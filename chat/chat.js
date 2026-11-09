require("dotenv").config();

const express = require("express");
const http = require("http");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

const DB = path.join(__dirname, "data", "users.json");
const SECRET = process.env.JWT_SECRET;

if (!SECRET) {
    console.error("JWT_SECRET topilmadi!");
    process.exit(1);
}

// 2 daqiqalik blok tizimi
const mutedUsers = new Map();
const BLOCK_TIME = 2 * 60 * 1000;

// Bu ro'yxatga taqiqlangan so'zlarni qo'shing
const badWords = [
    "so'kinish1",
    "so'kinish2",
    "haqorat1"
];

function normalize(text) {
    return text
        .toLowerCase()
        .replace(/[.,!?;:*_]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function containsBadWord(message) {
    const text = normalize(message);

    return badWords.some(word =>
        text.includes(normalize(word))
    );
}

function readUsers() {
    return JSON.parse(fs.readFileSync(DB, "utf8"));
}

function saveUsers(data) {
    fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}

function createToken(user) {
    return jwt.sign(
        { id: user.id, username: user.username },
        SECRET,
        { expiresIn: "7d" }
    );
}

// RO'YXATDAN O'TISH
app.post("/register", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return res.status(400).json({
                error: "Login 3-20 belgi bo'lsin."
            });
        }

        if (password.length < 8 || password.length > 72) {
            return res.status(400).json({
                error: "Parol 8-72 belgi bo'lishi kerak."
            });
        }

        const data = readUsers();

        if (data.users.some(u =>
            u.username.toLowerCase() === username.toLowerCase()
        )) {
            return res.status(409).json({
                error: "Bu login band."
            });
        }

        const user = {
            id: require("crypto").randomUUID(),
            username,
            passwordHash: await bcrypt.hash(password, 12),
            plan: "FREE",
            createdAt: new Date().toISOString()
        };

        data.users.push(user);
        saveUsers(data);

        res.json({
            success: true,
            id: user.id,
            token: createToken(user),
            plan: user.plan
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server xatosi." });
    }
});

// AKKAUNTGA KIRISH
app.post("/login", async (req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const password = String(req.body.password || "");

        const data = readUsers();
        const user = data.users.find(u =>
            u.username.toLowerCase() === username.toLowerCase()
        );

        if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
            return res.status(401).json({
                error: "Login yoki parol noto'g'ri."
            });
        }

        res.json({
            success: true,
            id: user.id,
            token: createToken(user),
            plan: user.plan
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server xatosi." });
    }
});

// CHATGA AKKAUNT ORQALI ULANISH
io.use((socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        const user = jwt.verify(token, SECRET);
        socket.user = user;
        next();
    } catch {
        next(new Error("Avval akkauntga kiring."));
    }
});

// FOYDALANUVCHINI LOGIN ORQALI QIDIRISH
app.get("/search/:username", (req, res) => {
    try {
        const username = String(req.params.username || "").trim();

        const data = readUsers();

        const user = data.users.find(u =>
            u.username.toLowerCase() === username.toLowerCase()
        );

        if (!user) {
            return res.status(404).json({
                error: "Foydalanuvchi topilmadi!"
            });
        }

        res.json({
            id: user.id,
            username: user.username,
            plan: user.plan
        });

    } catch (error) {
        res.status(500).json({
            error: "Server xatosi!"
        });
    }});
// ONLAYN FOYDALANUVCHILAR
const onlineUsers = new Map();

app.get("/online", (req, res) => {
    res.json({
        count: onlineUsers.size,
        users: Array.from(onlineUsers.values())
    });
});
// XABARLAR
io.on("connection", socket => {
onlineUsers.set(socket.user.id, {
    id: socket.user.id,
    username: socket.user.username
});   
 socket.join(socket.user.id);

    console.log("Ulandi:", socket.user.username);

    socket.on("private_message", data => {
    if (!data ||
        typeof data.to !== "string" ||
        typeof data.message !== "string") {
        return;
    }

        const message = data.message.trim();

        if (!message || message.length > 2000) {
            return;
        }

        // Foydalanuvchi bloklanganmi?
        const mutedUntil = mutedUsers.get(socket.user.id);

        if (mutedUntil && Date.now() < mutedUntil) {
            socket.emit("blocked", {
                message: "Siz 2 daqiqaga bloklangansiz!"
            });
            return;
        }

        // Blok muddati tugaganmi?
        if (mutedUntil && Date.now() >= mutedUntil) {
            mutedUsers.delete(socket.user.id);
        }

        // Taqiqlangan so'z tekshiruvi
        if (containsBadWord(message)) {
            mutedUsers.set(
                socket.user.id,
                Date.now() + BLOCK_TIME
            );

            socket.emit("blocked", {
                message: "Taqiqlangan so'z yozdingiz! 2 daqiqaga bloklandingiz."
            });

            console.log(
                "2 daqiqaga bloklandi:",
                socket.user.username
            );

            return;
        }

        const users = readUsers().users;
        const recipient = users.find(u => u.id === data.to);

        if (!recipient) {
            socket.emit("message_error", {
                message: "Foydalanuvchi topilmadi."
            });
            return;
        }

        io.to(recipient.id).emit("private_message", {
            from: socket.user.username,
            message
        });
    });

    socket.on("disconnect", () => {
        console.log("Chiqdi:", socket.user.username);
    });
});

app.get("/", (req, res) => {
    res.send("JARVIS ACCOUNT SERVER ISHLAYAPTI!");
});

server.listen(3002, "127.0.0.1", () => {
    console.log("JARVIS ACCOUNT SERVER ISHLADI!");
    console.log("Port: 3002");
});

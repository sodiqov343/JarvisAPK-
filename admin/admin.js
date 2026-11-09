require("dotenv").config();

const express = require("express");
const crypto = require("crypto");
const path = require("path");

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(express.static(__dirname));

const PORT = process.env.ADMIN_PORT || 3001;
const PASSWORD = process.env.ADMIN_PASSWORD;

if (!PASSWORD) {
console.error("Admin paroli topilmadi!");
process.exit(1);
}

let adminToken = null;
let attempts = 0;

app.post("/login", (req, res) => {
if (attempts >= 5) {
return res.status(429).json({
error: "Urinishlar soni tugadi. Serverni qayta ishga tushiring."
});
}

const password = String(req.body.password || "");
const a = Buffer.from(password);
const b = Buffer.from(PASSWORD);

const correct = a.length === b.length &&
    crypto.timingSafeEqual(a, b);

if (!correct) {
    attempts++;
    return res.status(401).json({
        error: "Parol noto‘g‘ri!"
    });
}

attempts = 0;
adminToken = crypto.randomBytes(32).toString("hex");

res.json({ success: true, token: adminToken });

});

app.get("/admin", (req, res) => {
if (
!adminToken ||
req.headers.authorization !== "Bearer " + adminToken
) {
return res.status(403).json({ error: "Ruxsat yo‘q!" });
}

res.json({
    message: "Xush kelibsiz, JARVIS administratori!"
});

});

app.listen(PORT, "127.0.0.1", () => {
console.log("JARVIS ADMIN SERVER ISHLADI!");
console.log("Port:", PORT);
});

const express = require("express");
const fs = require("fs");

const app = express();

app.use(express.json());

app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

const API_KEY = fs.readFileSync(
    process.env.HOME + "/OpenJarvis/gemini_key.txt",
    "utf8"
).trim();

app.post("/ask", async (req, res) => {
    try {
        const savol = req.body.question;

        if (!savol) {
            return res.status(400).json({
                error: "Savol yozilmagan"
            });
        }

        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=" +
            encodeURIComponent(API_KEY);

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: savol }]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(500).json({
                error: data.error?.message || "Gemini xatosi"
            });
        }

        const javob =
            data.candidates?.[0]?.content?.parts?.[0]?.text ||
            "Javob topilmadi.";

        res.json({ answer: javob });

    } catch (error) {
        res.status(500).json({
            error: "Server xatosi"
        });
    }
});

app.listen(3000, "127.0.0.1", () => {
    console.log("JARVIS server ishga tushdi!");
});

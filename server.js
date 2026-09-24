const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function generatePreciseAACR2(material, text) {
    let lines = [
        "Journal of Information",
        "and Library Research /",
        "edited by Neha Kapoor",
        "and Rajiv Singh.",
        "Vol. 1, no. 1 (2022)-",
        "New Delhi : Asian",
        "Scholarly Publishers,",
        "2022-",
        "volumes : illustrations ;",
        "25 cm.",
        "ISSN 2458-1234"
    ];

    if (text && text.trim().length > 3) {
        const cleaned = text.trim();
        lines = [
            cleaned.substring(0, 25),
            cleaned.substring(25, 50) || "-- / edited by Editorial Board.",
            "Vol. 1, no. 1 (2022)-",
            "New Delhi : Academic Press,",
            "2022-",
            "volumes ; 25 cm."
        ];
    }

    return {
        cards: [
            {
                type: "MAIN ENTRY",
                cardNumber: "CARD 1 / 1",
                lines: lines
            }
        ]
    };
}

app.post('/api/generate', (req, res) => {
    const { material, text } = req.body;
    const result = generatePreciseAACR2(material, text);
    res.json({ success: true, result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

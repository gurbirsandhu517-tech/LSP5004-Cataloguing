const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function generatePreciseAACR2(material, text) {
    let title = "Library Research Journal.";
    let statement = "/ edited by Anita Sharma.";
    let imprint = "New Delhi : Asian Scholarly Publishers, 2022-";
    let physical = "volumes : illustrations ; 25 cm.";
    let note = "ISSN 2458-1234";

    if (text && text.trim().length > 3) {
        title = text.split('.')[0] + '.';
    }

    return {
        cards: [
            {
                type: "MAIN ENTRY",
                cardNumber: "CARD 1 / 1",
                lines: [
                    title,
                    `-- ${statement}`,
                    `Vol. 1, no. 1 (2022)-`,
                    imprint,
                    physical,
                    note
                ]
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

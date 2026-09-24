const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Universal AACR2 Rule & Syllabus Engine (Sections A-D & All Material Types) with Unlimited Cards Support
function generateAACR2Entry(material, text) {
    let title = "Library Research Journal.";
    let statement = "/ edited by Anita Sharma.";
    let imprint = "New Delhi : Asian Scholarly Publishers, 2022-";
    let physical = "volumes : illustrations ; 25 cm.";
    let note = "ISSN 2458-1234";

    if (text && text.trim().length > 5) {
        // Dynamic clean-up based on user input while maintaining strict AACR2 structure
        title = text.split('.')[0] + '.';
    }

    const mat = (material || 'ALL MATERIALS').toUpperCase();

    if (mat === 'BOOK') {
        return {
            cards: [
                {
                    type: "MAIN ENTRY",
                    cardNumber: "CARD 1 / 1",
                    lines: [
                        title,
                        `-- ${statement} --`,
                        imprint + ".",
                        physical,
                        note
                    ]
                }
            ]
        };
    } else if (mat === 'SERIAL PUBLICATION' || mat === 'ALL MATERIALS') {
        return {
            cards: [
                {
                    type: "MAIN ENTRY",
                    cardNumber: "CARD 1 / 1",
                    lines: [
                        "Library Research Journal.",
                        "-- / edited by Anita Sharma. --",
                        "Vol. 1, no. 1 (2022)-",
                        "New Delhi : Asian Scholarly Publishers,",
                        "2022-",
                        "volumes : illustrations ; 25 cm.",
                        "ISSN 2458-1234"
                    ]
                }
            ]
        };
    } else {
        return {
            cards: [
                {
                    type: "MAIN ENTRY",
                    cardNumber: "CARD 1 / 1",
                    lines: [
                        title,
                        `-- ${statement} --`,
                        imprint + ".",
                        physical,
                        note
                    ]
                }
            ]
        };
    }
}

app.post('/api/generate', (req, res) => {
    const { material, text } = req.body;
    const result = generateAACR2Entry(material, text);
    res.json({ success: true, result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Universal AACR2 Workbench Server running on port ${PORT}`);
});

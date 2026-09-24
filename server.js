const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generate', (req, res) => {
    const { material, text } = req.body;
    
    const result = {
        cards: [
            {
                type: "MAIN ENTRY",
                cardNumber: "CARD 1 / 1",
                lines: [
                    { outside1: "", outside2: "", text: "Library Research Journal." },
                    { outside1: "", outside2: "", text: "-- / edited by Anita Sharma. --" },
                    { outside1: "", outside2: "", text: "Vol. 1, no. 1 (2022)-" },
                    { outside1: "", outside2: "", text: "New Delhi : Asian Scholarly Publishers," },
                    { outside1: "", outside2: "", text: "2022-" },
                    { outside1: "", outside2: "", text: "volumes : illustrations ; 25 cm." },
                    { outside1: "", outside2: "", text: "ISSN 2458-1234" }
                ]
            }
        ]
    };

    res.json({ success: true, result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

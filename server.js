const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Universal AACR2 Cataloging Engine supporting Books, Serials, Monographs, etc.
function generateUniversalCatalogEntry(data) {
    let materialType = data.materialType ? data.materialType.toLowerCase() : "book";
    let title = data.title ? data.title.trim() : "Default Title";
    
    // Clean any unwanted prefix phrases
    title = title.replace(/^(the serial publication|publication|book)\s+/i, '');

    let statementOfResponsibility = data.editor || data.author ? `/ by ${data.author || data.editor}.` : "";
    let imprintPlace = data.place || "New Delhi";
    let publisher = data.publisher || "Academic Publishers";
    let year = data.year || "2026";
    
    if (materialType === 'serial' || materialType === 'journal') {
        let designation = data.designation || "Vol. 1, no. 1 (2026)-";
        let physicalDesc = "volumes : illustrations ; 25 cm.";
        let issn = data.issn ? `ISSN ${data.issn}` : "ISSN 2581-6742";
        return {
            formatted: `${title}. -- ${statementOfResponsibility} --\n${designation}\n${imprintPlace} : ${publisher}, ${year}-\n${physicalDesc}\n${issn}`
        };
    } else {
        // Standard Book / Monograph AACR2 format
        let pages = data.pages || "xiv, 250 p.";
        let illustration = data.illustration || "ill.";
        let cm = data.cm || "22 cm.";
        let isbn = data.isbn ? `ISBN ${data.isbn}` : "ISBN 978-81-90000-00-1";
        return {
            formatted: `${title}. -- ${statementOfResponsibility} --\n${imprintPlace} : ${publisher}, ${year}.\n${pages} : ${illustration} ; ${cm}\n${isbn}`
        };
    }
}

app.post('/api/generate', (req, res) => {
    const entry = generateUniversalCatalogEntry(req.body);
    res.json({ success: true, entry });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Universal AACR2 Server running on port ${PORT}`);
});

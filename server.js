const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/generate', (req, res) => {
    const { material, text } = req.body;
    let result = "International Journal of Digital Library and Information Studies / edited by Anjali Mehta.\nVol. 1, no. 1 (January-February 2018)-.\nNew Delhi : Centre for Library and Information Studies, 2018-.\nBimonthly.\nISSN 2581-6742.";
    
    if (material && material.toUpperCase() === 'BOOK') {
        result = "Library Research Methods / by Anita Sharma. -- New Delhi : Academic Publishers, 2022.\nxiv, 250 p. : ill. ; 22 cm.\nISBN 978-81-90000-00-1.";
    } else if (material && material.toUpperCase() === 'MOTION PICTURE') {
        result = "[Uniform Title] -- Motion Picture Title / produced by Studio Name. -- [Place] : Publisher, 2023.\n1 motion reel (120 min.) : sd., col. ; 35 mm.";
    }

    res.json({ success: true, result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

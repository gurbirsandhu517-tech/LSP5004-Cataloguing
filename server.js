const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err && !res.headersSent) {
      console.error("public/index.html missing:", err.message);
      res.status(500).send("Website file missing: public/index.html");
    }
  });
});

app.post("/generate-pdf", (req, res) => {
  const {
    section,
    materialType,
    title,
    entry,
    subject,
    accessPoints,
    verification,
    missing
  } = req.body;

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="LSP5004-catalogue-entry.pdf"'
  );

  doc.pipe(res);

  doc.fontSize(16).text(
    "LSP5004: KNOWLEDGE ORGANISATION ADVANCED LIBRARY CATALOGUING",
    { align: "center" }
  );
  doc.fontSize(11).text("(PRACTICE)", { align: "center" });
  doc.moveDown();

  doc.fontSize(11).text(`Section: ${section || "Not specified"}`);
  doc.text(`Material Type: ${materialType || "Not specified"}`);
  doc.text(`Title: ${title || "Not provided"}`);
  doc.moveDown();

  doc.fontSize(14).text("CATALOGUE ENTRY");
  doc.moveDown();
  doc.fontSize(11).text(entry || "No catalogue entry generated.");
  doc.moveDown();

  doc.fontSize(12).text("SUBJECT HEADING(S)");
  doc.fontSize(11).text(subject || "Not provided / requires verification.");
  doc.moveDown();

  doc.fontSize(12).text("ADDED ENTRIES / ACCESS POINTS");
  doc.fontSize(11).text(accessPoints || "None supplied.");
  doc.moveDown();

  doc.fontSize(12).text("AACR2 / CATALOGUING VERIFICATION");
  doc.fontSize(11).text(verification || "Requires verification.");
  doc.moveDown();

  doc.fontSize(12).text("MISSING / UNVERIFIED INFORMATION");
  doc.fontSize(11).text(missing || "None reported.");

  doc.end();
});

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"), (err) => {
    if (err && !res.headersSent) {
      res.status(404).send("Page not found.");
    }
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LSP5004 Cataloguing website running on port ${PORT}`);
});

const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

app.post("/generate-pdf", (req, res) => {
  const {
    section,
    materialType,
    title,
    responsibility,
    edition,
    publication,
    physical,
    notes,
    entry,
    missing,
    verification
  } = req.body;

  const doc = new PDFDocument({ size: "A4", margin: 50 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="LSP5004-catalogue-entry.pdf"'
  );

  doc.pipe(res);

  doc.fontSize(16).text(
    "LSP5004: KNOWLEDGE ORGANISATION & ADVANCED LIBRARY CATALOGUING",
    { align: "center" }
  );
  doc.fontSize(11).text("(PRACTICE CATALOGUE ENTRY)", { align: "center" });
  doc.moveDown();

  doc.fontSize(10);
  doc.text(`Section: ${section || "Not supplied"}`);
  doc.text(`Material Type: ${materialType || "Not supplied"}`);
  doc.moveDown();

  doc.fontSize(14).text("CATALOGUE ENTRY");
  doc.moveDown(0.4);
  doc.fontSize(11).text(entry || "No entry generated.", { lineGap: 3 });
  doc.moveDown();

  const fields = [
    ["Title Proper", title],
    ["Statement of Responsibility", responsibility],
    ["Edition Statement", edition],
    ["Publication Statement", publication],
    ["Physical Description", physical],
    ["Notes / Other Information", notes],
    ["Missing / Unverified Information", missing]
  ];

  for (const [label, value] of fields) {
    doc.fontSize(11).font("Helvetica-Bold").text(label);
    doc.font("Helvetica").text(value || "Not supplied");
    doc.moveDown(0.55);
  }

  doc.font("Helvetica-Bold").text("AACR2 PRACTICE CHECK");
  doc.font("Helvetica").text(
    verification || "Verify the final description against authorised course/reference material."
  );

  doc.end();
});

app.use((req, res) => {
  res.status(404).send("Page not found.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LSP5004 Cataloguing website running on port ${PORT}`);
});

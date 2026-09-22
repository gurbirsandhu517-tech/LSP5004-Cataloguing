const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, "public");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.static(publicPath));

app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

app.post("/generate", async (req, res) => {
  try {
    const { question, section = "A" } = req.body || {};
    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Please paste the complete cataloguing question." });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({
        error: "Gemini API is not configured. Add GEMINI_API_KEY in Render → Environment."
      });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const prompt = `You are a library cataloguing practice assistant for LSP5004.\n\nSection: ${section}\n\nRead the COMPLETE question below and extract only information actually supplied in it. Do not invent, guess, or silently add bibliographic facts. Produce a practice catalogue entry using AACR2 terminology where appropriate. If a field is absent, say Not supplied. This is a practice assistant; final work must be checked against the student's authorised cataloguing rules/reference.\n\nReturn ONLY valid JSON matching the requested schema.\n\nCOMPLETE QUESTION:\n${question}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            materialType: { type: Type.STRING },
            title: { type: Type.STRING },
            responsibility: { type: Type.STRING },
            edition: { type: Type.STRING },
            publication: { type: Type.STRING },
            physical: { type: Type.STRING },
            notes: { type: Type.STRING },
            entry: { type: Type.STRING },
            missing: { type: Type.STRING },
            verification: { type: Type.STRING }
          },
          required: ["materialType","title","responsibility","edition","publication","physical","notes","entry","missing","verification"]
        }
      }
    });

    let result;
    try {
      result = JSON.parse(response.text);
    } catch {
      return res.status(502).json({ error: "Gemini returned an invalid response. Please try again." });
    }

    result.section = section;
    res.json(result);
  } catch (error) {
    console.error("Gemini generation error:", error);
    res.status(500).json({ error: "Gemini could not generate the catalogue entry. Please try again." });
  }
});

app.post("/generate-pdf", (req, res) => {
  const { section, materialType, title, responsibility, edition, publication, physical, notes, entry, missing, verification } = req.body || {};
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="LSP5004-catalogue-entry.pdf"');
  doc.pipe(res);

  doc.fontSize(16).text("LSP5004: KNOWLEDGE ORGANISATION & ADVANCED LIBRARY CATALOGUING", { align: "center" });
  doc.fontSize(11).text("(PRACTICE CATALOGUE ENTRY)", { align: "center" });
  doc.moveDown();
  doc.fontSize(10).text(`Section: ${section || "Not supplied"}`);
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
  doc.font("Helvetica").text(verification || "Verify against authorised course/reference material.");
  doc.end();
});

app.use((req, res) => res.status(404).send("Page not found."));
app.listen(PORT, "0.0.0.0", () => console.log(`LSP5004 Cataloguing website running on port ${PORT}`));

const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");
const { GoogleGenAI } = require("@google/genai");
const Groq = require("groq-sdk");

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, "public");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(publicPath));
app.get("/", (req, res) => res.sendFile(path.join(publicPath, "index.html")));

const schema = {
  type: "object",
  properties: {
    materialType: { type: "string" },
    title: { type: "string" },
    responsibility: { type: "string" },
    edition: { type: "string" },
    publication: { type: "string" },
    physical: { type: "string" },
    notes: { type: "string" },
    subjectHeadings: { type: "string" },
    accessPoints: { type: "string" },
    mainEntry: { type: "string" },
    entry: { type: "string" },
    missing: { type: "string" },
    verification: { type: "string" }
  },
  required: [
    "materialType", "title", "responsibility", "edition", "publication",
    "physical", "notes", "subjectHeadings", "accessPoints", "mainEntry", "entry",
    "missing", "verification"
  ]
};

const SYSTEM_PROMPT = `You are an LSP5004 library cataloguing practice assistant.

Read the COMPLETE assignment question. Extract and use ONLY bibliographic facts actually supplied in it.
Never invent author names, publishers, dates, places, editions, physical details, series, notes or other bibliographic facts.
If a field is absent, write "Not supplied".

Prepare a professional PRACTICE catalogue entry using AACR2 terminology and appropriate cataloguing punctuation where possible.
Include:
- material type
- title proper
- statement of responsibility
- edition statement
- publication statement
- physical description
- notes
- subject headings/access points only when supported by the supplied question
- added entries/access points
- missing/unverified information
- concise AACR2 practice check

Do not silently add information from general knowledge.
Do not claim a rule is verified if it is not.
The supplied question is the primary factual source.

Return ONLY valid JSON with exactly these keys. If the question requests multiple catalogue entries, include ONLY those requested entries in "entry"; never add extra entries. "mainEntry" is the heading/first line of the first requested entry.
materialType, title, responsibility, edition, publication, physical, notes,
subjectHeadings, accessPoints, entry, missing, verification.

For every missing field use "Not supplied".`;

function buildPrompt(question, section, materialType) {
  return `${SYSTEM_PROMPT}

SECTION: ${section}
MATERIAL TYPE SELECTED: ${materialType}

COMPLETE QUESTION:
${question}`;
}

function cleanJsonText(text) {
  if (!text) throw new Error("Empty AI response.");
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first >= 0 && last > first) s = s.slice(first, last + 1);

  return JSON.parse(s);
}

function normalizeResult(result, section, provider) {
  const keys = [
    "materialType", "title", "responsibility", "edition", "publication",
    "physical", "notes", "subjectHeadings", "accessPoints", "entry",
    "missing", "verification"
  ];
  const out = {};
  for (const k of keys) out[k] = result?.[k] == null ? "Not supplied" : String(result[k]);
  out.section = section;
  out.provider = provider;
  return out;
}

async function generateWithGemini(question, section, materialType) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("Gemini key not configured.");

  const ai = new GoogleGenAI({ apiKey });

  const response = await ai.models.generateContent({
    model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
    contents: buildPrompt(question, section, materialType),
    config: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.1
    }
  });

  return normalizeResult(cleanJsonText(response.text), section, "Gemini");
}

async function generateWithGroq(question, section, materialType) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("Groq key not configured.");

  const groq = new Groq({ apiKey });

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    temperature: 0.1,
    max_completion_tokens: 2500,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: `SECTION: ${section}
MATERIAL TYPE SELECTED: ${materialType}

COMPLETE QUESTION:
${question}`
      }
    ]
  });

  const text = completion.choices?.[0]?.message?.content;
  return normalizeResult(cleanJsonText(text), section, "Groq");
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    pdf: true
  });
});

app.post("/generate", async (req, res) => {
  const { question, section = "A", materialType = "Not specified" } = req.body || {};
  if (!question || !String(question).trim()) {
    return res.status(400).json({ error: "Please paste the complete cataloguing question." });
  }

  const errors = [];

  // Gemini is primary. Groq is used only if Gemini is unavailable, errors, or quota-limited.
  try {
    const result = await generateWithGemini(String(question).trim(), section, materialType);
    return res.json(result);
  } catch (error) {
    console.error("Gemini failed:", error?.message || error);
    errors.push(`Gemini: ${error?.message || "request failed"}`);
  }

  try {
    const result = await generateWithGroq(String(question).trim(), section, materialType);
    result.verification = `${result.verification} Provider used: Groq fallback because Gemini was unavailable or failed.`;
    return res.json(result);
  } catch (error) {
    console.error("Groq failed:", error?.message || error);
    errors.push(`Groq: ${error?.message || "request failed"}`);
  }

  return res.status(503).json({
    error: "Both AI providers failed. Add/check GEMINI_API_KEY and GROQ_API_KEY in Render → Environment, then redeploy.",
    details: errors
  });
});

function pdfSafe(value) {
  return String(value ?? "Not supplied")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201C|\u201D/g, '"')
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00A0/g, " ");
}

app.post("/generate-pdf", (req, res) => {
  try {
    const {
      section, materialType, title, responsibility, edition, publication,
      physical, notes, subjectHeadings, accessPoints, entry, missing, verification
    } = req.body || {};

    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      info: {
        Title: "LSP5004 Catalogue Entry",
        Author: "LSP5004 Cataloguing Practice"
      }
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="LSP5004-catalogue-entry.pdf"'
    );

    doc.pipe(res);

    doc.font("Helvetica-Bold")
      .fontSize(15)
      .text("LSP5004: KNOWLEDGE ORGANISATION & ADVANCED LIBRARY CATALOGUING", {
        align: "center"
      });
    doc.moveDown(0.3);
    doc.font("Helvetica")
      .fontSize(10)
      .text("(PRACTICE CATALOGUE ENTRY)", { align: "center" });
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(10).text(`Section: ${pdfSafe(section)}`);
    doc.font("Helvetica").text(`Material Type: ${pdfSafe(materialType)}`);
    doc.moveDown();

    doc.font("Helvetica-Bold").fontSize(13).text("CATALOGUE ENTRY");
    doc.moveDown(0.35);
    doc.font("Helvetica").fontSize(11)
      .text(pdfSafe(entry || "No entry generated."), { lineGap: 3, width: 500 });
    doc.moveDown();

    const fields = [
      ["Title Proper", title],
      ["Statement of Responsibility", responsibility],
      ["Edition Statement", edition],
      ["Publication Statement", publication],
      ["Physical Description", physical],
      ["Notes", notes],
      ["Subject Headings / Access Points", subjectHeadings],
      ["Added Entries / Access Points", accessPoints],
      ["Missing / Unverified Information", missing],
      ["AACR2 Practice Check", verification]
    ];

    for (const [label, value] of fields) {
      doc.font("Helvetica-Bold").fontSize(10).text(label);
      doc.font("Helvetica").fontSize(10)
        .text(pdfSafe(value || "Not supplied"), { lineGap: 2, width: 500 });
      doc.moveDown(0.45);
    }

    doc.fontSize(8)
      .fillColor("#666666")
      .text(
        "Practice output only. Verify against the authorised course/reference material.",
        { align: "center" }
      );

    doc.end();
  } catch (error) {
    console.error("PDF generation error:", error);
    if (!res.headersSent) res.status(500).json({ error: "PDF generation failed." });
  }
});

app.use((req, res) => res.status(404).send("Page not found."));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`LSP5004 Cataloguing website running on port ${PORT}`);
});

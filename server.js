const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const publicPath = path.join(__dirname, "public");

app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(express.static(publicPath, { etag: false, maxAge: 0, setHeaders: (res) => res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate") }));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const SYSTEM_PROMPT = `You are an expert AACR2 library-cataloguing practice assistant for LSP5004.
Read the COMPLETE assignment question and use ONLY facts explicitly supplied in it.
Never invent bibliographic facts. If a field is absent, write "Not supplied".
Use AACR2 terminology and cataloguing punctuation appropriate to the material type.
For serial publications, preserve the supplied title proper, statement of responsibility, edition, and publication information.
Return ONLY valid JSON with these keys:
section, materialType, title, responsibility, edition, publication, physical, notes, subjectHeadings, accessPoints, missing, verification, entry.`;

function text(x) { return x == null ? "" : String(x).trim(); }
function safe(x, fallback = "Not supplied") { return text(x) || fallback; }

function extractJson(raw) {
  let s = text(raw).replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  try { return JSON.parse(s); } catch (_) {}
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch (_) {}
  }
  throw new Error("AI returned invalid JSON.");
}

function normalise(r, section, materialType, provider) {
  const requestedEntries = Array.isArray(r?.requestedEntries) ? r.requestedEntries
    .filter(x => x && (text(x.label) || text(x.value)))
    .map(x => ({ label: safe(x.label, "Requested entry"), value: safe(x.value) })) : [];
  return {
    section: safe(r?.section, section || "A"), materialType: safe(r?.materialType, materialType || "Serial Publication"),
    title: safe(r?.title), responsibility: safe(r?.responsibility), edition: safe(r?.edition), publication: safe(r?.publication),
    physical: safe(r?.physical), notes: safe(r?.notes), subjectHeadings: safe(r?.subjectHeadings), accessPoints: safe(r?.accessPoints),
    missing: safe(r?.missing, "None reported"), verification: safe(r?.verification, "Check against authorised AACR2/course reference."),
    requestedEntries, entry: safe(r?.entry, "No catalogue entry generated."), provider: provider || "Local fallback"
  };
}

function field(question, label) {
  const re = new RegExp("(?:^|\\n|\\r)\\s*" + label.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&") + "\\s*:\\s*(.+?)(?=\\n\\s*[A-Za-z][A-Za-z /_-]*\\s*:|$)", "i");
  const m = question.match(re);
  return m ? text(m[1]).replace(/\s+/g, " ") : "";
}

function localFallback(question, section, materialType) {
  const title = field(question, "Title proper") || field(question, "Title") || "";
  const responsibility = field(question, "Statement of responsibility");
  const edition = field(question, "Edition statement") || field(question, "Edition");
  const place = field(question, "Place of publication") || field(question, "Place");
  const publisher = field(question, "Publisher");
  const date = field(question, "Date of publication") || field(question, "Date");
  const physical = field(question, "Physical description") || field(question, "Physical");
  const notes = field(question, "Notes");

  const entryParts = [];
  if (title) entryParts.push(title);
  else entryParts.push("[Title not supplied]");
  if (responsibility) entryParts.push(` / ${responsibility}`);
  if (edition) entryParts.push(`. — ${edition}`);
  if (place || publisher || date) {
    entryParts.push(`. — ${place || "[place not supplied]"} : ${publisher || "[publisher not supplied]"}, ${date || "[date not supplied]"}`);
  }
  if (physical) entryParts.push(`. — ${physical}`);
  if (notes) entryParts.push(`. — ${notes}`);
  entryParts.push(".");

  const missing = [];
  if (!title) missing.push("Title proper");
  if (!responsibility) missing.push("Statement of responsibility");
  if (!edition) missing.push("Edition statement");
  if (!place) missing.push("Place of publication");
  if (!publisher) missing.push("Publisher");
  if (!date) missing.push("Date of publication");
  if (!physical) missing.push("Physical description");

  const requestedEntries = [];
  const ql = question.toLowerCase();
  if (/\bmain\s+entr(?:y|ies)\b/.test(ql) || /main entry/.test(ql)) requestedEntries.push({label:"Main Entry", value: title || "Not supplied"});
  if (/\bsubject\s+entr(?:y|ies)\b/.test(ql) || /subject heading/.test(ql)) requestedEntries.push({label:"Subject Entry / Subject Heading", value:"Not supplied"});
  if (/\badded\s+entr(?:y|ies)\b/.test(ql) || /added entry/.test(ql) || /access point/.test(ql)) requestedEntries.push({label:"Added Entry / Access Point", value: responsibility || "Not supplied"});
  if (/\bseries\s+entr(?:y|ies)\b/.test(ql) || /series statement/.test(ql)) requestedEntries.push({label:"Series Entry", value: field(question,"Series statement") || "Not supplied"});
  if (/\bcall\s+number\b/.test(ql)) requestedEntries.push({label:"Call Number", value:"Not supplied"});
  if (/\btracing\b/.test(ql)) requestedEntries.push({label:"Tracing", value:"Not supplied"});
  if (/\bphysical\s+description\b/.test(ql)) requestedEntries.push({label:"Physical Description", value: physical || "Not supplied"});

  return normalise({
    section,
    materialType,
    title: title || "Not supplied",
    responsibility: responsibility || "Not supplied",
    edition: edition || "Not supplied",
    publication: (place || publisher || date) ? `${place || "[place not supplied]"} : ${publisher || "[publisher not supplied]"}, ${date || "[date not supplied]"}.` : "Not supplied",
    physical: physical || "Not supplied",
    notes: notes || "Not supplied",
    subjectHeadings: "Not supplied",
    accessPoints: responsibility || "Not supplied",
    requestedEntries,
    missing: missing.length ? missing.join(", ") : "None reported",
    verification: "Local fallback entry assembled only from facts found in the supplied question. Verify punctuation and AACR2 rules against your authorised course/reference material.",
    entry: entryParts.join("")
  }, section, materialType, "Local fallback");
}

async function callGemini(question, section, materialType) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(key);
  const prompt = `${SYSTEM_PROMPT}\n\nSection: ${section}\nMaterial type: ${materialType}\n\nCOMPLETE QUESTION:\n${question}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Gemini HTTP ${response.status}`);
  const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  if (!raw) throw new Error("Gemini returned an empty response.");
  return extractJson(raw);
}

async function callGroq(question, section, materialType) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Section: ${section}\nMaterial type: ${materialType}\n\nCOMPLETE QUESTION:\n${question}` }
      ]
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || `Groq HTTP ${response.status}`);
  const raw = data?.choices?.[0]?.message?.content || "";
  if (!raw) throw new Error("Groq returned an empty response.");
  return extractJson(raw);
}

app.get("/version", (req, res) => res.json({ ok: true, version: "GENERATE-V4-QUESTION-FIELDS-20260923" }));

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY),
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    pdf: true
  });
});

app.post("/generate", async (req, res) => {
  const question = text(req.body?.question);
  const section = text(req.body?.section) || "A";
  const materialType = text(req.body?.materialType) || "Serial Publication";
  if (!question) return res.status(400).json({ error: "Please paste the complete cataloguing question first." });

  const errors = [];
  try {
    const r = await callGemini(question, section, materialType);
    return res.json(normalise(r, section, materialType, "Gemini"));
  } catch (e) { errors.push(`Gemini: ${e.message}`); console.error(errors.at(-1)); }

  try {
    const r = await callGroq(question, section, materialType);
    return res.json(normalise(r, section, materialType, "Groq"));
  } catch (e) { errors.push(`Groq: ${e.message}`); console.error(errors.at(-1)); }

  // Final safety net: the Generate button still produces an entry from supplied facts.
  const fallback = localFallback(question, section, materialType);
  fallback.verification += ` AI providers unavailable: ${errors.join(" | ")}`;
  return res.json(fallback);
});

function pdfSafe(value) {
  return String(value ?? "Not supplied").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/\u00A0/g, " ");
}

app.post("/generate-pdf", (req, res) => {
  const r = req.body || {};
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="LSP5004-catalogue-entry.pdf"');
  doc.pipe(res);
  doc.fontSize(16).text("LSP5004: KNOWLEDGE ORGANISATION ADVANCED LIBRARY CATALOGUING", { align: "center" });
  doc.fontSize(11).text("(PRACTICE)", { align: "center" });
  doc.moveDown();
  doc.fontSize(11).text(`Section: ${pdfSafe(r.section)}`);
  doc.text(`Material Type: ${pdfSafe(r.materialType)}`);
  doc.text(`Title: ${pdfSafe(r.title)}`);
  doc.moveDown();
  doc.fontSize(14).text("CATALOGUE ENTRY");
  doc.moveDown();
  doc.fontSize(11).text(pdfSafe(r.entry || "No catalogue entry generated."), { lineGap: 3 });
  doc.moveDown();
  for (const [label, value] of [
    ["SUBJECT HEADING(S)", r.subjectHeadings || r.subject],
    ["ADDED ENTRIES / ACCESS POINTS", r.accessPoints],
    ["AACR2 / CATALOGUING VERIFICATION", r.verification],
    ["MISSING / UNVERIFIED INFORMATION", r.missing]
  ]) {
    doc.fontSize(12).text(label);
    doc.fontSize(11).text(pdfSafe(value || "Not supplied."));
    doc.moveDown();
  }
  doc.end();
});

app.use((req, res) => res.status(404).send("Page not found."));

app.listen(PORT, "0.0.0.0", () => console.log(`LSP5004 Cataloguing running on port ${PORT}`));


const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "V10";

app.use(express.json({limit: "10mb"}));
app.use(express.urlencoded({extended:true, limit:"10mb"}));
app.use(express.static(path.join(__dirname, "public")));

const SYSTEM_PROMPT = `
You are an advanced library cataloguing assistant for LSP5004 practice.
Primary model: Gemini. Use Google Search grounding/verification when enabled.
The user's supplied question is authoritative for bibliographic facts. Do not invent
publisher, date, edition, dimensions, names, accession numbers, call numbers, or other
facts not supplied or legitimately derivable from the question/reference.

Use AACR2 cataloguing principles and the supplied catalogue-entry reference as the
formatting/practice basis. Decide entries from the question, not from a fixed template.
Only create an entry when it is justified by the question and AACR2 practice.

Return ONLY valid JSON with:
{
  "materialType": "...",
  "mainEntry": "...",
  "titleStatement": "...",
  "edition": "...",
  "imprint": "...",
  "physicalDescription": "...",
  "notes": "...",
  "callNumber": "...",
  "accessionNumber": "...",
  "addedEntries": [{"type":"...","heading":"...","reference":"..."}],
  "subjectEntries": [{"heading":"...","reference":"..."}],
  "seriesEntry": "...",
  "uniformTitleEntry": "...",
  "cards": [
    {
      "cardType":"Main Entry|Added Entry|Subject Entry|Series Entry|Uniform Title",
      "callNumber":"...",
      "accessionNumber":"...",
      "lines":["...","..."]
    }
  ],
  "verification": "...",
  "missing": ["..."]
}

Card rules:
- Standard physical catalogue card is 12.5 cm × 7.5 cm.
- Preserve catalogue-card line structure: call number/accession area, indented
  bibliographic description, then added/subject information only where applicable.
- Accession number, when supplied, belongs in the fifth-line position used by the
  practice layout; do not invent it.
- Call number must be placed in the filing/call-number block; do not invent one.
- The imprint, physical description, and notes must appear in their proper sequence.
- Create as many cards as the question genuinely requires. No artificial one-page limit.
- Long records continue onto additional cards/pages rather than being squeezed into one.
- Do not add generic labels such as "Added Entry" when the actual heading is known.
- Never fabricate an entry just to fill space.
`;

function cleanJsonText(t){
  if(!t) return "";
  t = t.trim().replace(/^```json/i,"").replace(/^```/,"").replace(/```$/,"").trim();
  const a=t.indexOf("{"), b=t.lastIndexOf("}");
  return (a>=0 && b>a) ? t.slice(a,b+1) : t;
}

function safeJson(t){
  try { return JSON.parse(cleanJsonText(t)); }
  catch(e){ return null; }
}

function fallback(question, section, materialType){
  const q = String(question || "").trim();
  const title = q.split("\n").map(s=>s.trim()).find(Boolean) || "Untitled item";
  return {
    materialType: materialType || "Not specified",
    mainEntry: "",
    titleStatement: title,
    edition: "",
    imprint: "",
    physicalDescription: "",
    notes: "",
    callNumber: "",
    accessionNumber: "",
    addedEntries: [],
    subjectEntries: [],
    seriesEntry: "",
    uniformTitleEntry: "",
    cards: [{
      cardType:"Main Entry",
      callNumber:"",
      accessionNumber:"",
      lines:[title]
    }],
    verification:"Gemini generation was not available; no unsupported bibliographic facts were added.",
    missing:["AI generation unavailable; verify the complete cataloguing answer."]
  };
}

async function geminiGenerate(question, section, materialType){
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if(!key) throw new Error("GEMINI_API_KEY is not configured.");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;

  const body = {
    systemInstruction: {parts:[{text:SYSTEM_PROMPT}]},
    contents: [{
      role:"user",
      parts:[{text:`Section: ${section || ""}\nMaterial type: ${materialType || ""}\n\nCATALOGUING QUESTION:\n${question}`}]
    }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json"
    },
    tools: [{google_search: {}}]
  };

  const r = await fetch(endpoint, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify(body)
  });
  const data = await r.json();
  if(!r.ok) throw new Error(data?.error?.message || `Gemini request failed (${r.status})`);

  const text = (data.candidates || [])
    .flatMap(c => (c.content?.parts || []))
    .map(p => p.text || "")
    .join("");

  const parsed = safeJson(text);
  if(!parsed) throw new Error("Gemini returned an invalid catalogue response.");
  parsed.provider = `Gemini ${model} + Google Search grounding`;
  return parsed;
}

app.post("/generate", async (req,res)=>{
  const {question, section, materialType} = req.body || {};
  if(!question || !String(question).trim())
    return res.status(400).json({error:"Please enter the complete cataloguing question."});

  try{
    const result = await geminiGenerate(String(question).trim(), section, materialType);
    res.json(result);
  }catch(err){
    console.error(err);
    // Safe fallback keeps the interface usable, but clearly marks that AI verification
    // was not completed instead of pretending an AACR2 answer was verified.
    const result = fallback(question, section, materialType);
    result.provider = "Fallback — Gemini unavailable";
    result.error = err.message;
    res.json(result);
  }
});

function drawCard(doc, card, cardNo, total){
  const W = 12.5 * 28.3464567;
  const H = 7.5 * 28.3464567;
  const margin = 12;
  const ruleX = 42;
  const top = 14;

  doc.rect(0,0,W,H).stroke();
  doc.moveTo(ruleX,0).lineTo(ruleX,H).stroke();
  doc.font("Helvetica").fontSize(6.5);
  doc.text(`CARD ${cardNo}${total ? " / " + total : ""}`, 47, 4, {width:W-52, align:"right"});

  const cn = card.callNumber || "";
  const an = card.accessionNumber || "";
  if(cn) doc.text(cn, 4, top, {width:34, align:"center"});
  if(an) doc.text(an, 4, 37, {width:34, align:"center"});

  let y = top + 12;
  doc.font("Courier").fontSize(7.3);
  for(const line of (card.lines || [])){
    if(y > H-14) break;
    doc.text(String(line), ruleX+7, y, {width:W-ruleX-12, lineGap:1});
    y += 9;
  }
}

app.post("/generate-pdf", (req,res)=>{
  const cards = Array.isArray(req.body.cards) ? req.body.cards : [];
  if(!cards.length) return res.status(400).json({error:"No catalogue cards available."});

  const W = 12.5 * 28.3464567;
  const H = 7.5 * 28.3464567;
  const doc = new PDFDocument({size:[W,H], margin:0, autoFirstPage:false});
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",'attachment; filename="LSP5004-catalogue-cards.pdf"');
  doc.pipe(res);

  cards.forEach((card,i)=>{
    doc.addPage({size:[W,H], margin:0});
    drawCard(doc, card, i+1, cards.length);
  });
  doc.end();
});

app.get("/version",(req,res)=>res.json({
  version:VERSION,
  cardSize:"12.5 × 7.5 cm",
  primary:"Gemini",
  verification:"Google Search grounding",
  pageLimit:"No artificial catalogue-card page limit"
}));

app.get("*",(req,res)=>{
  res.sendFile(path.join(__dirname,"public","index.html"));
});

app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 ${VERSION} running on ${PORT}`));

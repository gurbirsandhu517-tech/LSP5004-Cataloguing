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
Your job is to solve the COMPLETE assignment question exactly from the information supplied, regardless of whether it is written as a paragraph, bullets, numbered steps, labels, a table, a textbook exercise, or mixed wording.

MOST IMPORTANT OUTPUT RULE — COMPLETE CATALOGUE CARD:
- Read the whole question first and determine what kind of catalogue record/card the exercise requires.
- If the question asks for a complete catalogue entry/card, do NOT wait for the question to explicitly list every entry. Determine ALL catalogue entries/access points that should reasonably be made under AACR2 from the facts actually supplied.
- Include every applicable entry that the supplied facts justify, such as: main entry, title added entry, personal-name added entry/entries, corporate-body added entry/entries, subject entry/entries, series entry, uniform-title entry, and other appropriate added entries/access points.
- Do NOT create an entry merely because a field exists in the JSON schema. Include it only when the question/material and supplied facts make it applicable.
- Before finalising, audit every requestedEntries item: it must be either (1) explicitly required by the question, or (2) a genuine AACR2 catalogue entry/access point justified by a bibliographic fact in the question. Remove anything that is only a generic field, placeholder, duplicate, or unsupported addition.
- Never turn a descriptive field into a separate "entry" unless the question or AACR2 practice makes it an actual catalogue entry/access point. Imprint and physical description are description areas, not added entries.
- Do not create both a generic "Added Entry" row and the actual personal-name/corporate-body/title/series entry. Show the actual entry once.
- Do not invent subject headings simply to make the card look complete. If subject analysis is not requested or not supportable from the supplied facts, omit the subject entry rather than filling a placeholder.
- If the exercise explicitly asks for particular entries, include all of them even if the usual complete-card set would be different.
- Preserve the order requested by the question. When the question does not prescribe an order, use a conventional AACR2 practice-card order: main entry/heading, title and other title information, statement of responsibility, edition, publication/imprint, physical description, notes, subject headings, then added entries/access points.
- For added entries, identify the actual heading that would be entered (for example, “Walter, T.”, a corporate body, a series title, or a subject heading) rather than merely repeating “added entry”.
- For a personal-name main entry, give the proper filing heading in surname-first form when justified by the supplied information.
- For a title added entry, give the title as an entry, not a description of the title.
- For subjects, provide subject entries only when the question supplies enough information to establish them or explicitly asks for subject analysis. Do not invent controlled-vocabulary terms as if they were supplied facts; mark anything requiring authority-file/subject-list verification.
- For serials, distinguish the title proper from personal/corporate added entries and any series statement. Do not automatically treat an editor as the main entry when AACR2 practice would use the title as the main entry.
- For maps/non-book materials, include the applicable main/added entries, title, scale, mathematical data, physical description, notes, and other entries that the supplied exercise calls for. Follow the wording/structure of the exercise and do not replace it with a generic book template.
- The final visual card should contain separate ruled rows/lines for the applicable entries so it resembles a traditional catalogue card, including vertical and horizontal rules.

SOURCE / ACCURACY RULES:
- Treat the complete question as the source of bibliographic facts.
- Never invent names, dates, places, publishers, dimensions, series, subjects, call numbers, prices, or other bibliographic facts.
- You may apply standard AACR2 rules to facts that are actually supplied (for example, forming a surname-first personal-name heading).
- If a requested fact cannot be established from the question, write “Not supplied” or “Verification required”; do not guess.
- Preserve supplied wording where AACR2 requires transcription, especially title proper and statement of responsibility.
- Use AACR2 terminology and punctuation appropriate to the material type.

QUESTION PARSING:
- Identify every explicit task/subquestion in the complete question.
- If there are multiple titles/items/records, solve each separately and do not merge them.
- If there are (a), (b), (c) parts, preserve them.
- If a textbook/photo exercise demonstrates a particular card layout, reproduce the logical entry structure represented by that exercise from the supplied data.

Return ONLY valid JSON with these keys:
section, materialType, title, responsibility, edition, publication, physical, notes, subjectHeadings, accessPoints, requestedEntries, missing, verification, entry.
requestedEntries MUST be an array of objects with exactly: label, value.
Each requestedEntries object is one actual catalogue entry/access point or explicitly requested answer, not a generic field placeholder.
If a complete catalogue card is requested, requestedEntries should contain ALL applicable entries/access points you determine from the supplied facts, even if the question did not name each one individually.
The entry field must contain the principal complete catalogue-card text, with the main entry and subsequent catalogue information/access points clearly separated by lines. Use plain text; do not use Markdown tables.
FINAL AUDIT: Before returning JSON, compare every entry/access point with the supplied question. Keep only entries justified by the question and AACR2 practice; do not add decorative, generic, duplicate, or fabricated entries.
Do not add unrelated sections or invent fixed fields merely because they exist in this JSON schema.`;

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


function sourceFacts(question) {
  const q=text(question);
  const pick=(...labels)=>{ for(const label of labels){ const v=field(q,label); if(v) return v; } return ""; };
  return {
    title: pick("Title proper","Title"),
    responsibility: pick("Statement of responsibility"),
    edition: pick("Edition statement","Edition"),
    place: pick("Place of publication","Place"),
    publisher: pick("Publisher","Publication") && !/\bpublication\b/i.test(pick("Publisher","Publication")) ? pick("Publisher") : pick("Publisher"),
    date: pick("Date of publication","Date"),
    physical: pick("Physical description","Physical"),
    notes: pick("Notes"),
    series: pick("Series statement","Series")
  };
}

function fidelityClean(r, question) {
  const f=sourceFacts(question);
  const out={...r};
  // These descriptive areas must never acquire fabricated bibliographic facts.
  if(f.title) out.title=f.title;
  if(f.responsibility) out.responsibility=f.responsibility;
  if(f.edition) out.edition=f.edition;
  if(f.place || f.publisher || f.date) out.publication=`${f.place || "[place not supplied]"}${f.publisher ? ` : ${f.publisher}` : ""}${f.date ? `, ${f.date}` : ""}.`;
  else out.publication="Not supplied";
  if(f.physical) out.physical=f.physical;
  if(f.notes) out.notes=f.notes;
  if(f.series && /series/i.test(String(out.notes||""))) out.notes=String(out.notes);

  const items=Array.isArray(out.requestedEntries)?out.requestedEntries:[];
  out.requestedEntries=items.filter(x=>x && (text(x.label)||text(x.value))).map(x=>{
    const label=text(x.label).toLowerCase(); let value=text(x.value);
    if(label.includes("title") && !label.includes("series")) value=f.title || value;
    else if(label.includes("responsibility")) value=f.responsibility || value;
    else if(label.includes("edition")) value=f.edition || value;
    else if(label.includes("imprint") || label.includes("publication")) value=out.publication;
    else if(label.includes("physical")) value=f.physical || value;
    else if(label.includes("notes")) value=f.notes || value;
    else if(label.includes("series")) value=f.series || value;
    return {label:text(x.label),value:safe(value)};
  });
  // Remove common hallucinated publication details from the single prose entry when
  // the source explicitly supplied a structured set of facts.
  if(f.title){
    const parts=[f.title];
    if(f.responsibility) parts.push(` / ${f.responsibility}`);
    if(f.edition) parts.push(`. — ${f.edition}`);
    if(f.place || f.publisher || f.date) parts.push(`. — ${f.place || "[place not supplied]"}${f.publisher ? ` : ${f.publisher}` : ""}${f.date ? `, ${f.date}` : ""}`);
    if(f.physical) parts.push(`. — ${f.physical}`);
    if(f.notes) parts.push(`. — ${f.notes}`);
    out.entry=parts.join("")+".";
  }
  return out;
}

function normalise(r, section, materialType, provider) {
  // Keep the AI's actual catalogue entries. The earlier version replaced them
  // with a small keyword detector, which caused complete cards to lose valid
  // main/title/name/subject/series entries. We now only augment missing
  // explicitly requested entries and preserve the AI/question order.
  let requestedEntries = Array.isArray(r?.requestedEntries) ? r.requestedEntries
    .filter(x => x && (text(x.label) || text(x.value)))
    .map(x => ({ label: safe(x.label, "Requested entry"), value: safe(x.value) })) : [];
  const explicit = requestedEntryItems(r?.__question || "", r);
  const labels = new Set(requestedEntries.map(x => text(x.label).toLowerCase()));
  for (const item of explicit) {
    const key = text(item.label).toLowerCase();
    if (key && !labels.has(key)) {
      requestedEntries.push(item);
      labels.add(key);
    }
  }
  if (!requestedEntries.length) {
    requestedEntries = deriveCatalogueEntries(r?.__question || "", r);
  }
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

function deriveCatalogueEntries(question, r) {
  const q=text(question), ql=q.toLowerCase(), out=[];
  const add=(label,value)=>{ if(value && text(value)!=="Not supplied") out.push({label,value:text(value)}); };
  const title=text(r?.title), resp=text(r?.responsibility), subject=text(r?.subjectHeadings), access=text(r?.accessPoints), notes=text(r?.notes), physical=text(r?.physical), publication=text(r?.publication), edition=text(r?.edition);
  const complete=/\b(complete|full|prepare|catalogue\s+card|cataloging\s+card|cataloguing\s+card|catalogue\s+entry|cataloging\s+entry|cataloguing\s+entry)\b/i.test(ql);
  if(!complete && !/\bentry|heading|access point|tracing\b/i.test(ql)) return [{label:"Answer",value:text(r?.entry)||"Not supplied"}];

  // Main heading: use a supplied surname/name form when the model has one;
  // otherwise use the supplied responsibility statement without inventing a name.
  let main = text(r?.mainEntry) || "";
  if(!main && resp){
    const m=resp.match(/(?:edited\s+by|by|prepared\s+by|compiled\s+by|written\s+by|\bby)\s+(.+)/i);
    if(m) {
      const names=m[1].split(/\s+(?:and|&|;|,\s*and\s+)\s+/i).map(x=>x.trim()).filter(Boolean);
      if(names.length===1){
        const n=names[0].replace(/[.]+$/,'').trim().split(/\s+/);
        if(n.length>=2) main=n[n.length-1]+", "+n.slice(0,-1).join(" ");
      }
    }
  }
  if(main) add("Main Entry",main);
  if(title) add("Title Entry",title);
  if(resp) add("Statement of Responsibility",resp);
  if(edition) add("Edition Entry",edition);
  if(publication) add("Imprint / Publication",publication);
  if(physical) add("Physical Description",physical);
  if(notes) add("Notes",notes);
  if(subject && subject!=="Not supplied") add("Subject Entry / Subject Heading",subject);
  if(access && access!=="Not supplied") add("Added Entries / Access Points",access);
  return out;
}

function requestedEntryItems(question, r) {
  const q = text(question);
  const ql = q.toLowerCase();
  const out = [];
  const add = (label, value) => out.push({ label, value: safe(value) });
  const title = text(r?.title);
  const resp = text(r?.responsibility);
  const subject = text(r?.subjectHeadings);
  const access = text(r?.accessPoints);
  const series = field(q, "Series statement");

  // Prefer explicit subquestion/task wording and preserve its order.
  const patterns = [
    [/\b(main\s+entry(?:\s+heading)?|main\s+entry)\b/i, "Main Entry", resp || title],
    [/\btitle\s+entry\b/i, "Title Entry", title],
    [/\bsubject\s+(?:entry|heading|headings)\b/i, "Subject Entry / Subject Heading", subject],
    [/\b(?:added|additional)\s+entr(?:y|ies)\b/i, "Added Entry", access || resp],
    [/\bcorporate\s+author(?:ity)?\s+entry\b/i, "Corporate Author Entry", resp],
    [/\bauthor\s+entry\b/i, "Author Entry", resp],
    [/\bseries\s+entr(?:y|ies)\b/i, "Series Entry", series],
    [/\bcall\s+number\b/i, "Call Number", r?.callNumber],
    [/\btracing\b/i, "Tracing", r?.tracing],
    [/\bphysical\s+description\b/i, "Physical Description", r?.physical],
    [/\bnotes?\b/i, "Notes", r?.notes],
    [/\bcatalog(?:ue|uing)\s+card\b/i, "Catalogue Card", r?.entry],
    [/\bbibliographic\s+(?:description|record|entry)\b/i, "Bibliographic Description", r?.entry]
  ];
  const hits=[];
  for (const [re,label,value] of patterns) {
    const m=re.exec(q);
    if (m) hits.push({pos:m.index,label,value});
  }
  hits.sort((a,b)=>a.pos-b.pos);
  const seen=new Set();
  for (const h of hits) { if (!seen.has(h.label)) { seen.add(h.label); add(h.label,h.value); } }

  // Numbered/lettered subquestions that ask for an answer but don't contain a known catalogue label.
  const subq = [...q.matchAll(/(?:^|\n)\s*(\(?[a-z]\)|\d+[.)])\s+([^\n]+)/gi)];
  for (const m of subq) {
    const label=m[1]; const body=text(m[2]);
    if (!body || /^(title proper|statement of responsibility|edition statement|place of publication|publisher|date of publication|physical description)\s*:/i.test(body)) continue;
    if (!out.some(x=>x.label.startsWith(label))) add(`${label} Answer`, r?.entry || "Not supplied");
  }
  return out;
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

  const requestedEntries = deriveCatalogueEntries(question, {
    title: title || "Not supplied",
    responsibility: responsibility || "Not supplied",
    edition: edition || "Not supplied",
    publication: (place || publisher || date) ? `${place || "[place not supplied]"} : ${publisher || "[publisher not supplied]"}, ${date || "[date not supplied]"}.` : "Not supplied",
    physical: physical || "Not supplied",
    notes: notes || "Not supplied",
    subjectHeadings: "Not supplied",
    accessPoints: responsibility || "Not supplied",
    entry: entryParts.join("")
  });

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
  const response = await fetch(url, { signal: AbortSignal.timeout(28000),
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
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", { signal: AbortSignal.timeout(28000),
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

app.get("/version", (req, res) => res.json({ ok: true, version: "GENERATE-V9-AACR2-MULTICARD-12.5x7.5CM-20260923" }));

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
    r.__question = question; return res.json(normalise(fidelityClean(r, question), section, materialType, "Gemini"));
  } catch (e) { errors.push(`Gemini: ${e.message}`); console.error(errors.at(-1)); }

  try {
    const r = await callGroq(question, section, materialType);
    r.__question = question; return res.json(normalise(fidelityClean(r, question), section, materialType, "Groq"));
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
  const r=req.body||{};
  const entries=Array.isArray(r.requestedEntries)&&r.requestedEntries.length
    ? r.requestedEntries.map(x=>({label:pdfSafe(x?.label||"Entry"),value:pdfSafe(x?.value||"Not supplied")}))
    : [{label:"Catalogue Entry",value:pdfSafe(r.entry||"No catalogue entry generated.")}];

  // Standard card size requested for this course: 12.5 cm × 7.5 cm.
  // One PDF page is one physical catalogue card; additional content continues
  // automatically on as many card-pages as required.
  const CARD_W=12.5/2.54*72;
  const CARD_H=7.5/2.54*72;
  const doc=new PDFDocument({size:[CARD_W,CARD_H],margin:0,bufferPages:true});
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",'attachment; filename="LSP5004-catalogue-cards.pdf"');
  doc.pipe(res);

  const pad=8, gutter=22, labelW=96, contentW=CARD_W-pad*2-gutter;
  let cardNo=0;
  const usableTop=20, usableBottom=CARD_H-17;

  function startCard(continuation=false){
    cardNo++;
    if(cardNo>1) doc.addPage({size:[CARD_W,CARD_H],margin:0});
    doc.save().lineWidth(.7).rect(0.8,0.8,CARD_W-1.6,CARD_H-1.6).stroke().restore();
    doc.font("Helvetica-Bold").fontSize(6).text("LSP5004 · AACR2 PRACTICE",pad,3,{width:CARD_W-pad*2});
    doc.font("Helvetica").fontSize(5.5).text(continuation?"CATALOGUE CARD — CONTINUATION":"CATALOGUE CARD — ANSWER",pad,10,{width:CARD_W-pad*2});
    doc.font("Helvetica-Bold").fontSize(5.2).text(`CARD ${cardNo}`,CARD_W-42,10,{width:34,align:"right"});
    doc.moveTo(pad,18).lineTo(CARD_W-pad,18).stroke();
    // Traditional left filing/tracing gutter.
    doc.moveTo(pad+gutter,usableTop).lineTo(pad+gutter,usableBottom).stroke();
    // Light horizontal ruling inside the gutter.
    for(let yy=usableTop+14; yy<usableBottom; yy+=14) doc.moveTo(pad,yy).lineTo(pad+gutter,yy).stroke();
    return usableTop;
  }

  function rowHeight(label,value){
    doc.font("Helvetica-Bold").fontSize(5.7);
    const lh=doc.heightOfString(label,{width:labelW-gutter-8,lineGap:1});
    doc.font("Times-Roman").fontSize(7.2);
    const vh=doc.heightOfString(value,{width:CARD_W-pad-labelW-8,lineGap:1.4});
    return Math.max(18,lh+7,vh+7);
  }

  let y=startCard(false);
  for(const item of entries){
    const label=item.label, value=item.value;
    let h=rowHeight(label,value);
    if(y+h>usableBottom){
      doc.moveTo(pad,y).lineTo(CARD_W-pad,y).stroke();
      y=startCard(true);
      h=rowHeight(label,value);
    }
    doc.rect(pad,y,CARD_W-pad*2,h).stroke();
    doc.moveTo(pad+gutter,y).lineTo(pad+gutter,y+h).stroke();
    doc.moveTo(pad+labelW,y).lineTo(pad+labelW,y+h).stroke();
    doc.font("Helvetica-Bold").fontSize(5.7).text(label,pad+gutter+4,y+4,{width:labelW-gutter-8,lineGap:1});
    doc.font("Times-Roman").fontSize(7.2).text(value,pad+labelW+5,y+4,{width:CARD_W-pad-labelW-8,lineGap:1.4});
    y+=h;
  }
  // End marker stays on the final card, if there is room.
  if(y+12<usableBottom){
    doc.font("Helvetica-Bold").fontSize(5.2).text("END OF CATALOGUE RECORD",pad,usableBottom-8,{width:CARD_W-pad*2,align:"right"});
  }
  doc.end();
});

app.use((req, res) => res.status(404).send("Page not found."));

app.listen(PORT, "0.0.0.0", () => console.log(`LSP5004 Cataloguing running on port ${PORT}`));

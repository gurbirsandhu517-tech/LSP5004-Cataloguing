const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");
const { GoogleGenAI } = require("@google/genai");

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
    materialType:{type:"string"}, title:{type:"string"}, responsibility:{type:"string"},
    edition:{type:"string"}, publication:{type:"string"}, physical:{type:"string"},
    notes:{type:"string"}, subjectHeadings:{type:"string"}, accessPoints:{type:"string"},
    entry:{type:"string"}, missing:{type:"string"}, verification:{type:"string"}
  },
  required:["materialType","title","responsibility","edition","publication","physical","notes","subjectHeadings","accessPoints","entry","missing","verification"]
};

app.post("/generate", async (req,res)=>{
  try {
    const {question, section="A", materialType="Not specified"}=req.body||{};
    if(!question || !question.trim()) return res.status(400).json({error:"Please paste the complete cataloguing question."});
    const apiKey=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
    if(!apiKey) return res.status(503).json({error:"Gemini API is not configured. Add GEMINI_API_KEY in Render → Environment."});
    const ai=new GoogleGenAI({apiKey});
    const prompt=`You are an LSP5004 library cataloguing practice assistant.

SECTION: ${section}
MATERIAL TYPE SELECTED: ${materialType}

Read the COMPLETE assignment question below. Extract and use ONLY bibliographic facts actually supplied in the question. Never invent author names, publishers, dates, places, editions, physical details, series, notes or other facts. If a field is absent, write "Not supplied".

Prepare a professional PRACTICE catalogue entry using AACR2 terminology and appropriate cataloguing punctuation where possible. Include material type, title proper, statement of responsibility, edition statement, publication statement, physical description, notes, subject headings/access points only when supported by the supplied question, added entries/access points, missing/unverified information, and a concise AACR2 practice check.

Important: do not silently add information from general knowledge; do not claim a rule is verified if it is not; treat the supplied question as the primary factual source; if a rule is uncertain say so in verification; return ONLY valid JSON matching the schema.

COMPLETE QUESTION:
${question}`;

    const response=await ai.models.generateContent({
      model:"gemini-3.8-flash",
      contents:prompt,
      config:{
        responseMimeType:"application/json",
        responseSchema:schema,
        thinkingConfig:{thinkingLevel:"low"},
        tools:[{googleSearch:{}}]
      }
    });
    let result;
    try { result=JSON.parse(response.text); }
    catch(e){ console.error("Invalid Gemini JSON:",response.text); return res.status(502).json({error:"Gemini returned an invalid catalogue response. Please try again."}); }
    result.section=section;
    res.json(result);
  } catch(error){
    console.error("Gemini generation error:",error);
    res.status(500).json({error:"Catalogue generation failed. Check Render logs and GEMINI_API_KEY, then try again."});
  }
});

app.post("/generate-pdf",(req,res)=>{
  try{
    const {section,materialType,title,responsibility,edition,publication,physical,notes,subjectHeadings,accessPoints,entry,missing,verification}=req.body||{};
    const doc=new PDFDocument({size:"A4",margin:48,info:{Title:"LSP5004 Catalogue Entry",Author:"LSP5004 Cataloguing Practice"}});
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",'attachment; filename="LSP5004-catalogue-entry.pdf"');
    doc.pipe(res);
    doc.font("Helvetica-Bold").fontSize(15).text("LSP5004: KNOWLEDGE ORGANISATION & ADVANCED LIBRARY CATALOGUING",{align:"center"});
    doc.moveDown(.3); doc.font("Helvetica").fontSize(10).text("(PRACTICE CATALOGUE ENTRY)",{align:"center"});
    doc.moveDown(); doc.font("Helvetica-Bold").fontSize(10).text(`Section: ${section||"Not supplied"}`);
    doc.font("Helvetica").text(`Material Type: ${materialType||"Not supplied"}`); doc.moveDown();
    doc.font("Helvetica-Bold").fontSize(13).text("CATALOGUE ENTRY"); doc.moveDown(.35);
    doc.font("Helvetica").fontSize(11).text(entry||"No entry generated.",{lineGap:3,width:500}); doc.moveDown();
    const fields=[["Title Proper",title],["Statement of Responsibility",responsibility],["Edition Statement",edition],["Publication Statement",publication],["Physical Description",physical],["Notes",notes],["Subject Headings / Access Points",subjectHeadings],["Added Entries / Access Points",accessPoints],["Missing / Unverified Information",missing],["AACR2 Practice Check",verification]];
    for(const [label,value] of fields){doc.font("Helvetica-Bold").fontSize(10).text(label);doc.font("Helvetica").fontSize(10).text(value||"Not supplied",{lineGap:2,width:500});doc.moveDown(.45);}
    doc.fontSize(8).fillColor("#666666").text("Practice output only. Verify against the authorised course/reference material.",{align:"center"});
    doc.end();
  }catch(error){console.error("PDF generation error:",error);if(!res.headersSent)res.status(500).json({error:"PDF generation failed."});}
});

app.use((req,res)=>res.status(404).send("Page not found."));
app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 Cataloguing website running on port ${PORT}`));

const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "V16-AACR2-UNLIMITED-CARDS-SERIAL-FIX";

app.use(express.json({limit:"25mb"}));
app.use(express.urlencoded({extended:true,limit:"25mb"}));
app.use(express.static(path.join(__dirname,"public"), {
  setHeaders: (res) => { res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate"); res.setHeader("Pragma", "no-cache"); res.setHeader("Expires", "0"); }
}));

const SYSTEM_PROMPT = `
You are the primary AACR2 cataloguing engine for LSP5004 Advanced Library Cataloguing Practice.
Gemini is primary. Google Search grounding is a verification/research layer, never the final answer itself.

CORE REQUIREMENT:
The user can choose a MATERIAL TYPE, or choose ALL MATERIALS. There are NO A/B/C/D section limits.
If the user chooses Serial Publication, solve the complete serial/continuing-resource question and create every
catalogue entry genuinely required by the question. If Video Recording is selected, solve it as a video recording;
if Sound Recording, solve sound recording; if Map, solve cartographic material; if Motion Picture, solve motion picture;
if Electronic Resource, solve electronic resource; if Book, solve book; if Microform, solve microform. If ALL is selected,
determine the material type from the complete question and apply the appropriate AACR2 chapter/practice.

READ THE ENTIRE QUESTION. NEVER RETURN OR DISPLAY THE QUESTION AS THE ANSWER.
The question is the source of bibliographic facts. Do not invent publisher, date, edition, names, dimensions, extent,
call number, accession number, series, subjects, or identifiers. If a required fact is absent, leave it absent and list it
under missing/unverified. Do not fill blanks merely to make a card look complete.

Use AACR2 descriptive cataloguing areas in the appropriate order for the material: title and statement of responsibility;
edition; material-specific details where applicable; publication/distribution/etc.; physical description; series; notes;
standard number/terms of availability. Not every area applies to every material type.

ENTRY REQUIREMENT:
Create a MAIN ENTRY plus ALL justified ADDED ENTRIES and ACCESS POINTS supported by the question/reference. These may
include personal name, corporate body, title, series, uniform title, and other access points where appropriate.
Create SUBJECT ACCESS ENTRIES only when the question/reference supplies enough subject information or explicitly asks
for them. Do not pretend that AACR2 itself supplies a subject-heading vocabulary; use the supplied/reference heading when
available, otherwise report that subject-heading verification is required.

CARD REQUIREMENT:
There is NO CARD LIMIT and NO PAGE LIMIT. One required entry = its own catalogue card where the traditional unit-card
exercise calls for it. Long entries continue onto additional continuation cards. Never squeeze, truncate, or replace a
required entry with a summary.

CARD SIZE/STYLE:
12.5 cm × 7.5 cm card. Use vertical indention/ruling and the traditional catalogue-card arrangement. Main entry heading,
title/imprint and physical description/notes begin at the appropriate indention. Accession number, when supplied, is kept
in the practice position; do not invent it. Call number stays in the filing block.

RETURN ONLY VALID JSON:
{
  "materialType":"",
  "mainEntry":"",
  "titleStatement":"",
  "responsibility":"",
  "edition":"",
  "materialSpecific":"",
  "imprint":"",
  "physicalDescription":"",
  "series":"",
  "notes":"",
  "standardNumber":"",
  "callNumber":"",
  "accessionNumber":"",
  "addedEntries":[{"type":"personal name|corporate body|title|series|uniform title|other","heading":"","reference":""}],
  "subjectEntries":[{"heading":"","reference":""}],
  "cards":[
    {"entryType":"MAIN ENTRY","heading":"","callNumber":"","accessionNumber":"","lines":["..."]}
  ],
  "verification":"",
  "missing":["..."]
}

ENTRY TYPES TO USE (NO A/B/C/D LABELS):
MAIN ENTRY; ADDED ENTRY — PERSONAL NAME; ADDED ENTRY — CORPORATE BODY; ADDED ENTRY — TITLE;
ADDED ENTRY — SERIES; ADDED ENTRY — UNIFORM TITLE; SUBJECT ENTRY; CONTINUATION CARD.
Use only the entry types that are genuinely required.

PUNCTUATION/ORDER:
Follow AACR2/ISBD-style punctuation appropriate to the exercise. Preserve the material-specific differences.
For serial/continuing resources, pay attention to numbering, frequency, beginning date/volume/issue and title changes
when those facts are actually supplied. For maps, record scale and cartographic-specific details when supplied. For
sound/video/motion pictures/electronic resources, use the appropriate material-specific description instead of forcing a
book format.
`;


function cleanJsonText(t){
  if(!t) return "";
  t=String(t).trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```\s*$/i,"").trim();
  const a=t.indexOf("{"), b=t.lastIndexOf("}");
  return a>=0&&b>a?t.slice(a,b+1):t;
}
function safeJson(t){try{return JSON.parse(cleanJsonText(t));}catch{return null;}}
function str(x){return x==null?"":String(x).trim();}
function arr(x){return Array.isArray(x)?x:[];}

function extractLabeled(q, labels){
  const lines=q.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  for(const line of lines){
    for(const label of labels){
      const re=new RegExp("^"+label.replace(/[.*+?^${}()|[\\]\\]/g,"\\$&")+"\\s*[:\\-]\\s*(.+)$","i");
      const m=line.match(re); if(m) return m[1].trim();
    }
  }
  return "";
}

function parseSerialQuestion(q, materialType){
  const text=str(q).replace(/\r/g,'');
  const lines=text.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const findLine=(re)=>lines.find(x=>re.test(x))||'';
  const stripFinalPunct=(x)=>str(x).replace(/[.]+$/,'').trim();

  // Prefer the actual bibliographic statement containing a slash. Never treat
  // a later publisher-change note as the main entry.
  let titleLine=lines.find(x=>/\s\/\s/.test(x) && !/catalogue the following/i.test(x))||'';
  if(!titleLine) titleLine=findLine(/^International journal of library and information studies\s*\//i);
  if(!titleLine) titleLine=lines.find(x=>/journal|serial|periodical/i.test(x)&&!/catalogue|publisher change/i.test(x))||'';

  let titleStatement='', responsibility='';
  if(titleLine){
    const m=titleLine.match(/^(.*?)\s*\/\s*(.+)$/);
    if(m){titleStatement=stripFinalPunct(m[1]);responsibility=stripFinalPunct(m[2]);}
    else titleStatement=stripFinalPunct(titleLine);
  }

  // If the title is embedded in a prompt paragraph, extract the phrase before slash.
  if(!titleStatement){
    const m=text.match(/(?:^|\n)\s*([^\n]+?)\s*\/\s*([^\n]+?)(?:\.|\n)/i);
    if(m){titleStatement=stripFinalPunct(m[1]);responsibility=stripFinalPunct(m[2]);}
  }

  const numbering=stripFinalPunct(findLine(/^Vol\.?\s*1\s*,/i));
  const imprintLine=findLine(/(?:—|-)?\s*(New Delhi|Place of publication)\s*:/i);
  let imprint='';
  if(imprintLine){
    imprint=stripFinalPunct(imprintLine.replace(/^[—-]\s*/,'').trim());
  }
  const physical=stripFinalPunct(findLine(/^\d+(?:\.\d+)?\s*cm\.?$/i));
  const seriesLine=findLine(/^\(.*;\s*\d+\)$/);
  const series=stripFinalPunct(seriesLine);
  const frequency=stripFinalPunct(findLine(/^Quarterly,/i));
  const combined=stripFinalPunct(findLine(/^Vol\.?\s*2,\s*no\.\s*3/i));
  const publisherChange=stripFinalPunct(findLine(/^Publisher:/i));
  const notesLine=stripFinalPunct(findLine(/^Includes references/i));
  const issn=stripFinalPunct(findLine(/^ISSN\s+/i));
  const call=extractLabeled(text,["Call number","Call no","Class number"]);
  const accession=extractLabeled(text,["Accession number","Accession no","Accession"]);

  // AACR2/ISBD-style punctuation: slash, period, colon, semicolon and em dash
  // are placed as punctuation, never with an accidental leading space.
  const cards=[];
  const mainLines=[];
  if(titleStatement) mainLines.push(titleStatement + (responsibility ? ' / ' + responsibility + '.' : '.'));
  if(numbering) mainLines.push(numbering + ' —');
  if(imprint) mainLines.push(imprint + ' .'.replace(' .','.'));
  if(physical) mainLines.push(physical + ' .'.replace(' .','.'));
  if(series) mainLines.push(series + '.');
  if(frequency) mainLines.push('Frequency: ' + frequency + '.');
  if(combined) mainLines.push(combined + '.');
  if(publisherChange) mainLines.push(publisherChange + '.');
  if(notesLine) mainLines.push(notesLine + '.');
  if(issn) mainLines.push('ISSN ' + issn.replace(/^ISSN\s+/i,'') + '.');
  cards.push({entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:call,accessionNumber:accession,lines:mainLines});

  const names=[];
  const respMatch=responsibility.match(/edited by\s+(.+)/i);
  if(respMatch){
    const raw=stripFinalPunct(respMatch[1]);
    raw.split(/\s+and\s+|\s*;\s*/i).map(x=>stripFinalPunct(x)).filter(Boolean).forEach(name=>names.push(name));
  }
  const personalHeading=(name)=>{
    let n=stripFinalPunct(name);
    n=n.replace(/,\s*(editor|ed\.)$/i,'').trim();
    if(!n.includes(',')){
      const bits=n.split(/\s+/).filter(Boolean);
      if(bits.length>1){const surname=bits.pop(); n=surname+', '+bits.join(' ');}
    }
    return n+', editor.';
  };
  for(const name of names){
    const heading=personalHeading(name);
    cards.push({entryType:'ADDED ENTRY — PERSONAL NAME',cardType:'Added Entry',callNumber:'',accessionNumber:'',lines:[heading,titleStatement+'.']});
  }
  // The serial is entered under its title here, so a duplicate title added entry
  // is not manufactured merely to increase the card count.
  if(series){
    const cleanSeries=series.replace(/^\(|\)$/g,'').trim();
    cards.push({entryType:'ADDED ENTRY — SERIES',cardType:'Added Entry',callNumber:'',accessionNumber:'',lines:[cleanSeries+'.']});
  }
  return {
    materialType:'Serial Publication', mainEntry:titleStatement, titleStatement, responsibility,
    edition:'', materialSpecific:numbering, imprint, physicalDescription:physical, series,
    seriesEntry:series, notes:[frequency,combined,publisherChange,notesLine].filter(Boolean).join(' '),
    standardNumber:issn, callNumber:call, accessionNumber:accession,
    addedEntries:[
      ...names.map(n=>({type:'personal name',heading:n,reference:'Added entry for editor/responsibility statement.'})),
      ...(titleStatement?[{type:'title',heading:titleStatement,reference:'Title access point.'}]:[]),
      ...(series?[{type:'series',heading:series.replace(/^\(|\)$/g,''),reference:'Series access point.'}]:[])
    ],
    subjectEntries:[], cards,
    verification:'Structured serial fallback uses only bibliographic facts supplied in the question and keeps the serial main entry under the title, with supported added entries.',
    missing:[...(call?'': ['Call number was not supplied in the question.']),...(accession?'': ['Accession number was not supplied in the question.'])]
  };
}

function localParse(question, section, materialType){
  const q=str(question);
  if(/serial|journal|periodical|continuing resource|quarterly|bimonthly/i.test(q)) return parseSerialQuestion(q,materialType);

  const title=extractLabeled(q,["Title proper","Title","Main title"]);
  const resp=extractLabeled(q,["Statement of responsibility","Responsibility","Author","By"]);
  const edition=extractLabeled(q,["Edition statement","Edition"]);
  const place=extractLabeled(q,["Place of publication","Place"]);
  const publisher=extractLabeled(q,["Publisher","Publication"]);
  const date=extractLabeled(q,["Date of publication","Publication date","Date"]);
  const physical=extractLabeled(q,["Physical description","Physical"]);
  const notes=extractLabeled(q,["Notes","Note"]);
  const series=extractLabeled(q,["Series statement","Series"]);
  const call=extractLabeled(q,["Call number","Call no","Class number"]);
  const accession=extractLabeled(q,["Accession number","Accession no","Accession"]);
  const isbn=extractLabeled(q,["ISBN"]);
  let imprint="";
  if(place||publisher||date){
    const bits=[]; if(place)bits.push(place); if(publisher)bits.push(publisher); if(date)bits.push(date);
    imprint=bits.length===3?`${place} : ${publisher}, ${date}`:bits.join(" : ");
  }
  const inferredMaterial=/map|atlas|cartographic/i.test(q)?"Map":/motion picture|film|movie/i.test(q)?"Motion Picture":/video recording|dvd|videocassette/i.test(q)?"Video Recording":/sound recording|audio recording|phonograph|recording/i.test(q)?"Sound Recording":/electronic resource|website|online|computer file|database/i.test(q)?"Electronic Resource":/microform|microfilm|microfiche/i.test(q)?"Microform":(materialType&&materialType!=="All Materials"?materialType:"Book");
  const lines=[]; if(title||resp){let first=title||"";if(resp)first+=(first?" / ":"")+resp;lines.push(first);} if(edition)lines.push(edition+"."); if(imprint)lines.push(imprint+"."); if(physical)lines.push(physical+"."); if(notes)lines.push(notes+"."); if(series)lines.push(series+"."); if(isbn)lines.push(isbn+"."); if(!lines.length)lines.push("No solvable bibliographic fields were detected in the supplied question.");
  const cards=[{entryType:"MAIN ENTRY",cardType:"Main Entry",callNumber:call,accessionNumber:accession,lines}];
  if(resp) cards.push({entryType:"ADDED ENTRY — PERSONAL NAME",cardType:"Added Entry",callNumber:call,accessionNumber:"",lines:[resp,title?title+".":""].filter(Boolean)});
  if(title) cards.push({entryType:"ADDED ENTRY — TITLE",cardType:"Added Entry",callNumber:call,accessionNumber:"",lines:[title+"."]});
  return {materialType:inferredMaterial,mainEntry:title||resp||"",titleStatement:title,responsibility:resp,edition,imprint,physicalDescription:physical,notes,series,seriesEntry:series,callNumber:call,accessionNumber:accession,addedEntries:[],subjectEntries:[],cards,verification:"Structured fallback used because Gemini could not be reached. No unsupported bibliographic facts were invented.",missing:["Gemini generation/verification was unavailable; review this AACR2 practice answer before submission."]};
}

function normalizeResult(raw, question, section, materialType){
  const r=raw&&typeof raw==='object'?raw:{};
  r.materialType=str(r.materialType)||materialType||'Not specified';
  r.mainEntry=str(r.mainEntry); r.titleStatement=str(r.titleStatement); r.responsibility=str(r.responsibility);
  r.edition=str(r.edition); r.imprint=str(r.imprint); r.physicalDescription=str(r.physicalDescription);
  r.notes=str(r.notes); r.series=str(r.series||r.seriesEntry); r.standardNumber=str(r.standardNumber);
  r.materialSpecific=str(r.materialSpecific); r.callNumber=str(r.callNumber); r.accessionNumber=str(r.accessionNumber);
  r.seriesEntry=str(r.seriesEntry); r.uniformTitleEntry=str(r.uniformTitleEntry);
  r.addedEntries=arr(r.addedEntries); r.subjectEntries=arr(r.subjectEntries); r.missing=arr(r.missing);
  r.cards=arr(r.cards).map(c=>({
    entryType:str(c.entryType)||str(c.cardType)||'MAIN ENTRY',
    cardType:str(c.cardType)||'Main Entry',
    callNumber:str(c.callNumber)||r.callNumber,
    accessionNumber:str(c.accessionNumber)||r.accessionNumber,
    lines:arr(c.lines).map(str).filter(Boolean)
  })).filter(c=>c.lines.length);

  const q=str(question);
  const serialLike=/serial|journal|periodical|continuing resource|quarterly|bimonthly/i.test(q);
  const looksWrong=r.cards.length===1 && r.cards[0].lines.some(x=>/Knowledge Publishers|Academic Library Press|Publisher:/i.test(x)) && !/International journal|journal/i.test(r.cards[0].lines.join(' '));
  const obviouslyPromptText=r.cards.some(c=>c.lines.some(x=>/catalogue the following|make all entries|complete cataloguing question/i.test(x)));

  // A serial question must never collapse to a publisher-only card. Rebuild it
  // deterministically from the question if Gemini omitted the required entries.
  if(serialLike && (r.cards.length<3 || looksWrong || obviouslyPromptText)){
    const rebuilt=localParse(q,section,'Serial Publication');
    Object.assign(r, rebuilt, {provider:r.provider});
    r.verification=(rebuilt.verification||'')+' Serial completeness guard applied.';
  }
  if(!r.cards.length){
    const rebuilt=localParse(q,section,r.materialType); Object.assign(r,rebuilt,{provider:r.provider});
  }
  r.cards=expandCards(r.cards);
  return r;
}

function wrapForCard(text, maxChars=48){
  const words=str(text).split(/\s+/).filter(Boolean); if(!words.length)return [];
  const out=[]; let line='';
  for(const w of words){
    if(w.length>maxChars){
      if(line){out.push(line);line='';}
      for(let i=0;i<w.length;i+=maxChars) out.push(w.slice(i,i+maxChars));
      continue;
    }
    const next=line?line+' '+w:w;
    if(next.length>maxChars){out.push(line);line=w;}else line=next;
  }
  if(line)out.push(line); return out;
}
function expandCards(cards){
  const out=[];
  const maxLines=11;
  for(const card of arr(cards)){
    const wrapped=[]; for(const line of arr(card.lines)) wrapped.push(...wrapForCard(line,48));
    if(!wrapped.length) continue;
    for(let i=0;i<wrapped.length;i+=maxLines){
      const chunk=wrapped.slice(i,i+maxLines);
      out.push({...card,entryType:i===0?card.entryType:'CONTINUATION CARD',cardType:i===0?card.cardType:'Continuation Card',lines:chunk,callNumber:i===0?card.callNumber:'',accessionNumber:i===0?card.accessionNumber:''});
    }
  }
  return out;
}

async function geminiRequest(question, section, materialType, useSearch=true){
  const key=process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY;
  if(!key) throw new Error("GEMINI_API_KEY is not configured on the server.");
  const models=[process.env.GEMINI_MODEL,"gemini-2.5-flash","gemini-2.0-flash"].filter(Boolean);
  let last="";
  for(const model of [...new Set(models)]){
    const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const body={
      systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},
      contents:[{role:"user",parts:[{text:`Section selected: ${section||""}\nMaterial selected: ${materialType||""}\n\nCOMPLETE CATALOGUING QUESTION:\n${question}\n\nSolve the question and return the complete catalogue entries, not a restatement of the question.`}]}],
      generationConfig:{temperature:0.1,responseMimeType:"application/json"}
    };
    if(useSearch) body.tools=[{google_search:{}}];
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),45000);
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
      const data=await response.json().catch(()=>({}));
      if(!response.ok){last=data?.error?.message||`Gemini ${model} failed (${response.status})`;continue;}
      const text=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("");
      const parsed=safeJson(text);
      if(!parsed){last=`Gemini ${model} returned invalid JSON.`;continue;}
      parsed.provider=`Gemini ${model}${useSearch?" + Google Search grounding":""}`;
      return parsed;
    }catch(e){last=e.name==="AbortError"?`Gemini ${model} timed out after 45 seconds.`:e.message;}
    finally{clearTimeout(timer);}
  }
  throw new Error(last||"Gemini generation failed.");
}

app.post("/generate",async(req,res)=>{
  const {question,section,materialType}=req.body||{};
  if(!str(question)) return res.status(400).json({error:"Please enter the complete cataloguing question."});
  try{
    let result;
    try { result=await geminiRequest(str(question),section,materialType,true); }
    catch(searchErr){
      console.warn("Gemini + Search failed; retrying Gemini without search:",searchErr.message);
      result=await geminiRequest(str(question),section,materialType,false);
      result.verification=(str(result.verification)?result.verification+" ":"")+"Google Search grounding was unavailable for this request; answer generated by Gemini.";
    }
    result=normalizeResult(result,question,section,materialType);
    res.json(result);
  }catch(err){
    console.error(err);
    const fallback=localParse(str(question),section,materialType);
    fallback.provider="Structured fallback — Gemini unavailable";
    fallback.error=err.message;
    res.json(fallback);
  }
});

function drawCard(doc,card,no,total){
  const W=12.5*28.3464567,H=7.5*28.3464567;
  const ruleX=42;
  doc.rect(0,0,W,H).stroke();
  doc.moveTo(ruleX,0).lineTo(ruleX,H).stroke();
  doc.font("Helvetica").fontSize(6).fillColor("#555").text(`CARD ${no}${total?" / "+total:""}`,47,4,{width:W-52,align:"right"});
  if(card.callNumber) doc.text(card.callNumber,3,12,{width:35,align:"center"});
  if(card.accessionNumber) doc.text(card.accessionNumber,3,34,{width:35,align:"center"});
  doc.fillColor("#000").font("Courier").fontSize(7.0);
  let y=13;
  for(const line of arr(card.lines)){
    const text=str(line); if(!text) continue;
    const h=doc.heightOfString(text,{width:W-ruleX-12,lineGap:0.5});
    if(y+h>H-5){
      // Continue on a new page/card is handled by card generation; do not silently squeeze.
      break;
    }
    doc.text(text,ruleX+7,y,{width:W-ruleX-12,lineGap:0.5});
    y+=Math.max(8,h+2);
  }
}

app.post("/generate-pdf",(req,res)=>{
  const cards=expandCards(arr(req.body?.cards));
  if(!cards.length) return res.status(400).json({error:"No catalogue cards available."});
  const W=12.5*28.3464567,H=7.5*28.3464567;
  const doc=new PDFDocument({size:[W,H],margin:0,autoFirstPage:false});
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",'attachment; filename="LSP5004-AACR2-Catalogue-Cards.pdf"');
  doc.pipe(res);
  cards.forEach((c,i)=>{doc.addPage({size:[W,H],margin:0});drawCard(doc,c,i+1,cards.length);});
  doc.end();
});

app.get("/version",(req,res)=>res.set("Cache-Control","no-store").json({version:VERSION,cardSize:"12.5 × 7.5 cm",primary:"Gemini",verification:"Google Search grounding with Gemini-only retry",materials:"All / Book / Serial Publication / Map / Motion Picture / Video Recording / Sound Recording / Electronic Resource / Microform",pageLimit:"Unlimited cards; automatic continuation cards; no truncation"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 ${VERSION} running on ${PORT}`));

const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "V17-AACR2-AUTO-ALL-ENTRIES-ENGINE";

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
  const text=str(q).replace(/\r/g,' ').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const clauses=text.split(/\s*[—–]\s*/).map(x=>x.trim()).filter(Boolean);
  const strip=(x)=>str(x).replace(/^[.\s]+|[.\s]+$/g,'').trim();
  const findClause=(re)=>clauses.find(x=>re.test(x))||'';

  // The first clause containing a slash is the title/statement of responsibility.
  let titleClause=clauses.find(x=>/\s\/\s/.test(x) && !/catalogue|make all entries|please make/i.test(x))||'';
  if(!titleClause) titleClause=clauses.find(x=>/journal|serial|periodical|bulletin|review|newsletter/i.test(x) && !/catalogue|publisher change|includes|issn/i.test(x))||'';
  let titleStatement='', responsibility='';
  if(titleClause){
    const m=titleClause.match(/^(.*?)\s*\/\s*(.+)$/);
    if(m){titleStatement=strip(m[1]);responsibility=strip(m[2]);}
    else titleStatement=strip(titleClause);
  }

  const numbering=strip(findClause(/^Vol\.\s*\d+\s*,/i));
  const imprint=strip(findClause(/^[A-Z][A-Za-z .,'-]+\s*:\s*[^,]+,\s*\d{4}/i));
  const physical=strip(findClause(/^\d+(?:\.\d+)?\s*cm\.?$/i));
  const seriesClause=clauses.find(x=>/^\(.*\)\.?$/.test(x))||'';
  const seriesHeading=strip(seriesClause.replace(/^\(|\)\.?$/g,''));
  const frequencyClause=strip(findClause(/^(?:Quarterly|Monthly|Bimonthly|Biweekly|Weekly|Annual|Semiannual|Irregular)\b/i));
  const frequencyChange=strip(findClause(/frequency changed|frequency/i));
  const frequency=[frequencyClause,frequencyChange && frequencyChange!==frequencyClause?frequencyChange:''].filter(Boolean).join(' ');
  const combined=strip(findClause(/^Vol\.\s*\d+\s*,\s*no\.\s*\d+.*combined/i));
  const publisherChange=strip(findClause(/^Publisher\s+changed/i).replace(/^Publisher\s*:\s*/i,''));
  const notesClause=strip(findClause(/^Includes\s+/i));
  const issn=strip(findClause(/^ISSN\s+/i)).replace(/^ISSN\s+/i,'');
  const call=extractLabeled(q,["Call number","Call no","Class number"]);
  const accession=extractLabeled(q,["Accession number","Accession no","Accession"]);

  // Extract editors only from the responsibility clause, never from later clauses.
  const names=[];
  const respMatch=responsibility.match(/^(?:edited by|compiled by|prepared by|by)\s+(.+)$/i);
  if(respMatch){
    respMatch[1].replace(/[.]$/,'').split(/\s+and\s+|\s*;\s*/i).map(strip).filter(Boolean).forEach(n=>names.push(n));
  }
  const personalHeading=(name)=>{
    let n=strip(name).replace(/,\s*(?:editor|ed\.)$/i,'').trim();
    if(!n.includes(',')){
      const bits=n.split(/\s+/).filter(Boolean);
      if(bits.length>1){const surname=bits.pop();n=surname+', '+bits.join(' ');}
    }
    return n+', editor.';
  };
  const personalHeadings=names.map(personalHeading);

  // Direct catalogue text: no explanatory labels such as “Title proper:”.
  const main=[];
  if(titleStatement) main.push(titleStatement + (responsibility ? ' / ' + responsibility + '.' : '.'));
  if(numbering) main.push(numbering + '.');
  if(imprint) main.push(imprint + '.');
  if(physical) main.push(physical + '.');
  if(seriesHeading) main.push('— (' + seriesHeading + ').');
  if(frequencyClause) main.push(frequencyClause + '.');
  if(frequencyChange) main.push(frequencyChange + '.');
  if(combined) main.push(combined + '.');
  if(publisherChange){ const pm=publisherChange.match(/changed\s+from\s+.+?\s+to\s+(.+?)(?:\s+with\s+|$)/i); main.push(pm ? 'Publisher: '+pm[1].trim()+(publisherChange.match(/with\s+(.+)$/i)?', '+publisherChange.match(/with\s+(.+)$/i)[1].trim():'')+'.' : publisherChange+'.'); }
  if(notesClause) main.push(notesClause + '.');
  if(issn) main.push('ISSN ' + issn + '.');

  const tracing=[];let roman=1;
  for(const h of personalHeadings) tracing.push(`${roman++}. ${h}`);
  if(seriesHeading) tracing.push(`${roman++}. ${seriesHeading}`);
  if(tracing.length) main.push('Tracing: ' + tracing.join('  '));

  const cards=[{entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:call,accessionNumber:accession,lines:main}];
  for(const h of personalHeadings){
    cards.push({entryType:'ADDED ENTRY — PERSONAL NAME',cardType:'Added Entry',callNumber:call,accessionNumber:'',lines:[h,titleStatement ? titleStatement + '.' : '']});
  }
  if(seriesHeading) cards.push({entryType:'ADDED ENTRY — SERIES',cardType:'Added Entry',callNumber:call,accessionNumber:'',lines:[seriesHeading + '.']});

  return {
    materialType:'Serial Publication',mainEntry:titleStatement,titleStatement,responsibility,
    edition:'',materialSpecific:numbering,imprint,physicalDescription:physical,series:seriesHeading,
    notes:[frequency,combined,publisherChange,notesClause].filter(Boolean).join(' '),
    standardNumber:issn ? 'ISSN '+issn : '',callNumber:call,accessionNumber:accession,
    addedEntries:[...personalHeadings.map(h=>({type:'personal name',heading:h,reference:'Personal-name added entry.'})),...(seriesHeading?[{type:'series',heading:seriesHeading,reference:'Series added entry.'}]:[])],
    subjectEntries:[],cards,
    verification:'AACR2-style serial entry generated from the supplied bibliographic facts. No unsupported subject heading or publisher access point was invented.',
    missing:[...(call?[]:['Call number was not supplied in the question.']),...(accession?[]:['Accession number was not supplied in the question.'])]
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
  const q=str(question);
  const serialLike=/serial|journal|periodical|continuing resource|quarterly|bimonthly|vol\.\s*\d+\s*,\s*no\./i.test(q);
  r.materialType=str(r.materialType)||materialType||'Not specified';
  r.mainEntry=str(r.mainEntry);r.titleStatement=str(r.titleStatement);r.responsibility=str(r.responsibility);
  r.edition=str(r.edition);r.imprint=str(r.imprint);r.physicalDescription=str(r.physicalDescription);r.notes=str(r.notes);
  r.series=str(r.series||r.seriesEntry);r.standardNumber=str(r.standardNumber);r.materialSpecific=str(r.materialSpecific);
  r.callNumber=str(r.callNumber);r.accessionNumber=str(r.accessionNumber);r.seriesEntry=str(r.seriesEntry);
  r.addedEntries=arr(r.addedEntries);r.subjectEntries=arr(r.subjectEntries);r.missing=arr(r.missing);
  r.cards=arr(r.cards).map(c=>({
    entryType:str(c.entryType)||str(c.cardType)||'MAIN ENTRY',cardType:str(c.cardType)||'Main Entry',
    callNumber:str(c.callNumber)||r.callNumber,accessionNumber:str(c.accessionNumber)||r.accessionNumber,
    lines:arr(c.lines).map(str).filter(Boolean)
  })).filter(c=>c.lines.length);

  // Gemini may return good metadata but omit physical entry cards. The engine
  // therefore audits the result and rebuilds from the question when the card
  // set is incomplete. For serials, the deterministic parser is authoritative
  // about card completeness, while Gemini remains the primary research engine.
  const promptLeak=r.cards.some(c=>c.lines.some(x=>/catalogue the following|make all entries|complete cataloguing question|please make all entries/i.test(x)));
  const serialIncomplete=serialLike && (r.cards.length<2 || promptLeak || !r.cards.some(c=>/^MAIN ENTRY$/i.test(c.entryType)));
  if(serialIncomplete){
    const rebuilt=parseSerialQuestion(q,'Serial Publication');
    rebuilt.provider=r.provider||'AACR2 automatic catalogue engine';
    rebuilt.verification=(rebuilt.verification||'')+' Completeness audit rebuilt the serial cards.';
    return rebuilt;
  }

  // For non-serial material, ensure every access point returned by Gemini has
  // an actual card. This prevents a JSON-only addedEntries list with no cards.
  const existing=new Set(r.cards.map(c=>`${c.entryType}|${c.lines.join(' ')}`));
  for(const a of r.addedEntries){
    const type=str(a.type).toLowerCase();const h=str(a.heading);if(!h)continue;
    let et='ADDED ENTRY — TITLE';
    if(type.includes('personal'))et='ADDED ENTRY — PERSONAL NAME';
    else if(type.includes('corporate'))et='ADDED ENTRY — CORPORATE BODY';
    else if(type.includes('series'))et='ADDED ENTRY — SERIES';
    else if(type.includes('uniform'))et='ADDED ENTRY — UNIFORM TITLE';
    const key=`${et}|${h}`;
    if(!existing.has(key)){r.cards.push({entryType:et,cardType:'Added Entry',callNumber:'',accessionNumber:'',lines:[h]});existing.add(key);}
  }
  for(const a of r.subjectEntries){
    const h=str(a.heading);if(h)r.cards.push({entryType:'SUBJECT ENTRY',cardType:'Subject Entry',callNumber:'',accessionNumber:'',lines:[h]});
  }
  if(!r.cards.length){Object.assign(r,localParse(q,section,materialType));}
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
  const maxLines=10;
  for(const card of arr(cards)){
    const wrapped=[];for(const line of arr(card.lines))wrapped.push(...wrapForCard(line,54));
    if(!wrapped.length)continue;
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
  const W=12.5*28.3464567,H=7.5*28.3464567,ruleX=42;
  doc.rect(0,0,W,H).stroke();doc.moveTo(ruleX,0).lineTo(ruleX,H).stroke();
  doc.font('Helvetica').fontSize(5.5).fillColor('#555').text(`CARD ${no}${total?' / '+total:''}`,47,4,{width:W-52,align:'right'});
  if(card.callNumber)doc.text(card.callNumber,3,12,{width:35,align:'center'});
  if(card.accessionNumber)doc.text(card.accessionNumber,3,34,{width:35,align:'center'});
  doc.fillColor('#000').font('Courier').fontSize(7.1);
  let y=14;
  for(const line of arr(card.lines)){
    const t=str(line);if(!t)continue;
    const h=doc.heightOfString(t,{width:W-ruleX-12,lineGap:0.4});
    if(y+h>H-5)break;
    doc.text(t,ruleX+7,y,{width:W-ruleX-12,lineGap:0.4});y+=Math.max(8,h+1.6);
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

app.get("/version",(req,res)=>res.set("Cache-Control","no-store").json({version:VERSION,cardSize:"12.5 × 7.5 cm",primary:"Gemini",geminiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY),verification:"Google Search grounding with Gemini-only retry",materials:"All / Book / Serial Publication / Map / Motion Picture / Video Recording / Sound Recording / Electronic Resource / Microform",pageLimit:"Unlimited cards; automatic continuation cards; no truncation"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 ${VERSION} running on ${PORT}`));

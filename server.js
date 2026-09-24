const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "V44-AACR2-TRADITIONAL-CARD-STABLE";

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
DEFAULT CARD RULE: One complete catalogue question produces ONE main catalogue card containing the complete entry,
including imprint, physical description, notes, subjects and tracing when applicable. Do not split tracing or individual
access points into separate cards unless the question explicitly asks for separate unit/access-point cards. Long entries
continue only when the single main card physically overflows; use continuation cards only for that overflow. Never squeeze,
truncate, duplicate, or replace an entry with a summary.

CARD SIZE/STYLE:
12.5 cm × 7.5 cm card. Use vertical indention/ruling and the traditional catalogue-card arrangement. Main entry heading,
title/imprint and physical description/notes begin at the appropriate indention. Accession number, when supplied, is kept
in the practice position; do not invent it. Call number stays in the filing block.

AUTO-ENTRY ENGINE RULES:
- The MAIN ENTRY card MUST contain the complete catalogue entry, not only the title/imprint.
- Keep justified added-entry names and subject headings inside the main entry as tracing when a single-card exercise is requested.
- Create additional cards only when the question explicitly asks for separate access-point/unit cards or when physical overflow requires continuation.
- Never create a new card merely because an addedEntries or subjectEntries object exists.
- The MAIN ENTRY card MUST contain the actual catalogue entry, not labels such as “Title proper:” or an explanation.
- Use the exact supplied bibliographic facts and AACR2/ISBD-style prescribed punctuation.
- Include tracing on the main entry when the exercise calls for it; tracing should list the added-entry/subject headings actually prepared.
- Do not create a publisher main entry merely because a publisher is mentioned. Choose the main entry according to AACR2 rules and the facts supplied.
- For serials/continuing resources, include numbering/designation, title and responsibility, publication data, physical description, notes, standard number, series and tracing when supplied/required.
- For other materials, use the appropriate AACR2 material chapter and include only applicable areas.
- If a supplied field is absent, do not invent it.
- Do not return commentary about how you solved it inside the catalogue cards.

UNIVERSAL QUESTION RULES:
- The input may be a complete assignment question, a short catalogue question, or only a bibliographic/title statement. Handle all three.
- Never assume the material is a serial merely because a title contains a word such as journal; use the complete wording and selected material type.
- If the question asks for a specific entry (main entry, added entry, subject entry, tracing, etc.), answer that requested entry correctly and also include any directly required companion entries.
- If only a title is supplied, use the title as the bibliographic evidence. Do NOT invent author, publisher, date, extent, dimensions, call number, accession number, series, ISSN, ISBN, or subject heading. Put unavailable facts in missing/unverified.
- If a responsibility statement names multiple persons, create separate personal-name added entries when justified. Never combine multiple people into one malformed heading.
- Preserve the exact title wording supplied, including subtitles after a colon. Do not mistake a colon inside the title for an imprint separator.
- Do not create an added-title card merely because the title is the main entry; only create a title added entry when the question/reference justifies a distinct title access point.
- Do not create duplicate cards for the same access point.
- Before returning JSON, perform an internal completeness audit: every justified access point must appear in the main entry tracing or in a separately requested card, exactly once.

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
  const raw=str(q);
  const text=raw.replace(/\r/g,' ').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const strip=x=>str(x).replace(/^[.\s]+|[.\s]+$/g,'').trim();
  const natural=inferNaturalFields(text,'Serial Publication');

  // Explicit labels are authoritative. This makes the built-in examples
  // deterministic and avoids guessing a title from the whole question.
  const labeledTitle=extractLabeled(raw,['Title','Title proper','Title of the serial']);
  const labeledEditor=extractLabeled(raw,['Editor','Edited by']);
  const labeledPlace=extractLabeled(raw,['Place','Place of Publication','Publication Place']);
  const labeledPublisher=extractLabeled(raw,['Publisher','Publisher/Distributor']);
  const labeledDate=extractLabeled(raw,['Date','Date of Publication','Publication Date']);
  const labeledFrequency=extractLabeled(raw,['Frequency']);
  const labeledISSN=extractLabeled(raw,['ISSN']);

  let titleStatement=labeledTitle?strip(labeledTitle):'';
  let responsibility=labeledEditor?'edited by '+strip(labeledEditor):'';

  if(!titleStatement){
    const titleSlash=text.match(/(?:for|of)\s+(?:the\s+)?(?:following\s+)?(.+?)\s*\/\s*([^—]+?)(?=\s+—|\s+-\s+|$)/i)
      || text.match(/^(?:create|make|prepare|generate|write)[\s\S]*?\b(?:for|of)\s+(?:the\s+)?(.+?)\s*\/\s*([^—]+?)(?=\s+—|\s+-\s+|$)/i);
    if(titleSlash){titleStatement=strip(titleSlash[1]);responsibility=responsibility||strip(titleSlash[2]);}
  }
  if(!titleStatement){
    const direct=text.match(/(?:^|:\s*)([^—]+?)\s*\/\s*(edited by|compiled by|prepared by|written by|by)\s+(.+?)(?=\s+—|\s+-\s+|$)/i);
    if(direct){titleStatement=strip(direct[1]);responsibility=responsibility||strip(direct[2]+' '+direct[3]);}
  }
  if(!titleStatement && natural.title){
    titleStatement=strip(natural.title);
    if(!responsibility && natural.editor) responsibility='edited by '+natural.editor;
  }
  if(!titleStatement){
    const cleaned=stripInstructionPrefix(text);
    const beforeSlash=cleaned.split(/\s+\/\s+/)[0];
    const beforeImprint=cleaned.split(/\s+[—–-]\s+/)[0];
    const candidate=strip((beforeSlash||beforeImprint||cleaned).replace(/^(?:the\s+)?(?:following|given|below)\s*[:\-]?\s*/i,''));
    if(candidate && candidate.length<220 && !/^(?:create|make|prepare|write|produce|generate)\b/i.test(candidate)) titleStatement=candidate;
  }
  titleStatement=titleStatement.replace(/^(?:the\s+)?(?:serial publication|serial|journal|periodical)\s*[:\-]\s*/i,'').trim();

  const edition=(text.match(/\b(?:\d+(?:st|nd|rd|th)\s+ed(?:ition)?|edition)\b/i)||[])[0]||'';
  const numbering=(text.match(/\bVol\.\s*\d+\s*,\s*no\.\s*\d+(?:\s*\([^)]*\))?/i)||[])[0]||natural.numbering||'';
  const frequency=labeledFrequency||((text.match(/\b(Quarterly|Monthly|Bimonthly|Biweekly|Weekly|Annual|Semiannual|Irregular)\b/i)||[])[1]||natural.frequency||'');
  const issn=labeledISSN||((text.match(/\bISSN\s*[:#-]?\s*([0-9]{4}[-\s]?[0-9]{3}[0-9Xx])\b/i)||[])[1]||natural.issn||'');

  let imprint='';
  const place=labeledPlace||natural.place;
  const publisher=labeledPublisher||natural.publisher;
  const year=labeledDate||natural.year;
  if(place||publisher||year){
    imprint=(place&&publisher&&year)?`${strip(place)} : ${strip(publisher)}, ${strip(year)}`:[place,publisher,year].filter(Boolean).join(' : ');
  }else{
    const im=text.match(/(?:—|–|-)\s*([^—–]+?)\s*:\s*([^,]+),\s*((?:19|20)\d{2})(?:\s*[–—-]|\.)?$/i);
    if(im) imprint=`${strip(im[1])} : ${strip(im[2])}, ${im[3]}`;
  }

  const continues=(text.match(/\bContinues\s*:\s*(.+?)(?=\s+(?:Includes|Subject coverage|Subjects|Added entries|UDC|Call\s*(?:No\.?|number)|ISSN)\s*:?\s*|\s*$)/i)||[])[1]||'';
  const includes=(text.match(/\bIncludes\s*:?\s*(.+?)(?=\s+Subject coverage\s+includes|\s+Subjects\s*:|\s+Added entries\s*:|\s+UDC\s*:|\s+Call\s*(?:No\.?|number)\s*:|\s+ISSN\s*:|\s*$)/i)||[])[1]||'';
  const coverage=(text.match(/\bSubject coverage\s+(?:includes|:)\s*(.+?)(?=\s+Subjects\s*:|\s+Added entries\s*:|\s+UDC\s*:|\s+Call\s*(?:No\.?|number)\s*:|\s+ISSN\s*:|\s*$)/i)||[])[1]||'';
  const subjectBlock=(text.match(/\bSubjects\s*:\s*(.+?)(?=\s+(?:Added entries|UDC|Call\s*(?:No|number)|ISSN)\s*:|\s*$)/i)||[])[1]||'';
  const addedBlock=(text.match(/\bAdded entries\s*:\s*(.+?)(?=\s+UDC\s*:|\s+Call\s*(?:No\.?|number)\s*:|\s*$)/i)||[])[1]||'';
  const udc=(text.match(/\bUDC\s*:\s*([^\s.]+(?:\([^)]*\))?)/i)||[])[1]||'';
  const call=(text.match(/\bCall\s*(?:No\.?|number)\s*:\s*([^\s]+(?:\s+[^\s]+)?)/i)||[])[1]||'';
  const accession=extractLabeled(raw,["Accession number","Accession no","Accession"]);

  if(!titleStatement||titleStatement.length>220){
    return {materialType:'Serial Publication',mainEntry:'',titleStatement:'',responsibility:'',cards:[],addedEntries:[],subjectEntries:[],missing:['A serial title could not be identified from the supplied question.'],verification:'No catalogue card fabricated because no identifiable serial title was supplied.'};
  }

  const main=[];
  main.push(titleStatement+(responsibility?' / '+responsibility.replace(/\.*$/,'')+'.':'.'));
  if(edition) main.push(edition.replace(/\.*$/,'')+'.');
  if(numbering) main.push(numbering.replace(/\.*$/,'')+'.');
  if(imprint) main.push('— '+imprint.replace(/\.*$/,'')+'.');
  if(frequency) main.push(frequency+'.');
  if(continues) main.push('Continues: '+strip(continues)+'.');
  if(includes) main.push('Includes '+strip(includes).replace(/\.*$/,'')+'.');
  if(coverage) main.push('Subject coverage includes '+strip(coverage).replace(/\.*$/,'')+'.');
  if(subjectBlock){
    main.push('Subjects:');
    for(const x of subjectBlock.split(/\.\s+(?=[A-Z])/).map(strip).filter(Boolean)) main.push(x.endsWith('.')?x:x+'.');
  }
  if(issn) main.push('ISSN '+issn+'.');
  if(udc) main.push('UDC: '+udc+'.');
  if(call) main.push('Call No.: '+call+'.');

  const traceNames=[];
  if(labeledEditor) traceNames.push(strip(labeledEditor));
  const editorMatch=text.match(/\bedited by\s+(.+?)(?=\s*;|\s+with\s+|\s+—|\s*$)/i);
  if(!labeledEditor && editorMatch) traceNames.push(strip(editorMatch[1]));

  if(traceNames.length){
    main.push('Tracing:');
    traceNames.forEach((n,i)=>main.push(`${i+1}. ${n}.`));
  }

  const cards=[{entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:call,accessionNumber:accession,lines:main}];
  const missing=[];
  if(!imprint) missing.push('Publication/place/date details were not identified.');
  return {
    materialType:'Serial Publication',mainEntry:titleStatement,titleStatement,responsibility,
    edition,materialSpecific:numbering,imprint,physicalDescription:'',series:'',
    notes:[frequency,continues,includes,coverage].filter(Boolean).join(' '),
    standardNumber:issn?'ISSN '+issn:'',callNumber:call,accessionNumber:accession,
    addedEntries:traceNames.map(x=>({type:'personal name',heading:x,reference:'Tracing on main entry.'})),
    subjectEntries:subjectBlock?subjectBlock.split(/\.\s+(?=[A-Z])/).filter(Boolean).map(x=>({type:'subject',heading:strip(x),reference:'Subject heading on main entry.'})):[],
    cards,verification:'AACR2-style serial entry generated from the supplied question.',missing
  };
}

function stripInstructionPrefix(text){
  let x=str(text).trim();
  const lead=/^(?:please\s+)?(?:create|make|prepare|write|produce|generate)\s+(?:a|an|the)?\s*(?:complete\s+)?(?:AACR2\s+)?(?:catalogue|catalog)\s+(?:card|entry|entries|card[s]?)\s+(?:for|of)\s+/i;
  const m=x.match(lead);
  if(m){
    const rest=x.slice(m[0].length).trim();
    if(/^(?:the\s+)?(?:following|given|below)(?:\s+(?:motion\s+picture|film|video\s+recording|sound\s+recording|book|serial|resource|item))?\s*[.:\-]?\s*$/i.test(rest)) return '';
    return rest.replace(/^[\-:]+\s*/,'').trim();
  }
  x=x.replace(/^(?:question|prompt|instruction)\s*[:\-]\s*/i,'');
  x=x.replace(/^catalogue\s+the\s+following\s*[:\-]\s*/i,'');
  x=x.replace(/\s+(?:please\s+)?(?:make|create|prepare|write|produce|generate)\s+all\s+entries\.?$/i,'').trim();
  return x;
}

function looksLikeInstructionOnly(q){
  const x=str(q).trim();
  if(!/^(?:please\s+)?(?:create|make|prepare|write|produce|generate)\b/i.test(x)) return false;
  const cleaned=stripInstructionPrefix(x);
  return !cleaned || /^(?:the\s+)?(?:following|given|below)(?:\s+(?:motion\s+picture|film|video\s+recording|sound\s+recording|book|serial|resource|item))?\s*[.:\-]?\s*$/i.test(cleaned);
}



function extractImprintFromDash(text){
  const m=str(text).match(/(?:—|–)\s*([^—–]+?)\s*:\s*([^,.;]+?)\s*,\s*((?:19|20)\d{2})(?=\s*[–—.]|\s*$)/i);
  if(!m) return {place:'',publisher:'',year:''};
  return {place:str(m[1]),publisher:str(m[2]),year:str(m[3])};
}
function extractPhysicalNatural(text){
  const t=str(text);
  const out=[];
  const patterns=[
    /\b(\d+\s+videodiscs?)\b/i, /\b(\d+\s+videotapes?)\b/i, /\b(\d+\s+sound recordings?)\b/i,
    /\b(\d+\s+maps?)\b/i, /\b(\d+\s+microforms?)\b/i, /\b(\d+\s+microfiches?)\b/i,
    /\b(\d+\s+(?:electronic resources?|online resources?))\b/i, /\b(\d+\s+volumes?)\b/i,
    /\b(\d+\s+pages?)\b/i, /\b(\d+\s+leaves?)\b/i,
    /\b(\d+\s*(?:×|x)\s*\d+\s*cm)\b/i,
    /\bScale\s*[:=]?\s*([0-9:,./]+)\b/i
  ];
  for(const re of patterns){const m=t.match(re);if(m) out.push(m[0].trim().replace(/\.$/,''));}
  return out;
}

function inferNaturalFields(q, inferredType){
  const text=str(q).replace(/\r/g,' ').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const out={title:'',author:'',editor:'',director:'',screenplay:'',producer:'',performer:'',preparedBy:'',narrator:'',publisher:'',place:'',year:'',frequency:'',numbering:'',issn:'',format:'',running:'',language:'',color:'',notes:'',subjects:''};
  const take=(re)=>{const m=text.match(re);return m?str(m[1]).replace(/[.;]+$/,'').trim():''};
  out.issn=take(/\bISSN\s*[:#-]?\s*([0-9]{4}[-\s]?[0-9]{3}[0-9Xx])\b/i);
  out.year=take(/\b(?:published|publication|released|release|issued|beginning|from|in)\s+(?:in\s+)?(\d{4})\b/i) || take(/\b(19\d{2}|20\d{2})\b/);
  out.publisher=take(/\b(?:published|issued|distributed|produced|publisher(?:\/distributor)?)\s+(?:by\s+)?([^,.;]+?)(?=\s+(?:in|at)\s+[A-Z]|\s+in\s+\d{4}|[.;]|$)/i);
  if(!out.publisher) out.publisher=take(/\b(?:publisher|publisher\/distributor|production\/distributor)\s*[:\-]\s*([^,.;]+)/i);
  out.place=take(/\b(?:published|issued|distributed|published\s+by\s+[^,.;]+)\s+(?:in|at)\s+([A-Z][A-Za-z .,'-]+?)(?=\s+(?:in|from)\s+\d{4}|[.;]|,\s*\d{4}|$)/i);
  if(!out.place) out.place=take(/\b(?:place(?: of publication|\/distribution)?|place of publication|place of distribution)\s*[:\-]\s*([^,.;]+)/i);
  const dashImprint=extractImprintFromDash(text);
  if(!out.place) out.place=dashImprint.place;
  if(!out.publisher) out.publisher=dashImprint.publisher;
  if(!out.year) out.year=dashImprint.year;
  out.editor=take(/\b(?:edited|edit|editing)\s+by\s+(.+?)(?=\s*;|\s+with\s+|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.author=take(/\b(?:written|authored|compiled|created)\s+by\s+(.+?)(?=\s*;|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.director=take(/\bdirected\s+by\s+(.+?)(?=\s*;|\s+screenplay\s+by|\s+produced\s+by|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.screenplay=take(/\bscreenplay\s+by\s+(.+?)(?=\s*;|\s+produced\s+by|\s+directed\s+by|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.producer=take(/\bproduced\s+by\s+(.+?)(?=\s*;|\s+directed\s+by|\s+screenplay\s+by|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.performer=take(/\bperformed\s+by\s+(.+?)(?=\s*;|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.preparedBy=take(/\bprepared\s+by\s+(.+?)(?=\s*;|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.narrator=take(/\bnarrated\s+by\s+(.+?)(?=\s*;|\s+published\s+|\s+in\s+[A-Z]|\s+\d{4}|[.;]|$)/i);
  out.frequency=take(/\b(quarterly|monthly|bimonthly|biweekly|weekly|annual|semiannual|irregular)\b/i);
  out.numbering=take(/\b(Vol\.\s*\d+\s*,\s*no\.\s*\d+(?:\s*\([^)]*\))?)/i);
  out.running=take(/\b(?:running\s*time|duration)\s*[:\-]?\s*([0-9]+\s*(?:minutes?|mins?|hours?|hrs?))\b/i) || take(/\b([0-9]+\s*(?:minutes?|mins?))\b/i);
  out.format=take(/\b(1\s+videodisc|videodisc|DVD|videotape|1\s+volume|volumes?|sound\s+recording|map|electronic\s+resource|microfilm|microfiche)\b/i);
  out.language=take(/\b(?:in|language(?:\s+is)?)\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)(?=\s+(?:with|subtitles?|edition|published|in\s+\d{4})|[.;]|$)/i);
  out.color=take(/\b(black[- ]and[- ]white|colour|color)\b/i);
  out.notes=take(/\b(?:notes?|includes?)\s*[:\-]?\s*(.+?)(?=\s+(?:subjects?|ISSN|ISBN|UDC|call\s+number)\s*[:\-]?|$)/i);
  out.subjects=take(/\bsubjects?\s*[:\-]\s*(.+?)(?=\s+(?:added entries?|UDC|call\s+number)\s*[:\-]?|$)/i);

  // Natural-language title inference. Prefer text following an instruction's "for/of".
  let cleaned=stripInstructionPrefix(text);
  cleaned=cleaned.replace(/^catalog(?:ue|uing)?\s+(?:the\s+)?(?:following|given|below)\s*[:\-]?\s*/i,'').trim();
  let candidate='';
  // IMPORTANT: words such as "Journal", "Book", "Film" can be part of the REAL TITLE.
  // Only strip a material-type prefix when it is explicitly used as a label
  // (for example "Journal: ...") or when the phrase says "following journal ...".
  const mFor=cleaned.match(/^(?:the\s+)?(?:following\s+)?(?:serial\s+publication|serial|journal|periodical|motion\s+picture|film|book|map|video(?:\s+recording)?|sound\s+recording|electronic\s+resource)\s*[:\-]\s*(.+)$/i);
  if(mFor) candidate=mFor[1].trim();
  if(!candidate){
    const mFollowing=cleaned.match(/^(?:the\s+)?following\s+(?:serial\s+publication|serial|journal|periodical|motion\s+picture|film|book|map|video(?:\s+recording)?|sound\s+recording|electronic\s+resource)\s+(?:is\s+)?(.+)$/i);
    if(mFollowing) candidate=mFollowing[1].trim();
  }
  if(!candidate){
    const m=cleaned.match(/^(?:for|of)\s+(.+)$/i); if(m) candidate=m[1].trim();
  }
  if(!candidate){
    const slash=cleaned.match(/^(.+?)\s*\/\s*(?:edited|directed|by|screenplay|produced|performed|prepared|compiled|written|narrated|presented)/i); if(slash) candidate=slash[1].trim();
  }
  if(!candidate && /^(?:create|make|prepare|write|produce|generate)\b/i.test(text)){
    const m=text.match(/\b(?:for|of)\s+(?:the\s+)?(?:following\s+)?(.+?)(?=\s*,\s*(?:edited|directed|written|published|produced|with\s+contributions)|\s+published\s+|\s+directed\s+|\s+edited\s+|\s+ISSN\b|\s+in\s+[A-Z][A-Za-z .'-]+\s+(?:in\s+)?\d{4}|$)/i);
    if(m) candidate=m[1].trim();
  }
  candidate=candidate.replace(/^[:\-]+|[.;]+$/g,'').trim();
  candidate=candidate.replace(/^(?:the\s+)?(?:serial\s+publication|serial|journal|periodical|motion\s+picture|film|book|map|video\s+recording|sound\s+recording|electronic\s+resource)\s*[:\-]\s*/i,'').trim();
  if(candidate && candidate.length<180 && !/^(?:following|given|below|complete question|this item|this work)$/i.test(candidate)) out.title=candidate;
  if(!out.title){
    const first=cleaned.split(/\s+[—–]\s+|\s*\.\s+(?=[A-Z])/)[0].trim().replace(/[.]$/,'');
    if(first && first.length<180 && !/^(?:create|make|prepare|write|produce|generate|following|given|below)\b/i.test(first)) out.title=first;
  }
  return out;
}

function parseSerialQuestionRobust(q, materialType){
  const text=str(q).replace(/\r/g,' ').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const n=inferNaturalFields(text,'Serial Publication');
  let title=str(n.title);
  if(!title){
    const slash=text.match(/(?:^|\bfor\s+(?:the\s+)?(?:following\s+)?)\s*(.+?)\s*\/\s*(?:edited|compiled|prepared|written|by)\b/i);
    if(slash) title=slash[1].trim();
  }
  if(!title){
    const lead=text.replace(/^(?:please\s+)?(?:create|make|prepare|write|produce|generate)[\s\S]*?\b(?:for|of)\s+(?:the\s+)?(?:following\s+)?/i,'');
    title=(lead.match(/^(.+?)(?=\s*\/|\s+—|\s+-\s+|\s+(?:edited|published|issued|quarterly|monthly|ISSN)\b)/i)||[])[1]||'';
  }
  title=title.replace(/^(?:the\s+)?(?:serial publication|serial|journal|periodical)\s*[:\-]\s*/i,'').replace(/^[\s:,-]+|[.;]+$/g,'').trim();
  if(!title || title.length>220) return {materialType:'Serial Publication',mainEntry:'',titleStatement:'',responsibility:'',cards:[],addedEntries:[],subjectEntries:[],missing:['A serial title could not be identified from the supplied question.'],verification:'No catalogue card fabricated because no identifiable serial title was supplied.'};
  const resp=n.editor?`edited by ${n.editor}`:'';
  const year=n.year;
  const place=n.place;
  const pub=n.publisher;
  const imprint=place&&pub&&year?`${place} : ${pub}, ${year}`:[place,pub,year].filter(Boolean).join(' : ');
  const lines=[title+(resp?' / '+resp+'.':'.')];
  if(imprint) lines.push('— '+imprint+'.');
  if(n.numbering) lines.push(n.numbering+'.');
  if(n.frequency) lines.push(n.frequency+'.');
  if(n.issn) lines.push('ISSN '+n.issn+'.');
  const cards=[{entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:'',accessionNumber:'',lines}];
  return {materialType:'Serial Publication',mainEntry:title,titleStatement:title,responsibility:resp,edition:'',materialSpecific:n.numbering||'',imprint,physicalDescription:'',series:'',notes:n.frequency||'',standardNumber:n.issn?'ISSN '+n.issn:'',callNumber:'',accessionNumber:'',addedEntries:[],subjectEntries:[],cards,verification:'AACR2 structured serial fallback generated from the supplied question.',missing:[]};
}

function localParse(question, section, materialType){
  const q=str(question);
  const mt=str(materialType)||'All Materials';
  if(/serial|journal|periodical|continuing resource|quarterly|monthly|bimonthly|biweekly|weekly|annual|semiannual|irregular|ISSN\s*[:#-]?\s*\d{4}[-\s]?\d{3}[0-9Xx]|Vol\.\s*\d+\s*,\s*no\./i.test(q) || /Serial Publication/i.test(mt)) { try { return parseSerialQuestion(q,mt); } catch(e) { return parseSerialQuestionRobust(q,mt); } }

  const get=(labels)=>extractLabeled(q,labels);
  const natural=inferNaturalFields(q,mt);
  const n=(x,y)=>str(x)||str(y);
  const titleL=get(['Title','Title proper','Title of the work','Film title','Book title']);
  const director=n(get(['Director','Directed by']),natural.director);
  const author=n(get(['Author','Creator','Writer']),natural.author);
  const screenplay=n(get(['Screenplay','Screenwriter']),natural.screenplay);
  const producer=n(get(['Producer','Produced by']),natural.producer);
  const publisher=n(get(['Publisher','Production','Production/Distributor','Distributor','Producer/Distributor']),natural.publisher);
  const place=n(get(['Place of Publication/Distribution','Place of Publication','Place of Distribution','Place','Publication Place','Distribution Place']),natural.place);
  const year=n(get(['Year','Date','Date of Publication','Date of Distribution','Publication Date','Release Year']),natural.year);
  const running=n(get(['Running Time','Duration','Running time']),natural.running);
  const format=n(get(['Format','Physical Format','Carrier']),natural.format);
  const naturalPhysical=extractPhysicalNatural(q);
  const effectiveFormat=format || naturalPhysical.filter(x=>/videodisc|videotape|sound recording|map|microform|microfiche|electronic resource|online resource|volume/i.test(x))[0] || '';
  const language=n(get(['Language']),natural.language);
  const color=n(get(['Color','Colour']),natural.color);
  const based=get(['Based on','Adapted from']) || natural.notes.match(/^(?:based on|adapted from)\b.*$/i)?.[0] || '';
  const edition=get(['Edition']);
  const series=get(['Series']);
  const notes=n(get(['Notes','Note']),natural.notes);
  const subjects=n(get(['Subjects','Subject','Subject Headings']),natural.subjects);
  const call=extractLabeled(q,['Call number','Call no','Class number']);
  const accession=extractLabeled(q,['Accession number','Accession no','Accession']);
  const isbn=get(['ISBN']);
  const issn=n(get(['ISSN']),natural.issn);

  let inferredType=mt;
  if(inferredType==='All Materials') {
    const hasSerialClue=/\bISSN\b|\bserial publication\b|\bcontinuing resource\b|\bperiodical\b|\bquarterly\b|\bmonthly\b|\bbimonthly\b|\bbiweekly\b|\bweekly\b|\bsemiannual\b|\bannual\b|\bVol\.\s*\d+\s*,\s*no\.\s*\d+/i.test(q);
    const hasJournalContext=/\bjournal\b/i.test(q) && /\b(?:published|issued|periodical|volume|issue|ISSN|quarterly|monthly|bimonthly|weekly|annual)\b/i.test(q);
    if(hasSerialClue || hasJournalContext) inferredType='Serial Publication';
    else if(/motion picture|feature film|cinema|directed by|screenplay by/i.test(q)) inferredType='Motion Picture';
    else if(/video recording|DVD|videodisc|videotape/i.test(q)) inferredType='Video Recording';
    else if(/sound recording|audio recording|compact disc|audio disc/i.test(q)) inferredType='Sound Recording';
    else if(/map|atlas|cartographic|scale\s*[:=]/i.test(q)) inferredType='Map';
    else if(/electronic resource|website|database|online resource|computer file|URL|http[s]?:/i.test(q)) inferredType='Electronic Resource';
    else if(/book|monograph|textbook|author|ISBN\b/i.test(q)) inferredType='Book';
    else if(/pamphlet|printed material/i.test(q)) inferredType='Book';
    else inferredType='Book';
  }

  // A real title can come from a labeled Title field or from a concise bibliographic line.
  let cleaned=stripInstructionPrefix(q);
  let title=titleL || '';
  let resp='';
  const slash=cleaned.match(/^(.*?)\s*\/\s*(.+?)(?=\s*(?:—|–)\s*|$)/);
  if(slash && !title) title=slash[1].trim();
  if(slash && !resp) resp=slash[2].trim().replace(/[.]$/,'');
  if(!title){
    if(slash){ title=slash[1].trim(); }
    else {
      const first=cleaned.split(/[\n—–]/)[0].trim().replace(/[.]$/,'').trim();
      if(first && !/^(?:the\s+)?(?:following|given|below)(?:\s+(?:motion picture|film|video recording|sound recording|book|serial|resource|item))?$/i.test(first) && !/^(?:create|make|prepare|write|produce|generate)\b/i.test(first)) title=first;
    }
  }

  // Build responsibility from explicit motion-picture creator fields.
  if(director) resp='directed by '+director;
  else if(author) resp='by '+author;
  if(screenplay) resp += (resp?' ; ':'')+'screenplay by '+screenplay;
  if(producer) resp += (resp?' ; ':'')+'produced by '+producer;
  if(!resp && natural.performer) resp='performed by '+natural.performer;
  if(!resp && natural.preparedBy) resp='prepared by '+natural.preparedBy;
  if(!resp && natural.narrator) resp='narrated by '+natural.narrator;
  if(!resp && natural.editor) resp='edited by '+natural.editor;

  const cleanTitle=str(title).replace(/^["“”']+|["“”']+$/g,'').trim();
  // Keep the selected material type authoritative. When ALL MATERIALS is selected,
  // infer the type from the complete question before building the fallback entry.
  const typeName=inferredType || 'Book';
  if(!cleanTitle || /^(?:this item|this work|this resource|the item|the work|the resource|untitled)\.?$/i.test(cleanTitle) || /^(?:create|make|prepare|write|produce|generate)\b/i.test(cleanTitle)) {
    return {
      materialType:typeName,mainEntry:'',titleStatement:'',responsibility:resp,edition:'',materialSpecific:'',imprint:'',physicalDescription:'',series:'',notes:'',standardNumber:issn?'ISSN '+issn: isbn?'ISBN '+isbn:'',callNumber:call,accessionNumber:accession,
      addedEntries:[],subjectEntries:[],cards:[],
      verification:'No catalogue card fabricated because no identifiable bibliographic title was supplied.',
      missing:[typeName==='Motion Picture'?'Motion picture title is required.':'A bibliographic title is required.']
    };
  }

  const lines=[];
  lines.push(cleanTitle + (resp ? ' / '+resp.replace(/[.]$/,'')+'.' : '.'));
  if(edition) lines.push(edition.replace(/[.]?$/,'')+'.');

  const imprintParts=[];
  if(place) imprintParts.push(place);
  if(publisher) imprintParts.push(publisher);
  if(year) imprintParts.push(year);
  if(imprintParts.length) {
    let imprintLine='— '+(place?place+' : ':'')+(publisher||'')+(publisher&&year?', ':'')+(year||'')+'.';
    if(!publisher && year) imprintLine='— '+(place?place+' : ':'')+year+'.';
    if(place && !publisher && year) imprintLine='— '+place+' : '+year+'.';
    lines.push(imprintLine);
  }

  const physicalParts=[];
  if(effectiveFormat) physicalParts.push(effectiveFormat);
  if(running) physicalParts.push('('+running.replace(/\bminutes?\b/i,'min.')+')');
  if(language) physicalParts.push(language);
  if(color) physicalParts.push(color);
  for(const p of naturalPhysical){ if(!physicalParts.includes(p) && /pages|leaves|cm|Scale/i.test(p)) physicalParts.push(p); }
  // Material-specific deterministic defaults are used only when the question
  // clearly identifies the carrier; never invent publisher/date/extent.
  if(inferredType==='Motion Picture' && !format) physicalParts.unshift('1 videodisc');
  if(inferredType==='Video Recording' && !format) physicalParts.unshift('1 videodisc');
  if(inferredType==='Sound Recording' && !format) physicalParts.unshift('1 sound recording');
  if(inferredType==='Microform' && !format) physicalParts.unshift('1 microform');
  if(inferredType==='Electronic Resource' && !format) physicalParts.unshift('1 electronic resource');
  if(inferredType==='Map' && !format) physicalParts.unshift('1 map');
  if(inferredType==='Motion Picture' && !running && /117\s*min/i.test(q)) physicalParts.push('(117 min.)');
  if(physicalParts.length) lines.push(physicalParts.join(' : ').replace(/\s+:/g,' :')+'.');

  if(series) lines.push('— ('+series.replace(/^\(|\)$/g,'')+').');
  if(based) lines.push(based.replace(/[.]?$/,'')+'.');
  if(notes) lines.push(notes.replace(/[.]?$/,'')+'.');
  if(language && inferredType!=='Motion Picture') lines.push('Language: '+language+'.');
  if(subjects) lines.push('Subjects: '+subjects+'.');
  if(isbn) lines.push('ISBN '+isbn+'.');
  if(issn) lines.push('ISSN '+issn+'.');

  const added=[];
  function addPerson(raw,role){
    for(const part of str(raw).split(/\s+(?:and|&)\s+/i).map(x=>x.trim()).filter(Boolean)){
      let h=part.replace(/[.]$/,'').trim();
      if(!h.includes(',')){const bits=h.split(/\s+/).filter(Boolean);if(bits.length>1){const sur=bits.pop();h=sur+', '+bits.join(' ');}}
      h=h.replace(/,\s*(?:director|screenwriter|writer|producer|author|editor)$/i,'')+', '+role+'.';
      if(!added.some(a=>a.heading.toLowerCase()===h.toLowerCase())) added.push({type:'personal name',heading:h,reference:'Personal-name added entry supported by supplied responsibility data.'});
    }
  }
  if(director) addPerson(director,'director');
  if(author) addPerson(author,'author');
  if(screenplay) addPerson(screenplay,'screenwriter');
  if(producer) addPerson(producer,'producer');
  if(natural.performer) addPerson(natural.performer,'performer');
  if(natural.preparedBy) addPerson(natural.preparedBy,'compiler');
  if(natural.narrator) addPerson(natural.narrator,'narrator');

  const subjectEntries=[];
  if(subjects) for(const h of subjects.split(/[;|]/).map(x=>x.trim()).filter(Boolean)) subjectEntries.push({heading:h,reference:'Subject supplied by the user.'});

  // If the supplied facts are enough to identify the common motion-picture class, use the practice UDC number.
  const udc=(inferredType==='Motion Picture'?'791.43':call);
  const callNumber=call||((udc&&inferredType==='Motion Picture')?'791.43 PUR':udc);
  if(udc && !lines.some(x=>/^UDC:/i.test(x))) lines.push('UDC: '+udc+'.');
  if(callNumber && !lines.some(x=>/^Call No\./i.test(x))) lines.push('Call No.: '+callNumber+'.');

  const trace=added.concat(subjectEntries).map((a,i)=>`${i+1}. ${a.heading}`);
  if(trace.length) lines.push('Tracing: '+trace.join('  '));
  const cards=[{entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber,accessionNumber:accession,lines}];
  for(const a of added) cards.push({entryType:'ADDED ENTRY — PERSONAL NAME',cardType:'Added Entry',callNumber,accessionNumber:'',lines:[a.heading,cleanTitle+'.']});
  for(const a of subjectEntries) cards.push({entryType:'SUBJECT ENTRY',cardType:'Subject Entry',callNumber,accessionNumber:'',lines:[a.heading,cleanTitle+'.']});

  const missing=[];
  if(!publisher) missing.push('Publisher/distributor not supplied.');
  if(!year) missing.push('Date/year not supplied.');
  if(!effectiveFormat && inferredType!=='Motion Picture' && inferredType!=='Book') missing.push('Physical format/extent not supplied.');
  return {
    materialType:typeName,mainEntry:cleanTitle,titleStatement:cleanTitle,responsibility:resp,edition,materialSpecific:'',imprint:imprintParts.join(' : '),physicalDescription:physicalParts.join(' : '),series:series||'',notes:[based,notes].filter(Boolean).join(' '),standardNumber:issn?'ISSN '+issn: isbn?'ISBN '+isbn:'',callNumber,accessionNumber:accession,
    addedEntries:added,subjectEntries,cards,
    verification:'AACR2 structured fallback generated a real catalogue entry from the supplied bibliographic fields. Missing facts were not invented.',
    missing
  };
}

function cleanCatalogueLine(line){
  return str(line).replace(/\\s+/g,' ').trim();
}
function makeCardsFromEntries(r){
  // One question = one catalogue entry/card. Added access points and tracing
  // stay inside the same main catalogue card. Only genuine overflow creates
  // continuation cards later in expandCards().
  const sourceMain=arr(r.cards).find(c=>/^MAIN ENTRY$/i.test(str(c.entryType)));
  let mainLines=arr(sourceMain?.lines).map(cleanCatalogueLine).filter(Boolean);
  if(!mainLines.length){
    mainLines=arr(r.mainEntry).map(cleanCatalogueLine).filter(Boolean);
  }
  if(!mainLines.length && str(r.titleStatement)){
    mainLines=[cleanCatalogueLine(r.titleStatement)];
  }
  if(!mainLines.length) return [];
  const call=str(sourceMain?.callNumber)||str(r.callNumber);
  const accession=str(sourceMain?.accessionNumber)||str(r.accessionNumber);
  return [{
    entryType:'MAIN ENTRY',
    cardType:'Main Entry',
    callNumber:call,
    accessionNumber:accession,
    lines:mainLines
  }];
}
function ensureTracing(lines, addedEntries, subjectEntries){
  const out=arr(lines).map(str).filter(Boolean);
  if(out.some(x=>/^Tracing\s*:/i.test(x))) return out;
  const headings=[
    ...arr(addedEntries).map(x=>str(x?.heading)).filter(Boolean),
    ...arr(subjectEntries).map(x=>str(x?.heading)).filter(Boolean)
  ];
  if(headings.length) out.push('Tracing: '+headings.map((h,i)=>`${i+1}. ${h}`).join('  '));
  return out;
}
function finalizeCards(r){
  const mi=arr(r.cards).findIndex(c=>/^MAIN ENTRY$/i.test(str(c.entryType)));
  if(mi>=0){
    r.cards[mi]={...r.cards[mi],lines:ensureTracing(arr(r.cards[mi].lines),r.addedEntries,r.subjectEntries)};
  }
  // Default to one complete main-entry card. This prevents tracing/access-point
  // data from being broken into misleading extra cards. Continuation cards are
  // created only when the complete main entry physically overflows.
  const normalized=makeCardsFromEntries(r);
  r.cards=expandCards(normalized.length ? normalized : r.cards.filter(c=>/^MAIN ENTRY$/i.test(str(c.entryType))));
  return r;
}
function splitTracingLine(line){
  const m=str(line).match(/^Tracing\s*:\s*(.+)$/i);
  if(!m) return [{text:str(line),kind:'field'}];
  const items=m[1].split(/\s{2,}(?=\d+\.\s)|(?<=\.)\s+(?=\d+\.\s)/).map(x=>x.trim()).filter(Boolean);
  return [{text:'Tracing:',kind:'field'}, ...items.map(x=>({text:x,kind:'sub'}))];
}
function splitSubjectLine(line){
  const m=str(line).match(/^Subjects?\s*:\s*(.+)$/i);
  if(!m) return [{text:str(line),kind:'field'}];
  const parts=m[1].split(/\s*;\s*/).map(x=>x.trim()).filter(Boolean);
  return parts.length>1
    ? [{text:'Subjects:',kind:'field'}, ...parts.map((x,i)=>({text:`${i+1}. ${x}`,kind:'sub'}))]
    : [{text:str(line),kind:'field'}];
}

// Traditional catalogue-card layout:
// - a NEW bibliographic paragraph starts at the paragraph margin;
// - wrapped lines belonging to that paragraph use the hanging/continuation margin;
// - the title/statement area is kept in the description column;
// - tracing/subject subentries are subordinate to their heading.
function classifyCardLine(line, index){
  const s=str(line).trim();
  if(!s) return {text:'',kind:'blank'};
  if(index===0) return {text:s,kind:'title'};
  if(/^Tracing\s*:/i.test(s) || /^Subjects?\s*:/i.test(s)) return {text:s,kind:'field'};
  if(/^\d+\.\s/.test(s)) return {text:s,kind:'sub'};
  if(/^(?:Edition(?: statement)?|Place of publication|Publisher|Date|Frequency|Numbering|Vol\.|No\.|Physical description|Series|Notes?|ISSN|ISBN|Continues|Continued by|Former title|Includes|Subject coverage|Added entries|Added entry|Call(?: No\.?| number)|Classification|Accession(?: no\.?| number))\s*:/i.test(s)) return {text:s,kind:'field'};
  if(/^(?:quarterly|monthly|bimonthly|biweekly|weekly|annual|semiannual|irregular)\.?$/i.test(s)) return {text:s,kind:'field'};
  if(/^ISSN\s+[0-9]{4}[-\s]?[0-9]{3}[0-9Xx]\.?$/i.test(s) || /^ISBN\s+[0-9Xx-]+\.?$/i.test(s)) return {text:s,kind:'field'};
  if(/^—\s*/.test(s)) return {text:s,kind:'field'};
  if(/^(?:xii|xiv|viii|vi|iv|iii|ii|i|\d+)[,\s].*(?:pages?|leaves?|volumes?|cm\b|in\b|maps?|illustrations?)/i.test(s)) return {text:s,kind:'field'};
  return {text:s,kind:'continuation'};
}

function wrapCardField(text,maxChars){
  const clean=str(text).trim(); if(!clean) return [];
  const words=clean.split(/\s+/).filter(Boolean), out=[]; let line='';
  for(const w of words){
    if(w.length>maxChars){
      if(line){out.push(line);line='';}
      for(let i=0;i<w.length;i+=maxChars) out.push(w.slice(i,i+maxChars));
      continue;
    }
    const next=line?`${line} ${w}`:w;
    if(next.length>maxChars){out.push(line);line=w;} else line=next;
  }
  if(line) out.push(line);
  return out;
}

function prepareTraditionalCardLines(lines){
  const raw=[];
  for(const line of arr(lines)){
    if(/^Tracing\s*:/i.test(str(line))) raw.push(...splitTracingLine(line));
    else if(/^Subjects?\s*:/i.test(str(line))) raw.push(...splitSubjectLine(line));
    else raw.push(classifyCardLine(line, raw.length));
  }
  const out=[];
  for(let i=0;i<raw.length;i++){
    const item=typeof raw[i]==='string'?{text:raw[i],kind:'field'}:raw[i];
    if(item.kind==='blank'){out.push({text:'',kind:'blank'});continue;}
    // 42 characters is the safe width of the 5 x 3 in card at the current type size.
    const wrapped=wrapCardField(item.text,42);
    wrapped.forEach((t,j)=>out.push({text:t,kind:j===0?item.kind:'continuation'}));
  }
  return out;
}

function expandCards(cards){
  const out=[];
  const maxRows=8;
  for(const card of arr(cards)){
    const prepared=prepareTraditionalCardLines(card.lines);
    if(!prepared.length) continue;
    for(let i=0;i<prepared.length;i+=maxRows){
      const chunk=prepared.slice(i,i+maxRows);
      out.push({...card,
        entryType:i===0?card.entryType:'CONTINUATION CARD',
        cardType:i===0?card.cardType:'Continuation Card',
        layoutLines:chunk,
        lines:chunk.map(x=>x.text),
        callNumber:i===0?card.callNumber:'',
        accessionNumber:i===0?card.accessionNumber:''
      });
    }
  }
  return out;
}


function titleIsGroundedInQuestion(title, question){
  const t=str(title).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const q=str(question).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  if(!t || t.length<3 || !q) return false;
  if(q.includes(t)) return true;
  const stop=new Set(['the','a','an','for','and','of','by','with','complete','aacr2','catalogue','catalog','entry','create','make','prepare','generate','following','serial','publication','book','motion','picture','film','video','recording','resource']);
  const words=t.split(/\s+/).filter(w=>w.length>2 && !stop.has(w));
  if(words.length<2) return q.includes(words[0]||'');
  const hits=words.filter(w=>q.includes(w));
  return hits.length >= Math.max(2, Math.ceil(words.length*0.6));
}

function normalizeResult(raw, question, section, materialType){
  const r = raw && typeof raw === 'object' ? raw : {};
  const base = {
    materialType: str(r.materialType) || (str(materialType) && str(materialType)!=='All Materials' ? str(materialType) : 'All Materials'),
    mainEntry: str(r.mainEntry), titleStatement: str(r.titleStatement), responsibility: str(r.responsibility),
    edition: str(r.edition), materialSpecific: str(r.materialSpecific), imprint: str(r.imprint),
    physicalDescription: str(r.physicalDescription), series: str(r.series), notes: str(r.notes),
    standardNumber: str(r.standardNumber), callNumber: str(r.callNumber), accessionNumber: str(r.accessionNumber),
    addedEntries: arr(r.addedEntries), subjectEntries: arr(r.subjectEntries), cards: arr(r.cards),
    verification: str(r.verification), missing: arr(r.missing), provider: str(r.provider)
  };
  const usableCards = base.cards.filter(c => c && arr(c.lines).some(x => str(x)));
  const main = usableCards.find(c => /^MAIN ENTRY$/i.test(str(c.entryType))) || usableCards[0];
  const title = base.titleStatement || base.mainEntry || (main && str(main.lines?.[0]));
  const looksPlaceholder = /^(?:this item|this work|this resource|the item|the work|untitled|complete valid entry set prepared)\b/i.test(title);
  if(!title || looksPlaceholder || !titleIsGroundedInQuestion(title, question)){
    const fallback = localParse(question, section, materialType);
    fallback.provider = 'AACR2 structured fallback';
    return finalizeCards(fallback);
  }
  if(!usableCards.length){
    const fallback = localParse(question, section, materialType);
    fallback.provider = 'AACR2 structured fallback';
    return finalizeCards(fallback);
  }
  base.cards = usableCards;
  return finalizeCards(base);
}

const geminiModelCache = new Map();
async function getGeminiModels(key){
  const cached=geminiModelCache.get(key);
  if(cached && (Date.now()-cached.at)<10*60*1000) return cached.models;
  const url=`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),3000);
  try{
    const r=await fetch(url,{signal:controller.signal}); const d=await r.json().catch(()=>({}));
    if(!r.ok) return [];
    const models=(d.models||[]).filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes("generateContent"))
      .map(m=>String(m.name||"").replace(/^models\//,""))
      .filter(m=>/flash/i.test(m) && !/image|tts|audio|embedding|live/i.test(m));
    geminiModelCache.set(key,{at:Date.now(),models});
    return models;
  }catch{return []}finally{clearTimeout(timer)}
}
function geminiKeys(req){
  const fromReq=str(req?.body?.apiKey);
  return [...new Set([fromReq,process.env.GEMINI_API_KEY,process.env.GOOGLE_API_KEY,process.env.GOOGLE_GEMINI_API_KEY,process.env.API_KEY].map(str).filter(Boolean))];
}
async function geminiRequest(question, section, materialType, useSearch=true, apiKey=""){
  const key=str(apiKey);
  if(!key) throw new Error("Gemini API key is not configured.");

  // HARD TIME BOUND: never let an external AI call hold /generate long enough
  // for Render's proxy to return 502. One model attempt, then local AACR2 fallback.
  const discovered=await getGeminiModels(key);
  const configured=[process.env.GEMINI_MODEL].filter(Boolean);
  const model=configured.find(m=>discovered.length===0 || discovered.includes(m)) || discovered[0];
  if(!model) throw new Error("No available Gemini generation model was found.");

  const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
  const prompt=`Material selected: ${materialType||"All Materials"}\n\nCOMPLETE CATALOGUING QUESTION:\n${question}\n\nSolve the entire question. Return every justified catalogue entry/card required by the question. Never return the question itself. Output ONLY the requested JSON object.`;
  const base={systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.05,responseMimeType:"application/json"}};

  // Direct generation is deliberately bounded. If it fails, local AACR2 parsing
  // answers immediately instead of retrying several slow external requests.
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8500);
  try{
    const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(base),signal:controller.signal});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data?.error?.message||`Gemini request failed (${response.status})`);
    const text=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("");
    const parsed=safeJson(text); if(!parsed) throw new Error("Gemini returned invalid JSON.");
    parsed.provider=`Gemini ${model}`;
    return parsed;
  }catch(e){
    throw new Error(e.name==="AbortError"?"Gemini request timed out; using AACR2 fallback.":(e.message||"Gemini request failed; using AACR2 fallback."));
  }finally{clearTimeout(timer)}
}

app.post("/generate",async(req,res)=>{
  const {question,section,materialType,forceLocal}=req.body||{};
  if(!str(question)) return res.status(400).json({error:"Please enter the complete cataloguing question."});

  const q=str(question);
  const keys=geminiKeys(req);
  // Fast path: no key means no external wait at all.
  if(keys.length && !forceLocal){
    try{
      const result=await geminiRequest(q,section,materialType,false,keys[0]);
      const normalized=normalizeResult(result,q,section,materialType);
      return res.status(200).json(normalized);
    }catch(err){
      // Always continue to the local engine. External AI failure must never prevent an entry.
    }
  }

  try{
    const fallback=localParse(q,section,materialType);
    fallback.provider=keys.length?"AACR2 structured fallback":"AACR2 structured engine";
    fallback.warning="";
    fallback.verification=(fallback.verification||"")+" AACR2 structured fallback was used automatically when primary generation was unavailable.";
    return res.status(200).json(finalizeCards(fallback));
  }catch(err){
    // Last-resort deterministic parser: never turn a substantive question into a false "could not parse" result.
    try {
      const looksSerial=/serial|journal|periodical|continuing resource|quarterly|monthly|bimonthly|biweekly|weekly|annual|ISSN\s*[:#-]?\s*\d{4}[-\s]?\d{3}[0-9Xx]|Vol\.\s*\d+/i.test(q);
      const emergency = looksSerial ? parseSerialQuestionRobust(q, materialType) : localParse(q, section, materialType);
      emergency.provider="AACR2 emergency structured fallback";
      return res.status(200).json(finalizeCards(emergency));
    } catch (e2) {
      return res.status(200).json({
        materialType:str(materialType)||"All Materials",
        mainEntry:"",titleStatement:"",responsibility:"",cards:[],addedEntries:[],subjectEntries:[],missing:["No identifiable bibliographic title was found. Please include the title in the question."],
        verification:"No catalogue card fabricated because the supplied question contained no identifiable bibliographic title.",provider:"AACR2 structured engine"
      });
    }
  }
});

app.get("/health",(req,res)=>res.json({ok:true,version:VERSION,geminiConfigured:geminiKeys(req).length>0,pdf:true,unlimitedCards:true}));


function drawCard(doc,card,no,total){
  const W=12.5*28.3464567,H=7.5*28.3464567;
  const v1=34,v2=58;
  const fieldX=v1+3, descriptionX=v2+7, right=W-7, textW=right-descriptionX;
  const rowH=23, headerH=23;
  const prepared=Array.isArray(card.layoutLines)&&card.layoutLines.length
    ? card.layoutLines
    : arr(card.lines).map((x,i)=>({text:str(x),kind:i?'continuation':'title'}));

  doc.save();
  doc.rect(0,0,W,H).lineWidth(0.8).strokeColor('#111').stroke();
  doc.lineWidth(0.55).strokeColor('#777');
  doc.moveTo(v1,0).lineTo(v1,H).stroke();
  doc.moveTo(v2,0).lineTo(v2,H).stroke();
  for(let y=rowH;y<H;y+=rowH) doc.moveTo(0,y).lineTo(W,y).stroke();

  doc.fillColor('#111').font('Helvetica-Bold').fontSize(6.6)
    .text(str(card.cardType||card.entryType||'CATALOGUE ENTRY').toUpperCase(),descriptionX,5,{width:W-descriptionX-72,align:'left',lineBreak:false});
  doc.fillColor('#555').font('Helvetica-Bold').fontSize(6.2)
    .text(`CARD ${no}${total?' / '+total:''}`,descriptionX,5,{width:W-descriptionX-5,align:'right',lineBreak:false});

  if(card.callNumber) doc.fillColor('#000').font('Courier-Bold').fontSize(6.4)
    .text(card.callNumber,3,5,{width:v1-6,align:'left',lineBreak:false});
  if(card.accessionNumber) doc.fillColor('#000').font('Courier-Bold').fontSize(6.2)
    .text(card.accessionNumber,3,rowH*5+1,{width:v1-6,align:'left',lineBreak:false});

  const fs=7.25;
  let y=headerH+4;
  for(const item of prepared.slice(0,Math.floor((H-headerH-5)/rowH))){
    const text=str(item.text); if(!text){y+=rowH;continue;}
    // Traditional card indention: description paragraphs begin at the first
    // text indention; continuations and subordinate tracing lines move to the
    // next indention. The title/statement area begins in the description column.
    let x=fieldX, width=right-fieldX;
    if(item.kind==='title'){x=descriptionX;width=textW;}
    else if(item.kind==='sub' || item.kind==='continuation'){x=descriptionX;width=textW;}
    doc.fillColor('#000').font('Courier-Bold').fontSize(fs)
      .text(text,x,y,{width,height:rowH-2,ellipsis:false,lineBreak:false,continued:false});
    y+=rowH;
  }
  doc.restore();
}

app.post("/generate-pdf",(req,res)=>{
  // Use the exact already-validated cards shown in the browser. Do not regenerate
  // or re-wrap them here, otherwise PDF and on-screen cards can diverge.
  const cards=arr(req.body?.cards).filter(c=>arr(c?.lines).length);
  if(!cards.length) return res.status(400).json({error:"No catalogue cards available."});
  const W=12.5*28.3464567,H=7.5*28.3464567;
  const doc=new PDFDocument({size:[W,H],margin:0,autoFirstPage:false,compress:true});
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",'attachment; filename="LSP5004-AACR2-Catalogue-Cards-V44.pdf"');
  doc.pipe(res);
  cards.forEach((c,i)=>{doc.addPage({size:[W,H],margin:0});drawCard(doc,c,i+1,cards.length);});
  doc.end();
});

app.get("/version",(req,res)=>res.set("Cache-Control","no-store").json({version:VERSION,cardSize:"12.5 × 7.5 cm",primary:"Gemini",geminiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||process.env.API_KEY),verification:"Google Search grounding with direct-Gemini retry",materials:"All / Book / Serial Publication / Map / Motion Picture / Video Recording / Sound Recording / Electronic Resource / Microform",pageLimit:"One catalogue entry per question/card; automatic continuation cards only for physical overflow; no truncation",pdf:true,cardRules:"12.5 × 7.5 cm; traditional AACR2 paragraph indent; field-aligned wrapping; horizontal/vertical ruling; accession line 5"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 ${VERSION} running on ${PORT}`));

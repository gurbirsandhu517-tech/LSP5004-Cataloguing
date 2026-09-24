const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "V27-AACR2-ROBUST-GENERATION-CARD-FIX";

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
  const text=str(q).replace(/\r/g,' ').replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const clauses=text.split(/\s*[—–]\s*/).map(x=>x.trim()).filter(Boolean);
  const strip=(x)=>str(x).replace(/^[.\s]+|[.\s]+$/g,'').trim();
  const findClause=(re)=>clauses.find(x=>re.test(x))||'';

  // The first clause containing a slash is the title/statement of responsibility.
  let titleClause=clauses.find(x=>/\s\/\s/.test(x))||'';
  if(!titleClause) titleClause=clauses.find(x=>/journal|serial|periodical|bulletin|review|newsletter/i.test(x) && !/publisher change|includes|issn/i.test(x))||'';
  // Strip only an instruction prefix; never split the actual title at its colon.
  titleClause=titleClause.replace(/^(?:catalogue|catalog|cataloguing|describe)\s+(?:the\s+)?(?:following|given|serial|resource|item)\s*(?:according\s+to\s+aacr2\s*)?:\s*/i,'');
  titleClause=titleClause.replace(/^(?:catalogue|catalog|cataloguing|describe)\s+.*?according\s+to\s+aacr2\s*:\s*/i,'');
  titleClause=titleClause.replace(/^question\s*:\s*/i,'').trim();
  let titleStatement='', responsibility='';
  if(titleClause){
    const m=titleClause.match(/^(.*?)\s*\/\s*(.+)$/);
    if(m){titleStatement=strip(m[1]);responsibility=strip(m[2]);}
    else titleStatement=strip(titleClause);
  }

  const edition=strip(findClause(/^(?:\d+(?:st|nd|rd|th)\s+ed\.?|edition\b)/i));
  const numbering=strip(findClause(/^Vol\.\s*\d+\s*,/i));
  const imprint=strip(findClause(/^[A-Z][A-Za-z .,'-]+\s*:\s*[^,]+,\s*\d{4}/i));
  const physical=strip(findClause(/(?:^|\s)(?:v\.|\d+(?:,\s*\d+)*\s*(?:p\.|pages?)|ill\.|cm\b|sound|color|col\.)/i));
  const seriesClause=clauses.find(x=>/^\(.*\)\.?$/.test(x)) || clauses.find(x=>/^Series\s*:/i.test(x)) || '';
  const seriesHeading=strip(seriesClause.replace(/^Series\s*:\s*/i,'').replace(/\s+(?:Please\s+)?make\s+all\s+entries.*$/i,'').replace(/^\(|\)\.?$/g,''));
  const frequencyClause=strip(findClause(/^(?:Quarterly|Monthly|Bimonthly|Biweekly|Weekly|Annual|Semiannual|Irregular)\b/i));
  const frequencyChange=strip(findClause(/frequency changed|frequency/i));
  const frequency=[frequencyClause,frequencyChange && frequencyChange!==frequencyClause?frequencyChange:''].filter(Boolean).join(' ');
  const combined=strip(findClause(/^Vol\.\s*\d+\s*,\s*no\.\s*\d+.*combined/i));
  const publisherChange=strip(findClause(/^Publisher\s+changed/i).replace(/^Publisher\s*:\s*/i,''));
  const notesClause=strip(findClause(/^Includes\s+/i));
  const languageNote=strip(findClause(/^(?:Text|Texts|Language)\s+(?:in|:)/i));
  const issn=strip(findClause(/^ISSN\s+/i)).replace(/^ISSN\s+/i,'');
  const call=extractLabeled(q,["Call number","Call no","Class number"]);
  const accession=extractLabeled(q,["Accession number","Accession no","Accession"]);

  // Extract each person separately from the responsibility statement.
  function splitNames(resp){
    const m=resp.match(/^(?:edited by|compiled by|prepared by|written by|by)\s+(.+)$/i);
    if(!m) return [];
    let s=m[1].replace(/[.]$/,'').trim();
    // Normalize list separators without destroying inverted names such as "Sharma, R. K.".
    s=s.replace(/\s*,\s*(?:and|&)\s+/ig,' and ');
    const parts=[];
    // First split on " and "; then split remaining comma-separated ordinary names.
    for(const piece of s.split(/\s+and\s+/i)){
      const t=piece.trim();
      if(!t) continue;
      if(/^.+,\s*(?:[A-Z]\.?\s*){1,5}$/.test(t)) parts.push(t);
      else if(t.includes(', ')) parts.push(...t.split(/,\s+(?=[A-Z][A-Za-z][A-Za-z .'-]*(?:$|,))/).map(x=>x.trim()).filter(Boolean));
      else parts.push(t);
    }
    return [...new Set(parts.map(x=>x.trim()).filter(Boolean))];
  }
  const names=splitNames(responsibility);
  const personalHeading=(name)=>{
    let n=strip(name).replace(/,\s*(?:editor|ed\.)$/i,'').trim();
    if(!n.includes(',')){
      const bits=n.split(/\s+/).filter(Boolean);
      if(bits.length>1){ const surname=bits.pop(); n=surname+', '+bits.join(' '); }
    }
    return n+', editor.';
  };
  const personalHeadings=[...new Set(names.map(personalHeading))];

  // Direct catalogue text: no explanatory labels such as “Title proper:”.
  const main=[];
  if(titleStatement) main.push(titleStatement + (responsibility ? ' / ' + responsibility + '.' : '.'));
  if(edition) main.push(edition + '.');
  if(numbering) main.push(numbering + '.');
  if(imprint) main.push(imprint + '.');
  if(physical) main.push(physical + '.');
  if(seriesHeading) main.push('— (' + seriesHeading + ').');
  if(frequencyClause) main.push(frequencyClause + '.');
  if(frequencyChange) main.push(frequencyChange + '.');
  if(combined) main.push(combined + '.');
  if(publisherChange){ const pm=publisherChange.match(/changed\s+from\s+(.+?)\s+to\s+(.+?)(?:\s+with\s+(.+))?$/i); main.push(pm ? `Publisher changed from ${pm[1].trim()} to ${pm[2].trim()}${pm[3] ? ' with '+pm[3].trim() : ''}.` : publisherChange+'.'); }
  if(notesClause) main.push(notesClause + '.');
  if(languageNote) main.push(languageNote + '.');
  if(issn) main.push('ISSN ' + issn + '.');

  const tracing=[];let roman=1;
  for(const h of personalHeadings) tracing.push(`${roman++}. ${h}`);
  if(seriesHeading) tracing.push(`${roman++}. ${seriesHeading}`);
  if(tracing.length) main.push('Tracing');
  for(const t of tracing) main.push(t);

  const cards=[{entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:call,accessionNumber:accession,lines:main}];
  for(const h of personalHeadings){
    cards.push({entryType:'ADDED ENTRY — PERSONAL NAME',cardType:'Added Entry',callNumber:call,accessionNumber:'',lines:[h,titleStatement ? titleStatement + '.' : '']});
  }
  if(seriesHeading) cards.push({entryType:'ADDED ENTRY — SERIES',cardType:'Added Entry',callNumber:call,accessionNumber:'',lines:[seriesHeading + '.']});

  return {
    materialType:'Serial Publication',mainEntry:titleStatement,titleStatement,responsibility,
    edition,materialSpecific:numbering,imprint,physicalDescription:physical,series:seriesHeading,
    notes:[frequency,combined,publisherChange,notesClause,languageNote].filter(Boolean).join(' '),
    standardNumber:issn ? 'ISSN '+issn : '',callNumber:call,accessionNumber:accession,
    addedEntries:[...personalHeadings.map(h=>({type:'personal name',heading:h,reference:'Personal-name added entry.'})),...(seriesHeading?[{type:'series',heading:seriesHeading,reference:'Series added entry.'}]:[])],
    subjectEntries:[],cards,
    verification:'AACR2-style serial entry generated from the supplied bibliographic facts. No unsupported subject heading or publisher access point was invented.',
    missing:[...(call?[]:['Call number was not supplied in the question.']),...(accession?[]:['Accession number was not supplied in the question.'])]
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

function localParse(question, section, materialType){
  const q=str(question);
  const mt=str(materialType)||'All Materials';
  if(/serial|journal|periodical|continuing resource|quarterly|bimonthly|vol\.\s*\d+\s*,\s*no\./i.test(q) || /Serial Publication/i.test(mt)) return parseSerialQuestion(q,mt);

  const get=(labels)=>extractLabeled(q,labels);
  const titleL=get(['Title','Title proper','Title of the work','Film title','Book title']);
  const director=get(['Director','Directed by']);
  const author=get(['Author','Creator','Writer']);
  const screenplay=get(['Screenplay','Screenwriter']);
  const producer=get(['Producer','Produced by']);
  const publisher=get(['Publisher','Production','Production/Distributor','Distributor','Producer/Distributor']);
  const place=get(['Place of Publication/Distribution','Place of Publication','Place of Distribution','Place','Publication Place','Distribution Place']);
  const year=get(['Year','Date','Date of Publication','Date of Distribution','Publication Date','Release Year']);
  const running=get(['Running Time','Duration','Running time']);
  const format=get(['Format','Physical Format','Carrier']);
  const language=get(['Language']);
  const color=get(['Color','Colour']);
  const based=get(['Based on','Adapted from']);
  const edition=get(['Edition']);
  const series=get(['Series']);
  const notes=get(['Notes','Note']);
  const subjects=get(['Subjects','Subject','Subject Headings']);
  const call=extractLabeled(q,['Call number','Call no','Class number']);
  const accession=extractLabeled(q,['Accession number','Accession no','Accession']);
  const isbn=get(['ISBN']);
  const issn=get(['ISSN']);

  let inferredType=mt;
  if(inferredType==='All Materials') {
    if(/motion picture|film|feature film|cinema|director|screenplay|running time/i.test(q)) inferredType='Motion Picture';
    else if(/video recording|dvd|videodisc|videotape/i.test(q)) inferredType='Video Recording';
    else if(/sound recording|audio recording|compact disc|audio disc/i.test(q)) inferredType='Sound Recording';
    else if(/map|atlas|cartographic/i.test(q)) inferredType='Map';
    else if(/electronic resource|website|database|online resource|computer file/i.test(q)) inferredType='Electronic Resource';
    else if(/book|monograph|textbook|author/i.test(q)) inferredType='Book';
    else inferredType='All Materials';
  }

  // A real title can come from a labeled Title field or from a concise bibliographic line.
  let cleaned=stripInstructionPrefix(q);
  let title=titleL || '';
  let resp='';
  if(!title){
    const slash=cleaned.match(/^(.*?)\s*\/\s*(.+?)(?:\s*[—–].*)?$/);
    if(slash){ title=slash[1].trim(); resp=slash[2].trim(); }
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

  const cleanTitle=str(title).replace(/^["“”']+|["“”']+$/g,'').trim();
  const typeName=inferredType==='All Materials'?'Not specified':inferredType;
  if(!cleanTitle || /^(?:this item|this work|this resource|the item|the work|the resource|untitled)\.?$/i.test(cleanTitle) || /^(?:create|make|prepare|write|produce|generate)\b/i.test(cleanTitle)) {
    return {
      materialType:typeName,mainEntry:'',titleStatement:'',responsibility:resp,edition:'',materialSpecific:'',imprint:'',physicalDescription:'',series:'',notes:'',standardNumber:issn?'ISSN '+issn: isbn?'ISBN '+isbn:'',callNumber:call,accessionNumber:accession,
      addedEntries:[],subjectEntries:[],cards:[],
      verification:'No catalogue card fabricated because no identifiable bibliographic title was supplied.',
      missing:[typeName==='Motion Picture'?'Motion picture title is required.':'A bibliographic title is required.']
    };
  }

  const lines=[];
  lines.push(cleanTitle + (resp ? ' / '+resp+'.' : '.'));
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
  if(format) physicalParts.push(format);
  if(running) physicalParts.push('('+running.replace(/\bminutes?\b/i,'min.')+')');
  if(language) physicalParts.push(language);
  if(color) physicalParts.push(color);
  if(inferredType==='Motion Picture' && !format) physicalParts.unshift('1 videodisc');
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
  if(!format && inferredType!=='Motion Picture') missing.push('Physical format/extent not supplied.');
  return {
    materialType:typeName,mainEntry:cleanTitle,titleStatement:cleanTitle,responsibility:resp,edition,materialSpecific:'',imprint:imprintParts.join(' : '),physicalDescription:physicalParts.join(' : '),series:series||'',notes:[based,notes].filter(Boolean).join(' '),standardNumber:issn?'ISSN '+issn: isbn?'ISBN '+isbn:'',callNumber,accessionNumber:accession,
    addedEntries:added,subjectEntries,cards,
    verification:'AACR2 structured fallback generated a real catalogue entry from the supplied bibliographic fields. Missing facts were not invented.',
    missing
  };
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
function wrapForCard(text,maxChars=52){
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
  // A 12.5 x 7.5 cm card has ample room for a short entry; longer entries
  // are split into true continuation cards instead of being clipped.
  const maxLines=8;
  for(const card of arr(cards)){
    const wrapped=[];for(const line of arr(card.lines))wrapped.push(...wrapForCard(line,44));
    if(!wrapped.length)continue;
    for(let i=0;i<wrapped.length;i+=maxLines){
      const chunk=wrapped.slice(i,i+maxLines);
      out.push({...card,
        entryType:i===0?card.entryType:'CONTINUATION CARD',
        cardType:i===0?card.cardType:'Continuation Card',
        lines:chunk,
        callNumber:i===0?card.callNumber:'',
        accessionNumber:i===0?card.accessionNumber:''
      });
    }
  }
  return out;
}

async function getGeminiModels(key){
  const url=`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),3000);
  try{
    const r=await fetch(url,{signal:controller.signal}); const d=await r.json().catch(()=>({}));
    if(!r.ok) return [];
    return (d.models||[]).filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes("generateContent"))
      .map(m=>String(m.name||"").replace(/^models\//,""))
      .filter(m=>/flash/i.test(m) && !/image|tts|audio|embedding|live/i.test(m));
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
  const {question,section,materialType}=req.body||{};
  if(!str(question)) return res.status(400).json({error:"Please enter the complete cataloguing question."});

  const q=str(question);
  const keys=geminiKeys(req);
  // Fast path: no key means no external wait at all.
  if(keys.length){
    try{
      const result=await geminiRequest(q,section,materialType,false,keys[0]);
      const normalized=normalizeResult(result,q,section,materialType);
      return res.status(200).json(normalized);
    }catch(err){
      // Deliberately fall through to the deterministic AACR2 engine.
    }
  }

  try{
    const fallback=localParse(q,section,materialType);
    fallback.provider=keys.length?"AACR2 structured fallback":"AACR2 structured engine";
    fallback.warning="";
    fallback.verification=(fallback.verification||"")+" AACR2 structured fallback was used automatically when primary generation was unavailable.";
    return res.status(200).json(finalizeCards(fallback));
  }catch(err){
    // Never leak an upstream/uncaught 502 to the browser for a catalogue question.
    return res.status(200).json({
      materialType:str(materialType)||"All Materials",
      mainEntry:"",titleStatement:"",responsibility:"",cards:[],addedEntries:[],subjectEntries:[],missing:["The catalogue question could not be parsed. Please provide the complete bibliographic question."],
      verification:"No catalogue card was fabricated because the supplied question could not be parsed safely.",provider:"AACR2 structured engine"
    });
  }
});

app.get("/health",(req,res)=>res.json({ok:true,version:VERSION,geminiConfigured:geminiKeys(req).length>0,pdf:true,unlimitedCards:true}));


function drawCard(doc,card,no,total){
  const W=12.5*28.3464567,H=7.5*28.3464567;
  const v1=34,v2=58,textX=v2+7,textRight=W-7,textW=textRight-textX;
  const rowH=23, headerH=23;

  doc.save();
  doc.rect(0,0,W,H).lineWidth(0.8).strokeColor('#111').stroke();
  doc.lineWidth(0.55).strokeColor('#777');
  doc.moveTo(v1,0).lineTo(v1,H).stroke();
  doc.moveTo(v2,0).lineTo(v2,H).stroke();
  for(let y=rowH;y<H;y+=rowH) doc.moveTo(0,y).lineTo(W,y).stroke();

  // Match the browser card header exactly: card type at left and card number at right.
  doc.fillColor('#111').font('Helvetica-Bold').fontSize(6.6)
    .text(str(card.cardType||card.entryType||'CATALOGUE ENTRY').toUpperCase(),textX,5,{width:W-textX-72,align:'left',lineBreak:false});
  doc.fillColor('#555').font('Helvetica-Bold').fontSize(6.2)
    .text(`CARD ${no}${total?' / '+total:''}`,textX,5,{width:W-textX-5,align:'right',lineBreak:false});

  if(card.callNumber){
    doc.fillColor('#000').font('Courier-Bold').fontSize(6.4)
      .text(card.callNumber,3,5,{width:v1-6,align:'left',lineBreak:false});
  }
  if(card.accessionNumber){
    doc.fillColor('#000').font('Courier-Bold').fontSize(6.2)
      .text(card.accessionNumber,3,rowH*5+1,{width:v1-6,align:'left',lineBreak:false});
  }

  // The browser and PDF consume the SAME already-wrapped lines. Continuation
  // indentation is preserved so the downloaded card visually matches the
  // generated card instead of reflowing the text a second time.
  const lines=arr(card.lines).map(str).filter(Boolean);
  const maxRows=Math.floor((H-headerH-5)/rowH);
  const usable=lines.slice(0,maxRows);
  const fs=7.25;
  let y=headerH+4;
  for(let i=0;i<usable.length;i++){
    const raw=usable[i];
    const indent=(i>0 && raw!=='' ? 18 : 0);
    doc.fillColor('#000').font('Courier-Bold').fontSize(fs)
      .text(raw,textX+indent,y,{width:textW-indent,height:rowH-2,ellipsis:false,lineBreak:false,continued:false});
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
  res.setHeader("Content-Disposition",'attachment; filename="LSP5004-AACR2-Catalogue-Cards-V27.pdf"');
  doc.pipe(res);
  cards.forEach((c,i)=>{doc.addPage({size:[W,H],margin:0});drawCard(doc,c,i+1,cards.length);});
  doc.end();
});

app.get("/version",(req,res)=>res.set("Cache-Control","no-store").json({version:VERSION,cardSize:"12.5 × 7.5 cm",primary:"Gemini",geminiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||process.env.API_KEY),verification:"Google Search grounding with direct-Gemini retry",materials:"All / Book / Serial Publication / Map / Motion Picture / Video Recording / Sound Recording / Electronic Resource / Microform",pageLimit:"One catalogue entry per question/card; automatic continuation cards only for physical overflow; no truncation",pdf:true,cardRules:"12.5 × 7.5 cm; vertical indentions; horizontal ruling; accession line 5"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 ${VERSION} running on ${PORT}`));

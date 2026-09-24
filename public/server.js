const express = require("express");
const path = require("path");
const PDFDocument = require("pdfkit");

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = "V21-AACR2-UNIVERSAL-ENTRY-ENGINE";

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

AUTO-ENTRY ENGINE RULES:
- NEVER stop because one entry/card was generated. Continue until every justified access point in the question is represented by a card.
- There is no maximum number of catalogue cards or entries. Do not cap, sample, summarize, or omit entries because of length.
- Every object in addedEntries and subjectEntries MUST have a corresponding card in cards.
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
- Before returning JSON, perform an internal completeness audit: every justified access point mentioned/supported by the question must appear once in addedEntries/subjectEntries and once as a corresponding card.

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

function localParse(question, section, materialType){
  const q=str(question);
  const mt=str(materialType)||'All Materials';
  if(/serial|journal|periodical|continuing resource|quarterly|bimonthly|vol\.\s*\d+\s*,\s*no\./i.test(q) || /Serial Publication/i.test(mt)) return parseSerialQuestion(q,mt);

  // Generic title/question fallback: extract a supplied title and responsibility statement,
  // but never invent missing bibliographic facts.
  let cleaned=q.replace(/^(?:catalogue|catalog|cataloguing|describe)\s+(?:the\s+)?(?:following|given|item|resource)?\s*(?:according\s+to\s+aacr2)?\s*[:\-]?\s*/i,'').trim();
  cleaned=cleaned.replace(/\s+(?:please\s+)?make\s+all\s+entries\.?$/i,'').trim();
  let title='', resp='';
  const slash=cleaned.match(/^(.*?)\s*\/\s*(.+?)(?:\s*[—-].*)?$/);
  if(slash){ title=slash[1].trim(); resp=slash[2].trim(); }
  else {
    const firstLine=cleaned.split(/[\n—–]/)[0].trim();
    title=firstLine.replace(/[.]$/,'').trim();
  }
  const call=extractLabeled(q,['Call number','Call no','Class number']);
  const accession=extractLabeled(q,['Accession number','Accession no','Accession']);
  const lines=[];
  if(title) lines.push(title + (resp ? ' / '+resp+'.' : '.'));
  const cards=[{entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:call,accessionNumber:accession,lines}];
  const added=[];
  if(resp){
    const m=resp.match(/^(?:edited by|compiled by|prepared by|written by|by)\s+(.+)$/i);
    if(m){
      let s=m[1].replace(/[.]$/,'').replace(/\s*,\s*(?:and|&)\s+/ig,' and ');
      const parts=s.split(/\s+and\s+/i).map(x=>x.trim()).filter(Boolean);
      for(const part of parts){
        let h=part;
        if(!h.includes(',')){const bits=h.split(/\s+/).filter(Boolean);if(bits.length>1){const sur=bits.pop();h=sur+', '+bits.join(' ');}}
        h=h.replace(/,\s*(?:editor|ed\.)$/i,'')+', editor.';
        added.push({type:'personal name',heading:h,reference:'Personal-name added entry supported by the responsibility statement.'});
        cards.push({entryType:'ADDED ENTRY — PERSONAL NAME',cardType:'Added Entry',callNumber:call,accessionNumber:'',lines:[h,title?title+'.':'']});
      }
    }
  }
  return {materialType:mt==='All Materials'?'Not specified':mt,mainEntry:title,titleStatement:title,responsibility:resp,edition:'',imprint:'',physicalDescription:'',series:'',notes:'',standardNumber:'',callNumber:call,accessionNumber:accession,addedEntries:added,subjectEntries:[],cards,verification:'Structured AACR2 fallback used from the supplied bibliographic/title evidence. No unsupported facts were invented.',missing:['Full bibliographic details were not supplied; review missing AACR2 areas before final submission.']};
}

function makeCardsFromEntries(r){
  const cards=[];
  const sourceMain=arr(r.cards).find(c=>/^MAIN ENTRY$/i.test(str(c.entryType)));
  const mainLines=sourceMain?.lines?.length ? sourceMain.lines : [];
  if(sourceMain && mainLines.length) cards.push({...sourceMain,entryType:'MAIN ENTRY'});
  else if(mainLines.length) cards.push({entryType:'MAIN ENTRY',cardType:'Main Entry',callNumber:r.callNumber,accessionNumber:r.accessionNumber,lines:mainLines});

  // Unit-card style: each valid added entry gets its own card. The added heading is
  // followed by the same bibliographic body as the main entry (without tracing).
  const body=mainLines.filter(x=>!/^Tracing\s*:/i.test(str(x)));
  for(const a of arr(r.addedEntries)){
    const h=str(a?.heading); if(!h) continue;
    const t=str(a?.type).toLowerCase();
    let et='ADDED ENTRY — TITLE';
    if(t.includes('personal')) et='ADDED ENTRY — PERSONAL NAME';
    else if(t.includes('corporate')) et='ADDED ENTRY — CORPORATE BODY';
    else if(t.includes('series')) et='ADDED ENTRY — SERIES';
    else if(t.includes('uniform')) et='ADDED ENTRY — UNIFORM TITLE';
    else if(t.includes('subject')) et='SUBJECT ENTRY';
    cards.push({entryType:et,cardType:'Added Entry',callNumber:r.callNumber||'',accessionNumber:'',lines:[h,...body]});
  }
  for(const a of arr(r.subjectEntries)){
    const h=str(a?.heading); if(!h) continue;
    cards.push({entryType:'SUBJECT ENTRY',cardType:'Subject Entry',callNumber:r.callNumber||'',accessionNumber:'',lines:[h,...body]});
  }
  return cards;
}

function ensureTracing(mainLines, addedEntries, subjectEntries){
  const trace=[]; let n=1;
  for(const a of [...arr(addedEntries),...arr(subjectEntries)]){ const h=str(a?.heading); if(h) trace.push(`${n++}. ${h}`); }
  if(!trace.length) return mainLines;
  const filtered=mainLines.filter(x=>!/^Tracing\s*:/i.test(str(x)));
  filtered.push('Tracing: '+trace.join('  '));
  return filtered;
}

function cleanCatalogueLine(line){
  let x=str(line);
  x=x.replace(/^(?:MAIN ENTRY|ADDED ENTRY|CATALOGUE ENTRY)\s*[:\-]?\s*/i,'');
  x=x.replace(/^(?:Title proper|Place of publication|Publisher|Date of publication|Publication date|Physical description|Series statement|Notes|Standard number|ISSN|Call number|Accession number)\s*:\s*/i,'');
  return x.trim();
}

function normalizeResult(raw, question, section, materialType){
  const q=str(question); const r=raw&&typeof raw==='object'?raw:{};
  r.materialType=str(r.materialType)||materialType||'Not specified';
  for(const k of ['mainEntry','titleStatement','responsibility','edition','imprint','physicalDescription','notes','series','standardNumber','callNumber','accessionNumber','materialSpecific','seriesEntry']) r[k]=str(r[k]);
  r.addedEntries=arr(r.addedEntries); r.subjectEntries=arr(r.subjectEntries); r.missing=arr(r.missing);
  r.cards=arr(r.cards).map(c=>({entryType:str(c.entryType)||str(c.cardType)||'MAIN ENTRY',cardType:str(c.cardType)||'Main Entry',callNumber:str(c.callNumber)||r.callNumber,accessionNumber:str(c.accessionNumber)||r.accessionNumber,lines:arr(c.lines).map(cleanCatalogueLine).filter(Boolean)})).filter(c=>c.lines.length);
  const serialLike=/serial|journal|periodical|continuing resource|quarterly|bimonthly|vol\.\s*\d+\s*,\s*no\./i.test(q);
  const promptLeak=r.cards.some(c=>c.lines.some(x=>/catalogue the following|make all entries|complete cataloguing question|please make all entries/i.test(x)));
  const geminiMissingCards=r.addedEntries.some(a=>{const h=str(a?.heading);return h&&!r.cards.some(c=>c.lines.some(x=>x.trim()===h));}) || r.subjectEntries.some(a=>{const h=str(a?.heading);return h&&!r.cards.some(c=>c.lines.some(x=>x.trim()===h));});
  if(serialLike){
    const expected=parseSerialQuestion(q,'Serial Publication');
    const expectedHeadings=arr(expected.addedEntries).map(a=>str(a?.heading).toLowerCase()).filter(Boolean);
    const actualHeadings=arr(r.addedEntries).map(a=>str(a?.heading).toLowerCase()).filter(Boolean);
    const missingExpected=expectedHeadings.some(h=>!actualHeadings.includes(h));
    const titleMismatch=expected.titleStatement && r.titleStatement && !r.titleStatement.toLowerCase().includes(expected.titleStatement.toLowerCase());
    if(r.cards.length<2 || promptLeak || geminiMissingCards || missingExpected || titleMismatch || !r.cards.some(c=>/^MAIN ENTRY$/i.test(c.entryType))){
      expected.provider=r.provider||'AACR2 automatic catalogue engine';
      expected.verification=(str(expected.verification)?expected.verification+' ':'')+'Completeness audit rebuilt the serial entry set from the supplied question so every supported access point is represented.';
      return finalizeCards(expected);
    }
  }
  if(!r.cards.some(c=>/^MAIN ENTRY$/i.test(c.entryType))){
    const local=localParse(q,section,materialType); r.cards=local.cards; r.mainEntry=local.mainEntry; r.titleStatement=local.titleStatement; r.responsibility=local.responsibility; r.imprint=local.imprint; r.physicalDescription=local.physicalDescription; r.notes=local.notes; r.series=local.series; r.callNumber=local.callNumber; r.accessionNumber=local.accessionNumber;
  }
  const generated=makeCardsFromEntries(r);
  // Preserve Gemini's richer main card, but guarantee one card for every access entry.
  const main=arr(r.cards).find(c=>/^MAIN ENTRY$/i.test(c.entryType));
  r.cards=main?[main,...generated.filter(c=>!/^MAIN ENTRY$/i.test(c.entryType))]:generated;
  r.cards=r.cards.filter((c,i)=>i===0 || c.lines.length);
  // Deduplicate exact cards while preserving order.
  const seen=new Set(); r.cards=r.cards.filter(c=>{const k=(c.entryType||'')+'|'+(c.lines||[]).join('\n');if(seen.has(k))return false;seen.add(k);return true;});
  return finalizeCards(r);
}

function finalizeCards(r){
  const mi=r.cards.findIndex(c=>/^MAIN ENTRY$/i.test(str(c.entryType)));
  if(mi>=0){
    r.cards[mi]={...r.cards[mi],lines:ensureTracing(arr(r.cards[mi].lines),r.addedEntries,r.subjectEntries)};
  }
  r.cards=expandCards(r.cards);
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
  const maxLines=10;
  for(const card of arr(cards)){
    const wrapped=[];for(const line of arr(card.lines))wrapped.push(...wrapForCard(line,46));
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
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
  try{
    const r=await fetch(url,{signal:controller.signal}); const d=await r.json().catch(()=>({}));
    if(!r.ok) return [];
    return (d.models||[]).filter(m=>Array.isArray(m.supportedGenerationMethods)&&m.supportedGenerationMethods.includes("generateContent"))
      .map(m=>String(m.name||"").replace(/^models\//,"")).filter(Boolean);
  }catch{return []}finally{clearTimeout(timer)}
}
function geminiKeys(req){
  const fromReq=str(req?.body?.apiKey);
  return [...new Set([fromReq,process.env.GEMINI_API_KEY,process.env.GOOGLE_API_KEY,process.env.GOOGLE_GEMINI_API_KEY,process.env.API_KEY].map(str).filter(Boolean))];
}
async function geminiRequest(question, section, materialType, useSearch=true, apiKey=""){
  const key=str(apiKey);
  if(!key) throw new Error("Gemini API key is not configured. Add GEMINI_API_KEY in Render Environment Variables.");
  const configured=[process.env.GEMINI_MODEL,"gemini-2.5-flash","gemini-2.0-flash","gemini-1.5-flash"].filter(Boolean);
  const discovered=await getGeminiModels(key);
  const preferred=[...configured.filter(m=>discovered.length===0||discovered.includes(m)),...discovered.filter(m=>/flash/i.test(m))];
  const models=[...new Set(preferred)].slice(0,6); let last="";
  for(const model of models){
    const endpoint=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
    const prompt=`Material selected: ${materialType||"All Materials"}\n\nCOMPLETE CATALOGUING QUESTION:\n${question}\n\nSolve the entire question. Return every justified catalogue entry/card required by the question. Never return the question itself. Output ONLY the requested JSON object.`;
    const base={systemInstruction:{parts:[{text:SYSTEM_PROMPT}]},contents:[{role:"user",parts:[{text:prompt}]}],generationConfig:{temperature:0.05,responseMimeType:"application/json"}};
    const variants=useSearch?[{...base,tools:[{google_search:{}}]},base]:[base];
    for(const body of variants){
      const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),body.tools?18000:12000);
      try{
        const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
        const data=await response.json().catch(()=>({}));
        if(!response.ok){last=data?.error?.message||`Gemini ${model} failed (${response.status})`;continue;}
        const text=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("");
        const parsed=safeJson(text); if(!parsed){last=`Gemini ${model} returned invalid JSON.`;continue;}
        parsed.provider=`Gemini ${model}${body.tools?" + Google Search grounding":""}`; return parsed;
      }catch(e){last=e.name==="AbortError"?`Gemini ${model} timed out.`:e.message||"Gemini request failed.";}
      finally{clearTimeout(timer)}
    }
  }
  throw new Error(last||"Gemini generation failed.");
}

app.post("/generate",async(req,res)=>{
  const {question,section,materialType}=req.body||{};
  if(!str(question)) return res.status(400).json({error:"Please enter the complete cataloguing question."});
  const keys=geminiKeys(req); let lastError="";
  for(const key of keys){
    try{
      let result;
      try{result=await geminiRequest(str(question),section,materialType,true,key);}
      catch(searchErr){
        lastError=searchErr.message||"";
        result=await geminiRequest(str(question),section,materialType,false,key);
        result.verification=(str(result.verification)?result.verification+" ":"")+"Google Search grounding was unavailable; Gemini direct generation was used.";
      }
      result=normalizeResult(result,question,section,materialType); return res.json(result);
    }catch(err){lastError=err.message||lastError;}
  }
  const fallback=localParse(str(question),section,materialType);
  fallback.provider=keys.length?"AACR2 structured fallback — Gemini request failed":"AACR2 structured fallback — Gemini API key not configured";
  fallback.error=lastError||"Gemini API key not configured.";
  fallback.verification=(fallback.verification||"")+" "+(lastError?`Gemini error: ${lastError}`:"Add GEMINI_API_KEY in Render Environment Variables for Gemini generation.");
  return res.json(finalizeCards(fallback));
});

app.get("/health",(req,res)=>res.json({ok:true,version:VERSION,geminiConfigured:geminiKeys(req).length>0,pdf:true,unlimitedCards:true}));


function drawCard(doc,card,no,total){
  const W=12.5*28.3464567,H=7.5*28.3464567;
  const v1=34,v2=58, leftW=v1, textX=v2+7;
  // Traditional card: outer border, two vertical indention/ruling lines and
  // horizontal ruling lines. 12.5 x 7.5 cm = 5 x 3 inches.
  doc.rect(0,0,W,H).stroke();
  doc.moveTo(v1,0).lineTo(v1,H).stroke();
  doc.moveTo(v2,0).lineTo(v2,H).stroke();
  [25,50,75,100,125,150,175,200].forEach(y=>{ if(y<H-2){doc.moveTo(0,y).lineTo(W,y).stroke();} });
  doc.font('Helvetica-Bold').fontSize(6.2).fillColor('#222').text(`CARD ${no}${total?' / '+total:''}`,textX,4,{width:W-textX-4,align:'right'});
  if(card.callNumber) doc.font('Helvetica-Bold').fontSize(6.3).fillColor('#000').text(card.callNumber,3,7,{width:v1-6,align:'left'});
  // Practice convention requested by the user: accession number on the 5th line.
  if(card.accessionNumber) doc.font('Helvetica-Bold').fontSize(6.0).text(card.accessionNumber,3,126,{width:v1-6,align:'left'});
  const lineCount=arr(card.lines).length;
  const fs=lineCount>18?6.4:lineCount>14?6.8:lineCount>10?7.2:7.6;
  doc.fillColor('#000').font('Helvetica-Bold').fontSize(fs);
  let y=29;
  arr(card.lines).forEach((line,idx)=>{
    const t=str(line);if(!t)return;
    const x=idx===0?v1+7:v2+7;
    const h=doc.heightOfString(t,{width:W-x-7,lineGap:0.5});
    if(y+h>H-4)return;
    doc.text(t,x,y,{width:W-x-7,lineGap:0.2});
    y+=Math.max(8.0,h+1.0);
  });
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

app.get("/version",(req,res)=>res.set("Cache-Control","no-store").json({version:VERSION,cardSize:"12.5 × 7.5 cm",primary:"Gemini",geminiConfigured:Boolean(process.env.GEMINI_API_KEY||process.env.GOOGLE_API_KEY||process.env.GOOGLE_GEMINI_API_KEY||process.env.API_KEY),verification:"Google Search grounding with direct-Gemini retry",materials:"All / Book / Serial Publication / Map / Motion Picture / Video Recording / Sound Recording / Electronic Resource / Microform",pageLimit:"Unlimited justified entries; automatic continuation cards; no truncation",pdf:true,cardRules:"12.5 × 7.5 cm; vertical indentions; horizontal ruling; accession line 5"}));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,"0.0.0.0",()=>console.log(`LSP5004 ${VERSION} running on ${PORT}`));

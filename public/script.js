const $=id=>document.getElementById(id);let latest=null,selectedMaterial='All Materials';
const MATERIALS=[['All Materials','ALL MATERIALS','Detect the applicable treatment from the complete question.'],['Book','BOOK','Books and monographs.'],['Serial Publication','SERIAL','Continuing resources, periodicals and journals.'],['Map','MAP','Maps, atlases and cartographic material.'],['Motion Picture','MOTION PICTURE','Films and motion pictures.'],['Video Recording','VIDEO','DVDs, videotapes and video resources.'],['Sound Recording','SOUND','Audio and sound recordings.'],['Electronic Resource','ELECTRONIC','Websites, databases and electronic files.'],['Microform','MICROFORM','Microfilm, microfiche and related formats.']];
const examples={
serial:`Title: Library & Information Science Research
Place: Amsterdam
Publisher: Elsevier
Date: 1983-
Frequency: Quarterly
ISSN: 0740-8188`,
motion:`Title: The Pursuit of Happyness
Director: Gabriele Muccino
Screenplay: Steven Conrad
Producer: Todd Black
Place of Publication/Distribution: Culver City, Calif.
Publisher: Columbia Pictures
Date: 2006
Format: 1 videodisc
Running Time: 117 minutes`,
book:`Title: Introduction to Library Science
Author: Ranganathan, S. R.
Edition: 2nd ed.
Place of Publication: New Delhi
Publisher: Ess Ess Publications
Date: 1980
Physical Description: xii, 250 pages ; 23 cm.
ISBN: 81-7000-000-0`};
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\\':'&#92;'}[c]));}
function setStatus(t,busy=false){$('status').textContent=t;$('status').parentElement.classList.toggle('busy',busy)}
function selectMaterial(id){selectedMaterial=id;document.querySelectorAll('.materialBtn').forEach(x=>x.classList.toggle('active',x.dataset.id===id));const m=MATERIALS.find(x=>x[0]===id);}
function init(){const box=$('materialChoices');box.innerHTML=MATERIALS.map(([id,label])=>`<button class="materialBtn ${id===selectedMaterial?'active':''}" data-id="${esc(id)}">${esc(label)}</button>`).join('');box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>selectMaterial(b.dataset.id)));
 document.querySelectorAll('.examples button').forEach(b=>b.addEventListener('click',async()=>{const kind=b.dataset.fill;const target=kind==='serial'?'Serial Publication':kind==='motion'?'Motion Picture':'Book';$('question').value=examples[kind];selectMaterial(target);setStatus('Example ready — generating with local AACR2 data…',true);await generate(true);}));}
function renderCards(cards){$('cards').innerHTML=(cards||[]).map((c,i)=>{const lines=(c.lines||[]).map((x,j)=>`<span class="cardLine ${j?'cont':'first'}">${esc(x)}</span>`).join('');return `<article class="catalogCard"><div class="cardNo">CARD ${i+1} / ${cards.length}</div><div class="cardType">${esc(c.entryType||'MAIN ENTRY')}</div><div class="cardLeft">${esc(c.callNumber||'')}</div><div class="cardText">${lines}</div></article>`}).join('')}
function render(r){latest=r;const n=(r.cards||[]).length;$('result').classList.remove('hidden');$('answerTitle').textContent=n?`${n===1?'Catalogue entry':'Catalogue cards'} generated`:'No entry generated';$('resultMeta').textContent=[r.materialType,r.provider].filter(Boolean).join(' · ');if(n){renderCards(r.cards);$('entryAudit').textContent=`${n} card${n===1?'':'s'} · complete entry kept together`;}else{$('cards').innerHTML=`<div class="missingPanel"><strong>More bibliographic information is needed.</strong><p>${esc((r.missing||[]).join(' ')||'Please include the title and available bibliographic details.')}</p></div>`;$('entryAudit').textContent='0 cards';}}
async function check(){try{const h=await fetch('/health',{cache:'no-store'}).then(r=>r.json());$('engineBadge').innerHTML=`<i></i> ${h.geminiConfigured?'GEMINI READY':'LOCAL AACR2 READY'}`;}catch{$('engineBadge').innerHTML='<i></i> OFFLINE'}}
async function generate(forceLocal=false){const q=$('question').value.trim();if(!q){setStatus('Paste a catalogue question first.');return}const b=$('generate');b.disabled=true;b.textContent='GENERATING…';setStatus(forceLocal?'Building the example with the fast AACR2 engine…':'Reading the question and building the entry…',true);const started=performance.now();try{const res=await fetch('/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q,materialType:selectedMaterial,section:'',forceLocal})});const d=await res.json().catch(()=>({}));if(!res.ok)throw new Error(d.error||`Generation failed (${res.status}).`);render(d);setStatus(d.cards?.length?`Ready in ${Math.max(1,Math.round(performance.now()-started))} ms.`:'More bibliographic details are needed.');window.requestAnimationFrame(()=>window.scrollTo({top:$('result').offsetTop-10,behavior:'smooth'}));}catch(e){setStatus(e.message||'Generation failed.')}finally{b.disabled=false;b.textContent='GENERATE CATALOGUE ENTRY →'}}
$('generate').addEventListener('click',()=>generate(false));$('copy').addEventListener('click',async()=>{if(!latest?.cards?.length)return;const t=latest.cards.map((c,i)=>`CARD ${i+1}\n${(c.lines||[]).join('\n')}`).join('\n\n');await navigator.clipboard.writeText(t);setStatus('Catalogue entry copied.')});$('pdf').addEventListener('click',async()=>{if(!latest?.cards?.length){setStatus('Generate an entry first.');return}const b=$('pdf');b.disabled=true;b.textContent='CREATING PDF…';try{const res=await fetch('/generate-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(latest)});if(!res.ok)throw new Error('PDF generation failed.');const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='LSP5004-AACR2-Catalogue-Cards-V42.pdf';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('PDF ready — same generated card.')}catch(e){setStatus(e.message)}finally{b.disabled=false;b.textContent='DOWNLOAD PDF'}});init();check();

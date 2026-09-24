const $=id=>document.getElementById(id);
let latest=null,selectedMaterial="All Materials";
const MATERIALS=[
 {id:"All Materials",label:"ALL MATERIALS",help:"The engine determines the applicable AACR2 material treatment from the complete question."},
 {id:"Book",label:"BOOK",help:"Books, pamphlets and printed materials."},
 {id:"Serial Publication",label:"SERIAL PUBLICATION",help:"Continuing resources: numbering, frequency, notes, series, access points and tracing."},
 {id:"Map",label:"MAP / CARTOGRAPHIC",help:"Maps, atlases and cartographic materials."},
 {id:"Motion Picture",label:"MOTION PICTURE",help:"Motion pictures and films."},
 {id:"Video Recording",label:"VIDEO RECORDING",help:"Video recordings, DVDs and similar resources."},
 {id:"Sound Recording",label:"SOUND RECORDING",help:"Sound recordings and audio materials."},
 {id:"Electronic Resource",label:"ELECTRONIC RESOURCE",help:"Electronic resources, websites, databases and computer files."},
 {id:"Microform",label:"MICROFORM",help:"Microfilm, microfiche and other microforms."}
];
function esc(s){return String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function initMaterials(){
 const box=$("materialChoices");
 box.innerHTML=MATERIALS.map(m=>`<button class="materialBtn ${m.id===selectedMaterial?"active":""}" data-id="${esc(m.id)}">${esc(m.label)}</button>`).join("");
 box.querySelectorAll("button").forEach(b=>b.onclick=()=>{selectedMaterial=b.dataset.id;box.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));const m=MATERIALS.find(x=>x.id===selectedMaterial);$("materialHelp").textContent=m.help;});
}
function cardHtml(c,i){
 const type=esc(c.entryType||c.cardType||"CATALOGUE ENTRY");
 const leftCall=c.callNumber?`<div class="cardCall">${esc(c.callNumber)}</div>`:"";
 const leftAcc=c.accessionNumber?`<div class="cardAcc">${esc(c.accessionNumber)}</div>`:"";
 const lines=(c.lines||[]).map((line,j)=>`<span class="cardLine ${j?"cont":"first"}">${esc(line)}</span>`).join("");
 return `<article class="catalogCard"><div class="cardNo">CARD ${i+1}</div><div class="cardType">${type}</div><div class="cardLeft">${leftCall}${leftAcc}</div><div class="cardText">${lines}</div></article>`;
}
function renderCards(cards){
 const groups=[];
 for(const [i,c] of (cards||[]).entries()){
  const type=(c.entryType||c.cardType||"CATALOGUE ENTRY").toUpperCase();
  let g=groups.find(x=>x.type===type); if(!g){g={type,cards:[]};groups.push(g);} g.cards.push({c,i});
 }
 $("cards").innerHTML=groups.map(g=>`<section class="entrySection"><h4 class="entrySectionTitle">${esc(g.type)}</h4><div class="sectionCards">${g.cards.map(x=>cardHtml(x.c,x.i)).join("")}</div></section>`).join("");
}
function render(r){
 latest=r;const n=(r.cards||[]).length;
 $("answerTitle").textContent=n?`${n} catalogue ${n===1?"card":"cards"} generated`:"Catalogue entry needs bibliographic details";
 $("resultMeta").textContent=[r.materialType,r.provider].filter(Boolean).join(" · ")||"AACR2 structured engine";
 if(n){
   $("entryAudit").textContent=`${(r.addedEntries||[]).length+(r.subjectEntries||[]).length} added/subject access point(s) · tracing ${r.cards?.some(c=>c.lines.some(x=>/^Tracing:/i.test(x)))?"included":"not required"}`;
   renderCards(r.cards);
 }else{
   const missing=(r.missing||[]).map(x=>`<div class="missingItem">• ${esc(x)}</div>`).join("");
   $("cards").innerHTML=`<div class="missingPanel"><strong>No catalogue card fabricated.</strong><p>${esc(r.verification||"Bibliographic information is required before a valid AACR2 card can be generated.")}</p>${missing}</div>`;
   $("entryAudit").textContent="0 catalogue cards · missing bibliographic information";
 }
 $("result").classList.remove("hidden");
 $("status").textContent=r.warning?"AACR2 structured fallback used automatically.":(n?"AACR2 catalogue entry set prepared.":"Please provide the bibliographic details shown above.");
}
async function checkHealth(){
 try{const h=await fetch("/health",{cache:"no-store"}).then(r=>r.json());$("engineBadge").textContent=h.geminiConfigured?"GEMINI READY · PDF READY":"GEMINI KEY NEEDED · PDF READY";$("engineBadge").style.borderColor=h.geminiConfigured?"#111":"#a33";$("status").textContent=h.geminiConfigured?"Gemini configured. PDF engine ready.":"Gemini key not configured on server. PDF engine ready; session key can be supplied when generating.";return h}catch(e){$("engineBadge").textContent="ENGINE CHECK FAILED";$("status").textContent="Could not check the server.";return null;}
}
function askForGeminiKeyIfNeeded(){
 const saved=sessionStorage.getItem("lspGeminiKey"); if(saved)return saved;
 const k=prompt("Gemini API key is not configured on the server. Paste your Gemini API key for this browser session only:");
 if(k&&k.trim()){sessionStorage.setItem("lspGeminiKey",k.trim());return k.trim();} return "";
}
$("generate").onclick=async()=>{
 const q=$("question").value.trim(); if(!q){alert("Paste the complete cataloguing question first.");return;}
 const b=$("generate");b.disabled=true;b.textContent="GENERATING ALL VALID ENTRIES…";$("loading").classList.remove("hidden");$("status").textContent="Reading the complete question…";
 try{
  let key=sessionStorage.getItem("lspGeminiKey")||"";let h=null;
  try{h=await fetch("/health",{cache:"no-store"}).then(r=>r.json());if(!h.geminiConfigured&&!key)key=askForGeminiKeyIfNeeded();}catch{}
  $("status").textContent="Building main entry, added entries, tracing and continuation cards…";
  const res=await fetch("/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,section:"",materialType:selectedMaterial,apiKey:key})});
  const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||`Generation failed (${res.status}).`);
  render(data);
 }catch(e){$("status").textContent=e.message||"Generation failed.";alert($("status").textContent);}finally{b.disabled=false;b.textContent="⚡ GENERATE ALL VALID ENTRIES";$("loading").classList.add("hidden");}
};
$("clear").onclick=()=>{$("question").value="";$("cards").innerHTML="";$("result").classList.add("hidden");$("answerTitle").textContent="No answer generated";latest=null;$("status").textContent="Ready.";$("question").focus();};
$("health").onclick=checkHealth;
$("copy").onclick=async()=>{if(!latest?.cards?.length){alert("Generate the answer first.");return;}const t=latest.cards.map((c,i)=>`CARD ${i+1} — ${c.entryType||c.cardType}\n${(c.lines||[]).join("\n")}`).join("\n\n");try{await navigator.clipboard.writeText(t);$("status").textContent="All catalogue entries copied.";}catch{$("status").textContent="Copy failed.";}};
$("pdf").onclick=async()=>{if(!latest?.cards?.length){alert("Generate the answer first.");return;}const btn=$("pdf");btn.disabled=true;btn.textContent="CREATING PDF…";$("status").textContent="Preparing 12.5 × 7.5 cm cards with continuation pages…";try{const res=await fetch("/generate-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(latest)});if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||"PDF generation failed.");}const blob=await res.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="LSP5004-AACR2-Catalogue-Cards-V31.pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);$("status").textContent="PDF ready — all generated cards included.";}catch(e){$("status").textContent=e.message||"PDF generation failed.";alert($("status").textContent);}finally{btn.disabled=false;btn.textContent="⬇ PDF CARDS";}};
initMaterials();checkHealth();

// V14 cache-safe build: no legacy A/B/C/D section selector is required.
const $=id=>document.getElementById(id);let latest=null;
const MATERIALS=[
 {id:"All Materials",label:"ALL MATERIALS",help:"Engine determines the material treatment from the complete question."},
 {id:"Book",label:"BOOK",help:"Books, pamphlets and printed sheets."},
 {id:"Serial Publication",label:"SERIAL PUBLICATION",help:"Serials / continuing resources — complete serial entry and all justified access entries."},
 {id:"Map",label:"MAP / CARTOGRAPHIC",help:"Maps, atlases and cartographic materials."},
 {id:"Motion Picture",label:"MOTION PICTURE",help:"Motion pictures / films."},
 {id:"Video Recording",label:"VIDEO RECORDING",help:"Video recordings, DVD and similar video materials."},
 {id:"Sound Recording",label:"SOUND RECORDING",help:"Sound recordings and audio materials."},
 {id:"Electronic Resource",label:"ELECTRONIC RESOURCE",help:"Electronic resources, websites, databases and computer files."},
 {id:"Microform",label:"MICROFORM",help:"Microfilm, microfiche and other microforms."}
];
let selectedMaterial="All Materials";
function esc(s){return String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function initMaterials(){
  const box=$("materialChoices");
  box.innerHTML=MATERIALS.map(m=>`<button class="materialBtn ${m.id===selectedMaterial?"active":""}" data-id="${esc(m.id)}">${esc(m.label)}</button>`).join("");
  box.querySelectorAll("button").forEach(b=>b.onclick=()=>{selectedMaterial=b.dataset.id;box.querySelectorAll("button").forEach(x=>x.classList.toggle("active",x===b));const m=MATERIALS.find(x=>x.id===selectedMaterial);$("materialHelp").textContent=m.help;});
}
function splitLong(lines,max=48){const out=[];for(const raw of lines||[]){let s=String(raw||"").trim();if(!s)continue;while(s.length>max){let cut=s.lastIndexOf(" ",max);if(cut<24)cut=max;out.push(s.slice(0,cut).trim());s=s.slice(cut).trim();}if(s)out.push(s);}return out;}
function cardHtml(c,i){const left=[c.callNumber,c.accessionNumber].filter(Boolean).map(esc).join("<br>");return `<article class="catalogCard"><div class="cardNo">CARD ${i+1}</div><div class="cardType">${esc(c.entryType||c.cardType||"CATALOGUE ENTRY")}</div><div class="cardLeft">${left}</div><div class="cardText">${(c.lines||[]).map(esc).join("\n")}</div></article>`;}
function renderCards(cards){
  const groups=[];for(const [i,c] of (cards||[]).entries()){const type=(c.entryType||c.cardType||"CATALOGUE ENTRY").toUpperCase();let g=groups.find(x=>x.type===type);if(!g){g={type,cards:[]};groups.push(g);}g.cards.push({c,i});}
  $("cards").innerHTML=groups.map(g=>`<section class="entrySection"><h4 class="entrySectionTitle">${esc(g.type)}</h4><div class="sectionCards">${g.cards.map(x=>cardHtml(x.c,x.i)).join("")}</div></section>`).join("");
}
function render(r){
 latest=r;const n=(r.cards||[]).length;$("answerTitle").textContent=`${n} catalogue ${n===1?"card":"cards"} generated`;renderCards(r.cards);
 $("outMaterial").textContent=r.materialType||"—";$("outMainEntry").textContent=r.mainEntry||"—";$("outTitle").textContent=[r.titleStatement,r.responsibility].filter(Boolean).join(" / ")||"—";$("outEdition").textContent=r.edition||"—";$("outMaterialSpecific").textContent=r.materialSpecific||"—";$("outImprint").textContent=r.imprint||"—";$("outPhysical").textContent=r.physicalDescription||"—";$("outSeries").textContent=r.series||"—";$("outNotes").textContent=r.notes||"—";$("outStandard").textContent=r.standardNumber||"—";
 const access=[...(r.addedEntries||[]).map(x=>`${x.type||"Added entry"}: ${x.heading||""}`),...(r.subjectEntries||[]).map(x=>`Subject: ${x.heading||""}`)].filter(Boolean);$("outAdded").textContent=access.join("\n")||"—";$("outCall").textContent=[r.callNumber,r.accessionNumber].filter(Boolean).join(" / ")||"—";$("outVerification").textContent=r.verification||"—";$("outMissing").textContent=(r.missing||[]).filter(Boolean).join("\n")||"None reported";$("status").textContent=r.provider||"AACR2 automatic catalogue engine";$("result").classList.remove("hidden");
}
$("generate").onclick=async()=>{const q=$("question").value.trim();if(!q){alert("Paste the complete cataloguing question first.");return;}const b=$("generate");b.disabled=true;b.textContent="GENERATING ALL ENTRIES…";$("loading").classList.remove("hidden");$("status").textContent="Gemini is analysing the complete question…";try{const res=await fetch("/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({question:q,section:"",materialType:selectedMaterial})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||`Generation failed (${res.status}).`);render(data);}catch(e){$("status").textContent=e.message||"Generation failed.";alert($("status").textContent);}finally{b.disabled=false;b.textContent="⚡ GENERATE ALL CATALOGUE ENTRIES";$("loading").classList.add("hidden");}};
$("clear").onclick=()=>{$("question").value="";$("cards").innerHTML="";$("result").classList.add("hidden");$("answerTitle").textContent="No answer generated";latest=null;$("status").textContent="Ready";$("question").focus();};
$("copy").onclick=async()=>{if(!latest?.cards?.length){alert("Generate the answer first.");return;}const t=latest.cards.map((c,i)=>`CARD ${i+1} — ${c.entryType||c.cardType}\n${(c.lines||[]).join("\n")}`).join("\n\n");try{await navigator.clipboard.writeText(t);$("status").textContent="All catalogue entries copied.";}catch{$("status").textContent="Copy failed.";}};
$("pdf").onclick=async()=>{if(!latest?.cards?.length){alert("Generate the answer first.");return;}$("status").textContent="Preparing unlimited 12.5 × 7.5 cm catalogue cards…";try{const res=await fetch("/generate-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(latest)});if(!res.ok){const d=await res.json().catch(()=>({}));throw new Error(d.error||"PDF failed.");}const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="LSP5004-AACR2-All-Entries-Catalogue-Cards.pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);$("status").textContent="PDF ready.";}catch(e){$("status").textContent=e.message;alert(e.message);}};
initMaterials();

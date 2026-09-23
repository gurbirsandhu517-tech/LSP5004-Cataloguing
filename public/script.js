const $=id=>document.getElementById(id);
let latest=null;

function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}

function renderCards(cards){
  $("cards").innerHTML="";
  (cards||[]).forEach((card,i)=>{
    const el=document.createElement("div");
    el.className="catalogCard";
    const left=[card.callNumber||"",card.accessionNumber||""].filter(Boolean).join("\\n");
    el.innerHTML=`<div class="cardNo">CARD ${i+1}</div>
      <div class="cardLeft">${esc(left)}</div>
      <div class="cardText">${esc((card.lines||[]).join("\\n"))}</div>`;
    $("cards").appendChild(el);
  });
}

function render(r){
  latest=r;
  const first=(r.cards||[])[0];
  $("answerTitle").textContent=`${r.cards?.length||0} catalogue card${(r.cards?.length||0)===1?"":"s"} generated`;
  renderCards(r.cards);
  $("outMaterial").textContent=r.materialType||"—";
  $("outImprint").textContent=r.imprint||"—";
  $("outPhysical").textContent=r.physicalDescription||"—";
  $("outNotes").textContent=r.notes||"—";
  $("outVerification").textContent=r.verification||"—";
  $("outMissing").textContent=(r.missing||[]).join("\\n")||"None reported";
  $("status").textContent=r.provider||"Generated";
}

$("generate").onclick=async()=>{
  const question=$("question").value.trim();
  if(!question){alert("Paste the complete cataloguing question first.");return;}
  $("generate").disabled=true;$("loading").classList.remove("hidden");$("status").textContent="Generating…";
  try{
    const res=await fetch("/generate",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({question,section:$("section").value,materialType:$("material").value})});
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||"Generation failed.");
    render(data);
  }catch(e){$("status").textContent=e.message;alert(e.message);}
  finally{$("generate").disabled=false;$("loading").classList.add("hidden");}
};

$("clear").onclick=()=>{$("question").value="";$("cards").innerHTML="";$("answerTitle").textContent="No answer generated";latest=null;$("status").textContent="Ready";};
$("copy").onclick=async()=>{
  if(!latest?.cards?.length){alert("Generate the answer first.");return;}
  const text=latest.cards.map((c,i)=>`CARD ${i+1}\\n${(c.lines||[]).join("\\n")}`).join("\\n\\n");
  await navigator.clipboard.writeText(text);$("status").textContent="Catalogue cards copied.";
};
$("pdf").onclick=async()=>{
  if(!latest?.cards?.length){alert("Generate the answer first.");return;}
  $("status").textContent="Preparing 12.5 × 7.5 cm PDF…";
  const res=await fetch("/generate-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(latest)});
  if(!res.ok){const d=await res.json().catch(()=>({}));alert(d.error||"PDF failed.");return;}
  const blob=await res.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download="LSP5004-AACR2-Catalogue-Cards.pdf";a.click();URL.revokeObjectURL(url);
  $("status").textContent="PDF ready.";
};

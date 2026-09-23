(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const text = x => x == null ? "" : String(x).trim();
  const val = x => text(x) || "Not supplied";
  const show = (id, yes) => { const e=$(id); if(e) e.classList.toggle("hidden", !yes); };
  const put = (id, x) => { const e=$(id); if(e) e.textContent = x == null ? "" : String(x); };
  const setLoading = (on,msg) => { show("loading",on); put("loadingText",msg||"Generating catalogue entry…"); const b=$("generate"); if(b){b.disabled=on;b.textContent=on?"GENERATING…":"⚡ GENERATE CATALOGUE ENTRY";} };
  let section="A", latest=null;
  const sections={A:{title:"Section A — Serial Publications: Complexities",help:"Serial publication cataloguing practice.",material:"Serial Publication"},B:{title:"Section B — Uniform Titles; Motion Pictures",help:"Uniform-title and motion-picture cataloguing practice.",material:"Motion Picture"},C:{title:"Section C — Video Recordings; Sound Recordings",help:"Video and sound recording cataloguing practice.",material:"Video Recording"},D:{title:"Section D — Electronic Resources; Microforms",help:"Electronic-resource and microform cataloguing practice.",material:"Electronic Resource — Data"}};

  function field(q,label){
    const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const re=new RegExp("(?:^|\\n|\\r)\\s*"+escaped+"\\s*:\\s*(.+?)(?=\\n\\s*[A-Za-z][A-Za-z /_-]*\\s*:|$)","i");
    const m=q.match(re); return m?text(m[1]).replace(/\s+/g," "):"";
  }
  function localAnswer(q,material){
    const title=field(q,"Title proper")||field(q,"Title");
    const responsibility=field(q,"Statement of responsibility");
    const edition=field(q,"Edition statement")||field(q,"Edition");
    const place=field(q,"Place of publication")||field(q,"Place");
    const publisher=field(q,"Publisher"); const date=field(q,"Date of publication")||field(q,"Date");
    const physical=field(q,"Physical description")||field(q,"Physical description"); const notes=field(q,"Notes");
    let entry=title||"[Title not supplied]";
    if(responsibility) entry += " / "+responsibility;
    if(edition) entry += ". — "+edition;
    if(place||publisher||date) entry += ". — "+(place||"[place not supplied]")+" : "+(publisher||"[publisher not supplied]")+", "+(date||"[date not supplied]");
    if(physical) entry += ". — "+physical;
    if(notes) entry += ". — "+notes;
    entry += ".";
    const missing=[]; [["Title proper",title],["Statement of responsibility",responsibility],["Edition statement",edition],["Place of publication",place],["Publisher",publisher],["Date of publication",date],["Physical description",physical]].forEach(([n,v])=>{if(!v)missing.push(n)});
    const requestedEntries=[]; const ql=q.toLowerCase();
    if (/\bmain\s+entr(?:y|ies)\b/.test(ql)) requestedEntries.push({label:"Main Entry",value:responsibility||title||"Not supplied"});
    if (/\bsubject\s+(?:entr(?:y|ies)|heading(?:s)?)\b/.test(ql)) requestedEntries.push({label:"Subject Entry / Subject Heading",value:"Not supplied"});
    if (/\b(?:added|additional)\s+entr(?:y|ies)\b/.test(ql)||/access point/.test(ql)) requestedEntries.push({label:"Added Entry / Access Point",value:responsibility||"Not supplied"});
    if (/\bseries\s+entr(?:y|ies)\b/.test(ql)||/series statement/.test(ql)) requestedEntries.push({label:"Series Entry",value:field(q,"Series statement")||"Not supplied"});
    if (/\bcall\s+number\b/.test(ql)) requestedEntries.push({label:"Call Number",value:"Not supplied"});
    if (/\btracing\b/.test(ql)) requestedEntries.push({label:"Tracing",value:"Not supplied"});
    if (/\bphysical\s+description\b/.test(ql)) requestedEntries.push({label:"Physical Description",value:physical||"Not supplied"});
    if (!requestedEntries.length) requestedEntries.push({label:"Answer",value:entry});
    return {section,materialType:material,title:title||"Not supplied",responsibility:responsibility||"Not supplied",edition:edition||"Not supplied",publication:(place||publisher||date)?`${place||"[place not supplied]"} : ${publisher||"[publisher not supplied]"}, ${date||"[date not supplied]"}.`:"Not supplied",physical:physical||"Not supplied",notes:notes||"Not supplied",subjectHeadings:"Not supplied",accessPoints:responsibility||"Not supplied",requestedEntries,missing:missing.length?missing.join(", "):"None reported",verification:"Generated from the facts supplied in the question. Verify final AACR2 punctuation/details against your authorised course/reference material.",entry,provider:"Local fallback"};
  }
  function render(r){
    latest=r||{}; const entry=val(r.entry||r.mainEntry);
    put("entry",entry);
    const rows=$("catalogRows");
    if(rows){
      rows.innerHTML="";
      const items=Array.isArray(r.requestedEntries)?r.requestedEntries:[];
      // The ruled card is the primary answer. Avoid duplicating the same
      // complete card as one large paragraph when individual entries exist.
      const pre=$("entry");
      if(pre) pre.classList.toggle("hidden", items.length>0);
      items.forEach(item=>{
        const row=document.createElement("div"); row.className="catalog-row";
        const label=document.createElement("div"); label.className="catalog-row-label"; label.textContent=val(item.label);
        const value=document.createElement("div"); value.className="catalog-row-value"; value.textContent=val(item.value);
        row.append(label,value); rows.appendChild(row);
      });
    }
    put("outMaterial",val(r.materialType)); put("outTitle",val(r.title)); put("outResponsibility",val(r.responsibility)); put("outEdition",val(r.edition)); put("outPublication",val(r.publication)); put("outPhysical",val(r.physical)); put("outNotes",val(r.notes)); put("outSubject",val(r.subjectHeadings)); put("outAccess",val(r.accessPoints)); put("outMissing",val(r.missing)); put("outVerification",val(r.verification)); put("status",r.provider?`Generated · ${r.provider}`:"Generated");
    show("result",true); requestAnimationFrame(()=>$("result")?.scrollIntoView({behavior:"smooth",block:"start"}));
  }
  async function generate(){
    const q=$("question"), question=text(q?.value), material=text($("materialType")?.value)||sections[section].material;
    if(!question){alert("Please paste the complete cataloguing question first.");q?.focus();return;}
    setLoading(true,"Generating catalogue entry…"); put("pdfStatus","");
    const controller=new AbortController(), timer=setTimeout(()=>controller.abort(),30000);
    try{
      const response=await fetch("/generate",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({question,section,materialType:material}),signal:controller.signal,cache:"no-store"});
      const raw=await response.text(); let data={}; try{data=raw?JSON.parse(raw):{}}catch(e){throw new Error(`Server returned invalid response (${response.status}).`)}
      if(!response.ok) throw new Error(data.error||`Generation failed (${response.status}).`); render(data);
    }catch(e){
      console.error("Generate error:",e);
      // Guaranteed visible answer even if API/server is unavailable.
      render(localAnswer(question,material));
      put("status","Generated · Local fallback");
      put("pdfStatus",e.name==="AbortError"?"AI request timed out; answer generated locally from supplied facts.":"AI service unavailable; answer generated locally from supplied facts.");
    }finally{clearTimeout(timer);setLoading(false);}
  }
  function init(){
    document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>{section=b.dataset.section||"A";document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));b.classList.add("active");const s=sections[section]||sections.A;put("sectionKicker",`SECTION ${section}`);put("sectionTitle",s.title);put("sectionHelp",s.help);$("materialType").value=s.material;}));
    $("generate")?.addEventListener("click",generate);
    $("clear")?.addEventListener("click",()=>{$("question").value="";show("result",false);put("pdfStatus","");latest=null;$('question').focus();});
    $("copy")?.addEventListener("click",async()=>{if(!latest?.entry)return;try{await navigator.clipboard.writeText(latest.entry);put("pdfStatus","Catalogue entry copied.")}catch(e){put("pdfStatus","Copy failed. Select and copy the entry manually.")}});
    $("pdf")?.addEventListener("click",async()=>{if(!latest){alert("Generate the catalogue entry first.");return;}const b=$("pdf");b.disabled=true;put("pdfStatus","Preparing PDF…");try{const r=await fetch("/generate-pdf",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(latest),cache:"no-store"});if(!r.ok)throw new Error("PDF generation failed.");const blob=await r.blob(),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="LSP5004-catalogue-entry.pdf";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);put("pdfStatus","PDF ready — check your browser downloads.")}catch(e){put("pdfStatus",e.message);alert(e.message)}finally{b.disabled=false;}});
  }
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",init); else init();
  window.generateCatalogue=generate;
})();

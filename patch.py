from pathlib import Path
p=Path('/mnt/data/v8fix/public/style.css')
s=p.read_text()
start=s.index('/* V8 ADVANCED AACR2 CARD: true multi-page/continuation presentation */')
s=s[:start]+r'''/* V8.1 — standard catalogue card size: 12.5 cm × 7.5 cm */
.catalog-rows{display:flex;flex-direction:column;gap:18px;background:#eef2f5;padding:18px 0;align-items:flex-start}
.catalog-page{width:12.5cm;height:7.5cm;flex:0 0 12.5cm;break-after:page;page-break-after:always}
.catalog-sheet{width:12.5cm;height:7.5cm;background:#fff;padding:0;box-shadow:0 5px 16px rgba(15,23,42,.14);border:0;overflow:hidden}
.catalog-page-head{display:flex;justify-content:space-between;align-items:flex-end;gap:8px;height:.62cm;padding:0 .22cm .10cm;border-bottom:1px solid #777;margin:0}
.catalog-page-kicker{font-family:Arial,sans-serif;font-size:6px;font-weight:800;letter-spacing:.08em;color:#4b5563;text-transform:uppercase}
.catalog-page-title{font-family:Arial,sans-serif;font-size:9px;font-weight:800;letter-spacing:.01em;margin-top:1px;color:#111827}
.catalog-page-number{font-family:Arial,sans-serif;font-size:6px;font-weight:800;color:#5f6975;white-space:nowrap}
.catalog-card{width:12.5cm;height:6.88cm;border:1.2px solid #222;box-shadow:none;background:#fffefb;overflow:hidden}
.catalog-card-body{display:grid;grid-template-columns:.78cm minmax(0,1fr);height:6.25cm;min-height:0}
.catalog-gutter{border-right:1.1px solid #222;background:repeating-linear-gradient(to bottom,transparent 0,transparent 7.5mm,#c7cbd0 7.6mm,#c7cbd0 7.9mm)}
.catalog-card-content{min-width:0;height:6.25cm;overflow:hidden}
.catalog-row{display:grid;grid-template-columns:3.35cm minmax(0,1fr);border-top:1px solid #222;min-height:0}
.catalog-row:first-child{border-top:0}
.catalog-row-label{display:flex;align-items:flex-start;padding:1.8mm 1.5mm 1.5mm 2mm;border-right:1px solid #222;background:#faf9f4;font-family:Arial,sans-serif;font-size:6.8px;font-weight:700;line-height:1.25;text-transform:none;letter-spacing:0}
.catalog-row-value{padding:1.7mm 2mm 1.8mm;font-family:Georgia,"Times New Roman",serif;font-size:8.7px;line-height:1.42;white-space:pre-wrap;overflow-wrap:anywhere;color:#111}
.catalog-card-meta{height:.63cm;border-top:1px solid #222;background:#f4f4ef;padding:1.8mm 2mm;text-align:right;font-family:Arial,sans-serif;font-size:5.8px;font-weight:800;letter-spacing:.05em;color:#4b5563}
.catalog-card-wrap{padding:0;background:transparent;border:0;overflow:auto}
.catalog-card-wrap>h3{display:none}
.catalog-card-wrap .catalog-card-body pre{display:none}
@media(max-width:700px){
  .catalog-rows{align-items:flex-start;overflow-x:auto;padding:12px 0}
  .catalog-page{width:12.5cm;height:7.5cm;flex-basis:12.5cm}
  .catalog-sheet,.catalog-card{width:12.5cm;height:7.5cm}
  .catalog-card{height:6.88cm}
}
@media print{
  .catalog-rows{gap:0;background:#fff;padding:0}
  .catalog-page{break-after:page;page-break-after:always}
  .catalog-sheet{box-shadow:none}
}
'''
p.write_text(s)

p=Path('/mnt/data/v8fix/public/script.js')
s=p.read_text()
old='''      const chunked=[]; let chunk=[]; let weight=0;\n      // Paginate by content weight instead of forcing every record into one page.\n      // Long physical descriptions/notes therefore get their own continuation page.\n      items.forEach(item=>{\n        const w=70+item.label.length*0.5+item.value.length*0.42;\n        if(chunk.length && weight+w>620){chunked.push(chunk);chunk=[];weight=0;}\n        chunk.push(item); weight+=w;\n      });'''
new='''      const chunked=[]; let chunk=[]; let weight=0;\n      // Each rendered catalogue card is physically 12.5 cm × 7.5 cm.\n      // Keep adding entries until that card is full, then continue on a new card.\n      // There is deliberately no fixed page-count limit.\n      items.forEach(item=>{\n        const w=36 + item.label.length*0.35 + item.value.length*0.30;\n        if(chunk.length && weight+w>260){chunked.push(chunk);chunk=[];weight=0;}\n        // Very long single entries are split into continuation cards rather than overflowing.\n        if(!chunk.length && w>260){\n          const maxChars=Math.max(180, Math.floor(item.value.length*260/w));\n          let rest=item.value; let part=1;\n          while(rest.length){\n            const piece=rest.slice(0,maxChars);\n            const cut=piece.lastIndexOf(' ');\n            const take=cut>80?cut:piece.length;\n            chunked.push([{label:part===1?item.label:`${item.label} (continued)`,value:rest.slice(0,take).trim()}]);\n            rest=rest.slice(take).trim(); part++;\n          }\n          return;\n        }\n        chunk.push(item); weight+=w;\n      });'''
if old not in s: raise SystemExit('old JS block not found')
s=s.replace(old,new)
p.write_text(s)

p=Path('/mnt/data/v8fix/server.js')
s=p.read_text()
start=s.index('app.post("/generate-pdf"')
end=s.index('\napp.use((req, res) => res.status(404)', start)
new=r'''app.post("/generate-pdf", (req, res) => {
  const r=req.body||{};
  const entries=Array.isArray(r.requestedEntries)&&r.requestedEntries.length
    ? r.requestedEntries.map(x=>({label:pdfSafe(x?.label||"Entry"),value:pdfSafe(x?.value||"Not supplied")}))
    : [{label:"Catalogue Entry",value:pdfSafe(r.entry||"No catalogue entry generated.")}];

  // Standard card size requested for this course: 12.5 cm × 7.5 cm.
  // One PDF page is one physical catalogue card; additional content continues
  // automatically on as many card-pages as required.
  const CARD_W=12.5/2.54*72;
  const CARD_H=7.5/2.54*72;
  const doc=new PDFDocument({size:[CARD_W,CARD_H],margin:0,bufferPages:true});
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",'attachment; filename="LSP5004-catalogue-cards.pdf"');
  doc.pipe(res);

  const pad=8, gutter=22, labelW=96, contentW=CARD_W-pad*2-gutter;
  let cardNo=0;
  const usableTop=20, usableBottom=CARD_H-17;

  function startCard(continuation=false){
    cardNo++;
    if(cardNo>1) doc.addPage({size:[CARD_W,CARD_H],margin:0});
    doc.save().lineWidth(.7).rect(0.8,0.8,CARD_W-1.6,CARD_H-1.6).stroke().restore();
    doc.font("Helvetica-Bold").fontSize(6).text("LSP5004 · AACR2 PRACTICE",pad,3,{width:CARD_W-pad*2});
    doc.font("Helvetica").fontSize(5.5).text(continuation?"CATALOGUE CARD — CONTINUATION":"CATALOGUE CARD — ANSWER",pad,10,{width:CARD_W-pad*2});
    doc.font("Helvetica-Bold").fontSize(5.2).text(`CARD ${cardNo}`,CARD_W-42,10,{width:34,align:"right"});
    doc.moveTo(pad,18).lineTo(CARD_W-pad,18).stroke();
    // Traditional left filing/tracing gutter.
    doc.moveTo(pad+gutter,usableTop).lineTo(pad+gutter,usableBottom).stroke();
    // Light horizontal ruling inside the gutter.
    for(let yy=usableTop+14; yy<usableBottom; yy+=14) doc.moveTo(pad,yy).lineTo(pad+gutter,yy).stroke();
    return usableTop;
  }

  function rowHeight(label,value){
    doc.font("Helvetica-Bold").fontSize(5.7);
    const lh=doc.heightOfString(label,{width:labelW-gutter-8,lineGap:1});
    doc.font("Times-Roman").fontSize(7.2);
    const vh=doc.heightOfString(value,{width:CARD_W-pad-labelW-8,lineGap:1.4});
    return Math.max(18,lh+7,vh+7);
  }

  let y=startCard(false);
  for(const item of entries){
    const label=item.label, value=item.value;
    let h=rowHeight(label,value);
    if(y+h>usableBottom){
      doc.moveTo(pad,y).lineTo(CARD_W-pad,y).stroke();
      y=startCard(true);
      h=rowHeight(label,value);
    }
    doc.rect(pad,y,CARD_W-pad*2,h).stroke();
    doc.moveTo(pad+gutter,y).lineTo(pad+gutter,y+h).stroke();
    doc.moveTo(pad+labelW,y).lineTo(pad+labelW,y+h).stroke();
    doc.font("Helvetica-Bold").fontSize(5.7).text(label,pad+gutter+4,y+4,{width:labelW-gutter-8,lineGap:1});
    doc.font("Times-Roman").fontSize(7.2).text(value,pad+labelW+5,y+4,{width:CARD_W-pad-labelW-8,lineGap:1.4});
    y+=h;
  }
  // End marker stays on the final card, if there is room.
  if(y+12<usableBottom){
    doc.font("Helvetica-Bold").fontSize(5.2).text("END OF CATALOGUE RECORD",pad,usableBottom-8,{width:CARD_W-pad*2,align:"right"});
  }
  doc.end();
});
'''
s=s[:start]+new+s[end:]
s=s.replace('GENERATE-V8-ADVANCED-AACR2-MULTIPAGE-20260923','GENERATE-V8.1-STANDARD-CARD-12.5x7.5CM-20260923')
p.write_text(s)

p=Path('/mnt/data/v8fix/README.md')
s=p.read_text()
s += '''\n\n## V8.1 catalogue card sizing\n- Standard catalogue card size used by the renderer: **12.5 cm × 7.5 cm**.\n- The web preview uses the same physical CSS dimensions.\n- The PDF uses one 12.5 cm × 7.5 cm card per PDF page.\n- There is no fixed number of cards: content continues onto additional card-pages as required by the question and generated entries.\n- The card retains a left filing/tracing gutter plus ruled horizontal/vertical lines.\n'''
p.write_text(s)

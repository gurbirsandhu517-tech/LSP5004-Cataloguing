const $ = id => document.getElementById(id);

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value == null ? "" : String(value);
}
function setValue(id, value) {
  const el = $(id);
  if (el) el.value = value == null ? "" : String(value);
}
function setHidden(id, hidden) {
  const el = $(id);
  if (el) el.classList.toggle("hidden", hidden);
}

let currentSection = "A";
let latestResult = null;

const sections = {
  A: { title: "Section A — Serial Publications: Complexities", help: "Serial publication cataloguing practice.", material: "Serial Publication" },
  B: { title: "Section B — Uniform Titles; Motion Pictures", help: "Uniform-title and motion-picture cataloguing practice.", material: "Motion Picture" },
  C: { title: "Section C — Video Recordings; Sound Recordings", help: "Video and sound recording cataloguing practice.", material: "Video Recording" },
  D: { title: "Section D — Electronic Resources; Microforms", help: "Electronic-resource and microform cataloguing practice.", material: "Electronic Resource — Data" }
};

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  currentSection = btn.dataset.section || "A";
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  const info = sections[currentSection] || sections.A;
  setText("sectionKicker", `SECTION ${currentSection}`);
  setText("sectionTitle", info.title);
  setText("sectionHelp", info.help);
  setValue("materialType", info.material);
}));

function loading(on, text = "Generating catalogue entry…") {
  setHidden("loading", !on);
  setText("loadingText", text);
  const generate = $("generate");
  if (generate) {
    generate.disabled = on;
    generate.textContent = on ? "GENERATING…" : "⚡ GENERATE CATALOGUE ENTRY";
  }
}

function v(x) {
  return x != null && String(x).trim() ? String(x).trim() : "Not supplied";
}

function render(r) {
  if (!r || typeof r !== "object") throw new Error("The server returned an empty or invalid catalogue result.");
  latestResult = r;
  const entryText = v(r.entry ?? r.mainEntry);
  setText("entry", entryText);
  setText("outMainEntry", entryText);
  setText("outMaterial", r.materialType);
  setText("outTitle", r.title);
  setText("outResponsibility", r.responsibility);
  setText("outEdition", r.edition);
  setText("outPublication", r.publication);
  setText("outPhysical", r.physical);
  setText("outNotes", r.notes);
  setText("outSubject", r.subjectHeadings);
  setText("outAccess", r.accessPoints);
  setText("outMissing", r.missing);
  setText("outVerification", r.verification);
  setText("status", r.provider ? `Generated · ${r.provider}` : "Generated");
  const resultBox = $("result");
  if (resultBox) {
    resultBox.classList.remove("hidden");
    resultBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

const generateButton = $("generate");
if (generateButton) generateButton.addEventListener("click", async () => {
  const questionEl = $("question");
  const question = questionEl ? questionEl.value.trim() : "";
  if (!question) {
    alert("Please paste the complete cataloguing question first.");
    if (questionEl) questionEl.focus();
    return;
  }
  loading(true, "Gemini is generating…");
  try {
    const response = await fetch("/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question,
        section: currentSection,
        materialType: $("materialType")?.value || sections[currentSection]?.material || ""
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = Array.isArray(data.details) ? `\n${data.details.join("\n")}` : "";
      throw new Error((data.error || `Generation failed (${response.status}).`) + detail);
    }
    render(data);
  } catch (e) {
    alert(e?.message || "Catalogue generation failed. Please try again.");
  } finally {
    loading(false);
  }
});

const clearButton = $("clear");
if (clearButton) clearButton.addEventListener("click", () => {
  const q = $("question");
  if (q) q.value = "";
  setHidden("result", true);
  setText("pdfStatus", "");
  latestResult = null;
  if (q) q.focus();
});

const copyButton = $("copy");
if (copyButton) copyButton.addEventListener("click", async () => {
  if (!latestResult?.entry) return;
  try {
    await navigator.clipboard.writeText(latestResult.entry);
    setText("pdfStatus", "Catalogue entry copied.");
  } catch {
    setText("pdfStatus", "Copy failed. Select and copy the entry manually.");
  }
});

const pdfButton = $("pdf");
if (pdfButton) pdfButton.addEventListener("click", async () => {
  if (!latestResult) {
    alert("Generate the catalogue entry first.");
    return;
  }
  pdfButton.disabled = true;
  setText("pdfStatus", "Preparing PDF…");
  try {
    const response = await fetch("/generate-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(latestResult)
    });
    if (!response.ok) {
      const d = await response.json().catch(() => ({}));
      throw new Error(d.error || "PDF generation failed.");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "LSP5004-catalogue-entry.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    setText("pdfStatus", "PDF ready — check your browser downloads.");
  } catch (e) {
    setText("pdfStatus", e?.message || "PDF generation failed.");
    alert(e?.message || "PDF generation failed.");
  } finally {
    pdfButton.disabled = false;
  }
});

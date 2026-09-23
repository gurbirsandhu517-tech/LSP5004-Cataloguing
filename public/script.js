(() => {
  "use strict";

  function $(id) { return document.getElementById(id); }
  function setText(id, value) { const el = $(id); if (el) el.textContent = value == null ? "" : String(value); }
  function setValue(id, value) { const el = $(id); if (el) el.value = value == null ? "" : String(value); }
  function hidden(id, yes) { const el = $(id); if (el) el.classList.toggle("hidden", !!yes); }
  function value(x) { return x != null && String(x).trim() ? String(x).trim() : "Not supplied"; }

  let currentSection = "A";
  let latestResult = null;

  const sections = {
    A: { title: "Section A — Serial Publications: Complexities", help: "Serial publication cataloguing practice.", material: "Serial Publication" },
    B: { title: "Section B — Uniform Titles; Motion Pictures", help: "Uniform-title and motion-picture cataloguing practice.", material: "Motion Picture" },
    C: { title: "Section C — Video Recordings; Sound Recordings", help: "Video and sound recording cataloguing practice.", material: "Video Recording" },
    D: { title: "Section D — Electronic Resources; Microforms", help: "Electronic-resource and microform cataloguing practice.", material: "Electronic Resource — Data" }
  };

  function setLoading(on, msg) {
    hidden("loading", !on);
    setText("loadingText", msg || "Generating catalogue entry…");
    const b = $("generate");
    if (b) { b.disabled = on; b.textContent = on ? "GENERATING…" : "⚡ GENERATE CATALOGUE ENTRY"; }
  }

  function render(r) {
    if (!r || typeof r !== "object") throw new Error("Server returned no catalogue result.");
    latestResult = r;
    const entry = value(r.entry || r.mainEntry);
    setText("entry", entry);
    setText("outMainEntry", entry);
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
    const box = $("result");
    if (box) { box.classList.remove("hidden"); box.scrollIntoView({ behavior: "smooth", block: "start" }); }
  }

  async function generate() {
    const q = $("question");
    const question = q ? q.value.trim() : "";
    if (!question) { alert("Please paste the complete cataloguing question first."); if (q) q.focus(); return; }

    setLoading(true, "Generating catalogue entry…");
    setText("pdfStatus", "");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          question,
          section: currentSection,
          materialType: $("materialType")?.value || sections[currentSection]?.material || "Serial Publication"
        }),
        signal: controller.signal,
        cache: "no-store"
      });

      const raw = await response.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error(`Server returned non-JSON response (${response.status}).`); }
      if (!response.ok) throw new Error(data.error || `Generation failed (${response.status}).`);
      render(data);
    } catch (err) {
      if (err.name === "AbortError") alert("Generation took too long. Please try again.");
      else alert(err.message || "Catalogue generation failed. Please try again.");
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }

  function init() {
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

    const generateButton = $("generate");
    if (generateButton) generateButton.addEventListener("click", generate);

    const clearButton = $("clear");
    if (clearButton) clearButton.addEventListener("click", () => {
      if ($("question")) $("question").value = "";
      hidden("result", true);
      setText("pdfStatus", "");
      latestResult = null;
      $("question")?.focus();
    });

    const copyButton = $("copy");
    if (copyButton) copyButton.addEventListener("click", async () => {
      if (!latestResult?.entry) return;
      try { await navigator.clipboard.writeText(latestResult.entry); setText("pdfStatus", "Catalogue entry copied."); }
      catch (_) { setText("pdfStatus", "Copy failed. Select and copy the entry manually."); }
    });

    const pdfButton = $("pdf");
    if (pdfButton) pdfButton.addEventListener("click", async () => {
      if (!latestResult) { alert("Generate the catalogue entry first."); return; }
      pdfButton.disabled = true; setText("pdfStatus", "Preparing PDF…");
      try {
        const response = await fetch("/generate-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(latestResult), cache: "no-store" });
        if (!response.ok) { const d = await response.json().catch(() => ({})); throw new Error(d.error || "PDF generation failed."); }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = "LSP5004-catalogue-entry.pdf"; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500); setText("pdfStatus", "PDF ready — check your browser downloads.");
      } catch (e) { setText("pdfStatus", e.message || "PDF generation failed."); alert(e.message || "PDF generation failed."); }
      finally { pdfButton.disabled = false; }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

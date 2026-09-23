const $ = id => document.getElementById(id);

// Safe DOM setter: prevents the catalogue screen from crashing if an optional
// output element is missing. Both the current `entry` ID and the older
// `outMainEntry` ID are supported for compatibility with previous deployments.
function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

let currentSection = "A";
let latestResult = null;

const sections = {
  A: {
    title: "Section A — Serial Publications: Complexities",
    help: "Serial publication cataloguing practice.",
    material: "Serial Publication"
  },
  B: {
    title: "Section B — Uniform Titles; Motion Pictures",
    help: "Uniform-title and motion-picture cataloguing practice.",
    material: "Motion Picture"
  },
  C: {
    title: "Section C — Video Recordings; Sound Recordings",
    help: "Video and sound recording cataloguing practice.",
    material: "Video Recording"
  },
  D: {
    title: "Section D — Electronic Resources; Microforms",
    help: "Electronic-resource and microform cataloguing practice.",
    material: "Electronic Resource — Data"
  }
};

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    currentSection = btn.dataset.section;

    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const info = sections[currentSection];
    $("sectionKicker").textContent = `SECTION ${currentSection}`;
    $("sectionTitle").textContent = info.title;
    $("sectionHelp").textContent = info.help;
    $("materialType").value = info.material;
  });
});

function loading(on, text = "Generating catalogue entry…") {
  $("loading").classList.toggle("hidden", !on);
  $("loadingText").textContent = text;
  $("generate").disabled = on;
  $("generate").textContent = on ? "GENERATING…" : "⚡ GENERATE CATALOGUE ENTRY";
}

function v(x) {
  return x && String(x).trim() ? String(x).trim() : "Not supplied";
}

function render(r) {
  latestResult = r;

  const entryText = v(r.entry);

  // Current UI
  setText("entry", entryText);

  // Compatibility with the older deployed frontend that used outMainEntry.
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

$("generate").addEventListener("click", async () => {
  const question = $("question").value.trim();

  if (!question) {
    alert("Please paste the complete cataloguing question first.");
    $("question").focus();
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
        materialType: $("materialType").value
      })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const detail = Array.isArray(data.details) ? `\n${data.details.join("\n")}` : "";
      throw new Error((data.error || `Generation failed (${response.status}).`) + detail);
    }

    render(data);
  } catch (e) {
    alert(e.message || "Catalogue generation failed. Please try again.");
  } finally {
    loading(false);
  }
});

$("clear").addEventListener("click", () => {
  $("question").value = "";
  $("result").classList.add("hidden");
  $("pdfStatus").textContent = "";
  latestResult = null;
  $("question").focus();
});

$("copy").addEventListener("click", async () => {
  if (!latestResult?.entry) return;

  try {
    await navigator.clipboard.writeText(latestResult.entry);
    $("pdfStatus").textContent = "Catalogue entry copied.";
  } catch {
    $("pdfStatus").textContent = "Copy failed. Select and copy the entry manually.";
  }
});

$("pdf").addEventListener("click", async () => {
  if (!latestResult) {
    alert("Generate the catalogue entry first.");
    return;
  }

  $("pdf").disabled = true;
  $("pdfStatus").textContent = "Preparing PDF…";

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
    $("pdfStatus").textContent = "PDF ready — check your browser downloads.";
  } catch (e) {
    $("pdfStatus").textContent = e.message || "PDF generation failed.";
    alert($("pdfStatus").textContent);
  } finally {
    $("pdf").disabled = false;
  }
});

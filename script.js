const $ = id => document.getElementById(id);

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    $('section').value = btn.dataset.section;
  });
});

function val(id) { return $(id).value.trim(); }

function buildEntry() {
  const title = val('title');
  const responsibility = val('responsibility');
  const edition = val('edition');
  const place = val('place');
  const publisher = val('publisher');
  const date = val('date');
  const physical = val('physical');
  const notes = val('notes');
  const type = val('materialType');

  const parts = [];
  parts.push(title || '[Title not provided].');
  if (responsibility) parts.push(` / ${responsibility}.`);
  if (edition) parts.push(` — ${edition}.`);
  if (place || publisher || date) {
    parts.push(` — ${place || '[place not provided]'} : ${publisher || '[publisher not provided]'}, ${date || '[date not provided]'}.`);
  }
  if (physical) parts.push(` — ${physical}.`);
  if (notes) parts.push(` — Notes: ${notes}.`);

  const missing = [];
  if (!title) missing.push('Title proper');
  if (!responsibility) missing.push('Statement of responsibility');
  if (!place) missing.push('Place of publication');
  if (!publisher) missing.push('Publisher');
  if (!date) missing.push('Date');
  if (!physical) missing.push('Physical description');

  const subject = 'Not generated from copyrighted Sears text. Verify the appropriate authorized subject heading against your permitted reference source.';
  const access = responsibility || 'No creator/access point supplied.';
  const verification = `Material type identified as: ${type}. Description assembled only from supplied fields. Detailed AACR2 verification is still required.`;

  return {
    entry: parts.join(''),
    subject,
    access,
    verification,
    missing: missing.length ? missing.join(', ') : 'No basic fields missing.',
    title
  };
}

$('generate').addEventListener('click', () => {
  const r = buildEntry();
  if (!r.title) {
    $('title').focus();
    $('title').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  $('entry').textContent = r.entry;
  $('subject').textContent = r.subject;
  $('accessPoints').textContent = r.access;
  $('verification').textContent = r.verification;
  $('missing').textContent = r.missing;
  $('status').textContent = r.missing === 'No basic fields missing.' ? 'Requires verification' : 'Missing information';
  $('result').classList.remove('hidden');
  $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

$('clear').addEventListener('click', () => {
  document.querySelectorAll('input, textarea').forEach(el => el.value = '');
  $('result').classList.add('hidden');
  $('title').focus();
});

$('pdf').addEventListener('click', async () => {
  const r = buildEntry();
  const body = {
    section: val('section'),
    materialType: val('materialType'),
    title: r.title,
    entry: r.entry,
    subject: r.subject,
    accessPoints: r.access,
    verification: r.verification,
    missing: r.missing
  };

  try {
    const response = await fetch('/generate-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error('PDF generation failed');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'LSP5004-catalogue-entry.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert('PDF generation failed. Please try again.');
  }
});

/* Records & administration: PM hub, service reports, equipment/QR registry,
   document library, assessment & certification, admin. */
(function () {
  const { esc, $, $$, toast, modal, uid, fmtDate } = UI;
  const V = window.Views = window.Views || {};
  const eqName = id => (BME.equipment[id] || {}).name || id;
  const eqOptions = sel => Object.values(BME.equipment).sort((a, b) => a.name.localeCompare(b.name)).map(e => `<option value="${e.id}" ${e.id === sel ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
  const DOC_TYPES = ['PDF', 'SOP', 'Service Manual', 'User Manual', 'PM Checklist', 'QA Manual', 'Calibration Certificate', 'Service Report', 'Training Material'];

  /* Demo assets so the QR workflow is explorable on first run. */
  if (!Store.s.assets.length && !Store.s._seeded) {
    Store.s.assets = [
      { id: 'A-ICU-0007', equipment: 'ventilator', manufacturer: 'Other', model: 'Demo ICU ventilator', serial: 'DEMO-V-0007', location: 'ICU-2 Bed 7', installed: '2022-03-14', pmDue: '2026-12-01', qa: 'PASS', lastPM: '2026-06-02', history: [{ date: '2026-06-02', type: 'PM (annual)', text: 'PASS', by: 'Demo engineer' }], demo: true },
      { id: 'A-RAD-0001', equipment: 'ct', manufacturer: 'Other', model: 'Demo 64-slice CT', serial: 'DEMO-CT-0001', location: 'Radiology CT-1', installed: '2020-09-01', pmDue: '2026-11-15', qa: 'PASS', history: [], demo: true },
      { id: 'A-ED-0012', equipment: 'defibrillator', manufacturer: 'Other', model: 'Demo defibrillator', serial: 'DEMO-D-0012', location: 'ED Resus 2', installed: '2021-01-20', pmDue: '2026-10-01', qa: 'DUE', history: [], demo: true }
    ];
    Store.s._seeded = true; Store.save();
  }

  /* ================= PM HUB ================= */
  V.pmHub = function (el) {
    App.crumbs([['', 'Preventive Maintenance']]);
    const today = new Date().toISOString().slice(0, 10);
    const due = Store.s.assets.filter(a => a.pmDue && a.pmDue <= today);
    el.innerHTML = `<div class="page-head"><h1>Preventive maintenance</h1><p>Daily · Weekly · Monthly · Quarterly · Half-yearly · Annual — each task with why, tools, safety, procedure, acceptance criteria, result entry, pass/fail, remarks, photo and engineer signature.</p></div>
      ${due.length ? `<div class="warn-banner">⚠ ${due.length} asset(s) overdue for PM: ${due.map(a => `<a href="#/asset/${a.id}">${esc(a.serial)}</a>`).join(', ')}</div>` : ''}
      <div class="section-grid">${Object.values(BME.equipment).map(e => { BME.ensure(e); const n = Object.values(e.pm || {}).reduce((a, x) => a + x.length, 0); const r = Store.s.pmRecords.filter(p => p.equipment === e.id).length;
        return `<a class="section-card" href="#/eq/${e.id}/pm"><span class="sc-icon">✓</span><b>${esc(e.name)}</b><small>${n} tasks${e.full ? '' : ' (generic)'}${r ? ' · ' + r + ' record(s)' : ''}</small></a>`; }).join('')}</div>
      <div class="panel"><h3>Recent PM records</h3><table class="table"><thead><tr><th>Date</th><th>Equipment</th><th>Level</th><th>Asset</th><th>Engineer</th><th>Result</th><th></th></tr></thead><tbody>
      ${Store.s.pmRecords.slice(0, 20).map(r => `<tr><td>${esc(r.date)}</td><td>${esc(eqName(r.equipment))}</td><td>${esc(r.level)}</td><td>${esc((Store.s.assets.find(a => a.id === r.asset) || {}).serial || 'Training')}</td><td>${esc(r.engineer)}</td><td><span class="tag ${r.overall === 'PASS' ? 'tag-ok' : 'tag-bad'}">${r.overall}</span></td><td><button class="btn small" data-pm="${r.id}">View</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">No PM records yet.</td></tr>'}</tbody></table></div>`;
    $$('[data-pm]', el).forEach(b => b.onclick = async () => {
      const r = Store.s.pmRecords.find(x => x.id === b.dataset.pm);
      const photos = await Promise.all(r.items.map((it, k) => it.photo ? Files.get('media', r.id + '-' + k).catch(() => null) : null));
      modal(`<div class="print-doc"><h2>PM record — ${esc(eqName(r.equipment))}</h2><p>${esc(r.level)} · ${esc(r.date)} · ${esc(r.engineer)} · <b>${r.overall}</b></p>
        <table class="table"><thead><tr><th>Task</th><th>Result</th><th>Status</th><th>Remarks</th></tr></thead><tbody>${r.items.map((it, k) => `<tr><td>${esc(it.task)}</td><td>${esc(it.result)}</td><td>${esc(it.status.toUpperCase())}</td><td>${esc(it.remarks)}${photos[k] ? `<br><img class="thumb" src="${photos[k].data}">` : ''}</td></tr>`).join('')}</tbody></table>
        <p>Signature:</p><img class="sig-img" src="${r.signature}"></div><button class="btn no-print" onclick="window.print()">Print / Save PDF</button>`, { wide: true });
    });
  };

  /* ================= SERVICE REPORTS ================= */
  V.reports = function (el) {
    App.crumbs([['', 'Service Reports']]);
    const r = Store.s.serviceReports;
    el.innerHTML = `<div class="page-head row between wrap"><div><h1>Service reports</h1><p>Practise professional service documentation. Reports print as PDF.</p></div><a class="btn btn-primary" href="#/report/new">+ New service report</a></div>
      <table class="table"><thead><tr><th>Report</th><th>Date</th><th>Equipment</th><th>Serial</th><th>Complaint</th><th>Status</th><th>Quality</th></tr></thead><tbody>
      ${r.map(x => `<tr><td><a href="#/report/${x.id}">${esc(x.id)}</a></td><td>${esc(x.date)}</td><td>${esc(eqName(x.equipment))}</td><td>${esc(x.serial)}</td><td>${esc(x.complaint)}</td><td><span class="tag">${esc(x.finalStatus)}</span></td><td>${x.quality}%</td></tr>`).join('') || '<tr><td colspan="7" class="muted">No reports yet.</td></tr>'}</tbody></table>`;
  };

  const RF = [['equipment', 'Equipment'], ['make', 'Make'], ['model', 'Model'], ['serial', 'Serial number'], ['location', 'Location'], ['complaint', 'Complaint'], ['errorCode', 'Error code'],
    ['inspection', 'Initial inspection', 1], ['diagnosis', 'Diagnosis', 1], ['rootCause', 'Root cause', 1], ['action', 'Action taken', 1], ['parts', 'Parts replaced', 1], ['testing', 'Testing performed', 1],
    ['finalStatus', 'Final status'], ['downtime', 'Downtime (hours)'], ['engineer', 'Engineer'], ['date', 'Date']];

  V.report = function (el, id) {
    const q = window._query || new URLSearchParams();
    if (id === 'new') return reportForm(el, q);
    const r = Store.s.serviceReports.find(x => x.id === id);
    if (!r) { el.innerHTML = '<div class="empty">Report not found</div>'; return; }
    App.crumbs([['#/reports', 'Service Reports'], ['', r.id]]);
    el.innerHTML = `<div class="row gap no-print"><button class="btn btn-primary" onclick="window.print()">⬇ Print / Save as PDF</button><a class="btn" href="#/reports">All reports</a></div>
      <article class="print-doc report-doc"><header><div><b>BIOMEDICAL ENGINEERING DEPARTMENT</b><h1>Service Report</h1></div><div class="rd-id"><small>Report No.</small><b>${esc(r.id)}</b><small>${esc(r.date)}</small></div></header>
      <table class="rd-grid"><tr><th>Equipment</th><td>${esc(eqName(r.equipment))}</td><th>Make</th><td>${esc(r.make)}</td></tr><tr><th>Model</th><td>${esc(r.model)}</td><th>Serial No.</th><td>${esc(r.serial)}</td></tr>
        <tr><th>Location</th><td>${esc(r.location)}</td><th>Error code</th><td>${esc(r.errorCode)}</td></tr><tr><th>Complaint</th><td colspan="3">${esc(r.complaint)}</td></tr></table>
      ${['inspection', 'diagnosis', 'rootCause', 'action', 'parts', 'testing'].map(k => `<section><h3>${RF.find(f => f[0] === k)[1]}</h3><p>${esc(r[k] || '—').replace(/\n/g, '<br>')}</p></section>`).join('')}
      <table class="rd-grid"><tr><th>Final status</th><td><b>${esc(r.finalStatus)}</b></td><th>Downtime</th><td>${esc(r.downtime)} h</td></tr><tr><th>Engineer</th><td>${esc(r.engineer)}</td><th>Date</th><td>${esc(r.date)}</td></tr></table>
      <div class="rd-sign"><div><small>Engineer signature</small>${r.signature ? `<img src="${r.signature}">` : ''}</div><div><small>Department acceptance</small></div></div>
      <footer>Generated by BioMed Service Academy · training record. ${esc(UI.DISCLAIMER)}</footer></article>`;
  };

  function reportForm(el, q) {
    App.crumbs([['#/reports', 'Service Reports'], ['', 'New']]);
    const pre = { equipment: q.get('eq') || '', date: new Date().toISOString().slice(0, 10), engineer: Store.s.user.name, finalStatus: 'Returned to service' };
    const c = q.get('case') && BME.cases[q.get('case')], s = q.get('sim') && BME.scenarios[q.get('sim')];
    if (c) Object.assign(pre, { complaint: c.complaint, inspection: c.context, rootCause: '', action: '' });
    if (s) Object.assign(pre, { complaint: s.fault, errorCode: s.errorCode, inspection: s.symptoms.join('; ') });
    const asset = q.get('asset') && Store.s.assets.find(a => a.id === q.get('asset'));
    if (asset) Object.assign(pre, { equipment: asset.equipment, make: asset.manufacturer, model: asset.model, serial: asset.serial, location: asset.location, asset: asset.id });
    el.innerHTML = `<div class="page-head"><h1>New service report</h1><p>Complete every section. Documentation quality is scored.</p></div>
      <form class="panel report-form" id="rf">
        <label>Asset (optional)<select name="asset"><option value="">—</option>${Store.s.assets.map(a => `<option value="${a.id}" ${a.id === pre.asset ? 'selected' : ''}>${esc(a.serial)} · ${esc(eqName(a.equipment))} · ${esc(a.location)}</option>`).join('')}</select></label>
        <div class="form-grid">${RF.map(([k, l, big]) => k === 'equipment' ? `<label>${l}<select name="equipment" required><option value="">Select…</option>${eqOptions(pre.equipment)}</select></label>`
          : k === 'finalStatus' ? `<label>${l}<select name="finalStatus">${['Returned to service', 'Returned to service with restrictions', 'Awaiting parts', 'Escalated to manufacturer', 'Condemned / beyond repair'].map(o => `<option ${o === pre.finalStatus ? 'selected' : ''}>${o}</option>`).join('')}</select></label>`
          : big ? `<label class="span2">${l}<textarea name="${k}" rows="3">${esc(pre[k] || '')}</textarea></label>`
          : `<label>${l}<input name="${k}" ${k === 'date' ? 'type="date"' : k === 'downtime' ? 'type="number" step="0.5"' : ''} value="${esc(pre[k] || '')}"></label>`).join('')}</div>
        <label>Engineer signature</label><canvas class="sig" id="rsig" width="600" height="140"></canvas><button type="button" class="btn small" id="rclr">Clear</button>
        <div class="row gap"><button class="btn btn-primary">Save & generate report</button></div></form>`;
    const sig = UI.signaturePad($('#rsig', el));
    $('#rclr', el).onclick = () => sig.clear();
    $('[name=asset]', el).onchange = e => { const a = Store.s.assets.find(x => x.id === e.target.value); if (!a) return; const f = $('#rf', el); f.equipment.value = a.equipment; f.make.value = a.manufacturer; f.model.value = a.model; f.serial.value = a.serial; f.location.value = a.location; };
    $('#rf', el).onsubmit = e => {
      e.preventDefault();
      const fd = Object.fromEntries(new FormData(e.target).entries());
      if (!fd.equipment) return toast('Select the equipment');
      const filled = RF.filter(([k]) => String(fd[k] || '').trim()).length + (sig.value() ? 1 : 0), total = RF.length + 1;
      const r = Object.assign(fd, { id: 'SR-' + Date.now().toString().slice(-7), signature: sig.value(), quality: Math.round(filled / total * 100), ts: Date.now() });
      Store.s.serviceReports.unshift(r);
      if (fd.asset) { const a = Store.s.assets.find(x => x.id === fd.asset); if (a) { a.history = a.history || []; a.history.unshift({ date: fd.date, type: 'Service ' + r.id, text: fd.rootCause || fd.complaint, by: fd.engineer }); } }
      const k = 'documentation-practice', prev = Store.s.quiz[k] || { score: 0, total: 0, domains: { documentation: [0, 0] } };
      prev.score += filled; prev.total += total; prev.domains.documentation[0] += filled; prev.domains.documentation[1] += total; prev.pct = Math.round(prev.score / prev.total * 100); prev.band = prev.pct >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT';
      Store.recordQuiz(k, prev);
      toast(`Report saved · documentation completeness ${r.quality}%`);
      location.hash = '#/report/' + r.id;
    };
  }

  /* ================= EQUIPMENT REGISTRY & QR ================= */
  const assetUrl = id => location.href.split('#')[0] + '#/asset/' + id;
  V.assets = function (el) {
    App.crumbs([['', 'Equipment & QR']]);
    const today = new Date().toISOString().slice(0, 10);
    el.innerHTML = `<div class="page-head row between wrap"><div><h1>Equipment & QR identification</h1><p>Every asset gets a unique QR code. Scan it at the bedside to open its profile, PM status, history, QA status, manuals and troubleshooting.</p></div>
      <div class="row gap"><button class="btn" onclick="App.openScanner()">⌗ Scan QR</button><button class="btn btn-primary" id="addA">+ Add equipment</button></div></div>
      <div class="flow-chain">${['QR', 'Equipment profile', 'Make / Model / Serial', 'PM status', 'Service history', 'QA status', 'Manual', 'Troubleshooting', 'Open service record'].map(x => `<span>${x}</span>`).join('<i>→</i>')}</div>
      <div class="asset-grid">${Store.s.assets.map(a => `<a class="asset-card" href="#/asset/${a.id}"><div class="qr-mini" data-qr="${a.id}"></div><div><b>${esc(eqName(a.equipment))}</b><small>${esc(a.model)}</small><small>SN ${esc(a.serial)} · ${esc(a.location)}</small>
        <span class="tag ${a.pmDue && a.pmDue <= today ? 'tag-bad' : 'tag-ok'}">PM ${a.pmDue && a.pmDue <= today ? 'OVERDUE' : 'due ' + esc(a.pmDue || '—')}</span>${a.demo ? ' <span class="tag">demo</span>' : ''}</div></a>`).join('')}</div>`;
    $$('[data-qr]', el).forEach(d => { if (window.QRCode) new QRCode(d, { text: assetUrl(d.dataset.qr), width: 84, height: 84, correctLevel: QRCode.CorrectLevel.M }); else d.textContent = 'QR'; });
    $('#addA', el).onclick = () => assetForm();
  };
  function assetForm(a) {
    a = a || {};
    const c = modal(`<h2>${a.id ? 'Edit' : 'Add'} equipment</h2><form id="af" class="form-grid">
      <label>Equipment type<select name="equipment" required>${eqOptions(a.equipment)}</select></label>
      <label>Manufacturer<select name="manufacturer">${BME.manufacturers.map(m => `<option ${m.name === a.manufacturer ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      <label>Model<input name="model" required value="${esc(a.model || '')}"></label><label>Serial number<input name="serial" required value="${esc(a.serial || '')}"></label>
      <label>Location<input name="location" required value="${esc(a.location || '')}"></label><label>Asset ID<input name="id" value="${esc(a.id || '')}" placeholder="auto" ${a.id ? 'readonly' : ''}></label>
      <label>Installed<input type="date" name="installed" value="${esc(a.installed || '')}"></label><label>Next PM due<input type="date" name="pmDue" value="${esc(a.pmDue || '')}"></label>
      <label>QA status<select name="qa">${['PASS', 'FAIL', 'DUE', 'N/A'].map(o => `<option ${o === a.qa ? 'selected' : ''}>${o}</option>`).join('')}</select></label>
      <div class="span2"><button class="btn btn-primary">Save</button></div></form>`, { wide: true });
    $('#af', c).onsubmit = e => {
      e.preventDefault(); const fd = Object.fromEntries(new FormData(e.target).entries());
      fd.id = (fd.id || 'A-' + Date.now().toString(36)).replace(/[^\w-]/g, '').toUpperCase();
      const ex = Store.s.assets.find(x => x.id === fd.id);
      if (ex) Object.assign(ex, fd); else Store.s.assets.unshift(Object.assign({ history: [], notes: [] }, fd));
      Store.save(); UI.closeModal(); App.route();
    };
  }
  V.asset = function (el, id) {
    const a = Store.s.assets.find(x => x.id === id);
    if (!a) { App.crumbs([['#/assets', 'Equipment'], ['', id]]); el.innerHTML = `<div class="empty"><h2>Unknown asset ${esc(id)}</h2><a class="btn" href="#/assets">Equipment registry</a></div>`; return; }
    const eq = BME.ensure(BME.equipment[a.equipment]) || { name: a.equipment };
    App.crumbs([['#/assets', 'Equipment & QR'], ['', a.serial]]);
    const today = new Date().toISOString().slice(0, 10), overdue = a.pmDue && a.pmDue <= today;
    a.notes = a.notes || [];
    el.innerHTML = `<div class="asset-profile"><div class="ap-head"><div id="apqr" class="qr-big"></div><div><div class="eyebrow">Asset ${esc(a.id)}</div><h1>${esc(eq.name)}</h1>
        <div class="ap-meta"><div><small>Make</small><b>${esc(a.manufacturer)}</b></div><div><small>Model</small><b>${esc(a.model)}</b></div><div><small>Serial</small><b>${esc(a.serial)}</b></div><div><small>Location</small><b>${esc(a.location)}</b></div></div>
        <div class="haz-row">${UI.hazardBadges(eq.hazards)}</div></div></div>
      <div class="ap-actions">
        <a class="ap-btn" href="#/eq/${eq.id}/pm"><b class="${overdue ? 'bad-t' : 'ok-t'}">${overdue ? 'OVERDUE' : 'OK'}</b><small>PM · due ${esc(a.pmDue || '—')} · last ${esc(a.lastPM || '—')}</small></a>
        <a class="ap-btn" href="#/eq/${eq.id}/qa"><b class="${a.qa === 'PASS' ? 'ok-t' : 'bad-t'}">${esc(a.qa || '—')}</b><small>QA status</small></a>
        <a class="ap-btn" href="#/eq/${eq.id}/documents"><b>❐</b><small>Manuals</small></a>
        <a class="ap-btn" href="#/service/${eq.id}"><b>⚒</b><small>Troubleshooting</small></a>
        <a class="ap-btn" href="#/eq/${eq.id}/errors"><b>⌕</b><small>Error codes</small></a>
        <a class="ap-btn primary" href="#/report/new?asset=${a.id}"><b>✎</b><small>Open service record</small></a></div>
      <div class="two-col"><div class="panel"><h3>Service history</h3>${(a.history || []).length ? `<ol class="timeline">${a.history.map(h => `<li><b>${esc(h.date)} · ${esc(h.type)}</b><p>${esc(h.text)} — ${esc(h.by)}</p></li>`).join('')}</ol>` : '<p class="muted">No history yet.</p>'}</div>
      <div class="panel"><h3>Service notes & photos</h3><textarea id="note" rows="3" placeholder="Record service notes…"></textarea>
        <div class="row gap"><label class="file-btn">📷 Upload photo<input type="file" accept="image/*" capture="environment" id="aph"></label><button class="btn btn-primary" id="saveNote">Save note</button></div>
        <div class="notes">${a.notes.map(n => `<div class="note"><small>${esc(n.date)} · ${esc(n.by)}</small><p>${esc(n.text)}</p>${n.photo ? `<img class="thumb" data-ph="${n.photo}">` : ''}</div>`).join('')}</div></div></div>
      <div class="row gap no-print"><button class="btn" id="printLbl">🖨 Print QR label</button><button class="btn" id="editA">Edit</button>${a.demo ? '' : '<button class="btn danger" id="delA">Delete</button>'}</div></div>`;
    if (window.QRCode) new QRCode($('#apqr', el), { text: assetUrl(a.id), width: 132, height: 132 });
    $$('[data-ph]', el).forEach(img => Files.get('media', img.dataset.ph).then(r => { if (r) img.src = r.data; }).catch(() => {}));
    let photo = null;
    $('#aph', el).onchange = async e => { const f = e.target.files[0]; if (f) { photo = await UI.readImage(f, 1000); toast('Photo attached'); } };
    $('#saveNote', el).onclick = async () => {
      const text = $('#note', el).value.trim(); if (!text && !photo) return toast('Write a note or add a photo');
      let pid = null; if (photo) { pid = uid('ph'); await Files.put('media', { id: pid, data: photo }).catch(() => { pid = null; toast('Photo storage unavailable'); }); }
      a.notes.unshift({ date: new Date().toISOString().slice(0, 10), by: Store.s.user.name, text, photo: pid }); Store.save(); App.route();
    };
    $('#editA', el).onclick = () => assetForm(a);
    const del = $('#delA', el); if (del) del.onclick = () => { if (confirm('Delete this asset record?')) { Store.s.assets = Store.s.assets.filter(x => x !== a); Store.save(); location.hash = '#/assets'; } };
    $('#printLbl', el).onclick = () => {
      const img = $('#apqr img', el) || $('#apqr canvas', el); const src = img ? (img.src || img.toDataURL()) : '';
      modal(`<div class="print-doc qr-label"><img src="${src}"><div><b>${esc(eq.name)}</b><br>${esc(a.model)}<br>SN ${esc(a.serial)}<br>${esc(a.location)}<br><small>Asset ${esc(a.id)} · scan for PM, history & manuals</small></div></div><button class="btn no-print" onclick="window.print()">Print</button>`);
    };
  };

  /* ================= DOCUMENT LIBRARY ================= */
  if (window.pdfjsLib) pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  async function pdfText(blob) {
    if (!window.pdfjsLib) return [];
    try {
      const pdf = await pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise; const pages = [];
      for (let p = 1; p <= Math.min(pdf.numPages, 400); p++) { const tc = await (await pdf.getPage(p)).getTextContent(); pages.push(tc.items.map(i => i.str).join(' ')); }
      return pages;
    } catch (e) { console.warn('PDF text extraction failed', e); return []; }
  }
  V._docRow = (d, hit) => `<div class="doc-row" data-id="${d.id}"><div class="doc-ic">${d.mime === 'application/pdf' ? 'PDF' : (d.name.split('.').pop() || '').toUpperCase().slice(0, 4)}</div>
    <div class="doc-main"><b>${esc(d.name)}</b><small><span class="tag">${esc(d.docType)}</span> ${esc(eqName(d.equipment) || '')}${d.component ? ' · ' + esc(d.component) : ''}${d.errorCode ? ' · <code>' + esc(d.errorCode) + '</code>' : ''} · ${(d.size / 1024 / 1024).toFixed(2)} MB · ${d.pages ? d.pages.length + ' pages indexed' : 'not text-indexed'}</small>${hit || ''}</div>
    <div class="doc-act"><button class="btn small" data-act="view">View</button><button class="btn small" data-act="dl">Download</button><button class="btn small ${Store.s.bookmarks[d.id] ? 'on' : ''}" data-act="bm">${Store.s.bookmarks[d.id] ? '★' : '☆'}</button><button class="btn small danger" data-act="del">✕</button></div></div>`;
  V._wireDocs = (root, refresh) => $$('.doc-row', root).forEach(row => $$('[data-act]', row).forEach(b => b.onclick = async () => {
    const d = await Files.get('files', row.dataset.id); if (!d) return;
    const url = URL.createObjectURL(d.blob); const act = b.dataset.act;
    if (act === 'view') { const page = row.dataset.page ? '#page=' + row.dataset.page : ''; d.mime === 'application/pdf' ? modal(`<h3>${esc(d.name)}</h3><iframe class="pdf-frame" src="${url}${page}"></iframe>`, { wide: true }) : window.open(url, '_blank'); }
    if (act === 'dl') { const a = document.createElement('a'); a.href = url; a.download = d.name; a.click(); }
    if (act === 'bm') { Store.s.bookmarks[d.id] = !Store.s.bookmarks[d.id]; if (!Store.s.bookmarks[d.id]) delete Store.s.bookmarks[d.id]; Store.save(); refresh(); }
    if (act === 'del' && confirm('Delete ' + d.name + '?')) { await Files.del('files', d.id); refresh(); }
  }));
  V.documents = function (el) {
    App.crumbs([['', 'Service Reference Library']]);
    el.innerHTML = `<div class="page-head"><h1>Service reference library</h1><p>Upload manuals, SOPs, checklists and certificates. PDFs are text-indexed in your browser so you can search inside them. Files stay on this device.</p></div>
      <div class="panel upload"><div class="form-grid">
        <label>Files<input type="file" id="dfile" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.txt"></label>
        <label>Document type<select id="dtype">${DOC_TYPES.map(t => `<option>${t}</option>`).join('')}</select></label>
        <label>Related equipment<select id="deq"><option value="">—</option>${eqOptions()}</select></label>
        <label>Related component<select id="dcomp"><option value="">—</option></select></label>
        <label>Related error code<input id="derr" placeholder="e.g. TRN-V204"></label>
        <div class="span2"><button class="btn btn-primary" id="dup">Upload & index</button> <span id="dprog" class="muted"></span></div></div></div>
      <div class="filters"><input type="search" id="dq" placeholder="Search names, metadata and text inside PDFs…"><select id="dft"><option value="">All types</option>${DOC_TYPES.map(t => `<option>${t}</option>`).join('')}</select><select id="dfe"><option value="">All equipment</option>${eqOptions()}</select><label class="switch"><input type="checkbox" id="dbm"><span></span> Bookmarked</label></div>
      <div id="dlist"><p class="muted">Loading…</p></div>`;
    $('#deq', el).onchange = e => { const eq = BME.ensure(BME.equipment[e.target.value]); $('#dcomp', el).innerHTML = '<option value="">—</option>' + (eq ? Object.values(eq.components).map(c => `<option>${esc(c.name)}</option>`).join('') : ''); };
    $('#dup', el).onclick = async () => {
      const files = [...$('#dfile', el).files]; if (!files.length) return toast('Choose files first');
      for (const [n, f] of files.entries()) {
        $('#dprog', el).textContent = `Indexing ${n + 1}/${files.length}: ${f.name}…`;
        const pages = f.type === 'application/pdf' ? await pdfText(f) : f.type.startsWith('text') ? [await f.text()] : null;
        await Files.put('files', { id: uid('doc'), name: f.name, mime: f.type, size: f.size, blob: f, docType: $('#dtype', el).value, equipment: $('#deq', el).value, component: $('#dcomp', el).value, errorCode: $('#derr', el).value.trim(), pages, added: Date.now() });
      }
      $('#dprog', el).textContent = 'Done.'; $('#dfile', el).value = ''; list();
    };
    let docs = [];
    const list = async () => {
      try { docs = await Files.all('files'); } catch (e) { $('#dlist', el).innerHTML = '<div class="empty small">Document storage (IndexedDB) is unavailable in this browser mode.</div>'; return; }
      const q = $('#dq', el).value.trim().toLowerCase(), t = $('#dft', el).value, fe = $('#dfe', el).value, bm = $('#dbm', el).checked;
      const out = [];
      docs.sort((a, b) => b.added - a.added).forEach(d => {
        if ((t && d.docType !== t) || (fe && d.equipment !== fe) || (bm && !Store.s.bookmarks[d.id])) return;
        if (!q) return out.push([d, '']);
        const meta = [d.name, d.docType, eqName(d.equipment), d.component, d.errorCode].join(' ').toLowerCase();
        const hits = []; (d.pages || []).forEach((p, i) => { const k = p.toLowerCase().indexOf(q); if (k > -1) hits.push([i + 1, p.slice(Math.max(0, k - 60), k + q.length + 60)]); });
        if (meta.includes(q) || hits.length) out.push([d, hits.length ? `<div class="hits">${hits.slice(0, 3).map(([pg, s]) => `<a href="#" data-page="${pg}" class="hit">p.${pg}: …${esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), m => `<mark>${m}</mark>`)}…</a>`).join('')}${hits.length > 3 ? `<small>+${hits.length - 3} more pages</small>` : ''}</div>` : '']);
      });
      $('#dlist', el).innerHTML = out.map(([d, h]) => V._docRow(d, h)).join('') || `<div class="empty small">${docs.length ? 'No matches.' : 'No documents yet — upload your first service manual above.'}</div>`;
      V._wireDocs($('#dlist', el), list);
      $$('.hit', el).forEach(a => a.onclick = e => { e.preventDefault(); const row = a.closest('.doc-row'); row.dataset.page = a.dataset.page; $('[data-act=view]', row).click(); });
    };
    ['#dq', '#dft', '#dfe', '#dbm'].forEach(s => $(s, el).addEventListener('input', list));
    list();
  };

  /* ================= ASSESSMENT & CERTIFICATION ================= */
  V.assessment = function (el, mode) {
    App.crumbs([['#/assessment', 'Assessment & Certification']].concat(mode ? [['', 'Final assessment']] : []));
    if (mode === 'final') {
      const pool = [];
      Object.values(BME.equipment).filter(e => e.full).forEach(e => (e.questions || []).forEach(q => pool.push(Object.assign({}, q, { q: `[${e.name}] ${q.q}` }))));
      BME.safetyTopics.forEach(t => pool.push(Object.assign({ domain: 'safety', why: t.points[0] }, t.q)));
      BME.genericQuestions.forEach(q => pool.push(q));
      // Balance across domains: 4 per domain where possible.
      const pick = []; BME.DOMAINS.forEach(d => pool.filter(q => q.domain === d).sort(() => Math.random() - .5).slice(0, 4).forEach(q => pick.push(q)));
      el.innerHTML = `<div class="page-head"><h1>Final assessment</h1><p>${pick.length} questions balanced across knowledge, technical, troubleshooting, safety and documentation. ≥70% PASS · ≥90% ADVANCED.</p></div><div id="fq"></div><div id="cert"></div>`;
      UI.quiz($('#fq', el), pick.sort(() => Math.random() - .5), r => {
        Store.recordQuiz('final', r); App.renderNav();
        if (r.pct >= 70) $('#cert', el).innerHTML = `<div class="certificate print-doc"><div class="cert-in"><small>BioMed Service Academy</small><h1>Certificate of Achievement</h1><p>This certifies that</p><h2>${esc(Store.s.user.name)}</h2><p>has completed the Biomedical Equipment Service final assessment with the result</p><h3>${r.band} · ${r.pct}%</h3><p class="muted">Training level ${Store.level()} — ${BME.LEVELS[Store.level() - 1].name} · ${fmtDate(Date.now())}</p><small>Training certificate — not a manufacturer authorisation to service specific models.</small></div></div><button class="btn btn-primary no-print" onclick="window.print()">Print certificate</button>`;
      });
      return;
    }
    const rows = Object.values(BME.equipment).filter(e => e.full);
    const f = Store.s.quiz.final;
    el.innerHTML = `<div class="page-head"><h1>Assessment & certification</h1><p>After every module: MCQ, image identification, component identification, troubleshooting scenario, practical decision. Scored by Knowledge · Technical · Troubleshooting · Safety · Documentation → PASS / NEEDS IMPROVEMENT / ADVANCED.</p></div>
      <div class="panel final-card"><div><h2>Final assessment</h2><p>${f ? `Last result: <b>${f.pct}% · ${f.band}</b>` : 'Not attempted yet.'}</p></div><a class="btn btn-primary" href="#/assessment/final">Start final assessment →</a></div>
      <table class="table"><thead><tr><th>Module</th><th>Questions</th><th>Result</th><th>Band</th><th></th></tr></thead><tbody>
      ${rows.map(e => { const q = Store.s.quiz[e.id]; return `<tr><td>${esc(e.name)}</td><td>${(e.questions || []).length}+</td><td>${q ? q.pct + '%' : '—'}</td><td>${q ? `<span class="tag ${q.pct >= 70 ? 'tag-ok' : 'tag-bad'}">${q.band}</span>` : '—'}</td><td><a class="btn small" href="#/eq/${e.id}/assessment">${q ? 'Retake' : 'Start'}</a></td></tr>`; }).join('')}
      <tr><td>Fault simulations</td><td>${Object.keys(BME.scenarios).length}</td><td>${Object.values(Store.s.scenarios).filter(x => x.solved).length} solved</td><td>—</td><td><a class="btn small" href="#/simlab">Open</a></td></tr>
      <tr><td>Image identification</td><td>${Object.keys(BME.artifacts).length}</td><td>${Object.keys(Store.s.artifacts).length} attempted</td><td>—</td><td><a class="btn small" href="#/image-quality">Open</a></td></tr></tbody></table>`;
  };

  /* ================= ADMIN ================= */
  V.admin = function (el) {
    App.crumbs([['', 'Admin']]);
    const cu = Store.s.custom;
    el.innerHTML = `<div class="page-head"><h1>Administration</h1><p>Extend the platform without changing the core application. Data added here is stored in this browser; export it as JSON to share or migrate to the server database (db/schema.sql).</p></div>
      <div class="admin-grid">
      <form class="panel" id="fUser"><h3>Profile</h3><label>Trainee / engineer name<input name="name" value="${esc(Store.s.user.name)}"></label><button class="btn btn-primary">Save</button></form>
      <form class="panel" id="fCat"><h3>Add equipment category</h3><label>Name<input name="name" required></label><label>Icon (one character)<input name="icon" maxlength="2" value="◆"></label><label>Colour<input name="color" type="color" value="#7c8cff"></label><button class="btn btn-primary">Add category</button>
        ${cu.categories.length ? `<p class="muted small">Custom: ${cu.categories.map(c => esc(c.name)).join(', ')}</p>` : ''}</form>
      <form class="panel" id="fEq"><h3>Add equipment</h3><label>Name<input name="name" required></label><label>Category<select name="category">${BME.categories.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label>
        <div class="row gap"><label>Difficulty<select name="difficulty"><option>Beginner</option><option selected>Intermediate</option><option>Advanced</option><option>Expert</option></select></label><label>Hours<input name="hours" type="number" value="4"></label></div>
        <label>Major components in signal/energy order (one per line)<textarea name="parts" rows="5" required placeholder="Power supply\nController\nSensor\nDisplay"></textarea></label>
        <label>Hazard label (optional)<input name="hazard" placeholder="e.g. HIGH VOLTAGE"></label><button class="btn btn-primary">Add equipment</button>
        ${cu.equipment.length ? `<p class="muted small">Custom: ${cu.equipment.map(e => `${esc(e.name)} <a href="#" data-deleq="${e.id}">✕</a>`).join(', ')}</p>` : ''}</form>
      <form class="panel" id="fModel"><h3>Add manufacturer model</h3><label>Manufacturer<select name="manufacturer">${BME.manufacturers.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>
        <label>Equipment<select name="equipment">${eqOptions()}</select></label><label>Model name<input name="name" required></label><button class="btn btn-primary">Add model</button>
        ${cu.models.length ? `<p class="muted small">${cu.models.length} custom model(s)</p>` : ''}</form>
      <form class="panel span2" id="fErr"><h3>Add model-specific error code</h3><p class="warn-banner small">Enter only from current manufacturer service documentation. Reference the document and revision in the service procedure field.</p>
        <div class="form-grid"><label>Manufacturer<select name="manufacturer">${BME.manufacturers.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select></label>
        <label>Equipment<select name="equipment" id="errEq">${eqOptions()}</select></label><label>Model<select name="model" id="errModel"></select></label>
        <label>Error code<input name="code" required></label><label class="span2">Description<input name="desc" required></label>
        <label>Affected component<select name="component" id="errComp"></select></label><label>Related PM task<input name="pm"></label>
        <label class="span2">Possible causes (one per line)<textarea name="causes" rows="3"></textarea></label><label class="span2">Recommended diagnostic checks (one per line)<textarea name="checks" rows="3"></textarea></label>
        <label class="span2">Service procedure (cite manual + section)<textarea name="service" rows="2"></textarea></label><label class="span2">Verification<input name="verify"></label></div>
        <button class="btn btn-primary">Add error code</button>${cu.errors.length ? ` <span class="muted">${cu.errors.length} custom code(s)</span>` : ''}</form>
      <div class="panel span2"><h3>Data</h3><div class="row gap wrap"><button class="btn" id="exp">⬇ Export all data (JSON)</button><label class="file-btn">⬆ Import JSON<input type="file" accept=".json" id="imp"></label><button class="btn" id="tpl">⬇ Content-pack template</button><button class="btn danger" id="rst">Reset all progress & data</button></div></div>
      </div>`;
    const syncErr = () => {
      const e = BME.ensure(BME.equipment[$('#errEq', el).value]), m = $('[name=manufacturer]', $('#fErr', el)).value;
      $('#errComp', el).innerHTML = Object.entries(e.components).map(([k, c]) => `<option value="${k}">${esc(c.name)}</option>`).join('');
      const ms = BME.models.filter(x => x.equipment === e.id && x.manufacturer === m);
      $('#errModel', el).innerHTML = ms.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('') || '<option value="">(add a model first)</option>';
    };
    $('#errEq', el).onchange = syncErr; $('[name=manufacturer]', $('#fErr', el)).onchange = syncErr; syncErr();
    const fd = f => Object.fromEntries(new FormData(f).entries());
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const done = msg => { Store.save(); toast(msg); setTimeout(() => location.reload(), 600); };
    $('#fUser', el).onsubmit = e => { e.preventDefault(); Store.s.user.name = fd(e.target).name || 'Trainee'; Store.save(); toast('Saved'); };
    $('#fCat', el).onsubmit = e => { e.preventDefault(); const d = fd(e.target); cu.categories.push({ id: 'c-' + slug(d.name), name: d.name, icon: d.icon || '◆', color: d.color }); done('Category added'); };
    $('#fEq', el).onsubmit = e => { e.preventDefault(); const d = fd(e.target); const id = 'x-' + slug(d.name);
      if (BME.equipment[id]) return toast('Equipment already exists');
      cu.equipment.push({ id, name: d.name, category: d.category, difficulty: d.difficulty, hours: +d.hours, parts: d.parts.split('\n').map(s => s.trim()).filter(Boolean), hazards: d.hazard ? [{ label: d.hazard.toUpperCase(), type: 'hv' }] : [] }); done('Equipment added'); };
    $$('[data-deleq]', el).forEach(a => a.onclick = ev => { ev.preventDefault(); if (confirm('Remove custom equipment?')) { cu.equipment = cu.equipment.filter(x => x.id !== a.dataset.deleq); done('Removed'); } });
    $('#fModel', el).onsubmit = e => { e.preventDefault(); const d = fd(e.target); cu.models.push({ id: d.manufacturer + '-' + d.equipment + '-' + slug(d.name), manufacturer: d.manufacturer, equipment: d.equipment, name: d.name }); done('Model added'); };
    $('#fErr', el).onsubmit = e => { e.preventDefault(); const d = fd(e.target); if (!d.model) return toast('Add a model for this manufacturer/equipment first');
      d.causes = d.causes.split('\n').filter(Boolean); d.checks = d.checks.split('\n').filter(Boolean); cu.errors.push(d); done('Error code added'); };
    $('#exp', el).onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' })); a.download = 'bme-academy-data.json'; a.click(); };
    $('#imp', el).onchange = async e => { const f = e.target.files[0]; if (!f) return; try { Store.importJSON(await f.text()); done('Imported'); } catch (x) { toast('Invalid JSON'); } };
    $('#tpl', el).onclick = () => { const a = document.createElement('a'); a.href = 'js/content/ventilator.js'; a.download = 'content-pack-template.js'; a.click(); };
    $('#rst', el).onclick = () => { if (confirm('Erase all progress, records and custom data in this browser?')) { Store.reset(); done('Reset'); } };
  };
})();

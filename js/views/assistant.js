/* Training Assistant — answers only from the platform's own knowledge base and
   always separates: Educational · Manufacturer-specific · Hospital SOP · Regulatory.
   It never generates manufacturer service procedures. To connect a hosted LLM,
   send the same context (equipment pack + matched documents) from a server-side
   endpoint and keep this four-way separation in the system prompt. */
(function () {
  const { esc, $ } = UI;
  const log = () => $('#aiLog');

  function currentEq() {
    const h = location.hash;
    const m = h.match(/#\/(?:eq|service)\/([\w-]+)/) || h.match(/#\/sim\/([\w-]+)/);
    if (m && BME.equipment[m[1]]) return BME.ensure(BME.equipment[m[1]]);
    if (m && BME.scenarios[m[1]]) return BME.ensure(BME.equipment[BME.scenarios[m[1]].equipment]);
    const a = h.match(/#\/asset\/([\w-]+)/); if (a) { const as = Store.s.assets.find(x => x.id === a[1]); if (as) return BME.ensure(BME.equipment[as.equipment]); }
    return null;
  }
  function findEq(q) {
    const words = q.toLowerCase();
    return Object.values(BME.equipment).sort((a, b) => b.name.length - a.name.length).find(e => words.includes(e.name.toLowerCase()) || words.includes(e.id.toLowerCase())) || null;
  }
  function findComp(q, eq) {
    const l = q.toLowerCase(); const pools = eq ? [eq] : Object.values(BME.equipment).filter(e => e.full);
    for (const e of pools) { BME.ensure(e); for (const [k, c] of Object.entries(e.components)) if (l.includes(c.name.toLowerCase().split(' (')[0].split(' / ')[0])) return [e, k, c]; }
    if (eq) return findComp(q, null);
    return null;
  }

  function block(kind, html) {
    const L = { edu: 'Educational information', mfr: 'Manufacturer-specific information', sop: 'Hospital SOP', reg: 'Regulatory requirements' };
    return `<div class="ai-block ai-${kind}"><small>${L[kind]}</small>${html}</div>`;
  }
  const mfrNone = 'Not provided by this assistant. <b>Model-specific procedure required</b> — use the current manufacturer service documentation for the exact model and software version.';
  const sopNone = 'Follow your hospital’s approved SOP (work-order, LOTO, decontamination, release-to-service). Upload SOPs to the Reference Library to link them here.';
  const regNone = 'Acceptance limits and test intervals depend on jurisdiction, standard revision and device class. Use the limits configured from your hospital protocol.';

  async function docsFor(eq, q) {
    try {
      const all = await Files.all('files'); const l = (q || '').toLowerCase();
      const mine = all.filter(d => eq && d.equipment === eq.id);
      const sop = mine.filter(d => d.docType === 'SOP').map(d => d.name);
      const man = mine.filter(d => /manual/i.test(d.docType)).map(d => d.name);
      const textHit = all.filter(d => l.length > 3 && (d.pages || []).some(p => p.toLowerCase().includes(l))).map(d => d.name);
      return { sop, man, textHit };
    } catch (e) { return { sop: [], man: [], textHit: [] }; }
  }

  async function answer(q) {
    const l = q.toLowerCase();
    const eq = findEq(q) || currentEq();
    const docs = await docsFor(eq, '');
    const mfrDocs = docs.man.length ? `Linked manuals for ${esc(eq.name)}: ${docs.man.map(esc).join(', ')}. Read the relevant section before servicing.` : mfrNone;
    const sop = docs.sop.length ? `Linked SOPs: ${docs.sop.map(esc).join(', ')}.` : sopNone;
    const need = () => `<p>Open an equipment module first (or name it, e.g. “ventilator”), so I know which system you mean.</p>`;

    // Error code
    const code = q.match(/\b([A-Z]{2,5}-?[A-Z]?\d{2,5})\b/i);
    if (code || /error code/.test(l)) {
      const c = code && code[1].toUpperCase();
      const all = []; Object.values(BME.equipment).forEach(e => (e.errors || []).forEach(x => all.push([e, x])));
      Store.s.custom.errors.forEach(x => all.push([BME.equipment[x.equipment], x]));
      const hit = c && all.find(([, x]) => x.code.toUpperCase() === c);
      if (hit) {
        const [e, x] = hit; BME.ensure(e);
        return block('edu', `<p><b>${esc(x.code)}</b> — ${esc(x.desc)} (${esc(e.name)})</p><p>Possible causes: ${x.causes.map(esc).join('; ')}</p><p>Diagnostic checks: ${(x.checks || []).map(esc).join(' → ')}</p><p>Verify: ${esc(x.verify)}</p>${/^TRN-/.test(x.code) ? '<p class="muted">TRN- codes are fictional training codes.</p>' : ''}`) +
          block('mfr', x.manufacturer && !/^TRN-/.test(x.code) ? `Entered by your administrator for this model. Service note: ${esc(x.service)}` : mfrNone) + block('sop', sop) + block('reg', regNone);
      }
      return block('edu', `<p>I could not find ${c ? '<b>' + esc(c) + '</b>' : 'that code'} in the training database. Use the <a href="#/errors">Error Code Explorer</a>, or ask your administrator to add model-specific codes from the service manual.</p>`) + block('mfr', mfrNone);
    }

    // Flowchart
    if (/flow ?chart|decision tree/.test(l)) {
      if (!eq || !(eq.troubleshoot || []).length) return block('edu', need() + '<p>Flowcharts are available for equipment with troubleshooting flows.</p>');
      const t = eq.troubleshoot.find(x => l.includes(x.symptom.toLowerCase().split(' ')[1] || '~')) || eq.troubleshoot[0];
      const right = t.first.options.find(o => o.correct);
      const nodes = [['Symptom', t.symptom], ['First test', right.t], ['Measure', t.measure], ['Decision', t.decision], ['Repair', t.repair], ['Verify', t.verify], ['Document', 'Service report, PM/QA record']];
      return block('edu', `<p>Troubleshooting flowchart — ${esc(eq.name)}</p><div class="ai-flow">${nodes.map(([a, b]) => `<div><b>${a}</b><span>${esc(b)}</span></div>`).join('<i>↓</i>')}</div><p class="muted">Causes considered: ${t.causes.map(c => esc(c.cause)).join(', ')}</p>`) + block('mfr', mfrDocs) + block('sop', sop);
    }

    // What to check first
    if (/check first|test first|start|where do i begin|what should i check/.test(l)) {
      if (!eq) return block('edu', need() + '<p>General rule: start with the least invasive check that could explain the symptom — supply, connections, error log, accessories — before opening the unit or replacing boards.</p>');
      const t = (eq.troubleshoot || [])[0];
      return block('edu', `<p>For <b>${esc(eq.name)}</b>${t ? ` with “${esc(t.symptom)}”` : ''}: begin with evidence, not parts.</p>${t ? `<p><b>First:</b> ${esc(t.first.options.find(o => o.correct).t)} — ${esc(t.first.options.find(o => o.correct).why)}</p><p><b>Then measure:</b> ${esc(t.measure)}</p>` : ''}<p>Order: symptom → understand system → possible causes → measure → isolate → repair → verify → document.</p><p><a href="#/service/${eq.id}">Open service mode →</a></p>`) + block('mfr', mfrDocs) + block('sop', sop) + block('reg', regNone);
    }

    // Flow / signal path
    if (/path|how (does|it) work|sequence|signal chain|flow of/.test(l)) {
      if (!eq) return block('edu', need());
      return block('edu', `<p>${esc(eq.name)} sequence:</p><ol>${eq.workflow.map(s => `<li><b>${esc(s.title)}</b> — ${esc(s.what)}</li>`).join('')}</ol><p><a href="#/eq/${eq.id}/how">▶ Open the animated view</a></p>`);
    }

    // Tools
    if (/tool|instrument|analy[sz]er|what do i need/.test(l)) {
      if (!eq) return block('edu', need() + `<p>Common tools: ${Object.values(BME.tools).slice(0, 8).map(t => esc(t.name)).join(', ')}.</p>`);
      return block('edu', `<p>Tools for ${esc(eq.name)}:</p><ul>${(eq.tools || []).map(t => BME.tools[t]).filter(Boolean).map(t => `<li><a href="#/tools/${t.id}">${esc(t.name)}</a> — ${esc(t.purpose)}</li>`).join('')}</ul><p>All test equipment must be within its calibration date.</p>`) + block('sop', sop);
    }

    // PM
    if (/\bpm\b|preventive|maintenance|checklist/.test(l)) {
      if (!eq) return block('edu', need());
      return block('edu', `<p>PM structure for ${esc(eq.name)} (training content):</p>${BME.PM_LEVELS.filter(([k]) => (eq.pm[k] || []).length).map(([k, n]) => `<p><b>${n}:</b> ${eq.pm[k].map(t => esc(t.task)).join(', ')}</p>`).join('')}<p><a href="#/eq/${eq.id}/pm">Open PM with result entry →</a></p>`) + block('mfr', 'Manufacturer PM kits, intervals and part numbers: ' + mfrDocs) + block('sop', sop) + block('reg', regNone);
    }

    // Alarm
    if (/alarm|why is/.test(l)) {
      const pools = eq ? [eq] : Object.values(BME.equipment).filter(e => e.full);
      const kw = l.replace(/why|is|this|alarm|occurring|the|a|on|my/g, ' ').split(/\s+/).filter(w => w.length > 3);
      const hits = [];
      pools.forEach(e => { BME.ensure(e); Object.values(e.components).forEach(c => { const t = (c.symptoms + ' ' + c.failure).toLowerCase(); if (!kw.length ? /alarm/.test(t) : kw.some(w => t.includes(w))) hits.push([e, c]); }); });
      if (hits.length) return block('edu', `<p>Components whose failure produces related alarms:</p><ul>${hits.slice(0, 6).map(([e, c]) => `<li><b>${esc(c.name)}</b> (${esc(e.name)}): ${esc(c.symptoms)} — check: ${esc(c.test)}</li>`).join('')}</ul><p>Read the alarm/error log first and note the exact text and code.</p>`) + block('mfr', mfrDocs) + block('sop', sop);
    }

    // Explain component / PCB
    const comp = findComp(q, eq);
    if (comp || /explain|what is|what does/.test(l)) {
      if (comp) {
        const [e, k, c] = comp;
        return block('edu', `<p><b>${esc(c.name)}</b> (${esc(e.name)})</p><p><b>What it does:</b> ${esc(c.function)}</p><p><b>Principle:</b> ${esc(c.principle)}</p><p><b>Common failure:</b> ${esc(c.failure)}</p><p><b>Engineer check:</b> ${esc(c.test)}</p><p><a href="#/eq/${e.id}/components" onclick="window._openComp='${k}'">Open component →</a></p>`) +
          block('mfr', `Service procedure detail: ${/model-specific/i.test(c.service) ? mfrNone : esc(c.service) + ' <span class="muted">(generic — confirm against the service manual)</span>'}`) + block('sop', sop) + block('reg', regNone);
      }
    }

    // Fallback search
    const res = [];
    Object.values(BME.equipment).forEach(e => { BME.ensure(e); Object.values(e.components).forEach(c => { if ((c.name + ' ' + c.function + ' ' + c.failure).toLowerCase().includes(l.split(' ').filter(w => w.length > 3)[0] || '~~')) res.push(`${esc(c.name)} — ${esc(e.name)}`); }); });
    const txt = (await docsFor(null, q)).textHit;
    return block('edu', `<p>I answer from this platform’s training content. ${res.length ? 'Related: <ul>' + res.slice(0, 6).map(r => `<li>${r}</li>`).join('') + '</ul>' : 'Try: “what should I check first?”, “show me the ventilator flow path”, “explain the flow sensor”, “what tools do I need?”, “give me a PM procedure”, “explain error code TRN-V204”, “create a troubleshooting flowchart”.'}</p>`) +
      (txt.length ? block('mfr', `Your uploaded documents mention this: ${txt.slice(0, 5).map(esc).join(', ')} — <a href="#/documents">search the library</a>.`) : '');
  }

  function push(who, html) { log().insertAdjacentHTML('beforeend', `<div class="ai-msg ${who}">${html}</div>`); log().scrollTop = log().scrollHeight; }
  async function ask(q) {
    open(); push('me', esc(q)); push('bot typing', '…');
    const html = await answer(q);
    log().lastElementChild.remove(); push('bot', html);
  }
  function open() { $('#aiDrawer').classList.add('open'); $('#aiDrawer').setAttribute('aria-hidden', 'false'); }
  function suggest() {
    const s = ['What should I check first?', 'Show me the ventilator flow path', 'Explain the flow sensor', 'What tools do I need?', 'Give me a PM procedure', 'Explain error code TRN-V204', 'Create a troubleshooting flowchart', 'Why is this alarm occurring?'];
    $('#aiSuggest').innerHTML = s.map(x => `<button>${esc(x)}</button>`).join('');
    $('#aiSuggest').onclick = e => { const b = e.target.closest('button'); if (b) ask(b.textContent); };
  }
  document.addEventListener('DOMContentLoaded', () => {
    $('#aiBtn').onclick = () => { $('#aiDrawer').classList.contains('open') ? $('#aiDrawer').classList.remove('open') : open(); };
    $('#aiClose').onclick = () => $('#aiDrawer').classList.remove('open');
    $('#aiForm').onsubmit = e => { e.preventDefault(); const v = $('#aiInput').value.trim(); if (v) { $('#aiInput').value = ''; ask(v); } };
    push('bot', block('edu', '<p>Hi — I answer from this platform’s training content and your uploaded documents, and I keep four kinds of information separate: <b>educational</b>, <b>manufacturer-specific</b>, <b>hospital SOP</b> and <b>regulatory</b>. I never invent manufacturer service procedures.</p>'));
    suggest();
  });
  window.Assistant = { ask, open };
})();

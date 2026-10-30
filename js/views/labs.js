/* Hands-on labs: service mode, fault simulation, service cases, tools lab,
   DICOM/network simulator, image-quality trainer, safety, error explorer, QA hub. */
(function () {
  const { esc, $, $$, toast, hazardBadges, diagram } = UI;
  const V = window.Views = window.Views || {};
  const kv = (k, v) => `<div class="kv"><dt>${k}</dt><dd>${Array.isArray(v) ? '<ul>' + v.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : esc(v || '—')}</dd></div>`;

  /* ================= SERVICE ENGINEER MODE ================= */
  V._serviceFlow = function (root, eq) {
    const flows = eq.troubleshoot || [];
    if (!flows.length) { root.innerHTML = '<div class="empty small">No troubleshooting flows for this equipment yet. Try the <a href="#/cases">service cases</a>.</div>'; return; }
    const STAGES = ['Symptom', 'Possible cause', 'Test', 'Measurement', 'Decision', 'Repair', 'Verification'];
    let f = null, stage = 0, suspect = null, answered = false;
    const render = () => {
      if (!f) {
        root.innerHTML = `<div class="philosophy">${STAGES.map(s => `<span>${s}</span>`).join('<i>→</i>')}</div><h3>Select the reported symptom</h3>
          <div class="section-grid">${flows.map((x, k) => `<button class="section-card" data-f="${k}"><span class="sc-icon">⚠</span><b>${esc(x.symptom)}</b><small>${x.causes.length} possible causes</small></button>`).join('')}</div>`;
        $$('[data-f]', root).forEach(b => b.onclick = () => { f = flows[+b.dataset.f]; stage = 1; suspect = null; answered = false; render(); });
        return;
      }
      const step = (n, inner) => n <= stage ? `<div class="sf-step ${n === stage ? 'cur' : 'done'}"><div class="sf-n">${n + 1}</div><div><h4>${STAGES[n]}</h4>${inner}</div></div>` : '';
      root.innerHTML = `<div class="sf-bar">${STAGES.map((s, k) => `<span class="${k < stage ? 'done' : k === stage ? 'cur' : ''}">${s}</span>`).join('')}</div>
        <div class="sf">
        ${step(0, `<p class="symptom">“${esc(f.symptom)}”</p>`)}
        ${step(1, `<p class="muted">Which cause do you suspect? (You will still test before deciding.)</p><div class="cause-list">${f.causes.map((c, k) => `<button class="cause ${suspect === k ? 'on' : ''}" data-c="${k}"><b>${k + 1}. ${esc(c.cause)}</b>${suspect === k ? `<small>${esc(c.note)}</small>` : ''}</button>`).join('')}</div>`)}
        ${step(2, `<p><b>${esc(f.first.prompt)}</b></p><div class="options">${f.first.options.map((o, k) => `<button class="opt" data-o="${k}" ${answered ? 'disabled' : ''}><b>${'ABCD'[k]}</b> ${esc(o.t)}</button>`).join('')}</div><div id="sfFb"></div>`)}
        ${step(3, `<p>${esc(f.measure)}</p>`)}
        ${step(4, `<p>${esc(f.decision)}</p>`)}
        ${step(5, `<p>${esc(f.repair)}</p>`)}
        ${step(6, `<p>${esc(f.verify)}</p><p class="muted">Then document everything in a service report.</p><div class="row gap"><a class="btn btn-primary" href="#/report/new?eq=${eq.id}">✎ Service report</a><button class="btn" data-restart>Another symptom</button></div>`)}
        </div>
        <div class="row gap">${stage >= 3 && stage < 6 ? '<button class="btn btn-primary" data-next>Next stage →</button>' : ''}<button class="btn" data-back>← Symptoms</button></div>`;
      $$('[data-c]', root).forEach(b => b.onclick = () => { suspect = +b.dataset.c; if (stage < 2) stage = 2; render(); });
      $$('[data-o]', root).forEach(b => b.onclick = () => {
        const o = f.first.options[+b.dataset.o]; answered = true;
        $$('[data-o]', root).forEach(x => { x.disabled = true; if (f.first.options[+x.dataset.o].correct) x.classList.add('right'); });
        if (!o.correct) b.classList.add('wrong');
        const right = f.first.options.find(x => x.correct);
        $('#sfFb', root).innerHTML = `<div class="fb ${o.correct ? 'ok' : 'bad'}"><b>${o.correct ? 'Correct.' : 'Not the best first step.'}</b> ${esc(o.why)}${o.correct ? '' : `<br><b>Better:</b> ${esc(right.t)} — ${esc(right.why)}`}</div><button class="btn btn-primary" data-next>Continue →</button>`;
        const p = Store.eqProgress(eq.id); p.flows = p.flows || {}; p.flows[f.symptom] = o.correct; Store.save();
        $('[data-next]', root).onclick = () => { stage = 3; render(); };
      });
      const nx = $('[data-next]', root); if (nx && stage >= 3) nx.onclick = () => { stage++; render(); };
      const rs = $('[data-restart]', root); if (rs) rs.onclick = () => { f = null; render(); };
      $('[data-back]', root).onclick = () => { f = null; render(); };
      const cur = $('.sf-step.cur', root); if (cur && stage > 1) cur.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    };
    render();
  };

  V.service = function (el, id) {
    const eqs = Object.values(BME.equipment).filter(e => (e.troubleshoot || []).length);
    if (id && BME.equipment[id]) {
      const eq = BME.ensure(BME.equipment[id]);
      App.crumbs([['#/service', 'Service Engineer Mode'], ['', eq.name]]);
      el.innerHTML = `<div class="page-head"><h1>Service mode · ${esc(eq.name)}</h1><div class="haz-row">${hazardBadges(eq.hazards)}</div></div><div id="sfRoot"></div>`;
      V._serviceFlow($('#sfRoot', el), eq); return;
    }
    App.crumbs([['', 'Service Engineer Mode']]);
    el.innerHTML = `<div class="page-head"><h1>Service engineer mode</h1><p>Train the diagnostic habit: <b>symptom → possible cause → test → measurement → decision → repair → verification</b>. Never “replace parts until it works”.</p></div>
      <div class="section-grid">${eqs.map(e => `<a class="section-card" href="#/service/${e.id}"><span class="sc-icon">⚒</span><b>${esc(e.name)}</b><small>${e.troubleshoot.map(t => esc(t.symptom)).join(' · ')}</small></a>`).join('')}</div>`;
  };

  /* ================= FAULT SIMULATION LAB ================= */
  V.simlab = function (el) {
    App.crumbs([['', 'Fault Simulation Lab']]);
    el.innerHTML = `<div class="page-head"><h1>Fault simulation lab</h1><p>Realistic faults. You get the evidence, not the answer. Investigate, diagnose, and get scored on your diagnostic path.</p></div>
      <div class="section-grid">${Object.values(BME.scenarios).map(s => { const r = Store.s.scenarios[s.id]; const e = BME.equipment[s.equipment] || {};
        return `<a class="section-card warn" href="#/sim/${s.id}"><span class="sc-icon">⚠</span><b>${esc(s.title)}</b><small>${esc(e.name || '')} · ${esc(s.fault)}</small><small>${esc(s.difficulty)}${r ? ` · <b>${r.solved ? 'Solved' : 'Attempted'} — ${r.score}</b>` : ''}</small></a>`; }).join('')}</div>`;
  };

  V.scenario = function (el, id) {
    const s = BME.scenarios[id]; if (!s) { el.innerHTML = '<div class="empty">Scenario not found</div>'; return; }
    const eq = BME.ensure(BME.equipment[s.equipment]);
    App.crumbs([['#/simlab', 'Fault Simulation Lab'], ['', s.title]]);
    const done = []; let wrongDx = 0, finished = false;
    const render = () => {
      el.innerHTML = `<div class="page-head"><div class="eyebrow">${esc(s.difficulty)} · ${esc(eq ? eq.name : '')}</div><h1>${esc(s.title)}</h1></div>
      <div class="sim-layout"><div>
        <div class="panel ticket"><div class="ticket-row"><div><small>Machine</small><b>${esc(s.machine)}</b></div><div><small>Fault</small><b class="bad-t">“${esc(s.fault)}”</b></div><div><small>Error code</small><code>${esc(s.errorCode)}</code></div></div>
          <div class="kv-grid">${kv('Symptoms', s.symptoms)}${kv('Recent service history', s.history)}${kv('Temperature', s.temperature)}${kv('Power status', s.power)}</div>
          <h4>Sensor status</h4><div class="sensor-grid">${Object.entries(s.sensors).map(([k, v]) => `<div class="sensor ${/open|low|fail|no |high|irregular|falling/i.test(v) ? 'alert' : ''}"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div></div>
        <div class="panel"><h3>Investigate</h3><div class="check-grid">${Object.entries(s.checks).map(([k, c]) => `<button class="check-btn ${done.includes(k) ? 'done' : ''} ${c.invasive ? 'invasive' : ''}" data-k="${k}" ${finished ? 'disabled' : ''}>${esc(c.label.toUpperCase())}${c.invasive ? '<small>invasive</small>' : ''}</button>`).join('')}</div>
          <div class="findings">${done.map((k, n) => `<div class="finding ${s.checks[k].relevant ? 'rel' : ''}"><i>${n + 1}</i><div><b>${esc(s.checks[k].label)}</b><p>${esc(s.checks[k].finding)}</p></div></div>`).join('') || '<p class="muted">No checks performed yet. Choose where to start — order matters.</p>'}</div></div>
      </div><div>
        <div class="panel sticky"><h3>Your diagnosis</h3>${done.length < 2 && !finished ? '<p class="muted">Gather evidence first (at least 2 checks).</p>' : ''}
          <div class="options">${s.diagnoses.map((d, k) => `<button class="opt" data-d="${k}" ${done.length < 2 || finished ? 'disabled' : ''}>${esc(d.t)}</button>`).join('')}</div><div id="dxFb"></div>
          ${eq && eq.diagram ? `<details><summary>System diagram</summary>${diagram(eq, {})}</details>` : ''}</div>
      </div></div><div id="debrief"></div>`;
      $$('[data-k]', el).forEach(b => b.onclick = () => { if (!done.includes(b.dataset.k)) done.push(b.dataset.k); render(); });
      $$('[data-d]', el).forEach(b => b.onclick = () => {
        const d = s.diagnoses[+b.dataset.d];
        if (!d.correct) { wrongDx++; b.classList.add('wrong'); b.disabled = true; $('#dxFb', el).innerHTML = '<div class="fb bad">The evidence does not support that. Look again at the findings — which check explains the symptom?</div>'; return; }
        finished = true; debrief();
      });
    };
    const debrief = () => {
      const invasiveEarly = done.findIndex(k => s.checks[k].invasive) > -1 && done.findIndex(k => s.checks[k].invasive) < Math.max(...s.essential.map(k => done.indexOf(k)));
      const extra = done.filter(k => !s.checks[k].relevant).length;
      let score = 100 - extra * 5 - wrongDx * 20 - (invasiveEarly ? 15 : 0);
      score = Math.max(10, score);
      Store.s.scenarios[s.id] = { solved: true, score, ts: Date.now() }; Store.save(); App.renderNav();
      render();
      $('#debrief', el).innerHTML = `<div class="panel debrief"><div class="row between wrap"><h2>Debrief</h2><div class="score">${score}<small>/100</small></div></div>
        <div class="kv-grid">${kv('Root cause', s.root)}${kv('Ideal diagnostic path', s.path)}${kv('Your path', done.map(k => s.checks[k].label + (s.checks[k].relevant ? ' ✓' : ' (not needed)')))}${kv('Correct repair', s.repair)}${kv('Verification procedure', s.verify)}${kv('Safety precautions', s.safety)}</div>
        <div class="score-notes">${extra ? `<span class="tag">−${extra * 5} unnecessary checks (${extra})</span>` : ''}${wrongDx ? `<span class="tag tag-bad">−${wrongDx * 20} wrong diagnosis</span>` : ''}${invasiveEarly ? '<span class="tag tag-warn">−15 invasive check before basics</span>' : ''}${!extra && !wrongDx && !invasiveEarly ? '<span class="tag tag-ok">Efficient, evidence-based path</span>' : ''}</div>
        <div class="row gap"><a class="btn btn-primary" href="#/report/new?eq=${s.equipment}&sim=${s.id}">✎ Document as service report</a><a class="btn" href="#/simlab">More simulations</a></div></div>`;
      $('#debrief', el).scrollIntoView({ behavior: 'smooth' });
    };
    render();
  };

  /* ================= SERVICE CASES ================= */
  V.cases = function (el) {
    App.crumbs([['', 'Service Cases']]);
    el.innerHTML = `<div class="page-head"><h1>Service case library</h1><p>Each case is a hospital service call. Read the ticket, investigate, identify the root cause.</p></div>
      <div class="case-grid">${Object.values(BME.cases).map(c => { const e = BME.equipment[c.equipment] || {}; const r = Store.s.cases[c.id];
        return `<a class="case-card pri-${c.priority.toLowerCase()}" href="#/case/${c.id}"><div class="row between"><span class="tag">${esc(c.priority)}</span>${r && r.solved ? '<span class="tag tag-ok">Solved</span>' : ''}</div><b>${esc(c.title)}</b><small>${esc(e.name || '')}</small><p>${esc(c.complaint)}</p></a>`; }).join('')}</div>`;
  };
  V.case = function (el, id) {
    const c = BME.cases[id]; if (!c) { el.innerHTML = '<div class="empty">Case not found</div>'; return; }
    const e = BME.equipment[c.equipment] || { name: '' };
    App.crumbs([['#/cases', 'Service Cases'], ['', c.title]]);
    const opened = []; let solved = false, tries = 0;
    const ticketNo = 'WO-' + (10000 + Math.abs([...id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)) % 89999);
    const render = () => {
      el.innerHTML = `<div class="ticket-sheet"><div class="ticket-top"><div><small>Work order</small><b>${ticketNo}</b></div><div><small>Equipment</small><b>${esc(e.name)}</b></div><div><small>Priority</small><b class="pri">${esc(c.priority)}</b></div><div><small>Status</small><b>${solved ? 'Resolved' : 'Open'}</b></div></div>
        <h1>${esc(c.title)}</h1><blockquote>“${esc(c.complaint)}”</blockquote><p class="muted">${esc(c.context)}</p></div>
        <div class="two-col"><div class="panel"><h3>Investigation</h3><div class="check-list">${c.checks.map(([l], k) => `<button class="check-btn ${opened.includes(k) ? 'done' : ''}" data-k="${k}">${esc(l)}</button>`).join('')}</div>
          <div class="findings">${opened.map(k => `<div class="finding rel"><i>✓</i><div><b>${esc(c.checks[k][0])}</b><p>${esc(c.checks[k][1])}</p></div></div>`).join('')}</div></div>
        <div class="panel"><h3>Root cause</h3><div class="options">${c.causes.map(([t], k) => `<button class="opt" data-c="${k}" ${opened.length < 2 || solved ? 'disabled' : ''}>${esc(t)}</button>`).join('')}</div>${opened.length < 2 ? '<p class="muted">Perform at least two checks first.</p>' : ''}<div id="cfb"></div></div></div>`;
      $$('[data-k]', el).forEach(b => b.onclick = () => { if (!opened.includes(+b.dataset.k)) opened.push(+b.dataset.k); render(); });
      $$('[data-c]', el).forEach(b => b.onclick = () => {
        tries++;
        if (!c.causes[+b.dataset.c][1]) { b.classList.add('wrong'); b.disabled = true; $('#cfb', el).innerHTML = '<div class="fb bad">Not supported by your findings.</div>'; return; }
        solved = true; Store.s.cases[c.id] = { solved: true, score: Math.max(20, 100 - (tries - 1) * 25), ts: Date.now() }; Store.save(); App.renderNav(); render();
        $('#cfb', el).innerHTML = `<div class="fb ok"><b>Resolved.</b></div><div class="kv-grid">${kv('Corrective action', c.fix)}${kv('Verification', c.verify)}${kv('Lesson', c.lesson)}</div><a class="btn btn-primary" href="#/report/new?eq=${c.equipment}&case=${c.id}">✎ Close the work order (service report)</a>`;
      });
    };
    render();
  };

  /* ================= SERVICE TOOLS LAB ================= */
  V.tools = function (el, id) {
    const t = BME.tools[id];
    if (!t) {
      App.crumbs([['', 'Service Tools Lab']]);
      el.innerHTML = `<div class="page-head"><h1>Service tools lab</h1><div class="flow-chain">${['Tool selection', 'Connection', 'Measurement', 'Expected result', 'Interpretation', 'Documentation'].map(x => `<span>${x}</span>`).join('<i>→</i>')}</div></div>
        <div class="panel"><h3>Which tool would you use?</h3><div id="pick"></div></div>
        <div class="section-grid">${Object.values(BME.tools).map(x => `<a class="section-card ${Store.s.tools[x.id] ? 'done' : ''}" href="#/tools/${x.id}"><span class="sc-icon">⚖</span><b>${esc(x.name)}</b><small>${esc(x.purpose)}</small></a>`).join('')}</div>`;
      const tasks = [['Verify delivered defibrillator energy', 'defibAnalyzer'], ['Find why a monitor fails enclosure leakage', 'esa'], ['Check ventilator tidal volume accuracy', 'ventAnalyzer'], ['Check SMPS ripple on a DC rail', 'oscilloscope'], ['Confirm modality can talk DICOM to PACS', 'dicomTools'], ['Measure X-ray kVp accuracy', 'radMeter'], ['Check NIBP static pressure accuracy', 'manometer']];
      const ask = () => {
        const [task, ans] = tasks[Math.floor(Math.random() * tasks.length)];
        const opts = [ans].concat(Object.keys(BME.tools).filter(k => k !== ans).sort(() => Math.random() - .5).slice(0, 3)).sort(() => Math.random() - .5);
        $('#pick', el).innerHTML = `<p><b>Task:</b> ${esc(task)}</p><div class="options">${opts.map(o => `<button class="opt" data-o="${o}">${esc(BME.tools[o].name)}</button>`).join('')}</div><div class="pfb"></div>`;
        $$('[data-o]', el).forEach(b => b.onclick = () => { const ok = b.dataset.o === ans; $$('[data-o]', el).forEach(x => { x.disabled = true; if (x.dataset.o === ans) x.classList.add('right'); }); if (!ok) b.classList.add('wrong');
          $('.pfb', el).innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}">${ok ? 'Correct.' : 'Better choice: ' + esc(BME.tools[ans].name)} — ${esc(BME.tools[ans].purpose)}</div><button class="btn small" id="again">Another task</button>`; $('#again', el).onclick = ask; });
      };
      ask(); return;
    }
    App.crumbs([['#/tools', 'Service Tools Lab'], ['', t.name]]);
    const keys = [['select', 'Tool selection'], ['connect', 'Connection'], ['measure', 'Measurement'], ['expected', 'Expected result'], ['interpret', 'Interpretation'], ['document', 'Documentation']];
    let i = 0;
    const render = () => {
      el.innerHTML = `<div class="page-head"><h1>${esc(t.name)}</h1><p>${esc(t.purpose)}</p></div>
        <div class="stepper">${keys.map(([, l], k) => `<button class="${k === i ? 'on' : k < i ? 'past' : ''}" data-k="${k}"><i>${k + 1}</i>${l}</button>`).join('')}</div>
        <div class="panel stage-card"><div class="eyebrow">Step ${i + 1} of ${keys.length}</div><h2>${keys[i][1]}</h2><p class="lead">${esc(t.steps[keys[i][0]])}</p>
        <div class="row gap">${i ? '<button class="btn" id="pv">← Back</button>' : ''}${i < keys.length - 1 ? '<button class="btn btn-primary" id="nx">Next →</button>' : ''}</div></div>
        ${i === keys.length - 1 ? `<div class="panel"><h3>Check your understanding</h3><div id="tq"></div></div>` : ''}`;
      $$('.stepper button', el).forEach(b => b.onclick = () => { i = +b.dataset.k; render(); });
      const nx = $('#nx', el); if (nx) nx.onclick = () => { i++; render(); };
      const pv = $('#pv', el); if (pv) pv.onclick = () => { i--; render(); };
      if (i === keys.length - 1) UI.quiz($('#tq', el), [Object.assign({ domain: 'technical', why: '' }, t.quiz)], r => { if (r.pct === 100) { Store.s.tools[t.id] = true; Store.save(); } });
    };
    render();
  };

  /* ================= DICOM / NETWORK ================= */
  V.dicom = function (el) {
    App.crumbs([['#/fundamentals', 'Fundamentals'], ['', 'DICOM / Network']]);
    const FAULTS = [
      { id: 'ae', hint: 'Called AE title mismatch', fix: c => c.destAE === 'PACS_MAIN' },
      { id: 'port', hint: 'Port mismatch', fix: c => +c.destPort === 104 },
      { id: 'ip', hint: 'Wrong destination IP', fix: c => c.destIP === '10.20.1.50' },
      { id: 'cable', hint: 'Modality network cable unplugged', fix: () => cableOk },
      { id: 'svc', hint: 'PACS DICOM service stopped', fix: () => pacsUp }
    ];
    const fault = FAULTS[Math.floor(Math.random() * FAULTS.length)];
    let cableOk = fault.id !== 'cable', pacsUp = fault.id !== 'svc';
    const cfg = { aet: 'CT_ROOM1', ip: '10.20.3.21', mask: '255.255.255.0', gw: '10.20.3.1', destAE: fault.id === 'ae' ? 'PACS' : 'PACS_MAIN', destIP: fault.id === 'ip' ? '10.20.1.55' : '10.20.1.50', destPort: fault.id === 'port' ? 4242 : 104 };
    const status = {}; const log = [];
    const net = () => cableOk;
    const ping = () => net() && cfg.destIP === '10.20.1.50';
    const echo = () => ping() && pacsUp && cfg.destAE === 'PACS_MAIN' && +cfg.destPort === 104;
    const CHECKS = [
      ['network', '1. Network link', () => net() ? ['ok', 'Link LED on, 1 Gbps full duplex.'] : ['bad', 'No link LED. Cable not connected at the modality.']],
      ['ip', '2. IP config', () => ['ok', `Modality ${cfg.ip}/${cfg.mask} gw ${cfg.gw} — valid for VLAN 3.`]],
      ['ae', '3. AE title', () => cfg.destAE === 'PACS_MAIN' ? ['ok', `Called AE "${cfg.destAE}" matches PACS.`] : ['bad', `Called AE "${cfg.destAE}" — PACS expects "PACS_MAIN" (ask PACS admin to confirm).`]],
      ['port', '4. Port', () => +cfg.destPort === 104 ? ['ok', 'Port 104 matches PACS listener.'] : ['bad', `Port ${cfg.destPort} — PACS listens on 104.`]],
      ['dest', '5. DICOM destination', () => cfg.destIP === '10.20.1.50' ? ['ok', 'Destination IP 10.20.1.50 correct.'] : ['bad', `Destination IP ${cfg.destIP} — PACS is 10.20.1.50.`]],
      ['ping', '6. Ping', () => ping() ? ['ok', 'Reply from 10.20.1.50: time=1 ms'] : ['bad', 'Request timed out.']],
      ['echo', '7. DICOM verification (C-ECHO)', () => echo() ? ['ok', 'C-ECHO success — association accepted.'] : ['bad', ping() ? 'Association rejected / no response.' : 'Cannot reach host.']],
      ['pacs', '8. PACS status', () => pacsUp ? ['ok', 'PACS DICOM service running.'] : ['bad', 'PACS DICOM listener service is STOPPED (PACS admin to restart).']]
    ];
    const render = () => {
      const n = id => status[id] ? ' st-' + status[id] : '';
      el.innerHTML = `<div class="page-head"><h1>DICOM / network training</h1><div class="flow-chain">${['Modality', 'DICOM', 'AE Title', 'IP Address', 'Port', 'PACS', 'RIS', 'Worklist'].map(x => `<span>${x}</span>`).join('<i>→</i>')}</div></div>
        <div class="warn-banner">Service call: <b>“No images reaching PACS from CT Room 1.”</b> Work through the checks, find the fault, and fix the configuration.</div>
        <div class="two-col wide-left"><div class="panel"><svg class="netdia" viewBox="0 0 760 330">
          <g class="nd${n('network')}"><rect x="20" y="130" width="150" height="70" rx="10"/><text x="95" y="160">CT Modality</text><text x="95" y="180" class="sm">${esc(cfg.aet)} · ${esc(cfg.ip)}</text></g>
          <line class="nl ${cableOk ? '' : 'cut'}" x1="170" y1="165" x2="290" y2="165"/>
          <g class="nd"><rect x="290" y="135" width="120" height="60" rx="10"/><text x="350" y="170">Switch / VLAN</text></g>
          <line class="nl" x1="410" y1="165" x2="540" y2="70"/><line class="nl" x1="410" y1="165" x2="540" y2="165"/><line class="nl" x1="410" y1="165" x2="540" y2="260"/>
          <g class="nd${n('pacs')}${n('echo') && status.echo === 'ok' ? ' st-ok' : ''}"><rect x="540" y="40" width="190" height="64" rx="10"/><text x="635" y="68">PACS</text><text x="635" y="88" class="sm">PACS_MAIN · 10.20.1.50:104</text></g>
          <g class="nd"><rect x="540" y="135" width="190" height="60" rx="10"/><text x="635" y="162">RIS</text><text x="635" y="180" class="sm">orders / reports</text></g>
          <g class="nd"><rect x="540" y="228" width="190" height="64" rx="10"/><text x="635" y="256">Modality Worklist (MWL)</text><text x="635" y="275" class="sm">C-FIND</text></g>
          ${echo() && status.echo === 'ok' ? '<circle class="packet" r="7"><animateMotion dur="1.6s" repeatCount="indefinite" path="M170 165 L410 165 L540 72"/></circle>' : ''}
        </svg>
        <div class="check-grid">${CHECKS.map(([id, l]) => `<button class="check-btn st-${status[id] || ''}" data-c="${id}">${l}</button>`).join('')}</div>
        <div class="console">${log.slice(-8).map(x => `<div class="${x[0]}">&gt; ${esc(x[1])}</div>`).join('') || '<div class="muted">&gt; ready</div>'}</div></div>
        <div class="panel"><h3>Modality DICOM configuration</h3>
          <label>Calling AE title (this modality)<input data-k="aet" value="${esc(cfg.aet)}"></label>
          <label>Destination (called) AE title<input data-k="destAE" value="${esc(cfg.destAE)}"></label>
          <label>Destination IP<input data-k="destIP" value="${esc(cfg.destIP)}"></label>
          <label>Destination port<input data-k="destPort" type="number" value="${esc(cfg.destPort)}"></label>
          <div class="row gap wrap">${!cableOk ? '<button class="btn" id="plug">Reconnect cable</button>' : ''}${!pacsUp ? '<button class="btn" id="svc">Ask PACS admin to restart service</button>' : ''}</div>
          <p class="muted small">AE titles are case-sensitive. Changes on clinical systems are agreed with the PACS administrator and documented.</p>
          <button class="btn" id="newF">New fault</button></div></div>`;
      $$('[data-c]', el).forEach(b => b.onclick = () => { const [st, msg] = CHECKS.find(c => c[0] === b.dataset.c)[2](); status[b.dataset.c] = st; log.push([st, msg]);
        if (b.dataset.c === 'echo' && st === 'ok') { log.push(['ok', 'Test study sent — received by PACS. Fault resolved.']); Store.s.cases['dicom-lab'] = { solved: true, score: 100, ts: Date.now() }; Store.save(); toast('Solved: ' + fault.hint); }
        render(); });
      $$('[data-k]', el).forEach(i => i.onchange = () => { cfg[i.dataset.k] = i.value.trim(); delete status.echo; delete status.ping; log.push(['', `Config: ${i.dataset.k} = ${i.value.trim()}`]); render(); });
      const pl = $('#plug', el); if (pl) pl.onclick = () => { cableOk = true; log.push(['ok', 'Cable reconnected. Link up.']); delete status.network; render(); };
      const sv = $('#svc', el); if (sv) sv.onclick = () => { if (status.pacs !== 'bad') return toast('Check PACS status first — prove the fault before asking others to act'); pacsUp = true; log.push(['ok', 'PACS admin restarted DICOM service.']); delete status.pacs; render(); };
      $('#newF', el).onclick = () => V.dicom(el);
    };
    render();
  };

  /* ================= IMAGE QUALITY (procedural images) ================= */
  const imgCache = {};
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  function renderImage(modality, artifact, size) {
    const W = size, H = size, c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'), r = rng(42 + (artifact || '').length * 7);
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    const g = (v, a) => `rgba(${v},${v},${v},${a == null ? 1 : a})`;
    const ell = (cx, cy, rx, ry, col) => { x.fillStyle = col; x.beginPath(); x.ellipse(cx * W, cy * H, rx * W, ry * H, 0, 0, Math.PI * 2); x.fill(); };
    const drawBase = () => {
      if (modality === 'ct') { ell(.5, .52, .4, .32, g(105)); ell(.5, .52, .37, .29, g(120)); ell(.38, .48, .1, .12, g(135)); ell(.62, .48, .1, .12, g(140)); ell(.5, .74, .06, .05, g(235)); ell(.5, .45, .05, .05, g(160)); }
      if (modality === 'mri') { ell(.5, .5, .36, .42, g(90)); ell(.5, .5, .33, .39, g(170)); ell(.5, .5, .27, .33, g(125)); ell(.44, .48, .04, .1, g(25)); ell(.56, .48, .04, .1, g(25)); }
      if (modality === 'dr') { x.fillStyle = g(200); x.fillRect(.1 * W, .05 * H, .8 * W, .9 * H); ell(.33, .5, .15, .3, g(60)); ell(.67, .5, .15, .3, g(60)); x.fillStyle = g(215); x.fillRect(.45 * W, .1 * H, .1 * W, .8 * H);
        x.strokeStyle = g(185); x.lineWidth = 4; for (let k = 0; k < 7; k++) { x.beginPath(); x.ellipse(.5 * W, (.22 + k * .09) * H, .36 * W, .05 * H, 0, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); } }
      if (modality === 'us') { x.fillStyle = g(70); x.beginPath(); x.moveTo(.42 * W, .04 * H); x.lineTo(.58 * W, .04 * H); x.lineTo(.95 * W, .95 * H); x.lineTo(.05 * W, .95 * H); x.closePath(); x.fill(); ell(.5, .55, .1, .07, g(10)); }
    };
    drawBase();
    // speckle / noise
    const id = x.getImageData(0, 0, W, H), d = id.data;
    const noiseAmt = modality === 'us' ? 60 : artifact === 'ct-noise' ? 70 : artifact === 'dr-exposure' ? 55 : 10;
    for (let p = 0; p < d.length; p += 4) { if (d[p] === 0 && modality !== 'dr') continue; const n = (r() - .5) * noiseAmt; d[p] = d[p + 1] = d[p + 2] = Math.max(0, Math.min(255, d[p] + n)); }
    x.putImageData(id, 0, 0);
    const a = artifact;
    if (a === 'ct-ring') { x.strokeStyle = g(200, .35); for (let k = 1; k <= 4; k++) { x.lineWidth = 1.5; x.beginPath(); x.arc(.5 * W, .52 * H, k * .07 * W, 0, Math.PI * 2); x.stroke(); } }
    if (a === 'ct-motion' || a === 'mri-motion') { x.globalAlpha = .35; x.drawImage(c, W * .025, 0); x.drawImage(c, -W * .02, H * .01); x.globalAlpha = 1; x.strokeStyle = g(255, .15); for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(0, (.2 + k * .12) * H); x.lineTo(W, (.25 + k * .1) * H); x.stroke(); } }
    if (a === 'ct-beamhard') { ell(.4, .6, .03, .03, g(255)); ell(.6, .6, .03, .03, g(255)); x.fillStyle = g(20, .7); x.fillRect(.43 * W, .585 * H, .14 * W, .03 * H); x.strokeStyle = g(255, .35); for (let k = 0; k < 10; k++) { const an = k / 10 * Math.PI; x.beginPath(); x.moveTo(.5 * W - Math.cos(an) * W * .4, .6 * H - Math.sin(an) * H * .3); x.lineTo(.5 * W + Math.cos(an) * W * .4, .6 * H + Math.sin(an) * H * .3); x.stroke(); } }
    if (a === 'mri-ghost') { x.globalAlpha = .22; x.drawImage(c, 0, -H * .28); x.drawImage(c, 0, H * .28); x.globalAlpha = 1; }
    if (a === 'mri-suscept') { ell(.62, .45, .09, .07, g(0)); x.strokeStyle = g(255, .9); x.lineWidth = 3; x.beginPath(); x.ellipse(.62 * W, .45 * H, .1 * W, .08 * H, .3, 0, Math.PI * 1.3); x.stroke(); }
    if (a === 'mri-rf') { for (let yy = 0; yy < H; yy += 3) { x.fillStyle = g(r() > .5 ? 255 : 30); x.fillRect(.3 * W - 2, yy, 4, 2); } }
    if (a === 'dr-detector') { x.fillStyle = g(255); x.fillRect(.7 * W, 0, 2, H); x.fillStyle = g(0); x.fillRect(.72 * W, 0, 2, H); for (let k = 0; k < 30; k++) { x.fillRect((.65 + r() * .1) * W, (.45 + r() * .1) * H, 2, 2); } }
    if (a === 'dr-exposure') { x.fillStyle = g(0, .45); x.fillRect(0, 0, W, H); }
    if (a === 'dr-grid') { x.fillStyle = g(0, .22); for (let xx = 0; xx < W; xx += 4) x.fillRect(xx, 0, 1.5, H); }
    if (a === 'dr-processing') { x.strokeStyle = g(0, .8); x.lineWidth = 6; x.strokeRect(.44 * W, .1 * H, .12 * W, .8 * H); x.strokeStyle = g(255, .6); x.lineWidth = 3; x.strokeRect(.425 * W, .09 * H, .15 * W, .82 * H); }
    if (a === 'us-dead') { x.fillStyle = g(0, .85); x.beginPath(); x.moveTo(.47 * W, .04 * H); x.lineTo(.49 * W, .04 * H); x.lineTo(.42 * W, .95 * H); x.lineTo(.35 * W, .95 * H); x.closePath(); x.fill(); }
    if (a === 'us-dropout') { ell(.62, .5, .04, .02, g(255)); x.fillStyle = g(0, .8); x.beginPath(); x.moveTo(.58 * W, .5 * H); x.lineTo(.66 * W, .5 * H); x.lineTo(.72 * W, .95 * H); x.lineTo(.6 * W, .95 * H); x.closePath(); x.fill(); }
    if (a === 'us-reverb') { x.fillStyle = g(240, .8); for (let k = 0; k < 5; k++) x.fillRect(.4 * W, (.15 + k * .06) * H, .2 * W, 2.5); }
    if (a === 'us-probe') { x.fillStyle = g(0, .9); x.fillRect(.45 * W, .04 * H, .1 * W, .14 * H); }
    if (modality === 'us') { x.fillStyle = '#4da3ff'; x.font = `${Math.round(W / 26)}px monospace`; x.fillText('L12 · 7.5 MHz', 8, H - 8); }
    if (modality === 'ct' || modality === 'mri') { x.fillStyle = '#9ab'; x.font = `${Math.round(W / 26)}px monospace`; x.fillText(modality === 'ct' ? 'WL 40 / WW 400' : 'T2 TSE AX', 8, 18); }
    return c;
  }
  V._artifactImg = (id, size) => {
    const k = id + ':' + (size || 300); if (imgCache[k]) return imgCache[k];
    const a = BME.artifacts[id]; return (imgCache[k] = renderImage(a.modality, a.id, size || 300).toDataURL());
  };
  const MOD = { ct: 'CT', mri: 'MRI', dr: 'X-Ray / DR', us: 'Ultrasound' };
  V.imageQuality = function (el) {
    App.crumbs([['#/fundamentals', 'Fundamentals'], ['', 'Image Quality']]);
    let mod = 'ct', mode = 'compare', sel = null, quizState = null;
    const render = () => {
      const arts = Object.values(BME.artifacts).filter(a => a.modality === mod);
      sel = sel && sel.modality === mod ? sel : arts[0];
      el.innerHTML = `<div class="page-head"><h1>Image quality training</h1><p>Normal image vs artifact vs equipment fault. Simulated teaching images — not clinical images.</p></div>
        <div class="row between wrap"><div class="chips">${Object.entries(MOD).map(([k, l]) => `<button class="chip ${k === mod ? 'on' : ''}" data-m="${k}">${l}</button>`).join('')}</div>
        <div class="chips"><button class="chip ${mode === 'compare' ? 'on' : ''}" data-mode="compare">Compare</button><button class="chip ${mode === 'identify' ? 'on' : ''}" data-mode="identify">Identify (exercise)</button></div></div>
        <div id="iq"></div>`;
      $$('[data-m]', el).forEach(b => b.onclick = () => { mod = b.dataset.m; quizState = null; render(); });
      $$('[data-mode]', el).forEach(b => b.onclick = () => { mode = b.dataset.mode; quizState = null; render(); });
      const box = $('#iq', el);
      if (mode === 'compare') {
        box.innerHTML = `<div class="chips">${arts.map(a => `<button class="chip ${a === sel ? 'on' : ''}" data-a="${a.id}">${esc(a.name)}</button>`).join('')}</div>
          <div class="iq-compare"><figure><img src="${renderImage(mod, null, 320).toDataURL()}" alt="normal"><figcaption>Normal</figcaption></figure>
          <figure><img src="${V._artifactImg(sel.id, 320)}" alt="${esc(sel.name)}"><figcaption>${esc(sel.name)} <span class="tag ${/fault/i.test(sel.kind) ? 'tag-bad' : ''}">${esc(sel.kind)}</span></figcaption></figure>
          <div class="panel">${kv('Possible cause', sel.cause)}${kv('Component involved', sel.component)}${kv('Corrective action', sel.action)}</div></div>`;
        $$('[data-a]', box).forEach(b => b.onclick = () => { sel = BME.artifacts[b.dataset.a]; render(); });
      } else {
        if (!quizState) quizState = { a: arts[Math.floor(Math.random() * arts.length)], click: null, step: 0, score: 0 };
        const q = quizState, a = q.a;
        const pick = (title, key, correct, pool) => { const opts = [correct].concat(pool.filter(v => v !== correct).sort(() => Math.random() - .5).slice(0, 3)).sort(() => Math.random() - .5); return { title, key, correct, opts }; };
        q.qs = q.qs || [pick('Artifact', 'name', a.name, arts.map(x => x.name)), pick('Possible cause', 'cause', a.cause, Object.values(BME.artifacts).map(x => x.cause)), pick('Component involved', 'component', a.component, Object.values(BME.artifacts).map(x => x.component)), pick('Corrective action', 'action', a.action, Object.values(BME.artifacts).map(x => x.action))];
        const cur = q.qs[q.step];
        box.innerHTML = `<div class="two-col"><div class="panel"><p class="muted">${q.click ? 'Marked.' : 'Step 1 — click the image where you see the problem.'}</p><div class="iq-click"><img src="${V._artifactImg(a.id, 380)}" alt="exercise">${q.click ? `<span class="mark ${q.hit ? 'ok' : 'bad'}" style="left:${q.click[0] * 100}%;top:${q.click[1] * 100}%"></span>` : ''}</div></div>
          <div class="panel">${q.click ? (cur ? `<h3>${q.step + 2}. ${esc(cur.title)}?</h3><div class="options">${cur.opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o)}</button>`).join('')}</div><div class="ifb"></div>` :
            `<h2>Score ${q.score + (q.hit ? 1 : 0)} / 5</h2>${kv('Answer', a.name + ' — ' + a.kind)}${kv('Cause', a.cause)}${kv('Component', a.component)}${kv('Action', a.action)}<button class="btn btn-primary" id="nextImg">Next image</button>`) : '<p class="muted">Locate the artifact first.</p>'}</div></div>`;
        const img = $('.iq-click', box);
        if (!q.click) img.onclick = e => { const r = img.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height; q.click = [px, py]; q.hit = Math.hypot(px - a.region.x, py - a.region.y) <= a.region.r + .08; render(); };
        $$('[data-k]', box).forEach(b => b.onclick = () => { const ok = cur.opts[+b.dataset.k] === cur.correct; if (ok) q.score++;
          $$('[data-k]', box).forEach(x => { x.disabled = true; if (cur.opts[+x.dataset.k] === cur.correct) x.classList.add('right'); }); if (!ok) b.classList.add('wrong');
          $('.ifb', box).innerHTML = `<button class="btn btn-primary">Next →</button>`; $('.ifb button', box).onclick = () => { q.step++; if (q.step >= 4) { Store.s.artifacts[a.id] = q.score + (q.hit ? 1 : 0); Store.save(); } render(); }; });
        const ni = $('#nextImg', box); if (ni) ni.onclick = () => { quizState = null; render(); };
      }
    };
    render();
  };

  /* ================= ELECTRICAL & SAFETY ================= */
  V.safety = function (el, id) {
    const t = BME.safetyTopics.find(x => x.id === id);
    if (!t) {
      App.crumbs([['', 'Electrical & Safety']]);
      const maps = [['ct', 'HIGH VOLTAGE AREA'], ['mri', 'MAGNETIC FIELD / PROJECTILE RISK'], ['xray', 'HIGH VOLTAGE + RADIATION'], ['ventilator', 'PATIENT SAFETY CRITICAL']];
      el.innerHTML = `<div class="page-head"><h1>Electrical & safety training</h1><p>${Object.keys(Store.s.safety).length} / ${BME.safetyTopics.length} modules complete.</p></div>
        <h2 class="section-h">Danger-area maps</h2><div class="hazard-maps">${maps.map(([e, l]) => { const eq = BME.ensure(BME.equipment[e]); if (!eq || !eq.diagram) return ''; return `<a class="hazard-map" href="#/eq/${e}/safety"><div class="hm-label">${esc(l)}</div>${diagram(eq, { active: (eq.diagram.zones || []).length ? [] : [], dim: false })}<b>${esc(eq.name)}</b></a>`; }).join('')}</div>
        <h2 class="section-h">Modules</h2><div class="section-grid">${BME.safetyTopics.map(x => `<a class="section-card ${Store.s.safety[x.id] ? 'done' : ''} haz-card-${x.type}" href="#/safety/${x.id}"><span class="sc-icon">${UI.HAZ[x.type] || '⚠'}</span><b>${esc(x.name)}</b><small>${Store.s.safety[x.id] ? '✓ Complete' : x.sim ? 'Interactive simulator' : 'Module'}</small></a>`).join('')}</div>`;
      return;
    }
    App.crumbs([['#/safety', 'Electrical & Safety'], ['', t.name]]);
    el.innerHTML = `<div class="page-head"><h1>${UI.HAZ[t.type] || '⚠'} ${esc(t.name)}</h1></div>
      <div class="two-col"><div class="panel safety-item lvl-${t.type === 'patient' ? 'warning' : 'danger'}"><ul class="big-list">${t.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <div class="panel"><h3>Check</h3><div id="sq"></div></div></div>${['leakage', 'ground', 'elec', 'earthing'].includes(t.id) ? '<div class="panel" id="leak"></div>' : ''}`;
    UI.quiz($('#sq', el), [Object.assign({ domain: 'safety', why: t.points[0] }, t.q)], r => {
      Store.s.safety[t.id] = r.pct === 100; if (!r.pct) delete Store.s.safety[t.id];
      const k = 'safety'; const q = Store.s.quiz[k] || { pct: 0, domains: { safety: [0, 0] }, score: 0, total: 0, band: '' };
      q.domains.safety[0] += r.score; q.domains.safety[1] += r.total; q.score += r.score; q.total += r.total; q.pct = Math.round(q.score / q.total * 100); q.band = q.pct >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT';
      Store.recordQuiz(k, q);
    });
    if ($('#leak', el)) leakageSim($('#leak', el));
  };
  function leakageSim(box) {
    const st = { pe: 0.1, ins: 100, earthOpen: false, polarity: false };
    const L = Store.limit('safety', 'enclosure');
    const render = () => {
      // Simple teaching model: leakage via Y-capacitors/insulation, diverted by earth unless open.
      const base = 230 / (st.ins * 1000) * 1e6 / 1000 + 60; // µA
      const enclosure = st.earthOpen ? base * (st.polarity ? 1.3 : 1) : base * st.pe / (st.pe + 1000) * 10;
      const ok = L ? enclosure <= +L.tol : null;
      box.innerHTML = `<h3>Leakage current simulator <small class="muted">(teaching model, not a measurement)</small></h3>
        <div class="two-col"><div><label>Protective-earth resistance: <b>${st.pe.toFixed(2)} Ω</b><input type="range" min="0.01" max="5" step="0.01" value="${st.pe}" data-k="pe"></label>
          <label>Insulation resistance: <b>${st.ins} MΩ</b><input type="range" min="0.2" max="200" step="0.1" value="${st.ins}" data-k="ins"></label>
          <label class="switch"><input type="checkbox" data-k="earthOpen" ${st.earthOpen ? 'checked' : ''}><span></span> Single fault: open earth</label>
          <label class="switch"><input type="checkbox" data-k="polarity" ${st.polarity ? 'checked' : ''}><span></span> Reversed mains polarity</label></div>
        <div><svg viewBox="0 0 320 180" class="leak-svg"><rect x="20" y="30" width="120" height="90" rx="8" class="dev"/><text x="80" y="80" text-anchor="middle">Device</text>
          <line x1="80" y1="120" x2="80" y2="165" class="${st.earthOpen ? 'cut' : 'earth'}"/><text x="92" y="160">PE</text>
          <line x1="140" y1="75" x2="230" y2="75" class="${st.earthOpen ? 'flow' : 'weak'}"/><circle cx="250" cy="55" r="12" class="person"/><line x1="250" y1="67" x2="250" y2="130" class="person"/><line x1="250" y1="130" x2="250" y2="165" class="${st.earthOpen ? 'flow' : 'weak'}"/></svg>
          <div class="leak-read"><small>Enclosure (touch) leakage</small><b class="${ok === false ? 'bad-t' : ok ? 'ok-t' : ''}">${enclosure.toFixed(0)} µA</b><small>${L ? `Limit ${esc(L.tol)} µA (${esc(L.source)}) → ${ok ? 'PASS' : 'FAIL'}` : '<button class="btn small" id="setL">Set protocol limit</button>'}</small></div></div></div>
        <p class="muted">With the earth intact, most leakage returns through PE. Open the earth and the current path is through the person — this is why single-fault testing matters.</p>`;
      $$('[data-k]', box).forEach(i => i.oninput = () => { st[i.dataset.k] = i.type === 'checkbox' ? i.checked : +i.value; render(); });
      const s = $('#setL', box); if (s) s.onclick = () => { const v = prompt('Enclosure leakage limit (µA) from your hospital protocol:'); if (!v) return; const src = prompt('Source (protocol / standard + revision):') || ''; Store.setLimit('safety', 'enclosure', { mode: 'abs', tol: v, source: src }); leakageSim(box); };
    };
    render();
  }

  /* ================= ERROR CODE EXPLORER ================= */
  V.errors = function (el) {
    App.crumbs([['', 'Error Code Explorer']]);
    const all = [];
    Object.values(BME.equipment).forEach(e => (e.errors || []).forEach(er => all.push(Object.assign({ manufacturer: 'Generic (training)', model: '—', equipment: e.id }, er))));
    Store.s.custom.errors.forEach(er => all.push(Object.assign({}, er, { manufacturer: (BME.manufacturers.find(m => m.id === er.manufacturer) || {}).name || er.manufacturer, model: (BME.models.find(m => m.id === er.model) || {}).name || er.model })));
    const mans = [...new Set(all.map(a => a.manufacturer))], eqs = [...new Set(all.map(a => a.equipment))];
    el.innerHTML = `<div class="page-head"><h1>Error code explorer</h1><div class="flow-chain"><span>Manufacturer</span><i>→</i><span>Equipment</span><i>→</i><span>Model</span><i>→</i><span>Error code</span></div></div>
      <div class="warn-banner">⚠ ${UI.DISCLAIMER} Built-in codes (TRN-*) are fictional training codes. Add real model codes from your service documentation in Admin.</div>
      <div class="filters"><select id="em"><option value="">All manufacturers</option>${mans.map(m => `<option>${esc(m)}</option>`).join('')}</select>
        <select id="ee"><option value="">All equipment</option>${eqs.map(e => `<option value="${e}">${esc((BME.equipment[e] || {}).name || e)}</option>`).join('')}</select>
        <select id="emo"><option value="">All models</option></select><input id="eq" type="search" placeholder="Error code or text…"></div>
      <div id="elist"></div>`;
    const apply = () => {
      const m = $('#em').value, e = $('#ee').value, mo = $('#emo').value, q = $('#eq').value.toLowerCase();
      const models = [...new Set(all.filter(a => (!m || a.manufacturer === m) && (!e || a.equipment === e)).map(a => a.model))];
      const cur = $('#emo').value; $('#emo').innerHTML = '<option value="">All models</option>' + models.map(x => `<option ${x === cur ? 'selected' : ''}>${esc(x)}</option>`).join('');
      const res = all.filter(a => (!m || a.manufacturer === m) && (!e || a.equipment === e) && (!mo || a.model === mo) && (!q || (a.code + ' ' + a.desc + ' ' + (a.causes || []).join(' ')).toLowerCase().includes(q)));
      $('#elist').innerHTML = res.map(a => V._errorCard(a, BME.ensure(BME.equipment[a.equipment]))).join('') || '<div class="empty small">No matching codes.</div>';
      $$('[data-comp]', $('#elist')).forEach(x => x.onclick = ev => { ev.preventDefault(); const card = x.closest('.err-card'); const r = res[$$('.err-card', $('#elist')).indexOf(card)]; V._openComp(BME.equipment[r.equipment], x.dataset.comp); });
    };
    ['#em', '#ee', '#emo', '#eq'].forEach(s => $(s).addEventListener('input', apply)); apply();
  };

  /* ================= QA HUB ================= */
  V.qaHub = function (el) {
    App.crumbs([['', 'QA & Performance Testing']]);
    const list = [['xray', 'X-Ray QA'], ['ct', 'CT QA'], ['mri', 'MRI QA'], ['ultrasound', 'Ultrasound QA'], ['mammo', 'Mammography QA'], ['cathlab', 'Cath Lab QA'], ['carm', 'C-Arm QA'], ['ventilator', 'Ventilator performance testing'], ['patientMonitor', 'Patient monitor testing'], ['defibrillator', 'Defibrillator testing'], ['infusionPump', 'Infusion pump testing']];
    const recs = Store.s.qaRecords;
    el.innerHTML = `<div class="page-head"><h1>QA & performance testing</h1><div class="flow-chain">${['Test', 'Equipment setup', 'Measurement', 'Acceptance limit', 'Result', 'Pass / Fail', 'Report'].map(x => `<span>${x}</span>`).join('<i>→</i>')}</div></div>
      <div class="info-banner">Acceptance criteria are configurable per test and must reference the hospital’s approved protocol, manufacturer documentation and the applicable standard revision. Nothing regulatory is hard-coded.</div>
      <div class="section-grid">${list.map(([id, l]) => { const e = BME.equipment[id]; const n = e && e.qa ? e.qa.length : 0; return `<a class="section-card" href="#/eq/${id}/qa"><span class="sc-icon">◎</span><b>${l}</b><small>${n ? n + ' tests' : 'Protocol to be defined — model-specific'}</small></a>`; }).join('')}</div>
      <div class="panel"><div class="row between"><h3>QA records (${recs.length})</h3>${recs.length ? '<button class="btn small" onclick="window.print()">Print report</button>' : ''}</div>
      <table class="table"><thead><tr><th>Date</th><th>Equipment</th><th>Test</th><th>Points (set → measured)</th><th>Limit</th><th>Result</th></tr></thead><tbody>
      ${recs.map(r => `<tr><td>${UI.fmtDate(r.ts)}</td><td>${esc((BME.equipment[r.equipment] || {}).name)}</td><td>${esc(r.test)}</td><td>${r.points.map(p => esc(p[0] + ' → ' + p[1])).join('<br>') || '—'}</td><td>${r.limit ? esc((r.limit.tol ? '± ' + r.limit.tol + (r.limit.mode === 'pct' ? '%' : '') : 'checklist') + ' · ' + r.limit.source) : '<span class="tag tag-warn">none</span>'}</td><td><span class="tag ${r.result === 'PASS' ? 'tag-ok' : r.result === 'FAIL' ? 'tag-bad' : 'tag-warn'}">${esc(r.result)}</span></td></tr>`).join('') || '<tr><td colspan="6" class="muted">No QA results recorded yet.</td></tr>'}</tbody></table></div>`;
  };

  /* ================= FUNDAMENTALS ================= */
  V.fundamentals = function (el) {
    App.crumbs([['', 'Medical Equipment Fundamentals']]);
    const cards = [['#/tools', '⚖', 'Service Tools Lab', 'Analyzers, simulators, meters'], ['#/dicom', '⇄', 'DICOM / Network', 'Modality → PACS troubleshooting'], ['#/image-quality', '◐', 'Image Quality', 'Normal vs artifact vs fault'], ['#/safety', '⚡', 'Electrical & Safety', 'Leakage, LOTO, radiation, MRI'], ['#/levels', '▤', 'Training Levels', 'Beginner → Senior Engineer'], ['#/service', '⚒', 'Diagnostic Thinking', 'Symptom → verify → document']];
    el.innerHTML = `<div class="page-head"><h1>Medical equipment fundamentals</h1></div>
      <div class="philosophy big">${['Symptom', 'Understand system', 'Identify possible causes', 'Measure', 'Isolate', 'Repair', 'Verify', 'Document'].map(x => `<span>${x}</span>`).join('<i>↓</i>')}</div>
      <div class="section-grid">${cards.map(([h, i, t, d]) => `<a class="section-card" href="${h}"><span class="sc-icon">${i}</span><b>${t}</b><small>${d}</small></a>`).join('')}</div>`;
  };
})();

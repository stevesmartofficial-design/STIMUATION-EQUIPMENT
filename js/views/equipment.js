/* Equipment explorer: one page per equipment with 14 tabs the learner can move
   between without leaving the equipment. */
(function () {
  const { esc, $, $$, diagram, hazardBadges, toast, modal, quiz, uid } = UI;
  const V = window.Views = window.Views || {};

  const list = a => (a && a.length ? '<ul>' + a.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '<span class="muted">—</span>');
  const field = (k, v) => `<div class="kv"><dt>${k}</dt><dd>${Array.isArray(v) ? list(v) : esc(v || '—')}</dd></div>`;

  V.equipment = function (el, id, tab) {
    const eq = BME.ensure(BME.equipment[id]);
    if (!eq) { el.innerHTML = '<div class="empty"><h2>Equipment not found</h2></div>'; return; }
    tab = tab || 'overview';
    const lvl = Store.level();
    const tdef = BME.TABS.find(t => t[0] === tab) || BME.TABS[0];
    const cat = BME.categories.find(c => c.id === eq.category) || {};
    App.crumbs([['#/library', 'Equipment'], ['#/library/' + eq.category, cat.name || ''], ['#/eq/' + id, eq.name], ['', tdef[1]]]);
    const locked = tdef[2] > lvl;
    if (!locked) Store.touch(id, tab);
    const seen = Store.eqProgress(id).tabs;

    el.innerHTML = `<div class="eq-head">
        <div><div class="eyebrow">${esc(cat.icon || '')} ${esc(cat.name || '')} · ${esc(eq.difficulty || '')} · ${eq.hours || '—'} h</div>
        <h1>${esc(eq.name)}</h1><div class="haz-row">${hazardBadges(eq.hazards)}</div></div>
        <div class="eq-head-right">${UI.ring(Store.percent(id), 64)}${eq.generated ? '<span class="tag">Starter pack</span>' : ''}</div>
      </div>
      <nav class="tabs" role="tablist">${BME.TABS.map(([k, l, n]) => `<a role="tab" href="#/eq/${id}/${k}" class="${k === tab ? 'on' : ''} ${n > lvl ? 'locked' : ''} ${seen[k] ? 'seen' : ''}" title="Level ${n}">${n > lvl ? '🔒 ' : ''}${l}</a>`).join('')}</nav>
      <div id="tabBody" class="tab-body"></div>`;
    const body = $('#tabBody', el);
    $('.tabs a.on', el).scrollIntoView({ block: 'nearest', inline: 'center' });
    $$('.tabs a', el).forEach(a => a.addEventListener('click', () => { window._keepScroll = true; }));
    if (locked) {
      body.innerHTML = `<div class="empty"><h2>🔒 Level ${tdef[2]} module</h2><p>${esc(tdef[1])} unlocks at Level ${tdef[2]} — ${BME.LEVELS[tdef[2] - 1].name}. You are Level ${lvl}.</p><div class="row gap center"><a class="btn btn-primary" href="#/eq/${id}/assessment">Take the assessment</a><a class="btn" href="#/levels">How levels work</a></div></div>`;
      return;
    }
    (TABS[tab] || TABS.overview)(body, eq);
    if (eq.generated && !['documents', 'assessment'].includes(tab)) body.insertAdjacentHTML('afterbegin', `<div class="info-banner">Starter pack: architecture auto-generated from the catalog. An administrator can add a full content pack (js/content/${esc(id)}.js) — the app picks it up with no code change.</div>`);
  };

  const TABS = {};

  /* ---------- OVERVIEW ---------- */
  TABS.overview = (b, eq) => {
    const path = ['Equipment', 'Principle', 'Major Components', 'Internal Architecture', 'Operation', 'Parameters', 'Preventive Maintenance', 'Performance Testing', 'Troubleshooting', 'Service Procedure', 'Safety', 'Assessment'];
    const tabFor = ['overview', 'overview', 'components', 'how', 'operation', 'operation', 'pm', 'qa', 'troubleshoot', 'service', 'safety', 'assessment'];
    b.innerHTML = `<div class="learn-path">${path.map((p, i) => `<a href="#/eq/${eq.id}/${tabFor[i]}"><i>${i + 1}</i>${p}</a>`).join('')}</div>
      <div class="two-col wide-left">
        <div class="panel"><h3>What it is</h3><p class="lead">${esc(eq.summary || eq.name + ' — starter module. Explore the architecture and add content as it becomes available.')}</p>
          ${eq.principle ? `<h3>Principle of operation</h3><ol class="steps-list">${eq.principle.map(p => `<li>${esc(p)}</li>`).join('')}</ol>` : ''}</div>
        <div class="panel"><h3>Architecture at a glance</h3><div class="mini-diagram">${diagram(eq, { visited: Store.eqProgress(eq.id).comps })}</div><p class="muted small">Click any block to open the component.</p>
          <div class="row gap wrap"><a class="btn btn-primary" href="#/eq/${eq.id}/how">▶ How it works</a><a class="btn" href="#/3d/${eq.id}">⬢ 3D explorer</a>${window.Sim && Sim.has(eq.id) ? `<a class="btn" href="#/live/${eq.id}">◉ Live simulator</a>` : ''}<a class="btn" href="#/service/${eq.id}">Service mode</a></div></div>
      </div>
      ${eq.parameters ? `<div class="panel"><h3>Key parameters</h3><table class="table"><thead><tr><th>Parameter</th><th>Unit</th><th>Typical</th><th>Engineer note</th></tr></thead><tbody>${eq.parameters.map(p => `<tr><td>${esc(p.name)}</td><td>${esc(p.unit)}</td><td>${esc(p.typical)}</td><td>${esc(p.note)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
    $$('[data-node]', b).forEach(n => n.onclick = () => { window._openComp = n.dataset.node; location.hash = '#/eq/' + eq.id + '/components'; });
  };

  /* ---------- HOW IT WORKS (animated sequence) ---------- */
  TABS.how = (b, eq) => {
    const W = eq.workflow; let i = 0, playing = false, timer = null;
    if (!W.length) { b.innerHTML = '<p class="muted">No workflow defined.</p>'; return; }
    b.innerHTML = `<div class="info-banner small row gap wrap between"><span>See it run: rotate the real machine in 3D or operate it live with sound and alarms.</span><span class="row gap"><a class="btn small" href="#/3d/${eq.id}">⬢ 3D explorer</a>${window.Sim && Sim.has(eq.id) ? `<a class="btn small btn-primary" href="#/live/${eq.id}">◉ Live simulator</a>` : ''}</span></div>
      <div class="how-wrap"><div class="panel diagram-panel" id="howDia"></div>
      <div class="panel how-side"><div class="stage-strip" id="strip">${W.map((s, k) => `<button data-k="${k}"><i>${k + 1}</i>${esc(s.title)}</button>`).join('')}</div>
      <div id="stageInfo"></div>
      <div class="player"><button class="btn" id="prev">◀</button><button class="btn btn-primary" id="play">▶ Play</button><button class="btn" id="next">▶</button></div></div></div>`;
    const show = () => {
      const s = W[i];
      $('#howDia', b).innerHTML = diagram(eq, { active: s.active, dim: true });
      $$('#strip button', b).forEach((x, k) => { x.classList.toggle('on', k === i); x.classList.toggle('past', k < i); });
      $('#strip button.on', b).scrollIntoView({ block: 'nearest', inline: 'nearest' });
      const comps = s.active.map(a => (eq.components[a] || {}).name || a);
      $('#stageInfo', b).innerHTML = `<div class="stage-card"><div class="eyebrow">Stage ${i + 1} of ${W.length}</div><h2>${esc(s.title)}</h2>
        <div class="kv-grid">${field('What is happening?', s.what)}${field('Active component', comps.join(', '))}${field('Signal generated', s.signal)}${field('Parameter measured', s.parameter)}${field('What can fail here?', s.fail)}</div></div>`;
      $$('[data-node]', $('#howDia', b)).forEach(n => n.onclick = () => openComp(eq, n.dataset.node));
    };
    const stop = () => { playing = false; clearInterval(timer); $('#play', b).textContent = '▶ Play'; };
    $('#play', b).onclick = () => {
      if (playing) return stop();
      playing = true; $('#play', b).textContent = '❚❚ Pause';
      timer = setInterval(() => { if (!document.body.contains(b)) return clearInterval(timer); i = (i + 1) % W.length; show(); }, 4200);
    };
    $('#prev', b).onclick = () => { stop(); i = (i - 1 + W.length) % W.length; show(); };
    $('#next', b).onclick = () => { stop(); i = (i + 1) % W.length; show(); };
    $('#strip', b).onclick = e => { const x = e.target.closest('button'); if (!x) return; stop(); i = +x.dataset.k; show(); };
    show();
  };

  /* ---------- COMPONENTS ---------- */
  function compDetail(eq, cid) {
    const c = eq.components[cid]; if (!c) return '';
    const node = eq.diagram.nodes.find(n => n.id === cid) || {};
    const zone = (eq.diagram.zones || []).find(z => node.x >= z.x && node.x <= z.x + z.w && node.y >= z.y && node.y <= z.y + z.h);
    return `<div class="comp-detail"><div class="eyebrow">${esc(eq.name)} · Component</div><h2>${esc(c.name)}</h2>
      ${zone ? `<span class="haz haz-${zone.type}">${UI.HAZ[zone.type] || '⚠'} ${esc(zone.label)}</span>` : ''}
      <div class="quick-card">
        <div><small>What it does</small><p>${esc(c.function)}</p></div>
        <div><small>Where it is</small><p>${esc(c.input)} → <b>${esc(c.name)}</b> → ${esc(c.output)}</p></div>
        <div><small>Common failure</small><p>${esc(c.failure)}</p></div>
        <div><small>Engineer check</small><p>${esc(c.test)}</p></div>
      </div>
      <details open><summary>Working principle & signals</summary><div class="kv-grid">${field('Working principle', c.principle)}${field('Input', c.input)}${field('Output', c.output)}${field('Normal operating condition', c.normal)}</div></details>
      <details open><summary>Faults & diagnosis</summary><div class="kv-grid">${field('Common failure', c.failure)}${field('Symptoms', c.symptoms)}${field('Testing method', c.test)}</div></details>
      <details><summary>Service</summary><div class="kv-grid">${field('Service procedure', c.service)}${field('Safety precautions', c.safety)}${field('Related spare parts', c.spares)}${field('Related PM checklist', c.pm)}${field('Related QA test', c.qa)}</div></details>
      <div class="warn-banner small">${UI.DISCLAIMER}</div>
      <button class="btn small" onclick="Assistant.ask('Explain the ${esc(c.name).replace(/'/g, '')} in the ${esc(eq.name)}')">✦ Ask the assistant</button></div>`;
  }
  function openComp(eq, cid) {
    Store.eqProgress(eq.id).comps[cid] = true; Store.save();
    modal(compDetail(eq, cid), { wide: true });
  }
  V._openComp = openComp;
  TABS.components = (b, eq) => {
    const ids = Object.keys(eq.components);
    let sel = window._openComp && eq.components[window._openComp] ? window._openComp : ids[0];
    window._openComp = null;
    b.innerHTML = `<div class="comp-layout"><div class="panel diagram-panel"><div class="row between"><h3>Interactive machine view</h3><small class="muted">Click a block · ● = not yet explored</small></div><div id="cDia"></div>
      <div class="comp-chips" id="cList">${ids.map(k => `<button data-c="${k}">${esc(eq.components[k].name)}</button>`).join('')}</div></div>
      <div class="panel comp-side" id="cDet"></div></div>`;
    const show = cid => {
      sel = cid; Store.eqProgress(eq.id).comps[cid] = true; Store.save();
      $('#cDia', b).innerHTML = diagram(eq, { active: [cid], visited: Store.eqProgress(eq.id).comps });
      $('#cDet', b).innerHTML = compDetail(eq, cid);
      $$('#cList button', b).forEach(x => { x.classList.toggle('on', x.dataset.c === cid); x.classList.toggle('seen', !!Store.eqProgress(eq.id).comps[x.dataset.c]); });
      $$('[data-node]', $('#cDia', b)).forEach(n => { n.onclick = () => { show(n.dataset.node); if (innerWidth < 900) $('#cDet', b).scrollIntoView({ behavior: 'smooth' }); }; n.onkeydown = e => { if (e.key === 'Enter') show(n.dataset.node); }; });
    };
    $('#cList', b).onclick = e => { const x = e.target.closest('button'); if (x) show(x.dataset.c); };
    show(sel);
  };

  /* ---------- OPERATION ---------- */
  TABS.operation = (b, eq) => {
    b.innerHTML = `<div class="two-col"><div class="panel"><h3>Operating sequence</h3>${eq.operation ? `<ol class="timeline">${eq.operation.map(o => `<li><b>${esc(o.step)}</b><p>${esc(o.detail)}</p></li>`).join('')}</ol>` : '<p class="muted">Model-specific procedure required — refer to the operator manual.</p>'}</div>
      <div class="panel"><h3>Parameters</h3>${eq.parameters ? `<table class="table"><tbody>${eq.parameters.map(p => `<tr><td><b>${esc(p.name)}</b><br><small class="muted">${esc(p.note)}</small></td><td>${esc(p.unit)}</td><td>${esc(p.typical)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">Not defined.</p>'}
      <div class="info-banner small">Engineers verify that the equipment performs to specification. Clinical settings are the responsibility of trained clinical users.</div></div></div>`;
  };

  /* ---------- PM ---------- */
  TABS.pm = (b, eq) => {
    const levels = BME.PM_LEVELS.filter(([k]) => (eq.pm[k] || []).length);
    let cur = levels[0] && levels[0][0];
    const photos = {};
    const render = () => {
      const tasks = eq.pm[cur] || [];
      b.innerHTML = `<div class="row between wrap"><div class="chips" id="pmLv">${levels.map(([k, l]) => `<button class="chip ${k === cur ? 'on' : ''}" data-v="${k}">${l} <small>${eq.pm[k].length}</small></button>`).join('')}</div>
        <select id="pmAsset"><option value="">Training (no asset)</option>${Store.s.assets.filter(a => a.equipment === eq.id).map(a => `<option value="${a.id}">${esc(a.serial)} · ${esc(a.location)}</option>`).join('')}</select></div>
        <div class="pm-list">${tasks.map((t, k) => `<details class="pm-task" data-k="${k}" ${k === 0 ? 'open' : ''}><summary><span class="pm-status" data-st></span><b>${esc(t.task)}</b><small>${esc(t.tools)}</small></summary>
          <div class="kv-grid">${field('Why it is required', t.why)}${field('Tools required', t.tools)}${field('Safety requirement', t.safety)}${field('Procedure', t.procedure)}${field('Acceptance criteria', t.criteria)}</div>
          <div class="pm-entry"><label>Result<input data-f="result" placeholder="Measured value / observation"></label>
            <div class="pf"><button type="button" data-pf="pass">✓ Pass</button><button type="button" data-pf="fail">✕ Fail</button><button type="button" data-pf="na">N/A</button></div>
            <label>Remarks<input data-f="remarks" placeholder="Remarks"></label>
            <label class="file-btn">📷 Photo<input type="file" accept="image/*" capture="environment" data-photo></label><span class="photo-thumb"></span></div>
        </details>`).join('')}</div>
        <div class="panel sign-panel"><h3>Sign-off</h3><div class="row gap wrap"><label>Engineer<input id="pmEng" value="${esc(Store.s.user.name)}"></label><label>Date<input id="pmDate" type="date" value="${new Date().toISOString().slice(0, 10)}"></label></div>
          <label>Engineer signature</label><canvas id="pmSig" class="sig" width="600" height="140"></canvas><div class="row gap"><button class="btn small" id="sigClr">Clear</button><button class="btn btn-primary" id="pmSave">Save PM record</button></div></div>
        ${pmHistory(eq.id)}`;
      const sig = UI.signaturePad($('#pmSig', b));
      $('#sigClr', b).onclick = () => sig.clear();
      $('#pmLv', b).onclick = e => { const x = e.target.closest('.chip'); if (x) { cur = x.dataset.v; render(); } };
      $$('.pm-task', b).forEach(d => {
        $$('[data-pf]', d).forEach(btn => btn.onclick = () => { $$('[data-pf]', d).forEach(x => x.classList.toggle('on', x === btn)); d.dataset.pf = btn.dataset.pf; $('[data-st]', d).className = 'pm-status ' + btn.dataset.pf; });
        $('[data-photo]', d).onchange = async ev => { const f = ev.target.files[0]; if (!f) return; photos[d.dataset.k] = await UI.readImage(f, 900); $('.photo-thumb', d).innerHTML = `<img src="${photos[d.dataset.k]}" alt="PM photo">`; };
      });
      $('#pmSave', b).onclick = async () => {
        const items = $$('.pm-task', b).map(d => { const t = tasks[+d.dataset.k]; return { task: t.task, result: $('[data-f=result]', d).value, status: d.dataset.pf || '', remarks: $('[data-f=remarks]', d).value, photo: photos[d.dataset.k] ? true : false }; });
        if (items.some(x => !x.status)) return toast('Mark every task Pass / Fail / N/A before saving');
        const signature = sig.value(); if (!signature) return toast('Engineer signature required');
        const rec = { id: uid('pm'), equipment: eq.id, asset: $('#pmAsset', b).value, level: cur, items, engineer: $('#pmEng', b).value, date: $('#pmDate', b).value, signature, ts: Date.now(), overall: items.some(x => x.status === 'fail') ? 'FAIL' : 'PASS' };
        for (const k of Object.keys(photos)) await Files.put('media', { id: rec.id + '-' + k, data: photos[k] }).catch(() => {});
        Store.s.pmRecords.unshift(rec);
        if (rec.asset) { const a = Store.s.assets.find(x => x.id === rec.asset); if (a) { a.lastPM = rec.date; a.history = a.history || []; a.history.unshift({ date: rec.date, type: 'PM (' + cur + ')', text: rec.overall, by: rec.engineer }); } }
        Store.save(); toast('PM record saved — ' + rec.overall); render();
      };
    };
    if (!cur) { b.innerHTML = '<p class="muted">No PM defined.</p>'; return; }
    render();
  };
  function pmHistory(eqId) {
    const r = Store.s.pmRecords.filter(x => x.equipment === eqId).slice(0, 8);
    return `<div class="panel"><h3>PM records</h3>${r.length ? `<table class="table"><thead><tr><th>Date</th><th>Level</th><th>Asset</th><th>Engineer</th><th>Result</th></tr></thead><tbody>${r.map(x => `<tr><td>${esc(x.date)}</td><td>${esc(x.level)}</td><td>${esc((Store.s.assets.find(a => a.id === x.asset) || {}).serial || 'Training')}</td><td>${esc(x.engineer)}</td><td><span class="tag ${x.overall === 'PASS' ? 'tag-ok' : 'tag-bad'}">${x.overall}</span></td></tr>`).join('')}</tbody></table>` : '<p class="muted">No PM records yet.</p>'}</div>`;
  }
  V._pmHistory = pmHistory;

  /* ---------- QA ---------- */
  TABS.qa = (b, eq) => {
    if (!eq.qa) { b.innerHTML = `<div class="warn-banner">Model-specific procedure required. Define QA tests for this equipment in a content pack.</div>`; return; }
    b.innerHTML = `<div class="flow-chain">${['Test', 'Equipment setup', 'Measurement', 'Acceptance limit', 'Result', 'Pass / Fail', 'Report'].map(x => `<span>${x}</span>`).join('<i>→</i>')}</div>
      <div class="info-banner">Acceptance limits are <b>not hard-coded</b>. Configure each limit from your hospital’s approved protocol, the manufacturer documentation and the applicable standard revision. Unconfigured tests cannot pass automatically.</div>
      <div class="qa-grid">${eq.qa.map(t => qaCard(eq, t)).join('')}</div>`;
    wireQa(b, eq);
  };
  function qaCard(eq, t) {
    const L = Store.limit(eq.id, t.id); const check = t.unit === '—';
    return `<div class="panel qa-card" data-t="${esc(t.id)}"><div class="row between"><h3>${esc(t.test)}</h3><span class="tag">${esc(t.unit)}</span></div>
      <div class="kv-grid">${field('Equipment setup', t.setup)}${field('Measurement', t.measure)}${field('What is compared', t.example)}${field('Report', t.report)}</div>
      <div class="limit-box">${L ? `<b>Limit:</b> ${check ? 'Checklist' : `± ${esc(L.tol)} ${L.mode === 'pct' ? '%' : esc(t.unit)}`} <small class="muted">Source: ${esc(L.source || '—')}</small>` : '<span class="tag tag-warn">Limit not configured</span>'} <button class="btn small" data-cfg>Configure</button></div>
      ${check ? `<div class="pf"><button data-pf="pass">✓ Pass</button><button data-pf="fail">✕ Fail</button></div>` :
        `<div class="qa-rows"><div class="qa-row"><input type="number" step="any" placeholder="Set / reference"><input type="number" step="any" placeholder="Measured"><output>—</output></div></div><button class="btn small" data-addrow>+ Add point</button>`}
      <div class="qa-result"></div><button class="btn btn-primary small" data-save>Record result</button></div>`;
  }
  function wireQa(b, eq) {
    $$('.qa-card', b).forEach(card => {
      const t = eq.qa.find(x => x.id === card.dataset.t); const check = t.unit === '—';
      const evalRow = row => {
        const [s, m] = $$('input', row).map(i => parseFloat(i.value)); const L = Store.limit(eq.id, t.id); const o = $('output', row);
        if (isNaN(s) || isNaN(m)) { o.textContent = '—'; o.className = ''; return null; }
        const dev = m - s, pct = s ? dev / s * 100 : 0;
        if (!L) { o.textContent = `Δ ${dev.toFixed(2)} (${pct.toFixed(1)}%) · no limit`; o.className = 'warn'; return 'unset'; }
        const ok = L.mode === 'pct' ? Math.abs(pct) <= +L.tol : Math.abs(dev) <= +L.tol;
        o.textContent = `Δ ${dev.toFixed(2)} (${pct.toFixed(1)}%) · ${ok ? 'PASS' : 'FAIL'}`; o.className = ok ? 'ok' : 'bad'; return ok ? 'pass' : 'fail';
      };
      card.addEventListener('input', e => { const r = e.target.closest('.qa-row'); if (r) evalRow(r); });
      const add = $('[data-addrow]', card); if (add) add.onclick = () => $('.qa-rows', card).insertAdjacentHTML('beforeend', '<div class="qa-row"><input type="number" step="any" placeholder="Set / reference"><input type="number" step="any" placeholder="Measured"><output>—</output></div>');
      $$('[data-pf]', card).forEach(btn => btn.onclick = () => { $$('[data-pf]', card).forEach(x => x.classList.toggle('on', x === btn)); card.dataset.pf = btn.dataset.pf; });
      $('[data-cfg]', card).onclick = () => {
        const L = Store.limit(eq.id, t.id) || {};
        const c = modal(`<h2>Acceptance limit — ${esc(t.test)}</h2><p class="muted">Enter the limit from your approved protocol. Do not copy values without checking the current manufacturer documentation and standard revision.</p>
          ${check ? '<p>Checklist test — pass/fail recorded manually.</p>' : `<div class="row gap"><label>Tolerance mode<select id="lm"><option value="abs" ${L.mode !== 'pct' ? 'selected' : ''}>Absolute (± ${esc(t.unit)})</option><option value="pct" ${L.mode === 'pct' ? 'selected' : ''}>Percent of set (± %)</option></select></label><label>Tolerance<input id="lt" type="number" step="any" value="${esc(L.tol || '')}"></label></div>`}
          <label>Source / reference (protocol, manual section, standard + revision)<input id="ls" value="${esc(L.source || '')}"></label>
          <div class="row gap"><button class="btn btn-primary" id="lsave">Save limit</button>${L.tol || L.source ? '<button class="btn" id="lclr">Clear</button>' : ''}</div>`);
        $('#lsave', c).onclick = () => {
          const v = check ? { mode: 'check', tol: 0, source: $('#ls', c).value } : { mode: $('#lm', c).value, tol: $('#lt', c).value, source: $('#ls', c).value };
          if (!check && v.tol === '') return toast('Enter a tolerance');
          if (!v.source) return toast('Record the source of the limit');
          Store.setLimit(eq.id, t.id, v); UI.closeModal(); TABS.qa(b, eq);
        };
        const clr = $('#lclr', c); if (clr) clr.onclick = () => { delete Store.s.qaLimits[eq.id + ':' + t.id]; Store.save(); UI.closeModal(); TABS.qa(b, eq); };
      };
      $('[data-save]', card).onclick = () => {
        let result, points = [];
        if (check) { result = card.dataset.pf; if (!result) return toast('Select Pass or Fail'); }
        else {
          const rows = $$('.qa-row', card); const rs = rows.map(evalRow).filter(Boolean);
          points = rows.map(r => $$('input', r).map(i => i.value)).filter(p => p[0] !== '' && p[1] !== '');
          if (!rs.length) return toast('Enter at least one set / measured pair');
          result = rs.includes('unset') ? 'NO LIMIT' : rs.includes('fail') ? 'fail' : 'pass';
        }
        Store.s.qaRecords.unshift({ id: uid('qa'), equipment: eq.id, test: t.test, points, result: String(result).toUpperCase(), limit: Store.limit(eq.id, t.id), engineer: Store.s.user.name, ts: Date.now() });
        Store.save();
        $('.qa-result', card).innerHTML = `<span class="tag ${result === 'pass' ? 'tag-ok' : result === 'fail' ? 'tag-bad' : 'tag-warn'}">${String(result).toUpperCase()}</span> recorded.`;
        toast('QA result recorded');
      };
    });
  }

  /* ---------- TROUBLESHOOT (service-mode flow) ---------- */
  TABS.troubleshoot = (b, eq) => V._serviceFlow(b, eq);

  /* ---------- ERROR CODES ---------- */
  TABS.errors = (b, eq) => {
    const errs = (eq.errors || []).map(e => Object.assign({ manufacturer: 'Generic (training)', model: '—' }, e))
      .concat(Store.s.custom.errors.filter(e => e.equipment === eq.id));
    b.innerHTML = `<div class="warn-banner">⚠ ${UI.DISCLAIMER} Codes prefixed TRN- are fictional training codes.</div>
      ${errs.length ? errs.map(e => V._errorCard(e, eq)).join('') : '<p class="muted">No error codes for this equipment. Add model-specific codes in Admin.</p>'}
      <a class="btn" href="#/errors">Open Error Code Explorer →</a>`;
    $$('[data-comp]', b).forEach(a => a.onclick = ev => { ev.preventDefault(); openComp(eq, a.dataset.comp); });
  };
  V._errorCard = (e, eq) => {
    const comp = eq && eq.components[e.component];
    return `<details class="err-card"><summary><code>${esc(e.code)}</code><b>${esc(e.desc)}</b><small>${esc(e.manufacturer || '')} · ${esc(eq ? eq.name : e.equipment)}${e.model && e.model !== '—' ? ' · ' + esc(e.model) : ''}</small></summary>
      <div class="kv-grid">${field('Possible causes', e.causes)}<div class="kv"><dt>Affected component</dt><dd>${comp ? `<a href="#" data-comp="${esc(e.component)}">${esc(comp.name)} →</a>` : esc(e.component || '—')}</dd></div>
      ${field('Recommended diagnostic checks', e.checks)}${field('Service procedure', e.service)}${field('Verification', e.verify)}${field('Related PM task', e.pm)}</div></details>`;
  };

  /* ---------- SERVICE ---------- */
  TABS.service = (b, eq) => {
    const steps = [
      ['Receive & triage', 'Record complaint, error code, who reported, clinical impact. Arrange replacement equipment if patient-critical.'],
      ['Understand the system', 'Review architecture and the signal/energy path for the symptom. Open the Components and How it works tabs.'],
      ['Prepare safely', 'Remove from clinical use, decontaminate, apply LOTO, discharge stored energy, ESD protection.'],
      ['Identify possible causes', 'List causes from the symptom; rank by likelihood and ease of checking.'],
      ['Measure', 'Use calibrated tools. Compare to expected values from service documentation.'],
      ['Isolate', 'Substitute known-good parts or split the signal path to localise the fault.'],
      ['Repair', 'Replace/repair only the proven root cause using approved parts.'],
      ['Calibrate & verify', 'Calibrate as required; run performance (QA) and electrical safety tests.'],
      ['Document & release', 'Complete the service report; return to service only with a documented PASS.']
    ];
    b.innerHTML = `<div class="philosophy">${['Symptom', 'Understand system', 'Possible causes', 'Measure', 'Isolate', 'Repair', 'Verify', 'Document'].map(x => `<span>${x}</span>`).join('<i>↓</i>')}</div>
      <div class="two-col"><div class="panel"><h3>Service procedure framework</h3><ol class="timeline">${steps.map(([t, d]) => `<li><b>${t}</b><p>${d}</p></li>`).join('')}</ol>
        <div class="warn-banner small">Do not “replace parts until it works”. Every part replaced should be justified by a measurement.</div></div>
      <div class="panel"><h3>Component service procedures</h3><table class="table"><thead><tr><th>Component</th><th>Procedure</th></tr></thead><tbody>
        ${Object.entries(eq.components).map(([k, c]) => `<tr><td><a href="#" data-comp="${k}">${esc(c.name)}</a></td><td>${esc(c.service)}${/model-specific/i.test(c.service) ? ' <span class="tag tag-warn">Model-specific</span>' : ''}</td></tr>`).join('')}</tbody></table>
        <a class="btn btn-primary" href="#/report/new?eq=${eq.id}">✎ Write a service report</a></div></div>`;
    $$('[data-comp]', b).forEach(a => a.onclick = ev => { ev.preventDefault(); openComp(eq, a.dataset.comp); });
  };

  /* ---------- SAFETY ---------- */
  TABS.safety = (b, eq) => {
    const zoneIds = new Set();
    (eq.diagram.zones || []).forEach(z => eq.diagram.nodes.forEach(n => { if (n.x >= z.x && n.x <= z.x + z.w && n.y >= z.y && n.y <= z.y + z.h) zoneIds.add(n.id); }));
    b.innerHTML = `<div class="haz-row big">${hazardBadges(eq.hazards)}</div>
      <div class="two-col wide-left"><div class="panel diagram-panel"><h3>Danger areas</h3>${diagram(eq, { active: [...zoneIds], dim: true })}</div>
      <div class="panel">${(eq.safety || [{ title: 'General', level: 'warning', text: 'Apply LOTO, discharge stored energy, use PPE, and follow the manufacturer safety instructions.' }]).map(s => `<div class="safety-item lvl-${esc(s.level)}"><b>${esc(s.level.toUpperCase())}: ${esc(s.title)}</b><p>${esc(s.text)}</p></div>`).join('')}
        <a class="btn" href="#/safety">Electrical & Safety training →</a></div></div>`;
    $$('[data-node]', b).forEach(n => n.onclick = () => openComp(eq, n.dataset.node));
  };

  /* ---------- TOOLS ---------- */
  TABS.tools = (b, eq) => {
    b.innerHTML = `<p class="muted">Test equipment used for ${esc(eq.name)} service. Open a tool to learn selection → connection → measurement → interpretation → documentation.</p>
      <div class="section-grid">${(eq.tools || []).map(t => BME.tools[t]).filter(Boolean).map(t => `<a class="section-card" href="#/tools/${t.id}"><span class="sc-icon">⚖</span><b>${esc(t.name)}</b><small>${esc(t.purpose)}</small></a>`).join('')}</div>`;
  };

  /* ---------- DOCUMENTS ---------- */
  TABS.documents = (b, eq) => {
    b.innerHTML = '<p class="muted">Loading…</p>';
    Files.all('files').then(all => {
      const docs = all.filter(d => d.equipment === eq.id);
      b.innerHTML = `<div class="row between wrap"><p class="muted">${docs.length} document(s) linked to ${esc(eq.name)}.</p><a class="btn btn-primary" href="#/documents">Upload / manage documents</a></div>
        ${docs.map(d => V._docRow(d)).join('') || '<div class="empty small">No documents linked yet. Upload service manuals, SOPs, PM checklists and certificates in the Reference Library.</div>'}`;
      V._wireDocs && V._wireDocs(b, () => TABS.documents(b, eq));
    }).catch(() => { b.innerHTML = '<p class="muted">Document storage unavailable in this browser.</p>'; });
  };

  /* ---------- CASES ---------- */
  TABS.cases = (b, eq) => {
    const cs = (eq.cases || []).map(c => BME.cases[c]).filter(Boolean).concat(Object.values(BME.cases).filter(c => c.equipment === eq.id && !(eq.cases || []).includes(c.id)));
    const sc = Object.values(BME.scenarios).filter(s => s.equipment === eq.id);
    const ar = (eq.artifacts || []).map(a => BME.artifacts[a]).filter(Boolean);
    b.innerHTML = `${sc.length ? `<h3>Fault simulations</h3><div class="section-grid">${sc.map(s => `<a class="section-card warn" href="#/sim/${s.id}"><span class="sc-icon">⚠</span><b>${esc(s.title)}</b><small>${esc(s.fault)}</small></a>`).join('')}</div>` : ''}
      <h3>Service cases</h3><div class="section-grid">${cs.map(c => `<a class="section-card" href="#/case/${c.id}"><span class="sc-icon">☎</span><b>${esc(c.title)}</b><small>${esc(c.complaint)}</small></a>`).join('') || '<p class="muted">No cases yet.</p>'}</div>
      ${ar.length ? `<h3>Image quality</h3><a class="btn" href="#/image-quality">Train artifact recognition (${ar.length}) →</a>` : ''}`;
  };

  /* ---------- ASSESSMENT ---------- */
  TABS.assessment = (b, eq) => {
    const qs = (eq.questions || []).slice();
    // Component identification from the diagram
    const ids = Object.keys(eq.components);
    if (ids.length >= 4) {
      for (let n = 0; n < 2; n++) {
        const target = ids[Math.floor(Math.random() * ids.length)];
        const opts = [target].concat(ids.filter(x => x !== target).sort(() => Math.random() - .5).slice(0, 3)).sort(() => Math.random() - .5);
        const masked = Object.assign({}, eq, { diagram: Object.assign({}, eq.diagram, { nodes: eq.diagram.nodes.map(x => x.id === target ? Object.assign({}, x, { label: '?' }) : x) }) });
        qs.push({ q: 'Component identification: which component is highlighted?', img: diagram(masked, { active: [target], dim: true }), options: opts.map(o => eq.components[o].name), answer: opts.indexOf(target), why: eq.components[target].function, domain: 'technical' });
      }
    }
    // Image identification
    (eq.artifacts || []).slice(0, 2).forEach(aid => {
      const a = BME.artifacts[aid]; if (!a || !V._artifactImg) return;
      const others = Object.values(BME.artifacts).filter(x => x.modality === a.modality && x.id !== a.id).slice(0, 3);
      const opts = [a].concat(others).sort(() => Math.random() - .5);
      qs.push({ q: 'Image identification: what is shown?', img: `<img src="${V._artifactImg(a.id, 260)}" alt="image">`, options: opts.map(o => o.name), answer: opts.indexOf(a), why: a.cause + ' → ' + a.action, domain: 'troubleshooting' });
    });
    const prev = Store.s.quiz[eq.id];
    b.innerHTML = `<div class="row between wrap"><p class="muted">${qs.length} questions: MCQ, component identification${(eq.artifacts || []).length ? ', image identification' : ''}, troubleshooting, safety and documentation. Scored by competency domain.</p>${prev ? `<span class="tag">Last: ${prev.pct}% · ${prev.band}</span>` : ''}</div><div id="qz"></div>`;
    quiz($('#qz', b), qs, res => { Store.recordQuiz(eq.id, res); App.renderNav(); });
  };
})();

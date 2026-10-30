/* Dashboard, equipment library, levels, progress, manufacturers. */
(function () {
  const { esc, $, $$, ring, hazardBadges, ago } = UI;
  const V = window.Views = window.Views || {};
  const DIFF_LEVEL = { Beginner: 1, Intermediate: 2, Advanced: 3, Expert: 4 };
  const catOf = id => BME.categories.find(c => c.id === id) || { name: id, icon: '•', color: '#888' };

  function eqCard(e) {
    BME.ensure(e);
    const pct = Store.percent(e.id), p = Store.s.progress[e.id], done = p ? Object.keys(p.tabs).length : 0;
    const c = catOf(e.category), lvl = DIFF_LEVEL[e.difficulty] || 2;
    return `<article class="eq-card" style="--cat:${c.color}" data-cat="${esc(e.category)}" data-diff="${esc(e.difficulty)}" data-name="${esc(e.name.toLowerCase())}" data-status="${pct === 0 ? 'new' : pct >= 80 ? 'done' : 'progress'}">
      <div class="eq-card-top"><span class="cat-pill">${c.icon} ${esc(c.name)}</span>${e.full ? '<span class="tag tag-ok">Full pack</span>' : '<span class="tag">Starter</span>'}</div>
      <div class="eq-card-head"><h3>${esc(e.name)}</h3>${ring(pct, 52)}</div>
      <div class="eq-meta">
        <div><small>Level</small><b>L${lvl} · ${BME.LEVELS[lvl - 1].name}</b></div>
        <div><small>Difficulty</small><b>${esc(e.difficulty || '—')}</b></div>
        <div><small>Completed</small><b>${done} / ${BME.TABS.length}</b></div>
        <div><small>Pending</small><b>${BME.TABS.length - done}</b></div>
        <div><small>Est. time</small><b>${e.hours || '—'} h</b></div>
        <div><small>Last accessed</small><b>${ago(p && p.last)}</b></div>
      </div>
      <div class="haz-row">${hazardBadges((e.hazards || []).slice(0, 2))}</div>
      <a class="btn ${pct ? 'btn-primary' : ''} block" href="#/eq/${e.id}">${pct ? 'Continue →' : 'Start →'}</a>
    </article>`;
  }
  V._eqCard = eqCard;

  function stats() {
    const s = Store.s, eqs = Object.values(BME.equipment);
    const started = eqs.filter(e => Store.percent(e.id) > 0);
    const overall = Math.round(eqs.reduce((a, e) => a + Store.percent(e.id), 0) / eqs.length);
    const quizzes = Object.values(s.quiz); const avg = quizzes.length ? Math.round(quizzes.reduce((a, q) => a + q.pct, 0) / quizzes.length) : 0;
    const scen = Object.values(s.scenarios).filter(x => x.solved).length + Object.values(s.cases).filter(x => x.solved).length;
    const domains = {};
    quizzes.forEach(q => Object.entries(q.domains || {}).forEach(([d, [c, t]]) => { domains[d] = domains[d] || [0, 0]; domains[d][0] += c; domains[d][1] += t; }));
    return { overall, started, avg, scen, domains, quizzes };
  }
  V._stats = stats;

  /* Recommendations from weak domains, failed assessments and incomplete work. */
  function recommend() {
    const s = Store.s, st = stats(), recs = [];
    Object.entries(st.domains).forEach(([d, [c, t]]) => {
      if (t && c / t < 0.7) {
        const map = { safety: ['#/safety', 'Electrical & Safety modules'], troubleshooting: ['#/simlab', 'Fault Simulation Lab'], technical: ['#/tools', 'Service Tools Lab'], documentation: ['#/reports', 'Service report practice'], knowledge: ['#/library', 'Equipment component explorer'] };
        const [h, l] = map[d] || ['#/library', 'Review']; recs.push({ h, t: l, why: `Weak area: ${d} (${Math.round(c / t * 100)}%)`, k: 'weak' });
      }
    });
    Object.entries(s.quiz).filter(([, q]) => q.pct < 70).forEach(([k, q]) => {
      const e = BME.equipment[k]; if (e) recs.push({ h: '#/eq/' + k + '/assessment', t: 'Retake ' + e.name + ' assessment', why: `Scored ${q.pct}%`, k: 'retake' });
    });
    st.started.filter(e => Store.percent(e.id) < 80).sort((a, b) => (s.progress[b.id].last || 0) - (s.progress[a.id].last || 0)).slice(0, 3)
      .forEach(e => recs.push({ h: '#/eq/' + e.id, t: 'Continue ' + e.name, why: Store.percent(e.id) + '% complete', k: 'continue' }));
    Object.values(BME.scenarios).filter(x => !(s.scenarios[x.id] || {}).solved).slice(0, 2)
      .forEach(x => recs.push({ h: '#/sim/' + x.id, t: x.title, why: 'Unsolved fault simulation', k: 'sim' }));
    if (!recs.length) recs.push({ h: '#/eq/ventilator', t: 'Start with the Ventilator', why: 'Best first module — full interactive pack', k: 'start' });
    return recs.slice(0, 6);
  }
  V._recommend = recommend;

  V.dashboard = function (el) {
    App.crumbs([['', 'Dashboard']]);
    const st = stats(), s = Store.s;
    const last = Object.entries(s.progress).sort((a, b) => b[1].last - a[1].last)[0];
    const lastEq = last && BME.equipment[last[0]];
    const featured = ['ventilator', 'ct', 'mri', 'ultrasound', 'xray', 'patientMonitor', 'defibrillator', 'infusionPump'].map(id => BME.equipment[id]).filter(Boolean);
    el.innerHTML = `
    <section class="hero">
      <div class="hero-text">
        <div class="eyebrow">Medical Engineering Command Center</div>
        <h1>Learn equipment the way engineers think.</h1>
        <p>Explore every machine visually: <b>principle → components → architecture → operation → PM → QA → troubleshooting → service → safety → assessment</b>.</p>
        <div class="row gap wrap">${lastEq ? `<a class="btn btn-primary" href="#/eq/${lastEq.id}">Continue ${esc(lastEq.name)} →</a>` : '<a class="btn btn-primary" href="#/eq/ventilator">Start: Ventilator →</a>'}<a class="btn" href="#/simlab">Fault Simulation Lab</a><button class="btn" onclick="App.openScanner()">⌗ Scan equipment QR</button></div>
      </div>
      <div class="hero-stats">
        <div class="stat">${ring(st.overall, 84)}<span>Overall training</span></div>
        <div class="stat"><b>${st.started.length}</b><span>Equipment started</span></div>
        <div class="stat"><b>${st.scen}</b><span>Faults diagnosed</span></div>
        <div class="stat"><b>${st.quizzes.length ? st.avg + '%' : '—'}</b><span>Assessment avg</span></div>
      </div>
      <div class="ecg-line" aria-hidden="true"><svg viewBox="0 0 600 60" preserveAspectRatio="none"><path d="M0 30 H170 L185 30 L195 8 L208 54 L220 22 L230 30 H380 L395 30 L405 8 L418 54 L430 22 L440 30 H600"/></svg></div>
    </section>

    <h2 class="section-h">Real-time</h2>
    <div class="live-grid" style="margin-bottom:22px">
      <a class="live-card" href="#/live"><span class="live-pulse"></span><span class="lc-ic">◉</span><b>Live simulators</b><small>Operate 8 machines in real time with sound and alarms, inject faults and diagnose mystery faults.</small></a>
      <a class="live-card" href="#/3d"><span class="lc-ic">⬢</span><b>3D machine explorer</b><small>Rotate, X-ray and explode the machine in 3D. Click any part for service detail, then watch a scan.</small></a>
      <a class="live-card" href="#/dicom-viewer"><span class="lc-ic">▣</span><b>DICOM viewer</b><small>Open .dcm studies: window/level, MPR, measurements, ROI and the tag browser, all in your browser.</small></a>
    </div>

    <h2 class="section-h">Training sections</h2>
    <div class="section-grid">${BME.sections.map(x => `<a class="section-card" href="${x.route}"><span class="sc-icon">${x.icon}</span><b>${esc(x.name)}</b><small>${esc(x.desc)}</small></a>`).join('')}</div>

    <h2 class="section-h">Recommended for you</h2>
    <div class="rec-row">${recommend().map(r => `<a class="rec rec-${r.k}" href="${r.h}"><b>${esc(r.t)}</b><small>${esc(r.why)}</small></a>`).join('')}</div>

    <div class="section-h row between wrap"><h2>Equipment training</h2><a class="btn small" href="#/library">Full library (${Object.keys(BME.equipment).length}) →</a></div>
    <div class="eq-grid">${featured.map(eqCard).join('')}</div>`;
  };

  V.library = function (el, cat) {
    App.crumbs([['#/library', 'Equipment Training']].concat(cat ? [['', catOf(cat).name]] : []));
    const eqs = Object.values(BME.equipment);
    el.innerHTML = `<div class="page-head"><h1>Equipment library</h1><p>${eqs.length} equipment types across ${BME.categories.length} categories. Full packs have complete interactive content; starter packs have an auto-generated architecture and generic PM, ready to be extended by an administrator.</p></div>
      <div class="filters sticky-filters">
        <input type="search" id="fq" placeholder="Filter equipment…">
        <div class="chips" id="fcat"><button class="chip ${!cat ? 'on' : ''}" data-v="">All</button>${BME.categories.map(c => `<button class="chip ${cat === c.id ? 'on' : ''}" data-v="${c.id}">${c.icon} ${esc(c.name)}</button>`).join('')}</div>
        <select id="fdiff"><option value="">Any difficulty</option>${Object.keys(DIFF_LEVEL).map(d => `<option>${d}</option>`).join('')}</select>
        <select id="fstat"><option value="">Any status</option><option value="new">Not started</option><option value="progress">In progress</option><option value="done">Completed</option></select>
      </div>
      ${BME.categories.map(c => `<section class="cat-section" data-catsec="${c.id}"><h2 class="section-h"><span style="color:${c.color}">${c.icon}</span> ${esc(c.name)}</h2>
        <div class="eq-grid">${eqs.filter(e => e.category === c.id).map(eqCard).join('') || '<p class="muted">No equipment yet.</p>'}</div></section>`).join('')}`;
    let fc = cat || '';
    const apply = () => {
      const q = $('#fq').value.toLowerCase(), d = $('#fdiff').value, st = $('#fstat').value;
      $$('.eq-card', el).forEach(c => c.hidden = !((!fc || c.dataset.cat === fc) && (!q || c.dataset.name.includes(q)) && (!d || c.dataset.diff === d) && (!st || c.dataset.status === st)));
      $$('[data-catsec]', el).forEach(s => s.hidden = !$$('.eq-card', s).some(c => !c.hidden));
    };
    $('#fcat').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; fc = b.dataset.v; $$('.chip', $('#fcat')).forEach(x => x.classList.toggle('on', x === b)); apply(); };
    ['#fq', '#fdiff', '#fstat'].forEach(s => $(s).addEventListener('input', apply));
    apply();
  };

  V.levels = function (el) {
    App.crumbs([['', 'Training Levels']]);
    const lvl = Store.level();
    const tabsFor = n => BME.TABS.filter(t => t[2] === n).map(t => t[1]);
    const req = ['Open any equipment module', 'Pass 1 assessment (≥70%)', 'Pass 2 assessments', 'Pass 3 assessments + solve 2 faults/cases', 'Pass 5 assessments + solve 5 faults/cases'];
    el.innerHTML = `<div class="page-head"><h1>Level-based training</h1><p>Modules unlock progressively as you demonstrate competence. Instructors can unlock everything for classroom use.</p>
      <label class="switch"><input type="checkbox" id="unlockAll" ${Store.s.unlockAll ? 'checked' : ''}><span></span> Instructor mode — unlock all levels</label></div>
      <div class="levels">${BME.LEVELS.map(L => `<div class="level-card ${L.n <= lvl ? 'unlocked' : 'locked'}">
        <div class="lv-n">L${L.n}</div><div><h3>${L.name} ${L.n <= lvl ? '' : '🔒'}</h3><p>${L.desc}</p>
        <small>Unlocks tabs: ${tabsFor(L.n).join(', ') || 'Advanced scenarios and root-cause analysis'}</small><br><small class="muted">Requirement: ${req[L.n - 1]}</small></div></div>`).join('')}</div>`;
    $('#unlockAll').onchange = e => { Store.s.unlockAll = e.target.checked; Store.save(); App.route(); };
  };

  V.progress = function (el) {
    App.crumbs([['', 'My Progress']]);
    const s = Store.s, st = stats(), eqs = Object.values(BME.equipment);
    const done = eqs.filter(e => Store.percent(e.id) >= 80);
    const safetyDone = Object.keys(s.safety).length;
    const weak = Object.entries(st.domains).filter(([, [c, t]]) => t && c / t < 0.7).map(([d]) => d);
    const tile = (v, l) => `<div class="tile"><b>${v}</b><span>${l}</span></div>`;
    el.innerHTML = `<div class="page-head"><h1>My progress</h1><p>${esc(s.user.name)} · Level ${Store.level()} — ${BME.LEVELS[Store.level() - 1].name}</p></div>
      <div class="tiles">
        <div class="tile big">${ring(st.overall, 96)}<span>Overall training</span></div>
        ${tile(done.length + ' / ' + eqs.length, 'Equipment completed')}
        ${tile(s.pmRecords.length, 'PM records completed')}
        ${tile(Object.values(s.scenarios).filter(x => x.solved).length + Object.values(s.cases).filter(x => x.solved).length, 'Troubleshooting cases solved')}
        ${tile(s.qaRecords.length, 'QA tests recorded')}
        ${tile(safetyDone + ' / ' + BME.safetyTopics.length, 'Safety modules')}
        ${tile(st.quizzes.length ? st.avg + '%' : '—', 'Assessment score')}
      </div>
      <div class="two-col">
        <div class="panel"><h3>Competency domains</h3><div class="domain-bars">${BME.DOMAINS.map(d => { const v = st.domains[d]; const p = v ? Math.round(v[0] / v[1] * 100) : null; return `<div class="dbar ${p != null && p < 70 ? 'weak' : ''}"><span>${d}</span><div class="bar"><i style="width:${p || 0}%"></i></div><b>${p == null ? '—' : p + '%'}</b></div>`; }).join('')}</div>
          <p class="muted">${weak.length ? 'Weak areas: <b>' + weak.join(', ') + '</b>' : 'No weak areas identified yet — take assessments to measure.'}</p></div>
        <div class="panel"><h3>Recommended next training</h3><div class="rec-col">${recommend().map(r => `<a class="rec rec-${r.k}" href="${r.h}"><b>${esc(r.t)}</b><small>${esc(r.why)}</small></a>`).join('')}</div></div>
      </div>
      <div class="panel"><h3>Equipment progress</h3><table class="table"><thead><tr><th>Equipment</th><th>Progress</th><th>Modules</th><th>Assessment</th><th>Last accessed</th></tr></thead><tbody>
        ${eqs.filter(e => s.progress[e.id]).sort((a, b) => Store.percent(b.id) - Store.percent(a.id)).map(e => `<tr><td><a href="#/eq/${e.id}">${esc(e.name)}</a></td><td><div class="bar"><i style="width:${Store.percent(e.id)}%"></i></div></td><td>${Object.keys(s.progress[e.id].tabs).length}/${BME.TABS.length}</td><td>${s.quiz[e.id] ? s.quiz[e.id].pct + '% · ' + s.quiz[e.id].band : '—'}</td><td>${ago(s.progress[e.id].last)}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Nothing started yet.</td></tr>'}
      </tbody></table></div>`;
  };

  V.manufacturers = function (el, mid) {
    const m = BME.manufacturers.find(x => x.id === mid);
    if (!m) {
      App.crumbs([['', 'Manufacturer Training']]);
      el.innerHTML = `<div class="page-head"><h1>Manufacturer training</h1><p>Manufacturer-neutral architecture: each manufacturer → equipment → model → system architecture → service manual → PM → error codes → troubleshooting → parts → training. Generic training content is never assumed to apply to a specific model.</p></div>
        <div class="warn-banner">⚠ Model-specific procedures must come from the manufacturer’s current service documentation and authorised training. Upload them in the Reference Library and link them to the model.</div>
        <div class="section-grid">${BME.manufacturers.map(x => { const n = BME.models.filter(md => md.manufacturer === x.id).length; return `<a class="section-card" href="#/manufacturers/${x.id}"><span class="sc-icon">⌂</span><b>${esc(x.name)}</b><small>${n} model record(s)</small></a>`; }).join('')}</div>`;
      return;
    }
    App.crumbs([['#/manufacturers', 'Manufacturers'], ['', m.name]]);
    const models = BME.models.filter(x => x.manufacturer === m.id);
    const chain = ['Manufacturer', 'Equipment', 'Model', 'System Architecture', 'Service Manual', 'PM', 'Error Codes', 'Troubleshooting', 'Parts', 'Training'];
    el.innerHTML = `<div class="page-head"><h1>${esc(m.name)}</h1><div class="flow-chain">${chain.map(c => `<span>${c}</span>`).join('<i>→</i>')}</div></div>
      <div class="warn-banner">⚠ Model-specific procedure required. The generic architecture below is for understanding the system class only.</div>
      ${models.length ? `<table class="table"><thead><tr><th>Equipment</th><th>Model</th><th>Architecture</th><th>Manuals</th><th>PM</th><th>Error codes</th><th>Troubleshooting</th><th>Parts</th></tr></thead><tbody>
      ${models.map(md => { const e = BME.equipment[md.equipment]; if (!e) return ''; const errs = Store.s.custom.errors.filter(x => x.model === md.id).length;
        return `<tr><td>${esc(e.name)}</td><td>${esc(md.name)}${md.placeholder ? ' <span class="tag">placeholder</span>' : ''}</td>
        <td><a href="#/eq/${e.id}/components">Generic ${esc(e.name)} →</a></td><td><a href="#/documents">Library</a></td>
        <td><span class="tag tag-warn">Model-specific</span></td><td>${errs ? `<a href="#/errors">${errs} code(s)</a>` : '<span class="muted">None loaded</span>'}</td>
        <td><a href="#/service/${e.id}">Generic flows</a></td><td><span class="muted">Per service manual</span></td></tr>`; }).join('')}</tbody></table>` : '<p class="muted">No models recorded. Add models in Admin.</p>'}
      <a class="btn" href="#/admin">+ Add model / error codes</a>`;
  };
})();

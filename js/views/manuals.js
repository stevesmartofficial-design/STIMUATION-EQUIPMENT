/* Service Manual Library (#/manuals): searchable index of the public service and
   user manual collection at Frank's Hospital Workshop. The index (data/manuals.json)
   holds titles and links only; documents open on the source site and are never
   re-hosted here. Entries the source marks "download prohibited" were left out. */
(function () {
  const { esc, $, $$, toast } = UI;
  const V = window.Views = window.Views || {};
  const LANG = { gb: 'English', de: 'German', ger: 'German', fr: 'French', sp: 'Spanish', es: 'Spanish', rus: 'Russian', por: 'Portuguese', ch: 'Chinese', tz: 'Swahili', ge: 'Georgian' };
  const PAGE = 60;

  /* Platform equipment → source categories, plus a keyword for models filed under a broader category. */
  const EQ = {
    ventilator: { c: ['ventilators'] }, cpap: { c: ['ventilators'], k: /cpap|bipap|apap|sleep|resmed|respironics/i }, bipap: { c: ['ventilators'], k: /bipap|bi-level|niv|vpap/i },
    anesthesia: { c: ['anaesthesia'] }, patientMonitor: { c: ['ecg', 'pulse_oximeter', 'sphygmomanometer'] }, ecg: { c: ['ecg'], k: /ecg|ekg|cardio|pagewriter|mac\s?\d/i },
    defibrillator: { c: ['defibrillators'] }, infusionPump: { c: ['infusion_pumps'] }, syringePump: { c: ['infusion_pumps'], k: /syring|perfus|injectomat|graseby|spritz/i },
    xray: { c: ['x-ray'] }, dr: { c: ['x-ray'], k: /\bdr\b|digital|detector|cr\b|reader|digitizer/i }, mobileDr: { c: ['x-ray'], k: /mobil|portab|polymobil|amx/i },
    portableXray: { c: ['x-ray'], k: /portab|mobil|field/i }, fluoro: { c: ['x-ray'], k: /fluoro|intensif|r\/f|rf\b/i }, carm: { c: ['x-ray'], k: /c-?arm|ziehm|oec|siremobil|arcadis|bv\s?\d/i },
    cathlab: { c: ['x-ray'], k: /angio|cath|allura|axiom|innova/i }, mammo: { c: ['x-ray'], k: /mammo|senographe|mammomat/i },
    ct: { c: ['x-ray', 'various_equipment'], k: /\bct\b|tomograph|somatom|lightspeed|aquilion|brilliance|hispeed/i }, mri: { c: ['x-ray', 'various_equipment', 'ecg', 'infusion_pumps'], k: /\bmri?\b|magnetom|\bsigna\b|resonance|ingenia|achieva/i },
    ultrasound: { c: ['ultrasonographs'] }, analyzer: { c: ['automated_analyzer', 'photometer_analyzer', 'laboratory_equipment'] }, hematology: { c: ['automated_analyzer'], k: /hemat|haemat|cell counter|sysmex|coulter|abx|celltac|micros/i },
    bga: { c: ['automated_analyzer', 'laboratory_equipment'], k: /blood gas|bga|abl|rapidlab|gem premier|i-stat/i }, electrolyte: { c: ['automated_analyzer', 'photometer_analyzer'], k: /electrolyt|ise|easylyte|na\/k/i },
    centrifuge: { c: ['centrifuges'] }, microscope: { c: ['microscopes'] }, sterilizer: { c: ['autoclaves'] }, esu: { c: ['electrosurgery'] }, diathermy: { c: ['electrosurgery', 'physiotherapy', 'electrotherapy'], k: /diatherm|shortwave|kurzwelle/i },
    endoscopy: { c: ['endoscopy'] }, neonatal: { c: ['infant_incubators', 'patient_warmer'] }, phototherapy: { c: ['infant_incubators'], k: /photo|bili/i },
    dental: { c: ['dental_units'] }, ot: { c: ['operating_tables', 'light', 'medical_gas_supply'] }
  };

  let DATA = null, loading = null;
  function load() {
    if (DATA) return Promise.resolve(DATA);
    return loading = loading || fetch('data/manuals.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(d => {
      const cn = Object.fromEntries(d.cats);
      d.items = d.rows.map(([ci, kind, make, model, doc, lang, size, ext, path], i) => {
        const cat = d.cats[ci][0];
        return { i, cat, catName: cn[cat], kind, make, model, doc, lang, size, ext, url: d.base + encodeURI(path), hay: (make + ' ' + model + ' ' + doc + ' ' + cn[cat]).toLowerCase() };
      });
      return DATA = d;
    }).catch(e => { loading = null; throw e; });
  }
  V._manualsLoad = load;
  V._manualsFor = eqId => load().then(d => d.items.filter(eqMatch(eqId)));

  function eqMatch(eqId) {
    const m = EQ[eqId];
    if (!m) return () => false;
    return x => (!m.c || m.c.includes(x.cat)) && (!m.k || m.k.test(x.model + ' ' + x.doc));
  }

  /* One-time acknowledgement before the first download link opens. */
  function ackThen(go) {
    if (Store.s.fhwAck) return go();
    const c = UI.modal(`<h2>Before you open a manual</h2>
      <p>These documents are hosted by <b>Frank's Hospital Workshop</b>, a free collection of service and user manuals for biomedical technicians. They open on that site in a new tab.</p>
      <ul><li>Copyright stays with each manufacturer. Use the documents for training and maintenance of equipment you are responsible for.</li>
      <li>Older manuals may be superseded. Check the model, serial range and revision against the manufacturer's current documentation before servicing.</li>
      <li>Documents that manufacturers asked the site not to distribute are excluded from this index.</li>
      <li>The source site's own disclaimer applies (downloads are at your own risk).</li></ul>
      <div class="row gap"><button class="btn btn-primary" id="ackOk">I understand, open it</button><button class="btn" data-close>Cancel</button></div>`);
    $('#ackOk', c).onclick = () => { Store.s.fhwAck = true; Store.save(); UI.closeModal(); go(); };
  }

  V.manuals = function (el) {
    App.crumbs([['', 'Service Manuals']]);
    const q0 = window._query || new URLSearchParams();
    const st = { q: q0.get('q') || '', cat: q0.get('cat') || '', eq: q0.get('eq') || '', kind: q0.get('kind') || 'all', lang: '', make: '', star: false, n: PAGE };
    const stars = Store.s.manStar = Store.s.manStar || [];
    el.innerHTML = `<div class="page-head"><div class="eyebrow">Reference</div><h1>Service manual library</h1>
      <p>Search thousands of free service and user manuals by manufacturer, model or document type: schematics, troubleshooting guides, calibration and repair procedures. Download the one for your model, then add it to your <a href="#/documents">Reference Library</a> to search inside it and link it to components.</p></div>
      <div id="manBody"><div class="empty small">Loading manual index…</div></div>`;
    load().then(d => draw(d)).catch(e => {
      $('#manBody', el).innerHTML = `<div class="empty"><h3>Manual index could not be loaded</h3><p class="muted">${esc(e.message)}. The index loads over the web, so open the app from its hosted link or a local server (not directly from the file).</p>
        <a class="btn" target="_blank" rel="noopener" href="http://www.frankshospitalworkshop.com/equipment.html">Open Frank's Hospital Workshop ↗</a></div>`;
    });

    function draw(d) {
      const makes = Object.entries(d.items.reduce((a, x) => (a[x.make] = (a[x.make] || 0) + 1, a), {})).filter(([, n]) => n >= 4).sort((a, b) => a[0].localeCompare(b[0]));
      const langs = [...new Set(d.items.map(x => x.lang))].sort((a, b) => (LANG[a] || a).localeCompare(LANG[b] || b));
      const eqs = Object.keys(EQ).filter(id => BME.equipment[id]).sort((a, b) => BME.equipment[a].name.localeCompare(BME.equipment[b].name));
      const nSvc = d.items.filter(x => !x.kind).length;
      $('#manBody', el).innerHTML = `
        <div class="man-stats"><div><b>${d.items.length.toLocaleString()}</b><small>documents</small></div><div><b>${nSvc.toLocaleString()}</b><small>service docs</small></div>
          <div><b>${makes.length}</b><small>manufacturers</small></div><div><b>${d.cats.length}</b><small>equipment groups</small></div></div>
        <div class="man-filters panel">
          <input id="mq" type="search" placeholder="Search manufacturer, model or document… e.g. Evita schematic, Zoll M series, autoclave" value="${esc(st.q)}" autocomplete="off">
          <div class="man-selects">
            <select id="meq"><option value="">All training equipment</option>${eqs.map(id => `<option value="${id}" ${st.eq === id ? 'selected' : ''}>${esc(BME.equipment[id].name)}</option>`).join('')}</select>
            <select id="mcat"><option value="">All source groups</option>${d.cats.map(([k, n]) => `<option value="${k}" ${st.cat === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
            <select id="mmake"><option value="">All manufacturers</option>${makes.map(([m, n]) => `<option value="${esc(m)}">${esc(m)} (${n})</option>`).join('')}</select>
            <select id="mlang"><option value="">Any language</option>${langs.map(l => `<option value="${l}">${esc(LANG[l] || l)}</option>`).join('')}</select>
          </div>
          <div class="chips">${[['all', 'Service + user'], ['svc', 'Service manuals'], ['usr', 'User manuals']].map(([k, l]) => `<button class="chip ${st.kind === k ? 'on' : ''}" data-kind="${k}">${l}</button>`).join('')}
            <button class="chip ${st.star ? 'on' : ''}" id="mstar">★ Saved <small id="mstarN">${stars.length}</small></button></div>
        </div>
        <div id="mres"></div>
        <p class="muted small man-src">Index of the public collection at <a target="_blank" rel="noopener" href="${esc(d.site)}equipment.html">Frank's Hospital Workshop ↗</a> (crawled ${esc(d.crawled)}). Titles and links only; documents open on the source site. Manufacturer names and trademarks belong to their owners. Always confirm a manual matches your exact model and revision.</p>`;

      const rerun = () => { st.n = PAGE; results(); };
      let t; $('#mq', el).oninput = e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; rerun(); }, 150); };
      $('#meq', el).onchange = e => { st.eq = e.target.value; rerun(); };
      $('#mcat', el).onchange = e => { st.cat = e.target.value; rerun(); };
      $('#mmake', el).onchange = e => { st.make = e.target.value; rerun(); };
      $('#mlang', el).onchange = e => { st.lang = e.target.value; rerun(); };
      $$('[data-kind]', el).forEach(b => b.onclick = () => { st.kind = b.dataset.kind; $$('[data-kind]', el).forEach(x => x.classList.toggle('on', x === b)); rerun(); });
      $('#mstar', el).onclick = e => { st.star = !st.star; e.currentTarget.classList.toggle('on', st.star); rerun(); };
      results();

      function results() {
        const words = st.q.toLowerCase().split(/\s+/).filter(Boolean), em = st.eq && eqMatch(st.eq);
        const list = d.items.filter(x => (st.kind === 'all' || (st.kind === 'svc' ? !x.kind : x.kind)) && (!st.cat || x.cat === st.cat) && (!st.make || x.make === st.make)
          && (!st.lang || x.lang === st.lang) && (!em || em(x)) && (!st.star || stars.includes(x.url)) && words.every(w => x.hay.includes(w)));
        const groups = []; const gi = {};
        list.forEach(x => { const k = x.model.toLowerCase(); if (!(k in gi)) { gi[k] = groups.length; groups.push({ model: x.model, make: x.make, catName: x.catName, docs: [] }); } groups[gi[k]].docs.push(x); });
        const shown = groups.slice(0, st.n);
        $('#mres', el).innerHTML = `<div class="row between wrap man-count"><b>${list.length.toLocaleString()} document${list.length === 1 ? '' : 's'} · ${groups.length.toLocaleString()} model${groups.length === 1 ? '' : 's'}</b>
            ${st.eq ? `<a class="btn small" href="#/eq/${st.eq}/documents">${esc(BME.equipment[st.eq].name)} documents tab</a>` : ''}</div>
          <div class="man-list">${shown.map(g => `<div class="man-model"><div class="man-head"><b>${esc(g.model)}</b><small>${esc(g.make)} · ${esc(g.catName)}</small></div>
            ${g.docs.map(x => `<div class="man-doc"><span class="man-kind ${x.kind ? 'u' : 's'}">${x.kind ? 'User' : 'Service'}</span><span class="man-title">${esc(x.doc)}</span>
              <span class="man-meta">${esc(LANG[x.lang] || x.lang)} · ${esc(x.ext.toUpperCase())} · ${esc(x.size)}</span>
              <span class="man-act"><button class="icon-btn man-star ${stars.includes(x.url) ? 'on' : ''}" data-star="${x.i}" title="Save">★</button><a class="btn small btn-primary" href="${esc(x.url)}" data-open="${x.i}" target="_blank" rel="noopener">Open ↗</a></span></div>`).join('')}</div>`).join('')
            || '<div class="empty small">No manuals match. Try fewer words or another filter. The source collection does not cover every model.</div>'}</div>
          ${groups.length > st.n ? `<div class="row center"><button class="btn" id="mmore">Show more (${(groups.length - st.n).toLocaleString()} models left)</button></div>` : ''}`;
        const more = $('#mmore', el); if (more) more.onclick = () => { st.n += PAGE; results(); };
        $$('[data-open]', el).forEach(a => a.onclick = e => { if (Store.s.fhwAck) return; e.preventDefault(); ackThen(() => window.open(a.href, '_blank', 'noopener')); });
        $$('[data-star]', el).forEach(b => b.onclick = () => {
          const u = d.items[+b.dataset.star].url, k = stars.indexOf(u);
          k < 0 ? stars.push(u) : stars.splice(k, 1); Store.save();
          b.classList.toggle('on', k < 0); $('#mstarN', el).textContent = stars.length; toast(k < 0 ? 'Saved to your manuals' : 'Removed');
          if (st.star) results();
        });
      }
    }
  };
})();

/* My Equipment (#/fleet, #/fleet/:id): the hospital's installed models, each with
   manuals to read in the in-app reader, the hospital's own uploaded copies, matches in
   the public manual collection, the maker's document portal, and its 3D replica. */
(function () {
  const { esc, $, $$, toast } = UI;
  const V = window.Views = window.Views || {};
  const ICON = { imaging: '⌒', angio: '✚', cath: '♥', ct: '◎', mri: '◉', nm: '☢', rf: '▦', dr: '▭', mob: '⇆', cr: '▤', dental: '◡', mammo: '◇', dxa: '⊞', us: '◖', echo: '♡', inj: '⇣' };
  const docsOf = id => ((BME.fleetDocs || {}).docs || {})[id] || [];
  const portalOf = f => ((BME.fleetDocs || {}).portals || {})[f.maker];
  const readerHref = d => '#/reader?url=' + encodeURIComponent(d.url) + '&title=' + encodeURIComponent(d.title);

  /* 3D link: CT/MRI use the manufacturer model record, others the fleet variant. */
  function x3dHref(f) {
    if (!f.eq) return '';
    return '#/3d/' + f.eq + (f.oem && BME.oem && BME.oem[f.oem] ? '?oem=' + f.oem : '?v=' + f.id);
  }

  /* Words that identify a model inside the public manual index, e.g. "LOGIQ S8" → ['logiq', 's8']. */
  const STOP = new Set(['the', 'and', 'portable', 'model', 'not', 'listed', 'system', 'smart', 'fdr', 'ct', 'mri', 'injector', 'coronary']);
  const words = f => f.model.toLowerCase().replace(/[()]/g, ' ').split(/[\s/,+]+/).map(w => w.replace(/[.\-]/g, '')).filter(w => w.length > 1 && !STOP.has(w));
  function publicMatches(f) {
    if (!V._manualsLoad) return Promise.resolve([]);
    const w = words(f), mk = f.maker.toLowerCase().split(/[\s(]/)[0];
    if (!w.length) return Promise.resolve([]);
    const find = (d, ws) => d.items.filter(x => {
      const h = x.hay.replace(/[.\-]/g, '');
      return ws.every(t => h.includes(t)) && h.includes(mk);
    });
    /* No exact model: fall back to the product family (first distinctive word), flagged as related. */
    return V._manualsLoad().then(d => {
      const l = find(d, w);
      if (l.length || w.length < 2 || w[0].length < 4 || w[0] === 'discovery') return l;
      return find(d, [w[0]]).map(x => Object.assign({ related: true }, x));
    }).catch(() => []);
  }

  V.fleetHub = function (el) {
    App.crumbs([['', 'My Equipment']]);
    const q0 = window._query || new URLSearchParams();
    const st = { mod: q0.get('mod') || '', mk: '', q: '' };
    const F = BME.fleet, mods = BME.fleetModalities;
    const makers = [...new Set(F.map(f => f.maker))].sort();
    const units = F.reduce((a, f) => a + f.count, 0);
    const withDocs = F.filter(f => docsOf(f.id).length).length;
    el.innerHTML = `<div class="page-head"><div class="eyebrow">Installed base</div><h1>My equipment</h1>
      <p>Every model in the hospital's imaging and cath-lab fleet. Open a model to read its manuals in the built-in reader (works on phones), keep the hospital's own manual copies with it, and explore its 3D replica.</p></div>
      <div class="man-stats"><div><b>${F.length}</b><small>models</small></div><div><b>${units}</b><small>units</small></div><div><b>${makers.length}</b><small>manufacturers</small></div><div><b>${withDocs}</b><small>with online documents</small></div></div>
      <div class="panel fl-filters"><input id="fq" type="search" placeholder="Search model or manufacturer… e.g. Ziehm, LOGIQ, Azurion" autocomplete="off">
        <select id="fmk"><option value="">All manufacturers</option>${makers.map(m => `<option>${esc(m)}</option>`).join('')}</select>
        <div class="chips"><button class="chip ${st.mod ? '' : 'on'}" data-mod="">All</button>${Object.entries(mods).filter(([k]) => F.some(f => f.mod === k)).map(([k, n]) => `<button class="chip ${st.mod === k ? 'on' : ''}" data-mod="${k}">${esc(n)}</button>`).join('')}</div></div>
      <div id="fres"></div>
      <p class="muted small man-src">Model names as recorded in the hospital equipment list, normalised to the manufacturer's product name (notes show the original entry where it differed). Serial numbers are not stored on this site.</p>`;
    const draw = () => {
      const w = st.q.toLowerCase().split(/\s+/).filter(Boolean);
      const list = F.filter(f => (!st.mod || f.mod === st.mod) && (!st.mk || f.maker === st.mk) && w.every(t => (f.maker + ' ' + f.model + ' ' + mods[f.mod]).toLowerCase().includes(t)));
      const groups = Object.keys(mods).map(k => [k, list.filter(f => f.mod === k)]).filter(([, l]) => l.length);
      $('#fres', el).innerHTML = groups.map(([k, l]) => `<h2 class="section-h">${ICON[k] || ''} ${esc(mods[k])} <small class="muted">${l.length} model${l.length > 1 ? 's' : ''} · ${l.reduce((a, f) => a + f.count, 0)} units</small></h2>
        <div class="fl-grid">${l.map(card).join('')}</div>`).join('') || '<div class="empty small">No equipment matches.</div>';
    };
    const card = f => {
      const n = docsOf(f.id).length;
      return `<a class="fl-card" href="#/fleet/${f.id}"><div class="fl-top"><span class="fl-ic">${ICON[f.mod] || '◆'}</span><span class="fl-count" title="Units installed">×${f.count}</span></div>
        <small>${esc(f.maker)}</small><b>${esc(f.model)}</b>
        <div class="fl-tags">${n ? `<span class="tag tag-ok">${n} doc${n > 1 ? 's' : ''}</span>` : ''}${f.eq ? '<span class="tag">3D</span>' : ''}${f.oem ? '<span class="tag tag-warn">specs + FRU</span>' : ''}</div></a>`;
    };
    let t; $('#fq', el).oninput = e => { clearTimeout(t); t = setTimeout(() => { st.q = e.target.value; draw(); }, 120); };
    $('#fmk', el).onchange = e => { st.mk = e.target.value; draw(); };
    $$('[data-mod]', el).forEach(b => b.onclick = () => { st.mod = b.dataset.mod; $$('[data-mod]', el).forEach(x => x.classList.toggle('on', x === b)); draw(); });
    draw();
  };

  V.fleet = function (el, id) {
    const f = BME.fleet.find(x => x.id === id);
    if (!f) { el.innerHTML = '<div class="empty"><h2>Equipment not found</h2><a class="btn" href="#/fleet">My equipment</a></div>'; return; }
    App.crumbs([['#/fleet', 'My Equipment'], ['', f.maker + ' ' + f.model]]);
    const eq = f.eq && BME.equipment[f.eq], docs = docsOf(f.id), portal = portalOf(f), x3 = x3dHref(f);
    const gq = s => 'https://www.google.com/search?q=' + encodeURIComponent(`"${f.maker.replace(/\s*\(.*\)/, '')} ${f.model.replace(/\s*\(.*\)/, '')}" ${s}`);
    el.innerHTML = `<section class="fl-hero"><div><div class="eyebrow">${esc(BME.fleetModalities[f.mod])} · ${f.count} unit${f.count > 1 ? 's' : ''} installed</div>
        <h1>${esc(f.model)}</h1><p>${esc(f.maker)}${f.note ? ' · ' + esc(f.note) : ''}</p>
        <div class="row gap wrap">${x3 ? `<a class="btn btn-primary" href="${x3}">⬢ 3D replica</a>` : ''}${f.oem && BME.oem && BME.oem[f.oem] ? `<a class="btn" href="#/oem/${f.oem}">◆ Specs &amp; service parts</a>` : ''}
          ${eq ? `<a class="btn" href="#/eq/${eq.id}">${esc(eq.name)} training</a>` : ''}${eq && window.Sim && Sim.has(eq.id) ? `<a class="btn" href="#/live/${eq.id}">◉ Live simulator</a>` : ''}</div></div>
        <span class="fl-hero-ic">${ICON[f.mod] || '◆'}</span></section>

      <div class="panel"><div class="row between wrap gap"><h3>Manufacturer documents online</h3>${portal ? `<a class="btn small" target="_blank" rel="noopener" href="${esc(portal.url)}">${esc(portal.name)} ↗</a>` : ''}</div>
        ${docs.length ? `<div class="fl-docs">${docs.map(d => `<div class="man-doc"><span class="man-kind s">${esc(d.type)}</span><span class="man-title">${esc(d.title)}</span>
          <span class="man-meta">${esc((d.lang || '').toUpperCase())}${d.pages ? ' · ' + d.pages + ' pages' : ''}</span>
          <span class="man-act">${d.cors ? `<a class="btn small btn-primary" href="${readerHref(d)}">Read in app</a>` : ''}<a class="btn small" target="_blank" rel="noopener" href="${esc(d.url)}">${d.cors ? 'Original ↗' : 'Open ↗'}</a></span></div>`).join('')}</div>`
          : `<p class="muted">No manufacturer-hosted manual for this exact model was found publicly online.${portal ? ` ${esc(portal.name)}${portal.login ? ' requires a customer login' : ' may have it'}${portal.note ? ' (' + esc(portal.note) + ')' : ''}.` : ''} Service manuals for this class of equipment are normally supplied only to the owner or contracted service provider.</p>`}
        ${portal && docs.length ? `<p class="muted small">${esc(portal.name)}${portal.login ? ' (customer login)' : ''}${portal.note ? ': ' + esc(portal.note) : ''}</p>` : ''}
        <div class="row gap wrap fl-search"><span class="muted small">Search the web:</span><a class="btn small" target="_blank" rel="noopener" href="${gq('service manual pdf')}">Service manual</a><a class="btn small" target="_blank" rel="noopener" href="${gq('operator manual OR "instructions for use" pdf')}">Operator manual / IFU</a><a class="btn small" target="_blank" rel="noopener" href="${gq('site planning OR installation manual pdf')}">Site planning</a></div></div>

      <div class="panel"><div class="row between wrap gap"><h3>Hospital copies</h3><label class="btn btn-primary file-btn">＋ Add manual (PDF)<input type="file" id="flUp" accept="application/pdf,.pdf" multiple hidden></label></div>
        <p class="muted small">Manuals your department holds for this model (service manual, IFU, PM checklist). They stay in this browser and open in the reader on desktop or phone.</p>
        <div id="flMine"><p class="muted">Loading…</p></div></div>

      <div class="panel"><h3>Free public collection</h3><div id="flPub"><p class="muted">Searching the service manual library…</p></div></div>`;

    const mine = () => Files.all('files').then(all => {
      const l = all.filter(d => d.fleet === f.id).sort((a, b) => b.added - a.added);
      $('#flMine', el).innerHTML = l.length ? l.map(d => `<div class="man-doc"><span class="man-kind s">${esc(d.docType || 'Manual')}</span><span class="man-title">${esc(d.name)}</span><span class="man-meta">${(d.size / 1048576).toFixed(1)} MB</span>
        <span class="man-act"><a class="btn small btn-primary" href="#/reader?doc=${d.id}">Read</a><button class="icon-btn" data-del="${d.id}" title="Remove">✕</button></span></div>`).join('')
        : '<div class="empty small">No copies added yet. Add the PDF you hold for this model.</div>';
      $$('[data-del]', el).forEach(b => b.onclick = async () => { if (confirm('Remove this manual from this device?')) { await Files.del('files', b.dataset.del); mine(); } });
    }).catch(() => { $('#flMine', el).innerHTML = '<p class="muted">File storage is unavailable in this browser mode.</p>'; });
    mine();
    $('#flUp', el).onchange = async e => {
      const files = [...e.target.files]; if (!files.length) return;
      let last = null;
      for (const file of files) {
        last = 'doc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        await Files.put('files', { id: last, name: file.name, mime: 'application/pdf', size: file.size, blob: file, docType: 'Service manual', equipment: f.eq || '', component: '', errorCode: '', fleet: f.id, pages: null, added: Date.now() });
      }
      toast(files.length > 1 ? files.length + ' manuals added' : 'Manual added');
      if (files.length === 1) location.hash = '#/reader?doc=' + last; else mine();
    };

    publicMatches(f).then(l => {
      const box = $('#flPub', el); if (!box) return;
      const rel = l.length && l[0].related;
      box.innerHTML = l.length ? `<p class="muted small">${rel ? `<b>No document for this exact model.</b> ${l.length} for related models of the same family (useful for principles and circuits, but check every procedure against your model)` : `${l.length} document${l.length > 1 ? 's' : ''} for this model`} in the free collection at Frank's Hospital Workshop. That site cannot be read inside other web apps, so open it, download the PDF, then use <b>Add manual</b> above to read it here.</p>
        ${l.slice(0, 20).map(x => `<div class="man-doc"><span class="man-kind ${x.kind ? 'u' : 's'}">${x.kind ? 'User' : 'Service'}</span><span class="man-title"><b>${esc(x.model)}</b> · ${esc(x.doc)}</span><span class="man-meta">${esc(x.size)}</span>
          <span class="man-act"><a class="btn small" target="_blank" rel="noopener" href="${esc(x.url)}">Download ↗</a></span></div>`).join('')}
        ${l.length > 20 ? `<a class="btn small" href="#/manuals?q=${encodeURIComponent(words(f).join(' '))}">All ${l.length} ›</a>` : ''}`
        : `<p class="muted">No match for this model in the free collection. <a href="#/manuals?q=${encodeURIComponent(f.maker.split(/[\s(]/)[0])}">Browse ${esc(f.maker.split(/[\s(]/)[0])} manuals ›</a></p>`;
    });
  };
})();

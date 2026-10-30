/* Manufacturer model reference (#/oem, #/oem/:id): CT and MRI families with
   published specs, 3D replica, and a field-replaceable-unit service-parts catalogue. */
(function () {
  const { esc, $, $$, toast } = UI;
  const V = window.Views = window.Views || {};
  const EQN = { ct: 'CT', mri: 'MRI' };

  V.oemHub = function (el) {
    App.crumbs([['', 'CT & MRI Models']]);
    const q = window._query || new URLSearchParams();
    let mk = q.get('maker') || 'all', mod = q.get('eq') || 'all';
    const render = () => {
      const list = Object.values(BME.oem).filter(o => (mk === 'all' || o.maker === mk) && (mod === 'all' || o.equipment === mod));
      el.innerHTML = `<div class="page-head"><div class="eyebrow">Manufacturer reference</div><h1>CT &amp; MRI models</h1>
        <p>GE HealthCare, Siemens Healthineers and Philips CT and MRI families: published specifications, a stylised 3D replica, and the service-parts (FRU) catalogue with symptoms, diagnosis, replacement and safety notes for every major unit.</p></div>
        <div class="oem-filters"><div class="chips">${[['all', 'All makers'], ...Object.entries(BME.oemMakers).map(([k, v]) => [k, v.name])].map(([k, l]) => `<button class="chip ${mk === k ? 'on' : ''}" data-mk="${k}">${esc(l)}</button>`).join('')}</div>
          <div class="chips">${[['all', 'CT + MRI'], ['ct', 'CT'], ['mri', 'MRI']].map(([k, l]) => `<button class="chip ${mod === k ? 'on' : ''}" data-mod="${k}">${l}</button>`).join('')}</div></div>
        <div class="oem-grid">${list.map(card).join('')}</div>
        <p class="muted small oem-note">${esc(BME.OEM_NOTE)}</p>`;
      $$('[data-mk]', el).forEach(b => b.onclick = () => { mk = b.dataset.mk; render(); });
      $$('[data-mod]', el).forEach(b => b.onclick = () => { mod = b.dataset.mod; render(); });
    };
    render();
  };

  function card(o) {
    const c = BME.oemMakers[o.maker].color;
    return `<a class="oem-card" href="#/oem/${o.id}" style="--oc:${c}">
      <div class="oem-art">${art(o)}</div>
      <div class="oem-body"><small>${esc(o.makerName)} · ${EQN[o.equipment]}</small><b>${esc(o.name)}</b><span>${esc(o.tagline)}</span>
      <div class="oem-specs">${o.specs.slice(0, 3).map(([k, v]) => `<div><i>${esc(k)}</i>${esc(v)}</div>`).join('')}</div></div></a>`;
  }

  /* Small SVG silhouette in the model's styling (no logos). */
  function art(o) {
    const L = o.look, hex = n => '#' + n.toString(16).padStart(6, '0'), r = o.equipment === 'ct' ? 26 * L.bore / 70 : 20 * L.bore / 70;
    if (o.equipment === 'ct') return `<svg viewBox="0 0 160 100" aria-hidden="true"><rect x="40" y="86" width="80" height="8" rx="3" fill="#9aa7b8"/>
      <rect x="38" y="8" width="84" height="80" rx="${84 * L.round * .5}" fill="${hex(L.cover)}" stroke="#c3cddb"/><circle cx="80" cy="48" r="${r + 6}" fill="${hex(L.accent)}"/>
      <circle cx="80" cy="48" r="${r + 2.5}" fill="none" stroke="${hex(L.light)}" stroke-width="1.6"/><circle cx="80" cy="48" r="${r}" fill="#0b1322"/>
      <rect x="4" y="58" width="90" height="6" rx="3" fill="#e8edf3"/><rect x="20" y="64" width="22" height="26" rx="3" fill="#d5dde8"/></svg>`;
    return `<svg viewBox="0 0 160 100" aria-hidden="true"><rect x="22" y="80" width="116" height="12" rx="4" fill="#9aa7b8"/>
      <rect x="${80 - 50 * L.len / 1.7}" y="10" width="${100 * L.len / 1.7}" height="74" rx="30" fill="${hex(L.cover)}" stroke="#c3cddb"/>
      <ellipse cx="80" cy="47" rx="${34 * L.flare / 1.08}" ry="${38 * L.flare / 1.08}" fill="${hex(L.accent)}"/><ellipse cx="80" cy="47" rx="${r + 3}" ry="${r + 4}" fill="none" stroke="${hex(L.light)}" stroke-width="1.6"/>
      <ellipse cx="80" cy="47" rx="${r}" ry="${r + 1}" fill="#0b1322"/><rect x="0" y="56" width="74" height="6" rx="3" fill="#e8edf3"/><text x="150" y="20" text-anchor="end" font-size="10" font-weight="700" fill="${hex(L.accent)}">${esc(L.field || '')}</text></svg>`;
  }

  V.oem = function (el, id) {
    const o = BME.oem[id];
    if (!o) { el.innerHTML = '<div class="empty"><h2>Model not found</h2><a class="btn" href="#/oem">All models</a></div>'; return; }
    App.crumbs([['#/oem', 'CT & MRI Models'], ['', o.makerName + ' ' + o.name]]);
    const parts = BME.oemParts(id), eq = BME.ensure(BME.equipment[o.equipment]);
    const pn = (Store.s.oemPN = Store.s.oemPN || {})[id] = Store.s.oemPN[id] || {};
    const cats = [...new Set(parts.map(p => p.cat))];
    const c = BME.oemMakers[o.maker].color;
    el.innerHTML = `<section class="oem-hero" style="--oc:${c}">
        <div class="oem-hero-text"><div class="eyebrow">${esc(o.makerName)} · ${EQN[o.equipment]} · ${esc(o.family)}</div><h1>${esc(o.name)}</h1><p>${esc(o.tagline)}</p>
          <div class="row gap wrap"><a class="btn btn-primary" href="#/3d/${o.equipment}?oem=${o.id}">⬢ 3D replica</a><a class="btn" href="#/live/${o.equipment}">◉ Live simulator</a><a class="btn" href="#/eq/${o.equipment}">${EQN[o.equipment]} training module</a></div></div>
        <div class="oem-hero-art">${art(o)}</div></section>
      <div class="two-col">
        <div class="panel"><h3>Published specifications</h3><table class="table oem-spec"><tbody>${o.specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>
          <p class="muted small">Typical published values for orientation; options and configurations differ. Verify against the current datasheet for the installed system.</p></div>
        <div class="panel"><h3>What engineers should know</h3><ul class="oem-hl">${o.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
          <div class="warn-banner small">⚠ Model-specific procedure required. Service procedures, calibrations, error codes and part numbers come only from the manufacturer's current service documentation and authorised training.</div></div>
      </div>
      <div class="panel"><div class="row between wrap gap"><h3 style="margin:0">Service parts catalogue (FRU) <span class="tag">${parts.length} units</span></h3>
        <div class="row gap wrap"><input id="fq" placeholder="Search parts, symptoms…" style="width:220px"><button class="btn small" id="fexp">Expand all</button><button class="btn small" id="fpdf">⎙ Print</button></div></div>
        <div class="chips" id="fcat" style="margin:12px 0"><button class="chip on" data-c="">All</button>${cats.map(k => `<button class="chip" data-c="${esc(k)}">${esc(k)}</button>`).join('')}</div>
        <div id="flist" class="fru-list"></div></div>
      <div class="panel"><h3>PM focus for this system class</h3><div class="pm-focus">${parts.filter(p => p.pm && p.pm !== '—').map(p => `<div><b>${esc(p.oemName || p.name)}</b><span>${esc(p.pm)}</span></div>`).join('')}</div></div>
      <p class="muted small oem-note">${esc(BME.OEM_NOTE)}</p>`;

    let cat = '', q = '', all = false;
    const li = a => `<ul>${(a || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    const draw = () => {
      const f = parts.filter(p => (!cat || p.cat === cat) && (!q || JSON.stringify(p).toLowerCase().includes(q)));
      $('#flist', el).innerHTML = f.map(p => `<details class="fru" ${all ? 'open' : ''}><summary><span class="fru-crit c-${p.crit.toLowerCase()}">${esc(p.crit)}</span><b>${esc(p.oemName || p.name)}</b><small>${esc(p.cat)}${p.oemName ? ' · ' + esc(p.name) : ''}</small></summary>
        <div class="fru-body">
          <div class="fru-fn">${esc(p.fn)}</div>
          <div class="fru-grid">
            <div><h4>Failure symptoms</h4>${li(p.sym)}</div>
            <div><h4>Diagnosis</h4>${li(p.diag)}</div>
            <div><h4>Replacement &amp; after-replacement</h4><p>${esc(p.replace)}</p>${p.life ? `<p class="muted small">${esc(p.life)}</p>` : ''}</div>
            <div><h4>PM</h4><p>${esc(p.pm)}</p><h4>Safety</h4>${li(p.safety)}</div>
          </div>
          <div class="fru-foot"><label>Hospital part-number record <input data-pn="${p.id}" value="${esc(pn[p.id] || '')}" placeholder="Enter from manufacturer parts portal"></label>
            <a class="btn small" href="#/3d/${o.equipment}?oem=${o.id}">View in 3D</a><a class="btn small" href="#/report/new?eq=${o.equipment}">✎ Service report</a></div>
        </div></details>`).join('') || '<p class="muted">No parts match.</p>';
      $$('[data-pn]', el).forEach(i => i.onchange = () => { pn[i.dataset.pn] = i.value.trim(); Store.save(); toast('Part number saved for this model'); });
    };
    $('#fq', el).oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    $('#fcat', el).onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; $$('#fcat .chip', el).forEach(x => x.classList.toggle('on', x === b)); draw(); };
    $('#fexp', el).onclick = e => { all = !all; e.target.textContent = all ? 'Collapse all' : 'Expand all'; draw(); };
    $('#fpdf', el).onclick = () => { all = true; draw(); setTimeout(() => window.print(), 50); };
    draw();
  };

  V._oemArt = art;
})();

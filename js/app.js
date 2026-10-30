/* App shell: hash router, navigation, global search, theme, full-screen, QR scan. */
(function () {
  const { esc, $, $$ } = UI;
  window.Views = window.Views || {};

  const NAV = [
    ['Overview', [['#/', '◈', 'Dashboard'], ['#/library', '⚙', 'Equipment Training'], ['#/levels', '▤', 'Training Levels']]],
    ['Real-time', [['#/live', '◉', 'Live Simulators'], ['#/3d', '⬢', '3D Machine Explorer'], ['#/oem', '◆', 'CT & MRI Models'], ['#/dicom-viewer', '▣', 'DICOM Viewer']]],
    ['Service', [['#/service', '⚒', 'Service Engineer Mode'], ['#/simlab', '⚠', 'Fault Simulation Lab'], ['#/cases', '☎', 'Service Cases'], ['#/errors', '⌕', 'Error Code Explorer']]],
    ['Maintenance & QA', [['#/pm', '✓', 'Preventive Maintenance'], ['#/qa', '◎', 'QA & Performance'], ['#/safety', '⚡', 'Electrical & Safety']]],
    ['Fundamentals', [['#/tools', '⚖', 'Service Tools Lab'], ['#/dicom', '⇄', 'DICOM / Network'], ['#/image-quality', '◐', 'Image Quality'], ['#/manufacturers', '⌂', 'Manufacturers']]],
    ['Records', [['#/assets', '⌗', 'Equipment & QR'], ['#/reports', '✎', 'Service Reports'], ['#/manuals', '▥', 'Service Manuals'], ['#/documents', '❐', 'Reference Library']]],
    ['You', [['#/assessment', '★', 'Assessment'], ['#/progress', '▲', 'My Progress'], ['#/admin', '⚙', 'Admin']]]
  ];

  function renderNav() {
    const cur = (location.hash || '#/').split('?')[0];
    $('#nav').innerHTML = NAV.map(([g, items]) => `<div class="nav-group"><div class="nav-title">${g}</div>${items.map(([h, i, l]) =>
      `<a href="${h}" class="${(cur === h || (h !== '#/' && cur.startsWith(h + '/'))) ? 'active' : ''}"><span class="ni">${i}</span>${l}</a>`).join('')}</div>`).join('');
    const lvl = Store.level(); const L = BME.LEVELS[lvl - 1];
    $('#levelChip').innerHTML = `<small>Training level</small><b>L${lvl} · ${L.name}</b><div class="lvl-dots">${BME.LEVELS.map(x => `<i class="${x.n <= lvl ? 'on' : ''}"></i>`).join('')}</div>`;
  }

  /* Breadcrumbs are set by views via App.crumbs([...]). */
  function crumbs(list) {
    $('#crumbs').innerHTML = [['#/', 'Home']].concat(list || []).map(([h, l], i, a) =>
      i === a.length - 1 ? `<span>${esc(l)}</span>` : `<a href="${h}">${esc(l)}</a><i>›</i>`).join('');
  }

  const ROUTES = [
    [/^#?\/?$/, 'dashboard'], [/^#\/library(?:\/(\w+))?$/, 'library'], [/^#\/eq\/([\w-]+)(?:\/(\w+))?$/, 'equipment'],
    [/^#\/levels$/, 'levels'], [/^#\/service(?:\/([\w-]+))?$/, 'service'], [/^#\/simlab$/, 'simlab'], [/^#\/sim\/([\w-]+)$/, 'scenario'],
    [/^#\/cases$/, 'cases'], [/^#\/case\/([\w-]+)$/, 'case'], [/^#\/errors$/, 'errors'], [/^#\/pm$/, 'pmHub'],
    [/^#\/qa$/, 'qaHub'], [/^#\/safety(?:\/([\w-]+))?$/, 'safety'], [/^#\/fundamentals$/, 'fundamentals'], [/^#\/tools(?:\/([\w-]+))?$/, 'tools'],
    [/^#\/dicom$/, 'dicom'], [/^#\/image-quality$/, 'imageQuality'], [/^#\/manufacturers(?:\/([\w-]+))?$/, 'manufacturers'],
    [/^#\/assets$/, 'assets'], [/^#\/asset\/([\w-]+)$/, 'asset'], [/^#\/reports$/, 'reports'], [/^#\/report\/([\w-]+)$/, 'report'],
    [/^#\/documents$/, 'documents'], [/^#\/assessment(?:\/([\w-]+))?$/, 'assessment'], [/^#\/progress$/, 'progress'], [/^#\/admin$/, 'admin'],
    [/^#\/live$/, 'liveHub'], [/^#\/live\/([\w-]+)$/, 'live'], [/^#\/3d$/, 'x3dHub'], [/^#\/3d\/([\w-]+)$/, 'x3d'], [/^#\/dicom-viewer$/, 'dicomViewer'], [/^#\/oem$/, 'oemHub'], [/^#\/oem\/([\w-]+)$/, 'oem'], [/^#\/manuals$/, 'manuals']
  ];

  function route() {
    const [h, qs] = (location.hash || '#/').split('?');
    window._query = new URLSearchParams(qs || '');
    let view = null, params = [];
    for (const [re, name] of ROUTES) { const m = h.match(re); if (m) { view = name; params = m.slice(1); break; } }
    renderNav();
    window.Sim && Sim.stop(); window.X3D && X3D.stop();
    const el = $('#view');
    el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
    if (!view || !Views[view]) { crumbs([['', 'Not found']]); el.innerHTML = '<div class="empty"><h2>Page not found</h2><a class="btn" href="#/">Back to dashboard</a></div>'; return; }
    try { Views[view](el, ...params.map(p => p && decodeURIComponent(p))); }
    catch (e) { console.error(e); el.innerHTML = `<div class="empty"><h2>Something went wrong</h2><pre>${esc(e.message)}</pre></div>`; }
    if (!h.startsWith('#/eq/') || !window._keepScroll) window.scrollTo(0, 0);
    window._keepScroll = false;
    document.body.classList.remove('nav-open');
  }

  /* ---------- Global search ---------- */
  function searchIndex() {
    const out = [];
    Object.values(BME.equipment).forEach(e => {
      out.push({ t: e.name, s: 'Equipment · ' + ((BME.categories.find(c => c.id === e.category) || {}).name || ''), h: '#/eq/' + e.id });
      Object.entries(e.components || {}).forEach(([cid, c]) => out.push({ t: c.name, s: 'Component · ' + e.name, h: '#/eq/' + e.id + '/components', comp: cid }));
      (e.errors || []).forEach(er => out.push({ t: er.code + ' — ' + er.desc, s: 'Error code · ' + e.name, h: '#/eq/' + e.id + '/errors' }));
      (e.troubleshoot || []).forEach(t => out.push({ t: t.symptom, s: 'Symptom · ' + e.name, h: '#/service/' + e.id }));
    });
    Store.s.custom.errors.forEach(er => out.push({ t: er.code + ' — ' + er.desc, s: 'Error code · custom', h: '#/errors' }));
    Object.values(BME.cases).forEach(c => out.push({ t: c.title, s: 'Service case', h: '#/case/' + c.id }));
    Object.values(BME.scenarios).forEach(c => out.push({ t: c.title, s: 'Fault simulation', h: '#/sim/' + c.id }));
    Object.values(BME.tools).forEach(c => out.push({ t: c.name, s: 'Service tool', h: '#/tools/' + c.id }));
    BME.safetyTopics.forEach(c => out.push({ t: c.name, s: 'Safety', h: '#/safety/' + c.id }));
    return out;
  }
  function wireSearch() {
    const inp = $('#globalSearch'), box = $('#searchResults');
    inp.addEventListener('input', () => {
      const q = inp.value.trim().toLowerCase();
      if (q.length < 2) { box.classList.remove('open'); return; }
      const res = searchIndex().filter(r => (r.t + ' ' + r.s).toLowerCase().includes(q)).slice(0, 12);
      box.innerHTML = res.length ? res.map(r => `<a href="${r.h}" data-comp="${r.comp || ''}"><b>${esc(r.t)}</b><small>${esc(r.s)}</small></a>`).join('') : '<div class="sr-empty">No results</div>';
      box.classList.add('open');
    });
    box.addEventListener('click', e => {
      const a = e.target.closest('a'); if (!a) return;
      if (a.dataset.comp) window._openComp = a.dataset.comp;
      box.classList.remove('open'); inp.value = '';
    });
    document.addEventListener('click', e => { if (!e.target.closest('.search-wrap')) box.classList.remove('open'); });
    document.addEventListener('keydown', e => { if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); inp.focus(); } });
  }

  /* ---------- Theme ---------- */
  function applyTheme() {
    const t = Store.s.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
  }

  /* ---------- QR scanning ---------- */
  function openScanner() {
    const c = UI.modal(`<h2>Scan equipment QR</h2><p class="muted">Point the camera at an equipment QR label.</p><div id="qrReader" class="qr-reader"></div>
      <div class="row gap"><input id="qrManual" placeholder="…or type asset ID / paste URL"><button class="btn" id="qrGo">Open</button></div>`);
    const go = txt => {
      const m = String(txt).match(/asset\/([\w-]+)/) || String(txt).match(/^([\w-]+)$/);
      if (m) { stop(); UI.closeModal(); location.hash = '#/asset/' + m[1]; } else UI.toast('Not a recognised equipment QR');
    };
    let scanner = null;
    const stop = () => { try { scanner && scanner.stop(); } catch (e) { /* already stopped */ } };
    $('#qrGo', c).onclick = () => go($('#qrManual', c).value.trim());
    if (window.Html5Qrcode) {
      scanner = new Html5Qrcode('qrReader');
      scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 230 }, go).catch(() => {
        $('#qrReader', c).innerHTML = '<div class="empty small">Camera unavailable (needs HTTPS or localhost and permission). Use manual entry.</div>';
      });
      $('#modal').addEventListener('click', function h(e) { if (e.target.matches('[data-close]') || e.target.id === 'modal') { stop(); $('#modal').removeEventListener('click', h); } });
    } else $('#qrReader', c).innerHTML = '<div class="empty small">QR library not loaded (offline). Use manual entry.</div>';
  }

  window.App = { crumbs, route, renderNav, openScanner };

  document.addEventListener('DOMContentLoaded', () => {
    applyTheme();
    $('#themeBtn').onclick = () => { Store.s.theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'; Store.save(); applyTheme(); };
    $('#fsBtn').onclick = () => {
      document.body.classList.toggle('focus-mode');
      if (document.body.classList.contains('focus-mode') && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen();
    };
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) document.body.classList.remove('focus-mode'); });
    $('#menuBtn').onclick = () => document.body.classList.toggle('nav-open');
    $('#scanBtn').onclick = openScanner;
    wireSearch();
    window.addEventListener('hashchange', route);
    route();
  });
})();

/* PDF Reader (#/reader): Acrobat-style viewer for service manuals, schematics and datasheets.
   Route params: ?doc=<library id> or ?url=<http(s) link to a PDF>, plus optional &page=<n> and &q=<search>.
   Without a document it shows a landing screen (open from device / URL, library, recently read).
   Continuous scroll with lazy HiDPI rendering of only the visible pages (+-2), selectable text layer,
   clickable links, thumbnails / outline / bookmarks / search sidebar, pinch-zoom, night mode,
   password-protected PDFs. Reuse from other views: Views._openInReader(blobOrFile, name). */
(function () {
  const { esc, $, $$, toast } = UI;
  const V = window.Views = window.Views || {};

  const PX = 96 / 72;                 // 100 % = real size (1 pt = 1/72 in)
  const ZOOMS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];
  const PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const MINZ = 0.25, MAXZ = 5;
  const MAXPX = 16777216;             // iOS canvas limit (16.7 M pixels)
  const CDN = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  let S = null;        // the open document session
  let pending = null;  // blob handed over by _openInReader when library storage failed

  const I = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    side: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    up: '<path d="M18 15l-6-6-6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
    minus: '<path d="M5 12h14"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    rotate: '<path d="M20 11a8 8 0 1 0-2.3 6.2"/><path d="M20 4v7h-7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    moon: '<path d="M20.5 13.4A8.5 8.5 0 1 1 10.6 3.5a6.6 6.6 0 0 0 9.9 9.9z"/>',
    expand: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    shrink: '<path d="M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
    more: '<circle cx="5" cy="12" r="1.4" class="f"/><circle cx="12" cy="12" r="1.4" class="f"/><circle cx="19" cy="12" r="1.4" class="f"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01" stroke-width="2.6"/>',
    pages: '<rect x="4" y="3" width="7" height="8" rx="1"/><rect x="13" y="3" width="7" height="8" rx="1"/><rect x="4" y="13" width="7" height="8" rx="1"/><rect x="13" y="13" width="7" height="8" rx="1"/>',
    outline: '<path d="M4 5h16M8 10h12M8 15h12M4 20h16"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    fitw: '<path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4"/>',
    fitp: '<rect x="6" y="3" width="12" height="18" rx="1.5"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  const ico = n => `<svg viewBox="0 0 24 24" class="rd-i" aria-hidden="true">${I[n]}</svg>`;

  /* ---------- small helpers ---------- */
  const st = () => {
    const s = Store.s;
    s.readerPos = s.readerPos || {}; s.readerRecent = s.readerRecent || []; s.readerMarks = s.readerMarks || {};
    if (s.readerSave == null) s.readerSave = true;
    return s;
  };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const fmtSize = b => !b ? '' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
  const isPdf = r => !!r && (/pdf/i.test(r.mime || r.type || '') || /\.pdf$/i.test(r.name || ''));
  const mobile = () => matchMedia('(max-width: 860px)').matches;
  const newId = () => 'doc' + Date.now().toString(36);
  const urlName = u => { try { return decodeURIComponent(new URL(u).pathname.split('/').pop()) || 'Document.pdf'; } catch (e) { return 'Document.pdf'; } };
  const idle = () => new Promise(r => setTimeout(r, 0));
  function lib() {
    const L = window.pdfjsLib; if (!L) return null;
    if (!L.GlobalWorkerOptions.workerSrc) L.GlobalWorkerOptions.workerSrc = WORKER;
    return L;
  }
  function on(s, t, type, fn, opts) { t.addEventListener(type, fn, opts); s.off.push(() => t.removeEventListener(type, fn, opts)); }
  /* Listener on window/document: removes itself once the viewer is gone. */
  function onG(s, t, type, fn, opts) { on(s, t, type, e => { if (S !== s) return; if (!s.root.isConnected) return stop(); fn(e); }, opts); }

  /* ======================= Route entry ======================= */
  V.reader = function (el) {
    el.classList.remove('enter'); // the enter animation's transform would anchor our fixed layout to #view
    const q = window._query || new URLSearchParams();
    const id = q.get('doc'), url = q.get('url');
    const key = id ? 'f:' + id : url ? 'u:' + url : null;
    if (S && key && S.key === key && S.root.isConnected && S.el === el && !S.dead) { // same document: navigate in place
      crumbs(S); if (S.pdf) applyParams(S, q); return;
    }
    stop();
    if (pending && !id && !url) { const p = pending; pending = null; return openViewer(el, { name: p.name, blob: p.blob, key: 'l:' + p.name + ':' + p.blob.size }, q); }
    if (id) {
      openViewer(el, { id, key, name: 'Opening…', loadRec: true }, q);
      return;
    }
    if (url) return openViewer(el, { url, key, name: q.get('title') || urlName(url) }, q);
    landing(el);
  };

  V._readerStop = stop;
  V._openInReader = async function (blob, name) {
    name = name || (blob && blob.name) || 'Document.pdf';
    const id = newId();
    try {
      await Files.put('files', { id, name, mime: blob.type || 'application/pdf', size: blob.size, blob, docType: 'Service manual', equipment: '', component: '', errorCode: '', pages: null, added: Date.now() });
      location.hash = '#/reader?doc=' + id;
      return id;
    } catch (e) {
      pending = { blob, name };
      if (location.hash === '#/reader') App.route(); else location.hash = '#/reader';
      return null;
    }
  };

  window.addEventListener('hashchange', () => { if (S && !/^#\/reader(\?|$)/.test(location.hash)) stop(); });

  function crumbs(s) { App.crumbs([['#/documents', 'Reference Library'], ['', s ? s.name : 'PDF Reader']]); }

  /* ======================= Landing ======================= */
  function landing(el) {
    crumbs(null);
    const set = st();
    el.innerHTML = `<div class="rd-landing">
      <div class="page-head"><div class="eyebrow">Reference Library</div><h1>PDF Reader</h1>
        <p>Read service manuals, schematics and datasheets with search, thumbnails, the document outline and page bookmarks. Your place in every document is remembered.</p></div>
      <div class="rd-land">
        <div class="panel rd-drop" id="rdDrop">
          <div class="rd-drop-ic">${ico('file')}</div>
          <h2>Drop a PDF here</h2>
          <p class="muted">or choose one from this device</p>
          <label class="btn btn-primary rd-pick">${ico('upload')} Open PDF from device<input type="file" accept="application/pdf,.pdf" class="rd-vh" id="rdFile"></label>
          <div><label class="switch"><input type="checkbox" id="rdSave" ${set.readerSave ? 'checked' : ''}><span></span>Save to my library</label></div>
          <div class="rd-or"><span>or open from a web address</span></div>
          <form class="rd-urlf" id="rdUrlF"><input type="url" id="rdUrl" placeholder="https://example.com/service-manual.pdf" required autocomplete="off" inputmode="url"><button class="btn">${ico('link')} Open</button></form>
          <div id="rdUrlErr"></div>
        </div>
        <div class="panel rd-recent"><h3>${ico('clock')} Recently read</h3><div id="rdRecent" class="rd-docs"><div class="muted small">Loading…</div></div></div>
      </div>
      <div class="panel"><div class="row between wrap gap"><h3 style="margin:0">PDFs in your library</h3><a class="btn small" href="#/documents">Manage library</a></div>
        <div id="rdLib" class="rd-docs rd-libgrid"><div class="muted small">Loading…</div></div></div>
    </div>`;
    const root = $('.rd-landing', el), drop = $('#rdDrop', el);
    $('#rdFile', el).onchange = e => { const f = e.target.files[0]; if (f) openLocal(el, f); };
    $('#rdSave', el).onchange = e => { st().readerSave = e.target.checked; Store.save(); };
    $('#rdUrlF', el).onsubmit = e => {
      e.preventDefault();
      const u = $('#rdUrl', el).value.trim(); if (!u) return;
      location.hash = '#/reader?url=' + encodeURIComponent(u);
    };
    root.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
    root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) drop.classList.remove('over'); });
    root.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('over');
      const f = [...(e.dataTransfer.files || [])].find(isPdf);
      if (f) openLocal(el, f); else toast('Drop a PDF file');
    });
    listDocs(el);
  }

  async function listDocs(el) {
    const set = st();
    let docs = [];
    try { docs = (await Files.all('files')).filter(isPdf).sort((a, b) => (b.added || 0) - (a.added || 0)); }
    catch (e) { const l = $('#rdLib', el); if (l) l.innerHTML = '<div class="empty small">Document storage (IndexedDB) is unavailable in this browser mode. You can still open PDFs from the device.</div>'; }
    const libEl = $('#rdLib', el), recEl = $('#rdRecent', el);
    if (!libEl || !recEl) return;
    const prog = key => {
      const p = set.readerPos[key];
      if (!p || !p.pages) return '<span class="rd-doc-p muted">Not opened yet</span>';
      return `<span class="rd-doc-p"><small>p. ${p.page} / ${p.pages}</small><i><b style="width:${Math.round(p.page / p.pages * 100)}%"></b></i></span>`;
    };
    const row = (href, name, sub, key) => `<a class="rd-doc" href="${href}"><span class="rd-doc-ic">PDF</span><span class="rd-doc-t"><b title="${esc(name)}">${esc(name)}</b><small>${sub}</small></span>${prog(key)}</a>`;
    libEl.innerHTML = docs.length ? docs.map(d => row('#/reader?doc=' + encodeURIComponent(d.id), d.name,
      esc([fmtSize(d.size), d.docType, UI.fmtDate(d.added)].filter(Boolean).join(' · ')), 'f:' + d.id)).join('')
      : (libEl.innerHTML.includes('IndexedDB') ? libEl.innerHTML : '<div class="empty small">No PDFs in your library yet. Open one from this device with “Save to my library” ticked, or add it in the Reference Library.</div>');
    const ids = new Set(docs.map(d => d.id));
    const rec = set.readerRecent.filter(r => (r.id && ids.has(r.id)) || (!r.id && r.url)).slice(0, 8);
    recEl.innerHTML = rec.length ? rec.map(r => row(r.id ? '#/reader?doc=' + encodeURIComponent(r.id) : '#/reader?url=' + encodeURIComponent(r.url), r.name,
      esc((r.url && !r.id ? 'Web · ' : '') + UI.ago(r.t)), r.key)).join('')
      : '<div class="empty small">Documents you read appear here.</div>';
  }

  function openLocal(el, file) {
    if (!isPdf(file)) { toast('That file is not a PDF'); return; }
    openViewer(el, { name: file.name, blob: file, key: 'l:' + file.name + ':' + file.size, save: st().readerSave }, new URLSearchParams());
  }

  /* ======================= Viewer ======================= */
  async function openViewer(el, src, q) {
    stop();
    const s = S = {
      el, src, key: src.key, id: src.id || null, url: src.url || null, name: src.name || 'Document', blob: src.blob || null,
      q: q || new URLSearchParams(), pages: [], vis: new Set(), live: new Set(), text: {}, N: 0, cur: 1,
      search: { q: '', raw: '', hits: [], byPage: {}, cur: -1, done: true, scanned: 0 },
      off: [], urls: [], busy: 0, tBusy: 0, tWant: new Set(), tDone: new Set(), zoom: 1, scale: PX, mode: 'fit-width', rot: 0, dead: false
    };
    build(s);
    crumbs(s);
    if (!lib()) return fail(s, { code: 'engine' });
    let data;
    try {
      if (src.loadRec) {
        const rec = await Files.get('files', src.id);
        if (!rec || !rec.blob) throw Object.assign(new Error('not found'), { code: 'missing' });
        s.blob = rec.blob; s.name = rec.name || 'Document.pdf'; s.rec = rec;
        setTitle(s); crumbs(s);
      }
      if (s.blob) data = await s.blob.arrayBuffer();
      else {
        data = await fetchPdf(s.url, f => setProg(s, f));
        if (s.dead) return;
        s.blob = new Blob([data], { type: 'application/pdf' });
      }
    } catch (e) { if (!s.dead) fail(s, e); return; }
    if (s.dead) return;
    load(s, data);
  }

  async function fetchPdf(url, onProg) {
    let r;
    try { r = await fetch(url, { mode: 'cors' }); }
    catch (e) { throw Object.assign(new Error('blocked'), { code: 'fetch' }); }
    if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status), { code: 'http', status: r.status });
    const total = +r.headers.get('content-length') || 0;
    if (!r.body || !r.body.getReader) return r.arrayBuffer();
    const rd = r.body.getReader(), chunks = []; let got = 0;
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      chunks.push(value); got += value.length; onProg(total ? got / total : -1);
    }
    const out = new Uint8Array(got); let o = 0;
    chunks.forEach(c => { out.set(c, o); o += c.length; });
    return out.buffer;
  }

  async function load(s, data) {
    const L = lib();
    s.pwCancelled = false;
    const task = s.task = L.getDocument({ data, cMapUrl: CDN + 'cmaps/', cMapPacked: true, standardFontDataUrl: CDN + 'standard_fonts/', isEvalSupported: false });
    task.onProgress = p => { if (p.total) setProg(s, p.loaded / p.total); };
    task.onPassword = (update, reason) => {
      askPassword(s, reason === L.PasswordResponses.INCORRECT_PASSWORD).then(pw => {
        if (pw == null) { s.pwCancelled = true; update(new Error('Password entry cancelled')); } else update(pw);
      });
    };
    let pdf;
    try { pdf = await task.promise; }
    catch (e) {
      if (s.dead) return;
      return fail(s, s.pwCancelled ? { code: 'locked' } : e);
    }
    if (s.dead) { pdf.destroy(); return; }
    s.pdf = pdf;
    try { await start(s); } catch (e) { if (!s.dead) { console.error(e); fail(s, e); } }
  }

  /* ---------- DOM ---------- */
  function build(s) {
    const set = st();
    const zopts = `<option value="cur" hidden>100%</option><option value="fit-width">Fit width</option><option value="fit-page">Fit page</option>${PRESETS.map(z => `<option value="${z}">${Math.round(z * 100)}%</option>`).join('')}`;
    s.el.innerHTML = `<div class="rd-root rd-loading${set.readerNight ? ' rd-night' : ''}" tabindex="-1">
      <div class="rd-bar" role="toolbar" aria-label="PDF toolbar">
        <div class="rd-l">
          <button class="rd-btn" data-act="back" title="Back to library" aria-label="Back to library">${ico('back')}</button>
          <button class="rd-btn rd-hm" data-act="side" title="Sidebar: pages, outline, bookmarks" aria-label="Toggle sidebar">${ico('side')}</button>
          <div class="rd-title" title="${esc(s.name)}">${esc(s.name)}</div>
        </div>
        <div class="rd-c">
          <button class="rd-btn rd-hm" data-act="prev" title="Previous page" aria-label="Previous page">${ico('up')}</button>
          <button class="rd-btn rd-hm" data-act="next" title="Next page" aria-label="Next page">${ico('down')}</button>
          <input class="rd-pnum" value="1" inputmode="numeric" enterkeyhint="go" aria-label="Page number" autocomplete="off"><span class="rd-ptot">/ –</span>
          <span class="rd-sep rd-hm"></span>
          <button class="rd-btn" data-act="zout" title="Zoom out (Ctrl −)" aria-label="Zoom out">${ico('minus')}</button>
          <select class="rd-zsel rd-hm" aria-label="Zoom">${zopts}</select>
          <button class="rd-btn" data-act="zin" title="Zoom in (Ctrl +)" aria-label="Zoom in">${ico('plus')}</button>
        </div>
        <div class="rd-r">
          <button class="rd-btn rd-ht" data-act="rotate" title="Rotate clockwise" aria-label="Rotate">${ico('rotate')}</button>
          <span class="rd-sep rd-ht"></span>
          <button class="rd-btn" data-act="search" title="Search (Ctrl F)" aria-label="Search">${ico('search')}</button>
          <button class="rd-btn rd-ht${set.readerNight ? ' on' : ''}" data-act="night" title="Night mode" aria-label="Night mode">${ico('moon')}</button>
          <button class="rd-btn rd-ht" data-act="fs" title="Full screen" aria-label="Full screen">${ico('expand')}</button>
          <button class="rd-btn rd-ht" data-act="download" title="Download original" aria-label="Download">${ico('download')}</button>
          <button class="rd-btn rd-savebtn" data-act="save" title="Save to my library" aria-label="Save to my library" hidden>${ico('upload')}<span>Save to library</span></button>
          <button class="rd-btn rd-ht rd-star" data-act="mark" title="Bookmark this page" aria-label="Bookmark this page">${ico('star')}</button>
          <button class="rd-btn rd-more" data-act="more" title="More" aria-label="More" aria-haspopup="menu">${ico('more')}</button>
        </div>
        <div class="rd-menu" role="menu" hidden></div>
        <div class="rd-prog"><i></i></div>
      </div>
      <div class="rd-body">
        <aside class="rd-side" aria-label="Document navigation">
          <div class="rd-tabs" role="tablist">
            <button data-tab="thumbs" class="on" title="Page thumbnails">${ico('pages')}<span>Pages</span></button>
            <button data-tab="outline" title="Document outline">${ico('outline')}<span>Outline</span></button>
            <button data-tab="marks" title="Your bookmarks">${ico('star')}<span>Bookmarks</span></button>
            <button data-tab="results" title="Search results">${ico('search')}<span>Results</span></button>
          </div>
          <div class="rd-pane on" data-pane="thumbs"><div class="rd-thumbs"></div></div>
          <div class="rd-pane" data-pane="outline"><div class="rd-pad muted small">Loading outline…</div></div>
          <div class="rd-pane" data-pane="marks"></div>
          <div class="rd-pane" data-pane="results"><div class="rd-pad muted small">Search the document with the ${ico('search')} button or Ctrl F.</div></div>
        </aside>
        <div class="rd-scrim"></div>
        <div class="rd-find" hidden>
          <div class="rd-find-in">${ico('search')}<input type="search" placeholder="Find in document" aria-label="Find in document" autocomplete="off" enterkeyhint="search"><span class="rd-fcount"></span></div>
          <button class="rd-btn" data-act="fprev" title="Previous match (Shift Enter)" aria-label="Previous match">${ico('up')}</button>
          <button class="rd-btn" data-act="fnext" title="Next match (Enter)" aria-label="Next match">${ico('down')}</button>
          <button class="rd-btn" data-act="flist" title="All results" aria-label="Show all results">${ico('list')}</button>
          <button class="rd-btn" data-act="fclose" title="Close (Esc)" aria-label="Close search">${ico('close')}</button>
          <div class="rd-fprog"><i></i></div>
        </div>
        <div class="rd-scroll" tabindex="-1"><div class="rd-pages"><div class="rd-msg rd-opening"><div class="rd-spin"></div><b>Opening document…</b><span class="muted small"></span></div></div></div>
        <div class="rd-flag" aria-hidden="true"></div>
      </div>
    </div>`;
    s.root = $('.rd-root', s.el);
    s.bar = $('.rd-bar', s.root); s.scroller = $('.rd-scroll', s.root); s.pagesEl = $('.rd-pages', s.root);
    s.side = $('.rd-side', s.root); s.find = $('.rd-find', s.root); s.menu = $('.rd-menu', s.root);
    s.pnum = $('.rd-pnum', s.root); s.zsel = $('.rd-zsel', s.root); s.fin = $('.rd-find input', s.root);
    if (!mobile() && (set.readerSidebar == null ? innerWidth >= 1200 : set.readerSidebar)) s.root.classList.add('rd-side-open');
    place(s);
    wire(s);
  }

  /* Fill the main content area below the app top bar (desktop); whole screen on phones. */
  function place(s) {
    const tb = $('.topbar'), mn = $('.main');
    const top = tb ? Math.max(0, tb.getBoundingClientRect().bottom) : 0;
    const left = mn ? Math.max(0, mn.getBoundingClientRect().left) : 0;
    s.root.style.setProperty('--rd-top', top + 'px');
    s.root.style.setProperty('--rd-left', left + 'px');
  }

  function setTitle(s) { const t = $('.rd-title', s.root); if (t) { t.textContent = s.name; t.title = s.name; } }

  function setProg(s, f) {
    const p = $('.rd-prog', s.root); if (!p) return;
    p.classList.remove('done');
    p.classList.toggle('ind', f < 0);
    if (f >= 0) p.firstChild.style.width = Math.round(f * 100) + '%';
    const o = $('.rd-opening span', s.root); if (o && f >= 0) o.textContent = Math.round(f * 100) + '%';
  }
  function progDone(s) { const p = $('.rd-prog', s.root); if (p) { p.classList.remove('ind'); p.firstChild.style.width = '100%'; p.classList.add('done'); } }

  /* ---------- errors / password ---------- */
  function fail(s, e) {
    progDone(s);
    s.root.classList.add('rd-loading');
    const code = e && (e.code || e.name);
    let title = 'This PDF could not be opened', body = esc(e && e.message || 'Unknown error'), extra = '';
    if (code === 'engine') { title = 'PDF engine not loaded'; body = 'The PDF library could not be downloaded (offline?). Reconnect and reload the page.'; }
    else if (code === 'missing') { title = 'Document not found'; body = 'This document is no longer in your library on this device.'; }
    else if (code === 'locked') { title = 'Password required'; body = 'This document is protected. Enter its password to read it.'; extra = `<button class="btn btn-primary" data-x="pw">${ico('lock')} Enter password</button>`; }
    else if (code === 'fetch') {
      title = 'This site does not allow in-browser loading';
      body = `The server blocks other sites from reading the file (CORS), or it is an <b>http://</b> link on this secure page. Download the PDF, then open it from your device.`;
      extra = `<a class="btn btn-primary" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${ico('link')} Open original ↗</a><button class="btn" data-x="pick">${ico('upload')} Open from device</button>`;
    } else if (code === 'http') { title = 'Download failed'; body = 'The server answered with error ' + esc(e.status) + '. Check the link, or download the file and open it from your device.'; extra = `<a class="btn" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open original ↗</a>`; }
    else if (code === 'InvalidPDFException') { title = 'Not a valid PDF'; body = 'The file is damaged or is not a PDF (a link may point to a web page instead of the file itself).'; }
    else if (code === 'MissingPDFException') { title = 'File missing'; }
    s.pagesEl.innerHTML = `<div class="rd-msg"><div class="rd-msg-ic">${ico(code === 'locked' ? 'lock' : 'alert')}</div><h3>${title}</h3><p class="muted">${body}</p>
      <div class="row gap wrap center">${extra}<button class="btn" data-x="back">${ico('back')} Back to library</button></div>
      <input type="file" accept="application/pdf,.pdf" class="rd-vh"></div>`;
    const m = $('.rd-msg', s.pagesEl);
    m.onclick = ev => {
      const b = ev.target.closest('[data-x]'); if (!b) return;
      if (b.dataset.x === 'back') goLanding(s);
      if (b.dataset.x === 'pick') $('input[type=file]', m).click();
      if (b.dataset.x === 'pw') { m.remove(); s.pagesEl.innerHTML = '<div class="rd-msg rd-opening"><div class="rd-spin"></div><b>Opening document…</b><span></span></div>'; try { s.task && s.task.destroy(); } catch (x) { /* ignore */ } s.blob.arrayBuffer().then(d => load(s, d)); }
    };
    $('input[type=file]', m).onchange = ev => { const f = ev.target.files[0]; if (f) { history.replaceState(null, '', '#/reader'); openLocal(s.el, f); } };
  }

  function askPassword(s, wrong) {
    return new Promise(res => {
      const ov = document.createElement('div');
      ov.className = 'rd-ov';
      ov.innerHTML = `<form class="rd-dlg" autocomplete="off"><div class="rd-msg-ic">${ico('lock')}</div><h3>Password required</h3>
        <p class="muted small">“${esc(s.name)}” is protected. Enter the document password to open it.</p>
        <input type="password" aria-label="Document password" placeholder="Password" autocomplete="current-password">
        <div class="rd-dlg-err"${wrong ? '' : ' hidden'}>Wrong password. Try again.</div>
        <div class="row gap"><button type="button" class="btn" data-x>Cancel</button><button class="btn btn-primary">Open</button></div></form>`;
      s.root.appendChild(ov);
      s.overlay = true;
      const inp = $('input', ov), done = v => { s.overlay = false; ov.remove(); res(v); };
      setTimeout(() => inp.focus(), 30);
      $('form', ov).onsubmit = e => { e.preventDefault(); done(inp.value); };
      $('[data-x]', ov).onclick = () => done(null);
      ov.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
    });
  }

  /* ---------- start: shells, position restore ---------- */
  async function start(s) {
    const pdf = s.pdf, set = st();
    s.N = pdf.numPages;
    const p1 = await pdf.getPage(1);
    if (s.dead) return;
    const v = p1.getViewport({ scale: 1 });
    s.pages = Array.from({ length: s.N }, (_, i) => ({ n: i + 1, w: v.width, h: v.height, exact: i === 0 }));
    s.pagesEl.innerHTML = s.pages.map(p => `<div class="rd-page" data-n="${p.n}"><span class="rd-ph">${p.n}</span></div>`).join('');
    $$('.rd-page', s.pagesEl).forEach((el, i) => { s.pages[i].el = el; });
    $('.rd-ptot', s.root).textContent = '/ ' + s.N;
    s.root.classList.remove('rd-loading');
    progDone(s);

    const pos = set.readerPos[s.key] || {};
    const qp = s.q;
    s.rot = pos.rot || 0;
    const z = pos.zoom != null && !!pos.m === mobile() ? pos.zoom : 'fit-width';
    setZoom(s, z, null);
    const pg = parseInt(qp.get('page'), 10);
    goToPage(s, pg || pos.page || 1, pg ? null : pos.y);

    s.io = new IntersectionObserver(es => {
      es.forEach(e => { const n = +e.target.dataset.n; if (e.isIntersecting) s.vis.add(n); else s.vis.delete(n); });
      track(s); schedule(s);
    }, { root: s.scroller });
    s.pages.forEach(p => s.io.observe(p.el));
    s.ro = new ResizeObserver(() => {
      if (S !== s) return;
      if (!s.root.isConnected) return stop();
      place(s);
      const w = s.scroller.clientWidth, h = s.scroller.clientHeight;
      if (s.lastSize && s.lastSize[0] === w && s.lastSize[1] === h) return;
      s.lastSize = [w, h];
      if (s.mode) setZoom(s, s.mode, anchorAt(s, null, s.scroller.getBoundingClientRect().top + 1));
    });
    s.ro.observe(s.scroller);
    const tb = $('.topbar'), mn = $('.main'); tb && s.ro.observe(tb); mn && s.ro.observe(mn);

    updatePageUI(s);
    renderMarks(s);
    remember(s);
    s.scroller.focus({ preventScroll: true });
    if (qp.get('q')) { openFind(s, qp.get('q')); runSearch(s, qp.get('q')); }
    if (s.root.classList.contains('rd-side-open')) showTab(s, s.tab || 'thumbs');
    if (s.src.save && !s.id) saveToLibrary(s);
    $('[data-act=save]', s.root).hidden = !!s.id || !s.url;
    measureAll(s);
    pdf.getOutline().then(o => { s.hasOutline = !!(o && o.length); }).catch(() => {});
  }

  function applyParams(s, q) {
    const pg = parseInt(q.get('page'), 10);
    if (pg) goToPage(s, pg);
    if (q.get('q')) { openFind(s, q.get('q')); runSearch(s, q.get('q')); }
  }

  async function saveToLibrary(s) {
    if (s.id || s.saving || !s.blob) return;
    s.saving = true;
    try {
      const all = await Files.all('files');
      const dup = all.find(d => d.name === s.name && d.size === s.blob.size && isPdf(d));
      const id = dup ? dup.id : newId();
      if (!dup) await Files.put('files', { id, name: s.name, mime: 'application/pdf', size: s.blob.size, blob: s.blob, docType: 'Service manual', equipment: '', component: '', errorCode: '', pages: null, added: Date.now() });
      if (S !== s) return;
      const set = st(), nk = 'f:' + id;
      if (set.readerMarks[s.key] && !set.readerMarks[nk]) set.readerMarks[nk] = set.readerMarks[s.key];
      if (s.key[0] === 'l') { delete set.readerMarks[s.key]; delete set.readerPos[s.key]; }
      set.readerRecent = set.readerRecent.filter(r => r.key !== s.key);
      s.key = nk; s.id = id;
      history.replaceState(null, '', '#/reader?doc=' + encodeURIComponent(id));
      remember(s); savePos(s);
      const sb = $('[data-act=save]', s.root); if (sb) sb.hidden = true;
      toast(dup ? 'Already in your library' : 'Saved to your library');
    } catch (e) { toast('Could not save to the library (storage unavailable)'); }
    finally { s.saving = false; }
  }

  /* Record in "Recently read". */
  function remember(s) {
    if (!s.id && !s.url) return;
    const set = st();
    set.readerRecent = [{ key: s.key, id: s.id, url: s.id ? null : s.url, name: s.name, t: Date.now() }].concat(set.readerRecent.filter(r => r.key !== s.key)).slice(0, 12);
    Store.save();
  }

  function savePos(s) {
    if (!s.N) return;
    const set = st(), p = s.pages[s.cur - 1];
    let y = 0;
    if (p && p.el) y = clamp((s.scroller.scrollTop - p.el.offsetTop) / (p.el.offsetHeight || 1), 0, 1);
    set.readerPos[s.key] = { page: s.cur, y: +y.toFixed(3), zoom: s.mode || +s.zoom.toFixed(3), m: mobile() ? 1 : 0, rot: s.rot, pages: s.N, t: Date.now() };
    const r = set.readerRecent.find(x => x.key === s.key); if (r) r.t = Date.now();
    Store.save();
  }
  function saveSoon(s) { clearTimeout(s.saveT); s.saveT = setTimeout(() => { if (S === s) savePos(s); }, 1200); }

  /* ---------- page geometry ---------- */
  const dims = (s, p) => s.rot % 180 ? [p.h, p.w] : [p.w, p.h];
  function sizePage(s, p) {
    const [w, h] = dims(s, p);
    p.el.style.width = Math.floor(w * s.scale) + 'px';
    p.el.style.height = Math.floor(h * s.scale) + 'px';
  }
  function layoutPages(s) { s.pages.forEach(p => sizePage(s, p)); }

  function fitZoom(s, mode) {
    const p = s.pages[s.cur - 1] || s.pages[0];
    const cs = getComputedStyle(s.pagesEl);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight), padY = parseFloat(cs.paddingTop) + 12;
    const [w, h] = dims(s, p);
    const aw = Math.max(80, s.scroller.clientWidth - padX), ah = Math.max(80, s.scroller.clientHeight - padY);
    const zw = aw / (w * PX);
    return mode === 'fit-page' ? Math.min(zw, ah / (h * PX)) : zw;
  }

  function anchorAt(s, cx, cy) {
    const sr = s.scroller.getBoundingClientRect();
    if (cx == null) cx = sr.left + sr.width / 2;
    if (cy == null) cy = sr.top + sr.height / 2;
    const cand = s.vis.size ? [...s.vis] : [s.cur];
    let best = null, bd = Infinity;
    cand.forEach(n => {
      const p = s.pages[n - 1]; if (!p) return;
      const r = p.el.getBoundingClientRect();
      const d = cy < r.top ? r.top - cy : cy > r.bottom ? cy - r.bottom : 0;
      if (d < bd) { bd = d; best = { p, r }; }
    });
    if (!best) return null;
    return { p: best.p, fx: (cx - best.r.left) / (best.r.width || 1), fy: (cy - best.r.top) / (best.r.height || 1), cx, cy };
  }
  function restoreAnchor(s, a) {
    if (!a) return;
    const sr = s.scroller.getBoundingClientRect(), el = a.p.el;
    s.scroller.scrollLeft = el.offsetLeft + a.fx * el.offsetWidth - (a.cx - sr.left);
    s.scroller.scrollTop = el.offsetTop + a.fy * el.offsetHeight - (a.cy - sr.top);
  }

  function setZoom(s, z, anchor) {
    if (!s.pages.length) return;
    s.mode = typeof z === 'string' ? z : null;
    const apply = () => {
      const zoom = clamp(typeof z === 'string' ? fitZoom(s, z) : z, MINZ, MAXZ);
      s.zoom = zoom; s.scale = zoom * PX;
      s.pagesEl.style.setProperty('--scale-factor', s.scale);
      layoutPages(s);
    };
    const cw = s.scroller.clientWidth;
    apply();
    if (s.mode && s.scroller.clientWidth !== cw) apply(); // a scrollbar appeared or vanished
    s.lastSize = [s.scroller.clientWidth, s.scroller.clientHeight];
    restoreAnchor(s, anchor);
    updateZoomUI(s);
    track(s); schedule(s); saveSoon(s);
  }
  function zoomStep(s, dir, cx, cy) {
    const z = s.zoom;
    const next = dir > 0 ? ZOOMS.find(v => v > z * 1.01) || MAXZ : [...ZOOMS].reverse().find(v => v < z * 0.99) || MINZ;
    setZoom(s, next, anchorAt(s, cx, cy));
  }
  function updateZoomUI(s) {
    const pct = Math.round(s.zoom * 100) + '%';
    const cur = s.zsel.querySelector('[value=cur]'); cur.textContent = pct; s.zsel.value = 'cur';
    $('[data-act=zin]', s.root).disabled = s.zoom >= MAXZ - 1e-3;
    $('[data-act=zout]', s.root).disabled = s.zoom <= MINZ + 1e-3;
  }

  /* Correct a placeholder size once the page's real size is known, without moving the view. */
  function fixSizes(s, list) {
    const ch = list.filter(([p, w, h]) => Math.abs(p.w - w) > 0.5 || Math.abs(p.h - h) > 0.5);
    list.forEach(([p]) => { p.exact = true; });
    if (!ch.length) return;
    const a = anchorAt(s, null, s.scroller.getBoundingClientRect().top + 1);
    ch.forEach(([p, w, h]) => { p.w = w; p.h = h; sizePage(s, p); thumbAspect(s, p); });
    restoreAnchor(s, a);
  }
  async function measureAll(s) {
    for (let i = 1; i < s.N; i += 40) {
      if (S !== s) return;
      const batch = s.pages.slice(i, i + 40).filter(p => !p.exact);
      if (!batch.length) continue;
      try {
        const got = await Promise.all(batch.map(p => s.pdf.getPage(p.n).then(pg => { const v = pg.getViewport({ scale: 1 }); return [p, v.width, v.height]; })));
        if (S !== s) return;
        while (s.gesture) await new Promise(r => setTimeout(r, 120));
        fixSizes(s, got);
      } catch (e) { return; }
      await new Promise(r => setTimeout(r, 30));
    }
  }

  /* ---------- navigation ---------- */
  function goToPage(s, n, yFrac) {
    if (!s.N) return;
    n = clamp(Math.round(n) || 1, 1, s.N);
    const p = s.pages[n - 1];
    const top = p.el.offsetTop + (yFrac ? yFrac * p.el.offsetHeight : 0) - (yFrac ? 0 : 8);
    s.scroller.scrollTop = Math.max(0, top);
    s.force = n;
    setCur(s, n);
    schedule(s);
  }

  async function goToDest(s, dest) {
    try {
      const d = typeof dest === 'string' ? await s.pdf.getDestination(dest) : dest;
      if (!Array.isArray(d) || S !== s) return;
      const ref = d[0];
      const idx = ref && typeof ref === 'object' ? await s.pdf.getPageIndex(ref) : Number.isInteger(ref) ? ref : null;
      if (idx == null || S !== s) return;
      const n = idx + 1, type = d[1] && d[1].name;
      let y = null;
      const top = type === 'XYZ' ? d[3] : (type === 'FitH' || type === 'FitBH') ? d[2] : null;
      if (top != null) {
        const pg = await s.pdf.getPage(n);
        const vp = pg.getViewport({ scale: 1, rotation: (pg.rotate + s.rot) % 360 });
        const pt = vp.convertToViewportPoint(type === 'XYZ' ? d[2] || 0 : 0, top);
        y = clamp(pt[1] / vp.height, 0, 1) || null;
      }
      goToPage(s, n, y);
      if (mobile()) toggleSide(s, false);
    } catch (e) { toast('Link target not found'); }
  }

  /* Current page = the visible page occupying the most of the viewport. */
  function track(s) {
    if (!s.N) return;
    const sc = s.scroller, sr = sc.getBoundingClientRect();
    if (s.force && s.vis.has(s.force)) { const f = s.force; s.force = 0; setCur(s, f); return; }
    s.force = 0;
    let best = s.cur, bv = -1;
    const atEnd = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 2;
    [...s.vis].forEach(n => {
      const r = s.pages[n - 1].el.getBoundingClientRect();
      const v = Math.min(r.bottom, sr.bottom) - Math.max(r.top, sr.top);
      if (v > bv + 0.5 || (v > bv - 0.5 && n < best)) { bv = v; best = n; }
    });
    if (atEnd && s.vis.size) best = Math.max(...s.vis);
    setCur(s, best);
  }
  function setCur(s, n) {
    if (n === s.cur && s.curShown) return;
    const old = s.cur; s.cur = n; s.curShown = true;
    updatePageUI(s);
    const th = $('.rd-thumbs', s.root);
    if (th && th.children.length) {
      const o = th.children[old - 1], c = th.children[n - 1];
      o && o.classList.remove('on');
      if (c) { c.classList.add('on'); if (s.tab === 'thumbs' && s.root.classList.contains('rd-side-open') && !s.thumbClick) scrollIntoPane(c); }
      s.thumbClick = false;
    }
    saveSoon(s);
  }
  function scrollIntoPane(el) {
    const pane = el.closest('.rd-pane'); if (!pane) return;
    const r = el.getBoundingClientRect(), pr = pane.getBoundingClientRect();
    if (r.top < pr.top || r.bottom > pr.bottom) pane.scrollTop += r.top - pr.top - (pr.height - r.height) / 2;
  }
  function updatePageUI(s) {
    if (document.activeElement !== s.pnum) s.pnum.value = s.cur;
    $('[data-act=prev]', s.root).disabled = s.cur <= 1;
    $('[data-act=next]', s.root).disabled = s.cur >= s.N;
    const marked = (st().readerMarks[s.key] || []).includes(s.cur);
    $$('.rd-star', s.root).forEach(b => b.classList.toggle('on', marked));
  }

  /* ---------- rendering ---------- */
  function schedule(s) {
    if (s.raf) return;
    s.raf = requestAnimationFrame(() => { s.raf = 0; pump(s); });
  }
  function wanted(s) {
    if (!s.vis.size) return [s.cur];
    const vis = [...s.vis].sort((a, b) => a - b), lo = vis[0], hi = vis[vis.length - 1];
    const out = vis.sort((a, b) => Math.abs(a - s.cur) - Math.abs(b - s.cur));
    for (let d = 1; d <= 2; d++) { if (hi + d <= s.N) out.push(hi + d); if (lo - d >= 1) out.push(lo - d); }
    return out;
  }
  const needs = (s, p) => !p.canvas || p.rScale !== s.scale || p.rRot !== s.rot;
  function pump(s) {
    if (S !== s || s.dead || !s.N || s.gesture) return;
    if (!s.root.isConnected) return stop();
    const want = wanted(s);
    const lo = Math.min(...want) - 3, hi = Math.max(...want) + 3;
    [...s.live].forEach(n => { if (n < lo || n > hi) release(s, s.pages[n - 1]); });
    let pendingWork = false;
    for (const n of want) {
      const p = s.pages[n - 1];
      if (!p || !needs(s, p)) continue;
      pendingWork = true;
      if (p.rendering) continue;
      if (s.busy >= 1) break;
      renderPage(s, p);
    }
    if (!pendingWork && !s.busy) pumpThumbs(s);
  }

  async function renderPage(s, p) {
    p.rendering = true; s.busy++;
    const scale = s.scale, rot = s.rot;
    let page;
    try {
      page = await s.pdf.getPage(p.n);
      if (S !== s) return;
      if (!p.exact) { const v = page.getViewport({ scale: 1 }); fixSizes(s, [[p, v.width, v.height]]); }
      const vp = page.getViewport({ scale, rotation: (page.rotate + rot) % 360 });
      const dpr = window.devicePixelRatio || 1;
      const ratio = Math.min(dpr, Math.sqrt(MAXPX / (vp.width * vp.height)));
      const cv = document.createElement('canvas');
      cv.className = 'rd-cv';
      cv.width = Math.max(1, Math.floor(vp.width * ratio)); cv.height = Math.max(1, Math.floor(vp.height * ratio));
      const ctx = cv.getContext('2d', { alpha: false });
      const task = p.task = page.render({ canvasContext: ctx, viewport: vp, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null });
      await task.promise;
      p.task = null;
      if (S !== s || p.released) { cv.width = cv.height = 0; return; }
      if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); }
      p.el.insertBefore(cv, p.el.firstChild);
      p.canvas = cv; p.rScale = scale; p.rRot = rot;
      s.live.add(p.n);
      p.el.classList.add('rd-done');
    } catch (e) {
      p.task = null;
      if (!(e && e.name === 'RenderingCancelledException') && S === s) { console.warn('Page render failed', p.n, e); p.el.classList.add('rd-err'); p.rScale = scale; p.rRot = rot; p.canvas = p.canvas || document.createElement('canvas'); }
      return;
    } finally {
      p.rendering = false; p.released = false; s.busy--;
      if (S === s) schedule(s);
    }
    if (p.tRot !== rot || !p.tl) buildLayers(s, p, page, rot).catch(e => { if (S === s) console.warn('Text layer failed', p.n, e); });
  }

  async function buildLayers(s, p, page, rot) {
    p.tRot = rot;
    const tc = await page.getTextContent();
    if (S !== s || !p.canvas || p.rRot !== rot) { p.tRot = null; return; }
    if (!s.text[p.n]) s.text[p.n] = indexText(tc);
    p.tl && p.tl.remove();
    const div = document.createElement('div');
    div.className = 'textLayer';
    p.el.appendChild(div);
    const vp = page.getViewport({ scale: s.scale, rotation: (page.rotate + rot) % 360 });
    const divs = [];
    await pdfjsLib.renderTextLayer({ textContentSource: tc, container: div, viewport: vp, textDivs: divs }).promise;
    if (S !== s || !p.canvas) { div.remove(); return; }
    p.tl = div; p.textDivs = divs; p.strs = tc.items.filter(it => it.str !== undefined).map(it => it.str); p.hl = [];
    highlight(s, p);
    // Link annotations: internal destinations and web links
    try {
      const anns = await page.getAnnotations({ intent: 'display' });
      if (S !== s || !p.canvas) return;
      const links = anns.filter(a => a.subtype === 'Link' && (a.url || a.dest));
      p.ll && p.ll.remove(); p.ll = null;
      if (!links.length) return;
      const v1 = page.getViewport({ scale: 1, rotation: (page.rotate + rot) % 360 });
      const ll = document.createElement('div'); ll.className = 'rd-links';
      links.forEach(a => {
        const r = pdfjsLib.Util.normalizeRect(v1.convertToViewportRectangle(a.rect));
        const el = document.createElement('a');
        el.style.cssText = `left:${r[0] / v1.width * 100}%;top:${r[1] / v1.height * 100}%;width:${(r[2] - r[0]) / v1.width * 100}%;height:${(r[3] - r[1]) / v1.height * 100}%`;
        if (a.url) { el.href = a.url; el.target = '_blank'; el.rel = 'noopener noreferrer'; el.title = a.url; }
        else { el.href = '#'; el.title = 'Go to destination'; el.onclick = e => { e.preventDefault(); goToDest(s, a.dest); }; }
        ll.appendChild(el);
      });
      p.el.appendChild(ll); p.ll = ll;
    } catch (e) { /* annotations are optional */ }
  }

  function release(s, p) {
    if (!p) return;
    if (p.task) { p.released = true; try { p.task.cancel(); } catch (e) { /* ignore */ } }
    if (p.canvas) { p.canvas.width = p.canvas.height = 0; p.canvas.remove(); p.canvas = null; }
    p.tl && p.tl.remove(); p.ll && p.ll.remove();
    p.tl = p.ll = p.textDivs = p.strs = null; p.hl = []; p.tRot = null; p.rScale = 0;
    p.el.classList.remove('rd-done', 'rd-err');
    s.live.delete(p.n);
  }

  /* ---------- thumbnails ---------- */
  function thumbAspect(s, p) {
    const th = $('.rd-thumbs', s.root); const b = th && th.children[p.n - 1];
    if (b) { const [w, h] = dims(s, p); b.firstChild.style.aspectRatio = w + ' / ' + h; }
  }
  function buildThumbs(s) {
    if (s.thumbsBuilt || !s.N) return;
    s.thumbsBuilt = true;
    const th = $('.rd-thumbs', s.root);
    th.innerHTML = s.pages.map(p => { const [w, h] = dims(s, p); return `<button class="rd-th${p.n === s.cur ? ' on' : ''}" data-n="${p.n}" aria-label="Page ${p.n}"><span class="rd-th-box" style="aspect-ratio:${w} / ${h}"></span><span class="rd-th-n">${p.n}</span></button>`; }).join('');
    s.tio = new IntersectionObserver(es => {
      es.forEach(e => { const n = +e.target.dataset.n; if (e.isIntersecting) s.tWant.add(n); else { s.tWant.delete(n); releaseThumb(s, n); } });
      schedule(s);
    }, { root: $('[data-pane=thumbs]', s.root), rootMargin: '300px 0px' });
    [...th.children].forEach(c => s.tio.observe(c));
    th.onclick = e => { const b = e.target.closest('.rd-th'); if (!b) return; s.thumbClick = true; goToPage(s, +b.dataset.n); if (mobile()) toggleSide(s, false); };
    requestAnimationFrame(() => { const c = th.children[s.cur - 1]; c && scrollIntoPane(c); });
  }
  function releaseThumb(s, n) {
    const th = $('.rd-thumbs', s.root); const b = th && th.children[n - 1];
    const c = b && b.querySelector('canvas');
    if (c) { c.width = c.height = 0; c.remove(); }
    s.tDone.delete(n);
  }
  function resetThumbs(s) { [...s.tDone].forEach(n => releaseThumb(s, n)); s.pages.forEach(p => thumbAspect(s, p)); }
  async function pumpThumbs(s) {
    if (s.tBusy || !s.tWant.size || !s.root.classList.contains('rd-side-open') || s.tab !== 'thumbs') return;
    const n = [...s.tWant].filter(x => !s.tDone.has(x)).sort((a, b) => Math.abs(a - s.cur) - Math.abs(b - s.cur))[0];
    if (!n) return;
    s.tBusy = 1;
    try {
      const page = await s.pdf.getPage(n);
      if (S !== s || !s.tWant.has(n)) return;
      const rot = s.rot;
      const v1 = page.getViewport({ scale: 1, rotation: (page.rotate + rot) % 360 });
      const k = Math.min(2, window.devicePixelRatio || 1) * 112 / v1.width;
      const vp = page.getViewport({ scale: k, rotation: (page.rotate + rot) % 360 });
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(vp.width)); cv.height = Math.max(1, Math.round(vp.height));
      await page.render({ canvasContext: cv.getContext('2d', { alpha: false }), viewport: vp }).promise;
      const b = $('.rd-thumbs', s.root).children[n - 1];
      if (S !== s || !s.tWant.has(n) || rot !== s.rot || !b) { cv.width = cv.height = 0; return; }
      const box = b.firstChild; box.querySelector('canvas') && box.querySelector('canvas').remove();
      box.appendChild(cv); s.tDone.add(n);
    } catch (e) { s.tDone.add(n); }
    finally { s.tBusy = 0; if (S === s) schedule(s); }
  }

  /* ---------- outline / bookmarks ---------- */
  async function buildOutline(s) {
    if (s.outlineBuilt || !s.pdf) return;
    s.outlineBuilt = true;
    const pane = $('[data-pane=outline]', s.root);
    let ol = null;
    try { ol = await s.pdf.getOutline(); } catch (e) { /* none */ }
    if (S !== s) return;
    if (!ol || !ol.length) { pane.innerHTML = `<div class="rd-empty">${ico('outline')}<b>No outline</b><span>This document has no bookmarks table. Use page thumbnails or search instead.</span></div>`; return; }
    const items = [];
    const tree = list => `<ul>${list.map(it => {
      const i = items.push(it) - 1, kids = it.items && it.items.length;
      return `<li class="${kids ? 'rd-ol-has' : ''}${kids && it.count > 0 ? ' open' : ''}">${kids ? `<button class="rd-ol-tg" aria-label="Expand">${ico('down')}</button>` : '<span class="rd-ol-sp"></span>'}<button class="rd-ol-a${it.bold ? ' b' : ''}" data-o="${i}" title="${esc(it.title)}">${esc(it.title || 'Untitled')}</button>${kids ? tree(it.items) : ''}</li>`;
    }).join('')}</ul>`;
    pane.innerHTML = `<div class="rd-ol">${tree(ol)}</div>`;
    if (ol.length <= 3) $$('.rd-ol > ul > li.rd-ol-has', pane).forEach(li => li.classList.add('open'));
    pane.onclick = e => {
      const tg = e.target.closest('.rd-ol-tg'); if (tg) { tg.parentElement.classList.toggle('open'); return; }
      const a = e.target.closest('.rd-ol-a'); if (!a) return;
      $$('.rd-ol-a.on', pane).forEach(x => x.classList.remove('on')); a.classList.add('on');
      const it = items[+a.dataset.o];
      if (it.dest) goToDest(s, it.dest);
      else if (it.url) window.open(it.url, '_blank', 'noopener');
    };
  }

  function toggleMark(s) {
    const set = st(), m = set.readerMarks[s.key] = set.readerMarks[s.key] || [];
    const i = m.indexOf(s.cur);
    if (i >= 0) { m.splice(i, 1); toast('Bookmark removed'); }
    else { m.push(s.cur); m.sort((a, b) => a - b); toast('Page ' + s.cur + ' bookmarked'); }
    if (!m.length) delete set.readerMarks[s.key];
    Store.save(); updatePageUI(s); renderMarks(s);
  }
  function renderMarks(s) {
    const pane = $('[data-pane=marks]', s.root), m = st().readerMarks[s.key] || [];
    pane.innerHTML = m.length ? `<div class="rd-marks">${m.map(n => `<div class="rd-mark"><button class="rd-mark-go" data-n="${n}">${ico('star')}<span>Page ${n}</span></button><button class="rd-btn" data-del="${n}" title="Remove bookmark" aria-label="Remove bookmark for page ${n}">${ico('close')}</button></div>`).join('')}</div>`
      : `<div class="rd-empty">${ico('star')}<b>No bookmarks yet</b><span>Use ★ in the toolbar to bookmark the page you are reading.</span></div>`;
    pane.onclick = e => {
      const d = e.target.closest('[data-del]');
      if (d) { const set = st(), arr = set.readerMarks[s.key] || []; const i = arr.indexOf(+d.dataset.del); if (i >= 0) arr.splice(i, 1); if (!arr.length) delete set.readerMarks[s.key]; Store.save(); renderMarks(s); updatePageUI(s); return; }
      const g = e.target.closest('[data-n]'); if (g) { goToPage(s, +g.dataset.n); if (mobile()) toggleSide(s, false); }
    };
  }

  /* ---------- sidebar ---------- */
  function toggleSide(s, open) {
    const r = s.root, now = open == null ? !r.classList.contains('rd-side-open') : open;
    r.classList.toggle('rd-side-open', now);
    if (!mobile()) { st().readerSidebar = now; Store.save(); }
    if (now) showTab(s, s.tab || 'thumbs');
    schedule(s);
  }
  function showTab(s, tab) {
    s.tab = tab;
    $$('.rd-tabs [data-tab]', s.root).forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    $$('.rd-pane', s.root).forEach(p => p.classList.toggle('on', p.dataset.pane === tab));
    if (tab === 'thumbs') buildThumbs(s);
    if (tab === 'outline') buildOutline(s);
    schedule(s);
  }

  /* ---------- search ---------- */
  /* Normalised page text (lower-case, collapsed whitespace) with a map back to text-layer items. */
  function indexText(tc) {
    const n = [], d = [], map = [], off = [];
    let i = -1, last = ' ';
    tc.items.forEach(it => {
      if (it.str === undefined) return;
      i++;
      const str = it.str;
      for (let k = 0; k < str.length; k++) {
        const c = str[k];
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ' ') {
          if (last !== ' ') { n.push(' '); d.push(' '); map.push(i); off.push(k); last = ' '; }
          continue;
        }
        let l = c.toLowerCase(); if (l.length !== 1) l = c;
        n.push(l); d.push(c); map.push(i); off.push(k); last = l;
      }
      if (it.hasEOL && last !== ' ') { n.push(' '); d.push(' '); map.push(-1); off.push(0); last = ' '; }
    });
    return { norm: n.join(''), disp: d.join(''), map: Int32Array.from(map), off: Int32Array.from(off) };
  }

  function openFind(s, val) {
    s.find.hidden = false; s.root.classList.add('rd-finding');
    $('[data-act=search]', s.root).classList.add('on');
    if (val != null) s.fin.value = val;
    setTimeout(() => { s.fin.focus(); s.fin.select(); }, 20);
  }
  function closeFind(s) {
    s.find.hidden = true; s.root.classList.remove('rd-finding');
    $('[data-act=search]', s.root).classList.remove('on');
    runSearch(s, '');
    s.scroller.focus({ preventScroll: true });
  }

  async function runSearch(s, raw) {
    const q = String(raw || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const old = s.search;
    const H = s.search = { q, raw: String(raw || ''), hits: [], byPage: {}, cur: -1, done: !q, scanned: 0 };
    Object.keys(old.byPage || {}).forEach(n => { const p = s.pages[n - 1]; p && highlight(s, p); });
    s.pendingReveal = null;
    renderResults(s, true);
    updateFind(s);
    if (!q || !s.pdf) return;
    if (!mobile() && innerWidth >= 1100) { if (!s.root.classList.contains('rd-side-open')) toggleSide(s, true); showTab(s, 'results'); }
    const startPage = s.cur;
    for (let n = 1; n <= s.N; n++) {
      if (S !== s || s.search !== H) return;
      let t = s.text[n];
      if (!t) {
        try { const page = await s.pdf.getPage(n); const tc = await page.getTextContent(); t = s.text[n] = s.text[n] || indexText(tc); }
        catch (e) { t = { norm: '', disp: '', map: new Int32Array(0), off: new Int32Array(0) }; }
        if (S !== s || s.search !== H) return;
      }
      const list = [];
      for (let i = t.norm.indexOf(q); i >= 0; i = t.norm.indexOf(q, i + q.length)) { list.push(H.hits.length); H.hits.push({ p: n, s: i, e: i + q.length }); }
      H.scanned = n;
      if (list.length) {
        H.byPage[n] = list;
        renderResults(s, false, list);
        if (H.cur < 0 && n >= startPage) select(s, list[0], true);
        else highlight(s, s.pages[n - 1]);
      }
      if (list.length || n % 5 === 0 || n === s.N) updateFind(s);
      if (n % 6 === 0) { await idle(); while (s.busy && S === s && s.search === H) await new Promise(r => setTimeout(r, 40)); }
    }
    H.done = true;
    if (H.cur < 0 && H.hits.length) select(s, 0, true);
    updateFind(s); renderResults(s, false, []);
  }

  function select(s, hi, reveal) {
    const H = s.search, prev = H.hits[H.cur];
    H.cur = hi;
    const h = H.hits[hi];
    if (prev && prev.p !== h.p) highlight(s, s.pages[prev.p - 1]);
    highlight(s, s.pages[h.p - 1]);
    updateFind(s);
    const pane = $('[data-pane=results]', s.root);
    $$('.rd-res.on', pane).forEach(x => x.classList.remove('on'));
    const b = pane.querySelector(`.rd-res[data-h="${hi}"]`);
    if (b) { b.classList.add('on'); if (s.tab === 'results') scrollIntoPane(b); }
    if (reveal) {
      s.pendingReveal = hi;
      if (!revealMark(s)) { const p = s.pages[h.p - 1]; if (!p.tl) goToPage(s, h.p); }
    }
  }
  function revealMark(s) {
    const H = s.search, h = H.hits[s.pendingReveal];
    if (!h) return false;
    const p = s.pages[h.p - 1], m = p.tl && p.tl.querySelector('.rd-hl-cur');
    if (!m) return false;
    s.pendingReveal = null;
    const r = m.getBoundingClientRect(), sr = s.scroller.getBoundingClientRect();
    if (r.top < sr.top + 20 || r.bottom > sr.bottom - 20) s.scroller.scrollTop += r.top - sr.top - sr.height * 0.33;
    if (r.left < sr.left || r.right > sr.right) s.scroller.scrollLeft += r.left - sr.left - (sr.width - r.width) / 2;
    return true;
  }
  function step(s, dir) {
    const H = s.search, val = s.fin.value;
    if (val.trim().replace(/\s+/g, ' ').toLowerCase() !== H.q) return runSearch(s, val);
    if (!H.hits.length) return;
    select(s, H.cur < 0 ? 0 : (H.cur + dir + H.hits.length) % H.hits.length, true);
  }

  /* Wrap matches in the page's text layer with <mark>. */
  function highlight(s, p) {
    if (!p || !p.textDivs) return;
    (p.hl || []).forEach(i => { const d = p.textDivs[i]; if (d) d.textContent = p.strs[i]; });
    p.hl = [];
    const H = s.search, list = H.q && H.byPage[p.n], t = s.text[p.n];
    if (!list || !t) return;
    const per = new Map();
    list.forEach(hi => {
      const h = H.hits[hi];
      for (let j = h.s; j < h.e; j++) {
        const it = t.map[j]; if (it < 0) continue;
        const o = t.off[j];
        let arr = per.get(it); if (!arr) per.set(it, arr = []);
        const last = arr[arr.length - 1];
        if (last && last.h === hi) last.to = Math.max(last.to, o + 1); else arr.push({ from: o, to: o + 1, h: hi });
      }
    });
    per.forEach((arr, it) => {
      const d = p.textDivs[it], str = p.strs[it]; if (!d || str == null) return;
      arr.sort((a, b) => a.from - b.from);
      let html = '', at = 0;
      arr.forEach(r => { if (r.from < at) return; html += esc(str.slice(at, r.from)) + `<mark class="rd-hl${r.h === H.cur ? ' rd-hl-cur' : ''}">${esc(str.slice(r.from, r.to))}</mark>`; at = r.to; });
      d.innerHTML = html + esc(str.slice(at));
      p.hl.push(it);
    });
    if (s.pendingReveal != null && H.hits[s.pendingReveal] && H.hits[s.pendingReveal].p === p.n) revealMark(s);
  }

  function updateFind(s) {
    const H = s.search, c = $('.rd-fcount', s.root), bar = $('.rd-fprog', s.root);
    let txt = '';
    if (H.q) {
      if (H.hits.length) txt = (H.cur >= 0 ? H.cur + 1 : 0) + ' of ' + H.hits.length + (H.done ? '' : '+');
      else txt = H.done ? 'No results' : 'Searching p. ' + H.scanned + '/' + s.N;
    }
    c.textContent = txt;
    c.classList.toggle('none', !!(H.q && H.done && !H.hits.length));
    bar.hidden = !H.q || H.done;
    bar.firstChild.style.width = (s.N ? H.scanned / s.N * 100 : 0) + '%';
    const head = $('[data-pane=results] .rd-res-h', s.root);
    if (head) head.innerHTML = H.done ? `<b>${H.hits.length}</b> result${H.hits.length === 1 ? '' : 's'} for “${esc(H.raw.trim())}”` : `Searching p. ${H.scanned} / ${s.N}… <b>${H.hits.length}</b> found`;
  }

  function renderResults(s, reset, list) {
    const pane = $('[data-pane=results]', s.root), H = s.search;
    if (reset) {
      pane.innerHTML = H.q ? '<div class="rd-res-h"></div><div class="rd-res-l"></div>' : `<div class="rd-empty">${ico('search')}<b>Search this document</b><span>Results with page numbers and context appear here.</span></div>`;
      pane.onclick = e => { const b = e.target.closest('.rd-res'); if (!b) return; select(s, +b.dataset.h, true); if (mobile()) toggleSide(s, false); };
      return;
    }
    const l = $('.rd-res-l', pane); if (!l) return;
    if (H.done && !H.hits.length) { l.innerHTML = '<div class="rd-pad muted small">No matches. Check the spelling or try fewer words.</div>'; return; }
    const shown = l.childElementCount;
    if (shown >= 1500) { if (H.done && !$('.rd-res-more', l)) l.insertAdjacentHTML('beforeend', `<div class="rd-pad muted small rd-res-more">Showing the first 1500 results. Refine the search to narrow it down.</div>`); return; }
    const t = list.length ? s.text[H.hits[list[0]].p] : null;
    l.insertAdjacentHTML('beforeend', list.slice(0, 1500 - shown).map(hi => {
      const h = H.hits[hi], a = Math.max(0, h.s - 42), b = Math.min(t.disp.length, h.e + 60);
      return `<button class="rd-res" data-h="${hi}"><small>Page ${h.p}</small><span>${a > 0 ? '…' : ''}${esc(t.disp.slice(a, h.s))}<mark>${esc(t.disp.slice(h.s, h.e))}</mark>${esc(t.disp.slice(h.e, b))}${b < t.disp.length ? '…' : ''}</span></button>`;
    }).join(''));
  }

  /* ---------- tools ---------- */
  function rotate(s) {
    const a = anchorAt(s);
    s.rot = (s.rot + 90) % 360;
    if (a) { const fx = a.fx, fy = a.fy; a.fx = 1 - fy; a.fy = fx; } // clockwise turn of the focal point
    if (s.mode) setZoom(s, s.mode, a); else { layoutPages(s); restoreAnchor(s, a); track(s); schedule(s); saveSoon(s); }
    resetThumbs(s);
  }
  function night(s) {
    const v = s.root.classList.toggle('rd-night');
    st().readerNight = v; Store.save();
    $('[data-act=night]', s.root).classList.toggle('on', v);
  }
  function toggleFs(s) {
    const r = s.root;
    if (document.fullscreenElement === r) { document.exitFullscreen().catch(() => {}); return; }
    if (r.classList.contains('rd-fs')) { r.classList.remove('rd-fs'); fsIcon(s); return; }
    if (r.requestFullscreen && document.fullscreenEnabled) r.requestFullscreen().catch(() => { r.classList.add('rd-fs'); fsIcon(s); });
    else if (r.webkitRequestFullscreen) r.webkitRequestFullscreen();
    else { r.classList.add('rd-fs'); fsIcon(s); }
  }
  function fsIcon(s) {
    const isFs = document.fullscreenElement === s.root || document.webkitFullscreenElement === s.root || s.root.classList.contains('rd-fs');
    const b = $('[data-act=fs]', s.root); if (b) { b.innerHTML = ico(isFs ? 'shrink' : 'expand'); b.classList.toggle('on', isFs); }
  }
  function download(s) {
    if (!s.blob) return;
    const u = URL.createObjectURL(s.blob); s.urls.push(u);
    const a = document.createElement('a');
    a.href = u; a.download = /\.pdf$/i.test(s.name) ? s.name : s.name + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function goLanding(s) {
    if (location.hash === '#/reader') { stop(); landing(s.el); window.scrollTo(0, 0); }
    else location.hash = '#/reader';
  }

  function menu(s, open) {
    const m = s.menu, now = open == null ? m.hidden : open;
    if (!now) { m.hidden = true; return; }
    const marked = (st().readerMarks[s.key] || []).includes(s.cur), nightOn = s.root.classList.contains('rd-night');
    m.innerHTML = `<div class="rd-menu-h"><b>${esc(s.name)}</b><small>${s.N ? s.N + ' pages' : ''}${s.blob ? ' · ' + fmtSize(s.blob.size) : ''}</small></div>
      <button data-m="side">${ico('pages')}Pages, outline &amp; bookmarks</button>
      <button data-m="fit-width" class="${s.mode === 'fit-width' ? 'on' : ''}">${ico('fitw')}Fit width</button>
      <button data-m="fit-page" class="${s.mode === 'fit-page' ? 'on' : ''}">${ico('fitp')}Fit page</button>
      <button data-m="rotate">${ico('rotate')}Rotate clockwise</button>
      <button data-m="night" class="${nightOn ? 'on' : ''}">${ico('moon')}Night mode${nightOn ? ' · on' : ''}</button>
      <button data-m="fs">${ico('expand')}Full screen</button>
      <button data-m="mark" class="${marked ? 'on' : ''}">${ico('star')}${marked ? 'Remove bookmark' : 'Bookmark this page'}</button>
      <button data-m="download">${ico('download')}Download PDF</button>
      ${s.id ? '' : `<button data-m="save">${ico('upload')}Save to my library</button>`}
      ${s.url ? `<a class="rd-menu-a" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${ico('link')}Open original ↗</a>` : ''}`;
    m.hidden = false;
  }

  /* ---------- wiring ---------- */
  function wire(s) {
    const r = s.root;
    r.querySelector('.rd-bar').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
      const a = b.dataset.act;
      if (a !== 'more') menu(s, false);
      if (a === 'back') return goLanding(s);
      if (!s.pdf && a !== 'more') return;
      ({
        side: () => toggleSide(s), prev: () => goToPage(s, s.cur - 1), next: () => goToPage(s, s.cur + 1),
        zin: () => zoomStep(s, 1), zout: () => zoomStep(s, -1), rotate: () => rotate(s),
        search: () => (s.find.hidden ? openFind(s) : closeFind(s)), night: () => night(s), fs: () => toggleFs(s),
        download: () => download(s), mark: () => toggleMark(s), more: () => menu(s), save: () => saveToLibrary(s)
      })[a]();
    });
    s.menu.addEventListener('click', e => {
      const b = e.target.closest('[data-m]'); if (!b) return;
      const a = b.dataset.m; menu(s, false);
      if (!s.pdf) return;
      ({
        side: () => toggleSide(s, true), 'fit-width': () => setZoom(s, 'fit-width', anchorAt(s)), 'fit-page': () => setZoom(s, 'fit-page', anchorAt(s)),
        rotate: () => rotate(s), night: () => night(s), fs: () => toggleFs(s), mark: () => toggleMark(s), download: () => download(s), save: () => saveToLibrary(s)
      })[a]();
    });
    onG(s, document, 'pointerdown', e => { if (!s.menu.hidden && !e.target.closest('.rd-menu, [data-act=more]')) menu(s, false); });
    s.zsel.onchange = () => {
      const v = s.zsel.value;
      if (v !== 'cur') setZoom(s, v.startsWith('fit') ? v : +v, anchorAt(s));
      s.zsel.blur();
    };
    s.pnum.addEventListener('focus', () => s.pnum.select());
    s.pnum.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); goToPage(s, parseInt(s.pnum.value, 10) || s.cur); s.scroller.focus({ preventScroll: true }); }
      if (e.key === 'Escape') { s.pnum.value = s.cur; s.pnum.blur(); }
    });
    s.pnum.addEventListener('blur', () => { s.pnum.value = s.cur; });
    $('.rd-tabs', r).onclick = e => { const b = e.target.closest('[data-tab]'); if (b) showTab(s, b.dataset.tab); };
    $('.rd-scrim', r).onclick = () => toggleSide(s, false);
    // find bar
    let deb = 0;
    s.fin.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); clearTimeout(deb); step(s, e.shiftKey ? -1 : 1); }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeFind(s); }
    });
    s.fin.addEventListener('input', () => {
      clearTimeout(deb);
      const v = s.fin.value.trim();
      deb = setTimeout(() => { if (S === s && (v.length >= 2 || !v)) runSearch(s, s.fin.value); }, 450);
    });
    s.find.addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const a = b.dataset.act;
      if (a === 'fnext') step(s, 1);
      if (a === 'fprev') step(s, -1);
      if (a === 'fclose') closeFind(s);
      if (a === 'flist') { toggleSide(s, true); showTab(s, 'results'); }
    });
    // scrolling
    let flagT = 0;
    on(s, s.scroller, 'scroll', () => {
      if (s.sraf) return;
      s.sraf = requestAnimationFrame(() => {
        s.sraf = 0;
        if (S !== s) return;
        track(s); schedule(s);
        const f = $('.rd-flag', r);
        if (s.N) { f.textContent = s.cur + ' / ' + s.N; f.classList.add('show'); clearTimeout(flagT); flagT = setTimeout(() => f.classList.remove('show'), 900); }
      });
    }, { passive: true });
    // keyboard (only while mounted)
    onG(s, document, 'keydown', e => {
      if (s.overlay || !s.pdf) return;
      const t = e.target, typing = t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;
      if ($('#modal.open')) return;
      if (mod && !e.altKey && (e.key === 'f' || e.key === 'F')) { e.preventDefault(); openFind(s); return; }
      if (mod && (e.key === '+' || e.key === '=')) { e.preventDefault(); zoomStep(s, 1); return; }
      if (mod && (e.key === '-' || e.key === '_')) { e.preventDefault(); zoomStep(s, -1); return; }
      if (mod && e.key === '0') { e.preventDefault(); setZoom(s, 'fit-width', anchorAt(s)); return; }
      if (e.key === 'Escape') {
        if (!s.menu.hidden) return menu(s, false);
        if (!s.find.hidden) return closeFind(s);
        if (mobile() && r.classList.contains('rd-side-open')) return toggleSide(s, false);
        if (r.classList.contains('rd-fs')) { r.classList.remove('rd-fs'); fsIcon(s); }
        return;
      }
      if (typing || mod || e.altKey) return;
      const k = e.key;
      if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); goToPage(s, s.cur + 1); }
      else if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); goToPage(s, s.cur - 1); }
      else if (k === 'Home') { e.preventDefault(); goToPage(s, 1); }
      else if (k === 'End') { e.preventDefault(); goToPage(s, s.N); }
    });
    onG(s, document, 'fullscreenchange', () => fsIcon(s));
    onG(s, document, 'webkitfullscreenchange', () => fsIcon(s));
    onG(s, window, 'resize', () => place(s));
    onG(s, window, 'pagehide', () => savePos(s));
    // drop another PDF onto the viewer
    on(s, r, 'dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
    on(s, r, 'drop', e => {
      e.preventDefault();
      const f = [...(e.dataTransfer.files || [])].find(isPdf);
      if (f) { history.replaceState(null, '', '#/reader'); openLocal(s.el, f); }
    });
    wireGestures(s);
  }

  /* Pinch / ctrl+wheel zoom: CSS-transform preview around the focal point, then a real re-render. */
  function gStart(s, cx, cy) {
    const sr = s.scroller.getBoundingClientRect();
    s.gesture = { a: anchorAt(s, cx, cy), cx0: cx, cy0: cy, cx, cy, r: 1 };
    s.pagesEl.style.transformOrigin = `${s.scroller.scrollLeft + cx - sr.left}px ${s.scroller.scrollTop + cy - sr.top}px`;
  }
  function gMove(s, r, cx, cy) {
    const g = s.gesture; if (!g) return;
    g.r = clamp(s.zoom * r, MINZ, MAXZ) / s.zoom; g.cx = cx; g.cy = cy;
    s.pagesEl.style.transform = `translate(${cx - g.cx0}px, ${cy - g.cy0}px) scale(${g.r})`;
  }
  function gEnd(s) {
    const g = s.gesture; if (!g) return;
    s.gesture = null;
    s.pagesEl.style.transform = ''; s.pagesEl.style.transformOrigin = '';
    if (!g.a || Math.abs(g.r - 1) < 0.01) { restoreAnchor(s, g.a && Object.assign(g.a, { cx: g.a.cx, cy: g.a.cy })); schedule(s); return; }
    g.a.cx = g.cx; g.a.cy = g.cy;
    let z = s.zoom * g.r;
    const fw = fitZoom(s, 'fit-width');
    setZoom(s, Math.abs(z - fw) / fw < 0.04 ? 'fit-width' : z, g.a);
  }
  function wireGestures(s) {
    const sc = s.scroller;
    const mid = (a, b) => [(a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2];
    const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    let pinch = null, tap = null, lastTap = null;
    on(s, sc, 'touchstart', e => {
      if (!s.pdf) return;
      if (e.touches.length === 2) {
        e.preventDefault();
        const [a, b] = e.touches, [x, y] = mid(a, b);
        pinch = { d0: dist(a, b) }; tap = null; lastTap = null;
        gStart(s, x, y);
      } else if (e.touches.length === 1) {
        const t = e.touches[0]; tap = { x: t.clientX, y: t.clientY, t: Date.now(), moved: false };
      } else tap = null;
    }, { passive: false });
    on(s, sc, 'touchmove', e => {
      if (pinch && e.touches.length >= 2) {
        e.preventDefault();
        const [a, b] = e.touches, [x, y] = mid(a, b);
        gMove(s, dist(a, b) / pinch.d0, x, y);
      } else if (tap) {
        const t = e.touches[0]; if (Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > 10) tap.moved = true;
      }
    }, { passive: false });
    const end = e => {
      if (pinch) { if (e.touches.length < 2) { pinch = null; gEnd(s); } return; }
      if (!tap || tap.moved || e.touches.length || Date.now() - tap.t > 300) { tap = null; return; }
      const now = Date.now();
      if (lastTap && now - lastTap.t < 330 && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 30) {
        e.preventDefault();
        const a = anchorAt(s, tap.x, tap.y);
        setZoom(s, s.mode === 'fit-width' ? 2 : 'fit-width', a);
        lastTap = null;
      } else lastTap = { t: now, x: tap.x, y: tap.y };
      tap = null;
    };
    on(s, sc, 'touchend', end, { passive: false });
    on(s, sc, 'touchcancel', () => { tap = null; if (pinch) { pinch = null; gEnd(s); } });
    on(s, s.root, 'gesturestart', e => e.preventDefault()); // iOS Safari page zoom
    on(s, s.root, 'gesturechange', e => e.preventDefault());
    // ctrl/cmd + wheel (and trackpad pinch on desktop)
    let wt = 0;
    on(s, sc, 'wheel', e => {
      if (!(e.ctrlKey || e.metaKey) || !s.pdf) return;
      e.preventDefault();
      if (!s.gesture) gStart(s, e.clientX, e.clientY);
      const g = s.gesture;
      const f = Math.exp(-clamp(e.deltaY * (e.deltaMode === 1 ? 16 : 1), -60, 60) * 0.0045);
      gMove(s, g.r * f, g.cx0, g.cy0);
      clearTimeout(wt); wt = setTimeout(() => { if (S === s) gEnd(s); }, 160);
    }, { passive: false });
  }

  /* ---------- teardown ---------- */
  function stop() {
    const s = S; if (!s) return;
    S = null;
    try { if (s.pdf) savePos(s); } catch (e) { /* ignore */ }
    s.dead = true;
    clearTimeout(s.saveT);
    s.raf && cancelAnimationFrame(s.raf); s.sraf && cancelAnimationFrame(s.sraf);
    s.off.forEach(f => f()); s.off = [];
    s.io && s.io.disconnect(); s.tio && s.tio.disconnect(); s.ro && s.ro.disconnect();
    s.pages.forEach(p => { if (p.task) { try { p.task.cancel(); } catch (e) { /* ignore */ } } if (p.canvas) { p.canvas.width = p.canvas.height = 0; } });
    s.root && $$('.rd-th-box canvas', s.root).forEach(c => { c.width = c.height = 0; });
    s.urls.forEach(u => URL.revokeObjectURL(u)); s.urls = [];
    if (document.fullscreenElement && s.root && document.fullscreenElement === s.root) document.exitFullscreen().catch(() => {});
    s.text = {};
    try { s.task && s.task.destroy(); } catch (e) { /* ignore */ }
  }
})();

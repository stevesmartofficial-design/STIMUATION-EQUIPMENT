/* Shared UI helpers: escaping, modal/toast, SVG technical diagrams, quiz engine,
   signature pad, hazard badges. */
(function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }
  function modal(html, opts) {
    const m = $('#modal'), c = $('#modalCard');
    c.className = 'modal-card' + (opts && opts.wide ? ' wide' : '');
    c.innerHTML = '<button class="icon-btn modal-x" data-close>✕</button>' + html;
    m.classList.add('open'); m.setAttribute('aria-hidden', 'false');
    return c;
  }
  function closeModal() { const m = $('#modal'); m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); }
  document.addEventListener('click', e => {
    if (e.target.matches('[data-close]') || e.target.id === 'modal') closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  const HAZ = { hv: '⚡', rad: '☢', mag: '🧲', patient: '♥', bio: '☣', laser: '✷', chem: '⚠' };
  const hazardBadges = list => (list || []).map(h => `<span class="haz haz-${esc(h.type)}">${HAZ[h.type] || '⚠'} ${esc(h.label)}</span>`).join('');

  const ring = (pct, size) => {
    size = size || 44; const r = size / 2 - 4, c = 2 * Math.PI * r;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-bg"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle">${pct}%</text></svg>`;
  };

  /* Clip a line from the centre of rect a toward point (tx,ty) at a's border. */
  function edge(n, tx, ty) {
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2, dx = tx - cx, dy = ty - cy;
    if (!dx && !dy) return [cx, cy];
    const sx = (n.w / 2) / Math.abs(dx || 1e-9), sy = (n.h / 2) / Math.abs(dy || 1e-9), s = Math.min(sx, sy);
    return [cx + dx * s, cy + dy * s];
  }

  /* Technical block diagram. Nodes carry data-node; active nodes/links glow and
     animate. Zones render as hatched hazard areas. */
  function diagram(eq, opts) {
    opts = opts || {};
    const d = eq.diagram; if (!d) return '<p class="muted">No diagram.</p>';
    const active = new Set(opts.active || []);
    const byId = {}; d.nodes.forEach(n => byId[n.id] = n);
    const zones = (d.zones || []).map(z => `<g class="zone zone-${esc(z.type)}"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14"/><text x="${z.x + 12}" y="${z.y + 18}">${HAZ[z.type] || '⚠'} ${esc(z.label)}</text></g>`).join('');
    const links = (d.links || []).map(([a, b, label]) => {
      const A = byId[a], B = byId[b]; if (!A || !B) return '';
      const [x1, y1] = edge(A, B.x + B.w / 2, B.y + B.h / 2), [x2, y2] = edge(B, A.x + A.w / 2, A.y + A.h / 2);
      const on = active.has(a) && active.has(b);
      const lbl = label ? `<text class="link-label" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle">${esc(label)}</text>` : '';
      return `<g class="link${on ? ' on' : ''}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#arr)"/>${lbl}</g>`;
    }).join('');
    const visited = opts.visited || {};
    const nodes = d.nodes.map(n => {
      const c = (eq.components || {})[n.id] || {};
      const cls = ['node', active.has(n.id) ? 'on' : '', visited[n.id] ? 'seen' : '', opts.dim && active.size && !active.has(n.id) ? 'dim' : ''].join(' ');
      const words = String(n.label).split(' '); const lines = []; let cur = '';
      words.forEach(w => { if ((cur + ' ' + w).trim().length > Math.floor(n.w / 9.2)) { lines.push(cur.trim()); cur = w; } else cur += ' ' + w; });
      lines.push(cur.trim());
      const ty = n.y + n.h / 2 - (lines.length - 1) * 8;
      return `<g class="${cls}" data-node="${esc(n.id)}" tabindex="0" role="button" aria-label="${esc(c.name || n.label)}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="10"/><circle class="pulse" cx="${n.x + n.w - 10}" cy="${n.y + 10}" r="4"/>${lines.map((l, i) => `<text x="${n.x + n.w / 2}" y="${ty + i * 16}" text-anchor="middle" dominant-baseline="middle">${esc(l)}</text>`).join('')}</g>`;
    }).join('');
    return `<svg class="diagram" viewBox="0 0 ${d.w} ${d.h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(eq.name)} system diagram">
      <defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arrow"/></marker>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" class="gridline"/></pattern></defs>
      <rect width="100%" height="100%" fill="url(#grid)" class="grid-bg"/>${zones}${links}${nodes}</svg>`;
  }

  /* Quiz engine. Calls onDone({score,total,pct,domains,wrong}). */
  function quiz(root, questions, onDone, opts) {
    opts = opts || {};
    let i = 0, score = 0; const domains = {}, wrong = [];
    function render() {
      if (i >= questions.length) return finish();
      const q = questions[i];
      root.innerHTML = `<div class="quiz-card">
        <div class="quiz-meta"><span>Question ${i + 1} / ${questions.length}</span><span class="tag">${esc(q.domain || 'knowledge')}</span></div>
        ${q.img ? `<div class="quiz-img">${q.img}</div>` : ''}
        <h3>${esc(q.q)}</h3>
        <div class="options">${q.options.map((o, k) => `<button class="opt" data-k="${k}"><b>${'ABCD'[k]}</b> ${esc(o)}</button>`).join('')}</div>
        <div class="quiz-feedback"></div></div>`;
      $$('.opt', root).forEach(b => b.onclick = () => {
        const k = +b.dataset.k, ok = k === q.answer, dm = q.domain || 'knowledge';
        domains[dm] = domains[dm] || [0, 0]; domains[dm][1]++;
        if (ok) { score++; domains[dm][0]++; } else wrong.push(q);
        $$('.opt', root).forEach(x => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('right'); });
        if (!ok) b.classList.add('wrong');
        $('.quiz-feedback', root).innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><b>${ok ? 'Correct.' : 'Not quite.'}</b> ${esc(q.why || '')}</div><button class="btn btn-primary next">${i + 1 < questions.length ? 'Next →' : 'See results'}</button>`;
        $('.next', root).onclick = () => { i++; render(); };
      });
    }
    function finish() {
      const pct = Math.round(score / questions.length * 100);
      const band = pct >= 90 ? 'ADVANCED' : pct >= 70 ? 'PASS' : 'NEEDS IMPROVEMENT';
      const res = { score, total: questions.length, pct, band, domains, wrong: wrong.map(w => w.q) };
      root.innerHTML = `<div class="quiz-card result"><div class="result-band band-${band.replace(/ /g, '-').toLowerCase()}">${band}</div>
        <h2>${score} / ${questions.length} · ${pct}%</h2>
        <div class="domain-bars">${BME.DOMAINS.map(d => { const v = domains[d]; const p = v ? Math.round(v[0] / v[1] * 100) : null; return `<div class="dbar"><span>${d}</span><div class="bar"><i style="width:${p || 0}%"></i></div><b>${p == null ? '—' : p + '%'}</b></div>`; }).join('')}</div>
        ${wrong.length ? `<details><summary>Review ${wrong.length} missed question(s)</summary><ul>${wrong.map(w => `<li>${esc(w.q)} — <i>${esc(w.options[w.answer])}</i></li>`).join('')}</ul></details>` : ''}
        <button class="btn retry">Retry</button></div>`;
      $('.retry', root).onclick = () => { i = 0; score = 0; Object.keys(domains).forEach(k => delete domains[k]); wrong.length = 0; render(); };
      onDone && onDone(res);
    }
    render();
  }

  /* Signature pad returning a data URL via pad.value(). */
  function signaturePad(canvas) {
    const ctx = canvas.getContext('2d'); let draw = false, dirty = false;
    const pos = e => { const r = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [(p.clientX - r.left) * canvas.width / r.width, (p.clientY - r.top) * canvas.height / r.height]; };
    const color = () => getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#000';
    const start = e => { draw = true; dirty = true; ctx.beginPath(); ctx.moveTo(...pos(e)); e.preventDefault(); };
    const move = e => { if (!draw) return; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = color(); ctx.lineTo(...pos(e)); ctx.stroke(); e.preventDefault(); };
    const end = () => { draw = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
    return { clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; }, value() { return dirty ? canvas.toDataURL('image/png') : ''; } };
  }

  /* Downscale a photo before storing it. */
  function readImage(file, max) {
    max = max || 1280;
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => { const img = new Image(); img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas');
        c.width = img.width * s; c.height = img.height * s; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.82)); }; img.onerror = rej; img.src = fr.result; };
      fr.onerror = rej; fr.readAsDataURL(file);
    });
  }

  const fmtDate = ts => ts ? new Date(ts).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const ago = ts => {
    if (!ts) return 'Never'; const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'Just now'; if (m < 60) return m + ' min ago'; const h = Math.round(m / 60);
    if (h < 24) return h + ' h ago'; return Math.round(h / 24) + ' d ago';
  };
  const uid = p => (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const DISCLAIMER = 'Always verify against the current manufacturer service documentation before performing service.';

  window.UI = { esc, $, $$, toast, modal, closeModal, hazardBadges, ring, diagram, quiz, signaturePad, readImage, fmtDate, ago, uid, DISCLAIMER, HAZ };
})();

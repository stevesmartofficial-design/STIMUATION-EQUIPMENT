/* Live simulator — MRI scanner (console + live acquisition).
   Procedural 3D head phantom (ellipsoids with T1/T2/PD/ADC per tissue) imaged with
   sequence-dependent contrast (spin-echo, FSE, FLAIR, spoiled GRE, EPI-DWI).
   k-space is computed by a real 2D FFT and filled line by line (centric order, EPI zig-zag);
   the image is reconstructed from the lines acquired so far, so it sharpens from the centre
   of k-space outwards. Each sequence has its own synthesised gradient acoustic pattern;
   the cold head "chirps" about once a second when idle. Field, helium and SAR figures are
   simulated training values. */
(function () {
  const { Sound } = Sim;
  const N = 128, NS = 24, H = N / 2;
  /* ---------- radix-2 FFT (in place, strided) ---------- */
  const REV = new Uint16Array(N), TWr = new Float32Array(N / 2), TWi = new Float32Array(N / 2), TR = new Float32Array(N), TI = new Float32Array(N);
  for (let i = 0; i < N; i++) { let r = 0; for (let b = 0, x = i; b < 7; b++, x >>= 1) r = (r << 1) | (x & 1); REV[i] = r; }
  for (let k = 0; k < N / 2; k++) { TWr[k] = Math.cos(-2 * Math.PI * k / N); TWi[k] = Math.sin(-2 * Math.PI * k / N); }
  function fft1(re, im, off, stride, inv) {
    for (let i = 0; i < N; i++) { const j = REV[i], p = off + i * stride; TR[j] = re[p]; TI[j] = im[p]; }
    for (let size = 2; size <= N; size <<= 1) {
      const half = size >> 1, step = N / size;
      for (let i = 0; i < N; i += size) for (let k = 0; k < half; k++) {
        const wr = TWr[k * step], wi = inv ? -TWi[k * step] : TWi[k * step], a = i + k, b = a + half;
        const xr = TR[b] * wr - TI[b] * wi, xi = TR[b] * wi + TI[b] * wr;
        TR[b] = TR[a] - xr; TI[b] = TI[a] - xi; TR[a] += xr; TI[a] += xi;
      }
    }
    const s = inv ? 1 / N : 1; for (let i = 0; i < N; i++) { const p = off + i * stride; re[p] = TR[i] * s; im[p] = TI[i] * s; }
  }
  function fft2(re, im, inv) { for (let r = 0; r < N; r++) fft1(re, im, r * N, 1, inv); for (let c = 0; c < N; c++) fft1(re, im, c, N, inv); }
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(6.2831853 * Math.random());
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  /* ---------- phantom ---------- */
  // tissue: [T1 ms, T2 ms, PD, ADC (×10⁻³ mm²/s), fat?]
  const T = { air: [1, 1, 0, 0], fat: [260, 80, .9, .1, 1], mus: [870, 45, .7, 1.5], bone: [300, 1, .04, .1], csf: [4000, 2000, 1, 3], gm: [950, 100, .8, .8], wm: [600, 80, .7, .7], vit: [4000, 1500, 1, 2.8], les: [1100, 180, .85, .35] };
  const TK = Object.keys(T);
  const L = n => TK.indexOf(n);
  // ellipsoids [cx, cy, cz, rx, ry, rz, label]; x = right, y = posterior, z = superior; later entries win
  const E = [
    [0, .1, -.78, .4, .42, .5, L('mus')], [0, 0, .1, .74, .88, .86, L('fat')], [0, 0, .12, .69, .83, .8, L('bone')],
    [0, 0, .13, .655, .795, .765, L('csf')], [0, 0, .13, .63, .77, .74, L('gm')], [0, 0, .16, .5, .63, .56, L('wm')],
    [0, .36, -.32, .34, .22, .17, L('gm')], [0, .12, -.42, .12, .12, .3, L('wm')],
    [-.12, 0, .26, .07, .3, .11, L('csf')], [.12, 0, .26, .07, .3, .11, L('csf')], [0, .05, .12, .025, .12, .08, L('csf')],
    [-.27, -.66, -.08, .16, .15, .13, L('fat')], [.27, -.66, -.08, .16, .15, .13, L('fat')], [-.27, -.7, -.08, .1, .1, .1, L('vit')], [.27, -.7, -.08, .1, .1, .1, L('vit')],
    [.28, -.1, .32, .1, .12, .1, L('les')]
  ];
  function label(x, y, z) {
    let l = 0;
    for (let i = 0; i < E.length; i++) { const e = E[i], a = (x - e[0]) / e[3], b = (y - e[1]) / e[4], c = (z - e[2]) / e[5]; if (a * a + b * b + c * c <= 1) l = e[6]; }
    return l;
  }
  const fieldMap = (x, y, z, bad) => 0.25 * Math.exp(-(x * x / .05 + (y + .62) * (y + .62) / .03 + (z + .05) * (z + .05) / .04)) +
    0.15 * Math.exp(-((Math.abs(x) - .55) * (Math.abs(x) - .55) / .02 + (y - .1) * (y - .1) / .03 + (z + .15) * (z + .15) / .03)) + (bad ? 0.3 * x + 0.15 * z + 0.1 * x * y : 0);

  /* ---------- sequences ---------- */
  const SEQ = {
    t1se: { name: 'T1 SE', tr: 500, te: 15, etl: 1, period: 0.45, dist: 0.05, noise: 0.012, sar: 0.35 },
    t2fse: { name: 'T2 FSE', tr: 4000, te: 100, etl: 16, period: 3.0, shotDur: 0.3, dist: 0.05, noise: 0.012, sar: 0.8 },
    flair: { name: 'FLAIR', tr: 9000, ti: 2500, te: 120, etl: 16, period: 4.5, shotDur: 0.3, dist: 0.05, noise: 0.015, sar: 0.65 },
    gre: { name: 'GRE (spoiled, T1/T2*)', tr: 25, te: 5, flip: 25, etl: 1, period: 0.08, dist: 0.2, noise: 0.012, sar: 0.15, t2s: 1 },
    epi: { name: 'EPI / DWI', te: 90, epi: 1, period: 4.0, shots: 6, dist: 0.6, noise: 0.02, sar: 0.3, t2s: 1 }
  };
  const BVAL = [0, 500, 1000];
  function signal(l, q, b) {
    const t = T[TK[l]]; if (!t[2]) return 0;
    const [T1, T2, PD, ADC, fat] = t; let s;
    if (q.epi) s = PD * Math.exp(-q.te / T2) * Math.exp(-b * ADC / 1000) * (fat ? 0.08 : 1);
    else if (q.ti) s = PD * Math.abs(1 - 2 * Math.exp(-q.ti / T1) + Math.exp(-q.tr / T1)) * Math.exp(-q.te / T2);
    else if (q.flip) { const E1 = Math.exp(-q.tr / T1), a = q.flip * Math.PI / 180; s = PD * Math.sin(a) * (1 - E1) / (1 - Math.cos(a) * E1) * Math.exp(-q.te / (T2 * 0.6)) * 3; }
    else s = PD * (1 - Math.exp(-q.tr / T1)) * Math.exp(-q.te / T2);
    return s;
  }
  // acoustic patterns: one cycle = [period, [[offset, type], ...]]
  const PAT = {
    t1se: [0.45, [[0, 'knock'], [.026, 'knock2'], [.11, 'knock'], [.136, 'knock2'], [.22, 'knock'], [.246, 'knock2'], [.33, 'knock'], [.356, 'knock2']]],
    t2fse: [3.0, (() => { const a = []; for (let tr = 0; tr < 8; tr++) { a.push([tr * .3, 'rf']); for (let i = 0; i < 16; i++) a.push([tr * .3 + .012 + i * .009, 'tick']); } return a; })()],
    flair: [4.5, (() => { const a = [[0, 'inv']]; for (let tr = 0; tr < 6; tr++) { a.push([1.1 + tr * .3, 'rf']); for (let i = 0; i < 16; i++) a.push([1.1 + tr * .3 + .012 + i * .009, 'tick']); } return a; })()],
    gre: [0.05, [[0, 'tap'], [.025, 'tap2']]],
    epi: [0.2, [[0, 'thump'], [.045, 'thump'], [.09, 'buzz']]]
  };
  function emit(type, when, weak) {
    const k = weak ? 0.4 : 1;
    switch (type) {
      case 'knock': Sound.beep(95, .035, { type: 'square', lp: 900, vol: .2 * k, when }); Sound.burst(.03, { filter: 'lowpass', freq: 420, vol: .2 * k, when }); break;
      case 'knock2': Sound.beep(150, .025, { type: 'square', lp: 1300, vol: .12 * k, when }); break;
      case 'rf': Sound.beep(120, .02, { type: 'square', lp: 700, vol: .12 * k, when }); break;
      case 'tick': Sound.beep(340, .006, { type: 'square', lp: 2600, vol: .11 * k, when, attack: .001, release: .003 }); break;
      case 'inv': Sound.beep(90, .2, { type: 'sine', slide: 42, vol: .32 * k, when }); Sound.burst(.12, { filter: 'lowpass', freq: 220, vol: .22 * k, when }); break;
      case 'tap': Sound.beep(190, .009, { type: 'square', lp: 1500, vol: .13 * k, when, attack: .001, release: .004 }); break;
      case 'tap2': Sound.beep(190, .009, { type: 'square', lp: 1100, vol: .07 * k, when, attack: .001, release: .004 }); break;
      case 'thump': Sound.beep(68, .04, { type: 'square', lp: 420, vol: .24 * k, when }); break;
      case 'buzz': Sound.beep(1150, .075, { type: 'sawtooth', lp: 4200, vol: .12 * k, when, attack: .004, release: .01 }); Sound.beep(2300, .075, { type: 'square', lp: 4200, vol: .025 * k, when, attack: .004, release: .01 }); break;
    }
    if (weak && Math.random() < 0.15) Sound.burst(.05, { filter: 'highpass', freq: 3000, vol: .12, when });
  }
  const ORDER_C = (() => { const o = [H]; for (let i = 1; o.length < N; i++) { o.push(H - i); if (H + i < N) o.push(H + i); } return o; })();

  const fit = c => {
    const d = window.devicePixelRatio || 1, w = Math.max(40, c.clientWidth || 300), h = Math.max(40, c.clientHeight || 200);
    const W = Math.round(w * d), Hh = Math.round(h * d), resized = c.width !== W || c.height !== Hh;
    if (resized) { c.width = W; c.height = Hh; }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return { g, w, h, resized };
  };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const fmtT = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const PLANES = { ax: 'Axial', cor: 'Coronal', sag: 'Sagittal' };

  /* ---------- image formation ---------- */
  function coords(pl, u, v, pos, out) {
    if (pl === 'ax') { out[0] = u; out[1] = v; out[2] = pos; } else if (pl === 'cor') { out[0] = u; out[1] = pos; out[2] = -v; } else { out[0] = pos; out[1] = u; out[2] = -v; }
  }
  const XYZ = new Float32Array(3);
  function prepare(S) {
    const m = S.mr, q = SEQ[m.imgSeq], f = S.fault, re = m.Ir, im = m.Ii, pl = m.view.plane, pos = -0.85 + m.view.idx / (NS - 1) * 1.7;
    const bad = f.has('shim'), dist = q.dist * (bad ? 1.6 : m.shimmed ? 0.15 : 0.4), coil = f.has('coil');
    let max = 1e-6;
    for (let iv = 0; iv < N; iv++) for (let iu = 0; iu < N; iu++) {
      const u = -1 + (iu + .5) * 2 / N, v0 = -1 + (iv + .5) * 2 / N;
      coords(pl, u, v0, pos, XYZ);
      const fm = fieldMap(XYZ[0], XYZ[1], XYZ[2], bad);
      coords(pl, u, v0 - dist * fm, pos, XYZ);                                  // geometric shift along phase-encode (vertical)
      let s = signal(label(XYZ[0], XYZ[1], XYZ[2]), q, m.bval);
      if (q.t2s) s *= Math.max(0.05, 1 - Math.abs(fm) * dist * 5);             // intravoxel dephasing near air/bone
      if (coil) {                                                               // 8-element head coil, element 6 open
        let all = 0, ok = 0;
        for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, ex = 1.15 * Math.cos(a), ey = 1.15 * Math.sin(a), w = Math.exp(-((u - ex) * (u - ex) + (v0 - ey) * (v0 - ey)) / 0.3); all += w * w; if (k !== 1) ok += w * w; }
        s *= ok / all;
      }
      const p = iv * N + iu; re[p] = s; im[p] = 0; if (s > max) max = s;
    }
    if (f.has('rf')) for (let iv = 0; iv < N; iv++) { const p = iv * N + 86; re[p] += gauss() * 0.25 * max; im[p] += gauss() * 0.25 * max; } // zipper at the interference frequency
    m.norm = max * 1.08;
    const Kr = m.Kr, Ki = m.Ki; Kr.set(re); Ki.set(im); fft2(Kr, Ki, false);
    const sk = q.noise * max * N * (f.has('rf') ? 1.8 : 1) * (m.field < 1.4 ? 3 : 1);
    for (let i = 0; i < N * N; i++) { Kr[i] += gauss() * sk; Ki[i] += gauss() * sk; }
    if (f.has('rf')) { const ky = (H + 18 + (Math.random() * 30 | 0)) % N, kx = (Math.random() * N) | 0; Kr[ky * N + kx] += 0.07 * max * N * N; } // RF spike → herringbone
    // k-space display (fftshifted log magnitude)
    let lmax = 0; const KG = m.KG;
    for (let r = 0; r < N; r++) { const ar = ((r + H) % N) * N; for (let c = 0; c < N; c++) { const i = ar + (c + H) % N, l = Math.log(1 + Math.hypot(Kr[i], Ki[i]) / (max + 1e-6)); KG[r * N + c] = l; if (l > lmax) lmax = l; } }
    for (let i = 0; i < N * N; i++) KG[i] = Math.pow(KG[i] / (lmax || 1), 1.6);
    paintK(S); m.reconDue = true;
  }
  function paintK(S) {
    const m = S.mr, d = m.kImg.data;
    for (let r = 0; r < N; r++) { const a = m.acq[r]; for (let c = 0; c < N; c++) { const i = (r * N + c) * 4, g = a ? Math.round(255 * m.KG[r * N + c]) : 0; d[i] = a === 2 ? Math.min(255, g + 40) : g * 0.75; d[i + 1] = a ? g : 8; d[i + 2] = a ? Math.min(255, g + 30) : 18; d[i + 3] = 255; } }
    m.kCtx.putImageData(m.kImg, 0, 0); m.dirty = true;
  }
  function recon(S) {
    const m = S.mr, Wr = m.Wr, Wi = m.Wi, cg = Math.cos(0.9), sg = Math.sin(0.9);
    for (let r = 0; r < N; r++) {
      const a = m.acq[r], o = ((r + H) % N) * N;
      if (!a) { for (let j = 0; j < N; j++) { Wr[o + j] = 0; Wi[o + j] = 0; } }
      else if (a === 2 && (r & 1)) { for (let j = 0; j < N; j++) { const xr = m.Kr[o + j], xi = m.Ki[o + j]; Wr[o + j] = xr * cg - xi * sg; Wi[o + j] = xr * sg + xi * cg; } } // odd/even phase error → N/2 ghost
      else { for (let j = 0; j < N; j++) { Wr[o + j] = m.Kr[o + j]; Wi[o + j] = m.Ki[o + j]; } }
    }
    fft2(Wr, Wi, true);
    const d = m.iImg.data, k = 255 / (m.norm || 1);
    for (let p = 0; p < N * N; p++) { const g = Math.min(255, Math.hypot(Wr[p], Wi[p]) * k) | 0, i = p * 4; d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255; }
    m.iCtx.putImageData(m.iImg, 0, 0); m.reconDue = false; m.dirty = true;
  }

  /* ---------- console helpers ---------- */
  function syncView(S) {
    const m = S.mr; S.el.querySelectorAll('[data-mrplane]').forEach(b => b.classList.toggle('on', b.dataset.mrplane === m.view.plane));
    const sl = S.$('#mrSl'); if (sl && +sl.value !== m.view.idx + 1) sl.value = m.view.idx + 1;
    S.num('mrSlN', `${PLANES[m.view.plane]} ${m.view.idx + 1}/${NS}`);
    if (m.imgSeq) prepare(S); else m.dirty = true;
  }
  function stopScan(S, msg, kind) { const m = S.mr; if (m.ph === 'idle') return; m.ph = 'idle'; S.log(msg, kind || 'info'); m.msg = msg; }

  Sim.register('mri', {
    title: 'MRI scanner console — live acquisition',
    intro: 'Pick a sequence and start: hear its gradient rhythm, watch k-space fill line by line and the image sharpen as the centre of k-space is filled. Scroll through slices in three planes. The cold head chirps in the background. Inject faults, then reason from the artefact.',
    stage: () => `<style>
      .mrx-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #13223d;font:700 .8rem var(--mono)}
      .mrx-st{color:#9fd0ff}.mrx-msg{color:#f5b84a;font-weight:600}.mrx-on{padding:3px 10px;border-radius:6px;background:#13223d;color:#5a6f92}
      .mrx-on.on{background:#36d39a;color:#02130b}
      .mrx-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr)}
      .mrx-grid canvas{display:block;width:100%;height:330px}
      .mrx-grid>div:first-child{border-right:1px solid #13223d}
      .mrx-vc{display:flex;gap:6px;align-items:center;flex-wrap:wrap;padding:8px 10px;border-top:1px solid #13223d}
      .mrx-vc button{background:#0b1526;color:#8ea3c4;border:1px solid #1f3558;border-radius:6px;padding:4px 10px;font:600 .78rem Inter,sans-serif;cursor:pointer}
      .mrx-vc button.on{background:#1d3f73;color:#e6eefb;border-color:#4dd0ff}
      .mrx-vc input{flex:1;min-width:110px;margin:0}
      .mrx-vc span{font:600 .78rem var(--mono);color:#8ea3c4;min-width:96px;text-align:right}
      #mrImg{cursor:ns-resize}
      .mrx-q{position:absolute;inset:0;z-index:4;display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:24px;text-align:center;background:rgba(90,0,0,.9);color:#fff}
      .mrx-q.show{display:flex}
      .mrx-q h2{margin:0;font-size:1.7rem;letter-spacing:.04em}.mrx-q p{max-width:620px;margin:0;line-height:1.5}
      .mrx-ro small i{font-style:normal;text-transform:none;letter-spacing:0;opacity:.75}.mrx-ro b{font-size:1.1rem}
      @media(max-width:820px){.mrx-grid{grid-template-columns:1fr}.mrx-grid>div:first-child{border-right:0;border-bottom:1px solid #13223d}.mrx-grid canvas{height:270px}}
    </style>
    <div class="mrx-bar"><span class="mrx-on" id="mrOn">● SCANNING</span><span class="mrx-st" data-num="mrSt">IDLE</span><span class="mrx-msg" data-num="mrMsg"></span></div>
    <div class="mrx-grid"><div><canvas id="mrK"></canvas></div>
      <div><canvas id="mrImg" title="Mouse wheel: step through slices"></canvas>
        <div class="mrx-vc"><button data-mrplane="ax">Axial</button><button data-mrplane="cor">Coronal</button><button data-mrplane="sag">Sagittal</button>
          <input type="range" id="mrSl" min="1" max="${NS}" step="1" value="16" aria-label="Slice"><span data-num="mrSlN">Axial 16/${NS}</span></div></div></div>
    <div class="sim-readout mrx-ro">
      <div style="--c:#4dd0ff"><small>Helium level</small><b data-num="he">--</b><div class="sim-meter"><i id="mrHeM" style="--c:#4dd0ff;width:0"></i></div></div>
      <div style="--c:#c3a6ff"><small>Helium vessel pressure</small><b data-num="press">--</b></div>
      <div style="--c:#36d39a"><small>Cold head</small><b data-num="ch">--</b></div>
      <div style="--c:#f5b84a"><small>Magnet field B₀ <i>(simulated)</i></small><b data-num="b0">--</b></div>
      <div style="--c:#ff8fa3"><small>SAR <i>(rel., training estimate)</i></small><b data-num="sar">--</b><div class="sim-meter"><i id="mrSarM" style="--c:#ff8fa3;width:0"></i></div></div>
      <div style="--c:#e6eefb"><small>Scan time remaining</small><b data-num="trem">--</b></div>
    </div>
    <div class="mrx-q" id="mrQ"><h2>⚠ MAGNET QUENCHED</h2><p data-num="mrQtxt"></p><p><b>Emergency use only.</b> In real life: keep everyone out of the magnet room until the hiss has stopped, make sure the quench pipe vented outside (fog in the room or a door that will not open means it did not), open the room door outward if pressure allows, and call the manufacturer's service team. Do not try to re-ramp yourself.</p><button class="btn" id="mrQack">Acknowledge</button></div>`,
    controls: [
      { id: 'seq', label: 'Sequence', type: 'select', options: [['t1se', 'T1 spin echo'], ['t2fse', 'T2 fast spin echo'], ['flair', 'FLAIR (T2, CSF nulled)'], ['gre', 'Gradient echo (spoiled)'], ['epi', 'EPI / diffusion (DWI)']], value: 't2fse' },
      { id: 'ff', label: 'Teaching fast-forward ×4 (k-space only)', type: 'toggle', value: false },
      { id: 'chVol', label: 'Cold-head sound', type: 'toggle', value: true }
    ],
    actions: [{ id: 'start', label: '▶ Start scan', primary: true }, { id: 'stop', label: '■ Stop' }, { id: 'shim', label: '⌁ Shim' }, { id: 'intercom', label: '🎙 Patient intercom' }, { id: 'quench', label: '⚠ Emergency quench' }, { id: 'ramp', label: 'Service: refill & ramp magnet' }],
    faults: [
      { id: 'rf', label: 'RF door open / RF leak', explain: 'Outside RF is leaking into the Faraday cage. A fixed-frequency interferer shows as a "zipper" line along the phase-encode direction at one position, broadband noise lowers SNR, and spikes in k-space make herringbone stripes. The pre-scan noise check warns about elevated RF noise.', check: 'Check that the RF door is closed and the finger-stock is clean and making contact, look for any equipment brought into the room, check the penetration panel filters and waveguides, then run an RF noise / spike check with the service tool.' },
      { id: 'coldhead', label: 'Cold-head compressor off', explain: 'The cold-head chirp has stopped, which is the classic audible clue. Without re-condensing, helium boils off: vessel pressure rises and the level falls (accelerated here). Left alone this leads to venting, then a risk of quench.', check: 'Check the compressor is running: power, chilled-water supply and flow, the supply and return helium pressures, and the adsorber hours. Check the cold-head cable. Call the magnet service team early, because time matters.' },
      { id: 'grad', label: 'Gradient amplifier fault', explain: 'One gradient axis is misbehaving. The acoustic noise sounds weak and crackly, odd and even k-space lines get inconsistent phase (N/2 ghosting), and after a few seconds the amplifier trips and aborts the scan.', check: 'Read the gradient amplifier error log (over-current, over-temperature, axis), check the amplifier cooling water, and the cabinet-to-coil cables and filters. Run the gradient calibration / duty-cycle tests.' },
      { id: 'coil', label: 'Coil element failure', explain: 'One element of the phased-array head coil is open. The image has a dark, low-SNR region on the side nearest that element, while the rest of the image is normal.', check: 'Run the coil element / noise test from service software, inspect the coil plug pins and cable, and try another coil. If the dark zone follows the coil, the coil is faulty.' },
      { id: 'shim', label: 'B₀ inhomogeneity / shim failure', explain: 'The main field is not uniform. Echo-planar and gradient-echo images are stretched and warped along the phase-encode direction, with signal loss near air–bone interfaces. The Shim action fails to converge with a wide linewidth.', check: 'Look for metal in the bore or on the patient, re-run the shim, check the shim supply/currents and the room for new ferromagnetic objects. A persistent fault needs magnet field mapping by the service team.' },
      { id: 'bulb', label: 'Patient alarm bulb pressed', explain: 'The patient squeezed the alarm bulb. The scan pauses and the console sounds the patient alarm. This is a patient-safety event, not a technical fault: talk to the patient over the intercom straight away.', check: 'Use the intercom and go to the patient if needed. Afterwards, check the bulb, its tubing and the pressure switch still trigger reliably. A split tube means the alarm cannot be raised.' }
    ],

    init(S) {
      if (!S.mrMag) S.mrMag = { field: 1.5, he: 78.4, press: 2.4, quenched: false };
      if (!S.mrView) S.mrView = { plane: 'ax', idx: 15 };
      const m = S.mr = {
        ph: 'idle', seqT: 0, acq: new Uint8Array(N), lines: 0, shot: -1, bval: 0, imgSeq: null, scanSeq: null, view: S.mrView, shimmed: false,
        acNext: 0, acI: 0, chT: 0.4, gradT: 0, msg: '', boilLogged: false, reconT: 0, quenchT: -1, rampT: -1, dirty: true,
        Ir: new Float32Array(N * N), Ii: new Float32Array(N * N), Kr: new Float32Array(N * N), Ki: new Float32Array(N * N), Wr: new Float32Array(N * N), Wi: new Float32Array(N * N), KG: new Float32Array(N * N),
        kC: mkCanvas(N, N), iC: mkCanvas(N, N), get field() { return S.mrMag.field; }
      };
      m.kCtx = m.kC.getContext('2d'); m.iCtx = m.iC.getContext('2d'); m.kImg = m.kCtx.createImageData(N, N); m.iImg = m.iCtx.createImageData(N, N);
      paintK(S);
      S.el.querySelectorAll('[data-mrplane]').forEach(b => b.onclick = () => { if (!S.on) return; m.view.plane = b.dataset.mrplane; m.view.idx = Math.round((NS - 1) / 2); syncView(S); });
      const sl = S.$('#mrSl'); if (sl) sl.oninput = () => { if (!S.on) return; m.view.idx = clamp(+sl.value - 1, 0, NS - 1); syncView(S); };
      const img = S.$('#mrImg'); if (img) img.onwheel = e => { if (!S.on) return; e.preventDefault(); const n = clamp(m.view.idx + (e.deltaY > 0 ? 1 : -1), 0, NS - 1); if (n !== m.view.idx) { m.view.idx = n; syncView(S); } };
      const ack = S.$('#mrQack'); if (ack) ack.onclick = () => { const q = S.$('#mrQ'); if (q) q.classList.remove('show'); };
      syncView(S);
      if (S.mrMag.quenched) S.log('Magnet is NOT at field (quenched earlier). Refill and ramp before scanning.', 'bad');
      else S.log('Magnet at field. Cold head running. Select a sequence and start.', 'info');
    },

    onControl(S, id, val) {
      const m = S.mr; if (!m) return;
      if (id === 'seq' && m.ph !== 'idle') S.log('Sequence change applies to the next scan', 'warn');
    },
    onFault(S, id, on) {
      const m = S.mr; if (!m) return;
      if (id === 'grad' && !on) { S.clear('grad'); m.gradT = 0; }
      if (id === 'bulb' && on && m.ph === 'scan') { m.ph = 'paused'; m.msg = 'Paused — patient alarm'; S.log('Patient alarm bulb squeezed — scan paused, gradients and RF stopped', 'bad'); }
      if (id === 'bulb' && !on && m.ph === 'paused') S.log('Patient alarm reset. Press Start to resume the paused scan.', 'info');
      if (['rf', 'coil', 'shim'].includes(id) && m.imgSeq) prepare(S);
    },

    onAction(S, id) {
      const m = S.mr, f = S.fault, mag = S.mrMag;
      if (id === 'start') {
        if (m.ph === 'paused') {
          if (f.has('bulb')) return S.log('Cannot resume: patient alarm still active — talk to the patient first', 'bad');
          m.ph = 'scan'; m.msg = ''; m.acNext = m.seqT; S.log('Scan resumed'); return;
        }
        if (m.ph !== 'idle') return S.log('Already scanning');
        if (mag.quenched || mag.field < 1.49) return S.log('Cannot scan: magnet is not at field', 'bad');
        if (f.has('bulb')) return S.log('Cannot start: patient alarm active', 'bad');
        const key = S.v.seq, q = SEQ[key];
        m.scanSeq = key; m.imgSeq = key; m.ph = 'prescan'; m.seqT = 0; m.acq.fill(0); m.lines = 0; m.shot = -1; m.bval = 0; m.gradT = 0; m.acNext = 0; m.acI = 0; m.msg = '';
        prepare(S);
        S.log(`Pre-scan: centre frequency, transmitter (RF power) and receiver gain calibration for ${q.name}`);
        if (f.has('rf')) S.log('Pre-scan noise check: RF noise floor ELEVATED — check the RF door / room integrity', 'warn');
        Sound.beep(660, 0.08, { vol: 0.08 });
        return;
      }
      if (id === 'stop') { if (m.ph === 'idle') return S.log('No scan running'); stopScan(S, 'Scan stopped by operator — partial data kept', 'warn'); return; }
      if (id === 'shim') {
        if (m.ph !== 'idle') return S.log('Shim runs between scans', 'warn');
        if (mag.quenched || mag.field < 1.49) return S.log('Cannot shim: magnet not at field', 'bad');
        for (let i = 0; i < 10; i++) emit(i % 2 ? 'tap2' : 'tap', Sound.now + 0.05 + i * 0.09);
        if (f.has('shim')) { m.shimmed = false; S.log('Shim did NOT converge: water linewidth ~145 Hz (training value). Field inhomogeneity beyond shim range.', 'bad'); }
        else { m.shimmed = true; S.log('Shim converged: water linewidth ~20 Hz (training value)', 'ok'); }
        if (m.imgSeq) prepare(S);
        return;
      }
      if (id === 'intercom') {
        if (f.has('bulb')) { Sound.speak('This is the operator. I can see you pressed the alarm. Are you all right? Stay still, I am coming in.'); S.log('Intercom: patient reports feeling hot and anxious. Reassure, or stop and bring them out. Then reset the alarm (clear the fault).', 'warn'); }
        else if (m.ph === 'scan') { const q = SEQ[m.scanSeq]; Sound.speak(`This is the operator. You are doing well. This scan takes about ${Math.max(1, Math.round(remaining(S) / 60))} more minute. Please keep still.`); S.log(`Intercom: patient reassured during ${q.name}`); }
        else { Sound.speak('Hello, this is the operator. The next scan will be noisy. Please keep very still, and squeeze the bulb if you need me.'); S.log('Intercom: patient briefed'); }
        return;
      }
      if (id === 'quench') {
        if (mag.quenched) return S.log('Magnet already quenched', 'warn');
        const ok = window.confirm('EMERGENCY QUENCH — EMERGENCY USE ONLY.\n\nA real quench boils off the helium in seconds and removes the magnetic field. It is used only to free a person trapped by a ferromagnetic object, or in a fire or other emergency where the field must go.\n\nIt can damage the magnet and take it out of service for weeks.\n\nRun the simulated quench?');
        if (!ok) return S.log('Quench cancelled — correct unless there is a real emergency', 'info');
        stopScan(S, 'Scan aborted — emergency quench', 'bad');
        mag.quenched = true; m.quenchT = 0; m.rampT = -1;
        m.vHiss = Sound.voice({ noise: true, filter: 'highpass', freq: 650 }); m.vHiss.set({ vol: 0.55, glide: 0.05 });
        m.vRumble = Sound.voice({ noise: true, filter: 'lowpass', freq: 170 }); m.vRumble.set({ vol: 0.4, glide: 0.05 });
        Sound.burst(0.8, { filter: 'lowpass', freq: 140, vol: 0.6 }); Sound.beep(55, 0.6, { vol: 0.35, slide: 30 });
        S.log('EMERGENCY QUENCH ACTIVATED — helium venting through the quench pipe, field ramping down', 'bad');
        S.num('mrQtxt', `Quench activated at ${new Date().toLocaleTimeString()}. The field is collapsing and the helium is boiling off. The magnet is out of service until the manufacturer re-fills and re-ramps it.`);
        const q = S.$('#mrQ'); if (q) q.classList.add('show');
        return;
      }
      if (id === 'ramp') {
        if (!mag.quenched) return S.log('Magnet is already at field — ramping is a service-only task after a quench', 'info');
        if (m.quenchT >= 0 && m.quenchT < 20) return S.log('Wait for the quench to finish', 'warn');
        if (f.has('coldhead')) return S.log('Cannot ramp: cold head / compressor not running', 'bad');
        m.rampT = 0; S.log('Service: helium refill and magnet ramp started (shortened for training)', 'info');
      }
    },

    tick(S, dt, t) {
      const m = S.mr, f = S.fault, mag = S.mrMag, v = S.v;
      // ---- cryogenics ----
      const ch = !f.has('coldhead');
      if (m.quenchT >= 0) {
        m.quenchT += dt; const k = m.quenchT;
        mag.field = 1.5 * Math.exp(-k / 6); if (mag.field < 0.005) mag.field = 0;
        mag.he = Math.max(0, mag.he - dt * 6); mag.press = k < 2 ? 2.4 + k * 3.5 : Math.max(0.6, mag.press - dt * 0.4);
        if (m.vHiss) { m.vHiss.set({ vol: 0.55 * Math.exp(-k / 9), freq: 650 + 900 * Math.exp(-k / 5), glide: 0.2 }); m.vRumble.set({ vol: 0.4 * Math.exp(-k / 6), glide: 0.2 }); }
        if (k > 30) { m.quenchT = -1; if (m.vHiss) { m.vHiss.stop(); m.vRumble.stop(); m.vHiss = m.vRumble = null; } S.log('Quench complete: field 0 T, helium lost. Log the event and call the magnet service team.', 'bad'); }
      } else if (m.rampT >= 0) {
        m.rampT += dt; mag.he = Math.min(76, mag.he + dt * 8); mag.press += (2.4 - mag.press) * dt;
        mag.field = Math.min(1.5, 1.5 * m.rampT / 14);
        if (m.rampT >= 14) { m.rampT = -1; mag.field = 1.5; mag.quenched = false; S.log('Magnet at field 1.5 T (simulated). Shim before scanning.', 'ok'); m.shimmed = false; }
      } else {
        if (!ch) {
          mag.press += dt * 0.02; mag.he = Math.max(0, mag.he - dt * 0.015);
          if (!m.boilLogged) { m.boilLogged = true; S.log('Magnet monitor: cold head stopped — boil-off has started (rates accelerated for training)', 'warn'); }
        } else { m.boilLogged = false; mag.press += ((mag.quenched ? 0.6 : 2.4) - mag.press) * dt * 0.05; }
      }
      // cold head sound + pressure ripple
      m.chT -= dt;
      if (m.chT <= 0) {
        m.chT += 1.1;
        if (ch && v.chVol && mag.he > 1) {
          const k = m.ph === 'scan' ? 0.5 : 1, w = Sound.now + 0.02;
          Sound.beep(1900, 0.07, { slide: 2600, vol: 0.025 * k, when: w, type: 'triangle' });
          Sound.burst(0.13, { filter: 'bandpass', freq: 2600, q: 1.4, vol: 0.05 * k, when: w });
          Sound.burst(0.22, { filter: 'lowpass', freq: 260, vol: 0.08 * k, when: w + 0.5 });
        }
      }
      const pShow = mag.press + (ch && m.quenchT < 0 ? 0.04 * Math.sin(t * 2 * Math.PI / 1.1) : 0);

      // ---- sequence ----
      const q = m.scanSeq ? SEQ[m.scanSeq] : null, ff = v.ff ? 4 : 1;
      if (m.ph === 'prescan') { m.seqT += dt; if (m.seqT > 2) { m.ph = 'scan'; m.seqT = 0; m.acNext = 0; m.acI = 0; S.log(`${q.name} running — ${q.epi ? 'single-shot EPI with b = 0, 500, 1000' : (q.etl > 1 ? 'echo train ' + q.etl : 'one line per TR')}`); } }
      else if (m.ph === 'scan') {
        m.seqT += dt;
        // acoustic scheduler (real rhythm, lookahead)
        const [per, ev] = PAT[m.scanSeq], weak = f.has('grad');
        let guard = 0;
        while (m.acNext < m.seqT + 0.15 && guard++ < 400) {
          const cyc = Math.floor(m.acI / ev.length), e = ev[m.acI % ev.length], at = cyc * per + e[0];
          if (at < m.seqT - 0.05) { m.acI++; m.acNext = at; continue; }               // skip events missed while the tab was hidden
          emit(e[1], Sound.now + Math.max(0, at - m.seqT), weak);
          m.acI++; const nx = ev[m.acI % ev.length], ncyc = Math.floor(m.acI / ev.length); m.acNext = ncyc * per + nx[0];
        }
        // k-space acquisition clock
        const tc = m.seqT * ff, flag = weak ? 2 : 1;
        if (q.epi) {
          const shot = Math.min(q.shots - 1, Math.floor(tc / q.period));
          if (shot !== m.shot) { m.shot = shot; m.bval = BVAL[shot % 3]; m.acq.fill(0); m.lines = 0; prepare(S); }
          const want = Math.min(N, Math.floor((tc - shot * q.period) / 0.4 * N));
          let changed = false;
          while (m.lines < want) { m.acq[m.lines] = flag; m.lines++; changed = true; }
          if (changed) { paintK(S); m.reconDue = true; }
          if (shot === q.shots - 1 && m.lines >= N) done(S);
        } else {
          const shots = Math.floor(tc / q.period), frac = tc - shots * q.period, sd = q.shotDur || q.period;
          const want = Math.min(N, shots * q.etl + Math.min(q.etl, Math.floor(frac / sd * q.etl)));
          let changed = false;
          while (m.lines < want) { m.acq[ORDER_C[m.lines]] = flag; m.lines++; changed = true; }
          if (changed) { paintK(S); m.reconDue = true; }
          if (m.lines >= N) done(S);
        }
        if (weak && m.ph === 'scan') { m.gradT += dt; if (m.gradT > 3.5) { S.alarm('grad', 'high', 'GRADIENT AMPLIFIER FAULT (Y axis over-current)'); stopScan(S, 'Gradient amplifier tripped — scan aborted', 'bad'); } }
      }
      if (m.reconDue && t - m.reconT > 0.1) { m.reconT = t; recon(S); }

      // ---- alarms ----
      const set = (cond, id, pr, text) => cond ? S.alarm(id, pr, text) : S.clear(id);
      set(!ch, 'coldhead', 'med', 'COLD HEAD STOPPED — CHECK COMPRESSOR');
      set(mag.press > 4 && m.quenchT < 0, 'press', mag.press > 5.5 ? 'high' : 'med', 'HELIUM VESSEL PRESSURE HIGH');
      set(mag.he < 70 && !mag.quenched, 'he', mag.he < 60 ? 'high' : 'med', 'HELIUM LEVEL LOW');
      set(f.has('bulb'), 'bulb', 'high', 'PATIENT ALARM — BULB PRESSED');
      set(mag.quenched, 'quench', 'high', 'MAGNET QUENCH — NO FIELD');

      // ---- readouts ----
      S.num('he', mag.he.toFixed(1) + ' %');
      const hm = S.$('#mrHeM'); if (hm) { const w = Math.round(mag.he) + '%'; if (hm.style.width !== w) hm.style.width = w; }
      S.num('press', pShow.toFixed(2) + ' psi');
      S.num('ch', mag.quenched && mag.he < 1 ? 'No helium' : ch ? 'Running ~1 Hz' : 'STOPPED');
      S.num('b0', mag.field.toFixed(2) + ' T' + (mag.quenched ? (m.quenchT >= 0 ? ' ↓' : ' (quenched)') : m.rampT >= 0 ? ' ↑' : ''));
      const sar = m.ph === 'scan' && q ? q.sar : 0;
      S.num('sar', m.ph === 'scan' ? sar.toFixed(2) : '--');
      const sm = S.$('#mrSarM'); if (sm) { const w = Math.round(sar * 100) + '%'; if (sm.style.width !== w) sm.style.width = w; }
      S.num('trem', m.ph === 'scan' || m.ph === 'paused' || m.ph === 'prescan' ? fmtT(remaining(S)) : '--');
      const st = m.ph === 'idle' ? (m.imgSeq ? 'IDLE · images: ' + SEQ[m.imgSeq].name : 'IDLE') : m.ph === 'prescan' ? 'PRE-SCAN' : m.ph === 'paused' ? 'PAUSED' : 'SCANNING ' + q.name + (q.epi ? ' · b=' + m.bval : '');
      S.num('mrSt', st); S.num('mrMsg', m.msg);
      const on = S.$('#mrOn'), isOn = m.ph === 'scan'; if (on && on.classList.contains('on') !== isOn) on.classList.toggle('on', isOn);
      draw(S);
    },

    stop(S) {
      const m = S.mr; if (!m) return;
      if (m.vHiss) { m.vHiss.stop(); m.vRumble.stop(); m.vHiss = m.vRumble = null; }
      if (m.quenchT >= 0) { S.mrMag.field = 0; S.mrMag.he = Math.min(S.mrMag.he, 5); m.quenchT = -1; }
      if (m.rampT >= 0) { m.rampT = -1; S.mrMag.field = 0; }
      if (m.ph !== 'idle') m.ph = 'idle';
    }
  });

  function remaining(S) {
    const m = S.mr, q = m.scanSeq && SEQ[m.scanSeq]; if (!q) return 0;
    const ff = S.v.ff ? 4 : 1, total = q.epi ? (q.shots - 1) * q.period + 0.4 : Math.ceil(N / q.etl) * q.period;
    return m.ph === 'prescan' ? total / ff + 2 - m.seqT : (total - m.seqT * ff) / ff;
  }
  function done(S) {
    const m = S.mr; if (m.ph !== 'scan') return;
    m.ph = 'idle'; m.msg = 'Scan complete'; m.reconDue = true;
    S.log(`${SEQ[m.scanSeq].name} complete — scroll the slices with the mouse wheel`, 'ok');
    Sound.beep(784, 0.1, { vol: 0.08 }); Sound.beep(988, 0.12, { vol: 0.08, when: Sound.now + 0.12 });
  }

  function draw(S) {
    const m = S.mr, kc = S.$('#mrK'), ic = S.$('#mrImg'); if (!kc || !ic) return;
    const K = fit(kc), I = fit(ic);
    if (!m.dirty && !K.resized && !I.resized && m.ph !== 'scan') return;
    m.dirty = false;
    // k-space panel
    let g = K.g, w = K.w, h = K.h; g.fillStyle = '#02060d'; g.fillRect(0, 0, w, h);
    let s = Math.min(w - 16, h - 34), x0 = (w - s) / 2, y0 = 24;
    g.imageSmoothingEnabled = false; g.drawImage(m.kC, x0, y0, s, s);
    g.strokeStyle = '#1f3558'; g.strokeRect(x0 + .5, y0 + .5, s, s);
    const q = m.scanSeq ? SEQ[m.scanSeq] : null;
    if (m.ph === 'scan' && m.lines < N && m.lines > 0) {
      const r = q.epi ? m.lines - 1 : ORDER_C[m.lines - 1]; g.fillStyle = 'rgba(245,184,74,.85)'; g.fillRect(x0, y0 + s * r / N, s, Math.max(2, s / N));
    }
    g.fillStyle = '#8ea3c4'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'left';
    g.fillText(`k-space · ${q ? (q.epi ? 'EPI zig-zag (slowed)' : 'centric order') : '—'} · ${m.lines}/${N} lines`, 8, 15);
    g.fillStyle = '#5a6f92'; g.fillText('kx →', x0 + s - 32, y0 + s + 0 - 4);
    // image panel
    g = I.g; w = I.w; h = I.h; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    s = Math.min(w - 16, h - 30); x0 = (w - s) / 2; y0 = 22;
    if (m.imgSeq) { g.imageSmoothingEnabled = true; g.drawImage(m.iC, x0, y0, s, s); }
    else { g.fillStyle = '#5a6f92'; g.textAlign = 'center'; g.fillText('No images yet — choose a sequence and press Start', w / 2, h / 2); g.textAlign = 'left'; }
    g.fillStyle = '#8ea3c4'; g.fillText(`${m.imgSeq ? SEQ[m.imgSeq].name + (SEQ[m.imgSeq].epi ? ' b=' + m.bval : '') : ''}  ${PLANES[m.view.plane]} ${m.view.idx + 1}/${NS}`, 8, 15);
    // localiser inset
    const ls = 54, lx = w - ls - 8, ly = h - ls - 8, pos = -0.85 + m.view.idx / (NS - 1) * 1.7;
    g.fillStyle = 'rgba(2,6,13,.75)'; g.fillRect(lx, ly, ls, ls); g.strokeStyle = '#1f3558'; g.strokeRect(lx + .5, ly + .5, ls, ls);
    g.strokeStyle = '#8ea3c4'; g.beginPath();
    const cxl = lx + ls / 2, cyl = ly + ls / 2, rr = ls * 0.4;
    if (m.view.plane === 'sag') g.ellipse(cxl, cyl, rr * 0.85, rr, 0, 0, 7); else g.ellipse(cxl, cyl - 3, rr * 0.9, rr * 0.85, 0, 0, 7);
    g.stroke(); g.strokeStyle = '#f5b84a'; g.beginPath();
    if (m.view.plane === 'ax') { const yy = cyl - pos * rr; g.moveTo(lx + 4, yy); g.lineTo(lx + ls - 4, yy); }
    else { const xx = cxl + pos * rr; g.moveTo(xx, ly + 4); g.lineTo(xx, ly + ls - 4); }
    g.stroke();
  }
})();

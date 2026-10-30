/* Live simulator — Diagnostic ultrasound (B-mode, colour Doppler, PW spectral Doppler).
   Drag the probe across a QA-style tissue phantom (cyst, oblique vessel with pulsatile flow,
   wire targets, hyperechoic mass, calcification with shadow). The B-mode frame is formed per
   pixel from the probe geometry (linear / convex / phased), with tissue-locked animated speckle,
   frequency-dependent attenuation and noise floor, TGC, focus-dependent beam width,
   posterior enhancement and acoustic shadowing. PW mode scrolls a spectral display and plays
   Doppler audio from filtered noise whose centre frequency follows the aliased Doppler shift.
   Output and velocity figures are relative training estimates. */
(function () {
  const { Sound, W } = Sim;
  const PH = 16;                                   // phantom size, cm
  const CYST = [5, 4.5, 1.0], MASS = [3.5, 10, 1.2], STONE = [8.5, 11.5, 0.4];
  const V1 = [7.5, 1.8], V2 = [15.5, 7.0], VR = 0.35;
  const VL = Math.hypot(V2[0] - V1[0], V2[1] - V1[1]), VUX = (V2[0] - V1[0]) / VL, VUY = (V2[1] - V1[1]) / VL; // axis unit vector
  const FLOWX = -VUX, FLOWY = -VUY;                // blood flows from lower-right to upper-left (towards a vertical beam)
  const WIRES = [[11, 2], [11, 4], [11, 6], [11, 8], [11, 10], [11, 12], [11, 14], [2.5, 8.5], [3, 8.5], [3.7, 8.5], [4.6, 8.5]];
  const PROBES = {
    linear: { name: 'Linear', band: [6, 12], f: 7.5, depth: 5, ap: 4 },
    convex: { name: 'Convex', band: [2, 6], f: 3.5, depth: 14, R: 4.5, A: 30 * Math.PI / 180 },
    phased: { name: 'Phased', band: [1.5, 4.5], f: 2.5, depth: 14, A: 40 * Math.PI / 180 }
  };
  const MAXW = 240, MAXH = 170, MAXP = MAXW * MAXH, SW = 300, SH = 128, RR = 0.83, VPK = 95;
  const RAY = new Float32Array(1024); for (let i = 0; i < 1024; i++) RAY[i] = Math.sqrt(-2 * Math.log(1 - (i + 0.5) / 1024)) * 0.8;
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const hash = (i, j) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const velAt = t => { const ph = (t % RR) / RR; return VPK * (W.gauss(ph, 0.12, 0.045) - 0.22 * W.gauss(ph, 0.3, 0.035) + 0.16 * W.gauss(ph, 0.45, 0.07) + 0.04); };
  const vesselDist = (x, y) => { const u = clamp((x - V1[0]) * VUX + (y - V1[1]) * VUY, 0, VL), ex = x - V1[0] - u * VUX, ey = y - V1[1] - u * VUY; return Math.sqrt(ex * ex + ey * ey); };

  const fit = c => {
    const d = window.devicePixelRatio || 1, w = Math.max(40, c.clientWidth || 300), h = Math.max(40, c.clientHeight || 200);
    const Wd = Math.round(w * d), Hd = Math.round(h * d), resized = c.width !== Wd || c.height !== Hd;
    if (resized) { c.width = Wd; c.height = Hd; }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return { g, w, h, resized };
  };
  function setCtl(S, id, val) {
    S.v[id] = val; const def = S.def.controls.find(x => x.id === id);
    const i = S.el.querySelector(`[data-ctl="${id}"]`); if (i) { if (i.type === 'checkbox') i.checked = !!val; else i.value = val; }
    const o = S.el.querySelector(`[data-out="${id}"]`); if (o) o.textContent = val + (def && def.unit ? ' ' + def.unit : '');
  }

  /* ---------- scan geometry (rebuilt only when probe or depth changes) ---------- */
  function buildGeo(S) {
    const U = S.us, G = U.geo, P = PROBES[S.v.probe] || PROBES.linear, D = +S.v.depth;
    let xmin, xmax, ymin, ymax = D;
    if (S.v.probe === 'convex') { const s = Math.sin(P.A); xmin = -(P.R + D) * s; xmax = -xmin; ymin = P.R * Math.cos(P.A) - P.R; }
    else if (S.v.probe === 'phased') { xmax = D * Math.sin(P.A); xmin = -xmax; ymin = 0; }
    else { xmin = -P.ap / 2; xmax = P.ap / 2; ymin = 0; }
    const Hh = MAXH, Wd = clamp(Math.round(Hh * (xmax - xmin) / (ymax - ymin)), 60, MAXW);
    G.W = Wd; G.H = Hh; G.xmin = xmin; G.xmax = xmax; G.ymin = ymin; G.ymax = ymax; G.D = D;
    for (let j = 0; j < Hh; j++) for (let i = 0; i < Wd; i++) {
      const p = j * Wd + i, X = xmin + (i + 0.5) / Wd * (xmax - xmin), Y = ymin + (j + 0.5) / Hh * (ymax - ymin);
      let inside = 0, ox = 0, oy = 0, dx = 0, dy = 1, r = 0, beam = 0;
      if (S.v.probe === 'convex') {
        const rho = Math.hypot(X, Y + P.R), th = Math.atan2(X, Y + P.R);
        if (Math.abs(th) <= P.A && rho >= P.R && rho <= P.R + D) { inside = 1; dx = Math.sin(th); dy = Math.cos(th); ox = P.R * dx; oy = P.R * dy - P.R; r = rho - P.R; beam = Math.floor((th + P.A) / (2 * P.A) * 127.99); }
      } else if (S.v.probe === 'phased') {
        const rho = Math.hypot(X, Y), th = Math.atan2(X, Y);
        if (Math.abs(th) <= P.A && rho <= D) { inside = 1; dx = Math.sin(th); dy = Math.cos(th); r = rho; beam = Math.floor((th + P.A) / (2 * P.A) * 127.99); }
      } else if (Y >= 0 && Y <= D) { inside = 1; ox = X; r = Y; beam = Math.floor((X - xmin) / (xmax - xmin) * 127.99); }
      G.inn[p] = inside; G.ox[p] = ox; G.oy[p] = oy; G.dx[p] = dx; G.dy[p] = dy; G.r[p] = r; G.beam[p] = beam;
    }
    U.off.width = Wd; U.off.height = Hh; U.octx = U.off.getContext('2d'); U.img = U.octx.createImageData(Wd, Hh);
    U.phDirty = true;
  }

  /* ---------- B-mode / colour frame ---------- */
  function render(S, t) {
    const U = S.us, G = U.geo, f = S.fault, v = S.v, d = U.img.data, n = G.W * G.H;
    const fr = U.freq, D = G.D, ct = Math.cos(U.tilt), st = Math.sin(U.tilt), px = U.px, foc = +v.focus;
    const ac = 0.4 / fr, aw = 0.25 / fr, w0 = 1.0 / fr, breath = 0.025 * Math.sin(t * 1.4), DR = +v.dr, attK = 2 * 0.5 * fr;
    const color = v.mode === 'color', scale = U.scale, vnow = U.vNow;
    const lut = U.gainLut, att = U.attLut, nf = 8e-4, cable = f.has('cable'), lens = f.has('lens'), elem = f.has('elem');
    // per-frame depth LUTs: TGC, auto depth compensation, focal gain, TGC fault, lens loss
    for (let k = 0; k < 256; k++) {
      const r = k / 255 * D, z = r / D * 7, z0 = Math.min(6, Math.floor(z)), fz = z - z0;
      let g = (v.gain - 50) * 0.6 + U.tgc[z0] * (1 - fz) + U.tgc[z0 + 1] * fz + 0.9 * attK * r + 3 * Math.exp(-(r - foc) * (r - foc) / 0.8);
      if (f.has('tgc') && r / D > 0.48 && r / D < 0.62) g -= 28;
      lut[k] = g; att[k] = Math.exp(-attK * r * 0.115129);
    }
    const rows = U.noiseRows; if (cable) for (let i = 0; i < rows.length; i++) rows[i] = Math.random() < 0.6 ? (Math.random() * G.H) | 0 : -1;
    const bx0 = U.box[0], bx1 = U.box[1], by0 = U.box[2], by1 = U.box[3];
    for (let p = 0; p < n; p++) {
      const i4 = p * 4;
      if (!G.inn[p]) { d[i4] = d[i4 + 1] = d[i4 + 2] = 0; d[i4 + 3] = 255; continue; }
      const r = G.r[p], dx = G.dx[p], dy = G.dy[p], lx = G.ox[p] + r * dx, ly = G.oy[p] + r * dy;
      const wx = px + lx * ct + ly * st, wy = -lx * st + ly * ct;
      if (wx < 0 || wx > PH || wy < 0 || wy > PH) { d[i4] = d[i4 + 1] = d[i4 + 2] = 0; d[i4 + 3] = 255; continue; }
      const ddx = dx * ct + dy * st, ddy = -dx * st + dy * ct;
      const owx = px + G.ox[p] * ct + G.oy[p] * st, owy = -G.ox[p] * st + G.oy[p] * ct;
      const lw = w0 * (0.45 + 0.22 * Math.abs(r - foc));
      // reflectivity
      let refl = 1, lumen = -1;
      let a = wx - CYST[0], b = wy - CYST[1];
      if (a * a + b * b < CYST[2] * CYST[2]) refl = 0.015;
      else { a = wx - MASS[0]; b = wy - MASS[1]; if (a * a + b * b < MASS[2] * MASS[2]) refl = 2.2; }
      const dv = vesselDist(wx, wy);
      if (dv < VR) { refl = 0.02; lumen = dv; } else if (dv < VR + 0.07) refl = 3.5;
      a = wx - STONE[0]; b = wy - STONE[1]; if (a * a + b * b < STONE[2] * STONE[2]) refl = 30;
      if (wy < 0.08) refl = 4;
      // tissue-locked speckle (value noise in beam-aligned cells)
      const ua = (wx * ddx + wy * ddy + breath) / ac, ul = (wx * ddy - wy * ddx) / lw;
      const ia = Math.floor(ua), il = Math.floor(ul), fa = ua - ia, fl = ul - il;
      const h0 = hash(ia, il) * (1 - fa) + hash(ia + 1, il) * fa, h1 = hash(ia, il + 1) * (1 - fa) + hash(ia + 1, il + 1) * fa;
      let lin = refl * RAY[((h0 * (1 - fl) + h1 * fl) * 1023) | 0] * (0.85 + 0.3 * Math.random());
      // point targets with depth-dependent beam width
      for (let k = 0; k < WIRES.length; k++) {
        const ex = WIRES[k][0] - wx, ey = WIRES[k][1] - wy; if (ex > 0.6 || ex < -0.6 || ey > 0.6 || ey < -0.6) continue;
        const ax = ex * ddx + ey * ddy, la = ex * ddy - ey * ddx; lin += 30 * Math.exp(-2 * (la * la / (lw * lw) + ax * ax / (aw * aw)));
      }
      // posterior enhancement / shadowing along this beam
      let tx = CYST[0] - owx, ty = CYST[1] - owy, tc = tx * ddx + ty * ddy, q2;
      if (tc > 0 && (q2 = tx * tx + ty * ty - tc * tc) < CYST[2] * CYST[2] && r > tc + Math.sqrt(CYST[2] * CYST[2] - q2)) lin *= 1.8;
      tx = MASS[0] - owx; ty = MASS[1] - owy; tc = tx * ddx + ty * ddy;
      if (tc > 0 && (q2 = tx * tx + ty * ty - tc * tc) < MASS[2] * MASS[2] && r > tc + Math.sqrt(MASS[2] * MASS[2] - q2)) lin *= 0.7;
      tx = STONE[0] - owx; ty = STONE[1] - owy; tc = tx * ddx + ty * ddy;
      if (tc > 0 && (q2 = tx * tx + ty * ty - tc * tc) < STONE[2] * STONE[2] && r > tc + Math.sqrt(STONE[2] * STONE[2] - q2)) lin *= 0.06;
      // transducer faults
      const bm = G.beam[p];
      if (elem) { if (bm === 40 || bm === 41) lin *= 0.02; else if (bm >= 88 && bm <= 90) lin *= 0.3; }
      if (lens && r < 1.2) { const patch = 0.15 + 0.5 * hash(bm >> 3, 7); lin = lin * patch + 2.2 * Math.exp(-((r % 0.24) - 0.03) * ((r % 0.24) - 0.03) / 0.0006) * (1.2 - r); }
      const kd = Math.min(255, (r / D * 255) | 0);
      let rx = lin * att[kd] + nf * Math.random();
      if (cable) { const row = (p / G.W) | 0; for (let q = 0; q < rows.length; q++) if (rows[q] === row || rows[q] + 1 === row) rx += 0.05 * Math.random(); if (Math.random() < 0.004) rx += 0.03; }
      const db = 8.6859 * Math.log(rx) + lut[kd];
      let g = clamp((db + 0.55 * DR) / DR, 0, 1) * 255;
      // colour Doppler
      if (color && lumen >= 0 && lx >= bx0 && lx <= bx1 && ly >= by0 && ly <= by1 && Math.random() < 0.9) {
        const vel = vnow * (1 - lumen * lumen / (VR * VR)), vt = -vel * (FLOWX * ddx + FLOWY * ddy);
        let vw = ((vt + scale) % (2 * scale) + 2 * scale) % (2 * scale) - scale; // aliasing wrap
        const am = Math.abs(vw) / scale;
        if (Math.abs(vt) > 3 && elem && (bm === 40 || bm === 41)) vw = 0;
        if (Math.abs(vw) > 0.06 * scale) {
          const hi = clamp((am - 0.55) * 2.2, 0, 1) * 230;
          if (vw > 0) { d[i4] = 110 + 145 * am; d[i4 + 1] = hi; d[i4 + 2] = 0; } else { d[i4] = 0; d[i4 + 1] = hi; d[i4 + 2] = 110 + 145 * am; }
          d[i4 + 3] = 255; continue;
        }
      }
      d[i4] = g; d[i4 + 1] = g; d[i4 + 2] = Math.min(255, g * 1.04 + 2); d[i4 + 3] = 255;
    }
    U.octx.putImageData(U.img, 0, 0);
  }

  /* ---------- PW spectral column + Doppler audio ---------- */
  function gateInfo(S) {
    const U = S.us, ct = Math.cos(U.tilt), st = Math.sin(U.tilt), P = PROBES[S.v.probe] || PROBES.linear;
    // beam through the gate: from the element/apex towards the gate in local coordinates
    let ox = U.gate[0], oy = 0;
    if (S.v.probe === 'convex') { const th = Math.atan2(U.gate[0], U.gate[1] + P.R); ox = P.R * Math.sin(th); oy = P.R * Math.cos(th) - P.R; }
    else if (S.v.probe === 'phased') { ox = 0; oy = 0; }
    let dx = U.gate[0] - ox, dy = U.gate[1] - oy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    const ddx = dx * ct + dy * st, ddy = -dx * st + dy * ct;
    const wx = U.px + U.gate[0] * ct + U.gate[1] * st, wy = -U.gate[0] * st + U.gate[1] * ct;
    const dv = vesselDist(wx, wy), cosT = -(FLOWX * ddx + FLOWY * ddy);
    return { inV: dv < VR, dv, cosT };
  }
  function spectralColumn(S, col, vTrue, inV, bw) {
    const U = S.us, d = U.spec.data, scale = U.scale, f = S.fault;
    const lo = vTrue >= 0 ? vTrue * (1 - bw) : vTrue * 1.06, hi = vTrue >= 0 ? vTrue * 1.06 : vTrue * (1 - bw);
    for (let y = 0; y < SH; y++) {
      const vb = (SH / 2 - y - 0.5) / (SH / 2) * scale;
      let s = 0.04 * Math.random();
      if (inV) for (let k = -2; k <= 2; k++) { const va = vb + 2 * k * scale; if (va >= lo && va <= hi) { const pos = (va - lo) / (hi - lo + 1e-6); s = Math.max(s, (0.45 + 0.55 * (vTrue >= 0 ? pos : 1 - pos)) * (0.55 + 0.45 * Math.random())); } }
      if (Math.abs(vb) < scale * 0.03 && inV) s = Math.max(s, 0.3 * Math.random());       // wall-filter residue around baseline
      if (f.has('cable') && (y === 21 || y === 22 || y === 97 || Math.random() < 0.01)) s = Math.max(s, 0.5 + 0.4 * Math.random());
      const g = Math.round(255 * Math.min(1, s)), i = (y * SW + col) * 4; d[i] = g; d[i + 1] = g; d[i + 2] = Math.min(255, g + 10); d[i + 3] = 255;
    }
    for (let k = 1; k <= 4; k++) { const c2 = (col + k) % SW; for (let y = 0; y < SH; y++) { const i = (y * SW + c2) * 4; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = 255; } }
  }

  Sim.register('ultrasound', {
    title: 'Ultrasound scanner — live B-mode & Doppler',
    intro: 'Drag the probe across the phantom (wheel or two-finger scroll to tilt). Adjust frequency, depth, gain, TGC, dynamic range and focus. Switch to colour or PW Doppler, click the image to place the box or gate, and listen to the Doppler signal. Then inject probe and system faults.',
    stage: () => `<style>
      .usx-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #13223d;font:700 .8rem var(--mono)}
      .usx-mode{padding:3px 10px;border-radius:6px;background:#1d3f73;color:#9fd0ff}.usx-fz{padding:3px 10px;border-radius:6px;background:#13223d;color:#5a6f92}.usx-fz.on{background:#4dd0ff;color:#02060d}
      .usx-msg{color:#f5b84a;font-weight:600}
      .usx-grid{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(220px,1fr)}
      .usx-main{border-right:1px solid #13223d}
      .usx-main canvas{display:block;width:100%}
      #usImg{height:360px;cursor:crosshair}#usPw{height:170px;border-top:1px solid #13223d;display:none}.usx-pw #usPw{display:block}
      #usPh{display:block;width:100%;height:250px;touch-action:none;cursor:grab}#usPh.drag{cursor:grabbing}
      .usx-tgc{padding:8px 12px;border-top:1px solid #13223d}
      .usx-tgc h4{margin:0 0 4px;font:700 .7rem var(--mono);letter-spacing:.1em;color:#8ea3c4;display:flex;justify-content:space-between}
      .usx-tgc input{display:block;width:100%;margin:2px 0;height:14px}
      .usx-ro{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}.usx-ro b{font-size:1.05rem}.usx-ro small i{font-style:normal;text-transform:none;letter-spacing:0;opacity:.75}
      @media(max-width:820px){.usx-grid{grid-template-columns:1fr}.usx-main{border-right:0}#usImg{height:300px}}
    </style>
    <div class="usx-bar"><span class="usx-mode" data-num="usMode">B</span><span class="usx-fz" id="usFz">❄ FROZEN</span><span data-num="usProbe" style="color:#9fd0ff"></span><span class="usx-msg" data-num="usMsg"></span></div>
    <div class="usx-grid">
      <div class="usx-main" id="usMain"><canvas id="usImg" title="Click to place the colour box / PW gate"></canvas><canvas id="usPw"></canvas></div>
      <div><canvas id="usPh" title="Drag to move the probe · wheel to tilt"></canvas>
        <div class="usx-tgc"><h4><span>TGC</span><span>near ↓ far</span></h4>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<input type="range" min="-20" max="20" step="1" value="0" data-tgc="${i}" aria-label="TGC band ${i + 1}">`).join('')}</div></div>
    </div>
    <div class="sim-readout usx-ro">
      <div style="--c:#36d39a"><small>Frame rate</small><b data-num="fps">--</b></div>
      <div style="--c:#e6eefb"><small>Freq / depth</small><b data-num="fd">--</b></div>
      <div style="--c:#4dd0ff"><small>PRF / scale</small><b data-num="prf">--</b></div>
      <div style="--c:#f5b84a"><small>Doppler angle</small><b data-num="ang">--</b></div>
      <div style="--c:#ff8fa3"><small>PSV <i>(angle-corr., training est.)</i></small><b data-num="psv">--</b></div>
      <div style="--c:#c3a6ff"><small>Probe / system temp</small><b data-num="temp">--</b></div>
    </div>`,
    controls: [
      { id: 'probe', label: 'Probe', type: 'select', options: [['linear', 'Linear array (6–12 MHz)'], ['convex', 'Convex / curvilinear (2–6 MHz)'], ['phased', 'Phased array (1.5–4.5 MHz)']], value: 'linear' },
      { id: 'mode', label: 'Mode', type: 'select', options: [['b', 'B-mode'], ['color', 'Colour Doppler'], ['pw', 'PW spectral Doppler']], value: 'b' },
      { id: 'freq', label: 'Frequency', type: 'range', min: 1.5, max: 12, step: 0.5, value: 7.5, unit: 'MHz' },
      { id: 'depth', label: 'Depth', type: 'range', min: 2, max: 16, step: 0.5, value: 5, unit: 'cm' },
      { id: 'gain', label: 'Overall gain', type: 'range', min: 0, max: 100, step: 1, value: 50 },
      { id: 'dr', label: 'Dynamic range', type: 'range', min: 30, max: 90, step: 3, value: 60, unit: 'dB' },
      { id: 'focus', label: 'Focus depth', type: 'range', min: 0.5, max: 14, step: 0.5, value: 2.5, unit: 'cm' },
      { id: 'scale', label: 'Velocity scale (PRF)', type: 'range', min: 10, max: 150, step: 5, value: 60, unit: 'cm/s' }
    ],
    actions: [{ id: 'freeze', label: '❄ Freeze / unfreeze', primary: true }, { id: 'tgc', label: 'Reset TGC' }, { id: 'gate', label: '⌖ Gate to vessel' }],
    faults: [
      { id: 'elem', label: 'Dead / weak transducer elements', explain: 'Some piezo elements (or their channels) have failed. Each dead element leaves a dark vertical line in a linear image, or a dark radial line in a sector image, running from the skin to the bottom of the image. Weak elements give fainter bands.', check: 'Image a uniform phantom, or run the probe element test if the system has one. Check whether the dropout follows the probe (try it on another port or system). Inspect the cable for kinks. Dead elements need probe repair or replacement.' },
      { id: 'cable', label: 'Cable / connector noise', explain: 'Interference gets in through a damaged cable shield or a dirty or worn connector. You see flickering horizontal noise lines and speckle-like interference, plus noise lines and crackle in the Doppler spectrum and audio.', check: 'Reseat the probe connector and inspect the pins. Flex the cable along its length while imaging. Check nearby interference sources and the equipotential earth, then try the probe on another port.' },
      { id: 'tgc', label: 'TGC board fault', explain: 'One depth band of the time-gain compensation stays at minimum gain whatever the slider says, so a horizontal dark band sits at a fixed depth across the whole image.', check: 'Move each TGC slider and watch for a band that does not respond. Run the front-panel / control diagnostics, check the slide-pot module and its connector, and confirm the band does not change with the probe.' },
      { id: 'lens', label: 'Lens / delamination damage', explain: 'The acoustic lens or matching layer has delaminated, which shows as near-field damage: patchy loss of echoes, horizontal reverberation bands in the top centimetre, and uneven near-field brightness across the array.', check: 'Inspect the lens for bubbles, cracks, swelling or peeling, and check for gel or cleaner damage. Image a phantom near field. A damaged lens is also an electrical-safety risk, so remove the probe from use and do a leakage test.' },
      { id: 'alias', label: 'Doppler aliasing (PRF stuck low)', explain: 'The velocity scale (PRF) is too low for the flow. The PW spectrum wraps around, with peaks cut off and appearing below the baseline, the colour box shows a red/blue mosaic, and the Doppler audio pitch folds. Here the scale is stuck at 15 cm/s. In practice this is usually an operator setting.', check: 'Raise the velocity scale or PRF, move the baseline, reduce the depth or use a lower Doppler frequency. If the scale control does not respond, run the control diagnostics.' },
      { id: 'fan', label: 'Cooling fan failure / overheating', explain: 'The system fan has stopped (listen: the fan hiss is gone). Internal temperature rises, the system lowers the frame rate and acoustic output to protect itself, then freezes imaging with an over-temperature warning.', check: 'Check the fan runs and the filters and vents are clear, and keep the system away from walls or curtains. Check the fan supply and tacho. Let the system cool. Do not keep scanning on a system that keeps overheating.' }
    ],

    init(S) {
      if (!S.usKeep) S.usKeep = { px: 9.5, tilt: 0, tgc: new Float32Array(8), gate: [0, 3.1] };
      const K = S.usKeep;
      const U = S.us = {
        px: K.px, tilt: K.tilt, tgc: K.tgc, gate: K.gate, box: [-1.4, 1.4, 0.8, 4.5], freq: +S.v.freq, scale: +S.v.scale, vNow: 0,
        frozen: false, thermal: false, temp: 38, renderAcc: 1, fpsShown: 0, colAcc: 0, col: 0, peakBeam: 0, peakHold: 0, cycleT: 0, msg: '',
        geo: { W: 0, H: 0, inn: new Uint8Array(MAXP), ox: new Float32Array(MAXP), oy: new Float32Array(MAXP), dx: new Float32Array(MAXP), dy: new Float32Array(MAXP), r: new Float32Array(MAXP), beam: new Uint8Array(MAXP) },
        gainLut: new Float32Array(256), attLut: new Float32Array(256), noiseRows: new Int16Array(3),
        off: document.createElement('canvas'), specC: document.createElement('canvas'), phDirty: true, view: null, drag: false
      };
      U.specC.width = SW; U.specC.height = SH; U.sctx = U.specC.getContext('2d'); U.spec = U.sctx.createImageData(SW, SH);
      for (let i = 3; i < U.spec.data.length; i += 4) U.spec.data[i] = 255;
      clampFreq(S, false); buildGeo(S);
      U.vD1 = Sound.voice({ noise: true, filter: 'bandpass', freq: 800, q: 3 });
      U.vD2 = Sound.voice({ noise: true, filter: 'bandpass', freq: 500, q: 1.2 });
      U.vFan = Sound.voice({ noise: true, filter: 'lowpass', freq: 900 });
      // TGC sliders
      S.el.querySelectorAll('[data-tgc]').forEach(inp => { inp.value = U.tgc[+inp.dataset.tgc]; inp.oninput = () => { U.tgc[+inp.dataset.tgc] = +inp.value; }; });
      // probe dragging on the phantom panel
      const ph = S.$('#usPh');
      if (ph) {
        const move = e => { const r = ph.getBoundingClientRect(), s = Math.min(r.width - 16, r.height - 34), x0 = (r.width - s) / 2; U.px = clamp((e.clientX - r.left - x0) / s * PH, 0.6, PH - 0.6); K.px = U.px; U.phDirty = true; };
        ph.onpointerdown = e => { if (!S.on) return; U.drag = true; ph.classList.add('drag'); try { ph.setPointerCapture(e.pointerId); } catch (x) { } move(e); };
        ph.onpointermove = e => { if (U.drag) move(e); };
        ph.onpointerup = ph.onpointercancel = () => { U.drag = false; ph.classList.remove('drag'); };
        ph.onwheel = e => { if (!S.on) return; e.preventDefault(); U.tilt = clamp(U.tilt + (e.deltaY > 0 ? 1 : -1) * 0.035, -0.45, 0.45); K.tilt = U.tilt; U.phDirty = true; };
      }
      const im = S.$('#usImg');
      if (im) im.onclick = e => {
        if (!S.on || !U.view) return; const r = im.getBoundingClientRect(), vw = U.view, G = U.geo;
        const i = Math.floor((e.clientX - r.left - vw.x0) / vw.s), j = Math.floor((e.clientY - r.top - vw.y0) / vw.s);
        if (i < 0 || j < 0 || i >= G.W || j >= G.H || !G.inn[j * G.W + i]) return;
        const p = j * G.W + i, lx = G.ox[p] + G.r[p] * G.dx[p], ly = G.oy[p] + G.r[p] * G.dy[p];
        if (S.v.mode === 'color') { U.box = [lx - 1.4, lx + 1.4, Math.max(0.3, ly - 1.8), ly + 1.8]; S.log('Colour box moved'); }
        else { U.gate[0] = lx; U.gate[1] = ly; S.v.mode === 'pw' ? S.log(`PW gate placed at ${ly.toFixed(1)} cm depth`) : S.log('Gate position set (switch to PW mode to use it)'); }
      };
      syncMode(S);
      S.log('Probe connected and recognised. Drag the probe over the phantom to find the cyst, vessel and wire targets.', 'info');
    },

    onControl(S, id, val) {
      const U = S.us; if (!U) return;
      if (id === 'probe') { const P = PROBES[val]; setCtl(S, 'freq', P.f); setCtl(S, 'depth', P.depth); U.freq = P.f; setCtl(S, 'focus', val === 'linear' ? 2.5 : 6); buildGeo(S); S.log(`${P.name} probe selected — ${P.f} MHz, ${P.depth} cm`); }
      if (id === 'freq') clampFreq(S, true);
      if (id === 'depth') buildGeo(S);
      if (id === 'mode') syncMode(S);
    },
    onFault(S, id, on) {
      const U = S.us; if (!U) return;
      if (id === 'fan' && !on) S.log('Fan restored — system cooling', 'ok');
      if (id === 'alias') S.log(on ? 'Velocity scale control not responding' : 'Velocity scale control responding', on ? 'warn' : 'ok');
    },
    onAction(S, id) {
      const U = S.us;
      if (id === 'freeze') { if (U.thermal) return S.log('Cannot unfreeze: system over-temperature', 'bad'); U.frozen = !U.frozen; S.log(U.frozen ? 'Image frozen' : 'Live imaging'); }
      if (id === 'tgc') { U.tgc.fill(0); S.el.querySelectorAll('[data-tgc]').forEach(i => i.value = 0); S.log('TGC reset to the default curve'); }
      if (id === 'gate') {
        // nearest point on the vessel axis to the image centre line, if the vessel is in view
        const ct = Math.cos(U.tilt), st = Math.sin(U.tilt);
        let best = null;
        for (let y = 0.5; y < U.geo.D; y += 0.05) { const wx = U.px + y * st, wy = y * ct, dv = vesselDist(wx, wy); if (!best || dv < best[1]) best = [y, dv]; }
        if (best && best[1] < VR) { U.gate[0] = 0; U.gate[1] = best[0]; S.log(`Gate placed on the vessel at ${best[0].toFixed(1)} cm`); }
        else S.log('Vessel not under the centre line — slide the probe right until the vessel crosses the middle of the image', 'warn');
      }
    },

    tick(S, dt, t) {
      const U = S.us, f = S.fault, v = S.v;
      U.scale = f.has('alias') ? 15 : +v.scale;
      U.vNow = velAt(t);
      // ---- thermal ----
      U.temp += f.has('fan') ? dt * 0.35 * (62 - U.temp) / 24 : (38 - U.temp) * dt * 0.08;
      const hot = U.temp > 46;
      if (U.temp > 52 && !U.thermal) { U.thermal = true; U.frozen = true; S.log('System over-temperature — imaging frozen to protect the electronics and the probe', 'bad'); }
      if (U.thermal && U.temp < 44) { U.thermal = false; U.frozen = false; S.log('Temperature normal — live imaging restored', 'ok'); }
      // ---- frame timing (depth-limited, mode-limited, thermal throttling) ----
      const D = U.geo.D, lines = v.mode === 'color' ? 260 : 128, physFps = 154000 / (2 * D * lines), target = Math.min(v.mode === 'b' ? 30 : 18, physFps) / (hot ? 3 : 1);
      if (!U.frozen) {
        U.renderAcc += dt;
        if (U.renderAcc >= 1 / target) { U.renderAcc = 0; render(S, t); U.fpsShown = target; U.imgDirty = true; }
      }
      // ---- PW Doppler ----
      const pw = v.mode === 'pw' && !U.frozen;
      const gi = gateInfo(S), vel = gi.inV ? U.vNow * (1 - gi.dv * gi.dv / (VR * VR)) : 0, vBeam = vel * gi.cosT;
      const f0 = U.freq * 0.75e6, scale = U.scale, vAl = ((vBeam + scale) % (2 * scale) + 2 * scale) % (2 * scale) - scale;
      if (pw) {
        U.colAcc += dt * 100;
        const bw = 0.18 + 0.5 * (1 - Math.min(1, Math.abs(vBeam) / (VPK * 0.6)));
        while (U.colAcc >= 1) { U.colAcc -= 1; spectralColumn(S, U.col, vBeam, gi.inV, bw); U.col = (U.col + 1) % SW; }
        U.sctx.putImageData(U.spec, 0, 0); U.pwDirty = true;
        // Doppler audio: band of noise centred on the (aliased) Doppler shift
        const fd = Math.abs(2 * f0 * (vAl / 100) / 1540), amp = gi.inV ? Math.min(1, Math.abs(vAl) / 25 + 0.08) : 0;
        U.vD1.set({ vol: 0.24 * amp, freq: clamp(fd, 60, 9000), glide: 0.012 });
        U.vD2.set({ vol: 0.12 * amp, freq: clamp(fd * 0.55, 50, 6000), glide: 0.012 });
        U.vD1.filter.Q.value = Math.abs(vBeam) > 30 ? 3.5 : 1.6;
        if (f.has('cable') && Math.random() < dt * 6) Sound.burst(0.02, { filter: 'highpass', freq: 2500, vol: 0.12 });
      } else { U.vD1.set({ vol: 0 }); U.vD2.set({ vol: 0 }); }
      U.vFan.set({ vol: f.has('fan') ? 0 : 0.022 });
      // peak tracking for PSV
      U.cycleT += dt; U.peakBeam = Math.max(U.peakBeam, Math.abs(vBeam));
      if (U.cycleT > RR) { U.peakHold = U.peakBeam; U.peakBeam = 0; U.cycleT = 0; }

      // ---- alarms ----
      const set = (cond, id, pr, text) => cond ? S.alarm(id, pr, text) : S.clear(id);
      set(hot && !U.thermal, 'hot', 'med', 'SYSTEM TEMPERATURE HIGH — FRAME RATE REDUCED');
      set(U.thermal, 'thermal', 'high', 'OVER-TEMPERATURE — IMAGING FROZEN');

      // ---- readouts ----
      const P = PROBES[v.probe] || PROBES.linear;
      S.num('usMode', { b: 'B-MODE', color: 'COLOUR', pw: 'PW DOPPLER' }[v.mode]);
      S.num('usProbe', `${P.name} · ${U.freq} MHz · ${D} cm${U.tilt ? ' · tilt ' + Math.round(U.tilt * 57.3) + '°' : ''}`);
      U.msg = U.thermal ? 'Over-temperature: frozen' : hot ? 'Thermal throttling' : pw && !gi.inV ? 'Gate not in a vessel' : pw && Math.abs(vBeam) > scale ? 'Aliasing: raise the scale' : '';
      S.num('usMsg', U.msg);
      const fz = S.$('#usFz'); if (fz && fz.classList.contains('on') !== U.frozen) fz.classList.toggle('on', U.frozen);
      S.num('fps', U.frozen ? '0' : Math.round(U.fpsShown) + ' Hz');
      S.num('fd', `${U.freq} MHz / ${D} cm`);
      S.num('prf', v.mode === 'b' ? '--' : `${(4 * f0 * scale / 100 / 1540 / 1000).toFixed(1)} kHz / ${scale}`);
      const ang = Math.round(Math.acos(clamp(Math.abs(gi.cosT), 0, 1)) * 57.3);
      S.num('ang', v.mode === 'pw' ? ang + '°' + (ang > 60 ? ' (>60°)' : '') : '--');
      S.num('psv', v.mode === 'pw' && gi.inV && Math.abs(gi.cosT) > 0.17 ? Math.round(U.peakHold / Math.abs(gi.cosT)) + ' cm/s' : '--');
      S.num('temp', U.temp.toFixed(1) + ' °C');
      draw(S);
    },
    stop(S) {
      const U = S.us; if (!U) return;
      ['vD1', 'vD2', 'vFan'].forEach(k => { if (U[k]) { U[k].stop(); U[k] = null; } });
      U.drag = false;
    }
  });

  function clampFreq(S, log) {
    const U = S.us, P = PROBES[S.v.probe] || PROBES.linear, fq = +S.v.freq, c = clamp(fq, P.band[0], P.band[1]);
    U.freq = c; if (c !== fq) { setCtl(S, 'freq', c); if (log) S.log(`${fq} MHz is outside the ${P.name.toLowerCase()} probe band — set to ${c} MHz`, 'warn'); }
  }
  function syncMode(S) { const m = S.$('#usMain'); if (m) m.classList.toggle('usx-pw', S.v.mode === 'pw'); S.us.pwDirty = true; S.us.imgDirty = true; }

  function draw(S) {
    const U = S.us, G = U.geo, ic = S.$('#usImg');
    if (ic) {
      const { g, w, h, resized } = fit(ic);
      if (U.imgDirty || resized) {
        U.imgDirty = false;
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        const s = Math.min((w - 40) / G.W, (h - 26) / G.H), dw = G.W * s, dh = G.H * s, x0 = (w - dw) / 2, y0 = 20;
        U.view = { x0, y0, s };
        g.imageSmoothingEnabled = true; g.drawImage(U.off, x0, y0, dw, dh);
        const Y = cm => y0 + (cm - G.ymin) / (G.ymax - G.ymin) * dh, X = cm => x0 + (cm - G.xmin) / (G.xmax - G.xmin) * dw;
        // depth scale + focus marker
        g.fillStyle = '#8ea3c4'; g.font = '600 10px Inter, sans-serif'; g.textAlign = 'left';
        for (let c = 0; c <= G.D + 0.01; c += G.D > 8 ? 2 : 1) { const y = Y(c); g.fillRect(x0 + dw + 4, y, 5, 1); g.fillText(String(c), x0 + dw + 11, y + 3); }
        g.fillStyle = '#f5b84a'; const fy = Y(Math.min(+S.v.focus, G.D)); g.beginPath(); g.moveTo(x0 + dw + 2, fy); g.lineTo(x0 + dw + 9, fy - 4); g.lineTo(x0 + dw + 9, fy + 4); g.fill();
        if (S.v.mode === 'color') { g.strokeStyle = '#e6eefb'; g.lineWidth = 1; g.strokeRect(X(U.box[0]), Y(U.box[2]), X(U.box[1]) - X(U.box[0]), Y(U.box[3]) - Y(U.box[2])); }
        if (S.v.mode === 'pw') {
          const P = PROBES[S.v.probe] || PROBES.linear; let ox = U.gate[0], oy = 0;
          if (S.v.probe === 'convex') { const th = Math.atan2(U.gate[0], U.gate[1] + P.R); ox = P.R * Math.sin(th); oy = P.R * Math.cos(th) - P.R; } else if (S.v.probe === 'phased') ox = 0;
          g.strokeStyle = 'rgba(77,208,255,.6)'; g.setLineDash([3, 4]); g.beginPath(); g.moveTo(X(ox), Y(oy)); g.lineTo(X(U.gate[0]), Y(U.gate[1])); g.stroke(); g.setLineDash([]);
          const gx = X(U.gate[0]), gy = Y(U.gate[1]); g.strokeStyle = '#4dd0ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx - 7, gy - 4); g.lineTo(gx + 7, gy - 4); g.moveTo(gx - 7, gy + 4); g.lineTo(gx + 7, gy + 4); g.stroke(); g.lineWidth = 1;
        }
        g.fillStyle = '#8ea3c4'; g.fillText(`${PROBES[S.v.probe].name} ${U.freq} MHz · G${S.v.gain} · DR${S.v.dr}`, 8, 13);
        if (U.frozen) { g.fillStyle = '#4dd0ff'; g.fillText('❄ FROZEN', w - 70, 13); }
        if (S.v.mode === 'color') { // colour bar
          const bx = 8, by = 26, bh = 70; for (let k = 0; k < bh; k++) { const a = 1 - Math.abs(k - bh / 2) / (bh / 2), up = k < bh / 2; g.fillStyle = up ? `rgb(${110 + 145 * a},${clamp((a - 0.55) * 2.2, 0, 1) * 230},0)` : `rgb(0,${clamp((a - 0.55) * 2.2, 0, 1) * 230},${110 + 145 * a})`; g.fillRect(bx, by + k, 8, 1); }
          g.fillStyle = '#8ea3c4'; g.fillText('+' + U.scale, bx + 11, by + 8); g.fillText('−' + U.scale, bx + 11, by + bh);
        }
      }
    }
    const pc = S.$('#usPw');
    if (pc && S.v.mode === 'pw') {
      const { g, w, h, resized } = fit(pc);
      if (U.pwDirty || resized) {
        U.pwDirty = false; g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        g.imageSmoothingEnabled = true; g.drawImage(U.specC, 40, 4, w - 48, h - 8);
        g.strokeStyle = 'rgba(142,163,196,.5)'; g.beginPath(); g.moveTo(40, h / 2); g.lineTo(w - 8, h / 2); g.stroke();
        g.fillStyle = '#8ea3c4'; g.font = '600 10px Inter, sans-serif'; g.textAlign = 'right';
        [1, 0.5, 0, -0.5, -1].forEach(k => g.fillText(String(Math.round(k * U.scale)), 36, h / 2 - k * (h / 2 - 6) + 3));
        g.textAlign = 'left'; g.fillText('cm/s', 4, 12);
      }
    }
    const pv = S.$('#usPh');
    if (pv) {
      const { g, w, h, resized } = fit(pv);
      if (U.phDirty || resized) {
        U.phDirty = false;
        g.fillStyle = '#02060d'; g.fillRect(0, 0, w, h);
        const s = Math.min(w - 16, h - 34), x0 = (w - s) / 2, y0 = 26, k = s / PH, P = PROBES[S.v.probe] || PROBES.linear;
        g.fillStyle = '#3a3428'; g.fillRect(x0, y0, s, s);
        const circ = (c, col) => { g.fillStyle = col; g.beginPath(); g.arc(x0 + c[0] * k, y0 + c[1] * k, c[2] * k, 0, 7); g.fill(); };
        circ(CYST, '#0d0d0d'); circ(MASS, '#7b6f58'); circ(STONE, '#f0ead8');
        g.strokeStyle = '#1a0a0a'; g.lineWidth = VR * 2 * k; g.lineCap = 'round'; g.beginPath(); g.moveTo(x0 + V1[0] * k, y0 + V1[1] * k); g.lineTo(x0 + V2[0] * k, y0 + V2[1] * k); g.stroke();
        g.strokeStyle = '#d42a2a'; g.lineWidth = 1.5; g.beginPath(); const mx = (V1[0] + V2[0]) / 2, my = (V1[1] + V2[1]) / 2; g.moveTo(x0 + (mx + VUX) * k, y0 + (my + VUY) * k); g.lineTo(x0 + (mx - VUX) * k, y0 + (my - VUY) * k); g.lineTo(x0 + (mx - VUX * 0.6 + VUY * 0.3) * k, y0 + (my - VUY * 0.6 - VUX * 0.3) * k); g.stroke();
        g.fillStyle = '#fff'; WIRES.forEach(([x, y]) => g.fillRect(x0 + x * k - 1, y0 + y * k - 1, 2, 2));
        // field of view outline
        const ct = Math.cos(U.tilt), st = Math.sin(U.tilt), D = U.geo.D, toW = (lx, ly) => [x0 + (U.px + lx * ct + ly * st) * k, y0 + (-lx * st + ly * ct) * k];
        const pts = [];
        if (S.v.probe === 'linear') { pts.push(toW(-P.ap / 2, 0), toW(P.ap / 2, 0), toW(P.ap / 2, D), toW(-P.ap / 2, D)); }
        else { const R = S.v.probe === 'convex' ? P.R : 0; for (let a = -P.A; a <= P.A + 1e-6; a += P.A / 8) pts.push(toW((R + D) * Math.sin(a), (R + D) * Math.cos(a) - R)); for (let a = P.A; a >= -P.A - 1e-6; a -= P.A / 8) pts.push(toW(R * Math.sin(a), R * Math.cos(a) - R)); }
        g.save(); g.beginPath(); g.rect(x0, y0, s, s); g.clip();
        g.fillStyle = 'rgba(77,208,255,.13)'; g.strokeStyle = 'rgba(77,208,255,.7)'; g.lineWidth = 1; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill(); g.stroke();
        g.restore();
        // probe body
        g.save(); g.translate(x0 + U.px * k, y0); g.rotate(-U.tilt);
        const pw = (S.v.probe === 'linear' ? P.ap : S.v.probe === 'convex' ? 5 : 2) * k;
        g.fillStyle = '#c3cbe0'; g.fillRect(-pw / 2, -7, pw, 7); g.fillStyle = '#8ea3c4'; g.fillRect(-pw * 0.25, -7 - 14, pw * 0.5, 14);
        g.restore();
        g.fillStyle = '#8ea3c4'; g.font = '600 10px Inter, sans-serif'; g.fillText('Phantom — drag the probe', x0 + 4, y0 + s - 6);
      }
    }
  }
})();

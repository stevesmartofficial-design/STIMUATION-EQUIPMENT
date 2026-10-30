/* Live simulator — General radiography (generator console + two-stage hand switch).
   PREP spins the anode (rising rotor whine) and boosts the filament; READY lights only when
   rotor speed, interlocks and generator are good; EXPOSE flashes, beeps for the exposure time
   and produces a procedural radiograph (chest or hand) from tissue/bone path lengths with
   kV-dependent attenuation, inverse-square SID, quantum noise and detector saturation.
   AEC terminates on a chamber signal. kV/mA waveforms are drawn for each exposure.
   Exposure index / deviation index and heat figures are relative training estimates. */
(function () {
  const { Sound } = Sim;
  const IW = 192, IH = 232, NPX = IW * IH, ET = 400, SMAX = 2400, CQ = 1000, HEATCAP = 300, WN = 160;
  const MUS = kv => 0.17 * Math.pow(70 / kv, 0.35), MUB = kv => 0.55 * Math.pow(70 / kv, 0.9);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(6.2831853 * Math.random());
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
  const PRESETS = {
    chest: { kv: 120, ma: '320', ms: '10', aec: true, focus: 'large', sid: '180' },
    hand: { kv: 55, ma: '200', ms: '10', aec: false, focus: 'small', sid: '100' }
  };
  const MS = ['2', '5', '8', '10', '12.5', '16', '20', '25', '32', '40', '50', '63', '80', '100', '125', '160', '200', '250', '320', '400', '500', '630', '800', '1000'];

  const fit = c => {
    const d = window.devicePixelRatio || 1, w = Math.max(40, c.clientWidth || 300), h = Math.max(40, c.clientHeight || 200);
    const W = Math.round(w * d), H = Math.round(h * d), resized = c.width !== W || c.height !== H;
    if (resized) { c.width = W; c.height = H; }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return { g, w, h, resized };
  };
  function setCtl(S, id, val) {
    S.v[id] = val; const def = S.def.controls.find(x => x.id === id);
    const i = S.el.querySelector(`[data-ctl="${id}"]`); if (i) { if (i.type === 'checkbox') i.checked = !!val; else i.value = val; }
    const o = S.el.querySelector(`[data-out="${id}"]`); if (o) o.textContent = val + (def && def.unit ? ' ' + def.unit : '');
  }

  /* ---------- phantom construction (path lengths in cm) ---------- */
  function capsule(soft, bone, ax, ay, bx, by, r, cmPerUnit, toBone, k) {
    const x0 = Math.floor((Math.min(ax, bx) - r) * IH / 2 + IW / 2) - 1, x1 = Math.ceil((Math.max(ax, bx) + r) * IH / 2 + IW / 2) + 1;
    const y0 = Math.floor((Math.min(ay, by) - r) * IH / 2 + IH / 2) - 1, y1 = Math.ceil((Math.max(ay, by) + r) * IH / 2 + IH / 2) + 1;
    const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-9, arr = toBone ? bone : soft;
    for (let j = Math.max(0, y0); j <= Math.min(IH - 1, y1); j++) for (let i = Math.max(0, x0); i <= Math.min(IW - 1, x1); i++) {
      const x = (i - IW / 2) / (IH / 2), y = (j - IH / 2) / (IH / 2);
      const u = clamp(((x - ax) * dx + (y - ay) * dy) / L2, 0, 1), ex = x - ax - u * dx, ey = y - ay - u * dy, d2 = ex * ex + ey * ey;
      if (d2 < r * r) arr[j * IW + i] += (k || 1) * 2 * Math.sqrt(r * r - d2) * cmPerUnit;
    }
  }
  function polyCap(soft, bone, pts, r, cm, toBone, k) { for (let i = 0; i < pts.length - 1; i++) capsule(soft, bone, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], r, cm, toBone, k); }
  function buildChest(X) {
    const s = X.soft, b = X.bone, m = X.roi; s.fill(0); b.fill(0); m.fill(0);
    for (let j = 0; j < IH; j++) for (let i = 0; i < IW; i++) {
      const x = (i - IW / 2) / (IH / 2), y = (j - IH / 2) / (IH / 2), p = j * IW + i;
      const hw = y < -0.82 ? 0.2 : y < -0.6 ? 0.2 + (y + 0.82) / 0.22 * 0.6 : 0.8 - Math.max(0, y - 0.6) * 0.15;
      const tmax = y < -0.82 ? 12 : y < -0.6 ? 12 + (y + 0.82) / 0.22 * 10 : 22;
      const q = 1 - (x / hw) * (x / hw); if (q <= 0) continue;
      let soft = tmax * Math.sqrt(q), lung = 0;
      const ax = Math.abs(x), lx = (ax - 0.37) / 0.27, bottom = 0.5 - 0.16 * Math.cos(clamp(lx, -1, 1) * Math.PI / 2);
      const ly = y < 0 ? (y + 0.05) / 0.6 : (y + 0.05) / (bottom + 0.05), r2 = lx * lx + ly * ly;
      if (r2 < 1 && y < bottom) lung = 16 * Math.sqrt(1 - r2);
      const hx = (x - 0.1) / 0.3, hy = (y - 0.24) / 0.26, hr = hx * hx + hy * hy;
      if (hr < 1) lung *= Math.min(1, hr * 1.1);                                     // heart shadow
      soft -= lung * 0.9;
      const nx = (x + 0.33) / 0.04, ny = (y + 0.22) / 0.04; if (nx * nx + ny * ny < 1) soft += 2.5; // lung nodule
      s[p] = soft;
      if (ax < 0.065) b[p] += 2.6 * Math.sqrt(1 - (x / 0.065) * (x / 0.065)) * (Math.sin(y * 30) > -0.55 ? 1 : 0.45); // vertebrae + discs
      if (lung > 4 && Math.abs(lx) < 0.6 && Math.abs(ly) < 0.6) m[p] = 1;                // AEC chambers over the lung fields
    }
    for (const sd of [-1, 1]) {
      for (let k = 0; k < 10; k++) {                                                   // posterior ribs
        const y0 = -0.66 + k * 0.115, pts = [];
        for (let n = 0; n <= 8; n++) { const tau = n / 8; pts.push([sd * (0.07 + 0.66 * tau), y0 - 0.07 * Math.sin(Math.PI * tau) + 0.22 * tau * tau]); }
        polyCap(s, b, pts, 0.02, 20, true, 0.55);
      }
      capsule(s, b, sd * 0.07, -0.64, sd * 0.56, -0.73, 0.024, 20, true, 0.7);          // clavicles
      capsule(s, b, sd * 0.78, -0.66, sd * 0.86, -0.4, 0.07, 20, true, 0.35);           // humeral heads
    }
  }
  function buildHand(X) {
    const s = X.soft, b = X.bone, m = X.roi; s.fill(0); b.fill(0); m.fill(0); const cm = 12;
    capsule(s, b, 0, 1.2, 0, 0.5, 0.3, cm, false, 0.75);                                  // forearm
    for (let j = 0; j < IH; j++) for (let i = 0; i < IW; i++) {                          // palm
      const x = (i - IW / 2) / (IH / 2), y = (j - IH / 2) / (IH / 2), ex = x / 0.33, ey = (y - 0.15) / 0.3, r = ex * ex + ey * ey;
      if (r < 1) { s[j * IW + i] = Math.max(s[j * IW + i], 3.6 * Math.sqrt(1 - r)); if (r < 0.5) m[j * IW + i] = 1; }
    }
    capsule(s, b, -0.12, 1.2, -0.12, 0.5, 0.075, cm, true); capsule(s, b, 0.14, 1.2, 0.14, 0.53, 0.05, cm, true); // radius, ulna
    [[-0.13, .44], [-.03, .45], [.07, .44], [.16, .45], [-.15, .34], [-.04, .35], [.06, .34], [.15, .36]].forEach(([x, y]) => capsule(s, b, x, y - .01, x, y + .01, 0.05, cm, true, 0.8)); // carpals
    const F = [[-0.2, -0.2, -0.82], [-0.07, -0.07, -0.92], [0.07, 0.08, -0.88], [0.2, 0.22, -0.74]];
    F.forEach(([xb, xt, yt]) => {
      capsule(s, b, xb, 0.3, xb * 1.05, -0.05, 0.035, cm, true);                         // metacarpal
      capsule(s, b, xb * 1.05, -0.08, xt, yt, 0.075, cm, false);                         // finger soft tissue
      const L = -0.08 - yt, seg = [0.45, 0.3, 0.22]; let y = -0.1;
      seg.forEach((f, k) => { const y2 = y - L * f + 0.025; const xa = xb + (xt - xb) * ((-0.08 - y) / L), xe = xb + (xt - xb) * ((-0.08 - y2) / L); capsule(s, b, xa, y, xe, y2, 0.028 - k * 0.004, cm, true); y = y2 - 0.035; });
    });
    capsule(s, b, -0.25, 0.3, -0.5, -0.12, 0.085, cm, false);                             // thumb
    capsule(s, b, -0.22, 0.34, -0.33, 0.1, 0.035, cm, true); capsule(s, b, -0.35, 0.06, -0.43, -0.04, 0.03, cm, true); capsule(s, b, -0.45, -0.07, -0.5, -0.14, 0.024, cm, true);
  }

  /* ---------- exposure → image ---------- */
  function makeImage(S, e) {
    const X = S.xr, f = S.fault, c = X.cnt, tmp = X.tmp, us = MUS(e.kv), ub = MUB(e.kv), sid = +S.v.sid;
    const Q = e.mAs * Math.pow(e.kv / 80, 2) * Math.pow(100 / sid, 2) * CQ;
    for (let i = 0; i < NPX; i++) c[i] = Q * Math.exp(-(us * X.soft[i] + ub * X.bone[i]));
    if (S.v.focus === 'large') {                                                         // focal-spot blur (1-2-1)
      for (let j = 0; j < IH; j++) for (let i = 0; i < IW; i++) { const p = j * IW + i; tmp[p] = (c[p - (i > 0)] + 2 * c[p] + c[p + (i < IW - 1)]) / 4; }
      for (let j = 0; j < IH; j++) for (let i = 0; i < IW; i++) { const p = j * IW + i; c[p] = (tmp[p - (j > 0) * IW] + 2 * tmp[p] + tmp[p + (j < IH - 1) * IW]) / 4; }
    }
    const det = f.has('det');
    let roiSum = 0, roiN = 0, sat = 0;
    for (let j = 0; j < IH; j++) for (let i = 0; i < IW; i++) {
      const p = j * IW + i; let v = c[p] + Math.sqrt(c[p]) * gauss();
      if (det) v *= (i < IW / 2 ? 1 : 0.84) * (j < IH / 2 ? 1 : 1.12) * (1 + 0.05 * Math.sin(i * 0.39)) * (i === 61 || j === 150 ? 0.25 : 1);
      if (v > SMAX) { v = SMAX; sat++; } if (v < 0.5) v = 0.5;
      c[p] = v; if (X.roi[p]) { roiSum += Math.min(v, SMAX); roiN++; }
    }
    const ei = roiN ? roiSum / roiN : 0;
    // processing: log, auto window from sampled percentiles of the anatomy, invert (bone white)
    const smp = X.smp; let n = 0;
    for (let p = 0; p < NPX && n < smp.length; p += 7) if (X.soft[p] > 0.3) smp[n++] = Math.log(c[p]);
    const arr = smp.subarray(0, n).sort();
    const lo = n ? arr[Math.floor(n * 0.01)] : 0, hi = n ? arr[Math.min(n - 1, Math.floor(n * 0.995))] : 1, span = Math.max(0.3, hi - lo);
    const d = X.img.data;
    for (let p = 0; p < NPX; p++) { const g = Math.round(255 * clamp(1 - (Math.log(c[p]) - lo) / span, 0, 1)), i = p * 4; d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255; }
    X.ictx.putImageData(X.img, 0, 0);
    X.hasImg = true; X.blank = false; X.ei = ei; X.di = ei > 0 ? 10 * Math.log10(ei / ET) : -99; X.satPct = sat / NPX * 100;
  }
  function blankImage(S) {
    const X = S.xr, d = X.img.data;
    for (let p = 0; p < NPX; p++) { const g = 235 + (Math.random() * 20 | 0), i = p * 4; d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255; }
    X.ictx.putImageData(X.img, 0, 0); X.hasImg = true; X.blank = true; X.ei = 0; X.di = -99;
  }
  function buildWave(S, e) {
    const X = S.xr, f = S.fault, kv = X.wkv, ma = X.wma;
    for (let i = 0; i < WN; i++) {
      const tau = -0.08 + i / (WN - 1) * 1.25; let k = 0, a = 0;
      if (tau >= 0) {
        const on = tau <= 1 ? 1 - Math.exp(-tau / 0.025) : (1 - Math.exp(-1 / 0.025)) * Math.exp(-(tau - 1) / 0.035);
        k = e.kvSet * on * (1 + (tau <= 1 ? (f.has('kv') ? 0.2 * Math.exp(-tau / 0.09) * Math.cos(2 * Math.PI * 5 * tau) + 0.08 * Math.sin(2 * Math.PI * 23 * tau) : 0.012 * Math.sin(2 * Math.PI * 40 * tau)) : 0));
        a = f.has('fil') ? 0 : e.ma * (tau <= 1 ? 1 - Math.exp(-tau / 0.03) : Math.exp(-(tau - 1) / 0.02)) * (1 + (tau <= 1 ? 0.01 * Math.sin(2 * Math.PI * 31 * tau) : 0));
      }
      kv[i] = k; ma[i] = a;
    }
    X.wave = e; X.wDirty = true;
  }

  /* ---------- generator logic ---------- */
  function refuse(S, msg) { S.log(msg, 'bad'); S.xr.msg = msg; Sound.beep(300, 0.15, { vol: 0.14, type: 'square', lp: 1000 }); Sound.beep(240, 0.22, { vol: 0.14, type: 'square', lp: 1000, when: Sound.now + 0.18 }); }
  function prep(S) {
    const X = S.xr, v = S.v;
    if (X.ph === 'prep' || X.ph === 'ready') return;
    if (X.ph === 'expose') return;
    if (X.heat > HEATCAP * 0.9) return refuse(S, `Prep refused: anode heat ${Math.round(X.heat)} kHU — wait for cooling`);
    if (v.focus === 'small' && +v.ma > 320) return refuse(S, 'Prep refused: tube loading limit for the small focal spot — reduce mA or select the large focus');
    X.ph = 'prep'; X.phT = 0; X.msg = ''; S.log('PREP: rotor accelerating, filament boost');
  }
  function expose(S) {
    const X = S.xr, v = S.v, f = S.fault;
    if (X.ph !== 'ready') { refuse(S, X.ph === 'prep' ? 'Expose ignored: generator not READY yet' : 'Expose ignored: press PREP first and wait for READY'); return; }
    const kvSet = +v.kv, ma = +v.ma, msSet = +v.ms, kvEff = kvSet * (f.has('kv') ? 1.08 : 1);
    let ms = msSet, aecMsg = '';
    if (v.aec) {
      let att = 0, n = 0; const us = MUS(kvEff), ub = MUB(kvEff);
      for (let p = 0; p < NPX; p += 3) if (X.roi[p]) { att += Math.exp(-(us * X.soft[p] + ub * X.bone[p])); n++; }
      const perMas = Math.pow(kvEff / 80, 2) * Math.pow(100 / +v.sid, 2) * CQ * (n ? att / n : 1e-3);
      const need = ET / perMas, backup = Math.max(5 * msSet, 100);
      ms = Math.max(1, need / ma * 1000);
      if (f.has('aec') || ms > backup) { ms = backup; aecMsg = f.has('aec') ? 'AEC: no chamber signal — exposure ended by the BACKUP TIMER' : 'AEC: backup time reached before the chamber dose'; }
    }
    const maAct = f.has('fil') ? 0 : ma, mAs = maAct * ms / 1000;
    X.ph = 'expose'; X.phT = 0; X.dur = ms / 1000; X.e = { kvSet, kv: kvEff, ma: maAct, ms, mAs, aecMsg };
    buildWave(S, X.e);
    Sound.beep(1600, Math.max(0.03, ms / 1000), { vol: 0.2, attack: 0.002, release: 0.008 });
    if (X.flash) X.flash.classList.add('on');
  }
  function finishExposure(S) {
    const X = S.xr, e = X.e, f = S.fault;
    if (X.flash) X.flash.classList.remove('on');
    X.heat = Math.min(HEATCAP * 1.05, X.heat + 1.35 * e.kv * e.mAs / 1000);
    if (f.has('fil')) {
      blankImage(S); S.alarm('fil', 'med', 'NO TUBE CURRENT — FILAMENT FAULT');
      S.log(`Exposure ${e.kvSet} kV for ${e.ms.toFixed(0)} ms: kV present but mA = 0. No radiation detected, so the image is blank.`, 'bad');
    } else {
      makeImage(S, e);
      S.log(`Exposure: ${e.kvSet} kV set (${e.kv.toFixed(0)} actual), ${e.ma} mA × ${e.ms.toFixed(1)} ms = ${e.mAs.toFixed(2)} mAs${S.v.aec ? ' (AEC)' : ''} — EI ${Math.round(X.ei)}, DI ${X.di.toFixed(1)} (training estimate)`, Math.abs(X.di) > 3 ? 'warn' : 'ok');
      if (X.satPct > 5) S.log(`Detector saturation in ${X.satPct.toFixed(0)} % of the image — detail lost (over-exposure)`, 'warn');
      if (X.di < -3) S.log('Under-exposed: quantum mottle (noise) dominates. Image processing cannot add back information that was never detected.', 'warn');
    }
    if (e.aecMsg) { S.log(e.aecMsg, 'bad'); S.alarm('aec', 'med', 'AEC BACKUP TIMER TERMINATED EXPOSURE'); }
    if (f.has('kv')) { S.alarm('kv', 'low', 'kV ACTUAL DEVIATES FROM SET VALUE'); S.log('Generator: kV overshoot / ripple detected during exposure', 'warn'); }
    X.ph = 'brake'; X.phT = 0; X.dirty = true;
  }

  Sim.register('xray', {
    title: 'X-ray generator console — live exposure',
    intro: 'Set kV, mA and time (or use AEC), press PREP, wait for READY, then EXPOSE. The radiograph is built from the physics: low mAs gives noise, too much saturates the detector. Watch the kV waveform and listen to the rotor.',
    stage: () => `<style>
      .xrx-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #13223d;font:700 .8rem var(--mono)}
      .xrx-gen{padding:3px 10px;border-radius:6px;background:#13223d;color:#8ea3c4}
      .xrx-gen.prep{background:#1d3f73;color:#9fd0ff}.xrx-gen.ready{background:#36d39a;color:#02130b}.xrx-gen.xray{background:#f5b84a;color:#111;box-shadow:0 0 16px #f5b84a}.xrx-gen.err{background:#d42a2a;color:#fff}
      .xrx-msg{color:#f5b84a;font-weight:600}
      .xrx-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,1fr)}
      .xrx-iw{position:relative;border-right:1px solid #13223d}
      .xrx-iw canvas{display:block;width:100%;height:400px}
      .xrx-flash{position:absolute;inset:0;background:#fff8e0;opacity:0;pointer-events:none;transition:opacity .25s}
      .xrx-flash.on{opacity:.75;transition:none}
      .xrx-hs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}
      .xrx-btn{border:1px solid #1f3558;border-radius:10px;padding:12px 8px;font:800 1rem Inter,sans-serif;letter-spacing:.06em;color:#e6eefb;background:#0b1526;cursor:pointer;touch-action:manipulation}
      .xrx-btn small{display:block;font:600 .65rem Inter,sans-serif;color:#8ea3c4;letter-spacing:.04em}
      .xrx-btn:active{transform:translateY(1px)}.xrx-btn.exp{background:#3b2a07;border-color:#f5b84a}.xrx-btn.sm{font-size:.8rem;padding:8px}
      .xrx-ready{grid-column:span 2;text-align:center;padding:8px;border-radius:8px;font:800 .9rem var(--mono);letter-spacing:.12em;background:#0b1526;color:#33415c;border:1px solid #1f3558}
      .xrx-ready.on{background:#0f3d2b;color:#36d39a;border-color:#36d39a;box-shadow:0 0 14px rgba(54,211,154,.4)}
      .xrx-lampled{font:600 .75rem var(--mono);color:#5a6f92;align-self:center;text-align:center}.xrx-lampled.on{color:#ffe08a}
      .xrx-side canvas{display:block;width:100%;height:150px;border-top:1px solid #13223d;border-bottom:1px solid #13223d}
      .xrx-ro{grid-template-columns:repeat(auto-fit,minmax(105px,1fr))}.xrx-ro b{font-size:1.05rem}.xrx-ro small i{font-style:normal;text-transform:none;letter-spacing:0;opacity:.75}
      @media(max-width:820px){.xrx-grid{grid-template-columns:1fr}.xrx-iw{border-right:0}.xrx-iw canvas{height:320px}}
    </style>
    <div class="xrx-bar"><span class="xrx-gen" id="xrGen">STANDBY</span><span class="xrx-msg" data-num="xrMsg"></span></div>
    <div class="xrx-grid">
      <div class="xrx-iw"><canvas id="xrImg"></canvas><div class="xrx-flash" id="xrFlash"></div></div>
      <div class="xrx-side">
        <div class="xrx-hs">
          <div class="xrx-ready" id="xrReady">READY</div>
          <button class="xrx-btn" id="xrPrep">PREP<small>hand switch · stage 1</small></button>
          <button class="xrx-btn exp" id="xrExp">☢ EXPOSE<small>hand switch · stage 2</small></button>
          <button class="xrx-btn sm" id="xrLamp">💡 Collimator light</button>
          <div class="xrx-lampled" id="xrLampLed">Light field off</div>
        </div>
        <canvas id="xrWave"></canvas>
        <div class="sim-readout xrx-ro">
          <div style="--c:#f5b84a"><small>kV actual</small><b data-num="kv">--</b></div>
          <div style="--c:#4dd0ff"><small>mA actual</small><b data-num="ma">--</b></div>
          <div style="--c:#e6eefb"><small>ms actual</small><b data-num="ms">--</b></div>
          <div style="--c:#e6eefb"><small>mAs actual</small><b data-num="mas">--</b></div>
          <div style="--c:#ff8fa3"><small>Anode heat</small><b data-num="heat">--</b><div class="sim-meter"><i id="xrHeatM" style="--c:#ff8fa3;width:0"></i></div></div>
          <div style="--c:#c3a6ff"><small>EI / DI <i>(training estimate)</i></small><b data-num="ei">--</b></div>
        </div>
      </div>
    </div>`,
    controls: [
      { id: 'preset', label: 'Body part', type: 'select', options: [['chest', 'Chest PA (wall stand)'], ['hand', 'Hand PA (table top)']], value: 'chest' },
      { id: 'kv', label: 'Tube voltage', type: 'range', min: 40, max: 150, step: 1, value: 120, unit: 'kV' },
      { id: 'ma', label: 'Tube current', type: 'select', options: ['100', '200', '320', '400', '500', '630'].map(x => [x, x + ' mA']), value: '320' },
      { id: 'ms', label: 'Exposure time (AEC backup = 5× or ≥ 100 ms)', type: 'select', options: MS.map(x => [x, x + ' ms']), value: '10' },
      { id: 'aec', label: 'AEC (automatic exposure control)', type: 'toggle', value: true },
      { id: 'focus', label: 'Focal spot', type: 'select', options: [['small', 'Small (0.6)'], ['large', 'Large (1.2)']], value: 'large' },
      { id: 'sid', label: 'SID', type: 'select', options: [['100', '100 cm'], ['115', '115 cm'], ['150', '150 cm'], ['180', '180 cm']], value: '180' }
    ],
    actions: [{ id: 'reset', label: 'Reset generator errors' }, { id: 'cool', label: 'Tube cooling estimate' }],
    faults: [
      { id: 'rotor', label: 'Rotor fault (no READY)', explain: 'On PREP you hear the stator hum but not the rising whine of the anode. The generator never sees rotor speed, so READY never lights and the exposure cannot start. It ends in "ROTOR SPEED NOT REACHED".', check: 'Measure the stator drive output and the start/run capacitor, check the stator cable and connections at the tube housing, and listen at the tube. A seized bearing is often heard as grinding during coast-down before it fails.' },
      { id: 'door', label: 'Room door interlock open', explain: 'The room door switch reports open. The rotor spins up, but the generator withholds READY and refuses EXPOSE. This is a radiation-protection interlock working as intended.', check: 'Close the door and confirm the indicator clears. If it does not, check the door switch alignment and continuity and the interlock wiring to the generator. Never link out a door interlock.' },
      { id: 'fil', label: 'Filament failure (no mA)', explain: 'The tube filament is open circuit or its supply has failed. kV rises, but no tube current flows: the mA trace is flat, no X-rays reach the detector, and the image is blank.', check: 'Measure filament continuity at the tube (both foci), check the filament supply and boost on the generator, and compare small and large focus. An open filament means the tube needs replacing.' },
      { id: 'kv', label: 'kV regulation error', explain: 'The high-voltage regulation loop is unstable: the kV waveform overshoots and ripples, and the kV actual reads above the set value. Images vary in contrast and dose from one exposure to the next.', check: 'Measure kVp and the waveform with a non-invasive kV meter, then check the HV tank feedback divider, the inverter drive and the HV cables. Compare against the acceptance values.' },
      { id: 'det', label: 'Detector not calibrated (gain map)', explain: 'The flat-panel gain/offset calibration is missing or out of date, so the readout tiles, column structure and defective lines are not corrected. The radiograph shows tile steps, faint stripes and bright/dark lines.', check: 'Run the detector offset, gain and defect-map calibration with the correct beam quality and no objects in the field. Check the detector temperature and its link to the workstation. Repeat a flat-field exposure to confirm.' },
      { id: 'lamp', label: 'Collimator lamp failure', explain: 'The light-field lamp does not light: you hear the relay click, but no field is projected. Radiographers cannot centre or collimate accurately, so repeats and unnecessary dose are likely.', check: 'Replace the lamp with the correct type (let it cool and wear gloves), check the lamp timer/relay and the supply voltage, then check light field and X-ray field congruence with a test tool.' },
      { id: 'aec', label: 'AEC chamber fault (over-exposure)', explain: 'The AEC chamber or its amplifier gives no signal, so the exposure is not terminated at the right dose. It runs until the backup timer, the image saturates (DI very high) and the patient receives several times the needed dose.', check: 'Test the AEC with a phantom at different thicknesses and kV, check chamber selection, chamber cabling and the AEC amplifier. Make sure the backup timer and mAs limit are set correctly.' }
    ],

    init(S) {
      const X = S.xr = {
        ph: 'idle', phT: 0, rot: 0, heat: S.xr ? S.xr.heat : 12, msg: 'Select a body part, set exposure, press PREP', lampT: 0, err: false,
        soft: new Float32Array(NPX), bone: new Float32Array(NPX), roi: new Uint8Array(NPX), cnt: new Float32Array(NPX), tmp: new Float32Array(NPX), smp: new Float32Array(Math.ceil(NPX / 7) + 1),
        wkv: new Float32Array(WN), wma: new Float32Array(WN), wave: null, e: null, hasImg: false, ei: 0, di: 0, preset: null, dirty: true
      };
      X.ic = document.createElement('canvas'); X.ic.width = IW; X.ic.height = IH; X.ictx = X.ic.getContext('2d'); X.img = X.ictx.createImageData(IW, IH);
      X.flash = S.$('#xrFlash');
      (S.v.preset === 'hand' ? buildHand : buildChest)(X); X.preset = S.v.preset;
      X.vStator = Sound.voice({ type: 'square', pitch: 150, freq: 420 });
      X.vWhine = Sound.voice({ type: 'triangle', pitch: 120, freq: 2400 });
      X.vAir = Sound.voice({ noise: true, filter: 'bandpass', freq: 600, q: 1.5 });
      const b = (id, fn) => { const el = S.$(id); if (el) el.onclick = () => { if (!S.on) return; Sound.init(); fn(); }; };
      b('#xrPrep', () => prep(S)); b('#xrExp', () => expose(S)); b('#xrLamp', () => lamp(S));
      S.log('Generator self-test passed. Tube heat ' + Math.round(X.heat) + ' kHU.', 'info');
    },
    onControl(S, id, val) {
      const X = S.xr; if (!X) return;
      if (id === 'preset') {
        const p = PRESETS[val]; if (!p) return; Object.keys(p).forEach(k => setCtl(S, k, p[k]));
        (val === 'hand' ? buildHand : buildChest)(X); X.preset = val; X.hasImg = false; X.wave = null; X.dirty = true; X.wDirty = true;
        S.log(`Preset ${val}: ${p.kv} kV, ${p.ma} mA, ${p.ms} ms, AEC ${p.aec ? 'on' : 'off'}, ${p.focus} focus, SID ${p.sid} cm`);
      }
      if (X.ph === 'ready' || X.ph === 'prep') S.log('Technique changed during PREP — check the console before exposing', 'warn');
    },
    onFault(S, id, on) {
      if (!S.xr) return;
      if (!on) { const map = { fil: 'fil', aec: 'aec', kv: 'kv', rotor: 'rotor' }; if (map[id]) S.clear(map[id]); }
      if (id === 'door' && on && S.xr.ph === 'ready') { S.xr.ph = 'prep'; S.xr.phT = 0.9; S.log('Door opened — READY withdrawn', 'warn'); }
    },
    onAction(S, id) {
      if (id === 'prep') prep(S);
      if (id === 'expose') expose(S);
      if (id === 'lamp') lamp(S);
      if (id === 'cool') { const X = S.xr; let h = X.heat, k = 0; while (h > HEATCAP * 0.3 && k < 3600) { h -= 0.25 + h * 0.004; k++; } S.log(`Anode heat ${Math.round(X.heat)} of ${HEATCAP} kHU (training value) — about ${k} s to cool below 30 %`); }
      if (id === 'reset') { ['fil', 'aec', 'kv', 'rotor'].forEach(a => S.clear(a)); S.xr.msg = ''; S.log('Generator error memory reset'); }
    },

    tick(S, dt, t) {
      const X = S.xr, f = S.fault; X.phT += dt;
      // rotor
      const spin = (X.ph === 'prep' || X.ph === 'ready' || X.ph === 'expose') && !f.has('rotor');
      X.rot += spin ? (1 - X.rot) * Math.min(1, dt * 2.6) : -Math.min(X.rot, dt * (X.ph === 'brake' ? 0.7 : 0.25));
      if (X.ph === 'prep') {
        if (f.has('rotor') && X.phT > 2.5) { X.ph = 'idle'; X.msg = 'ROTOR SPEED NOT REACHED'; S.alarm('rotor', 'med', 'ROTOR SPEED NOT REACHED — EXPOSURE INHIBITED'); S.log('Generator: rotor speed sensor not satisfied after 2.5 s — PREP cancelled', 'bad'); }
        else if (X.rot > 0.96 && X.phT > 0.8) {
          if (f.has('door')) { if (X.msg !== 'Door interlock open — exposure inhibited') { X.msg = 'Door interlock open — exposure inhibited'; S.log(X.msg, 'warn'); } }
          else { X.ph = 'ready'; X.phT = 0; X.msg = ''; Sound.beep(1320, 0.07, { vol: 0.1 }); S.log('READY'); }
        }
        if (X.ph === 'prep' && X.phT > 12) { X.ph = 'brake'; X.phT = 0; S.log('PREP released (timeout) — rotor braking'); }
      } else if (X.ph === 'ready') {
        if (X.phT > 12) { X.ph = 'brake'; X.phT = 0; S.log('READY held too long — PREP released, rotor braking (protects the filament)'); }
      } else if (X.ph === 'expose') {
        if (X.phT >= X.dur) finishExposure(S);
      } else if (X.ph === 'brake') { if (X.phT > 2.5) X.ph = 'idle'; }
      // heat
      X.heat = Math.max(0, X.heat - dt * (0.25 + X.heat * 0.004));
      if (X.lampT > 0) { X.lampT -= dt; if (X.lampT <= 0) { X.lampT = 0; Sound.burst(0.02, { freq: 3000, vol: 0.1 }); X.dirty = true; } }
      // sound
      const prepping = X.ph === 'prep' || X.ph === 'ready' || X.ph === 'expose';
      X.vStator.set({ vol: prepping ? (f.has('rotor') ? 0.07 : 0.03) : X.ph === 'brake' && X.phT < 1.2 ? 0.05 : 0, pitch: X.ph === 'brake' ? 100 : 150 });
      X.vWhine.set({ vol: X.rot * 0.05, pitch: 120 + X.rot * 780, glide: 0.06 });
      X.vAir.set({ vol: X.rot * 0.04, freq: 400 + X.rot * 2200, glide: 0.06 });
      // alarms
      const set = (cond, id, pr, text) => cond ? S.alarm(id, pr, text) : S.clear(id);
      set(f.has('door'), 'door', 'low', 'ROOM DOOR OPEN — EXPOSURE INHIBITED');
      set(f.has('det'), 'det', 'low', 'DETECTOR CALIBRATION EXPIRED');
      set(X.heat > HEATCAP * 0.8, 'heat', X.heat > HEATCAP * 0.9 ? 'med' : 'low', 'ANODE HEAT HIGH');
      // readouts
      const e = X.e, showE = e && X.ph !== 'expose';
      const lastKv = showE ? (f.has('kv') ? e.kv : e.kvSet) : X.ph === 'expose' ? e.kv : 0;
      S.num('kv', X.ph === 'expose' || showE ? lastKv.toFixed(0) : '--');
      S.num('ma', X.ph === 'expose' || showE ? Math.round(e.ma) : '--');
      S.num('ms', showE ? e.ms.toFixed(e.ms < 10 ? 1 : 0) : '--');
      S.num('mas', showE ? e.mAs.toFixed(2) : '--');
      S.num('heat', Math.round(X.heat) + ' kHU');
      const hm = S.$('#xrHeatM'); if (hm) { const w = Math.round(X.heat / HEATCAP * 100) + '%'; if (hm.style.width !== w) hm.style.width = w; }
      S.num('ei', X.hasImg && !X.blank ? `${Math.round(X.ei)} / ${X.di >= 0 ? '+' : ''}${X.di.toFixed(1)}` : X.blank ? '0 / --' : '--');
      const eiEl = S.el.querySelector('[data-num="ei"]'); if (eiEl) { const c = !X.hasImg || X.blank ? '' : Math.abs(X.di) <= 1 ? '#36d39a' : Math.abs(X.di) <= 3 ? '#f5b84a' : '#ff5c5c'; if (eiEl.style.color !== c) eiEl.style.color = c; }
      const err = !!(S.alarms.rotor || S.alarms.fil || S.alarms.aec);
      const st = X.ph === 'expose' ? ['xray', 'X-RAY ON'] : X.ph === 'ready' ? ['ready', 'READY'] : X.ph === 'prep' ? ['prep', 'PREP'] : err ? ['err', 'ERROR'] : ['', X.ph === 'brake' ? 'ROTOR BRAKE' : 'STANDBY'];
      const ge = S.$('#xrGen'); if (ge && ge.textContent !== st[1]) { ge.textContent = st[1]; ge.className = 'xrx-gen ' + st[0]; }
      const rd = S.$('#xrReady'); if (rd && rd.classList.contains('on') !== (X.ph === 'ready')) rd.classList.toggle('on', X.ph === 'ready');
      const ll = S.$('#xrLampLed'); if (ll) { const on = X.lampT > 0, txt = on ? `Light field ON (${Math.ceil(X.lampT)} s)` : 'Light field off'; if (ll.textContent !== txt) ll.textContent = txt; ll.classList.toggle('on', on); }
      S.num('xrMsg', X.msg);
      draw(S);
    },
    stop(S) {
      const X = S.xr; if (!X) return;
      ['vStator', 'vWhine', 'vAir'].forEach(k => { if (X[k]) { X[k].stop(); X[k] = null; } });
      if (X.flash) X.flash.classList.remove('on');
      X.ph = 'idle'; X.rot = 0; X.lampT = 0;
    }
  });

  function lamp(S) {
    const X = S.xr; Sound.burst(0.02, { freq: 2800, vol: 0.15 });
    if (S.fault.has('lamp')) { X.lampT = 0; S.log('Collimator light: relay clicked but no light field', 'warn'); X.msg = 'No light field'; X.dirty = true; return; }
    X.lampT = 30; X.dirty = true; S.log('Collimator light on (30 s timer)');
  }

  function draw(S) {
    const X = S.xr, ic = S.$('#xrImg'), wc = S.$('#xrWave');
    if (ic) {
      const { g, w, h, resized } = fit(ic);
      if (X.dirty || resized || X.lampT > 0) {
        g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
        const s = Math.min((w - 16) / IW, (h - 28) / IH), dw = IW * s, dh = IH * s, x0 = (w - dw) / 2, y0 = 22;
        if (X.hasImg) { g.imageSmoothingEnabled = true; g.drawImage(X.ic, x0, y0, dw, dh); }
        else { g.fillStyle = '#5a6f92'; g.font = '600 12px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('No exposure yet — PREP, wait for READY, then EXPOSE', w / 2, h / 2); g.textAlign = 'left'; }
        if (X.lampT > 0) {
          g.fillStyle = 'rgba(255,224,138,.12)'; g.fillRect(x0 + dw * 0.08, y0 + dh * 0.06, dw * 0.84, dh * 0.88);
          g.strokeStyle = '#ffe08a'; g.setLineDash([6, 4]); g.strokeRect(x0 + dw * 0.08, y0 + dh * 0.06, dw * 0.84, dh * 0.88); g.setLineDash([]);
          g.beginPath(); g.moveTo(x0 + dw / 2, y0 + dh * 0.06); g.lineTo(x0 + dw / 2, y0 + dh * 0.94); g.moveTo(x0 + dw * 0.08, y0 + dh / 2); g.lineTo(x0 + dw * 0.92, y0 + dh / 2); g.stroke();
        }
        g.fillStyle = '#8ea3c4'; g.font = '600 11px Inter, sans-serif';
        g.fillText(`${X.preset === 'hand' ? 'Hand PA' : 'Chest PA'} · ${S.v.focus} focus · SID ${S.v.sid} cm`, 8, 15);
        if (X.hasImg && !X.blank && X.satPct > 5) { g.fillStyle = '#ff8fa3'; g.fillText(`Saturated ${X.satPct.toFixed(0)} %`, w - 110, 15); }
        X.dirty = false;
      }
    }
    if (wc) {
      const { g, w, h, resized } = fit(wc);
      if (!X.wDirty && !resized && X.ph !== 'expose') return;
      X.wDirty = false;
      g.fillStyle = '#02060d'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,150,200,.12)'; g.lineWidth = 1; g.beginPath(); for (let y = 20; y < h; y += 25) { g.moveTo(0, y); g.lineTo(w, y); } g.stroke();
      g.font = '600 11px Inter, sans-serif';
      if (X.wave) {
        const prog = X.ph === 'expose' ? clamp(X.phT / X.dur * 0.8 + 0.08, 0, 1) : 1, n = Math.max(2, Math.floor(WN * prog));
        const Y = (val, max) => h - 8 - val / max * (h - 30);
        g.lineWidth = 2;
        [[X.wkv, 170, '#f5b84a'], [X.wma, 700, '#4dd0ff']].forEach(([arr, mx, col]) => {
          g.strokeStyle = col; g.beginPath(); for (let i = 0; i < n; i++) { const x = 6 + i / (WN - 1) * (w - 12), y = Y(arr[i], mx); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
        });
        g.strokeStyle = 'rgba(245,184,74,.35)'; g.setLineDash([3, 4]); g.beginPath(); const ys = Y(X.wave.kvSet, 170); g.moveTo(6, ys); g.lineTo(w - 6, ys); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#f5b84a'; g.fillText(`kV (set ${X.wave.kvSet})`, 8, 14); g.fillStyle = '#4dd0ff'; g.fillText(`mA`, 100, 14);
        g.fillStyle = '#8ea3c4'; g.fillText(`${X.wave.ms.toFixed(X.wave.ms < 10 ? 1 : 0)} ms`, w - 60, 14);
      } else { g.fillStyle = '#5a6f92'; g.fillText('kV / mA waveform appears after an exposure', 8, 14); }
    }
  }
})();

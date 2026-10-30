/* Live simulator — CT scanner (scan console + live acquisition).
   Left: gantry cross-section — tube and detector arc rotate at the selected rotation time,
   fan beam while X-rays are on, patient on the table, side view of table travel.
   Right: the sinogram builds row by row during exposure from a procedural phantom
   (ellipses with HU-like values, quantum noise from kV/mA/rotation/slice), then a real
   filtered back-projection (128², Shepp-Logan ramp filter) is revealed angle by angle.
   Sound: gantry whoosh/hum following rpm, anode spin-up/brake whine, soft X-ray-on tone,
   table motor, gantry cooling fans. Dose and heat figures are relative training estimates. */
(function () {
  const { Sound } = Sim;
  const N = 128, NA = 240, DS = 2 / N, MUK = 3.3, COV = 40, DEAD = 84;
  const PX = new Float32Array(N); for (let i = 0; i < N; i++) PX[i] = -1 + (i + 0.5) * DS;
  const KER = new Float32Array(2 * N - 1); // Shepp-Logan ramp kernel
  for (let n = -(N - 1); n < N; n++) KER[n + N - 1] = -2 / (Math.PI * Math.PI * DS * DS * (4 * n * n - 1));
  const COS = new Float32Array(NA), SIN = new Float32Array(NA);
  for (let k = 0; k < NA; k++) { COS[k] = Math.cos(k * 2 * Math.PI / NA); SIN[k] = Math.sin(k * 2 * Math.PI / NA); }
  const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(6.2831853 * Math.random());
  const clamp = (x, a, b) => x < a ? a : x > b ? b : x;

  /* Phantoms: [x0, y0, a, b, rotation°, Δμ (water = 1), bone?] — additive, Shepp-Logan style.
     HU = (μ − 1) × 1000; bone components lose a little contrast at higher kV. */
  const PHANTOM = {
    head: [
      [0, 0, .74, .94, 0, 1.04, 0], [0, 0, .70, .90, 0, .8, 1], [0, 0, .66, .86, 0, -.8, 1],
      [0, .02, .5, .68, 0, -.014, 0],                                  // white matter ~26 HU
      [-.1, -.04, .06, .2, -15, -.024, 0], [.1, -.04, .06, .2, 15, -.024, 0], // ventricles (CSF)
      [.3, .32, .08, .08, 0, .035, 0],                                 // hyperdense haematoma
      [-.32, .38, .05, .05, 0, -.02, 0]                                // hypodense lesion
    ],
    chest: [
      [0, 0, .92, .66, 0, .92, 0], [0, 0, .86, .6, 0, .12, 0],
      [-.45, -.04, .28, .44, 8, -.86, 0], [.45, -.04, .28, .44, -8, -.86, 0], // lungs
      [.05, .08, .1, .1, 0, .12, 0], [-.12, .3, .06, .06, 0, .15, 0],         // heart blood pool, aorta
      [0, .45, .1, .1, 0, .7, 1], [0, -.52, .07, .03, 0, .5, 1],                // spine, sternum
      [-.75, -.15, .03, .05, 0, .6, 1], [.75, -.15, .03, .05, 0, .6, 1], [-.62, .35, .04, .03, 0, .6, 1], [.62, .35, .04, .03, 0, .6, 1],
      [.42, -.22, .05, .05, 0, .84, 0]                                  // lung nodule
    ],
    abdomen: [
      [0, 0, .92, .66, 0, .92, 0], [0, 0, .86, .6, 0, .12, 0],
      [-.38, -.08, .38, .3, 15, .03, 0], [-.45, -.1, .07, .07, 0, -.05, 0], // liver, liver lesion
      [.55, .05, .15, .2, -20, .02, 0],                                     // spleen
      [-.3, .32, .09, .13, 20, .12, 0], [.3, .32, .09, .13, -20, .12, 0],   // kidneys (enhanced)
      [-.05, .26, .06, .06, 0, .15, 0], [0, .46, .11, .1, 0, .7, 1],        // aorta, vertebra
      [.3, -.25, .07, .06, 0, -1.04, 0], [.1, -.36, .05, .05, 0, -1.04, 0], [.22, -.08, .15, .12, 0, -.02, 0] // bowel gas, bowel
    ]
  };
  const PROTO = {
    head: { kv: '120', ma: 250, rot: '1.0', pitch: 0.6, slice: '5', len: 150, win: 'brain' },
    chest: { kv: '120', ma: 150, rot: '0.5', pitch: 1.2, slice: '1.25', len: 350, win: 'lung' },
    abdomen: { kv: '120', ma: 200, rot: '0.5', pitch: 1, slice: '2.5', len: 400, win: 'soft' }
  };
  const WIN = { brain: [80, 40], soft: [400, 40], lung: [1500, -600], bone: [2000, 400] };
  const PHASE_TXT = { idle: 'STANDBY', warmup: 'TUBE WARM-UP', aircal: 'AIR CALIBRATION', move: 'TABLE TO START', breath: 'BREATH-HOLD', expose: 'SCANNING', recon: 'RECONSTRUCTING' };

  const fit = c => {
    const d = window.devicePixelRatio || 1, w = Math.max(40, c.clientWidth || 300), h = Math.max(40, c.clientHeight || 200);
    const W = Math.round(w * d), H = Math.round(h * d), resized = c.width !== W || c.height !== H;
    if (resized) { c.width = W; c.height = H; }
    const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); return { g, w, h, resized };
  };
  const mkCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function setCtl(S, id, val) {
    S.v[id] = val; const def = S.def.controls.find(x => x.id === id);
    const i = S.el.querySelector(`[data-ctl="${id}"]`); if (i) { if (i.type === 'checkbox') i.checked = !!val; else i.value = val; }
    const o = S.el.querySelector(`[data-out="${id}"]`); if (o) o.textContent = val + (def && def.unit ? ' ' + def.unit : '');
  }
  const params = v => ({ kv: +v.kv, ma: +v.ma, rot: +v.rot, pitch: +v.pitch, slice: +v.slice, len: +v.len, proto: v.proto });
  const ctdi = p => 0.075 * p.ma * p.rot * Math.pow(p.kv / 120, 2.5) / p.pitch * (p.proto === 'head' ? 1.8 : 1);
  const scanTime = p => p.len / (p.pitch * COV / p.rot);

  /* ---------- acquisition + reconstruction ---------- */
  function projRow(S, k) {
    const c = S.ct, sc = c.scan, out = c.sino, o = k * N, f = S.fault, ct = COS[k], st = SIN[k], th = k * 2 * Math.PI / NA;
    for (let j = 0; j < N; j++) out[o + j] = 0;
    for (const e of sc.phan) {
      const d = e[6] ? e[5] * sc.boneK : e[5], al = th - e[4] * Math.PI / 180, ca = Math.cos(al), sa = Math.sin(al);
      const r2 = e[2] * e[2] * ca * ca + e[3] * e[3] * sa * sa, cen = e[0] * ct + e[1] * st, k2 = 2 * e[2] * e[3] / r2;
      for (let j = 0; j < N; j++) { const s = PX[j] - cen; if (s * s < r2) out[o + j] += d * k2 * Math.sqrt(r2 - s * s); }
    }
    const arc = c.arcT > 0, corrupt = f.has('slip') && Math.random() < 0.05, seg = (Math.random() * (N - 32)) | 0;
    for (let j = 0; j < N; j++) {
      const I = sc.n0 * Math.exp(-MUK * out[o + j]), n = Math.max(1, I + Math.sqrt(I) * gauss());
      let p = -Math.log(n / sc.n0) / MUK + c.gains[j];
      if (arc) p = 3.5 + Math.random() * 0.8;                       // no photons while the HV collapses
      if (f.has('dead') && j === DEAD) p = p * 0.9 + 0.02;          // channel has lost its gain: reads wrong at every angle
      if (corrupt && j >= seg && j < seg + 32) p += (Math.random() - 0.5) * 0.35; // garbled packet from the slip-ring link
      out[o + j] = clamp(p, 0, 5);
    }
    if (corrupt) { c.crc++; if (c.crc === 1 || c.crc % 4 === 0) S.log(`DAS frame CRC error at view ${k} (slip-ring data link) — ${c.crc} so far`, 'warn'); }
    if (arc) c.badRows++;
    paintSinoRow(S, k);
  }
  function filterAll(S) {
    const c = S.ct, p = c.sino, q = c.filt;
    for (let k = 0; k < c.rows; k++) {
      const o = k * N;
      for (let j = 0; j < N; j++) { let s = 0; for (let i = 0; i < N; i++) s += p[o + i] * KER[j - i + N - 1]; q[o + j] = s * DS; }
    }
  }
  function bpAngle(S, k) {
    const c = S.ct, q = c.filt, rec = c.rec, o = k * N, ct = COS[k], st = SIN[k];
    for (let iy = 0; iy < N; iy++) {
      const ys = PX[iy] * st, r = iy * N;
      for (let ix = 0; ix < N; ix++) {
        const u = (PX[ix] * ct + ys + 1) / DS - 0.5, i0 = Math.floor(u); if (i0 < 0 || i0 >= N - 1) continue;
        const fr = u - i0; rec[r + ix] += q[o + i0] * (1 - fr) + q[o + i0 + 1] * fr;
      }
    }
  }
  function paintSinoRow(S, k) {
    const c = S.ct, d = c.sinoImg.data, o = k * N;
    for (let j = 0; j < N; j++) { const g = Math.round(255 * Math.pow(clamp(c.sino[o + j] / 3.6, 0, 1), 0.75)), i = (o + j) * 4; d[i] = g; d[i + 1] = g; d[i + 2] = Math.min(255, g + 12); d[i + 3] = 255; }
    c.sinoDirty = true; c.dirty = true;
  }
  function paintRecon(S) {
    const c = S.ct, d = c.recImg.data, [W, L] = WIN[S.v.win] || WIN.soft, lo = L - W / 2, sc = c.bpDone ? Math.PI / c.bpDone : 0;
    for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
      const p = iy * N + ix, i = p * 4, inFov = PX[ix] * PX[ix] + PX[iy] * PX[iy] < 0.98;
      const hu = (c.rec[p] * sc - 1) * 1000, g = inFov && c.bpDone ? Math.round(255 * clamp((hu - lo) / W, 0, 1)) : 0;
      d[i] = g; d[i + 1] = g; d[i + 2] = g; d[i + 3] = 255;
    }
    c.recCtx.putImageData(c.recImg, 0, 0); c.dirty = true;
  }
  function clearImages(S) {
    const c = S.ct; c.sino.fill(0); c.filt.fill(0); c.rec.fill(0); c.rows = 0; c.bpDone = 0; c.crc = 0; c.badRows = 0;
    const d = c.sinoImg.data; for (let i = 0; i < d.length; i += 4) { d[i] = 6; d[i + 1] = 12; d[i + 2] = 26; d[i + 3] = 255; }
    c.sinoDirty = true; paintRecon(S);
  }

  /* ---------- console logic ---------- */
  function refuse(S, msg) { S.log('Scan refused: ' + msg, 'bad'); S.ct.msg = msg; Sound.beep(330, 0.18, { vol: 0.15, type: 'square', lp: 1200 }); Sound.beep(262, 0.25, { vol: 0.15, type: 'square', lp: 1200, when: Sound.now + 0.2 }); }
  function abort(S, msg, err) {
    const c = S.ct; if (c.ph === 'idle') return;
    if (c.ph === 'expose' && c.scan && c.scan.proto !== 'head') Sound.speak('Scan stopped. You may breathe.');
    c.ph = 'idle'; c.phT = 0; c.xr = false; c.spinUntil = S.t + 4; c.msg = msg;
    S.log(msg, err ? 'bad' : 'warn');
  }
  function begin(S, ph) { const c = S.ct; c.ph = ph; c.phT = 0; c.msg = ''; c.arcs = 0; c.arcT = 0; }
  function blocked(S, needWarm) {
    const c = S.ct, f = S.fault;
    if (c.ph !== 'idle') return 'system busy (' + PHASE_TXT[c.ph] + ')';
    if (f.has('cover')) return 'gantry cover / door interlock open — rotation and X-ray disabled';
    if (c.heat > 80) return `tube heat ${Math.round(c.heat)} % — cooling wait about ${Math.ceil((c.heat - 70) / coolRate(S))} s`;
    if (c.gTemp > 42) return 'gantry over-temperature — check cooling fans';
    if (needWarm && !c.warmed) return 'tube warm-up / seasoning required after start-up';
    return '';
  }
  const coolRate = S => (0.25 + S.ct.heat * 0.006) * (S.fault.has('fan') ? 0.3 : 1) * (S.fault.has('heat') ? 0.5 : 1);

  Sim.register('ct', {
    title: 'CT scanner console — live acquisition',
    intro: 'Warm up the tube, run an air calibration, then scan. Watch the gantry rotate, the sinogram fill view by view and the slice reconstruct by filtered back-projection. Listen for the gantry, anode, X-ray tone and table — then inject faults.',
    stage: () => `<style>
      .ctx-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:8px 12px;border-bottom:1px solid #13223d;font:700 .8rem var(--mono)}
      .ctx-xr{padding:3px 10px;border-radius:6px;background:#13223d;color:#5a6f92;letter-spacing:.05em}
      .ctx-xr.on{background:#f5b84a;color:#111;box-shadow:0 0 16px #f5b84a}
      .ctx-st{color:#9fd0ff}.ctx-msg{color:#f5b84a;font-weight:600}
      .ctx-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.3fr)}
      .ctx-grid canvas{display:block;width:100%;height:340px}
      .ctx-grid>div:first-child{border-right:1px solid #13223d}
      .ctx-ro small i{font-style:normal;text-transform:none;letter-spacing:0;opacity:.75}
      .ctx-ro b{font-size:1.1rem}
      @media(max-width:820px){.ctx-grid{grid-template-columns:1fr}.ctx-grid>div:first-child{border-right:0;border-bottom:1px solid #13223d}.ctx-grid canvas{height:280px}}
    </style>
    <div class="ctx-bar"><span class="ctx-xr" id="ctXr">☢ X-RAY ON</span><span class="ctx-st" data-num="ctSt">STANDBY</span><span class="ctx-msg" data-num="ctMsg"></span></div>
    <div class="ctx-grid"><div><canvas id="ctGan"></canvas></div><div><canvas id="ctImg"></canvas></div></div>
    <div class="sim-readout ctx-ro">
      <div style="--c:#f5b84a"><small>CTDIvol-like index <i>(rel., training estimate)</i></small><b data-num="ctdi">--</b></div>
      <div style="--c:#f5b84a"><small>DLP-like <i>(rel.)</i></small><b data-num="dlp">--</b></div>
      <div style="--c:#ff8fa3"><small>Tube heat</small><b data-num="heat">--</b><div class="sim-meter"><i id="ctHeatM" style="--c:#ff8fa3;width:0"></i></div></div>
      <div style="--c:#c3a6ff"><small>Anode rpm</small><b data-num="anode">0</b></div>
      <div style="--c:#4dd0ff"><small>Gantry rpm</small><b data-num="grpm">0</b></div>
      <div style="--c:#36d39a"><small>Table position</small><b data-num="table">0 mm</b></div>
      <div style="--c:#8ea3c4"><small>kV / mA actual</small><b data-num="kvma">0 / 0</b></div>
      <div style="--c:#8ea3c4"><small>Gantry air temp</small><b data-num="gtemp">--</b></div>
      <div style="--c:#e6eefb"><small>Scan time</small><b data-num="stime">--</b></div>
    </div>`,
    controls: [
      { id: 'proto', label: 'Protocol', type: 'select', options: [['head', 'Routine head'], ['chest', 'Chest (breath-hold)'], ['abdomen', 'Abdomen (breath-hold)']], value: 'head' },
      { id: 'kv', label: 'Tube voltage', type: 'select', options: [['80', '80 kV'], ['100', '100 kV'], ['120', '120 kV'], ['140', '140 kV']], value: '120' },
      { id: 'ma', label: 'Tube current', type: 'range', min: 50, max: 500, step: 10, value: 250, unit: 'mA' },
      { id: 'rot', label: 'Rotation time', type: 'select', options: [['0.33', '0.33 s'], ['0.5', '0.5 s'], ['0.75', '0.75 s'], ['1.0', '1.0 s']], value: '1.0' },
      { id: 'pitch', label: 'Pitch', type: 'range', min: 0.5, max: 1.5, step: 0.05, value: 0.6 },
      { id: 'slice', label: 'Slice thickness', type: 'select', options: [['0.625', '0.625 mm'], ['1.25', '1.25 mm'], ['2.5', '2.5 mm'], ['5', '5 mm']], value: '5' },
      { id: 'len', label: 'Scan length', type: 'range', min: 50, max: 500, step: 10, value: 150, unit: 'mm' },
      { id: 'win', label: 'Display window', type: 'select', options: [['brain', 'Brain W80 / L40'], ['soft', 'Soft tissue W400 / L40'], ['lung', 'Lung W1500 / L−600'], ['bone', 'Bone W2000 / L400']], value: 'brain' }
    ],
    actions: [{ id: 'warm', label: '♨ Warm-up / tube seasoning' }, { id: 'aircal', label: '◎ Air calibration' }, { id: 'scan', label: '▶ Start scan', primary: true }, { id: 'abort', label: '■ Abort' }],
    faults: [
      { id: 'cover', label: 'Gantry door / cover interlock open', explain: 'A gantry cover or service door switch is open, so the interlock chain disables rotation and the high-voltage generator. Every scan, warm-up and calibration is refused with an interlock message, and the gantry will not spin.', check: 'Walk round the gantry and confirm every cover is seated. Then follow the interlock chain on the service diagnostics: test each micro-switch for continuity and check the connector at the stationary side. Never bridge an interlock to "get a scan done".' },
      { id: 'heat', label: 'Tube overheat (cooling circuit)', explain: 'Tube heat climbs several times faster than normal on every exposure and falls away slowly, so the console starts refusing scans with a cooling wait. That points to the tube oil circuit, such as the pump, heat exchanger or a blocked filter, rather than to the scan protocol.', check: 'Check the tube heat-exchanger fan and oil pump run, look for oil leaks, read the tube housing temperature sensor and the heat history in the service log, and compare cooling curves with the reference.' },
      { id: 'dead', label: 'Detector channel dead', explain: 'One detector channel always reads "air". You see a vertical line in the sinogram, and because that channel samples the same radius at every angle, back-projection turns it into a sharp ring centred on the isocentre. Air calibration reports the channel out of tolerance.', check: 'Run the detector diagnostics or channel map, then a water-phantom scan to see the ring. Reseat or swap the DAS or detector module, then re-run air calibration. A ring that stays the same in every image almost always means a channel fault.' },
      { id: 'slip', label: 'Slip-ring data error', explain: 'Data frames crossing from the rotating side are getting corrupted. You see random garbled sinogram rows and streaks in the image, and the log fills with CRC / communication errors. Typical causes are worn or contaminated slip-ring tracks and brushes, or a failing optical/RF data link.', check: 'Read the communication error counters, inspect and clean the slip-ring and brushes (lock-out first, as the slip ring carries high power), check the data-link transmitter/receiver alignment and run the manufacturer\'s link test.' },
      { id: 'arc', label: 'Tube arc / spit', explain: 'The high voltage briefly collapses inside the tube (an arc or "spit"). The kV readout drops and the exposure is interrupted, giving a burst of empty views and streaks. After repeated arcs the generator aborts the scan. Seasoning may help a gassy tube, but if the arcs keep coming the tube is near end of life.', check: 'Review the generator arc counter and the kV/mA traces in the log, run tube seasoning, and check the HV cables and terminations for tracking. If the arc rate stays high after seasoning, plan a tube replacement.' },
      { id: 'fan', label: 'Gantry cooling fan failure', explain: 'The gantry fans have stopped. Listen: the steady fan noise is gone. The gantry air temperature creeps up, tube cooling becomes less effective, and above the temperature limit scanning is refused.', check: 'Confirm the fans are not running, then check the fan fuses, supply voltage, tacho signals and the filters, which can block airflow. Check the room HVAC as well. Let the gantry cool before returning it to service.' },
      { id: 'table', label: 'Table motor fault', explain: 'The table drive hums but the table does not move. After a timeout the console aborts with a table motion error. The scan can\'t start because the table never reaches the start position.', check: 'Check the table drive motor, its controller and fuse, the encoder and clutch/belt, and the emergency stop and collision switches. Test manual table release and longitudinal travel limits.' }
    ],

    init(S) {
      const c = S.ct = {
        ph: 'idle', phT: 0, ang: 0, rpm: 0, anode: 0, kvT: 120, heat: S.ct ? S.ct.heat : 8, gTemp: 24, z: 0, xr: false, kvAct: 0, maAct: 0,
        warmed: false, cal: false, spinUntil: 0, msg: 'Tube cold — run warm-up, then air calibration', arcs: 0, arcT: 0, nextArc: 0, crc: 0, badRows: 0,
        rows: 0, bpDone: 0, prog: 0, scan: null, tableStall: 0,
        sino: new Float32Array(NA * N), filt: new Float32Array(NA * N), rec: new Float32Array(N * N), gains: new Float32Array(N),
        sinoC: mkCanvas(N, NA), recC: mkCanvas(N, N), dirty: true, sinoDirty: true
      };
      c.sinoCtx = c.sinoC.getContext('2d'); c.recCtx = c.recC.getContext('2d');
      c.sinoImg = c.sinoCtx.createImageData(N, NA); c.recImg = c.recCtx.createImageData(N, N);
      for (let j = 0; j < N; j++) c.gains[j] = 0.004 * gauss(); // uncalibrated channel offsets
      clearImages(S);
      c.vWhoosh = Sound.voice({ noise: true, filter: 'bandpass', freq: 300, q: 1.2 });
      c.vHum = Sound.voice({ type: 'triangle', pitch: 30, freq: 240 });
      c.vAnode = Sound.voice({ type: 'sawtooth', pitch: 30, freq: 500, q: 2 });
      c.vXr = Sound.voice({ type: 'sine', pitch: 760, freq: 2000 });
      c.vTable = Sound.voice({ type: 'sawtooth', pitch: 48, freq: 380 });
      c.vFan = Sound.voice({ noise: true, filter: 'lowpass', freq: 700 });
      S.log('CT console ready. Tube is cold: run warm-up / seasoning, then air calibration.', 'info');
    },

    onControl(S, id, val) {
      const c = S.ct; if (!c) return;
      if (id === 'proto') {
        const p = PROTO[val]; if (!p) return;
        Object.keys(p).forEach(k => setCtl(S, k, p[k]));
        S.log(`Protocol preset loaded: ${val} (kV ${p.kv}, ${p.ma} mA, ${p.rot} s, pitch ${p.pitch}, ${p.slice} mm, ${p.len} mm)`);
        paintRecon(S);
      }
      if (id === 'win') paintRecon(S);
      if (c.ph !== 'idle' && id !== 'win') S.log('Scan parameters are locked during acquisition — the change applies to the next scan.', 'warn');
    },
    onFault(S, id, on) {
      const c = S.ct; if (!c) return;
      if (!on && id === 'table') S.clear('table');
      if (!on && id === 'arc') S.clear('arc');
      if (!on && id === 'slip') { S.clear('slip'); c.crc = 0; }
      if (on && id === 'cover' && c.ph !== 'idle') abort(S, 'Interlock opened — rotation braked and X-ray switched off', true);
    },

    onAction(S, id) {
      const c = S.ct, v = S.v, f = S.fault;
      if (id === 'abort') { if (c.ph === 'idle') return S.log('Nothing to abort'); abort(S, 'Scan / procedure aborted by operator', false); Sound.beep(520, 0.15, { vol: 0.12 }); return; }
      if (id === 'warm') {
        const b = blocked(S, false); if (b) return refuse(S, b);
        begin(S, 'warmup'); c.scan = Object.assign(params(v), { rot: 1, ma: 100 }); S.log('Tube warm-up / seasoning started: stepped low-mA exposures from 80 to 140 kV, no patient on the table');
        return;
      }
      if (id === 'aircal') {
        const b = blocked(S, true); if (b) return refuse(S, b);
        begin(S, 'aircal'); c.scan = Object.assign(params(v), { ma: 100 }); S.log('Air calibration started: gantry empty, exposures at each kV to measure channel gains');
        return;
      }
      if (id === 'scan') {
        const b = blocked(S, true); if (b) return refuse(S, b);
        const p = params(v);
        p.phan = PHANTOM[p.proto] || PHANTOM.head; p.boneK = Math.pow(120 / p.kv, 0.35);
        p.n0 = 4e6 * (p.ma * p.rot / 100) * Math.pow(p.kv / 120, 2.5) * (p.slice / 5) * (p.proto === 'head' ? 1 : 6);
        p.time = scanTime(p); p.z0 = 400; p.ctdi = ctdi(p);
        if (p.ma > 400 && p.rot >= 0.75 && c.heat > 50) S.log('Warning: high mAs while the tube is already warm — heat will be close to the limit', 'warn');
        c.scan = p; clearImages(S); S.clear('arc');
        if (!c.cal) S.log('Air calibration not done since start-up — expect ring artefacts', 'warn');
        S.log(`Scan started: ${p.proto}, ${p.kv} kV, ${p.ma} mA, ${p.rot} s, pitch ${p.pitch}, ${p.slice} mm × ${p.len} mm, est. ${p.time.toFixed(1)} s`);
        begin(S, 'move');
      }
    },

    tick(S, dt, t) {
      const c = S.ct, v = S.v, f = S.fault; c.phT += dt;
      const sc = c.scan, rotNow = c.ph === 'warmup' ? 1 : sc && c.ph !== 'idle' ? sc.rot : +v.rot;
      const busy = c.ph !== 'idle', needAnode = busy && c.ph !== 'recon';

      // ---- mechanics: gantry, anode, table ----
      const rpmT = f.has('cover') ? 0 : (busy || t < c.spinUntil) ? 60 / rotNow : 0;
      c.rpm += clamp(rpmT - c.rpm, -22 * dt, 32 * dt); c.ang = (c.ang + c.rpm / 60 * 2 * Math.PI * dt) % (2 * Math.PI);
      const anT = needAnode && !f.has('cover') ? 9000 : 0;
      c.anode += clamp(anT - c.anode, -4200 * dt, 3600 * dt);
      const atSpeed = c.rpm > rpmT - 1 && rpmT > 0 && c.anode > 8500;
      let tableSpeed = 0;

      // ---- cooling ----
      c.gTemp += ((f.has('fan') ? 47 : 24 + c.rpm / 60) - c.gTemp) * dt * (f.has('fan') ? 0.02 : 0.05);
      c.heat = Math.max(2, c.heat - coolRate(S) * dt);

      // ---- phases ----
      c.xr = false;
      if (c.ph === 'warmup' || c.ph === 'aircal') {
        const dur = c.ph === 'warmup' ? 12 : 8, k = c.phT - 2.5, period = c.ph === 'warmup' ? 1.6 : 1.3;
        if (k > 0 && atSpeed && (k % period) < period * 0.6 && k < dur) {
          c.xr = true; c.kvT = [80, 100, 120, 140][Math.min(3, Math.floor(k / (dur / 4)))];
          if (f.has('arc') && Math.random() < dt * 0.6) arcEvent(S);
        }
        if (k > 0 && !atSpeed) c.phT -= dt; // wait for rotation / anode
        if (k >= dur) {
          if (c.ph === 'warmup') {
            c.warmed = true; c.ph = 'idle'; c.spinUntil = t + 6;
            S.log(f.has('arc') ? `Warm-up complete — ${c.arcs} arc(s) during seasoning. Persistent arcing after seasoning suggests a gassy tube near end of life.` : 'Warm-up / seasoning complete — tube ready. Run air calibration next.', f.has('arc') ? 'warn' : 'ok');
            c.msg = 'Tube warm';
          } else {
            c.ph = 'idle'; c.spinUntil = t + 6;
            if (f.has('slip')) { c.cal = false; S.log('Air calibration FAILED: data transmission errors during acquisition — retry after checking the slip-ring link', 'bad'); c.msg = 'Calibration failed'; }
            else {
              c.gains.fill(0); c.cal = true; c.msg = 'Calibration valid';
              if (f.has('dead')) S.log(`Air calibration complete with WARNING: channel ${DEAD} out of tolerance (no signal change with kV)`, 'warn');
              else S.log('Air calibration complete — all channels within tolerance', 'ok');
            }
          }
        }
      } else if (c.ph === 'move') {
        const dz = sc.z0 - c.z;
        if (f.has('table')) {
          c.tableStall += dt; tableSpeed = -1;
          if (c.tableStall > 4) { c.tableStall = 0; S.alarm('table', 'med', 'TABLE MOTION TIMEOUT — LONGITUDINAL DRIVE'); abort(S, 'Table did not reach the start position (motor current but no encoder movement) — scan aborted', true); }
        } else {
          c.tableStall = 0; const step = Math.sign(dz) * Math.min(Math.abs(dz), 160 * dt); c.z += step; tableSpeed = Math.abs(step / dt);
          if (Math.abs(dz) < 0.5) {
            begin(S, 'breath');
            if (sc.proto === 'head') Sound.speak('Please keep your head still.'); else Sound.speak('Breathe in and hold your breath.');
          }
        }
      } else if (c.ph === 'breath') {
        if (c.phT > (sc.proto === 'head' ? 1.5 : 3.8) && atSpeed) { begin(S, 'expose'); c.prog = 0; c.rows = 0; c.nextArc = 0.15 + Math.random() * 0.25; S.log('X-ray ON'); }
      } else if (c.ph === 'expose') {
        if (!atSpeed) { abort(S, 'Rotation or anode speed lost during exposure — scan aborted', true); }
        else {
          c.xr = c.arcT <= 0; c.kvT = sc.kv;
          c.prog = Math.min(1, c.prog + dt / sc.time);
          const step = sc.len / sc.time * dt; c.z += step; tableSpeed = sc.len / sc.time;
          if (f.has('arc') && c.prog > c.nextArc) { arcEvent(S); c.nextArc = c.prog + 0.12 + Math.random() * 0.2; }
          const want = Math.floor(c.prog * NA);
          while (c.rows < want && c.ph === 'expose') { projRow(S, c.rows); c.rows++; }
          if (f.has('slip') && c.crc > 0) S.alarm('slip', 'med', 'DATA TRANSMISSION ERROR (slip-ring / DAS link)');
          if (c.arcs >= 3) { S.alarm('arc', 'high', 'TUBE ARC — SCAN ABORTED'); abort(S, `Generator aborted the scan after ${c.arcs} arcs (kV collapse). Partial data only.`, true); }
          else if (c.heat >= 100) { abort(S, 'Tube heat limit reached during exposure — scan aborted', true); }
          else if (c.rows >= NA) {
            c.ph = 'recon'; c.phT = 0; c.bpDone = 0; c.rec.fill(0); filterAll(S);
            if (sc.proto !== 'head') Sound.speak('You may breathe.');
            S.log(`Exposure complete (${sc.time.toFixed(1)} s). Reconstructing: ramp filter + back-projection of ${NA} views`, 'ok');
            if (f.has('slip')) S.log(`Data link reported ${c.crc} corrupted view(s) — expect streaks`, 'warn');
          }
        }
      } else if (c.ph === 'recon') {
        const want = Math.min(NA, Math.floor(c.phT / 2.4 * NA) + 1);
        if (want > c.bpDone) { while (c.bpDone < want) { bpAngle(S, c.bpDone); c.bpDone++; } paintRecon(S); }
        if (c.bpDone >= NA) { c.ph = 'idle'; c.spinUntil = t + 8; c.msg = 'Images ready'; S.log('Reconstruction complete — image sent to the viewer', 'ok'); Sound.beep(880, 0.1, { vol: 0.1 }); Sound.beep(1175, 0.12, { vol: 0.1, when: Sound.now + 0.12 }); }
      }
      if (c.ph === 'idle' && f.has('table') && !S.alarms.table) c.tableStall = 0;

      // ---- generator ----
      if (c.arcT > 0) c.arcT -= dt;
      const ma = c.ph === 'warmup' || c.ph === 'aircal' ? 100 : sc ? sc.ma : 0;
      if (c.xr) { c.heat = Math.min(100, c.heat + dt * ma * c.kvT / 24000 * 1.1 * (f.has('heat') ? 6 : 1)); }
      c.kvAct += ((c.xr ? c.kvT : c.arcT > 0 ? 8 : 0) - c.kvAct) * Math.min(1, dt * 25);
      c.maAct += ((c.xr ? ma : 0) - c.maAct) * Math.min(1, dt * 25);

      // ---- sound ----
      const r = c.rpm / 180;
      c.vWhoosh.set({ vol: r * 0.16 * (0.72 + 0.28 * Math.sin(c.ang)), freq: 160 + c.rpm * 6, glide: 0.02 });
      c.vHum.set({ vol: r * 0.05, pitch: 22 + c.rpm * 0.55 });
      c.vAnode.set({ vol: (c.anode / 9000) * 0.045, pitch: 25 + c.anode / 9000 * 150, freq: 300 + c.anode / 9000 * 2600, glide: 0.08 });
      c.vXr.set({ vol: c.xr ? 0.05 : 0, glide: 0.01 });
      c.vTable.set({ vol: tableSpeed < 0 ? 0.08 : tableSpeed > 0 ? 0.06 : 0, pitch: tableSpeed < 0 ? 38 : 40 + tableSpeed * 0.15, freq: tableSpeed < 0 ? 220 : 420 });
      c.vFan.set({ vol: f.has('fan') ? 0 : 0.03 });

      // ---- alarms ----
      const set = (cond, id, pr, text) => cond ? S.alarm(id, pr, text) : S.clear(id);
      set(f.has('cover'), 'cover', 'med', 'GANTRY COVER / DOOR INTERLOCK OPEN');
      set(c.heat > 85, 'heat', c.heat > 95 ? 'high' : 'med', 'TUBE HEAT HIGH — COOLING');
      set(c.gTemp > 40, 'gtemp', c.gTemp > 42 ? 'high' : 'med', 'GANTRY TEMPERATURE HIGH');

      // ---- display ----
      drawGantry(S);
      drawImages(S);
      const p = sc && busy ? sc : params(v);
      const cd = ctdi(p);
      S.num('ctdi', cd.toFixed(1)); S.num('dlp', Math.round(cd * p.len / 10));
      S.num('heat', Math.round(c.heat) + ' %');
      const hm = S.$('#ctHeatM'); if (hm) { const w = Math.round(c.heat) + '%'; if (hm.style.width !== w) hm.style.width = w; }
      S.num('anode', Math.round(c.anode / 10) * 10); S.num('grpm', Math.round(c.rpm)); S.num('table', Math.round(c.z) + ' mm');
      S.num('kvma', Math.round(c.kvAct) + ' / ' + Math.round(c.maAct)); S.num('gtemp', c.gTemp.toFixed(1) + ' °C');
      S.num('stime', c.ph === 'expose' ? ((1 - c.prog) * sc.time).toFixed(1) + ' s left' : scanTime(p).toFixed(1) + ' s');
      S.num('ctSt', PHASE_TXT[c.ph] + (c.ph === 'idle' ? (c.warmed ? ' · tube warm' : ' · tube cold') + (c.cal ? ' · cal OK' : ' · cal due') : ''));
      S.num('ctMsg', c.msg || '');
      const xe = S.$('#ctXr'); if (xe && xe.classList.contains('on') !== c.xr) xe.classList.toggle('on', c.xr);
    },

    stop(S) {
      const c = S.ct; if (!c) return;
      ['vWhoosh', 'vHum', 'vAnode', 'vXr', 'vTable', 'vFan'].forEach(k => { if (c[k]) { c[k].stop(); c[k] = null; } });
      c.ph = 'idle'; c.xr = false;
    }
  });

  function arcEvent(S) {
    const c = S.ct; c.arcs++; c.arcT = 0.12;
    Sound.burst(0.09, { filter: 'highpass', freq: 2500, vol: 0.35 }); Sound.burst(0.15, { filter: 'lowpass', freq: 200, vol: 0.25 });
    S.log(`Tube arc #${c.arcs}: kV collapsed, exposure interrupted for ~${Math.round(c.arcT * 1000)} ms`, 'warn');
  }

  /* ---------- drawing ---------- */
  function drawGantry(S) {
    const cv = S.$('#ctGan'); if (!cv) return;
    const { g, w, h } = fit(cv), c = S.ct, proto = c.scan && c.ph !== 'idle' ? c.scan.proto : S.v.proto;
    g.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.4, R = Math.min(w * 0.36, h * 0.33);
    // housing and bore
    g.fillStyle = '#0b1526'; g.beginPath(); g.arc(cx, cy, R * 1.22, 0, 7); g.fill();
    g.strokeStyle = '#1f3558'; g.lineWidth = 2; g.stroke();
    // rotating frame
    const ca = Math.cos(c.ang), sa = Math.sin(c.ang), rr = R * 1.02;
    const tx = cx + sa * rr, ty = cy - ca * rr, fan = 0.46;
    if (c.xr) {
      g.fillStyle = 'rgba(245,184,74,.22)'; g.beginPath(); g.moveTo(tx, ty);
      for (let k = -1; k <= 1.001; k += 0.1) { const a = c.ang + Math.PI + k * fan; const D = 2 * rr * Math.cos(k * fan); g.lineTo(tx + Math.sin(a) * D, ty - Math.cos(a) * D); }
      g.closePath(); g.fill();
    } else {
      g.strokeStyle = 'rgba(245,184,74,.18)'; g.setLineDash([4, 5]); g.beginPath();
      [-1, 1].forEach(k => { const a = c.ang + Math.PI + k * fan, D = 2 * rr * Math.cos(fan); g.moveTo(tx, ty); g.lineTo(tx + Math.sin(a) * D, ty - Math.cos(a) * D); });
      g.stroke(); g.setLineDash([]);
    }
    // detector arc (centred on focal spot)
    g.strokeStyle = '#4dd0ff'; g.lineWidth = 7; g.beginPath();
    for (let k = -1; k <= 1.001; k += 0.1) { const a = c.ang + Math.PI + k * fan, D = 2 * rr * Math.cos(k * fan) + 4; const x = tx + Math.sin(a) * D, y = ty - Math.cos(a) * D; k === -1 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    if (S.fault.has('dead')) { const a = c.ang + Math.PI + (DEAD / N * 2 - 1) * fan * 0.9, D = 2 * rr * Math.cos(fan * 0.3) + 4; g.fillStyle = '#ff5c5c'; g.fillRect(tx + Math.sin(a) * D - 2, ty - Math.cos(a) * D - 2, 4, 4); }
    // tube
    g.save(); g.translate(tx, ty); g.rotate(c.ang);
    g.fillStyle = c.xr ? '#f5b84a' : '#c3a6ff'; g.fillRect(-R * 0.16, -R * 0.12, R * 0.32, R * 0.16);
    g.fillStyle = '#02060d'; g.font = `700 ${Math.max(9, R * 0.08)}px Inter, sans-serif`; g.textAlign = 'center'; g.fillText('TUBE', 0, -R * 0.015);
    g.restore();
    // bore cover
    g.strokeStyle = '#2b4a78'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R * 0.72, 0, 7); g.stroke();
    // patient + table
    const head = proto === 'head', pa = head ? R * 0.27 : R * 0.5, pb = head ? R * 0.33 : R * 0.36;
    g.fillStyle = '#1d3f73'; g.beginPath(); g.ellipse(cx, cy, pa, pb, 0, 0, 7); g.fill();
    if (head) { g.strokeStyle = '#8ea3c4'; g.lineWidth = 3; g.beginPath(); g.ellipse(cx, cy, pa * 0.92, pb * 0.94, 0, 0, 7); g.stroke(); }
    else { g.fillStyle = '#0b1526'; if (proto === 'chest') [-1, 1].forEach(s => { g.beginPath(); g.ellipse(cx + s * pa * 0.45, cy - pb * 0.05, pa * 0.3, pb * 0.65, 0, 0, 7); g.fill(); }); g.fillStyle = '#8ea3c4'; g.beginPath(); g.arc(cx, cy + pb * 0.68, pb * 0.14, 0, 7); g.fill(); }
    g.fillStyle = '#5a6f92'; g.fillRect(cx - R * 0.55, cy + pb + 2, R * 1.1, R * 0.07);
    g.fillStyle = '#8ea3c4'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'left';
    g.fillText(`${Math.round(c.rpm)} rpm · ${(c.rpm > 1 ? 60 / c.rpm : 0).toFixed(2)} s/rot`, 8, 16);
    // side view: gantry + table travel
    const y0 = h * 0.86, gx = w * 0.62, scale = (w * 0.5) / 700;
    g.fillStyle = '#0b1526'; g.fillRect(gx - 10, y0 - 34, 20, 52); g.strokeStyle = '#1f3558'; g.strokeRect(gx - 10, y0 - 34, 20, 52);
    g.fillStyle = '#3a4f72'; g.fillRect(w * 0.06, y0 + 6, w * 0.4, 8);              // table base
    const topR = gx - 40 + c.z * scale;                                            // table top front end
    g.fillStyle = '#8ea3c4'; g.fillRect(topR - w * 0.5, y0, w * 0.5, 5);
    g.fillStyle = '#1d3f73'; g.fillRect(topR - w * 0.34, y0 - 9, w * 0.3, 9);       // patient
    if (c.scan && c.scan.z0) {                                                      // planned range in the scan plane
      const len = c.scan.len * scale; g.fillStyle = 'rgba(77,208,255,.15)'; g.fillRect(gx - len, y0 - 20, len, 4);
      if (c.ph === 'expose' || c.ph === 'recon' || (c.ph === 'idle' && c.rows)) { g.fillStyle = 'rgba(245,184,74,.7)'; g.fillRect(gx - len * (c.ph === 'expose' ? c.prog : c.rows / NA), y0 - 20, len * (c.ph === 'expose' ? c.prog : c.rows / NA), 4); }
    }
    if (c.xr) { g.fillStyle = '#f5b84a'; g.fillRect(gx - 1, y0 - 30, 2, 40); }
    g.fillStyle = '#8ea3c4'; g.fillText(`Table ${Math.round(c.z)} mm`, w * 0.06, y0 - 6);
  }

  function drawImages(S) {
    const cv = S.$('#ctImg'); if (!cv) return;
    const c = S.ct, { g, w, h, resized } = fit(cv);
    if (!c.dirty && !resized) return;
    c.dirty = false;
    if (c.sinoDirty) { c.sinoCtx.putImageData(c.sinoImg, 0, 0); c.sinoDirty = false; }
    g.fillStyle = '#02060d'; g.fillRect(0, 0, w, h);
    const pad = 8, top = 24, sw = Math.min(w * 0.36, (h - top - pad) * N / NA), sh = sw * NA / N;
    const rs = Math.min(w - sw - pad * 3, h - top - pad);
    g.imageSmoothingEnabled = true;
    g.drawImage(c.sinoC, pad, top, sw, sh);
    g.drawImage(c.recC, pad * 2 + sw, top, rs, rs);
    g.strokeStyle = '#1f3558'; g.lineWidth = 1; g.strokeRect(pad + .5, top + .5, sw, sh); g.strokeRect(pad * 2 + sw + .5, top + .5, rs, rs);
    if (c.ph === 'expose' && c.rows < NA) { g.fillStyle = '#f5b84a'; g.fillRect(pad, top + sh * c.rows / NA, sw, 2); }
    g.fillStyle = '#8ea3c4'; g.font = '600 11px Inter, sans-serif'; g.textAlign = 'left';
    g.fillText(`Sinogram  ${c.rows}/${NA} views`, pad, 15);
    const [W, L] = WIN[S.v.win] || WIN.soft;
    g.fillText(c.ph === 'recon' ? `Back-projecting ${c.bpDone}/${NA}` : c.bpDone ? `Slice · ${c.scan ? c.scan.slice : '-'} mm · W${W} L${L}` : 'Reconstruction', pad * 2 + sw, 15);
    if (!c.bpDone && !c.rows) { g.fillStyle = '#5a6f92'; g.textAlign = 'center'; g.fillText('No data — start a scan', pad * 2 + sw + rs / 2, top + rs / 2); }
    if (c.ph === 'recon') { g.fillStyle = 'rgba(77,208,255,.8)'; g.fillRect(pad * 2 + sw, top + rs - 3, rs * c.bpDone / NA, 3); }
  }
})();

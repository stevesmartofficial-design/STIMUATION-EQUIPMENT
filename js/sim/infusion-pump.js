/* Live simulator — Volumetric (peristaltic) infusion pump (generic, manufacturer-neutral).
   Real-time rate / VTBI / volume-infused counter with a ×60 training speed-up, animated
   drip chamber and peristaltic fingers, downstream pressure trend, stepper-motor ticks
   proportional to flow, key beeps, occlusion with post-release bolus, air-in-line,
   door / anti-free-flow clamp, KVO and battery faults. */
(function () {
  const { W, Sound } = Sim;
  const CSET = 0.004;        // set + sensor compliance (mL/mmHg) — sets time-to-occlusion-alarm (training value)
  const BOLUS_RATE = 600;    // mL/h
  const FREE_RATE = 1500;    // gravity free flow with no clamp (mL/h)
  const DROPS_PER_ML = 20;   // standard macro-drip set
  const BAG = 1000;          // container volume (mL)
  const P_VEN = 8;           // venous back-pressure (mmHg)
  const TICKS_PER_ML = 144;  // audible motor ticks per mL (≈4/s at 100 mL/h)
  const MAX_TPS = 30;        // tick-rate cap so the speed-up stays listenable
  const AIR_ML = 0.3;        // volume that carries a bubble from the chamber to the air sensor
  const MAX_P = 900;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const p0 = rate => P_VEN + rate * 0.06;   // line + cannula resistance
  const keyBeep = () => Sound.beep(2100, 0.04, { vol: 0.08, type: 'square', lp: 3500 });
  const errBeep = () => { Sound.beep(400, 0.12, { vol: 0.14, type: 'square', lp: 1500 }); Sound.beep(300, 0.16, { vol: 0.14, type: 'square', lp: 1500, when: Sound.now + 0.16 }); };
  const hhmm = h => { if (!isFinite(h) || h < 0) return '--'; const m = Math.round(h * 60); return Math.floor(m / 60) + ' h ' + String(m % 60).padStart(2, '0'); };

  function setRun(S, on) {
    S.run = on; if (!on) S.bolusLeft = 0;
    const b = S.$('[data-act="start"]'); if (b) b.textContent = on ? '■ Stop' : '▶ Start';
  }
  function halt(S, id, pr, text) {
    if (S.run) { setRun(S, false); S.log('Infusion stopped by alarm: ' + text, 'bad'); }
    S.alarm(id, pr, text);
  }
  function fit(c) {
    const dpr = window.devicePixelRatio || 1, w = Math.max(50, c.clientWidth), h = Math.max(30, c.clientHeight);
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
  }

  /* Pump mechanism drawing: container, drip chamber with drop sensor, peristaltic fingers,
     upstream / downstream / air sensors, line to patient. */
  function draw(S, st) {
    const c = S.$('#ipC'); if (!c) return;
    const { g, w, h } = fit(c);
    g.clearRect(0, 0, w, h);
    g.font = '600 10px Inter, sans-serif'; g.lineCap = 'round';
    const lim = +S.v.occl;
    // container
    const bx = 16, bw = Math.min(64, w * 0.12), by = 14, bh = h * 0.3, cx = bx + bw / 2;
    const lvl = clamp(S.bag / BAG, 0, 1);
    g.fillStyle = 'rgba(77,208,255,.28)'; g.fillRect(bx, by + bh * (1 - lvl), bw, bh * lvl);
    g.strokeStyle = '#8ea3c4'; g.lineWidth = 1.5; g.strokeRect(bx, by, bw, bh);
    g.fillStyle = '#8ea3c4'; g.fillText(Math.round(S.bag) + ' mL', bx + 4, by + 12);
    // drip chamber
    const cw = 24, cy = by + bh + 14, ch = h * 0.27, cl = cx - cw / 2;
    g.strokeStyle = '#4dd0ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, by + bh); g.lineTo(cx, cy); g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = '#8ea3c4'; g.strokeRect(cl, cy, cw, ch);
    const pool = S.bag > 0 || S.poolLeft > 0 ? 0.3 : 0.05;
    g.fillStyle = 'rgba(77,208,255,.35)'; g.fillRect(cl + 1, cy + ch * (1 - pool), cw - 2, ch * pool - 1);
    g.fillStyle = '#4dd0ff';
    if (st.stream) { g.fillRect(cx - 1, cy + 4, 2.5, ch * 0.66); }
    else S.drops.forEach(d => { g.beginPath(); g.arc(cx, cy + 6 + d.y * ch * 0.62, 2.6, 0, Math.PI * 2); g.fill(); });
    // drop sensor
    g.fillStyle = st.dropSeen ? '#36d39a' : '#3a4c6b'; g.fillRect(cl - 9, cy + ch * 0.35, 6, 10); g.fillRect(cl + cw + 3, cy + ch * 0.35, 6, 10);
    g.fillStyle = '#8ea3c4'; g.fillText('drop sensor', cl + cw + 12, cy + ch * 0.35 + 9);
    if (st.free) { g.fillStyle = '#ff6b6b'; g.font = '700 11px Inter, sans-serif'; g.fillText('FREE FLOW', cl + cw + 12, cy + ch * 0.35 + 24); g.font = '600 10px Inter, sans-serif'; }
    // tubing path
    const ty = Math.min(h - 26, cy + ch + 34), px = Math.max(cx + 60, w * 0.28), pw = Math.min(w * 0.42, 340), pe = px + pw;
    const upX = px + 16, fx0 = px + 36, fx1 = pe - 56, dnX = pe - 38, airX = pe - 18, endX = w - 18;
    const frac = clamp(S.p / lim, 0, 1.2);
    const dnCol = `rgb(${Math.round(77 + 178 * Math.min(1, frac))},${Math.round(208 - 130 * Math.min(1, frac))},${Math.round(255 - 160 * Math.min(1, frac))})`;
    g.lineWidth = 6; g.strokeStyle = S.bag > 0 && !S.fault.has('upOcc') ? '#2f8fb3' : '#3a4c6b';
    g.beginPath(); g.moveTo(cx, cy + ch); g.lineTo(cx, ty); g.lineTo(fx1, ty); g.stroke();
    g.strokeStyle = dnCol; g.beginPath(); g.moveTo(fx1, ty); g.lineTo(endX, ty); g.stroke();
    g.fillStyle = '#8ea3c4'; g.fillText('→ patient', endX - 52, ty + 20);
    // upstream occlusion marker
    if (S.fault.has('upOcc')) { g.strokeStyle = '#ff6b6b'; g.lineWidth = 2.5; const x = (cx + upX) / 2; g.beginPath(); g.moveTo(x - 6, ty - 8); g.lineTo(x + 6, ty + 8); g.moveTo(x + 6, ty - 8); g.lineTo(x - 6, ty + 8); g.stroke(); g.fillStyle = '#ff6b6b'; g.fillText('closed', x - 14, ty - 12); }
    // downstream occlusion marker (clamp / kink)
    if (st.occ) { const x = Math.min(endX - 20, pe + (endX - pe) * 0.5); g.strokeStyle = '#ff6b6b'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, ty - 11); g.lineTo(x, ty + 11); g.moveTo(x + 5, ty - 11); g.lineTo(x + 5, ty + 11); g.stroke(); g.fillStyle = '#ff6b6b'; g.fillText('occluded', x - 18, ty - 15); }
    // pump housing
    g.lineWidth = 1.5; g.fillStyle = 'rgba(11,21,38,.85)';
    g.fillRect(px, ty - 58, pw, 76);
    g.strokeStyle = st.door ? '#ff6b6b' : '#2a4470'; if (st.door) g.setLineDash([6, 4]);
    g.strokeRect(px, ty - 58, pw, 76); g.setLineDash([]);
    g.fillStyle = st.door ? '#ff6b6b' : '#8ea3c4'; g.fillText(st.door ? 'DOOR OPEN' + (st.clampOk ? ' — clamp closed' : ' — NO CLAMP') : 'peristaltic mechanism', px + 6, ty - 46);
    // re-draw tube through the housing
    g.lineWidth = 6; g.strokeStyle = S.bag > 0 ? '#2f8fb3' : '#3a4c6b'; g.beginPath(); g.moveTo(px, ty); g.lineTo(fx1, ty); g.stroke();
    g.strokeStyle = dnCol; g.beginPath(); g.moveTo(fx1, ty); g.lineTo(pe, ty); g.stroke();
    // fingers
    const N = 9, sp = (fx1 - fx0) / N;
    for (let i = 0; i < N; i++) {
      const press = st.door ? 0 : (Math.sin(S.phase - i * 0.75) + 1) / 2;
      const x = fx0 + i * sp + 2, bot = ty - 12 + press * 9;
      g.fillStyle = press > 0.8 && !st.door ? '#c3a6ff' : '#5a6f96';
      g.fillRect(x, ty - 36, Math.max(3, sp - 4), bot - (ty - 36));
    }
    // sensors
    const sens = (x, label, col) => { g.fillStyle = col; g.fillRect(x - 5, ty + 6, 10, 9); g.fillStyle = '#8ea3c4'; g.fillText(label, x - 6, ty + 28); };
    sens(upX, 'U', S.alarms.up ? '#ff6b6b' : '#36d39a');
    sens(dnX, 'D', frac > 1 ? '#ff6b6b' : frac > 0.6 ? '#f5b84a' : '#36d39a');
    sens(airX, 'AIL', S.alarms.air ? '#ff6b6b' : '#36d39a');
    // air bubble
    if (S.air != null) {
      const x = cx + (airX - cx) * clamp(S.air, 0, 1), y = S.air <= 0.02 ? cy + ch : ty;
      g.fillStyle = '#ffffff'; g.beginPath(); g.ellipse(x, y, 7, 3, 0, 0, Math.PI * 2); g.fill();
    }
    // status badge
    g.font = '700 12px Inter, sans-serif'; g.textAlign = 'right';
    g.fillStyle = st.col; g.fillText(st.label, w - 12, 18); g.textAlign = 'left';
  }

  Sim.register('infusionPump', {
    title: 'Volumetric infusion pump — live',
    intro: 'Set the rate and VTBI, press Start, and watch the drip chamber, the peristaltic fingers and the downstream pressure. Turn on ×60 time so an hour passes in a minute. Inject occlusion, air, door and power faults. Alarm levels and acceptance limits come from the manufacturer and hospital protocol.',
    stage: () => `<style>
      .ipx-c{display:block;width:100%;height:250px;border-bottom:1px solid #0d1830}
      .ipx-p{display:block;width:100%;height:120px}
      .ipx-st{padding:6px 12px;font:600 .74rem var(--mono);color:#8ea3c4;border-bottom:1px solid #0d1830;display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}
      .ipx-st b{color:#e6eefb}
      @media (max-width:720px){.ipx-c{height:220px}.ipx-p{height:100px}}
    </style>
    <div class="ipx">
      <div class="ipx-st"><b data-num="state">STOPPED</b><span data-num="clock"></span></div>
      <canvas class="ipx-c" id="ipC"></canvas>
      <canvas class="ipx-p" id="ipP"></canvas>
      <div class="sim-readout">
        <div style="--c:#36d39a"><small>Rate mL/h</small><b data-num="rate">--</b></div>
        <div style="--c:#4dd0ff"><small>VTBI mL</small><b data-num="vtbi">--</b></div>
        <div style="--c:#4dd0ff"><small>Volume infused mL</small><b data-num="vi">0.0</b></div>
        <div style="--c:#c3a6ff"><small>Time left</small><b data-num="left" style="font-size:1.1rem">--</b></div>
        <div style="--c:#ff8fa3"><small>Downstream mmHg</small><b data-num="p">--</b><div class="sim-meter" style="--c:#ff8fa3"><i id="ipPm" style="width:0%"></i></div></div>
        <div style="--c:#ff6b6b"><small>Uncontrolled mL</small><b data-num="free">0.0</b></div>
        <div style="--c:#8ea3c4"><small>Power</small><b data-num="pwr" style="font-size:1.1rem">AC</b></div>
      </div>
    </div>`,
    controls: [
      { id: 'rate', label: 'Rate', type: 'range', min: 1, max: 600, value: 100, unit: 'mL/h' },
      { id: 'vtbi', label: 'VTBI', type: 'range', min: 10, max: 1000, step: 10, value: 250, unit: 'mL' },
      { id: 'occl', label: 'Downstream occlusion alarm level', type: 'select', options: [['300', 'Low (≈300 mmHg)'], ['500', 'Medium (≈500 mmHg)'], ['750', 'High (≈750 mmHg)']], value: '500' },
      { id: 'kvo', label: 'KVO rate', type: 'range', min: 0.5, max: 5, step: 0.5, value: 1, unit: 'mL/h' },
      { id: 'bolus', label: 'Bolus volume', type: 'range', min: 1, max: 20, value: 5, unit: 'mL' },
      { id: 'fast', label: 'Time ×60 (training speed-up)', type: 'toggle', value: false },
      { id: 'clamp', label: 'Anti-free-flow clamp working', type: 'toggle', value: true }
    ],
    actions: [{ id: 'start', label: '▶ Start', primary: true }, { id: 'bolus', label: '⇡ Bolus' }, { id: 'clear', label: '✂ Clear occlusion' }, { id: 'silence', label: '🔕 Silence' }],
    faults: [
      { id: 'downOcc', label: 'Downstream occlusion', explain: 'The line to the patient is blocked (closed clamp, kink, clotted cannula). The pump keeps pushing, so the downstream pressure builds in the set until it reaches the alarm level, which is slow at low rates. The pressurised tubing holds extra volume. Releasing the occlusion without relieving that pressure gives the patient an unintended bolus.', check: 'At the bedside, clear the cause with the line clamped and relieve the pressure first. On the bench, use an infusion-device analyser to measure the occlusion alarm pressure and the time to alarm at the protocol rates, and to measure the post-occlusion bolus volume. Compare all of these with the manufacturer’s specification.' },
      { id: 'upOcc', label: 'Upstream occlusion', explain: 'The line between the container and the pump is closed (roller clamp shut, kinked spike line). No drops fall and the upstream sensor sees a vacuum, so the pump stops with "UPSTREAM OCCLUSION". The volume counter has counted fluid that was never delivered.', check: 'Open the roller clamp and check the spike, vent and line. Then test the upstream sensor with the manufacturer’s service procedure or a test set.' },
      { id: 'air', label: 'Air-in-line', explain: 'A bubble has been drawn into the set. It moves with the flow through the fingers until the ultrasonic air-in-line detector sees it, and the pump stops with a high-priority alarm.', check: 'Clamp the line and remove the air per hospital protocol, and check the priming and the container. On the bench, check the detector’s sensitivity with calibrated bubbles or a test set per the manufacturer, and clean the sensor faces.' },
      { id: 'door', label: 'Door open', explain: 'The door or latch is open, so the set is no longer held against the fingers. The pump stops and alarms. With a working anti-free-flow clamp, nothing flows.', check: 'Check the door latch and hinge and the door-sensor switch or magnet. Confirm that an open door stops the pump and that the clamp closes the set.' },
      { id: 'freeflow', label: 'Door opened — anti-free-flow clamp failed', explain: 'The door is open and the set’s anti-free-flow clamp is missing or broken. Gravity drives fluid into the patient uncontrolled: drops turn into a stream, the counter does not see it, and the free-flow alarm comes on. This is one of the most dangerous pump failures.', check: 'Clamp the line immediately and assess the patient. Quarantine the set and the pump and report it per hospital incident protocol. Check the clamp mechanism and confirm the set is the approved type for this pump.' },
      { id: 'empty', label: 'Empty container', explain: 'The container has run dry. The drop sensor sees no drops and the pump stops with "NO FLOW / CONTAINER EMPTY". If it keeps running, air enters the line.', check: 'Replace the container and re-prime per protocol. Test the drop sensor with a drip chamber at a known rate, and clean its window.' },
      { id: 'vtbiDone', label: 'VTBI almost complete (→ KVO)', explain: 'The programmed volume has been infused. The pump alarms "VTBI COMPLETE" and drops to the KVO rate to keep the cannula open. This is normal behaviour, but it often confuses users.', check: 'Confirm the KVO rate set in the device configuration matches the hospital drug-library policy. On the bench, verify the volume accuracy over a full VTBI with an analyser.' },
      { id: 'battery', label: 'Mains lost + low battery', explain: 'The pump is on battery with little charge left. "AC POWER LOST" is followed by escalating low-battery alarms, then the pump stops.', check: 'Check the mains lead, the docking/rack contacts and the fuse. Run a battery capacity test per manufacturer / hospital protocol and replace an aged battery.' }
    ],

    init(S) {
      S.pr = S.strip('#ipP', { color: '#ff8fa3', min: 0, max: MAX_P, label: 'Downstream pressure', unit: 'mmHg', speed: 25 });
      setRun(S, false);
      S.vi = 0; S.p = P_VEN; S.pPrev = P_VEN; S.bolusLeft = 0; S.kvo = false; S.dead = false;
      S.bag = S.fault.has('empty') ? 0 : BAG; S.poolLeft = 1; S.free = 0; S.phase = 0; S.drops = []; S.dropAcc = 0; S.tickAcc = 0;
      S.air = S.fault.has('air') ? 0 : null; S.occFixed = false; S.releasing = null; S.upMiss = 0; S.dropMiss = 0; S.simT = 0; S.occT = 0;
      S.batt = S.fault.has('battery') ? Math.min(S.batt != null ? S.batt : 100, 30) : 100;
    },

    onAction(S, id) {
      const v = S.v, f = S.fault;
      keyBeep();
      if (id === 'silence') { S.silencedUntil = S.t + 120; S.renderAlarms && S.renderAlarms(); S.log('Alarm audio silenced for 2 min — the cause is still present until fixed'); return; }
      if (id === 'start') {
        if (S.run) { setRun(S, false); S.clear('vtbi'); S.log('Infusion stopped by the user'); return; }
        if (S.dead) { errBeep(); return S.log('Cannot start — battery depleted', 'bad'); }
        if (f.has('door') || f.has('freeflow')) { errBeep(); return S.log('Cannot start — close the door first', 'warn'); }
        if (S.alarms.air) { errBeep(); return S.log('Cannot start — air in line. Remove the air and re-prime (clear the fault) first', 'warn'); }
        S.clear('up'); S.clear('empty'); S.clear('occl'); S.upMiss = 0; S.dropMiss = 0;
        if (S.vi >= v.vtbi) S.kvo = true;
        setRun(S, true);
        S.log(`Infusion started at ${S.kvo ? v.kvo + ' mL/h (KVO)' : v.rate + ' mL/h'}, VTBI ${v.vtbi} mL`, 'ok');
        return;
      }
      if (id === 'bolus') {
        if (!S.run) { errBeep(); return S.log('Start the infusion before giving a bolus', 'warn'); }
        S.bolusLeft = v.bolus; S.log(`Bolus ${v.bolus} mL at ${BOLUS_RATE} mL/h`); Sound.beep(1568, 0.06, { vol: 0.1, when: Sound.now + 0.08 });
        return;
      }
      if (id === 'clear') {
        if (!(f.has('downOcc') && !S.occFixed)) return S.log('No downstream occlusion to clear');
        S.occFixed = true;
        const stored = Math.max(0, CSET * (S.p - P_VEN));
        if (stored > 0.05) {
          S.releasing = { vol: 0, start: stored };
          S.log(`Occlusion released with the line at ${Math.round(S.p)} mmHg — ≈${stored.toFixed(2)} mL stored in the set will rush into the patient as a bolus. Best practice: clamp the line and relieve the pressure before releasing (or let the pump back off), per hospital protocol.`, 'warn');
          S.alarm('bolusW', 'low', 'CHECK PATIENT — POST-OCCLUSION BOLUS'); S.bolusWUntil = S.t + 20;
        } else S.log('Occlusion cleared (line was not pressurised)', 'ok');
      }
    },
    onControl(S, id, val) {
      keyBeep();
      if (id === 'vtbi' && S.kvo && S.vi < val) { S.kvo = false; S.clear('vtbi'); S.log('VTBI raised above volume infused — back to the programmed rate'); }
      if (id === 'fast') S.log(val ? 'Training speed-up ON: 1 s real = 1 min simulated' : 'Real-time');
    },
    onFault(S, id, on) {
      if (id === 'downOcc') { if (on) { S.occFixed = false; S.occT = 0; } else if (S.p > p0(0) + 20 && !S.occFixed) S.releasing = { vol: 0, start: CSET * (S.p - P_VEN) }; }
      if (id === 'air') { if (on) S.air = 0; else if (!(S.bag <= 0)) { S.air = null; S.clear && S.clear('air'); } }
      if (id === 'empty') { if (on) S.bag = 0; else { S.bag = BAG; if (!S.fault.has('air')) S.air = null; S.clear && (S.clear('empty'), S.clear('air')); } }
      if (id === 'upOcc' && !on) S.clear && S.clear('up');
      if (id === 'battery') { S.batt = on ? Math.min(S.batt != null ? S.batt : 100, 30) : 100; if (!on) { S.dead = false; S.clear && S.clear('dead'); } }
      if (id === 'vtbiDone' && on) {
        if (S.v.vtbi - (S.vi || 0) > 0.2) S.vi = S.v.vtbi - 0.2;
        S.kvo = false; S.clear && S.clear('vtbi');
      }
      if (on && S.mystery && S.on && !S.run && !S.dead) { setRun(S, true); S.log('Infusion started for the mystery-fault exercise'); }
    },

    tick(S, dt, t) {
      const v = S.v, f = S.fault, k = v.fast ? 60 : 1, sdt = dt * k;
      S.simT += sdt;
      // ---- power ----
      if (f.has('battery') && !S.dead) {
        S.batt = Math.max(0, S.batt - dt * 0.35);
        if (S.batt <= 0) { S.dead = true; halt(S, 'dead', 'high', 'BATTERY DEPLETED — INFUSION STOPPED'); }
      }
      // ---- conditions ----
      const door = f.has('door') || f.has('freeflow'), clampOk = v.clamp && !f.has('freeflow');
      const occ = f.has('downOcc') && !S.occFixed;
      const source = !f.has('upOcc') && S.bag > 0;
      if (door && S.run) halt(S, 'door', 'high', 'DOOR OPEN');
      const rate = S.run ? (S.bolusLeft > 0 ? BOLUS_RATE : S.kvo ? v.kvo : v.rate) : 0;
      const dVol = rate / 3600 * sdt;    // mL moved by the fingers this frame

      // ---- pumping ----
      if (S.run) {
        S.vi += dVol; S.phase += dVol / 0.25 * Math.PI * 2;
        if (S.bolusLeft > 0) { S.bolusLeft -= dVol; if (S.bolusLeft <= 0) { S.bolusLeft = 0; S.log('Bolus complete'); Sound.beep(1568, 0.08, { vol: 0.1 }); } }
        if (!S.kvo && S.vi >= v.vtbi) { S.kvo = true; S.bolusLeft = 0; S.alarm('vtbi', 'med', 'VTBI COMPLETE — KVO'); S.log(`VTBI reached (${v.vtbi} mL) — continuing at KVO ${v.kvo} mL/h`, 'warn'); }
        // stepper ticks, spread evenly through the frame
        const tps = Math.min(MAX_TPS, rate * k / 3600 * TICKS_PER_ML);
        S.tickAcc += tps * dt; let j = 0;
        while (S.tickAcc >= 1) { S.tickAcc -= 1; Sound.burst(0.012, { freq: 3200, q: 5, vol: 0.06, when: Sound.now + j / Math.max(1, tps) }); j++; }
        // upstream
        if (!source) {
          if (f.has('upOcc')) { S.upMiss += dVol; if (S.upMiss > 0.05) halt(S, 'up', 'high', 'UPSTREAM OCCLUSION'); }
          else { S.dropMiss += dVol * DROPS_PER_ML; if (S.air == null) S.air = 0; if (S.dropMiss > 3) halt(S, 'empty', 'high', 'NO FLOW — CONTAINER EMPTY?'); }
        } else { S.upMiss = 0; S.dropMiss = 0; }
        // air bubble travels with the fluid
        if (S.air != null && S.air < 1) { S.air += dVol / AIR_ML; if (S.air >= 1) { S.air = 1; halt(S, 'air', 'high', 'AIR IN LINE'); } }
      }
      const pumpedIn = S.run && source ? dVol : 0;
      const free = door && !clampOk && source ? FREE_RATE / 3600 * sdt : 0;
      S.free += free; S.bag = Math.max(0, S.bag - pumpedIn - free);
      if (S.bag <= 0 && !f.has('empty') && S.run && !S.alarms.empty) S.log('Container ran dry', 'warn');

      // ---- downstream pressure ----
      S.pPrev = S.p;
      if (occ) {
        if (S.run) { S.p = Math.min(MAX_P + 100, S.p + dVol / CSET); S.occT += sdt; }
        if (S.p >= +v.occl && !S.alarms.occl) {
          halt(S, 'occl', 'high', 'DOWNSTREAM OCCLUSION');
          S.log(`Downstream pressure reached the ${v.occl} mmHg alarm level after ${Math.round(S.occT)} s (simulated) at ${v.rate} mL/h — ≈${(CSET * (S.p - P_VEN)).toFixed(2)} mL is stored in the pressurised set`, 'bad');
        }
      } else {
        const pz = free ? 30 : S.run ? p0(rate) : P_VEN, before = S.p;
        S.p += (pz - S.p) * Math.min(1, sdt / 3);
        if (S.releasing) {
          S.releasing.vol += Math.max(0, before - S.p) * CSET;
          if (Math.abs(S.p - pz) < 3) { S.log(`Post-occlusion bolus ≈ ${S.releasing.vol.toFixed(2)} mL delivered to the patient`, 'warn'); S.releasing = null; }
        }
        if (S.alarms.occl && S.p < +v.occl * 0.5) S.clear('occl');
      }
      if (S.alarms.bolusW && !S.releasing && t > S.bolusWUntil) S.clear('bolusW');

      // ---- drops ----
      const upFlow = (S.run && source ? rate : 0) + (free ? FREE_RATE : 0);   // mL/h simulated
      const dps = upFlow * k / 3600 * DROPS_PER_ML;
      const stream = dps > 10;
      if (!stream) { S.dropAcc += dps * dt; while (S.dropAcc >= 1 && S.drops.length < 20) { S.dropAcc -= 1; S.drops.push({ y: 0 }); } }
      else { S.drops = []; S.dropAcc = 0; }
      S.drops.forEach(d => d.y += dt * 4); S.drops = S.drops.filter(d => d.y < 1);
      const dropSeen = stream || S.drops.some(d => d.y > 0.3 && d.y < 0.6);

      // ---- trend + mechanism ----
      const pa = S.pPrev, pb = S.p, t0 = t - dt;
      S.pr.advance(dt, t, tt => pa + (pb - pa) * clamp((tt - t0) / dt, 0, 1) + W.noise(1.5));
      const lim = +v.occl, s = S.pr;
      if (s.g && s.h) { const y = s.h - 6 - lim / MAX_P * (s.h - 12); s.g.strokeStyle = 'rgba(255,107,107,.7)'; s.g.setLineDash([5, 4]); s.g.lineWidth = 1; s.g.beginPath(); s.g.moveTo(0, y); s.g.lineTo(s.w, y); s.g.stroke(); s.g.setLineDash([]); s.g.fillStyle = 'rgba(255,107,107,.9)'; s.g.font = '600 10px Inter, sans-serif'; s.g.fillText('alarm level ' + lim, s.w - 96, y - 4); }
      const state = S.dead ? ['NO POWER', '#ff6b6b'] : door ? ['DOOR OPEN', '#ff6b6b'] : !S.run ? ['STOPPED', '#f5b84a'] : S.bolusLeft > 0 ? ['BOLUS', '#c3a6ff'] : S.kvo ? ['KVO', '#f5b84a'] : ['RUNNING', '#36d39a'];
      draw(S, { stream, dropSeen, free: !!free, occ, door, clampOk, label: state[0], col: state[1] });

      // ---- numerics ----
      S.num('state', state[0] + (S.run ? ` · ${rate} mL/h` : ''));
      S.num('clock', `${v.fast ? 'Time ×60' : 'Real time'} · simulated ${hhmm(S.simT / 3600)}`);
      S.num('rate', S.run && S.bolusLeft > 0 ? BOLUS_RATE : S.kvo ? v.kvo : v.rate);
      S.num('vtbi', v.vtbi); S.num('vi', S.vi.toFixed(1));
      S.num('left', S.kvo ? 'KVO' : hhmm((v.vtbi - S.vi) / v.rate));
      S.num('p', Math.round(S.p)); S.num('free', S.free.toFixed(1));
      const pm = S.$('#ipPm'); if (pm) pm.style.width = clamp(S.p / lim * 100, 0, 100) + '%';
      S.num('pwr', f.has('battery') ? 'BAT ' + Math.round(S.batt) + '%' : 'AC');

      // ---- alarms ----
      const set = (c, id, pr, tx) => { if (c && S.alarms[id] && S.alarms[id].pr !== pr) S.clear(id); c ? S.alarm(id, pr, tx) : S.clear(id); };
      if (!door) S.clear('door'); else if (!S.alarms.door) S.alarm('door', 'med', 'DOOR OPEN');
      set(door && !clampOk && source, 'free', 'high', 'FREE FLOW — CLAMP THE LINE');
      if (!f.has('upOcc')) S.clear('up');
      if (S.alarms.air && S.air == null) S.clear('air');
      if (S.alarms.empty && S.bag > 0) S.clear('empty');
      set(f.has('battery'), 'ac', 'low', 'AC POWER LOST — ON BATTERY');
      set(f.has('battery') && !S.dead && S.batt < 25, 'batt', S.batt < 10 ? 'high' : 'med', 'BATTERY LOW');
      if (!S.dead) S.clear('dead');
    },
    stop(S) {
      setRun(S, false); S.drops = []; S.releasing = null;
    }
  });
})();

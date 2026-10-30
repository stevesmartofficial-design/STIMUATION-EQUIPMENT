/* Live simulator — Manual defibrillator / AED on a defibrillator analyser (generic,
   manufacturer-neutral). The analyser supplies the ECG rhythm and the test load and
   measures delivered energy. Rising-pitch charge tone and continuous ready tone,
   shock thump with ECG artifact, synchronised-cardioversion markers, AED voice
   prompts via speech synthesis, charge-time and battery read-outs, engineering faults. */
(function () {
  const { W, Sound } = Sim;
  const RHYTHMS = [['nsr', 'Normal sinus rhythm'], ['af', 'Atrial fibrillation'], ['vt', 'Ventricular tachycardia'], ['vf', 'Ventricular fibrillation'], ['asys', 'Asystole']];
  const LOADS = [['25', '25 Ω'], ['50', '50 Ω (analyser standard load)'], ['75', '75 Ω'], ['100', '100 Ω'], ['125', '125 Ω'], ['150', '150 Ω'], ['175', '175 Ω']];
  const CAP = 200e-6;            // storage capacitor (F) — for the capacitor voltage read-out
  const RATE = 200 / 5;          // nominal charge rate (J/s): 200 J in ~5 s (training value)
  const READY_TIMEOUT = 30;      // auto internal disarm if not shocked (s; manufacturer-specific)
  const CHARGE_TIMEOUT = 20;     // charge must complete within this (s)
  const SYNC_TIMEOUT = 5;        // sync shock waits this long for an R wave (s)
  const SPEED = 125;             // ECG sweep (px/s)
  const shockable = r => r === 'vf' || r === 'vt';
  const setCtl = (S, id, val) => { S.v[id] = val; const i = S.$(`[data-ctl="${id}"]`); if (i) i.value = val; };
  const flash = (S, on) => { const b = S.$('[data-act="shock"]'); if (b) b.classList.toggle('dfb-flash', !!on); };
  const errBeep = () => Sound.beep(300, 0.18, { vol: 0.15, type: 'square', lp: 1200 });
  const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;   // ≈ N(0,1)

  function charge(S) {
    if (S.st === 'charging') return;
    if (S.batt <= 0) { S.log('Cannot charge — battery depleted', 'bad'); errBeep(); return; }
    S.clear('chg'); S.clear('idis');
    S.target = S.v.energy; S.E = 0; S.st = 'charging'; S.chStart = S.t; flash(S, false);
    S.chVoice && S.chVoice.stop();
    S.chVoice = Sound.voice({ type: 'triangle', pitch: 300, filter: 'lowpass', freq: 3000 }); S.chVoice.set({ vol: 0.07 });
    S.batt = Math.max(0, S.batt - S.target / 200 * (S.fault.has('battery') ? 5 : 0.4));
    S.log(`Charging to ${S.target} J`);
  }
  function disarm(S, why, kind = 'info') {
    if (S.st === 'idle') return;
    S.st = 'idle'; S.E = 0; flash(S, false);
    S.chVoice && S.chVoice.stop(); S.chVoice = null;
    Sound.burst(0.06, { freq: 900, q: 2, vol: 0.15 });   // internal dump relay
    S.log(why, kind);
  }
  function deliver(S) {
    const Z = +S.v.load, sel = S.target, E = S.E;
    const sd = 0.015 + Math.abs(Z - 50) / 50 * 0.015;               // spread grows away from 50 Ω
    const del = Math.max(0, E * (1 + gauss() * sd));
    const ipk = Math.sqrt(2 * E / CAP) / (Z + 5);
    S.del = { del, sel, Z, ipk }; S.shocks++; S.shockT = S.t;
    S.st = 'idle'; S.E = 0; flash(S, false);
    S.chVoice && S.chVoice.stop(); S.chVoice = null;
    Sound.burst(0.02, { freq: 3500, q: 2, vol: 0.2 });                // HV relay
    Sound.burst(0.35, { filter: 'lowpass', freq: 150, q: 0.8, vol: 0.7 });
    Sound.beep(70, 0.28, { vol: 0.45, slide: 35 });                   // thump
    S.batt = Math.max(0, S.batt - (S.fault.has('battery') ? 3 : 0.3));
    const dev = (del - sel) / sel * 100;
    S.log(`Shock ${S.shocks}${S.syncShot ? ' (synchronised)' : ''}: selected ${sel} J → delivered ${del.toFixed(1)} J into ${Z} Ω (${dev >= 0 ? '+' : ''}${dev.toFixed(1)} %), peak ≈ ${ipk.toFixed(0)} A. Compare with the manufacturer’s stated accuracy / hospital protocol.`, 'ok');
    S.syncShot = false;
    if (S.aed) { Sound.speak('Shock delivered.'); S.aed = null; }
  }
  function onR(S, rt) {
    if (!S.sync || S.fault.has('pads') || S.fault.has('syncFail')) return;
    S.lastSyncR = S.t;
    const s = S.ecg;
    if (s && s.ys) { const Wl = s.ys.length, d0 = Math.max(0, Math.round((S.t - rt) * SPEED)); S.marks.push({ x: ((s.head - 1 - d0) % Wl + Wl) % Wl, born: S.t - d0 / SPEED }); }
    Sound.beep(1500, 0.035, { vol: 0.1, type: 'square', lp: 4000 });
    if (S.st === 'syncwait') { S.st = 'ready'; S.syncShot = true; deliver(S); }
  }

  Sim.register('defibrillator', {
    title: 'Defibrillator on an analyser — live',
    intro: 'The defibrillator is connected to a defibrillator analyser. The analyser simulates the ECG rhythm, provides the test load and measures the delivered energy. Charge, shock, disarm, try synchronised cardioversion and the AED voice prompts, then inject faults.',
    stage: () => `<style>
      .dfb{display:grid;grid-template-columns:minmax(0,1fr) 250px;min-height:380px}
      .dfb-w{display:flex;flex-direction:column;border-right:1px solid #13223d;min-width:0}
      .dfb-c{display:block;width:100%;height:210px;border-bottom:1px solid #0d1830}
      .dfb-msg{padding:10px 12px;font:700 .95rem var(--mono);color:#f5b84a;min-height:42px;border-bottom:1px solid #0d1830}
      .dfb-side{display:flex;flex-direction:column}
      .dfb-side>div{padding:10px 12px;border-bottom:1px solid #13223d;border-left:1px solid #13223d;color:var(--c,#e6eefb)}
      .dfb-side small{display:block;font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;opacity:.85}
      .dfb-side b{font:700 2.3rem/1.05 var(--mono)}
      .dfb-side i{display:block;font-style:normal;font-size:.74rem;opacity:.85;font-family:var(--mono);margin-top:3px}
      .dfb-sync{display:inline-block;padding:1px 8px;border-radius:5px;background:#13223d;color:#8ea3c4;font:700 .74rem var(--mono)}
      .dfb-sync.on{background:#36d39a;color:#04110b}
      .sim-actions .dfb-flash{background:#d42a2a!important;color:#fff!important;border-color:#d42a2a!important;animation:dfbfl .5s steps(1) infinite}
      @keyframes dfbfl{50%{opacity:.45}}
      @media (max-width:720px){.dfb{grid-template-columns:1fr}.dfb-w{border-right:0}.dfb-c{height:170px}.dfb-side b{font-size:1.8rem}}
    </style>
    <div class="dfb">
      <div class="dfb-w">
        <canvas class="dfb-c" id="dfbEcg"></canvas>
        <div class="dfb-msg" data-num="msg">--</div>
        <div class="sim-readout">
          <div style="--c:#36d39a"><small>Delivered</small><b data-num="del">--</b></div>
          <div style="--c:#8ea3c4"><small>Test load</small><b data-num="z">--</b></div>
          <div style="--c:#ff8fa3"><small>Peak current</small><b data-num="ipk">--</b></div>
          <div style="--c:#4dd0ff"><small>Charge time</small><b data-num="cht">--</b></div>
          <div style="--c:#c3a6ff"><small>Shocks</small><b data-num="n">0</b></div>
          <div style="--c:#f5b84a"><small>Battery</small><b data-num="batt">--</b><div class="sim-meter"><i id="dfbBatt" style="width:100%"></i></div></div>
        </div>
      </div>
      <div class="dfb-side">
        <div style="--c:#36d39a"><small>HR bpm</small><b data-num="hr">--</b><i data-num="rhy"></i></div>
        <div style="--c:#ffd166"><small>Energy J</small><b data-num="e">--</b><i data-num="es"></i><div class="sim-meter" style="--c:#ffd166"><i id="dfbCap" style="width:0%"></i></div><i data-num="vc"></i></div>
        <div><small>Mode</small><i data-num="mode" style="font-size:.9rem"></i><i><span class="dfb-sync" id="dfbSync">SYNC OFF</span></i></div>
      </div>
    </div>`,
    controls: [
      { id: 'mode', label: 'Mode', type: 'select', options: [['manual', 'Manual defibrillation'], ['aed', 'AED (automatic analysis)']], value: 'manual' },
      { id: 'energy', label: 'Energy select', type: 'range', min: 5, max: 200, step: 5, value: 150, unit: 'J' },
      { id: 'load', label: 'Analyser test load', type: 'select', options: LOADS, value: '50' },
      { id: 'rhythm', label: 'Analyser ECG rhythm', type: 'select', options: RHYTHMS, value: 'vf' },
      { id: 'hr', label: 'Analyser heart rate', type: 'range', min: 30, max: 200, value: 80, unit: 'bpm' }
    ],
    actions: [{ id: 'charge', label: '⚡ Charge', primary: true }, { id: 'shock', label: '◉ Shock' }, { id: 'disarm', label: '✕ Disarm' }, { id: 'sync', label: '♥ Sync on/off' }, { id: 'analyse', label: '▶ AED analyse' }],
    faults: [
      { id: 'pads', label: 'Pads / paddles not connected', explain: 'The pad cable is open circuit. The ECG via pads is a flat line, "CONNECT PADS" is showing and the shock is blocked even when the unit is charged. AED analysis cannot start.', check: 'Check the pad cable connector, its pins and latch, and the cable continuity, plus the pad expiry date and gel. Then confirm the impedance and energy reading on the analyser with a known-good cable.' },
      { id: 'battery', label: 'Battery degraded', explain: 'The battery has little capacity left and cannot supply the charging current. The charge takes several times longer, each charge eats a big share of the remaining capacity, and the low-battery alarm comes on.', check: 'Run the battery capacity / conditioning test per manufacturer instructions, and check the battery’s date and cycle count. Measure the charge time at maximum energy and compare it with the manufacturer’s specification. Replace the battery if it is out of tolerance.' },
      { id: 'capFail', label: 'Charge circuit / capacitor failure', explain: 'The HV charger or the storage capacitor cannot reach the selected energy. The charge tone rises, then stalls part-way, and the charge times out with "CHARGE FAULT". No shock is possible.', check: 'HIGH VOLTAGE — service-trained staff only, following the manufacturer’s capacitor discharge procedure. Read the self-test log, then check the charger output, the capacitor (ESR/capacitance) and the HV relay. Verify with the analyser after repair.' },
      { id: 'bleed', label: 'Internal discharge (energy bleeds)', explain: 'The stored energy leaks away while the unit waits to shock, through a leaky capacitor or a partly closed dump/HV relay. The energy read-out drops and the unit disarms itself early.', check: 'Charge to maximum, wait, then shock into the analyser and compare the delivered energy with the energy selected. Then inspect the internal dump circuit and the HV relay. HV work only by trained staff, per the manufacturer’s procedure.' },
      { id: 'noise', label: 'ECG lead / pad noise', explain: 'Mains hum, baseline wander and spikes are on the ECG via pads. AED analysis is interrupted, and in sync mode the artifact can trigger false sync markers, which is dangerous during cardioversion.', check: 'Check pad contact and gel, the cable shield and connector, and any nearby interference sources. Use the analyser’s clean ECG to prove the ECG front-end.' },
      { id: 'syncFail', label: 'Sync not detecting R waves', explain: 'Sync is on and the rhythm is organised, but no sync markers appear. A synchronised shock waits, then times out without discharging.', check: 'Use the analyser to check that the sync marker appears on each R wave and that the R-to-discharge delay is within the manufacturer’s specification. Check ECG gain and lead source, and the QRS detector. Repair or escalate if it fails.' }
    ],

    init(S) {
      S.ecg = S.strip('#dfbEcg', { color: '#36d39a', min: -0.8, max: 1.5, label: 'Pads', unit: '×1  25 mm/s', speed: SPEED });
      S.st = 'idle'; S.E = 0; S.target = S.v.energy; S.chStart = 0; S.readyT = 0; S.chTime = null; S.del = null; S.shocks = S.shocks || 0;
      S.batt = S.fault.has('battery') ? Math.min(S.batt != null ? S.batt : 100, 22) : 100;
      S.sync = false; S.syncShot = false; S.syncOnT = 0; S.lastSyncR = -99; S.marks = []; S.marksYs = null; S.rQ = [];
      S.beatT = 0; S.nextBeat = 0.3; S.rrNow = 60 / S.v.hr; S.lastBeats = []; S.aed = null; S.shockT = -99; S.chVoice = null;
    },

    onAction(S, id) {
      const v = S.v, f = S.fault;
      if (id === 'charge') {
        if (v.mode === 'aed') { S.log('AED mode: the device charges by itself when a shock is advised', 'warn'); errBeep(); return; }
        charge(S); return;
      }
      if (id === 'disarm') { if (S.st === 'idle') return S.log('Nothing to disarm'); disarm(S, 'Disarmed by the user — energy dumped internally'); if (S.aed) S.aed = null; return; }
      if (id === 'sync') {
        S.sync = !S.sync; S.syncOnT = S.t; S.marks = [];
        Sound.beep(S.sync ? 1200 : 800, 0.06, { vol: 0.1 });
        S.log(S.sync ? 'Sync ON — shocks are delivered on the next detected R wave' : 'Sync OFF — asynchronous defibrillation');
        if (!S.sync && S.st === 'syncwait') S.st = 'ready';
        return;
      }
      if (id === 'analyse') {
        if (v.mode !== 'aed') { setCtl(S, 'mode', 'aed'); S.log('Switched to AED mode'); }
        if (S.st !== 'idle') disarm(S, 'Disarmed for rhythm analysis');
        if (f.has('pads')) { Sound.speak('Connect electrode pads.'); S.log('AED: pads not connected — analysis not possible', 'bad'); S.aed = null; return; }
        S.aed = { ph: 'analyse', t: 0, said: S.t };
        Sound.speak('Analysing heart rhythm. Do not touch the patient.'); S.log('AED: analysing rhythm');
        return;
      }
      if (id === 'shock') {
        if (S.st === 'syncwait') return S.log('Sync shock already armed — waiting for an R wave');
        if (S.st !== 'ready') { S.log(S.st === 'charging' ? 'Still charging — wait for the ready tone' : 'Not charged — press Charge first', 'warn'); errBeep(); return; }
        if (v.mode === 'aed' && !(S.aed && S.aed.ph === 'ready')) { S.log('AED: shock only after "Shock advised"', 'warn'); errBeep(); return; }
        if (f.has('pads')) { S.log('Shock blocked — pads not connected (open circuit / impedance out of range)', 'bad'); errBeep(); if (v.mode === 'aed') Sound.speak('Connect electrode pads.'); return; }
        if (S.sync) { S.st = 'syncwait'; S.syncT = S.t; S.log('Synchronised shock armed — discharging on the next detected R wave'); return; }
        deliver(S);
      }
    },
    onControl(S, id) {
      if ((id === 'energy') && S.st !== 'idle') disarm(S, 'Energy changed after charging — charge dumped; charge again at the new value', 'warn');
      if (id === 'mode') { if (S.st !== 'idle') disarm(S, 'Mode changed — charge dumped', 'warn'); S.aed = null; }
      if (id === 'energy' || id === 'load' || id === 'rhythm') Sound.beep(1800, 0.03, { vol: 0.06 });
    },
    onFault(S, id, on) {
      if (id === 'battery') S.batt = on ? Math.min(S.batt != null ? S.batt : 100, 22) : 100;
      if (id === 'pads' && on && S.st === 'syncwait') S.st = 'ready';
    },

    tick(S, dt, t) {
      const v = S.v, f = S.fault, pads = !f.has('pads');
      // ---- analyser rhythm timing ----
      const rhythm = v.rhythm; let hr = v.hr;
      if (rhythm === 'vt') hr = Math.max(150, hr); if (rhythm === 'asys' || rhythm === 'vf') hr = 0;
      if (hr === 0) S.nextBeat = Math.max(S.nextBeat, t);
      if (t >= S.nextBeat && hr > 0) {
        let rr = 60 / hr; if (rhythm === 'af') rr *= 0.6 + Math.random() * 0.8;
        S.beatT = t; S.rrNow = rr; S.nextBeat = t + rr;
        const k = Math.min(1, 0.8 / rr), off = rhythm === 'vt' ? 0.227 : 0.215 * k + 0.04;
        S.rQ.push(t + off * rr); if (pads) { S.lastBeats.push(t); }
      }
      S.lastBeats = S.lastBeats.filter(x => t - x < 8);
      const ecgAt = tt => {
        if (!pads) return W.noise(0.01);
        let y = 0;
        if (rhythm === 'vf') y = 0.35 * Math.sin(tt * 30) * Math.sin(tt * 4.3) + 0.2 * Math.sin(tt * 47 + Math.sin(tt * 3));
        else if (rhythm === 'asys') y = W.noise(0.01) + 0.02 * Math.sin(tt * 1.1);
        else {
          const ph = (tt - S.beatT) / S.rrNow;
          if (ph >= 0 && ph < 1) y = rhythm === 'vt' ? 0.9 * Math.sin(Math.PI * Math.min(1, ph * 2.2)) * (ph < 0.45 ? 1 : 0) - 0.25 * W.gauss(ph, 0.6, 0.08) : W.ecg(ph, { rr: S.rrNow, noP: rhythm === 'af' });
          if (rhythm === 'af') y += 0.04 * Math.sin(tt * 37) + 0.03 * Math.sin(tt * 23);
        }
        if (f.has('noise')) y += 0.15 * Math.sin(2 * Math.PI * 50 * tt) + 0.35 * Math.sin(tt * 2.3) * Math.sin(tt * 0.9) + W.noise(0.08) + (Math.random() < 0.004 ? W.noise(1.4) : 0);
        const x = tt - S.shockT;   // shock artifact: amplifier saturation then recovery
        if (x >= 0 && x < 2) y = x < 0.05 ? 3 : y * Math.min(1, x / 1.5) + 2.2 * Math.exp(-(x - 0.05) / 0.18) - 0.5 * Math.exp(-x / 0.7);
        return y + W.noise(0.008);
      };
      S.ecg.advance(dt, t, ecgAt);

      // ---- R-wave detection / sync markers (after the sweep so the column is known) ----
      while (S.rQ.length && t >= S.rQ[0]) { const rt = S.rQ.shift(); if (pads && t - rt < 0.5) onR(S, rt); }
      if (S.sync && pads && f.has('noise') && Math.random() < dt * 0.6) onR(S, t);   // artifact falsely detected as R
      const s = S.ecg;
      if (s.ys !== S.marksYs) { S.marks = []; S.marksYs = s.ys; }
      if (S.marks.length) {
        const Wl = s.ys.length, g = s.g;
        S.marks = S.marks.filter(m => (t - m.born) * SPEED < Wl - 16);
        g.fillStyle = '#ffffff';
        S.marks.forEach(m => { g.beginPath(); g.moveTo(m.x - 5, 18); g.lineTo(m.x + 5, 18); g.lineTo(m.x, 27); g.closePath(); g.fill(); });
      }

      // ---- charge / ready state machine ----
      if (S.st === 'charging') {
        let rate = RATE * (f.has('battery') ? 0.35 : 1);
        if (f.has('capFail')) rate *= S.E < 0.4 * S.target ? 0.5 : 0.01;
        S.E = Math.min(S.target, S.E + rate * dt);
        S.chVoice && S.chVoice.set({ pitch: 300 + 900 * S.E / S.target, glide: 0.05 });
        if (S.E >= S.target) {
          S.st = 'ready'; S.readyT = t; S.chTime = t - S.chStart; flash(S, true);
          S.chVoice && S.chVoice.set({ pitch: 1250, vol: 0.06, glide: 0.01 });   // continuous ready tone
          S.log(`Charged: ${S.target} J ready in ${S.chTime.toFixed(1)} s`, 'ok');
        } else if (t - S.chStart > CHARGE_TIMEOUT) {
          disarm(S, `Charge timeout — ${S.E.toFixed(0)} of ${S.target} J reached after ${CHARGE_TIMEOUT} s`, 'bad');
          S.alarm('chg', 'high', 'CHARGE FAULT — ENERGY NOT REACHED');
          if (S.aed) { Sound.speak('Device fault. Start CPR.'); S.aed = null; }
        }
      } else if (S.st === 'ready' || S.st === 'syncwait') {
        if (f.has('bleed')) {
          S.E *= Math.exp(-dt / 25);
          S.chVoice && S.chVoice.set({ pitch: 1250 * S.E / S.target, glide: 0.1 });
          if (S.E < 0.85 * S.target) { disarm(S, `Stored energy fell to ${S.E.toFixed(0)} J (selected ${S.target} J) — internal discharge, device disarmed itself`, 'bad'); S.alarm('idis', 'med', 'DISARMED — INTERNAL DISCHARGE'); if (S.aed) S.aed = null; }
        }
        if (S.st === 'syncwait' && t - S.syncT > SYNC_TIMEOUT) { S.st = 'ready'; S.log(`Sync: no R wave detected in ${SYNC_TIMEOUT} s — shock NOT delivered (still charged)`, 'bad'); errBeep(); }
        if (S.st !== 'idle' && t - S.readyT > READY_TIMEOUT) { disarm(S, `Not shocked within ${READY_TIMEOUT} s — automatic internal disarm (timeout per manufacturer)`, 'warn'); if (S.aed) S.aed = null; }
      }

      // ---- AED sequence ----
      const a = S.aed;
      if (a) {
        a.t += dt;
        if (!pads) { Sound.speak('Connect electrode pads.'); S.log('AED: pads disconnected — analysis stopped', 'bad'); S.aed = null; }
        else if (a.ph === 'analyse') {
          if (f.has('noise') && a.t > 2.5) { Sound.speak('Noise detected. Analysis interrupted. Do not touch the patient.'); S.log('AED: analysis interrupted — noise / motion on the ECG', 'warn'); S.aed = null; }
          else if (a.t >= 6) {
            if (shockable(rhythm)) { a.ph = 'charging'; Sound.speak('Shock advised. Charging.'); S.log('AED: shock advised', 'warn'); charge(S); }
            else { Sound.speak('No shock advised.'); S.log('AED: no shock advised — continue care per protocol'); S.aed = null; }
          }
        } else if (a.ph === 'charging') {
          if (S.st === 'ready') { a.ph = 'ready'; a.said = t; Sound.speak('Press the flashing shock button.'); }
          else if (S.st === 'idle') S.aed = null;
        } else if (a.ph === 'ready') {
          if (S.st === 'idle') S.aed = null;
          else if (t - a.said > 9) { a.said = t; Sound.speak('Press the flashing shock button.'); }
        }
      }

      // ---- numerics / display ----
      const measHr = S.lastBeats.length > 1 ? Math.round(60 * (S.lastBeats.length - 1) / (S.lastBeats[S.lastBeats.length - 1] - S.lastBeats[0])) : 0;
      S.num('hr', !pads ? '--' : rhythm === 'vf' ? '---' : rhythm === 'asys' ? 0 : measHr || '--');
      S.num('rhy', !pads ? 'PADS OFF' : (RHYTHMS.find(r => r[0] === rhythm) || [])[1]);
      const eShown = S.st === 'idle' ? v.energy : Math.round(S.E);
      S.num('e', eShown);
      S.num('es', S.st === 'idle' ? 'selected' : S.st === 'charging' ? `charging → ${S.target}` : `stored (sel. ${S.target})`);
      S.num('vc', `Cap ≈ ${Math.round(Math.sqrt(2 * S.E / CAP))} V`);
      const cap = S.$('#dfbCap'); if (cap) cap.style.width = Math.min(100, S.E / Math.max(1, S.target) * 100) + '%';
      S.num('del', S.del ? S.del.del.toFixed(1) + ' J' : '--');
      S.num('z', pads ? v.load + ' Ω' : 'OPEN');
      S.num('ipk', S.del ? S.del.ipk.toFixed(0) + ' A' : '--');
      S.num('cht', S.st === 'charging' ? (t - S.chStart).toFixed(1) + ' s…' : S.chTime != null ? S.chTime.toFixed(1) + ' s' : '--');
      S.num('n', S.shocks);
      if (f.has('battery')) S.batt = Math.max(0, S.batt - dt * 0.03);
      S.num('batt', Math.round(S.batt) + '%');
      const bb = S.$('#dfbBatt'); if (bb) { bb.style.width = S.batt + '%'; bb.style.background = S.batt < 20 ? '#ff6b6b' : ''; }
      S.num('mode', v.mode === 'aed' ? 'AED' : 'MANUAL');
      const sy = S.$('#dfbSync'); if (sy) { sy.classList.toggle('on', S.sync); sy.textContent = S.sync ? 'SYNC ON' : 'SYNC OFF'; }
      const msg = !pads ? 'CONNECT PADS'
        : S.aed && S.aed.ph === 'analyse' ? 'ANALYSING… DO NOT TOUCH THE PATIENT'
        : S.st === 'charging' ? `CHARGING ${Math.round(S.E)} / ${S.target} J`
        : S.st === 'syncwait' ? 'SYNC — WAITING FOR R WAVE'
        : S.st === 'ready' ? `READY ${Math.round(S.E)} J — PRESS SHOCK`
        : v.mode === 'aed' ? 'AED — press Analyse' : 'Select energy, press Charge';
      S.num('msg', msg);

      // ---- alarms ----
      const set = (c, id, pr, tx) => { if (c && S.alarms[id] && S.alarms[id].pr !== pr) S.clear(id); c ? S.alarm(id, pr, tx) : S.clear(id); };
      set(!pads, 'pads', 'med', 'CONNECT PADS');
      set(pads && f.has('noise'), 'noise', 'low', 'ECG NOISE — CHECK PADS / CABLE');
      set(S.batt < 20, 'batt', S.batt < 8 ? 'high' : 'med', 'BATTERY LOW');
      set(v.mode === 'manual' && pads && shockable(rhythm), 'vfvt', 'high', 'VF / VT');
      set(v.mode === 'manual' && pads && rhythm === 'asys', 'asys', 'high', 'ASYSTOLE');
      set(S.sync && pads && ['nsr', 'af', 'vt'].includes(rhythm) && t - Math.max(S.lastSyncR, S.syncOnT) > 3, 'syncR', 'low', 'SYNC — NO R-WAVE DETECTION');
    },
    stop(S) {
      S.chVoice && S.chVoice.stop(); S.chVoice = null;
      S.st = 'idle'; S.E = 0; S.aed = null; flash(S, false);
    }
  });
})();

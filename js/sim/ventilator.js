/* Live simulator — Critical-care ventilator (generic, manufacturer-neutral).
   Single-compartment lung solved with the equation of motion P = V/C + R·Flow + PEEP,
   plus a compliant patient circuit, at 1 ms steps. VC-CMV (square flow) and PC-CMV
   (servo-controlled pressure), inspiratory hold for Pplat, flow-following inspiratory
   hiss, exhalation-valve clicks, pre-use check and engineering faults. */
(function () {
  const { W, Sound } = Sim;
  const H = 0.001;          // physics step (s)
  const FMAX = 3;           // max inspiratory valve flow (L/s ≈ 180 L/min)
  const RV = 2;             // exhalation valve + expiratory limb resistance (cmH2O/L/s)
  const CC = 0.002;         // patient circuit compliance (L/cmH2O ≈ 2 mL/cmH2O)
  const BIAS_MAX = 0.5;     // max PEEP-compensation (bias) flow (L/s)
  const HOLD = 1.5;         // inspiratory hold duration (s)
  const KINK = 60;          // added airway resistance of a kinked tube (cmH2O/L/s)
  const LEAK_K = 0.02;      // circuit leak conductance (L/s per cmH2O)
  const MODES = [['vc', 'VC-CMV (volume control)'], ['pc', 'PC-CMV (pressure control)']];
  const IE = [['1', '1:1'], ['1.5', '1:1.5'], ['2', '1:2'], ['3', '1:3'], ['4', '1:4']];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  const timing = v => { const tt = 60 / v.rr; return { tt, ti: tt / (1 + +v.ie) }; };
  /* Fault-free expectation from the settings: reference for the relative alarm limits. */
  const expected = v => {
    const { ti } = timing(v);
    if (v.mode === 'vc') return { vt: v.vt, ppeak: v.peep + v.vt / v.comp + v.res * (v.vt / 1000 / ti) };
    const tau = v.res * v.comp / 1000;
    return { vt: v.comp * v.pinsp * (1 - Math.exp(-ti / tau)), ppeak: v.peep + v.pinsp };
  };

  /* Pre-use check steps: [name, test(S) -> true | failure text]. Ventilation is in standby meanwhile. */
  const CHECK = [
    ['Alarm loudspeaker and visual indicators', () => true],
    ['Gas supply pressures (O₂ / air)', S => S.fault.has('o2') ? 'O₂ supply pressure not detected' : true],
    ['O₂ sensor calibration (21 % / 100 %)', S => S.fault.has('o2') ? 'cannot reach the 100 % calibration point (no O₂)' : true],
    ['Flow sensor zero and calibration', S => S.fault.has('flowSensor') ? 'expiratory flow sensor reading out of tolerance' : true],
    ['Circuit leak test (Y-piece occluded)', S => S.fault.has('disc') ? 'circuit cannot be pressurised (open circuit)' : S.fault.has('leak') ? 'pressure decays too fast — circuit leak' : true],
    ['Circuit compliance and resistance', S => S.fault.has('kink') ? 'limb resistance too high (kink / obstruction)' : true],
    ['Exhalation valve function', S => S.fault.has('expValve') ? 'exhalation valve does not release pressure' : true],
    ['Battery and power supply', S => S.fault.has('mains') ? 'mains not detected / battery capacity low' : true]
  ];
  const CHECK_STEP = 1.8;

  function startBreath(S) {
    const v = S.v, m = S.meas, b = S.br;
    if (b.started) {   // close out the previous breath
      m.rr = 60 / Math.max(0.5, S.tt - b.t0);
      m.ppeak = b.ppeak; m.peep = S.pc; m.vti = b.vti; m.vte = b.vte; m.limited = b.limited;
      m.mve = Math.max(0, b.vte) * m.rr / 1000;
      S.breaths++;
    }
    const { tt, ti } = timing(v);
    S.ph = 'insp'; S.pt = 0; S.ti = ti; S.mode = v.mode; S.vcFlow = v.vt / 1000 / ti;
    S.nextBreath = S.tt + tt; S.dispV = 0;
    S.br = { started: true, t0: S.tt, ppeak: -99, vti: 0, vte: 0, limited: false };
    Sound.burst(0.025, { freq: 2600, q: 3, vol: 0.14 });   // exhalation valve closes
  }
  function startExp(S) {
    S.ph = 'exp'; S.pt = 0;
    if (!S.fault.has('expValve')) {   // a stuck valve gives no opening click — listen for it
      Sound.burst(0.03, { freq: 1700, q: 2.5, vol: 0.22 });
      Sound.burst(0.16, { filter: 'lowpass', freq: 650, vol: 0.1 });
    }
  }

  /* One physics step of h seconds. Writes S.o = {p, f, v, fv, fx}. */
  function step(S, h) {
    const v = S.v, f = S.fault, C = v.comp / 1000, peep = v.peep;
    const Rin = v.res + (f.has('kink') ? KINK : 0), rv = f.has('expValve') ? 400 : RV;
    const disc = f.has('disc'), kL = f.has('leak') ? LEAK_K : 0;
    const standby = S.dead || !!S.check;
    S.tt += h; S.pt += h;
    const Palv = S.vol / C;
    const Fpat = disc ? -Palv / v.res : (S.pc - Palv) / Rin;   // into the patient (+)
    const Fopen = disc ? Math.max(0, S.pc) / 1.2 : 0;          // out of the open Y-piece
    const leak = kL * Math.max(0, S.pc);
    let Fv = 0, Fexp = 0;
    if (standby) Fexp = Math.max(0, S.pc) / RV;                 // valves open to room
    else if (S.ph === 'insp') {
      if (S.mode === 'vc') Fv = S.vcFlow;
      else {
        const Pt = peep + v.pinsp * (1 - Math.exp(-S.pt / 0.05));
        Fv = clamp(Fpat + leak + Fopen + (Pt - S.pc) * CC / 0.01, 0, FMAX);
      }
    } else if (S.ph === 'exp') {
      Fexp = S.pc > peep ? (S.pc - peep) / rv : 0;
      Fv = S.pc < peep ? clamp((peep - S.pc) * CC / 0.02, 0, BIAS_MAX) : 0;
    }
    const relief = S.pc > v.pmax + 10 ? (S.pc - v.pmax - 10) / 1.5 : 0;   // mechanical safety valve
    S.pc += (Fv - Fpat - leak - Fopen - Fexp - relief) * h / CC;
    S.vol = Math.max(0, S.vol + Fpat * h);

    const FexpM = Fexp * S.fsGain + (f.has('flowSensor') && Fexp > 0.01 ? W.noise(0.05) : 0);
    const flow = standby ? 0 : Fv - FexpM;
    const o = S.o;
    o.fv = Fv; o.fx = Fexp;
    if (S.dead) { o.p = o.f = o.v = NaN; return; }
    o.p = S.check ? 0 : S.pc + W.noise(0.08); o.f = flow * 60;
    if (!standby) {
      const b = S.br;
      if (S.ph === 'exp') b.vte += FexpM * h * 1000;
      else { b.vti += Fv * h * 1000; b.ppeak = Math.max(b.ppeak, S.pc); }
      S.dispV += flow * h * 1000;
    }
    o.v = S.check ? 0 : S.dispV;
    if (standby) return;

    // ---- phase transitions ----
    if (S.ph === 'insp') {
      if (S.pc >= v.pmax) { S.br.limited = true; startExp(S); }
      else if (S.pt >= S.ti) {
        if (S.holdReq) { S.holdReq = false; S.ph = 'hold'; S.pt = 0; S.nextBreath += HOLD; S.br.held = true; }
        else startExp(S);
      }
    } else if (S.ph === 'hold') {
      if (S.pt >= HOLD) {
        const m = S.meas, pplat = S.pc, pe = m.peep != null ? m.peep : v.peep;
        m.pplat = pplat;
        const cst = S.br.vti / Math.max(0.5, pplat - pe);
        const raw = S.mode === 'vc' ? ` · Raw ≈ ${((S.br.ppeak - pplat) / S.vcFlow).toFixed(0)} cmH₂O/L/s (includes ET tube / circuit)` : '';
        S.log(`Inspiratory hold: Pplat ${pplat.toFixed(1)} cmH₂O · Cstat ≈ ${cst.toFixed(0)} mL/cmH₂O${raw}`, 'ok');
        Sound.beep(1046, 0.08, { vol: 0.1 });
        startExp(S);
      }
    } else if (S.tt >= S.nextBreath) startBreath(S);
  }

  function runCheck(S, dt) {
    const c = S.check; c.t += dt;
    if (!c.announced) {
      c.announced = true; S.log(`Pre-use check ${c.i + 1}/${CHECK.length}: ${CHECK[c.i][0]}…`);
      if (c.i === 0) Sound.alarm('low'); else Sound.beep(660, 0.06, { vol: 0.1 });
    }
    if (c.t < CHECK_STEP) return;
    const r = CHECK[c.i][1](S);
    if (r === true) { S.log(`  PASS — ${CHECK[c.i][0]}`, 'ok'); Sound.beep(1320, 0.07, { vol: 0.12 }); }
    else { c.fails.push(CHECK[c.i][0]); S.log(`  FAIL — ${CHECK[c.i][0]}: ${r}`, 'bad'); Sound.beep(330, 0.14, { vol: 0.16, type: 'square', lp: 1200 }); Sound.beep(330, 0.14, { vol: 0.16, type: 'square', lp: 1200, when: Sound.now + 0.22 }); }
    c.i++; c.t = 0; c.announced = false;
    if (c.i >= CHECK.length) {
      if (c.fails.length) {
        S.log(`Pre-use check FAILED (${c.fails.length}): ${c.fails.join('; ')}. Do not use on a patient — investigate per manufacturer / hospital protocol.`, 'bad');
        S.alarm('chk', 'med', 'PRE-USE CHECK FAILED');
      } else {
        S.log('Pre-use check passed. Reconnect the patient and confirm settings.', 'ok'); S.clear('chk');
        [0, 0.12, 0.24].forEach((o, i) => Sound.beep([1046, 1318, 1568][i], 0.09, { vol: 0.12, when: Sound.now + o }));
      }
      S.check = null; S.ph = 'exp'; S.pt = 0; S.nextBreath = S.tt + 0.6; S.br = { started: false };
    }
  }

  Sim.register('ventilator', {
    title: 'ICU ventilator — live',
    intro: 'Pressure, flow and volume from a lung model (P = V/C + R·Flow + PEEP). Change the mode, settings and the patient’s compliance and resistance, use the inspiratory hold, run the pre-use check, inject faults and listen to the hiss, the valve clicks and the alarms.',
    stage: () => `<style>
      .vnt{display:grid;grid-template-columns:minmax(0,1fr) 250px;min-height:420px}
      .vnt-w{display:flex;flex-direction:column;border-right:1px solid #13223d;min-width:0}
      .vnt-st{display:flex;justify-content:space-between;flex-wrap:wrap;gap:4px 12px;padding:6px 10px;font:600 .74rem var(--mono);color:#8ea3c4;border-bottom:1px solid #0d1830}
      .vnt-st b{color:#e6eefb}
      .vnt-c{display:block;width:100%;height:126px;border-bottom:1px solid #0d1830}
      .vnt-n{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:minmax(62px,auto)}
      .vnt-n>div{padding:8px 12px;border-bottom:1px solid #13223d;border-left:1px solid #13223d;color:var(--c);display:flex;flex-direction:column;min-width:0}
      .vnt-n small{font-size:.66rem;text-transform:uppercase;letter-spacing:.08em;opacity:.85}
      .vnt-n b{font:700 1.9rem/1 var(--mono);margin-top:4px}
      .vnt-n i{font-style:normal;font-size:.72rem;opacity:.85;margin-top:3px;font-family:var(--mono)}
      .vnt-n .vnt-wide{grid-column:span 2}
      @media (max-width:720px){.vnt{grid-template-columns:1fr}.vnt-w{border-right:0}.vnt-c{height:100px}.vnt-n b{font-size:1.5rem}}
    </style>
    <div class="vnt">
      <div class="vnt-w">
        <div class="vnt-st"><b data-num="st">--</b><span data-num="set"></span></div>
        <canvas class="vnt-c" id="vP"></canvas><canvas class="vnt-c" id="vF"></canvas><canvas class="vnt-c" id="vV"></canvas>
      </div>
      <div class="vnt-n">
        <div style="--c:#f5b84a"><small>Ppeak cmH₂O</small><b data-num="ppk">--</b></div>
        <div style="--c:#f5b84a"><small>Pplat cmH₂O</small><b data-num="ppl">--</b><i>insp. hold</i></div>
        <div style="--c:#f5b84a"><small>PEEP cmH₂O</small><b data-num="peep">--</b></div>
        <div style="--c:#36d39a"><small>VTe mL</small><b data-num="vte">--</b><i data-num="vti">VTi --</i></div>
        <div style="--c:#36d39a"><small>MVe L/min</small><b data-num="mve">--</b></div>
        <div style="--c:#4dd0ff"><small>RRtot b/min</small><b data-num="rr">--</b></div>
        <div style="--c:#c3a6ff"><small>FiO₂ %</small><b data-num="fio2">--</b><i data-num="fio2s"></i></div>
        <div style="--c:#8ea3c4"><small>Power</small><b data-num="pwr" style="font-size:1.2rem">AC</b></div>
      </div>
    </div>`,
    controls: [
      { id: 'mode', label: 'Mode', type: 'select', options: MODES, value: 'vc' },
      { id: 'rr', label: 'Set rate (RR)', type: 'range', min: 6, max: 40, value: 15, unit: 'b/min' },
      { id: 'vt', label: 'Tidal volume Vt (VC)', type: 'range', min: 200, max: 1000, step: 10, value: 500, unit: 'mL' },
      { id: 'pinsp', label: 'Pinsp above PEEP (PC)', type: 'range', min: 5, max: 40, value: 15, unit: 'cmH₂O' },
      { id: 'peep', label: 'PEEP', type: 'range', min: 0, max: 20, value: 5, unit: 'cmH₂O' },
      { id: 'ie', label: 'I:E ratio (sets Ti)', type: 'select', options: IE, value: '2' },
      { id: 'fio2', label: 'FiO₂', type: 'range', min: 21, max: 100, value: 40, unit: '%' },
      { id: 'pmax', label: 'Paw high alarm / pressure limit', type: 'range', min: 20, max: 60, value: 40, unit: 'cmH₂O' },
      { id: 'comp', label: 'Patient compliance C', type: 'range', min: 10, max: 100, value: 50, unit: 'mL/cmH₂O' },
      { id: 'res', label: 'Patient resistance R', type: 'range', min: 2, max: 50, value: 10, unit: 'cmH₂O/L/s' }
    ],
    actions: [{ id: 'hold', label: '⏸ Inspiratory hold', primary: true }, { id: 'o2', label: 'O₂ 100 % (2 min)' }, { id: 'test', label: '♪ Alarm test' }, { id: 'check', label: '✓ Pre-use check' }],
    faults: [
      { id: 'leak', label: 'Circuit / cuff leak', explain: 'Part of every breath escapes before it reaches the lungs. The volume curve does not return to zero, VTe is clearly lower than VTi and, in VC, Ppeak falls until the low-pressure alarm trips. In PC the pressure is held, so watch VTe and the leak alarm instead.', check: 'Run the circuit leak test with the Y-piece blocked. Then work along the circuit: water-trap seals, humidifier chamber, exhalation valve diaphragm and seat, flow-sensor O-rings, ET-tube cuff pressure.' },
      { id: 'kink', label: 'Occlusion / kinked tube', explain: 'The airway resistance has jumped. In VC the pressure shoots up to the high-pressure limit, the ventilator cuts inspiration short (pressure limiting) and the delivered volume collapses. Exhalation is slow too, so gas gets trapped.', check: 'Check the patient end first: tube kink, bite block, secretions, wet HME or filter. Then check the circuit limbs and water traps. Confirm the pressure transducer reading against a reference manometer.' },
      { id: 'disc', label: 'Patient disconnect', explain: 'The circuit is open at the Y-piece. Paw hardly rises, VTe is close to zero and PEEP is lost. The ventilator pushes bias flow to try to hold PEEP, so the hiss carries on during expiration.', check: 'Reconnect and confirm the alarm clears. If it happens again, check the connector taper fit, the swivel and the HME. Make sure the disconnect alarm is enabled and its delay is set per hospital protocol.' },
      { id: 'o2', label: 'O₂ supply loss', explain: 'The O₂ inlet pressure has dropped. Ventilation carries on with air, but measured FiO₂ drifts down to 21 % and the O₂ supply and FiO₂-low alarms come on. The O₂ boost does nothing.', check: 'Check the wall outlet and hose, the cylinder contents and regulator, and the inlet filter and check valve. Verify the inlet pressure switch or sensor reading with a gauge, then recalibrate the O₂ cell.' },
      { id: 'flowSensor', label: 'Expiratory flow sensor failure / drift', explain: 'The pressures and the real ventilation are normal, but the expiratory flow sensor reads low and noisy. VTe and MVe fall, and the leak and low-volume alarms come on. Normal pressures with a "leak" that the leak test cannot find point to the sensor.', check: 'Inspect the sensor for moisture, nebulised drug or a broken element. Clean or replace it per manufacturer instructions, run the flow sensor calibration, and verify volume accuracy with a calibrated flow/volume analyser.' },
      { id: 'expValve', label: 'Exhalation valve stuck closed', explain: 'The patient cannot breathe out. The pressure stays high between breaths, each new breath stacks on the last until it hits the pressure limit, and the continuous-high-pressure alarm comes on. The valve’s opening click is missing.', check: 'Disconnect the patient and ventilate by other means immediately. Then inspect the valve diaphragm and seat, the actuator or solenoid, and the drive signal. Run the exhalation valve test in the pre-use check.' },
      { id: 'mains', label: 'Mains lost + weak battery', explain: 'Mains power has failed and the internal battery is weak, so its charge drops quickly. Low-battery alarms escalate and then the ventilator stops. Watch for flat waveforms and no breaths.', check: 'Restore mains power: check the plug, outlet and fuse, and the PSU output. Run a battery capacity test per manufacturer / hospital protocol and replace an aged battery. Make sure a manual resuscitator is always at the bedside.' }
    ],

    init(S) {
      const v = S.v;
      const spd = 70;
      S.sP = S.strip('#vP', { color: '#f5b84a', min: -2, max: 62, label: 'Paw', unit: 'cmH₂O', speed: spd });
      S.sF = S.strip('#vF', { color: '#4dd0ff', min: -100, max: 100, label: 'Flow', unit: 'L/min', speed: spd });
      S.sV = S.strip('#vV', { color: '#36d39a', min: -60, max: 1150, label: 'Volume', unit: 'mL', speed: spd, fill: true });
      S.tt = S.t; S.pc = v.peep; S.vol = v.peep * v.comp / 1000; S.ph = 'exp'; S.pt = 0; S.ti = 1; S.vcFlow = 0; S.mode = v.mode;
      S.nextBreath = S.t + 0.5; S.br = { started: false }; S.meas = {}; S.breaths = 0; S.dispV = 0;
      S.holdReq = false; S.check = null; S.dead = false; S.o2Until = 0;
      S.batt = S.fault.has('mains') && S.batt != null ? S.batt : 100; S.fLoT = 0;
      S.fsGain = 1; S.fio2m = S.fault.has('o2') ? 21 : v.fio2;
      S.o = { p: 0, f: 0, v: 0, fv: 0, fx: 0 };
      S.buf = { p: new Float32Array(128), f: new Float32Array(128), v: new Float32Array(128), n: 1, t0: S.t, h: H };
      S.hiss = Sound.voice({ noise: true, filter: 'bandpass', freq: 900, q: 0.8 });
      S.exh = Sound.voice({ noise: true, filter: 'lowpass', freq: 450, q: 0.7 });
      S.log('Ventilator running — ' + (v.mode === 'vc' ? 'VC-CMV' : 'PC-CMV') + ' on a simulated lung');
    },

    onAction(S, id) {
      if (id === 'test') { Sound.alarm('high'); setTimeout(() => Sound.alarm('med'), 3200); setTimeout(() => Sound.alarm('low'), 4800); S.log('Alarm sound test: high, medium, low priority'); return; }
      if (id === 'check') {
        if (S.check) { S.check = null; S.ph = 'exp'; S.pt = 0; S.nextBreath = S.tt + 0.6; S.br = { started: false }; S.log('Pre-use check aborted — ventilation resumed', 'warn'); return; }
        if (S.dead) return S.log('Cannot run the pre-use check — no power', 'bad');
        S.check = { i: 0, t: 0, fails: [], announced: false }; S.breaths = 0; S.meas = {}; S.holdReq = false;
        S.log('Pre-use check started — ventilator in standby. (Real use: patient disconnected and ventilated by other means, test lung / Y-piece blocked when prompted.)', 'warn');
        return;
      }
      if (S.dead || S.check) return S.log('Not available — ' + (S.dead ? 'ventilator stopped' : 'pre-use check running'), 'warn');
      if (id === 'hold') { S.holdReq = true; S.log(`Inspiratory hold requested — applied at end of the next inspiration for ${HOLD} s`); Sound.beep(1200, 0.05, { vol: 0.1 }); }
      if (id === 'o2') {
        if (S.fault.has('o2')) { S.log('O₂ boost requested but there is no O₂ supply — FiO₂ cannot rise', 'bad'); Sound.beep(330, 0.15, { vol: 0.15, type: 'square', lp: 1200 }); return; }
        S.o2Until = S.t + 120; S.log('O₂ 100 % for 2 min (pre-oxygenation / suction)'); Sound.beep(1046, 0.08, { vol: 0.12 });
      }
    },
    onControl(S, id) {
      if (id === 'mode') S.log('Mode change takes effect from the next breath');
    },
    onFault(S, id, on) {
      if (id === 'mains' && !on) {
        S.batt = 100;
        if (S.dead) { S.dead = false; S.clear('dead'); S.ph = 'exp'; S.pt = 0; S.nextBreath = (S.tt || 0) + 0.3; S.br = { started: false }; S.breaths = 0; S.meas = {}; S.log('Mains restored — ventilation resumes', 'ok'); }
      }
      if (id === 'flowSensor' && !on) S.fsGain = 1;
    },

    tick(S, dt, t) {
      const v = S.v, f = S.fault;
      // ---- power ----
      if (f.has('mains') && !S.dead) {
        S.batt = Math.max(0, S.batt - dt * 1.2);
        if (S.batt <= 0) {
          S.dead = true; S.check = null; S.holdReq = false;
          S.log('Battery depleted — ventilator stopped. Ventilate manually now.', 'bad');
          Sound.beep(220, 0.8, { vol: 0.2, type: 'square', lp: 900 });
        }
      }
      S.num('pwr', f.has('mains') ? 'BAT ' + Math.round(S.batt) + '%' : 'AC');
      // ---- sensors ----
      S.fsGain += ((f.has('flowSensor') ? 0.55 : 1) - S.fsGain) * Math.min(1, dt / 15);
      const boost = S.o2Until > t;
      const fTarget = f.has('o2') || S.dead ? 21 : boost ? 100 : v.fio2;
      S.fio2m += (fTarget - S.fio2m) * Math.min(1, dt / 8);
      if (S.o2Until && !boost) { S.o2Until = 0; S.log('O₂ 100 % period ended — back to set FiO₂'); Sound.beep(880, 0.08, { vol: 0.1 }); }
      if (S.check) runCheck(S, dt);

      // ---- physics (sub-stepped) ----
      const B = S.buf, n = clamp(Math.ceil(dt / H), 1, 128), h = dt / n;
      B.n = n; B.t0 = t - dt; B.h = h;
      let fv = 0, fx = 0;
      for (let i = 0; i < n; i++) { step(S, h); B.p[i] = S.o.p; B.f[i] = S.o.f; B.v[i] = S.o.v; fv += S.o.fv; fx += S.o.fx; }
      fv /= n; fx /= n;
      const pick = arr => tt => arr[clamp(Math.round((tt - B.t0) / B.h) - 1, 0, B.n - 1)];
      S.sP.advance(dt, t, pick(B.p)); S.sF.advance(dt, t, pick(B.f)); S.sV.advance(dt, t, pick(B.v));

      // ---- sound: inspiratory hiss follows the valve flow, softer exhaled whoosh ----
      if (S.hiss) S.hiss.set({ vol: fv > 0.02 ? Math.min(0.2, 0.03 + fv * 0.09) : 0, freq: 600 + fv * 900, glide: 0.03 });
      if (S.exh) S.exh.set({ vol: fx > 0.02 && !S.check ? Math.min(0.1, fx * 0.07) : 0, freq: 350 + fx * 300, glide: 0.04 });

      // ---- numerics ----
      const m = S.meas, live = !S.dead && !S.check, okN = live && S.breaths >= 1;
      const d = (x, k = 0) => okN && x != null && isFinite(x) ? Math.max(0, x).toFixed(k) : '--';
      S.num('ppk', d(m.ppeak)); S.num('ppl', live && m.pplat != null ? m.pplat.toFixed(0) : '--'); S.num('peep', d(m.peep));
      S.num('vte', d(m.vte)); S.num('vti', 'VTi ' + d(m.vti)); S.num('mve', d(m.mve, 1)); S.num('rr', d(m.rr));
      S.num('fio2', S.dead ? '--' : Math.round(S.fio2m)); S.num('fio2s', 'set ' + (boost ? '100 (boost ' + Math.ceil(S.o2Until - t) + ' s)' : v.fio2));
      const { ti } = timing(v), modeTxt = (S.mode || v.mode) === 'vc' ? 'VC-CMV' : 'PC-CMV';
      S.num('st', S.dead ? 'VENTILATION STOPPED' : S.check ? `PRE-USE CHECK ${Math.min(CHECK.length, S.check.i + 1)}/${CHECK.length}` : `${modeTxt} · ${S.ph === 'insp' ? 'INSPIRATION' : S.ph === 'hold' ? 'INSP. HOLD' : 'EXPIRATION'}`);
      S.num('set', `${v.mode === 'vc' ? 'Vt ' + v.vt + ' mL' : 'Pinsp ' + v.pinsp}  RR ${v.rr}  PEEP ${v.peep}  I:E 1:${v.ie}  Ti ${ti.toFixed(2)} s`);

      // ---- alarms ----
      const set = (c, id, pr, tx) => { if (c && S.alarms[id] && S.alarms[id].pr !== pr) S.clear(id); c ? S.alarm(id, pr, tx) : S.clear(id); };
      const e = expected(v), on = live && S.breaths >= 2;
      const discD = on && m.ppeak < v.peep + 3 && m.vte < 0.2 * Math.max(1, m.vti);
      set(discD, 'disc', 'high', 'PATIENT DISCONNECTED / CIRCUIT OPEN');
      set(on && m.limited, 'pHi', 'high', 'PAW HIGH — INSPIRATION PRESSURE-LIMITED');
      set(on && m.ppeak < v.peep + 0.5 * (e.ppeak - v.peep), 'pLo', 'high', 'PAW LOW');
      set(on && m.peep > v.peep + 8, 'cpap', 'high', 'CONTINUOUS HIGH PRESSURE / PEEP HIGH');
      set(on && !discD && m.peep < v.peep - 3, 'peepLo', 'med', 'PEEP LOW');
      set(on && !discD && m.vte < 0.7 * e.vt, 'vteLo', 'med', 'VTe LOW');
      set(on && !discD && m.vti > 50 && m.vte < 0.8 * m.vti, 'leak', 'med', 'LEAK — VTe < VTi');
      set(on && m.mve < 0.6 * e.vt * v.rr / 1000, 'mvLo', 'med', 'MVe LOW');
      set(f.has('o2'), 'o2', 'high', 'O₂ SUPPLY PRESSURE LOW');
      S.fLoT = !S.dead && S.fio2m < v.fio2 - 5 ? S.fLoT + dt : 0;   // alarm delay so a set-point step does not trip it
      set(S.fLoT > 20, 'fio2Lo', 'med', 'FiO₂ LOW');
      set(on && Math.abs(S.fsGain - 1) > 0.25, 'fs', 'low', 'EXP. FLOW SENSOR — CHECK / CALIBRATE');
      set(f.has('mains'), 'ac', 'low', 'AC POWER LOST — ON BATTERY');
      set(f.has('mains') && !S.dead && S.batt < 40, 'batt', S.batt < 15 ? 'high' : 'med', 'BATTERY LOW');
      set(S.dead, 'dead', 'high', 'VENTILATION STOPPED — BATTERY DEPLETED');
    },
    stop(S) {
      S.hiss && S.hiss.stop(); S.exh && S.exh.stop(); S.hiss = S.exh = null;
      S.check = null; S.holdReq = false;
    }
  });
})();

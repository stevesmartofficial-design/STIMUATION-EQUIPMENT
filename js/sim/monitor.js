/* Live simulator — Patient Monitor (reference implementation for js/sim/*).
   Sweep ECG / pleth / respiration, QRS tone whose pitch follows SpO2,
   NIBP cycle with pump sound, prioritised physiological + technical alarms. */
(function () {
  const { W, Sound } = Sim;
  const RHYTHMS = [['nsr', 'Normal sinus rhythm'], ['af', 'Atrial fibrillation'], ['vt', 'Ventricular tachycardia'], ['vf', 'Ventricular fibrillation'], ['asys', 'Asystole']];

  Sim.register('patientMonitor', {
    title: 'Bedside patient monitor — live',
    intro: 'Live ECG, SpO₂ and respiration with QRS tone (pitch drops as SpO₂ falls), NIBP cycle and prioritised alarms. Change the patient, inject faults, listen.',
    stage: () => `<div class="mon">
      <div class="mon-waves">
        <canvas class="mon-c" id="cEcg"></canvas><canvas class="mon-c" id="cPleth"></canvas><canvas class="mon-c small" id="cResp"></canvas>
      </div>
      <div class="mon-nums">
        <div class="mn" style="--c:#36d39a"><small>HR bpm</small><b data-num="hr">--</b><i data-num="rhy"></i></div>
        <div class="mn" style="--c:#4dd0ff"><small>SpO₂ %</small><b data-num="spo2">--</b><i>PR <span data-num="pr">--</span></i></div>
        <div class="mn" style="--c:#f5b84a"><small>Resp rpm</small><b data-num="rr">--</b></div>
        <div class="mn" style="--c:#ff8fa3"><small>NIBP mmHg</small><b data-num="nibp" class="sm">--/--</b><i data-num="nibpS">Press “Start NIBP”</i></div>
        <div class="mn" style="--c:#c3a6ff"><small>Temp °C</small><b data-num="temp" class="sm">--</b></div>
        <div class="mn" style="--c:#8ea3c4"><small>Power</small><b data-num="pwr" class="sm">AC</b></div>
      </div></div>`,
    controls: [
      { id: 'rhythm', label: 'Rhythm', type: 'select', options: RHYTHMS, value: 'nsr' },
      { id: 'hr', label: 'Heart rate', type: 'range', min: 30, max: 180, value: 72, unit: 'bpm' },
      { id: 'spo2', label: 'SpO₂', type: 'range', min: 70, max: 100, value: 98, unit: '%' },
      { id: 'rr', label: 'Respiration', type: 'range', min: 0, max: 40, value: 16, unit: 'rpm' },
      { id: 'sys', label: 'Systolic BP', type: 'range', min: 60, max: 200, value: 120, unit: 'mmHg' },
      { id: 'temp', label: 'Temperature', type: 'range', min: 34, max: 41, step: 0.1, value: 36.8, unit: '°C' },
      { id: 'notch', label: 'Mains notch filter', type: 'toggle', value: false },
      { id: 'qrs', label: 'QRS tone', type: 'toggle', value: true }
    ],
    actions: [{ id: 'nibp', label: '⊕ Start NIBP', primary: true }, { id: 'freeze', label: '❚❚ Freeze' }, { id: 'test', label: '♪ Alarm sound test' }],
    faults: [
      { id: 'leadOff', label: 'ECG lead off (RA)', explain: 'One electrode lost contact: the ECG trace goes flat and a medium-priority technical alarm "LEADS OFF" appears, while SpO₂ and pulse rate continue.', check: 'Check electrode gel and contact, lead-wire continuity with a multimeter, then the trunk cable with a patient simulator.' },
      { id: 'mains', label: 'Mains interference (50/60 Hz)', explain: 'A thick, regular fuzz on the ECG baseline. Turning the notch filter on hides it, but the source is usually poor grounding, an unshielded cable, or electrodes that are dried out or mismatched.', check: 'Check the equipotential/earth connection, cable shielding, electrode condition and nearby equipment. Do not just leave the filter on.' },
      { id: 'motion', label: 'Motion artifact', explain: 'Large irregular deflections that can look like an arrhythmia. The pleth is also disturbed. The patient (or the cable) is moving.', check: 'Re-site the electrodes over bone, secure the cables, confirm with the pleth / pulse before calling an arrhythmia.' },
      { id: 'probeOff', label: 'SpO₂ probe off / damaged', explain: 'No pleth and SpO₂ shows "--". The technical alarm is "SpO₂ NO SENSOR", not a desaturation.', check: 'Swap in a known-good probe, inspect the connector pins, test with an SpO₂ simulator.' },
      { id: 'lowPerf', label: 'Low perfusion SpO₂ signal', explain: 'The pleth amplitude is tiny and the SpO₂ reading wanders. The quality index drops. Typical causes: a cold finger, a vasoconstricted patient or the wrong probe site.', check: 'Warm the site, try another site or probe type, then check the module with a simulator at a low perfusion index.' },
      { id: 'nibpLeak', label: 'NIBP cuff / hose leak', explain: 'The pump runs but cannot reach inflation pressure, then times out with "NIBP CUFF LEAK". No reading is given.', check: 'Pressure-hold (leak) test with a manometer, inspect the cuff bladder, hose and connectors.' },
      { id: 'battery', label: 'Mains lost + weak battery', explain: 'The monitor switches to battery and the charge falls quickly, causing a "BATTERY LOW" alarm. That means a failing battery or no mains supply.', check: 'Check the mains cable/outlet and fuse, then run a battery capacity test and replace the battery if it is below specification.' },
      { id: 'tempProbe', label: 'Temperature probe open circuit', explain: 'The temperature reading drops out ("--"). The thermistor or its cable is open circuit.', check: 'Measure the probe resistance against the expected thermistor curve, or test with a temperature simulator.' }
    ],

    init(S) {
      S.ecg = S.strip('#cEcg', { color: '#36d39a', min: -0.6, max: 1.3, label: 'II', unit: '×1  25 mm/s', speed: 125 });
      S.pleth = S.strip('#cPleth', { color: '#4dd0ff', min: -0.1, max: 1.1, label: 'Pleth', speed: 125, fill: true });
      S.resp = S.strip('#cResp', { color: '#f5b84a', min: -1.2, max: 1.2, label: 'Resp', speed: 40 });
      S.beatT = 0; S.nextBeat = 0.4; S.lastBeats = []; S.rrNow = 60 / S.v.hr; S.respPh = 0; S.batt = 100;
      S.nibp = null; S.vfPh = 0; S.frozen = false;
    },

    onAction(S, id) {
      if (id === 'freeze') { S.frozen = !S.frozen; S.log(S.frozen ? 'Waveforms frozen' : 'Waveforms running'); }
      if (id === 'test') { Sound.alarm('high'); setTimeout(() => Sound.alarm('med'), 3200); setTimeout(() => Sound.alarm('low'), 4800); S.log('Alarm sound test: high, medium, low priority'); }
      if (id === 'nibp') {
        if (S.nibp) return;
        S.nibp = { t: 0, p: 0, phase: 'inflate', target: Math.max(160, S.v.sys + 30) };
        S.pump = Sound.voice({ noise: true, filter: 'bandpass', freq: 380, q: 2 }); S.pump.set({ vol: 0.12 });
        S.motor = Sound.voice({ type: 'sawtooth', pitch: 46, freq: 300 }); S.motor.set({ vol: 0.05 });
        S.log('NIBP measurement started');
      }
    },
    onFault(S, id, on) { if (!on) { if (id === 'battery') S.batt = 100; } },

    tick(S, dt, t) {
      const v = S.v, f = S.fault;
      // ---- heart timing ----
      let rhythm = v.rhythm, hr = v.hr;
      if (rhythm === 'vt') hr = Math.max(150, hr); if (rhythm === 'asys' || rhythm === 'vf') hr = 0;
      if (t >= S.nextBeat && hr > 0) {
        let rr = 60 / hr; if (rhythm === 'af') rr *= 0.6 + Math.random() * 0.8;
        S.beatT = t; S.rrNow = rr; S.nextBeat = t + rr; S.lastBeats.push(t); S.lastBeats = S.lastBeats.filter(x => t - x < 8);
        const ecgOk = !f.has('leadOff');
        if (v.qrs && (ecgOk || !f.has('probeOff'))) {
          const sp = f.has('probeOff') ? 98 : v.spo2; // tone pitch follows SpO2
          Sound.beep(440 + (sp - 70) * 13, 0.07, { vol: 0.14, type: 'triangle' });
        }
      }
      const ecgAt = tt => {
        if (f.has('leadOff')) return W.noise(0.01);
        let y = 0;
        if (rhythm === 'vf') y = 0.35 * Math.sin(tt * 30) * Math.sin(tt * 4.3) + 0.2 * Math.sin(tt * 47 + Math.sin(tt * 3));
        else if (rhythm === 'asys') y = W.noise(0.01) + 0.02 * Math.sin(tt * 1.1);
        else {
          const ph = (tt - S.beatT) / S.rrNow;
          if (ph >= 0 && ph < 1) y = rhythm === 'vt' ? 0.9 * Math.sin(Math.PI * Math.min(1, ph * 2.2)) * (ph < 0.45 ? 1 : 0) - 0.25 * W.gauss(ph, 0.6, 0.08) : W.ecg(ph, { rr: S.rrNow, noP: rhythm === 'af' });
          if (rhythm === 'af') y += 0.04 * Math.sin(tt * 37) + 0.03 * Math.sin(tt * 23);
        }
        if (f.has('mains') && !v.notch) y += 0.12 * Math.sin(2 * Math.PI * 50 * tt);
        if (f.has('motion')) y += 0.5 * Math.sin(tt * 2.1) * Math.sin(tt * 0.7) + W.noise(0.12);
        return y + W.noise(0.008);
      };
      const plethAt = tt => {
        if (f.has('probeOff') || hr === 0) return NaN;
        const ph = (tt - S.beatT - 0.22) / S.rrNow, p = ph < 0 ? ph + 1 : ph;
        let y = 0.85 * W.gauss(p, 0.18, 0.09) + 0.3 * W.gauss(p, 0.42, 0.08);
        if (f.has('lowPerf')) y = y * 0.12 + 0.45 + W.noise(0.02);
        if (f.has('motion')) y += 0.25 * Math.sin(tt * 2.1);
        return y;
      };
      S.respPh += dt * v.rr / 60;
      const respAt = tt => v.rr === 0 ? W.noise(0.02) : Math.sin(2 * Math.PI * (S.respPh - (t - tt) * v.rr / 60)) * 0.9;
      if (!S.frozen) { S.ecg.advance(dt, t, ecgAt); S.pleth.advance(dt, t, plethAt); S.resp.advance(dt, t, respAt); }

      // ---- numerics ----
      const measHr = S.lastBeats.length > 1 ? Math.round(60 * (S.lastBeats.length - 1) / (S.lastBeats[S.lastBeats.length - 1] - S.lastBeats[0])) : 0;
      const shownHr = f.has('leadOff') ? '--' : rhythm === 'vf' ? '---' : rhythm === 'asys' ? 0 : measHr || '--';
      S.num('hr', shownHr); S.num('rhy', f.has('leadOff') ? 'LEADS OFF' : (RHYTHMS.find(r => r[0] === rhythm) || [])[1].replace('Normal sinus rhythm', 'Sinus'));
      const sp = f.has('probeOff') || hr === 0 ? '--' : f.has('lowPerf') ? Math.round(v.spo2 - 4 + Math.sin(t * 0.9) * 5) : v.spo2;
      S.num('spo2', sp); S.num('pr', f.has('probeOff') || hr === 0 ? '--' : measHr || '--');
      S.num('rr', v.rr); S.num('temp', f.has('tempProbe') ? '--' : v.temp.toFixed(1));
      if (f.has('battery')) { S.batt = Math.max(0, S.batt - dt * 1.5); S.num('pwr', 'BAT ' + Math.round(S.batt) + '%'); } else S.num('pwr', 'AC');

      // ---- NIBP cycle ----
      if (S.nibp) {
        const n = S.nibp; n.t += dt;
        if (n.phase === 'inflate') {
          n.p += dt * (f.has('nibpLeak') ? 9 : 45) - (f.has('nibpLeak') ? n.p * 0.04 * dt : 0);
          S.num('nibpS', 'Cuff ' + Math.round(n.p) + ' mmHg ↑');
          if (n.p >= n.target) { n.phase = 'deflate'; S.pump.set({ vol: 0 }); S.motor.set({ vol: 0 }); }
          if (n.t > 25) { n.phase = 'fail'; }
        } else if (n.phase === 'deflate') {
          n.p -= dt * 9; S.num('nibpS', 'Cuff ' + Math.round(n.p) + ' mmHg ↓');
          if (Math.floor(n.p / 6) !== Math.floor((n.p + dt * 9) / 6)) Sound.burst(0.03, { freq: 2400, vol: 0.12 }); // step-deflate valve tick
          if (n.p <= Math.max(40, v.sys * 0.55)) n.phase = 'done';
        }
        if (n.phase === 'done' || n.phase === 'fail') {
          S.pump.stop(); S.motor.stop(); Sound.burst(0.25, { filter: 'highpass', freq: 1500, vol: 0.15 });
          if (n.phase === 'done') {
            const dia = Math.round(v.sys * 0.65), map = Math.round((v.sys + 2 * dia) / 3);
            S.num('nibp', `${v.sys}/${dia}`); S.num('nibpS', `MAP ${map} · ${new Date().toLocaleTimeString().slice(0, 5)}`); S.log(`NIBP ${v.sys}/${dia} (${map})`, 'ok'); S.clear('nibpLeak');
            Sound.beep(880, 0.12, { vol: 0.12 });
          } else { S.num('nibp', '--/--'); S.num('nibpS', 'Measurement failed'); S.alarm('nibpLeak', 'med', 'NIBP CUFF LEAK / INFLATION TIMEOUT'); }
          S.nibp = null;
        }
      }

      // ---- alarms ----
      const set = (cond, id, pr, text) => cond ? S.alarm(id, pr, text) : S.clear(id);
      set(rhythm === 'vf' && !f.has('leadOff'), 'vf', 'high', 'VFIB / VTACH');
      set(rhythm === 'vt' && !f.has('leadOff'), 'vt', 'high', 'V-TACH');
      set(rhythm === 'asys' && !f.has('leadOff'), 'asys', 'high', 'ASYSTOLE');
      set(['nsr', 'af'].includes(rhythm) && !f.has('leadOff') && v.hr > 120, 'hrHi', 'med', 'HR HIGH > 120');
      set(['nsr', 'af'].includes(rhythm) && !f.has('leadOff') && v.hr < 45, 'hrLo', 'med', 'HR LOW < 45');
      set(!f.has('probeOff') && hr > 0 && v.spo2 < 90, 'spo2', v.spo2 < 85 ? 'high' : 'med', 'SpO₂ LOW < 90');
      set(v.rr === 0, 'apnea', 'high', 'APNEA');
      set(rhythm === 'af' && !f.has('leadOff'), 'af', 'low', 'IRREGULAR RHYTHM');
      set(f.has('leadOff'), 'leadOff', 'med', 'ECG LEADS OFF');
      set(f.has('probeOff'), 'probe', 'med', 'SpO₂ NO SENSOR');
      set(f.has('lowPerf'), 'perf', 'low', 'SpO₂ LOW SIGNAL QUALITY');
      set(f.has('mains') && !v.notch, 'noise', 'low', 'ECG NOISE');
      set(f.has('tempProbe'), 'temp', 'low', 'TEMP PROBE FAULT');
      set(f.has('battery') && S.batt < 60, 'batt', S.batt < 20 ? 'high' : 'med', 'BATTERY LOW — CONNECT AC');
      set(!f.has('tempProbe') && v.temp >= 38.5, 'tempHi', 'low', 'TEMP HIGH');
    },
    stop(S) { S.pump && S.pump.stop(); S.motor && S.motor.stop(); S.nibp = null; }
  });
})();

/* Procedural 3D models: Ventilator, Patient Monitor, Defibrillator, Infusion Pump. */
(function () {
  const PI = Math.PI;
  const ecgV = ph => { const g = (x, mu, s) => Math.exp(-((x - mu) ** 2) / (2 * s * s)); return .12 * g(ph, .14, .025) - .08 * g(ph, .24, .008) + g(ph, .255, .011) - .22 * g(ph, .275, .01) + .25 * g(ph, .5, .05); };
  /* Draw scrolling traces on a canvas screen. traces: [{c,f(t),y,h}] */
  const waveScreen = (title, traces, nums) => (ctx, w, h, t) => {
    ctx.fillStyle = '#02060d'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#8ea3c4'; ctx.font = '10px sans-serif'; ctx.fillText(title, 5, 11);
    const ww = w * .7;
    traces.forEach(tr => {
      ctx.strokeStyle = tr.c; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let x = 0; x < ww; x += 2) { const v = tr.f(t - (ww - x) / 90); const y = tr.y * h - v * tr.h * h; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.stroke();
    });
    (nums ? nums(t) : []).forEach(([l, v, c], i) => { ctx.fillStyle = c; ctx.font = '9px sans-serif'; ctx.fillText(l, ww + 6, 22 + i * (h - 18) / 3); ctx.font = 'bold 22px monospace'; ctx.fillText(v, ww + 6, 44 + i * (h - 18) / 3); });
  };
  const caster = (K, x, z) => K.group(K.cyl(.035, .035, .03, K.m.rubber(), [x, .035, z], [0, 0, PI / 2]), K.box(.03, .05, .03, K.m.steel(), [x, .07, z]));

  /* ===================== VENTILATOR ===================== */
  X3D.model('ventilator', (K) => {
    const T = K.T, m = K.m, S = { run: 0, ph: 0, rr: 15 };
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.add(K.box(.36, .04, .06, m.dark(), [Math.cos(a) * .18, .08, Math.sin(a) * .18], [0, -a, 0])); K.add(caster(K, Math.cos(a) * .36, Math.sin(a) * .36)); }
    K.add(K.cyl(.035, .035, .62, m.steel(), [0, .4, 0]));
    K.cover(K.rbox(.62, .42, .45, .05, m.shell(), [0, .92, 0]), { explode: [0, 0, -1.2] });
    const flow = t => S.run ? Math.max(0, Math.sin(2 * PI * (t * S.rr / 60))) : 0;
    const paw = t => { const ph = (t * S.rr / 60) % 1; return S.run ? (ph < .33 ? .25 + Math.min(1, ph * 6) * .75 : .25) : 0; };
    const disp = K.screen(.46, .3, waveScreen('VC-CMV · training', [{ c: '#f5b84a', f: paw, y: .45, h: .3 }, { c: '#36d39a', f: t => S.run ? Math.sin(2 * PI * t * S.rr / 60) * .8 : 0, y: .8, h: .15 }], () => [['Ppeak', S.run ? '22' : '--', '#f5b84a'], ['VTe', S.run ? '480' : '--', '#36d39a'], ['FiO2', '40', '#4dd0ff']]), [0, 0, .021], null, 200);
    K.part('display', K.at(K.group(K.rbox(.52, .36, .04, .02, m.dark(), [0, 0, 0]), disp), [0, 1.36, .05], [-.25, 0, 0]), { explode: [0, .5, .3] });
    const part = (id, obj, p, ex) => K.part(id, K.at(obj, p), { explode: ex });
    part('gasInlet', K.group(K.cyl(.025, .025, .08, m.metal(), [-.08, 0, 0], [PI / 2, 0, 0]), K.cyl(.025, .025, .08, m.metal(), [.08, 0, 0], [PI / 2, 0, 0]), K.box(.3, .08, .04, m.steel(), [0, 0, .04])), [-.1, .95, -.25], [0, 0, -.6]);
    K.add(K.tube([[-.18, .95, -.3], [-.3, .6, -.45], [-.4, .1, -.5]], .014, new T.MeshStandardMaterial({ color: 0x2bb34a, roughness: .5 })));
    K.add(K.tube([[-.02, .95, -.3], [-.1, .6, -.5], [-.15, .1, -.6]], .014, new T.MeshStandardMaterial({ color: 0xf2d43a, roughness: .5 })));
    part('blender', K.rbox(.12, .1, .1, .02, m.steel(), [0, 0, 0]), [-.18, 1.02, -.08], [-.4, .3, -.3]);
    part('valves', K.group(K.cyl(.025, .025, .09, m.metal(), [-.04, 0, 0]), K.cyl(.025, .025, .09, m.metal(), [.04, 0, 0])), [-.18, .85, -.08], [-.5, -.2, -.2]);
    const rotor = K.cyl(.06, .06, .02, m.metal(), [0, .03, 0]);
    for (let i = 0; i < 6; i++) rotor.add(K.box(.11, .015, .006, m.steel(), [0, 0, 0], [0, i / 6 * PI, 0]));
    part('turbine', K.group(K.cyl(.08, .08, .1, m.dark(), [0, -.02, 0]), rotor), [.02, .96, -.05], [0, .5, -.3]);
    part('inspValve', K.cyl(.03, .03, .1, m.accent(), [0, 0, 0], [0, 0, PI / 2]), [.16, 1.0, .05], [.4, .3, .1]);
    part('flowSensor', K.group(K.cyl(.025, .025, .08, m.glass(), [0, 0, 0], [0, 0, PI / 2]), K.box(.04, .02, .03, m.pcb(), [0, .03, 0])), [.16, .9, .12], [.5, .1, .3]);
    part('pressureSensor', K.group(K.box(.06, .015, .05, m.pcb(), [0, 0, 0]), K.cyl(.012, .012, .03, m.dark(), [0, .02, 0])), [.06, .86, .14], [.2, -.2, .5]);
    part('expValve', K.group(K.cyl(.05, .05, .04, m.shell2(), [0, 0, 0], [PI / 2, 0, 0]), K.cyl(.035, .035, .04, m.dark(), [0, 0, .03], [PI / 2, 0, 0])), [-.18, .86, .22], [-.4, -.2, .5]);
    part('peepValve', K.cyl(.025, .025, .06, m.orange(), [0, 0, 0], [PI / 2, 0, 0]), [-.06, .86, .2], [-.1, -.3, .6]);
    part('pcb', K.group(K.box(.4, .01, .3, m.pcb(), [0, 0, 0]), K.box(.05, .012, .05, m.dark(), [.08, .01, .05]), K.box(.03, .012, .03, m.dark(), [-.1, .01, -.05])), [0, 1.1, 0], [0, .7, 0]);
    part('battery', K.box(.18, .06, .12, m.dark(), [0, 0, 0]), [.15, .76, -.1], [.6, -.3, -.2]);
    part('psu', K.box(.14, .07, .14, m.steel(), [0, 0, 0]), [-.12, .76, -.1], [-.6, -.3, -.3]);
    part('alarm', K.group(K.cyl(.035, .02, .02, m.dark(), [0, 0, 0], [PI / 2, 0, 0]), K.box(.3, .02, .02, m.glow(0xff6b6b), [0, .25, .05])), [0, 1.08, .2], [0, .6, .5]);
    // circuit + test lung
    const circ = new T.MeshStandardMaterial({ color: 0xd6e9f7, roughness: .25, transparent: true, opacity: .85 });
    const lung = K.sph(.1, new T.MeshStandardMaterial({ color: 0x3b4b63, roughness: .7 }), [.62, .7, .45]);
    K.part('circuit', K.group(K.tube([[.25, 1.0, .22], [.45, 1.05, .45], [.55, .95, .5], [.62, .84, .45]], .022, circ), K.tube([[-.18, .86, .24], [.1, .7, .55], [.45, .82, .55], [.62, .84, .45]], .022, circ.clone()), K.cyl(.02, .02, .06, m.shell2(), [.62, .8, .45])), { explode: [.4, 0, .4] });
    K.add(lung);
    K.hazard('patient', [.62, .8, .45], .3, 'Patient circuit — loss of ventilation risk');
    K.hazard('chem', [-.1, .95, -.35], .3, 'High-pressure O₂ — oxygen-enriched atmosphere');
    let hiss, lastPh = 0;
    K.onTick((dt, t) => {
      rotor.rotation.y += dt * (S.run ? 60 : 4);
      const f = flow(t), ph = (t * S.rr / 60) % 1;
      const s = 1 + (S.run ? Math.max(0, Math.sin(PI * Math.min(1, ph * 1.3))) * .55 : 0); lung.scale.setScalar(s);
      if (hiss) hiss.set({ vol: f * .1, freq: 500 + f * 1300 });
      if (S.run && K.Sound && ph < lastPh) K.Sound.burst(.04, { freq: 1800, vol: .1 });
      if (S.run && K.Sound && lastPh < .4 && ph >= .4) K.Sound.burst(.06, { freq: 600, vol: .12 }); // exhalation valve
      lastPh = ph;
    });
    K.scan = {
      start(K) { S.run = 1; if (K.Sound) hiss = K.Sound.voice({ noise: true, filter: 'bandpass', freq: 900, q: .7 }); },
      tick() { }, stop() { S.run = 0; hiss && hiss.stop(); hiss = null; }
    };
    return { cam: [1.6, 1.6, 1.9], target: [.15, .9, .1] };
  });

  /* ===================== PATIENT MONITOR ===================== */
  X3D.model('patientMonitor', (K) => {
    const T = K.T, m = K.m, S = { run: 0, alarm: 0, lastBeat: 0 };
    K.add(K.cyl(.025, .025, 1.3, m.steel(), [0, .65, -.15]));
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.add(K.box(.3, .03, .05, m.dark(), [Math.cos(a) * .15, .05, Math.sin(a) * .15 - .15], [0, -a, 0])); K.add(caster(K, Math.cos(a) * .3, Math.sin(a) * .3 - .15)); }
    K.add(K.box(.12, .1, .12, m.steel(), [0, 1.2, -.1]));
    K.cover(K.rbox(.62, .44, .14, .04, m.shell(), [0, 1.35, 0]), { explode: [0, 0, -.8] });
    const hr = 72, hb = 60 / hr;
    const disp = K.screen(.5, .34, waveScreen('ICU bed 4 · training', [
      { c: '#36d39a', f: t => S.run ? ecgV((t % hb) / hb) : 0, y: .32, h: .22 },
      { c: '#4dd0ff', f: t => S.run ? Math.exp(-((((t - .25) % hb) / hb - .25) ** 2) / .01) * .8 : 0, y: .62, h: .2 },
      { c: '#f5b84a', f: t => S.run ? Math.sin(t * 1.6) * .6 : 0, y: .88, h: .1 }],
      () => [['HR', S.run ? hr : '--', '#36d39a'], ['SpO2', S.run ? '98' : '--', '#4dd0ff'], ['NIBP', S.run ? '118/76' : '--', '#ff8fa3']]), [0, 0, .001], null, 220);
    K.part('display', K.at(K.group(K.box(.52, .36, .01, m.dark(), [0, 0, -.005]), disp), [0, 1.37, .075]), { explode: [0, 0, .5] });
    const bar = K.box(.4, .03, .05, m.glow(0x1d3f73), [0, 1.6, 0]);
    K.part('alarm', K.group(bar, K.cyl(.03, .02, .02, m.dark(), [.22, 1.2, .07], [PI / 2, 0, 0])), { explode: [0, .4, 0] });
    const mods = [['ecgFront', 0x36d39a], ['spo2', 0x4dd0ff], ['nibp', 0xff8fa3], ['ibp', 0xff6b6b], ['temp', 0xc3a6ff], ['etco2', 0xf5b84a]];
    const rackM = K.group(K.rbox(.12, .44, .14, .02, m.shell2(), [0, 0, 0]));
    K.add(K.at(rackM, [.39, 1.35, 0]));
    mods.forEach(([id, c], i) => K.part(id, K.at(K.group(K.box(.1, .06, .13, m.shell(), [0, 0, 0]), K.box(.02, .03, .01, m.glow(c), [-.02, 0, .07]), K.cyl(.012, .012, .02, m.dark(), [.025, 0, .07], [PI / 2, 0, 0])), [.39, 1.52 - i * .07, .01]), { explode: [.35 + i * .02, (2.5 - i) * .06, .2] }));
    const cables = [[0x36d39a, [.42, 1.52, .09]], [0x4dd0ff, [.42, 1.45, .09]], [0xff8fa3, [.42, 1.38, .09]]];
    cables.forEach(([c, p], i) => K.add(K.tube([p, [p[0] + .15, p[1] - .2, .2], [p[0] + .1 - i * .1, .85, .35], [p[0] - i * .12, .7, .45]], .008, new T.MeshStandardMaterial({ color: c, roughness: .6 }))));
    K.part('mainPcb', K.box(.5, .3, .01, m.pcb(), [0, 1.35, -.03]), { explode: [0, 0, -.5] });
    K.part('psu', K.box(.16, .1, .06, m.steel(), [-.17, 1.24, -.03]), { explode: [-.4, -.2, -.3] });
    K.part('battery', K.box(.16, .06, .05, m.dark(), [.13, 1.22, -.03]), { explode: [.3, -.3, -.3] });
    K.part('network', K.group(K.box(.05, .03, .03, m.steel(), [-.2, 1.2, -.08]), K.box(.03, .02, .01, m.glow(0x36d39a), [-.2, 1.2, -.095])), { explode: [-.5, -.1, -.5] });
    K.add(K.tube([[-.2, 1.2, -.1], [-.3, 1.0, -.3], [-.4, .3, -.4], [-.6, .02, -.5]], .006, new T.MeshStandardMaterial({ color: 0x4da3ff })));
    K.hazard('patient', [.35, .75, .4], .3, 'Applied parts — patient leads (leakage current)');
    K.onTick((dt, t) => {
      if (!S.run) return;
      if (t - S.lastBeat > hb) { S.lastBeat = t; K.Sound && K.Sound.beep(820, .07, { vol: .12, type: 'triangle' }); }
      bar.material.color.setHex(S.alarm && Math.floor(t * 4) % 2 ? 0xff3b3b : 0x1d3f73);
    });
    let rang = false;
    K.scan = {
      start() { S.run = 1; S.alarm = 0; rang = false; },
      tick(K, dt, t, p) { if (p > .8 && !rang) { rang = true; S.alarm = 1; K.Sound && K.Sound.alarm('med'); } },
      stop() { S.run = 0; S.alarm = 0; }
    };
    return { cam: [1.3, 1.6, 1.4], target: [.1, 1.25, 0] };
  });

  /* ===================== DEFIBRILLATOR ===================== */
  X3D.model('defibrillator', (K) => {
    const T = K.T, m = K.m, S = { charge: 0, charging: 0, flash: 0 };
    K.add(K.box(1, .04, .7, m.shell2(), [0, .7, 0])); K.add(K.box(.04, .68, .04, m.steel(), [-.45, .35, -.3])); K.add(K.box(.04, .68, .04, m.steel(), [.45, .35, -.3])); K.add(K.box(.04, .68, .04, m.steel(), [-.45, .35, .3])); K.add(K.box(.04, .68, .04, m.steel(), [.45, .35, .3]));
    K.cover(K.group(K.rbox(.5, .32, .36, .05, m.shell(), [0, .88, 0]), K.torus(.12, .018, m.dark(), [0, 1.06, 0], [0, 0, 0], PI)), { explode: [0, .9, 0] });
    const disp = K.screen(.2, .14, waveScreen('Monitor · training', [{ c: '#36d39a', f: t => S.flash > 0 ? 1.2 : ecgV((t % .8) / .8) * (1 - S.charge * 0) , y: .6, h: .35 }], () => [['J', Math.round(S.charge * 200), '#f5b84a']]), [0, 0, .001], null, 160);
    K.part('display', K.at(K.group(K.box(.22, .16, .01, m.dark(), [0, 0, -.005]), disp), [-.08, .93, .181]), { explode: [0, 0, .5] });
    const btn = K.cyl(.025, .025, .015, m.glow(0xff5a2a), [.16, .9, .181], [PI / 2, 0, 0]); K.add(btn);
    K.add(K.cyl(.02, .02, .015, m.glow(0xf5b84a), [.16, .96, .181], [PI / 2, 0, 0]));
    const paddle = x => K.group(K.rbox(.08, .05, .14, .02, m.shell2(), [x, 0, 0]), K.box(.07, .01, .1, m.metal(), [x, -.03, 0]), K.cyl(.02, .02, .08, m.dark(), [x, .05, 0]));
    K.part('paddles', K.at(K.group(paddle(-.06), paddle(.06)), [.33, .82, 0]), { explode: [.6, .2, .3] });
    K.add(K.tube([[.27, .87, 0], [.4, .75, .15], [.3, .72, .25], [.2, .74, .2]], .007, m.rubber()));
    K.part('printer', K.at(K.group(K.cyl(.03, .03, .1, new T.MeshStandardMaterial({ color: 0xffffff }), [0, 0, 0], [0, 0, PI / 2]), K.box(.12, .02, .06, m.dark(), [0, .03, 0])), [-.15, 1.02, .1]), { explode: [-.2, .6, .3] });
    const capMat = m.metal();
    const cap = K.cyl(.06, .06, .18, capMat, [0, 0, 0]);
    K.part('capacitor', K.at(K.group(cap, K.cyl(.015, .015, .02, m.dark(), [.025, .1, 0]), K.cyl(.015, .015, .02, m.dark(), [-.025, .1, 0])), [.1, .88, -.08]), { explode: [.2, .3, -.6] });
    const part = (id, obj, p, ex) => K.part(id, K.at(obj, p), { explode: ex });
    part('battery', K.box(.2, .08, .12, m.dark(), [0, 0, 0]), [-.12, .76, -.08], [-.3, -.2, -.6]);
    part('charger', K.group(K.box(.12, .01, .14, m.pcb(), [0, 0, 0]), K.box(.04, .04, .04, m.copper(), [0, .025, 0])), [-.12, .86, -.06], [-.5, .1, -.4]);
    part('hvRelay', K.box(.05, .05, .07, m.orange(), [0, 0, 0]), [.2, .8, -.05], [.5, -.1, -.4]);
    part('waveform', K.group(K.box(.12, .01, .12, m.pcb(), [0, 0, 0]), ...[-.03, .03].map(x => K.box(.02, .04, .1, m.steel(), [x, .025, 0]))), [.2, .9, .05], [.6, .2, -.1]);
    part('ecg', K.box(.1, .01, .1, m.pcb(), [0, 0, 0]), [-.12, .96, .05], [-.4, .4, .1]);
    part('pacer', K.box(.08, .01, .08, m.pcb(), [0, 0, 0]), [-.02, .96, .05], [-.1, .5, .2]);
    part('controller', K.group(K.box(.14, .01, .12, m.pcb(), [0, 0, 0]), K.box(.04, .012, .04, m.dark(), [0, .01, 0])), [0, .78, .08], [0, -.3, .5]);
    part('selfTest', K.group(K.box(.05, .01, .05, m.pcb(), [0, 0, 0]), K.sph(.008, m.glow(0x36d39a), [0, .01, 0])), [-.2, .78, .12], [-.4, -.3, .5]);
    const arc = new T.PointLight(0x9fd0ff, 0, 1.5); arc.position.set(.33, .78, 0); K.scene.add(arc);
    K.hazard('hv', [.1, .88, -.05], .35, 'Energy storage capacitor — lethal stored charge');
    K.hazard('patient', [.33, .8, 0], .25, 'Defibrillation output — paddles / pads');
    let whine, ready = false;
    K.onTick((dt, t) => {
      if (S.charging) { S.charge = Math.min(1, S.charge + dt / 4); if (whine) whine.set({ pitch: 400 + S.charge * 2600, vol: .04 }); }
      capMat.emissive.setRGB(S.charge * .9, S.charge * .6, 0);
      btn.material.color.setHex(S.charge >= 1 && Math.floor(t * 3) % 2 ? 0xffffff : 0xff5a2a);
      arc.intensity = S.flash > 0 ? 6 : 0; S.flash -= dt;
    });
    K.scan = {
      start(K) { S.charge = 0; S.charging = 0; ready = false; },
      tick(K, dt, t, p) {
        const s = K.Sound;
        if (p > .2 && p < .6 && !S.charging && !ready) { S.charging = 1; if (s) { whine = s.voice({ type: 'sine', pitch: 400, freq: 5000 }); s.speak('Charging. Stand clear.'); } }
        if (S.charge >= 1 && !ready) { ready = true; S.charging = 0; if (whine) { whine.stop(); whine = null; } if (s) { whine = s.voice({ type: 'square', pitch: 1100, freq: 2200 }); whine.set({ vol: .03 }); } }
        if (p > .7 && ready && S.charge > 0) { S.charge = 0; S.flash = .15; if (whine) { whine.stop(); whine = null; } if (s) { s.burst(.35, { filter: 'lowpass', freq: 160, vol: .8 }); s.beep(60, .2, { vol: .4 }); } }
      },
      stop() { S.charging = 0; S.charge = 0; if (whine) { whine.stop(); whine = null; } }
    };
    return { cam: [1.1, 1.4, 1.2], target: [.05, .88, 0] };
  });

  /* ===================== INFUSION PUMP ===================== */
  X3D.model('infusionPump', (K) => {
    const T = K.T, m = K.m, S = { run: 0, ph: 0, drops: [] };
    K.add(K.cyl(.015, .015, 2.0, m.steel(), [0, 1, -.1]));
    for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; K.add(K.box(.3, .03, .04, m.dark(), [Math.cos(a) * .15, .05, Math.sin(a) * .15 - .1], [0, -a, 0])); K.add(caster(K, Math.cos(a) * .3, Math.sin(a) * .3 - .1)); }
    K.add(K.torus(.04, .006, m.steel(), [0, 1.98, -.1], [PI / 2, 0, 0]));
    const bag = K.rbox(.16, .26, .04, .03, new T.MeshStandardMaterial({ color: 0xcfe8ff, roughness: .1, transparent: true, opacity: .55 }), [0, 1.78, -.1]); K.add(bag);
    const chamber = K.cyl(.022, .022, .08, m.glass(), [0, 1.56, -.1]); K.add(chamber);
    K.part('dropSensor', K.group(K.torus(.032, .01, m.dark(), [0, 1.56, -.1], [PI / 2, 0, 0]), K.box(.03, .02, .01, m.glow(0x36d39a), [.035, 1.56, -.1])), { explode: [.3, 0, 0] });
    const tubeMat = new T.MeshStandardMaterial({ color: 0xe8f4ff, roughness: .2, transparent: true, opacity: .8 });
    K.add(K.tube([[0, 1.52, -.1], [.05, 1.4, -.05], [-.08, 1.25, .04], [-.12, 1.1, .05]], .006, tubeMat));
    K.add(K.tube([[.12, .88, .05], [.2, .7, .1], [.15, .4, .2], [.3, .2, .4]], .006, tubeMat.clone()));
    K.add(K.box(.08, .06, .1, m.steel(), [0, 1.0, -.07]));
    K.cover(K.rbox(.3, .26, .16, .03, m.shell(), [0, 1.0, .02]), { explode: [0, 0, -.7] });
    const door = K.rbox(.2, .2, .02, .02, new T.MeshStandardMaterial({ color: 0xdfe6ef, roughness: .3, transparent: true, opacity: .55 }), [-.03, 1.0, .1]);
    K.cover(door, { explode: [0, 0, .5] });
    const disp = K.screen(.1, .06, (c, w, h, t) => { c.fillStyle = '#02060d'; c.fillRect(0, 0, w, h); c.fillStyle = '#36d39a'; c.font = 'bold 22px monospace'; c.fillText(S.run ? '125' : '---', 8, 30); c.font = '11px sans-serif'; c.fillStyle = '#8ea3c4'; c.fillText('mL/h · VI ' + (S.ph * .02).toFixed(1), 8, 48); if (S.run) { c.fillStyle = '#36d39a'; c.fillRect(w - 16, 8, 8, 8); } }, [0, 0, .001], null, 140);
    K.part('display', K.at(K.group(K.box(.11, .07, .005, m.dark(), [0, 0, -.003]), disp), [.09, 1.07, .105]), { explode: [.2, .2, .4] });
    K.part('keypad', K.group(...[0, 1, 2].flatMap(r => [0, 1].map(c => K.box(.025, .018, .008, r === 2 && c === 0 ? m.glow(0x36d39a) : m.shell2(), [.075 + c * .032, .99 - r * .026, .105])))), { explode: [.3, -.1, .4] });
    const fingers = [];
    const mech = K.group(); for (let i = 0; i < 8; i++) { const f = K.box(.02, .012, .03, m.metal(), [0, .065 - i * .018, 0]); mech.add(f); fingers.push(f); }
    K.part('mechanism', K.at(mech, [-.05, .99, .06]), { explode: [-.3, 0, .3] });
    K.add(K.cyl(.004, .004, .2, tubeMat.clone(), [-.03, 1.0, .07]));
    const part = (id, obj, p, ex) => K.part(id, K.at(obj, p), { explode: ex });
    part('motor', K.group(K.cyl(.025, .025, .06, m.steel(), [0, 0, 0], [0, 0, PI / 2]), K.cyl(.01, .01, .03, m.metal(), [.04, 0, 0], [0, 0, PI / 2])), [-.08, .94, -.02], [-.4, -.2, -.3]);
    part('doorSensor', K.group(K.box(.015, .02, .01, m.dark(), [0, 0, 0]), K.sph(.004, m.glow(0x4dd0ff), [0, 0, .006])), [-.12, 1.1, .08], [-.35, .3, .2]);
    part('upOcclusion', K.box(.02, .015, .02, m.orange(), [0, 0, 0]), [-.03, 1.09, .06], [-.15, .35, .3]);
    part('downOcclusion', K.box(.02, .015, .02, m.orange(), [0, 0, 0]), [-.03, .91, .06], [-.15, -.35, .3]);
    part('airSensor', K.group(K.box(.025, .02, .02, m.dark(), [0, 0, 0]), K.box(.006, .006, .006, m.glow(0xff6b6b), [.013, 0, 0])), [-.03, .89, .06], [0, -.45, .35]);
    part('controller', K.group(K.box(.2, .15, .01, m.pcb(), [0, 0, 0]), K.box(.03, .03, .01, m.dark(), [.03, .02, .008])), [.03, 1.0, -.04], [0, 0, -.5]);
    part('battery', K.box(.1, .04, .06, m.dark(), [0, 0, 0]), [.07, .91, -.02], [.4, -.25, -.3]);
    part('psu', K.box(.06, .04, .05, m.steel(), [0, 0, 0]), [.08, 1.08, -.03], [.4, .25, -.3]);
    const drop = K.sph(.006, new T.MeshStandardMaterial({ color: 0x9fd0ff, transparent: true, opacity: .9 }), [0, 1.59, -.1]); drop.visible = false; K.add(drop);
    K.hazard('patient', [.3, .25, .4], .25, 'Fluid path to patient — free-flow / air embolism');
    let dropT = 0, tick = 0;
    K.onTick((dt, t) => {
      if (!S.run) { fingers.forEach(f => f.position.x = 0); return; }
      S.ph += dt * 6; fingers.forEach((f, i) => f.position.x = .008 * Math.sin(S.ph - i * .8));
      dropT += dt; if (dropT > .9) { dropT = 0; drop.position.y = 1.59; drop.visible = true; }
      if (drop.visible) { drop.position.y -= dt * .25; if (drop.position.y < 1.53) drop.visible = false; }
      if ((tick += dt) > .12) { tick = 0; K.Sound && K.Sound.burst(.012, { freq: 3200, vol: .04 }); }
    });
    K.scan = { start() { S.run = 1; K.Sound && K.Sound.beep(1500, .08, { vol: .1 }); }, tick() { }, stop() { S.run = 0; } };
    return { cam: [.9, 1.35, 1.0], target: [0, 1.1, 0] };
  });
})();

/* Procedural 3D models: CT, MRI, X-Ray, Ultrasound. Part ids match each
   equipment's components so clicking a part opens its service details. */
(function () {
  const PI = Math.PI;

  /* Shared bits */
  function patient(K, m) {
    const T = K.T, g = new T.Group(), skin = m || K.m.shell2();
    const body = K.mesh(new T.CapsuleGeometry(.17, 1.1, 8, 16), skin, [0, 0, 0], [PI / 2, 0, 0]);
    const head = K.sph(.12, skin, [0, .02, -.78]);
    const sheet = K.mesh(new T.CapsuleGeometry(.19, .9, 6, 16), new T.MeshStandardMaterial({ color: 0x8fb3d9, roughness: .9 }), [0, .01, .12], [PI / 2, 0, 0]);
    sheet.scale.set(1.05, 1, .8); g.add(body, head, sheet); return g;
  }
  function rack(K, h, leds) {
    const g = K.group(K.rbox(.6, h, .8, .03, K.m.dark(), [0, h / 2, 0]));
    for (let i = 0; i < Math.floor(h / .18); i++) {
      g.add(K.box(.52, .12, .02, K.m.steel(), [0, .15 + i * .18, .41]));
      g.add(K.box(.03, .02, .01, K.m.glow(i % 3 ? 0x36d39a : 0x4da3ff), [.2, .15 + i * .18, .425]));
    }
    return g;
  }
  function desk(K, screens) {
    const g = K.group(K.box(1.4, .05, .7, K.m.shell2(), [0, .74, 0]), K.box(.05, .72, .6, K.m.dark(), [-.65, .37, 0]), K.box(.05, .72, .6, K.m.dark(), [.65, .37, 0]),
      K.box(.5, .02, .18, K.m.dark(), [0, .78, .15]));
    screens.forEach((s, i) => { const x = (i - (screens.length - 1) / 2) * .62; g.add(K.box(.04, .3, .04, K.m.dark(), [x, .92, -.2]), K.box(.58, .36, .03, K.m.dark(), [x, 1.2, -.2])); s.position.set(x, 1.2, -.18); g.add(s); });
    return g;
  }
  const grayImg = (ctx, w, h, t, kind, prog) => {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) * .38;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, h * (prog == null ? 1 : prog)); ctx.clip();
    if (kind === 'ct') {
      ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.ellipse(cx, cy, r * .82, r, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6a6a6a'; ctx.beginPath(); ctx.ellipse(cx, cy, r * .74, r * .92, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#2a2a2a'; [[-.18, -.05], [.18, -.05]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(cx + a * r, cy + b * r, r * .1, r * .26, a * 1.5, 0, 7); ctx.fill(); });
    } else if (kind === 'mr') {
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.ellipse(cx, cy, r * .82, r, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#bbb'; ctx.beginPath(); ctx.ellipse(cx, cy, r * .72, r * .9, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#ececec'; ctx.lineWidth = 2; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(cx, cy, r * (.25 + i * .05), r * (.32 + i * .06), Math.sin(i) * .3, 0, 7); ctx.stroke(); }
      ctx.fillStyle = '#fff'; [[-.15, 0], [.15, 0]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(cx + a * r, cy + b * r, r * .07, r * .22, a, 0, 7); ctx.fill(); });
    } else {
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(w * .12, h * .1, w * .76, h * .82);
      ctx.fillStyle = '#2b2b2b'; [[-.17], [.17]].forEach(([a]) => { ctx.beginPath(); ctx.ellipse(cx + a * w, cy, w * .14, h * .3, 0, 0, 7); ctx.fill(); });
      ctx.strokeStyle = '#cfcfcf'; ctx.lineWidth = 3; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(cx, cy - h * .25 + i * h * .06, w * .36, h * .08, 0, 0, PI); ctx.stroke(); }
      ctx.fillStyle = '#fafafa'; ctx.fillRect(cx - 4, h * .1, 8, h * .8);
    }
    ctx.restore();
    ctx.fillStyle = '#4dd0ff'; ctx.font = '11px monospace'; ctx.fillText(kind.toUpperCase() + ' · training image', 6, 14);
  };
  const uiScreen = (title, sub) => (ctx, w, h, t) => {
    ctx.fillStyle = '#0a1424'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#4da3ff'; ctx.fillRect(0, 0, w, 18);
    ctx.fillStyle = '#04101f'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(title, 6, 13);
    ctx.fillStyle = '#8ea3c4'; ctx.font = '10px sans-serif'; (sub || []).forEach((s, i) => ctx.fillText(s, 8, 36 + i * 16));
  };

  /* ===================== CT ===================== */
  X3D.model('ct', (K) => {
    const T = K.T, m = K.m, GY = 1.15, S = { w: 0, target: 0, table: 0, tableT: 0, expo: false, img: 0 };
    const L = Object.assign({ cover: 0xdfe5ee, accent: 0x2f7de1, light: 0x4da3ff, bore: 70, round: .25, depth: .86 }, K.look || {});
    const RI = .4 * L.bore / 70, DEP = L.depth, tint = (mat, c) => { mat.color.setHex(c); return mat; };
    K.add(K.rbox(1.7, .36, 1.05, .06, m.shell2(), [0, .18, 0]));
    K.cover(K.ring(1.12, RI, DEP, tint(m.shell(), L.cover), [0, GY, 0], null, L.round), { explode: [0, 0, -2] });
    K.cover(K.group(K.ring(RI + .1, RI, DEP + .04, tint(m.accent(), L.accent), [0, GY, .01]), K.torus(RI + .05, .012, m.glow(L.light), [0, GY, DEP / 2 + .03]),
      K.ring(1.13, 1.08, DEP * .3, tint(m.accent(), L.accent), [0, GY, DEP * .36], null, L.round)), { explode: [0, 0, -2] });
    K.part('gantry', K.group(K.ring(1.04, .97, .74, m.steel(), [0, GY, 0], null, true), K.box(.3, .5, .6, m.steel(), [-.75, .55, 0]), K.box(.3, .5, .6, m.steel(), [.75, .55, 0])), { explode: [0, 0, 0] });
    K.part('slipRing', K.group(K.torus(.72, .03, m.copper(), [0, GY, -.36]), K.torus(.68, .03, m.copper(), [0, GY, -.36]), K.box(.1, .08, .08, m.dark(), [.0, GY + .72, -.42]), K.box(.1, .08, .08, m.dark(), [0, GY - .72, -.42])), { explode: [0, 0, -1.1] });
    const rotor = new T.Group(); rotor.position.set(0, GY, 0); K.add(rotor);
    K.part('gantry', K.ring(.93, .5, .1, m.metal(), [0, 0, .12]), { parent: rotor });
    K.part('tube', K.at(K.group(K.cyl(.16, .16, .48, m.metal(), [0, 0, 0], [PI / 2, 0, 0]), K.cyl(.17, .17, .05, m.dark(), [0, 0, .25], [PI / 2, 0, 0]), K.cyl(.17, .17, .05, m.dark(), [0, 0, -.25], [PI / 2, 0, 0]), K.cyl(.1, .1, .02, m.copper(), [0, 0, 0], [PI / 2, 0, 0])), [0, .72, 0]), { parent: rotor, explode: [0, .7, 0] });
    const col = K.part('collimator', K.box(.22, .09, .2, m.dark(), [0, .52, 0]), { parent: rotor, explode: [0, .45, .3] });
    K.part('bowtie', K.box(.16, .03, .12, m.gold(), [0, .46, 0]), { parent: rotor, explode: [0, .3, .5] });
    const det = K.mesh(new T.CylinderGeometry(.8, .8, .26, 48, 1, true, -.62, 1.24), new T.MeshStandardMaterial({ color: 0x2a3644, metalness: .6, roughness: .35, side: T.DoubleSide }), [0, 0, 0], [PI / 2, 0, 0]);
    const detG = K.group(det); for (let i = -6; i <= 6; i++) { const a = i * .095; detG.add(K.box(.07, .02, .24, m.gold(), [Math.sin(a) * .79, -Math.cos(a) * .79, 0], [0, 0, a])); }
    K.part('detector', detG, { parent: rotor, explode: [0, -.7, 0] });
    if (K.oem && K.oem.dual) { // second tube-detector pair at ~95 degrees
      const sub = new T.Group(); sub.rotation.z = -1.66; rotor.add(sub);
      K.part('tube', K.at(K.group(K.cyl(.14, .14, .42, m.metal(), [0, 0, 0], [PI / 2, 0, 0]), K.cyl(.15, .15, .05, m.dark(), [0, 0, .22], [PI / 2, 0, 0]), K.cyl(.15, .15, .05, m.dark(), [0, 0, -.22], [PI / 2, 0, 0])), [0, .74, 0]), { parent: sub, explode: [0, .7, 0] });
      const d2 = K.mesh(new T.CylinderGeometry(.8, .8, .24, 32, 1, true, -.36, .72), new T.MeshStandardMaterial({ color: 0x2a3644, metalness: .6, roughness: .35, side: T.DoubleSide }), [0, 0, 0], [PI / 2, 0, 0]);
      const d2g = K.group(d2); for (let i = -3; i <= 3; i++) { const a = i * .095; d2g.add(K.box(.07, .02, .22, m.gold(), [Math.sin(a) * .79, -Math.cos(a) * .79, 0], [0, 0, a])); }
      K.part('detector', d2g, { parent: sub, explode: [0, -.7, 0] });
    }
    K.part('das', K.group(...[-.3, 0, .3].map(x => K.box(.22, .1, .22, m.pcb(), [x, -.9 + Math.abs(x) * .15, 0]))), { parent: rotor, explode: [0, -1.1, .4] });
    K.part('generator', K.group(K.rbox(.22, .4, .32, .03, m.orange(), [-.72, 0, 0]), K.rbox(.22, .3, .32, .03, m.orange(), [.72, .05, 0])), { parent: rotor, explode: [0, 0, 1] });
    K.part('cooling', K.group(K.box(.26, .2, .1, m.steel(), [.48, .58, -.05], [0, 0, -.7]), K.cyl(.08, .08, .02, m.dark(), [.48, .58, .02], [PI / 2, 0, 0])), { parent: rotor, explode: [.5, .5, .5] });
    // fan beam
    const fan = new T.Shape(); fan.moveTo(0, .72); fan.lineTo(Math.sin(-.62) * .8, -Math.cos(-.62) * .8); fan.lineTo(Math.sin(.62) * .8, -Math.cos(.62) * .8); fan.closePath();
    const beam = new T.Mesh(new T.ShapeGeometry(fan), new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: .0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    rotor.add(beam);
    // table + cradle with patient
    K.part('table', K.group(K.rbox(.5, .45, 1.4, .05, m.shell2(), [0, .23, 2.0]), K.box(.32, .4, .32, m.shell(), [0, .62, 1.9])), { explode: [0, 0, 1.2] });
    const cradle = K.group(K.rbox(.46, .06, 2.4, .03, m.shell(), [0, 0, 0]), K.box(.42, .02, 2.2, m.accent(), [0, .035, 0]));
    const pat = patient(K); pat.position.set(0, .2, -.1); cradle.add(pat);
    K.part('table', cradle, { explode: [0, .4, 1.2] }); cradle.userData.base.set(0, .86, 1.5); cradle.position.set(0, .86, 1.5);
    // console / recon / pacs
    const imgScr = K.screen(.54, .32, (c, w, h, t) => grayImg(c, w, h, t, 'ct', S.img), null, null, 160);
    const uiScr = K.screen(.54, .32, (c, w, h, t) => { uiScreen('CT · Scan control', ['kV 120 · mAs 200 · rot 0.5 s', 'Gantry ' + Math.round(S.w * 60) + ' rpm', S.expo ? 'X-RAY ON' : 'Ready', 'Table ' + (S.table * 100).toFixed(0) + ' cm'])(c, w, h, t); if (S.expo) { c.fillStyle = '#ffcf3f'; c.fillRect(w - 26, 24, 18, 18); } }, null, null, 160);
    K.part('console', K.at(desk(K, [uiScr, imgScr]), [3.2, 0, 2.2], [0, -PI / 2.6, 0]), { explode: [.8, 0, .5] });
    K.part('recon', K.at(rack(K, 1.6), [3.4, 0, -1.2], [0, -PI / 2, 0]), { explode: [.8, 0, -.5] });
    K.part('pacs', K.at(rack(K, 1.2), [3.4, 0, -2.2], [0, -PI / 2, 0]), { explode: [.8, 0, -1] });
    K.add(K.tube([[.9, .1, -.4], [2, .05, -.8], [3.1, .05, -1.2]], .03, m.dark()));
    K.hazard('rad', [0, GY, .3], 2.2, 'Scatter radiation during exposure');
    K.hazard('hv', [0, GY, 0], .55, 'High voltage — generator & tube (rotor)');

    let hum, whoosh, xray;
    K.onTick((dt, t) => {
      S.w += (S.target - S.w) * Math.min(1, dt * (S.target > S.w ? .6 : .35));
      rotor.rotation.z -= S.w * dt * 2 * PI;
      S.table += (S.tableT - S.table) * Math.min(1, dt * .5);
      cradle.userData.base.z = 1.5 - S.table * 1.5;
      beam.material.opacity = S.expo ? .22 + Math.random() * .1 : 0;
      if (hum) { hum.set({ vol: Math.min(.12, S.w * .09), pitch: 30 + S.w * 40 }); whoosh.set({ vol: Math.min(.14, S.w * .1), freq: 300 + S.w * 500 }); }
      if (hum && S.target === 0 && S.w < .02) { hum.stop(); whoosh.stop(); hum = whoosh = null; }
    });
    K.scan = {
      start(K) { const s = K.Sound; if (s && !hum) { hum = s.voice({ type: 'sawtooth', pitch: 30, freq: 260 }); whoosh = s.voice({ noise: true, filter: 'bandpass', freq: 400, q: .8 }); } S.target = 1.6; S.img = 0; },
      tick(K, dt, t, p) {
        const on = p > .3 && p < .78;
        if (on !== S.expo) { S.expo = on; if (K.Sound) { if (on) { xray = K.Sound.voice({ type: 'sine', pitch: 1100, freq: 3000 }); xray.set({ vol: .03 }); } else if (xray) { xray.stop(); xray = null; } } }
        S.tableT = p > .2 ? Math.min(1, (p - .2) / .6) : 0;
        S.img = p > .55 ? Math.min(1, (p - .55) / .35) : 0;
      },
      stop() { S.target = 0; S.tableT = 0; S.expo = false; if (xray) { xray.stop(); xray = null; } }
    };
    return { cam: [5.2, 3.2, 5.8], target: [.6, 1, .3] };
  });

  /* ===================== MRI ===================== */
  X3D.model('mri', (K) => {
    const T = K.T, m = K.m, GY = 1.15, S = { table: 0, tableT: 0, rf: 0, img: 0, knock: 0, chirp: 0 };
    const L = Object.assign({ cover: 0xdfe5ee, accent: 0x2f7de1, light: 0x4da3ff, bore: 70, len: 1.7, flare: 1.08, field: '1.5 T' }, K.look || {});
    const RI = .34 * L.bore / 70, tint = (mat, c) => { mat.color.setHex(c); return mat; };
    const housing = K.group(K.ring(1.05, RI, L.len, tint(m.shell(), L.cover), [0, 0, 0]), K.ring(L.flare, RI, .12, tint(m.accent(), L.accent), [0, 0, L.len / 2 + .01]),
      K.torus(RI + .03, .014, m.glow(L.light), [0, 0, L.len / 2 + .08]), K.torus(L.flare - .03, .012, m.glow(L.light), [0, 0, L.len / 2 + .08]),
      K.rbox(1.6, .5, L.len * .88, .06, m.shell2(), [0, -.85, 0]));
    K.cover(K.at(housing, [0, GY, 0]), { explode: [0, 0, -2.8] });
    const cryoMat = m.metal(); cryoMat.transparent = true; cryoMat.opacity = .45;
    K.part('cryo', K.group(K.ring(.98, .92, 1.6, cryoMat, [0, GY, 0]), K.ring(.62, .6, 1.6, cryoMat.clone(), [0, GY, 0]),
      K.cyl(.12, .12, .5, m.steel(), [0, GY + 1.2, -.3]), K.cyl(.16, .16, .1, m.dark(), [0, GY + 1.0, -.3])), { explode: [0, 0, -1.8] });
    K.part('magnet', K.group(...[-.65, -.35, -.1, .1, .35, .65].map(z => K.torus(.77, .07, m.copper(), [0, GY, z]))), { explode: [0, 0, -.6] });
    K.part('shim', K.group(K.ring(.57, .55, 1.5, m.gold(), [0, GY, 0])), { explode: [0, 0, .7] });
    K.part('gradient', K.ring(.53, .45, 1.45, m.orange(), [0, GY, 0]), { explode: [0, 0, 1.6] });
    const cage = K.group(K.torus(.41, .02, m.copper(), [0, 0, .62]), K.torus(.41, .02, m.copper(), [0, 0, -.62]));
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; cage.add(K.cyl(.012, .012, 1.24, m.copper(), [Math.cos(a) * .41, Math.sin(a) * .41, 0], [PI / 2, 0, 0], 8)); }
    const rfGlow = new T.Mesh(new T.CylinderGeometry(.4, .4, 1.2, 32, 1, true), new T.MeshBasicMaterial({ color: 0xff5ec4, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    rfGlow.rotation.x = PI / 2; cage.add(rfGlow);
    K.part('rfCoil', K.at(cage, [0, GY, 0]), { explode: [0, 0, 2.5] });
    K.part('magMonitor', K.rbox(.3, .18, .25, .03, m.dark(), [.55, GY + 1.0, -.6]), { explode: [.6, .4, 0] });
    K.add(K.tube([[0, GY + 1.45, -.3], [-.8, 2.5, -.6], [-2.4, 2.2, -.8], [-2.8, 1.4, -.6]], .035, m.rubber()));
    // Faraday cage wall
    const wall = new T.Mesh(new T.PlaneGeometry(6, 2.8), new T.MeshStandardMaterial({ color: 0xc87533, metalness: .9, roughness: .4, transparent: true, opacity: .12, side: T.DoubleSide, depthWrite: false }));
    wall.position.set(2.3, 1.4, 0); wall.rotation.y = PI / 2; K.add(wall);
    K.add(K.box(.04, .9, 1.2, m.glass(), [2.3, 1.4, .3]));
    K.part('chiller', K.at(K.group(K.rbox(.8, 1.5, .7, .04, m.shell2(), [0, .75, 0]), K.cyl(.22, .22, .05, m.dark(), [0, 1.2, .36], [PI / 2, 0, 0])), [-3.1, 0, -.4]), { explode: [-.8, 0, 0] });
    K.part('rfAmp', K.at(rack(K, 1.8), [-3.1, 0, -1.6], [0, PI / 2, 0]), { explode: [-.8, 0, -.4] });
    K.part('table', K.group(K.rbox(.6, .7, 1.5, .06, m.shell2(), [0, .35, 2.3])), { explode: [0, 0, 1.6] });
    const cradle = K.group(K.rbox(.5, .06, 2.4, .03, m.shell(), [0, 0, 0]), K.group(K.cyl(.2, .2, .3, m.shell2(), [0, .12, -.95], [PI / 2, 0, 0])));
    const pat = patient(K); pat.position.set(0, .2, -.15); cradle.add(pat);
    cradle.position.set(0, .82, 1.9); K.part('table', cradle, { explode: [0, .4, 1.6] });
    const imgScr = K.screen(.54, .32, (c, w, h, t) => grayImg(c, w, h, t, 'mr', S.img), null, null, 160);
    const uiScr = K.screen(.54, .32, uiScreen('MR · Sequence · ' + L.field, ['T2 FSE  TR 4000  TE 100', 'He level 72% (training)', 'Coldhead: running', 'SAR: normal mode']), null, null, 160);
    K.part('console', K.at(desk(K, [uiScr, imgScr]), [3.6, 0, 1.2], [0, -PI / 2, 0]), { explode: [.8, 0, 0] });
    K.part('recon', K.at(rack(K, 1.6), [3.7, 0, -1], [0, -PI / 2, 0]), { explode: [.8, 0, -.4] });
    K.part('pacs', K.at(rack(K, 1.2), [3.7, 0, -1.9], [0, -PI / 2, 0]), { explode: [.8, 0, -.8] });
    K.hazard('mag', [0, GY, 0], 2.6, 'Static magnetic field (fringe field — illustrative)');
    K.hazard('chem', [0, GY + 1.3, -.3], .5, 'Cryogen / quench vent');

    K.onTick((dt, t) => {
      S.table += (S.tableT - S.table) * Math.min(1, dt * .5); cradle.userData.base.z = 1.9 - S.table * 1.8;
      rfGlow.material.opacity = S.rf;
      S.rf *= Math.pow(.02, dt);
      const s = K.Sound; if (!s || !s.ctx) return;
      if ((S.chirp += dt) > 1.15) { S.chirp = 0; s.burst(.18, { freq: 700, q: 3, vol: .03 }); s.beep(180, .12, { vol: .02, type: 'triangle' }); } // coldhead
    });
    const SEQ = [{ n: 'Localiser', r: .25, f: 600, b: 2 }, { n: 'T1 SE', r: .45, f: 500, b: 1 }, { n: 'T2 FSE', r: .12, f: 800, b: 4 }, { n: 'EPI / DWI', r: .012, f: 1400, b: 1 }];
    K.scan = {
      start() { S.tableT = 1; S.img = 0; },
      tick(K, dt, t, p) {
        const s = K.Sound; if (p < .18) return;
        const q = SEQ[Math.min(SEQ.length - 1, Math.floor((p - .18) / .2))];
        S.knock += dt; if (S.knock >= q.r) {
          S.knock = 0;
          if (s) for (let i = 0; i < q.b; i++) { s.burst(.035, { freq: q.f, q: 4, vol: .22, when: s.now + i * .06 }); s.beep(q.f / 4, .03, { type: 'square', vol: .05, when: s.now + i * .06, lp: 1200 }); }
          S.rf = .45;
        }
        S.img = Math.max(0, (p - .3) / .65);
      },
      stop() { S.tableT = 0; }
    };
    return { cam: [5.4, 3.2, 6], target: [0, 1.1, .4] };
  });

  /* ===================== X-RAY ===================== */
  X3D.model('xray', (K) => {
    const T = K.T, m = K.m, S = { rotor: 0, rotorT: 0, flash: 0, img: 0, lamp: 0 };
    K.add(K.box(.12, .04, 4, m.steel(), [-1.3, .02, 0]));
    K.add(K.box(.12, .04, 4, m.steel(), [-1.3, 2.9, 0]));
    const stand = K.group(K.box(.18, 2.85, .22, m.shell(), [0, 1.45, 0]), K.box(.9, .12, .14, m.shell2(), [.45, 2.05, 0]));
    K.add(K.at(stand, [-1.3, 0, 0]));
    K.part('tube', K.at(K.group(K.cyl(.17, .17, .55, m.shell(), [0, 0, 0], [0, 0, PI / 2]), K.cyl(.18, .18, .06, m.accent(), [.3, 0, 0], [0, 0, PI / 2]), K.cyl(.18, .18, .06, m.accent(), [-.3, 0, 0], [0, 0, PI / 2]), K.cyl(.09, .09, .02, m.copper(), [0, 0, 0], [0, 0, PI / 2])), [0, 2.0, 0]), { explode: [0, .5, 0] });
    K.part('collimator', K.group(K.rbox(.28, .2, .28, .03, m.shell2(), [0, 1.74, 0]), K.box(.2, .02, .2, m.glass(), [0, 1.63, 0]), K.cyl(.025, .025, .03, m.dark(), [.15, 1.74, .1], [0, 0, PI / 2])), { explode: [0, .25, .5] });
    const cone = new T.Mesh(new T.ConeGeometry(.42, 1.0, 4, 1, true), new T.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    cone.position.set(0, 1.12, 0); cone.rotation.y = PI / 4; K.add(cone);
    K.part('table', K.group(K.rbox(2.2, .08, .8, .03, m.shell(), [0, .8, 0]), K.box(.4, .72, .4, m.shell2(), [0, .38, 0]), K.box(1, .06, .6, m.dark(), [0, .03, 0])), { explode: [0, -.3, 1] });
    K.part('bucky', K.box(.55, .08, .55, m.steel(), [0, .7, 0]), { explode: [0, -.2, 1.5] });
    K.part('detector', K.box(.45, .03, .45, m.dark(), [0, .74, 0]), { explode: [0, -.6, 2] });
    K.part('aec', K.group(...[[-.1, -.05], [.1, -.05], [0, .1]].map(([x, z]) => K.box(.07, .006, .07, m.glow(0x4dd0ff), [x, .765, z]))), { explode: [0, -.4, 2.6] });
    const pat = patient(K); pat.position.set(0, .93, 0); pat.rotation.y = PI / 2; K.add(pat);
    K.part('generator', K.at(K.group(K.rbox(.7, 1.6, .7, .04, m.shell2(), [0, .8, 0]), K.box(.5, .08, .02, m.glow(0x36d39a), [0, 1.35, .36])), [-2.6, 0, -1.3]), { explode: [-.8, 0, 0] });
    K.part('psu', K.rbox(.5, .7, .5, .04, m.dark(), [-2.6, .35, -.3]), { explode: [-.8, 0, .3] });
    K.add(K.tube([[-2.4, 1.4, -1], [-1.6, 2.7, -.6], [-1.3, 2.8, -.1], [-.3, 2.2, -.05]], .03, m.rubber()));
    K.add(K.tube([[-2.4, 1.3, -1.05], [-1.5, 2.6, -.5], [-1.2, 2.7, .05], [.3, 2.2, .05]], .03, m.rubber()));
    const lead = new T.Mesh(new T.BoxGeometry(.05, 2, 1.4), m.glass()); lead.position.set(2.2, 1, 1.4); K.add(lead);
    const imgScr = K.screen(.54, .32, (c, w, h, t) => grayImg(c, w, h, t, 'dr', S.img), null, null, 160);
    const uiScr = K.screen(.54, .32, (c, w, h, t) => { uiScreen('X-ray console', ['Chest PA · 120 kV · 2.5 mAs', 'AEC: centre chamber', S.rotor > .9 ? 'READY' : S.rotor > .05 ? 'PREP…' : 'Standby'])(c, w, h, t); }, null, null, 160);
    K.part('console', K.at(desk(K, [uiScr]), [3, 0, 1.6], [0, -PI / 2, 0]), { explode: [.8, 0, 0] });
    K.part('workstation', K.at(desk(K, [imgScr]), [3, 0, .2], [0, -PI / 2, 0]), { explode: [.8, 0, -.3] });
    K.part('pacs', K.at(rack(K, 1.2), [3.1, 0, -1.4], [0, -PI / 2, 0]), { explode: [.8, 0, -.8] });
    K.hazard('rad', [0, 1, 0], 2, 'Primary beam + scatter during exposure');
    K.hazard('hv', [-2.6, .8, -1.3], .7, 'High voltage generator / HV cables');
    let whine;
    K.onTick((dt) => {
      S.rotor += (S.rotorT - S.rotor) * Math.min(1, dt * 1.2);
      cone.material.opacity = S.flash > 0 ? .55 : S.lamp * .14; S.flash -= dt;
      if (whine) whine.set({ pitch: 60 + S.rotor * 140, vol: S.rotor * .05 + .001 });
      if (whine && S.rotorT === 0 && S.rotor < .03) { whine.stop(); whine = null; }
    });
    let shot = false, ready = false;
    K.scan = {
      start(K) { shot = ready = false; S.img = 0; S.lamp = 1; },
      tick(K, dt, t, p) {
        const s = K.Sound;
        if (p > .25 && S.rotorT === 0 && !shot) { S.rotorT = 1; if (s) { whine = s.voice({ type: 'sawtooth', pitch: 60, freq: 900 }); } }
        if (S.rotor > .92 && !ready) { ready = true; s && s.beep(1200, .12, { vol: .1 }); }
        if (p > .55 && !shot) { shot = true; S.flash = .25; S.lamp = 0; s && s.beep(2000, .25, { vol: .14 }); setTimeout(() => S.rotorT = 0, 400); }
        if (shot) S.img = Math.min(1, S.img + dt * .8);
      },
      stop() { S.rotorT = 0; S.lamp = 0; }
    };
    return { cam: [4.4, 3, 4.6], target: [-.3, 1.1, 0] };
  });

  /* ===================== ULTRASOUND ===================== */
  X3D.model('ultrasound', (K) => {
    const T = K.T, m = K.m, S = { scan: 0, probeX: 0 };
    // base with casters
    K.add(K.rbox(.7, .12, .8, .04, m.dark(), [0, .14, 0]));
    [[-.3, -.32], [.3, -.32], [-.3, .32], [.3, .32]].forEach(([x, z]) => K.add(K.cyl(.05, .05, .04, m.rubber(), [x, .05, z], [0, 0, PI / 2])));
    K.cover(K.rbox(.56, .7, .6, .05, m.shell(), [0, .55, 0]), { explode: [0, 0, -1.4] });
    // board cage
    const cards = [['tx', m.pcb()], ['beamformer', m.pcb()], ['rx', m.pcb()], ['processing', m.pcb()], ['mainPcb', m.pcb()]];
    cards.forEach(([id, mat], i) => K.part(id, K.at(K.group(K.box(.02, .42, .44, mat, [0, 0, 0]), K.box(.025, .06, .1, m.gold(), [0, -.12, .12]), K.box(.026, .04, .04, m.dark(), [0, .08, -.1])), [-.2 + i * .1, .58, 0]), { explode: [(i - 2) * .22, .7, .3] }));
    K.part('psu', K.box(.4, .12, .4, m.steel(), [0, .3, 0]), { explode: [0, -.1, .9] });
    K.part('battery', K.box(.18, .1, .3, m.dark(), [.15, .3, -.05]), { explode: [.8, -.1, .5] });
    const fans = [K.cyl(.07, .07, .03, m.dark(), [-.12, .55, -.3], [PI / 2, 0, 0]), K.cyl(.07, .07, .03, m.dark(), [.12, .55, -.3], [PI / 2, 0, 0])];
    const blades = fans.map(f => { const b = K.box(.12, .015, .01, m.steel(), [0, 0, 0]); b.rotation.x = -PI / 2; f.add(b); return b; });
    K.part('cooling', K.group(...fans), { explode: [0, 0, -.9] });
    // control panel
    K.add(K.rbox(.8, .06, .5, .03, m.shell2(), [0, .96, .2], [-.2, 0, 0]));
    K.add(K.sph(.04, m.dark(), [.2, 1.0, .25]));
    for (let i = 0; i < 6; i++) K.add(K.box(.08, .015, .05, m.accent(), [-.3 + i * .07, .995, .1], [-.2, 0, 0]));
    // monitor on arm
    K.add(K.cyl(.025, .025, .5, m.steel(), [0, 1.2, -.15]));
    K.cover(K.rbox(.62, .42, .04, .02, m.dark(), [0, 1.55, -.12], [-.1, 0, 0]), { explode: [0, .4, 0] });
    const scr = K.screen(.56, .36, (c, w, h, t) => {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      const cx = w / 2, top = 14, R = h - 20; c.save(); c.beginPath(); c.moveTo(cx, top); c.arc(cx, top, R, PI / 2 - .6, PI / 2 + .6); c.closePath(); c.clip();
      for (let i = 0; i < 1400; i++) { const a = PI / 2 + (Math.random() - .5) * 1.2, r = Math.random() * R; const v = 40 + Math.random() * 120 * (S.scan ? 1 : .3); c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(cx + Math.cos(a) * r, top + Math.sin(a) * r, 2, 1.5); }
      if (S.scan) { c.fillStyle = '#000'; c.beginPath(); c.ellipse(cx + Math.sin(t * .7) * 20, top + R * .55, 18, 12, 0, 0, 7); c.fill(); c.strokeStyle = '#fff'; c.beginPath(); c.ellipse(cx + Math.sin(t * .7) * 20, top + R * .55, 19, 13, 0, 0, 7); c.stroke(); }
      c.restore(); c.fillStyle = '#4dd0ff'; c.font = '10px monospace'; c.fillText('B-mode · 5 MHz · training', 4, 11);
    }, [0, 1.55, -.095], [-.1, 0, 0], 200);
    K.part('display', scr, { explode: [0, .4, .1] });
    // probe + cable
    const probe = K.group(K.rbox(.05, .16, .035, .015, m.shell(), [0, 0, 0]), K.box(.052, .02, .036, m.dark(), [0, -.085, 0]));
    const piezo = K.group(K.box(.048, .008, .03, m.gold(), [0, -.097, 0]));
    K.part('probe', probe, { explode: [0, .3, .3] }); K.part('piezo', piezo, { explode: [0, -.1, .5] });
    const phantom = K.rbox(.4, .2, .3, .03, new T.MeshStandardMaterial({ color: 0x9ab7cf, roughness: .3, transparent: true, opacity: .8 }), [.75, .9, .2]);
    K.add(K.box(.5, .02, .4, m.shell2(), [.75, .79, .2])); K.add(K.cyl(.03, .03, .78, m.steel(), [.75, .4, .2])); K.add(phantom);
    const cable = K.tube([[.3, .9, .1], [.45, .6, .3], [.6, .9, .25], [.72, 1.1, .2]], .008, m.rubber()); K.add(cable);
    K.hazard('patient', [.75, 1.0, .2], .35, 'Applied part — probe face (leakage, surface temperature)');
    K.hazard('hv', [0, .5, 0], .4, 'Transmit high voltage / mains PSU');
    const place = () => { const x = .75 + S.probeX, y = 1.08; probe.position.set(x, y, .2); probe.userData.base.set(x, y, .2); piezo.userData.base.set(x, y - .0, .2); piezo.position.set(x, y, .2); };
    place();
    K.onTick((dt, t) => { blades.forEach(b => b.parent.rotation.y += dt * 25); if (S.scan) { S.probeX = Math.sin(t * .7) * .12; place(); } });
    let dop;
    K.scan = {
      start(K) { S.scan = 1; if (K.Sound) dop = K.Sound.voice({ noise: true, filter: 'bandpass', freq: 600, q: 4 }); },
      tick(K, dt, t, p) { if (dop) { const ph = (t % .85) / .85, v = Math.exp(-((ph - .15) ** 2) / .004) + .25; dop.set({ vol: p > .5 ? .18 * v : 0, freq: 250 + v * 900, glide: .02 }); } },
      stop() { S.scan = 0; if (dop) { dop.stop(); dop = null; } }
    };
    return { cam: [1.9, 1.7, 2.1], target: [.25, .9, 0] };
  });
})();

/* Procedural 3D models: CT, MRI, X-Ray, Ultrasound. Part ids match each
   equipment's components so clicking a part opens its service details.
   CT and MRI are parametric stylised replicas driven by BME.oem[..].look
   (published external dimensions in metres, bore in cm, colours and design cues).
   Scene units: 1 unit = 1 m. No logos, wordmarks or copied textures. */
(function () {
  const PI = Math.PI;

  /* Shared bits */
  function patient(K, m) {
    const T = K.T, g = new T.Group(), skin = m || new T.MeshStandardMaterial({ color: 0xd9b59a, roughness: .7 });
    const gown = new T.MeshStandardMaterial({ color: 0x9cb8d6, roughness: .9 });
    const torso = K.mesh(new T.CapsuleGeometry(.16, .5, 6, 16), gown, [0, .02, -.3], [PI / 2, 0, 0]); torso.scale.set(1.15, 1, .75);
    const legs = K.mesh(new T.CapsuleGeometry(.13, .7, 6, 16), new T.MeshStandardMaterial({ color: 0xc9d6e6, roughness: .95 }), [0, 0, .42], [PI / 2, 0, 0]); legs.scale.set(1.35, 1, .7);
    const head = K.sph(.1, skin, [0, .04, -.78]); head.scale.set(.9, .85, 1.05);
    g.add(torso, legs, head); return g;
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

  /* ---------- Geometry helpers for the parametric CT / MRI replicas ---------- */
  const IS_PHONE = () => Math.min(window.innerWidth || 1000, window.innerHeight || 1000) < 620;
  /* Materials: clear-coated plastics, satin trims. Created once per model build. */
  function mats(K, L) {
    const T = K.T, tone = c => { const x = new T.Color(c); x.multiplyScalar(.9); return x; };
    const P = (c, o) => new T.MeshPhysicalMaterial(Object.assign({ color: tone(c), roughness: .36, metalness: 0, clearcoat: .3, clearcoatRoughness: .3, envMapIntensity: .45 }, o));
    return {
      cover: P(L.cover), face: P(L.face != null ? L.face : L.cover), side: P(L.side != null ? L.side : L.cover, { roughness: .42, clearcoat: .3 }),
      bezel: P(L.bezel != null ? L.bezel : 0xdfe4ea, { clearcoat: .15, roughness: .45 }), rim: P(L.rim != null ? L.rim : 0x9aa1a9, { roughness: .32, metalness: .12, clearcoat: .5, envMapIntensity: .35 }),
      lining: P(L.lining != null ? L.lining : 0xf2f3f5, { roughness: .5, clearcoat: .15 }), kick: P(L.kick != null ? L.kick : 0x4a5058, { roughness: .55, clearcoat: .2 }),
      trim: new T.MeshStandardMaterial({ color: 0x9aa3ad, metalness: .75, roughness: .3 }),
      dark: new T.MeshStandardMaterial({ color: 0x252b33, roughness: .5, metalness: .1 }),
      glass: new T.MeshPhysicalMaterial({ color: 0x0b1018, roughness: .12, metalness: .1, clearcoat: 1, clearcoatRoughness: .05 }),
      mat: new T.MeshStandardMaterial({ color: L.mattress != null ? L.mattress : 0x56606d, roughness: .85 }),
      tableC: P(L.tableColor != null ? L.tableColor : 0xf3f4f6), tableS: P(L.tableSide != null ? L.tableSide : 0xd5dae0, { roughness: .45, clearcoat: .2 })
    };
  }
  /* [r, z] arc points around (cr, cz) */
  const arc = (cr, cz, rad, a0, a1, n = 6) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cr + rad * Math.cos(a), cz + rad * Math.sin(a)]; });
  /* Cubic funnel from the front face (Rf, zf) into the bore (Rb, zf - fl); round 0 = straight cone, 1 = full bull-nose */
  const funnel = (Rf, Rb, zf, fl, round = .55, n = 10, z2) => {
    const P0 = [Rf, zf], P1 = [Rf - (Rf - Rb) * round, zf], P2 = [Rb, zf - fl * (1 - round)], P3 = [Rb, zf - fl], out = [];
    for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0], u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1]]); }
    return out;
  };
  /* Lathe about the scanner (z) axis; profile in [radius, z]. Normal = (dz, -dr): order points so the outside is on the right. */
  function lathe(K, pts, mat, seg = 80) {
    const T = K.T, g = new T.LatheGeometry(pts.map(p => new T.Vector2(Math.max(0.0001, p[0]), p[1])), seg);
    const m = K.mesh(g, mat); m.rotation.x = PI / 2; return m;
  }
  /* Rounded rectangle shape with separate top / bottom corner radii */
  function rrect(T, x0, y0, x1, y1, rt, rb) {
    const s = new T.Shape(); rb = Math.max(.001, rb); rt = Math.max(.001, rt);
    s.moveTo(x0 + rb, y0); s.lineTo(x1 - rb, y0); s.absarc(x1 - rb, y0 + rb, rb, -PI / 2, 0, false);
    s.lineTo(x1, y1 - rt); s.absarc(x1 - rt, y1 - rt, rt, 0, PI / 2, false);
    s.lineTo(x0 + rt, y1); s.absarc(x0 + rt, y1 - rt, rt, PI / 2, PI, false);
    s.lineTo(x0, y0 + rb); s.absarc(x0 + rb, y0 + rb, rb, PI, PI * 1.5, false); return s;
  }
  /* Extruded slab (shape in x/y) centred on z, optional round hole at the origin, with soft bevel */
  function slab(K, shape, hole, depth, bev, mat) {
    const T = K.T;
    if (hole) { const h = new T.Path(); h.absarc(0, 0, hole, 0, PI * 2, true); shape.holes = [h]; }
    const g = new T.ExtrudeGeometry(shape, { depth: Math.max(.001, depth - bev * 2), bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev, bevelSegments: 4, curveSegments: 40 });
    g.translate(0, 0, -(depth - bev * 2) / 2); return K.mesh(g, mat);
  }
  /* Small push-button cluster (Siemens/GE style): centre pad + 4 keys + LED row */
  function keypad(K, M, x, y, z, ledC) {
    const T = K.T, g = new T.Group();
    g.add(K.cyl(.032, .034, .012, M.dark, [0, 0, 0], [PI / 2, 0, 0], 24));
    const ring = K.torus(.05, .006, new T.MeshBasicMaterial({ color: ledC || 0x7fb6ff }), [0, 0, .004]); ring.castShadow = false; g.add(ring);
    [[0, .075], [0, -.075], [.075, 0], [-.075, 0]].forEach(([a, b]) => g.add(K.cyl(.014, .014, .01, M.trim, [a, b, 0], [PI / 2, 0, 0], 12)));
    for (let i = 0; i < 4; i++) { const l = K.cyl(.009, .009, .006, i === 3 ? new T.MeshBasicMaterial({ color: 0xffb000 }) : M.trim, [-.045 + i * .03, -.13, 0], [PI / 2, 0, 0], 10); g.add(l); }
    g.position.set(x, y, z); return g;
  }
  /* Small live UI for gantry displays */
  const gantryUI = (S, label, accent) => (c, w, h, t) => {
    c.fillStyle = '#0c1522'; c.fillRect(0, 0, w, h); c.fillStyle = accent || '#3aa0ff'; c.fillRect(0, 0, w, h * .16);
    c.fillStyle = '#e8f1ff'; c.font = `bold ${Math.round(h * .11)}px sans-serif`; c.fillText(label, w * .05, h * .12);
    c.fillStyle = '#9fb3cc'; c.font = `${Math.round(h * .1)}px sans-serif`;
    c.fillText(S.expo ? 'X-RAY ON' : S.label || 'Ready', w * .05, h * .38); c.fillText('Table ' + Math.round((S.table || 0) * 100) + ' cm', w * .05, h * .56);
    c.fillStyle = S.expo ? '#ffcf3f' : '#36d39a'; c.beginPath(); c.arc(w * .85, h * .45, h * .1, 0, 7); c.fill();
    c.strokeStyle = '#36d39a'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i < w * .9; i += 3) { const ph = ((i / w) * 3 + t) % 1; c.lineTo(w * .05 + i, h * .82 - (ph < .06 ? Math.sin(ph / .06 * PI) * h * .12 : 0)); } c.stroke();
  };
  /* Faint horizontal grooves (Siemens CT body panels), procedural canvas */
  function grooveMat(K, base, pitch) {
    const T = K.T, c = document.createElement('canvas'); c.width = 4; c.height = 64; const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 4, 64); g.fillStyle = '#c3c8ce'; g.fillRect(0, 0, 4, 3); g.fillStyle = '#e6e9ec'; g.fillRect(0, 3, 4, 2);
    const tx = new T.CanvasTexture(c); tx.wrapS = tx.wrapT = T.RepeatWrapping; tx.repeat.set(1, 1 / pitch); tx.encoding = T.sRGBEncoding;
    const m = base.clone(); m.map = tx; return m;
  }

  /* ===================== CT ===================== */
  X3D.model('ct', (K) => {
    const T = K.T, m = K.m, S = { w: 0, target: 0, table: 0, tableT: 0, expo: false, img: 0 };
    const L = Object.assign({ style: 'box', W: 2.2, H: 1.95, D: 1.0, bore: 70, cover: 0xeef1f5, side: 0xd3d9e0, bezel: 0xdfe4ea, light: 0x4da3ff, ring: 0,
      rTop: .45, rBot: .08, ctl: 'buttons', disp: 'top', table: 'box', fl: .12, lip: .6, bez: .17 }, K.look || {});
    const W = L.W, H = L.H, D = L.D, RB = L.bore / 200, ISO = L.iso || Math.min(1.05, H * .54), zf = D / 2, zr = -D / 2;
    const M = mats(K, L), Rf = RB + L.bez, b = .045;
    const covers = []; // [mesh, explode]
    let faceZ = () => zf, Rmax; // z of the front face at radius r

    if (L.style === 'disc') {
      /* Siemens SOMATOM: round front "disc" in front of a rectangular body */
      const Rd = H - ISO - .005, dd = L.dd || Math.min(.36, D * .38), e1 = .07, e2 = L.e2 || .085, bulge = L.bulge != null ? L.bulge : .035;
      Rmax = Rd - .1;
      faceZ = r => zf + bulge * Math.max(0, Math.min(1, (Rd - e2 - r) / (Rd - e2 - Rf)));
      const prof = [[RB + .08, zf - dd], ...arc(Rd - e1, zf - dd + e1, e1, -PI / 2, 0, 5), ...arc(Rd - e2, zf - e2, e2, 0, PI / 2, 8)];
      for (let i = 1; i <= 6; i++) { const r = (Rd - e2) + (Rf - (Rd - e2)) * i / 6; prof.push([r, faceZ(r)]); }
      prof.push(...funnel(Rf, RB, zf + bulge, L.fl + bulge, L.lip));
      const disc = lathe(K, prof, M.face, 96); disc.position.y = ISO; covers.push([disc, [0, .25, 1.5]]);
      const bodyTop = H - ISO - (L.bodyDrop != null ? L.bodyDrop : .12), bodyD = D - dd + .02;
      const body = slab(K, rrect(T, -W / 2 + b, -ISO + .03 + b, W / 2 - b, bodyTop - b, .07, .02), RB + .012 + b, bodyD, b, M.side);
      body.position.set(0, ISO, zr + bodyD / 2); covers.push([body, [0, 0, -1.3]]);
      if (L.grooves) { // grooved front panels of the body (visible either side of the disc)
        const sh = rrect(T, -W / 2 + .01, -ISO + .05, W / 2 - .01, bodyTop - .01, .06, .02); const hh = new T.Path(); hh.absarc(0, 0, Rd - .05, 0, PI * 2, true); sh.holes = [hh];
        const gm = grooveMat(K, M.side, .085), pl = K.mesh(new T.ShapeGeometry(sh, 32), gm); pl.receiveShadow = true; pl.castShadow = false;
        pl.position.set(0, ISO, zf - dd + .021); covers.push([pl, [0, 0, -1.3]]);
      }
      // dark kick plate under the disc
      const kick = K.rbox(Math.min(W * .62, Rd * 1.3), .1, dd + .12, .03, M.kick, [0, .05, zf - dd / 2 - .02]); covers.push([kick, [0, 0, .6]]);
      if (L.rear) { // go.Up: rear of the bore opens wider (published asymmetric bore) — shown as a rear trumpet ring
        const rr = lathe(K, [[RB + .02, zr - .004], [L.rear / 200, zr - .004], [L.rear / 200 + .05, zr - .006]], M.lining, 72); rr.position.y = ISO;
        const cone = lathe(K, [[L.rear / 200, zr - .02], [RB + .012, zr + .25]], M.lining, 72); cone.position.y = ISO; covers.push([K.group(rr, cone), [0, 0, -1.3]]);
      }
    } else {
      /* GE / Philips: rounded-rectangle gantry, front cover + side band + rear cover */
      Rmax = Math.min(H - ISO, W / 2) - .14;
      const Df = L.Df || Math.min(.34, D * .3), Dr = L.Dr || Math.min(.3, D * .26), out = ins => rrect(T, -W / 2 + ins, -ISO + ins, W / 2 - ins, H - ISO - ins, L.rTop - ins, L.rBot);
      const front = slab(K, out(b), Rf + b + .004, Df, b, M.cover); front.position.set(0, ISO, zf - Df / 2); covers.push([front, [0, .25, 1.5]]);
      const midD = D - Df - Dr + .04, mid = slab(K, out(b + (L.inset != null ? L.inset : .03)), RB + .012 + b, midD, b * .5, M.side);
      mid.position.set(0, ISO, zr + Dr - .02 + midD / 2); covers.push([mid, [0, 0, -.5]]);
      const rear = slab(K, out(b), RB + .012 + b, Dr, b, M.cover); rear.position.set(0, ISO, zr + Dr / 2); covers.push([rear, [0, 0, -1.4]]);
      if (L.kickH) { const k = K.rbox(W - .2, L.kickH, D - .1, .02, M.kick, [0, L.kickH / 2, 0]); covers.push([k, [0, 0, 0]]); }
      if (L.sideBand) { // Philips coloured side panels
        [-1, 1].forEach(s => { const p = K.rbox(.05, H * .78, D - Df - Dr + .02, .02, new T.MeshPhysicalMaterial({ color: L.sideBand, roughness: .35, clearcoat: .6 }), [s * (W / 2 - .01), H * .41, zr + Dr + (D - Df - Dr) / 2]); covers.push([p, [s * .6, 0, 0]]); });
      }
      const bz = lathe(K, [[Rf + b + .006, zf - .004], ...funnel(Rf + b * .3, RB, zf - .001, L.fl, L.lip)], M.bezel, 96); bz.position.y = ISO; covers.push([bz, [0, .25, 1.5]]);
    }
    // bore lining through the gantry
    const lin = lathe(K, [[RB, zf - L.fl - .002], [RB, zr + .01], [RB + .02, zr - .002]], M.lining, 96); lin.position.y = ISO; covers.push([lin, [0, 0, -.9]]);
    covers.forEach(([o, ex]) => K.cover(o, { explode: ex }));
    const fz = r => faceZ(r) + .006;

    /* ---- gantry front details (lights, displays, controls, camera, vents) ---- */
    const det = new T.Group(); det.position.y = ISO;
    if (L.style === 'disc') { const sm = K.torus(Rf + .035, .004, M.dark, [0, 0, fz(Rf + .035) - .003]); sm.castShadow = false; det.add(sm); }
    if (L.ring) { const r = K.torus(Rf + .004, .009, new T.MeshBasicMaterial({ color: L.ring }), [0, 0, fz(Rf) - .004]); r.castShadow = false; det.add(r); }
    const ui = (w, h, label, x, y, rx) => { const sc = K.screen(w, h, gantryUI(S, label, '#' + (L.light || 0x3aa0ff).toString(16).padStart(6, '0')), [x, y, fz(Math.hypot(x, y)) + .012], [rx || 0, 0, 0], 96); return sc; };
    const bezelBox = (w, h, x, y, rx) => K.rbox(w + .03, h + .03, .03, .012, M.glass, [x, y, fz(Math.hypot(x, y))], [rx || 0, 0, 0]);
    if (L.disp === 'top') { // GE: display panel at the top of the front cover
      const y = H - ISO - .2, x = L.dispX || 0; det.add(bezelBox(.3, .15, x, y, -.18), ui(.28, .13, 'Gantry', x, y, -.18));
    } else if (L.disp === 'above') { det.add(bezelBox(.16, .12, 0, Rf + .2), ui(.15, .11, 'Pat', 0, Rf + .2)); }
    else if (L.disp === 'wide') { det.add(bezelBox(.44, .16, 0, Rf + .21), ui(.42, .14, 'Scan', 0, Rf + .21)); }
    if (L.ctl === 'buttons') [-1, 1].forEach(s => det.add(keypad(K, M, s * (Rf + .17), .02, fz(Rf + .17) + .004, L.light)));
    else if (L.ctl === 'touch') [-1, 1].forEach(s => { const x = s * (Rf + .2), y = .16; det.add(bezelBox(.15, .23, x, y), ui(.14, .21, 'Touch', x, y), K.cyl(.025, .025, .015, M.dark, [x, y - .19, fz(Rf + .2) + .006], [PI / 2, 0, 0], 20)); });
    else if (L.ctl === 'panel') [-1, 1].forEach(s => { const x = s * (Rf * .74 + .12), y = Rf * .74; det.add(K.rbox(.3, .1, .04, .015, M.side, [x, y, fz(Rf) + .015]), K.box(.12, .05, .006, new T.MeshBasicMaterial({ color: 0xffb54a }), [x + .05, y, fz(Rf) + .036]), K.cyl(.014, .014, .01, new T.MeshBasicMaterial({ color: 0xff4b4b }), [x - .1, y, fz(Rf) + .036], [PI / 2, 0, 0], 12)); });
    else if (L.ctl === 'tablet') { // go.: tablet docked on the gantry front + remote
      const x = -(Rf + .26), y = .3; det.add(K.rbox(.2, .27, .03, .014, M.dark, [x, y, fz(Rf + .26) + .01], [0, .25, 0]), ui(.17, .23, 'go.', x + .006, y, 0));
      det.children[det.children.length - 1].rotation.y = .25; det.add(K.rbox(.05, .13, .03, .012, M.side, [Rf + .23, .04, fz(Rf + .23) + .01]));
    }
    if (L.cam) det.add(K.rbox(.07, .035, .03, .01, M.dark, [0, Rf + .04, fz(Rf + .04) + .004]));
    if (L.laser !== false) [-1, 1].forEach(s => det.add(K.box(.05, .016, .01, M.dark, [s * (Rf + .05), 0, fz(Rf + .05)])));
    if (L.mood) { // ambient/mood light bar on top of the gantry front
      const y = H - ISO - .07, z = fz(y); const bar = K.rbox(.4, .045, .03, .015, M.side, [0, y, z]); const gl = K.box(.34, .016, .012, new T.MeshBasicMaterial({ color: L.mood }), [0, y - .004, z + .012]); gl.castShadow = false; det.add(bar, gl);
    }
    if (L.vents) for (let i = 0; i < 7; i++) { const a = PI * .62 + i * .055, r = H - ISO - .2; det.add(K.box(.12, .012, .01, M.dark, [Math.cos(a) * r, Math.sin(a) * r, fz(r) + .002], [0, 0, a + PI / 2])); }
    K.cover(det, { explode: [0, .25, 1.5] });

    /* ---- internals (sized to the bore and the gantry) ---- */
    const Rin = RB + .06, Rout = Math.max(Rin + .25, Rmax), rt = Math.min(Rout - .14, RB + .3);
    K.part('gantry', K.group(K.ring(Rout + .07, Rout + .01, .5, m.steel(), [0, ISO, -.05], null, .3), K.box(.3, ISO - Rout + .12, .6, m.steel(), [-(Rout - .1), (ISO - Rout + .1) / 2, -.05]), K.box(.3, ISO - Rout + .12, .6, m.steel(), [Rout - .1, (ISO - Rout + .1) / 2, -.05])), { explode: [0, 0, 0] });
    K.part('slipRing', K.group(K.torus(Rout - .1, .025, m.copper(), [0, ISO, zr + .14]), K.torus(Rout - .16, .025, m.copper(), [0, ISO, zr + .14]), K.box(.1, .08, .08, m.dark(), [0, ISO + Rout - .06, zr + .1]), K.box(.1, .08, .08, m.dark(), [0, ISO - Rout + .06, zr + .1])), { explode: [0, 0, -1.1] });
    const rotor = new T.Group(); rotor.position.set(0, ISO, 0); K.add(rotor);
    K.part('gantry', K.ring(Rout - .02, Rin, .08, m.metal(), [0, 0, .1]), { parent: rotor });
    const tubeAsm = (r, s) => K.group(K.cyl(.13 * s, .13 * s, .42 * s, m.metal(), [0, 0, 0], [PI / 2, 0, 0]), K.cyl(.14 * s, .14 * s, .05, m.dark(), [0, 0, .22 * s], [PI / 2, 0, 0]), K.cyl(.14 * s, .14 * s, .05, m.dark(), [0, 0, -.22 * s], [PI / 2, 0, 0]), K.cyl(.08 * s, .08 * s, .02, m.copper(), [0, -.12 * s, 0], [0, 0, 0]));
    K.part('tube', K.at(tubeAsm(rt, 1), [0, rt, 0]), { parent: rotor, explode: [0, .7, 0] });
    K.part('collimator', K.box(.2, .07, .18, m.dark(), [0, rt - .17, 0]), { parent: rotor, explode: [0, .45, .3] });
    K.part('bowtie', K.box(.15, .025, .12, m.gold(), [0, rt - .22, 0]), { parent: rotor, explode: [0, .3, .5] });
    const rd = RB + .07, detArc = (half, w) => { const g = K.group(K.mesh(new T.CylinderGeometry(rd, rd, w, 40, 1, true, PI - half, half * 2), new T.MeshStandardMaterial({ color: 0x2a3644, metalness: .6, roughness: .35, side: T.DoubleSide }), [0, 0, 0], [PI / 2, 0, 0])); const n = Math.round(half / .09); for (let i = -n; i <= n; i++) { const a = i * .09; g.add(K.box(.06, .02, w - .02, m.gold(), [Math.sin(a) * (rd + .015), -Math.cos(a) * (rd + .015), 0], [0, 0, a])); } return g; };
    K.part('detector', detArc(.62, .24), { parent: rotor, explode: [0, -.7, 0] });
    if (K.oem && K.oem.dual) { // second tube-detector pair at ~95 degrees
      const sub = new T.Group(); sub.rotation.z = -1.66; rotor.add(sub);
      K.part('tube', K.at(tubeAsm(rt, .9), [0, rt, 0]), { parent: sub, explode: [0, .7, 0] });
      K.part('detector', detArc(.36, .22), { parent: sub, explode: [0, -.7, 0] });
    }
    const rDas = Math.min(Rout - .08, rd + .17);
    K.part('das', K.group(...[-.32, 0, .32].map(a => K.box(.2, .08, .2, m.pcb(), [Math.sin(a) * rDas, -Math.cos(a) * rDas, 0], [0, 0, a]))), { parent: rotor, explode: [0, -1.1, .4] });
    const rg = (Rin + Rout) / 2 + .02;
    K.part('generator', K.group(K.rbox(.2, .36, .3, .03, m.orange(), [-rg, 0, 0]), K.rbox(.2, .28, .3, .03, m.orange(), [rg, .04, 0])), { parent: rotor, explode: [0, 0, 1] });
    K.part('cooling', K.group(K.box(.24, .18, .1, m.steel(), [Math.sin(.75) * rg, Math.cos(.75) * rg, -.05], [0, 0, -.75]), K.cyl(.07, .07, .02, m.dark(), [Math.sin(.75) * rg, Math.cos(.75) * rg, .02], [PI / 2, 0, 0])), { parent: rotor, explode: [.5, .5, .5] });
    const fan = new T.Shape(); fan.moveTo(0, rt - .2); fan.lineTo(Math.sin(-.62) * rd, -Math.cos(-.62) * rd); fan.lineTo(Math.sin(.62) * rd, -Math.cos(.62) * rd); fan.closePath();
    const beam = new T.Mesh(new T.ShapeGeometry(fan), new T.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    rotor.add(beam);

    /* ---- patient table ---- */
    const topY = ISO - (L.tableDrop || .2), z0 = zf + 1.2;
    const base = new T.Group();
    if (L.table === 'pedestal' || L.table === 'fluted') {
      const foot = K.cyl(.34, .38, .07, M.tableS, [0, .035, z0 + .25], null, 48); foot.scale.set(1, 1, 1.7); base.add(foot);
      const colH = topY - .2; base.add(K.rbox(.36, colH, .6, .08, M.tableC, [0, colH / 2 + .05, z0 + .25]));
      if (L.table === 'fluted') for (let i = 0; i < 5; i++) [-1, 1].forEach(s => base.add(K.box(.008, colH * .8, .05, M.tableS, [s * .182, colH * .45 + .05, z0 + .05 + i * .1])));
      base.add(K.rbox(.5, .11, 2.1, .04, M.tableC, [0, topY - .11, z0 + .15]), K.box(.52, .025, 2.0, M.tableS, [0, topY - .16, z0 + .15]));
    } else {
      const bh = topY - .12; base.add(K.rbox(.58, bh, 1.9, .05, M.tableC, [0, bh / 2, z0 + .3]), K.box(.6, .06, 1.9, M.kick, [0, .03, z0 + .3]), K.box(.585, .015, 1.6, M.tableS, [0, bh * .62, z0 + .3]));
      base.add(K.rbox(.54, .1, 2.15, .04, M.tableC, [0, topY - .1, z0 + .1]));
    }
    K.part('table', base, { explode: [0, 0, 1.2] });
    const cradle = K.group(K.rbox(.46, .045, 2.2, .02, M.tableC, [0, 0, 0]), K.rbox(.42, .05, 1.85, .025, M.mat, [0, .045, .12]),
      K.rbox(.26, .07, .28, .03, M.tableS, [0, .06, -.98]));
    const pat = patient(K); pat.position.set(0, .2, -.05); cradle.add(pat);
    K.part('table', cradle, { explode: [0, .4, 1.2] }); cradle.userData.base.set(0, topY + .025, z0); cradle.position.set(0, topY + .025, z0);

    /* ---- control room ---- */
    const imgScr = K.screen(.54, .32, (c, w, h, t) => grayImg(c, w, h, t, 'ct', S.img), null, null, 160);
    const uiScr = K.screen(.54, .32, (c, w, h, t) => { uiScreen('CT · Scan control', ['kV 120 · mAs 200 · rot ' + (L.rot || '0.5') + ' s', 'Gantry ' + Math.round(S.w * 60) + ' rpm', S.expo ? 'X-RAY ON' : 'Ready', 'Table ' + (S.table * 100).toFixed(0) + ' cm'])(c, w, h, t); if (S.expo) { c.fillStyle = '#ffcf3f'; c.fillRect(w - 26, 24, 18, 18); } }, null, null, 160);
    const cx = W / 2 + 1.9;
    K.part('console', K.at(desk(K, [uiScr, imgScr]), [cx, 0, 2.3], [0, -PI / 2.6, 0]), { explode: [.8, 0, .5] });
    K.part('recon', K.at(rack(K, 1.6), [cx + .2, 0, -1.1], [0, -PI / 2, 0]), { explode: [.8, 0, -.5] });
    K.part('pacs', K.at(rack(K, 1.2), [cx + .2, 0, -2.1], [0, -PI / 2, 0]), { explode: [.8, 0, -1] });
    K.add(K.tube([[W / 2 - .2, .06, -.3], [W / 2 + .8, .04, -.8], [cx + .1, .04, -1.1]], .03, m.dark()));
    K.hazard('rad', [0, ISO, .3], 2.2, 'Scatter radiation during exposure');
    K.hazard('hv', [0, ISO, 0], .55, 'High voltage — generator & tube (rotor)');

    let hum, whoosh, xray;
    K.onTick((dt, t) => {
      S.w += (S.target - S.w) * Math.min(1, dt * (S.target > S.w ? .6 : .35));
      rotor.rotation.z -= S.w * dt * 2 * PI;
      S.table += (S.tableT - S.table) * Math.min(1, dt * .5);
      cradle.userData.base.z = z0 - S.table * (D / 2 + 1.25);
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
    const k = IS_PHONE() ? 1.55 : 1;
    return { cam: [3.7 * k, 2.25 + (k - 1) * 1.1, 5.3 * k], target: [-.05, ISO * .78, .55] };
  });

  /* ===================== MRI ===================== */
  X3D.model('mri', (K) => {
    const T = K.T, m = K.m, S = { table: 0, tableT: 0, rf: 0, img: 0, knock: 0, chirp: 0 };
    const L = Object.assign({ cover: 0xf1f2f4, rim: 0, face: null, bezel: 0xe3e6ea, light: 0x4da3ff, ring: 0, bore: 70, Lsys: 1.6, W: 2.15, H: 2.3, flare: 1.0, fl: .3, lip: .35,
      field: '1.5 T', ctl: 'siemens', table: 'siemens', turret: true, quench: true, boreLight: 0xdff0ff }, K.look || {});
    /* outer cover radius from the published width / height; isocentre just above that radius; the service turret takes the remaining height */
    const Ls = L.Lsys, RB = L.bore / 200, Ro = Math.min(L.W / 2 - .04, (L.H - .1) / 2), ISO = L.iso || Ro + .03;
    const turretH = L.turret ? Math.max(.1, L.H - ISO - Ro) : 0, zf = Ls / 2, zr = -Ls / 2;
    const Rf = L.flare / 2, M = mats(K, L), e = L.e || .16, er = .1, bulge = L.bulge != null ? L.bulge : .03, flr = L.flr != null ? L.flr : .1;
    const faceZ = r => zf + bulge * Math.max(0, Math.min(1, (Ro - e - r) / (Ro - e - Rf)));
    /* one-piece lathe shell: rear face → outer cylinder → rounded front → face → flare → bore lining → rear flare */
    const prof = [[RB + flr, zr], ...arc(Ro - er, zr + er, er, -PI / 2, 0, 5), ...arc(Ro - e, zf - e, e, 0, PI / 2, 8)];
    for (let i = 1; i <= 6; i++) { const r = (Ro - e) + (Rf - (Ro - e)) * i / 6; prof.push([r, faceZ(r)]); }
    const shell = lathe(K, prof, M.face, 96);
    const flare = lathe(K, [[Rf + .01, faceZ(Rf) - .002], ...funnel(Rf, RB, faceZ(Rf), L.fl, L.lip, 12)], M.bezel, 96);
    const lining = lathe(K, [[RB, zf + bulge - L.fl + .01], [RB, zr + flr], [RB + flr, zr - .002]], M.lining, 96);
    const housing = K.group(shell, flare, lining);
    if (L.rim) { // grey front rim band wrapping the outer edge (Siemens / GE cue)
      const rw = L.rimW || .26, band = [[Ro + .006, zf - rw], ...arc(Ro - e, zf - e, e + .006, 0, PI / 2, 8), [Ro - e - (L.rimF || .05), zf + .006]];
      housing.add(lathe(K, band, M.rim, 96));
    }
    { const pz = zf - (L.rim ? (L.rimW || .26) + .06 : .3), pl = K.torus(Ro + .001, .004, M.dark, [0, 0, pz]); pl.castShadow = false; housing.add(pl); }
    if (L.seam) { const sm = K.torus(Rf + L.seam, .005, M.dark, [0, 0, faceZ(Rf + L.seam) + .002]); housing.add(sm); }
    if (L.ring) { const r = K.torus(Rf - .01, .01, new T.MeshBasicMaterial({ color: L.ring }), [0, 0, faceZ(Rf) + .004]); r.castShadow = false; housing.add(r); }
    if (L.boreLight) { const bl = K.box(.16, .006, Ls - 2 * L.fl - .1, new T.MeshBasicMaterial({ color: L.boreLight }), [0, RB - .006, 0]); bl.castShadow = false; housing.add(bl); }
    K.cover(K.at(housing, [0, ISO, 0]), { explode: [0, 0, -2.6] });
    // base skirt + front step + service turret
    const skH = ISO - Ro + .45, base = K.group(K.rbox(Math.min(L.W * .66, 1.55), skH, Ls * .82, .05, M.side, [0, skH / 2, -.04]), K.rbox(Math.min(L.W * .5, 1.2), .1, .3, .03, M.kick, [0, .05, zf - .02]));
    if (L.turret) base.add(K.rbox(.62, turretH + .2, .7, .06, M.cover, [0, ISO + Ro + turretH / 2 - .1, -Ls * .12]));
    K.cover(base, { explode: [0, 0, -2.6] });

    /* front controls / displays */
    const fz = r => faceZ(r) + .008, det = new T.Group(); det.position.y = ISO;
    const lc = '#' + (L.light || 0x4da3ff).toString(16).padStart(6, '0');
    const mrUI = (label) => (c, w, h, t) => { c.fillStyle = '#0c1522'; c.fillRect(0, 0, w, h); c.fillStyle = lc; c.fillRect(0, 0, w, h * .18); c.fillStyle = '#e8f1ff'; c.font = `bold ${Math.round(h * .12)}px sans-serif`; c.fillText(label, w * .06, h * .14); c.fillStyle = '#9fb3cc'; c.font = `${Math.round(h * .1)}px sans-serif`; c.fillText(L.field + ' · ' + (S.tableT ? 'Scanning' : 'Ready'), w * .06, h * .42); c.fillText('Table ' + Math.round(S.table * 100) + ' %', w * .06, h * .62); c.fillStyle = '#36d39a'; c.fillRect(w * .06, h * .76, w * .88 * (S.img || 0) + 2, h * .08); };
    const scr = (w, h, x, y, label) => { const r = Math.hypot(x, y); det.add(K.rbox(w + .03, h + .03, .03, .012, M.glass, [x, y, fz(r)]), K.screen(w, h, mrUI(label), [x, y, fz(r) + .017], null, 96)); };
    if (L.ctl === 'siemens') { scr(.24, .16, 0, Rf + .2, 'Exam'); [-1, 1].forEach(s => det.add(keypad(K, M, s * (Rf + .16), .04, fz(Rf + .16) + .004, L.light))); }
    else if (L.ctl === 'siemensTouch') { scr(.3, .19, 0, Rf + .22, 'Select'); [-1, 1].forEach(s => det.add(keypad(K, M, s * (Rf + .15), .02, fz(Rf + .15) + .004, L.light))); }
    else if (L.ctl === 'ge') { [-1, 1].forEach(s => scr(.15, .22, s * (Rf + .17), .14, 'Touch')); det.add(keypad(K, M, 0, Rf + .14, fz(Rf + .14), L.light)); }
    else if (L.ctl === 'philips') { [-1, 1].forEach(s => scr(.15, .21, s * (Rf + .16), .1, 'Panel')); }
    else if (L.ctl === 'achieva') { const x = -(Rf + .12), y = -.05; det.add(K.rbox(.3, .16, .08, .02, M.side, [x, y, fz(Rf) + .04]), K.box(.22, .03, .01, M.dark, [x, y + .03, fz(Rf) + .085])); for (let i = 0; i < 5; i++) det.add(K.cyl(.011, .011, .01, new T.MeshBasicMaterial({ color: i === 0 ? 0xff4b4b : 0xe9eef5 }), [x - .1 + i * .045, y - .03, fz(Rf) + .085], [PI / 2, 0, 0], 10)); }
    K.cover(det, { explode: [0, 0, -2.6] });

    /* internals sized to the bore and the outer shell */
    const Lb = Math.max(.7, Ls - 2 * L.fl - .04), Lc = Ls * .86, cryoMat = m.metal(); cryoMat.transparent = true; cryoMat.opacity = .45;
    const rCo = Ro - .1, rCi = RB + .2;
    K.part('cryo', K.group(K.ring(rCo, rCo - .05, Lc, cryoMat, [0, ISO, 0]), K.ring(rCi + .03, rCi, Lb, cryoMat.clone(), [0, ISO, 0]),
      K.cyl(.1, .1, L.turret ? .45 : .2, m.steel(), [0, ISO + Ro + (L.turret ? .02 : -.2), -Ls * .12]), K.cyl(.14, .14, .1, m.dark(), [0, ISO + Ro - .14, -Ls * .12])), { explode: [0, 0, -1.8] });
    const rMag = (rCi + rCo) / 2 - .04;
    K.part('magnet', K.group(...[-.42, -.24, -.08, .08, .24, .42].map(f => K.torus(rMag, .065, m.copper(), [0, ISO, f * Lc]))), { explode: [0, 0, -.6] });
    K.part('shim', K.group(K.ring(RB + .17, RB + .155, Lb * .95, m.gold(), [0, ISO, 0])), { explode: [0, 0, .7] });
    K.part('gradient', K.ring(RB + .14, RB + .06, Lb * .92, m.orange(), [0, ISO, 0]), { explode: [0, 0, 1.6] });
    const cl = Math.min(1.24, Lb * .85), rc = RB + .035, cage = K.group(K.torus(rc, .018, m.copper(), [0, 0, cl / 2]), K.torus(rc, .018, m.copper(), [0, 0, -cl / 2]));
    for (let i = 0; i < 16; i++) { const a = i / 16 * PI * 2; cage.add(K.cyl(.011, .011, cl, m.copper(), [Math.cos(a) * rc, Math.sin(a) * rc, 0], [PI / 2, 0, 0], 8)); }
    const rfGlow = new T.Mesh(new T.CylinderGeometry(rc - .01, rc - .01, cl, 32, 1, true), new T.MeshBasicMaterial({ color: 0xff5ec4, transparent: true, opacity: 0, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending }));
    rfGlow.rotation.x = PI / 2; cage.add(rfGlow);
    K.part('rfCoil', K.at(cage, [0, ISO, 0]), { explode: [0, 0, 2.5] });
    K.part('magMonitor', K.rbox(.28, .16, .22, .03, m.dark(), [.45, ISO - Ro + .5, zr - .02]), { explode: [.6, .2, -.4] });
    if (L.quench) K.add(K.tube([[0, ISO + Ro + .28, -Ls * .12], [0, 2.75, -Ls * .2], [0, 2.85, zr - .6], [.2, 2.8, zr - 1.4]], .06, m.steel()));
    // Faraday cage wall + window
    const wx = -(L.W / 2 + 1.25);
    const wall = new T.Mesh(new T.PlaneGeometry(6, 2.8), new T.MeshStandardMaterial({ color: 0xc87533, metalness: .9, roughness: .4, transparent: true, opacity: .12, side: T.DoubleSide, depthWrite: false }));
    wall.position.set(wx, 1.4, 0); wall.rotation.y = PI / 2; K.add(wall);
    K.add(K.box(.04, .9, 1.2, m.glass(), [wx, 1.4, .3]));
    K.part('chiller', K.at(K.group(K.rbox(.8, 1.5, .7, .04, m.shell2(), [0, .75, 0]), K.cyl(.22, .22, .05, m.dark(), [0, 1.2, .36], [PI / 2, 0, 0])), [-.7, 0, zr - 1.6]), { explode: [0, 0, -.8] });
    K.part('rfAmp', K.at(rack(K, 1.8), [.6, 0, zr - 1.6], [0, 0, 0]), { explode: [0, 0, -1] });

    /* patient table (docks to the magnet front) */
    const topY = ISO - RB + .07, z0 = zf + 1.0, tb = new T.Group();
    if (L.table === 'siemens') { // stepped plinth + column + table body (classic Siemens MR table)
      tb.add(K.rbox(.78, .07, 1.5, .03, M.tableS, [0, .035, z0 + .45]), K.rbox(.56, topY - .3, 1.15, .04, M.tableC, [0, (topY - .3) / 2 + .07, z0 + .45]));
      [.2, .38].forEach(f => tb.add(K.box(.565, .012, 1.1, M.tableS, [0, .07 + (topY - .3) * f * 2, z0 + .45])));
      tb.add(K.rbox(.62, .16, 2.2, .05, M.tableC, [0, topY - .1, z0 + .05]), K.box(.63, .03, 2.1, M.tableS, [0, topY - .15, z0 + .05]));
    } else if (L.table === 'ge') { // detachable cart-style table with castors
      const bh = topY - .2; tb.add(K.rbox(.6, bh, 1.7, .05, M.tableC, [0, bh / 2 + .1, z0 + .35]), K.box(.62, .05, 1.7, M.kick, [0, .1, z0 + .35]));
      [[-.25, -.4], [.25, -.4], [-.25, 1.1], [.25, 1.1]].forEach(([x, z]) => tb.add(K.cyl(.05, .05, .04, m.rubber(), [x, .05, z0 + z], [0, 0, PI / 2], 16)));
      tb.add(K.rbox(.6, .12, 2.15, .04, M.tableC, [0, topY - .08, z0 + .05]));
    } else { // Philips: long base with rounded foot end
      const bh = topY - .12; tb.add(K.rbox(.6, bh, 1.8, .07, M.tableC, [0, bh / 2, z0 + .35]), K.box(.61, .05, 1.8, M.kick, [0, .025, z0 + .35]), K.rbox(.58, .1, 2.2, .04, M.tableC, [0, topY - .08, z0 + .05]));
    }
    K.part('table', tb, { explode: [0, 0, 1.6] });
    const cradle = K.group(K.rbox(.52, .045, 2.25, .02, M.tableC, [0, 0, 0]), K.rbox(.48, .055, 1.9, .025, M.mat, [0, .045, .12]),
      K.group(K.mesh(new T.CylinderGeometry(.17, .17, .32, 32, 1, true, -PI * .55, PI * 1.1), new T.MeshPhysicalMaterial({ color: 0xe9ecef, roughness: .4, side: T.DoubleSide }), [0, .17, -.85], [PI / 2, 0, 0])));
    const pat = patient(K); pat.position.set(0, .2, -.08); cradle.add(pat);
    cradle.position.set(0, topY + .02, z0); K.part('table', cradle, { explode: [0, .4, 1.6] });

    const imgScr = K.screen(.54, .32, (c, w, h, t) => grayImg(c, w, h, t, 'mr', S.img), null, null, 160);
    const uiScr = K.screen(.54, .32, uiScreen('MR · Sequence · ' + L.field, ['T2 FSE  TR 4000  TE 100', L.quench ? 'He level 72% (training)' : 'Sealed / low-helium magnet', 'Coldhead: running', 'SAR: normal mode']), null, null, 160);
    K.part('console', K.at(desk(K, [uiScr, imgScr]), [wx - 1.3, 0, 1.2], [0, PI / 2, 0]), { explode: [-.8, 0, 0] });
    K.part('recon', K.at(rack(K, 1.6), [wx - 1.4, 0, -1], [0, PI / 2, 0]), { explode: [-.8, 0, -.4] });
    K.part('pacs', K.at(rack(K, 1.2), [wx - 1.4, 0, -1.9], [0, PI / 2, 0]), { explode: [-.8, 0, -.8] });
    K.hazard('mag', [0, ISO, 0], 2.6, 'Static magnetic field (fringe field — illustrative)');
    if (L.quench) K.hazard('chem', [0, ISO + Ro + .2, -Ls * .12], .5, 'Cryogen / quench vent');

    K.onTick((dt, t) => {
      S.table += (S.tableT - S.table) * Math.min(1, dt * .5); cradle.userData.base.z = z0 - S.table * (zf + .95);
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
    const k = IS_PHONE() ? 1.55 : 1;
    return { cam: [3.9 * k, 2.3 + (k - 1) * 1.1, 5.6 * k], target: [-.1, ISO * .8, .5] };
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

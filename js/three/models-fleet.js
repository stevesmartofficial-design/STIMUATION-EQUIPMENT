/* Model-specific 3D replicas of the hospital fleet: mobile C-arms (incl. compact and
   O-ring), angiography suites and ultrasound systems. Parametric builders read the
   selected fleet look (K.vlook from BME.fleetLooks, K.fleet from BME.fleet — set by
   the explorer from ?v=<fleetId>) and fall back to a generic look. 1 unit = 1 m.
   Part ids: carm/cathlab = slugs of the catalog parts list (see BME.ensure),
   ultrasound = js/content/ultrasound.js component ids. Loads after models-imaging.js
   and replaces its generic ultrasound model. */
(function () {
  if (!window.X3D) return;
  const PI = Math.PI, IN = .0254;

  /* ---------------- shared helpers ---------------- */
  function U(K) {
    const T = K.T, mc = {}, gc = {};
    /* Colours are given as sRGB hex (as seen in product photos) and converted to linear so they
       render true under the sRGB output encoding. */
    const mat = (hex, o) => {
      const k = hex + '|' + JSON.stringify(o || 0); if (mc[k]) return mc[k];
      const m = new T.MeshStandardMaterial(Object.assign({ color: hex, roughness: .42, metalness: .04 }, o));
      m.color.convertSRGBToLinear(); if (o && o.emissive) m.emissive.convertSRGBToLinear(); return (mc[k] = m);
    };
    const geo = (k, f) => gc[k] || (gc[k] = f());
    const u = { T, mat, geo };
    u.rb = (w, h, d, r, m, p, rot) => { const k = ['rb', w, h, d, r].join(); const g = geo(k, () => { const x = K.rbox(w, h, d, Math.min(r, w / 2 - .001, h / 2 - .001, d / 1.2), m); return x.geometry; }); return K.mesh(g, m, p, rot); };
    u.bx = (w, h, d, m, p, rot) => K.mesh(geo(['bx', w, h, d].join(), () => new T.BoxGeometry(w, h, d)), m, p, rot);
    u.cy = (rt, rb, h, m, p, rot, seg = 28) => K.mesh(geo(['cy', rt, rb, h, seg].join(), () => new T.CylinderGeometry(rt, rb, h, seg)), m, p, rot);
    u.sp = (r, m, p, seg = 20) => K.mesh(geo(['sp', r, seg].join(), () => new T.SphereGeometry(r, seg, Math.max(8, seg / 2))), m, p);
    u.cap = (r, len, m, p, rot) => K.mesh(geo(['cap', r, len].join(), () => new T.CapsuleGeometry(r, len, 6, 14)), m, p, rot);
    u.lathe = (pts, m, p, rot, seg = 36) => K.mesh(new T.LatheGeometry(pts.map(q => new T.Vector2(q[0], q[1])), seg), m, p, rot);
    /* Extruded annular sector — C-arm arcs, gantry segments. Shape in x-y, extruded along z (centred). */
    u.arc = (R, t, w, a0, a1, m, bev = .02, seg = 40) => {
      const s = new T.Shape(), ro = R + t / 2 - bev, ri = R - t / 2 + bev;
      s.absarc(0, 0, ro, a0, a1, false); s.absarc(0, 0, ri, a1, a0, true);
      const g = new T.ExtrudeGeometry(s, { depth: Math.max(.002, w - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: seg });
      g.translate(0, 0, -(w - 2 * bev) / 2); return K.mesh(g, m);
    };
    /* Rounded slab from a plan outline (x,z) with optional convex front bulge; extruded upward. */
    u.slab = (w, d, h, r, bulge, m, p, rot) => {
      const s = new T.Shape(), x = w / 2, z = d / 2;
      s.moveTo(-x + r, -z); s.lineTo(x - r, -z); s.quadraticCurveTo(x, -z, x, -z + r); s.lineTo(x, z - r); s.quadraticCurveTo(x, z, x - r, z);
      if (bulge) s.quadraticCurveTo(0, z + bulge * 2, -x + r, z); else s.lineTo(-x + r, z);
      s.quadraticCurveTo(-x, z, -x, z - r); s.lineTo(-x, -z + r); s.quadraticCurveTo(-x, -z, -x + r, -z);
      const bev = Math.min(.012, h / 3);
      const g = new T.ExtrudeGeometry(s, { depth: h - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 10 });
      g.rotateX(PI / 2); g.translate(0, h / 2 - bev, 0); // plan x,y -> world x,z ; extrude goes down -> recentre
      return K.mesh(g, m, p, rot);
    };
    u.tube = (pts, r, m, seg = 40) => K.mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...q))), seg, r, 8), m);
    /* Static canvas screen (drawn once, not re-uploaded every frame). */
    u.sscreen = (w, h, draw, res = 128) => {
      const c = document.createElement('canvas'); c.width = Math.round(res * w / h); c.height = res;
      draw(c.getContext('2d'), c.width, c.height, 0);
      const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
      const sc = K.mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false })); sc.castShadow = false; return sc;
    };
    /* Monitor: bezel + rear housing + screen (live: K.screen draw fn; else static). Faces +z. */
    u.monitor = (diag, aspect, m, draw, o = {}) => {
      const dg = diag * IN, h = dg / Math.sqrt(1 + aspect * aspect), w = h * aspect, b = o.bezel || .014;
      const g = K.group(u.rb(w + b * 2, h + b * 2, .035, .008, m, [0, 0, 0]), u.rb(w * .55, h * .55, .05, .02, m, [0, 0, -.035]));
      const scr = o.live ? K.screen(w, h, draw, [0, 0, .0185], null, o.res || 160) : u.sscreen(w, h, draw, o.res || 128);
      if (!o.live) scr.position.set(0, 0, .0185);
      g.add(scr); g.userData.w = w; g.userData.h = h; g.userData.scr = scr; return g;
    };
    u.caster = (r, m, mr) => K.group(u.cy(r, r, r * .7, mr || m, [0, r, 0], [0, 0, PI / 2], 18), u.bx(r * .9, r * .5, r * .9, m, [0, r * 2 + r * .1, 0]));
    u.patient = (len = 1.7) => {
      const skin = mat(0xd9b38c, { roughness: .7 }), drape = mat(0x5f8fb5, { roughness: .95 });
      const g = K.group(u.cap(.16, len - .45, drape, [0, .08, .05], [PI / 2, 0, 0]), u.sp(.11, skin, [0, .1, -len / 2 + .02]));
      g.children[0].scale.set(1.15, .6, 1); return g;
    };
    return u;
  }

  /* ---------------- screen drawings ---------------- */
  const D = {
    fluoro(c, w, h, t, o) {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, r = Math.min(w, h) * .46, on = o.on;
      c.save(); c.beginPath(); if (o.round) c.arc(cx, cy, r, 0, 7); else c.rect(cx - r, cy - r, r * 2, r * 2); c.clip();
      const g = c.createRadialGradient(cx, cy, r * .1, cx, cy, r * 1.1); g.addColorStop(0, on ? '#9a9a9a' : '#3a3a3a'); g.addColorStop(1, on ? '#5a5a5a' : '#202020');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = on ? '#e2e2e2' : '#666';
      for (let i = -2; i <= 2; i++) { c.beginPath(); c.roundRect ? c.roundRect(cx - r * .17, cy + i * r * .36 - r * .13, r * .34, r * .26, 6) : c.rect(cx - r * .17, cy + i * r * .36 - r * .13, r * .34, r * .26); c.fill(); }
      c.fillStyle = on ? '#bdbdbd' : '#555'; for (let i = -2; i <= 2; i++) { c.fillRect(cx - r * .55, cy + i * r * .36 - 3, r * .34, 6); c.fillRect(cx + r * .21, cy + i * r * .36 - 3, r * .34, 6); }
      if (o.tool) { c.strokeStyle = '#111'; c.lineWidth = 4; c.beginPath(); c.moveTo(cx + r * .9, cy - r * .7); c.lineTo(cx + r * .12, cy + Math.sin(t) * r * .1); c.stroke(); }
      if (on) for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * .12})`; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      c.restore();
      c.fillStyle = on ? '#ffcf3f' : '#4dd0ff'; c.font = '10px monospace'; c.fillText(on ? '☢ FLUORO  ' + (o.kv || 70) + ' kV' : 'LIH · last image hold', 5, 12);
    },
    ui(c, w, h, title, rows, col = '#4da3ff') {
      c.fillStyle = '#0b1526'; c.fillRect(0, 0, w, h); c.fillStyle = col; c.fillRect(0, 0, w, Math.max(12, h * .12));
      c.fillStyle = '#04101f'; c.font = `bold ${Math.round(h * .08)}px sans-serif`; c.fillText(title, 5, h * .09);
      const n = rows.length; rows.forEach((r, i) => {
        const y = h * .18 + i * (h * .8 / n), bh = h * .8 / n - 4;
        c.fillStyle = i % 2 ? '#15233a' : '#1b2d4a'; c.fillRect(5, y, w - 10, bh);
        c.fillStyle = '#cfe3ff'; c.font = `${Math.round(Math.min(bh * .55, h * .08))}px sans-serif`; c.fillText(r, 10, y + bh * .68);
      });
    },
    touch(c, w, h, col = '#4da3ff', title = '') {
      c.fillStyle = '#0d1828'; c.fillRect(0, 0, w, h);
      const cols = 4, rows = 3, gw = (w - 10) / cols, gh = (h - 24) / rows;
      if (title) { c.fillStyle = '#8ea3c4'; c.font = `bold ${Math.round(h * .08)}px sans-serif`; c.fillText(title, 6, h * .1); }
      for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
        c.fillStyle = (i + j) % 5 === 0 ? col : '#22344f'; c.fillRect(6 + i * gw, 18 + j * gh, gw - 6, gh - 6);
      }
    },
    bmode(c, w, h, t, o) {
      c.fillStyle = '#000'; c.fillRect(0, 0, w, h);
      const cx = w * (o.split ? .36 : .5), top = h * .08, R = h * .86, span = o.linear ? 0 : .62;
      c.save(); c.beginPath();
      if (o.linear) c.rect(cx - h * .38, top, h * .76, R); else { c.moveTo(cx, top); c.arc(cx, top, R, PI / 2 - span, PI / 2 + span); c.closePath(); }
      c.clip();
      const live = o.on;
      for (let i = 0; i < 900; i++) {
        const a = PI / 2 + (Math.random() - .5) * span * 2, r = Math.random() * R, v = 30 + Math.random() * (live ? 150 : 60);
        c.fillStyle = `rgb(${v},${v},${v})`; c.fillRect(cx + Math.cos(a) * r - (o.linear ? (Math.random() - .5) * h * .7 : 0), top + Math.sin(a) * r, 2, 1.4);
      }
      const ox = cx + Math.sin(t * .8) * 14, oy = top + R * .5;
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(ox, oy, 20, 13, 0, 0, 7); c.fill(); c.strokeStyle = '#ddd'; c.lineWidth = 1.5; c.stroke();
      if (live && o.doppler) { c.fillStyle = 'rgba(220,40,40,.75)'; c.beginPath(); c.ellipse(ox - 4, oy, 12, 6, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(40,90,230,.75)'; c.beginPath(); c.ellipse(ox + 7, oy + 2, 8, 5, 0, 0, 7); c.fill(); }
      c.restore();
      if (o.split) { // spectral / M-mode strip on the right
        const x0 = w * .7; c.fillStyle = '#060606'; c.fillRect(x0, top, w * .28, R * .9); c.strokeStyle = '#7fd6ff'; c.beginPath();
        for (let x = 0; x < w * .28; x += 2) { const ph = ((x / 30 + t * 2) % 1), v = Math.exp(-((ph - .2) ** 2) / .006); c.lineTo(x0 + x, top + R * .55 - v * R * .4); } c.stroke();
        c.strokeStyle = '#36d39a'; c.beginPath(); for (let x = 0; x < w * .28; x += 2) { const ph = ((x / 30 + t * 2) % 1); c.lineTo(x0 + x, h - 10 - (ph < .05 ? 14 : 0)); } c.stroke();
      }
      c.fillStyle = '#4dd0ff'; c.font = '10px monospace'; c.fillText((o.label || 'B-mode') + (live ? ' · LIVE' : ' · frozen'), 5, 11);
    },
    angio(c, w, h, t, o) {
      c.fillStyle = '#0a0a0a'; c.fillRect(0, 0, w, h);
      const tile = (x, y, tw, th, fn) => { c.save(); c.beginPath(); c.rect(x + 2, y + 2, tw - 4, th - 4); c.clip(); c.translate(x, y); fn(tw, th); c.restore(); c.strokeStyle = '#223'; c.strokeRect(x + 1, y + 1, tw - 2, th - 2); };
      const tree = (tw, th, on) => {
        const g = c.createRadialGradient(tw / 2, th / 2, 5, tw / 2, th / 2, tw * .7); g.addColorStop(0, on ? '#8a8a8a' : '#444'); g.addColorStop(1, '#2a2a2a'); c.fillStyle = g; c.fillRect(0, 0, tw, th);
        const fill = on ? Math.min(1, o.fill || 0) : 1;
        c.strokeStyle = on ? '#141414' : '#262626'; c.lineCap = 'round';
        const br = (x, y, a, len, wd, d) => { if (d > 5 || wd < .6) return; const L = len * fill, x2 = x + Math.cos(a) * L, y2 = y + Math.sin(a) * L; c.lineWidth = wd; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + Math.cos(a + .3) * L * .5, y + Math.sin(a + .3) * L * .5, x2, y2); c.stroke(); br(x2, y2, a - .45, len * .72, wd * .7, d + 1); br(x2, y2, a + .5, len * .66, wd * .62, d + 1); };
        br(tw * .3, th * .15, 1.0, th * .28, 5, 0);
        c.fillStyle = '#ccc'; c.fillRect(tw * .28, 0, 3, th * .16);
      };
      tile(0, 0, w * .5, h * .62, (tw, th) => tree(tw, th, true));
      tile(w * .5, 0, w * .5, h * .62, (tw, th) => tree(tw, th, false));
      tile(0, h * .62, w * .5, h * .38, (tw, th) => { c.fillStyle = '#05080d'; c.fillRect(0, 0, tw, th); [['#36d39a', .3], ['#ff6b81', .62], ['#ffcf3f', .88]].forEach(([col, yy], k) => { c.strokeStyle = col; c.lineWidth = 1.4; c.beginPath(); for (let x = 0; x < tw; x += 2) { const ph = ((x / 40 + t * 1.5 + k * .1) % 1); c.lineTo(x, th * yy - (k === 0 ? (ph < .06 ? th * .2 : 0) : Math.exp(-((ph - .25) ** 2) / .01) * th * .15)); } c.stroke(); }); });
      tile(w * .5, h * .62, w * .25, h * .38, (tw, th) => D.ui(c, tw, th, 'Exam', ['Coronary', 'LAO 30 CRA 20', '15 fps', o.on ? 'X-RAY' : 'Ready'], o.on ? '#ffcf3f' : '#4da3ff'));
      tile(w * .75, h * .62, w * .25, h * .38, (tw, th) => { c.fillStyle = '#0b1526'; c.fillRect(0, 0, tw, th); c.strokeStyle = '#4da3ff'; c.lineWidth = 2; c.beginPath(); c.arc(tw / 2, th / 2, th * .32, t % 6.28, t % 6.28 + 4.5); c.stroke(); c.fillStyle = '#8ea3c4'; c.font = '9px sans-serif'; c.fillText('3D-RA', 4, 11); });
      if (o.on) { c.fillStyle = '#ffcf3f'; c.fillRect(w - 16, 6, 10, 10); }
    }
  };

  /* =========================================================================
     MOBILE C-ARM
     ========================================================================= */
  const CARM_DEF = {
    form: 'carm', det: 'ii', ii: 9, sid: 1.0, free: .78, depth: .7, cart: { kind: 'dual', mon: 19 }, touch: null, panel: 'slope', motor: false,
    col: { shell: 0xeef1f4, shell2: 0xd2d8df, accent: 0x2f7de1, dark: 0x2a3039, base: 0x4a5462 }
  };

  X3D.model('carm', K => {
    const L = Object.assign({}, CARM_DEF, K.vlook || {}); L.col = Object.assign({}, CARM_DEF.col, L.col || {});
    const u = U(K), T = K.T, cl = L.col;
    const M = {
      shell: u.mat(cl.shell, { roughness: .32 }), shell2: u.mat(cl.shell2, { roughness: .38 }), accent: u.mat(cl.accent, { roughness: .35 }),
      dark: u.mat(cl.dark, { roughness: .55 }), base: u.mat(cl.base, { roughness: .5 }), rubber: u.mat(0x1d2126, { roughness: .9 }),
      metal: u.mat(0xb9c1c9, { roughness: .25, metalness: .85 }), black: u.mat(0x15181c, { roughness: .3, metalness: .2 }),
      glass: u.mat(0x0b0f14, { roughness: .08, metalness: .3 }), pcb: u.mat(0x1f7a4a, { roughness: .55 }), copper: u.mat(0xc87533, { roughness: .3, metalness: .9 }),
      oil: u.mat(0xc8a24a, { roughness: .3, metalness: .4 })
    };
    const S = { expo: 0, orb: 0, orbT: 0, wig: 0, door: 1, doorT: 1, rot: 0, rotW: 0, fill: 0 };
    let ret;
    if (L.form === 'oarm') ret = oarm(K, L, u, M, S);
    else ret = carm(K, L, u, M, S);
    // shared: sound + scan
    let hum = null;
    K.scan = {
      start(K) { S.orbT = 0; S.doorT = 0; if (K.Sound) { hum = K.Sound.voice({ type: 'sine', pitch: 160, freq: 900 }); hum.set({ vol: 0 }); } },
      tick(K, dt, t, p) {
        const on = p > .35 && p < .8;
        if (on !== !!S.expo) { S.expo = on ? 1 : 0; K.Sound && K.Sound.beep(on ? 1400 : 900, .12, { vol: .08 }); }
        if (hum) hum.set({ vol: on ? .03 : 0 });
        if (L.threeD) S.orbT = on ? -1 + 2 * Math.min(1, (p - .35) / .45) : (p >= .8 ? 1 : -1) * (p > .25 ? 1 : 0);
        if (L.wigwag) S.wig = Math.sin(t * 1.3) * .2 * (p > .2 && p < .35 ? 1 : 0);
        S.rotW = L.form === 'oarm' && on ? 1 : 0;
      },
      stop() { S.expo = 0; S.orbT = 0; S.doorT = 1; S.rotW = 0; S.wig = 0; if (hum) { hum.stop(); hum = null; } }
    };
    return ret;
  });

  function carm(K, L, u, M, S) {
    const T = K.T, isII = L.det === 'ii', compact = L.form === 'compact';
    const FREE = L.free, SID = L.sid, DEP = L.depth;
    // detector housing geometry
    const iiR = (L.ii || 9) * IN / 2 + .045, iiLen = (L.ii || 9) >= 12 ? .40 : .33;
    const fw = (L.fpd ? L.fpd[0] : 21) / 100 + .1, fd = (L.fpd ? L.fpd[1] : 21) / 100 + .1, fh = .15;
    const tC = L.threeD ? .13 : .105, wC = L.threeD ? .2 : .17;
    const yT = FREE / 2 + (isII ? iiLen * .5 : fh * .7), yB = FREE / 2 - SID - .02;
    const R = (yT - yB) / 2, cyC = (yT + yB) / 2, cxC = -DEP + R - tC / 2, PHI = 80 * PI / 180;
    const HY = .95; // world height of the free-space midpoint (beam axis frame origin)
    // ---- frames: wig (vertical swivel at column) > ang (rotation about horizontal arm, x) > orb (orbital, about C centre, z)
    const colX = cxC - R - .3;
    const wig = new T.Group(); wig.position.set(colX, HY + cyC, 0); K.add(wig);
    const ang = new T.Group(); ang.position.set(-colX, 0, 0); wig.add(ang);           // origin at C centre height, x = beam axis frame
    const angIn = new T.Group(); angIn.position.set(0, 0, 0); ang.add(angIn);
    const orb = new T.Group(); orb.position.set(cxC, 0, 0); angIn.add(orb);         // orbital pivot = C centre
    const F = new T.Group(); F.position.set(-cxC, -cyC, 0); orb.add(F);            // F = beam-axis frame (x=0 beam, y=0 mid free space)

    // C arc + necks + carriage (c_arm_mechanics)
    const cArc = u.arc(R, tC, wC, PHI, 2 * PI - PHI, M.shell, .028, 48); cArc.position.set(cxC, cyC, 0);
    const neckT = u.rb(Math.abs(cxC) + .12, .1, wC * .9, .03, M.shell, [cxC / 2, yT, 0]);
    const neckB = u.rb(Math.abs(cxC) + .12, .1, wC * .9, .03, M.shell, [cxC / 2, yB + .03, 0]);
    const stripe = u.arc(R - tC / 2 - .002, .012, wC * .5, PHI + .15, 2 * PI - PHI - .15, M.accent, .004, 40); stripe.position.set(cxC, cyC, 0);
    K.part('c_arm_mechanics', K.group(cArc, neckT, neckB, stripe), { parent: F, explode: [-.3, 0, .5] });
    const carriage = u.rb(.2, .46, wC + .14, .05, M.shell2, [cxC - R - .03, cyC, 0]); // built at F-frame y, shifted into the ang frame below
    const armLen = .34;
    const hArm = u.rb(armLen, .17, .22, .04, M.shell2, [cxC - R - .1 - armLen / 2, cyC, 0]);
    const sideLock = u.cy(.05, .05, .05, M.dark, [cxC - R - .03, cyC, wC / 2 + .09], [PI / 2, 0, 0]);
    const mech2 = K.group(carriage, hArm, sideLock);
    mech2.position.set(0, -cyC, 0); // ang frame: C centre at (cxC, 0)
    K.part('c_arm_mechanics', mech2, { parent: ang, explode: [-.3, 0, .5] });

    // detector
    if (isII) {
      const yb = FREE / 2;
      const body = u.lathe([[0, 0], [iiR - .02, 0], [iiR, .02], [iiR + .012, .08], [iiR + .02, iiLen * .55], [iiR * .78, iiLen * .9], [.1, iiLen], [0, iiLen]], M.shell, [0, yb, 0], null, 40);
      const face = u.cy(iiR - .02, iiR - .02, .006, M.black, [0, yb + .003, 0], null, 40);
      const grip = u.lathe([[iiR + .03, .02], [iiR + .045, .035], [iiR + .045, .055], [iiR + .03, .07]], M.dark, [0, yb, 0], null, 40);
      const cam = u.cy(.085, .095, .12, M.shell2, [0, yb + iiLen + .05, 0], null, 28);
      const ring = u.cy(iiR + .021, iiR + .021, .018, M.accent, [0, yb + iiLen * .5, 0], null, 40);
      K.part('image_intensifier_fpd', K.group(body, face, grip, cam, ring), { parent: F, explode: [0, .55, 0] });
    } else {
      const yb = FREE / 2;
      const hous = u.rb(fw, fh, fd, .045, M.shell, [0, yb + fh / 2, 0]);
      const face = u.bx(fw - .06, .006, fd - .06, M.black, [0, yb + .002, 0]);
      const hood = u.rb(fw * .7, .07, fd * .7, .03, M.shell2, [0, yb + fh + .025, 0]);
      const handles = K.group(u.rb(.03, .03, fd * .7, .012, M.dark, [fw / 2 + .025, yb + .05, 0]), u.rb(.03, .03, fd * .7, .012, M.dark, [-fw / 2 - .025, yb + .05, 0]));
      const band = u.bx(fw + .004, .012, fd + .004, M.accent, [0, yb + fh * .55, 0]);
      K.part('image_intensifier_fpd', K.group(hous, face, hood, handles, band), { parent: F, explode: [0, .55, 0] });
    }
    // tube (monoblock) + collimator
    const yC = -FREE / 2, foc = FREE / 2 - SID;
    const tubeG = K.group(
      u.rb(.34, .26, .3, .07, M.shell, [-.03, foc - .02, 0]),
      u.cy(.12, .12, .3, M.shell2, [-.03, foc - .02, 0], [PI / 2, 0, 0], 28),
      u.bx(.04, .1, .32, M.accent, [-.2, foc - .02, 0])
    );
    K.part('monoblock_tube', tubeG, { parent: F, explode: [0, -.45, 0] });
    const collG = K.group(u.rb(.2, Math.max(.06, yC - foc - .13), .2, .025, M.dark, [0, (yC + foc + .13) / 2, 0]), u.bx(.12, .006, .12, M.glass, [0, yC - .002, 0]));
    K.part('collimator', collG, { parent: F, explode: [.35, -.2, 0] });
    // X-ray beam (cone from focal spot to detector)
    const beamH = SID - .02, beamR = isII ? iiR - .03 : Math.min(fw, fd) / 2 - .04;
    const beamGeo = isII ? new T.ConeGeometry(beamR, beamH, 32, 1, true) : new T.ConeGeometry(beamR * 1.41, beamH, 4, 1, true);
    const beam = new T.Mesh(beamGeo, new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    beam.position.set(0, foc + beamH / 2, 0); beam.rotation.set(PI, isII ? 0 : PI / 4, 0); F.add(beam);
    const cross = u.cy(.004, .004, .3, u.mat(0xff2a2a, { emissive: 0xff2a2a }), [0, yC - .02, 0], [0, 0, PI / 2], 6); // laser hint
    F.add(cross);

    // ---- stand (mobile base + body + column)
    const bodyX0 = colX - .5, bodyX1 = colX + .1, bodyL = bodyX1 - bodyX0, W = .74;
    K.add(u.rb(bodyX1 + .5 - bodyX0 + .05, .14, W + .04, .05, M.base, [(bodyX0 - .05 + colX + .55) / 2, .2, 0]));            // chassis
    [[bodyX0 + .12, -.3], [bodyX0 + .12, .3], [colX + .42, -.31], [colX + .42, .31]].forEach(([x, z], i) => K.add(K.at(u.caster(i < 2 ? .075 : .06, M.dark, M.rubber), [x, 0, z])));
    K.add(u.rb(.12, .03, .2, .01, M.accent, [bodyX0 + .06, .1, 0]));   // brake/steer pedal
    const bodyH = compact ? .98 : .92;
    const body = K.group(
      u.rb(bodyL, bodyH - .27, W, .08, M.shell, [(bodyX0 + bodyX1) / 2, .27 + (bodyH - .27) / 2, 0]),
      u.bx(bodyL - .04, .05, W + .006, M.accent, [(bodyX0 + bodyX1) / 2, .36, 0])
    );
    K.cover(body, { explode: [-.6, 0, 0] });
    // column (vertical lift) — part of mechanics
    const colTop = HY + cyC;
    const column = K.group(u.rb(.24, colTop - bodyH + .2, .3, .05, M.shell2, [colX, bodyH + (colTop - bodyH) / 2 - .1, 0]),
      u.cy(.075, .075, .2, M.dark, [colX, colTop, 0], null, 24));
    K.part('c_arm_mechanics', column, { explode: [-.2, .2, 0] });
    if (L.wigwag) K.add(u.cy(.11, .11, .06, M.accent, [colX, colTop + .1, 0], null, 28));
    // inside the stand: HV generator / inverter + mains/UPS batteries
    K.part('hv_generator', K.group(u.rb(.3, .3, .34, .02, M.oil, [bodyX0 + .25, .52, 0]), u.cy(.05, .05, .16, M.copper, [bodyX0 + .25, .72, 0]), u.bx(.22, .02, .26, M.pcb, [bodyX0 + .25, .7, .0])), { explode: [-.3, .4, .5] });
    K.part('mains_ups', K.group(...[-.18, 0, .18].map(z => u.rb(.14, .16, .14, .01, M.dark, [bodyX0 + .3, .36, z])), u.tube([[bodyX0, .3, -.2], [bodyX0 - .2, .12, -.4], [bodyX0 - .55, .02, -.8]], .012, M.rubber)), { explode: [-.4, -.1, -.4] });
    // rear handle + control panel
    const hx = bodyX0 - .06;
    if (L.panel === 'pod') { // OEC: tall rear control pod with side handles
      K.add(u.rb(.22, .5, .6, .06, M.shell2, [bodyX0 + .1, bodyH + .2, 0]));
      K.add(u.tube([[hx, bodyH - .1, -.36], [hx - .06, bodyH + .2, -.38], [hx - .02, bodyH + .42, -.32]], .02, M.dark, 16));
      K.add(u.tube([[hx, bodyH - .1, .36], [hx - .06, bodyH + .2, .38], [hx - .02, bodyH + .42, .32]], .02, M.dark, 16));
      const pnl = u.sscreen(.26, .18, (c, w, h) => D.touch(c, w, h, '#7fb2ff', 'Control'), 96); pnl.position.set(bodyX0 - .01, bodyH + .3, 0); pnl.rotation.set(0, -PI / 2, 0); pnl.rotation.x = 0; K.add(pnl);
      K.add(u.bx(.02, .2, .28, M.dark, [bodyX0 - .003, bodyH + .3, 0]));
    } else {
      K.add(u.tube([[hx + .05, bodyH - .25, -.36], [hx - .04, bodyH - .05, -.36], [hx - .04, bodyH - .05, .36], [hx + .05, bodyH - .25, .36]], .02, M.dark, 24));
      const pnlW = L.panel === 'touch' ? .3 : .34, pnlD = L.panel === 'touch' ? .22 : .2;
      const pg = new T.Group(); pg.position.set(bodyX0 + .16, bodyH + .03, 0); pg.rotation.z = .5; K.add(pg);
      pg.add(u.rb(pnlD, .04, pnlW + .06, .015, M.dark, [0, 0, 0]));
      const scr = u.sscreen(pnlW, pnlD * .8, (c, w, h) => L.panel === 'touch' ? D.touch(c, w, h, '#4da3ff', L.touch ? 'Touch UI' : '') : D.ui(c, w, h, 'Fluoro', ['kV 70  mA 2.1', 'Pulse 8 p/s', 'Dose 0.4 mGy'], '#36d39a'), 96);
      scr.rotation.set(-PI / 2, 0, -PI / 2); scr.position.set(0, .021, 0); pg.add(scr);
    }
    if (L.motor) { // Ziehm RFD position control center / footswitch
      K.add(u.rb(.3, .04, .22, .02, M.dark, [colX + .3, .02, .75]));
      K.add(u.rb(.08, .03, .06, .01, M.accent, [colX + .26, .045, .75])); K.add(u.rb(.08, .03, .06, .01, u.mat(0xffcf3f), [colX + .36, .045, .75]));
    }

    // ---- OR table + patient (scenery)
    K.add(u.rb(.36, .7, .5, .05, M.dark, [0, .38, -1.25]));
    K.add(u.rb(.6, .05, .7, .02, M.dark, [0, .03, -1.25]));
    K.add(u.rb(.52, .05, 2.1, .02, u.mat(0x22262c, { roughness: .35 }), [0, .82, -.45]));
    const pat = u.patient(); pat.position.set(0, .85, -.3); K.add(pat);

    // ---- monitor cart / integrated monitor
    let live = null;
    const fluoroDraw = (c, w, h, t) => D.fluoro(c, w, h, t, { on: S.expo, round: isII, tool: true });
    if (compact) { // monitor pole on the stand
      const px = bodyX0 + .2;
      K.part('monitor_cart', K.group(u.cy(.03, .03, .85, M.metal, [px, bodyH + .42, -.25]), u.rb(.1, .06, .1, .02, M.shell2, [px, bodyH + .86, -.25])), { explode: [-.2, .3, -.3] });
      const mon = u.monitor(L.cart.mon || 24, 16 / 9, M.dark, fluoroDraw, { live: true, res: 180 });
      mon.position.set(px + .02, bodyH + 1.05, -.25); mon.rotation.y = PI / 2 - .35; live = mon;
      K.part('monitor_cart', mon, { explode: [-.2, .4, -.3] });
      K.part('image_processor', K.group(u.rb(.26, .12, .3, .02, M.pcb, [bodyX0 + .3, .75, 0]), u.bx(.2, .02, .24, M.copper, [bodyX0 + .3, .82, 0])), { explode: [-.2, .5, 0] });
      K.part('dicom_export', K.group(u.rb(.08, .05, .12, .01, M.dark, [bodyX0 + .55, .78, .2]), u.bx(.02, .02, .02, u.mat(0x36d39a, { emissive: 0x36d39a }), [bodyX0 + .6, .8, .26])), { explode: [0, .3, .5] });
    } else {
      live = monitorCart(K, L, u, M, S, fluoroDraw, isII, [1.1, 0, -2.05], -.45); // across the table from the C-arm, facing the surgeon
      K.add(u.tube([[bodyX0 - .05, .25, -.25], [bodyX0 - .2, .02, -.8], [-.6, .02, -2.15], [.8, .02, -2.45], [.92, .22, -2.3]], .013, M.rubber, 40));
    }
    // hazards
    K.hazard('rad', [0, HY, 0], 1.8, 'Primary beam + scatter (stand ≥2 m away or use lead PPE)');
    K.hazard('hv', [bodyX0 + .25, .55, 0], .45, 'HV generator / inverter in the stand');
    // ticks
    K.onTick((dt, t) => {
      S.orb += (S.orbT - S.orb) * Math.min(1, dt * 1.2);
      orb.rotation.z = S.orb * (L.threeD ? PI / 2 : .3);
      wig.rotation.y = S.wig;
      beam.material.opacity = S.expo ? .16 + Math.random() * .05 : 0;
    });
    return { cam: [2.9, 2.1, 3.1], target: [.15, 1.0, -.85] };
  }

  /* Monitor cart (C-arm workstation). Returns the live monitor group. */
  function monitorCart(K, L, u, M, S, draw, round, pos, ry) {
    const T = K.T, g = new T.Group(); g.position.set(...pos); g.rotation.y = ry; K.add(g);
    const kind = (L.cart && L.cart.kind) || 'dual', mon = (L.cart && L.cart.mon) || 19;
    const cw = .66, cd = .66, ch = kind === 'mvs' ? .95 : .9;
    // base + casters
    K.part('monitor_cart', K.group(u.rb(cw + .04, .1, cd + .04, .04, M.base, [0, .16, 0]),
      ...[[-.28, -.28], [.28, -.28], [-.28, .28], [.28, .28]].map(([x, z]) => K.at(u.caster(.05, M.dark, M.rubber), [x, 0, z]))), { parent: g, explode: [0, -.2, 0] });
    // body cover
    K.cover(K.group(u.rb(cw, ch - .2, cd, .06, M.shell, [0, .2 + (ch - .2) / 2, 0]), u.bx(cw + .004, .04, cd + .004, M.accent, [0, .32, 0]),
      u.rb(cw * .7, .05, .03, .015, M.dark, [0, ch - .2, cd / 2 + .01])), { parent: g, explode: [0, 0, .6] });
    // internals: image processor, UPS, DICOM/network
    K.part('image_processor', K.group(u.rb(.4, .22, .36, .02, M.dark, [0, .62, -.05]), ...[-.12, -.04, .04, .12].map(x => u.bx(.015, .18, .3, M.pcb, [x, .62, -.05]))), { parent: g, explode: [.0, .3, .5] });
    K.part('mains_ups', u.rb(.4, .16, .3, .02, M.dark, [0, .34, -.05]), { parent: g, explode: [0, -.1, .7] });
    K.part('dicom_export', K.group(u.rb(.18, .05, .2, .01, M.dark, [.17, .8, .2]), u.bx(.025, .015, .01, u.mat(0x36d39a, { emissive: 0x36d39a }), [.22, .81, .305]),
      u.tube([[.25, .8, .1], [.4, .5, -.25], [.6, .05, -.6], [1.0, .02, -.9]], .006, u.mat(0x2f7de1))), { parent: g, explode: [.4, .2, .3] });
    // top: keyboard + mouse + touch
    g.add(K.group(u.rb(cw + .02, .03, cd + .02, .02, M.shell2, [0, ch + .015, 0]), u.rb(.4, .015, .14, .006, M.dark, [0, ch + .04, .18]), u.rb(.06, .02, .09, .02, M.dark, [.27, ch + .04, .2])));
    if (L.touch === 'cart' || L.touch === 'both') { const tp = u.sscreen(.24, .15, (c, w, h) => D.touch(c, w, h, '#4da3ff', 'Touch'), 96); tp.position.set(-.18, ch + .1, .2); tp.rotation.x = -.9; g.add(tp); g.add(K.at(u.rb(.26, .17, .02, .01, M.dark, [0, 0, 0]), [-.18, ch + .093, .192], [-.9, 0, 0])); }
    // post + monitors
    const postH = kind === 'mvs' ? .5 : .55, top = ch + postH;
    const post = K.group(u.rb(.12, postH, .1, .03, M.shell2, [0, ch + postH / 2, -.18]));
    const mons = [];
    const make = (diag, asp, x, y, liveIt, i) => { const m = u.monitor(diag, asp, M.dark, liveIt ? draw : (c, w, h) => i % 2 ? D.ui(c, w, h, 'Patient / Archive', ['ID 000123', 'Run 3 · 12 img', 'DICOM send ✓'], '#4da3ff') : D.fluoro(c, w, h, 0, { on: 0, round }), { live: liveIt, res: liveIt ? 170 : 110 }); m.position.set(x, y, -.13); mons.push(m); return m; };
    let live;
    if (kind === 'wide') {
      const n = (L.cart && L.cart.n) || 1;
      if (n > 1) { const d2 = mon * .85, w2 = d2 * IN * 16 / Math.sqrt(16 * 16 + 81); live = make(d2, 16 / 9, -(w2 / 2 + .015), top + .2, true, 0); make(d2, 16 / 9, w2 / 2 + .015, top + .2, false, 1); post.add(u.rb(w2 * 2, .05, .06, .02, M.shell2, [0, top + .04, -.17])); }
      else live = make(mon, 16 / 9, 0, top + .22, true, 0);
    } else if (kind === 'mvs') {
      live = make(mon, 16 / 9, 0, top + .2, true, 0);
    } else {
      const asp = 5 / 4, w0 = mon * IN / Math.sqrt(1 + 1 / (asp * asp));
      live = make(mon, asp, -(w0 / 2 + .02), top + .18, true, 0); make(mon, asp, w0 / 2 + .02, top + .18, false, 1);
      if (kind === 'quad') { const h0 = live.userData.h; make(mon, asp, -(w0 / 2 + .02), top + .18 + h0 + .05, false, 2); make(mon, asp, w0 / 2 + .02, top + .18 + h0 + .05, false, 3); }
      post.add(u.rb(w0 * 2 + .1, .05, .06, .02, M.shell2, [0, top + .04, -.17]));
    }
    K.part('monitor_cart', K.group(post, ...mons), { parent: g, explode: [0, .45, 0] });
    return live;
  }

  /* ---------------- O-arm (O-ring gantry) ---------------- */
  function oarm(K, L, u, M, S) {
    const T = K.T, Ri = (L.bore || .965) / 2 + .02, Ro = Ri + .36, GD = .62, GY = 1.18, Rm = (Ri + Ro) / 2, tR = Ro - Ri;
    const DOOR0 = -.62, DOOR1 = .48; // door arc (rad) on the +x side
    // static gantry (cover) + door
    const gantry = new T.Group(); gantry.position.set(0, GY, 0); K.add(gantry);
    const ring = u.arc(Rm, tR, GD, DOOR1, 2 * PI + DOOR0, M.shell, .06, 72);
    const liner = u.arc(Ri + .015, .03, GD - .04, DOOR1 + .02, 2 * PI + DOOR0 - .02, M.shell2, .008, 72);
    const band = u.arc(Ro - .005, .02, GD * .55, DOOR1 + .05, 2 * PI + DOOR0 - .05, u.mat(L.col.accent), .006, 72);
    K.cover(K.group(ring, liner, band), { parent: gantry, explode: [0, 0, -1.0] });
    const doorPivot = new T.Group(); gantry.add(doorPivot);
    const door = K.group(u.arc(Rm, tR - .01, GD - .02, DOOR0, DOOR1, M.shell, .06, 24), u.arc(Ri + .015, .03, GD - .06, DOOR0 + .02, DOOR1 - .02, M.shell2, .008, 24));
    K.cover(door, { parent: doorPivot, explode: [.6, 0, 0] });
    // rotor inside: tube + flat panel + generator (rotate together)
    const rotor = new T.Group(); gantry.add(rotor);
    K.part('c_arm_mechanics', K.group(K.ring(Rm + .03, Rm - .03, GD * .5, M.metal), ...[0, 1, 2, 3].map(i => u.bx(.06, .06, .3, M.dark, [Math.cos(i * PI / 2 + .4) * Rm, Math.sin(i * PI / 2 + .4) * Rm, 0]))), { parent: rotor, explode: [0, 0, .6] });
    K.part('monoblock_tube', K.group(u.rb(.3, .16, .26, .05, M.oil, [0, -Rm, 0]), u.cy(.07, .07, .26, M.metal, [0, -Rm, 0], [PI / 2, 0, 0])), { parent: rotor, explode: [0, -.5, .5] });
    K.part('collimator', u.rb(.14, .06, .14, .015, M.dark, [0, -Rm + .11, 0]), { parent: rotor, explode: [0, -.3, .8] });
    K.part('image_intensifier_fpd', K.group(u.rb(.46, .07, .36, .02, M.dark, [0, Rm - .02, 0]), u.bx(.42, .004, .32, M.black, [0, Rm - .056, 0])), { parent: rotor, explode: [0, .5, .5] });
    K.part('hv_generator', u.rb(.22, .14, .26, .02, M.oil, [Math.cos(-2.2) * Rm, Math.sin(-2.2) * Rm, 0], [0, 0, -2.2 + PI / 2]), { parent: rotor, explode: [-.4, -.4, .5] });
    const beamH = 2 * Rm - .12, beam = new T.Mesh(new T.ConeGeometry(.28, beamH, 4, 1, true), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
    beam.rotation.set(PI, PI / 4, 0); beam.position.set(0, -Rm + .06 + beamH / 2, 0); rotor.add(beam);
    // mobile base: long low cart under the ring on the -x side, gantry mount
    const bx0 = -1.75, bx1 = .45;
    K.part('c_arm_mechanics', K.group(
      u.rb(bx1 - bx0, .2, .82, .07, M.base, [(bx0 + bx1) / 2, .2, 0]),
      ...[[bx0 + .15, -.32], [bx0 + .15, .32], [bx1 - .15, -.32], [bx1 - .15, .32]].map(([x, z]) => K.at(u.caster(.07, M.dark, M.rubber), [x, 0, z])),
      u.rb(.5, GY - Rm - .05, .5, .06, M.shell2, [-.75, .3 + (GY - .3 - .55) / 2, 0])
    ), { explode: [0, -.3, 0] });
    K.cover(K.group(u.rb(.75, .62, .7, .08, M.shell, [bx0 + .45, .62, 0]), u.bx(.75, .04, .704, u.mat(L.col.accent), [bx0 + .45, .42, 0])), { explode: [-.6, 0, 0] });
    K.part('mains_ups', K.group(...[-.2, 0, .2].map(z => u.rb(.16, .2, .16, .01, M.dark, [bx0 + .35, .5, z]))), { explode: [-.5, 0, .6] });
    K.add(u.tube([[bx0 + .05, .9, -.3], [bx0 - .1, 1.0, 0], [bx0 + .05, .9, .3]], .02, M.dark, 20)); // push handle
    const cp = u.sscreen(.26, .16, (c, w, h) => D.touch(c, w, h, '#7fa6c9', 'Gantry'), 96); cp.position.set(bx0 + .06, .98, 0); cp.rotation.set(0, -PI / 2, 0); K.add(cp);
    // table (radiolucent carbon) through the bore + patient
    K.add(u.rb(.36, .72, .5, .05, M.dark, [0, .38, -1.55])); K.add(u.rb(.5, .05, 2.6, .02, u.mat(0x22262c, { roughness: .35 }), [0, .86, -.4]));
    const pat = u.patient(); pat.position.set(0, .89, -.2); K.add(pat);
    // Mobile View Station
    const fluoroDraw = (c, w, h, t) => { D.fluoro(c, w * .5, h, t, { on: S.expo, round: false }); c.fillStyle = '#0b1526'; c.fillRect(w * .5, 0, w * .5, h); for (let i = 0; i < 3; i++) { c.fillStyle = '#2a2a2a'; c.fillRect(w * .52 + i * w * .16, h * .2, w * .14, h * .6); c.fillStyle = '#9a9a9a'; c.beginPath(); c.ellipse(w * .59 + i * w * .16, h * .5, w * .05, h * .18, 0, 0, 7); c.fill(); } c.fillStyle = '#4dd0ff'; c.font = '10px monospace'; c.fillText('3D · axial / sag / cor', w * .52, 12); };
    monitorCart(K, L, u, M, S, fluoroDraw, false, [1.25, 0, -2.2], -.5);
    K.add(u.tube([[bx0 + .1, .3, -.3], [bx0 - .05, .02, -.9], [-.8, .02, -2.3], [.9, .02, -2.6], [1.05, .25, -2.45]], .015, M.rubber, 40));
    K.hazard('rad', [0, GY, 0], 1.9, 'Cone-beam exposure inside the gantry + scatter');
    K.hazard('hv', [0, GY, 0], .3, 'Rotor HV generator (inside gantry)');
    K.onTick((dt) => {
      S.door += (S.doorT - S.door) * Math.min(1, dt * 1.1);
      doorPivot.rotation.z = S.door * 1.25; // door telescopes up into the ring
      S.rot += (S.rotW - S.rot) * Math.min(1, dt * .8); rotor.rotation.z -= S.rot * dt * 2.4;
      beam.material.opacity = S.expo ? .15 + Math.random() * .05 : 0;
    });
    return { cam: [3.1, 2.3, 3.4], target: [-.1, 1.0, -.7] };
  }

  /* =========================================================================
     ANGIOGRAPHY / CATH LAB
     ========================================================================= */
  const ANGIO_DEF = { mount: 'ceiling', biplane: false, detA: [30, 38], detB: [20, 20], sid: [.9, 1.2], display: 58, table: { len: 3.1, w: .5 }, col: { shell: 0xf2f3f4, shell2: 0xcfd5db, accent: 0x2f7de1, dark: 0x262b31, base: 0x8a929a } };

  X3D.model('cathlab', K => {
    const L = Object.assign({}, ANGIO_DEF, K.vlook || {}); L.col = Object.assign({}, ANGIO_DEF.col, L.col || {});
    const u = U(K), T = K.T, cl = L.col;
    const M = {
      shell: u.mat(cl.shell, { roughness: .3 }), shell2: u.mat(cl.shell2, { roughness: .38 }), accent: u.mat(cl.accent, { roughness: .35 }), dark: u.mat(cl.dark, { roughness: .5 }),
      base: u.mat(cl.base, { roughness: .45, metalness: .2 }), rubber: u.mat(0x1d2126, { roughness: .9 }), metal: u.mat(0xb9c1c9, { roughness: .25, metalness: .85 }),
      black: u.mat(0x121519, { roughness: .3, metalness: .2 }), lead: u.mat(0x9fc8e8, { roughness: .05, metalness: .1, transparent: true, opacity: .32 }),
      pcb: u.mat(0x1f7a4a, { roughness: .55 }), oil: u.mat(0xc8a24a, { roughness: .3, metalness: .4 }), cab: u.mat(0xdfe3e8, { roughness: .45 }), orange: u.mat(0xe58a2b, { roughness: .45 })
    };
    const S = { expo: 0, rot: 0, rotT: 0, fill: 0, plunger: 0 };
    const ISO = 1.06, RAIL = 2.95;

    /* Isocentric C (arc centre = isocentre). Built in its own frame: arc in x-y plane, back toward -x,
       tube at bottom (focus 0.8 below iso), detector on a lift at the top end. */
    function cArm(R, det, sidMid, opt = {}) {
      const g = new T.Group(), tC = .15, wC = .26;
      const arcM = u.arc(R, tC, wC, PI / 2 - .05, 3 * PI / 2 + .05, M.shell, .035, 56);
      const neckT = u.rb(.36, .14, wC, .05, M.shell, [-.06, R, 0]), neckB = u.rb(.3, .16, wC, .05, M.shell, [-.04, -R, 0]);
      const inner = u.arc(R - tC / 2 - .003, .014, wC * .45, PI / 2 + .1, 3 * PI / 2 - .1, M.accent, .004, 48);
      K.part('gantry_stand', K.group(arcM, neckT, neckB, inner), { parent: g, explode: [-.4, 0, 0] });
      // tube housing + collimator (focus at -0.8)
      const foc = -.8;
      K.part('x_ray_tube', K.group(u.cy(.16, .16, .44, M.shell2, [0, foc - .08, 0], [PI / 2, 0, 0], 32), u.sp(.16, M.shell2, [0, foc - .08, .22], 24), u.sp(.16, M.shell2, [0, foc - .08, -.22], 24),
        u.cy(.165, .165, .04, M.accent, [0, foc - .08, 0], [PI / 2, 0, 0], 32), u.rb(.2, .2, .3, .05, M.shell, [0, foc - .2, 0])), { parent: g, explode: [0, -.5, 0] });
      K.part('collimator_filters', K.group(u.rb(.24, .14, .24, .03, M.dark, [0, foc + .14, 0]), u.bx(.16, .006, .16, M.black, [0, foc + .213, 0])), { parent: g, explode: [.4, -.2, 0] });
      // detector on lift
      const dw = det[0] / 100 + .14, dd = det[1] / 100 + .14, dy = sidMid - .8;
      const lift = u.rb(.14, R - dy - .1, .16, .04, M.shell2, [-.02, (R + dy) / 2 + .05, 0]);
      K.cover(lift, { parent: g, explode: [0, .3, 0] });
      const dg = K.group(u.rb(dw, .2, dd, .06, M.shell, [0, dy + .1, 0]), u.bx(dw - .05, .008, dd - .05, M.black, [0, dy + .002, 0]),
        u.rb(dw * .55, .08, dd * .55, .03, M.shell2, [0, dy + .23, 0]), u.bx(dw + .006, .016, dd + .006, M.accent, [0, dy + .12, 0]));
      K.part('flat_panel_detector', dg, { parent: g, explode: [0, .55, 0] });
      const beam = new T.Mesh(new T.ConeGeometry(Math.min(dw, dd) * .55, sidMid - .02, 4, 1, true), new T.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending }));
      beam.rotation.set(PI, PI / 4, 0); beam.position.set(0, foc + (sidMid - .02) / 2, 0); g.add(beam); g.userData.beam = beam;
      // C sleeve / carriage at the back
      const sleeve = u.rb(.24, .62, wC + .16, .07, M.shell2, [-R - .1, 0, 0]);
      g.userData.sleeve = sleeve; return g;
    }

    // ---- plane A: frontal, C plane = y-z, back toward the head (-z)
    const R_A = .92;
    const rotA = new T.Group(); rotA.position.set(0, ISO, 0); K.add(rotA);   // LAO/RAO about z
    const cA = cArm(R_A, L.detA, (L.sid[0] + L.sid[1]) / 2); cA.rotation.y = -PI / 2; rotA.add(cA); // x(back) -> -z
    K.part('gantry_stand', K.group(cA.userData.sleeve), { parent: cA, explode: [-.3, 0, 0] });
    // support from sleeve back to stand
    const zSleeve = -R_A - .22;
    if (L.mount === 'floor') {
      const zc = zSleeve - .55;
      K.part('gantry_stand', K.group(
        u.cy(.55, .58, .08, M.base, [0, .04, zc], null, 48),
        u.rb(.55, ISO + .1, .5, .1, M.shell, [0, (ISO + .1) / 2 + .05, zc]),
        u.rb(.36, .34, .66, .1, M.shell, [0, ISO, (zc + zSleeve) / 2 - .05]),
        u.cy(.2, .2, .1, M.accent, [0, ISO, zSleeve - .05], [PI / 2, 0, 0], 32),
        u.bx(.56, .03, .51, M.accent, [0, .45, zc])
      ), { explode: [0, 0, -.8] });
    } else {
      const zc = zSleeve - .35;
      K.part('gantry_stand', K.group(
        ...[-.4, .4].map(x => u.bx(.12, .1, 6.5, M.metal, [x, RAIL, -.5])),
        u.rb(1.0, .18, .7, .05, M.shell2, [0, RAIL - .12, zc]),
        u.rb(.36, RAIL - ISO - .1, .4, .1, M.shell, [0, (RAIL + ISO) / 2, zc]),
        u.rb(.34, .34, .62, .1, M.shell, [0, ISO, (zc + zSleeve) / 2]),
        u.cy(.2, .2, .1, M.accent, [0, ISO, zSleeve - .05], [PI / 2, 0, 0], 32)
      ), { explode: [0, .5, -.6] });
    }
    // ---- plane B: lateral (biplane) — ceiling mounted, C plane = x-y, back on top
    let cB = null;
    if (L.biplane) {
      const R_B = 1.12; cB = cArm(R_B, L.detB, 1.05); cB.rotation.z = -PI / 2; cB.position.set(0, ISO, .12); K.add(cB);
      // after rotation: back(-x) -> +y (top), tube at +x?  (-y -> -x)… mirror so tube is on the operator side
      cB.rotation.set(0, PI, -PI / 2);
      K.part('gantry_stand', K.group(cB.userData.sleeve), { parent: cB, explode: [-.3, 0, 0] });
      K.part('gantry_stand', K.group(...[-.45, .45].map(z => u.bx(6, .1, .12, M.metal, [0, RAIL, .12 + z])), u.rb(.7, .18, 1.0, .05, M.shell2, [0, RAIL - .12, .12]),
        u.rb(.4, RAIL - ISO - R_B - .3, .44, .1, M.shell, [0, (RAIL + ISO + R_B + .2) / 2, .12])), { explode: [0, .6, .3] });
    }
    // ---- patient table (pedestal at the foot end, cantilevered top)
    const TL = (L.table && L.table.len) || 3, TW = (L.table && L.table.w) || .5, topY = ISO - .17;
    const tz0 = -.8, tz1 = tz0 + TL;
    K.part('patient_table', K.group(
      u.rb(.7, .06, 1.1, .03, M.base, [0, .03, tz1 - .75]), u.rb(.46, topY - .2, .62, .08, M.shell, [0, (topY - .2) / 2 + .05, tz1 - .75]),
      u.rb(TW, .06, TL, .025, u.mat(0x1f2329, { roughness: .35 }), [0, topY - .03, (tz0 + tz1) / 2]), u.rb(TW - .04, .05, TL - .3, .02, u.mat(0x3a4f6a, { roughness: .9 }), [0, topY + .02, (tz0 + tz1) / 2 + .1]),
      u.bx(.02, .04, TL * .7, M.metal, [TW / 2 + .02, topY - .03, (tz0 + tz1) / 2 + .2]), u.bx(.02, .04, TL * .7, M.metal, [-TW / 2 - .02, topY - .03, (tz0 + tz1) / 2 + .2])
    ), { explode: [0, -.3, .9] });
    const pat = u.patient(1.75); pat.position.set(0, topY + .03, .42); K.add(pat);
    // table-side control module (touch screen + joysticks) on the operator rail (+x)
    const tsm = u.sscreen(.26, .17, (c, w, h) => D.touch(c, w, h, '#4da3ff', 'Touch module'), 96); tsm.position.set(TW / 2 + .1, topY + .1, .55); tsm.rotation.set(-1.0, PI / 2, 0, 'YXZ');
    K.add(K.group(u.rb(.08, .1, .34, .02, M.dark, [TW / 2 + .07, topY + .04, .55]), tsm, u.cy(.012, .012, .08, M.dark, [TW / 2 + .07, topY + .12, .85], null, 10), u.sp(.022, M.accent, [TW / 2 + .07, topY + .17, .85], 12)));
    // lead protection: ceiling-suspended shield + table-side curtain
    K.add(K.group(u.bx(.6, .72, .015, M.lead, [.55, 1.55, .25]), u.bx(.62, .04, .03, M.dark, [.55, 1.93, .25]), u.cy(.02, .02, RAIL - 1.95, M.metal, [.55, (RAIL + 1.95) / 2, .25], null, 10)));
    K.add(u.bx(.012, .62, .9, u.mat(0x2e3740, { roughness: .9 }), [TW / 2 + .03, topY - .36, .4]));
    // ---- displays: ceiling-suspended large display (or monitor bank)
    let live;
    const angioDraw = (c, w, h, t) => D.angio(c, w, h, t, { on: S.expo, fill: S.fill });
    const dispG = new T.Group(); dispG.position.set(-1.15, 0, .9); dispG.rotation.y = .95; K.add(dispG);
    if (L.display) {
      live = u.monitor(L.display, 16 / 9, M.dark, angioDraw, { live: true, res: 220, bezel: .02 }); live.position.set(0, 1.85, 0);
      K.part('room_monitors', K.group(live, u.cy(.04, .04, RAIL - 2.25, M.metal, [0, (RAIL + 2.25) / 2, -.1], null, 12), u.rb(.5, .1, .3, .03, M.shell2, [0, RAIL - .05, -.1])), { parent: dispG, explode: [-.3, .3, 0] });
    } else {
      const n = L.monitors || 4, mons = [];
      for (let i = 0; i < n; i++) { const r = Math.floor(i / 2), c = i % 2; const m = u.monitor(19, 5 / 4, M.dark, i ? (cc, w, h) => D.ui(cc, w, h, ['Reference', 'Hemo', 'Patient'][i - 1] || 'Aux', ['Ao 120/80', 'HR 72', 'SpO₂ 98%'], '#36d39a') : angioDraw, { live: i === 0, res: i ? 96 : 170 }); m.position.set((c - .5) * .42, 2.05 - r * .36, 0); mons.push(m); if (!i) live = m; }
      K.part('room_monitors', K.group(...mons, u.rb(.9, .05, .1, .02, M.shell2, [0, 2.26, -.05]), u.cy(.04, .04, RAIL - 2.28, M.metal, [0, (RAIL + 2.28) / 2, -.05], null, 12)), { parent: dispG, explode: [-.3, .3, 0] });
    }
    // ---- hemodynamic system (cart with monitor), injector, technical room cabinets
    K.part('hemodynamic_system', K.group(u.rb(.5, .8, .45, .04, M.cab, [-1.5, .45, 2.0]), K.at(u.monitor(19, 16 / 10, M.dark, (c, w, h, t) => D.angio(c, w, h, 0, { on: 0 }), {}), [-1.5, 1.15, 2.05], [0, .5, 0]),
      u.tube([[-1.3, .8, 1.8], [-.6, .6, 1.2], [-.2, topY + .05, .6]], .006, u.mat(0x36d39a))), { explode: [-.5, 0, .4] });
    const plunger = u.cy(.03, .03, .16, M.metal, [0, 0, 0], [PI / 2, 0, 0], 12);
    const injHead = K.group(u.rb(.18, .16, .36, .04, M.shell, [0, 0, 0]), u.cy(.045, .045, .3, u.mat(0xd6e9f7, { transparent: true, opacity: .6 }), [0, -.02, .25], [PI / 2, 0, 0], 16), plunger);
    injHead.position.set(.85, 1.35, .9); plunger.position.set(0, -.02, .05); injHead.rotation.set(.5, -.3, 0);
    K.part('injector', K.group(u.rb(.5, .06, .5, .02, M.base, [.85, .05, .9]), u.cy(.035, .035, 1.25, M.metal, [.85, .68, .9], null, 12), injHead,
      u.tube([[.85, 1.3, 1.1], [.6, 1.1, .8], [.3, topY + .08, .5], [.05, topY + .1, .25]], .005, u.mat(0xd6e9f7, { transparent: true, opacity: .7 }))), { explode: [.6, .2, .3] });
    const cabX = 2.75, cab = (w, h, x, z, kids) => K.group(u.rb(w, h, .7, .03, M.cab, [x, h / 2, z]), ...kids);
    K.part('generator', cab(.7, 1.9, cabX, -3.0, [u.rb(.5, .5, .4, .03, M.oil, [cabX, .45, -3.0]), u.bx(.4, .05, .02, u.mat(0xffcf3f, { emissive: 0x6b5200 }), [cabX + .36, 1.6, -3.0], [0, PI / 2, 0])]), { explode: [.6, 0, -.3] });
    K.part('image_chain', cab(.7, 1.9, cabX, -2.22, [...[.4, .7, 1.0, 1.3].map(y => u.bx(.02, .22, .5, M.dark, [cabX + .36, y, -2.22]))]), { explode: [.6, 0, 0] });
    K.part('pacs', cab(.6, 1.6, cabX, -1.5, [...[.3, .55, .8, 1.05, 1.3].map(y => u.bx(.02, .1, .4, M.dark, [cabX + .31, y, -1.5])), ...[.3, .55, .8].map(y => u.bx(.02, .02, .02, u.mat(0x36d39a, { emissive: 0x36d39a }), [cabX + .32, y + .03, -1.35]))]), { explode: [.6, 0, .3] });
    K.add(u.tube([[cabX - .3, .05, -2.9], [1.4, .02, -2.6], [.4, .02, -2.1], [0, .05, -1.75]], .025, M.rubber, 24));
    K.hazard('rad', [0, ISO, 0], 2.1, 'Scatter radiation — wear lead, use the ceiling shield and table curtain');
    K.hazard('hv', [cabX, .9, -3.0], .7, 'High-voltage generator cabinet / HV cables');
    K.hazard('patient', [0, topY + .1, 0], .9, 'Patient + motorised C-arm/table collision zone');
    K.onTick((dt, t) => {
      S.rot += (S.rotT - S.rot) * Math.min(1, dt * .9); rotA.rotation.z = S.rot;
      const op = S.expo ? .14 + Math.random() * .05 : 0; cA.userData.beam.material.opacity = op; if (cB) cB.userData.beam.material.opacity = op;
      plunger.position.z = .05 + S.plunger * .2;
    });
    let hum;
    K.scan = {
      start(K) { if (K.Sound) { hum = K.Sound.voice({ type: 'sine', pitch: 120, freq: 700 }); hum.set({ vol: 0 }); } },
      tick(K, dt, t, p) {
        const on = p > .3 && p < .82; if (on !== !!S.expo) { S.expo = on ? 1 : 0; K.Sound && K.Sound.beep(on ? 1400 : 900, .12, { vol: .08 }); }
        S.rotT = p > .15 && p < .3 ? .52 : on ? .52 - 1.04 * Math.min(1, (p - .3) / .5) : 0;   // LAO 30 -> RAO 30 rotational run
        S.plunger = on ? Math.min(1, (p - .3) / .3) : 0; S.fill = on ? Math.min(1, (p - .3) / .2) : 0;
        if (hum) hum.set({ vol: on ? .03 : 0, pitch: 120 + Math.abs(S.rot) * 40 });
      },
      stop() { S.expo = 0; S.rotT = 0; S.plunger = 0; if (hum) { hum.stop(); hum = null; } }
    };
    return { cam: [4.3, 2.9, 5.0], target: [0, 1.1, .2] };
  });

  /* =========================================================================
     ULTRASOUND
     ========================================================================= */
  const US_DEF = { form: 'cart', H: [1.35, 1.65], W: .56, D: .9, mon: 21.5, touch: 12, ports: 4, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim', col: { body: 0xeef1f4, panel: 0xd5dbe2, trim: 0x8d96a0, accent: 0x2f7de1, keys: 0x2c323a } };

  X3D.model('ultrasound', K => {
    const L = Object.assign({}, US_DEF, K.vlook || {}); L.col = Object.assign({}, US_DEF.col, L.col || {});
    const u = U(K), T = K.T, cl = L.col;
    const M = {
      body: u.mat(cl.body, { roughness: .3 }), panel: u.mat(cl.panel, { roughness: .4 }), trim: u.mat(cl.trim, { roughness: .35, metalness: .3 }), accent: u.mat(cl.accent, { roughness: .35 }),
      keys: u.mat(cl.keys, { roughness: .5 }), dark: u.mat(0x22272e, { roughness: .55 }), rubber: u.mat(0x1b1f24, { roughness: .9 }), metal: u.mat(0xb9c1c9, { roughness: .25, metalness: .85 }),
      ball: u.mat(0x30363e, { roughness: .12, metalness: .1 }), pcb: u.mat(0x1f7a4a, { roughness: .55 }), gold: u.mat(0xd8b04a, { roughness: .3, metalness: .9 }),
      probe: u.mat(0xf0f2f4, { roughness: .35 }), lens: u.mat(0x2f3540, { roughness: .6 }), cable: u.mat(0x2a2f36, { roughness: .7 }), steel: u.mat(0x7d8794, { roughness: .35, metalness: .8 })
    };
    const S = { scan: 0, probeX: 0 };
    const cardiac = K.fleet && K.fleet.mod === 'echo';
    const usDraw = (c, w, h, t) => D.bmode(c, w, h, t, { on: S.scan, doppler: true, split: cardiac, label: cardiac ? 'Echo · 2D + PW' : 'B + Colour' });
    const probes = [];
    const mkProbe = (kind) => { // linear / convex / phased
      const g = new T.Group();
      g.add(u.cap(.017, .07, M.probe, [0, .05, 0]));
      if (kind === 'convex') { const h = u.cy(.03, .03, .03, M.probe, [0, -.01, 0], [PI / 2, 0, 0], 20); h.scale.set(1.2, 1, .7); g.add(h, u.cy(.031, .031, .022, M.lens, [0, -.016, 0], [PI / 2, 0, 0], 20)); }
      else if (kind === 'phased') g.add(u.rb(.03, .035, .026, .01, M.probe, [0, -.005, 0]), u.bx(.024, .006, .02, M.lens, [0, -.024, 0]));
      else g.add(u.rb(.05, .03, .022, .008, M.probe, [0, -.005, 0]), u.bx(.046, .006, .018, M.lens, [0, -.022, 0]));
      g.add(u.cy(.008, .012, .04, M.dark, [0, .12, 0], null, 10)); return g;
    };
    let out;
    if (L.form === 'laptop') out = laptop(); else out = cart();

    function cart() {
      const W = L.W, Dp = L.D, Hm = (L.H[0] + L.H[1]) / 2;
      const monH = L.mon * IN / Math.sqrt(1 + (16 / 9) ** 2), monW = monH * 16 / 9;
      const panelY = Math.max(.82, Math.min(1.0, Hm - monH - .2)), panelD = Math.min(.5, Dp * .55), panelW = W + (L.panel === 'wing' ? .06 : 0);
      const zF = Dp / 2 - .02; // front (operator side) at +z
      // base + casters + brake pedal
      K.add(u.slab(W * .98, Dp * .92, .1, .1, 0, M.trim, [0, .14, 0]));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => K.add(K.at(u.caster(.06, M.dark, M.rubber), [sx * (W * .42), 0, sz * (Dp * .38)])));
      K.add(u.rb(.14, .025, .06, .01, M.accent, [0, .1, Dp * .46]));
      // body (cover) — wide or slim column
      const bH = panelY - .33, bodyW = W * (L.column === 'wide' ? .9 : .84), bodyD = Dp * .62, bz = -Dp * .1;
      const shellG = K.group(u.rb(bodyW, bH * .62, bodyD, .07, M.body, [0, .2 + bH * .31, bz]),
        u.rb(bodyW * (L.column === 'wide' ? .9 : .62), bH * .45, bodyD * .7, .06, M.body, [0, .2 + bH * .62 + bH * .2, bz - bodyD * .12]),
        u.bx(bodyW + .004, .02, bodyD + .004, M.accent, [0, .2 + bH * .62 - .01, bz]));
      K.cover(shellG, { explode: [0, 0, -1.0] });
      // front: printer bay + probe ports (on the front face of the lower body)
      const fz = bz + bodyD / 2 + .002;
      K.add(u.bx(bodyW * .6, .07, .01, M.dark, [0, .3, fz]));
      const portY = .2 + bH * .5, nP = L.ports + (L.pencil ? 1 : 0), pw = Math.min(.1, (bodyW - .06) / nP - .015), portPos = [];
      const portG = K.group(u.bx(bodyW - .02, .1, .012, M.dark, [0, portY, fz]));
      for (let i = 0; i < nP; i++) { const x = (i - (nP - 1) / 2) * (pw + .015), pen = L.pencil && i === nP - 1; portG.add(u.rb(pen ? pw * .45 : pw, .07, .02, .008, pen ? M.accent : M.trim, [x, portY, fz + .008])); portPos.push([x, portY, fz + .02]); }
      K.part('probe', portG, { explode: [0, 0, .5] });
      // internals: card cage, PSU, battery, fans
      const cy0 = .2 + bH * .3;
      [['tx', 0], ['beamformer', 1], ['rx', 2], ['processing', 3], ['mainPcb', 4]].forEach(([id, i]) => K.part(id, K.at(K.group(u.bx(.016, bH * .5, bodyD * .7, M.pcb, [0, 0, 0]), u.bx(.02, .05, .08, M.gold, [0, -bH * .2, bodyD * .25]), u.bx(.02, .04, .04, M.dark, [0, bH * .1, -.05])), [(i - 2) * bodyW * .14, cy0 + bH * .1, bz]), { explode: [(i - 2) * .26, .5, .4] }));
      K.part('psu', u.rb(bodyW * .7, .1, bodyD * .6, .02, M.steel, [0, .27, bz - .02]), { explode: [0, -.2, .8] });
      K.part('battery', u.rb(.16, .09, .26, .015, M.dark, [bodyW * .28, .27, bz + .12]), { explode: [.7, -.1, .5] });
      const fans = [-.1, .1].map(x => u.cy(.06, .06, .025, M.dark, [x, cy0 + bH * .15, bz - bodyD / 2 + .02], [PI / 2, 0, 0], 20));
      const blades = fans.map(f => { const b = u.bx(.1, .012, .008, M.steel, [0, 0, 0]); b.rotation.x = 0; f.add(b); return b; });
      K.part('cooling', K.group(...fans), { explode: [0, 0, -.8] });
      // control panel (height-adjustable deck) with handle
      const pz = Dp * .12, pnl = new T.Group(); pnl.position.set(0, panelY, pz); pnl.rotation.x = .1; K.add(pnl);
      pnl.add(u.slab(panelW, panelD, .05, .06, L.panel === 'curved' ? .03 : L.panel === 'wing' ? .015 : 0, M.panel, [0, 0, 0]));
      pnl.add(u.slab(panelW + .01, panelD + .01, .015, .065, L.panel === 'curved' ? .03 : L.panel === 'wing' ? .015 : 0, M.trim, [0, -.03, 0]));
      if (L.handle === 'wrap' || L.handle === 'front') {
        const hz = panelD / 2 + .045 + (L.panel === 'curved' ? .03 : 0), hx = panelW / 2 + (L.handle === 'wrap' ? .03 : -.04);
        const pts = L.handle === 'wrap' ? [[-hx, -.01, -panelD * .2], [-hx, -.01, hz - .05], [0, -.01, hz + .02], [hx, -.01, hz - .05], [hx, -.01, -panelD * .2]] : [[-hx, -.03, hz - .06], [-hx + .03, -.01, hz], [hx - .03, -.01, hz], [hx, -.03, hz - .06]];
        pnl.add(u.tube(pts, .014, L.handle === 'wrap' ? M.trim : M.accent, 40));
      }
      if (L.panel === 'wing') { pnl.add(u.rb(.08, .04, panelD * .7, .02, M.accent, [-panelW / 2 - .02, -.005, 0])); pnl.add(u.rb(.08, .04, panelD * .7, .02, M.accent, [panelW / 2 + .02, -.005, 0])); }
      // controls: trackball, keys, knobs, TGC
      const top = .03, cz = panelD * .18;
      pnl.add(u.cy(.05, .05, .012, M.keys, [0, top, cz], null, 28), u.sp(.026, M.ball, [0, top + .006, cz]));
      for (let i = 0; i < 4; i++) pnl.add(u.rb(.05, .014, .03, .006, i === 1 ? M.accent : M.keys, [-.07 + i * .047 - .0, top, cz + .065]));
      [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) pnl.add(u.cy(.016, .016, .02, M.keys, [s * (.12 + i * .045), top + .004, cz - .01 + (i % 2) * .03], null, 14)); pnl.add(u.rb(.07, .014, .045, .008, s > 0 ? u.mat(0x3fa36b) : M.keys, [s * .17, top, cz + .07])); });
      for (let i = 0; i < 8; i++) pnl.add(u.bx(.006, .006, .045, M.dark, [-.07 + i * .02, top - .002, cz - .1]));
      // touch screen (tilted) at the rear of the panel
      if (L.touch) {
        const th = L.touch * IN / Math.sqrt(1 + (16 / 10) ** 2), tw = th * 1.6;
        const tg = new T.Group(); tg.position.set(0, .03 + th * .35, -panelD * .3); tg.rotation.x = -.75; pnl.add(tg);
        tg.add(u.rb(tw + .03, th + .03, .025, .012, M.keys, [0, 0, -.006]));
        const ts = u.sscreen(tw, th, (c, w, h) => D.touch(c, w, h, '#' + cl.accent.toString(16).padStart(6, '0'), 'Presets · B · C · PW · Measure'), 110); ts.position.z = .008; tg.add(ts);
      }
      // keyboard drawer
      if (L.kb === 'pull') { pnl.add(u.rb(panelW * .62, .018, .14, .006, M.keys, [0, -.045, panelD / 2 - .02])); }
      // probe holders + probes on both sides of the panel, cables to ports
      const kinds = cardiac ? ['phased', 'phased', 'linear', 'convex'] : ['convex', 'linear', 'phased', 'convex'];
      const holdX = panelW / 2 + .055, holders = K.group();
      const hp = [[-holdX, .0, -.02], [-holdX, .0, .1], [holdX, .0, -.02], [holdX, .0, .1]].slice(0, Math.min(4, L.ports));
      hp.forEach(([x, y, z], i) => {
        holders.add(u.cy(.032, .026, .07, M.trim, [x, y - .01, z], null, 18));
        const pr = mkProbe(kinds[i]); pr.position.set(x, y + .04, z); if (i === 0) pr.visible = false; holders.add(pr);
        // cable from holder down to its port
        const pp = portPos[i] || portPos[0], wx = new T.Vector3(x, y, z).applyMatrix4(new T.Matrix4().makeRotationX(.1)).add(new T.Vector3(0, panelY, pz));
        K.add(u.tube([[wx.x, wx.y + .14, wx.z], [wx.x * 1.15, wx.y + .05, wx.z + .08], [pp[0] * 1.2 + wx.x * .2, pp[1] + .15, pp[2] + .18], [pp[0], pp[1], pp[2] + .04]], .006, M.cable, 30));
      });
      pnl.add(holders);
      // gel bottle holder on the side
      pnl.add(u.cy(.03, .03, .08, M.trim, [holdX - .005, -.03, -panelD * .32], null, 16), u.cy(.025, .022, .12, u.mat(0x55b4e8, { roughness: .2 }), [holdX - .005, .03, -panelD * .32], null, 16));
      // monitor arm + monitor
      const armBase = new T.Vector3(0, panelY + .08, pz - panelD / 2 + .02);
      const mY = Math.max(panelY + .2 + monH / 2, L.H[0] + (L.H[1] - L.H[0]) * .45 - monH / 2 - .02), mZ = pz - panelD * .2;
      const arm = K.group(u.cy(.03, .03, .16, M.trim, [armBase.x, armBase.y, armBase.z], null, 16),
        u.rb(.06, .05, Math.abs(mZ - armBase.z) + .14, .02, M.trim, [0, mY - monH / 2 - .02, (mZ + armBase.z) / 2 - .05]),
        u.cy(.025, .025, mY - monH / 2 - armBase.y, M.trim, [0, (mY - monH / 2 + armBase.y) / 2, armBase.z], null, 12));
      K.add(arm);
      const mon = u.monitor(L.mon, 16 / 9, M.keys, usDraw, { live: true, res: 180, bezel: .016 });
      mon.position.set(0, mY, mZ - .05); mon.rotation.x = -.08;
      K.part('display', mon, { explode: [0, .45, .1] });
      // rear push handle
      K.add(u.tube([[-W * .35, panelY - .05, -Dp * .35], [-W * .3, panelY + .05, -Dp * .45], [W * .3, panelY + .05, -Dp * .45], [W * .35, panelY - .05, -Dp * .35]], .014, M.trim, 24));
      // active probe (animated) on a phantom beside the cart
      phantom([W / 2 + .5, 0, -Dp * .05], kinds[0], portPos[0]);
      K.hazard('hv', [0, .45, bz], .45, 'Mains PSU + transmit high voltage');
      K.onTick((dt) => blades.forEach(b => b.parent.rotation.y += dt * 25));
      return { cam: [1.75, 1.65, 2.25], target: [.2, .95, 0] };
    }

    function laptop() {
      // optional mobile trolley: 5-leg base, column, tray with dock + probe holders, basket
      const trayY = .82, W = Math.max(.46, L.W + .06), Dp = .5;
      const legs = K.group(); for (let i = 0; i < 5; i++) { const a = i / 5 * PI * 2; legs.add(u.rb(.3, .04, .06, .02, M.trim, [Math.cos(a) * .15, .1, Math.sin(a) * .15], [0, -a, 0])); legs.add(K.at(u.caster(.04, M.dark, M.rubber), [Math.cos(a) * .3, 0, Math.sin(a) * .3])); }
      K.add(legs); K.add(u.cy(.045, .05, trayY - .12, M.metal, [0, (trayY + .12) / 2, 0], null, 20));
      K.add(u.slab(W, Dp, .04, .05, .02, M.trim, [0, trayY, 0]));
      K.add(u.rb(W * .7, .12, Dp * .5, .02, M.body, [0, .48, -.02])); // basket / storage
      K.part('psu', u.rb(.16, .05, .1, .015, M.dark, [0, .58, -.02]), { explode: [0, -.3, .5] });
      // multi-port dock under the tray
      const nP = L.ports, portPos = [], dock = K.group(u.rb(W * .8, .07, .14, .02, M.dark, [0, trayY - .07, Dp / 2 - .08]));
      for (let i = 0; i < nP; i++) { const x = (i - (nP - 1) / 2) * .11; dock.add(u.rb(.09, .05, .02, .008, M.trim, [x, trayY - .07, Dp / 2 - .005])); portPos.push([x, trayY - .07, Dp / 2 + .01]); }
      K.part('probe', dock, { explode: [0, -.2, .5] });
      // laptop: base (keyboard + trackball) and lid with screen
      const bw = L.W, bd = L.D * .85, bh = .045, by = trayY + .045;
      K.cover(u.slab(bw, bd, bh, .03, 0, M.body, [0, by, .02]), { explode: [0, 0, -.6] });
      const kb = u.sscreen(bw * .82, bd * .36, (c, w, h) => { c.fillStyle = '#' + cl.panel.toString(16).padStart(6, '0'); c.fillRect(0, 0, w, h); c.fillStyle = '#' + cl.keys.toString(16).padStart(6, '0'); for (let r = 0; r < 4; r++) for (let k = 0; k < 13; k++) c.fillRect(4 + k * (w - 8) / 13, 4 + r * (h - 8) / 4, (w - 8) / 13 - 3, (h - 8) / 4 - 3); }, 64);
      kb.rotation.x = -PI / 2; kb.position.set(0, by + bh / 2 + .002, -.04); K.add(kb);
      K.add(u.slab(bw * .82, bd * .4, .006, .02, 0, M.panel, [0, by + bh / 2 + .001, bd * .25]));
      K.add(u.cy(.032, .032, .008, M.keys, [0, by + bh / 2 + .004, bd * .27], null, 24), u.sp(.02, M.ball, [0, by + bh / 2 + .006, bd * .27]));
      [-1, 1].forEach(s => { for (let i = 0; i < 3; i++) K.add(u.cy(.012, .012, .014, M.keys, [s * (.08 + i * .035), by + bh / 2 + .006, bd * .25 + (i % 2) * .02], null, 12)); });
      if (L.handle === 'rear') K.add(u.tube([[-bw * .3, by, -bd / 2 - .005], [-bw * .25, by + .005, -bd / 2 - .045], [bw * .25, by + .005, -bd / 2 - .045], [bw * .3, by, -bd / 2 - .005]], .01, M.trim, 20));
      // boards inside the base
      [['tx', -2], ['beamformer', -1], ['rx', 0], ['processing', 1], ['mainPcb', 2]].forEach(([id, i]) => K.part(id, u.bx(bw * .15, .006, bd * .7, M.pcb, [i * bw * .17, by - .005 + (i % 2) * .01, .0]), { explode: [i * .15, .35 + Math.abs(i) * .05, .3] }));
      K.part('battery', u.rb(.12, .02, .2, .006, M.dark, [bw * .3, by - .012, -.05]), { explode: [.5, .1, 0] });
      const fan = u.cy(.035, .035, .012, M.dark, [-bw * .32, by, -bd * .3], null, 18), blade = u.bx(.06, .006, .006, M.steel, [0, .007, 0]); fan.add(blade);
      K.part('cooling', fan, { explode: [-.5, .1, -.2] });
      // lid
      const mh = L.mon * IN / Math.sqrt(1 + (4 / 3) ** 2) * (L.mon >= 15 ? .95 : 1), mw = mh * 4 / 3 + .01;
      const lid = new T.Group(); lid.position.set(0, by + bh / 2, -bd / 2 + .02); lid.rotation.x = -.18; K.add(lid);
      lid.add(u.rb(Math.max(mw + .04, bw * .96), mh + .06, .022, .012, M.body, [0, mh / 2 + .03, -.01]));
      const scr = K.screen(mw, mh, usDraw, [0, mh / 2 + .035, .002], null, 170);
      K.part('display', scr, { parent: lid, explode: [0, .35, -.1] });
      K.add(u.cy(.012, .012, Math.max(mw + .04, bw * .96) * .7, M.dark, [0, by + bh / 2 + .006, -bd / 2 + .02], [0, 0, PI / 2], 12));
      // probe holders on the tray sides with probes + cables
      const kinds = cardiac ? ['phased', 'convex'] : ['convex', 'linear'];
      [[-W / 2 - .03, .1], [W / 2 + .03, .1]].slice(0, Math.max(1, Math.min(2, nP))).forEach(([x, z], i) => {
        K.add(u.cy(.03, .025, .07, M.trim, [x, trayY - .02, z], null, 16));
        const pr = mkProbe(kinds[i]); pr.position.set(x, trayY + .03, z); if (i === 0) pr.visible = false; K.add(pr);
        const pp = portPos[i] || portPos[0]; K.add(u.tube([[x, trayY + .17, z], [x * 1.2, trayY + .05, z + .1], [pp[0], pp[1] - .1, pp[2] + .12], [pp[0], pp[1], pp[2] + .02]], .005, M.cable, 24));
      });
      phantom([W / 2 + .5, 0, -.05], kinds[0], portPos[0]);
      K.hazard('hv', [0, by, 0], .3, 'Transmit high voltage / external PSU');
      K.onTick((dt) => blade.parent.rotation.y += dt * 25);
      return { cam: [1.45, 1.45, 1.75], target: [.2, .9, 0] };
    }

    // phantom on a stand + scanning probe (animated) — shared
    function phantom(pos, kind, port) {
      const [x0, , z0] = pos;
      K.add(u.rb(.34, .025, .28, .01, M.steel, [x0, .8, z0])); K.add(u.cy(.02, .02, .78, M.steel, [x0, .4, z0], null, 12)); K.add(u.cy(.17, .19, .025, M.steel, [x0, .013, z0], null, 24));
      K.add(u.rb(.28, .16, .22, .03, u.mat(0x9ab7cf, { roughness: .25, transparent: true, opacity: .85 }), [x0, .895, z0]));
      const probe = mkProbe(kind), piezo = u.bx(.044, .006, .016, M.gold, [0, 0, 0]);
      K.part('probe', probe, { explode: [0, .3, .3] }); K.part('piezo', piezo, { explode: [0, -.1, .5] });
      const cable = u.tube([[x0, 1.13, z0], [x0 - .15, 1.2, z0 + .05], [port[0] + .2, port[1] + .2, port[2] + .25], [port[0], port[1], port[2] + .03]], .006, M.cable, 36); K.add(cable);
      const place = () => { const x = x0 + S.probeX, y = 1.0; probe.position.set(x, y, z0); probe.userData.base.set(x, y, z0); piezo.position.set(x, y - .025, z0); piezo.userData.base.set(x, y - .025, z0); };
      place();
      K.hazard('patient', [x0, 1.0, z0], .3, 'Applied part — probe face (leakage, surface temperature)');
      K.onTick((dt, t) => { if (S.scan) { S.probeX = Math.sin(t * .7) * .1; place(); } });
    }

    let dop;
    K.scan = {
      start(K) { S.scan = 1; if (K.Sound) dop = K.Sound.voice({ noise: true, filter: 'bandpass', freq: 600, q: 4 }); },
      tick(K, dt, t, p) { if (dop) { const ph = (t % .85) / .85, v = Math.exp(-((ph - .15) ** 2) / .004) + .25; dop.set({ vol: p > .5 ? .18 * v : 0, freq: 250 + v * 900, glide: .02 }); } },
      stop() { S.scan = 0; if (dop) { dop.stop(); dop = null; } }
    };
    return out;
  });
})();

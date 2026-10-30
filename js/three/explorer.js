/* 3D Machine Explorer — interactive procedural 3D models of each machine.
   Click a part for its service details, X-ray (see-through covers), exploded view,
   isolate, labels, and a "Run scan" sequence that walks the equipment workflow in 3D
   with synthesised sound. three.js is loaded on demand from a CDN.

   Models register with X3D.model(eqId, build) where build(K) uses the kit:
     K.part(compId, object3D, {explode:[x,y,z]})  -> clickable part linked to eq.components[compId]
     K.cover(object3D, {explode})                  -> housing that turns see-through in X-ray mode
     K.add(object3D)                               -> static scenery
     K.box/cyl/tube/ring/... geometry + K.m material helpers (see below)
     K.onTick(fn(dt,t,K)), K.scan = {start(K), tick(K,dt,t,p), stop(K)}, K.hazard(type,[x,y,z],r,label)
   Equipment without a hand-built model gets an auto-generated modular rack from its parts. */
(function () {
  const { esc, $, $$, toast } = UI;
  const V = window.Views = window.Views || {};
  const CDN = 'https://cdn.jsdelivr.net/npm/three@0.147.0/';
  const models = {};
  let loading = null, cur = null;

  function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Could not load ' + src)); document.head.appendChild(s); }); }
  function loadThree() {
    if (window.THREE && THREE.OrbitControls) return Promise.resolve();
    return loading || (loading = loadScript(CDN + 'build/three.min.js')
      .then(() => Promise.all([loadScript(CDN + 'examples/js/controls/OrbitControls.js'), loadScript(CDN + 'examples/js/environments/RoomEnvironment.js')]))
      .catch(e => { loading = null; throw e; }));
  }

  const HAZC = { chem: 0x4dd0ff, hv: 0xffcf3f, rad: 0xff9f43, mag: 0xb388ff, patient: 0xff6b81, laser: 0xff5ec4, bio: 0x7bd88f };

  /* ================= KIT ================= */
  function makeKit(scene) {
    const T = THREE;
    const K = { T, scene, parts: {}, covers: [], ticks: [], hazards: [], root: new T.Group() };
    scene.add(K.root);
    const std = (color, o = {}) => new T.MeshStandardMaterial(Object.assign({ color, roughness: .45, metalness: .1 }, o));
    K.m = {
      shell: () => std(0xdfe5ee, { roughness: .38, metalness: .05 }),
      shell2: () => std(0xc9d3e1, { roughness: .4 }),
      accent: () => std(0x2f7de1, { roughness: .35 }),
      dark: () => std(0x1d2633, { roughness: .6 }),
      metal: () => std(0xb8c2cc, { roughness: .28, metalness: .85 }),
      steel: () => std(0x7d8794, { roughness: .35, metalness: .8 }),
      copper: () => std(0xc87533, { roughness: .3, metalness: .9 }),
      gold: () => std(0xd8b04a, { roughness: .3, metalness: .9 }),
      pcb: () => std(0x1f7a4a, { roughness: .55 }),
      rubber: () => std(0x22272e, { roughness: .9 }),
      orange: () => std(0xe58a2b, { roughness: .45 }),
      glass: () => std(0x9fd0ff, { roughness: .05, metalness: 0, transparent: true, opacity: .35 }),
      screen: () => new T.MeshBasicMaterial({ color: 0x0a1424 }),
      glow: c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: .85 }),
      tubeC: () => std(0xd6e9f7, { roughness: .2, transparent: true, opacity: .7 })
    };
    const mesh = (g, m, p, r) => { const x = new T.Mesh(g, m); x.castShadow = true; x.receiveShadow = true; if (p) x.position.set(...p); if (r) x.rotation.set(...r); return x; };
    K.mesh = mesh;
    K.box = (w, h, d, m, p, r) => mesh(new T.BoxGeometry(w, h, d), m, p, r);
    K.rbox = (w, h, d, rad, m, p, r) => { // rounded box via extrude
      const s = new T.Shape(), x = -w / 2, y = -h / 2;
      s.moveTo(x + rad, y); s.lineTo(x + w - rad, y); s.quadraticCurveTo(x + w, y, x + w, y + rad); s.lineTo(x + w, y + h - rad); s.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
      s.lineTo(x + rad, y + h); s.quadraticCurveTo(x, y + h, x, y + h - rad); s.lineTo(x, y + rad); s.quadraticCurveTo(x, y, x + rad, y);
      const g = new T.ExtrudeGeometry(s, { depth: d - rad * 0.6, bevelEnabled: true, bevelThickness: rad * .3, bevelSize: rad * .3, bevelSegments: 3, curveSegments: 8 }); g.center();
      return mesh(g, m, p, r);
    };
    K.cyl = (rt, rb, h, m, p, r, seg = 40) => mesh(new T.CylinderGeometry(rt, rb, h, seg), m, p, r);
    K.sph = (rad, m, p) => mesh(new T.SphereGeometry(rad, 32, 16), m, p);
    K.torus = (R, t, m, p, r, arc) => mesh(new T.TorusGeometry(R, t, 20, 96, arc || Math.PI * 2), m, p, r);
    /* Ring/annulus extruded along z (gantry, bore). */
    K.ring = (Ro, Ri, d, m, p, r, square) => {
      const s = new T.Shape();
      if (square) { const a = Ro, rr = Ro * (typeof square === 'number' ? square : .25); s.moveTo(-a + rr, -a); s.lineTo(a - rr, -a); s.quadraticCurveTo(a, -a, a, -a + rr); s.lineTo(a, a - rr); s.quadraticCurveTo(a, a, a - rr, a); s.lineTo(-a + rr, a); s.quadraticCurveTo(-a, a, -a, a - rr); s.lineTo(-a, -a + rr); s.quadraticCurveTo(-a, -a, -a + rr, -a); }
      else s.absarc(0, 0, Ro, 0, Math.PI * 2, false);
      const h = new T.Path(); h.absarc(0, 0, Ri, 0, Math.PI * 2, true); s.holes.push(h);
      const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 3, curveSegments: 64 }); g.translate(0, 0, -d / 2);
      return mesh(g, m, p, r);
    };
    K.tube = (pts, rad, m) => mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts.map(q => new T.Vector3(...q))), 64, rad, 10), m);
    K.group = (...kids) => { const g = new T.Group(); kids.forEach(k => k && g.add(k)); return g; };
    K.at = (obj, p, r) => { obj.position.set(...p); if (r) obj.rotation.set(...r); return obj; };
    /* Canvas texture (for screens). draw(ctx,w,h,t) is called every frame when live. */
    K.screen = (w, h, draw, p, r, res = 256) => {
      const c = document.createElement('canvas'); c.width = res * (w / h); c.height = res;
      const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
      const m = new T.MeshBasicMaterial({ map: tex, toneMapped: false });
      const sc = mesh(new T.PlaneGeometry(w, h), m, p, r); sc.castShadow = false;
      sc.userData.draw = (t) => { draw(c.getContext('2d'), c.width, c.height, t); tex.needsUpdate = true; };
      K.screens = K.screens || []; K.screens.push(sc); return sc;
    };
    K.add = o => { K.root.add(o); return o; };
    K.part = (id, obj, o = {}) => {
      obj.traverse(x => { if (x.isMesh) { x.material = x.material.clone(); x.userData.part = id; x.userData.baseEm = x.material.emissive ? x.material.emissive.getHex() : null; } });
      obj.userData.base = obj.position.clone(); obj.userData.explode = new T.Vector3(...(o.explode || [0, 0, 0]));
      (o.parent || K.root).add(obj); (K.parts[id] = K.parts[id] || []).push(obj); return obj;
    };
    K.cover = (obj, o = {}) => {
      obj.traverse(x => { if (x.isMesh) { x.material = x.material.clone(); x.material.transparent = true; x.userData.cover = true; } });
      obj.userData.base = obj.position.clone(); obj.userData.explode = new T.Vector3(...(o.explode || [0, 0, 0]));
      (o.parent || K.root).add(obj); K.covers.push(obj); return obj;
    };
    K.hazard = (type, p, r, label) => {
      const m = new T.MeshBasicMaterial({ color: HAZC[type] || 0xffcf3f, transparent: true, opacity: .08, depthWrite: false, side: T.DoubleSide });
      const s = new T.Mesh(new T.SphereGeometry(r, 32, 16), m); s.position.set(...p); s.visible = false;
      const w = new T.LineSegments(new T.EdgesGeometry(new T.IcosahedronGeometry(r, 2)), new T.LineBasicMaterial({ color: HAZC[type] || 0xffcf3f, transparent: true, opacity: .35 })); s.add(w);
      s.userData.hz = { type, label }; K.root.add(s); K.hazards.push(s); return s;
    };
    K.onTick = fn => K.ticks.push(fn);
    return K;
  }

  /* Auto-generated model for equipment without a hand-built one: modules in a rack,
     linked by a signal bus in the catalog's signal order. */
  function autoModel(K, eq) {
    const ids = Object.keys(eq.components || {}); const n = ids.length || 1;
    const cols = Math.min(4, Math.ceil(Math.sqrt(n))), rows = Math.ceil(n / cols);
    K.cover(K.rbox(cols * 1.05 + .4, rows * .62 + .5, 1.2, .08, K.m.shell(), [0, rows * .31 + .45, 0]), { explode: [0, 0, -1.4] });
    K.add(K.box(cols * 1.05 + .6, .12, 1.4, K.m.dark(), [0, .06, 0]));
    const pts = [];
    ids.forEach((id, i) => {
      const r = Math.floor(i / cols), c = i % cols, x = (c - (cols - 1) / 2) * 1.05, y = .55 + (rows - 1 - r) * .62;
      const g = K.group(K.rbox(.9, .46, .8, .05, i % 3 === 0 ? K.m.accent() : i % 3 === 1 ? K.m.shell2() : K.m.dark(), [0, 0, 0]), K.box(.5, .05, .02, K.m.glow(0x2dd4bf), [0, .1, .41]));
      K.part(id, K.at(g, [x, y, 0]), { explode: [x * .5, (y - rows * .31) * .6, .9 + (i % 2) * .4] }); pts.push([x, y, -.5]);
    });
    if (pts.length > 1) K.add(K.tube(pts, .025, K.m.copper()));
    return { cam: [cols * 1.6, rows * .9 + 1.4, 3.6], target: [0, rows * .31 + .3, 0] };
  }

  /* ================= VIEWER ================= */
  function stop() {
    if (!cur) return; const c = cur; cur = null;
    cancelAnimationFrame(c.raf); c.ro && c.ro.disconnect();
    try { c.K.scan && c.K.scanning && c.K.scan.stop && c.K.scan.stop(c.K); } catch (e) { }
    window.Sim && Sim.Sound.stopAll();
    c.renderer.dispose(); c.scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map && m.map.dispose(); m.dispose(); }); });
  }

  V.x3dHub = function (el) {
    App.crumbs([['', '3D Machine Explorer']]);
    const hand = Object.keys(models).filter(id => BME.equipment[id]);
    el.innerHTML = `<div class="page-head"><div class="eyebrow">3D · Real-time</div><h1>3D machine explorer</h1>
      <p>Rotate the machine, look inside with X-ray view, pull it apart with the exploded view and click any part for its function, failure modes, tests, PM and spares. Press <b>Run scan</b> to watch the workflow play out in 3D with sound.</p></div>
      <h3>Manufacturer models — CT &amp; MRI</h3><div class="oem-grid" style="margin-bottom:22px">${Object.values(BME.oem || {}).map(o => `<a class="oem-card" href="#/3d/${o.equipment}?oem=${o.id}" style="--oc:${BME.oemMakers[o.maker].color}"><div class="oem-art">${Views._oemArt ? Views._oemArt(o) : ''}</div><div class="oem-body"><small>${esc(o.makerName)}</small><b>${esc(o.name)}</b><span>${esc(o.tagline)}</span></div></a>`).join('')}</div>
      <h3>Detailed 3D models</h3><div class="live-grid">${hand.map(id => card(id, true)).join('')}</div>
      <h3 style="margin-top:22px">Modular 3D (auto-generated from the parts list)</h3><div class="live-grid">${Object.keys(BME.equipment).filter(id => !models[id]).map(id => card(id, false)).join('')}</div>`;
    function card(id, full) { const e = BME.equipment[id]; return `<a class="live-card" href="#/3d/${id}">${full ? '<span class="live-pulse"></span>' : ''}<span class="lc-ic">⬢</span><b>${esc(e.name)}</b><small>${Object.keys(e.components || {}).length || (e.parts || []).length} clickable parts${full ? ' · scan animation + sound' : ''}</small></a>`; }
  };

  V.x3d = function (el, id) {
    const eq = BME.ensure(BME.equipment[id]);
    if (!eq) { el.innerHTML = '<div class="empty"><h2>Equipment not found</h2></div>'; return; }
    const q = window._query || new URLSearchParams(), oem = BME.oem && BME.oem[q.get('oem')] && BME.oem[q.get('oem')].equipment === id ? BME.oem[q.get('oem')] : null;
    const variants = Object.values(BME.oem || {}).filter(o => o.equipment === id);
    App.crumbs([['#/3d', '3D Explorer'], ['', oem ? oem.makerName + ' ' + oem.name : eq.name]]);
    Store.touch(id);
    el.innerHTML = `<div class="x3-head"><div><div class="eyebrow">⬢ 3D machine explorer${models[id] ? '' : ' · modular view'}${oem ? ' · ' + esc(oem.makerName) : ''}</div><h1>${esc(oem ? oem.name : eq.name)}</h1>
        ${oem ? `<p class="muted small" style="margin:0">${esc(oem.tagline)} · stylised training replica, not to scale · <a href="#/oem/${oem.id}">specs &amp; service parts →</a></p>` : ''}
        ${variants.length ? `<select id="x3var" class="x3-var" aria-label="Model"><option value="">Generic ${esc(eq.name)}</option>${['ge', 'siemens', 'philips'].map(mk => `<optgroup label="${esc(BME.oemMakers[mk].name)}">${variants.filter(v => v.maker === mk).map(v => `<option value="${v.id}" ${oem && oem.id === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</optgroup>`).join('')}</select>` : ''}</div>
        <div class="row gap wrap"><a class="btn" href="#/eq/${id}/components">Components</a>${window.Sim && Sim.has(id) ? `<a class="btn" href="#/live/${id}">◉ Live simulator</a>` : ''}<a class="btn" href="#/eq/${id}/service">Service</a></div></div>
      <div class="x3">
        <div class="x3-view" id="x3v"><div class="x3-load" id="x3load"><div class="spin"></div>Loading 3D engine…</div>
          <div class="x3-labels" id="x3lab"></div><div class="x3-tip" id="x3tip"></div>
          <div class="x3-sub" id="x3sub"></div>
          <div class="x3-tools">
            <div class="seg" id="x3mode"><button data-m="ext" class="on">Exterior</button><button data-m="xray">X-ray view</button><button data-m="service">Service</button></div>
            <label class="x3-ex">Exploded <input type="range" id="x3ex" min="0" max="1" step="0.01" value="0"></label>
            <button class="btn small" id="x3lbl">Labels</button><button class="btn small" id="x3rot">Auto-rotate</button><button class="btn small" id="x3reset">Reset view</button><button class="btn small" id="x3snd"></button>
          </div>
          <div class="x3-scanbar"><button class="btn btn-primary" id="x3scan">▶ Run scan</button><div class="x3-prog"><i id="x3p"></i></div><span id="x3stage" class="mono small"></span></div>
        </div>
        <aside class="x3-side"><div class="panel x3-info" id="x3info"></div><div class="panel"><h3>Parts</h3><input id="x3q" placeholder="Filter parts…"><div class="x3-parts" id="x3parts"></div></div></aside>
      </div>`;
    const info = $('#x3info', el);
    const comps = eq.components || {};
    const partList = filter => $('#x3parts', el).innerHTML = Object.entries(comps).filter(([k, c]) => !filter || c.name.toLowerCase().includes(filter)).map(([k, c]) => `<button data-p="${k}">${esc(c.name)}</button>`).join('');
    const vs = $('#x3var', el); if (vs) vs.onchange = () => { location.hash = '#/3d/' + id + (vs.value ? '?oem=' + vs.value : ''); };
    partList(); $('#x3q', el).oninput = e => partList(e.target.value.toLowerCase());

    loadThree().then(() => build(el, eq, oem), e => { const l = $('#x3load', el); if (l) l.innerHTML = `<b>3D engine could not be loaded.</b><small>${esc(e.message)}. The 3D explorer needs an internet connection the first time (three.js from jsDelivr).</small>`; })
      .catch(e => { console.error(e); const v = $('#x3v', el); if (v) v.insertAdjacentHTML('beforeend', `<div class="x3-load"><b>3D view failed to start.</b><small>${esc(e.message)} — WebGL may be disabled in this browser.</small></div>`); });
  };

  function build(el, eq, oem) {
    stop();
    const T = THREE, view = $('#x3v', el); if (!view) return;
    const info = $('#x3info', el), comps = eq.components || {};
    const renderer = new T.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(2, devicePixelRatio)); renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .85;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    view.prepend(renderer.domElement); $('#x3load', el).remove();
    const scene = new T.Scene(); scene.background = new T.Color(0x0b1322); scene.fog = new T.Fog(0x0b1322, 14, 34);
    const pm = new T.PMREMGenerator(renderer); scene.environment = pm.fromScene(new T.RoomEnvironment(), 0.04).texture; pm.dispose();
    const cam = new T.PerspectiveCamera(40, 1, 0.05, 100);
    const ctl = new T.OrbitControls(cam, renderer.domElement); ctl.enableDamping = true; ctl.dampingFactor = .08; ctl.maxPolarAngle = Math.PI * .49; ctl.minDistance = .6; ctl.maxDistance = 22;
    scene.add(new T.HemisphereLight(0xcfe3ff, 0x1a2333, .55));
    const key = new T.DirectionalLight(0xffffff, 1.3); key.position.set(5, 9, 6); key.castShadow = true; key.shadow.mapSize.set(1536, 1536);
    Object.assign(key.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 }); key.shadow.bias = -0.0005; scene.add(key);
    const rim = new T.DirectionalLight(0x4da3ff, .7); rim.position.set(-6, 4, -6); scene.add(rim);
    // floor with soft radial gradient + grid
    const fc = document.createElement('canvas'); fc.width = fc.height = 512; const fg = fc.getContext('2d');
    const gr = fg.createRadialGradient(256, 256, 10, 256, 256, 256); gr.addColorStop(0, '#1a2840'); gr.addColorStop(.6, '#0f1a2d'); gr.addColorStop(1, '#0b1322'); fg.fillStyle = gr; fg.fillRect(0, 0, 512, 512);
    const ftex = new T.CanvasTexture(fc); ftex.encoding = T.sRGBEncoding;
    const floor = new T.Mesh(new T.CircleGeometry(16, 64), new T.MeshStandardMaterial({ map: ftex, roughness: .9, metalness: 0, envMapIntensity: .2 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    const grid = new T.GridHelper(24, 48, 0x2a4470, 0x1a2a46); grid.material.transparent = true; grid.material.opacity = .35; grid.position.y = .002; scene.add(grid);

    const K = makeKit(scene); K.eq = eq; K.Sound = window.Sim && Sim.Sound;
    K.oem = oem || null; K.look = (oem && oem.look) || null;
    const def = models[eq.id] ? models[eq.id](K, eq) : autoModel(K, eq);
    const home = { cam: new T.Vector3(...(def.cam || [6, 4, 7])), target: new T.Vector3(...(def.target || [0, 1, 0])) };
    cam.position.copy(home.cam); ctl.target.copy(home.target);

    const c = cur = { renderer, scene, cam, ctl, K, el };
    const ray = new T.Raycaster(), mouse = new T.Vector2();
    let hover = null, sel = null, mode = 'ext', explode = 0, labels = false, fly = null, scanT = 0, stageIdx = -1;
    const active = new Set();
    const accent = new T.Color(0x4da3ff), cyan = new T.Color(0x2dd4bf);

    const resize = () => { const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    c.ro = new ResizeObserver(resize); c.ro.observe(view); resize();

    const meshesOf = id => { const out = []; (K.parts[id] || []).forEach(o => o.traverse(x => x.isMesh && out.push(x))); return out; };
    const allPartMeshes = () => Object.keys(K.parts).flatMap(meshesOf);
    function paint(t) {
      const pulse = .5 + .5 * Math.sin(t * 5);
      Object.keys(K.parts).forEach(id => {
        const on = id === sel ? 1 : id === hover ? .6 : active.has(id) ? .35 + .4 * pulse : 0;
        const col = active.has(id) && id !== sel && id !== hover ? cyan : accent;
        const ghost = (mode === 'xray' && sel && id !== sel) || (sel && c.isolate && id !== sel);
        meshesOf(id).forEach(m => {
          if (m.material.emissive) { if (on) m.material.emissive.copy(col).multiplyScalar(on * .55); else m.material.emissive.setHex(m.userData.baseEm || 0); }
          if (m.userData.op0 == null) m.userData.op0 = m.material.opacity, m.userData.tr0 = m.material.transparent;
          m.material.transparent = ghost || m.userData.tr0; m.material.opacity = ghost ? .18 : m.userData.op0; m.material.depthWrite = !ghost;
        });
      });
    }
    function applyMode() {
      $$('#x3mode button', el).forEach(b => b.classList.toggle('on', b.dataset.m === mode));
      K.covers.forEach(o => o.traverse(m => { if (m.isMesh) { m.material.opacity = mode === 'ext' ? 1 : .1; m.material.depthWrite = mode === 'ext'; m.castShadow = mode === 'ext'; } }));
      K.hazards.forEach(h => h.visible = mode === 'service');
      $('#x3sub', el).innerHTML = mode === 'service' && K.hazards.length ? `<div class="x3-legend">${[...new Set(K.hazards.map(h => h.userData.hz.type))].map(t => `<span class="haz haz-${t}">${UI.HAZ[t] || '⚠'} ${esc(K.hazards.find(h => h.userData.hz.type === t).userData.hz.label)}</span>`).join('')}<small>Zones are illustrative for training — use the site survey and manufacturer data for real boundaries.</small></div>` : '';
    }
    /* Field-replaceable-unit detail (manufacturer-level) for CT/MRI parts. */
    const frus = BME.oemFru && BME.oemFru[eq.id] ? (oem ? BME.oemParts(oem.id) : BME.oemFru[eq.id]) : [];
    function fruHtml(id) {
      const list = frus.filter(f => f.comp === id); if (!list.length) return '';
      const li = a => `<ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
      return `<div class="x3-fru"><div class="eyebrow">Service parts (FRU)${oem ? ' · ' + esc(oem.makerName + ' ' + oem.name) : ''}</div>${list.map(f => `<details open><summary><b>${esc(f.oemName || f.name)}</b> <span class="tag ${/Crit|High/.test(f.crit) ? 'tag-bad' : 'tag-warn'}">${esc(f.crit)}</span></summary>
        <div class="x3-kv">${f.oemName ? `<small>Generic part</small><p>${esc(f.name)}</p>` : ''}<small>Symptoms of failure</small>${li(f.sym)}<small>Diagnosis</small>${li(f.diag)}<small>Replacement</small><p>${esc(f.replace)}</p><small>Part number</small><p class="muted">From the manufacturer's service parts portal — record it on the asset.</p></div></details>`).join('')}</div>`;
    }
    function select(id, flyTo) {
      sel = id; c.isolate = false;
      $$('#x3parts button', el).forEach(b => b.classList.toggle('on', b.dataset.p === id));
      if (!id) { info.innerHTML = '<p class="muted">Click a part to see its details.</p>'; return; }
      const p = comps[id] || { name: id };
      const li = a => a && a.length ? `<ul>${[].concat(a).map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
      info.innerHTML = `<div class="eyebrow">Part</div><h2>${esc(p.name)}</h2>
        <div class="x3-kv"><small>Function</small><p>${esc(p.function || '—')}</p>
        ${p.normal ? `<small>Normal condition</small><p>${esc(p.normal)}</p>` : ''}
        <small>Common failure</small><p>${esc(p.failure || '—')}</p>
        ${p.symptoms ? `<small>Symptoms</small>${li(p.symptoms)}` : ''}
        <small>Engineer test</small><p>${esc(p.test || '—')}</p>
        ${p.pm ? `<small>PM</small>${Array.isArray(p.pm) ? li(p.pm) : `<p>${esc(p.pm)}</p>`}` : ''}
        ${p.spares ? `<small>Spares</small>${Array.isArray(p.spares) ? li(p.spares) : `<p>${esc(p.spares)}</p>`}` : ''}
        ${p.safety ? `<small>Safety</small><p class="bad-t">${esc([].concat(p.safety).join(' · '))}</p>` : ''}</div>
        ${fruHtml(id)}
        <div class="row gap wrap"><button class="btn small" id="x3iso">Isolate</button><button class="btn small" id="x3fly">Zoom to part</button><a class="btn small" href="#/eq/${eq.id}/components" id="x3full">Full detail →</a></div>`;
      $('#x3iso', el).onclick = () => { c.isolate = !c.isolate; };
      $('#x3fly', el).onclick = () => flyTo_(id);
      $('#x3full', el).onclick = () => { window._openComp = id; };
      Store.eqProgress(eq.id).comps[id] = true; Store.save();
      if (flyTo) flyTo_(id);
    }
    function flyTo_(id) {
      const box = new T.Box3(); (K.parts[id] || []).forEach(o => box.expandByObject(o)); if (box.isEmpty()) return;
      const ctr = box.getCenter(new T.Vector3()), size = box.getSize(new T.Vector3()).length();
      const dir = cam.position.clone().sub(ctl.target).normalize();
      fly = { t: 0, p0: cam.position.clone(), t0: ctl.target.clone(), p1: ctr.clone().add(dir.multiplyScalar(Math.max(1.4, size * 2.2))), t1: ctr };
    }
    const pick = e => {
      const r = renderer.domElement.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, cam);
      const hit = ray.intersectObjects(allPartMeshes().filter(m => m.visible && m.material.opacity > .2), false)[0];
      return hit ? hit.object.userData.part : null;
    };
    let down = null;
    renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
    renderer.domElement.addEventListener('pointermove', e => {
      const id = pick(e); hover = id; renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
      const tip = $('#x3tip', el); if (!tip) return;
      if (id) { const r = view.getBoundingClientRect(); tip.style.display = 'block'; tip.style.left = (e.clientX - r.left + 14) + 'px'; tip.style.top = (e.clientY - r.top + 10) + 'px'; tip.textContent = (comps[id] || {}).name || id; } else tip.style.display = 'none';
    });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const id = pick(e); if (id) { select(id); K.Sound && K.Sound.beep(1320, .04, { vol: .06 }); } else if (sel) select(null);
    });
    $('#x3parts', el).onclick = e => { const b = e.target.closest('[data-p]'); if (b) select(b.dataset.p, true); };
    $('#x3mode', el).onclick = e => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; applyMode(); };
    $('#x3ex', el).oninput = e => explode = +e.target.value;
    $('#x3lbl', el).onclick = e => { labels = !labels; e.target.classList.toggle('on', labels); if (!labels) $('#x3lab', el).innerHTML = ''; };
    $('#x3rot', el).onclick = e => { ctl.autoRotate = !ctl.autoRotate; ctl.autoRotateSpeed = 1.2; e.target.classList.toggle('on', ctl.autoRotate); };
    $('#x3reset', el).onclick = () => { fly = { t: 0, p0: cam.position.clone(), t0: ctl.target.clone(), p1: home.cam.clone(), t1: home.target.clone() }; select(null); $('#x3ex', el).value = explode = 0; };
    const sndBtn = $('#x3snd', el), syncSnd = () => { if (!K.Sound) return sndBtn.style.display = 'none'; sndBtn.textContent = K.Sound.muted ? '🔇' : '🔊'; };
    syncSnd(); sndBtn.onclick = () => { K.Sound.init(); K.Sound.setMuted(!K.Sound.muted); syncSnd(); };

    /* Scan: walk the equipment workflow; each stage highlights its active parts. */
    const W = eq.workflow || [], STAGE_S = 4.5;
    const scanBtn = $('#x3scan', el);
    const endScan = () => { K.scanning = false; active.clear(); scanBtn.textContent = '▶ Run scan'; $('#x3p', el).style.width = '0%'; $('#x3stage', el).textContent = ''; K.scan && K.scan.stop && K.scan.stop(K); };
    scanBtn.onclick = () => {
      if (K.scanning) return endScan();
      K.Sound && K.Sound.init(); K.scanning = true; scanT = 0; stageIdx = -1; scanBtn.textContent = '■ Stop';
      K.scan && K.scan.start && K.scan.start(K);
    };
    applyMode(); select(null);
    info.insertAdjacentHTML('afterbegin', `<h3>How to use</h3><ul class="x3-help"><li><b>Drag</b> rotate · <b>right-drag</b> pan · <b>wheel</b> zoom</li><li><b>Click a part</b> for service details</li><li><b>X-ray view</b> sees through covers · <b>Service</b> shows hazard zones</li><li><b>Run scan</b> animates the workflow with sound</li></ul>`);

    const clock = new T.Clock(); let t = 0, scrT = 0;
    const tmpV = new T.Vector3();
    const loop = () => {
      if (cur !== c) return;
      if (!document.body.contains(renderer.domElement)) return stop();
      const dt = Math.min(.05, clock.getDelta()); t += dt;
      // explode
      [...Object.values(K.parts).flat(), ...K.covers].forEach(o => o.position.copy(o.userData.base).addScaledVector(o.userData.explode, explode));
      if (fly) { fly.t = Math.min(1, fly.t + dt * 1.6); const k = 1 - Math.pow(1 - fly.t, 3); cam.position.lerpVectors(fly.p0, fly.p1, k); ctl.target.lerpVectors(fly.t0, fly.t1, k); if (fly.t >= 1) fly = null; }
      // scan sequence
      if (K.scanning) {
        scanT += dt; const total = Math.max(1, W.length) * STAGE_S, p = Math.min(1, scanT / total);
        const si = Math.min(W.length - 1, Math.floor(scanT / STAGE_S));
        if (si !== stageIdx && W[si]) {
          stageIdx = si; active.clear(); (W[si].active || []).forEach(a => active.add(a));
          $('#x3sub', el).innerHTML = `<div class="x3-caption"><small>Stage ${si + 1}/${W.length}</small><b>${esc(W[si].title)}</b><span>${esc(W[si].what || '')}</span></div>`;
          $('#x3stage', el).textContent = W[si].title; K.Sound && K.Sound.beep(880, .05, { vol: .05 });
        }
        $('#x3p', el).style.width = (p * 100) + '%';
        try { K.scan && K.scan.tick && K.scan.tick(K, dt, t, p); } catch (e) { console.error(e); }
        if (p >= 1) { endScan(); $('#x3sub', el).innerHTML = ''; applyMode(); toast('Scan sequence complete'); }
      }
      K.ticks.forEach(f => f(dt, t, K));
      if (K.screens && (scrT += dt) > 1 / 20) { scrT = 0; K.screens.forEach(s => s.userData.draw(t)); }
      paint(t); ctl.update(); renderer.render(scene, cam);
      if (labels) {
        const w = view.clientWidth, h = view.clientHeight;
        $('#x3lab', el).innerHTML = Object.keys(K.parts).map(id => {
          const box = new T.Box3(); K.parts[id].forEach(o => box.expandByObject(o)); box.getCenter(tmpV); tmpV.project(cam);
          if (tmpV.z > 1) return ''; return `<span style="left:${(tmpV.x * .5 + .5) * w}px;top:${(-tmpV.y * .5 + .5) * h}px" class="${id === sel ? 'on' : ''}">${esc((comps[id] || {}).name || id)}</span>`;
        }).join('');
      }
      c.raf = requestAnimationFrame(loop);
    };
    c.raf = requestAnimationFrame(loop);
  }

  window.X3D = { model: (id, fn) => { models[id] = fn; }, has: id => !!models[id], stop, load: loadThree };
})();

/* Persistent state (localStorage) and file storage (IndexedDB).
   Production deployments replace these with API calls to the database
   described in db/schema.sql — the shape of each record matches a table. */
(function () {
  const KEY = 'bme-academy-v1';
  const defaults = () => ({
    theme: null, unlockAll: false, user: { name: 'Trainee Engineer' },
    progress: {}, quiz: {}, scenarios: {}, cases: {}, safety: {}, tools: {}, artifacts: {},
    qaLimits: {}, qaRecords: [], pmRecords: [], serviceReports: [], assets: [], bookmarks: {}, weak: [],
    custom: { categories: [], equipment: [], models: [], errors: [] }
  });

  let state;
  try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch (e) { state = defaults(); }

  const Store = {
    get s() { return state; },
    save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('Save failed', e); } },
    reset() { state = defaults(); this.save(); },
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(txt) { state = Object.assign(defaults(), JSON.parse(txt)); this.save(); },

    eqProgress(id) {
      const p = state.progress[id] || (state.progress[id] = { tabs: {}, comps: {}, last: 0 });
      return p;
    },
    touch(id, tab) {
      const p = this.eqProgress(id);
      p.last = Date.now();
      if (tab) p.tabs[tab] = true;
      this.save();
    },
    /* Percentage of the 14 learning tabs visited plus components opened. */
    percent(id) {
      const eq = BME.equipment[id]; const p = state.progress[id];
      if (!p || !eq) return 0;
      const tabs = Object.keys(p.tabs).length / BME.TABS.length;
      const nComp = Object.keys(eq.components || {}).length || 1;
      const comps = Math.min(1, Object.keys(p.comps).length / nComp);
      const quiz = state.quiz[id] ? 1 : 0;
      return Math.round((tabs * 0.6 + comps * 0.25 + quiz * 0.15) * 100);
    },
    recordQuiz(key, result) { state.quiz[key] = Object.assign({ ts: Date.now() }, result); this.save(); },

    /* Training level: unlocked by passed assessments, solved scenarios and cases. */
    level() {
      if (state.unlockAll) return 5;
      const passed = Object.values(state.quiz).filter(q => q.pct >= 70).length;
      const solved = Object.values(state.scenarios).filter(s => s.solved).length + Object.values(state.cases).filter(c => c.solved).length;
      const visited = Object.keys(state.progress).length;
      let lvl = 1;
      if (visited >= 1 && passed >= 1) lvl = 2;
      if (passed >= 2) lvl = 3;
      if (passed >= 3 && solved >= 2) lvl = 4;
      if (passed >= 5 && solved >= 5) lvl = 5;
      return lvl;
    },

    limit(eqId, testId) { return state.qaLimits[eqId + ':' + testId] || null; },
    setLimit(eqId, testId, v) { state.qaLimits[eqId + ':' + testId] = v; this.save(); }
  };
  window.Store = Store;

  /* ---------- IndexedDB for uploaded documents and photos ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('IndexedDB unavailable'));
      const r = indexedDB.open('bme-academy', 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('files', { keyPath: 'id' });
        r.result.createObjectStore('media', { keyPath: 'id' });
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  const tx = (store, mode, fn) => db().then(d => new Promise((res, rej) => {
    const t = d.transaction(store, mode); const st = t.objectStore(store);
    const out = fn(st);
    t.oncomplete = () => res(out && out.result !== undefined ? out.result : out);
    t.onerror = () => rej(t.error);
  }));
  window.Files = {
    put: (store, rec) => tx(store, 'readwrite', s => s.put(rec)),
    get: (store, id) => tx(store, 'readonly', s => s.get(id)),
    all: (store) => tx(store, 'readonly', s => s.getAll()),
    del: (store, id) => tx(store, 'readwrite', s => s.delete(id))
  };

  /* ---------- Merge admin-added content ---------- */
  state.custom.categories.forEach(c => BME.addCategory(c));
  state.custom.equipment.forEach(e => BME.registerEquipment(Object.assign({ custom: true }, e)));
  BME.models = BME.models.concat(state.custom.models);

  /* ---------- Auto-generate structure for equipment without a content pack ---------- */
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  BME.ensure = function (eq) {
    if (!eq || eq._ready) return eq;
    eq.pm = eq.pm || BME.genericPM;
    eq.questions = (eq.questions || []).concat(eq.full ? [] : BME.genericQuestions);
    eq.tools = eq.tools || ['esa', 'multimeter'];
    eq.hazards = eq.hazards || [];
    if (!eq.diagram && eq.parts && eq.parts.length) {
      eq.generated = true;
      const cols = 4, W = 190, H = 60, gx = 50, gy = 70, x0 = 40, y0 = 50;
      const nodes = eq.parts.map((p, i) => {
        const row = Math.floor(i / cols); let col = i % cols;
        if (row % 2) col = cols - 1 - col; // snake layout keeps the chain readable
        return { id: slug(p) || 'n' + i, x: x0 + col * (W + gx), y: y0 + row * (H + gy), w: W, h: H, label: p };
      });
      const rows = Math.ceil(nodes.length / cols);
      eq.diagram = { w: 1000, h: Math.max(300, y0 * 2 + rows * (H + gy)), nodes, zones: [],
        links: nodes.slice(1).map((n, i) => [nodes[i].id, n.id]) };
      eq.components = {};
      nodes.forEach((n, i) => {
        eq.components[n.id] = {
          name: n.label, function: n.label + ' stage of the ' + eq.name + ' signal/energy chain.',
          principle: 'Content pack pending.', input: i ? nodes[i - 1].label : 'Supply / user input', output: nodes[i + 1] ? nodes[i + 1].label : 'Final output',
          normal: 'Per manufacturer documentation.', failure: 'Add via content pack.', symptoms: '—', test: 'Model-specific procedure required.',
          service: 'Model-specific procedure required.', safety: (eq.hazards[0] || {}).label || 'Follow LOTO and general electrical safety.',
          spares: [], pm: [], qa: []
        };
      });
      eq.workflow = nodes.map((n, i) => ({ title: n.label, active: [n.id], what: 'Signal / energy is processed by the ' + n.label + '.', signal: i ? 'From ' + nodes[i - 1].label : 'Input', parameter: '—', fail: 'Failure here interrupts every downstream stage.' }));
    }
    eq.components = eq.components || {};
    eq.workflow = eq.workflow || [];
    eq._ready = true;
    return eq;
  };
  Object.values(BME.equipment).forEach(e => { if (e.diagram && e.components && e.summary) e.full = true; });
})();

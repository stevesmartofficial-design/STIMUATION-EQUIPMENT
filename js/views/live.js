/* Live simulator routes: hub (#/live) and one simulator (#/live/:eq). */
(function () {
  const { esc } = UI;
  const V = window.Views = window.Views || {};
  const ICON = { ct: '◎', mri: '◉', xray: '☢', ultrasound: '◠', ventilator: '❋', patientMonitor: '♥', defibrillator: '⚡', infusionPump: '⧗' };

  V.liveHub = function (el) {
    App.crumbs([['', 'Live Simulators']]);
    const ids = Sim.list().filter(id => BME.equipment[id]);
    const r = Store.s.live || {};
    el.innerHTML = `<div class="page-head"><div class="eyebrow">Real-time · Sound</div><h1>Live simulators</h1>
      <p>Each machine runs in real time: live waveforms, the console, the sounds (QRS tone, alarm priorities, breath flow, gantry spin, gradient noise, charge whine, Doppler) and alarms that react to your settings. Inject faults as an instructor, or let the system hide a <b>mystery fault</b> and diagnose it from what you see and hear.</p></div>
      <div class="info-banner small">🔊 Sound starts when you power a simulator on. Training approximations only: alarm patterns, voice prompts and numbers are generic, not those of any specific manufacturer.</div>
      <div class="live-grid">${ids.map(id => { const e = BME.equipment[id], s = r[id];
        return `<a class="live-card" href="#/live/${id}"><span class="live-pulse"></span><span class="lc-ic">${ICON[id] || '◉'}</span><b>${esc(e.name)}</b><small>${esc((e.summary || '').slice(0, 110))}${(e.summary || '').length > 110 ? '…' : ''}</small>
          <div class="row gap wrap"><span class="tag">Live + sound</span>${window.X3D && X3D.has(id) ? '<span class="tag">3D</span>' : ''}${s ? `<span class="tag tag-ok">Mystery ${s.solved}/${s.tries}</span>` : ''}</div></a>`; }).join('')}</div>`;
  };

  /* The DICOM decoder (daikon, ~1.2 MB) is fetched only when the viewer is opened. */
  const DAIKON = 'https://cdn.jsdelivr.net/npm/daikon@1.2.45/release/current/daikon-min.js';
  let daikonP = null;
  document.addEventListener('DOMContentLoaded', () => {
    const real = V.dicomViewer; if (!real) return;
    V.dicomViewer = function (el) {
      if (window.daikon) return real(el);
      App.crumbs([['', 'DICOM Viewer']]);
      el.innerHTML = '<div class="empty"><div class="spin" style="margin:0 auto 12px"></div>Loading DICOM decoder…</div>';
      daikonP = daikonP || new Promise((res, rej) => { const s = document.createElement('script'); s.src = DAIKON; s.onload = res; s.onerror = () => { daikonP = null; rej(); }; document.head.appendChild(s); });
      daikonP.then(() => { if (location.hash.split('?')[0] === '#/dicom-viewer' && document.body.contains(el)) real(el); },
        () => { el.innerHTML = '<div class="empty"><h2>DICOM decoder could not be loaded</h2><p>The viewer needs an internet connection the first time (jsDelivr).</p></div>'; });
    };
    Object.assign(V.dicomViewer, real);
  });

  V.live = function (el, id) {
    if (!Sim.has(id)) { el.innerHTML = `<div class="empty"><h2>No live simulator for this equipment yet</h2><a class="btn" href="#/live">All simulators</a> <a class="btn" href="#/3d/${esc(id)}">3D explorer</a></div>`; return; }
    const eq = BME.equipment[id];
    App.crumbs([['#/live', 'Live Simulators'], ['', eq ? eq.name : id]]);
    if (eq) Store.touch(id);
    Sim.mount(el, id);
    if (window.X3D) el.querySelector('.sim-head-btns').insertAdjacentHTML('beforeend', `<a class="btn" href="#/3d/${id}">⬢ 3D</a>`);
  };
})();

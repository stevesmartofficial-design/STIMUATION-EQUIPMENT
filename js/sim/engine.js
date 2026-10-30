/* Real-time simulation engine: Web Audio synthesiser, sweep-style strip charts,
   alarm manager (priority patterns), event log, fault injection and the
   "mystery fault" challenge. Equipment simulators register with
   Sim.register(eqId, def) — see js/sim/monitor.js for the reference simulator.

   def = {
     title, intro,                         // header text
     stage(S) -> html,                     // markup for the live display (canvases etc.)
     controls: [{id,label,type:'range',min,max,step,value,unit} | {id,label,type:'select',options:[[v,l]],value} | {id,label,type:'toggle',value}],
     actions:  [{id,label,primary}],       // buttons -> def.onAction(S,id)
     faults:   [{id,label,explain,check}], // injectable faults (instructor) / mystery fault pool
     init(S), tick(S, dt, t), onAction(S,id), onControl(S,id,value), stop(S)
   }
   S (instance): el, v (control values), fault (Set), t, on (powered), $(sel),
     alarm(id, priority 'high'|'med'|'low', text), clear(id), log(text, kind),
     num(id, value), strip(canvasSel, opts), sound (= Sound)
   All sound is synthesised at run time — no audio files. */
(function () {
  const { esc, $, $$, toast } = UI;

  /* ================= SOUND ================= */
  const MUTE_KEY = 'bme-sound-muted';
  const Sound = {
    ctx: null, master: null, voices: new Set(),
    muted: (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch (e) { return false; } })(),
    vol: 0.6,
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      this.ctx = new AC(); this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.vol; this.master.connect(this.ctx.destination);
      return this.ctx;
    },
    get now() { return this.ctx ? this.ctx.currentTime : 0; },
    setMuted(m) {
      this.muted = m; try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch (e) { }
      if (this.master) this.master.gain.setTargetAtTime(m ? 0 : this.vol, this.now, 0.02);
      if (m && window.speechSynthesis) speechSynthesis.cancel();
      document.dispatchEvent(new CustomEvent('sound-change'));
    },
    setVolume(v) { this.vol = v; if (this.master && !this.muted) this.master.gain.setTargetAtTime(v, this.now, 0.02); },
    /* One-shot tone. */
    beep(freq, dur = 0.1, o = {}) {
      const c = this.init(); if (!c) return;
      const t = (o.when || c.currentTime), osc = c.createOscillator(), g = c.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(o.slide, t + dur);
      const v = o.vol == null ? 0.25 : o.vol, a = o.attack || 0.005, r = o.release || 0.03;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a);
      g.gain.setValueAtTime(v, t + Math.max(a, dur - r)); g.gain.linearRampToValueAtTime(0, t + dur);
      let node = osc;
      if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; osc.connect(f); node = f; }
      node.connect(g); g.connect(this.master); osc.start(t); osc.stop(t + dur + 0.02);
    },
    /* Harmonic-rich alarm pulse (alarm tones need harmonics to be localisable). */
    pulse(freq, dur, when, vol = 0.2) {
      [1, 2, 3, 4].forEach((h, i) => this.beep(freq * h, dur, { when, vol: vol / (i + 1.5), attack: 0.015, release: 0.04 }));
    },
    _noiseBuf: null,
    noiseBuffer() {
      if (this._noiseBuf) return this._noiseBuf;
      const c = this.ctx, b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      return (this._noiseBuf = b);
    },
    /* Short noise burst (clicks, thumps, valve sounds). */
    burst(dur = 0.05, o = {}) {
      const c = this.init(); if (!c) return;
      const t = o.when || c.currentTime, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = this.noiseBuffer(); f.type = o.filter || 'bandpass'; f.frequency.value = o.freq || 1200; f.Q.value = o.q || 1;
      const v = o.vol == null ? 0.3 : o.vol;
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.02);
    },
    /* Continuous voice: noise or oscillator through a filter; .set() changes it live. */
    voice(o = {}) {
      const c = this.init(); if (!c) return { set() { }, stop() { } };
      const g = c.createGain(); g.gain.value = 0;
      const f = c.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.value = o.freq || 800; f.Q.value = o.q || 0.7;
      let src;
      if (o.noise) { src = c.createBufferSource(); src.buffer = this.noiseBuffer(); src.loop = true; }
      else { src = c.createOscillator(); src.type = o.type || 'sine'; src.frequency.value = o.pitch || 100; }
      src.connect(f); f.connect(g); g.connect(this.master); src.start();
      const v = {
        src, filter: f, gain: g,
        set(p = {}) {
          const t = c.currentTime, k = p.glide == null ? 0.05 : p.glide;
          if (p.vol != null) g.gain.setTargetAtTime(p.vol, t, k);
          if (p.freq != null) f.frequency.setTargetAtTime(p.freq, t, k);
          if (p.pitch != null && src.frequency) src.frequency.setTargetAtTime(p.pitch, t, k);
        },
        stop() { try { g.gain.setTargetAtTime(0, c.currentTime, 0.03); src.stop(c.currentTime + 0.2); } catch (e) { } Sound.voices.delete(v); }
      };
      this.voices.add(v); return v;
    },
    stopAll() { [...this.voices].forEach(v => v.stop()); if (window.speechSynthesis) speechSynthesis.cancel(); },
    /* Voice prompts (AED style) via the browser's speech synthesiser. */
    speak(text) {
      if (this.muted || !window.speechSynthesis) return;
      speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1; u.pitch = 0.9; u.volume = Math.min(1, this.vol + 0.3);
      speechSynthesis.speak(u);
    },
    /* Alarm patterns modelled on the IEC 60601-1-8 burst structure (training approximation):
       high = 10 pulses (3 + 2, pause, 3 + 2), medium = 3 pulses, low = 2 pulses. */
    alarm(priority) {
      const c = this.init(); if (!c) return;
      const t = c.currentTime + 0.02;
      if (priority === 'high') {
        const off = [0, .2, .4, .8, 1.0, 1.7, 1.9, 2.1, 2.5, 2.7], notes = [988, 1175, 1319, 988, 1319, 988, 1175, 1319, 988, 1319];
        off.forEach((o, i) => this.pulse(notes[i], 0.14, t + o, 0.18));
      } else if (priority === 'med') {
        [0, .3, .6].forEach((o, i) => this.pulse([659, 784, 988][i], 0.22, t + o, 0.16));
      } else {
        [0, .35].forEach((o, i) => this.pulse([659, 784][i], 0.25, t + o, 0.1));
      }
    }
  };
  const ALARM_REPEAT = { high: 6, med: 12, low: 20 };

  /* ================= STRIP CHART (sweep display like a bedside monitor) ================= */
  class Strip {
    constructor(canvas, o) {
      this.c = canvas; this.g = canvas.getContext('2d');
      this.o = Object.assign({ speed: 120, min: -1, max: 1, color: '#36d39a', label: '', unit: '', grid: true, fill: false, width: 2 }, o);
      this.ys = null; this.head = 0; this.acc = 0; this.resize();
    }
    resize() {
      const dpr = window.devicePixelRatio || 1, w = Math.max(50, this.c.clientWidth), h = Math.max(30, this.c.clientHeight);
      if (this.c.width === Math.round(w * dpr) && this.ys) return;
      this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr); this.dpr = dpr; this.w = w; this.h = h;
      this.ys = new Float32Array(Math.ceil(w)).fill(NaN); this.head = 0;
    }
    /* Advance by dt seconds, sampling fn(t) for each new pixel column. */
    advance(dt, t, fn) {
      this.resize();
      this.acc += dt * this.o.speed; const n = Math.floor(this.acc); this.acc -= n;
      const W = this.ys.length;
      for (let k = 0; k < n; k++) { this.ys[this.head] = fn(t - (n - k) / this.o.speed); this.head = (this.head + 1) % W; }
      this.draw();
    }
    draw() {
      const { g, o, w, h, dpr } = this; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      if (o.grid) { g.strokeStyle = 'rgba(120,150,200,.10)'; g.lineWidth = 1; g.beginPath(); for (let x = 0; x < w; x += 25) { g.moveTo(x, 0); g.lineTo(x, h); } for (let y = 0; y < h; y += 25) { g.moveTo(0, y); g.lineTo(w, y); } g.stroke(); }
      const Y = v => h - 6 - (v - o.min) / (o.max - o.min) * (h - 12);
      /* Collect contiguous runs (the sweep gap and NaN samples break the trace). */
      const W = this.ys.length, gap = 14, runs = []; let run = null;
      for (let x = 0; x < W; x++) {
        const d = (x - this.head + W) % W; const v = this.ys[x];
        if (d < gap || isNaN(v)) { run = null; continue; }
        if (!run) runs.push(run = []);
        run.push(x, Math.max(1, Math.min(h - 1, Y(v))));
      }
      g.strokeStyle = o.color; g.lineWidth = o.width; g.lineJoin = 'round'; g.beginPath();
      runs.forEach(r => { g.moveTo(r[0], r[1]); for (let i = 2; i < r.length; i += 2) g.lineTo(r[i], r[i + 1]); });
      g.stroke();
      if (o.fill) {
        const base = Y(Math.max(o.min, 0)); g.globalAlpha = .14; g.fillStyle = o.color;
        runs.forEach(r => { g.beginPath(); g.moveTo(r[0], base); for (let i = 0; i < r.length; i += 2) g.lineTo(r[i], r[i + 1]); g.lineTo(r[r.length - 2], base); g.fill(); });
        g.globalAlpha = 1;
      }
      if (o.label) { g.fillStyle = o.color; g.font = '600 11px Inter, sans-serif'; g.fillText(o.label + (o.unit ? '  ' + o.unit : ''), 8, 14); }
    }
    clear() { if (this.ys) this.ys.fill(NaN); }
  }

  /* ================= INSTANCE ================= */
  let current = null;
  const registry = {};
  const fmtT = s => { s = Math.floor(s); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  function mount(el, eqId) {
    stop();
    const def = registry[eqId], eq = BME.equipment[eqId];
    const S = {
      def, eq, el, v: {}, fault: new Set(), t: 0, on: false, sound: Sound, strips: [], alarms: {}, mystery: null, silencedUntil: 0,
      $: sel => el.querySelector(sel),
      log(text, kind = 'info') {
        const box = el.querySelector('#simLog'); if (!box) return;
        box.insertAdjacentHTML('afterbegin', `<div class="sl-${kind}"><time>${fmtT(S.t)}</time>${esc(text)}</div>`);
        while (box.children.length > 60) box.lastChild.remove();
      },
      alarm(id, pr, text) {
        if (S.alarms[id]) return; S.alarms[id] = { pr, text, next: 0 };
        S.log(`ALARM (${pr === 'med' ? 'medium' : pr}): ${text}`, pr === 'high' ? 'bad' : 'warn'); renderAlarms();
      },
      clear(id) { if (!S.alarms[id]) return; delete S.alarms[id]; renderAlarms(); },
      num(id, val) { const n = el.querySelector(`[data-num="${id}"]`); if (n && n.textContent !== String(val)) n.textContent = val; },
      strip(sel, o) { const c = el.querySelector(sel); if (!c) return null; const s = new Strip(c, o); S.strips.push(s); return s; },
      has: f => S.fault.has(f)
    };
    (def.controls || []).forEach(c => S.v[c.id] = c.value);

    const ctl = c => {
      if (c.type === 'select') return `<label>${esc(c.label)}<select data-ctl="${c.id}">${c.options.map(([v, l]) => `<option value="${esc(v)}" ${v == c.value ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
      if (c.type === 'toggle') return `<label class="sim-toggle"><input type="checkbox" data-ctl="${c.id}" ${c.value ? 'checked' : ''}> ${esc(c.label)}</label>`;
      return `<label>${esc(c.label)} <b data-out="${c.id}">${c.value}${c.unit ? ' ' + esc(c.unit) : ''}</b><input type="range" data-ctl="${c.id}" min="${c.min}" max="${c.max}" step="${c.step || 1}" value="${c.value}"></label>`;
    };
    el.innerHTML = `<div class="sim-head">
        <div><div class="eyebrow">◉ Live simulator · ${esc(eq ? eq.name : eqId)}</div><h1>${esc(def.title)}</h1><p class="muted">${esc(def.intro || '')}</p></div>
        <div class="sim-head-btns">
          <button class="btn btn-primary" id="simPower">⏻ Power on</button>
          <button class="btn" id="simMute" title="Sound on / off"></button>
          <input type="range" id="simVol" min="0" max="1" step="0.05" value="${Sound.vol}" title="Volume" aria-label="Volume">
          ${eq ? `<a class="btn" href="#/eq/${eqId}/how">Theory</a>` : ''}
        </div></div>
      <div class="sim-layout2">
        <div class="sim-main">
          <div class="sim-alarmbar" id="simAlarms"><span class="muted">No active alarms</span></div>
          <div class="sim-stage" id="simStage">${def.stage(S)}<div class="sim-off" id="simOff"><button class="btn btn-primary">⏻ Power on to start the simulation</button><small>Sound starts after you power on (browser rule). Use headphones in shared rooms.</small></div></div>
          ${def.actions ? `<div class="sim-actions">${def.actions.map(a => `<button class="btn ${a.primary ? 'btn-primary' : ''}" data-act="${a.id}">${esc(a.label)}</button>`).join('')}</div>` : ''}
          <div class="panel sim-logp"><div class="row between"><h3>Event log</h3><span class="mono muted" id="simClock">00:00</span></div><div class="sim-log" id="simLog"></div></div>
        </div>
        <aside class="sim-side">
          <div class="panel"><h3>Settings</h3>${(def.controls || []).map(ctl).join('')}</div>
          <div class="panel"><h3>Fault injection</h3><p class="muted small">Instructor: switch faults on and watch, listen and read the alarms. Or let the system hide one and diagnose it.</p>
            <div class="fault-list">${(def.faults || []).map(f => `<label class="sim-toggle"><input type="checkbox" data-fault="${f.id}"> ${esc(f.label)}</label>`).join('')}</div>
            <div class="row gap wrap"><button class="btn btn-primary" id="mysteryBtn">? Mystery fault</button><button class="btn" id="clearFaults">Clear faults</button></div>
            <div id="mysteryBox"></div></div>
        </aside>
      </div>`;

    const muteBtn = $('#simMute', el);
    const syncMute = () => { muteBtn.textContent = Sound.muted ? '🔇 Sound off' : '🔊 Sound on'; muteBtn.classList.toggle('on', !Sound.muted); };
    syncMute(); document.addEventListener('sound-change', syncMute);
    muteBtn.onclick = () => { Sound.init(); Sound.setMuted(!Sound.muted); };
    $('#simVol', el).oninput = e => { Sound.init(); Sound.setVolume(+e.target.value); };

    function renderAlarms() {
      const box = $('#simAlarms', el); if (!box) return;
      const list = Object.entries(S.alarms).sort((a, b) => 'hml'.indexOf(a[1].pr[0]) - 'hml'.indexOf(b[1].pr[0]));
      box.className = 'sim-alarmbar' + (list.length ? ' pr-' + list[0][1].pr : '');
      box.innerHTML = list.length ? list.map(([id, a]) => `<span class="al al-${a.pr}">${a.pr === 'high' ? '!!!' : a.pr === 'med' ? '!!' : '!'} ${esc(a.text)}</span>`).join('') +
        `<button class="btn small" id="alSil">${S.silencedUntil > S.t ? '🔕 Silenced ' + Math.ceil(S.silencedUntil - S.t) + 's' : '🔕 Audio pause 2 min'}</button>` : '<span class="muted">No active alarms</span>';
      const sb = $('#alSil', el); if (sb) sb.onclick = () => { S.silencedUntil = S.t + 120; S.log('Alarm audio paused for 120 s (visual alarm stays on)', 'info'); renderAlarms(); };
    }
    S.renderAlarms = renderAlarms;

    const power = on => {
      S.on = on; Sound.init();
      $('#simPower', el).textContent = on ? '⏻ Power off' : '⏻ Power on';
      $('#simOff', el).style.display = on ? 'none' : '';
      if (on) { S.strips = []; S.log('Power on — self-test passed (simulated)', 'ok'); def.init && def.init(S); }
      else { def.stop && def.stop(S); Sound.stopAll(); S.alarms = {}; renderAlarms(); S.log('Power off', 'info'); }
    };
    $('#simPower', el).onclick = () => power(!S.on);
    $('#simOff button', el).onclick = () => power(true);

    $$('[data-ctl]', el).forEach(i => i.addEventListener('input', () => {
      const c = def.controls.find(x => x.id === i.dataset.ctl);
      const val = c.type === 'toggle' ? i.checked : c.type === 'range' ? +i.value : i.value;
      S.v[c.id] = val;
      const out = el.querySelector(`[data-out="${c.id}"]`); if (out) out.textContent = val + (c.unit ? ' ' + c.unit : '');
      if (S.on) { S.log(`${c.label} set to ${c.type === 'select' ? (c.options.find(o => o[0] == val) || [])[1] : val}${c.unit ? ' ' + c.unit : ''}`); def.onControl && def.onControl(S, c.id, val); }
    }));
    $$('[data-act]', el).forEach(b => b.onclick = () => { if (!S.on) return toast('Power on first'); def.onAction && def.onAction(S, b.dataset.act); });
    $$('[data-fault]', el).forEach(i => i.onchange = () => {
      if (S.mystery) { i.checked = S.fault.has(i.dataset.fault); return toast('Finish or reveal the mystery fault first'); }
      const f = def.faults.find(x => x.id === i.dataset.fault);
      i.checked ? S.fault.add(f.id) : S.fault.delete(f.id);
      S.log(`${i.checked ? 'Fault injected' : 'Fault cleared'}: ${f.label}`, 'warn'); def.onFault && def.onFault(S, f.id, i.checked);
    });
    $('#clearFaults', el).onclick = () => {
      [...S.fault].forEach(f => def.onFault && def.onFault(S, f, false));
      S.fault.clear(); S.mystery = null; $$('[data-fault]', el).forEach(i => i.checked = false); $('#mysteryBox', el).innerHTML = ''; S.log('All faults cleared', 'ok');
    };
    $('#mysteryBtn', el).onclick = () => {
      if (!S.on) power(true);
      [...S.fault].forEach(f => def.onFault && def.onFault(S, f, false));
      S.fault.clear(); $$('[data-fault]', el).forEach(i => { i.checked = false; i.disabled = true; });
      const f = def.faults[Math.floor(Math.random() * def.faults.length)];
      S.mystery = f; S.fault.add(f.id); def.onFault && def.onFault(S, f.id, true); S.mysteryStart = S.t;
      S.log('Mystery fault injected. Observe the display, listen to the alarms, then diagnose.', 'warn');
      $('#mysteryBox', el).innerHTML = `<div class="fb"><b>What is wrong?</b><div class="options">${def.faults.map(x => `<button class="opt" data-guess="${x.id}">${esc(x.label)}</button>`).join('')}</div></div>`;
      $$('[data-guess]', el).forEach(b => b.onclick = () => {
        const ok = b.dataset.guess === f.id, secs = Math.round(S.t - S.mysteryStart);
        const r = Store.s.live || (Store.s.live = {}); const k = r[eqId] || (r[eqId] = { tries: 0, solved: 0 });
        k.tries++; if (ok) k.solved++; k.ts = Date.now(); Store.save();
        $('#mysteryBox', el).innerHTML = `<div class="fb ${ok ? 'ok' : 'bad'}"><b>${ok ? `Correct — diagnosed in ${secs} s.` : `Not quite. It was: ${esc(f.label)}.`}</b><p>${esc(f.explain)}</p>${f.check ? `<p><b>Engineer check:</b> ${esc(f.check)}</p>` : ''}<button class="btn" id="mAgain">Another mystery fault</button></div>`;
        $('#mAgain', el).onclick = () => $('#mysteryBtn', el).click();
        S.mystery = null; $$('[data-fault]', el).forEach(i => { i.disabled = false; i.checked = S.fault.has(i.dataset.fault); });
        S.log(ok ? 'Diagnosis correct: ' + f.label : 'Diagnosis incorrect — fault was ' + f.label, ok ? 'ok' : 'bad');
      });
    };

    /* Main loop */
    let last = performance.now(), clockTick = 0;
    const loop = now => {
      if (current !== S) return;
      if (!document.body.contains(el) || !el.querySelector('#simStage')) { stop(); return; }
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (S.on) {
        S.t += dt;
        try { def.tick(S, dt, S.t); } catch (e) { console.error(e); stop(); return; }
        if (S.silencedUntil <= S.t) {
          const pr = ['high', 'med', 'low'].find(p => Object.values(S.alarms).some(a => a.pr === p));
          if (pr) { const a = Object.values(S.alarms).find(x => x.pr === pr); if (S.t >= a.next) { Sound.alarm(pr); Object.values(S.alarms).forEach(x => x.next = S.t + ALARM_REPEAT[pr]); } }
        }
        if ((clockTick += dt) > 1) { clockTick = 0; $('#simClock', el).textContent = fmtT(S.t); if (S.silencedUntil > S.t) renderAlarms(); }
      }
      S.raf = requestAnimationFrame(loop);
    };
    current = S; S.raf = requestAnimationFrame(loop);
    S.cleanup = () => { document.removeEventListener('sound-change', syncMute); };
    return S;
  }

  function stop() {
    if (!current) return;
    const S = current; current = null;
    cancelAnimationFrame(S.raf); try { S.def.stop && S.def.stop(S); } catch (e) { }
    S.cleanup && S.cleanup(); Sound.stopAll();
  }

  /* Shared waveform helpers */
  const W = {
    gauss: (x, mu, s) => Math.exp(-((x - mu) * (x - mu)) / (2 * s * s)),
    /* ECG for one beat; phase 0..1 of the RR interval. */
    ecg(ph, o = {}) {
      const g = W.gauss, rr = o.rr || 1, k = Math.min(1, 0.8 / rr);
      let v = 0;
      if (!o.noP) v += 0.12 * g(ph, 0.12 * k + 0.02, 0.025 * k);
      v += -0.08 * g(ph, 0.2 * k + 0.04, 0.008) + 1.0 * g(ph, 0.215 * k + 0.04, 0.011) - 0.22 * g(ph, 0.235 * k + 0.04, 0.01);
      v += 0.25 * g(ph, 0.45 * k + 0.06, 0.05 * k);
      return v;
    },
    noise: (a = 1) => (Math.random() * 2 - 1) * a
  };

  window.Sim = { register: (id, def) => { registry[id] = def; }, has: id => !!registry[id], list: () => Object.keys(registry), mount, stop, Sound, Strip, W, get current() { return current; } };
})();

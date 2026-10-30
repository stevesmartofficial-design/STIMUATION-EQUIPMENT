/* DICOM viewer — training / reference only, NOT a cleared diagnostic device.
   Everything runs client-side: files are decoded in the browser with daikon (global
   `daikon`, loaded from CDN) and never uploaded.
   Sections: helpers · decode · series + MPR geometry · demo phantom · viewport
   rendering · interaction · view shell (loading, toolbar, tags, export). */
(function () {
  const { esc, $, $$, toast, modal, closeModal } = UI;
  const V = window.Views = window.Views || {};

  /* ================= constants & helpers ================= */
  const CT_PRESETS = [['CT Brain', 80, 40], ['Subdural', 200, 75], ['Stroke', 40, 40], ['Lung', 1500, -600],
    ['Mediastinum', 350, 50], ['Abdomen', 400, 50], ['Liver', 150, 30], ['Bone', 2000, 500]];
  const TOOLS = [['wl', 'W/L', 'W'], ['pan', 'Pan', 'P'], ['zoom', 'Zoom', 'Z'], ['len', 'Length', 'L'],
    ['ang', 'Angle', 'A'], ['ell', 'Ellipse ROI', 'E'], ['rect', 'Rect ROI', 'R'], ['cross', 'Crosshair', 'C']];
  const PLANE_COL = { src: '#f5b84a', pc: '#4da3ff', pr: '#36d39a' };
  const FONT = '"JetBrains Mono", Consolas, ui-monospace, monospace';
  const BIG_VOXELS = 512 * 512 * 512, MAX_BYTES = 1.5e9;

  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const len3 = a => Math.hypot(a[0], a[1], a[2]);
  const norm = a => { const l = len3(a) || 1; return mul(a, 1 / l); };
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const num = v => v == null || v === '' || !isFinite(+v) ? null : +v;
  const fmt = (v, d) => v == null || !isFinite(v) ? '' : (+v).toFixed(d == null ? 1 : d);
  const tick = () => new Promise(r => setTimeout(r, 0));

  /* Patient (LPS) direction vector -> orientation letters, strongest first. */
  function orientLabel(v) {
    if (!v) return '';
    const L = [['L', 'R'], ['P', 'A'], ['S', 'I']];
    return [0, 1, 2].map(i => [Math.abs(v[i]), i]).sort((a, b) => b[0] - a[0])
      .filter(([m], k) => k === 0 || m > 0.3 * len3(v)).map(([, i]) => L[i][v[i] >= 0 ? 0 : 1]).join('');
  }
  const planeName = n => { if (!n) return 'Image'; const a = n.map(Math.abs), i = a.indexOf(Math.max(...a)); return ['Sagittal', 'Coronal', 'Axial'][i]; };
  /* PatientOrientation letters (e.g. "LF") -> vector, used when ImageOrientationPatient is absent (CR/DX). */
  const letterVec = s => { const m = { L: [1, 0, 0], R: [-1, 0, 0], P: [0, 1, 0], A: [0, -1, 0], H: [0, 0, 1], S: [0, 0, 1], F: [0, 0, -1], I: [0, 0, -1] }; let v = [0, 0, 0]; String(s || '').toUpperCase().split('').forEach(c => { if (m[c]) v = add(v, m[c]); }); return len3(v) ? norm(v) : null; };

  /* ================= DICOM decoding (daikon) ================= */
  const tagVal = (img, g, e) => { const t = img.getTag(g, e); return t && t.value != null ? t.value : null; };
  const tag1 = (img, g, e) => { const v = tagVal(img, g, e); return Array.isArray(v) ? v[0] : (v instanceof DataView || v instanceof ArrayBuffer ? null : v); };
  const str = v => v == null ? '' : v instanceof Date ? dateStr(v) : String(v).trim();
  const dateStr = d => isNaN(d) ? '' : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const timeStr = t => { t = str(t).replace(/:/g, ''); return /^\d{4}/.test(t) ? `${t.slice(0, 2)}:${t.slice(2, 4)}` : t; };

  function looksDicom(u8) {
    if (u8.length >= 132 && u8[128] === 68 && u8[129] === 73 && u8[130] === 67 && u8[131] === 77) return true; // "DICM"
    if (u8.length < 8) return false;
    const gLE = u8[0] | (u8[1] << 8);
    return gLE === 0x0008 || gLE === 0x0002 || gLE === 0x0010 || gLE === 0x0800; // headerless ACR-NEMA style
  }

  /* Depth-first search of a sequence item list for a nested tag value. */
  function findNested(tags, g, e) {
    for (const t of tags || []) {
      if (t.group === g && t.element === e) return t.value;
      if (Array.isArray(t.value) && t.value.length && t.value[0] instanceof daikon.Tag) { const r = findNested(t.value, g, e); if (r != null) return r; }
    }
    return null;
  }

  /* Decode one file into {info, frames:[slice]} or null (not an image object). */
  function decodeFile(buf, name) {
    const img = daikon.Series.parseImage(new DataView(buf));
    if (!img) throw new Error(String(daikon.Series.parserError || 'not parseable'));
    if (!img.hasPixelData() || !img.getRows() || !img.getCols()) return null;
    const rows = img.getRows(), cols = img.getCols(), frameN = rows * cols;
    const pi = str(img.getPhotometricInterpretation()).toUpperCase();
    const spp = img.getNumberOfSamplesPerPixel() || 1, ba = img.getBitsAllocated() || 16, bs = img.getBitsStored() || ba;
    const signed = img.getPixelRepresentation() === 1, compressed = img.isCompressed(), palette = img.isPalette();
    if (![8, 16, 32].includes(ba)) throw new Error(`BitsAllocated ${ba} not supported`);
    const raw = img.getRawData(); // decompresses + converts palette colour to RGB
    const dv = new DataView(raw), le = compressed ? true : img.littleEndian;
    const slope = num(img.getDataScaleSlope()) || 1, inter = num(img.getDataScaleIntercept()) || 0;
    const info = fileInfo(img, name, pi);
    const color = palette || spp === 3;
    const frames = [];
    let nFrames = Math.max(1, num(img.getNumberOfFrames()) || 1);
    if (color) {
      const bps = palette ? 1 : ba / 8, per = frameN * 3 * bps;
      nFrames = Math.min(nFrames, Math.floor(raw.byteLength / per)) || 0;
      const planar = !palette && !compressed && img.getPlanarConfig() === 1;
      const ybr = (!compressed || img.isCompressedRLE()) && pi === 'YBR_FULL';
      const shift = bps === 2 ? Math.max(0, bs - 8) : 0;
      for (let f = 0; f < nFrames; f++) {
        const rgb = new Uint8Array(frameN * 3), base = f * per;
        for (let p = 0; p < frameN; p++) for (let c = 0; c < 3; c++) {
          const o = base + (planar ? c * frameN + p : p * 3 + c) * bps;
          rgb[p * 3 + c] = bps === 1 ? dv.getUint8(o) : dv.getUint16(o, le) >> shift;
        }
        if (ybr) for (let p = 0; p < rgb.length; p += 3) {
          const y = rgb[p], cb = rgb[p + 1] - 128, cr = rgb[p + 2] - 128;
          rgb[p] = clamp(y + 1.402 * cr, 0, 255); rgb[p + 1] = clamp(y - 0.344136 * cb - 0.714136 * cr, 0, 255); rgb[p + 2] = clamp(y + 1.772 * cb, 0, 255);
        }
        frames.push({ kind: 'rgb', data: rgb, min: 0, max: 255 });
      }
    } else {
      const bpp = ba / 8, mask = bs < 32 ? 2 ** bs - 1 : 0, half = 2 ** (bs - 1);
      nFrames = Math.min(nFrames, Math.floor(raw.byteLength / (frameN * bpp))) || 0;
      const intScale = Number.isInteger(slope) && Number.isInteger(inter);
      for (let f = 0; f < nFrames; f++) {
        const tmp = new Float32Array(frameN), base = f * frameN * bpp;
        let mn = Infinity, mx = -Infinity;
        for (let p = 0; p < frameN; p++) {
          const o = base + p * bpp; let v;
          if (bs >= 32 || bs === ba) v = bpp === 1 ? (signed ? dv.getInt8(o) : dv.getUint8(o)) : bpp === 2 ? (signed ? dv.getInt16(o, le) : dv.getUint16(o, le)) : (signed ? dv.getInt32(o, le) : dv.getUint32(o, le));
          else { v = (bpp === 1 ? dv.getUint8(o) : bpp === 2 ? dv.getUint16(o, le) : dv.getUint32(o, le)) % (mask + 1); if (signed && v >= half) v -= 2 * half; }
          v = v * slope + inter; tmp[p] = v; if (v < mn) mn = v; if (v > mx) mx = v;
        }
        let data = tmp;
        if (intScale && mn >= -32768 && mx <= 32767) data = Int16Array.from(tmp);
        else if (intScale && mn >= 0 && mx <= 65535) data = Uint16Array.from(tmp);
        frames.push({ kind: 'gray', data, min: mn, max: mx });
      }
    }
    try { img.clearPixelData(); } catch (e) { /* keep going */ }
    // geometry, per-frame positions for enhanced multi-frame
    const iop = (img.getImageDirections() || []).map(Number);
    const ipp = (img.getImagePosition() || []).map(Number);
    const pf = img.tags[daikon.Tag.createId(0x5200, 0x9230)];
    const perPos = pf && Array.isArray(pf.value) ? pf.value.map(it => { const v = findNested(it.value, 0x0020, 0x0032); return v && v.length === 3 ? v.map(Number) : null; }) : [];
    const po = tagVal(img, 0x0020, 0x0020);
    const right = iop.length === 6 ? iop.slice(0, 3) : po && po.length === 2 ? letterVec(po[0]) : null;
    const down = iop.length === 6 ? iop.slice(3, 6) : po && po.length === 2 ? letterVec(po[1]) : null;
    return {
      info, frames: frames.map((fr, f) => Object.assign(fr, {
        rows, cols, img, frame: f, nFrames, info, right, down, iop: iop.length === 6 ? iop : null,
        pos: perPos[f] || (ipp.length === 3 && nFrames === 1 ? ipp : null),
        sliceLoc: num(tag1(img, 0x0020, 0x1041)), inst: num(tag1(img, 0x0020, 0x0013)),
        mono1: pi === 'MONOCHROME1', spacing: info.spacing, calib: info.calib
      }))
    };
  }

  function fileInfo(img, name, pi) {
    const t = (g, e) => tag1(img, g, e);
    let spacing = null, calib = '';
    const ps = img.getPixelSpacing(), ip = tagVal(img, 0x0018, 0x1164);
    if (ps && ps.length >= 2 && +ps[0] > 0) { spacing = [+ps[0], +ps[1]]; calib = 'PixelSpacing'; }
    else if (ip && ip.length >= 2 && +ip[0] > 0) { spacing = [+ip[0], +ip[1]]; calib = 'detector'; }
    else {
      const dx = num(t(0x0018, 0x602C)), dy = num(t(0x0018, 0x602E));
      if (dx > 0 && dy > 0 && t(0x0018, 0x6024) === 3) { spacing = [Math.abs(dy) * 10, Math.abs(dx) * 10]; calib = 'us'; }
    }
    const ft = num(t(0x0018, 0x1063)), cine = num(t(0x0018, 0x0040));
    const mas = num(t(0x0018, 0x1152)) || (num(t(0x0018, 0x1151)) && num(t(0x0018, 0x1150)) ? num(t(0x0018, 0x1151)) * num(t(0x0018, 0x1150)) / 1000 : null);
    const arr = (g, e) => { const v = tagVal(img, g, e); return Array.isArray(v) ? v.map(Number).filter(isFinite) : []; };
    return {
      file: name, modality: str(img.getModality()).toUpperCase(), photometric: pi,
      seriesUID: str(img.getSeriesInstanceUID()), sopUID: str(t(0x0008, 0x0018)),
      patName: str(img.getPatientName()), patId: str(img.getPatientID()), dob: str(t(0x0010, 0x0030)), sex: str(t(0x0010, 0x0040)),
      studyDate: str(img.getStudyDate()), studyTime: timeStr(img.getStudyTime()), studyDesc: str(t(0x0008, 0x1030)),
      seriesDesc: str(img.getSeriesDescription()), seriesNum: num(img.getSeriesNumber()), institution: str(t(0x0008, 0x0080)),
      maker: [str(t(0x0008, 0x0070)), str(t(0x0008, 0x1090))].filter(Boolean).join(' '), bodyPart: str(t(0x0018, 0x0015)),
      kvp: num(t(0x0018, 0x0060)), mas, thick: num(img.getSliceThickness()),
      wc: arr(0x0028, 0x1050), ww: arr(0x0028, 0x1051),
      lossy: str(t(0x0028, 0x2110)) === '01', lossyRatio: num(t(0x0028, 0x2112)),
      fps: ft ? 1000 / ft : cine || null, spacing, calib, ts: str(img.getTransferSyntax())
    };
  }

  /* ================= series building & MPR geometry ================= */
  let seriesSeq = 0;
  function newSeries(info) {
    return { id: 's' + (++seriesSeq), uid: info.seriesUID, info, slices: [], anns: {}, min: Infinity, max: -Infinity, kind: 'gray' };
  }

  function finalizeSeries(s) {
    const sl = s.slices, f0 = sl[0];
    s.kind = f0.kind; s.isCT = s.info.modality === 'CT';
    s.min = Math.min(...sl.map(x => x.min)); s.max = Math.max(...sl.map(x => x.max));
    const n = f0.iop ? norm(cross(f0.iop.slice(0, 3), f0.iop.slice(3))) : null;
    const allPos = n && sl.every(x => x.pos);
    sl.forEach((x, i) => { x._o = i; x._k = allPos ? dot(x.pos, n) : null; });
    sl.sort((a, b) => allPos ? a._k - b._k || (a.inst || 0) - (b.inst || 0) : (a.inst || 0) - (b.inst || 0) || a.frame - b.frame || a._o - b._o);
    if (allPos && sl.length > 1 && sl[0].inst != null && sl[sl.length - 1].inst != null && sl[0].inst > sl[sl.length - 1].inst) sl.reverse();
    s.defWin = defaultWindow(s);
    s.mprWhy = mprCheck(s, n);
    s.bigVolume = sl.length * f0.rows * f0.cols > BIG_VOXELS;
  }

  function percentileWindow(fr) {
    const d = fr.data, step = Math.max(1, Math.floor(d.length / 65536)), a = [];
    for (let i = 0; i < d.length; i += step) a.push(d[i]);
    a.sort((x, y) => x - y);
    const lo = a[Math.floor(a.length * 0.01)], hi = a[Math.floor(a.length * 0.99)];
    return { ww: Math.max(1, hi - lo), wc: (hi + lo) / 2 };
  }

  function windowOptions(s) {
    const o = [];
    if (s.kind === 'rgb') { o.push(['Colour (identity)', 256, 128]); return o; }
    if (s.isCT) CT_PRESETS.forEach(p => o.push(p));
    s.info.ww.forEach((w, i) => { if (w > 0 && s.info.wc[i] != null) o.push([`DICOM window ${i + 1}`, w, s.info.wc[i]]); });
    o.push(['Full range (min/max)', Math.max(1, s.max - s.min), (s.max + s.min) / 2]);
    const pw = percentileWindow(s.slices[Math.floor(s.slices.length / 2)]);
    o.push(['Auto (1–99 %)', pw.ww, pw.wc]);
    return o;
  }

  function defaultWindow(s) {
    const o = windowOptions(s); s.winOptions = o;
    if (s.demo) return o[0];
    return o.find(x => /^DICOM/.test(x[0])) || o[o.length - 1];
  }

  /* Returns null if MPR is possible, else a human-readable reason. Builds s.vol. */
  function mprCheck(s, n) {
    const sl = s.slices, f0 = sl[0];
    if (s.kind !== 'gray') return 'colour images cannot be reformatted';
    if (sl.length < 10) return 'needs at least 10 slices';
    if (!f0.spacing) return 'no pixel spacing';
    if (!n || !sl.every(x => x.pos)) return 'no ImagePositionPatient / orientation';
    if (sl.some(x => x.rows !== f0.rows || x.cols !== f0.cols)) return 'slices differ in matrix size';
    if (sl.some(x => !x.iop || x.iop.some((v, i) => Math.abs(v - f0.iop[i]) > 1e-3))) return 'slice orientation is not constant';
    const d = []; for (let i = 1; i < sl.length; i++) d.push(sl[i]._k - sl[i - 1]._k);
    const mean = d.reduce((a, b) => a + b, 0) / d.length;
    if (Math.abs(mean) < 1e-3) return 'duplicate slice positions';
    if (d.some(x => Math.abs(x - mean) > 0.1 * Math.abs(mean) + 0.01)) return 'slice spacing is not uniform';
    const r = f0.iop.slice(0, 3), c = f0.iop.slice(3), nd = mul(n, Math.sign(mean));
    const span = sub(sl[sl.length - 1].pos, sl[0].pos), shear = len3(sub(span, mul(nd, dot(span, nd))));
    // reformat "down" direction: inferior / posterior / left goes down the screen
    const dom = nd.map(Math.abs).indexOf(Math.max(...nd.map(Math.abs)));
    const flip = dom === 2 ? nd[2] > 0 : nd[dom] < 0;
    s.vol = { nx: f0.cols, ny: f0.rows, nz: sl.length, dx: f0.spacing[1], dy: f0.spacing[0], dz: Math.abs(mean), r, c, n: nd,
      flip, down: flip ? mul(nd, -1) : nd, tilt: shear > 0.05 * Math.abs(mean) * sl.length, cur: null };
    return null;
  }

  /* ================= synthetic CT head phantom ================= */
  async function makeDemo(onProgress) {
    const N = 256, Z = 64, dx = 0.9, dz = 2.5;
    const info = { file: 'demo', modality: 'CT', photometric: 'MONOCHROME2', seriesUID: 'demo.' + Date.now(), sopUID: '',
      patName: 'DEMO PHANTOM', patId: 'DEMO-0001', dob: '', sex: 'O', studyDate: dateStr(new Date()), studyTime: '', studyDesc: 'Synthetic head phantom',
      seriesDesc: 'Head 2.5 mm (synthetic)', seriesNum: 1, institution: 'Training lab', maker: 'In-browser generator', bodyPart: 'HEAD',
      kvp: 120, mas: 250, thick: 2.5, wc: [40], ww: [80], lossy: false, lossyRatio: null, fps: 12, spacing: [dx, dx], calib: 'PixelSpacing', ts: 'synthetic' };
    const s = newSeries(info); s.demo = true;
    const E = (x, y, z, cx, cy, cz, a, b, c) => ((x - cx) / a) ** 2 + ((y - cy) / b) ** 2 + ((z - cz) / c) ** 2;
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < Z; k++) {
      const z = -80 + k * dz, data = new Int16Array(N * N);
      let mn = 1e9, mx = -1e9;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = (i - N / 2 + 0.5) * dx, y = (j - N / 2 + 0.5) * dx; let v = -1000;
        if (E(x, y, z, 0, 0, 0, 80, 100, 92) < 1) {
          v = 35; // scalp
          if (E(x, y, z, 0, 0, 0, 76, 96, 88) < 1) v = 1100; // skull
          if (E(x, y, z, 0, 0, 0, 70, 90, 82) < 1) {
            v = 38; // grey matter
            if (E(x, y, z, 0, 5, 5, 56, 74, 62) < 1) v = 28; // white matter
            if (E(x, y, z, 9, -2, 12, 6, 24, 14) < 1 || E(x, y, z, -9, -2, 12, 6, 24, 14) < 1) v = 6; // ventricles
            if (x < -40 && E(x, y, z, 0, 0, 0, 67, 87, 79) >= 1) v = 62; // right subdural collection
            if (E(x, y, z, 32, 22, 22, 9, 9, 9) < 1) v = 72; // haemorrhage
            if (E(x, y, z, -24, -32, 8, 13, 13, 13) < 1) v = 22; // early infarct
            if (E(x, y, z, 0, 42, 4, 2.5, 2.5, 2.5) < 1) v = 450; // calcification
          }
          if (E(x, y, z, 0, -78, -55, 26, 12, 16) < 1) v = -950; // sinus air
        }
        v += (rnd() + rnd() + rnd() - 1.5) * 6;
        v = Math.round(v); data[j * N + i] = v; if (v < mn) mn = v; if (v > mx) mx = v;
      }
      s.slices.push({ kind: 'gray', data, min: mn, max: mx, rows: N, cols: N, img: null, frame: 0, nFrames: 1, info,
        right: [1, 0, 0], down: [0, 1, 0], iop: [1, 0, 0, 0, 1, 0], pos: [-(N / 2) * dx, -(N / 2) * dx, z], sliceLoc: z, inst: Z - k,
        mono1: false, spacing: [dx, dx], calib: 'PixelSpacing' });
      if (k % 4 === 3) { onProgress((k + 1) / Z); await tick(); }
    }
    finalizeSeries(s);
    return s;
  }
  const DEMO_TAGS = [['(0008,0060)', 'Modality', 'CS', 'CT'], ['(0010,0010)', 'PatientName', 'PN', 'DEMO^PHANTOM'], ['(0010,0020)', 'PatientID', 'LO', 'DEMO-0001'],
    ['(0018,0050)', 'SliceThickness', 'DS', '2.5'], ['(0018,0060)', 'KVP', 'DS', '120'], ['(0020,0037)', 'ImageOrientationPatient', 'DS', '1\\0\\0\\0\\1\\0'],
    ['(0028,0010)', 'Rows', 'US', '256'], ['(0028,0011)', 'Columns', 'US', '256'], ['(0028,0030)', 'PixelSpacing', 'DS', '0.9\\0.9'],
    ['(0028,1050)', 'WindowCenter', 'DS', '40'], ['(0028,1051)', 'WindowWidth', 'DS', '80'], ['(0028,1052)', 'RescaleIntercept', 'DS', '-1024'], ['(0028,1053)', 'RescaleSlope', 'DS', '1']];

  /* ================= viewport: frames & rendering ================= */
  function newVp(el) {
    return { el, canvas: $('canvas', el), series: null, idx: 0, plane: 'src', ww: 400, wc: 40, invert: false, rot: 0, flipH: false, flipV: false,
      zoom: 1, panX: 0, panY: 0, fit: true, hover: null, draft: null, pendingAng: null, _fr: null, _win: null, cw: 0, ch: 0 };
  }
  const isMpr = vp => vp.plane !== 'src' || !!vp.mpr;
  function count(vp) { const s = vp.series; if (!s) return 0; if (!isMpr(vp)) return s.slices.length; const v = s.vol; return vp.plane === 'src' ? v.nz : vp.plane === 'pc' ? v.ny : v.nx; }
  function getIdx(vp) { if (!isMpr(vp)) return vp.idx; const c = vp.series.vol.cur; return vp.plane === 'src' ? c.k : vp.plane === 'pc' ? c.j : c.i; }
  function setIdx(vp, i) {
    const n = count(vp); if (!n) return; i = clamp(Math.round(i), 0, n - 1);
    if (!isMpr(vp)) vp.idx = i; else { const c = vp.series.vol.cur; c[vp.plane === 'src' ? 'k' : vp.plane === 'pc' ? 'j' : 'i'] = i; }
  }
  const rowOfK = (v, k) => v.flip ? v.nz - 1 - k : k;

  /* The 2-D frame currently shown: source slice, or a reformat from the stacked volume. */
  function frameOf(vp) {
    const s = vp.series, idx = getIdx(vp), key = `${s.id}|${vp.plane}|${idx}`;
    if (vp._fr && vp._fr.key === key) return vp._fr;
    let fr;
    if (vp.plane === 'src') {
      const sl = s.slices[idx];
      fr = { key, w: sl.cols, h: sl.rows, data: sl.data, kind: sl.kind, sx: sl.spacing ? sl.spacing[1] : null, sy: sl.spacing ? sl.spacing[0] : null,
        right: sl.right, down: sl.down, slice: sl, mono1: sl.mono1, normal: sl.iop ? cross(sl.iop.slice(0, 3), sl.iop.slice(3)) : null };
    } else {
      const v = s.vol, sl = s.slices, row = vp.plane === 'pc', w = row ? v.nx : v.ny, h = v.nz;
      const Ctor = sl.some(x => x.data instanceof Float32Array) ? Float32Array : sl[0].data.constructor, out = new Ctor(w * h);
      for (let kk = 0; kk < h; kk++) {
        const src = sl[rowOfK(v, kk)].data, o = kk * w;
        if (row) { const b = idx * v.nx; for (let i = 0; i < w; i++) out[o + i] = src[b + i]; }
        else for (let j = 0; j < w; j++) out[o + j] = src[j * v.nx + idx];
      }
      fr = { key, w, h, data: out, kind: 'gray', sx: row ? v.dx : v.dy, sy: v.dz, right: row ? v.r : v.c, down: v.down,
        slice: sl[v.cur.k], mono1: sl[0].mono1, normal: row ? v.c : v.r, reformat: true };
    }
    fr.calib = s.slices[0].calib;
    vp._fr = fr; return fr;
  }

  /* Windowed 8-bit rendering through a precomputed LUT (DICOM linear VOI function). */
  function windowed(vp, fr) {
    const inv = vp.invert !== !!fr.mono1, key = `${fr.key}|${vp.ww}|${vp.wc}|${inv}`;
    if (vp._win && vp._win.key === key) return vp._win.canvas;
    const c = (vp._win && vp._win.canvas) || document.createElement('canvas');
    if (c.width !== fr.w || c.height !== fr.h) { c.width = fr.w; c.height = fr.h; }
    const cx = c.getContext('2d'), id = cx.createImageData(fr.w, fr.h), u32 = new Uint32Array(id.data.buffer), d = fr.data;
    const w1 = Math.max(1, vp.ww - 1), lo = vp.wc - 0.5 - w1 / 2, hi = vp.wc - 0.5 + w1 / 2;
    const g8 = v => { const y = v <= lo ? 0 : v > hi ? 255 : Math.round(((v - (vp.wc - 0.5)) / w1 + 0.5) * 255); return inv ? 255 - y : y; };
    const A = 0xFF000000;
    if (fr.kind === 'rgb') {
      const l = new Uint8Array(256); for (let k = 0; k < 256; k++) l[k] = g8(k);
      for (let p = 0, q = 0; p < u32.length; p++, q += 3) u32[p] = (A | (l[d[q + 2]] << 16) | (l[d[q + 1]] << 8) | l[d[q]]) >>> 0;
    } else if (!(d instanceof Float32Array)) {
      const s = vp.series, mn = Math.floor(s.min), n = Math.ceil(s.max) - mn + 1, lut = new Uint32Array(n);
      for (let k = 0; k < n; k++) { const g = g8(mn + k); lut[k] = (A | (g << 16) | (g << 8) | g) >>> 0; }
      for (let p = 0; p < u32.length; p++) u32[p] = lut[d[p] - mn];
    } else for (let p = 0; p < u32.length; p++) { const g = g8(d[p]); u32[p] = (A | (g << 16) | (g << 8) | g) >>> 0; }
    cx.putImageData(id, 0, 0);
    vp._win = { key, canvas: c };
    return c;
  }

  function aspect(fr) { const sx = fr.sx || 1, sy = fr.sy || 1, m = Math.min(sx, sy); return [sx / m, sy / m, m]; }
  function fitZoom(vp, fr) { const [ax, ay] = aspect(fr); let dw = fr.w * ax, dh = fr.h * ay; if (vp.rot % 2) [dw, dh] = [dh, dw]; return Math.min(vp.cw / dw, vp.ch / dh) * 0.96; }
  function matrix(vp, fr) {
    if (vp.fit) vp.zoom = fitZoom(vp, fr);
    const [ax, ay] = aspect(fr);
    return new DOMMatrix().translate(vp.cw / 2 + vp.panX, vp.ch / 2 + vp.panY).scale(vp.flipH ? -1 : 1, vp.flipV ? -1 : 1)
      .rotate(vp.rot * 90).scale(vp.zoom * ax, vp.zoom * ay).translate(-fr.w / 2, -fr.h / 2);
  }
  const tp = (m, x, y) => { const p = m.transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; };

  function pixelValue(fr, x, y, s) {
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= fr.w || j >= fr.h) return null;
    const p = j * fr.w + i;
    if (fr.kind === 'rgb') return `RGB ${fr.data[p * 3]},${fr.data[p * 3 + 1]},${fr.data[p * 3 + 2]}`;
    const v = fr.data[p]; return `${Number.isInteger(v) ? v : v.toFixed(2)}${s.isCT ? ' HU' : ''}`;
  }

  /* ---------- measurements ---------- */
  function annMetrics(a, fr, s) {
    const sx = fr.sx || 1, sy = fr.sy || 1, cal = !!fr.sx, u = cal ? 'mm' : 'px', star = fr.calib === 'detector' ? '*' : '';
    if (a.t === 'len') { const [p, q] = a.p; return [`${fmt(Math.hypot((q[0] - p[0]) * sx, (q[1] - p[1]) * sy), 1)} ${u}${star}`]; }
    if (a.t === 'ang') {
      const [p, v, q] = a.p, a1 = [(p[0] - v[0]) * sx, (p[1] - v[1]) * sy], a2 = [(q[0] - v[0]) * sx, (q[1] - v[1]) * sy];
      const l = Math.hypot(...a1) * Math.hypot(...a2); return [l ? `${fmt(Math.acos(clamp((a1[0] * a2[0] + a1[1] * a2[1]) / l, -1, 1)) * 180 / Math.PI, 1)}°` : '—'];
    }
    const x0 = Math.min(a.p[0][0], a.p[1][0]), x1 = Math.max(a.p[0][0], a.p[1][0]), y0 = Math.min(a.p[0][1], a.p[1][1]), y1 = Math.max(a.p[0][1], a.p[1][1]);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (x1 - x0) / 2 || 1e-6, ry = (y1 - y0) / 2 || 1e-6;
    let n = 0, sum = 0, sq = 0, mn = Infinity, mx = -Infinity;
    for (let j = Math.max(0, Math.floor(y0)); j < Math.min(fr.h, Math.ceil(y1)); j++) for (let i = Math.max(0, Math.floor(x0)); i < Math.min(fr.w, Math.ceil(x1)); i++) {
      if (a.t === 'ell' && ((i + 0.5 - cx) / rx) ** 2 + ((j + 0.5 - cy) / ry) ** 2 > 1) continue;
      const p = j * fr.w + i, v = fr.kind === 'rgb' ? 0.299 * fr.data[p * 3] + 0.587 * fr.data[p * 3 + 1] + 0.114 * fr.data[p * 3 + 2] : fr.data[p];
      n++; sum += v; sq += v * v; if (v < mn) mn = v; if (v > mx) mx = v;
    }
    const area = (a.t === 'ell' ? Math.PI * rx * ry : 4 * rx * ry) * (cal ? sx * sy : 1);
    if (!n) return ['no pixels'];
    const mean = sum / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean)), unit = s.isCT ? ' HU' : fr.kind === 'rgb' ? ' (luma)' : '';
    return [`Mean ${fmt(mean, 1)}${unit}  SD ${fmt(sd, 1)}`, `Min ${fmt(mn, 1)}  Max ${fmt(mx, 1)}`, `Area ${fmt(area, area > 100 ? 0 : 1)} ${u}²${star}  n=${n}`];
  }

  function drawAnn(ctx, a, m, fr, s, color) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.5;
    let pts = a.p.map(p => tp(m, p[0], p[1])), label;
    ctx.beginPath();
    if (a.t === 'len' || a.t === 'ang') { pts.forEach((p, i) => i ? ctx.lineTo(...p) : ctx.moveTo(...p)); label = pts[1]; }
    else {
      const [p, q] = a.p, cx = (p[0] + q[0]) / 2, cy = (p[1] + q[1]) / 2, rx = Math.abs(q[0] - p[0]) / 2, ry = Math.abs(q[1] - p[1]) / 2;
      const poly = a.t === 'rect' ? [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]]
        : Array.from({ length: 72 }, (_, k) => [cx + rx * Math.cos(k / 72 * 2 * Math.PI), cy + ry * Math.sin(k / 72 * 2 * Math.PI)]);
      const sp = poly.map(q2 => tp(m, q2[0], q2[1])); sp.forEach((q2, i) => i ? ctx.lineTo(...q2) : ctx.moveTo(...q2)); ctx.closePath();
      label = [Math.max(...sp.map(q2 => q2[0])), Math.min(...sp.map(q2 => q2[1]))];
    }
    ctx.stroke();
    pts.forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 2.5, 0, 7); ctx.fill(); });
    const lines = annMetrics(a, fr, s);
    textBlock(ctx, lines, label[0] + 8, label[1] - 4, 'left', color);
  }

  function textBlock(ctx, lines, x, y, align, color, size) {
    size = size || 12; ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'top';
    lines.forEach((l, i) => {
      if (!l) return; const t = typeof l === 'string' ? l : l[0], c = typeof l === 'string' ? color : l[1];
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(t, x, y + i * (size + 3));
      ctx.fillStyle = c; ctx.fillText(t, x, y + i * (size + 3));
    });
  }

  /* Full draw of one viewport. opts: {ctx,dpr,overlay,ann,phi} for export. */
  function renderVp(vp, S, opts) {
    opts = opts || {};
    const dpr = opts.dpr || window.devicePixelRatio || 1, cv = vp.canvas, ctx = opts.ctx || cv.getContext('2d');
    const W = vp.cw, H = vp.ch, live = !opts.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const s = vp.series;
    if (!s) { textBlock(ctx, ['Select a series on the left,', 'drop files here, or load the demo volume.'], W / 2, H / 2 - 14, 'center', '#6f84a8'); return; }
    const fr = frameOf(vp), img = windowed(vp, fr), m = matrix(vp, fr), D = new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).multiply(m);
    ctx.save(); ctx.setTransform(D); ctx.imageSmoothingEnabled = S.smooth; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(img, 0, 0); ctx.restore();
    const showAnn = opts.ann !== false, showOv = opts.overlay != null ? opts.overlay : S.overlay, phi = opts.phi != null ? opts.phi : !S.privacy;
    // MPR reference lines
    if (isMpr(vp) && showAnn) {
      const v = s.vol, c = v.cur, kr = rowOfK(v, c.k) + 0.5;
      const lines = vp.plane === 'src' ? [['pc', 'h', c.j + 0.5], ['pr', 'v', c.i + 0.5]] : vp.plane === 'pc' ? [['src', 'h', kr], ['pr', 'v', c.i + 0.5]] : [['src', 'h', kr], ['pc', 'v', c.j + 0.5]];
      ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      lines.forEach(([pl, dir, at]) => {
        const a = dir === 'h' ? tp(m, 0, at) : tp(m, at, 0), b = dir === 'h' ? tp(m, fr.w, at) : tp(m, at, fr.h);
        ctx.strokeStyle = PLANE_COL[pl]; ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    if (showAnn) {
      (s.anns[fr.key] || []).forEach(a => drawAnn(ctx, a, m, fr, s, '#ffd84d'));
      if (vp.draft && vp.draft.key === fr.key) drawAnn(ctx, vp.draft.a, m, fr, s, '#7fffd4');
      if (vp.pendingAng && vp.pendingAng.key === fr.key) drawAnn(ctx, vp.pendingAng.a, m, fr, s, '#7fffd4');
    }
    // orientation markers
    const inv = m.inverse(), dirOf = (sx, sy) => {
      if (!fr.right || !fr.down) return '';
      const o = inv.transformPoint(new DOMPoint(0, 0)), p = inv.transformPoint(new DOMPoint(sx, sy));
      return orientLabel(add(mul(fr.right, (p.x - o.x) * (fr.sx || 1)), mul(fr.down, (p.y - o.y) * (fr.sy || 1))));
    };
    const fs = W < 360 ? 11 : 12, compact = W < 340 || H < 280, cut = (a, n) => compact ? a.slice(0, n) : a;
    if (showOv) {
      textBlock(ctx, [dirOf(0, -1)], W / 2, 6, 'center', '#ffe08a', 14); textBlock(ctx, [dirOf(0, 1)], W / 2, H - 22, 'center', '#ffe08a', 14);
      textBlock(ctx, [dirOf(-1, 0)], 8, H / 2 - 8, 'left', '#ffe08a', 14); textBlock(ctx, [dirOf(1, 0)], W - 8, H / 2 - 8, 'right', '#ffe08a', 14);
      const I = s.info, sl = fr.slice, n = count(vp), idx = getIdx(vp);
      const mask = compact ? 'hidden' : 'hidden (privacy)';
      if (phi !== 'none') textBlock(ctx, cut([phi ? I.patName || '—' : 'Patient: ' + mask, phi ? `ID ${I.patId || '—'}${I.sex ? '  ' + I.sex : ''}` : '', phi ? `${I.studyDate} ${I.studyTime}` : '', phi ? I.institution : ''].filter(Boolean), 1).map(t => compact && t.length > 18 ? t.slice(0, 17) + '…' : t), 8, 26, 'left', '#dfe8f7', fs);
      if (!compact) textBlock(ctx, [[I.modality, I.bodyPart].filter(Boolean).join(' · '), I.studyDesc, `Se ${I.seriesNum != null ? I.seriesNum : '—'}  ${I.seriesDesc}`, I.maker], W - 8, 26, 'right', '#dfe8f7', fs);
      const plane = isMpr(vp) ? `${planeName(fr.normal)}${fr.reformat ? ' MPR' : ''}` : '';
      const loc = fr.reformat ? `Pos ${fmt(idx * (vp.plane === 'pc' ? s.vol.dy : s.vol.dx), 1)} mm` : sl.sliceLoc != null ? `Loc ${fmt(sl.sliceLoc, 1)} mm` : '';
      let bl = [plane, `Im ${idx + 1}/${n}${!isMpr(vp) && sl.nFrames > 1 ? `  (frame ${sl.frame + 1}/${sl.nFrames})` : ''}`, [loc, I.thick ? `Thk ${fmt(I.thick, 1)} mm` : ''].filter(Boolean).join('  '),
        [I.kvp ? `${fmt(I.kvp, 0)} kVp` : '', I.mas ? `${fmt(I.mas, 0)} mAs` : ''].filter(Boolean).join('  ')];
      if (live && vp.hover && vp.hover.vp === vp) { const pv = pixelValue(fr, vp.hover.ix, vp.hover.iy, s); if (pv != null) bl.push([`x ${Math.floor(vp.hover.ix)}  y ${Math.floor(vp.hover.iy)}  ${pv}`, '#9fe8ff']); }
      if (compact) bl = [`Im ${idx + 1}/${n}`, bl[bl.length - 1] !== bl[3] ? bl[bl.length - 1] : ''];
      textBlock(ctx, bl.filter(Boolean), 8, H - 26 - bl.filter(Boolean).length * (fs + 3), 'left', '#dfe8f7', fs);
      let br = [`WW ${fmt(vp.ww, 0)}  WL ${fmt(vp.wc, 0)}`, `Zoom ${fmt(vp.zoom * dpr * 100, 0)}%${vp.rot ? `  Rot ${vp.rot * 90}°` : ''}${vp.flipH ? '  FlipH' : ''}${vp.flipV ? '  FlipV' : ''}`,
        vp.invert ? 'INVERTED' : '', I.lossy ? [`LOSSY COMPRESSED${I.lossyRatio ? ' ' + fmt(I.lossyRatio, 1) + ':1' : ''}`, '#ff9f43'] : '',
        !fr.sx ? ['No pixel spacing: measurements in px', '#ff9f43'] : fr.calib === 'detector' ? ['* Detector-plane calibration', '#ff9f43'] : fr.calib === 'us' ? 'US region calibration' : '',
        s.vol && s.vol.tilt && isMpr(vp) ? ['Gantry tilt/shear: MPR geometry approx.', '#ff9f43'] : ''].filter(Boolean);
      if (compact) br = br.filter((x, i) => i === 0 || Array.isArray(x)).map(x => Array.isArray(x) ? [x[0].replace('No pixel spacing: measurements in px', 'Uncalibrated (px)').replace('Detector-plane calibration', 'Detector cal.').replace('Gantry tilt/shear: MPR geometry approx.', 'Tilt: approx.').replace(/^LOSSY COMPRESSED/, 'LOSSY'), x[1]] : x);
      textBlock(ctx, br, W - 8, H - 26 - br.length * (fs + 3), 'right', '#dfe8f7', fs);
      // vertical scale bar on the left edge, between the L/R marker and the lower-left text
      if (fr.sx) {
        const ppm = vp.zoom / aspect(fr)[2], top = H / 2 + 22, bottom = H - 30 - bl.filter(Boolean).length * (fs + 3), room = bottom - top;
        const nice = [1, 2, 5, 10, 20, 50, 100, 200, 500].filter(x => x * ppm <= Math.min(room, 160)).pop();
        if (nice && nice * ppm > 20) {
          const L = nice * ppm, x0 = 10, y0 = top + (room - L) / 2; ctx.strokeStyle = '#dfe8f7'; ctx.lineWidth = 1.5; ctx.beginPath();
          ctx.moveTo(x0 + 5, y0); ctx.lineTo(x0, y0); ctx.lineTo(x0, y0 + L); ctx.lineTo(x0 + 5, y0 + L);
          for (let k = 1; k < 5; k++) { ctx.moveTo(x0, y0 + L * k / 5); ctx.lineTo(x0 + 3, y0 + L * k / 5); }
          ctx.stroke(); textBlock(ctx, [`${nice} mm`], x0 + 8, y0 + L / 2 - 6, 'left', '#dfe8f7', 11);
        }
      }
    }
    // stack position indicator
    const n = count(vp);
    if (n > 1) { const h = Math.max(6, (H - 40) / n); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(W - 4, 20, 3, H - 40); ctx.fillStyle = '#4da3ff'; ctx.fillRect(W - 4, 20 + (H - 40 - h) * (getIdx(vp) / (n - 1)), 3, h); }
    // magnifier lens
    if (live && S.lens && vp.hover && vp.hover.vp === vp) {
      const { sx: hx, sy: hy } = vp.hover, R = 70;
      ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, R, 0, 7); ctx.clip();
      ctx.setTransform(new DOMMatrix([dpr, 0, 0, dpr, 0, 0]).translate(hx, hy).scale(2.5).translate(-hx, -hy).multiply(m));
      ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#000'; ctx.fillRect(-1e5, -1e5, 2e5, 2e5); ctx.drawImage(img, 0, 0); ctx.restore();
      ctx.strokeStyle = '#4da3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, R, 0, 7); ctx.stroke();
    }
  }

  /* ================= the view ================= */
  V.dicomViewer = function (el) {
    App.crumbs([['', 'DICOM Viewer']]);
    const hasDaikon = !!window.daikon;
    el.innerHTML = `<div class="page-head"><h1>DICOM viewer</h1><p>Open CT, MR, CR/DX, MG, US, XA and other DICOM images: stack scrolling, window/level, measurements, ROI statistics, MPR, tag browser. <b>Files never leave this browser</b>: decoding happens locally; nothing is uploaded or stored.</p></div>
      <div class="warn-banner"><b>Training / reference viewer only.</b> This is not a cleared (FDA 510(k) / CE-MDR) medical device and must not be used for primary diagnosis or clinical decisions. Report from the facility's approved PACS workstation on calibrated, QA-tested diagnostic displays.</div>
      ${hasDaikon ? '' : '<div class="warn-banner"><b>DICOM decoder not loaded.</b> The daikon library (CDN) is unavailable, so DICOM files cannot be opened. Check the network connection and reload. The demo volume still works.</div>'}
      <div class="dv" id="dv" tabindex="-1">
        <div class="dv-top">
          <label class="btn btn-primary small">Open files<input type="file" id="dvFiles" multiple hidden></label>
          <label class="btn small">Open folder<input type="file" id="dvDir" webkitdirectory directory multiple hidden></label>
          <button class="btn small" id="dvDemo">Load demo volume</button>
          <span class="dv-sep"></span>
          <button class="btn small" id="dvTags">Tags</button><button class="btn small" id="dvExport">Export PNG</button><button class="btn small" id="dvHelp">Shortcuts ?</button>
          <div class="dv-progress" id="dvProg" hidden><i></i><span></span></div>
        </div>
        <div class="dv-toolbar" id="dvTools">
          ${TOOLS.map(([k, l, key]) => `<button class="dv-tb" data-tool="${k}" title="${l} (${key})">${l}<kbd>${key}</kbd></button>`).join('')}
          <span class="dv-sep"></span>
          <select id="dvPreset" title="Window presets (1–9, 0 = default)"><option>Window presets</option></select>
          <span class="dv-sep"></span>
          <button class="dv-tb" data-act="fit" title="Fit (F)">Fit<kbd>F</kbd></button><button class="dv-tb" data-act="one" title="1:1 device pixels (N)">1:1<kbd>N</kbd></button>
          <button class="dv-tb" data-act="invert" title="Invert (I)">Invert<kbd>I</kbd></button><button class="dv-tb" data-act="rot" title="Rotate 90° (T)">Rotate<kbd>T</kbd></button>
          <button class="dv-tb" data-act="flipH" title="Flip horizontal (H)">Flip H<kbd>H</kbd></button><button class="dv-tb" data-act="flipV" title="Flip vertical (V)">Flip V<kbd>V</kbd></button>
          <button class="dv-tb" data-act="reset" title="Reset view (X)">Reset<kbd>X</kbd></button><button class="dv-tb" data-act="clear" title="Delete annotations on this image (Del)">Clear ann.</button>
          <span class="dv-sep"></span>
          <button class="dv-tb" data-tog="lens" title="Magnifier (M)">Magnifier<kbd>M</kbd></button><button class="dv-tb" data-tog="overlay" title="Overlay text (O)">Overlay<kbd>O</kbd></button>
          <button class="dv-tb" data-tog="privacy" title="Hide patient identifiers (K)">Privacy<kbd>K</kbd></button><button class="dv-tb" data-tog="smooth" title="Bilinear interpolation (S)">Smooth<kbd>S</kbd></button>
          <span class="dv-sep"></span>
          <button class="dv-tb" data-layout="1" title="1 viewport">1×1</button><button class="dv-tb" data-layout="2" title="Side by side">1×2</button><button class="dv-tb" data-layout="4" title="2×2">2×2</button>
          <button class="dv-tb" data-layout="mpr" title="Multiplanar reformat of the active series">MPR</button>
        </div>
        <div class="dv-body">
          <aside class="dv-series" id="dvSeries"><div class="dv-empty">No series loaded.<br>Drop DICOM files or a folder anywhere on the viewer.</div></aside>
          <div class="dv-stage"><div class="dv-grid" id="dvGrid"></div><div class="dv-drop" id="dvDrop">Drop DICOM files or folders</div></div>
        </div>
        <div class="dv-status">
          <button class="dv-tb" id="dvPlay" title="Cine (Space)">▶ Cine</button>
          <label class="dv-fps">fps <input type="number" id="dvFps" min="1" max="60" value="10"></label>
          <input type="range" id="dvSlider" min="0" max="0" value="0" aria-label="Image">
          <span class="dv-pos" id="dvPos">—</span>
          <label class="dv-wl">WW <input type="number" id="dvWW"></label><label class="dv-wl">WL <input type="number" id="dvWC"></label>
          <span class="dv-msg" id="dvMsg"></span>
        </div>
      </div>`;

    const S = { series: [], vps: [], active: 0, layout: '1', tool: 'wl', lens: false, overlay: true, privacy: true, smooth: true, cine: null, bytes: 0, sops: new Set() };
    const grid = $('#dvGrid', el), root = $('#dv', el), ac = new AbortController(), sig = { signal: ac.signal };
    const act = () => S.vps[S.active];
    let rafId = 0;
    const redraw = () => { if (!rafId) rafId = requestAnimationFrame(() => { rafId = 0; S.vps.forEach(vp => renderVp(vp, S)); syncStatus(); }); };

    /* ---------- layout / viewports ---------- */
    function buildGrid(n) {
      const keep = S.vps; grid.className = 'dv-grid l' + S.layout; grid.innerHTML = '';
      S.vps = Array.from({ length: n }, (_, i) => {
        const d = document.createElement('div'); d.className = 'dv-vp'; d.innerHTML = '<canvas></canvas>'; grid.appendChild(d);
        const vp = newVp(d), old = keep[i];
        if (old && old.series && S.layout !== 'mpr') Object.assign(vp, { series: old.series, idx: old.mpr ? old.series.vol.cur.k : old.idx, ww: old.ww, wc: old.wc, invert: old.invert, rot: old.mpr ? 0 : old.rot, flipH: old.mpr ? false : old.flipH, flipV: old.mpr ? false : old.flipV });
        wireVp(vp); return vp;
      });
      S.active = Math.min(S.active, n - 1); resize(); markActive();
    }
    function setLayout(l) {
      if (l === 'mpr') return startMpr();
      const wasMpr = S.layout === 'mpr'; S.layout = l; stopCine(); if (S.tool === 'cross') S.tool = 'wl'; buildGrid(+l);
      if (wasMpr) { S.vps.slice(1).forEach(vp => { vp.series = null; }); S.active = 0; markActive(); }
      S.vps.forEach((vp, i) => { if (!vp.series && S.series[i]) setSeries(vp, S.series[i]); });
      syncButtons(); redraw();
    }
    function startMpr() {
      const s = act() && act().series;
      if (!s) return toast('Load a series first');
      if (s.mprWhy) return toast('MPR not available: ' + s.mprWhy);
      const go = () => {
        S.layout = 'mpr'; stopCine(); const prev = act(); buildGrid(3);
        const v = s.vol; v.cur = v.cur || { i: v.nx >> 1, j: v.ny >> 1, k: v.nz >> 1 };
        S.vps.forEach((vp, i) => { setSeries(vp, s); vp.mpr = true; vp.plane = ['src', 'pc', 'pr'][i]; vp.ww = prev.ww; vp.wc = prev.wc; vp.invert = prev.invert; vp.el.style.setProperty('--plane', PLANE_COL[vp.plane]); });
        S.tool = 'cross'; syncButtons(); redraw();
        if (v.tilt) toast('Slices are sheared (gantry tilt): reformat geometry is approximate');
      };
      if (s.bigVolume) {
        const c = modal(`<h2>Large volume</h2><p>This series has ${s.slices.length} slices of ${s.slices[0].cols}×${s.slices[0].rows}. Reformatting it is memory- and CPU-intensive and may make the browser slow on this device.</p><div class="row gap"><button class="btn btn-primary" id="dvGo">Continue</button><button class="btn" data-close>Cancel</button></div>`);
        $('#dvGo', c).onclick = () => { closeModal(); go(); };
      } else go();
    }
    function markActive() { S.vps.forEach((vp, i) => vp.el.classList.toggle('on', i === S.active)); }
    function setActive(i) { if (S.active !== i) { S.active = i; markActive(); syncPresets(); syncStatus(); } }

    function setSeries(vp, s) {
      Object.assign(vp, { series: s, idx: 0, plane: 'src', mpr: false, invert: false, rot: 0, flipH: false, flipV: false, fit: true, panX: 0, panY: 0, _fr: null, _win: null, draft: null, pendingAng: null });
      vp.ww = s.defWin[1]; vp.wc = s.defWin[2]; vp.el.style.removeProperty('--plane');
      if (s.info.fps && !S.cine) $('#dvFps', root).value = Math.round(clamp(s.info.fps, 1, 60));
      if (vp === act()) syncPresets();
    }
    function resize() {
      const dpr = window.devicePixelRatio || 1;
      S.vps.forEach(vp => { const r = vp.el.getBoundingClientRect(); vp.cw = Math.max(50, r.width); vp.ch = Math.max(50, r.height); vp.canvas.width = Math.round(vp.cw * dpr); vp.canvas.height = Math.round(vp.ch * dpr); });
      redraw();
    }
    const ro = new ResizeObserver(resize); ro.observe(grid);

    /* ---------- interaction ---------- */
    function wireVp(vp) {
      const cv = vp.canvas, ptrs = new Map(); let drag = null;
      const local = e => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      const toImg = (x, y) => { const fr = frameOf(vp), p = matrix(vp, fr).inverse().transformPoint(new DOMPoint(x, y)); return [p.x, p.y]; };
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('pointerdown', e => {
        setActive(S.vps.indexOf(vp)); if (!vp.series) return;
        cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, local(e)); e.preventDefault();
        if (ptrs.size === 2) { // pinch
          if (vp.draft) vp.draft = null;
          const [a, b] = [...ptrs.values()];
          drag = { kind: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c0: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], z0: vp.zoom, px: vp.panX, py: vp.panY };
          return;
        }
        const [x, y] = local(e), tool = e.button === 1 ? 'pan' : e.button === 2 ? 'zoom' : S.tool, fr = frameOf(vp), ip = toImg(x, y);
        drag = { kind: tool, x, y, ww: vp.ww, wc: vp.wc, px: vp.panX, py: vp.panY, z: vp.zoom };
        if (['len', 'ell', 'rect'].includes(tool)) vp.draft = { key: fr.key, a: { t: tool, p: [ip, ip.slice()] } };
        else if (tool === 'ang') {
          if (vp.pendingAng && vp.pendingAng.key === fr.key) { vp.pendingAng.a.p[2] = ip; commit(vp, vp.pendingAng); vp.pendingAng = null; drag = null; }
          else vp.draft = { key: fr.key, a: { t: 'ang', p: [ip, ip.slice(), ip.slice()] } };
        } else if (tool === 'cross') crossAt(vp, ip);
        redraw();
      });
      cv.addEventListener('pointermove', e => {
        if (!vp.series) return;
        const [x, y] = local(e);
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [x, y]);
        const ip = toImg(x, y);
        if (e.pointerType === 'mouse') vp.hover = { vp, sx: x, sy: y, ix: ip[0], iy: ip[1] };
        if (vp.pendingAng && !drag) vp.pendingAng.a.p[2] = ip;
        if (drag) {
          const dx = x - drag.x, dy = y - drag.y, s = vp.series;
          if (drag.kind === 'pinch' && ptrs.size >= 2) {
            const [a, b] = [...ptrs.values()], f = Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.d0, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
            vp.fit = false; vp.zoom = clamp(drag.z0 * f, 0.02, 60);
            const k = vp.zoom / drag.z0; vp.panX = c[0] - vp.cw / 2 - k * (drag.c0[0] - vp.cw / 2 - drag.px); vp.panY = c[1] - vp.ch / 2 - k * (drag.c0[1] - vp.ch / 2 - drag.py);
          } else if (drag.kind === 'wl') {
            const k = Math.max(0.05, (s.max - s.min) / 1024);
            vp.ww = Math.max(1, Math.round(drag.ww + dx * k)); vp.wc = Math.round(drag.wc + dy * k);
          } else if (drag.kind === 'pan') { vp.panX = drag.px + dx; vp.panY = drag.py + dy; }
          else if (drag.kind === 'zoom') { vp.fit = false; const f = Math.exp(-dy * 0.01), z = clamp(drag.z * f, 0.02, 60), k = z / drag.z; vp.zoom = z; vp.panX = drag.px * k; vp.panY = drag.py * k; }
          else if (drag.kind === 'cross') crossAt(vp, ip);
          else if (vp.draft) { vp.draft.a.p[1] = ip; if (vp.draft.a.t === 'ang') vp.draft.a.p[2] = ip.slice(); }
        }
        redraw();
      });
      const end = e => {
        ptrs.delete(e.pointerId);
        if (!drag) return;
        if (drag.kind === 'pinch') { drag = null; return; }
        if (vp.draft) {
          const [x, y] = local(e), moved = Math.hypot(x - drag.x, y - drag.y) > 3;
          if (moved) { if (vp.draft.a.t === 'ang') vp.pendingAng = vp.draft; else commit(vp, vp.draft); }
          vp.draft = null;
        }
        drag = null; redraw();
      };
      cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
      cv.addEventListener('pointerleave', () => { vp.hover = null; redraw(); });
      let acc = 0;
      cv.addEventListener('wheel', e => {
        if (!vp.series) return; e.preventDefault(); setActive(S.vps.indexOf(vp));
        const dy = e.deltaY * (e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1);
        if (e.ctrlKey || e.metaKey) { const [x, y] = local(e); zoomAt(vp, x, y, Math.exp(-dy * 0.002)); }
        else { acc += dy; const steps = Math.trunc(acc / 80); if (steps) { acc -= steps * 80; step(vp, steps); } }
        redraw();
      }, { passive: false });
      vp.el.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('text/dv-series')) { e.preventDefault(); e.stopPropagation(); } });
      vp.el.addEventListener('drop', e => {
        const id = e.dataTransfer.getData('text/dv-series'); if (!id) return;
        e.preventDefault(); e.stopPropagation(); const s = S.series.find(x => x.id === id);
        if (s && S.layout !== 'mpr') { setActive(S.vps.indexOf(vp)); setSeries(vp, s); redraw(); }
      });
    }
    function commit(vp, d) { const s = vp.series; (s.anns[d.key] = s.anns[d.key] || []).push(d.a); }
    function crossAt(vp, ip) {
      const v = vp.series.vol, c = v.cur, i = clamp(Math.floor(ip[0]), 0, 1e9), j = clamp(Math.floor(ip[1]), 0, 1e9), kOf = r => rowOfK(v, clamp(r, 0, v.nz - 1));
      if (vp.plane === 'src') { c.i = Math.min(i, v.nx - 1); c.j = Math.min(j, v.ny - 1); }
      else if (vp.plane === 'pc') { c.i = Math.min(i, v.nx - 1); c.k = kOf(j); }
      else { c.j = Math.min(i, v.ny - 1); c.k = kOf(j); }
      S.vps.forEach(x => { x._fr = null; });
    }
    function zoomAt(vp, x, y, f) {
      const z = clamp(vp.zoom * f, 0.02, 60), k = z / vp.zoom; vp.fit = false; vp.zoom = z;
      vp.panX = x - vp.cw / 2 - k * (x - vp.cw / 2 - vp.panX); vp.panY = y - vp.ch / 2 - k * (y - vp.ch / 2 - vp.panY);
    }
    function step(vp, d, wrap) {
      const n = count(vp); if (!n) return; let i = getIdx(vp) + d;
      if (wrap) i = ((i % n) + n) % n;
      setIdx(vp, i); vp.pendingAng = null;
      if (isMpr(vp)) S.vps.forEach(x => { if (x !== vp) x._fr = null; }); // refresh slice metadata in sibling planes
    }

    /* ---------- actions ---------- */
    function doAct(a) {
      const vp = act(); if (!vp || !vp.series) return;
      const tgt = S.layout === 'mpr' ? S.vps : [vp];
      tgt.forEach(v => {
        if (a === 'fit') { v.fit = true; v.panX = v.panY = 0; }
        else if (a === 'one') { v.fit = false; v.zoom = 1 / (window.devicePixelRatio || 1); }
        else if (a === 'invert') v.invert = !v.invert;
        else if (a === 'rot') { v.rot = (v.rot + 1) % 4; }
        else if (a === 'flipH') v.flipH = !v.flipH;
        else if (a === 'flipV') v.flipV = !v.flipV;
        else if (a === 'reset') Object.assign(v, { invert: false, rot: 0, flipH: false, flipV: false, fit: true, panX: 0, panY: 0, ww: v.series.defWin[1], wc: v.series.defWin[2] });
      });
      if (a === 'clear') { const fr = frameOf(vp); delete vp.series.anns[fr.key]; vp.pendingAng = null; }
      redraw();
    }
    function setWindow(ww, wc) { const tgt = S.layout === 'mpr' ? S.vps : [act()]; tgt.forEach(v => { if (v && v.series) { v.ww = Math.max(1, ww); v.wc = wc; } }); redraw(); }
    function undo() { const vp = act(); if (!vp || !vp.series) return; const l = vp.series.anns[frameOf(vp).key]; if (l && l.length) l.pop(); vp.pendingAng = null; redraw(); }
    function setTool(t) { if (t === 'cross' && S.layout !== 'mpr') return toast('Crosshair is used in MPR layout'); S.tool = t; S.vps.forEach(v => { v.pendingAng = null; v.draft = null; }); syncButtons(); redraw(); }
    function toggle(k) { S[k] = !S[k]; syncButtons(); redraw(); }

    function syncButtons() {
      $$('[data-tool]', root).forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
      $$('[data-tog]', root).forEach(b => b.classList.toggle('on', !!S[b.dataset.tog]));
      $$('[data-layout]', root).forEach(b => b.classList.toggle('on', b.dataset.layout === S.layout));
      root.dataset.tool = S.tool;
    }
    function syncPresets() {
      const s = act() && act().series, sel = $('#dvPreset', root);
      sel.innerHTML = '<option value="">Window presets</option>' + (s ? s.winOptions.map((o, i) => `<option value="${i}">${i < 9 ? i + 1 + ' · ' : ''}${esc(o[0])} (${fmt(o[1], 0)}/${fmt(o[2], 0)})</option>`).join('') : '');
    }
    function syncStatus() {
      const vp = act(), n = vp && vp.series ? count(vp) : 0, sl = $('#dvSlider', root);
      sl.max = Math.max(0, n - 1); sl.value = n ? getIdx(vp) : 0; sl.disabled = n < 2;
      $('#dvPos', root).textContent = n ? `${getIdx(vp) + 1} / ${n}` : '—';
      const ww = $('#dvWW', root), wc = $('#dvWC', root);
      if (document.activeElement !== ww) ww.value = vp && vp.series ? Math.round(vp.ww) : '';
      if (document.activeElement !== wc) wc.value = vp && vp.series ? Math.round(vp.wc) : '';
      $('#dvPlay', root).textContent = S.cine ? '❚❚ Stop' : '▶ Cine';
    }

    /* ---------- cine ---------- */
    function stopCine() { if (S.cine) clearInterval(S.cine); S.cine = null; syncStatus(); }
    function startCine() {
      stopCine(); const vp = act(); if (!vp || count(vp) < 2) return toast('Cine needs a multi-image series');
      const fps = clamp(+$('#dvFps', root).value || 10, 1, 60);
      S.cine = setInterval(() => { const v = act(); if (!v || !v.series) return stopCine(); step(v, 1, true); redraw(); }, 1000 / fps); syncStatus();
    }

    /* ---------- series list ---------- */
    function renderSeriesList() {
      const box = $('#dvSeries', root);
      if (!S.series.length) return;
      box.innerHTML = S.series.map(s => `<div class="dv-thumb" draggable="true" data-s="${s.id}" title="${esc(s.info.seriesDesc || s.info.file)}">
        <canvas width="96" height="96"></canvas>
        <div><b>${esc(s.info.modality || '?')}</b> <span>Se ${esc(s.info.seriesNum != null ? s.info.seriesNum : '—')}</span></div>
        <small>${esc(s.info.seriesDesc || s.info.file)}</small>
        <small>${s.slices.length} img${s.slices.length > 1 ? 's' : ''}${s.mprWhy ? '' : ' · <em class="ok">MPR</em>'}${s.kind === 'rgb' ? ' · colour' : ''}${s.info.lossy ? ' · <em class="warn">lossy</em>' : ''}</small></div>`).join('');
      $$('.dv-thumb', box).forEach(t => {
        const s = S.series.find(x => x.id === t.dataset.s);
        drawThumb($('canvas', t), s);
        t.onclick = () => { if (S.layout === 'mpr') setLayout('1'); setSeries(act(), s); redraw(); };
        t.ondragstart = e => e.dataTransfer.setData('text/dv-series', s.id);
      });
    }
    function drawThumb(c, s) {
      const vp = { series: s, plane: 'src', idx: Math.floor(s.slices.length / 2), ww: s.defWin[1], wc: s.defWin[2], invert: false };
      const fr = frameOf(vp), img = windowed(vp, fr), ctx = c.getContext('2d'), [ax, ay] = aspect(fr), k = Math.min(96 / (fr.w * ax), 96 / (fr.h * ay));
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 96, 96); ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, (96 - fr.w * ax * k) / 2, (96 - fr.h * ay * k) / 2, fr.w * ax * k, fr.h * ay * k);
    }

    /* ---------- loading ---------- */
    const prog = (frac, text) => { const p = $('#dvProg', root); p.hidden = frac == null; if (frac != null) { $('i', p).style.width = (frac * 100).toFixed(1) + '%'; $('span', p).textContent = text || ''; } };
    const msg = t => { $('#dvMsg', root).textContent = t; };
    let busy = false;
    async function loadFiles(files) {
      if (busy) return toast('Still loading, please wait');
      if (!window.daikon) return toast('DICOM decoder (daikon) failed to load: cannot open files');
      files = files.filter(f => f && f.size > 0 && !/^\./.test(f.name) && !/\.(txt|xml|json|html?|pdf|jpe?g|png|gif|zip|md|exe|dll|ini|csv|log)$/i.test(f.name));
      if (!files.length) return toast('No candidate files found');
      busy = true; let added = 0, skipped = 0, nonImg = 0, dup = 0, stopped = false; const errs = [], touched = new Set();
      for (let i = 0; i < files.length; i++) {
        const f = files[i]; prog(i / files.length, `${i + 1}/${files.length} ${f.name}`);
        try {
          const head = new Uint8Array(await f.slice(0, 132).arrayBuffer());
          if (!looksDicom(head)) { skipped++; continue; }
          const r = decodeFile(await f.arrayBuffer(), f.webkitRelativePath || f.name);
          if (!r || !r.frames.length) { nonImg++; continue; }
          if (r.info.sopUID && S.sops.has(r.info.sopUID)) { dup++; continue; }
          if (r.info.sopUID) S.sops.add(r.info.sopUID);
          const key = r.info.seriesUID || 'file:' + f.name;
          let s = S.series.find(x => (x.uid || 'file:' + x.info.file) === key && !x.demo);
          if (!s) { s = newSeries(r.info); s.uid = key; S.series.push(s); }
          r.frames.forEach(fr => { s.slices.push(fr); S.bytes += fr.data.byteLength; });
          touched.add(s); added += r.frames.length;
        } catch (err) { errs.push(`${f.name}: ${err.message || err}`); }
        if (S.bytes > MAX_BYTES) { stopped = true; break; }
        if (i % 2 === 1) await tick();
      }
      touched.forEach(finalizeSeries);
      prog(null); busy = false;
      const parts = [`Loaded ${added} image${added === 1 ? '' : 's'} in ${touched.size} series`];
      if (skipped) parts.push(`${skipped} non-DICOM skipped`); if (nonImg) parts.push(`${nonImg} non-image DICOM (SR, DICOMDIR…) skipped`);
      if (dup) parts.push(`${dup} duplicates`); if (errs.length) parts.push(`${errs.length} failed`);
      if (stopped) parts.push('stopped: memory limit (~1.5 GB decoded) reached');
      msg(parts.join(' · ')); toast(parts[0]);
      if (errs.length) console.warn('DICOM load errors', errs);
      if (errs.length && !added) modal(`<h2>Could not decode</h2><p class="muted">The files look like DICOM but could not be decoded (unsupported transfer syntax or corrupt data).</p><pre class="dv-pre">${esc(errs.slice(0, 20).join('\n'))}</pre>`);
      [...touched].filter(s => s.bigVolume).forEach(s => toast(`Large series (${s.slices.length} slices): MPR will ask before reformatting`));
      afterLoad([...touched]);
    }
    function afterLoad(newS) {
      renderSeriesList();
      if (!newS.length) return;
      if (S.layout === 'mpr') setLayout('1');
      S.vps.forEach(vp => { vp._fr = null; vp._win = null; });
      let k = 0; S.vps.forEach(vp => { if (!vp.series && newS[k]) setSeries(vp, newS[k++]); });
      if (k === 0) setSeries(act(), newS[0]);
      if (!S.scrolled) { S.scrolled = true; root.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
      syncPresets(); redraw();
    }
    async function readEntry(entry, out) {
      if (entry.isFile) return new Promise(r => entry.file(f => { out.push(f); r(); }, () => r()));
      if (entry.isDirectory) {
        const rd = entry.createReader();
        for (;;) { const batch = await new Promise(r => rd.readEntries(r, () => r([]))); if (!batch.length) break; for (const e of batch) await readEntry(e, out); }
      }
    }
    async function onDrop(e) {
      e.preventDefault(); root.classList.remove('dragging');
      if (e.dataTransfer.getData('text/dv-series')) return;
      const items = [...(e.dataTransfer.items || [])], out = [];
      const entries = items.map(it => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);
      if (entries.length) { msg('Reading folder…'); for (const en of entries) await readEntry(en, out); }
      else out.push(...e.dataTransfer.files);
      loadFiles(out);
    }

    /* ---------- tag browser / export / help ---------- */
    function tagRows(sl) {
      if (!sl.img) return DEMO_TAGS.map(r => ({ tag: r[0], name: r[1], vr: r[2], value: r[3], depth: 0 }));
      const out = [], hex = n => n.toString(16).toUpperCase().padStart(4, '0');
      const val = t => {
        if (t.group === 0x7FE0 && t.element === 0x0010) return '[pixel data]';
        const v = t.value; if (v == null) return '';
        if (v instanceof DataView || v instanceof ArrayBuffer) return `[binary ${v.byteLength} bytes]`;
        if (Array.isArray(v)) return v.map(x => x instanceof Date ? dateStr(x) : typeof x === 'object' && x ? JSON.stringify(x) : String(x)).join(' \\ ').slice(0, 300);
        return String(v).slice(0, 300);
      };
      const walk = (tags, depth) => tags.forEach(t => {
        if (t.group === 0xFFFE) { out.push({ tag: '', name: '— item —', vr: '', value: '', depth }); if (Array.isArray(t.value)) walk(t.value, depth + 1); return; }
        const seq = t.sublist || (Array.isArray(t.value) && t.value[0] instanceof daikon.Tag);
        out.push({ tag: `(${hex(t.group)},${hex(t.element)})`, name: t.group === 0x7FE0 && t.element === 0x10 ? 'PixelData' : daikon.Dictionary.getDescription(t.group, t.element), vr: t.vr || '', value: seq ? `[sequence, ${t.value.length} item(s)]` : val(t), depth, g: t.group });
        if (seq) walk(t.value, depth + 1);
      });
      walk(Object.keys(sl.img.tags).sort().map(k => sl.img.tags[k]), 0);
      return out;
    }
    function openTags() {
      const vp = act(); if (!vp || !vp.series) return toast('Load a series first');
      const fr = frameOf(vp), rows = tagRows(fr.slice), phiG = r => S.privacy && (r.g === 0x0010 || r.vr === 'PN');
      const c = modal(`<h2>DICOM tags</h2><p class="muted small">${esc(fr.slice.info.file)}${S.privacy ? ' · patient identifiers masked (Privacy on)' : ''}</p>
        <input type="search" id="dvTagQ" class="dv-tagq" placeholder="Filter by tag, name or value…" autocomplete="off">
        <div class="dv-tagbox"><table class="dv-tags"><thead><tr><th>Tag</th><th>Name</th><th>VR</th><th>Value</th></tr></thead><tbody></tbody></table></div>`, { wide: true });
      const body = $('tbody', c), draw = q => {
        q = (q || '').toLowerCase();
        body.innerHTML = rows.filter(r => !q || `${r.tag} ${r.name} ${r.value}`.toLowerCase().includes(q)).slice(0, 2000)
          .map(r => `<tr><td class="mono">${esc(r.tag)}</td><td style="padding-left:${8 + r.depth * 14}px">${esc(r.name)}</td><td class="mono">${esc(r.vr)}</td><td class="mono">${phiG(r) ? '•••' : esc(r.value)}</td></tr>`).join('');
      };
      draw(); $('#dvTagQ', c).oninput = e => draw(e.target.value); $('#dvTagQ', c).focus();
    }
    function openExport() {
      const vp = act(); if (!vp || !vp.series) return toast('Load a series first');
      const c = modal(`<h2>Export current view (PNG)</h2>
        <p class="muted">Exports the windowed 8-bit rendering of the active viewport. Patient name, ID, birth date, institution and study date are <b>never</b> written into the PNG, and the file name contains no identifiers. Burned-in annotations already present in the pixel data cannot be removed.</p>
        <label class="dv-check"><input type="checkbox" id="exAnn" checked> Burn in measurements / ROIs</label>
        <label class="dv-check"><input type="checkbox" id="exOv" checked> Burn in technical overlay (WW/WL, scale bar, orientation, image number)</label>
        <label class="dv-check"><input type="checkbox" id="exHi" checked> 2× resolution</label>
        <div class="row gap"><button class="btn btn-primary" id="exGo">Download PNG</button><button class="btn" data-close>Cancel</button></div>`);
      $('#exGo', c).onclick = () => {
        const k = $('#exHi', c).checked ? 2 : 1, cv = document.createElement('canvas'); cv.width = Math.round(vp.cw * k); cv.height = Math.round(vp.ch * k);
        renderVp(vp, S, { ctx: cv.getContext('2d'), dpr: k, ann: $('#exAnn', c).checked, overlay: $('#exOv', c).checked, phi: 'none' });
        const d = new Date(), stamp = d.toISOString().replace(/[-:]/g, '').slice(0, 15);
        cv.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `dicom-view-${vp.series.info.modality || 'img'}-${stamp}.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); });
        closeModal(); toast('PNG exported (de-identified overlay)');
      };
    }
    function openHelp() {
      const rows = [['Mouse left drag', 'Active tool'], ['Right drag / middle drag', 'Zoom / Pan'], ['Wheel', 'Scroll images'], ['Ctrl + wheel / trackpad pinch', 'Zoom at cursor'], ['Touch: 1 finger / 2 fingers', 'Active tool / pinch-zoom + pan'],
        ['W P Z', 'W/L, Pan, Zoom tools'], ['L A E R', 'Length, Angle (drag 2 arms, click 3rd point), Ellipse, Rectangle ROI'], ['C', 'MPR crosshair (click a plane to move the other two)'],
        ['↑ ↓ ← → PgUp PgDn Home End', 'Previous / next / first / last image'], ['Space', 'Cine play / stop'], ['1 – 9, 0', 'Window presets from the list, 0 = default'],
        ['F, N', 'Fit, 1:1 (one image pixel per device pixel)'], ['I T H V X', 'Invert, Rotate 90°, Flip H, Flip V, Reset'], ['M O K S', 'Magnifier, Overlay, Privacy, Smoothing'], ['Del / Ctrl+Z', 'Remove last annotation on this image'], ['?', 'This help']];
      modal(`<h2>Viewer shortcuts</h2><table class="table"><tbody>${rows.map(r => `<tr><td><kbd>${esc(r[0])}</kbd></td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table>
        <h3>Limitations</h3><ul class="muted small"><li>Training/reference only: no FDA/CE clearance, no display calibration (GSDF) control, no DICOM presentation states, overlays (60xx), or modality LUT sequences.</li><li>Rendering is 8-bit after windowing; windowing itself is applied to the full-precision rescaled values (HU for CT).</li><li>MPR uses nearest-slice sampling of the stacked volume (no interpolation between slices).</li></ul>`, { wide: true });
    }

    /* ---------- wiring ---------- */
    $('#dvFiles', root).onchange = e => { loadFiles([...e.target.files]); e.target.value = ''; };
    $('#dvDir', root).onchange = e => { loadFiles([...e.target.files]); e.target.value = ''; };
    $('#dvDemo', root).onclick = async () => {
      if (busy) return; busy = true; const b = $('#dvDemo', root); b.disabled = true;
      const s = await makeDemo(f => prog(f, 'Generating synthetic head phantom…'));
      prog(null); busy = false; b.disabled = false; S.series.push(s); S.bytes += s.slices.length * s.slices[0].data.byteLength;
      msg('Demo: synthetic CT head phantom, 64 × 256², 0.9 mm pixels, 2.5 mm slices. Contains a haemorrhage, subdural collection, infarct, calcification.');
      afterLoad([s]);
    };
    $('#dvTags', root).onclick = openTags; $('#dvExport', root).onclick = openExport; $('#dvHelp', root).onclick = openHelp;
    $$('[data-tool]', root).forEach(b => b.onclick = () => setTool(b.dataset.tool));
    $$('[data-act]', root).forEach(b => b.onclick = () => doAct(b.dataset.act));
    $$('[data-tog]', root).forEach(b => b.onclick = () => toggle(b.dataset.tog));
    $$('[data-layout]', root).forEach(b => b.onclick = () => setLayout(b.dataset.layout));
    $('#dvPreset', root).onchange = e => { const vp = act(); const o = vp && vp.series && vp.series.winOptions[+e.target.value]; if (o) setWindow(o[1], o[2]); e.target.selectedIndex = 0; };
    $('#dvSlider', root).oninput = e => { const vp = act(); if (vp && vp.series) { setIdx(vp, +e.target.value); redraw(); } };
    $('#dvPlay', root).onclick = () => S.cine ? stopCine() : startCine();
    $('#dvFps', root).onchange = () => { if (S.cine) startCine(); };
    const wlIn = () => { const ww = +$('#dvWW', root).value, wc = +$('#dvWC', root).value; if (ww > 0 && isFinite(wc)) setWindow(ww, wc); };
    $('#dvWW', root).onchange = wlIn; $('#dvWC', root).onchange = wlIn;
    root.addEventListener('dragover', e => { if (!e.dataTransfer.types.includes('text/dv-series')) { e.preventDefault(); root.classList.add('dragging'); } });
    root.addEventListener('dragleave', e => { if (!root.contains(e.relatedTarget)) root.classList.remove('dragging'); });
    root.addEventListener('drop', onDrop);

    document.addEventListener('keydown', e => {
      if (!document.body.contains(root)) return cleanup();
      if ($('#modal').classList.contains('open') || (e.target.matches && e.target.matches('input, textarea, select')) || e.altKey) return;
      const k = e.key, vp = act(), has = vp && vp.series;
      if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 'z') { e.preventDefault(); return undo(); }
      if (e.ctrlKey || e.metaKey) return;
      const tool = { w: 'wl', p: 'pan', z: 'zoom', l: 'len', a: 'ang', e: 'ell', r: 'rect', c: 'cross' }[k.toLowerCase()];
      const actK = { f: 'fit', n: 'one', i: 'invert', t: 'rot', h: 'flipH', v: 'flipV', x: 'reset' }[k.toLowerCase()];
      const tog = { m: 'lens', o: 'overlay', k: 'privacy', s: 'smooth' }[k.toLowerCase()];
      const nav = { ArrowUp: -1, ArrowLeft: -1, PageUp: -10, ArrowDown: 1, ArrowRight: 1, PageDown: 10, Home: -1e9, End: 1e9 }[k];
      let handled = true;
      if (tool) setTool(tool); else if (actK) doAct(actK); else if (tog) toggle(tog);
      else if (nav && has) { step(vp, nav); redraw(); }
      else if (k === ' ') S.cine ? stopCine() : startCine();
      else if (/^[0-9]$/.test(k) && has) { const o = vp.series.winOptions; if (k === '0') setWindow(vp.series.defWin[1], vp.series.defWin[2]); else if (o[+k - 1]) setWindow(o[+k - 1][1], o[+k - 1][2]); }
      else if ((k === 'Delete' || k === 'Backspace') && has) undo();
      else if (k === '?') openHelp();
      else if (k === 'Escape') { S.vps.forEach(v => { v.draft = null; v.pendingAng = null; }); redraw(); }
      else handled = false;
      if (handled) e.preventDefault();
    }, sig);
    window.addEventListener('hashchange', () => { if (!document.body.contains(root)) cleanup(); }, sig);
    function cleanup() { ac.abort(); stopCine(); ro.disconnect(); cancelAnimationFrame(rafId); S.series.length = 0; }

    buildGrid(1); syncButtons(); syncPresets(); syncStatus();
    V.dicomViewer._state = S; // exposed for debugging / tests
  };
})();

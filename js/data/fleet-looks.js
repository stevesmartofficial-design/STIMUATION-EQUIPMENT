/* Look parameters for the hospital fleet's 3D replicas (js/three/models-fleet.js).
   One entry per BME.fleet id (C-arms, angiography systems, ultrasound). Values are
   from published specs where available (see src); "est." marks figures estimated
   from product photos / sister models. Stylised training replicas — no logos.

   C-arm:   form 'carm' | 'compact' (monitor on the stand) | 'oarm' (O-ring gantry)
            det 'ii' (ii = inches) | 'fpd' (fpd = [w,h] cm); sid/free/depth in m
            cart {kind 'dual'|'wide'|'quad'|'mvs'|'none', mon inches}; touch 'stand'|'cart'|'both'
            panel 'slope'|'pod'|'touch'; wigwag, motor, threeD; col {shell, shell2, accent, dark, base}
   Angio:   mount 'ceiling'|'floor'; biplane; detA/detB [w,h] cm; sid [min,max] m; display inches;
            flexarm; table {len, w}; col {...}
   US:      form 'cart'|'laptop'; H [min,max], W, D (m); kg; mon/touch inches; ports; pencil;
            kb 'pull'|'panel'|'none'; panel 'flat'|'curved'|'wing'; handle 'front'|'wrap'|'rear';
            column 'slim'|'wide'; col {body, panel, trim, accent, keys} */
(function () {
  const ZIEHM = { shell: 0xf2f4f6, shell2: 0xd9dee4, accent: 0x1f5fae, dark: 0x2c333c, base: 0x3a434e };
  const SIEMENS = { shell: 0xf1f2f3, shell2: 0xd6dadf, accent: 0x5d6b78, dark: 0x30363d, base: 0x6a737c };
  const PHILIPS = { shell: 0xf4f5f6, shell2: 0xdde1e5, accent: 0x2b6cb0, dark: 0x2a2f36, base: 0x4a525b };
  const GE = { shell: 0xeef0f2, shell2: 0xcfd5dc, accent: 0x5a6f8c, dark: 0x2b3038, base: 0x56606c };
  const L = {
    /* ---------------- Mobile C-arms ---------------- */
    'ziehm-vision': {
      form: 'carm', det: 'ii', ii: 9, sid: .97, free: .76, depth: .68, orbital: '-90°/+45° (135°)', kw: '2.0–2.5 (est.)',
      dims: 'Stand ≈1.8 × 0.80 × 1.80 m, 260 kg · monitor cart 160 kg', cart: { kind: 'dual', mon: 19 }, touch: null, panel: 'slope', motor: false,
      col: ZIEHM, ref: 'Ziehm Vision (II version): 9" image intensifier, dual 19" TFT monitor cart, slim rounded C, Ziehm blue/white styling.',
      src: ['https://remma.fr/en/model/mobile-surgical-c-arm-vision']
    },
    'ziehm-vision-fd': {
      form: 'carm', det: 'fpd', fpd: [20.5, 20.5], sid: 1.0, free: .80, depth: .68, orbital: '-90°/+45°; angulation ±225°', kw: '2.5 (est.)',
      dims: 'Stand ≈1.8 × 0.80 × 1.75 m (est.), ~200 kg; vertical travel 43 cm motorised', cart: { kind: 'dual', mon: 19 }, touch: 'cart', panel: 'slope', motor: false,
      col: ZIEHM, ref: 'Ziehm Vision FD: 20.5 × 20.5 cm a-Si flat panel (1k × 1k), dual 19" touch monitors on the cart, same chassis as Vision.',
      src: ['https://remma.fr/en/model/vision-fd', 'https://fda.innolitics.com/device/K061534']
    },
    'ziehm-vision-rfd': {
      form: 'carm', det: 'fpd', fpd: [31, 31], sid: 1.0, free: .78, depth: .68, orbital: '165°', kw: '25 kW pulsed (as published)',
      dims: 'Stand ≈1.85 × 0.80 × 1.80 m (est.); footprint 0.8 m²; motorised 4 axes', cart: { kind: 'wide', mon: 27, n: 2 }, touch: 'both', panel: 'touch', motor: true,
      col: Object.assign({}, ZIEHM, { accent: 0x1d6fd6 }), ref: 'Ziehm Vision RFD: CMOS/a-Si flat panel 21 or 31 cm (31 shown), motorised on 4 axes with Position Control Center, monitor cart with large displays + touchscreens.',
      src: ['https://www.ziehm.com/us/products/ziehm-vision-rfd/', 'https://healthmanagement.org/products/view/mobile-c-arm-with-flat-panel-detector-with-video-column-ziehm-vision-rfd-hybrid-edition-ziehm-imaging']
    },
    'ziehm-vision-rfd-3d': {
      form: 'carm', det: 'fpd', fpd: [31, 31], sid: 1.0, free: .78, depth: .70, orbital: '165° 2D · 180° SmartScan 3D, isocentric', kw: '25 kW pulsed (as published)',
      dims: 'Stand ≈1.9 × 0.85 × 1.9 m (est.), ~320 kg (est.); 3D volume 16 × 16 × 16 cm', cart: { kind: 'wide', mon: 27, n: 2 }, touch: 'both', panel: 'touch', motor: true, threeD: true,
      col: Object.assign({}, ZIEHM, { accent: 0x1d6fd6 }), ref: 'Ziehm Vision RFD 3D: 31 × 31 cm CMOS flat panel, motorised isocentric C for 180° 3D scan, thicker C profile than RFD.',
      src: ['https://www.ziehm.com/en/us/products/ziehm-vision-rfd-3d', 'https://510k.innolitics.com/search/K231701']
    },
    'ziehm-solo': {
      form: 'compact', det: 'ii', ii: 9, sid: .97, free: .76, depth: .68, orbital: '-90°/+45°; angulation 225°', kw: '1 nominal / 2 max',
      dims: 'L 1.73–1.95 × W 0.80 × H 1.77–2.20 m, 310 kg; vertical travel 42 cm motorised', cart: { kind: 'none', mon: 24 }, touch: 'stand', panel: 'slope', motor: false,
      col: ZIEHM, ref: 'Ziehm Solo: compact C-arm (not a mini C-arm) with the monitor on a pole on the stand — no separate monitor cart. 9" II.',
      src: ['https://www.somatechnology.com/c-arms/ziehm-solo', 'https://www.ziehm.com/en/us/product-portfolio/ziehm-solo-fd/']
    },
    'siemens-siremobil-compact': {
      form: 'carm', det: 'ii', ii: 9, sid: 1.0, free: .78, depth: .73, orbital: '130° (-40°/+90°); angulation ±190°', kw: '2.0 (est.)',
      dims: 'C-arm 257 kg; monitor trolley 112 kg (≈0.7 × 0.7 × 1.6 m est.)', cart: { kind: 'dual', mon: 17 }, touch: null, panel: 'slope', motor: false,
      col: Object.assign({}, SIEMENS, { shell: 0xe9ebe6, shell2: 0xc9ccc4, accent: 0x5f7f99 }), ref: 'Siemens Siremobil Compact L: 9" dual-mode II, classic light-grey covers, button control panel, monitor trolley.',
      src: ['https://www.auntminnie.com/industry-news/product-news/article/15557548/siemens-releases-siremobil-compact-l']
    },
    'siemens-cios-select': {
      form: 'carm', det: 'ii', ii: 9, sid: 1.0, free: .78, depth: .73, orbital: '130° (-40°/+90°)', kw: '2.5',
      dims: 'C-arm 179.5 × 80 × 173.5 cm, 275 kg · cart 68.6 × 73.6 × 179.2 cm, 150 kg', cart: { kind: 'quad', mon: 19 }, touch: null, panel: 'slope', motor: false,
      col: SIEMENS, ref: 'Siemens Cios Select (II): 9" II, smooth white shell, rear loop handle, cart with 2 × 19" high-bright + 2 × 19" monitors.',
      src: ['https://www.siemens-healthineers.com/en-us/surgical-c-arms-and-navigation/mobile-c-arms/cios-select', 'https://www.siemens-healthineers.com/kr/surgical-c-arms-and-navigation/mobile-c-arms/cios-select-with-fd']
    },
    'siemens-cios-connect': {
      form: 'carm', det: 'ii', ii: 9, sid: 1.0, free: .79, depth: .73, orbital: '130° (-40°/+90°)', kw: '2.3',
      dims: 'C-arm 188.5 × 80.5 × 173 cm, 248 kg · cart 70 × 74 × 182 cm, 230 kg (incl. UPS)', cart: { kind: 'quad', mon: 19 }, touch: 'cart', panel: 'slope', motor: false,
      col: SIEMENS, ref: 'Siemens Cios Connect: 9" II, Cios-family shell, cart with 2 × 19" + 2 × 19" monitors, UPS and touch user interface.',
      src: ['https://www.siemens-healthineers.com/en-ca/surgical-c-arms-and-navigation/mobile-c-arms/cios-connect', 'https://www.auntminnie.com/clinical-news/digital-x-ray/article/15614576/fda-clears-new-cios-mobile-c-arms-from-siemens']
    },
    'philips-zenition-50': {
      form: 'carm', det: 'ii', ii: 12, sid: .98, free: .77, depth: .68, orbital: 'angulation +90°/-25°; rotation ±135° stop', kw: '15 kW monoblock (as published)',
      dims: 'Stand ≈1.8 × 0.8 × 1.8 m (est.), ~250 kg (est.)', cart: { kind: 'wide', mon: 27, n: 1 }, touch: 'stand', panel: 'touch', motor: false,
      col: PHILIPS, ref: 'Philips Zenition 50: 9"/12" II (12" shown), touch-screen module on the C-arm stand, mobile view station with one large monitor.',
      src: ['https://www.usa.philips.com/healthcare/product/HC718096', 'https://www.somatechnology.com/c-arms/philips-zenition-50']
    },
    'ge-oec-brivo-785': {
      form: 'carm', det: 'ii', ii: 9, sid: 1.0, free: .78, depth: .66, orbital: '120°; lateral 410°; wig-wag ±12.5°', kw: '2.2',
      dims: 'Mainframe 179 × 78 × 170.5 cm, 260 kg · workstation 90 × 64 × 167 cm, 170 kg', cart: { kind: 'dual', mon: 19 }, touch: null, panel: 'pod', motor: false, wigwag: true,
      col: GE, ref: 'GE OEC Brivo 785: tri-mode 9" II, wig-wag swivel at the cross-arm, tall rear control pod with handles, workstation with dual 19" monitors on a swivel arm.',
      src: ['https://www.somatechnology.com/c-arms/ge-oec-brivo-plus', 'https://medicaldevices.icij.org/devices/usa-radiology-devices-oec-brivo-715-prime-oec-brivo-785-essential-oec-brivo-865-advance']
    },
    'medtronic-o-arm-o2': {
      form: 'oarm', det: 'fpd', fpd: [40, 30], bore: .965, gap: .699, kw: '32',
      dims: 'Gantry 280.6 × 81.3 × 202.2 cm (door open), 926 kg · Mobile View Station ≈60 × 60 × 180 cm', cart: { kind: 'mvs', mon: 24 }, touch: 'cart',
      col: { shell: 0xf3f4f5, shell2: 0xd5dbe1, accent: 0x7fa6c9, dark: 0x2a3038, base: 0x5b646e }, ref: 'Medtronic O-arm O2: O-ring gantry (96.5 cm bore) whose door telescopes open (69.9 cm gap) to pass the table, 40 × 30 cm flat panel, Mobile View Station.',
      src: ['https://fda.innolitics.com/device/K151000', 'https://medtronic.com/ca-en/healthcare-professionals/products/neurological/surgical-imaging-systems/o-arm.html']
    },

    /* ---------------- Angiography ---------------- */
    'siemens-artis-zee-biplane': {
      mount: 'floor', biplane: true, detA: [30, 40], detB: [20, 20], sid: [.9, 1.2], display: 56, table: { len: 2.9, w: .5 }, kw: '100 (est.)', tube: 'MEGALIX Cat Plus (est.)',
      col: { shell: 0xf0f1f2, shell2: 0xc9ced4, accent: 0x6b7784, dark: 0x2a2f36, base: 0x7a838c },
      ref: 'Siemens Artis zee biplane: floor-mounted plane A (30 × 40 cm) + ceiling-mounted lateral plane B (20 × 20 cm, typical cardiac pairing), large display on ceiling suspension.',
      src: ['https://healthcare-in-europe.com/en/radbook/interventional-systems/2911-artis-zee-floor-artis-q-floor.html', 'https://blockimaging.com/equipment/interventional-radiology/siemens-artis-zee-biplane-cath-angio']
    },
    'philips-azurion-5-m12': {
      mount: 'ceiling', biplane: false, detA: [25, 25], sid: [.895, 1.195], display: 55, table: { len: 3.19, w: .5 }, kw: '100 (est.)', tube: 'MRC (est.)',
      col: { shell: 0xf4f5f6, shell2: 0xd2d7dc, accent: 0x3a7bd5, dark: 0x262b31, base: 0x8a929a },
      ref: 'Philips Azurion 5 M12: monoplane ceiling-mounted C-arm with 12" flat detector, central touch screen module at table side, FlexVision display.',
      src: ['https://www.philips.dk/healthcare/product/HC722227']
    },
    'philips-azurion-7-m12': {
      mount: 'ceiling', biplane: false, detA: [25, 25], sid: [.895, 1.195], display: 58, table: { len: 3.19, w: .5 }, kw: '100 (est.)', tube: 'MRC (est.)',
      col: { shell: 0xf4f5f6, shell2: 0xd2d7dc, accent: 0x3a7bd5, dark: 0x262b31, base: 0x8a929a },
      ref: 'Philips Azurion 7 M12: ceiling-mounted monoplane, 12" flat detector, FlexVision XL 58" display, table-side touch module.',
      src: ['https://acc.healthcare.philips.com/healthcare/product/HCNCVD003']
    },
    'philips-azurion-7-m20': {
      mount: 'ceiling', biplane: false, detA: [30, 38], sid: [.895, 1.195], display: 58, flexarm: false, table: { len: 3.19, w: .5 }, kw: '100 (est.)', tube: 'MRC (est.)',
      col: { shell: 0xf4f5f6, shell2: 0xd2d7dc, accent: 0x3a7bd5, dark: 0x262b31, base: 0x8a929a },
      ref: 'Philips Azurion 7 M20: ceiling-mounted monoplane, 20" (30 × 38 cm) flat detector, SID 89.5–119.5 cm, table 74–102 cm high, 319 cm top; FlexVision XL.',
      src: ['https://www.philips.co.ke/healthcare/product/HCNCVD005', 'https://www.philips.co.il/healthcare/product/HCNCVD207']
    },
    'philips-allura-xper-fd10': {
      mount: 'ceiling', biplane: false, detA: [25, 25], sid: [.9, 1.2], display: 0, monitors: 4, table: { len: 2.9, w: .5 }, kw: '100 (est.)', tube: 'MRC GS 0508',
      col: { shell: 0xeef0f1, shell2: 0xcfd4d9, accent: 0x5a8fc8, dark: 0x2a2f36, base: 0x8a929a },
      ref: 'Philips Allura Xper FD10: ceiling-mounted cardiac C-arm, 10" (25 cm) flat detector, MRC GS 0508 tube, AD5/AD7 table, monitor ceiling suspension with 4 LCDs.',
      src: ['https://www.blockimaging.com/philips-allura-fd10-vs.-allura-fd20-cath/angio-comparison']
    },
    'ge-innova-igs-5': {
      mount: 'floor', biplane: false, detA: [31, 31], sid: [.9, 1.2], display: 56, table: { len: 3.0, w: .5 }, kw: '100', tube: 'Performix 160A',
      col: { shell: 0xf1f2f3, shell2: 0xc9cfd6, accent: 0x6e5a9e, dark: 0x2a2e35, base: 0x7c848d },
      ref: 'GE Innova IGS 5 (IGS 530 shown): floor-mounted pivoting L-arm gantry, 31 × 31 cm square flat panel, 100 kW generator, Omega table.',
      src: ['https://www.blockimaging.com/equipment/interventional-radiology/ge-innova-igs-530-016545', 'https://www.manualslib.com/manual/3337068/Ge-Innova-Igs-520.html']
    },

    /* ---------------- Ultrasound ---------------- */
    'canon-xario-100': {
      form: 'cart', H: [1.35, 1.6], W: .48, D: .80, kg: '≈70 (est.)', mon: 19, touch: 10.4, ports: 3, kb: 'pull', panel: 'flat', handle: 'front', column: 'slim',
      col: { body: 0xf2f2f0, panel: 0xdcdde0, trim: 0x8b8f96, accent: 0x6d5ba8, keys: 0x3c4048 },
      ref: 'Canon (Toshiba) Xario 100: compact cart, 19" LCD, small touch panel, light grey with violet accent (est.).',
      src: ['https://cdn.shopify.com/s/files/1/0641/2402/7133/files/Xario_100MX.pdf']
    },
    'canon-xario-200': {
      form: 'cart', H: [1.35, 1.65], W: .50, D: .85, kg: '≈75', mon: 19, touch: 10.4, ports: 4, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf3f3f1, panel: 0xd9dadd, trim: 0x8b8f96, accent: 0x6d5ba8, keys: 0x3c4048 },
      ref: 'Canon (Toshiba) Xario 200: compact cart, 19" monitor on a free-moving arm, ~10.4" touch panel, ~75 kg.',
      src: ['https://healthmanagement.org/pdf/article/medica-2013-toshiba-ultrasound-introduces-new-xariotm']
    },
    'canon-aplio-300': {
      form: 'cart', H: [1.32, 1.62], W: .52, D: .94, kg: '≈110 (est.)', mon: 19, touch: 10.4, ports: 4, kb: 'pull', panel: 'curved', handle: 'wrap', column: 'wide',
      col: { body: 0xeceeef, panel: 0xc8ccd1, trim: 0x7d838b, accent: 0x5b6fb0, keys: 0x34383f },
      ref: 'Canon (Toshiba) Aplio 300: full-size cart, 19" monitor, 10.4" touch panel, 4 probe ports (est. from Aplio family).',
      src: []
    },
    'ge-logiq-s8': {
      form: 'cart', H: [1.15, 1.72], W: .62, D: .88, kg: '≈85', mon: 22, touch: 10.1, ports: 4, kb: 'pull', panel: 'curved', handle: 'wrap', column: 'slim',
      col: { body: 0xf1f2f3, panel: 0xe4e6e9, trim: 0x9aa2ab, accent: 0x6a7f9a, keys: 0x2f343b },
      ref: 'GE LOGIQ S8 XDclear: mid-size cart, 22" OLED (23" LCD option) on articulating arm, ~10" touch screen, 4 active + 1 parking port.',
      src: ['https://www.somatechnology.com/ultrasounds/ge-logiq-s8-xdclear/']
    },
    'siemens-acuson-juniper': {
      form: 'cart', H: [1.225, 1.634], W: .508, D: .654, kg: '≈76', mon: 21.5, touch: 12.1, ports: 4, kb: 'pull', panel: 'curved', handle: 'wrap', column: 'slim',
      col: { body: 0xf4f4f4, panel: 0xdfe2e5, trim: 0x8c949c, accent: 0xec6602, keys: 0x30353b },
      ref: 'Siemens ACUSON Juniper: compact cart 50.8 × 65.4 cm, 122.5–163.4 cm, ~76 kg; slim column, wrap-around handle, battery option.',
      src: ['https://www.siemens-healthineers.com/en-th/ultrasound/general-imaging/acuson-juniper', 'https://remma.fr/en/model/echograph-acuson-juniper']
    },
    'siemens-acuson-sc2000': {
      form: 'cart', H: [1.45, 1.83], W: .64, D: 1.09, kg: '136', mon: 21.5, touch: 15, ports: 3, pencil: true, kb: 'pull', panel: 'wing', handle: 'front', column: 'wide',
      col: { body: 0xe6e8ea, panel: 0x2f3338, trim: 0xa8afb7, accent: 0xec6602, keys: 0x1e2226 },
      ref: 'Siemens ACUSON SC2000: large cardiology cart (~136 kg), 21.5" 16:9 monitor, wide dark control panel, 3 universal ports + pencil.',
      src: ['https://www.siemens-healthineers.com/en-us/ultrasound/cardiovascular/acuson-sc2000-ultrasound-system']
    },
    'samsung-v7': {
      form: 'cart', H: [1.3, 1.7], W: .55, D: .80, kg: '≈80 (est.)', mon: 21.5, touch: 14, ports: 4, pencil: true, kb: 'pull', panel: 'wing', handle: 'front', column: 'slim',
      col: { body: 0xf5f5f5, panel: 0x3a3f46, trim: 0xb5bbc2, accent: 0x1c75bc, keys: 0x24282d },
      ref: 'Samsung V7: cart with 21.5" HD monitor and a large 14" tilting touch screen, dark control panel.',
      src: ['https://usa.samsunghealthcare.com/ultrasound/general-imaging/v7']
    },
    'fujifilm-arietta-65': {
      form: 'cart', H: [1.317, 1.567], W: .531, D: .767, kg: '≈64–75', mon: 21.5, touch: 12.1, ports: 4, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf2f3f4, panel: 0xe1e3e6, trim: 0x8f979f, accent: 0x2a8a73, keys: 0x2c3036 },
      ref: 'Fujifilm ARIETTA 65: cart with 21.5" widescreen on 360° swivel arm, angled tablet-style touch screen, height-adjustable console.',
      src: ['https://www.healthcare-eu.fujifilm.com/solutions/cardiology-cardiovascular/ultrasound/ultrasound-systems/arietta-series/arietta-65']
    },
    'mindray-dc-80': {
      form: 'cart', H: [1.355, 1.80], W: .58, D: .92, kg: '≈120', mon: 21.5, touch: 13.3, ports: 4, pencil: true, kb: 'pull', panel: 'wing', handle: 'front', column: 'wide',
      col: { body: 0xf3f3f3, panel: 0xd5d8dc, trim: 0x6d747c, accent: 0x0e6bb3, keys: 0x26292e },
      ref: 'Mindray DC-80: full cart 58 × 92 cm, 135.5–180 cm, ~120 kg; 21.5" monitor, 13.3" touch screen, wide front handle.',
      src: ['https://www.manualslib.com/manual/1804764/Mindray-Dc-80.html']
    },
    'sonoscape-p40': {
      form: 'cart', H: [1.3, 1.65], W: .56, D: .86, kg: '≈70 (est.)', mon: 21.5, touch: 13.3, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'wrap', column: 'slim',
      col: { body: 0xf5f6f7, panel: 0xe0e3e7, trim: 0x8e979f, accent: 0x1aa5c8, keys: 0x2b3036 },
      ref: 'SonoScape P40: trolley colour Doppler, 21.5" monitor, 13.3" touch screen, 4 + 1 ports (est. from P-series).',
      src: []
    },
    'sonoscape-p25': {
      form: 'cart', H: [1.3, 1.6], W: .52, D: .80, kg: '≈60 (est.)', mon: 21.5, touch: 13.3, ports: 4, kb: 'pull', panel: 'flat', handle: 'front', column: 'slim',
      col: { body: 0xf5f6f7, panel: 0xe3e6ea, trim: 0x8e979f, accent: 0x1aa5c8, keys: 0x2b3036 },
      ref: 'SonoScape P25: entry trolley system of the P-series (est.: 21.5" monitor, 13.3" touch, 4 ports).',
      src: ['https://remma.fr/en/model/ultrasound-system-p50-elite']
    },
    'sonoscape-s8-exp': {
      form: 'laptop', H: [1.2, 1.35], W: .41, D: .36, kg: '7.9 (system)', mon: 15, touch: 0, ports: 2, kb: 'panel', panel: 'flat', handle: 'rear', column: 'slim',
      col: { body: 0xe9ebee, panel: 0x3a3f46, trim: 0x9aa1a9, accent: 0x1aa5c8, keys: 0x1f2328 },
      ref: 'SonoScape S8 Exp: laptop-portable (41 × 36 × 39 cm, 7.9 kg), 15" LCD tilting 45°, shown on the optional trolley.',
      src: ['https://www.somatechnology.com/pdfFiles/SonoScape-S8-EXP.pdf']
    },
    'sonoscape-s12': {
      form: 'laptop', H: [1.2, 1.35], W: .40, D: .36, kg: '≈7 (est.)', mon: 15, touch: 0, ports: 2, kb: 'panel', panel: 'flat', handle: 'rear', column: 'slim',
      col: { body: 0xeef0f2, panel: 0x464b52, trim: 0x9aa1a9, accent: 0x1aa5c8, keys: 0x1f2328 },
      ref: 'SonoScape S12: notebook-style portable colour Doppler (est.: 15" LCD, 2 ports) on optional trolley.',
      src: []
    },
    'sonoscape-s50-elite': {
      form: 'cart', H: [1.32, 1.70], W: .64, D: 1.0, kg: '≈120', mon: 21.5, touch: 13.3, ports: 4, pencil: true, kb: 'pull', panel: 'wing', handle: 'wrap', column: 'wide',
      col: { body: 0xf4f5f6, panel: 0xdfe3e7, trim: 0x7f8891, accent: 0x1aa5c8, keys: 0x2b3036 },
      ref: 'SonoScape S50 Elite: full high-end cart (64 × 100 × 142 cm, ~120 kg), 21.5" monitor, 13.3" touch, 4 + pencil ports (est.).',
      src: ['https://www.praiston.pl/en/catalog/view/14222/sonoscape-s50-ultrasound-scanner']
    },
    'philips-epiq-5': {
      form: 'cart', H: [1.46, 1.715], W: .606, D: 1.092, kg: '104', mon: 21.5, touch: 12, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf4f5f6, panel: 0xe7e9ec, trim: 0x8a929b, accent: 0x2b6cb0, keys: 0x2d3238 },
      ref: 'Philips EPIQ 5: 60.6 × 109.2 cm, 146–171.5 cm, 104 kg; 21.5" monitor on articulating arm (180°), 12" touch screen, 25 cm panel travel.',
      src: ['https://www.usa.philips.com/healthcare/product/HC795231', 'https://www.somatechnology.com/pdfFiles/Philips-EPIQ-5.pdf']
    },
    'philips-epiq-7': {
      form: 'cart', H: [1.46, 1.715], W: .606, D: 1.092, kg: '104', mon: 21.5, touch: 12, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf4f5f6, panel: 0xe7e9ec, trim: 0x8a929b, accent: 0x2b6cb0, keys: 0x2d3238 },
      ref: 'Philips EPIQ 7: premium cart (same chassis as EPIQ 5), 21.5" monitor, 12" touch screen, 4 active + pencil ports.',
      src: ['https://acc.philips.com.tr/healthcare/product/HC795200R/-']
    },
    'philips-epiq-cvx': {
      form: 'cart', H: [1.46, 1.715], W: .606, D: 1.092, kg: '104', mon: 21.6, touch: 12, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf4f5f6, panel: 0xe7e9ec, trim: 0x8a929b, accent: 0xc0392b, keys: 0x2d3238 },
      ref: 'Philips EPIQ CVx: cardiovascular EPIQ chassis, 54.9 cm monitor, ECG input, 4 + pencil ports.',
      src: ['https://www.usa.philips.com/healthcare/product/HC795231']
    },
    'philips-affiniti-50g': {
      form: 'cart', H: [1.422, 1.626], W: .572, D: .983, kg: '83.6', mon: 21.5, touch: 12, ports: 4, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf4f5f6, panel: 0xe3e6e9, trim: 0x8a929b, accent: 0x2b6cb0, keys: 0x2d3238 },
      ref: 'Philips Affiniti 50G: 57.2 × 98.3 cm, 142.2–162.6 cm, 83.6 kg; 21.5" monitor (180°), ~12" touch screen, 4 ports.',
      src: ['https://www.usa.philips.com/healthcare/product/HC795208']
    },
    'philips-affiniti-70g': {
      form: 'cart', H: [1.422, 1.626], W: .572, D: .983, kg: '83.6', mon: 21.5, touch: 12, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf4f5f6, panel: 0xe3e6e9, trim: 0x8a929b, accent: 0x2b6cb0, keys: 0x2d3238 },
      ref: 'Philips Affiniti 70G: Affiniti chassis (57.2 × 98.3 cm, 83.6 kg), 21.5" monitor, 12" touch, 4 + pencil ports; 2D/3D configurations.',
      src: ['https://www.somatechnology.com/pdfFiles/Philips-Affiniti-70.pdf']
    },
    'philips-cx50': {
      form: 'laptop', H: [1.15, 1.3], W: .41, D: .36, kg: '≈7 (system)', mon: 15, touch: 0, ports: 1, kb: 'panel', panel: 'flat', handle: 'rear', column: 'slim',
      col: { body: 0xc9ced4, panel: 0x50565e, trim: 0x8a929b, accent: 0x2b6cb0, keys: 0x1f2328 },
      ref: 'Philips CX50: compact clamshell (~7 kg) with 15" LCD, integrated handle, single transducer port; shown docked on its mobile cart.',
      src: ['https://cdn.shopify.com/s/files/1/0641/2402/7133/files/Philips_CX50.pdf']
    },
    'ge-vivid-s60': {
      form: 'cart', H: [1.38, 1.68], W: .54, D: .76, kg: '≈73', mon: 19, touch: 12, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf1f2f3, panel: 0x3b4048, trim: 0xb6bcc3, accent: 0x5a6f8c, keys: 0x1e2226 },
      ref: 'GE Vivid S60: compact cardiac cart 54 × 76 cm, 138–168 cm, ~73 kg; 19" LED monitor, 12" touch, ECG input.',
      src: ['https://www.somatechnology.com/pdfFiles/GE-Vivid-S60-Ultrasound.pdf']
    },
    'ge-vivid-s70': {
      form: 'cart', H: [1.38, 1.68], W: .54, D: .76, kg: '≈75', mon: 21.5, touch: 12, ports: 4, pencil: true, kb: 'pull', panel: 'curved', handle: 'front', column: 'slim',
      col: { body: 0xf1f2f3, panel: 0x3b4048, trim: 0xb6bcc3, accent: 0x5a6f8c, keys: 0x1e2226 },
      ref: 'GE Vivid S70: Vivid S-series cart (S60 chassis), larger monitor, 12" touch, 4 + pencil ports.',
      src: ['https://www.somatechnology.com/pdfFiles/GE-Vivid-S70-Ultrasound.pdf']
    },
    'ge-vivid-e95': {
      form: 'cart', H: [1.23, 1.67], W: .544, D: .844, kg: '≈126', mon: 22, touch: 12, ports: 5, kb: 'pull', panel: 'curved', handle: 'wrap', column: 'wide',
      col: { body: 0xf2f3f4, panel: 0x30353c, trim: 0xb0b7bf, accent: 0x5a6f8c, keys: 0x1b1e22 },
      ref: 'GE Vivid E95: premium cardiac cart 54.4 × 84.4 cm, 123–167 cm, ~126 kg; 22" OLED, 12" multi-touch, 5 active ports.',
      src: ['https://somatechnology.com/app/uploads/2024/12/GE-Vivid-E95-Specifications.pdf']
    }
  };
  window.BME = window.BME || {};
  BME.fleetLooks = L;
})();

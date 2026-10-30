/* Content pack: Magnetic Resonance Imaging (generic superconducting MRI system).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'mri',
  summary: 'An MRI system places the patient in a strong static magnetic field, excites hydrogen nuclei with radio-frequency pulses and spatially encodes the returning signal with switched gradient fields. The magnet is always on. Service work is dominated by magnetic-field safety, cryogen safety, RF and gradient performance, and image-quality physics.',
  hazards: [{ label: 'STRONG MAGNETIC FIELD — PROJECTILE RISK', type: 'mag' }, { label: 'CRYOGEN / QUENCH', type: 'chem' }],
  principle: [
    'A superconducting magnet, cooled by liquid helium, creates a strong, stable, homogeneous static field (B₀).',
    'Hydrogen nuclei align with B₀ and precess at the Larmor frequency, proportional to field strength.',
    'RF pulses from the RF amplifier and coil tip the magnetisation; the coil then receives the decaying MR signal.',
    'Gradient coils vary the field in x, y and z to encode position in frequency and phase.',
    'Shimming improves field homogeneity; the cold head and compressor keep the helium cold.',
    'The reconstruction computer converts k-space data into images (Fourier transform) and sends them to PACS.'
  ],
  parameters: [
    { name: 'Static field strength (B₀)', unit: 'T', typical: 'Fixed by magnet design', note: 'Magnet is always on' },
    { name: 'Centre frequency', unit: 'MHz', typical: 'Set by B₀', note: 'Drift trend indicates field change' },
    { name: 'Helium level', unit: '%', typical: 'Displayed by magnet monitor', note: 'Trend daily; falling level needs action' },
    { name: 'Helium vessel pressure', unit: 'kPa / psi', typical: 'Per manufacturer spec', note: 'Model-specific procedure required' },
    { name: 'SNR', unit: '—', typical: 'Phantom baseline', note: 'Compared to coil baseline' },
    { name: 'SAR', unit: 'W/kg', typical: 'Calculated per sequence', note: 'RF heating limit managed by system' },
    { name: 'Chilled water temperature / flow', unit: '°C, L/min', typical: 'Per site specification', note: 'Affects gradients, RF and compressor' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 20, y: 30, w: 560, h: 330, label: 'MAGNETIC FIELD / PROJECTILE RISK', type: 'mag' },
      { x: 600, y: 30, w: 380, h: 160, label: 'CRYOGEN', type: 'chem' }
    ],
    nodes: [
      { id: 'shim', x: 40, y: 70, w: 150, h: 54, label: 'Shim system' },
      { id: 'magnet', x: 220, y: 70, w: 150, h: 54, label: 'Superconducting magnet' },
      { id: 'gradient', x: 40, y: 180, w: 150, h: 54, label: 'Gradient coil' },
      { id: 'rfCoil', x: 220, y: 180, w: 150, h: 54, label: 'RF coil' },
      { id: 'table', x: 400, y: 180, w: 150, h: 54, label: 'Patient table' },
      { id: 'cryo', x: 620, y: 70, w: 150, h: 54, label: 'Cryogen / cold head' },
      { id: 'magMonitor', x: 800, y: 70, w: 160, h: 54, label: 'Magnet monitor' },
      { id: 'rfAmp', x: 620, y: 270, w: 150, h: 54, label: 'RF amplifier' },
      { id: 'chiller', x: 800, y: 270, w: 150, h: 54, label: 'Chiller' },
      { id: 'recon', x: 400, y: 430, w: 150, h: 54, label: 'Reconstruction computer' },
      { id: 'console', x: 620, y: 430, w: 150, h: 54, label: 'Operator console' },
      { id: 'pacs', x: 800, y: 430, w: 150, h: 54, label: 'PACS / DICOM' }
    ],
    links: [
      ['cryo', 'magnet', 'cooling'], ['magMonitor', 'cryo', 'He level / pressure'], ['chiller', 'cryo', 'water'],
      ['chiller', 'rfAmp', 'water'], ['shim', 'magnet', 'homogeneity'], ['magnet', 'rfCoil', 'B₀'],
      ['gradient', 'rfCoil', 'spatial encoding'], ['rfAmp', 'rfCoil', 'RF pulses'], ['table', 'rfCoil', 'patient'],
      ['rfCoil', 'recon', 'MR signal'], ['recon', 'console', 'images'], ['console', 'pacs', 'DICOM'],
      ['console', 'rfAmp', 'sequence'], ['console', 'gradient', 'gradient waveforms']
    ]
  },
  components: {
    magnet: {
      name: 'Superconducting magnet', function: 'Produces the strong, stable, homogeneous static field B₀.',
      principle: 'Niobium-titanium windings in liquid helium carry persistent current with zero resistance; the field remains on without external power.',
      input: 'Persistent current (set at ramp-up), cryogenic cooling', output: 'Static magnetic field B₀',
      normal: 'Stable centre frequency; homogeneity within specification; no quench.',
      failure: 'Quench (loss of superconductivity), field drift, homogeneity degradation from ferrous objects.',
      symptoms: 'Loss of field after quench, frequency drift, poor fat suppression or distortion.',
      test: 'Trend centre frequency; measure homogeneity with phantom; review magnet monitor data.',
      service: 'Ramping, quench recovery and field work are specialist, model-specific procedures.',
      safety: 'The field is always on. Screen every person and object; ferrous items become projectiles.',
      spares: [], pm: ['Centre frequency trend'], qa: ['Centre frequency', 'Geometric distortion']
    },
    gradient: {
      name: 'Gradient coil', function: 'Creates linear field variations in x, y and z to encode spatial position.',
      principle: 'High-current switched waveforms from gradient amplifiers drive coils in the bore; field changes encode frequency and phase.',
      input: 'Gradient waveforms (high current)', output: 'Spatially varying field',
      normal: 'Accurate linear gradients; normal acoustic noise; temperatures stable.',
      failure: 'Amplifier fault, coil overheating, loose mounting, cooling fault.',
      symptoms: 'Geometric distortion, ghosting, spikes, gradient error, unusual noise.',
      test: 'Geometric accuracy with phantom; review gradient error log and temperature.',
      service: 'Check cooling and connections; amplifier or coil work is model-specific.',
      safety: 'High currents and acoustic noise — hearing protection for patients and staff in room.',
      spares: ['Gradient amplifier module'], pm: ['Gradient and RF log review'], qa: ['Geometric distortion', 'Ghosting ratio']
    },
    rfCoil: {
      name: 'RF coil', function: 'Transmits RF excitation and receives the MR signal.',
      principle: 'Body coil transmits; local receive arrays close to anatomy improve SNR; coils are tuned to the Larmor frequency.',
      input: 'RF pulses, MR signal from patient', output: 'Received MR signal',
      normal: 'Each coil element passes check; SNR within baseline.',
      failure: 'Broken element, cable damage, connector damage, detuning fault.',
      symptoms: 'Low SNR, signal drop-out in one region, coil not recognised.',
      test: 'Coil element check in service software; SNR test with phantom.',
      service: 'Inspect cables and connectors; repair or replacement is model-specific.',
      safety: 'Damaged coil cables can cause RF burns — remove from use immediately.',
      spares: ['Local receive coil'], pm: ['Coil inspection'], qa: ['SNR', 'Image uniformity']
    },
    rfAmp: {
      name: 'RF amplifier', function: 'Amplifies the RF pulses that excite the nuclei.',
      principle: 'Solid-state power amplifier at the Larmor frequency, with forward/reflected power monitoring and SAR supervision.',
      input: 'Low-level RF from spectrometer', output: 'High-power RF pulses to coil',
      normal: 'Forward power as commanded; low reflected power; no faults.',
      failure: 'Output stage failure, cooling fault, high reflected power from coil or cable.',
      symptoms: 'RF errors, scans abort, low signal, SAR errors.',
      test: 'Review forward/reflected power logs; check cooling flow.',
      service: 'Model-specific procedure required.',
      safety: 'High RF power — do not open while energised.',
      spares: ['RF amplifier module'], pm: ['Gradient and RF log review'], qa: ['SNR']
    },
    shim: {
      name: 'Shim system', function: 'Improves static field homogeneity.',
      principle: 'Passive iron shims set at installation; active shim coils correct residual and patient-induced inhomogeneity.',
      input: 'Field map, shim currents', output: 'Homogeneous field',
      normal: 'Shim converges; narrow spectral line width.',
      failure: 'Shim supply fault, ferrous contamination in bore, environment change.',
      symptoms: 'Poor fat saturation, distortion, shim errors.',
      test: 'Measure homogeneity with spherical phantom; check bore for ferrous debris.',
      service: 'Passive shimming is specialist work; active shim supply repair is model-specific.',
      safety: 'Never place tools in the bore; ferrous debris affects homogeneity and is a projectile.',
      spares: ['Shim power supply'], pm: [], qa: ['Geometric distortion']
    },
    cryo: {
      name: 'Cryogen system / cold head / compressor', function: 'Keeps the magnet at superconducting temperature and minimises helium boil-off.',
      principle: 'A helium compressor drives a cold head that recondenses helium gas; a quench pipe vents gas safely outside.',
      input: 'Electrical power, chilled water', output: 'Cold helium vessel',
      normal: 'Cold head running; helium level stable; vessel pressure normal; compressor pressures in range.',
      failure: 'Compressor fault, cold head wear, adsorber end of life, chilled water loss, quench pipe blockage.',
      symptoms: 'Falling helium level, rising pressure, cold head stopped alarm.',
      test: 'Review magnet monitor trends; check compressor pressures and water supply; listen for cold head cycling.',
      service: 'Adsorber and cold head replacement and helium fills are model-specific specialist work.',
      safety: 'Cryogens cause cold burns and asphyxiation. Quench pipe must remain clear and intact.',
      spares: ['Compressor adsorber', 'Cold head'], pm: ['Helium level and pressure', 'Compressor check'], qa: []
    },
    table: {
      name: 'Patient table', function: 'Positions the patient in the bore and carries coil connections.',
      principle: 'Motorised drive with position sensors; non-magnetic construction inside the room.',
      input: 'Position commands, patient load', output: 'Patient positioned at isocentre',
      normal: 'Smooth motion; coil sockets recognised; emergency stop works.',
      failure: 'Drive fault, socket damage, sensor fault.',
      symptoms: 'Table will not move, coil not detected, position error.',
      test: 'Motion test and coil detection check; emergency release test.',
      service: 'Inspect sockets and drive; repair per service manual.',
      safety: 'Only MR-safe tools in the room; pinch points.',
      spares: ['Coil socket', 'Drive motor'], pm: ['Table and emergency release'], qa: []
    },
    magMonitor: {
      name: 'Magnet monitor', function: 'Monitors helium level, pressure, cold head status and alarms.',
      principle: 'Sensors on the cryostat report to a monitoring unit with local alarms and often remote reporting.',
      input: 'Cryostat sensors', output: 'Status display, alarms',
      normal: 'All values displayed; no active alarms.',
      failure: 'Sensor fault, communication loss, power loss to monitor.',
      symptoms: 'Missing data, false alarms, no remote reporting.',
      test: 'Compare readings with trend history; confirm alarm reaches the responsible staff.',
      service: 'Model-specific procedure required.',
      safety: 'An unmonitored magnet may lose helium unnoticed — treat monitor failure as urgent.',
      spares: [], pm: ['Helium level and pressure'], qa: []
    },
    chiller: {
      name: 'Chiller', function: 'Supplies cooling water to the compressor, gradients and RF electronics.',
      principle: 'Closed-loop water circuit with heat exchanger and pump.',
      input: 'Electrical power, facility water', output: 'Chilled water at set temperature and flow',
      normal: 'Temperature and flow within site specification.',
      failure: 'Pump failure, low flow, refrigerant fault, blocked strainer.',
      symptoms: 'Compressor stops, gradient or RF over-temperature errors.',
      test: 'Measure supply temperature and flow; inspect strainers.',
      service: 'Clean strainers; refrigeration work by qualified staff.',
      safety: 'Loss of chilled water can stop the cold head — escalate promptly.',
      spares: ['Strainer', 'Pump'], pm: ['Chiller temperature and flow'], qa: []
    },
    console: {
      name: 'Operator console', function: 'Protocol selection, scan control and image review.',
      principle: 'Workstation running the scanner application and sending sequences to the spectrometer.',
      input: 'User commands, images', output: 'Scan commands, displayed images',
      normal: 'Application starts cleanly; patient intercom and emergency call work.',
      failure: 'Software fault, communication loss.',
      symptoms: 'Freezes, cannot start scan.',
      test: 'Check logs and subsystem status.',
      service: 'Restart per procedure; software restore is model-specific.',
      safety: 'Patient communication and emergency stop must be functional before scanning.',
      spares: ['Workstation', 'Monitor'], pm: ['Table and emergency release'], qa: []
    },
    recon: {
      name: 'Reconstruction computer', function: 'Converts raw k-space data into images.',
      principle: 'Fourier transform and parallel-imaging reconstruction with coil sensitivity correction.',
      input: 'Raw MR data', output: 'Images',
      normal: 'Reconstruction completes promptly.',
      failure: 'Disk, memory or software fault.',
      symptoms: 'Slow or failed reconstruction.',
      test: 'Review logs and disk space.',
      service: 'Model-specific procedure required.',
      safety: 'Back up configuration before changes.',
      spares: ['Hard disk'], pm: ['Gradient and RF log review'], qa: []
    },
    pacs: {
      name: 'PACS / DICOM', function: 'Stores and distributes images.',
      principle: 'DICOM storage and worklist services over the hospital network.',
      input: 'DICOM images', output: 'Archived images',
      normal: 'Images arrive complete.',
      failure: 'Network or configuration fault.',
      symptoms: 'Send failures, empty worklist.',
      test: 'C-ECHO, configuration check, send queue review.',
      service: 'Correct configuration with IT.',
      safety: 'Patient data privacy.',
      spares: [], pm: ['DICOM connectivity check'], qa: []
    }
  },
  workflow: [
    { title: 'Screening and zone access', active: ['table', 'console'], what: 'Patient and staff are screened; patient is positioned with appropriate coil.', signal: 'Coil detection', parameter: 'Screening checklist', fail: 'Unscreened ferrous object — projectile risk.' },
    { title: 'Static field', active: ['magnet', 'cryo'], what: 'The superconducting magnet provides B₀; cryogenics keep it cold.', signal: 'Helium level / pressure', parameter: 'B₀, He level', fail: 'Cold head stopped, quench.' },
    { title: 'Magnet monitoring', active: ['magMonitor', 'cryo', 'chiller'], what: 'Monitor tracks helium, pressure, cold head and chilled water.', signal: 'Monitor alarms', parameter: 'He level, pressure, water temperature', fail: 'Chiller loss stops compressor.' },
    { title: 'Prescan and shimming', active: ['shim', 'magnet'], what: 'System finds centre frequency, adjusts shim and RF power.', signal: 'Field map', parameter: 'Centre frequency, line width', fail: 'Shim failure, ferrous debris.' },
    { title: 'RF excitation', active: ['rfAmp', 'rfCoil'], what: 'RF pulses tip magnetisation away from B₀.', signal: 'Forward / reflected RF power', parameter: 'Flip angle, SAR', fail: 'High reflected power, amplifier fault.' },
    { title: 'Spatial encoding', active: ['gradient', 'console'], what: 'Gradient waveforms encode slice, frequency and phase.', signal: 'Gradient current', parameter: 'Gradient amplitude, slew', fail: 'Gradient error, distortion.' },
    { title: 'Signal reception', active: ['rfCoil', 'recon'], what: 'Receive coil detects the MR echo; signal is digitised.', signal: 'MR echo', parameter: 'SNR', fail: 'Broken coil element, RF interference.' },
    { title: 'Reconstruction', active: ['recon'], what: 'k-space data are Fourier transformed into images.', signal: 'Raw to image', parameter: 'Image quality', fail: 'Disk or software fault.' },
    { title: 'Review and archive', active: ['console', 'pacs'], what: 'Images reviewed and sent to PACS.', signal: 'DICOM association', parameter: 'Transfer status', fail: 'Network or configuration error.' }
  ],
  operation: [
    { step: 'Daily checks', detail: 'Record helium level and pressure, check cold head running, chiller status and room conditions.' },
    { step: 'Daily QA', detail: 'Scan the QA phantom and review SNR, uniformity and centre frequency.' },
    { step: 'Screen patient and staff', detail: 'Complete the safety questionnaire; remove ferrous objects; check implant status per local policy.' },
    { step: 'Position and coil', detail: 'Select coil, position patient, provide hearing protection and emergency call.' },
    { step: 'Scan', detail: 'Run localiser, prescan and sequences; monitor SAR and patient comfort.' },
    { step: 'Archive and report faults', detail: 'Send to PACS; record any errors and magnet monitor alarms in the work-order system.' }
  ],
  pm: {
    daily: [
      { task: 'Helium level and pressure', why: 'Early detection of cryogen problems prevents quench.', tools: 'Magnet monitor', safety: 'Zone access rules apply', procedure: 'Read and record helium level, pressure and cold head status.', criteria: 'Stable trend; no alarms.' },
      { task: 'Daily phantom QA', why: 'Detects coil and system drift.', tools: 'MRI phantom', safety: 'Only MR-safe items in room', procedure: 'Scan phantom with QA protocol; review results.', criteria: 'Within hospital-configured limits.' }
    ],
    weekly: [
      { task: 'Coil inspection', why: 'Damaged cables cause burns and poor images.', tools: 'Visual', safety: 'Remove damaged coils from use', procedure: 'Inspect coil housings, cables and connectors.', criteria: 'No cracks, exposed conductors or bent pins.' },
      { task: 'Table and emergency release', why: 'Patient must be removable quickly in an emergency.', tools: 'Visual', safety: 'Test without patient', procedure: 'Test table motion, emergency stop and manual release.', criteria: 'All functions operate.' }
    ],
    monthly: [
      { task: 'Chiller temperature and flow', why: 'Cooling loss stops the compressor and gradients.', tools: 'Thermometer, flow indicator', safety: 'Water near electrical equipment', procedure: 'Check supply temperature, flow, strainers.', criteria: 'Within site specification.' },
      { task: 'Centre frequency trend', why: 'Drift indicates field changes.', tools: 'Service software', safety: '—', procedure: 'Review frequency log.', criteria: 'No unexplained trend.' }
    ],
    quarterly: [
      { task: 'Compressor check', why: 'Compressor faults stop recondensing.', tools: 'Pressure gauges on compressor', safety: 'High-pressure helium lines', procedure: 'Record supply/return pressures; check adsorber hours.', criteria: 'Within manufacturer spec; adsorber within life.' },
      { task: 'DICOM connectivity check', why: 'Lost images delay diagnosis.', tools: 'DICOM tools', safety: 'Data privacy', procedure: 'C-ECHO and test transfer.', criteria: 'Successful transfer.' }
    ],
    halfyearly: [
      { task: 'Gradient and RF log review', why: 'Trends reveal developing faults.', tools: 'Service software', safety: '—', procedure: 'Review gradient, RF power and reconstruction logs.', criteria: 'No recurring errors.' }
    ],
    annual: [
      { task: 'Full image-quality QA', why: 'Verifies diagnostic performance.', tools: 'MRI phantom', safety: 'MR-safe phantom and tools only', procedure: 'Run all QA tests in the QA tab.', criteria: 'Within configured limits.' },
      { task: 'Quench pipe and oxygen monitor inspection', why: 'Ensures helium vents safely and asphyxiation risk is detected.', tools: 'Visual, O₂ monitor test gas', safety: 'Coordinate with facilities', procedure: 'Inspect quench pipe route and outlet; test room O₂ monitor alarm.', criteria: 'Pipe clear and intact; alarm functions.' },
      { task: 'Electrical safety', why: 'Protects patient and staff.', tools: 'Electrical safety analyzer', safety: 'Only MR-safe equipment in the magnet room', procedure: 'Test accessible equipment outside the magnet room per protocol.', criteria: 'Per hospital protocol based on applicable standard.' }
    ]
  },
  qa: [
    { id: 'snr', test: 'Signal-to-noise ratio (SNR)', setup: 'Standard phantom; fixed coil and protocol.', measure: 'Mean signal / noise SD', unit: '—', example: 'Measured SNR compared with coil baseline', report: 'Trend against baseline' },
    { id: 'uniformity', test: 'Image uniformity', setup: 'Uniform phantom.', measure: 'Max and min signal in ROI', unit: '%', example: 'Percent integral uniformity compared with baseline', report: 'ROI values' },
    { id: 'geometry', test: 'Geometric distortion', setup: 'Grid phantom.', measure: 'Measured vs known distances', unit: 'mm', example: 'Deviation of measured from known phantom dimensions', report: 'Distance table' },
    { id: 'slice', test: 'Slice thickness', setup: 'Phantom with ramp insert.', measure: 'FWHM of slice profile', unit: 'mm', example: 'Measured vs nominal slice thickness', report: 'Set vs measured' },
    { id: 'ghost', test: 'Ghosting ratio', setup: 'Uniform phantom.', measure: 'Ghost signal vs main signal', unit: '%', example: 'Ghost signal relative to phantom signal', report: 'Ratio' },
    { id: 'freq', test: 'Centre frequency', setup: 'Prescan on phantom.', measure: 'Resonance frequency', unit: 'Hz / MHz', example: 'Change from previous measurement', report: 'Trend' },
    { id: 'coil', test: 'Coil element check', setup: 'Each coil with phantom.', measure: 'Per-element SNR', unit: '—', example: 'Element SNR compared with baseline', report: 'Element table' }
  ],
  troubleshoot: [
    {
      symptom: 'Helium level falling faster than normal',
      causes: [
        { cause: 'Cold head or compressor not running', note: 'Most common; check status first.' },
        { cause: 'Chilled water loss', note: 'Stops compressor.' },
        { cause: 'Adsorber or cold head end of life', note: 'Check service hours.' },
        { cause: 'Monitor sensor fault', note: 'Confirm against trend.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Ramp down the magnet', correct: false, why: 'Drastic and unnecessary without evidence; specialist decision only.' },
          { t: 'Check magnet monitor, cold head status and chiller supply', correct: true, why: 'Quick, non-invasive checks that explain most boil-off increases and give evidence for escalation.' },
          { t: 'Replace the cold head', correct: false, why: 'Parts replacement without diagnosis.' },
          { t: 'Reboot the console', correct: false, why: 'The console does not cool the magnet.' }
        ]
      },
      measure: 'Helium level trend, vessel pressure, compressor pressures, water temperature and flow.',
      decision: 'Water lost → restore and restart compressor. Compressor OK but cold head silent → escalate to specialist.',
      repair: 'Model-specific procedure required for cryogenic repairs; escalate early.',
      verify: 'Helium trend stabilises; pressure normal; document and notify.'
    },
    {
      symptom: 'Low SNR on one coil',
      causes: [
        { cause: 'Coil not correctly connected or selected', note: 'Simple check.' },
        { cause: 'Broken element or cable', note: 'Coil element test.' },
        { cause: 'RF interference (room door / shielding)', note: 'Look for zipper artefacts.' },
        { cause: 'Receiver chain fault', note: 'If all coils affected.' }
      ],
      first: {
        prompt: 'What would you do first?',
        options: [
          { t: 'Check coil connection and compare with another coil on the phantom', correct: true, why: 'Isolates the coil from the system quickly and non-invasively.' },
          { t: 'Replace the RF amplifier', correct: false, why: 'Transmit fault would affect all coils; unproven.' },
          { t: 'Re-shim the magnet', correct: false, why: 'Shim does not explain low SNR in one coil.' },
          { t: 'Reinstall software', correct: false, why: 'No evidence of software fault.' }
        ]
      },
      measure: 'SNR per coil and per element against baseline.',
      decision: 'Only one coil low → element test → inspect cable/connector. All coils low → receiver chain / RF interference.',
      repair: 'Repair or replace the confirmed faulty coil.',
      verify: 'Coil element check and SNR test; document.'
    }
  ],
  errors: [
    { code: 'TRN-M101', desc: 'Cold head stopped', causes: ['Compressor fault', 'Chilled water loss', 'Power loss'], component: 'cryo', checks: ['Compressor status', 'Water flow and temperature', 'Power supply'], service: 'Restore supply; cold head work is model-specific.', verify: 'Cold head running; helium trend stable.', pm: 'Compressor check' },
    { code: 'TRN-M115', desc: 'Helium level low', causes: ['Increased boil-off', 'Cold head fault'], component: 'magMonitor', checks: ['Level trend', 'Cold head status'], service: 'Model-specific procedure required.', verify: 'Level stable after correction.', pm: 'Helium level and pressure' },
    { code: 'TRN-M220', desc: 'Gradient over-temperature', causes: ['Chiller fault', 'Low flow', 'Heavy sequence use'], component: 'gradient', checks: ['Chiller temperature', 'Flow', 'Error log'], service: 'Restore cooling.', verify: 'Scan without errors.', pm: 'Chiller temperature and flow' },
    { code: 'TRN-M330', desc: 'RF reflected power high', causes: ['Damaged coil or cable', 'Connector fault', 'Amplifier fault'], component: 'rfAmp', checks: ['Inspect coil and cable', 'Try another coil', 'Review power log'], service: 'Model-specific procedure required.', verify: 'Normal reflected power; SNR test.', pm: 'Gradient and RF log review' },
    { code: 'TRN-M410', desc: 'Coil not recognised', causes: ['Bent connector pin', 'Socket fault', 'Coil fault'], component: 'rfCoil', checks: ['Inspect pins', 'Try other socket', 'Try another coil'], service: 'Repair socket or coil.', verify: 'Coil element check.', pm: 'Coil inspection' },
    { code: 'TRN-M520', desc: 'Chilled water flow low', causes: ['Blocked strainer', 'Pump failure'], component: 'chiller', checks: ['Strainer', 'Pump operation', 'Flow reading'], service: 'Clean strainer; pump repair by qualified staff.', verify: 'Flow restored; compressor running.', pm: 'Chiller temperature and flow' }
  ],
  safety: [
    { title: 'Projectile risk — magnet always on', level: 'danger', text: 'Ferromagnetic objects are pulled violently into the bore. Only MR-safe or MR-conditional items enter the magnet room. Switching off the power does not remove the field.' },
    { title: 'Quench', level: 'danger', text: 'A quench rapidly boils off helium. Leave the room, keep the door open if possible and follow the emergency procedure. Emergency field shutdown only for life-threatening entrapment.' },
    { title: 'Cryogen asphyxiation and cold burns', level: 'danger', text: 'Helium displaces oxygen. Never handle cryogens without training and PPE; ensure the quench pipe and room O₂ monitor work.' },
    { title: 'Zone access control', level: 'warning', text: 'Follow the site zoning scheme. Only screened, authorised staff enter controlled zones; escort contractors.' },
    { title: 'Implants and devices', level: 'warning', text: 'Pacemakers, neurostimulators and other implants may be MR unsafe. Engineers with implants must be cleared before entering.' },
    { title: 'Release to service', level: 'info', text: 'Return to use only after documented phantom QA following any RF, gradient or coil repair.' }
  ],
  tools: ['mriPhantom', 'esa', 'multimeter', 'oscilloscope', 'dicomTools'],
  cases: ['poorImage', 'overheating', 'dicomFailure', 'commFailure', 'alarmMalfunction', 'sensorFailure'],
  scenarios: ['mriHelium'],
  artifacts: ['mri-motion', 'mri-ghost', 'mri-suscept', 'mri-rf'],
  questions: [
    { q: 'Why is the MRI magnet still dangerous after the console is switched off?', options: ['It is not', 'The superconducting field stays on', 'The battery keeps it on', 'The chiller powers it'], answer: 1, why: 'Persistent current keeps the field on without external power.', domain: 'safety' },
    { q: 'Which component encodes spatial position?', options: ['RF amplifier', 'Gradient coil', 'Chiller', 'PACS'], answer: 1, why: 'Gradients vary the field to encode position.', domain: 'knowledge' },
    { q: 'What does the cold head do?', options: ['Cools the RF amplifier', 'Recondenses helium to limit boil-off', 'Cools the patient', 'Stores images'], answer: 1, why: 'It keeps the helium vessel cold.', domain: 'knowledge' },
    { q: 'Helium level is falling faster than normal. First step?', options: ['Ramp down magnet', 'Check monitor, cold head and chiller', 'Replace cold head', 'Reboot console'], answer: 1, why: 'Non-invasive, evidence-based checks first.', domain: 'troubleshooting' },
    { q: 'Low SNR on one coil only. First step?', options: ['Replace RF amplifier', 'Check connection and compare with another coil', 'Re-shim', 'Reinstall software'], answer: 1, why: 'Isolates the coil from the rest of the system.', domain: 'troubleshooting' },
    { q: 'Main asphyxiation hazard in MRI comes from…', options: ['Gradient noise', 'Helium released during a quench', 'RF heating', 'Table motion'], answer: 1, why: 'Helium displaces oxygen.', domain: 'safety' },
    { q: 'Which test detects geometric distortion?', options: ['Grid phantom measurement', 'Electrical safety test', 'C-ECHO', 'Helium level'], answer: 0, why: 'Known phantom distances are compared with measured ones.', domain: 'technical' },
    { q: 'A damaged coil cable is found. Correct action?', options: ['Tape it and continue', 'Remove from use, label and report', 'Ignore', 'Use only for small patients'], answer: 1, why: 'Damaged cables can cause RF burns.', domain: 'safety' },
    { q: 'After a coil repair, what must be recorded?', options: ['Nothing', 'Coil element check and SNR results with work-order details', 'Only the time', 'Only the part cost'], answer: 1, why: 'Verification evidence must be documented.', domain: 'documentation' }
  ]
});

/* Content pack: Diagnostic Ultrasound System (generic cart-based / portable B-mode scanner).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'ultrasound',
  summary: 'A diagnostic ultrasound system transmits short high-frequency acoustic pulses into tissue through a transducer, receives the returning echoes, and focuses, processes and displays them as real-time images. Image quality depends on every element of the probe and every channel of the transmit/receive chain; the probe is a patient-contact applied part.',
  hazards: [{ label: 'PATIENT-CONTACT (PROBE LEAKAGE)', type: 'patient' }],
  principle: [
    'The transmit circuit applies short high-voltage pulses to piezoelectric elements in the probe.',
    'Elements convert electrical pulses into acoustic pressure waves that travel into tissue.',
    'Tissue boundaries reflect part of the energy; the same elements convert echoes back into small voltages.',
    'The beamformer applies per-channel delays so that transmit and receive are focused and steered.',
    'Processing performs envelope detection, log compression, gain/TGC and scan conversion into an image.',
    'Echo arrival time gives depth (assumed speed of sound in tissue); echo amplitude gives brightness.'
  ],
  parameters: [
    { name: 'Transducer centre frequency', unit: 'MHz', typical: 'Probe dependent', note: 'Higher frequency = better resolution, less penetration' },
    { name: 'Penetration depth', unit: 'cm', typical: 'Measured on phantom', note: 'Trend against baseline for each probe' },
    { name: 'Axial / lateral resolution', unit: 'mm', typical: 'Measured on phantom', note: 'Compare with acceptance baseline' },
    { name: 'Distance measurement accuracy', unit: '%', typical: 'Measured on phantom', note: 'Calliper vs known target spacing' },
    { name: 'Transmit voltage', unit: 'V', typical: 'Per manufacturer spec', note: 'Model-specific procedure required' },
    { name: 'Probe leakage current', unit: 'µA', typical: 'Measured', note: 'Limits from hospital protocol / applicable standard' },
    { name: 'Output indices (MI / TI)', unit: '—', typical: 'Displayed on screen', note: 'Must be displayed and update with settings' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 20, y: 30, w: 360, h: 130, label: 'PATIENT-CONTACT (PROBE)', type: 'patient' },
      { x: 400, y: 20, w: 180, h: 90, label: 'TX HIGH VOLTAGE', type: 'hv' }
    ],
    nodes: [
      { id: 'probe', x: 40, y: 75, w: 140, h: 54, label: 'Probe / transducer' },
      { id: 'piezo', x: 210, y: 75, w: 150, h: 54, label: 'Piezo elements' },
      { id: 'tx', x: 420, y: 45, w: 140, h: 54, label: 'Transmit circuit' },
      { id: 'rx', x: 420, y: 150, w: 140, h: 54, label: 'Receive circuit' },
      { id: 'beamformer', x: 620, y: 95, w: 150, h: 54, label: 'Beamformer' },
      { id: 'processing', x: 820, y: 95, w: 150, h: 54, label: 'Processing board' },
      { id: 'mainPcb', x: 620, y: 280, w: 150, h: 54, label: 'Main PCB / system CPU' },
      { id: 'display', x: 820, y: 280, w: 150, h: 54, label: 'Display / UI' },
      { id: 'psu', x: 40, y: 450, w: 140, h: 54, label: 'Power supply' },
      { id: 'battery', x: 220, y: 450, w: 140, h: 54, label: 'Battery' },
      { id: 'cooling', x: 420, y: 450, w: 140, h: 54, label: 'Cooling / fans' }
    ],
    links: [
      ['mainPcb', 'beamformer', 'control'], ['beamformer', 'tx', 'TX timing'], ['tx', 'piezo', 'HV pulses'],
      ['piezo', 'probe', 'acoustic'], ['piezo', 'rx', 'echo signal'], ['rx', 'beamformer', 'digitised'],
      ['beamformer', 'processing', 'RF lines'], ['processing', 'display', 'image'], ['processing', 'mainPcb'],
      ['mainPcb', 'display'], ['psu', 'battery'], ['battery', 'mainPcb', 'DC'], ['psu', 'tx', 'HV rail'],
      ['cooling', 'mainPcb', 'temp']
    ]
  },
  components: {
    probe: {
      name: 'Probe / transducer assembly', function: 'Couples acoustic energy into and out of the patient and houses the element array.',
      principle: 'Acoustic lens focuses the beam in elevation; matching layers improve energy transfer; backing material shortens pulses; cable carries one coax per channel.',
      input: 'Electrical pulses via cable', output: 'Acoustic beam into patient; echo voltages back to system',
      normal: 'Lens intact, housing sealed, cable undamaged, uniform image with no dropout.',
      failure: 'Cracked or delaminated lens, damaged cable or strain relief, bent connector pins, fluid ingress.',
      symptoms: 'Vertical dark streaks, reduced penetration, intermittent image, leakage test failure.',
      test: 'Visual and tactile inspection of lens, housing and cable; phantom uniformity image; probe leakage test.',
      service: 'Probe repair or replacement is normally specialist work; document findings with images and test results.',
      safety: 'A cracked lens or housing can expose the patient to leakage current and harbour microorganisms — remove from use.',
      spares: ['Replacement probe', 'Connector dust cap'], pm: ['Probe inspection', 'Probe leakage test'], qa: ['Uniformity / element check', 'Probe leakage current']
    },
    piezo: {
      name: 'Piezoelectric element array', function: 'Converts electrical pulses into ultrasound and returning echoes into voltages.',
      principle: 'Piezoelectric ceramic or composite deforms when voltage is applied and generates voltage when deformed (reversible piezoelectric effect).',
      input: 'Transmit pulses / returning echoes', output: 'Acoustic pressure waves / echo voltages',
      normal: 'All elements contribute equally; no vertical dropout in uniformity image.',
      failure: 'Dead or weak elements from impact, cracked ceramic, broken internal interconnect, depolarisation by overheating.',
      symptoms: 'Narrow vertical shadow lines from the skin line downward, reduced lateral resolution.',
      test: 'Scan a uniform phantom region (or the air/lens test where the manufacturer allows) and inspect for dark vertical lines; use element test tool if available.',
      service: 'Elements are not field-repairable; probe replacement or specialist repair.',
      safety: 'Do not autoclave or overheat probes — heat depolarises the elements.',
      spares: ['Replacement probe'], pm: ['Element dropout check'], qa: ['Uniformity / element check']
    },
    tx: {
      name: 'Transmit circuit (pulsers)', function: 'Generates high-voltage drive pulses for each element.',
      principle: 'Per-channel pulsers switch the HV rail into the element at times set by the beamformer; amplitude sets acoustic output.',
      input: 'HV rail, TX timing', output: 'HV pulses to elements',
      normal: 'Pulse amplitude and timing per channel within manufacturer spec; output indices displayed.',
      failure: 'Failed pulser channel, HV supply fault, TX/RX switch damage.',
      symptoms: 'Channel-specific dropout across all probes on one port, reduced penetration, HV fault messages.',
      test: 'Swap probe to another port / try a known-good probe to separate probe vs system; review HV status in service mode.',
      service: 'Model-specific procedure required.',
      safety: 'Transmit rail can carry hazardous voltage — isolate before opening.',
      spares: ['Transmit board'], pm: [], qa: ['Penetration / sensitivity']
    },
    beamformer: {
      name: 'Beamformer', function: 'Focuses and steers transmit and receive beams by delaying each channel.',
      principle: 'Applies calculated delays (and apodisation) per channel, then sums channels coherently; dynamic receive focusing tracks depth.',
      input: 'Digitised channel data, scan parameters', output: 'Focused RF/IQ scan lines',
      normal: 'Sharp, symmetric point-target images; consistent across ports.',
      failure: 'Channel board failure, clock/timing fault, FPGA error.',
      symptoms: 'Blurred lateral resolution, ghost targets, same defect on all probes.',
      test: 'Image resolution targets on a phantom with several probes; review self-test and error log.',
      service: 'Board-level replacement after power rails and cabling are verified; Model-specific procedure required.',
      safety: 'ESD-sensitive board — wrist strap and ESD mat.',
      spares: ['Beamformer board'], pm: [], qa: ['Axial / lateral resolution']
    },
    rx: {
      name: 'Receive circuit', function: 'Protects, amplifies and digitises the small echo signals.',
      principle: 'TX/RX switch isolates the receiver during transmit; low-noise amplifier and time-gain compensation boost echoes; ADC samples each channel.',
      input: 'Echo voltages (µV–mV)', output: 'Digitised channel data',
      normal: 'Low noise floor, smooth TGC response, no banding.',
      failure: 'LNA or ADC channel failure, TX/RX switch breakdown, noise coupling from ground faults.',
      symptoms: 'Noise speckle, horizontal bands, dropout lines on every probe at the same position.',
      test: 'Compare images from two probes on the same and different ports; check noise with probe in air.',
      service: 'Model-specific procedure required.',
      safety: 'ESD-sensitive inputs — handle boards by edges.',
      spares: ['Receive board'], pm: [], qa: ['Penetration / sensitivity']
    },
    processing: {
      name: 'Processing board', function: 'Converts beamformed data into displayable image and Doppler information.',
      principle: 'Envelope detection, log compression, filtering, Doppler estimation and scan conversion to the display raster.',
      input: 'RF/IQ scan lines', output: 'Image frames, measurements',
      normal: 'Stable frame rate; correct greyscale and colour Doppler.',
      failure: 'Overheating GPU/DSP, memory faults, firmware corruption.',
      symptoms: 'Frozen image, artefacts after warm-up, slow frame rate, crashes.',
      test: 'Review temperature and error logs; observe whether fault correlates with warm-up time.',
      service: 'Clean cooling path first; board replacement only with evidence. Model-specific procedure required.',
      safety: 'ESD precautions; let heatsinks cool.',
      spares: ['Processing board'], pm: ['Filter and fan cleaning'], qa: ['Greyscale / dynamic range']
    },
    mainPcb: {
      name: 'Main PCB / system computer', function: 'Runs the operating software, user interface, storage and networking.',
      principle: 'Embedded PC / controller coordinates scan modes, presets, measurements, archive and DICOM export.',
      input: 'User commands, processed images, DC power', output: 'Scan control, display data, stored studies',
      normal: 'Boots without errors; presets load; storage and export work.',
      failure: 'Storage failure, corrupted software, failed RAM, CMOS battery.',
      symptoms: 'Boot loop, lost presets, error at start-up, failed export.',
      test: 'Review boot messages and system log; run built-in diagnostics.',
      service: 'Restore software/presets from approved image; replace storage. Model-specific procedure required.',
      safety: 'Back up configuration and patient data per hospital data-protection policy before service.',
      spares: ['Storage drive', 'System board'], pm: ['Software / log review'], qa: ['Measurement accuracy']
    },
    display: {
      name: 'Display / user interface', function: 'Shows images and measurements; provides controls and keyboard.',
      principle: 'Medical-grade LCD with calibrated greyscale; control panel and touch screen send commands to the main PCB.',
      input: 'Video signal, user input', output: 'Displayed image, commands',
      normal: 'Uniform brightness, correct greyscale steps visible, all keys and encoders work.',
      failure: 'Backlight ageing, dead pixels, worn encoders, cable fault.',
      symptoms: 'Dim image, missing greyscale steps, unresponsive controls.',
      test: 'Display a greyscale test pattern; test every key, knob and slider.',
      service: 'Replace display or control panel assembly; recheck greyscale.',
      safety: 'Clean with approved agents only; fluid ingress can damage controls.',
      spares: ['Monitor assembly', 'Control panel', 'Trackball'], pm: ['Display and controls check'], qa: ['Display greyscale']
    },
    psu: {
      name: 'Power supply', function: 'Converts mains to low-voltage and HV rails.',
      principle: 'Isolated medical-grade SMPS plus regulated, programmable HV supply for the transmitter.',
      input: 'Mains AC', output: 'DC rails, HV rail',
      normal: 'Rails within tolerance; passes electrical safety tests.',
      failure: 'Fuse failure, capacitor ageing, HV supply fault.',
      symptoms: 'No power, random shutdown, HV fault message.',
      test: 'Check fuse and inlet; measure rails at test points; electrical safety analyzer.',
      service: 'Replace PSU module; repeat electrical safety tests.',
      safety: 'Mains and HV present — lockout before opening.',
      spares: ['PSU module', 'Mains fuse'], pm: ['Electrical safety test'], qa: ['Electrical safety']
    },
    battery: {
      name: 'Battery', function: 'Allows portable use or standby/transport without shutdown.',
      principle: 'Rechargeable pack with battery management circuit.',
      input: 'Charge current', output: 'DC supply',
      normal: 'Run time meets manufacturer specification.',
      failure: 'Capacity loss, swelling, charger fault.',
      symptoms: 'Short run time, unexpected shutdown when unplugged.',
      test: 'Run-time test with defined scanning load.',
      service: 'Replace pack; dispose per local regulations.',
      safety: 'Swollen battery — remove from service immediately; thermal hazard.',
      spares: ['Battery pack'], pm: ['Battery check'], qa: ['Battery run-time']
    },
    cooling: {
      name: 'Cooling system', function: 'Removes heat from boards and power supply.',
      principle: 'Fans draw air through dust filters across heatsinks; temperature sensors allow controlled shutdown.',
      input: 'Fan supply, temperature feedback', output: 'Airflow',
      normal: 'Fans running quietly; filters clean; temperatures normal in log.',
      failure: 'Clogged filter, failed fan bearing, blocked vents.',
      symptoms: 'Over-temperature message, image artefacts after warm-up, shutdown.',
      test: 'Inspect filters; listen to fans; review temperature log.',
      service: 'Clean or replace filters; replace noisy/failed fans.',
      safety: 'Disconnect power before reaching near fan blades.',
      spares: ['Air filter', 'Fan'], pm: ['Filter and fan cleaning'], qa: []
    }
  },
  workflow: [
    { title: 'Preset and probe selection', active: ['mainPcb', 'display'], what: 'User selects probe and exam preset; system loads scan parameters.', signal: 'Probe ID read', parameter: 'Frequency, depth, focus', fail: 'Probe not recognised (connector pins).' },
    { title: 'Transmit timing', active: ['beamformer', 'mainPcb'], what: 'Beamformer calculates per-element delays for focus and steering.', signal: 'TX delay profile', parameter: 'Focal depth', fail: 'Timing/clock fault.' },
    { title: 'Pulse generation', active: ['tx', 'psu'], what: 'Pulsers switch the HV rail into each element at its delay.', signal: 'HV pulses', parameter: 'Transmit voltage', fail: 'Pulser channel or HV rail fault.' },
    { title: 'Transduction', active: ['piezo', 'probe'], what: 'Elements vibrate and launch an acoustic pulse through the lens into tissue.', signal: 'Acoustic pressure', parameter: 'Centre frequency', fail: 'Dead elements, cracked lens.' },
    { title: 'Echo reception', active: ['probe', 'piezo', 'rx'], what: 'Reflected echoes return and are converted to small voltages.', signal: 'Echo voltage', parameter: 'Sensitivity', fail: 'Cable fault, weak elements.' },
    { title: 'Amplify and digitise', active: ['rx'], what: 'LNA and TGC amplify echoes by depth; ADC samples each channel.', signal: 'Digitised channel data', parameter: 'Gain, TGC', fail: 'Noisy or dead channel.' },
    { title: 'Receive beamforming', active: ['beamformer'], what: 'Channels are delayed and summed with dynamic focus to form scan lines.', signal: 'RF / IQ lines', parameter: 'Lateral resolution', fail: 'Channel board failure.' },
    { title: 'Image processing', active: ['processing'], what: 'Envelope detection, log compression, filtering and scan conversion.', signal: 'Image frame', parameter: 'Dynamic range, frame rate', fail: 'Overheating DSP/GPU.' },
    { title: 'Display and measure', active: ['display', 'mainPcb'], what: 'Image is shown with output indices; user measures and stores.', signal: 'Video', parameter: 'Greyscale, calliper accuracy', fail: 'Display ageing, calibration error.' },
    { title: 'Thermal management', active: ['cooling', 'mainPcb'], what: 'Fans and sensors keep electronics within temperature limits.', signal: 'Temperature sensor', parameter: 'Board temperature', fail: 'Blocked filter causes warm-up artefacts.' }
  ],
  operation: [
    { step: 'Pre-use inspection', detail: 'Inspect probes (lens, housing, cable), power cord and cart; confirm cleaning status.' },
    { step: 'Power on and enter patient data', detail: 'Wait for self-test; enter patient ID from the worklist.' },
    { step: 'Select probe and preset', detail: 'Connect/select probe and the exam preset appropriate to the study.' },
    { step: 'Optimise image', detail: 'Adjust depth, gain, TGC and focus; observe MI/TI displays (ALARA principle).' },
    { step: 'Measure, annotate, store', detail: 'Use callipers and annotations; store and export images to archive.' },
    { step: 'Post-use reprocessing', detail: 'Clean and disinfect probes per approved protocol and probe compatibility list; report damage via work order.' }
  ],
  pm: {
    daily: [
      { task: 'Probe visual inspection', why: 'Cracks and cuts create leakage and infection risk.', tools: 'Visual, touch', safety: 'Gloves — probe may be contaminated', procedure: 'Inspect lens, housing, strain relief and cable along full length.', criteria: 'No cracks, cuts, bulges or discolouration.' }
    ],
    weekly: [
      { task: 'Filter check', why: 'Dust raises board temperature and causes artefacts.', tools: 'Visual, vacuum', safety: 'Power off for filter removal if required', procedure: 'Remove and clean air filters; refit correctly.', criteria: 'Filters clean and seated.' }
    ],
    monthly: [
      { task: 'Element dropout check', why: 'Dead elements degrade image quality gradually and are easily missed clinically.', tools: 'Ultrasound phantom', safety: 'Clean probe after use', procedure: 'Scan uniform phantom region with each probe at fixed settings; inspect for vertical dark lines.', criteria: 'No new dropout compared with baseline image.' },
      { task: 'Battery check', why: 'Ensures portable operation.', tools: 'Stopwatch', safety: '—', procedure: 'Unplug and confirm switch to battery and charge indication.', criteria: 'No unexpected shutdown; no battery fault.' }
    ],
    quarterly: [
      { task: 'Display and controls check', why: 'Missing greyscale can hide pathology.', tools: 'Greyscale test pattern', safety: '—', procedure: 'Display test pattern; test every key, knob and trackball.', criteria: 'All greyscale steps distinguishable; all controls respond.' },
      { task: 'Software / log review', why: 'Recurring errors reveal developing faults.', tools: 'Service software', safety: 'Protect patient data', procedure: 'Review error and temperature log; note trends.', criteria: 'No unresolved recurring errors.' }
    ],
    halfyearly: [
      { task: 'Image quality on phantom', why: 'Detects gradual loss of penetration and resolution.', tools: 'Ultrasound phantom', safety: '—', procedure: 'Record penetration, resolution and calliper accuracy with fixed preset; compare with baseline.', criteria: 'Within configured limits vs baseline.' },
      { task: 'Probe leakage test', why: 'Detects insulation breakdown of the applied part.', tools: 'Electrical safety analyzer, probe leakage fixture', safety: 'Follow analyzer instructions; immerse only to manufacturer immersion line', procedure: 'Measure patient leakage of each probe in saline bath per protocol.', criteria: 'Per hospital protocol based on applicable electrical safety standard.' }
    ],
    annual: [
      { task: 'Electrical safety test', why: 'Protects patient and operator from shock.', tools: 'Electrical safety analyzer', safety: 'Follow analyzer instructions', procedure: 'Inspect cord; measure protective earth, insulation and leakage currents.', criteria: 'Per hospital protocol based on applicable electrical safety standard.' },
      { task: 'Fan and internal cleaning', why: 'Prevents thermal faults.', tools: 'Vacuum, ESD kit', safety: 'Mains disconnected; ESD protection', procedure: 'Clean fans, heatsinks and vents; check fan noise.', criteria: 'Clean; fans quiet.' },
      { task: 'Manufacturer PM', why: 'Model-specific checks and updates.', tools: 'Service software', safety: 'Back up configuration first', procedure: 'Perform manufacturer PM checklist and approved software updates.', criteria: 'Model-specific procedure required.' }
    ]
  },
  qa: [
    { id: 'uniformity', test: 'Uniformity / element check', setup: 'Each probe on uniform phantom region, fixed preset and gain.', measure: 'Presence of vertical dropout lines', unit: '—', example: 'Comparison with baseline image for new or wider dropout', report: 'Images per probe + pass/fail' },
    { id: 'depth', test: 'Penetration / sensitivity', setup: 'Phantom, fixed preset, maximum gain, TGC neutral.', measure: 'Depth at which speckle meets noise', unit: 'cm', example: 'Change from baseline depth', report: 'Depth per probe vs baseline' },
    { id: 'resolution', test: 'Axial / lateral resolution', setup: 'Phantom resolution target groups.', measure: 'Smallest separated target spacing', unit: 'mm', example: 'Comparison with baseline / specification', report: 'Resolution table' },
    { id: 'distance', test: 'Measurement accuracy', setup: 'Phantom with known target spacing.', measure: 'Calliper distance vertical and horizontal', unit: '%', example: 'Deviation of measured distance from known spacing', report: 'Known vs measured' },
    { id: 'greyscale', test: 'Display greyscale', setup: 'Built-in or standard test pattern.', measure: 'Visible greyscale steps', unit: '—', example: 'All steps distinguishable', report: 'Pass/fail' },
    { id: 'leakage', test: 'Probe leakage current', setup: 'Electrical safety analyzer with probe immersed in saline to immersion line.', measure: 'Patient leakage current', unit: 'µA', example: 'Measured leakage compared with configured limit', report: 'Value per probe' },
    { id: 'esafety', test: 'Electrical safety', setup: 'Electrical safety analyzer.', measure: 'Earth resistance, enclosure leakage', unit: 'Ω / µA', example: 'Measured values compared with configured limits', report: 'Analyzer printout' }
  ],
  troubleshoot: [
    {
      symptom: 'Dark vertical lines in image',
      causes: [
        { cause: 'Dead piezo elements in probe', note: 'Most common; usually after a drop.' },
        { cause: 'Damaged probe cable / connector pins', note: 'Lines may change when cable is flexed.' },
        { cause: 'Air gap / insufficient gel', note: 'Operator issue — rule out first.' },
        { cause: 'System channel (TX/RX) failure', note: 'Same line position on every probe.' }
      ],
      first: {
        prompt: 'What would you test first?',
        options: [
          { t: 'Replace the beamformer board', correct: false, why: 'No evidence points to the system; most dropout is in the probe.' },
          { t: 'Scan a phantom with this probe, then with a second probe on the same port', correct: true, why: 'Non-invasive and splits the fault: probe-only defect vs system channel defect in two scans.' },
          { t: 'Reinstall the software', correct: false, why: 'Software does not cause fixed vertical dropout; reinstalling destroys the log.' },
          { t: 'Increase overall gain', correct: false, why: 'Hides the symptom and leaves a degraded probe in clinical use.' }
        ]
      },
      measure: 'Phantom images per probe and per port; position and width of dropout; effect of flexing cable.',
      decision: 'Only one probe affected → probe fault. All probes same position → system channel. Changes with cable flex → cable/connector.',
      repair: 'Remove affected probe from service and arrange repair/replacement; system channel faults per service manual.',
      verify: 'Uniformity image vs baseline; probe leakage test; document.'
    },
    {
      symptom: 'Image degrades after system warms up',
      causes: [
        { cause: 'Clogged air filter', note: 'Most common and easy to check.' },
        { cause: 'Failed fan', note: 'Check fan noise and log.' },
        { cause: 'Processing board thermal fault', note: 'After cooling path verified.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Inspect filters and review the temperature log', correct: true, why: 'Correlating fault with temperature is evidence, and filter cleaning is the least invasive fix.' },
          { t: 'Replace processing board', correct: false, why: 'Expensive and does not address a likely cooling cause.' },
          { t: 'Replace the probe', correct: false, why: 'A probe fault does not depend on system warm-up.' },
          { t: 'Turn off the fans to reduce noise', correct: false, why: 'Worsens overheating.' }
        ]
      },
      measure: 'Board temperatures from log; fan speeds; filter condition.',
      decision: 'Filters blocked → clean. Fan failed → replace fan. Cooling OK but fault persists → board diagnosis.',
      repair: 'Clean/replace filter or fan; board only with evidence.',
      verify: 'Extended scan run; image quality on phantom; log clean.'
    }
  ],
  errors: [
    { code: 'TRN-U110', desc: 'Probe not recognised', causes: ['Dirty or bent connector pins', 'Probe ID memory fault', 'Port fault'], component: 'probe', checks: ['Inspect connector', 'Try another port', 'Try known-good probe'], service: 'Clean connector; repair/replace probe.', verify: 'Probe recognised on all ports; uniformity image.', pm: 'Probe inspection' },
    { code: 'TRN-U215', desc: 'Transmit high-voltage fault', causes: ['HV supply fault', 'Shorted pulser channel', 'Probe short'], component: 'tx', checks: ['Disconnect probes and retest', 'Review HV status'], service: 'Model-specific procedure required.', verify: 'Self-test pass; phantom image.', pm: '—' },
    { code: 'TRN-U320', desc: 'Receive channel self-test failed', causes: ['RX board channel', 'Board connector'], component: 'rx', checks: ['Review which channels fail', 'Reseat boards'], service: 'Model-specific procedure required.', verify: 'Self-test pass; uniformity on all probes.', pm: '—' },
    { code: 'TRN-U430', desc: 'System over-temperature', causes: ['Blocked filter', 'Fan failure', 'High room temperature'], component: 'cooling', checks: ['Inspect filters', 'Check fans', 'Room temperature'], service: 'Clean filters; replace fan.', verify: 'Temperature log normal after extended run.', pm: 'Filter and fan cleaning' },
    { code: 'TRN-U540', desc: 'Storage / archive error', causes: ['Disk full', 'Storage failure', 'Network export failure'], component: 'mainPcb', checks: ['Free space', 'Disk health', 'Export queue'], service: 'Clear per policy; replace storage; restore software.', verify: 'Store and export test study.', pm: 'Software / log review' },
    { code: 'TRN-U610', desc: 'Battery fault', causes: ['Aged pack', 'Charger fault'], component: 'battery', checks: ['Battery voltage', 'Run-time test'], service: 'Replace battery pack.', verify: 'Run-time test.', pm: 'Battery check' }
  ],
  safety: [
    { title: 'Probe leakage', level: 'danger', text: 'The probe is an applied part in direct (sometimes intracavity) contact. Any probe failing leakage testing must be removed from service immediately.' },
    { title: 'Cracked lens or housing', level: 'warning', text: 'Cracks allow fluid ingress, electrical leakage and trapped contamination. Tag out the probe and document with photographs.' },
    { title: 'Disinfection', level: 'warning', text: 'Use only disinfectants and methods on the manufacturer compatibility list. Treat returned probes as contaminated until reprocessing is confirmed.' },
    { title: 'Acoustic output', level: 'caution', text: 'Output indices (MI/TI) must display correctly. Users apply ALARA; engineers verify indices update with settings.' },
    { title: 'Electrical', level: 'info', text: 'Disconnect mains and battery before opening. Repeat electrical safety tests after repair.' }
  ],
  tools: ['esa', 'usPhantom', 'multimeter', 'oscilloscope', 'dicomTools'],
  cases: ['poorImage', 'excessiveLeakage', 'overheating', 'fanFailure', 'dicomFailure', 'batteryNotCharging'],
  scenarios: ['usDeadElements'],
  artifacts: ['us-dead', 'us-dropout', 'us-reverb', 'us-probe'],
  questions: [
    { q: 'Which effect allows the same element to transmit and receive ultrasound?', options: ['Doppler effect', 'Piezoelectric effect', 'Hall effect', 'Photoelectric effect'], answer: 1, why: 'Piezoelectric materials convert voltage to deformation and back.', domain: 'knowledge' },
    { q: 'Echo depth is calculated from…', options: ['Echo amplitude', 'Round-trip time and assumed speed of sound', 'Probe temperature', 'Frame rate'], answer: 1, why: 'Depth = speed × time / 2.', domain: 'knowledge' },
    { q: 'What does the beamformer do?', options: ['Generates mains power', 'Applies per-channel delays to focus and steer beams', 'Stores images', 'Cools the system'], answer: 1, why: 'Delay-and-sum focusing is the beamformer’s core job.', domain: 'technical' },
    { q: 'A thin dark vertical line appears with one probe only. Most likely cause?', options: ['Beamformer failure', 'Dead element(s) in that probe', 'Display fault', 'Software bug'], answer: 1, why: 'A defect isolated to one probe points at the probe.', domain: 'troubleshooting' },
    { q: 'Best first step for dropout lines?', options: ['Replace RX board', 'Phantom scan with this probe and a second probe', 'Reinstall software', 'Raise gain'], answer: 1, why: 'Two non-invasive scans split probe vs system.', domain: 'troubleshooting' },
    { q: 'A probe has a cracked lens but images look fine. Action?', options: ['Continue use', 'Remove from service, tag and report', 'Seal with tape', 'Use only for external scans'], answer: 1, why: 'Leakage and infection risk regardless of image quality.', domain: 'safety' },
    { q: 'Which tool measures probe leakage current?', options: ['Ultrasound phantom', 'Electrical safety analyzer with leakage fixture', 'Oscilloscope', 'DICOM viewer'], answer: 1, why: 'Leakage is an electrical safety measurement.', domain: 'technical' },
    { q: 'Why keep a baseline phantom image for each probe?', options: ['For marketing', 'To detect gradual degradation by comparison', 'Not needed', 'For billing'], answer: 1, why: 'Image QA is comparative; trends reveal slow failure.', domain: 'documentation' },
    { q: 'Where do the acceptance limits for ultrasound QA come from?', options: ['Any website', 'Hospital-approved protocol based on manufacturer documentation and applicable standards', 'Guesswork', 'The last engineer'], answer: 1, why: 'Limits vary by probe, model and jurisdiction.', domain: 'documentation' }
  ]
});

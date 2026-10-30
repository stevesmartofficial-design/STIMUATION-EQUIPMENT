/* Content pack: General radiography (digital radiography / DR room).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'xray',
  summary: 'A digital radiography room produces projection images by sending a short X-ray exposure through the patient onto a flat-panel detector. The generator sets kV and mAs, the collimator limits the field, the grid removes scatter and automatic exposure control terminates the exposure. Service work combines high voltage, radiation protection, mechanical positioning and image-processing chains.',
  hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'IONISING RADIATION', type: 'rad' }],
  principle: [
    'Mains power feeds a high-frequency generator that produces tube voltage (kV) and current (mA).',
    'The X-ray tube converts electron energy to X-rays at the anode focal spot.',
    'The collimator limits the beam to the area of interest; a light field shows its position.',
    'The patient attenuates the beam; the grid in the bucky absorbs scattered radiation.',
    'The AEC chamber measures radiation reaching the detector and terminates the exposure at the required dose.',
    'The flat-panel detector converts X-rays to a digital image, which is processed at the workstation and sent to PACS.'
  ],
  parameters: [
    { name: 'Tube voltage', unit: 'kV', typical: 'Selected per examination', note: 'Verified with a non-invasive meter' },
    { name: 'Tube current-time product', unit: 'mAs', typical: 'Selected or AEC-controlled', note: 'Output linearity checked' },
    { name: 'Exposure time', unit: 'ms', typical: 'Selected or AEC-controlled', note: 'Measured by meter' },
    { name: 'Source-to-image distance (SID)', unit: 'cm', typical: 'Set per examination', note: 'Affects magnification and dose' },
    { name: 'Dose-area product (DAP)', unit: 'µGy·m²', typical: 'Displayed per exposure', note: 'Compared to measured value' },
    { name: 'Exposure index', unit: '—', typical: 'Displayed per image', note: 'Indicates detector dose' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 185, y: 40, w: 335, h: 130, label: 'HIGH VOLTAGE', type: 'hv' },
      { x: 535, y: 40, w: 445, h: 340, label: 'RADIATION', type: 'rad' }
    ],
    nodes: [
      { id: 'psu', x: 30, y: 90, w: 140, h: 54, label: 'Mains / power' },
      { id: 'generator', x: 200, y: 90, w: 140, h: 54, label: 'HV generator' },
      { id: 'tube', x: 365, y: 90, w: 140, h: 54, label: 'X-ray tube' },
      { id: 'collimator', x: 555, y: 90, w: 140, h: 54, label: 'Collimator' },
      { id: 'table', x: 810, y: 90, w: 150, h: 54, label: 'Patient table' },
      { id: 'aec', x: 600, y: 210, w: 150, h: 54, label: 'AEC chambers' },
      { id: 'bucky', x: 810, y: 210, w: 150, h: 54, label: 'Grid / bucky' },
      { id: 'detector', x: 810, y: 310, w: 150, h: 54, label: 'Flat-panel detector' },
      { id: 'console', x: 200, y: 430, w: 150, h: 54, label: 'Generator console' },
      { id: 'workstation', x: 420, y: 430, w: 170, h: 54, label: 'Acquisition workstation' },
      { id: 'pacs', x: 660, y: 430, w: 150, h: 54, label: 'PACS / DICOM' }
    ],
    links: [
      ['psu', 'generator', 'mains'], ['generator', 'tube', 'kV / mA'], ['tube', 'collimator', 'X-ray beam'],
      ['collimator', 'table', 'field'], ['table', 'bucky', 'attenuated beam'], ['bucky', 'aec', 'dose signal'],
      ['bucky', 'detector'], ['aec', 'generator', 'stop exposure'], ['console', 'generator', 'kV / mAs / expose'],
      ['detector', 'workstation', 'raw image'], ['console', 'workstation', 'exam data'], ['workstation', 'pacs', 'DICOM']
    ]
  },
  components: {
    psu: {
      name: 'Mains / power', function: 'Supplies the generator and room equipment with electrical power.',
      principle: 'Dedicated mains supply with isolator; generator draws high peak current during exposure, so supply impedance matters.',
      input: 'Building mains', output: 'Power to generator and room',
      normal: 'Voltage stable under exposure load; isolator and emergency off functional.',
      failure: 'High line impedance, blown fuse, loose terminals, tripped breaker.',
      symptoms: 'No power, exposure aborts at high mA, line voltage errors.',
      test: 'Measure mains voltage at rest and during exposure with a power analyzer; inspect terminals with power isolated.',
      service: 'Tighten or repair terminals; supply issues via facilities electricians.',
      safety: 'Mains and high fault current — isolate and lock out before access.',
      spares: ['Mains fuses', 'Contactor'], pm: ['Emergency off and isolator'], qa: []
    },
    generator: {
      name: 'HV generator', function: 'Produces controlled kV and mA for the X-ray tube.',
      principle: 'High-frequency inverter and HV transformer/rectifier with closed-loop kV and mA control; exposure timer and AEC input.',
      input: 'Mains power, exposure commands, AEC signal', output: 'Tube kV and mA',
      normal: 'kV, mA and time follow set values; no arc or error messages.',
      failure: 'Inverter failure, HV tank breakdown, capacitor ageing, feedback drift.',
      symptoms: 'No exposure, exposure errors, kV inaccuracy, inconsistent image density.',
      test: 'Measure kV, time and output with a calibrated non-invasive meter; review error log.',
      service: 'Internal repair is model-specific; calibrate after component replacement.',
      safety: 'Lethal stored charge in capacitors and HV cables; verify discharge before access.',
      spares: ['Inverter board', 'HV cable', 'Filament board'], pm: ['HV cable inspection'], qa: ['kV accuracy', 'Exposure time accuracy', 'Output linearity', 'Reproducibility']
    },
    tube: {
      name: 'X-ray tube', function: 'Generates X-rays.',
      principle: 'Thermionic electrons accelerated to a rotating anode; focal spot size selected by filament.',
      input: 'kV, filament current, anode drive', output: 'X-ray beam, heat',
      normal: 'Normal anode spin-up sound; no arcing; housing free of oil leaks.',
      failure: 'Filament open, anode bearing wear, vacuum loss, overheating.',
      symptoms: 'Filament error, rotor error, noise during spin-up, reduced output.',
      test: 'Review rotor and filament errors; listen to spin-up; measure output and half-value layer.',
      service: 'Tube replacement is model-specific; recalibrate and perform QA afterwards.',
      safety: 'Hot housing; heavy assembly; stored HV in cables.',
      spares: ['X-ray tube assembly'], pm: ['Tube stand and housing inspection'], qa: ['Half-value layer', 'Output linearity']
    },
    collimator: {
      name: 'Collimator', function: 'Limits the radiation field and indicates it with a light field.',
      principle: 'Lead shutters set field size; a lamp and mirror project the field; added filtration may be present.',
      input: 'X-ray beam, field-size setting', output: 'Collimated field',
      normal: 'Light field matches X-ray field; lamp bright; shutters move freely.',
      failure: 'Lamp failure, mirror misalignment, shutter sticking.',
      symptoms: 'Field cut-off, no light field, field larger than set.',
      test: 'Light / X-ray field coincidence test with a test tool and detector image.',
      service: 'Replace lamp; adjust mirror per service manual.',
      safety: 'Lamp housing hot; radiation during alignment exposures.',
      spares: ['Collimator lamp'], pm: ['Collimator light and field check'], qa: ['Light / X-ray field coincidence']
    },
    table: {
      name: 'Patient table', function: 'Supports and positions the patient.',
      principle: 'Floating tabletop with electromagnetic locks and height drive.',
      input: 'Patient load, operator controls', output: 'Patient positioned in beam',
      normal: 'Locks hold; smooth motion; within load rating.',
      failure: 'Lock failure, drive fault, worn bearings.',
      symptoms: 'Tabletop drifts, will not lock, noise.',
      test: 'Test locks and motion under load.',
      service: 'Adjust locks; lubricate per service manual.',
      safety: 'Pinch and crush points; respect load limit.',
      spares: ['Brake / lock coil'], pm: ['Table and stand mechanical check'], qa: []
    },
    bucky: {
      name: 'Grid / bucky', function: 'Holds the grid and detector; removes scattered radiation.',
      principle: 'Lead strip grid absorbs off-axis scatter; moving grid blurs grid lines during exposure.',
      input: 'Attenuated beam with scatter', output: 'Primary beam to detector',
      normal: 'Grid moves during exposure; no grid lines; correct focal distance.',
      failure: 'Grid motor failure, damaged grid, wrong SID for focused grid.',
      symptoms: 'Grid lines, grid cut-off (uneven density), bucky error.',
      test: 'Check grid movement and SID; uniform exposure image.',
      service: 'Repair drive; replace damaged grid.',
      safety: 'Handle grids carefully — easily damaged.',
      spares: ['Grid', 'Bucky drive motor'], pm: ['Bucky and grid check'], qa: ['Detector uniformity']
    },
    detector: {
      name: 'Flat-panel detector', function: 'Converts the X-ray image to digital data.',
      principle: 'Scintillator and photodiode array (indirect) or photoconductor (direct) on a thin-film transistor matrix read out pixel by pixel.',
      input: 'X-ray image', output: 'Raw digital image',
      normal: 'Calibrated gain and offset; no new defective pixels; reliable link and battery (wireless).',
      failure: 'Dead pixels or lines, calibration expiry, impact damage, wireless or battery fault.',
      symptoms: 'Lines, artefacts, detector not ready, image not received.',
      test: 'Flat-field image review; detector calibration; check connection status.',
      service: 'Recalibrate (gain/offset/defect map); replacement is model-specific.',
      safety: 'Fragile and expensive — avoid drops; disinfect per policy.',
      spares: ['Detector battery', 'Detector cable'], pm: ['Detector calibration'], qa: ['Detector uniformity', 'Exposure index consistency']
    },
    aec: {
      name: 'Automatic exposure control (AEC)', function: 'Terminates exposure when the required detector dose is reached.',
      principle: 'Ionisation chambers in front of the detector integrate dose; at threshold the generator ends the exposure.',
      input: 'Radiation reaching chambers', output: 'Exposure termination signal',
      normal: 'Consistent detector dose across patient thicknesses and kV.',
      failure: 'Chamber fault, wrong field selection, calibration drift.',
      symptoms: 'Over- or under-exposed images, backup-time termination.',
      test: 'Expose varying phantom thicknesses; compare exposure index and detector dose.',
      service: 'AEC calibration per service manual.',
      safety: 'Faulty AEC can overexpose patients — remove from use if suspected.',
      spares: ['AEC chamber'], pm: [], qa: ['AEC consistency']
    },
    workstation: {
      name: 'Acquisition workstation', function: 'Receives, processes and displays images.',
      principle: 'Applies detector corrections and image processing; manages worklist and DICOM send.',
      input: 'Raw image, exam data', output: 'Processed DICOM images',
      normal: 'Images display promptly; processing correct for anatomy.',
      failure: 'Software fault, wrong processing, disk full.',
      symptoms: 'Images not shown, poor processing, slow response.',
      test: 'Review logs and disk space; check processing parameters.',
      service: 'Restore configuration; software restore is model-specific.',
      safety: 'Patient data privacy; back up configuration.',
      spares: ['Hard disk', 'Monitor'], pm: ['Workstation and monitor check'], qa: ['Exposure index consistency']
    },
    console: {
      name: 'Generator console', function: 'Sets exposure parameters and starts exposures.',
      principle: 'Two-stage prepare/expose switch; console communicates with generator and workstation.',
      input: 'Operator settings', output: 'Exposure commands',
      normal: 'Display correct; prepare/expose works; indicators and audible signal function.',
      failure: 'Switch failure, communication loss, display fault.',
      symptoms: 'No exposure, communication error.',
      test: 'Check exposure switch continuity; review communication status.',
      service: 'Replace switch or cable.',
      safety: 'Exposure only from protected area.',
      spares: ['Exposure hand switch'], pm: ['Exposure switch and indicators'], qa: []
    },
    pacs: {
      name: 'PACS / DICOM', function: 'Stores and distributes images.',
      principle: 'DICOM storage, worklist and MPPS services.',
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
    { title: 'Exam selection', active: ['workstation', 'console'], what: 'Patient selected from worklist; exam protocol sets default kV/mAs.', signal: 'Worklist data', parameter: 'Protocol', fail: 'Empty worklist, wrong protocol.' },
    { title: 'Positioning', active: ['table', 'collimator', 'bucky'], what: 'Patient positioned; light field and SID set.', signal: 'Light field', parameter: 'Field size, SID', fail: 'Light field misaligned.' },
    { title: 'Prepare', active: ['console', 'generator', 'tube'], what: 'Prepare stage heats filament and spins anode.', signal: 'Ready signal', parameter: 'Filament current, rotor speed', fail: 'Rotor or filament error.' },
    { title: 'High voltage', active: ['psu', 'generator'], what: 'Generator draws mains power and produces kV and mA.', signal: 'kV / mA feedback', parameter: 'kV, mA', fail: 'Line voltage drop, inverter fault.' },
    { title: 'X-ray production', active: ['generator', 'tube'], what: 'X-rays produced at the focal spot.', signal: 'Exposure on', parameter: 'kV, mA, time', fail: 'Arcing, no output.' },
    { title: 'Beam limiting', active: ['collimator'], what: 'Shutters restrict the beam to the selected field.', signal: '—', parameter: 'Field size', fail: 'Field larger than set.' },
    { title: 'Attenuation and scatter removal', active: ['table', 'bucky'], what: 'Patient attenuates beam; grid removes scatter.', signal: 'Grid motion', parameter: 'Grid ratio, SID', fail: 'Grid lines, cut-off.' },
    { title: 'AEC termination', active: ['aec', 'generator'], what: 'AEC ends exposure at the required dose.', signal: 'Termination signal', parameter: 'Detector dose', fail: 'Backup timer termination, overexposure.' },
    { title: 'Image capture', active: ['detector', 'workstation'], what: 'Detector reads out the image and transfers it.', signal: 'Image data', parameter: 'Exposure index', fail: 'Detector not ready, lost image.' },
    { title: 'Processing and archive', active: ['workstation', 'pacs'], what: 'Image processed, reviewed and sent to PACS.', signal: 'DICOM association', parameter: 'Transfer status', fail: 'Network or configuration fault.' }
  ],
  operation: [
    { step: 'Start-up', detail: 'Switch on room; check detector status and tube warm-up if required.' },
    { step: 'Select exam', detail: 'Choose patient from worklist and examination protocol.' },
    { step: 'Position and collimate', detail: 'Position patient, set SID, collimate to region of interest, apply shielding per policy.' },
    { step: 'Expose', detail: 'Prepare then expose from the protected area; observe exposure indicators.' },
    { step: 'Review image', detail: 'Check positioning, exposure index and artefacts.' },
    { step: 'Archive and report faults', detail: 'Send to PACS; record errors in the work-order system.' }
  ],
  pm: {
    daily: [
      { task: 'Room and indicator check', why: 'Warning lights and interlocks protect staff and public.', tools: 'Visual', safety: 'No exposure with persons in room', procedure: 'Check warning lights, door interlock, exposure indicators and detector status.', criteria: 'All indicators function.' }
    ],
    weekly: [
      { task: 'Collimator light and field check', why: 'Misalignment causes repeat exposures.', tools: 'Visual', safety: '—', procedure: 'Check lamp brightness and field indication.', criteria: 'Light field clear and centred.' },
      { task: 'Exposure switch and indicators', why: 'A faulty switch can cause unintended exposure.', tools: 'Visual', safety: 'Test without patient', procedure: 'Check two-stage function and audible signal.', criteria: 'Correct two-stage operation.' }
    ],
    monthly: [
      { task: 'Detector calibration', why: 'Maintains uniformity and defect correction.', tools: 'Built-in software', safety: 'Room cleared during exposures', procedure: 'Run gain/offset calibration per manufacturer.', criteria: 'Calibration completes; uniform image.' },
      { task: 'Bucky and grid check', why: 'Damaged grids cause artefacts.', tools: 'Visual', safety: 'Handle grids carefully', procedure: 'Inspect grid and check movement.', criteria: 'No damage; grid moves.' }
    ],
    quarterly: [
      { task: 'Table and stand mechanical check', why: 'Mechanical failure can injure patients and staff.', tools: 'Spanners, torque tool', safety: 'Counterweights and pinch points', procedure: 'Check locks, cables, counterweights, fasteners.', criteria: 'No wear beyond limits.' },
      { task: 'DICOM connectivity check', why: 'Lost images delay diagnosis.', tools: 'DICOM tools', safety: 'Data privacy', procedure: 'C-ECHO and test transfer.', criteria: 'Successful transfer.' }
    ],
    halfyearly: [
      { task: 'Workstation and monitor check', why: 'Display quality affects image review.', tools: 'Test pattern', safety: '—', procedure: 'Check monitor test pattern, disk space and logs.', criteria: 'Pattern correct; no recurring errors.' },
      { task: 'Tube stand and housing inspection', why: 'Detects oil leaks and mechanical wear.', tools: 'Visual', safety: 'Hot housing', procedure: 'Inspect housing, cables and stand bearings.', criteria: 'No leaks or damage.' }
    ],
    annual: [
      { task: 'Generator performance', why: 'Verifies kV, time, output and reproducibility.', tools: 'Radiation meter', safety: 'Radiation protection', procedure: 'Perform QA tests in QA tab.', criteria: 'Within hospital-configured limits.' },
      { task: 'HV cable inspection', why: 'Damaged insulation causes arcing.', tools: 'Visual', safety: 'Isolate and discharge', procedure: 'Inspect cables and terminations.', criteria: 'No damage.' },
      { task: 'Electrical safety and emergency off', why: 'Protects patients and staff.', tools: 'Electrical safety analyzer', safety: 'LOTO', procedure: 'Test earth bonding, leakage and emergency off.', criteria: 'Per hospital protocol based on applicable standard.' }
    ]
  },
  qa: [
    { id: 'kv', test: 'kV accuracy', setup: 'Non-invasive meter in beam at defined SID.', measure: 'Measured kV at several set points', unit: 'kV', example: 'Deviation of measured kV from set kV', report: 'Set vs measured' },
    { id: 'time', test: 'Exposure time accuracy', setup: 'Non-invasive meter.', measure: 'Measured exposure time', unit: 'ms', example: 'Deviation of measured from set time', report: 'Set vs measured' },
    { id: 'repro', test: 'Reproducibility', setup: 'Repeated identical exposures.', measure: 'Dose per exposure', unit: 'µGy', example: 'Variation of dose across repeated exposures', report: 'Coefficient of variation' },
    { id: 'linearity', test: 'Output linearity', setup: 'Several mAs settings at fixed kV.', measure: 'Dose per mAs', unit: 'µGy/mAs', example: 'Variation of dose per mAs between adjacent settings', report: 'Table of values' },
    { id: 'hvl', test: 'Half-value layer', setup: 'Meter with aluminium filters or HVL function.', measure: 'HVL at reference kV', unit: 'mm Al', example: 'Measured HVL compared with required minimum filtration', report: 'HVL value' },
    { id: 'field', test: 'Light / X-ray field coincidence', setup: 'Test tool on detector.', measure: 'Edge offsets', unit: 'cm or % SID', example: 'Offset between light field and X-ray field edges', report: 'Offsets per edge' },
    { id: 'aec', test: 'AEC consistency', setup: 'Phantoms of varying thickness.', measure: 'Exposure index / detector dose', unit: '—', example: 'Variation of detector dose across thicknesses', report: 'Table' },
    { id: 'uniform', test: 'Detector uniformity', setup: 'Flat-field exposure.', measure: 'Signal in ROIs', unit: '%', example: 'Variation across ROIs compared with baseline', report: 'ROI values' },
    { id: 'ei', test: 'Exposure index consistency', setup: 'Standard phantom exposure.', measure: 'Displayed EI vs measured dose', unit: '—', example: 'Agreement of exposure index with measured detector dose', report: 'Trend' }
  ],
  troubleshoot: [
    {
      symptom: 'No exposure when expose button is pressed',
      causes: [
        { cause: 'Interlock open (door, detector not ready)', note: 'Most common; check indicators.' },
        { cause: 'Exposure switch fault', note: 'Check continuity.' },
        { cause: 'Generator error', note: 'Read error log.' },
        { cause: 'Tube rotor or filament fault', note: 'Check prepare stage.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Replace the generator', correct: false, why: 'Expensive and unproven.' },
          { t: 'Check console messages, interlocks and detector ready status', correct: true, why: 'Interlocks and readiness block exposure by design; checking them is quick and non-invasive.' },
          { t: 'Replace the X-ray tube', correct: false, why: 'No evidence of tube fault.' },
          { t: 'Bypass the door interlock', correct: false, why: 'Unsafe; interlocks must never be bypassed to clinical use.' }
        ]
      },
      measure: 'Interlock states, error log, exposure switch continuity, prepare-stage status.',
      decision: 'Interlock open → correct cause. All clear → switch → error log → generator / tube diagnosis.',
      repair: 'Correct the confirmed cause only.',
      verify: 'Test exposure; kV accuracy; document.'
    },
    {
      symptom: 'Images inconsistently over- or under-exposed',
      causes: [
        { cause: 'Wrong AEC chamber selection or positioning', note: 'User technique.' },
        { cause: 'AEC calibration drift', note: 'Check with phantoms.' },
        { cause: 'Detector calibration expired', note: 'Run calibration.' },
        { cause: 'Generator output fault', note: 'Check reproducibility.' }
      ],
      first: {
        prompt: 'What would you do first?',
        options: [
          { t: 'Review exposure index and AEC settings of affected images', correct: true, why: 'Evidence from recent images separates technique issues from equipment faults.' },
          { t: 'Replace the AEC chambers', correct: false, why: 'Unproven parts replacement.' },
          { t: 'Increase default mAs for all exams', correct: false, why: 'Increases dose and hides the cause.' },
          { t: 'Replace detector', correct: false, why: 'No evidence of detector fault.' }
        ]
      },
      measure: 'EI values, AEC field selection, phantom exposures at varying thicknesses.',
      decision: 'Technique issue → user training. Phantom inconsistency → AEC calibration → generator output.',
      repair: 'Recalibrate AEC or repair confirmed fault.',
      verify: 'AEC consistency test; document.'
    }
  ],
  errors: [
    { code: 'TRN-X101', desc: 'Anode rotor fault', causes: ['Rotor drive fault', 'Bearing wear', 'Stator cable'], component: 'tube', checks: ['Listen to spin-up', 'Check stator cable', 'Review log'], service: 'Model-specific procedure required.', verify: 'Test exposures; output check.', pm: 'Tube stand and housing inspection' },
    { code: 'TRN-X205', desc: 'kV out of range', causes: ['Inverter fault', 'HV cable arcing', 'Feedback drift'], component: 'generator', checks: ['Measure kV with meter', 'Inspect HV cables'], service: 'Model-specific procedure required.', verify: 'kV accuracy test.', pm: 'Generator performance' },
    { code: 'TRN-X310', desc: 'Detector not ready', causes: ['Battery low', 'Wireless link lost', 'Calibration expired'], component: 'detector', checks: ['Battery', 'Link status', 'Calibration status'], service: 'Charge/replace battery, re-pair, recalibrate.', verify: 'Test image received.', pm: 'Detector calibration' },
    { code: 'TRN-X415', desc: 'AEC backup time reached', causes: ['Wrong chamber selected', 'Chamber fault', 'Calibration drift'], component: 'aec', checks: ['Settings', 'Phantom test'], service: 'Calibrate AEC.', verify: 'AEC consistency test.', pm: 'Generator performance' },
    { code: 'TRN-X520', desc: 'Mains voltage low during exposure', causes: ['High line impedance', 'Loose terminal'], component: 'psu', checks: ['Measure voltage under load', 'Inspect terminals'], service: 'Repair terminals; refer supply to facilities.', verify: 'Exposure at high mA without error.', pm: 'Electrical safety and emergency off' },
    { code: 'TRN-X630', desc: 'DICOM send failure', causes: ['Network fault', 'Wrong AE title / port'], component: 'pacs', checks: ['C-ECHO', 'Configuration'], service: 'Correct configuration with IT.', verify: 'Test image received.', pm: 'DICOM connectivity check' }
  ],
  safety: [
    { title: 'High voltage discharge', level: 'danger', text: 'Generator capacitors and HV cables store lethal charge. Isolate, lock out and verify discharge before access.' },
    { title: 'Radiation protection', level: 'danger', text: 'Expose only from the protected area with the room cleared. Wear a dosimeter; use lead protection where required.' },
    { title: 'Interlocks', level: 'warning', text: 'Door and exposure interlocks must never be bypassed in clinical use; restore after any service test.' },
    { title: 'Lockout / tagout', level: 'warning', text: 'Apply LOTO at the room isolator before electrical work; mechanical stands and counterweights also store energy.' },
    { title: 'Release to service', level: 'info', text: 'Return to clinical use only after documented exposure tests following any generator, tube or AEC repair.' }
  ],
  tools: ['radMeter', 'esa', 'multimeter', 'powerAnalyzer', 'oscilloscope', 'dicomTools'],
  cases: ['noPower', 'poorImage', 'calibrationError', 'dicomFailure', 'networkFailure', 'incorrectMeasurement'],
  scenarios: ['xrayNoExposure'],
  artifacts: ['dr-detector', 'dr-exposure', 'dr-grid', 'dr-processing'],
  questions: [
    { q: 'What does the AEC do?', options: ['Sets kV', 'Terminates exposure at the required dose', 'Cools the tube', 'Sends images to PACS'], answer: 1, why: 'AEC chambers integrate dose and stop the exposure.', domain: 'knowledge' },
    { q: 'What is the purpose of the grid?', options: ['Increase dose', 'Absorb scattered radiation', 'Hold the patient', 'Cool the detector'], answer: 1, why: 'Scatter reduces contrast; the grid absorbs it.', domain: 'knowledge' },
    { q: 'Which instrument measures kV non-invasively?', options: ['Multimeter', 'Calibrated radiation meter', 'Thermometer', 'Manometer'], answer: 1, why: 'A non-invasive meter measures beam kV.', domain: 'technical' },
    { q: 'No exposure occurs. First check?', options: ['Replace generator', 'Console messages, interlocks and detector ready', 'Replace tube', 'Bypass interlock'], answer: 1, why: 'Simple, non-invasive checks first.', domain: 'troubleshooting' },
    { q: 'Grid lines appear on images. Likely cause?', options: ['Grid not moving or wrong SID', 'PACS fault', 'kV too high', 'Monitor fault'], answer: 0, why: 'Stationary or misfocused grids show lines or cut-off.', domain: 'troubleshooting' },
    { q: 'Before opening the generator you must…', options: ['Switch off console only', 'Isolate, lock out and verify discharge', 'Make a test exposure', 'Nothing'], answer: 1, why: 'Stored charge remains.', domain: 'safety' },
    { q: 'Light field does not match the X-ray field. Which test confirms it?', options: ['HVL', 'Light / X-ray field coincidence', 'C-ECHO', 'Reproducibility'], answer: 1, why: 'The coincidence test measures edge offsets.', domain: 'technical' },
    { q: 'Interlocks may be bypassed…', options: ['Whenever convenient', 'Never in clinical use; only per service procedure and restored before release', 'For busy days', 'If the user agrees'], answer: 1, why: 'Interlocks protect people.', domain: 'safety' },
    { q: 'After repairing the generator, what completes the job?', options: ['Return immediately', 'QA exposure tests and documentation', 'Restart only', 'Nothing'], answer: 1, why: 'Repair, verify, document.', domain: 'documentation' }
  ]
});

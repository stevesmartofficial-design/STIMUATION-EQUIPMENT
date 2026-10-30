/* Content pack: Computed Tomography (generic multi-slice CT scanner).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'ct',
  summary: 'A CT scanner rotates an X-ray tube and a curved detector array around the patient on a slip-ring gantry. Thousands of attenuation projections are digitised, transferred off the rotating frame and reconstructed into cross-sectional images. Service work combines high voltage, ionising radiation, heavy rotating mechanics and image-quality physics.',
  hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'IONISING RADIATION', type: 'rad' }],
  principle: [
    'A high-voltage generator powers the X-ray tube, producing a polychromatic X-ray beam.',
    'The bow-tie filter and collimator shape the beam into a thin fan or cone matched to the patient.',
    'The beam is attenuated by the patient; the detector array converts transmitted X-rays to electrical signals.',
    'The data acquisition system (DAS) digitises the signals; data and power cross the rotating interface via the slip ring.',
    'The reconstruction computer applies calibration corrections and filtered back-projection or iterative algorithms to build images in Hounsfield units (HU).',
    'Images are reviewed at the console and sent to PACS using DICOM.'
  ],
  parameters: [
    { name: 'Tube voltage', unit: 'kV', typical: 'Selected per protocol', note: 'Accuracy verified with a calibrated non-invasive meter' },
    { name: 'Tube current', unit: 'mA', typical: 'Selected / modulated', note: 'Dose modulation varies mA during rotation' },
    { name: 'Rotation time', unit: 's', typical: 'Sub-second to seconds', note: 'Faster rotation increases mechanical stress' },
    { name: 'Slice thickness', unit: 'mm', typical: 'Selected per protocol', note: 'Verified with a phantom' },
    { name: 'CT number (water)', unit: 'HU', typical: 'Close to 0 HU for water', note: 'Checked daily with the water phantom' },
    { name: 'CTDIvol', unit: 'mGy', typical: 'Displayed per scan', note: 'Displayed dose index compared to measured value' },
    { name: 'Tube heat / anode temperature', unit: '% or HU (heat units)', typical: 'Displayed by system', note: 'Model-specific procedure required' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 20, y: 30, w: 500, h: 210, label: 'HIGH VOLTAGE AREA', type: 'hv' },
      { x: 535, y: 30, w: 445, h: 330, label: 'RADIATION', type: 'rad' }
    ],
    nodes: [
      { id: 'gantry', x: 40, y: 70, w: 140, h: 54, label: 'Gantry' },
      { id: 'generator', x: 200, y: 70, w: 140, h: 54, label: 'HV generator' },
      { id: 'tube', x: 360, y: 70, w: 140, h: 54, label: 'X-ray tube' },
      { id: 'slipRing', x: 40, y: 165, w: 140, h: 54, label: 'Slip ring' },
      { id: 'cooling', x: 360, y: 165, w: 140, h: 54, label: 'Cooling system' },
      { id: 'bowtie', x: 555, y: 70, w: 140, h: 54, label: 'Bow-tie filter' },
      { id: 'collimator', x: 715, y: 70, w: 140, h: 54, label: 'Collimator' },
      { id: 'table', x: 820, y: 170, w: 140, h: 54, label: 'Patient table' },
      { id: 'detector', x: 650, y: 275, w: 150, h: 54, label: 'Detector array' },
      { id: 'das', x: 360, y: 290, w: 150, h: 54, label: 'DAS' },
      { id: 'recon', x: 360, y: 430, w: 150, h: 54, label: 'Reconstruction computer' },
      { id: 'console', x: 580, y: 430, w: 150, h: 54, label: 'Operator console' },
      { id: 'pacs', x: 800, y: 430, w: 150, h: 54, label: 'PACS / DICOM' }
    ],
    links: [
      ['gantry', 'slipRing', 'rotation'], ['slipRing', 'generator', 'power'], ['generator', 'tube', 'kV / mA'],
      ['cooling', 'tube', 'heat removal'], ['tube', 'bowtie', 'X-ray beam'], ['bowtie', 'collimator'],
      ['collimator', 'table', 'fan beam'], ['table', 'detector', 'attenuated beam'],
      ['detector', 'das', 'analogue signal'], ['das', 'slipRing', 'digital data'], ['slipRing', 'recon', 'raw data'],
      ['recon', 'console', 'images'], ['console', 'pacs', 'DICOM'], ['console', 'gantry', 'scan control']
    ]
  },
  components: {
    gantry: {
      name: 'Gantry', function: 'Houses and rotates the imaging chain (tube, generator, detector, DAS) around the patient.',
      principle: 'A large bearing-mounted rotor is driven by a motor and belt or direct drive; encoders report angular position for each projection.',
      input: 'Scan commands, drive power', output: 'Controlled rotation, angle data, tilt',
      normal: 'Smooth, quiet rotation at the selected speed; no vibration alarms; covers and interlocks intact.',
      failure: 'Bearing wear, drive belt wear, encoder fault, rotor imbalance, cover interlock fault.',
      symptoms: 'Rotation noise or vibration, rotation-speed errors, motion-like artefacts, scan aborts.',
      test: 'Review rotation and encoder logs in service mode; listen at speed; check belt tension and condition with power isolated.',
      service: 'Inspect and tension belt, clean, check bearing noise and vibration trend; balance and bearing work are model-specific.',
      safety: 'Rotating mass — never enter the gantry with the rotor enabled. Apply rotor lock and LOTO before opening covers.',
      spares: ['Drive belt', 'Position encoder', 'Cover interlock switch'], pm: ['Gantry rotation inspection', 'Covers and interlocks'], qa: ['Laser / table alignment']
    },
    tube: {
      name: 'X-ray tube', function: 'Produces the X-ray beam used for imaging.',
      principle: 'Electrons from a heated filament are accelerated by kV onto a rotating anode; their deceleration produces X-rays and a large amount of heat.',
      input: 'High voltage, filament current, anode drive', output: 'X-ray beam, heat',
      normal: 'Stable output; no arcing; heat dissipates within expected cooling time; seasoning passes.',
      failure: 'Filament burnout, anode bearing wear, arcing (gas, vacuum loss), housing oil leak.',
      symptoms: 'Arc / spit errors, tube-rotation noise, scan aborts, streaks or reduced output.',
      test: 'Review arc counter and tube logs; run tube seasoning/warm-up; measure kV and output with a calibrated meter.',
      service: 'Tube replacement and calibration are model-specific; after replacement perform full calibration and QA.',
      safety: 'Stored high voltage in cables; hot housing; heavy assembly requires lifting aid.',
      spares: ['X-ray tube assembly', 'HV cable'], pm: ['Tube warm-up and seasoning', 'Inspect tube housing for oil'], qa: ['kV accuracy', 'Dose index (CTDI)']
    },
    generator: {
      name: 'HV generator', function: 'Supplies the precise high voltage and tube current to the X-ray tube.',
      principle: 'High-frequency inverter and HV tank rectify and multiply voltage; closed-loop feedback holds kV and mA.',
      input: 'DC bus power via slip ring, exposure commands', output: 'Tube kV and mA',
      normal: 'kV and mA follow commanded values; no arc or over-current events.',
      failure: 'Inverter IGBT failure, HV tank breakdown, feedback divider drift, cable arcing.',
      symptoms: 'Exposure errors, kV out of tolerance, HV arc errors, scans abort.',
      test: 'Compare set and measured kV with a non-invasive meter; review generator error log.',
      service: 'Internal repair is model-specific; inspect HV cables and terminations with power isolated and discharged.',
      safety: 'Lethal voltages. Isolate, lock out and confirm discharge with the specified tool before any access.',
      spares: ['Inverter module', 'HV tank', 'HV cable'], pm: ['HV cable and terminal inspection'], qa: ['kV accuracy', 'Dose index (CTDI)']
    },
    collimator: {
      name: 'Collimator', function: 'Defines the beam width (z-coverage) and prevents unnecessary exposure.',
      principle: 'Motor-driven high-attenuation blades shape the fan beam; position feedback ensures beam is centred on the detector.',
      input: 'Beam, aperture commands', output: 'Shaped beam',
      normal: 'Blades move to commanded positions; beam centred on detector.',
      failure: 'Blade motor or sensor fault, mechanical sticking, calibration drift.',
      symptoms: 'Collimator errors, incorrect slice width, uneven image noise across slices.',
      test: 'Run collimator self-test; measure slice thickness / beam width with a phantom or film.',
      service: 'Clean and recalibrate per service manual; replacement is model-specific.',
      safety: 'Radiation — test exposures only in a controlled area with shielding.',
      spares: ['Collimator motor', 'Position sensor'], pm: [], qa: ['Slice thickness']
    },
    bowtie: {
      name: 'Bow-tie filter', function: 'Equalises beam intensity across the patient and reduces surface dose.',
      principle: 'A shaped filter is thinner at the centre and thicker at the edges, matching the round body cross-section.',
      input: 'Raw X-ray beam', output: 'Shaped, hardened beam',
      normal: 'Correct filter selected for the scan field of view.',
      failure: 'Wrong filter position, mechanical damage, calibration mismatch.',
      symptoms: 'Uneven HU across field, edge artefacts, calibration errors.',
      test: 'Check uniformity with water phantom at each field of view; review filter position log.',
      service: 'Filter position calibration after any work on the beam path.',
      safety: 'Radiation — do not run exposures with covers removed outside service protocol.',
      spares: ['Filter drive assembly'], pm: [], qa: ['CT number uniformity']
    },
    detector: {
      name: 'Detector array', function: 'Converts transmitted X-rays into electrical signals.',
      principle: 'Scintillator elements convert X-rays to light; photodiodes convert light to current; anti-scatter grid rejects scatter.',
      input: 'Attenuated X-ray beam', output: 'Analogue signals per channel',
      normal: 'Uniform channel response after calibration; temperature stable.',
      failure: 'Dead or drifting channels, temperature control fault, module damage.',
      symptoms: 'Ring artefacts, bands, calibration failures.',
      test: 'Air and water calibration; review channel gain/offset maps in service mode; check detector temperature.',
      service: 'Recalibrate; module replacement is model-specific and followed by full calibration.',
      safety: 'ESD-sensitive. Temperature-sensitive — keep room conditions within specification.',
      spares: ['Detector module'], pm: ['Air calibration'], qa: ['CT number uniformity', 'Image noise']
    },
    das: {
      name: 'Data acquisition system (DAS)', function: 'Amplifies and digitises detector signals for each projection.',
      principle: 'Low-noise integrators and ADCs sample every channel at each view, triggered by the encoder.',
      input: 'Detector signals, view trigger', output: 'Digital projection data',
      normal: 'Low offset noise; no missing views.',
      failure: 'ADC board fault, connector problem, noise pickup, timing errors.',
      symptoms: 'Rings, streaks, missing data, DAS communication errors.',
      test: 'Review offset (dark) scans and noise reports; inspect connectors.',
      service: 'Reseat or replace boards per service manual; recalibrate.',
      safety: 'ESD protection; rotor locked and power isolated before access.',
      spares: ['DAS board'], pm: [], qa: ['Image noise']
    },
    slipRing: {
      name: 'Slip ring', function: 'Transfers power and data between the stationary and rotating gantry.',
      principle: 'Brushes on conductive rings carry power; data uses contactless optical or capacitive/RF links.',
      input: 'Stationary power and control', output: 'Power and data across rotation',
      normal: 'Clean track, brushes within wear limit, no data errors.',
      failure: 'Brush wear, carbon dust build-up, track damage, data link errors.',
      symptoms: 'Intermittent power loss during rotation, data transfer errors, scan aborts.',
      test: 'Inspect brushes and track with power isolated; review data-link error counters.',
      service: 'Clean track with approved method, replace brushes per wear limit.',
      safety: 'High voltage and rotating parts; LOTO and confirm discharge.',
      spares: ['Brush block', 'Data link module'], pm: ['Slip ring and brush inspection'], qa: []
    },
    cooling: {
      name: 'Cooling system', function: 'Removes heat from the tube, generator and detector.',
      principle: 'Oil-to-air or oil-to-water heat exchanger with pumps and fans; chilled water may be supplied from the building.',
      input: 'Heat load, coolant supply', output: 'Controlled temperatures',
      normal: 'Temperatures stable; fans and pumps running; filters clean.',
      failure: 'Blocked filters, fan or pump failure, low coolant, chiller fault.',
      symptoms: 'Tube cooling waits, over-temperature errors, scan delays.',
      test: 'Check temperature logs, filter condition, flow and fan operation.',
      service: 'Clean or replace filters, check coolant level and flow.',
      safety: 'Hot surfaces and oil; isolate before opening.',
      spares: ['Air filter', 'Cooling fan', 'Pump'], pm: ['Cooling filters'], qa: []
    },
    table: {
      name: 'Patient table', function: 'Positions and moves the patient through the gantry.',
      principle: 'Motorised vertical and horizontal drives with position encoders, synchronised with acquisition for helical scans.',
      input: 'Position commands, patient load', output: 'Accurate patient position',
      normal: 'Smooth motion; positional accuracy; emergency stop functional.',
      failure: 'Drive wear, encoder fault, cradle damage.',
      symptoms: 'Position errors, jerky movement, misregistration.',
      test: 'Measure table travel against a ruler under load; test emergency stop.',
      service: 'Lubricate and inspect per service manual; recalibrate position.',
      safety: 'Pinch and crush points; respect load limit.',
      spares: ['Drive motor', 'Encoder'], pm: ['Table motion and emergency stop'], qa: ['Table positioning accuracy']
    },
    recon: {
      name: 'Reconstruction computer', function: 'Corrects raw data and reconstructs images.',
      principle: 'Applies offset, gain, beam-hardening and other corrections, then filtered back-projection or iterative reconstruction.',
      input: 'Raw projection data', output: 'Image slices in HU',
      normal: 'Reconstruction completes in expected time; no errors.',
      failure: 'Disk full, memory or GPU failure, software fault.',
      symptoms: 'Slow or failed reconstruction, missing images.',
      test: 'Review system logs, disk space and hardware diagnostics.',
      service: 'Clear temporary data per procedure; hardware or software restore is model-specific.',
      safety: 'Back up configuration and calibration data before changes.',
      spares: ['Hard disk', 'Reconstruction board'], pm: ['Disk and log review'], qa: []
    },
    console: {
      name: 'Operator console', function: 'User interface for protocols, scanning and image review.',
      principle: 'Workstation running the scanner application; communicates with gantry and reconstruction subsystems.',
      input: 'User commands, images', output: 'Scan control, displayed images',
      normal: 'Application starts cleanly; exposure indicators and emergency stop work.',
      failure: 'Software crash, network link fault to subsystems.',
      symptoms: 'Freezes, communication errors, cannot start scan.',
      test: 'Check logs; verify subsystem communication status.',
      service: 'Restart per procedure; software reinstall is model-specific.',
      safety: 'Radiation warning lights and door interlocks must function.',
      spares: ['Workstation', 'Monitor'], pm: ['Warning lights and emergency stop'], qa: []
    },
    pacs: {
      name: 'PACS / DICOM', function: 'Stores and distributes images.',
      principle: 'DICOM storage, worklist and storage-commitment services over the hospital network.',
      input: 'DICOM images', output: 'Archived images available to clinicians',
      normal: 'Images arrive complete; worklist populates.',
      failure: 'Network fault, AE title / port misconfiguration, archive full.',
      symptoms: 'Send failures, missing series, empty worklist.',
      test: 'DICOM echo (C-ECHO); check AE title, IP, port; review send queue.',
      service: 'Correct configuration with PACS/IT team; re-send queued studies.',
      safety: 'Patient data privacy — follow hospital information-security policy.',
      spares: [], pm: ['DICOM connectivity check'], qa: []
    }
  },
  workflow: [
    { title: 'Scan setup', active: ['console', 'table'], what: 'Operator selects protocol and positions the patient using lasers and table motion.', signal: 'Protocol parameters, table position', parameter: 'kV, mA, pitch, slice thickness', fail: 'Table encoder error, wrong protocol.' },
    { title: 'Gantry rotation', active: ['gantry', 'slipRing'], what: 'Rotor accelerates to the selected speed before exposure.', signal: 'Encoder angle pulses', parameter: 'Rotation time', fail: 'Belt slip, bearing noise, speed error.' },
    { title: 'Power transfer', active: ['slipRing', 'generator'], what: 'DC power crosses the slip ring to the rotating generator.', signal: 'DC bus voltage', parameter: 'Bus voltage', fail: 'Worn brushes, intermittent power.' },
    { title: 'High voltage generation', active: ['generator', 'tube'], what: 'Generator produces kV and mA; tube anode spins up.', signal: 'kV / mA feedback', parameter: 'kV, mA', fail: 'Arcing, inverter fault.' },
    { title: 'X-ray production', active: ['tube', 'cooling'], what: 'Electrons strike the anode producing X-rays and heat; cooling removes heat.', signal: 'Tube heat status', parameter: 'Anode heat', fail: 'Overheating, cooling wait.' },
    { title: 'Beam shaping', active: ['bowtie', 'collimator'], what: 'Bow-tie filter equalises intensity; collimator sets beam width.', signal: 'Blade position', parameter: 'Beam width', fail: 'Collimator error, wrong filter.' },
    { title: 'Patient attenuation', active: ['table', 'detector'], what: 'Beam passes through the patient as the table moves.', signal: 'Table / angle synchronisation', parameter: 'Pitch', fail: 'Patient motion artefact.' },
    { title: 'Detection', active: ['detector', 'das'], what: 'Detector converts X-rays to signals; DAS digitises each view.', signal: 'Channel data per view', parameter: 'Offset, gain, noise', fail: 'Bad channel causes ring artefact.' },
    { title: 'Data transfer', active: ['das', 'slipRing', 'recon'], what: 'Projection data crosses the slip ring data link to the reconstruction computer.', signal: 'Data link packets', parameter: 'Link error count', fail: 'Data link errors, lost views.' },
    { title: 'Reconstruction', active: ['recon'], what: 'Calibration corrections and reconstruction produce images in HU.', signal: 'Raw to image data', parameter: 'HU, noise', fail: 'Disk or hardware fault, slow recon.' },
    { title: 'Review and archive', active: ['console', 'pacs'], what: 'Images reviewed and sent to PACS via DICOM.', signal: 'DICOM association', parameter: 'Transfer status', fail: 'Network or AE title misconfiguration.' }
  ],
  operation: [
    { step: 'Daily start-up', detail: 'Start system per procedure, run tube warm-up and air calibration as prompted.' },
    { step: 'Daily QA', detail: 'Scan the water phantom and review CT number, noise and uniformity results.' },
    { step: 'Patient setup', detail: 'Register patient from worklist, position with lasers, check radiation protection measures.' },
    { step: 'Scan', detail: 'Select protocol, acquire scout, plan and acquire scan; observe exposure indicators.' },
    { step: 'Reconstruct and review', detail: 'Check images for artefacts; reconstruct additional series if required.' },
    { step: 'Archive and report faults', detail: 'Send to PACS; record any errors in the work-order system with error codes and time.' }
  ],
  pm: {
    daily: [
      { task: 'Tube warm-up and air calibration', why: 'Stabilises the tube and updates detector offset/gain for uniform images.', tools: 'Built-in software', safety: 'Room clear, door closed', procedure: 'Run the warm-up and calibration routine from the console.', criteria: 'Routine completes without errors.' },
      { task: 'Water phantom check', why: 'Detects drift in CT number, noise and uniformity early.', tools: 'Water phantom', safety: 'Controlled area; no persons in room', procedure: 'Scan phantom with the QA protocol and review results.', criteria: 'Results within hospital-configured limits.' }
    ],
    weekly: [
      { task: 'Warning lights and emergency stop', why: 'Protects staff and patients during exposure.', tools: 'Visual', safety: 'Test without patient', procedure: 'Check exposure warning lights, door interlock and emergency stop function.', criteria: 'All indicators and stops work.' }
    ],
    monthly: [
      { task: 'Cooling filters', why: 'Blocked filters cause overheating and scan delays.', tools: 'Vacuum, replacement filters', safety: 'Isolate fans before access', procedure: 'Inspect and clean or replace air filters.', criteria: 'Filters clean, airflow unobstructed.' },
      { task: 'Disk and log review', why: 'Trends reveal developing faults.', tools: 'Service software', safety: 'Do not delete patient data', procedure: 'Review error logs, arc counters, disk space.', criteria: 'No unexplained recurring errors.' }
    ],
    quarterly: [
      { task: 'Table motion and emergency stop', why: 'Positional accuracy affects image registration and safety.', tools: 'Ruler, test weights', safety: 'Pinch points', procedure: 'Measure travel under load; test stops and limit switches.', criteria: 'Within configured limits.' },
      { task: 'DICOM connectivity check', why: 'Lost images delay diagnosis.', tools: 'DICOM tools', safety: 'Data privacy', procedure: 'C-ECHO to PACS and worklist; verify test study transfer.', criteria: 'Successful association and complete transfer.' }
    ],
    halfyearly: [
      { task: 'Gantry rotation inspection', why: 'Belt and bearing wear cause vibration and failure.', tools: 'Service mode, torch', safety: 'Rotor lock, LOTO', procedure: 'Inspect belt, bearing noise, fasteners; review vibration logs.', criteria: 'No abnormal noise or wear beyond limit.' },
      { task: 'Slip ring and brush inspection', why: 'Worn brushes cause intermittent power and data errors.', tools: 'Approved cleaning kit', safety: 'HV isolated and discharged', procedure: 'Inspect brushes and track; clean per service manual.', criteria: 'Brushes within wear limit.' }
    ],
    annual: [
      { task: 'Radiation output and kV accuracy', why: 'Confirms generator performance and patient dose.', tools: 'Radiation meter', safety: 'Radiation protection', procedure: 'Measure kV, dose and CTDI per QA tab.', criteria: 'Within hospital-configured limits.' },
      { task: 'Full image-quality QA', why: 'Verifies diagnostic image quality.', tools: 'CT phantom', safety: 'Controlled area', procedure: 'Run all QA tests and record.', criteria: 'All tests within configured limits.' },
      { task: 'Electrical safety and HV cable inspection', why: 'Prevents shock and arcing.', tools: 'Electrical safety analyzer, multimeter', safety: 'LOTO and discharge', procedure: 'Inspect HV cables and earth bonds; perform electrical safety tests.', criteria: 'Per hospital protocol based on applicable standard.' }
    ]
  },
  qa: [
    { id: 'hu', test: 'CT number accuracy (water)', setup: 'Water phantom centred; standard head/body protocol.', measure: 'Mean HU in central ROI', unit: 'HU', example: 'Deviation of measured water HU from expected value', report: 'Mean and SD of ROI' },
    { id: 'uniformity', test: 'CT number uniformity', setup: 'Water phantom; centre and four peripheral ROIs.', measure: 'Mean HU per ROI', unit: 'HU', example: 'Difference between peripheral and central ROI means', report: 'ROI table' },
    { id: 'noise', test: 'Image noise', setup: 'Water phantom with fixed protocol.', measure: 'SD of HU in central ROI', unit: 'HU', example: 'Measured noise compared with baseline', report: 'Trend against baseline' },
    { id: 'slice', test: 'Slice thickness', setup: 'Phantom with ramp or wire insert.', measure: 'FWHM of slice profile', unit: 'mm', example: 'Measured vs nominal slice thickness', report: 'Set vs measured' },
    { id: 'kv', test: 'kV accuracy', setup: 'Non-invasive meter on table in stationary mode (service).', measure: 'Measured kV', unit: 'kV', example: 'Deviation of measured kV from set kV', report: 'Set vs measured' },
    { id: 'ctdi', test: 'Dose index (CTDI)', setup: 'CTDI phantom and pencil chamber.', measure: 'CTDIvol', unit: 'mGy', example: 'Measured CTDIvol compared with displayed value', report: 'Displayed vs measured' },
    { id: 'laser', test: 'Laser / table alignment', setup: 'Alignment phantom; scan at laser position.', measure: 'Offset of laser to image plane', unit: 'mm', example: 'Distance between laser mark and scan plane', report: 'Offset' },
    { id: 'tablepos', test: 'Table positioning accuracy', setup: 'Loaded table; ruler.', measure: 'Actual vs commanded travel', unit: 'mm', example: 'Deviation of measured travel from commanded travel', report: 'Set vs measured' }
  ],
  troubleshoot: [
    {
      symptom: 'Ring artefacts in images',
      causes: [
        { cause: 'Calibration out of date', note: 'Most common and least invasive.' },
        { cause: 'Detector temperature unstable', note: 'Check room and detector temperature logs.' },
        { cause: 'Defective detector channel or module', note: 'Confirm with channel maps.' },
        { cause: 'DAS board or connector fault', note: 'After detector is ruled out.' }
      ],
      first: {
        prompt: 'What would you do first?',
        options: [
          { t: 'Replace the detector module', correct: false, why: 'Very expensive and unproven — you have no evidence of a module fault yet.' },
          { t: 'Run air calibration and rescan the water phantom', correct: true, why: 'Out-of-date calibration is the commonest cause; it is quick, non-invasive and confirms whether the ring persists.' },
          { t: 'Replace the X-ray tube', correct: false, why: 'Tube faults rarely produce rings; rings are a detector-channel signature.' },
          { t: 'Reinstall software', correct: false, why: 'No evidence of a software fault, and it may destroy calibration data.' }
        ]
      },
      measure: 'Water phantom HU and uniformity before and after calibration; detector temperature; channel gain map.',
      decision: 'Ring clears → monitor. Persists → check temperature → identify channel location → inspect module/DAS connection.',
      repair: 'Correct the confirmed cause (e.g. room temperature, reseat connector, model-specific module replacement).',
      verify: 'Water phantom QA pass; review clinical images; document.'
    },
    {
      symptom: 'Scan aborts with tube arc errors',
      causes: [
        { cause: 'Tube not warmed up / seasoning needed', note: 'Common after idle periods.' },
        { cause: 'HV cable or termination fault', note: 'Inspect with power isolated.' },
        { cause: 'Tube nearing end of life', note: 'Arc counter trend.' },
        { cause: 'Generator fault', note: 'After tube and cables are evaluated.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Review error log and arc counter trend, then run tube seasoning', correct: true, why: 'Logs provide evidence and seasoning resolves arcing caused by idle tubes without opening anything.' },
          { t: 'Replace the generator', correct: false, why: 'Expensive and unproven.' },
          { t: 'Replace the slip ring', correct: false, why: 'No evidence links arcing to the slip ring.' },
          { t: 'Increase kV to compensate', correct: false, why: 'Raises stress on the tube and increases patient dose.' }
        ]
      },
      measure: 'Arc count per scan, kV accuracy, cable insulation condition.',
      decision: 'Arcing stops after seasoning → monitor. Persists at specific kV → inspect cables → evaluate tube.',
      repair: 'Model-specific procedure required for tube or cable replacement.',
      verify: 'kV accuracy, dose output and full image QA; document.'
    }
  ],
  errors: [
    { code: 'TRN-C101', desc: 'HV arc detected during exposure', causes: ['Tube needs seasoning', 'HV cable fault', 'Tube end of life'], component: 'tube', checks: ['Review arc counter', 'Run seasoning', 'Inspect HV cables'], service: 'Model-specific procedure required.', verify: 'kV accuracy and image QA.', pm: 'Tube warm-up and seasoning' },
    { code: 'TRN-C214', desc: 'Gantry rotation speed error', causes: ['Belt worn or slipping', 'Encoder fault', 'Drive fault'], component: 'gantry', checks: ['Inspect belt', 'Review encoder log', 'Listen for bearing noise'], service: 'Adjust or replace belt per service manual.', verify: 'Rotation test at all speeds; phantom scan.', pm: 'Gantry rotation inspection' },
    { code: 'TRN-C305', desc: 'Detector temperature out of range', causes: ['Room temperature high', 'Cooling fan failure', 'Heater fault'], component: 'detector', checks: ['Room temperature', 'Detector temperature log', 'Fan operation'], service: 'Restore environment / cooling; recalibrate.', verify: 'Air calibration and water phantom.', pm: 'Cooling filters' },
    { code: 'TRN-C412', desc: 'Slip ring data link error', causes: ['Dirty or damaged track', 'Data link module fault'], component: 'slipRing', checks: ['Link error counter', 'Inspect track and brushes'], service: 'Clean per service manual; module replacement is model-specific.', verify: 'Repeated rotation scans without errors.', pm: 'Slip ring and brush inspection' },
    { code: 'TRN-C520', desc: 'Tube cooling wait — heat limit', causes: ['Blocked filters', 'Fan or pump failure', 'High workload'], component: 'cooling', checks: ['Filter condition', 'Fan / pump operation', 'Temperature log'], service: 'Clean filters; repair cooling fault.', verify: 'Cooling time normal under workload.', pm: 'Cooling filters' },
    { code: 'TRN-C630', desc: 'DICOM send failure', causes: ['Network fault', 'Wrong AE title / port', 'Archive unavailable'], component: 'pacs', checks: ['C-ECHO', 'Configuration review', 'Network link'], service: 'Correct configuration with IT.', verify: 'Test study received complete.', pm: 'DICOM connectivity check' }
  ],
  safety: [
    { title: 'High voltage discharge', level: 'danger', text: 'Generator, HV cables and tube store lethal charge. Isolate, lock out and verify discharge with the manufacturer-specified tool before access.' },
    { title: 'Ionising radiation', level: 'danger', text: 'Make exposures only from behind shielding with the room cleared and warning lights active. Wear a personal dosimeter.' },
    { title: 'Interlocks', level: 'warning', text: 'Never bypass door, cover or emergency-stop interlocks except as described in the service procedure, and restore them before release.' },
    { title: 'Lockout / tagout and rotating parts', level: 'warning', text: 'Apply LOTO and the rotor lock before working inside the gantry. The rotor carries a large stored mass.' },
    { title: 'Release to service', level: 'info', text: 'Return to clinical use only after documented calibration and image-quality QA following any beam-path repair.' }
  ],
  tools: ['radMeter', 'ctPhantom', 'esa', 'multimeter', 'oscilloscope', 'dicomTools'],
  cases: ['poorImage', 'overheating', 'mechanicalNoise', 'dicomFailure', 'calibrationError', 'intermittentShutdown'],
  scenarios: ['ctGantry'],
  artifacts: ['ct-ring', 'ct-motion', 'ct-beamhard', 'ct-noise'],
  questions: [
    { q: 'Which component transfers power and data to the rotating gantry?', options: ['Collimator', 'Slip ring', 'Bow-tie filter', 'Table'], answer: 1, why: 'The slip ring allows continuous rotation while carrying power and data.', domain: 'knowledge' },
    { q: 'What is the function of the bow-tie filter?', options: ['Increase kV', 'Equalise beam intensity across the patient', 'Store images', 'Cool the tube'], answer: 1, why: 'It attenuates the edges more than the centre, matching body shape.', domain: 'knowledge' },
    { q: 'Ring artefacts usually point to…', options: ['Patient motion', 'Detector channel / calibration issues', 'PACS fault', 'Table speed'], answer: 1, why: 'A channel with wrong gain traces a circle as the gantry rotates.', domain: 'technical' },
    { q: 'Ring artefacts appear. First action?', options: ['Replace detector', 'Run air calibration and rescan water phantom', 'Replace tube', 'Reinstall software'], answer: 1, why: 'Least invasive, evidence-based step first.', domain: 'troubleshooting' },
    { q: 'Which instrument verifies kV accuracy?', options: ['Multimeter on the console', 'Calibrated non-invasive radiation meter', 'Oscilloscope on mains', 'Thermometer'], answer: 1, why: 'A non-invasive kV meter measures the beam directly.', domain: 'technical' },
    { q: 'Before opening the HV generator you must…', options: ['Only switch off the console', 'Isolate, lock out and verify discharge', 'Run a scan', 'Remove the table'], answer: 1, why: 'Stored charge remains after switch-off.', domain: 'safety' },
    { q: 'Which unit expresses CT image values?', options: ['mGy', 'Hounsfield units', 'kV', 'mm'], answer: 1, why: 'CT numbers are in HU, with water near 0.', domain: 'knowledge' },
    { q: 'Scan aborts with arc errors after a long idle period. First step?', options: ['Replace generator', 'Review log and run tube seasoning', 'Increase kV', 'Replace slip ring'], answer: 1, why: 'Seasoning addresses arcing in idle tubes without invasive work.', domain: 'troubleshooting' },
    { q: 'After replacing a detector module, what completes the job?', options: ['Return to service immediately', 'Calibration, image QA and documentation', 'Restart only', 'Nothing'], answer: 1, why: 'Repair, verify, document.', domain: 'documentation' },
    { q: 'Where should CT QA acceptance limits come from?', options: ['A forum', 'Hospital-approved protocol based on manufacturer documentation and applicable standards', 'Memory', 'Default guesses'], answer: 1, why: 'Limits vary by model and jurisdiction.', domain: 'documentation' }
  ]
});

/* Content pack: Multiparameter Patient Monitor (generic bedside monitor).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'patientMonitor',
  summary: 'A multiparameter patient monitor acquires physiological signals (ECG, SpO₂, NIBP, invasive pressure, temperature, EtCO₂) through isolated applied parts, processes them into numerics and waveforms, compares them with alarm limits and forwards data to a central station. Measurement accuracy and alarm integrity are both patient-safety critical.',
  hazards: [{ label: 'PATIENT-CONNECTED APPLIED PARTS', type: 'patient' }],
  principle: [
    'Each parameter has a dedicated front-end that converts a physiological quantity into an electrical signal.',
    'Front-ends are galvanically isolated from mains so leakage through the patient stays very low.',
    'Signals are filtered, digitised and analysed into numerics (HR, SpO₂, BP, temperature, EtCO₂).',
    'An alarm engine compares values with limits and detects technical faults (lead-off, sensor-off).',
    'Data are displayed locally and sent over the network to a central station and records.'
  ],
  parameters: [
    { name: 'Heart rate', unit: 'bpm', typical: 'Measured', note: 'Verify with patient simulator at several rates' },
    { name: 'SpO₂', unit: '%', typical: 'Measured', note: 'Simulator checks function; true accuracy needs clinical validation' },
    { name: 'NIBP', unit: 'mmHg', typical: 'Measured', note: 'Static pressure accuracy checked with reference manometer' },
    { name: 'Invasive pressure', unit: 'mmHg', typical: 'Measured', note: 'Zero and gain checked with simulator' },
    { name: 'Temperature', unit: '°C', typical: 'Measured', note: 'Checked with temperature simulator' },
    { name: 'EtCO₂', unit: 'mmHg / %', typical: 'Measured', note: 'Checked with certified calibration gas' },
    { name: 'Alarm volume / priority', unit: '—', typical: 'Configured', note: 'Hospital alarm policy defines settings' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 20, y: 20, w: 200, h: 440, label: 'ISOLATED APPLIED PARTS', type: 'patient' }
    ],
    nodes: [
      { id: 'ecgFront', x: 40, y: 40, w: 160, h: 54, label: 'ECG front-end' },
      { id: 'spo2', x: 40, y: 110, w: 160, h: 54, label: 'SpO₂ module' },
      { id: 'nibp', x: 40, y: 180, w: 160, h: 54, label: 'NIBP pump / valve' },
      { id: 'ibp', x: 40, y: 250, w: 160, h: 54, label: 'Invasive pressure' },
      { id: 'temp', x: 40, y: 320, w: 160, h: 54, label: 'Temperature' },
      { id: 'etco2', x: 40, y: 390, w: 160, h: 54, label: 'EtCO₂ (capnography)' },
      { id: 'mainPcb', x: 400, y: 215, w: 150, h: 54, label: 'Main PCB / CPU' },
      { id: 'display', x: 660, y: 80, w: 150, h: 54, label: 'Display / UI' },
      { id: 'alarm', x: 660, y: 215, w: 150, h: 54, label: 'Alarm system' },
      { id: 'network', x: 660, y: 350, w: 160, h: 54, label: 'Network / central' },
      { id: 'psu', x: 400, y: 470, w: 150, h: 54, label: 'Power supply' },
      { id: 'battery', x: 660, y: 470, w: 150, h: 54, label: 'Battery' }
    ],
    links: [
      ['ecgFront', 'mainPcb', 'ECG'], ['spo2', 'mainPcb', 'SpO₂'], ['nibp', 'mainPcb', 'cuff P'],
      ['ibp', 'mainPcb', 'IBP'], ['temp', 'mainPcb', 'temp'], ['etco2', 'mainPcb', 'CO₂'],
      ['mainPcb', 'display'], ['mainPcb', 'alarm'], ['mainPcb', 'network', 'LAN / wireless'],
      ['psu', 'battery'], ['psu', 'mainPcb', 'DC'], ['battery', 'mainPcb', 'backup']
    ]
  },
  components: {
    ecgFront: {
      name: 'ECG front-end', function: 'Acquires the cardiac electrical signal from skin electrodes.',
      principle: 'Isolated differential instrumentation amplifier with right-leg drive, defibrillation protection and filtering; QRS detection gives heart rate.',
      input: 'mV-level body-surface potentials', output: 'Digitised ECG leads, HR',
      normal: 'Clean trace on simulator; HR matches simulator; lead-off detected correctly.',
      failure: 'Broken lead wires, damaged trunk cable, front-end damage after defibrillation, poor electrodes.',
      symptoms: 'Noisy or flat trace, lead-off alarms, wrong HR, 50/60 Hz interference.',
      test: 'Connect patient simulator; check each lead, HR at several rates, lead-off detection; inspect cable continuity.',
      service: 'Replace cable or lead set first when evidence points there; module replacement per service manual.',
      safety: 'Applied part — leakage testing required after repair; use only defibrillation-proof cables.',
      spares: ['ECG trunk cable', 'Lead set'], pm: ['Cable inspection', 'ECG simulator check'], qa: ['ECG / heart-rate accuracy']
    },
    spo2: {
      name: 'SpO₂ module', function: 'Measures arterial oxygen saturation and pulse rate non-invasively.',
      principle: 'Red and infrared LEDs shine through tissue; photodiode detects pulsatile absorption; ratio of ratios maps to SpO₂ via a calibration curve.',
      input: 'Light through perfused tissue', output: 'SpO₂, pulse rate, pleth waveform',
      normal: 'Reads simulator values; stable pleth; sensor-off alarm works.',
      failure: 'Damaged sensor/cable, LED ageing, ambient light, poor perfusion, module fault.',
      symptoms: 'No reading, "sensor off", erratic SpO₂, low signal quality.',
      test: 'Use SpO₂ simulator at several saturation levels; substitute known-good sensor and extension cable.',
      service: 'Replace sensor/cable on evidence; module per service manual.',
      safety: 'Sensor sites can suffer pressure injury or burns if incompatible sensors are used — use approved sensors only.',
      spares: ['SpO₂ sensor', 'SpO₂ extension cable'], pm: ['SpO₂ simulator check'], qa: ['SpO₂ functional check']
    },
    nibp: {
      name: 'NIBP pump / valve / transducer', function: 'Measures blood pressure non-invasively with an inflatable cuff.',
      principle: 'Pump inflates cuff; valve deflates in steps; transducer senses cuff pressure oscillations; oscillometric algorithm estimates systolic, mean and diastolic.',
      input: 'Cuff pressure oscillations', output: 'Systolic / diastolic / mean pressure',
      normal: 'Static pressure matches reference manometer; leak rate low; overpressure protection works.',
      failure: 'Hose/cuff leak, pump wear, valve sticking, transducer drift.',
      symptoms: 'Inflation timeout, repeated measurements, "cuff leak", inaccurate readings.',
      test: 'Static pressure check vs reference manometer; leak test; overpressure test; NIBP simulator.',
      service: 'Replace leaking hose/cuff first; calibrate transducer in service mode; replace pump/valve per manual.',
      safety: 'Overpressure protection protects the patient’s limb — always verify after NIBP service.',
      spares: ['NIBP hose', 'Cuff set', 'Pump/valve assembly'], pm: ['NIBP leak and pressure check'], qa: ['NIBP static pressure accuracy', 'NIBP overpressure protection']
    },
    ibp: {
      name: 'Invasive pressure (IBP)', function: 'Displays arterial or venous pressure from an external transducer.',
      principle: 'Disposable strain-gauge transducer forms a Wheatstone bridge; monitor supplies excitation and measures bridge output after zeroing.',
      input: 'Transducer bridge signal', output: 'Pressure waveform and numerics',
      normal: 'Zero succeeds; simulator pressures displayed correctly.',
      failure: 'Interface cable fault, module amplifier fault, zero failure.',
      symptoms: 'Cannot zero, flat or offset waveform.',
      test: 'Connect IBP simulator; zero; apply static and dynamic pressures; compare.',
      service: 'Replace interface cable on evidence; module per service manual.',
      safety: 'Direct connection to circulation via fluid line — isolation integrity essential.',
      spares: ['IBP interface cable'], pm: ['IBP simulator check'], qa: ['IBP accuracy']
    },
    temp: {
      name: 'Temperature module', function: 'Measures body temperature from a probe.',
      principle: 'Thermistor probe resistance varies with temperature; module converts resistance to temperature.',
      input: 'Probe resistance', output: 'Temperature reading',
      normal: 'Matches temperature simulator values.',
      failure: 'Broken probe, wrong probe type, connector damage.',
      symptoms: 'No reading, implausible value.',
      test: 'Apply known resistance values from a temperature simulator.',
      service: 'Replace probe; module per manual.',
      safety: 'Use only compatible probe series; probes are applied parts.',
      spares: ['Temperature probe'], pm: ['Temperature simulator check'], qa: ['Temperature accuracy']
    },
    etco2: {
      name: 'EtCO₂ (capnography) module', function: 'Measures exhaled CO₂ concentration and respiratory rate.',
      principle: 'Non-dispersive infrared absorption by CO₂; sidestream sampling pump or mainstream sensor.',
      input: 'Respiratory gas sample', output: 'EtCO₂, capnogram, respiratory rate',
      normal: 'Reads calibration gas correctly; sample flow normal; no occlusion.',
      failure: 'Water trap full, sample line occlusion, pump wear, sensor drift.',
      symptoms: 'Occlusion alarm, low or zero CO₂, slow response.',
      test: 'Check sample flow; apply certified calibration gas and compare.',
      service: 'Replace water trap/lines; calibrate; pump per service manual.',
      safety: 'Exhaust gas may contain anaesthetic agents — route to scavenging where required.',
      spares: ['Water trap', 'Sample line'], pm: ['CO₂ calibration check'], qa: ['EtCO₂ accuracy']
    },
    mainPcb: {
      name: 'Main PCB / CPU', function: 'Runs analysis algorithms, display, alarm logic and communications.',
      principle: 'Processor receives data from isolated modules over isolated serial links and runs the monitoring software.',
      input: 'Module data, DC power, user commands', output: 'Display data, alarms, network data',
      normal: 'Passes self-test; no internal errors in log.',
      failure: 'Firmware corruption, component failure, connector corrosion.',
      symptoms: 'Reboot loops, frozen screen, module not recognised.',
      test: 'Review error log; measure rails; check module connectors.',
      service: 'Replace only after power, cables and modules are ruled out; restore configuration.',
      safety: 'ESD protection; back up configuration before replacement.',
      spares: ['Main PCB'], pm: ['Log review'], qa: ['Alarm functional test']
    },
    display: {
      name: 'Display / UI', function: 'Shows waveforms, numerics and alarms; accepts user input.',
      principle: 'LCD with touch screen or rotary knob.',
      input: 'Video data, touch', output: 'Visual display, commands',
      normal: 'Legible from bedside distance; touch accurate.',
      failure: 'Backlight failure, touch drift, cable fault.',
      symptoms: 'Dark screen, unresponsive or misplaced touch.',
      test: 'Check brightness, pixels, touch calibration.',
      service: 'Replace display/touch assembly.',
      safety: 'A blank display with monitoring running can hide alarms — remove from use.',
      spares: ['Display assembly', 'Touch panel'], pm: ['Display check'], qa: []
    },
    alarm: {
      name: 'Alarm system', function: 'Signals physiological and technical alarm conditions.',
      principle: 'Alarm engine with priority levels drives speaker tones and visual indicators; alarms are also forwarded to the central station.',
      input: 'Measured values, limits, technical status', output: 'Audible and visual alarms',
      normal: 'Each alarm triggers at the correct priority; audible at the configured volume.',
      failure: 'Speaker failure, muted configuration, alarm light failure.',
      symptoms: 'Silent or weak alarm, missing visual indicator.',
      test: 'Use patient simulator to provoke high/low HR, SpO₂ low, lead-off, apnoea; check speaker and lights.',
      service: 'Replace speaker or indicator; correct configuration per hospital alarm policy.',
      safety: 'A monitor with a non-functioning alarm must be removed from clinical use.',
      spares: ['Speaker', 'Alarm light board'], pm: ['Alarm functional test'], qa: ['Alarm functional test']
    },
    network: {
      name: 'Network / central station link', function: 'Sends waveforms, numerics and alarms to the central station and records.',
      principle: 'Wired or wireless network; protocol to central station and HL7 or similar interfaces to records.',
      input: 'Monitor data', output: 'Central station display, records',
      normal: 'Bed appears online at central with correct bed label and synchronised time.',
      failure: 'Cable/port fault, IP conflict, wireless coverage, configuration error.',
      symptoms: 'Bed offline at central, wrong bed label, delayed alarms.',
      test: 'Check link light, IP settings, ping; verify alarm reaches central with simulator.',
      service: 'Correct cabling/configuration in coordination with IT.',
      safety: 'Wrong bed label sends alarms to the wrong patient location — verify after any change.',
      spares: ['Network cable', 'Wireless module'], pm: ['Central station link check'], qa: ['Central alarm transfer']
    },
    psu: {
      name: 'Power supply', function: 'Converts mains to internal DC rails and charges the battery.',
      principle: 'Medical-grade isolated SMPS.',
      input: 'Mains AC', output: 'DC rails',
      normal: 'Rails within tolerance; passes electrical safety tests.',
      failure: 'Fuse failure, component ageing.',
      symptoms: 'Runs on battery only, no power.',
      test: 'Check fuse, cord, rails; electrical safety analyzer.',
      service: 'Replace PSU; repeat electrical safety tests.',
      safety: 'Mains voltage — lockout before opening.',
      spares: ['PSU module', 'Fuse'], pm: ['Electrical safety test'], qa: ['Electrical safety']
    },
    battery: {
      name: 'Battery', function: 'Maintains monitoring during transport and power loss.',
      principle: 'Rechargeable pack with management circuit.',
      input: 'Charge current', output: 'DC backup',
      normal: 'Achieves manufacturer run time.',
      failure: 'Capacity loss, charger fault.',
      symptoms: 'Short run time, battery alarm.',
      test: 'Run-time test with defined parameters active.',
      service: 'Replace pack; dispose per regulations.',
      safety: 'Thermal and short-circuit hazard.',
      spares: ['Battery pack'], pm: ['Battery check'], qa: ['Battery run-time']
    }
  },
  workflow: [
    { title: 'Electrode and sensor connection', active: ['ecgFront', 'spo2', 'temp'], what: 'Electrodes, SpO₂ sensor and temperature probe are applied to the patient.', signal: 'Lead-off / sensor-off status', parameter: 'Contact quality', fail: 'Dry electrodes, broken leads.' },
    { title: 'ECG acquisition', active: ['ecgFront'], what: 'Isolated amplifier records lead potentials and removes common-mode noise.', signal: 'mV ECG', parameter: 'HR, rhythm', fail: 'Interference, damaged cable.' },
    { title: 'SpO₂ measurement', active: ['spo2'], what: 'Red/IR absorption ratio is computed from the pulsatile signal.', signal: 'Photodiode current', parameter: 'SpO₂, PR', fail: 'Motion, low perfusion, sensor fault.' },
    { title: 'NIBP cycle', active: ['nibp'], what: 'Cuff inflates above systolic, deflates in steps while oscillations are analysed.', signal: 'Cuff pressure', parameter: 'SYS/DIA/MAP', fail: 'Cuff or hose leak, pump wear.' },
    { title: 'Invasive pressure', active: ['ibp'], what: 'Transducer bridge output is zeroed and scaled to mmHg.', signal: 'Bridge µV/V', parameter: 'Arterial/venous pressure', fail: 'Zero failure, cable fault.' },
    { title: 'Temperature and CO₂', active: ['temp', 'etco2'], what: 'Thermistor resistance and IR absorption are converted to values.', signal: 'Resistance / IR detector', parameter: 'Temp, EtCO₂', fail: 'Wrong probe, occluded sample line.' },
    { title: 'Processing', active: ['mainPcb'], what: 'CPU runs algorithms, trends and arrhythmia analysis.', signal: 'Digital module data', parameter: 'All numerics', fail: 'Module communication error.' },
    { title: 'Alarm evaluation', active: ['mainPcb', 'alarm'], what: 'Values are compared with limits; technical faults raise technical alarms.', signal: 'Alarm priority flag', parameter: 'Limits', fail: 'Silent speaker, alarms disabled.' },
    { title: 'Display', active: ['display'], what: 'Waveforms and numerics are shown with alarm indicators.', signal: 'Video', parameter: 'Legibility', fail: 'Backlight or touch failure.' },
    { title: 'Network transfer', active: ['network', 'mainPcb'], what: 'Data and alarms reach the central station and records.', signal: 'Network packets', parameter: 'Latency, bed ID', fail: 'Offline, wrong bed label.' },
    { title: 'Power management', active: ['psu', 'battery'], what: 'Mains supply runs the monitor and charges the battery; battery takes over on mains loss.', signal: 'Power status', parameter: 'Battery charge', fail: 'Aged battery, PSU fault.' }
  ],
  operation: [
    { step: 'Pre-use check', detail: 'Inspect cables, sensors and cuffs; power on and confirm self-test and alarm tone.' },
    { step: 'Admit patient', detail: 'Enter or select patient from ADT; confirm bed label and patient category.' },
    { step: 'Connect parameters', detail: 'Apply electrodes, SpO₂ sensor, cuff, temperature probe, zero IBP, connect CO₂ line.' },
    { step: 'Set alarms', detail: 'Clinicians set limits per protocol; engineers verify alarm function, not clinical limits.' },
    { step: 'Monitor', detail: 'Observe waveforms and numerics; respond to alarms.' },
    { step: 'Discharge and clean', detail: 'Discharge patient, clean sensors/cables with approved agents, report defects.' }
  ],
  pm: {
    daily: [
      { task: 'Visual and alarm tone check', why: 'Damaged cables and silent alarms are common hazards.', tools: 'Visual', safety: 'Standard PPE', procedure: 'Inspect housing, cables and sensors; confirm start-up alarm tone.', criteria: 'No damage; tone audible.' }
    ],
    monthly: [
      { task: 'Cable inspection', why: 'Lead wires and sensor cables fail with flexing.', tools: 'Visual, multimeter', safety: 'Device off-patient', procedure: 'Inspect ECG, SpO₂, temperature and IBP cables; check continuity on suspect cables.', criteria: 'No cuts, kinks or loose connectors.' },
      { task: 'Battery check', why: 'Ensures transport monitoring.', tools: 'Stopwatch', safety: '—', procedure: 'Disconnect mains and confirm switch-over and charge level.', criteria: 'Seamless switch-over; no battery alarm.' }
    ],
    quarterly: [
      { task: 'NIBP leak and pressure check', why: 'Leaks and drift cause inaccurate BP.', tools: 'Reference manometer, rigid vessel', safety: 'Do not exceed cuff/vessel rating', procedure: 'Run service leak test; compare static pressure at several points.', criteria: 'Within configured limits.' },
      { task: 'Alarm functional test', why: 'Alarm integrity is the last line of protection.', tools: 'Patient simulator', safety: 'Off-patient', procedure: 'Provoke physiological and technical alarms; check audio, lights and central station.', criteria: 'All alarms trigger with correct priority and reach central.' }
    ],
    halfyearly: [
      { task: 'Parameter simulator check', why: 'Verifies ECG, SpO₂, IBP and temperature chains.', tools: 'Patient simulator, temperature simulator', safety: 'Off-patient', procedure: 'Apply simulated values and compare displayed values.', criteria: 'Within configured limits.' },
      { task: 'CO₂ calibration check', why: 'Sensor drift affects EtCO₂.', tools: 'Certified calibration gas', safety: 'Ventilated area', procedure: 'Check sample flow; apply calibration gas; calibrate if required.', criteria: 'Reading within configured limits.' },
      { task: 'Central station link check', why: 'Remote alarm coverage depends on it.', tools: 'Patient simulator', safety: 'Coordinate with ward and IT', procedure: 'Confirm bed label, time sync and alarm transfer to central.', criteria: 'Correct bed, alarm received.' }
    ],
    annual: [
      { task: 'Electrical safety test', why: 'Applied parts require low leakage.', tools: 'Electrical safety analyzer', safety: 'Follow analyzer instructions', procedure: 'Earth resistance, enclosure leakage and patient (applied part) leakage for each parameter.', criteria: 'Per hospital protocol based on applicable electrical safety standard.' },
      { task: 'NIBP overpressure test', why: 'Protects patient limb if control fails.', tools: 'Reference manometer', safety: 'Use rigid vessel', procedure: 'Run service overpressure test and record release pressure.', criteria: 'Releases at the configured limit.' },
      { task: 'Manufacturer PM', why: 'Model-specific wear parts and software.', tools: 'Service software, PM kit', safety: 'Back up configuration', procedure: 'Replace filters/water trap, update approved software.', criteria: 'Model-specific procedure required.' }
    ]
  },
  qa: [
    { id: 'ecg', test: 'ECG / heart-rate accuracy', setup: 'Patient simulator connected to all leads.', measure: 'Displayed HR at several simulated rates', unit: 'bpm', example: 'Deviation of displayed HR from simulated HR', report: 'Simulated vs displayed' },
    { id: 'spo2', test: 'SpO₂ functional check', setup: 'SpO₂ simulator with compatible probe interface.', measure: 'Displayed SpO₂ and PR', unit: '% / bpm', example: 'Deviation from simulated value', report: 'Simulated vs displayed' },
    { id: 'nibpStatic', test: 'NIBP static pressure accuracy', setup: 'Service mode; reference manometer and rigid vessel via T-piece.', measure: 'Displayed vs reference pressure', unit: 'mmHg', example: 'Absolute deviation from reference manometer', report: 'Reference vs displayed' },
    { id: 'nibpOver', test: 'NIBP overpressure protection', setup: 'Service overpressure test with manometer.', measure: 'Release pressure', unit: 'mmHg', example: 'Release pressure compared with configured limit', report: 'Value' },
    { id: 'ibp', test: 'IBP accuracy', setup: 'IBP simulator; zero first.', measure: 'Displayed pressure at static points', unit: 'mmHg', example: 'Deviation from simulated pressure', report: 'Simulated vs displayed' },
    { id: 'temp', test: 'Temperature accuracy', setup: 'Temperature simulator.', measure: 'Displayed temperature', unit: '°C', example: 'Deviation from simulated temperature', report: 'Simulated vs displayed' },
    { id: 'co2', test: 'EtCO₂ accuracy', setup: 'Certified calibration gas.', measure: 'Displayed CO₂', unit: 'mmHg / %', example: 'Deviation from gas concentration', report: 'Reference vs displayed' },
    { id: 'alarms', test: 'Alarm functional test', setup: 'Patient simulator provokes each alarm.', measure: 'Alarm triggered, priority, central received', unit: '—', example: 'All alarms trigger correctly', report: 'Checklist' },
    { id: 'leak', test: 'Applied part leakage', setup: 'Electrical safety analyzer, each applied part.', measure: 'Patient leakage current', unit: 'µA', example: 'Measured leakage compared with configured limit', report: 'Analyzer printout' }
  ],
  troubleshoot: [
    {
      symptom: 'No SpO₂ reading / sensor-off alarm',
      causes: [
        { cause: 'Sensor not applied / patient factors', note: 'Perfusion, motion, nail polish — check first.' },
        { cause: 'Damaged sensor', note: 'Most common hardware cause.' },
        { cause: 'Damaged extension cable', note: 'Test by substitution.' },
        { cause: 'SpO₂ module fault', note: 'Only after sensor and cable proven good.' }
      ],
      first: {
        prompt: 'What would you test first?',
        options: [
          { t: 'Replace the SpO₂ module', correct: false, why: 'Invasive and unproven — sensors and cables fail far more often.' },
          { t: 'Connect an SpO₂ simulator, then substitute a known-good sensor and cable', correct: true, why: 'Simulator proves the module; substitution isolates sensor vs cable without opening the monitor.' },
          { t: 'Factory reset the monitor', correct: false, why: 'Loses configuration and log evidence; does not test the signal path.' },
          { t: 'Replace the main PCB', correct: false, why: 'No evidence of a processing fault.' }
        ]
      },
      measure: 'Simulator reading; result with known-good sensor; result with known-good cable; error log.',
      decision: 'Simulator OK + new sensor OK → old sensor faulty. Fails only with old cable → cable. Simulator fails directly at port → module.',
      repair: 'Replace the proven faulty item only.',
      verify: 'SpO₂ simulator check; sensor-off alarm test; leakage if module replaced; document.'
    },
    {
      symptom: 'NIBP measurement times out / cuff leak',
      causes: [
        { cause: 'Cuff or hose leak', note: 'Most common.' },
        { cause: 'Wrong cuff size / connector', note: 'User issue.' },
        { cause: 'Pump wear', note: 'Slow inflation.' },
        { cause: 'Valve fault', note: 'Pressure not held.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Run the NIBP leak test with a rigid vessel instead of the cuff', correct: true, why: 'Separates external cuff/hose leaks from internal pneumatics with no disassembly.' },
          { t: 'Replace the pump', correct: false, why: 'Parts replacement without evidence.' },
          { t: 'Recalibrate the ECG', correct: false, why: 'Unrelated parameter.' },
          { t: 'Update software', correct: false, why: 'No evidence of a software fault.' }
        ]
      },
      measure: 'Leak rate with rigid vessel; leak rate with hose; inflation time.',
      decision: 'Vessel OK, cuff fails → cuff/hose. Vessel fails → internal pneumatics (pump/valve/tubing).',
      repair: 'Replace leaking cuff/hose or internal component as proven.',
      verify: 'Leak test, static pressure accuracy, overpressure test.'
    }
  ],
  errors: [
    { code: 'TRN-P120', desc: 'ECG lead-off persistent', causes: ['Broken lead wire', 'Trunk cable fault', 'Front-end fault'], component: 'ecgFront', checks: ['Simulator test', 'Cable continuity', 'Swap cable'], service: 'Replace cable; module per manual.', verify: 'ECG simulator check; leakage test.', pm: 'Cable inspection' },
    { code: 'TRN-P230', desc: 'SpO₂ module communication error', causes: ['Module connector', 'Module fault'], component: 'spo2', checks: ['Reseat module', 'Review log'], service: 'Model-specific procedure required.', verify: 'SpO₂ simulator check.', pm: 'SpO₂ simulator check' },
    { code: 'TRN-P340', desc: 'NIBP overpressure / leak fault', causes: ['Leak', 'Valve stuck', 'Transducer drift'], component: 'nibp', checks: ['Leak test', 'Static pressure check'], service: 'Replace hose/cuff; calibrate; pump/valve per manual.', verify: 'Static and overpressure tests.', pm: 'NIBP leak and pressure check' },
    { code: 'TRN-P450', desc: 'CO₂ sample line occluded', causes: ['Full water trap', 'Kinked line'], component: 'etco2', checks: ['Water trap', 'Sample flow'], service: 'Replace trap/line.', verify: 'Calibration gas check.', pm: 'CO₂ calibration check' },
    { code: 'TRN-P560', desc: 'Central station connection lost', causes: ['Cable/port', 'IP conflict', 'Wireless coverage'], component: 'network', checks: ['Link light', 'IP settings', 'Ping'], service: 'Correct cabling/configuration with IT.', verify: 'Alarm reaches central with correct bed label.', pm: 'Central station link check' },
    { code: 'TRN-P670', desc: 'Speaker fault', causes: ['Speaker open circuit', 'Connector'], component: 'alarm', checks: ['Speaker test in service mode', 'Measure coil resistance'], service: 'Replace speaker.', verify: 'Full alarm functional test.', pm: 'Alarm functional test' }
  ],
  safety: [
    { title: 'Applied parts and leakage', level: 'danger', text: 'ECG, SpO₂, IBP and temperature connect to the patient; IBP connects to the circulation. Leakage testing is required after any repair to an applied part or isolation barrier.' },
    { title: 'Alarm integrity', level: 'danger', text: 'A monitor whose alarms are silent, delayed or not forwarded must not be used. Verify audible, visual and central alarms after service.' },
    { title: 'Defibrillation protection', level: 'warning', text: 'Use only defibrillation-proof cables specified by the manufacturer; replace damaged protection components with identical parts.' },
    { title: 'Bed labels and network', level: 'warning', text: 'After network or configuration changes, confirm the bed label at the central station matches the physical location.' },
    { title: 'Infection control', level: 'caution', text: 'Cables, cuffs and sensors are contaminated after use. Clean with approved agents before service.' },
    { title: 'Release to service', level: 'info', text: 'Return to use only after documented parameter, alarm and electrical safety checks.' }
  ],
  tools: ['esa', 'patientSim', 'manometer', 'tempSim', 'multimeter'],
  cases: ['sensorFailure', 'incorrectMeasurement', 'alarmMalfunction', 'networkFailure', 'batteryNotCharging', 'excessiveLeakage'],
  scenarios: ['monitorSpo2'],
  questions: [
    { q: 'SpO₂ is calculated from absorption of which light?', options: ['UV and blue', 'Red and infrared', 'Green only', 'X-ray'], answer: 1, why: 'Oxy- and deoxyhaemoglobin absorb red and IR differently.', domain: 'knowledge' },
    { q: 'NIBP in most monitors uses which method?', options: ['Auscultatory', 'Oscillometric', 'Doppler', 'Tonometric'], answer: 1, why: 'Cuff pressure oscillations are analysed.', domain: 'knowledge' },
    { q: 'Why are ECG front-ends isolated?', options: ['To save power', 'To keep patient leakage current very low', 'To improve colours', 'To speed booting'], answer: 1, why: 'Isolation protects the patient from mains-referenced leakage.', domain: 'technical' },
    { q: 'Which tool verifies NIBP static pressure accuracy?', options: ['Oscilloscope', 'Reference manometer', 'Thermometer', 'Network tester'], answer: 1, why: 'A calibrated manometer gives the reference pressure.', domain: 'technical' },
    { q: 'No SpO₂ reading. First step?', options: ['Replace module', 'Simulator then known-good sensor/cable', 'Factory reset', 'Replace main PCB'], answer: 1, why: 'Least invasive tests that isolate the faulty element.', domain: 'troubleshooting' },
    { q: 'NIBP leak test passes with a rigid vessel but fails with the cuff. Fault?', options: ['Pump', 'Cuff or hose', 'Main PCB', 'Display'], answer: 1, why: 'Internal pneumatics are proven good by the vessel test.', domain: 'troubleshooting' },
    { q: 'A monitor’s alarm speaker is silent. Action?', options: ['Use it with visual alarms only', 'Remove from service until repaired and tested', 'Turn volume up', 'Ignore'], answer: 1, why: 'Alarm integrity is patient-safety critical.', domain: 'safety' },
    { q: 'After replacing an SpO₂ module you must…', options: ['Return immediately', 'Verify with simulator, test leakage, document', 'Replace sensor too', 'Nothing'], answer: 1, why: 'Repair → verify → document.', domain: 'documentation' },
    { q: 'Where do acceptance limits for monitor QA come from?', options: ['Any website', 'Hospital-approved protocol based on manufacturer documentation and applicable standards', 'Memory', 'A colleague'], answer: 1, why: 'Limits vary by model and jurisdiction.', domain: 'documentation' }
  ]
});

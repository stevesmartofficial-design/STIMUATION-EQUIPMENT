/* Content pack: ICU Ventilator (generic turbine/valve-based critical-care ventilator).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'ventilator',
  summary: 'A critical-care ventilator delivers controlled breaths by regulating gas pressure and flow into the patient circuit, measuring the result with flow and pressure sensors, and correcting delivery in a closed feedback loop. Faults here are directly patient-safety critical.',
  hazards: [{ label: 'PATIENT SAFETY CRITICAL', type: 'patient' }, { label: 'HIGH-PRESSURE O₂ — FIRE RISK', type: 'chem' }],
  principle: [
    'Medical air and O₂ enter at regulated pressure (or ambient air via an internal turbine).',
    'A blender mixes gases to the set FiO₂; proportional valves meter inspiratory flow.',
    'During inspiration the expiratory valve closes; during expiration it opens to the set PEEP.',
    'Flow and pressure sensors feed the controller, which corrects valve position breath-by-breath.',
    'Independent monitoring compares measured values to alarm limits and raises alarms.'
  ],
  parameters: [
    { name: 'Tidal volume (Vt)', unit: 'mL', typical: 'Set per patient', note: 'Delivered vs measured is a key performance check' },
    { name: 'Respiratory rate', unit: 'bpm', typical: 'Set per patient', note: 'Verify against analyzer timing' },
    { name: 'PEEP', unit: 'cmH₂O', typical: 'Set per patient', note: 'Maintained by expiratory valve' },
    { name: 'Peak inspiratory pressure', unit: 'cmH₂O', typical: 'Measured', note: 'High value can indicate occlusion' },
    { name: 'FiO₂', unit: '%', typical: '21–100', note: 'Check with calibrated O₂ sensor' },
    { name: 'I:E ratio', unit: '—', typical: 'Set per mode', note: 'Derived from Ti and rate' },
    { name: 'Gas supply pressure', unit: 'kPa / psi', typical: 'Per manufacturer spec', note: 'Model-specific procedure required' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 20, y: 30, w: 330, h: 230, label: 'HIGH-PRESSURE GAS', type: 'chem' },
      { x: 640, y: 30, w: 340, h: 360, label: 'PATIENT-CONNECTED PATH', type: 'patient' }
    ],
    nodes: [
      { id: 'gasInlet', x: 40, y: 70, w: 140, h: 54, label: 'Gas inlet (Air / O₂)' },
      { id: 'blender', x: 200, y: 70, w: 130, h: 54, label: 'O₂ blender' },
      { id: 'valves', x: 200, y: 180, w: 130, h: 54, label: 'Air / O₂ valves' },
      { id: 'turbine', x: 40, y: 180, w: 140, h: 54, label: 'Turbine' },
      { id: 'inspValve', x: 400, y: 120, w: 150, h: 54, label: 'Inspiratory valve' },
      { id: 'flowSensor', x: 660, y: 70, w: 140, h: 54, label: 'Flow sensor' },
      { id: 'circuit', x: 830, y: 120, w: 130, h: 54, label: 'Patient circuit' },
      { id: 'pressureSensor', x: 660, y: 180, w: 140, h: 54, label: 'Pressure sensor' },
      { id: 'expValve', x: 660, y: 300, w: 140, h: 54, label: 'Expiratory valve' },
      { id: 'peepValve', x: 830, y: 300, w: 130, h: 54, label: 'PEEP control' },
      { id: 'pcb', x: 400, y: 330, w: 150, h: 54, label: 'Control PCB' },
      { id: 'display', x: 400, y: 450, w: 150, h: 54, label: 'Display / UI' },
      { id: 'battery', x: 200, y: 450, w: 130, h: 54, label: 'Battery' },
      { id: 'psu', x: 40, y: 450, w: 140, h: 54, label: 'Power supply' },
      { id: 'alarm', x: 660, y: 450, w: 140, h: 54, label: 'Alarm system' }
    ],
    links: [
      ['gasInlet', 'blender'], ['blender', 'valves'], ['turbine', 'valves'], ['valves', 'inspValve'],
      ['inspValve', 'flowSensor'], ['flowSensor', 'circuit'], ['circuit', 'pressureSensor'],
      ['circuit', 'expValve'], ['expValve', 'peepValve'],
      ['flowSensor', 'pcb', 'flow signal'], ['pressureSensor', 'pcb', 'pressure signal'],
      ['pcb', 'inspValve', 'drive'], ['pcb', 'expValve', 'drive'], ['pcb', 'display'], ['pcb', 'alarm'],
      ['psu', 'battery'], ['battery', 'pcb', 'DC']
    ]
  },
  components: {
    gasInlet: {
      name: 'Gas inlet (Air / O₂)', function: 'Receives medical air and oxygen from pipeline or cylinder and filters/regulates them.',
      principle: 'Inlet filters remove particulates; check valves prevent back-flow; a regulator reduces pipeline pressure to the internal working pressure.',
      input: 'Pipeline / cylinder gas', output: 'Filtered, regulated gas to blender',
      normal: 'Supply pressure within the manufacturer specified range; no audible leak.',
      failure: 'Clogged inlet filter, failed check valve, worn regulator, low pipeline pressure.',
      symptoms: '"Gas supply low" alarm, unable to reach set FiO₂, low delivered volume.',
      test: 'Measure supply pressure at the inlet with a calibrated gauge; compare with the displayed supply pressure.',
      service: 'Replace inlet filter element and seals per service manual interval; leak-test fittings with approved leak detection fluid.',
      safety: 'Never use oil or grease on O₂ fittings. Depressurise before disconnecting.',
      spares: ['Inlet filter element', 'O-ring kit', 'Check valve'], pm: ['Inspect inlet filters', 'Leak test gas inlets'], qa: ['FiO₂ accuracy']
    },
    blender: {
      name: 'O₂ blender', function: 'Mixes air and oxygen to the set FiO₂.',
      principle: 'Proportional metering of each gas stream (mechanical or electronic) controlled against an O₂ sensor reading.',
      input: 'Regulated air + O₂', output: 'Mixed gas at set FiO₂',
      normal: 'Measured FiO₂ tracks set FiO₂ within the protocol tolerance.',
      failure: 'Exhausted O₂ cell, valve sticking, calibration drift.',
      symptoms: 'FiO₂ high/low alarm, O₂ calibration fails.',
      test: 'Compare FiO₂ at several set points (e.g. 21%, 50%, 100%) with a calibrated analyzer.',
      service: 'Perform O₂ sensor calibration; replace O₂ cell at end of life.',
      safety: 'Oxygen-enriched atmosphere increases fire risk — no ignition sources.',
      spares: ['O₂ sensor cell'], pm: ['O₂ cell calibration'], qa: ['FiO₂ accuracy']
    },
    valves: {
      name: 'Air / O₂ proportional valves', function: 'Meter the flow of each gas into the inspiratory path.',
      principle: 'Solenoid-driven proportional valves whose opening is set by PWM current from the controller.',
      input: 'Gas + drive current', output: 'Metered gas flow',
      normal: 'Smooth flow response to drive current; no chatter.',
      failure: 'Sticking plunger, coil open circuit, contamination.',
      symptoms: 'Erratic flow waveform, low delivered volume, "valve fault" self-test failure.',
      test: 'Run the manufacturer valve self-test; measure coil resistance with power off.',
      service: 'Replace valve assembly; perform flow calibration afterwards.',
      safety: 'Isolate gas and power before removal.',
      spares: ['Proportional valve assembly'], pm: [], qa: ['Volume accuracy']
    },
    turbine: {
      name: 'Turbine / blower', function: 'Generates gas flow from ambient air when no pipeline air is available.',
      principle: 'High-speed brushless motor drives an impeller; speed controls pressure and flow.',
      input: 'Ambient air + motor drive', output: 'Pressurised air flow',
      normal: 'Quiet, stable speed; temperature within spec.',
      failure: 'Bearing wear, motor driver failure, blocked intake filter.',
      symptoms: 'Abnormal noise, overheating alarm, low flow when on turbine source.',
      test: 'Check intake filter; listen for bearing noise; review turbine speed/temperature in service mode.',
      service: 'Replace turbine module per service manual; perform post-replacement calibration.',
      safety: 'Allow to stop fully and cool before handling.',
      spares: ['Turbine module', 'Intake filter'], pm: ['Replace intake filter'], qa: ['Volume accuracy']
    },
    inspValve: {
      name: 'Inspiratory valve', function: 'Controls the inspiratory flow profile delivered to the patient.',
      principle: 'Closed-loop control: valve position adjusted continuously from flow sensor feedback.',
      input: 'Mixed gas + controller drive', output: 'Controlled inspiratory flow',
      normal: 'Delivered waveform matches mode settings.',
      failure: 'Sticking, leakage, actuator failure.',
      symptoms: 'Volume not delivered, pressure overshoot, oscillating waveform.',
      test: 'Compare delivered Vt and flow waveform against a ventilator analyzer.',
      service: 'Clean or replace per service manual; calibrate flow afterwards.',
      safety: 'Device must be removed from patient use during service.',
      spares: ['Inspiratory valve assembly'], pm: [], qa: ['Volume accuracy', 'Pressure accuracy']
    },
    flowSensor: {
      name: 'Flow sensor', function: 'Measures gas flow.',
      principle: 'Differential-pressure, hot-wire or variable-orifice sensing converts gas flow into an electrical signal.',
      input: 'Gas flow', output: 'Flow signal to controller',
      normal: 'Reading agrees with a calibrated analyzer within the protocol tolerance.',
      failure: 'Contamination by secretions/humidity, broken hot-wire, connector fault.',
      symptoms: 'Volume alarms, "flow sensor fault", auto-zero failure, unrealistic Vt.',
      test: 'Verify sensor output and compare with analyzer measurement; run sensor calibration.',
      service: 'Replace sensor (often a consumable); calibrate; confirm with analyzer.',
      safety: 'Treat as potentially contaminated — wear PPE, follow decontamination procedure.',
      spares: ['Flow sensor'], pm: ['Flow sensor calibration'], qa: ['Volume accuracy']
    },
    pressureSensor: {
      name: 'Pressure sensor', function: 'Measures airway pressure.',
      principle: 'Piezoresistive transducer through a sensing line; signal used for control and alarms.',
      input: 'Airway pressure', output: 'Pressure signal',
      normal: 'Zero at ambient; reads correctly against reference manometer.',
      failure: 'Water in sensing line, transducer drift, blocked port.',
      symptoms: 'Pressure alarms without cause, incorrect PEEP display.',
      test: 'Apply known pressures with a calibrated manometer and compare.',
      service: 'Clear/replace sensing lines; perform pressure calibration.',
      safety: 'Do not over-pressurise transducer during testing.',
      spares: ['Pressure transducer', 'Sensing line'], pm: ['Pressure calibration'], qa: ['Pressure accuracy', 'PEEP accuracy']
    },
    circuit: {
      name: 'Patient breathing circuit', function: 'Carries gas to and from the patient.',
      principle: 'Inspiratory and expiratory limbs with Y-piece; humidifier or HME in the path.',
      input: 'Inspiratory gas', output: 'Expired gas to expiratory valve',
      normal: 'Passes leak test and compliance test.',
      failure: 'Cracks, loose connections, water accumulation.',
      symptoms: 'Leak alarm, low expired volume, failed pre-use test.',
      test: 'Run the pre-use leak/compliance test with circuit occluded.',
      service: 'Replace circuit (single-use or reprocessed per policy).',
      safety: 'Infection control — single-patient use per hospital policy.',
      spares: ['Breathing circuit'], pm: ['Leak test'], qa: ['Leak / compliance']
    },
    expValve: {
      name: 'Expiratory valve', function: 'Closes during inspiration and controls exhalation.',
      principle: 'Membrane/diaphragm valve actuated electronically to hold pressure.',
      input: 'Expired gas + drive', output: 'Controlled exhalation',
      normal: 'Opens/closes in time with breath phase; holds PEEP.',
      failure: 'Torn membrane, contamination, actuator failure.',
      symptoms: 'Cannot maintain PEEP, leak alarm, auto-triggering.',
      test: 'Inspect membrane; run expiratory valve test; check PEEP with analyzer.',
      service: 'Replace membrane/cassette; reprocess per manufacturer.',
      safety: 'Contaminated part — PPE and decontamination.',
      spares: ['Expiratory membrane', 'Expiratory cassette'], pm: ['Inspect expiratory membrane'], qa: ['PEEP accuracy']
    },
    peepValve: {
      name: 'PEEP control', function: 'Maintains positive end-expiratory pressure.',
      principle: 'Expiratory valve regulated by pressure feedback to hold the set baseline pressure.',
      input: 'Pressure feedback', output: 'Baseline airway pressure',
      normal: 'Measured PEEP matches set PEEP within protocol tolerance.',
      failure: 'Expiratory valve fault, leak, sensor error.',
      symptoms: 'PEEP low alarm, drifting baseline.',
      test: 'Set multiple PEEP levels and compare analyzer readings.',
      service: 'Repair underlying valve/leak; calibrate.',
      safety: 'Loss of PEEP can cause alveolar collapse — patient-critical.',
      spares: [], pm: [], qa: ['PEEP accuracy']
    },
    pcb: {
      name: 'Control PCB', function: 'Runs the control algorithm, monitoring and communications.',
      principle: 'Microcontroller(s) sample sensors, compute valve drive, run independent monitoring and alarm logic.',
      input: 'Sensor signals, user settings, DC power', output: 'Valve drive, display data, alarms',
      normal: 'Passes power-on self-test (POST); no internal error codes.',
      failure: 'Component failure, connector corrosion, firmware corruption.',
      symptoms: 'Self-test failure, technical alarm, reboot loops.',
      test: 'Review error log; measure supply rails at test points; check connectors.',
      service: 'Board replacement only after supply, cabling and sensors are ruled out. Load configuration and calibrate.',
      safety: 'ESD protection mandatory. Disconnect mains and battery.',
      spares: ['Control PCB'], pm: [], qa: ['Alarm functional test']
    },
    display: {
      name: 'Display / UI', function: 'Shows settings, waveforms, alarms; accepts user input.',
      principle: 'LCD + touch panel connected to the main controller.',
      input: 'Display data, touch', output: 'Visual interface, user commands',
      normal: 'No dead pixels/zones; touch accurate.',
      failure: 'Backlight failure, touch drift, cable fault.',
      symptoms: 'Dark screen, unresponsive touch.',
      test: 'Touch calibration test; check backlight supply.',
      service: 'Replace display assembly / touch panel.',
      safety: 'Backlight inverters may carry high voltage.',
      spares: ['Display assembly', 'Touch panel'], pm: ['Display & touch check'], qa: []
    },
    battery: {
      name: 'Battery', function: 'Provides backup power on mains failure and during transport.',
      principle: 'Rechargeable pack managed by a battery charger/management circuit.',
      input: 'Charge current', output: 'DC backup supply',
      normal: 'Achieves the run-time specified in the manufacturer documentation.',
      failure: 'Capacity loss with age, charger failure.',
      symptoms: 'Short run time, "battery low/fault" alarm.',
      test: 'Discharge (run-time) test under defined load.',
      service: 'Replace pack per age/test result; dispose per local regulations.',
      safety: 'Short-circuit and thermal hazard.',
      spares: ['Battery pack'], pm: ['Battery run-time test'], qa: ['Battery run-time']
    },
    psu: {
      name: 'Power supply', function: 'Converts mains to the DC rails used inside the unit.',
      principle: 'Isolated SMPS with medical-grade isolation.',
      input: 'Mains AC', output: 'DC rails',
      normal: 'Rails within tolerance; passes electrical safety tests.',
      failure: 'Capacitor ageing, fuse failure.',
      symptoms: 'Runs on battery only, no power.',
      test: 'Check fuse, measure DC rails, electrical safety analyzer test.',
      service: 'Replace PSU module; repeat electrical safety tests.',
      safety: 'Mains voltage — lockout before opening.',
      spares: ['PSU module', 'Mains fuse'], pm: ['Electrical safety test'], qa: ['Electrical safety']
    },
    alarm: {
      name: 'Alarm system', function: 'Alerts users to patient and technical conditions.',
      principle: 'Compares monitored values to limits; drives audible and visual indicators with priority levels.',
      input: 'Monitored parameters, limits', output: 'Audible/visual alarms',
      normal: 'Each alarm triggers correctly; speaker audible.',
      failure: 'Speaker failure, wrong configuration.',
      symptoms: 'No audible alarm, alarms not triggering.',
      test: 'Provoke each alarm condition (disconnect, occlusion, gas loss, power loss).',
      service: 'Replace speaker; correct configuration.',
      safety: 'A silent alarm is a critical patient hazard — remove from service.',
      spares: ['Speaker'], pm: ['Alarm functional test'], qa: ['Alarm functional test']
    }
  },
  workflow: [
    { title: 'Gas input', active: ['gasInlet', 'turbine'], what: 'Air and O₂ enter from pipeline/cylinder, or air is drawn in by the turbine.', signal: 'Supply pressure sensor output', parameter: 'Supply pressure', fail: 'Low pipeline pressure, clogged inlet filter.' },
    { title: 'Pressure regulation', active: ['gasInlet', 'blender'], what: 'Regulators reduce supply pressure; blender mixes to set FiO₂.', signal: 'O₂ sensor voltage', parameter: 'FiO₂', fail: 'Exhausted O₂ cell, regulator drift.' },
    { title: 'Flow control', active: ['valves', 'inspValve'], what: 'Proportional valves open according to drive current to create the set flow pattern.', signal: 'PWM valve drive', parameter: 'Inspiratory flow', fail: 'Sticking valve, coil failure.' },
    { title: 'Patient circuit', active: ['circuit'], what: 'Gas travels through the inspiratory limb and humidifier to the Y-piece.', signal: '—', parameter: 'Circuit compliance / leak', fail: 'Leaks, disconnection, water.' },
    { title: 'Inspiration', active: ['inspValve', 'expValve', 'circuit'], what: 'Expiratory valve is closed; lungs fill to target volume or pressure.', signal: 'Breath phase flag', parameter: 'Vt, PIP', fail: 'Expiratory valve leak causes volume loss.' },
    { title: 'Expiration', active: ['expValve', 'peepValve'], what: 'Expiratory valve opens; pressure falls to PEEP.', signal: 'Expiratory valve drive', parameter: 'PEEP, expired Vt', fail: 'Torn membrane, PEEP not held.' },
    { title: 'Flow measurement', active: ['flowSensor', 'pcb'], what: 'Flow sensor measures delivered/returned gas.', signal: 'Flow sensor analogue/digital output', parameter: 'Flow, Vt', fail: 'Sensor contamination, damaged element.' },
    { title: 'Pressure measurement', active: ['pressureSensor', 'pcb'], what: 'Airway pressure is sampled continuously.', signal: 'Transducer output', parameter: 'Paw, PIP, PEEP', fail: 'Water in sensing line, drift.' },
    { title: 'Feedback control', active: ['pcb', 'inspValve', 'expValve'], what: 'Controller compares measured to set values and corrects valve drive every cycle.', signal: 'Control loop error', parameter: 'Set vs measured', fail: 'Wrong calibration causes systematic error.' },
    { title: 'Alarm system', active: ['alarm', 'display', 'pcb'], what: 'Independent monitoring raises prioritised alarms on limit violations or technical faults.', signal: 'Alarm priority flag', parameter: 'All monitored values', fail: 'Speaker failure — silent alarms.' }
  ],
  operation: [
    { step: 'Pre-use check', detail: 'Connect gases and mains, fit circuit, run the manufacturer pre-use test (leak, compliance, sensor calibration).' },
    { step: 'Select patient category & mode', detail: 'Choose adult/paediatric/neonatal and ventilation mode (e.g. volume or pressure controlled).' },
    { step: 'Set parameters', detail: 'Vt or Pinsp, rate, PEEP, FiO₂, I:E or Ti, trigger sensitivity.' },
    { step: 'Set alarm limits', detail: 'Per clinical protocol. Engineers verify alarms function; clinicians set limits.' },
    { step: 'Connect & monitor', detail: 'Observe waveforms and measured values against settings.' },
    { step: 'Post-use', detail: 'Reprocess circuit parts; clean exterior; report faults via the hospital work-order system.' }
  ],
  pm: {
    daily: [
      { task: 'External condition', why: 'Damage can expose live parts or compromise gas integrity.', tools: 'Visual', safety: 'Standard PPE', procedure: 'Inspect housing, knobs, mounts, castors and labels.', criteria: 'No cracks, missing parts or illegible labels.' },
      { task: 'Pre-use self-test', why: 'Confirms leak, compliance and sensor calibration before patient use.', tools: 'Test lung, circuit', safety: 'Not connected to patient', procedure: 'Run the manufacturer pre-use test and record the result.', criteria: 'All self-test items pass.' }
    ],
    weekly: [
      { task: 'Filters', why: 'Blocked filters reduce flow and stress the turbine.', tools: 'Visual', safety: 'PPE — may be contaminated', procedure: 'Inspect cooling-fan and intake filters; clean or replace.', criteria: 'Filters clean and correctly seated.' }
    ],
    monthly: [
      { task: 'Battery', why: 'Ensures backup during power failure and transport.', tools: 'Stopwatch', safety: 'Device off-patient', procedure: 'Check charge indicator; run short mains-disconnect test.', criteria: 'Switch-over to battery without interruption; no battery alarm.' },
      { task: 'Alarm', why: 'Alarms are the last line of patient protection.', tools: 'Test lung', safety: 'Off-patient', procedure: 'Trigger disconnect, occlusion, gas-supply and power-loss alarms.', criteria: 'Each alarm triggers with correct priority and is audible.' }
    ],
    quarterly: [
      { task: 'Oxygen inlet', why: 'Leaks waste O₂ and create fire risk.', tools: 'Leak detection fluid', safety: 'No oil/grease', procedure: 'Inspect hose, fitting, inlet filter; leak test.', criteria: 'No leak; filter clean.' },
      { task: 'Air inlet', why: 'Contamination or leaks affect FiO₂ and flow.', tools: 'Leak detection fluid', safety: 'Depressurise before disassembly', procedure: 'Inspect hose, water trap and filter; leak test.', criteria: 'No leak; water trap empty.' },
      { task: 'Flow sensor', why: 'Accuracy of delivered/measured volume depends on it.', tools: 'Ventilator analyzer', safety: 'PPE', procedure: 'Inspect; calibrate; compare to analyzer.', criteria: 'Within protocol tolerance.' },
      { task: 'Pressure sensor', why: 'Drives pressure control and alarms.', tools: 'Reference manometer', safety: 'Do not over-pressurise', procedure: 'Zero and compare at several pressures.', criteria: 'Within protocol tolerance.' }
    ],
    halfyearly: [
      { task: 'Breathing circuit & leak', why: 'Leaks reduce delivered volume.', tools: 'Test lung', safety: 'PPE', procedure: 'Inspect reusable components; run leak/compliance test.', criteria: 'Leak below manufacturer limit.' },
      { task: 'Display', why: 'Misreadings lead to clinical errors.', tools: 'Visual', safety: '—', procedure: 'Check pixels, brightness, touch calibration.', criteria: 'Fully legible and responsive.' }
    ],
    annual: [
      { task: 'Power cord & electrical safety', why: 'Protects patient and operator from shock.', tools: 'Electrical safety analyzer', safety: 'Follow analyzer instructions', procedure: 'Inspect cord; measure protective earth resistance, insulation and leakage currents.', criteria: 'Per hospital protocol based on applicable electrical safety standard.' },
      { task: 'Functional test (full performance)', why: 'Verifies delivery accuracy across modes.', tools: 'Ventilator analyzer, test lung', safety: 'Off-patient', procedure: 'Run volume, pressure, PEEP, FiO₂, rate tests per QA tab.', criteria: 'All parameters within configured limits.' },
      { task: 'Manufacturer PM kit', why: 'Wear parts have defined service life.', tools: 'PM kit, service software', safety: 'Isolate gas and power', procedure: 'Replace seals, filters, O₂ cell per service manual.', criteria: 'Model-specific procedure required.' }
    ]
  },
  qa: [
    { id: 'vt', test: 'Volume accuracy', setup: 'Ventilator → circuit → ventilator analyzer → test lung (defined compliance/resistance).', measure: 'Delivered Vt at several set volumes', unit: '%', example: 'Deviation from set Vt', report: 'Set vs measured table' },
    { id: 'pressure', test: 'Pressure accuracy', setup: 'Pressure-control mode into analyzer/test lung.', measure: 'Measured Pinsp vs set', unit: 'cmH₂O', example: 'Absolute deviation', report: 'Set vs measured' },
    { id: 'peep', test: 'PEEP accuracy', setup: 'Analyzer in-line; several PEEP set points.', measure: 'Measured PEEP', unit: 'cmH₂O', example: 'Absolute deviation', report: 'Set vs measured' },
    { id: 'fio2', test: 'FiO₂ accuracy', setup: 'Analyzer O₂ sensor calibrated at 21% and 100%.', measure: 'FiO₂ at 21/50/100%', unit: '%', example: 'Absolute deviation (percentage points)', report: 'Set vs measured' },
    { id: 'rate', test: 'Rate accuracy', setup: 'Analyzer breath detection.', measure: 'Measured breaths/min', unit: 'bpm', example: 'Deviation', report: 'Set vs measured' },
    { id: 'alarms', test: 'Alarm functional test', setup: 'Provoke each alarm condition.', measure: 'Alarm triggered (Y/N)', unit: '—', example: 'All alarms trigger', report: 'Checklist' },
    { id: 'battery', test: 'Battery run-time', setup: 'Defined settings, mains disconnected.', measure: 'Minutes until low-battery alarm', unit: 'min', example: '≥ manufacturer spec', report: 'Duration' }
  ],
  troubleshoot: [
    {
      symptom: 'Ventilator not delivering flow',
      causes: [
        { cause: 'Gas supply issue', note: 'Most common and least invasive to check.' },
        { cause: 'Circuit leakage', note: 'Check with pre-use leak test.' },
        { cause: 'Flow sensor failure', note: 'May report flow incorrectly rather than stop it.' },
        { cause: 'Inspiratory valve problem', note: 'Check after gas and circuit are confirmed.' },
        { cause: 'Turbine failure', note: 'Only relevant if running on turbine source.' },
        { cause: 'PCB issue', note: 'Last — after inputs, outputs and cabling are verified.' }
      ],
      first: {
        prompt: 'What would you test first?',
        options: [
          { t: 'Replace PCB', correct: false, why: 'Expensive, invasive and unproven — you have no evidence the PCB is faulty.' },
          { t: 'Check gas supply', correct: true, why: 'No flow with no gas input is the simplest explanation. It is quick, non-invasive and rules out the whole upstream path in one step.' },
          { t: 'Replace display', correct: false, why: 'The display does not create flow. This would not change the symptom.' },
          { t: 'Restart system', correct: false, why: 'Restarting can clear evidence (error log) and does not identify the cause.' }
        ]
      },
      measure: 'Supply pressure at inlet with calibrated gauge; displayed supply pressure; error log entries.',
      decision: 'Supply OK → run leak test → check flow sensor reading vs analyzer → valve self-test.',
      repair: 'Correct the confirmed root cause only (e.g. restore pipeline, replace inlet filter).',
      verify: 'Pre-use test pass; volume accuracy with analyzer; alarm test; document.'
    },
    {
      symptom: 'PEEP cannot be maintained',
      causes: [
        { cause: 'Circuit leak', note: 'Most frequent.' },
        { cause: 'Expiratory membrane torn', note: 'Inspect after reprocessing.' },
        { cause: 'Pressure sensor drift', note: 'Compare with manometer.' },
        { cause: 'Expiratory valve actuator fault', note: 'Self-test.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Run leak test with the circuit occluded', correct: true, why: 'A leak is the most common cause and the test isolates the circuit from the machine.' },
          { t: 'Replace expiratory valve actuator', correct: false, why: 'Parts replacement without diagnosis.' },
          { t: 'Recalibrate O₂ sensor', correct: false, why: 'Unrelated to PEEP.' },
          { t: 'Update firmware', correct: false, why: 'No evidence of a software issue.' }
        ]
      },
      measure: 'Leak value from test; PEEP measured by analyzer at several settings.',
      decision: 'Leak high → replace circuit/components. Leak OK → inspect membrane → check sensor.',
      repair: 'Replace leaking part or membrane; calibrate.',
      verify: 'PEEP accuracy test; leak test pass.'
    }
  ],
  errors: [
    { code: 'TRN-V101', desc: 'Gas supply pressure low', causes: ['Pipeline pressure low', 'Hose kinked', 'Inlet filter blocked'], component: 'gasInlet', checks: ['Measure supply pressure', 'Inspect hose and filter'], service: 'Restore supply; replace filter.', verify: 'Alarm clears; FiO₂ accuracy check.', pm: 'Inspect inlet filters' },
    { code: 'TRN-V204', desc: 'Flow sensor calibration failed', causes: ['Contaminated sensor', 'Damaged element', 'Connector fault'], component: 'flowSensor', checks: ['Inspect sensor', 'Check cable/connector', 'Swap known-good sensor'], service: 'Replace sensor and recalibrate.', verify: 'Volume accuracy with analyzer.', pm: 'Flow sensor calibration' },
    { code: 'TRN-V310', desc: 'Expiratory valve fault', causes: ['Membrane torn', 'Actuator failure'], component: 'expValve', checks: ['Inspect membrane', 'Run valve self-test'], service: 'Replace membrane or valve.', verify: 'PEEP accuracy; leak test.', pm: 'Inspect expiratory membrane' },
    { code: 'TRN-V412', desc: 'Battery fault', causes: ['Aged battery', 'Charger failure'], component: 'battery', checks: ['Battery voltage', 'Run-time test'], service: 'Replace battery pack.', verify: 'Run-time test.', pm: 'Battery run-time test' },
    { code: 'TRN-V501', desc: 'Internal communication error', causes: ['Loose ribbon cable', 'PCB fault'], component: 'pcb', checks: ['Review log', 'Reseat cables', 'Measure rails'], service: 'Model-specific procedure required.', verify: 'POST pass; full functional test.', pm: '—' }
  ],
  safety: [
    { title: 'Patient safety critical', level: 'danger', text: 'Never service a ventilator connected to a patient. Provide a replacement ventilator before removing a unit from clinical use.' },
    { title: 'Oxygen fire risk', level: 'danger', text: 'No oil, grease or ignition sources near O₂ fittings. Use only approved O₂-compatible lubricants where specified.' },
    { title: 'Biological contamination', level: 'warning', text: 'Expiratory parts and flow sensors may be contaminated. Use PPE and follow the decontamination procedure before service.' },
    { title: 'Electrical', level: 'warning', text: 'Disconnect mains and battery before opening the enclosure. Perform electrical safety testing after any repair.' },
    { title: 'Release to service', level: 'info', text: 'A ventilator returns to clinical use only after a documented functional test and alarm test.' }
  ],
  tools: ['esa', 'ventAnalyzer', 'manometer', 'multimeter', 'testLung'],
  cases: ['noPower', 'batteryNotCharging', 'alarmMalfunction', 'sensorFailure', 'calibrationError'],
  scenarios: ['ventNoFlow'],
  questions: [
    { q: 'Which component provides the feedback the controller uses to regulate delivered volume?', options: ['Display', 'Flow sensor', 'Battery', 'Blender'], answer: 1, why: 'The flow sensor measures flow; the controller integrates it to volume and corrects valve drive.', domain: 'knowledge' },
    { q: 'During inspiration the expiratory valve is…', options: ['Open', 'Closed', 'Removed', 'In bypass'], answer: 1, why: 'Closing the expiratory valve allows the lungs to fill.', domain: 'knowledge' },
    { q: 'A ventilator is not delivering flow. What do you check first?', options: ['Replace PCB', 'Gas supply', 'Replace display', 'Firmware update'], answer: 1, why: 'Start with the simplest, least invasive check that explains the symptom.', domain: 'troubleshooting' },
    { q: 'Which instrument verifies delivered tidal volume during performance testing?', options: ['Multimeter', 'Ventilator analyzer', 'Oscilloscope', 'Thermometer'], answer: 1, why: 'A calibrated ventilator/gas-flow analyzer measures volume, pressure, FiO₂ and timing.', domain: 'technical' },
    { q: 'Why must lubricants never be used on oxygen fittings?', options: ['They block filters', 'Fire / explosion risk in O₂-enriched atmosphere', 'They void warranty', 'They affect display'], answer: 1, why: 'Hydrocarbons can ignite in high-pressure oxygen.', domain: 'safety' },
    { q: 'After replacing a flow sensor, the next step is…', options: ['Return to ward', 'Calibrate and verify with analyzer, then document', 'Replace the PCB', 'Nothing'], answer: 1, why: 'Repair → verify → document.', domain: 'documentation' },
    { q: 'PEEP cannot be maintained. First test?', options: ['Leak test', 'Replace turbine', 'Recalibrate touch screen', 'Battery test'], answer: 0, why: 'Leaks are the most common cause and the test is quick.', domain: 'troubleshooting' },
    { q: 'Where should acceptance limits for volume accuracy come from?', options: ['Any website', 'Hospital-approved protocol based on manufacturer documentation and applicable standards', 'Memory', 'A colleague'], answer: 1, why: 'Limits vary by model, standard and jurisdiction.', domain: 'documentation' }
  ]
});

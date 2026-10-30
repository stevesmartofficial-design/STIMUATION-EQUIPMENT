/* Content pack: Volumetric Infusion Pump (generic large-volume peristaltic pump).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'infusionPump',
  summary: 'A volumetric infusion pump delivers fluids and drugs at a programmed rate by compressing a dedicated administration set with a motor-driven peristaltic mechanism. Sensors detect door state, upstream and downstream occlusion and air-in-line. Dosing accuracy, free-flow prevention and alarm integrity are directly patient-safety critical.',
  hazards: [{ label: 'PATIENT SAFETY CRITICAL — DOSING', type: 'patient' }],
  principle: [
    'A stepper or brushless motor drives cams that move fingers against the administration set.',
    'Fingers squeeze the tubing in sequence, pushing a known volume per revolution toward the patient.',
    'Rate = volume per revolution × motor speed; the controller adjusts speed to the programmed rate.',
    'When the door opens, a clamp closes the set to prevent uncontrolled free flow.',
    'Upstream and downstream pressure sensors detect occlusions; an ultrasonic sensor detects air.',
    'Drug libraries and dose limits reduce programming errors.'
  ],
  parameters: [
    { name: 'Flow rate', unit: 'mL/h', typical: 'Set per prescription', note: 'Measured with infusion pump analyzer' },
    { name: 'Volume to be infused', unit: 'mL', typical: 'Set', note: 'Compared with collected volume' },
    { name: 'Downstream occlusion pressure', unit: 'mmHg / kPa', typical: 'Configurable levels', note: 'Measured with analyzer occlusion port' },
    { name: 'Time to occlusion alarm', unit: 's / min', typical: 'Measured', note: 'Rate dependent' },
    { name: 'Bolus after occlusion release', unit: 'mL', typical: 'Measured', note: 'Should be minimised' },
    { name: 'Air-in-line detection', unit: 'µL', typical: 'Per manufacturer spec', note: 'Model-specific procedure required' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 20, y: 45, w: 960, h: 105, label: 'FLUID PATH — TO PATIENT', type: 'patient' },
      { x: 195, y: 180, w: 375, h: 95, label: 'DOSING DRIVE / FREE-FLOW PROTECTION', type: 'patient' }
    ],
    nodes: [
      { id: 'dropSensor', x: 40, y: 80, w: 140, h: 54, label: 'Drop sensor' },
      { id: 'upOcclusion', x: 210, y: 80, w: 150, h: 54, label: 'Upstream occlusion' },
      { id: 'mechanism', x: 390, y: 80, w: 160, h: 54, label: 'Peristaltic mechanism' },
      { id: 'downOcclusion', x: 580, y: 80, w: 150, h: 54, label: 'Downstream occlusion' },
      { id: 'airSensor', x: 760, y: 80, w: 150, h: 54, label: 'Air-in-line sensor' },
      { id: 'doorSensor', x: 210, y: 205, w: 150, h: 54, label: 'Door sensor / clamp' },
      { id: 'motor', x: 390, y: 205, w: 160, h: 54, label: 'Motor / encoder' },
      { id: 'controller', x: 390, y: 340, w: 160, h: 54, label: 'Controller' },
      { id: 'display', x: 640, y: 340, w: 150, h: 54, label: 'Display' },
      { id: 'keypad', x: 640, y: 460, w: 150, h: 54, label: 'Keypad' },
      { id: 'battery', x: 210, y: 460, w: 150, h: 54, label: 'Battery' },
      { id: 'psu', x: 40, y: 460, w: 140, h: 54, label: 'Power supply' }
    ],
    links: [
      ['dropSensor', 'upOcclusion', 'fluid'], ['upOcclusion', 'mechanism'], ['mechanism', 'downOcclusion'],
      ['downOcclusion', 'airSensor', 'to patient'], ['motor', 'mechanism', 'drive'], ['controller', 'motor', 'speed cmd'],
      ['doorSensor', 'controller', 'door state'], ['upOcclusion', 'controller', 'pressure'], ['downOcclusion', 'controller', 'pressure'],
      ['airSensor', 'controller', 'air detect'], ['dropSensor', 'controller', 'drops'], ['controller', 'display'],
      ['keypad', 'controller', 'settings'], ['psu', 'battery'], ['battery', 'controller', 'DC']
    ]
  },
  components: {
    motor: {
      name: 'Motor / encoder', function: 'Provides controlled rotation for the pumping mechanism.',
      principle: 'Stepper or brushless DC motor with gearbox; encoder or step count confirms actual rotation for closed-loop verification.',
      input: 'Drive signal from controller', output: 'Rotation of camshaft',
      normal: 'Smooth, quiet rotation; encoder count matches commanded steps.',
      failure: 'Gearbox wear, motor winding failure, encoder fault, driver failure.',
      symptoms: 'Rate inaccuracy, grinding noise, motor fault alarm, pump stops.',
      test: 'Volumetric accuracy with analyzer; listen for noise; review motor fault log.',
      service: 'Replace motor/gearbox assembly per service manual; calibrate and verify rate.',
      safety: 'Undetected motor faults cause under- or over-infusion.',
      spares: ['Motor / gearbox assembly'], pm: ['Flow rate accuracy check'], qa: ['Flow rate accuracy']
    },
    mechanism: {
      name: 'Peristaltic finger mechanism', function: 'Moves fluid by sequentially compressing the administration set.',
      principle: 'Camshaft drives a row of fingers against a pressure plate; at least one finger always occludes the tubing, preventing free flow while running.',
      input: 'Camshaft rotation, set tubing', output: 'Displaced fluid volume',
      normal: 'Uniform finger movement; pressure plate correctly spring-loaded; accurate volume.',
      failure: 'Worn fingers or pressure plate spring, contamination from spilled fluids, misaligned set.',
      symptoms: 'Over/under infusion, free flow, noise, set damage.',
      test: 'Inspect for residue and wear; volumetric accuracy and free-flow test with analyzer.',
      service: 'Clean per manual; replace mechanism or pressure plate parts on evidence.',
      safety: 'Mechanism faults can cause free flow — remove pump immediately.',
      spares: ['Pumping mechanism', 'Pressure plate'], pm: ['Mechanism inspection and cleaning'], qa: ['Flow rate accuracy', 'Free-flow prevention']
    },
    doorSensor: {
      name: 'Door sensor and anti-free-flow clamp', function: 'Detects door state and clamps the set when the door opens.',
      principle: 'Hall/optical/micro-switch sensor reports door closed; mechanical clamp occludes the tubing when the door is opened.',
      input: 'Door position', output: 'Door-state signal; tubing clamp',
      normal: 'Pump will not run with door open; no flow when door is opened with fluid head.',
      failure: 'Broken latch, worn clamp, sensor misalignment.',
      symptoms: 'Door-open alarm while closed, cannot start infusion, free flow on door open.',
      test: 'Open/close door while running; free-flow test with set and fluid head.',
      service: 'Replace latch/clamp/sensor per manual.',
      safety: 'Free flow can deliver a dangerous dose rapidly — critical test after any door repair.',
      spares: ['Door latch', 'Anti-free-flow clamp', 'Door sensor'], pm: ['Door and clamp check'], qa: ['Free-flow prevention']
    },
    upOcclusion: {
      name: 'Upstream occlusion sensor', function: 'Detects blockage between the container and the pump.',
      principle: 'Force/pressure transducer measures tubing wall deflection; a drop in pressure indicates closed clamp or empty container.',
      input: 'Upstream tubing pressure', output: 'Pressure signal',
      normal: 'Alarm on closed upstream clamp; no false alarms.',
      failure: 'Sensor drift, contamination, misloaded set.',
      symptoms: 'False upstream alarms, missed empty-bag condition.',
      test: 'Close upstream clamp while running; check alarm; check sensor reading in service mode.',
      service: 'Clean; calibrate; replace sensor per manual.',
      safety: 'Missed upstream occlusion means therapy silently stops.',
      spares: ['Upstream pressure sensor'], pm: ['Occlusion sensor check'], qa: ['Upstream occlusion detection']
    },
    downOcclusion: {
      name: 'Downstream occlusion sensor', function: 'Detects blockage between the pump and the patient.',
      principle: 'Force transducer on the tubing measures rising pressure; alarm when threshold is exceeded; pump may back off to reduce bolus.',
      input: 'Downstream line pressure', output: 'Pressure signal',
      normal: 'Alarm at the selected pressure level within acceptable time.',
      failure: 'Sensor drift, contamination by fluid ingress, calibration error.',
      symptoms: 'False occlusion alarms, delayed or missing alarm, large bolus on release.',
      test: 'Occlusion test with infusion pump analyzer at each pressure level; measure time to alarm and bolus.',
      service: 'Clean; calibrate; replace sensor per manual.',
      safety: 'Delayed occlusion detection causes a dangerous bolus when released.',
      spares: ['Downstream pressure sensor'], pm: ['Occlusion sensor check'], qa: ['Downstream occlusion pressure', 'Bolus volume']
    },
    airSensor: {
      name: 'Air-in-line sensor', function: 'Detects air bubbles in the set downstream of the pump.',
      principle: 'Ultrasonic transmitter/receiver across the tubing; air causes a large drop in transmitted signal.',
      input: 'Tubing with fluid/air', output: 'Air-detect signal',
      normal: 'Alarms on air bubbles above threshold; no false alarms with fluid.',
      failure: 'Dirty sensor faces, misloaded set, transducer fault.',
      symptoms: 'Frequent false air alarms, missed air.',
      test: 'Introduce a defined air bubble per service procedure; check alarm.',
      service: 'Clean sensor faces; replace per manual.',
      safety: 'Air embolism risk if detection fails.',
      spares: ['Air sensor assembly'], pm: ['Air sensor test'], qa: ['Air-in-line detection']
    },
    dropSensor: {
      name: 'Drop sensor', function: 'Detects drops in the drip chamber (where fitted) to confirm flow or empty container.',
      principle: 'IR emitter/detector across the drip chamber counts drops.',
      input: 'Drops in chamber', output: 'Drop pulses',
      normal: 'Drops detected; alarm when container empty.',
      failure: 'Dirty optics, cable damage, ambient light interference.',
      symptoms: 'No-flow or empty-container alarms with fluid present.',
      test: 'Observe drop count/indicator; clean optics; swap known-good sensor.',
      service: 'Replace sensor/cable.',
      safety: 'Disabling a needed drop sensor removes a protection layer.',
      spares: ['Drop sensor'], pm: ['Drop sensor check'], qa: []
    },
    controller: {
      name: 'Controller', function: 'Executes infusion program, drug library limits, alarms and logging.',
      principle: 'Main and supervisory processors independently cross-check motor operation and sensors.',
      input: 'User settings, sensor signals, DC power', output: 'Motor commands, display, alarms, logs',
      normal: 'POST pass; no internal errors.',
      failure: 'Firmware fault, watchdog error, component failure.',
      symptoms: 'Technical alarm, pump stops with error code, frozen screen.',
      test: 'Review event and error logs; check drug library version.',
      service: 'Replace only after sensors, motor and cables ruled out; Model-specific procedure required.',
      safety: 'Load only approved drug library and firmware.',
      spares: ['Controller board'], pm: ['Log and drug library review'], qa: ['Alarm functional test']
    },
    display: {
      name: 'Display', function: 'Shows rate, volume, drug, alarms and status.',
      principle: 'LCD with backlight; status LEDs for running/alarm.',
      input: 'Display data', output: 'Visual information',
      normal: 'All segments/pixels visible; legible.',
      failure: 'Backlight failure, missing pixels.',
      symptoms: 'Dim or missing characters — risk of misread rate.',
      test: 'Display test in service mode.',
      service: 'Replace display assembly.',
      safety: 'Missing digits can cause tenfold dosing errors.',
      spares: ['Display assembly'], pm: ['Display and keypad check'], qa: []
    },
    keypad: {
      name: 'Keypad', function: 'Allows programming of rate, volume and drug selection.',
      principle: 'Membrane switch matrix scanned by controller.',
      input: 'Key presses', output: 'Commands',
      normal: 'Every key registers once per press.',
      failure: 'Worn or stuck keys, fluid ingress.',
      symptoms: 'Missed or double keystrokes, stuck key alarm.',
      test: 'Keypad test in service mode.',
      service: 'Replace keypad.',
      safety: 'Double keystrokes can change entered doses — remove from service.',
      spares: ['Keypad membrane'], pm: ['Display and keypad check'], qa: []
    },
    battery: {
      name: 'Battery', function: 'Maintains infusion during transport and power loss.',
      principle: 'Rechargeable pack with management circuit.',
      input: 'Charge current', output: 'DC backup',
      normal: 'Run time meets manufacturer spec at defined rate.',
      failure: 'Capacity loss, charger fault.',
      symptoms: 'Short run time, battery alarms.',
      test: 'Run-time test at defined rate.',
      service: 'Replace pack.',
      safety: 'Interruption of critical infusions on battery failure.',
      spares: ['Battery pack'], pm: ['Battery check'], qa: ['Battery run-time']
    },
    psu: {
      name: 'Power supply', function: 'Converts mains to DC and charges battery.',
      principle: 'Medical-grade isolated SMPS.',
      input: 'Mains AC', output: 'DC rails',
      normal: 'Mains indicator on; battery charges.',
      failure: 'Fuse, cord or PSU failure.',
      symptoms: 'Runs only on battery, no charge.',
      test: 'Check cord, fuse, DC rails; electrical safety analyzer.',
      service: 'Replace PSU; repeat electrical safety tests.',
      safety: 'Mains voltage — lockout before opening.',
      spares: ['PSU module', 'Power cord'], pm: ['Electrical safety test'], qa: ['Electrical safety']
    }
  },
  workflow: [
    { title: 'Programming', active: ['keypad', 'display', 'controller'], what: 'User selects drug from library and enters rate/volume; limits checked.', signal: 'Settings', parameter: 'Rate, VTBI', fail: 'Keypad fault, wrong library.' },
    { title: 'Set loading', active: ['doorSensor', 'mechanism'], what: 'Set is loaded; door closes; clamp releases only when door closed.', signal: 'Door state', parameter: 'Door closed', fail: 'Latch or clamp fault.' },
    { title: 'Upstream check', active: ['dropSensor', 'upOcclusion'], what: 'Fluid supply confirmed; upstream pressure monitored.', signal: 'Drops, pressure', parameter: 'Upstream pressure', fail: 'Closed clamp, empty bag.' },
    { title: 'Motor drive', active: ['controller', 'motor'], what: 'Controller drives motor at the speed for the set rate.', signal: 'Step / PWM', parameter: 'Motor speed', fail: 'Gearbox wear.' },
    { title: 'Peristaltic pumping', active: ['motor', 'mechanism'], what: 'Fingers squeeze the tubing sequentially, pushing fluid forward.', signal: 'Encoder feedback', parameter: 'Volume per cycle', fail: 'Worn fingers, wrong set.' },
    { title: 'Downstream monitoring', active: ['downOcclusion', 'controller'], what: 'Line pressure monitored for occlusion.', signal: 'Pressure', parameter: 'Occlusion level', fail: 'Sensor drift.' },
    { title: 'Air detection', active: ['airSensor', 'controller'], what: 'Ultrasonic sensor checks for air.', signal: 'Air detect', parameter: 'Bubble size', fail: 'Dirty sensor.' },
    { title: 'Alarm handling', active: ['controller', 'display'], what: 'On occlusion, air, door open or end of infusion the pump stops and alarms.', signal: 'Alarm', parameter: 'Alarm type', fail: 'Silent alarm.' },
    { title: 'Power management', active: ['psu', 'battery', 'controller'], what: 'Mains runs pump and charges battery; battery on mains loss.', signal: 'Power status', parameter: 'Battery level', fail: 'Aged battery.' }
  ],
  operation: [
    { step: 'Pre-use check', detail: 'Inspect housing, door, clamp and cord; power on and confirm self-test.' },
    { step: 'Prime and load set', detail: 'Prime the dedicated set; load per door diagram; close door.' },
    { step: 'Program', detail: 'Select care area and drug from library; enter rate and VTBI; confirm.' },
    { step: 'Start and verify', detail: 'Open clamps, start infusion, observe drops and running indicator.' },
    { step: 'Respond to alarms', detail: 'Resolve occlusion/air causes before restarting; never bypass alarms.' },
    { step: 'Post-use', detail: 'Clean exterior and mechanism area of spills; report faults through work order.' }
  ],
  pm: {
    daily: [
      { task: 'Visual and self-test', why: 'Detects damage and fluid ingress early.', tools: 'Visual', safety: 'Standard PPE', procedure: 'Inspect housing, door, clamp, cord; power on self-test.', criteria: 'No damage; self-test pass.' }
    ],
    monthly: [
      { task: 'Mechanism inspection and cleaning', why: 'Dried fluids cause mechanism and sensor errors.', tools: 'Approved cleaning agent, lint-free swabs', safety: 'Device off; PPE', procedure: 'Clean finger mechanism, pressure plate and sensor faces per manual.', criteria: 'No residue; parts move freely.' },
      { task: 'Battery check', why: 'Transport infusions depend on battery.', tools: 'Stopwatch', safety: '—', procedure: 'Disconnect mains while running; confirm switch-over and indicator.', criteria: 'Uninterrupted infusion; no battery fault.' }
    ],
    quarterly: [
      { task: 'Door and clamp check', why: 'Prevents free flow.', tools: 'Set, fluid container', safety: 'Collect fluid', procedure: 'Open door with fluid head on set; observe for flow.', criteria: 'No free flow.' },
      { task: 'Display and keypad check', why: 'Prevents programming errors.', tools: 'Service mode', safety: '—', procedure: 'Run display and keypad tests.', criteria: 'All segments and keys function.' },
      { task: 'Log and drug library review', why: 'Ensures current approved library and identifies recurring faults.', tools: 'Service software', safety: 'Coordinate with pharmacy', procedure: 'Check library version; review error log.', criteria: 'Approved version; no unresolved errors.' }
    ],
    halfyearly: [
      { task: 'Flow rate accuracy check', why: 'Core dosing performance.', tools: 'Infusion pump analyzer', safety: 'Use dedicated test set; not connected to patient', procedure: 'Run at defined rates; measure delivered volume over defined time.', criteria: 'Within configured limits.' },
      { task: 'Occlusion sensor check', why: 'Detects blocked lines.', tools: 'Infusion pump analyzer', safety: 'Release pressure carefully', procedure: 'Measure occlusion alarm pressure and time; upstream clamp test.', criteria: 'Within configured limits.' },
      { task: 'Air sensor test', why: 'Prevents air embolism.', tools: 'Syringe for defined air volume', safety: 'Off-patient', procedure: 'Introduce defined air bubble per manual.', criteria: 'Alarm triggers.' }
    ],
    annual: [
      { task: 'Electrical safety test', why: 'Protects patient and operator.', tools: 'Electrical safety analyzer', safety: 'Follow analyzer instructions', procedure: 'Earth resistance and leakage tests.', criteria: 'Per hospital protocol based on applicable electrical safety standard.' },
      { task: 'Manufacturer PM', why: 'Model-specific calibration and wear parts.', tools: 'Service software', safety: 'Device off-patient', procedure: 'Perform manufacturer PM and calibrations.', criteria: 'Model-specific procedure required.' }
    ]
  },
  qa: [
    { id: 'rate', test: 'Flow rate accuracy', setup: 'Pump with dedicated set into infusion pump analyzer; defined rates.', measure: 'Measured mean flow over defined period', unit: '%', example: 'Deviation of measured rate from set rate', report: 'Set vs measured table' },
    { id: 'volume', test: 'Volume delivered', setup: 'Defined VTBI into analyzer.', measure: 'Delivered volume', unit: 'mL', example: 'Deviation from programmed VTBI', report: 'Programmed vs delivered' },
    { id: 'occl', test: 'Downstream occlusion pressure', setup: 'Analyzer occlusion port; each pressure level.', measure: 'Pressure at alarm, time to alarm', unit: 'mmHg / s', example: 'Alarm pressure compared with selected level', report: 'Level vs measured' },
    { id: 'bolus', test: 'Bolus volume', setup: 'After occlusion alarm, release into analyzer.', measure: 'Bolus volume', unit: 'mL', example: 'Bolus compared with configured limit', report: 'Value' },
    { id: 'upocc', test: 'Upstream occlusion detection', setup: 'Close upstream clamp while running.', measure: 'Alarm triggered', unit: '—', example: 'Alarm present', report: 'Pass/fail' },
    { id: 'air', test: 'Air-in-line detection', setup: 'Defined air bubble.', measure: 'Alarm triggered', unit: '—', example: 'Alarm present', report: 'Pass/fail' },
    { id: 'freeflow', test: 'Free-flow prevention', setup: 'Set loaded with fluid head; open door.', measure: 'Flow observed', unit: '—', example: 'No flow', report: 'Pass/fail' },
    { id: 'battery', test: 'Battery run-time', setup: 'Defined rate on battery.', measure: 'Time to low-battery alarm', unit: 'min', example: 'Run time compared with manufacturer spec', report: 'Duration' },
    { id: 'esafety', test: 'Electrical safety', setup: 'Electrical safety analyzer.', measure: 'Earth resistance, leakage', unit: 'Ω / µA', example: 'Measured values compared with configured limits', report: 'Analyzer printout' }
  ],
  troubleshoot: [
    {
      symptom: 'Frequent downstream occlusion alarms',
      causes: [
        { cause: 'Real occlusion (closed clamp, kinked line, blocked cannula)', note: 'Most common — check first.' },
        { cause: 'Wrong or misloaded set', note: 'Set geometry affects sensor reading.' },
        { cause: 'Contaminated / drifted sensor', note: 'Check with analyzer.' },
        { cause: 'Controller fault', note: 'Last.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Replace the downstream pressure sensor', correct: false, why: 'Parts replacement before ruling out real occlusion and set issues.' },
          { t: 'Check the line path and set loading, then run an occlusion test on an analyzer with a new dedicated set', correct: true, why: 'Separates clinical/set causes from a sensor fault using non-invasive, measurable tests.' },
          { t: 'Raise the occlusion pressure limit to maximum', correct: false, why: 'Hides the alarm and increases bolus risk.' },
          { t: 'Reset to factory defaults', correct: false, why: 'Loses configuration and drug library; no diagnosis.' }
        ]
      },
      measure: 'Occlusion alarm pressure and time with analyzer; sensor reading in service mode at no load.',
      decision: 'Analyzer normal → clinical/set issue, educate users. Alarm at low pressure → clean sensor, recalibrate, then replace.',
      repair: 'Clean/calibrate/replace sensor only on evidence.',
      verify: 'Occlusion, bolus and flow accuracy tests; document.'
    },
    {
      symptom: 'Pump over-infusing',
      causes: [
        { cause: 'Free flow from door/clamp fault', note: 'Critical — remove from service.' },
        { cause: 'Wrong set type', note: 'Calibration assumes a specific set.' },
        { cause: 'Mechanism wear', note: 'Pressure plate spring.' },
        { cause: 'Programming error', note: 'Check event log.' }
      ],
      first: {
        prompt: 'What would you do first?',
        options: [
          { t: 'Remove from service, quarantine the set, download the event log, then perform free-flow and rate tests', correct: true, why: 'Preserves evidence and checks the most dangerous cause first with non-invasive tests.' },
          { t: 'Return it to the ward after cleaning', correct: false, why: 'Unresolved dosing fault — patient hazard.' },
          { t: 'Replace the motor', correct: false, why: 'Unproven; motor faults usually cause under-infusion.' },
          { t: 'Delete the event log', correct: false, why: 'Destroys evidence needed for incident investigation.' }
        ]
      },
      measure: 'Event log; free-flow test; flow accuracy with analyzer using the same set type.',
      decision: 'Free flow → door/clamp. Rate high with set → check set type and mechanism. Log shows programming → user issue/report.',
      repair: 'Repair proven cause; report incident per hospital policy.',
      verify: 'Free-flow, rate, occlusion tests; document and report.'
    }
  ],
  errors: [
    { code: 'TRN-I110', desc: 'Door open / clamp fault', causes: ['Latch damage', 'Sensor misalignment', 'Clamp wear'], component: 'doorSensor', checks: ['Inspect latch and clamp', 'Free-flow test'], service: 'Replace latch/clamp/sensor.', verify: 'Free-flow test; door alarm.', pm: 'Door and clamp check' },
    { code: 'TRN-I220', desc: 'Downstream occlusion sensor out of range', causes: ['Contamination', 'Drift', 'Sensor failure'], component: 'downOcclusion', checks: ['Clean', 'Read sensor in service mode', 'Analyzer test'], service: 'Clean, calibrate, replace.', verify: 'Occlusion and bolus test.', pm: 'Occlusion sensor check' },
    { code: 'TRN-I330', desc: 'Air sensor fault', causes: ['Dirty faces', 'Transducer fault'], component: 'airSensor', checks: ['Clean faces', 'Self-test'], service: 'Clean; replace sensor.', verify: 'Air-in-line test.', pm: 'Air sensor test' },
    { code: 'TRN-I440', desc: 'Motor speed mismatch', causes: ['Gearbox wear', 'Encoder fault', 'Mechanism binding'], component: 'motor', checks: ['Listen for noise', 'Check mechanism for residue', 'Log'], service: 'Model-specific procedure required.', verify: 'Flow rate accuracy.', pm: 'Flow rate accuracy check' },
    { code: 'TRN-I550', desc: 'Upstream occlusion detected', causes: ['Closed clamp', 'Empty container', 'Sensor drift'], component: 'upOcclusion', checks: ['Line path', 'Sensor reading'], service: 'Clean/calibrate sensor if no real cause.', verify: 'Upstream occlusion test.', pm: 'Occlusion sensor check' },
    { code: 'TRN-I660', desc: 'Battery depleted / fault', causes: ['Aged pack', 'Charger fault'], component: 'battery', checks: ['Run-time test', 'Mains charging'], service: 'Replace battery.', verify: 'Run-time test.', pm: 'Battery check' }
  ],
  safety: [
    { title: 'Free-flow risk', level: 'danger', text: 'Uncontrolled free flow can deliver a lethal dose within minutes. Any door, clamp or mechanism fault requires immediate removal from service and a free-flow test after repair.' },
    { title: 'Dosing accuracy', level: 'danger', text: 'Over- and under-infusion of high-alert drugs is life-threatening. Release only after documented flow accuracy testing with the dedicated set type.' },
    { title: 'Never bypass alarms', level: 'warning', text: 'Do not increase occlusion limits or disable sensors to stop nuisance alarms; find the cause.' },
    { title: 'Incident evidence', level: 'warning', text: 'After a suspected dosing incident, quarantine pump and set and preserve logs before any service.' },
    { title: 'Fluid ingress and contamination', level: 'caution', text: 'Spilled drugs and body fluids contaminate the mechanism; clean per manual with PPE.' },
    { title: 'Drug library', level: 'info', text: 'Only load drug libraries approved by pharmacy; record the version after service.' }
  ],
  tools: ['infusionAnalyzer', 'esa', 'manometer', 'multimeter'],
  cases: ['incorrectMeasurement', 'alarmMalfunction', 'batteryNotCharging', 'mechanicalNoise', 'calibrationError', 'sensorFailure'],
  scenarios: ['pumpOcclusion'],
  questions: [
    { q: 'How does a peristaltic pump move fluid?', options: ['Gravity only', 'Fingers sequentially squeeze the tubing', 'Heating the fluid', 'Vacuum'], answer: 1, why: 'Sequential compression displaces a known volume.', domain: 'knowledge' },
    { q: 'What prevents free flow when the door is opened?', options: ['Display', 'Anti-free-flow clamp', 'Battery', 'Keypad'], answer: 1, why: 'The clamp occludes the set when the door opens.', domain: 'knowledge' },
    { q: 'Which sensor detects a blocked cannula?', options: ['Upstream occlusion', 'Downstream occlusion', 'Drop sensor', 'Door sensor'], answer: 1, why: 'Blockage after the pump raises downstream pressure.', domain: 'technical' },
    { q: 'Which instrument verifies flow rate accuracy?', options: ['Oscilloscope', 'Infusion pump analyzer', 'Multimeter', 'Thermometer'], answer: 1, why: 'The analyzer measures delivered volume over time.', domain: 'technical' },
    { q: 'Frequent occlusion alarms. First step?', options: ['Replace sensor', 'Check line/set loading then analyzer test with new set', 'Raise limit', 'Factory reset'], answer: 1, why: 'Rule out real occlusion and set issues with measurable tests.', domain: 'troubleshooting' },
    { q: 'Pump suspected of over-infusing. First action?', options: ['Return to ward', 'Quarantine pump and set, preserve log, then test', 'Delete log', 'Replace motor'], answer: 1, why: 'Safety and evidence come first.', domain: 'troubleshooting' },
    { q: 'Why must occlusion limits not be raised to stop nuisance alarms?', options: ['Wastes battery', 'Increases bolus and delays detection', 'Changes colours', 'No reason'], answer: 1, why: 'Higher limits delay alarms and increase bolus on release.', domain: 'safety' },
    { q: 'After repairing a door latch, which test is essential?', options: ['Display test', 'Free-flow prevention test', 'Printer test', 'None'], answer: 1, why: 'The door/clamp prevents free flow.', domain: 'safety' },
    { q: 'What must be recorded after service?', options: ['Nothing', 'Tests performed, results, parts and drug library version', 'Only the date', 'Only cost'], answer: 1, why: 'Full traceability supports safety and audits.', domain: 'documentation' }
  ]
});

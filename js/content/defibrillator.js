/* Content pack: Defibrillator / monitor (generic manual + AED-capable biphasic unit).
   Educational, manufacturer-neutral. Model-specific values must come from the
   manufacturer's service documentation and the hospital's approved protocol. */
BME.registerEquipment({
  id: 'defibrillator',
  summary: 'A defibrillator stores energy from a battery in a high-voltage capacitor and releases it through pads or paddles as a controlled biphasic current pulse to terminate life-threatening arrhythmias. It also monitors ECG, measures patient impedance and may provide transcutaneous pacing. It contains lethal stored energy and must work first time, every time.',
  hazards: [{ label: 'LETHAL HIGH-VOLTAGE ENERGY', type: 'hv' }, { label: 'PATIENT SAFETY CRITICAL', type: 'patient' }],
  principle: [
    'The battery feeds a high-voltage charger (flyback / inverter) that charges the energy storage capacitor.',
    'Stored energy is E = ½·C·V²; the controller stops charging when the capacitor voltage reaches the selected energy.',
    'On shock command the HV relay connects the capacitor to an H-bridge that delivers a biphasic waveform.',
    'Patient transthoracic impedance is measured through the pads; waveform duration/amplitude is compensated.',
    'If the shock is cancelled or times out, the capacitor is discharged into an internal dump resistor.',
    'Self-tests check battery, charger, capacitor and pathways automatically and on demand.'
  ],
  parameters: [
    { name: 'Selected energy', unit: 'J', typical: 'Set by user / protocol', note: 'Delivered energy measured with defibrillator analyzer' },
    { name: 'Charge time', unit: 's', typical: 'Per manufacturer spec', note: 'Depends on battery condition' },
    { name: 'Patient impedance', unit: 'Ω', typical: 'Measured', note: 'Analyzer provides fixed test load' },
    { name: 'Synchronisation delay', unit: 'ms', typical: 'Measured', note: 'R-wave to shock delay in synchronised mode' },
    { name: 'Pacing rate / current', unit: 'ppm / mA', typical: 'Set by user', note: 'Measured with analyzer pacer load' },
    { name: 'Capacitor voltage', unit: 'V (kV range)', typical: 'Model-specific', note: 'Model-specific procedure required' }
  ],
  diagram: {
    w: 1000, h: 560,
    zones: [
      { x: 185, y: 30, w: 700, h: 110, label: 'HIGH VOLTAGE — LETHAL ENERGY', type: 'hv' },
      { x: 600, y: 180, w: 380, h: 220, label: 'PATIENT-CONNECTED PATH', type: 'patient' }
    ],
    nodes: [
      { id: 'battery', x: 40, y: 60, w: 130, h: 54, label: 'Battery' },
      { id: 'charger', x: 200, y: 60, w: 140, h: 54, label: 'HV charger' },
      { id: 'capacitor', x: 370, y: 60, w: 150, h: 54, label: 'Energy capacitor' },
      { id: 'hvRelay', x: 550, y: 60, w: 140, h: 54, label: 'HV relay / switch' },
      { id: 'waveform', x: 720, y: 60, w: 150, h: 54, label: 'Biphasic H-bridge' },
      { id: 'ecg', x: 620, y: 210, w: 150, h: 54, label: 'ECG / impedance' },
      { id: 'paddles', x: 810, y: 210, w: 150, h: 54, label: 'Paddles / pads' },
      { id: 'pacer', x: 810, y: 320, w: 150, h: 54, label: 'Pacer' },
      { id: 'controller', x: 380, y: 300, w: 150, h: 54, label: 'Controller' },
      { id: 'selfTest', x: 40, y: 300, w: 140, h: 54, label: 'Self-test' },
      { id: 'display', x: 200, y: 460, w: 150, h: 54, label: 'Display / UI' },
      { id: 'printer', x: 400, y: 460, w: 150, h: 54, label: 'Printer / event log' }
    ],
    links: [
      ['battery', 'charger', 'DC'], ['charger', 'capacitor', 'HV charge'], ['capacitor', 'hvRelay'],
      ['hvRelay', 'waveform'], ['waveform', 'paddles', 'biphasic shock'], ['paddles', 'ecg', 'ECG / Z'],
      ['ecg', 'controller', 'rhythm, Z'], ['controller', 'charger', 'charge cmd'], ['controller', 'hvRelay', 'arm / dump'],
      ['controller', 'waveform', 'timing'], ['controller', 'pacer'], ['pacer', 'paddles', 'pacing'],
      ['selfTest', 'controller', 'results'], ['controller', 'display'], ['controller', 'printer'], ['battery', 'controller', 'DC']
    ]
  },
  components: {
    battery: {
      name: 'Battery', function: 'Primary energy source for charging and operation.',
      principle: 'High-current rechargeable (or long-life primary) pack; capacity and internal resistance determine charge time and number of shocks.',
      input: 'Charge current from base/charger', output: 'High-current DC',
      normal: 'Charge time and shock count meet manufacturer specification; status indicator OK.',
      failure: 'Capacity loss, high internal resistance, expired pack, damaged contacts.',
      symptoms: 'Slow charging, low battery alarm, failed self-test, unit cannot charge.',
      test: 'Check status/expiry; measure charge time to maximum energy with analyzer; inspect contacts.',
      service: 'Replace pack per age or test result; dispose per regulations.',
      safety: 'High discharge current — short circuit can cause burns and fire.',
      spares: ['Battery pack'], pm: ['Battery status check', 'Charge time test'], qa: ['Charge time']
    },
    charger: {
      name: 'High-voltage charger', function: 'Converts battery DC to the high voltage needed to charge the capacitor.',
      principle: 'Switch-mode inverter / flyback transformer with rectifier; controller monitors capacitor voltage and stops at target.',
      input: 'Battery DC, charge command', output: 'High-voltage DC to capacitor',
      normal: 'Charges to selected energy within specified time.',
      failure: 'Switching transistor failure, transformer fault, feedback divider drift.',
      symptoms: 'No charge, slow charge, wrong energy, charger fault message.',
      test: 'Charge time and delivered energy with analyzer; review self-test log. Internal measurement is Model-specific procedure required.',
      service: 'Model-specific procedure required.',
      safety: 'Generates lethal voltage — never probe while operating outside approved service procedure.',
      spares: ['HV charger board'], pm: [], qa: ['Charge time', 'Delivered energy accuracy']
    },
    capacitor: {
      name: 'Energy storage capacitor', function: 'Stores the shock energy until delivery.',
      principle: 'High-voltage film capacitor; energy E = ½·C·V².',
      input: 'HV charge', output: 'Stored energy to HV relay',
      normal: 'Holds charge; delivers energy matching selection; discharges via dump resistor on cancel.',
      failure: 'Capacitance loss with age, dielectric breakdown, leakage.',
      symptoms: 'Low delivered energy, charge fault, capacitor test failure.',
      test: 'Delivered energy at several settings with analyzer; manufacturer capacitor self-test.',
      service: 'Model-specific procedure required. Specialist work only.',
      safety: 'May retain lethal charge even when switched off — verify discharge per service manual before any internal work.',
      spares: ['Energy storage capacitor'], pm: [], qa: ['Delivered energy accuracy']
    },
    hvRelay: {
      name: 'HV relay / switch', function: 'Connects the charged capacitor to the output stage or the internal dump resistor.',
      principle: 'High-voltage relay or solid-state switch controlled and monitored by the controller.',
      input: 'Arm / shock / dump commands', output: 'Energy routed to output or dump',
      normal: 'Shock delivered on command; internal discharge on cancel/timeout.',
      failure: 'Contact welding or pitting, coil failure, drive fault.',
      symptoms: 'No shock delivered, energy not dumped, self-test failure.',
      test: 'Shock into analyzer; verify disarm/internal discharge function; self-test.',
      service: 'Model-specific procedure required.',
      safety: 'A welded relay could connect energy unexpectedly — remove unit from service.',
      spares: ['HV relay'], pm: [], qa: ['Delivered energy accuracy', 'Internal discharge function']
    },
    waveform: {
      name: 'Biphasic waveform circuit (H-bridge)', function: 'Shapes the delivered current into a biphasic pulse.',
      principle: 'Four HV switches reverse current direction mid-pulse; phase durations adjusted for measured impedance.',
      input: 'Capacitor energy, timing', output: 'Biphasic current pulse to pads',
      normal: 'Correct waveform shape and energy into analyzer at different loads.',
      failure: 'Failed IGBT/switch, gate driver fault.',
      symptoms: 'Shock fault, wrong waveform, energy error.',
      test: 'Capture waveform with defibrillator analyzer (and its scope output) at several loads.',
      service: 'Model-specific procedure required.',
      safety: 'Lethal voltages during delivery.',
      spares: ['Output / H-bridge board'], pm: [], qa: ['Delivered energy accuracy']
    },
    paddles: {
      name: 'Paddles / pads', function: 'Deliver energy to the patient and pick up the ECG.',
      principle: 'Hard paddles with shock buttons or disposable adhesive pads with conductive gel via therapy cable.',
      input: 'Shock current, pacing', output: 'Current through thorax; ECG/impedance signal',
      normal: 'Cable intact; pads in date; paddle buttons work; paddle surfaces clean.',
      failure: 'Broken therapy cable, expired/dried pads, pitted paddle surface, failed shock button.',
      symptoms: 'Pads-off message, high impedance, no shock from paddles, noisy ECG.',
      test: 'Inspect cable and connector; check pad expiry; test into analyzer through the cable.',
      service: 'Replace therapy cable / paddle set; replace expired pads.',
      safety: 'Poor contact causes skin burns and ineffective shock; clean paddles of gel after use.',
      spares: ['Therapy cable', 'Pads', 'Paddle set'], pm: ['Cable and pads inspection'], qa: ['Delivered energy accuracy']
    },
    ecg: {
      name: 'ECG / impedance sensing', function: 'Monitors rhythm and measures patient impedance through pads or leads.',
      principle: 'Protected differential amplifier; a small high-frequency current measures transthoracic impedance; rhythm analysis supports AED and sync.',
      input: 'ECG potentials, sense current', output: 'Rhythm, impedance, R-wave markers',
      normal: 'Correct HR from simulator; correct shock/no-shock advice; sync marker on R-wave.',
      failure: 'Input protection damage, cable fault.',
      symptoms: 'Noisy ECG, wrong advisory decision, sync marker missing.',
      test: 'Analyzer/simulator rhythms (VF, VT, NSR); sync delay test.',
      service: 'Replace cable on evidence; board per manual.',
      safety: 'AED advisory errors are life-critical — always verify with standard rhythms.',
      spares: ['ECG cable'], pm: ['ECG / rhythm check'], qa: ['Synchronised cardioversion delay', 'AED rhythm recognition']
    },
    pacer: {
      name: 'Transcutaneous pacer', function: 'Delivers pacing pulses through pads.',
      principle: 'Constant-current pulse generator triggered on demand or fixed rate.',
      input: 'Rate, current settings, ECG sensing', output: 'Pacing pulses',
      normal: 'Rate and current match settings into analyzer pacer load.',
      failure: 'Output stage failure, sensing failure.',
      symptoms: 'No capture indication, pacer fault message.',
      test: 'Measure pacing rate, current and pulse width with analyzer.',
      service: 'Model-specific procedure required.',
      safety: 'Painful to conscious patients; never test on persons.',
      spares: [], pm: ['Pacer check'], qa: ['Pacer output']
    },
    controller: {
      name: 'Controller', function: 'Coordinates charging, delivery, monitoring, safety interlocks and logging.',
      principle: 'Microcontroller(s) with watchdog monitor HV voltage, relays and user inputs.',
      input: 'User commands, sensor feedback', output: 'Charge/shock/dump commands, display, log',
      normal: 'Self-test pass; no internal errors.',
      failure: 'Firmware fault, component failure.',
      symptoms: 'Self-test failure, unexpected shutdown, controls unresponsive.',
      test: 'Review event and error log; verify rails.',
      service: 'Replace only after battery, cables and self-test evidence; Model-specific procedure required.',
      safety: 'ESD protection; ensure capacitor discharged before handling boards.',
      spares: ['Controller board'], pm: ['Event log review'], qa: []
    },
    display: {
      name: 'Display / UI', function: 'Shows ECG, energy, prompts and alarms; provides controls.',
      principle: 'LCD plus energy selector, charge and shock buttons, voice prompts in AED mode.',
      input: 'Display data, user input', output: 'Visual/audio interface',
      normal: 'Legible; all buttons and prompts work.',
      failure: 'Backlight failure, worn buttons, speaker failure.',
      symptoms: 'Dark display, button not responding, no voice prompts.',
      test: 'Exercise all controls; check prompts and alarms.',
      service: 'Replace display or keypad assembly.',
      safety: 'Unreadable energy selection is a clinical hazard.',
      spares: ['Display', 'Keypad'], pm: ['Controls check'], qa: []
    },
    printer: {
      name: 'Printer / event log', function: 'Records ECG strips and event data.',
      principle: 'Thermal printer; internal memory stores events for review/export.',
      input: 'Event data', output: 'Strip / event report',
      normal: 'Clear print; time/date correct.',
      failure: 'Worn print head, paper jam, wrong clock.',
      symptoms: 'Faint print, missing events, wrong timestamps.',
      test: 'Print test strip; check time and date.',
      service: 'Clean print head; replace printer; set clock.',
      safety: 'Wrong timestamps compromise clinical and legal records.',
      spares: ['Printer paper', 'Printer module'], pm: ['Printer and clock check'], qa: []
    },
    selfTest: {
      name: 'Self-test system', function: 'Automatically verifies readiness.',
      principle: 'Daily/weekly automatic tests check battery, internal circuits and sometimes an internal charge/discharge; status indicator shows ready/not ready.',
      input: 'Scheduled trigger', output: 'Ready status, test report',
      normal: 'Ready indicator shows OK; no failed tests in log.',
      failure: 'Detects faults in other blocks; indicator failure.',
      symptoms: 'Not-ready indicator, service alarm chirp.',
      test: 'Run user/manual self-test; review result log.',
      service: 'Diagnose the block reported by the self-test.',
      safety: 'Self-test does not replace analyzer testing.',
      spares: [], pm: ['Readiness check'], qa: []
    }
  },
  workflow: [
    { title: 'Readiness', active: ['selfTest', 'battery', 'controller'], what: 'Automatic self-test confirms battery and circuits are ready.', signal: 'Ready indicator', parameter: 'Status', fail: 'Low battery, failed internal test.' },
    { title: 'ECG and impedance', active: ['paddles', 'ecg'], what: 'Pads sense the rhythm and patient impedance.', signal: 'ECG, Z', parameter: 'Rhythm, Ω', fail: 'Pads off, high impedance.' },
    { title: 'Rhythm analysis', active: ['ecg', 'controller'], what: 'Controller analyses rhythm (AED) or user decides (manual).', signal: 'Shock advisory', parameter: 'Rhythm class', fail: 'Noise, wrong advisory.' },
    { title: 'Energy selection', active: ['display', 'controller'], what: 'User or protocol selects energy.', signal: 'Energy setpoint', parameter: 'J', fail: 'Selector fault.' },
    { title: 'Charging', active: ['battery', 'charger', 'capacitor'], what: 'Charger raises capacitor voltage to the target.', signal: 'Capacitor voltage feedback', parameter: 'Charge time', fail: 'Weak battery, charger fault.' },
    { title: 'Armed', active: ['capacitor', 'hvRelay', 'controller'], what: 'Charged and waiting for shock; auto-dump after timeout.', signal: 'Ready-to-shock', parameter: 'Stored energy', fail: 'Leakage loses charge.' },
    { title: 'Synchronisation', active: ['ecg', 'controller'], what: 'In sync mode, shock is timed to the R-wave.', signal: 'R-wave marker', parameter: 'Sync delay', fail: 'Missed R-wave.' },
    { title: 'Delivery', active: ['hvRelay', 'waveform', 'paddles'], what: 'Relay closes; H-bridge delivers a biphasic pulse through the patient.', signal: 'Output current', parameter: 'Delivered J', fail: 'Switch failure, cable fault.' },
    { title: 'Internal discharge', active: ['hvRelay', 'controller'], what: 'If cancelled, energy is dumped into an internal resistor.', signal: 'Dump command', parameter: 'Residual voltage', fail: 'Relay fault — residual charge.' },
    { title: 'Pacing', active: ['pacer', 'paddles'], what: 'Pacer delivers current pulses at set rate.', signal: 'Pacing pulses', parameter: 'mA, ppm', fail: 'Output stage failure.' },
    { title: 'Record', active: ['printer', 'controller'], what: 'Events are logged and printed.', signal: 'Event data', parameter: 'Timestamps', fail: 'Clock wrong, printer fault.' }
  ],
  operation: [
    { step: 'Readiness check', detail: 'Check ready indicator, battery status, pads in date, cables connected, paper present.' },
    { step: 'Apply pads', detail: 'Apply pads per diagram; confirm ECG and acceptable impedance.' },
    { step: 'Analyse / select energy', detail: 'AED mode: follow prompts. Manual mode: interpret rhythm and select energy per clinical protocol.' },
    { step: 'Charge and clear', detail: 'Charge; ensure nobody is touching the patient or bed.' },
    { step: 'Deliver', detail: 'Press shock; resume CPR as per protocol; use sync for cardioversion.' },
    { step: 'Post-event', detail: 'Download/print event record; replace pads; return unit to ready state; report faults.' }
  ],
  pm: {
    daily: [
      { task: 'Readiness check', why: 'A defibrillator must be ready without warning.', tools: 'Checklist', safety: '—', procedure: 'Confirm ready indicator, battery, pads expiry, cables, paper.', criteria: 'Ready; all consumables present and in date.' }
    ],
    weekly: [
      { task: 'User shock test', why: 'Confirms charge and delivery path where the manufacturer provides a test load.', tools: 'Manufacturer test load or analyzer', safety: 'Never discharge into air or onto a person', procedure: 'Perform manufacturer user test into test load.', criteria: 'Test passes.' }
    ],
    monthly: [
      { task: 'Cable and pads inspection', why: 'Therapy cables fail at strain reliefs.', tools: 'Visual', safety: 'Unit off', procedure: 'Inspect therapy and ECG cables, connectors and paddle surfaces.', criteria: 'No damage; clean paddle surfaces.' },
      { task: 'Battery status check', why: 'Battery limits shock availability.', tools: 'Unit status display', safety: '—', procedure: 'Check capacity indicator and expiry.', criteria: 'In date; adequate capacity.' }
    ],
    quarterly: [
      { task: 'Printer and clock check', why: 'Event records must be accurate.', tools: 'Reference clock', safety: '—', procedure: 'Print test strip; check time and date.', criteria: 'Clear print; correct time.' },
      { task: 'Event log review', why: 'Self-test failures may be intermittent.', tools: 'Service software', safety: 'Protect patient data', procedure: 'Review self-test and error history.', criteria: 'No unresolved failures.' }
    ],
    halfyearly: [
      { task: 'Delivered energy and charge time', why: 'Core performance of the device.', tools: 'Defibrillator analyzer', safety: 'Discharge only into analyzer', procedure: 'Measure delivered energy at several settings and charge time to maximum.', criteria: 'Within configured limits.' },
      { task: 'ECG / rhythm check', why: 'AED advisory and sync depend on it.', tools: 'Defibrillator analyzer / simulator', safety: 'Analyzer only', procedure: 'Apply NSR, VF, VT; test sync delay.', criteria: 'Correct advisories; sync within configured limit.' }
    ],
    annual: [
      { task: 'Electrical safety test', why: 'Applied part leakage and enclosure safety.', tools: 'Electrical safety analyzer', safety: 'Follow analyzer instructions', procedure: 'Earth (if applicable), enclosure and patient leakage.', criteria: 'Per hospital protocol based on applicable electrical safety standard.' },
      { task: 'Pacer check', why: 'Pacing output must match settings.', tools: 'Defibrillator analyzer with pacer load', safety: 'Analyzer only', procedure: 'Measure rate, current and pulse width.', criteria: 'Within configured limits.' },
      { task: 'Manufacturer PM', why: 'Model-specific checks.', tools: 'Service software', safety: 'Capacitor discharge per manual', procedure: 'Perform manufacturer PM checklist.', criteria: 'Model-specific procedure required.' }
    ]
  },
  qa: [
    { id: 'energy', test: 'Delivered energy accuracy', setup: 'Pads/paddles into defibrillator analyzer at fixed test load.', measure: 'Delivered energy at several selected energies', unit: 'J', example: 'Deviation of delivered energy from selected energy', report: 'Selected vs delivered table' },
    { id: 'charge', test: 'Charge time', setup: 'Defined battery state; charge to maximum energy.', measure: 'Time from charge command to ready', unit: 's', example: 'Charge time compared with manufacturer specification', report: 'Time' },
    { id: 'sync', test: 'Synchronised cardioversion delay', setup: 'Analyzer provides ECG; sync mode.', measure: 'R-wave to shock delay', unit: 'ms', example: 'Measured delay compared with configured limit', report: 'Delay' },
    { id: 'aed', test: 'AED rhythm recognition', setup: 'Analyzer rhythms: VF, VT, NSR, asystole.', measure: 'Shock / no-shock decision', unit: '—', example: 'Correct advisory for each rhythm', report: 'Checklist' },
    { id: 'pacer', test: 'Pacer output', setup: 'Analyzer pacer load.', measure: 'Rate, current, pulse width', unit: 'ppm / mA / ms', example: 'Deviation from set rate and current', report: 'Set vs measured' },
    { id: 'dump', test: 'Internal discharge function', setup: 'Charge then cancel / wait for timeout.', measure: 'Unit disarms and dumps energy', unit: '—', example: 'Disarm occurs as specified', report: 'Pass/fail' },
    { id: 'ecghr', test: 'ECG heart-rate accuracy', setup: 'Analyzer NSR at several rates.', measure: 'Displayed HR', unit: 'bpm', example: 'Deviation from simulated rate', report: 'Simulated vs displayed' },
    { id: 'esafety', test: 'Electrical safety', setup: 'Electrical safety analyzer.', measure: 'Leakage currents', unit: 'µA', example: 'Measured values compared with configured limits', report: 'Analyzer printout' }
  ],
  troubleshoot: [
    {
      symptom: 'Defibrillator will not charge',
      causes: [
        { cause: 'Battery depleted / aged', note: 'Most common and least invasive to check.' },
        { cause: 'Pads/cable not connected (some modes inhibit charge)', note: 'Check configuration.' },
        { cause: 'HV charger failure', note: 'Self-test/log evidence needed.' },
        { cause: 'Capacitor failure', note: 'Specialist diagnosis.' },
        { cause: 'Controller fault', note: 'Last.' }
      ],
      first: {
        prompt: 'What would you test first?',
        options: [
          { t: 'Open the unit and measure capacitor voltage', correct: false, why: 'Dangerous and unnecessary before simple checks; lethal stored energy.' },
          { t: 'Check battery status, try a known-good charged battery / mains, and review the self-test log', correct: true, why: 'Battery problems are the most common cause and checks are external, safe and quick; the log gives evidence.' },
          { t: 'Replace the HV charger board', correct: false, why: 'Parts replacement without evidence.' },
          { t: 'Discharge the paddles together in air to test', correct: false, why: 'Never discharge into air or paddles together — damage and hazard. Use an analyzer.' }
        ]
      },
      measure: 'Battery status/voltage, result with known-good battery, self-test log, charge time into analyzer.',
      decision: 'Known-good battery fixes it → replace battery. Still fails with log charger error → charger path per service manual.',
      repair: 'Replace confirmed faulty item; internal HV work only by trained, authorised staff.',
      verify: 'Delivered energy and charge time with analyzer; self-test; document.'
    },
    {
      symptom: 'Delivered energy lower than selected',
      causes: [
        { cause: 'Analyzer setup / load error', note: 'Verify test setup first.' },
        { cause: 'Damaged therapy cable', note: 'Resistive connection.' },
        { cause: 'Capacitor ageing', note: 'Gradual drop over time.' },
        { cause: 'Output stage fault', note: 'Waveform distorted.' }
      ],
      first: {
        prompt: 'What would you check first?',
        options: [
          { t: 'Verify analyzer settings and load, then repeat with a known-good therapy cable', correct: true, why: 'Eliminates test-setup and cable faults before suspecting internal components.' },
          { t: 'Replace capacitor', correct: false, why: 'Invasive and unproven.' },
          { t: 'Increase selected energy to compensate', correct: false, why: 'Masks a fault and creates clinical error.' },
          { t: 'Recalibrate the display', correct: false, why: 'Display does not affect delivered energy.' }
        ]
      },
      measure: 'Delivered energy at several settings; waveform capture; trend vs previous PM.',
      decision: 'Cable swap fixes → cable. Proportional deficit at all energies → capacitor/charger. Waveform distortion → output stage.',
      repair: 'Model-specific procedure required for internal HV components.',
      verify: 'Full energy table; self-test; document.'
    }
  ],
  errors: [
    { code: 'TRN-D110', desc: 'Battery low / fault', causes: ['Depleted pack', 'Aged pack', 'Contact fault'], component: 'battery', checks: ['Status display', 'Known-good battery', 'Contacts'], service: 'Replace battery.', verify: 'Charge time test.', pm: 'Battery status check' },
    { code: 'TRN-D220', desc: 'Charge fault — target not reached', causes: ['Charger fault', 'Capacitor fault', 'Weak battery'], component: 'charger', checks: ['Known-good battery', 'Self-test log'], service: 'Model-specific procedure required.', verify: 'Energy and charge time with analyzer.', pm: '—' },
    { code: 'TRN-D330', desc: 'Capacitor self-test failed', causes: ['Capacitance loss', 'Leakage'], component: 'capacitor', checks: ['Self-test history', 'Energy trend'], service: 'Model-specific procedure required.', verify: 'Energy table with analyzer.', pm: '—' },
    { code: 'TRN-D440', desc: 'Internal discharge fault', causes: ['HV relay fault', 'Dump circuit fault'], component: 'hvRelay', checks: ['Self-test log'], service: 'Remove from service. Model-specific procedure required.', verify: 'Internal discharge test; energy table.', pm: '—' },
    { code: 'TRN-D550', desc: 'Pads / therapy cable fault', causes: ['Cable damage', 'Expired pads', 'Connector'], component: 'paddles', checks: ['Inspect cable', 'Known-good cable/pads'], service: 'Replace cable/pads.', verify: 'Shock into analyzer through cable.', pm: 'Cable and pads inspection' },
    { code: 'TRN-D660', desc: 'Pacer output fault', causes: ['Output stage', 'Cable'], component: 'pacer', checks: ['Analyzer pacer test', 'Known-good cable'], service: 'Model-specific procedure required.', verify: 'Pacer output test.', pm: 'Pacer check' }
  ],
  safety: [
    { title: 'Capacitor discharge', level: 'danger', text: 'The energy storage capacitor can retain a lethal charge after power-off. Only trained, authorised staff may open the unit, and only after verified discharge per the service manual.' },
    { title: 'Never open a charged unit', level: 'danger', text: 'Do not open, probe or disassemble a defibrillator that is charged or armed. Remove battery and allow/verify discharge first.' },
    { title: 'Test into an analyzer only', level: 'danger', text: 'Discharge only into a defibrillator analyzer or the manufacturer test load. Never discharge into air, paddles together, or any person.' },
    { title: 'Clear the patient', level: 'warning', text: 'During testing and use nobody may touch the patient, bed or the analyzer terminals during charge and shock.' },
    { title: 'Readiness', level: 'warning', text: 'A defibrillator removed from service must be replaced immediately so the clinical area is never without one.' },
    { title: 'Release to service', level: 'info', text: 'Return only after documented energy, charge time, sync, pacer and self-test checks.' }
  ],
  tools: ['defibAnalyzer', 'esa', 'patientSim', 'multimeter', 'oscilloscope'],
  cases: ['noPower', 'batteryNotCharging', 'calibrationError', 'softwareError', 'excessiveLeakage'],
  scenarios: ['defibNoCharge'],
  questions: [
    { q: 'Stored capacitor energy is given by…', options: ['E = V·I', 'E = ½·C·V²', 'E = I²·R', 'E = C/V'], answer: 1, why: 'Energy stored in a capacitor is half C times V squared.', domain: 'knowledge' },
    { q: 'What does the H-bridge do?', options: ['Charges the battery', 'Reverses current mid-pulse to form a biphasic waveform', 'Prints strips', 'Measures temperature'], answer: 1, why: 'Four switches reverse current direction.', domain: 'technical' },
    { q: 'Why is patient impedance measured?', options: ['For billing', 'To compensate the waveform and detect pad contact', 'To set the clock', 'To charge faster'], answer: 1, why: 'Impedance affects delivered current and indicates contact quality.', domain: 'knowledge' },
    { q: 'Unit will not charge. First step?', options: ['Open and measure capacitor', 'Check battery, try known-good battery, review log', 'Replace charger', 'Discharge in air'], answer: 1, why: 'Safe, quick, external and evidence-based.', domain: 'troubleshooting' },
    { q: 'Delivered energy is low. Before blaming the capacitor you should…', options: ['Raise energy setting', 'Verify analyzer setup and swap therapy cable', 'Replace display', 'Ignore'], answer: 1, why: 'Rule out setup and cable first.', domain: 'troubleshooting' },
    { q: 'Where may a defibrillator be discharged for testing?', options: ['Into air', 'Paddles together', 'Into a defibrillator analyzer or approved test load', 'Into a test colleague'], answer: 2, why: 'Only approved loads are safe and give measurements.', domain: 'safety' },
    { q: 'After power-off, the capacitor…', options: ['Is always safe', 'May still hold lethal charge', 'Has no voltage', 'Recharges itself'], answer: 1, why: 'Verify discharge per service manual.', domain: 'safety' },
    { q: 'Which instrument measures delivered energy?', options: ['Multimeter', 'Defibrillator analyzer', 'Manometer', 'Thermometer'], answer: 1, why: 'Analyzers provide a calibrated load and measure J.', domain: 'technical' },
    { q: 'Where should acceptance limits for delivered energy come from?', options: ['A forum', 'Hospital-approved protocol based on manufacturer documentation and applicable standards', 'Memory', 'Guesswork'], answer: 1, why: 'Limits vary by model and jurisdiction.', domain: 'documentation' }
  ]
});

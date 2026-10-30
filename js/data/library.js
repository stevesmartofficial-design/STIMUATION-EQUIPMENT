/* Shared training library: service tools, service cases, fault-simulation
   scenarios, image-quality artifacts, electrical & safety topics, and the
   generic PM / question bank used by equipment without a full content pack.
   All error codes are fictional TRN-* training codes. */
(function () {
  /* ---------------- SERVICE TOOLS LAB ---------------- */
  const T = (id, name, purpose, select, connect, measure, expected, interpret, document, quiz) =>
    BME.addTool({ id, name, purpose, steps: { select, connect, measure, expected, interpret, document }, quiz });

  T('esa', 'Electrical Safety Analyzer', 'Measures protective-earth resistance, insulation resistance and leakage currents of medical electrical equipment.',
    'Use for every mains-powered device at acceptance, after repair and at scheduled PM.',
    'Plug the device under test into the analyzer test socket; connect the enclosure probe to an exposed conductive part; connect applied parts to the AP terminals.',
    'Run sequence: mains voltage → protective earth resistance → insulation → earth leakage → touch/enclosure leakage → patient leakage (normal and single-fault conditions).',
    'Values within the limits configured from the hospital protocol and the applicable electrical safety standard for the device class and applied-part type.',
    'High PE resistance → damaged cord/plug/earth path. High leakage → insulation breakdown, contaminated filters, damaged isolation.',
    'Record analyzer serial and calibration date, device class/type, every measured value, limit and pass/fail.',
    { q: 'High protective-earth resistance most likely indicates…', options: ['Damaged power cord or earth connection', 'Low battery', 'Software fault', 'Dirty screen'], answer: 0 });
  T('defibAnalyzer', 'Defibrillator Analyzer', 'Measures delivered energy, waveform, charge time, synchronised cardioversion timing and pacing output.',
    'Use for defibrillator PM, post-repair and performance testing.',
    'Place paddles on the analyzer plates or connect pads cable via adapter. Never discharge into air or open circuit.',
    'Deliver shocks at several energy settings; measure charge time from full and low battery; test sync delay with simulated ECG.',
    'Delivered energy within the configured tolerance of selected energy; charge time within manufacturer spec.',
    'Low energy at all settings → capacitor/HV path. Long charge time → battery/charger.',
    'Record each setting vs measured, charge time, sync delay and battery condition.',
    { q: 'Where should a defibrillator be discharged during testing?', options: ['Into the analyzer load', 'Into air', 'Onto a metal bench', 'Into a multimeter'], answer: 0 });
  T('ventAnalyzer', 'Ventilator / Gas-Flow Analyzer', 'Measures flow, volume, pressure, O₂ concentration and breath timing.',
    'Use for ventilator, anaesthesia machine, CPAP/BiPAP performance testing.',
    'Insert in-line between ventilator circuit and test lung; select gas type and correction standard (e.g. BTPS/ATP) to match the ventilator.',
    'Record Vt, PIP, PEEP, rate, I:E, FiO₂ at each test point.',
    'Measured values within configured limits of set values.',
    'Consistent volume offset → wrong gas correction or flow sensor calibration.',
    'Record settings, gas correction used, test lung parameters, results.',
    { q: 'A constant volume offset across all settings is often caused by…', options: ['Wrong gas correction setting', 'Broken display', 'Low battery', 'Network failure'], answer: 0 });
  T('infusionAnalyzer', 'Infusion Pump Analyzer', 'Measures flow rate, volume and occlusion pressure.',
    'Use for infusion and syringe pump accuracy and occlusion testing.',
    'Prime the set with the test fluid; connect the output to the analyzer channel; remove air.',
    'Run flow test at defined rates for a defined time; run occlusion test to alarm.',
    'Flow accuracy and occlusion alarm pressure within configured limits.',
    'Low flow → mechanism wear, wrong set, upstream restriction.',
    'Record rate, duration, measured volume, % error, occlusion pressure/time.',
    { q: 'Before an infusion flow test you must…', options: ['Remove all air from the set', 'Unplug the pump', 'Disable alarms', 'Use any set'], answer: 0 });
  T('patientSim', 'Patient Simulator', 'Generates ECG, SpO₂, NIBP, IBP, temperature and respiration signals.',
    'Use to verify patient monitor and ECG accuracy and alarms.',
    'Connect lead wires, SpO₂ finger simulator, NIBP cuff/mandrel, IBP and temperature adapters.',
    'Set known values (e.g. HR, pressures) and compare displayed values; trigger arrhythmias for alarm tests.',
    'Displayed values within configured tolerance.',
    'One channel wrong → that module/cable. All channels wrong → main board/configuration.',
    'Record simulated vs displayed for each parameter and alarm results.',
    { q: 'All parameters read correctly except ECG on one lead. Suspect first…', options: ['That lead wire / cable', 'Main PCB', 'Display', 'Battery'], answer: 0 });
  T('manometer', 'Pressure Calibrator / Manometer', 'Applies and measures reference pressure.',
    'Use for NIBP, IBP, gas regulators and ventilator pressure sensors.',
    'Connect via T-piece to the device pressure path; ensure no leaks.',
    'Apply several pressures across the range and record device readings.',
    'Within configured tolerance; static leak below limit.',
    'Offset at all points → zero error; gain error → calibration.',
    'Record reference vs device readings.',
    { q: 'A reading that is wrong by the same amount at every point is a…', options: ['Zero/offset error', 'Gain error', 'Noise', 'Leak'], answer: 0 });
  T('tempSim', 'Temperature Simulator', 'Simulates thermistor probe resistance for temperature channels.',
    'Use for patient monitor temperature, incubators, warmers.',
    'Connect simulator to the temperature input using the matching probe type adapter.',
    'Select several temperatures and compare.',
    'Within configured tolerance.',
    'Wrong probe type selection gives large errors.',
    'Record simulated vs displayed.',
    { q: 'Large temperature error on all points — first check?', options: ['Probe type / adapter setting', 'Replace PCB', 'Replace display', 'Battery'], answer: 0 });
  T('multimeter', 'Digital Multimeter', 'Measures voltage, current, resistance and continuity.',
    'Use for power rails, fuses, cables, sensors.',
    'Select correct function and range BEFORE connecting; use CAT-rated probes.',
    'Measure rails at test points; continuity of cables with power OFF.',
    'Values match service-manual test point values.',
    'Rail low → PSU/load fault. Open cable → replace cable.',
    'Record test point, expected, measured.',
    { q: 'Resistance/continuity measurements must be made…', options: ['With power OFF', 'With power ON', 'During exposure', 'Any time'], answer: 0 });
  T('oscilloscope', 'Oscilloscope', 'Displays signals over time — waveforms, noise, timing.',
    'Use for sensor signals, motor drive, communication lines, ripple.',
    'Use proper probe compensation; ground clip to signal ground; differential probe for mains-referenced circuits.',
    'Capture waveform; measure amplitude, frequency, rise time, ripple.',
    'Waveform shape and amplitude per service documentation.',
    'Excess ripple → failing capacitors. Missing pulses → driver fault.',
    'Save screenshots with settings.',
    { q: 'To measure a mains-referenced circuit safely you use…', options: ['A differential probe', 'A standard probe ground clip on mains', 'A multimeter only', 'No probe'], answer: 0 });
  T('powerAnalyzer', 'Power Analyzer', 'Measures voltage, current, power, power factor, harmonics.',
    'Use for site power, UPS and large imaging installations.',
    'Connect voltage leads and current clamps per phase; observe phase rotation.',
    'Log during idle and peak load (e.g. exposure).',
    'Within site-planning specification.',
    'Voltage sag at exposure → supply impedance too high.',
    'Record log, peak values and timestamps.',
    { q: 'An imaging system faults only during exposure. Measure…', options: ['Supply voltage sag under load', 'Room temperature', 'Display brightness', 'Network speed'], answer: 0 });
  T('radMeter', 'Radiation / kV Meter (Multifunction X-ray QA)', 'Measures kVp, exposure time, dose, HVL and dose rate.',
    'Use for X-ray, CT, fluoroscopy, mammography QA.',
    'Place detector in the beam at defined distance; align collimation; wear dosimeter.',
    'Expose at defined kV/mA/time; record kVp, time, dose; repeat for reproducibility.',
    'Within configured protocol limits.',
    'kVp deviation → generator calibration. Poor reproducibility → generator/tube.',
    'Record technique factors and results.',
    { q: 'When measuring X-ray output you must…', options: ['Wear a dosimeter and stay behind the barrier', 'Stand next to the tube', 'Disable interlocks', 'Skip collimation'], answer: 0 });
  T('testLung', 'Test Lung', 'Provides defined compliance and resistance for ventilator testing.',
    'Use with a ventilator analyzer.', 'Connect to Y-piece via analyzer.',
    'Select compliance/resistance setting.', 'Stable breath delivery.',
    'Leaky test lung invalidates results.', 'Record compliance/resistance used.',
    { q: 'Why record the test-lung settings?', options: ['Results depend on load', 'Not needed', 'For warranty', 'For colour'], answer: 0 });
  T('ctPhantom', 'CT QA Phantom', 'Measures CT number accuracy, uniformity, noise, slice thickness, resolution.',
    'Use for CT daily/periodic QA.', 'Centre phantom in the gantry using lasers.',
    'Scan with the protocol defined in the QA programme; place ROIs.', 'Within configured limits / baseline.',
    'Uniformity change → detector/calibration. Rings → detector channel.', 'Record ROI values vs baseline.',
    { q: 'CT number of water should be compared to…', options: ['Configured limit / baseline', 'Any value', 'Room temperature', 'kV'], answer: 0 });
  T('mriPhantom', 'MRI QA Phantom', 'Measures SNR, uniformity, geometric accuracy, ghosting.',
    'Use for MRI periodic QA.', 'Position phantom in the coil at isocentre; allow to settle.',
    'Run the defined QA sequence; measure ROIs.', 'Within configured limits / baseline.',
    'SNR drop → coil/RF chain. Ghosting → gradient/stability.', 'Record results vs baseline.',
    { q: 'A sudden SNR drop on one coil only suggests…', options: ['Coil or its connection', 'Magnet failure', 'Network', 'Chiller'], answer: 0 });
  T('usPhantom', 'Ultrasound QA Phantom', 'Tissue-mimicking phantom for depth, resolution, dead zone, uniformity.',
    'Use for ultrasound probe and system QA.', 'Apply gel; hold probe perpendicular.',
    'Image targets; check uniformity for dropouts.', 'Consistent with baseline.',
    'Vertical dark band → dead elements / cable.', 'Save images with settings.',
    { q: 'A vertical dark stripe in a uniform phantom image indicates…', options: ['Dead elements or cable fault', 'Too much gel', 'Wrong patient', 'Low battery'], answer: 0 });
  T('dicomTools', 'Network & DICOM Test Tools', 'Ping, traceroute, DICOM C-ECHO (verification), log viewers.',
    'Use for modality → PACS / RIS / worklist faults.', 'Laptop on the same VLAN or use the modality service tools.',
    'Ping PACS IP; run DICOM verification from the modality; check AE title/port configuration.', 'Ping replies; C-ECHO success.',
    'Ping OK but C-ECHO fails → AE title/port/PACS configuration. Ping fails → network/IP.', 'Record configuration and test results.',
    { q: 'Ping succeeds but DICOM verification fails. Most likely…', options: ['AE title or port mismatch', 'Cable unplugged', 'Power failure', 'Monitor fault'], answer: 0 });

  /* ---------------- SERVICE CASE LIBRARY ---------------- */
  const C = (id, title, equipment, priority, complaint, context, checks, causes, fix, verify, lesson) =>
    BME.addCase({ id, title, equipment, priority, complaint, context, checks, causes, fix, verify, lesson });

  C('noPower', 'Machine not powering ON', 'patientMonitor', 'High', 'Monitor in Bed 4 ICU does not switch on.', 'Nurse moved the bed overnight. Battery indicator dark.',
    [['Check wall outlet with known-good device', 'Outlet works.'], ['Inspect power cord', 'Cord pinched by bed wheel — insulation crushed near plug.'], ['Measure cord continuity', 'Live conductor open circuit.'], ['Check internal fuse', 'Fuse intact.']],
    [['Damaged power cord', true], ['Main PCB failure', false], ['Battery failure', false], ['Display failure', false]],
    'Replace power cord with the manufacturer-specified cord.', 'Power on, battery charging indicator, electrical safety test (PE resistance, leakage).', 'Start at the outside: outlet → cord → fuse → PSU. Battery was flat because the device had no mains overnight.');
  C('intermittentShutdown', 'Intermittent shutdown', 'ventilator', 'Critical', 'Ventilator restarted twice during the night.', 'Event log shows power-loss events; the unit sits on a mobile stand.',
    [['Review event log', 'Repeated "AC lost" then "battery low" events.'], ['Check battery run-time', 'Battery lasts under 2 minutes.'], ['Wiggle-test mains inlet', 'Intermittent contact at IEC inlet.'], ['Check PCB temperature', 'Normal.']],
    [['Loose mains inlet + exhausted battery', true], ['Firmware bug', false], ['Flow sensor', false], ['Display', false]],
    'Replace mains inlet/cord retention; replace battery.', 'Run-time test; mains interruption test; full functional test; alarm test.', 'Two faults combined: intermittent mains AND a battery unable to bridge the gap.');
  C('displayFailure', 'Display failure', 'ultrasound', 'Medium', 'Ultrasound screen goes black, system still beeps.', 'Faint image visible with a torch on the screen.',
    [['Torch test on LCD', 'Faint image visible → LCD panel receives video.'], ['Measure backlight supply', 'No backlight voltage.'], ['Check backlight connector', 'Connector seated.'], ['External monitor output', 'Image OK.']],
    [['Backlight / inverter failure', true], ['Graphics board failure', false], ['Probe failure', false], ['Software crash', false]],
    'Replace backlight driver / LED strip per service manual.', 'Brightness uniformity; full imaging check.', 'A faint image means video is present — isolate to backlight, not the graphics chain.');
  C('batteryNotCharging', 'Battery not charging', 'defibrillator', 'Critical', 'Defibrillator shows "battery low" despite being on charge.', 'Unit is 5 years old; charging dock replaced last month.',
    [['Check charger LED', 'Charging LED on.'], ['Measure battery voltage', 'Low and not rising after 2 h.'], ['Swap known-good battery', 'Known-good battery charges normally.'], ['Check battery age/label', 'Beyond service life.']],
    [['Battery end-of-life', true], ['Charger failure', false], ['HV capacitor', false], ['Paddles', false]],
    'Replace battery with approved part.', 'Charge-time test, energy test with defib analyzer, self-test.', 'A known-good substitution test separates battery from charger quickly.');
  C('excessiveLeakage', 'Excessive leakage current', 'patientMonitor', 'High', 'Annual electrical safety test failed on enclosure leakage.', 'Unit was exposed to fluid spill last month.',
    [['Repeat test with known-good cord', 'Still fails.'], ['Visual inspection inside', 'Dried fluid residue on PSU board.'], ['Insulation test', 'Reduced insulation.'], ['Check earth resistance', 'Within limit.']],
    [['Fluid contamination on PSU', true], ['Bad analyzer', false], ['Software', false], ['Battery', false]],
    'Remove from service; clean or replace PSU per manufacturer procedure.', 'Full electrical safety test; functional test.', 'Never return a device that fails electrical safety. Investigate the cause, not just the number.');
  C('sensorFailure', 'Sensor failure', 'ventilator', 'High', '"Flow sensor fault" after reprocessing.', 'Sensor reprocessed in CSSD yesterday.',
    [['Visual inspection', 'Moisture inside sensor body.'], ['Sensor calibration', 'Fails.'], ['Swap known-good sensor', 'Calibration passes.'], ['Cable check', 'OK.']],
    [['Sensor damaged/wet after reprocessing', true], ['Control PCB', false], ['Turbine', false], ['O₂ cell', false]],
    'Replace sensor; review reprocessing method with CSSD.', 'Calibration; volume accuracy with analyzer.', 'Fix the process, not just the part — otherwise it fails again.');
  C('commFailure', 'Communication failure', 'infusionPump', 'Medium', 'Pump shows "internal communication error" at power-on.', 'Pump was dropped from an IV pole.',
    [['Error log', 'Comm error between UI and motor controller.'], ['Open & inspect', 'Ribbon cable partially unseated.'], ['Reseat cable', 'Error clears.'], ['Mechanical check', 'Door latch cracked.']],
    [['Unseated ribbon cable after drop', true], ['Motor failure', false], ['Battery', false], ['Firmware', false]],
    'Reseat cable; replace cracked latch; inspect for other drop damage.', 'Flow accuracy and occlusion tests; door sensor test.', 'After a drop, inspect mechanically AND test fully — hidden damage is common.');
  C('networkFailure', 'Network failure', 'patientMonitor', 'Medium', 'Bed 12 not showing on central station.', 'Wall port replaced by IT.',
    [['Link LED', 'No link.'], ['Test port with laptop', 'No connection — port unpatched.'], ['Check monitor IP config', 'Correct.'], ['Central station', 'Others online.']],
    [['Wall port not patched to the monitoring VLAN', true], ['Monitor network card', false], ['Central station', false], ['Wrong bed label', false]],
    'IT patches port to correct VLAN.', 'Bed appears on central; alarms transmit to central.', 'Prove the physical layer first (link LED).');
  C('dicomFailure', 'DICOM failure', 'ct', 'High', 'CT images not arriving at PACS.', 'PACS upgraded last night.',
    [['Ping PACS', 'Replies.'], ['DICOM verification', 'Fails — association rejected.'], ['Compare AE titles', 'PACS now expects a different called AE title.'], ['Network cable', 'OK.']],
    [['AE title changed during PACS upgrade', true], ['Network cable', false], ['CT recon computer', false], ['Tube', false]],
    'Update DICOM node configuration to match PACS (with PACS admin).', 'DICOM verification success; send test study; confirm on PACS.', 'Ping proves network; verification proves DICOM configuration.');
  C('pacsFailure', 'PACS connection failure', 'xray', 'High', 'DR room cannot send to PACS; queue growing.', 'IP addresses changed for new subnet.',
    [['Ping PACS', 'No reply.'], ['Check modality IP / gateway', 'Old gateway still configured.'], ['Correct gateway', 'Ping replies.'], ['Verification', 'Success.']],
    [['Wrong default gateway after re-addressing', true], ['AE title', false], ['Detector', false], ['Generator', false]],
    'Correct gateway/subnet with IT.', 'Send queue clears; verification; check images on PACS.', 'Ping fails → network layer. Fix that before touching DICOM settings.');
  C('overheating', 'Overheating', 'ct', 'High', 'CT shows "tube cooling" waits between scans.', 'Summer; chiller room AC failed.',
    [['Room temperature', 'High.'], ['Chiller status', 'High return temperature alarm.'], ['Heat exchanger', 'Dusty fins.'], ['Tube heat units', 'Normal usage pattern.']],
    [['Chiller / room cooling failure', true], ['Tube end-of-life', false], ['DAS', false], ['Console', false]],
    'Restore room AC; clean heat exchanger; service chiller.', 'Cooling recovery times; monitor temperature trend.', 'Check the environment and cooling chain before condemning an expensive tube.');
  C('fanFailure', 'Fan failure', 'ultrasound', 'Medium', 'Ultrasound shuts down after 20 minutes.', 'Fan noise absent.',
    [['Listen / feel airflow', 'Rear fan not spinning.'], ['Check temperature log', 'Rising until thermal shutdown.'], ['Fan supply voltage', 'Present.'], ['Fan spin test', 'Seized bearing.']],
    [['Seized cooling fan', true], ['PSU', false], ['Probe', false], ['Software', false]],
    'Replace fan; clean filters.', 'Run for extended period; temperature log stable.', 'Supply present + fan not turning → fan itself.');
  C('calibrationError', 'Calibration error', 'patientMonitor', 'Medium', 'NIBP readings consistently high vs manual.', 'NIBP module never calibrated since installation.',
    [['Static pressure check', 'Reads higher than reference at all points (offset).'], ['Leak test', 'Pass.'], ['Cuff/hose', 'OK.'], ['Patient simulator', 'Same offset.']],
    [['NIBP transducer calibration drift', true], ['Cuff size', false], ['Software', false], ['ECG', false]],
    'Perform NIBP calibration per service manual.', 'Static pressure accuracy; simulator test.', 'Constant offset at all points = calibration/zero issue.');
  C('softwareError', 'Software error', 'mri', 'Medium', 'Console freezes when opening a specific protocol.', 'New protocol imported from another site.',
    [['Other protocols', 'Work normally.'], ['Error log', 'Exception on protocol parameter parsing.'], ['Software version compare', 'Protocol from newer version.'], ['Hardware status', 'Normal.']],
    [['Incompatible imported protocol', true], ['Gradient amplifier', false], ['Magnet', false], ['RF coil', false]],
    'Remove/rebuild protocol on current software version; escalate to manufacturer if needed.', 'Protocol runs; phantom check.', 'Reproduce, then find what changed.');
  C('mechanicalNoise', 'Mechanical noise', 'ct', 'Medium', 'Grinding noise during gantry rotation.', 'Noise worse at higher speeds.',
    [['Listen with rotation at slow speed', 'Noise from drive belt area.'], ['Visual (LOTO, covers off)', 'Belt worn, debris.'], ['Bearing check', 'Smooth.'], ['Error log', 'No errors.']],
    [['Worn drive belt', true], ['Tube', false], ['DAS', false], ['Slip ring', false]],
    'Replace belt per manufacturer procedure; tension and align.', 'Rotation test; noise gone; image QA.', 'Isolate noise source safely — LOTO before covers off.');
  C('poorImage', 'Poor image quality', 'ultrasound', 'Medium', 'Radiologist reports dark stripe on linear probe images.', 'Probe was dropped last week.',
    [['Phantom image', 'Vertical dark band.'], ['Swap to another port', 'Band persists with this probe.'], ['Another probe on same port', 'Normal.'], ['Probe lens inspection', 'Small crack.']],
    [['Damaged probe elements', true], ['Beamformer', false], ['Display', false], ['Gel', false]],
    'Remove probe from service; repair/replace probe; leakage test.', 'Phantom uniformity; probe leakage test.', 'Swap tests isolate probe vs system port in two steps.');
  C('incorrectMeasurement', 'Incorrect measurement', 'infusionPump', 'High', 'Pump delivered less than programmed volume.', 'Non-approved administration set used.',
    [['Check set model', 'Not on approved list.'], ['Flow test with approved set', 'Within limits.'], ['Flow test with used set', 'Under-delivers.'], ['Mechanism', 'OK.']],
    [['Incompatible administration set', true], ['Motor', false], ['Battery', false], ['Display', false]],
    'Remove non-approved sets; inform clinical staff; incident report per policy.', 'Flow accuracy with approved set.', 'Many "device faults" are use or consumable issues — but they still need reporting.');
  C('alarmMalfunction', 'Alarm malfunction', 'patientMonitor', 'Critical', 'Monitor did not alarm audibly for low SpO₂.', 'Alarm volume reported as "fine" by staff.',
    [['Alarm test', 'Visual alarm OK, audible very weak.'], ['Check volume setting', 'Set to minimum — not allowed by default profile.'], ['Speaker test', 'Speaker distorted.'], ['Config audit', 'Default profile altered.']],
    [['Damaged speaker + altered alarm profile', true], ['SpO₂ module', false], ['Network', false], ['Battery', false]],
    'Replace speaker; restore approved alarm profile; lock configuration.', 'Alarm test for each priority; document configuration.', 'Alarm faults are patient-critical — remove from use until verified.');

  /* ---------------- FAULT SIMULATION SCENARIOS ---------------- */
  BME.addScenario({
    id: 'ctGantry', equipment: 'ct', title: 'Scenario 01 — CT Gantry Error', machine: 'Multi-slice CT (generic training model)',
    fault: 'Gantry rotation unavailable', errorCode: 'TRN-C210', difficulty: 'Service Engineer',
    symptoms: ['Console message: "Gantry rotation unavailable"', 'Scan cannot start', 'Table movement works'],
    history: 'Covers removed yesterday for PM (filters). Unit worked before PM.', temperature: 'Gantry 31 °C (normal)', power: 'Mains present; console and table powered',
    sensors: { 'Gantry door interlock': 'OPEN', 'Rotation encoder': 'No data (rotation not commanded)', 'E-stop chain': 'Closed', 'Cooling': 'OK' },
    checks: {
      power: { label: 'Check power', finding: 'All supply rails present. Rotation drive power not enabled — waiting for interlock chain.', relevant: true },
      log: { label: 'Check error log', finding: 'TRN-C210: rotation inhibit — safety interlock open. Started immediately after PM session.', relevant: true },
      interlock: { label: 'Check interlock', finding: 'Front cover interlock switch reads OPEN. Cover is fitted but the switch actuator tab is bent and does not reach the switch.', relevant: true, key: true },
      sensor: { label: 'Check sensor', finding: 'Encoder and position sensors respond normally on manual rotation (LOTO applied).', relevant: false },
      pcb: { label: 'Check PCB', finding: 'Drive controller board LEDs normal. No fault on board — it is correctly inhibiting rotation.', relevant: false, invasive: true },
      comm: { label: 'Check communication', finding: 'Gantry ↔ console communication OK; status messages received.', relevant: false },
      motor: { label: 'Check motor', finding: 'Not tested — rotation inhibited. Motor windings OK on resistance check (power off).', relevant: false, invasive: true },
      cable: { label: 'Check cable', finding: 'Interlock harness continuous; connectors seated.', relevant: false }
    },
    essential: ['log', 'interlock'],
    diagnoses: [
      { t: 'Cover interlock not actuated (bent actuator tab after PM)', correct: true },
      { t: 'Rotation motor failure', correct: false },
      { t: 'Drive controller PCB failure', correct: false },
      { t: 'Gantry–console communication failure', correct: false }
    ],
    root: 'The front cover interlock actuator tab was bent when covers were refitted after PM, so the interlock chain stays open and the system correctly inhibits rotation.',
    path: ['Error log points to interlock inhibit', 'Interlock status shows cover switch OPEN', 'Physical inspection: cover fitted but actuator misaligned', 'Correct actuator → interlock closes'],
    repair: 'Straighten or replace the actuator tab per manufacturer procedure; refit cover correctly. Never bypass the interlock.',
    verify: 'Interlock status CLOSED; rotation test at all speeds; air calibration if required; phantom QA scan; document.',
    safety: ['Never bypass or tape over interlocks', 'LOTO before working inside gantry', 'Rotating parts and high voltage inside gantry', 'Radiation: no exposure during mechanical checks']
  });
  BME.addScenario({
    id: 'ventNoFlow', equipment: 'ventilator', title: 'Scenario 02 — Ventilator no flow', machine: 'ICU ventilator (generic training model)',
    fault: 'Low delivered volume / gas supply alarm', errorCode: 'TRN-V101', difficulty: 'Biomedical Engineer',
    symptoms: ['Alarm: Gas supply low', 'Delivered Vt far below set', 'FiO₂ cannot reach set value'],
    history: 'Unit moved from ICU-2 to ICU-4 this morning.', temperature: 'Normal', power: 'Mains OK, battery full',
    sensors: { 'O₂ supply pressure': 'Low', 'Air supply pressure': 'Normal', 'Flow sensor': 'Reads low flow', 'Pressure sensor': 'Normal' },
    checks: {
      power: { label: 'Check power', finding: 'Mains and battery OK.', relevant: false },
      log: { label: 'Check error log', finding: 'TRN-V101 O₂ supply low since relocation.', relevant: true },
      interlock: { label: 'Check gas supply', finding: 'O₂ hose connected to wall outlet but probe not fully latched — pressure partially reaching inlet.', relevant: true, key: true },
      sensor: { label: 'Check sensor', finding: 'Flow sensor reads correctly against analyzer.', relevant: false },
      pcb: { label: 'Check PCB', finding: 'No PCB faults logged.', relevant: false, invasive: true },
      comm: { label: 'Check communication', finding: 'OK.', relevant: false },
      motor: { label: 'Check valves', finding: 'Valve self-test passes.', relevant: false, invasive: true },
      cable: { label: 'Check circuit / leak', finding: 'Leak test pass.', relevant: false }
    },
    essential: ['log', 'interlock'],
    diagnoses: [
      { t: 'O₂ hose probe not latched in wall outlet', correct: true },
      { t: 'Inspiratory valve failure', correct: false },
      { t: 'Flow sensor failure', correct: false },
      { t: 'Control PCB failure', correct: false }
    ],
    root: 'After relocation the O₂ hose probe was not fully latched into the wall outlet, restricting supply.',
    path: ['Log shows O₂ supply low', 'Supply check finds unlatched probe', 'Reconnect → pressure normal'],
    repair: 'Fully engage and latch the probe; inspect probe and outlet for damage.',
    verify: 'Supply pressure normal; FiO₂ accuracy; Vt accuracy; alarm test.', safety: ['Patient on alternative ventilation during troubleshooting', 'O₂ fire risk']
  });
  BME.addScenario({
    id: 'mriHelium', equipment: 'mri', title: 'Scenario 03 — MRI helium level dropping', machine: 'Superconducting MRI (generic training model)',
    fault: 'Helium level falling faster than normal', errorCode: 'TRN-M120', difficulty: 'Senior Engineer',
    symptoms: ['Magnet monitor: helium level trending down', 'Cold head sound irregular', 'Images normal'],
    history: 'Chiller service last week; water flow alarm once.', temperature: 'Compressor water outlet temp high', power: 'Mains OK',
    sensors: { 'Helium level': 'Falling', 'Helium pressure': 'Slightly high', 'Cold head': 'Irregular cycle', 'Chiller flow': 'Low' },
    checks: {
      power: { label: 'Check compressor power', finding: 'Compressor powered and running.', relevant: false },
      log: { label: 'Check magnet monitor log', finding: 'Compressor over-temperature trips several times after chiller service.', relevant: true },
      interlock: { label: 'Check chiller / water flow', finding: 'Chiller flow low — isolation valve left partly closed after service.', relevant: true, key: true },
      sensor: { label: 'Check level sensor', finding: 'Readings consistent with pressure trend.', relevant: false },
      pcb: { label: 'Check magnet monitor PCB', finding: 'Normal.', relevant: false, invasive: true },
      comm: { label: 'Check remote monitoring', finding: 'Connected.', relevant: false },
      motor: { label: 'Check cold head', finding: 'Cold head cycling irregular due to compressor trips.', relevant: true },
      cable: { label: 'Check helium lines', finding: 'Flex lines connected; no visible damage.', relevant: false }
    },
    essential: ['log', 'interlock'],
    diagnoses: [
      { t: 'Insufficient chiller water flow → compressor trips → cold head stops → boil-off', correct: true },
      { t: 'Faulty level sensor', correct: false },
      { t: 'Gradient coil fault', correct: false },
      { t: 'RF amplifier fault', correct: false }
    ],
    root: 'Chiller isolation valve left partly closed after service caused compressor over-temperature trips, interrupting the cold head and increasing helium boil-off.',
    path: ['Monitor log shows compressor trips', 'Trace cooling chain', 'Chiller flow low', 'Valve partly closed'],
    repair: 'Open valve fully; verify chiller flow/temperature; escalate to manufacturer for helium top-up if required.',
    verify: 'Compressor stable; cold head regular; helium level stable over 24–48 h.', safety: ['Quench/cryogen risk — follow site emergency plan', 'Magnetic field always on', 'Only authorised personnel in Zone IV']
  });
  BME.addScenario({
    id: 'usDeadElements', equipment: 'ultrasound', title: 'Scenario 04 — Ultrasound image dropout', machine: 'Cart-based ultrasound (generic)',
    fault: 'Dark vertical band in image', errorCode: '—', difficulty: 'Biomedical Engineer',
    symptoms: ['Dark vertical band on linear probe', 'Other probes normal'], history: 'Probe dropped last week.', temperature: 'Normal', power: 'Normal',
    sensors: { 'Probe ID': 'Recognised', 'Probe temperature': 'Normal' },
    checks: {
      power: { label: 'Check power', finding: 'Normal.', relevant: false },
      log: { label: 'Check error log', finding: 'No errors.', relevant: false },
      interlock: { label: 'Swap port', finding: 'Band follows the probe to another port.', relevant: true, key: true },
      sensor: { label: 'Phantom test', finding: 'Vertical dark band at same position.', relevant: true },
      pcb: { label: 'Check beamformer', finding: 'Other probes normal on same port → beamformer OK.', relevant: false, invasive: true },
      comm: { label: 'Check probe ID', finding: 'OK.', relevant: false },
      motor: { label: 'Inspect lens', finding: 'Small crack at lens edge.', relevant: true },
      cable: { label: 'Check cable', finding: 'No kinks.', relevant: false }
    },
    essential: ['interlock', 'sensor'],
    diagnoses: [{ t: 'Damaged probe elements', correct: true }, { t: 'Beamformer', correct: false }, { t: 'Display', correct: false }, { t: 'PSU', correct: false }],
    root: 'Probe impact damaged a group of piezoelectric elements; the cracked lens also creates a leakage risk.',
    path: ['Phantom shows band', 'Band follows probe', 'Other probe on same port normal', 'Lens crack found'],
    repair: 'Remove probe from service; repair/replace probe.', verify: 'Phantom uniformity; probe leakage test.', safety: ['Cracked lens = patient leakage/infection risk']
  });
  BME.addScenario({
    id: 'xrayNoExposure', equipment: 'xray', title: 'Scenario 05 — X-ray no exposure', machine: 'DR room (generic)',
    fault: 'Exposure button pressed — no exposure', errorCode: 'TRN-X305', difficulty: 'Service Engineer',
    symptoms: ['Prep works, expose does nothing', 'Message: exposure inhibited'], history: 'Room door replaced last week.', temperature: 'Normal', power: 'Normal',
    sensors: { 'Door interlock': 'OPEN', 'Detector ready': 'Yes', 'Tube heat': 'Low' },
    checks: {
      power: { label: 'Check power', finding: 'Generator powered.', relevant: false },
      log: { label: 'Check error log', finding: 'TRN-X305 exposure inhibited — room door interlock.', relevant: true },
      interlock: { label: 'Check interlock', finding: 'New door has no interlock switch wired — circuit open.', relevant: true, key: true },
      sensor: { label: 'Check detector', finding: 'Ready.', relevant: false },
      pcb: { label: 'Check generator PCB', finding: 'Normal.', relevant: false, invasive: true },
      comm: { label: 'Check communication', finding: 'Console ↔ generator OK.', relevant: false },
      motor: { label: 'Check tube', finding: 'Filament OK.', relevant: false, invasive: true },
      cable: { label: 'Check cable', finding: 'Interlock cable unterminated at new door frame.', relevant: true }
    },
    essential: ['log', 'interlock'],
    diagnoses: [{ t: 'Door interlock not reconnected after door replacement', correct: true }, { t: 'Tube failure', correct: false }, { t: 'Generator PCB', correct: false }, { t: 'Detector not ready', correct: false }],
    root: 'The new room door was installed without reconnecting the interlock switch.', path: ['Log', 'Interlock status', 'Physical inspection'],
    repair: 'Install and wire interlock switch to the door per site design.', verify: 'Interlock prevents exposure with door open; exposure OK with door closed; radiation survey if required.', safety: ['Never bypass interlocks', 'Radiation protection']
  });
  BME.addScenario({
    id: 'defibNoCharge', equipment: 'defibrillator', title: 'Scenario 06 — Defibrillator will not charge', machine: 'Manual / AED defibrillator (generic)',
    fault: 'Charge takes too long / fails', errorCode: 'TRN-D201', difficulty: 'Biomedical Engineer',
    symptoms: ['Charge to max energy exceeds spec time', 'Battery icon 1 bar'], history: 'Kept on crash cart, not plugged in for 2 weeks.', temperature: 'Normal', power: 'On battery',
    sensors: { 'Battery voltage': 'Low', 'Self-test': 'Battery warning' },
    checks: {
      power: { label: 'Check power / battery', finding: 'Battery low; unit not connected to mains.', relevant: true, key: true },
      log: { label: 'Check self-test log', finding: 'Daily self-test reporting battery low for 10 days.', relevant: true },
      interlock: { label: 'Check charger', finding: 'Charges normally when connected to mains.', relevant: true },
      sensor: { label: 'Check ECG', finding: 'OK.', relevant: false },
      pcb: { label: 'Check HV board', finding: 'Not indicated.', relevant: false, invasive: true },
      comm: { label: 'Check printer', finding: 'OK.', relevant: false },
      motor: { label: 'Check capacitor', finding: 'Not indicated — dangerous to open.', relevant: false, invasive: true },
      cable: { label: 'Check pads cable', finding: 'OK.', relevant: false }
    },
    essential: ['power', 'log'],
    diagnoses: [{ t: 'Discharged battery (unit left unplugged) — process issue', correct: true }, { t: 'HV capacitor failure', correct: false }, { t: 'Paddle failure', correct: false }, { t: 'Firmware', correct: false }],
    root: 'Unit left off mains with ignored self-test warnings; battery discharged.', path: ['Battery indicator', 'Self-test log', 'Charger works'],
    repair: 'Recharge; run battery capacity test; replace if fails; retrain staff on daily check.', verify: 'Charge time and energy test with defibrillator analyzer.', safety: ['Lethal energy — never open charged unit']
  });
  BME.addScenario({
    id: 'pumpOcclusion', equipment: 'infusionPump', title: 'Scenario 07 — Repeated occlusion alarms', machine: 'Volumetric infusion pump (generic)',
    fault: 'Downstream occlusion alarm at low rates', errorCode: 'TRN-I220', difficulty: 'Technician',
    symptoms: ['Downstream occlusion alarm', 'No visible kink'], history: 'Several pumps on same ward.', temperature: 'Normal', power: 'Normal',
    sensors: { 'Downstream pressure': 'High', 'Air-in-line': 'Clear' },
    checks: {
      power: { label: 'Check power', finding: 'Normal.', relevant: false },
      log: { label: 'Check alarm log', finding: 'Occlusion alarms only with one batch of extension lines.', relevant: true },
      interlock: { label: 'Check set / extension', finding: 'Extension line has an anti-reflux valve with high opening pressure.', relevant: true, key: true },
      sensor: { label: 'Occlusion test with analyzer', finding: 'Pump alarm pressure within limit.', relevant: true },
      pcb: { label: 'Check controller', finding: 'Normal.', relevant: false, invasive: true },
      comm: { label: 'Check comm', finding: 'Normal.', relevant: false },
      motor: { label: 'Check mechanism', finding: 'Normal.', relevant: false, invasive: true },
      cable: { label: 'Check clamps', finding: 'Open.', relevant: false }
    },
    essential: ['log', 'interlock'],
    diagnoses: [{ t: 'Incompatible extension line (high-pressure valve)', correct: true }, { t: 'Pressure sensor failure', correct: false }, { t: 'Motor failure', correct: false }, { t: 'Software', correct: false }],
    root: 'Accessory with high opening pressure triggers downstream occlusion detection.', path: ['Pattern across pumps', 'Common accessory', 'Pump tests normal'],
    repair: 'Remove accessory; inform clinical team/procurement.', verify: 'Flow and occlusion tests pass.', safety: ['Patient dosing interruption']
  });
  BME.addScenario({
    id: 'monitorSpo2', equipment: 'patientMonitor', title: 'Scenario 08 — SpO₂ reading unstable', machine: 'Bedside monitor (generic)',
    fault: 'SpO₂ intermittent / "no sensor"', errorCode: 'TRN-P140', difficulty: 'Technician',
    symptoms: ['SpO₂ drops out when cable moved', 'Other parameters fine'], history: 'Heavy use in ED.', temperature: 'Normal', power: 'Normal',
    sensors: { 'SpO₂ module': 'Sensor off intermittently' },
    checks: {
      power: { label: 'Check power', finding: 'Normal.', relevant: false },
      log: { label: 'Check log', finding: 'Frequent "SpO₂ sensor off".', relevant: true },
      interlock: { label: 'Swap sensor & cable', finding: 'Known-good extension cable fixes the fault.', relevant: true, key: true },
      sensor: { label: 'Simulator test', finding: 'Readings correct with good cable.', relevant: true },
      pcb: { label: 'Check module PCB', finding: 'Normal.', relevant: false, invasive: true },
      comm: { label: 'Check network', finding: 'Normal.', relevant: false },
      motor: { label: 'Check connector', finding: 'Monitor-side connector OK.', relevant: false },
      cable: { label: 'Check cable', finding: 'Broken conductor near strain relief.', relevant: true }
    },
    essential: ['interlock', 'cable'],
    diagnoses: [{ t: 'Damaged SpO₂ extension cable', correct: true }, { t: 'SpO₂ module', correct: false }, { t: 'Main PCB', correct: false }, { t: 'Display', correct: false }],
    root: 'Conductor fatigue at the cable strain relief.', path: ['Symptom follows cable movement', 'Swap test isolates cable'],
    repair: 'Replace extension cable.', verify: 'Simulator check; flex test.', safety: ['Applied part — use approved accessories only']
  });

  /* ---------------- IMAGE QUALITY ARTIFACTS ---------------- */
  const A = (id, modality, name, kind, cause, component, action, region) =>
    BME.addArtifact({ id, modality, name, kind, cause, component, action, region });
  A('ct-ring', 'ct', 'Ring artifact', 'Equipment fault', 'Miscalibrated or faulty detector channel', 'Detector / DAS', 'Air calibration; if persistent, diagnose detector module/DAS channel', { x: .5, y: .5, r: .32 });
  A('ct-motion', 'ct', 'Motion artifact', 'Patient artifact', 'Patient movement during acquisition', 'None (patient)', 'Immobilise, shorter rotation time, repeat', { x: .5, y: .5, r: .35 });
  A('ct-beamhard', 'ct', 'Beam hardening / streak', 'Physics artifact', 'Dense material hardens the beam (bone, metal)', 'Bow-tie filter / reconstruction', 'Use correction algorithms; check calibration if new', { x: .5, y: .5, r: .2 });
  A('ct-noise', 'ct', 'Excess noise', 'Technique / equipment', 'Low mAs, large patient, or tube output drop', 'Tube / generator', 'Check technique; measure output and noise on phantom', { x: .5, y: .5, r: .4 });
  A('mri-motion', 'mri', 'Motion', 'Patient artifact', 'Patient or physiological motion', 'None (patient)', 'Immobilise, gating, faster sequences', { x: .5, y: .5, r: .35 });
  A('mri-ghost', 'mri', 'Ghosting', 'Equipment / patient', 'Periodic motion or gradient/RF instability', 'Gradient / RF chain', 'Phantom ghosting test; if on phantom → service', { x: .5, y: .2, r: .2 });
  A('mri-suscept', 'mri', 'Susceptibility', 'Physics artifact', 'Metal or air–tissue interfaces distort field', 'None (object)', 'Remove metal, use SE / metal-reduction sequences', { x: .62, y: .45, r: .14 });
  A('mri-rf', 'mri', 'RF interference (zipper)', 'Equipment / site', 'RF leak — door open, cage breach, faulty equipment in room', 'RF cage / RF chain', 'Check door seal and penetrations; RF noise test', { x: .3, y: .5, r: .12 });
  A('dr-detector', 'dr', 'Detector artifact (dead lines)', 'Equipment fault', 'Defective detector rows/pixels or calibration', 'Flat-panel detector', 'Detector calibration; if persists, service detector', { x: .7, y: .5, r: .12 });
  A('dr-exposure', 'dr', 'Exposure issue (underexposed)', 'Technique / equipment', 'Low mAs/kV, AEC error, or generator output', 'Generator / AEC', 'Check exposure index; QA kV/mAs output', { x: .5, y: .5, r: .4 });
  A('dr-grid', 'dr', 'Grid lines', 'Equipment / setup', 'Grid misaligned, wrong SID, or stationary grid', 'Bucky / grid', 'Check grid alignment and focus distance', { x: .5, y: .5, r: .4 });
  A('dr-processing', 'dr', 'Processing artifact (halo)', 'Software', 'Wrong anatomy processing / edge enhancement', 'Image processing', 'Select correct protocol; review processing parameters', { x: .5, y: .5, r: .25 });
  A('us-dead', 'us', 'Dead elements', 'Equipment fault', 'Damaged piezoelectric elements or broken coax', 'Probe', 'Phantom test; swap test; repair/replace probe', { x: .4, y: .5, r: .12 });
  A('us-dropout', 'us', 'Dropout / shadow', 'Physics / technique', 'Poor contact, air, or strong reflector', 'None (contact)', 'Improve coupling; reposition', { x: .62, y: .62, r: .14 });
  A('us-reverb', 'us', 'Reverberation', 'Physics artifact', 'Sound bouncing between parallel reflectors', 'None (physics)', 'Change angle; harmonic imaging', { x: .5, y: .35, r: .2 });
  A('us-probe', 'us', 'Probe artifact (lens damage)', 'Equipment fault', 'Delaminated or cracked lens', 'Probe lens', 'Remove from service; leakage test; repair', { x: .5, y: .12, r: .14 });

  /* ---------------- ELECTRICAL & SAFETY ---------------- */
  BME.safetyTopics = [
    { id: 'elec', name: 'Electrical safety', type: 'hv', points: ['Medical electrical equipment is classified by protection class and applied-part type.', 'Tests: visual, protective earth, insulation, leakage currents, functional.', 'Limits come from the applicable standard adopted by your hospital protocol.'], q: { q: 'An applied part that connects directly to the heart requires…', options: ['The strictest patient-leakage limits (cardiac-type)', 'No testing', 'Only visual inspection', 'Earth bonding only'], answer: 0 } },
    { id: 'leakage', name: 'Leakage current', type: 'hv', sim: 'leakage', points: ['Earth, touch/enclosure and patient leakage.', 'Measured in normal condition and single-fault condition (open earth, reversed polarity).', 'Contamination and failed insulation raise leakage.'], q: { q: 'Why test under single-fault condition?', options: ['To confirm safety if the earth fails', 'To save time', 'It is optional', 'To charge battery'], answer: 0 } },
    { id: 'ground', name: 'Ground resistance', type: 'hv', points: ['Protective earth resistance from plug earth pin to accessible metal.', 'Flex the cord during measurement to find intermittent breaks.'], q: { q: 'Flexing the cord during PE test finds…', options: ['Intermittent breaks', 'Software bugs', 'Leaks', 'Noise'], answer: 0 } },
    { id: 'insulation', name: 'Insulation testing', type: 'hv', points: ['Applies DC test voltage between mains parts and earth.', 'Not suitable for all devices — follow manufacturer guidance.'], q: { q: 'Insulation tests may damage…', options: ['Some sensitive electronics if not permitted by manufacturer', 'Nothing', 'Cables only', 'Displays only'], answer: 0 } },
    { id: 'earthing', name: 'Earthing', type: 'hv', points: ['Earth provides a low-impedance fault path so protective devices trip.', 'Equipotential bonding in critical areas.'], q: { q: 'Earthing primarily protects against…', options: ['Electric shock from fault currents', 'Radiation', 'Magnetism', 'Noise only'], answer: 0 } },
    { id: 'ups', name: 'UPS', type: 'hv', points: ['Online vs line-interactive; battery autonomy; bypass.', 'Test transfer under load; check battery age.'], q: { q: 'A UPS battery test should be done…', options: ['Under representative load', 'With no load only', 'Never', 'By software only'], answer: 0 } },
    { id: 'smps', name: 'SMPS', type: 'hv', points: ['High-voltage DC bus after rectifier — capacitors stay charged.', 'Common failures: electrolytic capacitors, switching transistor, fuse.'], q: { q: 'Before touching an SMPS primary side…', options: ['Verify bulk capacitor is discharged', 'Remove fuse only', 'Nothing needed', 'Switch off display'], answer: 0 } },
    { id: 'batteries', name: 'Batteries', type: 'chem', points: ['Li-ion, NiMH, SLA — different charging and hazards.', 'Capacity testing; age-based replacement; safe disposal.'], q: { q: 'A swollen Li-ion pack should be…', options: ['Removed from service and safely isolated', 'Pressed back in', 'Charged', 'Ignored'], answer: 0 } },
    { id: 'fuses', name: 'Fuses', type: 'hv', points: ['Replace only with identical rating and type.', 'A blown fuse is a symptom — find the cause.'], q: { q: 'A fuse blows again immediately. Next step?', options: ['Find the short/overload', 'Fit a larger fuse', 'Bridge it', 'Replace PCB'], answer: 0 } },
    { id: 'relays', name: 'Relays', type: 'hv', points: ['Coil and contacts; contact wear and welding.', 'Test coil resistance and contact resistance.'], q: { q: 'Welded relay contacts cause…', options: ['Circuit stays energised', 'Circuit never energises', 'Nothing', 'Noise only'], answer: 0 } },
    { id: 'transformers', name: 'Transformers', type: 'hv', points: ['Isolation transformers in OT; HV transformers in X-ray generators.', 'Insulation, overheating, oil condition (HV tanks).'], q: { q: 'Isolation transformers in OT reduce…', options: ['Shock risk from earth faults', 'Radiation', 'Weight', 'Noise only'], answer: 0 } },
    { id: 'capacitors', name: 'Capacitors', type: 'hv', points: ['Store dangerous energy — defibrillators, generators, SMPS.', 'Use discharge tools; verify with meter.'], q: { q: 'Defibrillator capacitors are dangerous because…', options: ['They store lethal energy', 'They are heavy', 'They are expensive', 'They leak gas'], answer: 0 } },
    { id: 'motors', name: 'Motors', type: 'hv', points: ['DC, stepper, BLDC; drivers and encoders.', 'Winding resistance, insulation, bearing noise.'], q: { q: 'Motor runs but position is wrong. Suspect…', options: ['Encoder/feedback', 'Fuse', 'Display', 'Battery'], answer: 0 } },
    { id: 'sensors', name: 'Sensors', type: 'patient', points: ['Pressure, flow, temperature, optical, position.', 'Zero, span, linearity; compare to reference.'], q: { q: 'Sensor error proportional to value is…', options: ['Gain (span) error', 'Offset', 'Noise', 'Leak'], answer: 0 } },
    { id: 'pcb', name: 'PCB safety', type: 'hv', points: ['ESD-sensitive; power off; no live probing without training.', 'Board replacement only after inputs, outputs and cabling verified.'], q: { q: 'Replace a PCB when…', options: ['Inputs/supplies/cables are verified and the board is proven faulty', 'First', 'Whenever', 'Never'], answer: 0 } },
    { id: 'esd', name: 'ESD protection', type: 'hv', points: ['Wrist strap, ESD mat, shielded bags.', 'Damage can be latent — fails later.'], q: { q: 'ESD damage can be…', options: ['Latent, failing later', 'Always visible', 'Harmless', 'Only to displays'], answer: 0 } },
    { id: 'loto', name: 'Lockout / Tagout', type: 'hv', points: ['Isolate → lock → tag → verify zero energy.', 'Includes stored energy: capacitors, springs, gas, gravity.'], q: { q: 'Last LOTO step before work?', options: ['Verify zero energy', 'Remove tag', 'Call user', 'Power on'], answer: 0 } },
    { id: 'hv', name: 'High-voltage safety', type: 'hv', points: ['X-ray/CT generators reach very high kV; HV cables store charge.', 'Ground HV cables before disconnecting.'], q: { q: 'Before disconnecting an HV cable…', options: ['Discharge/ground it per procedure', 'Pull quickly', 'Use bare hands', 'Expose once'], answer: 0 } },
    { id: 'radiation', name: 'Radiation safety', type: 'rad', points: ['Time, distance, shielding.', 'Wear dosimeter; check interlocks and warning lights.'], q: { q: 'The three principles of radiation protection?', options: ['Time, distance, shielding', 'Speed, power, voltage', 'Cooling, airflow, light', 'None'], answer: 0 } },
    { id: 'mrisafety', name: 'MRI safety', type: 'mag', points: ['The magnet is always on.', 'Zone access control; screen all people and objects.', 'Projectile risk; quench; cryogen asphyxiation; implants.'], q: { q: 'An MRI magnet field is present…', options: ['Always, even when scanning is off', 'Only during scans', 'Only when lights on', 'Never at night'], answer: 0 } }
  ];

  /* Generic PM used for every mains-powered device lacking a content pack. */
  BME.genericPM = {
    daily: [{ task: 'Visual & functional check', why: 'Detects obvious damage before use.', tools: 'Visual', safety: 'Standard PPE', procedure: 'Inspect housing, cables, accessories; power on; check self-test.', criteria: 'No damage; self-test pass.' }],
    monthly: [{ task: 'Cleaning & filters', why: 'Dust causes overheating.', tools: 'Approved cleaning agents', safety: 'Power off', procedure: 'Clean exterior; inspect/clean fan filters.', criteria: 'Clean; airflow unobstructed.' }],
    quarterly: [{ task: 'Accessories & alarms', why: 'Accessory faults are a leading cause of complaints.', tools: 'Visual, simulator', safety: '—', procedure: 'Inspect accessories; test alarms.', criteria: 'All functional.' }],
    annual: [
      { task: 'Electrical safety test', why: 'Protects against shock.', tools: 'Electrical safety analyzer', safety: 'Follow analyzer instructions', procedure: 'PE resistance, insulation, leakage currents.', criteria: 'Per hospital protocol / applicable standard.' },
      { task: 'Performance verification', why: 'Confirms output accuracy.', tools: 'Device-specific analyzer', safety: '—', procedure: 'Model-specific procedure required.', criteria: 'Per manufacturer documentation.' }
    ]
  };

  BME.genericQuestions = [
    { q: 'The correct diagnostic order is…', options: ['Replace parts until it works', 'Symptom → understand system → possible causes → measure → isolate → repair → verify → document', 'Restart → replace PCB', 'Call vendor first always'], answer: 1, why: 'Evidence-based isolation avoids unnecessary parts and missed root causes.', domain: 'troubleshooting' },
    { q: 'After any repair of mains-powered equipment you should…', options: ['Return immediately', 'Perform functional and electrical safety tests and document', 'Only clean it', 'Only update software'], answer: 1, why: 'Verification and documentation complete the job.', domain: 'documentation' },
    { q: 'Acceptance limits should come from…', options: ['Hospital-approved protocol based on manufacturer documentation and applicable standards', 'A forum', 'Memory', 'Any value'], answer: 0, why: 'Limits differ by model, standard revision and jurisdiction.', domain: 'documentation' },
    { q: 'Before opening equipment you must…', options: ['Apply LOTO and verify zero energy', 'Just unplug', 'Nothing', 'Remove labels'], answer: 0, why: 'Stored energy can remain after unplugging.', domain: 'safety' },
    { q: 'A known-good substitution test is used to…', options: ['Isolate a suspected part quickly', 'Avoid documentation', 'Upgrade firmware', 'Clean'], answer: 0, why: 'Swapping a known-good part confirms or rules out a suspect.', domain: 'technical' }
  ];
})();

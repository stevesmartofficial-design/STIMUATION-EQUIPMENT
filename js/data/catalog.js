/* Equipment catalog, manufacturers and models.
   `parts` is a short component chain used to auto-generate an interactive
   block diagram for equipment that does not yet have a full content pack. */
(function () {
  const cats = [
    { id: 'imaging', name: 'Imaging', icon: '◉', color: '#4da3ff' },
    { id: 'icu', name: 'ICU / Critical Care', icon: '♥', color: '#ff6b81' },
    { id: 'lab', name: 'Laboratory', icon: '⚗', color: '#36d39a' },
    { id: 'other', name: 'Other Biomedical Equipment', icon: '✚', color: '#f5b84a' }
  ];
  cats.forEach(c => BME.addCategory(c));

  const E = (id, name, category, difficulty, hours, parts, extra) =>
    BME.registerEquipment(Object.assign({ id, name, category, difficulty, hours, parts }, extra || {}));

  // Imaging
  E('ct', 'CT Scanner', 'imaging', 'Advanced', 14, null);
  E('mri', 'MRI', 'imaging', 'Expert', 16, null);
  E('xray', 'X-Ray', 'imaging', 'Intermediate', 8, null);
  E('dr', 'Digital Radiography', 'imaging', 'Intermediate', 6, ['Generator', 'X-ray tube', 'Collimator', 'Flat-panel detector', 'Detector interface', 'Acquisition workstation', 'Image processing', 'PACS / DICOM'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }], artifacts: ['dr-detector', 'dr-exposure', 'dr-grid', 'dr-processing'] });
  E('mobileDr', 'Mobile DR', 'imaging', 'Intermediate', 6, ['Battery pack', 'Inverter', 'HV generator', 'X-ray tube', 'Collimator', 'Drive motor', 'Wireless detector', 'Console', 'Wi-Fi / PACS'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }] });
  E('fluoro', 'Fluoroscopy', 'imaging', 'Advanced', 10, ['Generator', 'X-ray tube', 'Collimator', 'Grid', 'Image intensifier / FPD', 'Camera / readout', 'Image processor', 'Monitor', 'Dose monitor'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }] });
  E('carm', 'C-Arm', 'imaging', 'Advanced', 10, ['Mains / UPS', 'HV generator', 'Monoblock tube', 'Collimator', 'C-arm mechanics', 'Image intensifier / FPD', 'Image processor', 'Monitor cart', 'DICOM export'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }] });
  E('cathlab', 'Cath Lab', 'imaging', 'Expert', 18, ['Generator', 'X-ray tube', 'Collimator & filters', 'Flat-panel detector', 'Gantry / stand', 'Patient table', 'Image chain', 'Hemodynamic system', 'Injector', 'Room monitors', 'PACS'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }, { label: 'PATIENT SAFETY CRITICAL', type: 'patient' }] });
  E('mammo', 'Mammography', 'imaging', 'Advanced', 10, ['Generator', 'X-ray tube (Mo/W/Rh)', 'Filter', 'Collimator', 'Compression paddle', 'Detector', 'AEC', 'Acquisition workstation', 'PACS'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }] });
  E('ultrasound', 'Ultrasound', 'imaging', 'Intermediate', 8, null);
  E('portableXray', 'Portable X-Ray', 'imaging', 'Beginner', 4, ['Mains input', 'Capacitor / generator', 'Monoblock tube', 'Collimator', 'Exposure switch', 'Detector / cassette'], { hazards: [{ label: 'HIGH VOLTAGE', type: 'hv' }, { label: 'RADIATION', type: 'rad' }] });

  // ICU / Critical Care
  E('ventilator', 'Ventilator', 'icu', 'Advanced', 10, null);
  E('bipap', 'BiPAP / NIV', 'icu', 'Intermediate', 5, ['Air inlet filter', 'Blower', 'Pressure sensor', 'Flow sensor', 'Controller', 'Humidifier', 'Mask circuit', 'Alarm'], { hazards: [{ label: 'PATIENT SAFETY CRITICAL', type: 'patient' }] });
  E('anesthesia', 'Anesthesia Machine', 'icu', 'Expert', 14, ['Pipeline / cylinder', 'Regulators', 'Flowmeters', 'Vaporizer', 'Common gas outlet', 'Breathing system', 'CO₂ absorber', 'Ventilator', 'APL valve', 'Scavenging', 'Gas monitor'], { hazards: [{ label: 'PATIENT SAFETY CRITICAL', type: 'patient' }, { label: 'ANAESTHETIC AGENT / O₂', type: 'chem' }] });
  E('patientMonitor', 'Patient Monitor', 'icu', 'Intermediate', 6, null);
  E('defibrillator', 'Defibrillator', 'icu', 'Advanced', 6, null);
  E('ecg', 'ECG', 'icu', 'Beginner', 4, ['Electrodes', 'Lead wires', 'Patient cable', 'Isolation amplifier', 'Filters', 'ADC', 'Processor', 'Printer / display'], { hazards: [{ label: 'PATIENT-CONNECTED', type: 'patient' }] });
  E('syringePump', 'Syringe Pump', 'icu', 'Intermediate', 4, ['Syringe clamp / size sensor', 'Plunger driver', 'Lead screw', 'Stepper motor', 'Force sensor', 'Controller', 'Display', 'Battery'], { hazards: [{ label: 'PATIENT SAFETY CRITICAL — DOSING', type: 'patient' }] });
  E('infusionPump', 'Infusion Pump', 'icu', 'Intermediate', 5, null);
  E('cpap', 'CPAP', 'icu', 'Beginner', 3, ['Inlet filter', 'Blower', 'Pressure sensor', 'Controller', 'Humidifier', 'Tubing & mask'], { hazards: [{ label: 'PATIENT-CONNECTED', type: 'patient' }] });

  // Laboratory
  E('analyzer', 'Chemistry Analyzer', 'lab', 'Advanced', 8, ['Sample probe', 'Reagent probe', 'Reaction cuvettes', 'Incubator', 'Photometer', 'Wash station', 'Fluidics', 'Controller', 'LIS interface'], { hazards: [{ label: 'BIOHAZARD', type: 'bio' }] });
  E('bga', 'Blood Gas Analyzer', 'lab', 'Advanced', 6, ['Sample inlet', 'Sensor cartridge', 'pH / pCO₂ / pO₂ electrodes', 'Calibration gases', 'Fluidics pump', 'Thermostat', 'Controller', 'Printer / LIS'], { hazards: [{ label: 'BIOHAZARD', type: 'bio' }] });
  E('centrifuge', 'Centrifuge', 'lab', 'Beginner', 3, ['Mains / PSU', 'Motor driver', 'Motor', 'Rotor', 'Lid lock', 'Imbalance sensor', 'Speed sensor', 'Brake', 'Controller'], { hazards: [{ label: 'ROTATING MASS', type: 'hv' }, { label: 'BIOHAZARD', type: 'bio' }] });
  E('microscope', 'Microscope', 'lab', 'Beginner', 2, ['Light source', 'Condenser', 'Stage', 'Objectives', 'Eyepieces', 'Camera port'], {});
  E('electrolyte', 'Electrolyte Analyzer', 'lab', 'Intermediate', 4, ['Sample probe', 'ISE electrodes', 'Reference electrode', 'Calibrant packs', 'Peristaltic pump', 'Controller', 'Printer'], { hazards: [{ label: 'BIOHAZARD', type: 'bio' }] });
  E('hematology', 'Hematology Analyzer', 'lab', 'Advanced', 8, ['Sample probe', 'Diluter', 'Impedance aperture', 'Optical / laser bench', 'HGB photometer', 'Fluidics', 'Controller', 'LIS interface'], { hazards: [{ label: 'BIOHAZARD', type: 'bio' }, { label: 'LASER', type: 'laser' }] });

  // Other
  E('ot', 'OT Equipment', 'other', 'Intermediate', 5, ['OT table actuators', 'OT lights', 'Pendants', 'Medical gas outlets', 'Isolation transformer', 'Line isolation monitor'], {});
  E('endoscopy', 'Endoscopy', 'other', 'Advanced', 8, ['Endoscope', 'Light source', 'Camera head', 'Video processor', 'Insufflator', 'Monitor', 'Recorder'], { hazards: [{ label: 'BIOHAZARD / REPROCESSING', type: 'bio' }] });
  E('sterilizer', 'Sterilizer (Autoclave)', 'other', 'Intermediate', 5, ['Water supply', 'Steam generator', 'Chamber', 'Door seal & lock', 'Vacuum pump', 'Temperature probe', 'Pressure transducer', 'Controller', 'Printer'], { hazards: [{ label: 'PRESSURE / STEAM', type: 'chem' }] });
  E('diathermy', 'Diathermy', 'other', 'Intermediate', 4, ['Mains / PSU', 'RF oscillator', 'Power amplifier', 'Output transformer', 'Active electrode', 'Return electrode monitor', 'Controller'], { hazards: [{ label: 'RF BURN / FIRE', type: 'hv' }] });
  E('esu', 'Electrosurgical Unit', 'other', 'Advanced', 6, ['Mains / PSU', 'RF generator', 'Output stage', 'Active electrode', 'Patient return electrode', 'REM / contact monitor', 'Foot switch', 'Controller'], { hazards: [{ label: 'RF BURN / FIRE', type: 'hv' }, { label: 'PATIENT SAFETY CRITICAL', type: 'patient' }] });
  E('phototherapy', 'Phototherapy', 'other', 'Beginner', 2, ['Mains / PSU', 'LED driver', 'LED array', 'Irradiance', 'Timer', 'Cooling fan'], {});
  E('neonatal', 'Neonatal Equipment (Incubator / Warmer)', 'other', 'Intermediate', 6, ['Heater', 'Fan', 'Air temperature sensor', 'Skin temperature probe', 'Humidifier', 'O₂ control', 'Controller', 'Alarms'], { hazards: [{ label: 'PATIENT SAFETY CRITICAL', type: 'patient' }] });
  E('dental', 'Dental Equipment', 'other', 'Beginner', 3, ['Compressor', 'Air dryer', 'Water system', 'Handpiece control', 'Suction', 'Dental chair', 'Light', 'Intraoral X-ray'], {});

  /* Manufacturers are listed for navigation only. All procedures here are
     generic training content; model-specific procedures must come from the
     manufacturer's current documentation. */
  BME.manufacturers = ['Siemens Healthineers', 'GE HealthCare', 'Philips', 'Canon Medical', 'Fujifilm', 'Samsung Medison', 'Mindray', 'Dräger', 'Getinge', 'ResMed', 'Zoll', 'Stryker', 'Hologic', 'Ziehm', 'Other']
    .map(n => ({ id: n.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name: n }));

  /* Example model records. Model names are placeholders ("Model A") to avoid
     implying manufacturer-endorsed content; real models are added by the admin. */
  const models = [];
  const map = {
    'siemens-healthineers': ['ct', 'mri', 'xray', 'cathlab', 'ultrasound', 'mammo'],
    'ge-healthcare': ['ct', 'mri', 'xray', 'ultrasound', 'patientMonitor', 'anesthesia', 'mammo'],
    'philips': ['ct', 'mri', 'xray', 'ultrasound', 'patientMonitor', 'defibrillator', 'ventilator', 'cathlab'],
    'canon-medical': ['ct', 'mri', 'xray', 'ultrasound'],
    'fujifilm': ['dr', 'mobileDr', 'mammo', 'ultrasound', 'endoscopy'],
    'samsung-medison': ['ultrasound', 'dr'],
    'mindray': ['patientMonitor', 'ultrasound', 'ventilator', 'anesthesia', 'defibrillator', 'infusionPump', 'syringePump', 'hematology', 'analyzer'],
    'dräger': ['ventilator', 'anesthesia', 'patientMonitor', 'neonatal'],
    'getinge': ['ventilator', 'sterilizer', 'ot'],
    'resmed': ['cpap', 'bipap'],
    'zoll': ['defibrillator'],
    'stryker': ['defibrillator', 'ot', 'endoscopy'],
    'hologic': ['mammo'],
    'ziehm': ['carm']
  };
  Object.keys(map).forEach(m => map[m].forEach((eq, i) => models.push({
    id: m + '-' + eq, manufacturer: m, equipment: eq, name: 'Model A (example record)', placeholder: true
  })));
  BME.models = models;

  BME.sections = [
    { id: 'equipment', name: 'Equipment Training', icon: '⚙', desc: 'Explore machines component by component', route: '#/library' },
    { id: 'service', name: 'Service Training', icon: '⚒', desc: 'Symptom → cause → test → repair → verify', route: '#/service' },
    { id: 'pm', name: 'Preventive Maintenance', icon: '✓', desc: 'Daily to annual PM with records', route: '#/pm' },
    { id: 'troubleshoot', name: 'Troubleshooting', icon: '⌕', desc: 'Error codes and diagnostic flows', route: '#/errors' },
    { id: 'qa', name: 'QA & Performance Testing', icon: '◎', desc: 'Protocol-based acceptance testing', route: '#/qa' },
    { id: 'safety', name: 'Electrical & Safety', icon: '⚡', desc: 'Leakage, earthing, LOTO, radiation, MRI', route: '#/safety' },
    { id: 'fundamentals', name: 'Medical Equipment Fundamentals', icon: '∿', desc: 'Components, tools, DICOM, image quality', route: '#/fundamentals' },
    { id: 'manufacturer', name: 'Manufacturer Training', icon: '⌂', desc: 'Manufacturer → model → architecture', route: '#/manufacturers' },
    { id: 'simlab', name: 'Fault Simulation Lab', icon: '⚠', desc: 'Diagnose realistic faults hands-on', route: '#/simlab' },
    { id: 'assessment', name: 'Assessment & Certification', icon: '★', desc: 'Scored by competency domain', route: '#/assessment' },
    { id: 'progress', name: 'My Progress', icon: '▲', desc: 'Weak areas and recommendations', route: '#/progress' },
    { id: 'library', name: 'Service Reference Library', icon: '❐', desc: 'Manuals, SOPs, certificates — searchable', route: '#/documents' }
  ];
})();

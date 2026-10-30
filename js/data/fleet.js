/* Installed equipment (hospital fleet list). Model-level only: serial numbers
   from the source list are intentionally not stored on this public site.
   [maker, model, modality, count, platform equipment id, OEM model id, note] */
(function () {
  const M = {
    imaging: 'Mobile C-arm', angio: 'Angiography / Cath lab', cath: 'Cath lab adjunct', ct: 'CT', mri: 'MRI', nm: 'Nuclear medicine / PET',
    rf: 'Fluoroscopy (R/F)', dr: 'Radiography (DR)', mob: 'Mobile X-ray', cr: 'CR / digitiser / printer', dental: 'Dental X-ray', mammo: 'Mammography',
    dxa: 'Bone densitometry (DXA)', us: 'Ultrasound', echo: 'Cardiac ultrasound', inj: 'Contrast injector'
  };
  const L = [
    ['Ziehm', 'Vision', 'imaging', 6, 'carm'], ['Ziehm', 'Vision FD', 'imaging', 2, 'carm'], ['Ziehm', 'Vision RFD', 'imaging', 4, 'carm'],
    ['Ziehm', 'Vision RFD 3D', 'imaging', 2, 'carm'], ['Ziehm', 'Solo', 'imaging', 1, 'carm'],
    ['Siemens', 'Siremobil Compact', 'imaging', 2, 'carm'], ['Siemens', 'Cios Select', 'imaging', 1, 'carm'], ['Siemens', 'Cios Connect', 'imaging', 1, 'carm'],
    ['Philips', 'Zenition 50', 'imaging', 3, 'carm'], ['GE', 'OEC Brivo 785', 'imaging', 2, 'carm'], ['Medtronic', 'O-arm O2', 'imaging', 1, 'carm', null, 'Intra-operative 2D/3D imaging system'],
    ['Siemens', 'Artis zee biplane', 'angio', 3, 'cathlab'], ['Philips', 'Azurion 5 M12', 'angio', 1, 'cathlab'], ['Philips', 'Azurion 7 M12', 'angio', 1, 'cathlab'],
    ['Philips', 'Azurion 7 M20', 'angio', 2, 'cathlab'], ['Philips', 'Allura Xper FD10', 'angio', 1, 'cathlab', null, 'Listed as "Allura F10"'], ['GE', 'Innova IGS 5', 'angio', 1, 'cathlab'],
    ['Abbott', 'Portable FFR / RFR', 'cath', 1, 'cathlab'], ['Abbott (St. Jude)', 'OCT portable', 'cath', 1, 'cathlab'], ['Boston Scientific', 'Portable IVUS', 'cath', 1, 'cathlab'],
    ['Philips', 'IntraSight co-registration (IVUS + iFR)', 'cath', 1, 'cathlab', null, 'Listed as "Integrated co-registration imaging system IVUS+iFR"'], ['Philips', 'ELCA coronary laser atherectomy', 'cath', 1, 'cathlab'],
    ['Philips', 'Incisive CT', 'ct', 1, 'ct', 'philips-incisive'], ['Siemens', 'SOMATOM go.Up', 'ct', 1, 'ct', 'siemens-somatom-go-up'], ['Siemens', 'SOMATOM go.Top', 'ct', 1, 'ct', 'siemens-somatom-go-top'],
    ['Siemens', 'SOMATOM Drive', 'ct', 1, 'ct', 'siemens-somatom-drive'], ['GE (Wipro GE)', 'Discovery CT750 HD', 'ct', 1, 'ct', 'ge-discovery-ct750-hd'],
    ['Siemens', 'MAGNETOM Avanto', 'mri', 1, 'mri', 'siemens-magnetom-avanto'], ['Siemens', 'MAGNETOM Avanto fit', 'mri', 1, 'mri', 'siemens-magnetom-avanto-fit'], ['Siemens', 'MAGNETOM Skyra', 'mri', 1, 'mri', 'siemens-magnetom-skyra'], ['Siemens', 'MAGNETOM Aera', 'mri', 1, 'mri', 'siemens-magnetom-aera'],
    ['Siemens', 'MAGNETOM Vida', 'mri', 1, 'mri', 'siemens-magnetom-vida'], ['Siemens', 'MAGNETOM Sola', 'mri', 1, 'mri', 'siemens-magnetom-sola'],
    ['Philips', 'Achieva 1.5T', 'mri', 1, 'mri', 'philips-achieva'], ['GE', 'SIGNA Artist', 'mri', 1, 'mri', 'ge-signa-artist'],
    ['Siemens', 'Symbia Evo', 'nm', 1, null, null, 'SPECT gamma camera'], ['Siemens', 'Symbia Intevo 6', 'nm', 2, null, null, 'SPECT/CT'], ['Siemens', 'Biograph Horizon', 'nm', 2, 'ct', null, 'PET/CT (one listed as "Biograph Horizon 3R")'],
    ['Siemens', 'Luminos dRF Max', 'rf', 3, 'fluoro'],
    ['Samsung', 'GC85A', 'dr', 2, 'dr'], ['Carestream', 'DRX-Compass', 'dr', 1, 'dr'], ['Prognosys', 'ProRad 2FC', 'dr', 2, 'dr'], ['Siemens', 'Multix Fusion', 'dr', 1, 'dr'],
    ['GE', 'Brivo XR115', 'dr', 1, 'xray'], ['Philips', 'DigitalDiagnost C90', 'dr', 1, 'dr', null, 'Listed as "C90"'],
    ['Fujifilm', 'FDR Smart (Smart FDR)', 'dr', 2, 'dr'], ['Fujifilm', 'FDR Smart f 52S', 'dr', 1, 'dr'], ['Fujifilm', 'FDR Smart FGXR', 'dr', 1, 'dr'],
    ['Fujifilm', 'FDR Smart X (X52)', 'dr', 1, 'dr'], ['Fujifilm', 'FDR Smart X (X53)', 'dr', 1, 'dr'], ['Fujifilm', 'FDR Smart X (X80)', 'dr', 1, 'dr'],
    ['Fujifilm', 'FDR D-EVO II', 'dr', 1, 'dr', null, 'Flat-panel detector (listed as "DEVO-II")'], ['Fujifilm', 'FDR Prima T2', 'dr', 1, 'dr'],
    ['Skanray', 'Skan Mobile', 'mob', 1, 'mobileDr'], ['Siemens', 'Multimobil 10', 'mob', 1, 'portableXray'],
    ['Fujifilm', 'Microscan', 'cr', 3, 'dr', null, 'Listed as "Microscan / Microskan"; verify exact product'], ['Vidar', 'DiagnosticPRO', 'cr', 1, null, null, 'Film digitiser'],
    ['Vidar', 'Medi 6000 Plus', 'cr', 1, null, null, 'As listed; verify exact product'], ['Edgena', 'Dry Fix Edge', 'cr', 1, null, null, 'As listed; verify exact product'],
    ['Carestream', 'CS 8000 (OPG)', 'dental', 1, 'dental'], ['Carestream', 'CS 8100 SC Evo', 'dental', 1, 'dental'], ['Carestream', 'CS 2100', 'dental', 1, 'dental'],
    ['Hologic', '3Dimensions', 'mammo', 1, 'mammo'], ['Hologic', 'Horizon', 'dxa', 1, null], ['Hologic', 'Discovery A', 'dxa', 1, null],
    ['Canon (Toshiba)', 'Xario 100', 'us', 9, 'ultrasound'], ['Canon (Toshiba)', 'Xario 200', 'us', 2, 'ultrasound'], ['Canon (Toshiba)', 'Aplio 300', 'us', 1, 'ultrasound'],
    ['GE', 'LOGIQ S8', 'us', 6, 'ultrasound'], ['Siemens', 'ACUSON Juniper', 'us', 4, 'ultrasound'], ['Samsung', 'V7', 'us', 5, 'ultrasound'],
    ['Fujifilm', 'ARIETTA 65', 'us', 2, 'ultrasound'], ['Mindray', 'DC-80', 'us', 2, 'ultrasound'],
    ['SonoScape', 'P40', 'us', 1, 'ultrasound'], ['SonoScape', 'P25', 'us', 2, 'ultrasound'], ['SonoScape', 'S8 Exp', 'us', 1, 'ultrasound'], ['SonoScape', 'S12', 'us', 2, 'ultrasound'], ['SonoScape', 'S50 Elite', 'us', 2, 'ultrasound'],
    ['Philips', 'EPIQ 5', 'us', 1, 'ultrasound'], ['Philips', 'EPIQ 7', 'us', 2, 'ultrasound'], ['Philips', 'Affiniti 50G', 'us', 4, 'ultrasound'], ['Philips', 'Affiniti 70G', 'us', 7, 'ultrasound', null, '2D and 3D configurations'],
    ['Philips', 'EPIQ CVx', 'echo', 1, 'ultrasound'], ['Philips', 'CX50', 'echo', 1, 'ultrasound'], ['Siemens', 'ACUSON SC2000', 'echo', 1, 'ultrasound'],
    ['GE', 'Vivid S60', 'echo', 3, 'ultrasound', null, 'S60N and S60 (listed "S60W")'], ['GE', 'Vivid S70', 'echo', 3, 'ultrasound', null, 'R3, R4, R5 software'], ['GE', 'Vivid E95', 'echo', 1, 'ultrasound'],
    ['Bayer (Medrad)', 'Salient', 'inj', 7, 'ct', null, 'CT injector, incl. GE- and Siemens-interfaced units'], ['Bayer (Medrad)', 'Mark 7 Arterion', 'inj', 2, 'cathlab', null, 'Angio injector (one listed with Siemens ProVis interface)'],
    ['Bayer (Medrad)', 'Injector (model not listed)', 'inj', 2, 'cathlab', null, 'Listed against GE and a biplane lab'],
    ['Liebel-Flarsheim (Guerbet)', 'Angiographic injector (model not listed)', 'inj', 5, 'cathlab', null, 'Listed with Philips labs; one entry "906200B"'],
    ['Liebel-Flarsheim (Guerbet)', 'OptiVantage', 'inj', 1, 'ct', null, 'CT injector (maker listed as "Chiller"; verify)']
  ];
  const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  BME.fleetModalities = M;
  BME.fleet = L.map(([maker, model, mod, count, eq, oem, note]) => ({ id: slug(maker.split(' ')[0] + ' ' + model), maker, model, mod, count, eq, oem: oem || null, note: note || '' }));
})();

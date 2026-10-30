# BioMed Service Academy

An interactive training platform for biomedical engineers, biomedical technicians, service engineers, students and hospital technical staff. It covers medical equipment service: the principle, the components, PM, QA, troubleshooting, safety and assessment.

## 1. What we took from the reference site (Neuro Lightbox)

| Neuro Lightbox pattern | How this platform uses it |
|---|---|
| One subject seen through many methods | One machine seen through 14 tabs. You never leave the equipment. |
| "How the machine works" walkthrough per method | **How it works**: animated stage player with pause and step. Each stage shows the active component, the signal, the parameter measured and what can fail. |
| Clickable / hoverable structures | **Interactive machine view**: every block in the diagram is clickable and opens 14 fields of component detail. |
| Structural vs functional grouping | Architecture (Components) vs behaviour (How it works, Operation) |
| Hands-on "Brain Lab" | Fault Simulation Lab, Service Engineer Mode, DICOM network simulator, leakage-current simulator |
| Viewer sub-tabs (Findings / Labels / Compare) | Image Quality: Compare (normal vs artifact) and Identify (click the image, then classify it) |
| "Simulated for teaching, not diagnosis" | "Training codes (TRN-*)". "Model-specific procedure required". Acceptance limits are always configured, never hard-coded. |

No branding, content or assets were copied from that site.

## 2. Run it

There is no build step. Use either option:

- **Simplest:** open `index.html` in Chrome or Edge.
- **Recommended:** serve the folder. Camera QR scanning needs `localhost` or HTTPS.
  ```
  npx serve E:\Steve\training      # or: python -m http.server
  ```

The app loads three libraries from public CDNs: QR generation, QR scanning, and PDF text extraction. Everything else works offline. Progress and records are kept in your browser (localStorage). Uploaded files and photos are kept in IndexedDB.

## 3. What's inside

- **Dashboard.** 12 training sections, recommendations and equipment cards. Each card shows progress, completed and pending modules, difficulty, time and when you last opened it.
- **36 equipment types in 4 categories.** These 8 have **full content packs**: Ventilator, CT, MRI, X-Ray, Ultrasound, Patient Monitor, Defibrillator and Infusion Pump. The rest have **starter packs**: an auto-generated architecture diagram plus generic PM.
- **14 equipment tabs:** Overview · How it works · Components · Operation · PM · QA · Troubleshoot · Error codes · Service · Safety · Tools · Documents · Cases · Assessment.
- **Levels L1–L5.** Tabs unlock as you pass assessments and solve cases. *Instructor mode* (on the Levels page) unlocks everything.
- **Service Engineer Mode.** Steps: Symptom → Possible cause → Test ("What would you test first?", with the reason) → Measurement → Decision → Repair → Verification.
- **Fault Simulation Lab.** 8 scenarios, each with an error code, sensor status and investigation buttons. Your score depends on your diagnostic path: unnecessary checks, invasive checks done before the basics, and wrong diagnoses all cost points.
- **18 service cases.** Each is a hospital work order.
- **PM.** Daily to annual. Each task has result entry, pass/fail, remarks, a photo (camera on mobile) and the engineer's signature. Records can be linked to an asset.
- **QA.** Test → setup → measurement → limit → result → pass/fail → report. You configure each limit and must cite its source (protocol, manual section, or standard and revision).
- **Electrical & Safety.** 20 modules, hazard-zone maps for CT, MRI, X-Ray and Ventilator, and a leakage-current simulator.
- **Error Code Explorer.** Filter by manufacturer → equipment → model → code, with a verification warning. An admin can add real model-specific codes.
- **Service Tools Lab.** 16 test instruments, each taught as selection → connection → measurement → expected result → interpretation → documentation.
- **DICOM / Network.** A simulated modality → switch → PACS/RIS/MWL setup with a random fault. Work through 8 checks, then fix the configuration.
- **Image Quality.** Procedurally generated CT, MRI, DR and ultrasound images with 16 artifacts or faults.
- **Equipment & QR.** Each asset has its own QR code. Scanning it opens the asset profile: PM status, service history, QA status, manuals, troubleshooting, notes and photos, and a link to start a service record.
- **Service reports.** Prints as a professional report (Print → Save as PDF). Documentation completeness is scored.
- **Reference Library.** Upload PDFs, SOPs and manuals. PDF text is indexed so you can search inside documents and jump straight to the matching page.
- **Assessment.** MCQ, component identification, image identification and troubleshooting questions. Scores are reported for 5 domains, with an overall result of PASS, NEEDS IMPROVEMENT or ADVANCED. A printable certificate is available.
- **Training Assistant.** Answers come only from the platform content and your uploaded documents. Every answer is split into **Educational · Manufacturer-specific · Hospital SOP · Regulatory**. It never invents manufacturer procedures.

## 3b. Real-time: live simulators, 3D explorer, DICOM viewer

- **Live Simulators** (`#/live`). Each machine runs in real time with **synthesised sound** from the Web Audio API; there are no audio files. Simulators exist for the Patient Monitor, Ventilator, Defibrillator, Infusion Pump, CT, MRI, X-Ray and Ultrasound. Each one has:
  - live waveforms and console numerics that respond to its controls;
  - the machine's sounds: QRS tone whose pitch follows SpO₂, breath flow, gantry spin, MRI gradient noise, rotor whine, the defibrillator's charge whine and shock, and Doppler audio;
  - alarms in prioritised high / medium / low patterns, modelled on the IEC 60601-1-8 burst structure as a training approximation, with audio pause;
  - an event log, instructor **fault injection**, and a **Mystery fault** mode that is scored.
- **3D Machine Explorer** (`#/3d`). Interactive procedural 3D models built with three.js, which loads on demand from jsDelivr.
  - Rotate, pan and zoom the machine.
  - **X-ray view** makes the covers see-through, **Exploded** view pulls the assembly apart, and **Service** view shows hazard zones.
  - Labels can be turned on.
  - **Click any part** for its function, failure modes, symptoms, tests, PM, spares and safety notes.
  - **Run scan** animates the equipment workflow stage by stage in 3D, with sound.
  - The 8 core machines have detailed models. Every other equipment type gets an auto-generated modular 3D model of its parts.
- **DICOM Viewer** (`#/dicom-viewer`). Load `.dcm` files or folders; they never leave the browser. It is a training / reference viewer, **not a cleared diagnostic device**.

Requirements: WebGL for 3D, and a modern Chrome or Edge. Sound starts only after you press Power on or Run scan, because browsers block autoplay.

## 4. Extending it (no core code changes)

| Add | How |
|---|---|
| A new equipment type, quickly | Admin → *Add equipment*. Type its components in signal order and the diagram, components, workflow and PM are generated automatically. |
| A full content pack | Copy `js/content/ventilator.js` (the schema is documented at the top of `js/core.js`), then add one `<script>` line in `index.html`. |
| Categories, manufacturer models, model-specific error codes | Admin screen |
| Manuals, SOPs, certificates | Reference Library upload. Each file can be linked to equipment, a component and an error code. |
| A live simulator | Add `js/sim/<name>.js` calling `Sim.register('<equipmentId>', def)`. The API is documented at the top of `js/sim/engine.js`, and `js/sim/monitor.js` is the reference simulator. |
| A detailed 3D model | Add a file calling `X3D.model('<equipmentId>', K => {...})`. The kit is documented at the top of `js/three/explorer.js`. Use `K.part('<componentId>', mesh)` to link a mesh to that component's service data. |
| Move to a server | `db/schema.sql` (PostgreSQL) has every table: equipment, manufacturers, models, components, training modules and lessons, PM/QA procedures, cases, error codes, troubleshooting steps, tools, documents (with full-text search), service/PM/QA records, users, roles, assessments, questions, answers, progress and QR codes. Admin → Export JSON produces the data to migrate. |

## 5. Content policy

- All built-in error codes are **fictional `TRN-*` training codes**.
- Manufacturer names are used for navigation only, and their model records are placeholders. Wherever a generic procedure could be mistaken for an official one, the app shows **"Model-specific procedure required"**.
- QA and electrical-safety limits are **never hard-coded**. They come from the hospital's approved protocol, and each one records its source.
- Training certificates do **not** authorise anyone to service a specific manufacturer's model.

## Layout

```
index.html            app shell
css/styles.css        theme (dark navy / light), responsive, print
js/core.js            registry + content schema
js/data/catalog.js    categories, 36 equipment, manufacturers, models, sections
js/data/library.js    tools, cases, scenarios, artifacts, safety topics, generic PM
js/content/*.js       full equipment content packs
js/store.js           localStorage + IndexedDB, starter-pack generator
js/ui.js              diagram renderer, quiz engine, modal, signature pad
js/views/*.js         dashboard, equipment explorer, labs, records, assistant, live, DICOM viewer
js/sim/*.js           real-time simulation engine (Web Audio synth, strip charts, alarms) + simulators
js/three/*.js         3D explorer framework + procedural machine models
css/sim.css, three.css, dicom-viewer.css
js/app.js             router, search, theme, full-screen, QR scanner
db/schema.sql         production database schema
```

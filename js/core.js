/* BioMed Service Academy — core registry.
 *
 * Everything in the app is driven by data registered here. New equipment,
 * manufacturers, models, error codes, cases and tools can be added as content
 * files (js/content/*.js) or at runtime through the Admin screen, without
 * touching the application code.
 *
 * EQUIPMENT CONTENT PACK SCHEMA (all fields optional except id):
 * {
 *   id, name, category, difficulty, hours, hazards:[{label,type}],   // type: hv|rad|mag|patient|bio|laser|chem
 *   summary: string,
 *   principle: [string],                      // short bullet points
 *   parameters: [{name, unit, typical, note}],// "typical" is descriptive, not an acceptance limit
 *   diagram: { w, h,
 *     nodes: [{id, x, y, w, h, label}],       // clickable blocks; id must match a components key
 *     links: [[fromId, toId, label?]],
 *     zones: [{x, y, w, h, label, type}] },   // hazard areas drawn behind blocks
 *   components: { [id]: { name, function, principle, input, output, normal, failure,
 *                 symptoms, test, service, safety, spares:[...], pm:[...], qa:[...] } },
 *   workflow: [{ title, active:[nodeIds], what, signal, parameter, fail }],
 *   operation: [{ step, detail }],
 *   pm: { daily|weekly|monthly|quarterly|halfyearly|annual: [{ task, why, tools, safety, procedure, criteria }] },
 *   qa: [{ id, test, setup, measure, unit, example, report }],   // limits are configured per hospital protocol
 *   troubleshoot: [{ symptom, causes:[{cause, note}], first:{ prompt, options:[{t, correct, why}] },
 *                    measure, decision, repair, verify }],
 *   errors: [{ code, desc, causes:[...], component, checks:[...], service, verify, pm }],
 *   safety: [{ title, level, text }],          // level: danger|warning|caution|info
 *   tools: [toolId],
 *   cases: [caseId], scenarios: [scenarioId], artifacts: [artifactId],
 *   questions: [{ q, options:[...], answer: index, why, domain }]  // domain: knowledge|technical|troubleshooting|safety|documentation
 * }
 */
(function () {
  const BME = {
    categories: [],
    equipment: {},
    manufacturers: [],
    models: [],
    errorCodes: [],
    tools: {},
    cases: {},
    scenarios: {},
    artifacts: {},
    safetyTopics: [],
    questions: [],
    sections: [],

    addCategory(cat) {
      if (!this.categories.find(c => c.id === cat.id)) this.categories.push(cat);
    },
    /* Registering the same id twice deep-merges, so a catalog entry can be
       enriched later by a content pack. */
    registerEquipment(def) {
      const prev = this.equipment[def.id] || {};
      this.equipment[def.id] = Object.assign({}, prev, def);
    },
    addTool(t) { this.tools[t.id] = t; },
    addCase(c) { this.cases[c.id] = c; },
    addScenario(s) { this.scenarios[s.id] = s; },
    addArtifact(a) { this.artifacts[a.id] = a; },

    PM_LEVELS: [
      ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'],
      ['quarterly', 'Quarterly'], ['halfyearly', 'Half-yearly'], ['annual', 'Annual']
    ],
    LEVELS: [
      { n: 1, name: 'Beginner', desc: 'Basic principles and components' },
      { n: 2, name: 'Technician', desc: 'Operation and preventive maintenance' },
      { n: 3, name: 'Biomedical Engineer', desc: 'Testing and troubleshooting' },
      { n: 4, name: 'Service Engineer', desc: 'Advanced diagnosis' },
      { n: 5, name: 'Senior Engineer', desc: 'Architecture, root-cause analysis, complex faults' }
    ],
    /* Equipment tabs and the training level that unlocks each one. */
    TABS: [
      ['overview', 'Overview', 1], ['how', 'How it works', 1], ['components', 'Components', 1],
      ['operation', 'Operation', 2], ['pm', 'PM', 2], ['qa', 'QA', 3], ['troubleshoot', 'Troubleshoot', 3],
      ['errors', 'Error codes', 4], ['service', 'Service', 4], ['safety', 'Safety', 1],
      ['tools', 'Tools', 3], ['documents', 'Documents', 2], ['cases', 'Cases', 4], ['assessment', 'Assessment', 1]
    ],
    DOMAINS: ['knowledge', 'technical', 'troubleshooting', 'safety', 'documentation']
  };
  window.BME = BME;
})();

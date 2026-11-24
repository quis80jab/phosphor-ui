// What the atlas preview has picked, shared by every page so a pick on one page shows on the others.
// Ephemeral: it lives in the page and is never saved, as the export's guide asks of preview state.
const START = {
  asset: 'a-small', flight: 'f2', run: 'r3', recording: 'rec3', case: 'c1', finding: 'fd1', event: 'e4', scanA: 's0', scanB: 's3',
  assetKind: 0, caseFilter: 0, calendarScope: 1, analyzeMetric: 0, compareMode: 0, simulateOn: 0, flyOn: 0, mode: 2, generator: 3,
  guard: true, noseAlong: true, pole: true, show: {cloud: true, splat: false, detections: true, path: true},
  layers: {sim: true, live: true, telemetry: true}, decision: null, stage: 1, scenario: 0, module: 'm-flight', chainStep: null,
  settingsData: 0, faults: {wind: false, link: false, battery: false}, waypoint: 9, notes: 0,
  // Nobody holds a lease now (the last was released at 10:09); the preview may take one, and sends nothing.
  leases: {'flight-orin': false, 'sim-robot': false}, link: null, lastCommand: null, benchChecks: {}, stagePick: 0, scenarioPick: 0,
  renderPick: 0, trainingPick: 0,
};

export const ui = structuredClone(START);

/** Back to the start, for tests and a fresh preview. */
export function resetUi() {
  for (const key of Object.keys(ui)) delete ui[key];
  Object.assign(ui, structuredClone(START));
}

/** The next of a list after `current`, wrapping round. */
export const next = (list, current) => list[(list.indexOf(current) + 1) % list.length];

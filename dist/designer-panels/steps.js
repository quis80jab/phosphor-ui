// The six step pages of a flight at a site: find a place, preview, simulate / edit, run, review,
// compare. Every figure comes from the sample records; flight 2 is the one that goes all the way.
import {SAMPLE, SAMPLE_POLE, assetById, flightById, runById, recordingById, findingById} from '../designer-records.js';
import {nodeById} from '../designer-architecture.js';
import {siteState} from './site.js';
import {el, text, fill, outline, facts, rows, table, chart, words, part, choice, button, lampLine, ORIGIN_TAG, MINT, DIM, AMBER, RED} from './kit.js';

const toggle = (ctx, b, label, value, env, set) => { el(ctx, 'toggle', b, {label, value}); env.hit(b, () => { set(!value); return true; }); };
/** Toggles one under another; side by side as checkboxes when the box is too short for them all. */
const toggles = (ctx, b, items, env) => {
  if (items.length * 28 <= b.height + 4) { items.forEach(([label, value, set], i) => toggle(ctx, part(b, 0, i * 28, b.width, 24), label, value, env, set)); return; }
  const width = Math.floor((b.width - 6 * (items.length - 1)) / items.length);
  items.forEach(([label, value, set], i) => {
    const box = part(b, i * (width + 6), 0, width, Math.min(22, b.height));
    el(ctx, 'checkbox', box, {label, value});
    env.hit(box, () => { set(!value); return true; });
  });
};

const flight2 = flightById('f2'), small = assetById('a-small'), watched = SAMPLE.watched, limits = SAMPLE.limits;
const siteTargets = () => SAMPLE.assets.filter(asset => asset.kind === 'site');
const centreOf = ring => ({x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length});
const pct = share => `${Math.round(share * 100)} %`;
/** Picks a value of the shared preview state; false when it was already picked, so nothing repaints. */
const set = (env, key, value) => { if (env.ui[key] === value) return false; env.ui[key] = value; return true; };

/** A flight's plan as the plan map draws it: home, take-off, the orbit with its views, back; the guard's run on top. */
export function planState(ui, {guard = false, aircraftAt = null, caption = ''} = {}) {
  const flight = flightById(ui.flight);
  if (!flight.path) {
    const outlines = flight.covers.map(id => assetById(id).outline), c = centreOf(outlines.flat());
    return {centre: c, reach: 80, outline: outlines[0], obstacles: outlines.slice(1), home: {x: c.x, y: c.y - 40}, fence_m: limits.fence_m, fenceBroken: true, legs: [], caption: caption || flight.note};
  }
  const path = flight.path, home = flight.home;
  const state = {
    centre: {x: home.x, y: home.y + 10}, reach: 32, outline: small.outline, obstacles: [], home, fence_m: limits.fence_m,
    legs: [{kind: 'take-off', points: [home, path[0]]}, {kind: 'scan', points: path.map(p => ({x: p.x, y: p.y, heading: (p.heading + 180) % 360}))}, {kind: 'return', points: [path[path.length - 1], home]}],
    caption,
  };
  if (guard) {
    const g = flight.guard, h = SAMPLE_POLE.side_m / 2, c = centreOf(small.outline), a = g.bearing_deg * Math.PI / 180;
    const round = {x: c.x - g.out_m * Math.sin(a), y: c.y - g.out_m * Math.cos(a)}, met = ui.pole, avoided = ui.pole && ui.guard;
    Object.assign(state, {
      unknown: met ? [[{x: SAMPLE_POLE.x - h, y: SAMPLE_POLE.y - h}, {x: SAMPLE_POLE.x + h, y: SAMPLE_POLE.y - h}, {x: SAMPLE_POLE.x + h, y: SAMPLE_POLE.y + h}, {x: SAMPLE_POLE.x - h, y: SAMPLE_POLE.y + h}]] : [],
      sensed: met ? [{x: SAMPLE_POLE.x + h, y: SAMPLE_POLE.y - h}, {x: SAMPLE_POLE.x - h, y: SAMPLE_POLE.y - h}] : [],
      stops: avoided ? [path[g.stopAt]] : [],
      ways: avoided ? [[path[g.stopAt], round, path[g.rejoin]]] : [],
      leftOut: avoided ? g.leftOut.map(i => path[i]) : [],
      struck: met && !ui.guard ? {x: SAMPLE_POLE.x, y: SAMPLE_POLE.y} : null,
      trail: [home, ...path.slice(0, met && !ui.guard ? g.struckAt : g.trail)].map((p, i) => ({x: p.x, y: p.y, blind: !ui.noseAlong && i % 6 > 2})),
    });
  }
  if (aircraftAt !== null) { state.trail = [home, ...path.slice(0, aircraftAt)].map(p => ({x: p.x, y: p.y})); state.aircraft = path[aircraftAt]; }
  return state;
}

/** Marks finds on a close view of the small building; gives back each mark's box. */
export function markFinds(ctx, b, view, list, picked) {
  const per = Math.max(8, Math.min(b.width, b.height) - 4) / view.across_m, cx = b.x + Math.floor(b.width / 2), cy = b.y + Math.floor(b.height / 2);
  const centre = centreOf(small.outline);
  return list.map(find => {
    const x = Math.round(cx + (centre.x + find.at.x - view.centre.x) * per), y = Math.round(cy - (centre.y + find.at.y - view.centre.y) * per);
    fill(ctx, x - 2, y - 2, 5, 5, RED);
    if (find.id === picked) outline(ctx, x - 5, y - 5, 11, 11, RED);
    return {find, box: {x: x - 6, y: y - 6, width: 13, height: 13}};
  });
}

const STEPS = {
  // -------------------------------------------------------------------------------- 1, find a place
  'site-find/find a place': {data: false, paint(ctx, b) {
    el(ctx, 'field', part(b, 0, 0, b.width, 24), {value: 'FERRY BUILDING, SAN FRANCISCO', icon: 'search'});
    if (b.height > 34) text(ctx, 'OR LATITUDE AND LONGITUDE', b.x, b.y + 30, DIM, {room: b.width});
  }},
  'site-find/places found': {paint(ctx, b) {
    SAMPLE.places.forEach((place, i) => { if ((i + 1) * 28 <= b.height + 4) el(ctx, 'place', part(b, 0, i * 28, b.width, 24), {...place, selected: i === 0}); });
    const below = SAMPLE.places.length * 28 + 4;
    if (b.height > below + 10) words(ctx, 'OPENSTREETMAP NOMINATIM, ASKED FROM THE PAGE', part(b, 0, below, b.width, b.height - below), DIM);
  }},
  'site-find/sites kept': {paint(ctx, b) {
    const columns = [{title: 'SITE', share: 3}, {title: 'TARGETS', share: 1.4, align: 'right'}];
    table(ctx, b, columns, SAMPLE.sitesKept.map(site => [site.name, String(site.targets)]), {selected: 0});
  }},
  'site-find/keep the site': {header: 'none', data: false, paint(ctx, b, env) { button(ctx, b, env.rect.label); }},
  'site-find/site map': {paint(ctx, b, env) {
    el(ctx, 'siteMap', b, {...siteState(env.ui, 'DRAW A LOOP ROUND A BUILDING'), mode: 'loop'});
    text(ctx, SAMPLE.site.terms, b.x + b.width - 4, b.y + b.height - 9, DIM, {align: 'right', room: b.width - 8});
  }},
  'site-find/picked building': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset), guess = asset.heights.includes('GUESS');
    el(ctx, 'target', part(b, 0, 0, b.width, 60), {name: asset.name, outline: asset.osm ? 'FROM OPENSTREETMAP' : 'NONE', ground: 'FLAT', groundSource: 'FRAME', groundGuess: true, roof: asset.roof_m ? `${asset.roof_m.toFixed(1)} M` : '--', roofSource: guess ? 'DEFAULT' : 'OSM', roofGuess: guess, surfaces: 'OUTLINE PUSHED UP'});
    if (b.height > 70) words(ctx, asset.full, part(b, 0, 66, b.width, b.height - 66), DIM);
  }},
  'site-find/roof by hand': {data: false, paint(ctx, b, env) {
    el(ctx, 'stepper', part(b, 0, 0, Math.min(b.width, 140), 24), {value: assetById(env.ui.asset).roof_m ?? 0, unit: 'm'});
  }},
  'site-find/edit the outline': {data: false, paint(ctx, b) {
    button(ctx, part(b, 0, 0, b.width, 24), 'MOVE A CORNER');
    if (b.height > 30) words(ctx, 'SYNTHETIC OUTLINE EDITING EXAMPLE', part(b, 0, 30, b.width, b.height - 30), DIM);
  }},
  'site-find/where it came from': {data: false, paint(ctx, b) {
    el(ctx, 'provenance', part(b, 0, 0, b.width, 16), {source: SAMPLE.site.source, terms: SAMPLE.site.terms, when: SAMPLE.site.fetched});
  }},
  'site-find/what this site holds': {header: 'compact', paint(ctx, b) {
    const items = [['OUTLINES', `${SAMPLE.buildings.length} FROM OSM`], ['TARGETS', String(siteTargets().length)], ['PAST SCANS', String(SAMPLE.scans.length)]];
    const width = Math.floor(b.width / items.length);
    items.forEach(([key, value], i) => el(ctx, 'keyvalue', part(b, i * width, -2, width - 12, 14), {key, value}));
  }},

  // ------------------------------------------------------------------------------------- 2, preview
  'site-preview/flights at this site': {paint(ctx, b, env) {
    rows(ctx, b, SAMPLE.flights.map(flight => ({title: flight.name, detail: flight.state, level: flight.state === 'PASSED' ? 'ok' : 'fail', selected: flight.id === env.ui.flight})), {pitch: 22})
      .forEach((row, i) => env.hit(row, () => set(env, 'flight', SAMPLE.flights[i].id)));
  }},
  'site-preview/this flight covers': {paint(ctx, b, env) {
    const flight = flightById(env.ui.flight), refused = flight.state === 'REFUSED';
    rows(ctx, b, flight.covers.map(id => ({title: assetById(id).name, detail: refused ? 'TOO BIG' : 'FITS', level: refused ? 'fail' : 'ok'})), {pitch: 20});
  }},
  'site-preview/generator': {data: false, paint(ctx, b, env) {
    choice(ctx, part(b, 0, 0, b.width, 24), ['RING', 'FACE', 'ROOF', 'ORBIT', 'HELIX', 'ALL'], env.ui.generator).forEach((box, i) => env.hit(box, () => set(env, 'generator', i)));
  }},
  'site-preview/settings': {data: false, paint(ctx, b, env) {
    const flight = flightById(env.ui.flight);
    SAMPLE.planSettings.forEach((setting, i) => {
      if ((i + 1) * 26 > b.height + 2) return;
      text(ctx, setting.label, b.x, b.y + i * 26 + 8, DIM, {room: 64});
      el(ctx, 'slider', part(b, 68, i * 26, b.width - 68, 22), {min: setting.min, max: setting.max, value: setting.key ? flight[setting.key] : setting.value, unit: setting.unit, decimals: setting.decimals});
    });
  }},
  'site-preview/home': {data: false, paint(ctx, b, env) {
    const flight = flightById(env.ui.flight);
    el(ctx, 'toggle', part(b, 0, 0, b.width, 24), {label: 'HOME SET BY HAND', value: false});
    if (b.height > 30) text(ctx, flight.homeNote ?? 'NO HOME: THE PLAN IS REFUSED', b.x, b.y + 30, flight.homeNote ? DIM : AMBER, {room: b.width});
  }},
  'site-preview/make the plan': {header: 'none', data: false, paint(ctx, b, env) { button(ctx, b, env.rect.label); }},
  'site-preview/the plan from above': {paint(ctx, b, env) {
    const flight = flightById(env.ui.flight);
    el(ctx, 'planMap', b, planState(env.ui, {caption: `${flight.name} / ${flight.generator} / SAMPLE`}));
  }},
  'site-preview/checks': {paint(ctx, b, env) {
    flightById(env.ui.flight).checks.forEach((check, i) => { if ((i + 1) * 18 <= b.height + 2) el(ctx, 'check', part(b, 0, i * 18, b.width, 16), check); });
  }},
  'site-preview/how far it reaches': {paint(ctx, b, env) {
    const flight = flightById(env.ui.flight);
    el(ctx, 'fence', b, {limit: limits.fence_m, farthest: flight.reach_m, ...flight.fence});
  }},
  'site-preview/coverage by target': {paint(ctx, b, env) {
    const flight = flightById(env.ui.flight);
    if (!flight.coverage) { words(ctx, 'NO PLAN: NOTHING TO COVER', b, AMBER); return; }
    el(ctx, 'coverage', b, {faces: flight.coverage.faces});
  }},
  'site-preview/slam and splat expected': {paint(ctx, b, env) {
    const e = flightById(env.ui.flight).expected;
    facts(ctx, b, [['VIEWS REGISTERED', e ? pct(e.registered) : '--'], ['SPLAT, THREE VIEWS', e ? pct(e.splatViews) : '--']]);
  }},
  'site-preview/missions': {paint(ctx, b, env) {
    const flight = flightById(env.ui.flight);
    if (!flight.missions.length) { words(ctx, 'NO MISSIONS: THE PLAN HAS CHECK ERRORS', b, RED); return; }
    flight.missions.forEach((mission, i) => el(ctx, 'mission', part(b, 0, i * 20, b.width, 18), {name: mission.name, steps: mission.steps, most: mission.of, time: mission.time, loss: mission.loss, selected: i === 0}));
    const half = Math.floor((b.width - 6) / 2);
    if (b.height > 60) { button(ctx, part(b, 0, b.height - 24, half, 24), 'KEEP'); button(ctx, part(b, half + 6, b.height - 24, b.width - half - 6, 24), 'DOWNLOAD'); }
  }},
  'site-preview/height along the path': {header: 'compact', paint(ctx, b) {
    chart(ctx, b, {type: 'sparkline', data: flight2.profile.map((value, i) => ({label: String(i), value})), unit: 'M', max: limits.up_m[1]});
  }},

  // --------------------------------------------------------------------------- 3, simulate / edit
  'site-simulate/simulate on': {data: false, paint(ctx, b, env) {
    choice(ctx, part(b, 0, 0, b.width, Math.min(24, b.height)), ['IN THE PAGE', 'SIM AIRCRAFT'], env.ui.simulateOn).forEach((box, i) => env.hit(box, () => set(env, 'simulateOn', i)));
  }},
  'site-simulate/the guard': {data: false, paint(ctx, b, env) {
    toggles(ctx, b, [['STOP FOR WHAT IT SEES', env.ui.guard, v => { env.ui.guard = v; }], ['NOSE ALONG THE WAY', env.ui.noseAlong, v => { env.ui.noseAlong = v; }], ['A POLE NOT IN THE PLAN', env.ui.pole, v => { env.ui.pole = v; }]], env);
  }},
  'site-simulate/waypoint': {paint(ctx, b, env) {
    const p = flight2.path[env.ui.waypoint], home = flight2.home;
    el(ctx, 'waypoint', part(b, 0, 0, b.width, 18), {index: env.ui.waypoint + 1, east: p.x - home.x, north: p.y - home.y, up: flight2.orbit.up_m, heading: (p.heading + 180) % 360, pitch: flight2.orbit.pitch_deg, aimLost: true});
    if (b.height > 30) words(ctx, 'PICK A SAMPLE WAYPOINT TO INSPECT ITS POSITION AND CAMERA ANGLE', part(b, 0, 26, b.width, b.height - 26), AMBER);
  }},
  'site-simulate/runs so far': {paint(ctx, b, env) {
    const runs = SAMPLE.runs.filter(run => run.flight === 'f2');
    rows(ctx, b, runs.map(run => ({title: `${run.name} / ${ORIGIN_TAG[run.origin]}`, detail: run.outcome, level: run.outcome === 'COMPLETED' ? 'ok' : run.outcome === 'STRUCK' ? 'fail' : 'off', selected: run.id === env.ui.run})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => set(env, 'run', runs[i].id)));
  }},
  'site-simulate/run the simulation': {header: 'none', data: false, paint(ctx, b, env) { button(ctx, b, env.rect.label); }},
  'site-simulate/the simulated scene': {paint(ctx, b, env) {
    const run = runById(env.ui.guard ? 'r1' : 'r2');
    el(ctx, 'planMap', b, planState(env.ui, {guard: true, caption: env.ui.guard ? `THE GUARD: ${run.stops} STOP, ${run.wentRound}` : 'NO GUARD: THE POLE IS STRUCK'}));
  }},
  'site-simulate/simulated camera': {paint(ctx, b) {
    el(ctx, 'picture', b, {...SAMPLE.simCamera, origin: 'sim', kind: 'video', signal: false});
  }},
  'site-simulate/sensors on board': {data: 'SAMPLE', paint(ctx, b) {
    rows(ctx, b, SAMPLE.guardSensors.map(sensor => ({title: sensor.name, detail: sensor.reach, level: 'ok'})), {pitch: 20});
    const below = SAMPLE.guardSensors.length * 20 + 6;
    if (b.height > below + 10) words(ctx, 'EXACT RAYS, NO NOISE. NOTHING LOOKS BACK OR TO THE SIDE', part(b, 0, below, b.width, b.height - below), DIM);
  }},
  'site-simulate/where it left the plan': {paint(ctx, b, env) {
    const run = runById(env.ui.guard ? 'r1' : 'r2');
    facts(ctx, b, [['STOPPED', `${run.stops} TIME${run.stops === 1 ? '' : 'S'}`, run.stops ? AMBER : undefined], ['WENT ROUND', run.wentRound], ['LEFT OUT', `${run.leftOut} STEPS`, run.leftOut ? AMBER : undefined], ['NEAREST, NOT IN PLAN', `${run.nearest_m.toFixed(2)} M`, run.outcome === 'STRUCK' ? RED : undefined], ['FLOWN BLIND', run.blind]]);
    if (b.height > 96) words(ctx, run.note, part(b, 0, 86, b.width, b.height - 86), DIM);
  }},
  'site-simulate/wind and faults': {data: false, paint(ctx, b, env) {
    const f = env.ui.faults;
    toggles(ctx, b, SAMPLE.faults.map(fault => [fault.label, f[fault.key], v => { f[fault.key] = v; }]), env);
  }},
  'site-simulate/the run': {header: 'compact', paint(ctx, b) {
    const head = SAMPLE.playheads.simulate;
    el(ctx, 'transport', part(b, 0, 0, b.width, Math.min(22, b.height)), {at: head.at, of: runById('r1').time.padStart(5, '0'), share: head.share});
  }},

  // ----------------------------------------------------------------------------------------- 4, run
  'site-run/fly on': {data: false, paint(ctx, b, env) {
    choice(ctx, part(b, 0, 0, b.width, Math.min(24, b.height)), ['VIRTUAL SIMULATOR', 'REAL: LOCKED'], env.ui.flyOn).forEach((box, i) => env.hit(box, () => i !== 1 && set(env, 'flyOn', i)));
  }},
  'site-run/before it flies': {paint(ctx, b) {
    const gates = SAMPLE.events.find(event => event.gates).gates;
    el(ctx, 'steps', part(b, 0, 0, b.width, 24), {items: [...gates.map(gate => ({label: gate.label, state: gate.state})), {label: 'REAL', state: 'todo'}]});
    words(ctx, `${gates.map(gate => gate.says).join(', THEN ')}. THIS PREVIEW DOES NOT CONTROL HARDWARE`, part(b, 0, 32, b.width, b.height - 32), DIM);
  }},
  'site-run/ready?': {paint(ctx, b) {
    SAMPLE.ready.forEach(([title, detail], i) => { if (i * 13 + 8 <= b.height) lampLine(ctx, b.x, b.y + i * 13, b.width, title, detail, MINT); });
  }},
  'site-run/start, pause, return, stop': {data: false, paint(ctx, b, env) {
    // Every command goes through Flight under the lease, signed; without the lease nothing is sent.
    const observer = env.arch.person !== 'operator', across = b.height < 52 ? 4 : 2, width = Math.floor((b.width - 6 * (across - 1)) / across);
    ['START', 'PAUSE', 'RETURN', 'STOP'].forEach((label, i) => {
      const box = part(b, (i % across) * (width + 6), Math.floor(i / across) * 28, width, 24);
      if (box.y + box.height <= b.y + b.height) button(ctx, box, label, {disabled: observer});
    });
    const below = across === 4 ? 30 : 60;
    if (b.height > below + 2) text(ctx, observer ? 'NO LEASE: TAKE IT ON SYSTEM FIRST' : 'LOCAL PREVIEW CONTROLS ONLY', b.x, b.y + below, observer ? AMBER : DIM, {room: b.width});
  }},
  'site-run/simulator view': {paint(ctx, b, env) {
    el(ctx, 'planMap', b, planState(env.ui, {aircraftAt: watched.aircraftAt, caption: `${runById(watched.run).name}, SYNTHETIC FLIGHT PREVIEW`}));
  }},
  'site-run/live view with telemetry': {paint(ctx, b) {
    const w = watched;
    el(ctx, 'flightCluster', b, {name: nodeById[w.device].name, origin: w.origin, roll: w.roll, pitch: w.pitch, height: w.up_m, speed: w.speed_mps, heading: w.heading_deg, latitude: w.latitude, longitude: w.longitude, altitude: `${w.up_m.toFixed(1)} M`, fix: w.fix, satellites: w.satellites, battery: w.battery_pct, volts: w.volts, lease: w.lease, leaseAge: w.leaseAge});
  }},
  'site-run/who holds control': {paint(ctx, b, env) {
    el(ctx, 'lease', part(b, 0, 0, b.width, 16), {state: env.arch.person === 'operator' ? watched.lease : 'other', age: watched.leaseAge});
    if (b.height > 24) lampLine(ctx, b.x, b.y + 24, b.width, 'THE RC', watched.pilot, AMBER);
    if (b.height > 40) words(ctx, 'THE MODE SWITCH OUT OF P TAKES OVER AT ONCE', part(b, 0, 40, b.width, b.height - 40), DIM);
  }},
  'site-run/recording': {paint(ctx, b) {
    el(ctx, 'progress', part(b, 0, 0, b.width, 14), {value: watched.recorded});
    if (b.height > 20) text(ctx, `${watched.recording}, ${watched.at} OF ${watched.of} EXPECTED`, b.x, b.y + 22, DIM, {room: b.width});
  }},
  'site-run/sensors live': {paint(ctx, b) {
    SAMPLE.sensorsLive.forEach((sensor, i) => { if (i * 13 + 8 <= b.height) lampLine(ctx, b.x, b.y + i * 13, b.width, sensor.name, sensor.live ? sensor.rate : 'ON THE BENCH', sensor.live ? MINT : DIM); });
  }},
  'site-run/on the view': {data: false, paint(ctx, b, env) {
    const l = env.ui.layers;
    toggles(ctx, b, [['SIMULATOR VIEW', l.sim, v => { l.sim = v; }], ['LIVE VIEW', l.live, v => { l.live = v; }], ['TELEMETRY', l.telemetry, v => { l.telemetry = v; }]], env);
  }},
  'site-run/the run': {header: 'compact', paint(ctx, b) {
    el(ctx, 'transport', part(b, 0, 0, b.width, Math.min(22, b.height)), {at: watched.at, of: watched.of, share: watched.share, playing: true});
  }},

  // -------------------------------------------------------------------------------------- 5, review
  'site-review/recordings of this flight': {paint(ctx, b, env) {
    rows(ctx, b, SAMPLE.recordings.map(rec => ({title: rec.name, detail: `${ORIGIN_TAG[rec.origin]} ${rec.length}`, selected: rec.id === env.ui.recording})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => set(env, 'recording', SAMPLE.recordings[i].id)));
  }},
  'site-review/show': {data: false, paint(ctx, b, env) {
    const s = env.ui.show, half = Math.floor((b.width - 6) / 2);
    [['CLOUD', 'cloud'], ['SPLAT', 'splat'], ['FINDS', 'detections'], ['PATH', 'path']].forEach(([label, key], i) => {
      const box = part(b, (i % 2) * (half + 6), Math.floor(i / 2) * 26, i % 2 ? b.width - half - 6 : half, 22);
      if (box.y + box.height > b.y + b.height) return;
      el(ctx, 'checkbox', box, {label, value: s[key]});
      env.hit(box, () => { s[key] = !s[key]; return true; });
    });
  }},
  'site-review/topics': {paint(ctx, b, env) {
    recordingById(env.ui.recording).topics.forEach(([topic, rate], i) => { if (i * 13 + 8 <= b.height) { text(ctx, topic, b.x, b.y + i * 13, MINT, {upper: false, room: b.width - 50}); text(ctx, rate, b.x + b.width, b.y + i * 13, DIM, {align: 'right'}); } });
  }},
  'site-review/pipeline': {paint(ctx, b) {
    el(ctx, 'steps', part(b, 0, 0, b.width, 24), {items: SAMPLE.pipeline.map(job => ({label: job.stage, state: job.done >= 1 ? 'done' : 'now'}))});
  }},
  'site-review/the result': {paint(ctx, b, env) {
    const run = runById('r3'), view = SAMPLE.views.small;
    el(ctx, 'siteMap', b, {...siteState(env.ui, `${run.name} / ${ORIGIN_TAG[run.origin]} / FINDS IN RED`, {names: false}), ...view});
    if (!env.ui.show.detections) return;
    const finds = SAMPLE.findings.filter(find => find.case === 'c1');
    markFinds(ctx, b, view, finds, env.ui.finding).forEach(({find, box}) => env.hit(box, () => set(env, 'finding', find.id)));
  }},
  'site-review/picked': {paint(ctx, b, env) {
    const f = findingById(env.ui.finding);
    facts(ctx, b, [['FIND', f.type], ['WHERE', f.zone], ['SEVERITY', f.severity.toUpperCase(), f.severity === 'critical' ? RED : f.severity === 'major' ? AMBER : undefined], ['CONFIDENCE', f.confidence.toFixed(2)], ['TRUTH', f.truth]]);
  }},
  'site-review/this run, measured': {paint(ctx, b) {
    const scan = SAMPLE.scans.find(entry => entry.run === 'r3');
    facts(ctx, b, [['SEEN', `${pct(scan.seen)} (${pct(flight2.coverage.seen)} EXPECTED)`], ['VIEWS REGISTERED', pct(scan.registered)], ['FINDS', scan.findings], ['ORIGIN', ORIGIN_TAG[scan.origin]]]);
  }},
  'site-review/jobs': {paint(ctx, b) {
    SAMPLE.pipeline.forEach((job, i) => {
      if (i * 18 + 14 > b.height) return;
      text(ctx, job.stage, b.x, b.y + i * 18 + 3, DIM, {room: 56});
      el(ctx, 'progress', part(b, 60, i * 18, b.width - 60, 14), {value: job.done});
    });
  }},
  'site-review/export to the rtx 2080': {header: 'none', data: false, paint(ctx, b, env) { button(ctx, b, env.rect.label); }},
  'site-review/the recording': {header: 'compact', paint(ctx, b, env) {
    const head = SAMPLE.playheads.review;
    el(ctx, 'transport', part(b, 0, 0, b.width, Math.min(22, b.height)), {at: head.at, of: recordingById(env.ui.recording).length.padStart(5, '0'), share: head.share});
  }},

  // ------------------------------------------------------------------------------------- 6, compare
  'site-compare/which target': {data: false, paint(ctx, b) { el(ctx, 'select', part(b, 0, 0, b.width, 24), {value: small.name}); }},
  'site-compare/scans of this area': {paint(ctx, b, env) {
    rows(ctx, b, SAMPLE.scans.map(scan => ({title: `${scan.when} ${ORIGIN_TAG[scan.origin]}`, detail: scan.note, selected: scan.id === env.ui.scanA || scan.id === env.ui.scanB})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => {
        const id = SAMPLE.scans[i].id, order = x => SAMPLE.scans.findIndex(scan => scan.id === x);
        if (id === env.ui.scanA || id === env.ui.scanB) return false;
        // The newly picked scan takes the place of the older pick; the earlier of the two stays first.
        [env.ui.scanA, env.ui.scanB] = [env.ui.scanB, id].sort((x, y) => order(x) - order(y));
        return true;
      }));
  }},
  'site-compare/compare': {data: false, paint(ctx, b, env) {
    const a = SAMPLE.scans.find(scan => scan.id === env.ui.scanA), z = SAMPLE.scans.find(scan => scan.id === env.ui.scanB);
    facts(ctx, b, [['EARLIER', a.when], ['LATER', z.when]]);
  }},
  'site-compare/show': {data: false, paint(ctx, b, env) {
    choice(ctx, part(b, 0, 0, b.width, Math.min(24, b.height)), ['SIDE BY SIDE', 'WHAT DIFFERS'], env.ui.compareMode).forEach((box, i) => env.hit(box, () => set(env, 'compareMode', i)));
  }},
  'site-compare/two scans': {paint(ctx, b, env) {
    const half = Math.floor((b.width - 6) / 2), view = SAMPLE.views.small, base = {...siteState(env.ui, '', {names: false}), ...view};
    const a = SAMPLE.scans.find(scan => scan.id === env.ui.scanA), z = SAMPLE.scans.find(scan => scan.id === env.ui.scanB);
    const pole = SAMPLE.findings.find(find => find.type === 'NEW OBJECT'), shows = scan => scan.note.includes('POLE');
    if (env.ui.compareMode === 0) {
      const left = part(b, 0, 0, half, b.height), right = part(b, half + 6, 0, b.width - half - 6, b.height);
      el(ctx, 'siteMap', left, {...base, caption: `${a.when} / ${ORIGIN_TAG[a.origin]}`});
      el(ctx, 'siteMap', right, {...base, caption: `${z.when} / ${ORIGIN_TAG[z.origin]}`});
      if (shows(a)) markFinds(ctx, left, view, [pole], pole.id);
      if (shows(z)) markFinds(ctx, right, view, [pole], pole.id);
    } else {
      const differs = shows(a) !== shows(z);
      el(ctx, 'siteMap', b, {...base, caption: differs ? 'WHAT DIFFERS: 1 NEW OBJECT' : 'WHAT DIFFERS: NOTHING'});
      if (differs) markFinds(ctx, b, view, [pole], pole.id);
    }
  }},
  'site-compare/what changed': {paint(ctx, b) {
    rows(ctx, b, SAMPLE.changes.rows, {pitch: 20});
    const below = SAMPLE.changes.rows.length * 20 + 6;
    if (b.height > below + 10) words(ctx, SAMPLE.changes.note, part(b, 0, below, b.width, b.height - below), DIM);
  }},
  'site-compare/expected, simulated, flown': {paint(ctx, b) {
    const sim = SAMPLE.scans.find(scan => scan.run === 'r3'), flown = SAMPLE.scans.find(scan => scan.origin === 'real');
    const columns = [{title: '', share: 2.2}, {title: 'EXP', share: 1, align: 'right'}, {title: 'SIM', share: 1, align: 'right'}, {title: 'FLOWN', share: 1.2, align: 'right'}];
    table(ctx, b, columns, [
      ['SEEN', pct(flight2.coverage.seen), pct(sim.seen), flown ? pct(flown.seen) : '--'],
      ['THREE TIMES', pct(flight2.coverage.three), pct(sim.three), flown ? pct(flown.three) : '--'],
      ['TIME', flight2.missions[0].time, runById(sim.run).time, '--'],
    ]);
    if (b.height > 80 && !flown) text(ctx, 'NOTHING FLOWN FOR REAL YET', b.x, b.y + b.height - 9, AMBER, {room: b.width});
  }},
  'site-compare/scans over time': {header: 'compact', paint(ctx, b) {
    chart(ctx, b, {type: 'sparkline', data: SAMPLE.scans.map(scan => ({label: scan.when.slice(5), value: Math.round(scan.seen * 100)})), unit: '%', max: 100});
  }},
};

export default STEPS;

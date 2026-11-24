// The tabs of the work the chain produces: Assets, Cases, Calendar, Analyze and Home. They read the
// sample records only, so one asset, case or run reads the same on every page. The Ops v2 records
// (regime, disposition, parts, sign-off) have marked places and come later.
import {SAMPLE, assetById, caseById, findingById, recordingById, runById, flightById} from '../designer-records.js';
import {NODES, MODULES, STATES} from '../designer-architecture.js';
import {siteState} from './site.js';
import {markFinds} from './steps.js';
import {el, text, fill, outline, hline, vline, facts, rows, table, chart, words, part, choice, lampLine, textWidth, ORIGIN_TAG, MINT, DIM, INK, PANEL, AMBER, RED} from './kit.js';

const pct = share => `${Math.round(share * 100)} %`;
const SEVERITY = {critical: 'fail', major: 'warn', minor: 'ok'};
const STATE_COLOUR = {planned: DIM, active: MINT, completed: MINT, cancelled: AMBER};
const KINDS = [['ALL', () => true], ['PLANES', a => a.kind === 'plane'], ['TANKS', a => a.kind === 'tank'], ['SITES', a => a.kind === 'site']];
const CASE_FILTERS = [['ALL', () => true], ['IN REVIEW', c => c.state === 'IN REVIEW'], ['DECIDED', c => c.state === 'DECIDED']];
const assetsShown = ui => SAMPLE.assets.filter(KINDS[ui.assetKind][1]);
const casesShown = ui => SAMPLE.cases.filter(CASE_FILTERS[ui.caseFilter][1]);
const kindWord = asset => asset.kind === 'site' ? 'BUILDING' : asset.kind.toUpperCase();
const centreOf = ring => ({x: ring.reduce((s, p) => s + p.x, 0) / ring.length, y: ring.reduce((s, p) => s + p.y, 0) / ring.length});
const byTime = (a, z) => `${a.day} ${a.time}`.localeCompare(`${z.day} ${z.time}`);

// --------------------------------------------------------------------------------------- calendar time
const DAY_MS = 86400000, WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const dayValue = s => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10)));
const dayString = value => new Date(value).toISOString().slice(0, 10);
const hourOf = time => Number(time.slice(0, 2)) + Number(time.slice(3, 5)) / 60;
const FIRST_HOUR = 8, LAST_HOUR = 18;

/** An event as a block on the grid; gives back its box. */
function eventBlock(ctx, box, event, picked) {
  const colour = STATE_COLOUR[event.state];
  if (event.state === 'active') fill(ctx, box.x, box.y, box.width, box.height, MINT);
  else fill(ctx, box.x, box.y, box.width, box.height, PANEL);
  if (event.state === 'planned') { hline(ctx, box.x, box.y, box.width, colour, true); hline(ctx, box.x, box.y + box.height - 1, box.width, colour, true); vline(ctx, box.x, box.y, box.height, colour, true); vline(ctx, box.x + box.width - 1, box.y, box.height, colour, true); }
  else outline(ctx, box.x, box.y, box.width, box.height, colour);
  if (picked) outline(ctx, box.x - 2, box.y - 2, box.width + 4, box.height + 4, MINT);
  const ink = event.state === 'active' ? INK : event.state === 'cancelled' ? AMBER : MINT;
  text(ctx, event.time, box.x + 3, box.y + 3, ink, {room: box.width - 6});
  if (box.height >= 20) text(ctx, event.title, box.x + 3, box.y + 12, ink, {room: box.width - 6});
}

/** The week round today: seven columns, the working hours down, each event at its time. */
function paintWeek(ctx, b, env) {
  const today = dayValue(SAMPLE.today), start = today - new Date(today).getUTCDay() * DAY_MS, gutter = 30;
  // The last hour's line sits a block's height above the legend, so an event at that hour still fits.
  const column = Math.floor((b.width - gutter) / 7), top = b.y + 16, height = b.height - 16 - 24 - 22;
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 2) {
    const y = top + Math.round((hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR) * height);
    text(ctx, `${String(hour).padStart(2, '0')}`, b.x, y - 3, DIM);
    hline(ctx, b.x + gutter, y, column * 7, DIM, true);
  }
  for (let i = 0; i < 7; i += 1) {
    const day = dayString(start + i * DAY_MS), x = b.x + gutter + i * column, isToday = day === SAMPLE.today;
    if (isToday) fill(ctx, x, b.y, column - 2, 12, MINT);
    text(ctx, `${WEEKDAYS[i]} ${day.slice(8)}`, x + 3, b.y + 3, isToday ? INK : MINT, {room: column - 6});
    for (const event of SAMPLE.events.filter(entry => entry.day === day)) {
      const y = top + Math.round((Math.min(LAST_HOUR, Math.max(FIRST_HOUR, hourOf(event.time))) - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR) * height);
      const box = {x: x + 1, y, width: column - 4, height: 22};
      eventBlock(ctx, box, event, event.id === env.ui.event);
      env.hit(box, () => { if (env.ui.event === event.id) return false; env.ui.event = event.id; return true; });
    }
  }
}

/** The month of today: a cell a day, the day's events named in it. */
function paintMonth(ctx, b, env) {
  const today = dayValue(SAMPLE.today), date = new Date(today), first = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  const days = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate(), offset = new Date(first).getUTCDay();
  const lines = Math.ceil((offset + days) / 7), column = Math.floor(b.width / 7), cell = Math.floor((b.height - 16) / lines);
  WEEKDAYS.forEach((name, i) => text(ctx, name, b.x + i * column + 3, b.y + 3, DIM));
  for (let n = 1; n <= days; n += 1) {
    const slot = offset + n - 1, x = b.x + (slot % 7) * column, y = b.y + 16 + Math.floor(slot / 7) * cell, day = dayString(first + (n - 1) * DAY_MS);
    const box = {x, y, width: column - 2, height: cell - 2}, list = SAMPLE.events.filter(entry => entry.day === day).sort(byTime);
    outline(ctx, box.x, box.y, box.width, box.height, day === SAMPLE.today ? MINT : DIM);
    text(ctx, String(n), box.x + 3, box.y + 3, day === SAMPLE.today ? MINT : DIM);
    list.slice(0, Math.max(0, Math.floor((box.height - 14) / 10))).forEach((event, i) => {
      fill(ctx, box.x + 3, box.y + 15 + i * 10, 4, 4, STATE_COLOUR[event.state]);
      text(ctx, event.title, box.x + 10, box.y + 13 + i * 10, event.id === env.ui.event ? MINT : DIM, {room: box.width - 13});
    });
    if (list.length) env.hit(box, () => { if (list.some(event => event.id === env.ui.event)) { env.ui.event = list[(list.findIndex(event => event.id === env.ui.event) + 1) % list.length].id; return list.length > 1; } env.ui.event = list[0].id; return true; });
  }
}

/** Today alone: the working hours down, each event at its time across the width. */
function paintDay(ctx, b, env) {
  const gutter = 30, height = b.height - 24 - 22, list = SAMPLE.events.filter(entry => entry.day === SAMPLE.today).sort(byTime);
  for (let hour = FIRST_HOUR; hour <= LAST_HOUR; hour += 1) {
    const y = b.y + Math.round((hour - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR) * height);
    text(ctx, `${String(hour).padStart(2, '0')}`, b.x, y - 3, DIM);
    hline(ctx, b.x + gutter, y, b.width - gutter, DIM, true);
  }
  for (const event of list) {
    const y = b.y + Math.round((hourOf(event.time) - FIRST_HOUR) / (LAST_HOUR - FIRST_HOUR) * height), box = {x: b.x + gutter + 4, y, width: b.width - gutter - 8, height: 22};
    eventBlock(ctx, box, event, event.id === env.ui.event);
    env.hit(box, () => { if (env.ui.event === event.id) return false; env.ui.event = event.id; return true; });
  }
}

// --------------------------------------------------------------------------------------- analyze
/** What each chart of Analyze shows: its unit, its range and how far it can be trusted. */
const METRICS = [
  {name: 'COVERAGE OVER SCANS', unit: 'SHARE OF THE TARGET SURFACE SEEN, AND SEEN THREE TIMES', values: () => SAMPLE.scans.map(scan => `${scan.when}: ${pct(scan.seen)}, ${pct(scan.three)}`)},
  {name: 'FINDINGS OVER SCANS', unit: 'FINDS IN A SCAN, ALL SEVERITIES', values: () => SAMPLE.scans.map(scan => `${scan.when}: ${scan.findings}`)},
  {name: 'EXPECTED, SIMULATED, FLOWN', unit: 'SHARE SEEN AND TIME, FROM THE PLAN, A SIMULATED RUN AND A REAL ONE', values: () => [`EXPECTED: ${pct(flightById('f2').coverage.seen)}`, `SIMULATED: ${pct(SAMPLE.scans.find(scan => scan.run === 'r3').seen)}`, 'FLOWN: NONE YET']},
  {name: 'RUNS', unit: 'OUTCOME AND TIME OF EACH RUN OF FLIGHT 2', values: () => SAMPLE.runs.map(run => `${run.name}: ${run.outcome}, ${run.time}`)},
  {name: 'MODELS', unit: 'MAP50 ON THE HELD-OUT SET OF EACH MODEL, 0 TO 1', values: () => SAMPLE.models.map(model => `${model.name}: ${model.score.toFixed(2)}`)},
  {name: 'PIPELINE TIMING', unit: 'MINUTES A STAGE TOOK ON RUN 3, AGAINST ITS TARGET', values: () => SAMPLE.pipeline.map(job => `${job.stage}: ${job.minutes} OF ${job.target} MIN`)},
];
const pickMetric = (env, index) => () => { if (env.ui.analyzeMetric === index) return false; env.ui.analyzeMetric = index; return true; };
const metricFrame = (ctx, b, env, index) => { if (env.ui.analyzeMetric === index) outline(ctx, b.x - 4, b.y - 4, b.width + 8, b.height + 8, MINT); env.hit(b, pickMetric(env, index)); };

export default {
  // ---------------------------------------------------------------------------------------- Assets
  'assets/planes, tanks, sites': {header: 'none', data: false, paint(ctx, b, env) {
    choice(ctx, b, KINDS.map(([name]) => name), env.ui.assetKind).forEach((box, i) => env.hit(box, () => {
      if (env.ui.assetKind === i) return false;
      env.ui.assetKind = i;
      const shown = assetsShown(env.ui);
      if (shown.length && !shown.some(asset => asset.id === env.ui.asset)) env.ui.asset = shown[0].id;
      return true;
    }));
  }},
  'assets/asset list': {paint(ctx, b, env) {
    const shown = assetsShown(env.ui), columns = [{title: 'ASSET', share: 3}, {title: 'KIND', share: 1.6}, {title: 'SCANS', share: 1, align: 'right'}, {title: 'CASES', share: 1, align: 'right'}];
    table(ctx, b, columns, shown.map(asset => [asset.name, kindWord(asset), String(asset.scans), String(asset.cases)]), {selected: shown.findIndex(asset => asset.id === env.ui.asset)})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.asset === shown[i].id) return false; env.ui.asset = shown[i].id; return true; }));
  }},
  'assets/the asset model': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset);
    if (!asset.outline) { words(ctx, `NO SHAPE YET. ${asset.frame}. ITS MODEL COMES FROM ITS FIRST SCAN`, b, DIM); return; }
    const xs = asset.outline.map(p => p.x), ys = asset.outline.map(p => p.y), extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const scanned = SAMPLE.scans.filter(scan => scan.recording && asset.id === 'a-small');
    el(ctx, 'siteMap', b, {...siteState(env.ui, `${asset.name} / ${scanned.length ? `${scanned.length} SCANS, SIM` : 'OUTLINE ONLY, NO MESH'}`, {names: false}), centre: centreOf(asset.outline), across_m: Math.max(30, extent * 2.2)});
  }},
  'assets/asset record': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset);
    const used = facts(ctx, b, [['ASSET', asset.name], ['KIND', kindWord(asset)], ['IS', asset.mobility], ['SITE', asset.site ? SAMPLE.site.name : '--'], ['OUTLINE', asset.osm ? 'OPENSTREETMAP' : 'NONE'], ['SCANS', asset.scans], ['OPEN CASES', asset.cases]], {pitch: 15});
    if (b.height > used + 12) words(ctx, asset.heights, part(b, 0, used + 4, b.width, b.height - used - 4), asset.heights.includes('GUESS') ? AMBER : DIM);
  }},
  'assets/scans over time': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset);
    if (!asset.scans) { words(ctx, `${asset.name} IS NOT SCANNED YET`, b, DIM); return; }
    chart(ctx, b, {type: 'line', data: SAMPLE.scans.map(scan => ({label: scan.when.slice(5), value: Math.round(scan.seen * 100)})), unit: '%', max: 100});
  }},
  'assets/open cases': {paint(ctx, b, env) {
    const list = SAMPLE.cases.filter(entry => entry.asset === env.ui.asset);
    if (!list.length) { words(ctx, 'NO CASES', b, DIM); return; }
    rows(ctx, b, list.map(entry => ({title: entry.name, detail: entry.state, level: entry.state === 'DECIDED' ? 'ok' : 'warn'})), {pitch: 18})
      .forEach((row, i) => env.hit(row, () => { env.ui.case = list[i].id; env.ui.finding = list[i].findings[0]; return {navigate: 'cases'}; }));
  }},
  'assets/regime': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset);
    text(ctx, asset.regime ?? 'NONE YET', b.x, b.y, asset.regime ? MINT : DIM, {room: b.width});
    words(ctx, 'OPS V2 ATTACHES HERE: THE REGIME SETS THE CHECKS, THE PARTS AND WHO SIGNS', part(b, 0, 14, b.width, b.height - 14), AMBER);
  }},
  'assets/identity and frame': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset);
    const named = words(ctx, asset.full, part(b, 0, 0, b.width, 20), MINT) + 4;
    const used = named + facts(ctx, part(b, 0, named, b.width, b.height - named), [['FRAME', asset.frame], ['OSM', asset.osm ?? '--']], {pitch: 15});
    if (b.height > used + 12) words(ctx, 'A FIXED ASSET IS PLACED BY THE FRAME OF ITS SITE. A MOVABLE ONE CARRIES ITS OWN: ITS EVIDENCE NEVER LEANS ON GPS', part(b, 0, used + 4, b.width, b.height - used - 4), DIM);
  }},

  // ----------------------------------------------------------------------------------------- Cases
  'cases/filters': {header: 'none', data: false, paint(ctx, b, env) {
    choice(ctx, b, CASE_FILTERS.map(([name]) => name), env.ui.caseFilter).forEach((box, i) => env.hit(box, () => {
      if (env.ui.caseFilter === i) return false;
      env.ui.caseFilter = i;
      const shown = casesShown(env.ui);
      if (shown.length && !shown.some(entry => entry.id === env.ui.case)) { env.ui.case = shown[0].id; env.ui.finding = shown[0].findings[0]; }
      return true;
    }));
  }},
  'cases/case queue': {paint(ctx, b, env) {
    const shown = casesShown(env.ui), columns = [{title: 'CASE', share: 1.4}, {title: 'STATE', share: 1.8}, {title: 'OWNER', share: 1.8}];
    table(ctx, b, columns, shown.map(entry => [entry.name, entry.state, entry.owner]), {selected: shown.findIndex(entry => entry.id === env.ui.case)})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.case === shown[i].id) return false; env.ui.case = shown[i].id; env.ui.finding = shown[i].findings[0]; return true; }));
  }},
  'cases/findings': {paint(ctx, b, env) {
    const list = caseById(env.ui.case).findings.map(findingById);
    rows(ctx, b, list.map(find => ({title: find.type, detail: find.severity.toUpperCase(), level: SEVERITY[find.severity], selected: find.id === env.ui.finding})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.finding === list[i].id) return false; env.ui.finding = list[i].id; return true; }));
  }},
  'cases/evidence': {paint(ctx, b, env) {
    // Close enough that the case's finds stand apart: twice the farthest of them from the building's centre.
    const entry = caseById(env.ui.case), asset = assetById(entry.asset), finds = entry.findings.map(findingById);
    const view = {centre: SAMPLE.views.small.centre, across_m: Math.max(24, 2.6 * Math.max(...finds.map(find => Math.hypot(find.at.x, find.at.y))) + 12)};
    el(ctx, 'siteMap', b, {...siteState(env.ui, `${entry.name} / ${asset.name} / ${ORIGIN_TAG[entry.evidence.origin]}`, {names: false}), ...view});
    markFinds(ctx, b, view, finds, env.ui.finding).forEach(({find, box}) => env.hit(box, () => { if (env.ui.finding === find.id) return false; env.ui.finding = find.id; return true; }));
  }},
  'cases/frames': {paint(ctx, b, env) {
    const find = findingById(env.ui.finding), entry = caseById(env.ui.case);
    el(ctx, 'picture', b, {name: `FRAME ${find.frame}: ${find.type}`, origin: entry.evidence.origin, size: find.modality, rate: recordingById(entry.evidence.recording).name, kind: 'still'});
  }},
  'cases/case details': {paint(ctx, b, env) {
    const entry = caseById(env.ui.case);
    facts(ctx, b, [['CASE', entry.name], ['ASSET', assetById(entry.asset).name], ['STATE', entry.state, entry.state === 'DECIDED' ? MINT : AMBER], ['OWNER', entry.owner], ['OPENED', entry.opened]], {pitch: 16});
  }},
  'cases/decision': {paint(ctx, b, env) {
    const entry = caseById(env.ui.case), local = env.ui.decision?.case === entry.id ? env.ui.decision : null;
    if (entry.decision) { facts(ctx, b, [['DECIDED', entry.decision.what], ['WHO', entry.decision.who], ['WHEN', entry.decision.when], ['ON', entry.decision.on]], {pitch: 16}); return; }
    const third = Math.floor((b.width - 8) / 3);
    ['APPROVE', 'FOLLOW UP', 'DISMISS'].forEach((label, i) => {
      const box = part(b, i * (third + 4), 0, third, 24);
      el(ctx, 'button', box, {label, held: local?.what === label});
      env.hit(box, () => { env.ui.decision = {case: entry.id, what: label}; return true; });
    });
    words(ctx, local ? `${local.what}: PREVIEW ONLY. KEPT WITH WHO, WHEN AND ON WHICH EVIDENCE` : 'A DECISION IS KEPT WITH WHO MADE IT, WHEN, AND ON WHICH EVIDENCE', part(b, 0, 32, b.width, b.height - 32), local ? AMBER : DIM);
  }},
  'cases/action history': {paint(ctx, b, env) {
    caseById(env.ui.case).history.forEach(([time, said], i) => { if ((i + 1) * 16 <= b.height + 2) el(ctx, 'textline', part(b, 0, i * 16, b.width, 14), {time, text: said}); });
  }},
  'cases/evidence trail': {paint(ctx, b, env) {
    const e = caseById(env.ui.case).evidence;
    facts(ctx, b, [['RECORDING', recordingById(e.recording).name], ['PIPELINE', e.pipeline], ['MODEL', e.model], ['ORIGIN', ORIGIN_TAG[e.origin]]], {pitch: 16});
  }},
  'cases/disposition, parts, sign-off': {data: false, paint(ctx, b) {
    words(ctx, 'OPS V2 ATTACHES HERE: THE DISPOSITION OF A CASE, THE PARTS IT NEEDS AND ITS SIGN-OFF, AS ITS REGIME ASKS. NOT IN THIS OUTLINE', b, AMBER);
  }},

  // -------------------------------------------------------------------------------------- Calendar
  'calendar/scope': {header: 'none', data: false, paint(ctx, b, env) {
    const width = Math.min(240, Math.floor(b.width / 2));
    choice(ctx, part(b, 0, 0, width, b.height), ['MONTH', 'WEEK', 'DAY'], env.ui.calendarScope).forEach((box, i) => env.hit(box, () => { if (env.ui.calendarScope === i) return false; env.ui.calendarScope = i; return true; }));
    text(ctx, `${SAMPLE.timeZone} / TODAY ${SAMPLE.today}`, b.x + b.width - 4, b.y + Math.floor((b.height - 7) / 2), DIM, {align: 'right', room: b.width - width - 12});
  }},
  'calendar/the grid': {paint(ctx, b, env) {
    [paintMonth, paintWeek, paintDay][env.ui.calendarScope](ctx, b, env);
    const legend = Object.entries(STATE_COLOUR), step = Math.floor(b.width / legend.length);
    legend.forEach(([state, colour], i) => { fill(ctx, b.x + i * step, b.y + b.height - 8, 5, 5, colour); text(ctx, state.toUpperCase(), b.x + i * step + 9, b.y + b.height - 9, colour, {room: step - 12}); });
  }},
  'calendar/upcoming': {paint(ctx, b, env) {
    const list = SAMPLE.events.filter(event => event.state === 'planned' || event.state === 'active').sort(byTime);
    rows(ctx, b, list.map(event => ({title: `${event.day.slice(5)} ${event.time} ${event.title}`, detail: event.who, level: event.state === 'active' ? 'ok' : 'off', selected: event.id === env.ui.event})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.event === list[i].id) return false; env.ui.event = list[i].id; return true; }));
  }},
  'calendar/gates before a flight': {paint(ctx, b) {
    const event = SAMPLE.events.find(entry => entry.gates);
    text(ctx, event.title, b.x, b.y, MINT, {room: b.width});
    event.gates.forEach((gate, i) => lampLine(ctx, b.x, b.y + 16 + i * 14, b.width, gate.says, gate.state === 'done' ? 'DONE' : gate.state === 'now' ? 'NOW' : '', gate.state === 'done' ? MINT : gate.state === 'now' ? AMBER : DIM));
    const top = 16 + event.gates.length * 14 + 8;
    words(ctx, 'A FLIGHT STAYS PLANNED UNTIL EVERY GATE IS PASSED', part(b, 0, top, b.width, b.height - top), DIM);
  }},
  'calendar/event details': {paint(ctx, b, env) {
    const event = SAMPLE.events.find(entry => entry.id === env.ui.event), asset = event.asset ? assetById(event.asset) : null;
    let y = words(ctx, event.title, part(b, 0, 0, b.width, 30), MINT) + 6;
    y += facts(ctx, part(b, 0, y, b.width, b.height - y), [['WHEN', `${event.day} ${event.time}`], ['TIME ZONE', SAMPLE.timeZone], ['KIND', event.kind.toUpperCase()], ['ASSIGNED TO', event.who], ['ASSET', asset ? asset.name : '--']], {pitch: 16}) + 8;
    Object.entries(STATE_COLOUR).forEach(([state, colour], i) => {
      const here = state === event.state, at = part(b, 0, y + i * 16, b.width, 14);
      if (here) fill(ctx, at.x, at.y, at.width, at.height, colour);
      text(ctx, state.toUpperCase(), at.x + 6, at.y + 4, here ? INK : DIM, {room: at.width - 12});
    });
    y += 4 * 16 + 8;
    if (event.why) y += words(ctx, `WHY: ${event.why}`, part(b, 0, y, b.width, 40), AMBER) + 6;
    if (event.gates) event.gates.forEach((gate, i) => lampLine(ctx, b.x, b.y + y + i * 14, b.width, gate.says, '', gate.state === 'done' ? MINT : gate.state === 'now' ? AMBER : DIM));
  }},

  // --------------------------------------------------------------------------------------- Analyze
  'analyze/scope': {header: 'none', paint(ctx, b) {
    const first = SAMPLE.scans[0].when, last = SAMPLE.scans[SAMPLE.scans.length - 1].when, origins = [...new Set(SAMPLE.scans.map(scan => ORIGIN_TAG[scan.origin]))].join(', ');
    fill(ctx, b.x, b.y, b.width, b.height, PANEL);
    text(ctx, `SITE ${SAMPLE.site.name} / ASSET ${assetById('a-small').name} / ${first} TO ${last} / ORIGIN ${origins} / SAMPLE`, b.x + 6, b.y + Math.floor((b.height - 7) / 2), MINT, {room: b.width - 12});
  }},
  'analyze/coverage over scans': {paint(ctx, b, env) {
    chart(ctx, b, {type: 'line', data: SAMPLE.scans.map(scan => ({label: scan.when.slice(5), value: Math.round(scan.seen * 100)})), series: [{label: 'THREE TIMES', values: SAMPLE.scans.map(scan => Math.round(scan.three * 100))}], unit: '%', max: 100});
    metricFrame(ctx, b, env, 0);
  }},
  'analyze/findings over scans': {paint(ctx, b, env) {
    chart(ctx, b, {type: 'bar', data: SAMPLE.scans.map(scan => ({label: scan.when.slice(5), value: scan.findings})), unit: 'FINDS'});
    metricFrame(ctx, b, env, 1);
  }},
  'analyze/expected, simulated, flown': {paint(ctx, b, env) {
    const flight = flightById('f2'), sim = SAMPLE.scans.find(scan => scan.run === 'r3');
    const columns = [{title: '', share: 2}, {title: 'EXP', share: 1, align: 'right'}, {title: 'SIM', share: 1, align: 'right'}, {title: 'FLOWN', share: 1.2, align: 'right'}];
    table(ctx, b, columns, [['SEEN', pct(flight.coverage.seen), pct(sim.seen), '--'], ['THREE TIMES', pct(flight.coverage.three), pct(sim.three), '--'], ['TIME', flight.missions[0].time, runById(sim.run).time, '--']]);
    metricFrame(ctx, b, env, 2);
  }},
  'analyze/runs': {paint(ctx, b, env) {
    const columns = [{title: 'RUN', share: 1}, {title: 'ORIGIN', share: 1.2}, {title: 'OUTCOME', share: 1.8}, {title: 'TIME', share: 1, align: 'right'}];
    table(ctx, b, columns, SAMPLE.runs.map(run => [run.name, ORIGIN_TAG[run.origin], run.outcome, run.time]));
    metricFrame(ctx, b, env, 3);
  }},
  'analyze/models': {paint(ctx, b, env) {
    chart(ctx, b, {type: 'bar', data: SAMPLE.models.map(model => ({label: model.short, value: model.score})), max: 1, unit: 'MAP50'});
    metricFrame(ctx, b, env, 4);
  }},
  'analyze/pipeline timing': {paint(ctx, b, env) {
    const each = Math.floor(b.height / SAMPLE.pipeline.length);
    SAMPLE.pipeline.forEach((job, i) => {
      text(ctx, `${job.stage} ${job.minutes} OF ${job.target} MIN`, b.x, b.y + i * each, job.minutes > job.target ? AMBER : DIM, {room: b.width});
      chart(ctx, part(b, 0, i * each + 8, b.width, each - 8), {type: 'bullet', value: job.minutes, max: Math.max(job.minutes, job.target) * 1.2, target: job.target, showLabels: false});
    });
    metricFrame(ctx, b, env, 5);
  }},
  'analyze/analysis details': {paint(ctx, b, env) {
    const metric = METRICS[env.ui.analyzeMetric], scans = SAMPLE.scans, sims = scans.filter(scan => scan.origin === 'sim').length;
    let y = words(ctx, metric.name, part(b, 0, 0, b.width, 20), MINT) + 6;
    y += facts(ctx, part(b, 0, y, b.width, 80), [['DATES', `${scans[0].when} TO ${scans[scans.length - 1].when}`], ['COVERAGE', `${scans.length} SCANS OF 1 ASSET`], ['ORIGIN', `${sims} SIM, ${scans.length - sims} REAL`]], {pitch: 16}) + 6;
    text(ctx, 'UNIT', b.x, b.y + y, DIM); y += 12;
    y += words(ctx, metric.unit, part(b, 0, y, b.width, 40), MINT) + 6;
    text(ctx, 'UNCERTAINTY', b.x, b.y + y, DIM); y += 12;
    y += words(ctx, `ONE SCAN A DAY, NONE REPEATED, ALL SIMULATED: NO SPREAD CAN BE GIVEN YET. EVERY FIGURE HERE IS A SAMPLE`, part(b, 0, y, b.width, 60), AMBER) + 8;
    text(ctx, 'VALUES', b.x, b.y + y, DIM); y += 12;
    for (const line of metric.values()) { if (y + 8 > b.height) break; text(ctx, line, b.x, b.y + y, MINT, {room: b.width}); y += 11; }
    const next = part(b, 0, b.height - 24, b.width, 24);
    if (next.y > b.y + y) { el(ctx, 'button', next, {label: 'NEXT CHART'}); env.hit(next, () => { env.ui.analyzeMetric = (env.ui.analyzeMetric + 1) % METRICS.length; return true; }); }
  }},

  // ------------------------------------------------------------------------------------------ Home
  'home/sites and devices': {paint(ctx, b, env) {
    const devices = NODES.filter(node => node.kind === 'device'), strip = Math.ceil(devices.length / 2) * 13 + 8;
    el(ctx, 'siteMap', part(b, 0, 0, b.width, b.height - strip), siteState(env.ui, `1 SITE: ${SAMPLE.site.name} / SAMPLE`));
    const half = Math.floor((b.width - 8) / 2);
    devices.forEach((node, i) => lampLine(ctx, b.x + (i % 2) * (half + 8), b.y + b.height - strip + 8 + Math.floor(i / 2) * 13, half, node.name, STATES[node.state].label, node.state === 'running' ? MINT : node.state === 'designed' ? AMBER : DIM));
  }},
  'home/my assigned work': {paint(ctx, b, env) {
    const list = SAMPLE.events.filter(event => event.who === 'OPERATOR A' && event.state === 'planned').sort(byTime);
    text(ctx, 'OPERATOR A', b.x, b.y, DIM, {room: b.width});
    rows(ctx, part(b, 0, 12, b.width, b.height - 12), list.map(event => ({title: event.title, detail: event.day === SAMPLE.today ? event.time : event.day.slice(5), level: 'off'})), {pitch: 18})
      .forEach((row, i) => env.hit(row, () => { env.ui.event = list[i].id; return {navigate: 'calendar'}; }));
  }},
  'home/needs attention': {paint(ctx, b, env) {
    const list = [
      ...SAMPLE.flights.filter(flight => flight.state === 'REFUSED').map(flight => ({title: `${flight.name} REFUSED`, detail: 'FENCE', level: 'fail', go: 'site-preview', pick: () => { env.ui.flight = flight.id; }})),
      ...SAMPLE.findings.filter(find => find.severity === 'critical' && caseById(find.case).state !== 'DECIDED').map(find => ({title: `CRITICAL: ${find.type}`, detail: caseById(find.case).name, level: 'fail', go: 'cases', pick: () => { env.ui.case = find.case; env.ui.finding = find.id; }})),
      ...SAMPLE.deploys.filter(entry => entry.holds.includes('WAITING')).map(entry => ({title: 'DEPLOY HELD', detail: entry.cluster, level: 'warn', go: 'system-activity', pick: () => {}})),
      ...SAMPLE.assets.filter(asset => asset.heights.includes('GUESS')).map(asset => ({title: 'ROOF GUESSED', detail: asset.name.replace(/^BUILDING /, ''), level: 'warn', go: 'site-find', pick: () => { env.ui.asset = asset.id; }})),
    ];
    rows(ctx, b, list, {pitch: 18}).forEach((row, i) => env.hit(row, () => { list[i].pick(); return {navigate: list[i].go}; }));
  }},
  'home/today': {paint(ctx, b, env) {
    const list = SAMPLE.events.filter(event => event.day === SAMPLE.today).sort(byTime);
    list.forEach((event, i) => {
      if ((i + 1) * 16 > b.height + 2) return;
      const at = part(b, 0, i * 16, b.width, 14);
      el(ctx, 'textline', at, {time: event.time, text: `${event.title} / ${event.who} / ${event.state.toUpperCase()}`});
      env.hit(at, () => { env.ui.event = event.id; return {navigate: 'calendar'}; });
    });
  }},
  'home/flights under way': {paint(ctx, b) {
    const flying = SAMPLE.events.filter(event => event.kind === 'flight' && event.state === 'active'), jobs = SAMPLE.events.filter(event => event.kind === 'job' && event.state === 'active');
    const next = SAMPLE.events.filter(event => event.kind === 'flight' && event.state === 'planned').sort(byTime)[0];
    let y = 0;
    text(ctx, flying.length ? `${flying.length} IN THE AIR` : `NOTHING IN THE AIR AT ${SAMPLE.now.time}`, b.x, b.y, flying.length ? MINT : DIM, {room: b.width}); y += 16;
    if (next) { const open = (next.gates ?? []).filter(gate => gate.state !== 'done').length; y += words(ctx, `NEXT: ${next.title} AT ${next.time}; ${open} GATE${open === 1 ? '' : 'S'} TO PASS`, part(b, 0, y, b.width, 30), AMBER) + 6; }
    for (const job of jobs) { if (y + 8 > b.height) break; lampLine(ctx, b.x, b.y + y, b.width, `UNDER WAY: ${job.title}`, job.who, MINT); y += 13; }
  }},
  'home/cases to decide': {paint(ctx, b, env) {
    const list = SAMPLE.cases.filter(entry => !entry.decision);
    if (!list.length) { words(ctx, 'NOTHING TO DECIDE', b, DIM); return; }
    rows(ctx, b, list.map(entry => ({title: `${entry.name}: ${entry.findings.length} FINDS`, detail: entry.owner, level: entry.findings.some(id => findingById(id).severity === 'critical') ? 'fail' : 'warn'})), {pitch: 18})
      .forEach((row, i) => env.hit(row, () => { env.ui.case = list[i].id; env.ui.finding = list[i].findings[0]; return {navigate: 'cases'}; }));
  }},
  'home/activity': {paint(ctx, b) {
    const list = [...SAMPLE.activity].reverse();
    list.forEach((entry, i) => { if ((i + 1) * 16 <= b.height + 2) el(ctx, 'textline', part(b, 0, i * 16, b.width, 14), {time: entry.time, text: entry.text}); });
  }},
  'home/notes': {paint(ctx, b) {
    const list = [...SAMPLE.notes].sort((a, z) => z.when.localeCompare(a.when));
    let y = 0;
    for (const note of list) {
      if (y + 8 > b.height) break;
      text(ctx, `${note.when.slice(11)} ${note.who}`, b.x, b.y + y, DIM, {room: b.width}); y += 10;
      y += words(ctx, note.text, part(b, 0, y, b.width, b.height - y), MINT) + 4;
    }
  }},
  'home/system state': {data: 'SAMPLE', paint(ctx, b) {
    const ids = Object.keys(STATES), colour = {running: MINT, built: MINT, designed: AMBER, named: DIM, planned: DIM};
    const half = Math.floor((b.width - 12) / 2);
    ids.forEach((id, i) => {
      const nodes = NODES.filter(node => node.state === id && node.kind !== 'person').length, modules = MODULES.filter(module => module.state === id).length;
      lampLine(ctx, b.x, b.y + i * 12, half, STATES[id].label, `${nodes} PARTS, ${modules} MODULES`, colour[id]);
    });
    words(ctx, 'SYNTHETIC STATUSES FOR VISUAL REVIEW. NO HARDWARE, DEPLOYMENT OR LIVE TELEMETRY IS CONNECTED', part(b, half + 12, 0, b.width - half - 12, b.height), DIM);
  }},
};

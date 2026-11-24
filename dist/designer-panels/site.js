// The Site tab: the owner's eleven boxes, drawn from the sample records (designer-records.js) as the
// atlas adapter. The site from above with its assets, the device's telemetry with the age of each
// value, and the picked asset. The step chain under them is shared.js.
import {siteMap, footprintMark, viewTransform} from '../sandbox-ui/src/paint/map.js';
import {SAMPLE, assetById, flightById, runById} from '../designer-records.js';
import {next} from './state.js';
import {el, text, fill, facts, rows, words, part, tag, button, ORIGIN_TAG, MINT, DIM, AMBER, PANEL} from './kit.js';

const view = SAMPLE.views.site;
const siteAssets = () => SAMPLE.assets.filter(asset => asset.kind === 'site');

/** The sample site from above: every building, the assets marked and named, the picked one as the target. Close views pass names: false. */
export function siteState(ui, caption, {names = true} = {}) {
  const assets = new Set(siteAssets().map(asset => asset.osm)), picked = assetById(ui.asset);
  return {
    ...view, mode: 'move', caption,
    footprints: SAMPLE.buildings.map(building => footprintMark(building.o.map(([x, y]) => ({x, y})), {name: names && assets.has(building.id) ? siteAssets().find(asset => asset.osm === building.id).name : '', part: building.id === picked?.osm})),
    target: picked?.outline ? {outline: picked.outline, holes: []} : null,
  };
}

/** The asset whose outline holds a point of the map, or null. */
export function assetAt(box, state, px, py) {
  const world = viewTransform(box, state).toWorld(px, py);
  return siteAssets().find(asset => {
    const ring = asset.outline;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      if ((ring[i].y > world.y) !== (ring[j].y > world.y) && world.x < ((ring[j].x - ring[i].x) * (world.y - ring[i].y)) / (ring[j].y - ring[i].y) + ring[i].x) inside = !inside;
    }
    return inside;
  }) ?? null;
}

const t = SAMPLE.telemetry;
// Nothing flies now: the device's values are the last sample of a run, so its time is the freshness.
const age = `${ORIGIN_TAG[t.origin]}, LAST ${t.at}`;
const MODES = ['ON THE GROUND', 'TAKING OFF', t.step, 'HOLDING', 'RETURNING', 'THE PILOT HAS IT'];

export default {
  'site/site map: assets highlighted': {paint(ctx, b, env) {
    const state = siteState(env.ui, `SAMPLE / ${SAMPLE.site.name} / PICK AN ASSET`);
    el(ctx, 'siteMap', b, state);
    env.hit(b, point => { const asset = assetAt(b, state, point.x, point.y); if (!asset || asset.id === env.ui.asset) return false; env.ui.asset = asset.id; return true; });
    text(ctx, SAMPLE.site.terms, b.x + b.width - 4, b.y + b.height - 9, DIM, {align: 'right', room: b.width - 8});
  }},

  'site/data panel': {header: 'none', paint(ctx, b, env) {
    fill(ctx, b.x, b.y, b.width, b.height, PANEL);
    text(ctx, `${SAMPLE.site.name} / ${SAMPLE.site.place}`, b.x + 8, b.y + 5, MINT, {room: b.width - 200});
    const right = b.x + b.width - 6;
    const used = tag(ctx, right, b.y + 3, 'PLAN');
    tag(ctx, right - used - 4, b.y + 3, 'SAMPLE');
    const flights = SAMPLE.flights.length, targets = siteAssets().length;
    text(ctx, `${targets} TARGETS / ${flights} FLIGHTS / ${t.device}: ${age}, ${runById(t.run).name} ENDED`, b.x + 8, b.y + 18, DIM, {room: b.width - 16});
  }},

  'site/telemetry': {header: 'compact', paint(ctx, b) {
    const items = [['UP', `${t.up_m.toFixed(1)} M`], ['SPEED', `${t.speed_mps.toFixed(1)} M/S`], ['BATTERY', `${t.battery_pct} %`], ['LAST', `${t.at} ${ORIGIN_TAG[t.origin]}`]];
    const width = Math.floor(b.width / items.length);
    items.forEach(([key, value], i) => el(ctx, 'keyvalue', part(b, i * width, -3, width - 12, 14), {key, value}));
  }},

  'site/coordinates': {header: 'none', paint(ctx, b) {
    fill(ctx, b.x, b.y, b.width, b.height, PANEL);
    text(ctx, `${t.latitude} / ${t.longitude}`, b.x + 3, b.y + 8, MINT, {room: b.width - 6});
  }},

  'site/compass': {header: 'none', paint(ctx, b) {
    fill(ctx, b.x, b.y, b.width, b.height, PANEL);
    el(ctx, 'heading', part(b, 2, 0, b.width - 4, b.height), {value: t.heading_deg});
  }},

  'site/mode': {header: 'none', paint(ctx, b, env) {
    button(ctx, b, `${MODES[env.ui.mode]} / ${t.control}`);
    env.hit(b, () => { env.ui.mode = (env.ui.mode + 1) % MODES.length; return true; });
  }},

  'site/asset details': {header: 'compact', paint(ctx, b, env) {
    const asset = assetById(env.ui.asset);
    text(ctx, asset.name, b.x, b.y, MINT, {room: Math.min(88, b.width)});
    text(ctx, asset.kind === 'site' ? 'BUILDING' : asset.kind.toUpperCase(), b.x, b.y + 12, DIM, {room: Math.min(88, b.width)});
  }},

  'site/pending': {header: 'compact', paint(ctx, b) {
    const today = SAMPLE.events.filter(event => event.day === SAMPLE.today && event.state === 'planned').sort((a, z) => a.time.localeCompare(z.time));
    el(ctx, 'row', part(b, 0, 0, b.width, 18), {title: `${today.length} PLANNED TODAY`, level: 'warn'});
    if (today[0]) text(ctx, `${today[0].time} ${today[0].title}`, b.x, b.y + 22, DIM, {room: b.width});
  }},

  'site/recent': {header: 'compact', paint(ctx, b) {
    const run = runById('r3');
    el(ctx, 'row', part(b, 0, 0, b.width, 18), {title: `${run.name} / ${ORIGIN_TAG[run.origin]}`, level: 'ok'});
    text(ctx, `${run.when.slice(11)} / ${run.outcome}`, b.x, b.y + 22, DIM, {room: b.width});
  }},

  'site/notes': {header: 'compact', paint(ctx, b, env) {
    const notes = SAMPLE.notes;
    words(ctx, notes[env.ui.notes % notes.length].text, b, MINT);
    env.hit(b, () => { env.ui.notes += 1; return true; });
  }},

  'site/details': {paint(ctx, b, env) {
    const asset = assetById(env.ui.asset), flights = SAMPLE.flights.filter(flight => flight.covers.includes(asset.id));
    el(ctx, 'badge', part(b, 0, 0, b.width, 16), {text: asset.cases ? `${asset.cases} OPEN CASE` : asset.scans ? 'SCANNED' : 'NOT SCANNED YET', level: asset.cases ? 'warn' : asset.scans ? 'ok' : 'off'});
    let y = 24;
    y += facts(ctx, part(b, 0, y, b.width, 80), [['ASSET', asset.name], ['KIND', asset.mobility], ['OUTLINE', asset.osm ? 'OPENSTREETMAP' : 'NONE YET'], ['SCANS', asset.scans]]);
    y += 4 + words(ctx, asset.heights, part(b, 0, y + 4, b.width, 30), asset.heights.includes('GUESS') ? AMBER : DIM);
    el(ctx, 'label', part(b, 0, y + 8, b.width, 16), {text: 'FLIGHTS AT THIS SITE', variant: 'caption'});
    const list = SAMPLE.flights.map(flight => ({title: flight.name, detail: flight.state, level: flight.state === 'PASSED' ? 'ok' : 'fail', selected: flight.id === env.ui.flight}));
    rows(ctx, part(b, 0, y + 28, b.width, 44), list, {pitch: 22}).forEach((row, i) => env.hit(row, () => { if (env.ui.flight === SAMPLE.flights[i].id) return false; env.ui.flight = SAMPLE.flights[i].id; return true; }));
    const flight = flightById(env.ui.flight);
    y += 80;
    words(ctx, flight.note ?? `COVERS ${flight.covers.map(id => assetById(id).name).join(', ')}`, part(b, 0, y, b.width, 50), flight.state === 'REFUSED' ? AMBER : DIM);
    if (flight.coverage && b.height > y + 100) {
      el(ctx, 'value', part(b, 0, y + 56, b.width, 32), {caption: 'SEEN, EXPECTED', value: Math.round(flight.coverage.seen * 100), unit: '%'});
      el(ctx, 'progress', part(b, 0, y + 92, b.width, 16), {value: flight.coverage.seen});
    }
    if (b.height > y + 150) {
      const at = part(b, 0, y + 120, b.width, 24);
      button(ctx, at, 'NEXT ASSET');
      env.hit(at, () => { env.ui.asset = next(siteAssets().map(entry => entry.id), env.ui.asset); return true; });
    }
    if (flights.length === 0 && b.height > y + 30) words(ctx, 'NO FLIGHT COVERS THIS ASSET YET', part(b, 0, b.height - 24, b.width, 20), DIM);
  }},
};

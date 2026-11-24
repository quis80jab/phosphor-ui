// The diagrams of the atlas adapter: the System topology, the command path and the chains, drawn from
// designer-architecture.js in the topology vocabulary of designer-topology.js (device, sensor,
// processor, admin and viewer glyphs; ethernet double, wifi dotted, usb solid, access dashed), with a
// few additions in the same style (pilot, module, store, aircraft and rc glyphs; radio, mount and
// local links). One selection is shared by every diagram and by the System panels.
//
// With the 'demo' adapter, paintSystemTopology, activateSystemTopology and getSystemTopologyState hand
// everything to today's designer-topology.js. Nothing here fetches, signs in or commands: it is the
// design, painted.
import * as demo from './designer-topology.js';
import {previewData} from './designer-data.js';
import {NODES, LINKS, TIERS, STATES, ORIGINS, OWNERS, LINK_KINDS, COMMAND_PATH, SAFETY, CHAINS, MODULES, nodeById, moduleById, interfaceById, sensorsOf, membersOf, modulesOn, linksOf} from './designer-architecture.js';
import {layoutTiers, nodeAt} from './designer-arch-layout.js';
import {text, fill, outline, hline, vline, line, circle, textWidth, triangle} from './sandbox-ui/src/paint/primitives.js';
import {MINT, DIM, INK, PANEL, AMBER} from './sandbox-ui/src/palette.js';

/** What is picked: a node or a module, the person whose view is shown, the page of tiers, a step. */
const view = {selected: 'flight-orin', person: 'operator', page: 0, step: null};
const regions = {topology: [], 'command-path': [], chains: []};

/** The picked node or module, and the person: what the System panels read. */
export function getArchSelection() {
  const node = nodeById[view.selected] ?? null, module = node ? null : moduleById[view.selected] ?? null;
  return {id: view.selected, node, module, person: view.person, step: view.step};
}

/** Picks a node or a module by id; true when that changed something. */
export function selectArch(id) {
  if (!nodeById[id] && !moduleById[id]) return false;
  const before = `${view.selected}|${view.person}`;
  view.selected = id;
  if (id === 'operator' || id === 'observer') view.person = id;
  return before !== `${view.selected}|${view.person}`;
}

/** Whose view is shown, without changing what is picked: 'operator' or 'observer'. True when it changed. */
export function setArchPerson(person) {
  if (person !== 'operator' && person !== 'observer') return false;
  const changed = view.person !== person;
  view.person = person;
  return changed;
}

/** Back to the start: the robot picked, the operator's view. For tests and a fresh preview. */
export function resetArchSelection() {
  Object.assign(view, {selected: 'flight-orin', person: 'operator', page: 0, step: null});
}

const TYPE_OF = {person: 'person', cluster: 'device', device: 'device', sensor: 'sensor', service: 'processor', store: 'processor', aircraft: 'device', rc: 'device', compute: 'processor'};

/** Today's selection shape {id, name, type, subtype, model, location, sensors, modules}, with more fields after it. */
function legacySelection() {
  const {node, module} = getArchSelection();
  if (module) return Object.freeze({id: module.id, name: module.name, type: 'module', subtype: module.state.toUpperCase(), model: module.runs.toUpperCase(), location: String(module.where ?? '').toUpperCase(), sensors: Object.freeze([]), modules: Object.freeze([]), status: module.state, owner: module.owner});
  const person = node.kind === 'person';
  return Object.freeze({
    id: node.id, name: node.name,
    type: person ? (node.id === 'operator' ? 'admin' : node.id === 'observer' ? 'viewer' : 'pilot') : TYPE_OF[node.kind],
    subtype: (node.role ?? node.kind).toUpperCase(), model: node.model ?? node.kind.toUpperCase(),
    location: node.parent ? nodeById[node.parent].name : TIERS.find(tier => tier.id === node.tier).label,
    sensors: Object.freeze(sensorsOf(node.id).map(entry => entry.name)),
    modules: Object.freeze([...new Set([...node.runs, ...modulesOn(node.id).map(entry => entry.name)])]),
    kind: node.kind, tier: node.tier, status: node.state, origin: node.origin, owner: node.owner,
  });
}

export function getSystemTopologyState() {
  if (previewData() === 'demo') return demo.getSystemTopologyState();
  return {selected: legacySelection(), accessRole: view.person === 'operator' ? 'admin' : 'viewer', person: view.person};
}

export function paintSystemTopology(ctx, bounds) {
  if (previewData() === 'demo') return demo.paintSystemTopology(ctx, bounds);
  paintArchView(ctx, 'topology', bounds);
}

export function activateSystemTopology(point, bounds) {
  if (previewData() === 'demo') return demo.activateSystemTopology(point, bounds);
  return activateArchView('topology', point, bounds);
}

// ---------------------------------------------------------------------------------------------- glyphs

function glyph(ctx, kind, x, y, size, colour) {
  const cx = x + Math.floor(size / 2), cy = y + Math.floor(size / 2);
  if (kind === 'aircraft') {
    line(ctx, x + 3, y + 3, x + size - 4, y + size - 4, colour); line(ctx, x + size - 4, y + 3, x + 3, y + size - 4, colour);
    for (const [dx, dy] of [[0, 0], [size - 6, 0], [0, size - 6], [size - 6, size - 6]]) outline(ctx, x + dx, y + dy, 6, 6, colour);
    fill(ctx, cx - 2, cy - 2, 5, 5, colour);
  } else if (kind === 'device') {
    outline(ctx, x, y + 2, size, size - 4, colour); hline(ctx, x + 3, y + 7, size - 6, colour);
    for (let i = 0; i < 3; i += 1) fill(ctx, x + 3 + i * 5, y + size - 6, 2, 2, colour);
  } else if (kind === 'sensor') {
    outline(ctx, x + 1, y + 3, size - 2, size - 6, colour); circle(ctx, cx, cy, 4, colour); fill(ctx, cx, cy, 1, 1, colour); hline(ctx, x + 4, y + 1, 5, colour);
  } else if (kind === 'processor') {
    outline(ctx, x + 4, y + 4, size - 8, size - 8, colour); fill(ctx, cx - 2, cy - 2, 5, 5, colour);
    for (let i = 5; i < size - 4; i += 4) { vline(ctx, x + i, y, 3, colour); vline(ctx, x + i, y + size - 3, 3, colour); hline(ctx, x, y + i, 3, colour); hline(ctx, x + size - 3, y + i, 3, colour); }
  } else if (kind === 'admin') {
    hline(ctx, x + 2, y + 1, size - 4, colour); vline(ctx, x + 2, y + 1, 9, colour); vline(ctx, x + size - 3, y + 1, 9, colour);
    line(ctx, x + 2, y + 10, cx, y + size - 1, colour); line(ctx, cx, y + size - 1, x + size - 3, y + 10, colour);
    hline(ctx, cx - 3, cy - 1, 7, colour); vline(ctx, cx, cy - 4, 7, colour);
  } else if (kind === 'viewer') {
    line(ctx, x, cy, cx, y + 2, colour); line(ctx, cx, y + 2, x + size - 1, cy, colour); line(ctx, x + size - 1, cy, cx, y + size - 3, colour); line(ctx, cx, y + size - 3, x, cy, colour); circle(ctx, cx, cy, 3, colour);
  } else if (kind === 'pilot' || kind === 'rc') {
    outline(ctx, x, y + 5, size, size - 8, colour); circle(ctx, x + 5, cy + 1, 2, colour); circle(ctx, x + size - 6, cy + 1, 2, colour);
    if (kind === 'pilot') { vline(ctx, cx, y, 5, colour); fill(ctx, cx - 1, y, 3, 2, colour); }
    else { vline(ctx, x + 3, y, 5, colour); vline(ctx, x + size - 4, y, 5, colour); }
  } else if (kind === 'store') {
    outline(ctx, x + 2, y + 3, size - 4, size - 5, colour); hline(ctx, x + 3, y + 6, size - 6, colour); hline(ctx, x + 3, y + 10, size - 6, colour);
    hline(ctx, x + 4, y + 1, size - 8, colour);
  } else if (kind === 'module') {
    outline(ctx, x + 3, y + 3, size - 6, size - 6, colour); fill(ctx, x, cy - 1, 3, 3, colour); fill(ctx, x + size - 3, cy - 1, 3, 3, colour);
    hline(ctx, x + 6, cy, size - 12, colour);
  }
}

const glyphOf = node => node.glyph ?? (node.kind === 'service' || node.kind === 'compute' ? 'processor' : node.kind === 'cluster' ? 'device' : node.kind);

// ------------------------------------------------------------------------------------------- strokes

/** A pattern of on and off pixels for each link style, continued along a whole line. */
const PATTERNS = {ethernet: null, usb: null, mount: null, wifi: [1, 3], local: [1, 1], access: [6, 4], radio: [4, 2, 1, 2]};

function stroke(ctx, points, style, colour) {
  const pattern = PATTERNS[style];
  let step = 0;
  const dot = (x, y) => {
    if (pattern) {
      let at = step % pattern.reduce((a, b) => a + b, 0), on = true;
      for (const length of pattern) { if (at < length) break; at -= length; on = !on; }
      step += 1;
      if (!on) return;
    } else step += 1;
    fill(ctx, x, y, 1, 1, colour);
  };
  for (let i = 1; i < points.length; i += 1) {
    const [x0, y0] = points[i - 1], [x1, y1] = points[i];
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let k = i === 1 ? 0 : 1; k <= n; k += 1) {
      const x = Math.round(x0 + (x1 - x0) * k / Math.max(1, n)), y = Math.round(y0 + (y1 - y0) * k / Math.max(1, n));
      dot(x, y);
      if (style === 'ethernet') fill(ctx, x0 === x1 ? x + 2 : x, y0 === y1 ? y + 2 : y, 1, 1, colour);
    }
  }
}

const STATE_COLOUR = {running: MINT, built: MINT, designed: AMBER, named: DIM, planned: DIM};

function paintNode(ctx, node, box, form, picked) {
  const {x, y, width: w, height: h} = box, stateColour = STATE_COLOUR[node.state] ?? DIM;
  fill(ctx, x, y, w, h, PANEL);
  const dotted = node.state === 'designed' || node.state === 'named' || node.state === 'planned';
  if (picked) { outline(ctx, x, y, w, h, MINT); outline(ctx, x + 2, y + 2, w - 4, h - 4, MINT); fill(ctx, x + 4, y + 4, 2, 2, MINT); }
  else if (dotted) { hline(ctx, x, y, w, stateColour === AMBER ? AMBER : DIM, true); hline(ctx, x, y + h - 1, w, stateColour === AMBER ? AMBER : DIM, true); vline(ctx, x, y, h, stateColour === AMBER ? AMBER : DIM, true); vline(ctx, x + w - 1, y, h, stateColour === AMBER ? AMBER : DIM, true); }
  else outline(ctx, x, y, w, h, DIM);
  const kindWord = node.kind === 'person' ? 'PERSON' : node.kind === 'cluster' ? 'CLUSTER' : node.role ? `${node.kind} / ${node.role}`.toUpperCase() : node.kind.toUpperCase();
  const origin = node.origin ? ORIGINS[node.origin] : '';
  if (form.name === 'compact') {
    text(ctx, node.name, x + 5, y + 5, picked ? MINT : node.state === 'running' ? MINT : DIM, {room: w - 14});
    fill(ctx, x + w - 6, y + 6, 3, 3, stateColour);
    return;
  }
  glyph(ctx, glyphOf(node), x + 6, y + (form.name === 'full' ? 8 : 6), 14, picked ? MINT : DIM);
  if (form.name === 'full') {
    text(ctx, kindWord, x + 25, y + 5, DIM, {room: w - 30});
    text(ctx, node.name, x + 25, y + 16, MINT, {room: w - 30});
    hline(ctx, x + 6, y + 28, w - 12, DIM);
    const stateWord = STATES[node.state]?.label ?? '';
    text(ctx, stateWord, x + 6, y + 33, stateColour, {room: w - 12 - (origin ? textWidth(origin) + 6 : 0)});
    if (origin) text(ctx, origin, x + w - 6, y + 33, DIM, {align: 'right'});
  } else {
    text(ctx, node.name, x + 25, y + 5, MINT, {room: w - 30});
    text(ctx, STATES[node.state]?.label ?? '', x + 25, y + 17, stateColour, {room: w - 30 - (origin ? textWidth(origin) + 6 : 0)});
    if (origin) text(ctx, origin, x + w - 5, y + 17, DIM, {align: 'right'});
  }
}

// -------------------------------------------------------------------------------------- the topology

/** The tiers as the layout takes them, nodes in the order that keeps lines short. */
function tiers() {
  const order = {sensors: ['xt2', 'z30', 'd455', 'gps', 'range', 'imu-main', 'sim-sensors']};
  return TIERS.map(tier => {
    const ids = NODES.filter(entry => entry.tier === tier.id).map(entry => entry.id);
    const wanted = order[tier.id];
    return {id: tier.id, label: tier.label, nodes: wanted ? [...wanted.filter(id => ids.includes(id)), ...ids.filter(id => !wanted.includes(id))] : ids};
  });
}

const HEADER = 70, STRIP = 16;

function legendHeight(width) { return width >= 360 ? 74 : 0; }

function topologyGeometry(b) {
  const legend = legendHeight(b.width), body = {x: b.x + 4, y: b.y + HEADER, width: b.width - 8, height: b.height - HEADER - legend - 6};
  let layout = layoutTiers(tiers(), LINKS, body, {page: view.page});
  if (layout.pages > 1) layout = layoutTiers(tiers(), LINKS, {...body, height: body.height - STRIP}, {page: view.page});
  return {layout, body, legend};
}

function paintTopology(ctx, b) {
  const {layout, body, legend} = topologyGeometry(b), picked = view.selected, list = regions.topology = [];
  text(ctx, 'SYSTEM TOPOLOGY', b.x + 16, b.y + 12, MINT, {scale: b.width >= 400 ? 2 : 1, room: b.width - 32});
  text(ctx, 'SYNTHETIC / PICK A NODE / NOT LIVE', b.x + 16, b.y + 38, DIM, {room: b.width - 32});
  hline(ctx, b.x + 16, b.y + 52, b.width - 32, DIM);
  text(ctx, view.person === 'operator' ? 'SEEN AS: OPERATOR / MAY TAKE THE LEASE' : 'SEEN AS: OBSERVER / WATCHES, NO LEASE', b.x + 16, b.y + 58, AMBER, {room: b.width - 32});
  if (!layout.form) { text(ctx, 'TOO SMALL FOR THE TOPOLOGY', b.x + 16, body.y + 4, AMBER, {room: b.width - 32}); return; }

  // Lines first, those of the picked node last and lit, then the nodes over them.
  const touches = route => route.from === picked || route.to === picked;
  const linkById = Object.fromEntries(LINKS.map(entry => [entry.id, entry]));
  for (const pass of [false, true]) {
    for (const route of [...layout.routes, ...layout.stubs]) {
      if (touches(route) !== pass) continue;
      const entry = linkById[route.link], style = LINK_KINDS[entry.kind].style;
      const colour = entry.kind === 'access' ? AMBER : pass ? MINT : DIM;
      stroke(ctx, route.points, style, colour);
    }
  }
  for (const [id, box] of Object.entries(layout.boxes)) {
    paintNode(ctx, nodeById[id], box, layout.form, id === picked);
    list.push({box, id});
  }
  // The words of the picked node's lines, on the longest run across of each.
  for (const route of layout.routes) {
    if (!touches(route)) continue;
    const entry = linkById[route.link];
    let best = null;
    for (let i = 1; i < route.points.length; i += 1) {
      const [x0, y0] = route.points[i - 1], [x1, y1] = route.points[i];
      if (y0 === y1 && (!best || Math.abs(x1 - x0) > best.length)) best = {length: Math.abs(x1 - x0), x: Math.min(x0, x1), y: y0};
    }
    if (!best || best.length < 30) continue;
    const words = LINK_KINDS[entry.kind].label, room = Math.min(best.length - 4, textWidth(words) + 4);
    fill(ctx, best.x + 2, best.y - 4, room, 9, PANEL);
    text(ctx, words, best.x + 4, best.y - 3, entry.kind === 'access' ? AMBER : MINT, {room: room - 4});
  }
  for (const label of layout.labels) {
    const width = textWidth(label.text) + 6;
    fill(ctx, label.x - 2, label.y - 1, width, 9, PANEL);
    text(ctx, label.text, label.x, label.y, DIM);
  }
  for (const stub of layout.stubs) {
    const [x, y] = stub.points[1], tier = TIERS.find(entry => entry.id === nodeById[stub.to].tier).label;
    text(ctx, `> ${tier}`, x + 3, y - 3, DIM, {room: 90});
  }
  if (layout.pages > 1) {
    const y = body.y + body.height - STRIP + 4, words = `< TIERS ${layout.page + 1} OF ${layout.pages} >`;
    text(ctx, words, b.x + Math.floor(b.width / 2), y, MINT, {align: 'center'});
    const half = Math.floor(textWidth(words) / 2), mid = b.x + Math.floor(b.width / 2);
    list.push({box: {x: mid - half - 6, y: y - 3, width: 24, height: 13}, page: -1});
    list.push({box: {x: mid + half - 18, y: y - 3, width: 24, height: 13}, page: 1});
  }
  if (legend) paintLegend(ctx, {x: b.x + 16, y: b.y + b.height - legend, width: b.width - 32, height: legend - 6});
}

function paintLegend(ctx, b) {
  hline(ctx, b.x, b.y, b.width, DIM);
  const nodes = [['admin', 'PERSON'], ['device', 'DEVICE'], ['sensor', 'SENSOR'], ['processor', 'SERVICE'], ['store', 'STORE'], ['aircraft', 'AIRCRAFT'], ['rc', 'RC']];
  const slot = Math.floor(b.width / nodes.length);
  nodes.forEach(([kind, label], i) => { const x = b.x + i * slot; glyph(ctx, kind, x, b.y + 6, 12, MINT); text(ctx, label, x + 16, b.y + 9, MINT, {room: slot - 18}); });
  const links = [['ethernet', 'CABLE'], ['wifi', 'WIFI, 4G'], ['usb', 'USB, SERIAL'], ['radio', 'RADIO'], ['access', 'A PERSON'], ['local', 'IN CLUSTER']];
  const span = Math.floor(b.width / links.length);
  links.forEach(([style, label], i) => { const x = b.x + i * span; stroke(ctx, [[x, b.y + 29], [x + 20, b.y + 29]], style, style === 'access' ? AMBER : MINT); text(ctx, label, x + 26, b.y + 26, style === 'access' ? AMBER : MINT, {room: span - 28}); });
  const states = Object.entries(STATES), step = Math.floor(b.width / states.length);
  states.forEach(([id, entry], i) => { const x = b.x + i * step; fill(ctx, x, b.y + 46, 5, 5, STATE_COLOUR[id]); text(ctx, entry.label, x + 9, b.y + 45, STATE_COLOUR[id], {room: step - 10}); });
}

// ------------------------------------------------------------------------------------ the command path

function paintCommandPath(ctx, b) {
  const list = regions['command-path'] = [];
  const bracket = 44, room = b.width - 16 - bracket - 8;
  let y = b.y;
  const rowHeight = Math.max(20, Math.min(26, Math.floor((b.height - 34) / COMMAND_PATH.length) - 4));
  COMMAND_PATH.forEach((step, i) => {
    const box = {x: b.x + 8, y, width: room, height: rowHeight}, picked = view.step === step.id, here = view.selected === step.node;
    fill(ctx, box.x, box.y, box.width, box.height, PANEL);
    outline(ctx, box.x, box.y, box.width, box.height, picked ? MINT : DIM);
    // The steps that run on the node picked anywhere carry a bar at their left.
    if (here) fill(ctx, box.x + 1, box.y + 1, 2, box.height - 2, MINT);
    text(ctx, `${i + 1} ${step.step}`, box.x + 5, box.y + 4, MINT, {room: box.width - 10});
    if (rowHeight >= 22) text(ctx, step.says, box.x + 5, box.y + 13, DIM, {room: box.width - 10});
    list.push({box, step: step.id, id: step.node});
    y += rowHeight;
    if (i < COMMAND_PATH.length - 1) { triangle(ctx, box.x + 12, y, 'down', 2, DIM); y += 4; }
  });
  // The pilot wins over every step: a bracket down the right side.
  const x = b.x + 8 + room + 8, top = b.y + 2, bottom = y - 2;
  hline(ctx, x, top, 6, AMBER); hline(ctx, x, bottom, 6, AMBER); vline(ctx, x + 5, top, bottom - top, AMBER);
  const mid = Math.floor((top + bottom) / 2), pilot = view.selected === 'pilot', ink = pilot ? INK : AMBER;
  if (pilot) fill(ctx, x + 9, mid - 15, 30, 32, AMBER);
  text(ctx, 'RC', x + 12, mid - 12, ink); text(ctx, 'WINS', x + 12, mid - 2, ink); text(ctx, 'ALL', x + 12, mid + 8, ink);
  list.push({box: {x, y: top, width: bracket, height: bottom - top}, id: 'pilot'});
  if (y + 24 <= b.y + b.height) text(ctx, SAFETY.unsigned, b.x + 8, y + 8, AMBER, {room: b.width - 16});
}

// -------------------------------------------------------------------------------------------- chains

const stepName = step => step.node ? `${nodeById[step.node].name} ${step.port}` : moduleById[step.module].name;
const stepState = step => step.node ? nodeById[step.node].state : moduleById[step.module].state;

function paintChains(ctx, b) {
  const list = regions.chains = [];
  const arrowOf = (iface, x, y) => {
    const colour = interfaceById[iface]?.owner === 'work' ? AMBER : DIM, width = Math.max(20, textWidth(iface) + 8);
    text(ctx, iface, x + 2, y + 1, colour, {upper: false, room: width - 2});
    hline(ctx, x, y + 13, width - 4, colour);
    triangle(ctx, x + width - 6, y + 11, 'right', 2, colour);
    return width;
  };
  let y = b.y + 4;
  for (const [index, chain] of CHAINS.entries()) {
    if (y + 34 > b.y + b.height - 12) { text(ctx, `${CHAINS.length - index} MORE: MAKE THE BOX TALLER`, b.x + 8, y, AMBER, {room: b.width - 16}); break; }
    text(ctx, chain.name, b.x + 8, y, DIM, {room: b.width - 16});
    y += 11;
    let x = b.x + 8, pending = null;
    for (const step of chain.steps) {
      if (step.iface) { pending = step.iface; continue; }
      const words = stepName(step), width = Math.min(textWidth(words) + 12, b.width - 16);
      const arrow = pending ? Math.max(20, textWidth(pending) + 8) : 0;
      if (x + arrow + width > b.x + b.width - 8 && x > b.x + 8) { y += 30; x = b.x + 24; }
      if (pending) { x += arrowOf(pending, x, y); pending = null; }
      const id = step.node ?? step.module, picked = view.selected === id, state = stepState(step);
      const box = {x, y: y + 6, width, height: 15};
      fill(ctx, box.x, box.y, box.width, box.height, picked ? MINT : PANEL);
      if (!picked) {
        if (state === 'running' || state === 'built') outline(ctx, box.x, box.y, box.width, box.height, DIM);
        else {
          const c = state === 'designed' ? AMBER : DIM;
          hline(ctx, box.x, box.y, box.width, c, true); hline(ctx, box.x, box.y + box.height - 1, box.width, c, true);
          vline(ctx, box.x, box.y, box.height, c, true); vline(ctx, box.x + box.width - 1, box.y, box.height, c, true);
        }
      }
      text(ctx, words, box.x + 6, box.y + 4, picked ? INK : MINT, {room: box.width - 10});
      list.push({box, id});
      x += width + 4;
    }
    if (pending && x + 20 <= b.x + b.width - 8) arrowOf(pending, x, y);
    y += 30;
  }
  text(ctx, 'AMBER: SYNTHETIC EXTENSION EXAMPLES', b.x + 8, b.y + b.height - 9, AMBER, {room: b.width - 16});
}

// ------------------------------------------------------------------------------------- one entrance

/** Paints a diagram, 'topology', 'command-path' or 'chains', at display-pixel bounds. */
export function paintArchView(ctx, kind, bounds) {
  const b = {x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height)};
  if (b.width < 80 || b.height < 60) return;
  ctx.save(); ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip();
  fill(ctx, b.x, b.y, b.width, b.height, PANEL);
  try {
    if (kind === 'topology') paintTopology(ctx, b);
    else if (kind === 'command-path') paintCommandPath(ctx, b);
    else if (kind === 'chains') paintChains(ctx, b);
  } finally { ctx.restore(); }
}

const noop = {fillStyle: '', imageSmoothingEnabled: false, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}};

/** A click at a display-pixel point inside a diagram; true when the selection or the page changed. */
export function activateArchView(kind, point, bounds) {
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return false;
  paintArchView(noop, kind, bounds);
  const hit = [...regions[kind]].reverse().find(entry => point.x >= entry.box.x && point.y >= entry.box.y && point.x < entry.box.x + entry.box.width && point.y < entry.box.y + entry.box.height);
  if (!hit) return false;
  if (hit.page) {
    const {layout} = topologyLayoutFor(bounds), next = Math.min(Math.max(0, view.page + hit.page), layout.pages - 1);
    const changed = next !== view.page;
    view.page = next;
    return changed;
  }
  const before = `${view.selected}|${view.person}|${view.step}`;
  if (hit.step) view.step = hit.step;
  selectArch(hit.id);
  return before !== `${view.selected}|${view.person}|${view.step}`;
}

/** The geometry of the topology in a box, for tests: the node boxes and the lines. */
export function topologyLayoutFor(bounds) {
  return topologyGeometry({x: Math.round(bounds.x), y: Math.round(bounds.y), width: Math.round(bounds.width), height: Math.round(bounds.height)});
}

export {nodeAt, OWNERS, membersOf, linksOf, MODULES};

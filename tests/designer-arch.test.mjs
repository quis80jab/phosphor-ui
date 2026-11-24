// The architecture file and the diagrams drawn from it: the synthetic fixtures hang together, nothing in them is an
// address, a port, a key or a place of ours, and the topology fits any box the owner draws it in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {NODES, LINKS, MODULES, INTERFACES, CHAINS, COMMAND_PATH, STATES, OWNERS, TIERS, LINK_KINDS, ORIGINS, nodeById, moduleById, interfaceById, sensorsOf, modulesOn} from '../dist/designer-architecture.js';
import {layoutTiers} from '../dist/designer-arch-layout.js';
import {paintArchView, activateArchView, getArchSelection, selectArch, setArchPerson, resetArchSelection, topologyLayoutFor, getSystemTopologyState} from '../dist/designer-arch-view.js';
import * as preview from '../dist/designer-preview.js';
import {resetUi} from '../dist/designer-panels/state.js';
import {raster, recorder, boundsInside, digest} from './helpers/raster.mjs';

const here = file => new URL(file, import.meta.url);
const design = JSON.parse(readFileSync(here('../handoff/designer/arachnid.flow-design.json'), 'utf8'));

test('the architecture hangs together: ids unique, every reference resolves, every fixture names its source', () => {
  const ids = [...NODES, ...MODULES, ...INTERFACES, ...LINKS, ...CHAINS, ...COMMAND_PATH].map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, 'one id, one thing');
  for (const node of NODES) {
    assert.ok(STATES[node.state], `${node.id}: a known state`);
    assert.ok(OWNERS[node.owner], `${node.id}: a known owner`);
    assert.ok(TIERS.some(tier => tier.id === node.tier), `${node.id}: a known tier`);
    assert.ok(node.parent === null || nodeById[node.parent], `${node.id}: its parent exists`);
    assert.ok(node.origin === null || ORIGINS[node.origin], `${node.id}: a known origin`);
    assert.ok(node.source && node.says, `${node.id}: says what it is and its synthetic origin`);
  }
  for (const link of LINKS) {
    assert.ok(nodeById[link.from] && nodeById[link.to], `${link.id}: both ends exist`);
    assert.ok(LINK_KINDS[link.kind], `${link.id}: a known kind`);
    assert.ok(STATES[link.state] && link.source && link.carries, `${link.id}: state, source and what it carries`);
  }
  for (const module of MODULES) {
    assert.ok(STATES[module.state] && OWNERS[module.owner] && module.source, `${module.id}: state, owner and source`);
    for (const port of [...module.inputs, ...module.outputs]) assert.ok(interfaceById[port] || port === port.toUpperCase(), `${module.id}: ${port} is an interface or a plain word`);
  }
  for (const chain of CHAINS) for (const step of chain.steps) {
    if (step.node) assert.ok(nodeById[step.node], `${chain.id}: ${step.node}`);
    if (step.module) assert.ok(moduleById[step.module], `${chain.id}: ${step.module}`);
    if (step.iface) assert.ok(interfaceById[step.iface], `${chain.id}: ${step.iface}`);
  }
  for (const step of COMMAND_PATH) assert.ok(nodeById[step.node], `${step.id}: ${step.node}`);
  assert.ok(sensorsOf('flight-orin').length >= 2 && modulesOn('flight-orin').length >= 3, 'the robot has its sensors and modules');
});

test('no address, port, key or place of ours in the files the outline is made of', () => {
  const files = ['designer-architecture.js', 'designer-records.js', 'designer-sample-site.js', 'designer-outline.js', 'designer-panel-map.js', 'designer-arch-view.js', 'designer-arch-layout.js', 'designer-preview.js', 'designer-data.js', ...readdirSync(here('../dist/designer-panels')).map(name => `designer-panels/${name}`)];
  const texts = [...files.map(file => [file, readFileSync(here(`../dist/${file}`), 'utf8')]), ['arachnid.flow-design.json', JSON.stringify(design)]];
  const inSample = value => (value >= 37.7 && value <= 37.81) || (value >= 122.38 && value <= 122.41) || value === 10;
  for (const [file, source] of texts) {
    assert.doesNotMatch(source, /\b(?:\d{1,3}\.){3}\d{1,3}\b/, `${file}: no IP address`);
    assert.doesNotMatch(source, /localhost|\.local\b|\.internal\b|ts\.net/i, `${file}: no host of ours`);
    assert.doesNotMatch(source, /[\w.+-]+@[\w-]+\.[a-z]{2,}/i, `${file}: no email address`);
    assert.doesNotMatch(source, /[a-z\d]:\d{4,5}\b/i, `${file}: no port`);
    assert.doesNotMatch(source, /\b(?:sk|pk|ghp|xox[bp])[-_][A-Za-z\d]{16,}|\b[A-Fa-f\d]{40,}\b/, `${file}: nothing that looks like a key`);
    for (const match of source.matchAll(/(-?\d{1,3}\.\d{4,})\s*[NSEW]\b|(?:latitude|longitude)\W{1,4}(-?\d{1,3}\.\d+)/g)) {
      const value = Math.abs(Number(match[1] ?? match[2]));
      assert.ok(inSample(value), `${file}: ${match[0]} is neither the public San Francisco sample nor DJI simulator's test position`);
    }
  }
});

// ------------------------------------------------------------------------------------- the topology

const realTiers = () => TIERS.map(tier => ({id: tier.id, label: tier.label, nodes: NODES.filter(node => node.tier === tier.id).map(node => node.id)}));
const demoTiers = () => [
  {id: 'people', label: 'PEOPLE', nodes: ['admin', 'viewer']}, {id: 'ground', label: 'GROUND', nodes: ['gateway', 'edge']},
  {id: 'devices', label: 'DEVICES', nodes: ['drone', 'rc']}, {id: 'sensors', label: 'SENSORS', nodes: ['camera', 'gps']},
];
const demoLinks = [['admin', 'gateway'], ['viewer', 'gateway'], ['gateway', 'edge'], ['gateway', 'drone'], ['rc', 'drone'], ['camera', 'drone'], ['gps', 'drone'], ['edge', 'camera']].map(([from, to], i) => ({id: `d${i}`, from, to}));
const stressTiers = () => [8, 6, 10, 8, 5, 3].map((count, t) => ({id: `t${t}`, label: `TIER ${t}`, nodes: Array.from({length: count}, (_, i) => `t${t}n${i}`)}));
const stressLinks = (() => {
  const all = stressTiers().flatMap(tier => tier.nodes), links = [];
  all.forEach((id, i) => { links.push({id: `s${i}a`, from: id, to: all[(i + 7) % all.length]}); if (i % 3 === 0) links.push({id: `s${i}b`, from: id, to: all[(i + 19) % all.length]}); });
  return links;
})();

/** Every property the layout promises, on every page, for one set of tiers in one body. */
function checkLayout(tiers, links, body, label) {
  const first = layoutTiers(tiers, links, body), seen = new Map();
  assert.ok(first.form, `${label}: some form fits`);
  for (let page = 0; page < first.pages; page += 1) {
    const layout = layoutTiers(tiers, links, body, {page}), boxes = Object.entries(layout.boxes);
    assert.ok(layout.fits, `${label}, page ${page}: fits its body`);
    for (const [id, box] of boxes) {
      assert.ok(!seen.has(id), `${label}: ${id} on one page only`);
      seen.set(id, page);
      assert.ok([box.x, box.y, box.width, box.height].every(Number.isInteger), `${label}: ${id} in whole pixels`);
      assert.ok(box.x >= body.x && box.y >= body.y && box.x + box.width <= body.x + body.width && box.y + box.height <= body.y + body.height, `${label}: ${id} inside the body`);
    }
    for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) {
      const [, a] = boxes[i], [, z] = boxes[j];
      assert.ok(a.x + a.width <= z.x || z.x + z.width <= a.x || a.y + a.height <= z.y || z.y + z.height <= a.y, `${label}: ${boxes[i][0]} and ${boxes[j][0]} do not overlap`);
    }
    for (const route of [...layout.routes, ...(layout.stubs ?? [])]) {
      for (let k = 1; k < route.points.length; k += 1) {
        const [x1, y1] = route.points[k - 1], [x2, y2] = route.points[k];
        assert.ok(x1 === x2 || y1 === y2, `${label}: ${route.link} runs straight across or down`);
        assert.ok([x1, y1, x2, y2].every(v => Number.isInteger(v)), `${label}: ${route.link} in whole pixels`);
        assert.ok(Math.min(x1, x2) >= body.x && Math.max(x1, x2) <= body.x + body.width && Math.min(y1, y2) >= body.y && Math.max(y1, y2) <= body.y + body.height, `${label}: ${route.link} inside the body`);
        for (const [id, box] of boxes) {
          // Never through a node: the segment may touch the edge of its own two ends, never cross an inside.
          const left = Math.min(x1, x2), right = Math.max(x1, x2), top = Math.min(y1, y2), bottom = Math.max(y1, y2);
          const crosses = left < box.x + box.width - 1 && right > box.x && top < box.y + box.height - 1 && bottom > box.y;
          assert.ok(!crosses, `${label}: ${route.link} passes through ${id}`);
        }
      }
    }
  }
  const all = tiers.flatMap(tier => tier.nodes);
  assert.deepEqual([...seen.keys()].sort(), [...all].sort(), `${label}: every node on a page`);
}

const SIZES = [[616, 704], [616, 744], [832, 744], [480, 360], [320, 240]];

test('the topology lays out the synthetic system, the compact demo and a stress set at every size, inside the box and never through a node', () => {
  for (const [width, height] of SIZES) {
    const body = {x: 12, y: 80, width: width - 8, height: height - 70 - (width >= 360 ? 74 : 0) - 6 - 16};
    checkLayout(realTiers(), LINKS, body, `real ${width}x${height}`);
    checkLayout(demoTiers(), demoLinks, body, `demo ${width}x${height}`);
    if (width >= 480) checkLayout(stressTiers(), stressLinks, body, `stress ${width}x${height}`);
  }
});

test('the three diagrams paint whole pixels inside their box at every size', () => {
  for (const kind of ['topology', 'command-path', 'chains']) for (const [width, height] of [...SIZES, [304, 208], [832, 480]]) {
    resetArchSelection();
    const ctx = recorder({strict: true}), bounds = {x: 8, y: 16, width, height};
    paintArchView(ctx, kind, bounds);
    assert.ok(ctx.bounds, `${kind} at ${width}x${height} paints`);
    assert.ok(ctx.depth === 0 && !ctx.unbalanced, `${kind} at ${width}x${height} restores what it saves`);
    assert.ok(boundsInside(ctx, bounds), `${kind} at ${width}x${height} stays in its box`);
  }
});

test('at the size of the System box every node fits one page, and a click on a node picks it', () => {
  resetArchSelection();
  const bounds = {x: 0, y: 40, width: 616, height: 704}, {layout} = topologyLayoutFor(bounds);
  assert.equal(layout.pages, 1, 'one page at the owner\'s size');
  assert.equal(layout.form.name, 'full', 'full-size nodes');
  for (const [id, box] of Object.entries(layout.boxes)) {
    resetArchSelection();
    activateArchView('topology', {x: box.x + Math.floor(box.width / 2), y: box.y + Math.floor(box.height / 2)}, bounds);
    assert.equal(getArchSelection().id, id, `a click on ${id} picks it`);
  }
  resetArchSelection();
});

test('a pick fills the six System boxes for every node, module and person, and the legacy shape stays whole', () => {
  const items = design.pages.system, six = ['device details', 'device info', 'location', 'installed modules', 'sensor types', 'device management'].map(label => items.find(rect => rect.label === label));
  assert.ok(six.every(Boolean), 'the owner\'s six boxes are on System');
  for (const id of [...NODES.map(node => node.id), ...MODULES.map(module => module.id)]) {
    resetUi(); resetArchSelection();
    assert.ok(selectArch(id) || id === 'flight-orin', `${id} can be picked`);
    const legacy = getSystemTopologyState().selected;
    for (const key of ['id', 'name', 'type', 'subtype', 'model', 'location']) assert.equal(typeof legacy[key], 'string', `${id}: legacy ${key}`);
    assert.ok(Array.isArray(legacy.sensors) && Array.isArray(legacy.modules), `${id}: legacy lists`);
    for (const rect of six) {
      const ctx = raster({strict: true});
      assert.ok(preview.paintDesignElement(ctx, rect, {page: 'system', allRects: items}), `${id}: ${rect.label} has a painter`);
      assert.ok(ctx.pixels.size > 0, `${id}: ${rect.label} paints something`);
    }
  }
  resetArchSelection();
});

test('device management does nothing for the observer, and only shows what the operator\'s lease would allow', () => {
  const items = design.pages.system, rect = items.find(entry => entry.label === 'device management');
  const paintOf = () => { const ctx = raster({strict: true}); preview.paintDesignElement(ctx, rect, {page: 'system', allRects: items}); return digest(ctx.calls); };
  const lowerClicks = () => {
    const results = [];
    for (let y = 0.42; y < 0.98; y += 0.04) for (let x = 0.05; x < 1; x += 0.06) results.push(preview.activateDesignElement(rect, {x, y}, {page: 'system', allRects: items}));
    return results;
  };
  resetUi(); resetArchSelection(); selectArch('sim-robot'); setArchPerson('observer');
  const before = paintOf();
  assert.ok(lowerClicks().every(result => result === false), 'no button of the observer acts');
  assert.equal(paintOf(), before, 'and nothing changed');
  // The operator may take the lease of a robot: a preview of it, nothing is sent.
  setArchPerson('operator');
  assert.ok(lowerClicks().some(result => result === true), 'the operator\'s buttons act in the preview');
  // Not a robot: nothing to lease, so nothing acts for anyone.
  resetUi(); selectArch('base-orin'); setArchPerson('operator');
  assert.ok(lowerClicks().every(result => result === false), 'a link device has no lease');
  resetUi(); resetArchSelection();
});

// The layout to import: made from the outline and the owner's export, it keeps every box of the owner,
// passes the editor's own checks, and the panel map covers every box it adds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeDesign, DESIGN_PAGES} from '../dist/blank-state.js';
import {OUTLINE, LINKED_PAGES, STEPS, FLOW_BOARD_WINDOWS} from '../dist/designer-outline.js';
import {PANEL_MAP, PANEL_STATES, ADAPTERS} from '../dist/designer-panel-map.js';
import {buildLayout} from '../tools/build-designer-layout.mjs';

const here = file => new URL(file, import.meta.url);
const committed = JSON.parse(readFileSync(here('../handoff/designer/arachnid.flow-design.json'), 'utf8'));
const keptIds = new Set(OUTLINE.flatMap(page => page.panels.filter(panel => panel.kept).map(panel => panel.id)));
const base = {...committed, pages: Object.fromEntries(Object.entries(committed.pages).map(([id, shapes]) => [id, shapes.filter(shape => keptIds.has(shape.id))]))};
const layout = buildLayout(base);
const rects = page => layout.pages[page].filter(shape => shape.type === 'rectangle');
const inside = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const apart = (a, b) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

test('the layout passes the editor\'s own checks and equals the file to import', () => {
  assert.deepEqual(normalizeDesign(layout), layout);
  assert.deepEqual(committed, layout, 'run node tools/build-designer-layout.mjs after changing the outline');
  assert.ok(JSON.stringify(layout).length < 1024 * 1024, 'under the 1 MB import limit');
});

test('every box of the owner is kept as it was: id, place, label and link', () => {
  const mine = Object.values(normalizeDesign(base).pages).flat();
  assert.equal(mine.length, 19);
  const now = new Map(Object.values(layout.pages).flat().map(shape => [shape.id, shape]));
  for (const shape of mine) assert.deepEqual(now.get(shape.id), shape);
  for (const page of DESIGN_PAGES) for (const shape of normalizeDesign(base).pages[page.id]) assert.ok(layout.pages[page.id].some(entry => entry.id === shape.id), `${shape.id} stays on ${page.id}`);
});

test('running it again on its own output adds nothing and moves nothing', () => {
  assert.deepEqual(buildLayout(layout), layout);
  // A box the owner moved after the import stays where the owner put it.
  const moved = structuredClone(layout), box = moved.pages.system.find(shape => shape.id === 'system-topology');
  box.x = 2; box.width = 70;
  assert.deepEqual(buildLayout(moved).pages.system.find(shape => shape.id === 'system-topology'), box);
});

test('the linked pages: the six steps, the four views of System, the pages beside the flow and the three of the owner', () => {
  assert.deepEqual(layout.hiddenPages.map(page => page.id).sort(), ['sign-in', 'sign-up', 'reset-password', ...LINKED_PAGES.map(page => page.id).filter(id => !['sign-in', 'sign-up', 'reset-password'].includes(id))].sort());
  assert.equal(layout.hiddenPages.length, 19);
  for (const step of STEPS) assert.ok(layout.pages[step.page], `${step.name} has its page`);
});

test('on every page boxes stand side by side or one inside another, never half over one another', () => {
  for (const page of Object.keys(layout.pages)) {
    const all = rects(page);
    for (let i = 0; i < all.length; i += 1) for (let j = i + 1; j < all.length; j += 1) {
      const a = all[i], c = all[j];
      assert.ok(apart(a, c) || inside(a, c) || inside(c, a), `${page}: "${a.label}" and "${c.label}" overlap in part`);
    }
  }
});

test('labels are unique on a page, every link opens a page that exists, and System has one topology', () => {
  for (const [page, shapes] of Object.entries(layout.pages)) {
    const labels = shapes.map(shape => shape.label.trim().toLowerCase());
    assert.equal(new Set(labels).size, labels.length, `${page}: a label used twice`);
    for (const shape of shapes) if (shape.link) assert.ok(layout.pages[shape.link], `${shape.id} links to ${shape.link}`);
  }
  assert.equal(rects('system').filter(shape => /^(system )?topology$/i.test(shape.label.trim())).length, 1);
});

test('the step chain: RETURN at the left, the six steps, NEXT at the right, on the Site tab and on every step page', () => {
  for (const page of ['site', ...STEPS.map(step => step.page)]) {
    const chain = rects(page).filter(shape => /^(return|next|step \d: )/.test(shape.label));
    assert.equal(chain.length, 8, page);
    const left = Math.min(...chain.map(shape => shape.x)), right = Math.max(...chain.map(shape => shape.x + shape.width));
    assert.equal(chain.find(shape => shape.label === 'return').x, left, `${page}: RETURN is at the left`);
    assert.equal(chain.find(shape => shape.label === 'next').x + chain.find(shape => shape.label === 'next').width, right, `${page}: NEXT is at the right`);
  }
  // RUN is reached from SIMULATE's NEXT; SITE's RETURN on the first step goes back to the Site tab.
  assert.equal(rects('site-simulate').find(shape => shape.label === 'next').link, 'site-run');
  assert.equal(rects('site-find').find(shape => shape.label === 'return').link, 'site');
});

test('the panel map: every labelled box of the layout has a binding that names an adapter and what exists today', () => {
  for (const shape of Object.values(layout.pages).flat()) {
    const binding = PANEL_MAP[shape.id];
    assert.ok(binding, `${shape.id} (${shape.label}) has a binding`);
    assert.ok(ADAPTERS.includes(binding.adapter), `${shape.id}: adapter ${binding.adapter}`);
    assert.ok(Object.hasOwn(PANEL_STATES, binding.state), `${shape.id}: state ${binding.state}`);
    if (binding.state === 'working') assert.ok(binding.where, `${shape.id}: a box that works says where`);
  }
  assert.equal(Object.keys(PANEL_MAP).length, Object.values(layout.pages).flat().length);
});

test('every window of the flow board is taken in by a page of the outline', () => {
  assert.equal(Object.keys(FLOW_BOARD_WINDOWS).length, 33);
  const pages = new Set(OUTLINE.map(page => page.id));
  for (const [window, page] of Object.entries(FLOW_BOARD_WINDOWS)) assert.ok(pages.has(page), `${window} goes to ${page}`);
});

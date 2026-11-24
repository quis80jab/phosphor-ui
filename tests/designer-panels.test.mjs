// The atlas adapter's panel painters: every box of the generated layout has one, each paints whole
// pixels inside its box at any size and never inside the boxes nested in it, a click that says it
// changed something changes what is painted, and no painter carries a figure of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import * as preview from '../dist/designer-preview.js';
import {registeredLabels} from '../dist/designer-panels/index.js';
import {resetUi} from '../dist/designer-panels/state.js';
import {resetArchSelection} from '../dist/designer-arch-view.js';
import {raster, recorder, insideBox, boundsInside, digest, litPixels} from './helpers/raster.mjs';

const here = file => new URL(file, import.meta.url);
const text = () => readFileSync(here('../handoff/designer/arachnid.flow-design.json'), 'utf8');
const design = JSON.parse(text());
const fresh = () => { resetUi(); resetArchSelection(); };
const boxOf = rect => ({x: rect.x * 8, y: rect.y * 8, width: rect.width * 8, height: rect.height * 8});
const within = (outer, inner) => inner.id !== outer.id && inner.width * inner.height < outer.width * outer.height && inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
const every = function* () { for (const [page, items] of Object.entries(design.pages)) for (const rect of items) if (rect.type === 'rectangle') yield {page, items, rect}; };
const paint = (rect, page, items) => { const ctx = raster({strict: true}); preview.paintDesignElement(ctx, rect, {page, allRects: items}); return ctx; };
/** The same paint into the recorder: whole pixels, saves and restores balanced, nothing past the box. */
const record = (rect, page, items) => {
  const ctx = recorder({strict: true});
  preview.paintDesignElement(ctx, rect, {page, allRects: items});
  assert.ok(ctx.depth === 0 && !ctx.unbalanced, `${page}/${rect.label}: every save has its restore`);
  return ctx;
};

test('every labelled box of the generated layout has a painter in the atlas preview', () => {
  const missing = [...every()].filter(({rect, page}) => !preview.hasDesignElement(rect, page)).map(({rect, page}) => `${page}/${rect.label}`);
  assert.deepEqual(missing, []);
});

test('each painter paints whole pixels inside its box, and nothing inside a box nested in it', () => {
  for (const {page, items, rect} of every()) {
    fresh();
    const ctx = paint(rect, page, items), box = boxOf(rect);
    assert.ok(ctx.pixels.size > 0, `${page}/${rect.label} paints something`);
    assert.ok(insideBox(ctx, box), `${page}/${rect.label} stays in its box`);
    for (const child of items.filter(other => other.type === 'rectangle' && within(rect, other))) {
      const c = boxOf(child);
      assert.ok(!litPixels(ctx).some(([x, y]) => x >= c.x && y >= c.y && x < c.x + c.width && y < c.y + c.height), `${page}/${rect.label} paints nothing inside ${child.label}`);
    }
  }
});

test('each painter holds at its smallest, at a middling size and across a whole page', () => {
  for (const {page, items, rect} of every()) {
    for (const [width, height] of [[4, 2], [12, 6], [rect.width, rect.height], [104, 93]]) {
      fresh();
      const resized = {...rect, width, height}, others = items.filter(other => other.id !== rect.id && !within(rect, other));
      const ctx = record(resized, page, [...others, resized]);
      assert.ok(boundsInside(ctx, boxOf(resized)), `${page}/${rect.label} at ${width}x${height} stays in its box`);
    }
  }
});

test('a click that says it changed something changes what is painted, and a page it opens exists', () => {
  let changed = 0;
  for (const {page, items, rect} of every()) {
    fresh();
    const before = digest(record(rect, page, items).calls);
    for (let y = 0.05; y < 1; y += 0.15) for (let x = 0.05; x < 1; x += 0.15) {
      fresh();
      const result = preview.activateDesignElement(rect, {x, y}, {page, allRects: items});
      if (result && typeof result === 'object') { assert.ok(design.pages[result.navigate], `${page}/${rect.label} opens ${result.navigate}, a page of the layout`); continue; }
      if (result !== true) continue;
      changed += 1;
      assert.notEqual(digest(record(rect, page, items).calls), before, `${page}/${rect.label}: a click at ${x.toFixed(2)},${y.toFixed(2)} said it changed something`);
    }
  }
  assert.ok(changed > 100, `the previews answer clicks (${changed})`);
  fresh();
});

test('a click inside a box nested in a panel never lands on the panel under it', () => {
  for (const {page, items, rect} of every()) {
    for (const child of items.filter(other => other.type === 'rectangle' && within(rect, other))) {
      fresh();
      for (let y = 0.1; y < 1; y += 0.2) for (let x = 0.1; x < 1; x += 0.2) {
        const point = {x: (child.x + x * child.width - rect.x) / rect.width, y: (child.y + y * child.height - rect.y) / rect.height};
        assert.equal(preview.activateDesignElement(rect, point, {page, allRects: items}), false, `${page}/${rect.label} has a control under ${child.label}`);
      }
    }
  }
});

test('painting and clicking every preview leaves the layout document byte for byte as it was', () => {
  const before = text(), live = JSON.parse(before), frozen = JSON.stringify(live);
  for (const [page, items] of Object.entries(live.pages)) for (const rect of items) {
    fresh();
    if (!preview.hasDesignElement(rect, page)) continue;
    preview.paintDesignElement(recorder({strict: true}), rect, {page, allRects: items});
    preview.activateDesignElement(rect, {x: 0.5, y: 0.5}, {page, allRects: items});
  }
  assert.equal(JSON.stringify(live), frozen, 'the document in memory is untouched');
  assert.equal(text(), before, 'and the file too');
  fresh();
});

test('no painter carries a figure of its own: numbers with units come from the records or the architecture', () => {
  const unit = /\b\d+(?:\.\d+)?\s?(?:M|KM|CM|MM|S|MIN|H|HZ|FPS|%|KG|M\/S|MB|GB|KB|MBIT\/S|DEG|°)(?![A-Z\d])/i;
  for (const file of readdirSync(here('../dist/designer-panels'))) {
    const source = readFileSync(here(`../dist/designer-panels/${file}`), 'utf8').replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(/'([^'\\]*(?:\\.[^'\\]*)*)'|`([^`\\]*(?:\\.[^`\\]*)*)`/g)) {
      const literal = (match[1] ?? match[2]).replace(/\$\{[^}]*\}/g, '');
      assert.doesNotMatch(literal, unit, `${file}: "${literal}" holds a figure; put it in designer-records.js`);
    }
    assert.doesNotMatch(source, /designer-elements\.js|designer-topology\.js/, `${file}: the atlas painters never reach into the demo adapter`);
  }
});

test('the manifest names the registered painters, and the packaged handoff notes equal the source ones', () => {
  const manifest = JSON.parse(readFileSync(here('../handoff/component-manifest.json'), 'utf8')), preview = manifest.pages.find(page => page.id === 'blank').preview;
  assert.deepEqual(preview.registeredPanels, registeredLabels(), 'rerun the manifest update when a painter is added');
  assert.equal(preview.module, 'dist/designer-preview.js');
  assert.equal(preview.recognizedLabels.length, 21, 'the demo adapter still recognizes its 21 names');
  for (const name of ['HANDOFF.md', 'COMPONENTS.md', 'component-manifest.json']) {
    assert.equal(readFileSync(here(`../dist/handoff/${name}`), 'utf8'), readFileSync(here(`../handoff/${name}`), 'utf8'), `dist/handoff/${name}: run node tools/prepare-handoff.mjs`);
  }
});

test('the registry knows every painter by page and label, and the shared ones by kind', () => {
  const labels = registeredLabels();
  for (const shared of ['*/step', '*/return', '*/next', '*/view', '*/link']) assert.ok(labels.includes(shared), shared);
  assert.ok(!labels.includes('*/sign up') && !labels.includes('*/reset password'), 'the sign-in page links to its two pages through the shared link painter');
  for (const label of labels.filter(entry => !entry.startsWith('*/'))) {
    const at = label.indexOf('/'), page = label.slice(0, at), name = label.slice(at + 1);
    assert.ok(design.pages[page]?.some(rect => rect.label.trim().toLowerCase().replace(/\s+/g, ' ') === name), `${label} paints a box that exists`);
  }
});

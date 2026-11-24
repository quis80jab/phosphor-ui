// The demo adapter is today's preview, unchanged: with ?data=demo the dispatcher and the diagram
// module must paint, and answer clicks, exactly as designer-elements.js and designer-topology.js did
// when tests/fixtures/designer-demo.json was recorded (tools/record-designer-fixture.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeDesign} from '../dist/blank-state.js';
import {OUTLINE} from '../dist/designer-outline.js';
import {setPreviewData, previewData} from '../dist/designer-data.js';
import * as preview from '../dist/designer-preview.js';
import * as topology from '../dist/designer-arch-view.js';
import {runSequence} from './helpers/designer-sequence.mjs';

const here = file => new URL(file, import.meta.url);
const fixture = JSON.parse(readFileSync(here('./fixtures/designer-demo.json'), 'utf8'));
const full = JSON.parse(readFileSync(here('../handoff/designer/arachnid.flow-design.json'), 'utf8'));
const keptIds = new Set(OUTLINE.flatMap(page => page.panels.filter(panel => panel.kept).map(panel => panel.id)));
const base = normalizeDesign({...full, pages: Object.fromEntries(Object.entries(full.pages).map(([id, shapes]) => [id, shapes.filter(shape => keptIds.has(shape.id))]))});

test('today\'s two preview modules are kept byte for byte', () => {
  for (const [file, hash] of Object.entries(fixture.source)) {
    assert.equal(createHash('sha256').update(readFileSync(here(`../${file}`))).digest('hex'), hash, `${file} must not change: it is the demo adapter`);
  }
});

test('with the demo adapter the owner\'s layout paints and clicks exactly as it did', () => {
  assert.equal(previewData(), 'atlas', 'atlas is the default when the address asks for nothing');
  setPreviewData('demo');
  try {
    const seen = runSequence(base, preview, topology);
    assert.deepEqual(seen.before, fixture.before, 'the first paint of every box and of the topology');
    assert.deepEqual(seen.clicks, fixture.clicks, 'the same clicks change the same things');
    assert.deepEqual(seen.after, fixture.after, 'and paint the same afterwards');
  } finally {
    setPreviewData('atlas');
  }
});

test('the data adapter is atlas or demo and nothing else', () => {
  assert.throws(() => setPreviewData('live'), RangeError);
  assert.equal(previewData(), 'atlas');
});

test('blank.js reaches the previews and the topology only through the dispatcher and the diagram module', () => {
  const blank = readFileSync(here('../dist/blank.js'), 'utf8');
  assert.match(blank, /from '\.\/designer-preview\.js';/);
  assert.match(blank, /from '\.\/designer-arch-view\.js';/);
  assert.doesNotMatch(blank, /designer-elements\.js|designer-topology\.js/);
});

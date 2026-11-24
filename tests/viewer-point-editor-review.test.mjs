import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import { createPointEditor } from '../dist/viewer-point-editor.js';

function source(records) {
  const mesh = new THREE.Object3D(), packed = new Uint32Array(records.length * 4);
  const other = new Uint32Array(records.length * 4), sh = new Uint32Array([0xffffffff, 0xdeadbeef, 0x12345678]);
  for (let i = 0; i < records.length; i++) {
    packed.set([0x10000000 + i, 0x20000000 + i, 0x30000000 + i,
      ((0xbeef << 16) | THREE.DataUtils.toHalfFloat(records[i].opacity ?? 1)) >>> 0], i * 4);
    other.set([i, i + 100, i + 200, i + 300], i * 4);
  }
  const reused = { center: new THREE.Vector3(), color: new THREE.Color(), opacity: 1 };
  mesh.numSplats = records.length; mesh.uploads = 0;
  mesh.extSplats = {
    extArrays: [packed, other], extra: { sh1: sh }, textures: [{}],
    getSplat(id) {
      const point = records[id];
      reused.center.set(...point.position); reused.color.setRGB(...(point.color || [.5,.5,.5]));
      reused.opacity = THREE.DataUtils.fromHalfFloat(packed[id * 4 + 3] & 0xffff);
      return reused;
    }
  };
  mesh.updateGenerator = () => mesh.uploads++;
  mesh.updateVersion = () => {};
  return { mesh, packed, other, sh };
}
const point = (x, y, z, color, opacity = 1) => ({ position: [x,y,z], color, opacity });
function view() {
  const camera = new THREE.OrthographicCamera(-1,1,1,-1,.1,10);
  camera.position.z = 5; camera.lookAt(0,0,0); camera.updateMatrixWorld();
  return { camera, pivot: new THREE.Group(), rect: { width: 100, height: 100 } };
}
const square = (left, top, right, bottom) => [{x:left,y:top},{x:right,y:top},{x:right,y:bottom},{x:left,y:bottom}];
const selectedRanges = (editor, name = 'Selection') => {
  const id = editor.createGroup(name);
  return editor.getSnapshot().groups.find(group => group.id === id).indices;
};
function slicedClock(t) {
  let time = 0;
  t.mock.method(performance, 'now', () => (time += 10));
}
const manyPoints = () => Array.from({ length: 5000 }, (_, id) => point(id % 2 ? .5 : -.5, 0, 0));

test('initial deletion, group-only mutations and restore preserve every non-opacity word and SH bit', async () => {
  const { mesh, packed, other, sh } = source([point(-.5,0,0,[0,0,0]),point(0,0,0,[1,1,1]),point(.5,0,0,[.5,.5,.5])]);
  const original = packed.slice(), originalOther = other.slice(), originalSH = sh.slice(), updates = [];
  const groups = [{ id:'saved', name:'Saved', indices:[[0,2]] }];
  const editor = await createPointEditor(mesh, { snapshot:{deleted:[[1,1]],groups}, onChange:update => updates.push(update) });
  assert.equal(packed[7], 0xbeef0000);
  assert.equal(editor.deleteRevision, 1);
  assert.equal(editor.getSummary().visible, 2);
  assert.equal(editor.getSummary().histogram[0], 1);
  assert.equal(editor.getSummary().histogram[6], 1);
  editor.selectAll();
  assert.equal(editor.getSummary().selectedHistogram.reduce((a,b) => a+b, 0), 2);
  const uploads = mesh.uploads;
  editor.createGroup('Visible');
  assert.equal(editor.deleteRevision, 1, 'an unsigned high-bit word must not look newly changed when already hidden');
  assert.equal(mesh.uploads, uploads, 'group-only edits must not re-upload point opacity');
  assert.equal(updates.at(-1).deletedChanged, false);
  assert.equal(editor.restorePoints(), 1);
  assert.deepEqual(packed, original);
  assert.equal(editor.getSummary().selected, 2, 'restoration retains the live selection');
  assert.equal(editor.getSummary().groups.length, 2);
  assert.equal(editor.undo(), true);
  assert.equal(packed[7], 0xbeef0000);
  for (let i = 0; i < packed.length; i++) if (i !== 7) assert.equal(packed[i], original[i]);
  assert.deepEqual(other, originalOther); assert.deepEqual(sh, originalSH);
  assert.equal(editor.getSummary().selectedHistogram.reduce((a,b) => a+b, 0), 2);
  assert.equal(editor.getSummary().histogram.reduce((a,b) => a+b, 0), 2);
  const summary = editor.getSummary(); summary.histogram[0] = 999;
  assert.equal(editor.getSummary().histogram[0], 1, 'summary histograms cannot mutate cached counts');
  editor.dispose();
});

test('click selects nearest original ID while polygons select through depth and skip hidden or clipped records', async () => {
  const { mesh } = source([
    point(-.5,0,0), point(0,0,0), point(0,0,1), point(.5,0,0,undefined,0),
    point(4,0,0), point(0,0,10), point(0,0,-20), point(.5,0,0)
  ]);
  const editor = await createPointEditor(mesh, { snapshot:{deleted:[[7,7]]} }), setup = view();
  await editor.selectScreen({...setup,point:{x:50,y:50}});
  assert.deepEqual(selectedRanges(editor), [[2,2]], 'click tie resolves the closer depth without renumbering IDs');
  await editor.selectScreen({...setup,polygon:square(45,45,55,55)});
  assert.deepEqual(selectedRanges(editor), [[1,2]]);
  await editor.selectScreen({...setup,point:{x:50,y:50},mode:'subtract'});
  assert.deepEqual(selectedRanges(editor), [[1,1]]);
  await editor.selectScreen({...setup,polygon:square(0,0,100,100)});
  assert.deepEqual(selectedRanges(editor), [[0,2]], 'transparent, deleted, offscreen, behind and far points are excluded');
  setup.pivot.position.x = .5;
  await editor.selectScreen({...setup,point:{x:50,y:50}});
  assert.deepEqual(selectedRanges(editor), [[0,0]], 'turntable matrix transforms cached original centers exactly once');
  const geometry = editor.group.children[0].geometry;
  assert.equal(geometry.drawRange.start, 0);
  assert.equal(geometry.drawRange.count, 1);
  assert.deepEqual([...geometry.attributes.position.array.subarray(0, geometry.drawRange.count * 3)], [-.5,0,0]);
  editor.dispose();
});

test('aborting sliced preparation leaves original packed records and SH untouched', async t => {
  const { mesh, packed, sh } = source(manyPoints()), original = packed.slice(), originalSH = sh.slice();
  const controller = new AbortController(), progress = [], updates = [];
  slicedClock(t);
  await assert.rejects(createPointEditor(mesh, {
    signal:controller.signal, snapshot:{deleted:[[0,4999]]}, onChange:update => updates.push(update),
    onProgress:value => { progress.push(value); controller.abort(); }
  }), {name:'AbortError'});
  assert.ok(progress[0] > 0 && progress[0] < 1, 'cancellation occurs during preparation, not only before it starts');
  assert.deepEqual(packed, original); assert.deepEqual(sh, originalSH);
  assert.equal(mesh.uploads, 0); assert.equal(updates.length, 0);
});

test('a new selection cancels stale projected hits and explicit cancellation preserves the last selection', async t => {
  const { mesh } = source(manyPoints()), updates = [];
  const editor = await createPointEditor(mesh, {onChange:update => updates.push(update)}), setup = view();
  slicedClock(t);
  const stale = editor.selectScreen({...setup,polygon:square(0,0,49,100)});
  assert.equal(editor.busy, true); assert.equal(editor.deleteSelected(), null, 'edits are blocked while selection scans');
  const fresh = editor.selectScreen({...setup,point:{x:75,y:50}});
  await Promise.all([stale,fresh]);
  assert.equal(editor.busy, false);
  assert.equal(editor.getSummary().selected, 1);
  assert.deepEqual(selectedRanges(editor), [[1,1]]);
  const changedCount = updates.filter(update => update.changed).length;
  const cancelled = editor.selectScreen({...setup,polygon:square(0,0,100,100)});
  editor.cancel(); await cancelled;
  assert.equal(editor.busy, false); assert.equal(editor.getSummary().selected, 1);
  assert.equal(updates.filter(update => update.changed).length, changedCount);
  editor.dispose();
});

test('disposal cancels an in-flight scan and releases highlight resources once', async t => {
  const { mesh } = source(manyPoints()), updates = []; let dirty = 0;
  const editor = await createPointEditor(mesh, {onChange:update => updates.push(update),onDirty:() => dirty++});
  const highlight = editor.group.children[0]; let geometries = 0, materials = 0;
  highlight.geometry.addEventListener('dispose', () => geometries++);
  highlight.material.addEventListener('dispose', () => materials++);
  slicedClock(t);
  const pending = editor.selectScreen({...view(),polygon:square(0,0,100,100)});
  editor.dispose(); const eventCount = updates.length, dirtyCount = dirty;
  await pending;
  editor.dispose(); editor.selectAll(); editor.clearSelection();
  await editor.selectScreen({...view(),point:{x:50,y:50}});
  assert.equal(updates.length, eventCount); assert.equal(dirty, dirtyCount);
  assert.equal(editor.getSummary().selected, 0);
  assert.equal(editor.group.children.length, 0);
  assert.equal(geometries, 1); assert.equal(materials, 1);
});

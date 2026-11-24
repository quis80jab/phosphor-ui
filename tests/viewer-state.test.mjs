import test from 'node:test';
import assert from 'node:assert/strict';
import { createViewerState, normalizeViewerState, loadViewerState, saveViewerState, exportViewerState } from '../dist/viewer-state.js';

const KEY = 'phosphor-inspection-viewer-v1';
const HOLOGRAM = { enabled:true, x:-.3, z:0, radius:.6, height:3, intensity:1, edge:1.4, pathGain:.18, falloff:1, offsetX:0, offsetZ:0, zoom:1 };
function useStorage(t, storage) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
}
function memoryStorage(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test('defaults and partial settings create independent layers', () => {
  const initial = createViewerState();
  assert.deepEqual(initial, { version: 1, asset: 'calibration', renderMode: 'voxels', voxelScale: 1, pointEdits: {}, hologram:HOLOGRAM, layers: { rgb: true, thermal: false, defect: true }, mark: 'dots', frame: 0, speed: 1, loop: true, view: 'iso', notes: '' });
  const input = { layers: { rgb: false }, notes: 'Keep my note' };
  const state = normalizeViewerState(input);
  assert.deepEqual(state.layers, { rgb: false, thermal: false, defect: true });
  assert.equal(state.notes, input.notes);
  input.layers.rgb = true; assert.equal(state.layers.rgb, false);
  state.layers.defect = false; assert.equal(initial.layers.defect, true);
  assert.deepEqual(createViewerState(), initial);
});

test('frame clamps, finite fractions survive, and speed uses only supported values', () => {
  assert.equal(normalizeViewerState({ frame: -5 }).frame, 0);
  assert.equal(normalizeViewerState({ frame: 5 }).frame, 1);
  assert.equal(normalizeViewerState({ frame: .375 }).frame, .375);
  assert.equal(normalizeViewerState({ frame: '0.75', speed: '0.5' }).frame, .75);
  assert.equal(normalizeViewerState({ speed: '0.5' }).speed, .5);
  for (const speed of [.25, .5, 1, 2]) assert.equal(normalizeViewerState({ speed }).speed, speed);
  for (const speed of [0, .3, 3, NaN, Infinity, null, true, '', []]) assert.equal(normalizeViewerState({ speed }).speed, 1);
  for (const frame of [NaN, Infinity, null, true, '', [], {}]) assert.equal(normalizeViewerState({ frame }).frame, 0);
});

test('enums and booleans reject coercion while false values persist', () => {
  for (const asset of ['calibration', 'surface', 'thermal', 'snow-globe', 'shopping-center', 'pumpkin', 'sf-waterfront']) assert.equal(normalizeViewerState({ asset }).asset, asset);
  for (const asset of ['snow', 'Snow globe', 'snowGlobe', 'Shopping center', 'shoppingCenter', '__proto__', 'constructor']) assert.equal(normalizeViewerState({ asset }).asset, 'calibration');
  for (const mark of ['dots', 'hashes', 'blocks', 'lines']) assert.equal(normalizeViewerState({ mark }).mark, mark);
  for (const view of ['iso', 'front', 'top', 'right']) assert.equal(normalizeViewerState({ view }).view, view);
  const invalid = normalizeViewerState({ asset: 'other', mark: 'DOTS', view: 'perspective', loop: 'false', layers: { rgb: 0, thermal: 'true', defect: null } });
  assert.deepEqual(invalid, createViewerState());
  assert.equal(normalizeViewerState({ loop: false }).loop, false);
  assert.deepEqual(normalizeViewerState({ layers: { rgb: false, thermal: true, defect: false } }).layers, { rgb: false, thermal: true, defect: false });
});

test('notes retain Unicode, newlines and literal markup with a code-point limit', () => {
  const notes = 'Inspection note\n日本語 🛰️ <script>alert("literal")</script>';
  assert.equal(normalizeViewerState({ notes }).notes, notes);
  const long = normalizeViewerState({ notes: '🛰'.repeat(4005) }).notes;
  assert.equal(Array.from(long).length, 4000);
  assert.equal(long, '🛰'.repeat(4000));
});

test('inherited, pollution and transient playback fields never enter state', () => {
  const inherited = Object.create({ asset: 'thermal', frame: 1, notes: 'Inherited' });
  inherited.layers = Object.create({ rgb: false });
  assert.deepEqual(normalizeViewerState(inherited), createViewerState());
  const input = JSON.parse('{"playing":true,"__proto__":{"polluted":true},"layers":{"rgb":false,"playing":true,"__proto__":{"polluted":true}}}');
  const normalized = normalizeViewerState(input);
  assert.equal(Object.hasOwn(normalized, 'playing'), false);
  assert.equal(Object.hasOwn(normalized.layers, 'playing'), false);
  assert.equal(Object.hasOwn(normalized, '__proto__'), false);
  assert.equal({}.polluted, undefined);
});

test('save/load/export roundtrip and old storage remain independent', t => {
  const storage = memoryStorage([['phosphor-screen-settings-v1', 'old display'], ['phosphor-component-workbench-v1', 'old workbench']]);
  useStorage(t, storage);
  assert.deepEqual(loadViewerState(), { state: createViewerState() });
  const input = { asset: 'thermal', layers: { rgb: false, thermal: true, defect: false }, mark: 'hashes', frame: .61, speed: .25, loop: false, view: 'right', notes: 'Case-sensitive\nNote', playing: true };
  const expected = normalizeViewerState(input);
  assert.deepEqual(saveViewerState(input), { ok: true });
  assert.deepEqual(loadViewerState(), { state: expected });
  const exported = JSON.parse(exportViewerState(input));
  assert.deepEqual(exported, { format: 'phosphor-inspection-viewer', version: 1, state: expected });
  assert.equal(storage.values.get(KEY).includes('playing'), false);
  assert.equal(storage.values.get('phosphor-screen-settings-v1'), 'old display');
  assert.equal(storage.values.get('phosphor-component-workbench-v1'), 'old workbench');
});

test('valid partial stored state migrates defaults and ignores old playing', t => {
  useStorage(t, memoryStorage([[KEY, JSON.stringify({ version: 1, frame: .2, notes: 'Existing', playing: true })]]));
  assert.deepEqual(loadViewerState(), { state: normalizeViewerState({ frame: .2, notes: 'Existing' }) });
});

test('all imported scenes persist without loader state or loss of inactive inspection layers', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  for (const asset of ['snow-globe', 'shopping-center', 'pumpkin']) {
    const input = { asset, layers: { rgb: false, thermal: true, defect: true },
      mark: 'blocks', frame: .375, speed: .5, loop: false, view: 'front',
      notes: `Keep Case\n${asset} 🥐 🌳 <literal>`, playing: true, assetAvailable: false,
      assetStatus: 'loading', sceneStatus: 'error' };
    const expected = normalizeViewerState(input);
    assert.equal(expected.asset, asset);
    assert.deepEqual(saveViewerState(input), { ok: true });
    assert.deepEqual(loadViewerState(), { state: expected });
    assert.deepEqual(JSON.parse(exportViewerState(input)).state, expected);
    assert.equal(expected.notes, input.notes);
    assert.deepEqual(expected.layers, input.layers, 'temporarily unavailable layers must retain user settings');
    const saved = JSON.parse(storage.values.get(KEY));
    for (const transient of ['playing', 'assetAvailable', 'assetStatus', 'sceneStatus']) {
      assert.equal(Object.hasOwn(saved, transient), false);
    }
  }
});

test('existing version-one setups survive switching between all imported scenes unchanged', t => {
  const storage = memoryStorage([['phosphor-screen-settings-v1', 'original optical setup'],
    ['phosphor-component-workbench-v1', 'original component notes']]);
  useStorage(t, storage);
  for (const asset of ['calibration', 'surface', 'thermal']) {
    const previous = { version: 1, asset, layers: { rgb: true, thermal: true, defect: false },
      mark: 'hashes', frame: .7125, speed: 2, loop: false, view: 'right', notes: `Original ${asset}\n保持 🛰` };
    const raw = JSON.stringify(previous); storage.values.set(KEY, raw);
    const loaded = loadViewerState();
    assert.deepEqual(loaded, { state: { ...previous, renderMode: 'voxels', voxelScale: 1, pointEdits: {}, hologram:HOLOGRAM } });
    assert.equal(storage.values.get(KEY), raw, 'loading an old setup must not rewrite it');
    let current = loaded.state;
    for (const importedAsset of ['snow-globe', 'shopping-center', 'pumpkin', 'snow-globe']) {
      assert.deepEqual(saveViewerState({ ...current, asset: importedAsset }), { ok: true });
      current = loadViewerState().state;
      assert.equal(current.asset, importedAsset);
      assert.deepEqual({ ...current, asset }, { ...previous, renderMode: 'voxels', voxelScale: 1, pointEdits: {}, hologram:HOLOGRAM });
      assert.deepEqual(JSON.parse(exportViewerState(current)).state, current);
    }
    assert.deepEqual(saveViewerState({ ...current, asset }), { ok: true });
    assert.deepEqual(loadViewerState(), { state: { ...previous, renderMode: 'voxels', voxelScale: 1, pointEdits: {}, hologram:HOLOGRAM } });
  }
  assert.equal(storage.values.get('phosphor-screen-settings-v1'), 'original optical setup');
  assert.equal(storage.values.get('phosphor-component-workbench-v1'), 'original component notes');
  assert.equal(storage.values.has(`${KEY}-recovery`), false);
});

test('minimal version-one records recognize every imported scene without a recovery rewrite', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  for (const asset of ['snow-globe', 'shopping-center', 'pumpkin']) {
    const raw = JSON.stringify({ version: 1, asset }); storage.values.set(KEY, raw);
    assert.deepEqual(loadViewerState(), { state: { ...createViewerState(), asset } });
    assert.equal(storage.values.get(KEY), raw);
    assert.equal(storage.values.has(`${KEY}-recovery`), false);
  }
});

test('malformed stored data is preserved with recovery warnings', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  for (const raw of ['{broken', 'null', '[]', '{}', '{"version":2,"asset":"surface"}', '{"version":1,"unknown":true}']) {
    storage.values.set(KEY, raw);
    const loaded = loadViewerState();
    assert.deepEqual(loaded.state, createViewerState()); assert.match(loaded.warning, /recovery copy was kept/);
    assert.equal(storage.values.get(KEY), raw); assert.equal(storage.values.get(`${KEY}-recovery`), raw);
  }
  storage.setItem = () => { throw new Error('quota'); };
  assert.match(loadViewerState().warning, /could not be saved/);
});

test('storage denial never throws or reports a successful save', t => {
  useStorage(t, { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } });
  assert.equal(saveViewerState(createViewerState()).ok, false);
  assert.match(loadViewerState().warning, /session only/);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('security'); } });
  assert.equal(saveViewerState(createViewerState()).ok, false);
  assert.deepEqual(loadViewerState().state, createViewerState());
});


test('voxel, VFD splat and smooth modes roundtrip all inspection settings independently', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  for (const renderMode of ['voxels', 'vfd', 'smooth', 'voxels']) {
    const input = { version: 1, asset: 'pumpkin', renderMode, voxelScale: 1, pointEdits: {}, hologram:HOLOGRAM,
      layers: { rgb: false, thermal: true, defect: false }, mark: 'hashes',
      frame: .375, speed: .5, loop: false, view: 'right', notes: 'Keep this note\n保持' };
    assert.deepEqual(saveViewerState(input), { ok: true });
    assert.deepEqual(loadViewerState(), { state: input });
    assert.deepEqual(JSON.parse(storage.values.get(KEY)), input);
    assert.deepEqual(JSON.parse(exportViewerState(input)), { format: 'phosphor-inspection-viewer', version: 1, state: input });
  }
  assert.deepEqual([...storage.values.keys()], [KEY], 'mode changes must keep the existing storage key');
  for (const renderMode of ['VFD', 'SMOOTH', 'VOXELS', '__proto__', false, null, 0, ['smooth']]) {
    assert.equal(normalizeViewerState({ renderMode }).renderMode, 'voxels');
  }
});

test('legacy splats migrate to VFD while saved voxel setups retain their geometry mode', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  for (const renderMode of ['voxels', 'splats']) {
    const previous = { version: 1, asset: 'shopping-center', renderMode,
      layers: { rgb: false, thermal: true, defect: true }, mark: 'blocks',
      frame: .7125, speed: 2, loop: false, view: 'top', notes: `Existing ${renderMode}\n日本語 🛰` };
    const expected = { ...previous, renderMode: renderMode === 'splats' ? 'vfd' : 'voxels', voxelScale: 1, pointEdits: {}, hologram:HOLOGRAM };
    const raw = JSON.stringify(previous); storage.values.set(KEY, raw);
    assert.deepEqual(normalizeViewerState(previous), expected);
    assert.deepEqual(loadViewerState(), { state: expected });
    assert.equal(storage.values.get(KEY), raw, 'loading a legacy mode must not silently rewrite its record');
    assert.equal(storage.values.has(`${KEY}-recovery`), false, 'legacy modes are valid version-one records');
    assert.deepEqual(JSON.parse(exportViewerState(previous)).state, expected);
    assert.deepEqual(saveViewerState(previous), { ok: true });
    assert.deepEqual(JSON.parse(storage.values.get(KEY)), expected);
  }
});

test('voxel size clamps finite values and rejects coercion', () => {
  for (const [input, expected] of [[.125,.25],[.25,.25],[1.5,1.5],[8,8],[100,8],['2',2]]) {
    assert.equal(normalizeViewerState({voxelScale:input}).voxelScale, expected);
  }
  for (const voxelScale of [NaN,Infinity,null,true,'',[],{}]) assert.equal(normalizeViewerState({voxelScale}).voxelScale,1);
});

test('per-scene point edits persist independently with bounded ranges and no runtime selection or undo', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  const input = { ...createViewerState(), asset:'shopping-center', voxelScale:2.5, notes:'Keep notes',
    pointEdits:{
      pumpkin:{deleted:[[4,6],[0,2],[2,4],[1999999,3000000]],groups:[{id:'stem',name:'Stem',indices:[[8,10]]}],selection:[1],undo:[{}]},
      'snow-globe':{deleted:[],groups:[{id:'empty',name:'Empty',indices:[]}]},
      'shopping-center':{deleted:[[17,17]],groups:[]}, calibration:{deleted:[[0,10]]}, unknown:{deleted:[[0,10]]}
    }, selected:[3], undo:[{deleted:[1]}] };
  const expected = { ...createViewerState(), asset:'shopping-center', voxelScale:2.5, notes:'Keep notes',pointEdits:{
    pumpkin:{deleted:[[0,6],[1999999,1999999]],groups:[{id:'stem',name:'Stem',indices:[[8,10]]}]},
    'shopping-center':{deleted:[[17,17]],groups:[]},
    'snow-globe':{deleted:[],groups:[{id:'empty',name:'Empty',indices:[]}]}
  }};
  assert.deepEqual(normalizeViewerState(input),expected);
  assert.deepEqual(saveViewerState(input),{ok:true});
  assert.deepEqual(loadViewerState(),{state:expected});
  assert.deepEqual(JSON.parse(exportViewerState(input)).state,expected);
  input.pointEdits.pumpkin.groups[0].indices[0][0]=999;
  assert.equal(expected.pointEdits.pumpkin.groups[0].indices[0][0],8);
  assert.equal(storage.values.get(KEY).includes('selection'),false);
  assert.equal(storage.values.get(KEY).includes('undo'),false);
});

test('new partial version-one editing records load without recovery and inherited edits are ignored', t => {
  const storage = memoryStorage(); useStorage(t, storage);
  for (const partial of [{version:1,voxelScale:2},{version:1,pointEdits:{pumpkin:{deleted:[[1,2]]}}}]) {
    const raw=JSON.stringify(partial); storage.values.set(KEY,raw);
    assert.deepEqual(loadViewerState(),{state:normalizeViewerState(partial)});
    assert.equal(storage.values.get(KEY),raw);
    assert.equal(storage.values.has(`${KEY}-recovery`),false);
  }
  assert.deepEqual(normalizeViewerState({pointEdits:Object.create({pumpkin:{deleted:[[0,10]]}})}).pointEdits,{});
});

test('hologram settings clamp every control, preserve false and reject nonnumeric coercion', () => {
  const limits={x:[-1,1],z:[-1,1],radius:[.2,1],height:[1,5],intensity:[.2,3],edge:[0,3],pathGain:[0,1],falloff:[0,8],offsetX:[-4,4],offsetZ:[-4,4],zoom:[.55,12]};
  for(const [key,[min,max]] of Object.entries(limits)) {
    assert.equal(normalizeViewerState({hologram:{[key]:min-10}}).hologram[key],min);
    assert.equal(normalizeViewerState({hologram:{[key]:max+10}}).hologram[key],max);
    assert.equal(normalizeViewerState({hologram:{[key]:String((min+max)/2)}}).hologram[key],(min+max)/2);
    for(const invalid of [NaN,Infinity,null,true,'',[],{}])assert.equal(normalizeViewerState({hologram:{[key]:invalid}}).hologram[key],HOLOGRAM[key]);
  }
  assert.equal(normalizeViewerState({hologram:{enabled:false}}).hologram.enabled,false);
  for(const enabled of [0,1,'false',null])assert.equal(normalizeViewerState({hologram:{enabled}}).hologram.enabled,true);
  const inherited=Object.create({radius:1,enabled:false});
  assert.deepEqual(normalizeViewerState({hologram:inherited}).hologram,HOLOGRAM);
  const input={hologram:{x:.25}}, normalized=normalizeViewerState(input);input.hologram.x=1;
  assert.equal(normalized.hologram.x,.25);normalized.hologram.radius=.8;
  assert.deepEqual(createViewerState().hologram,HOLOGRAM);
});

test('waterfront and hologram settings persist separately from original scene point edits', t => {
  const storage=memoryStorage();useStorage(t,storage);
  const hologram={enabled:false,x:.3,z:-.4,radius:.7,height:4.5,intensity:2.2,edge:0,pathGain:.6,falloff:2.8,offsetX:1.25,offsetZ:-.75,zoom:5.25};
  const pointEdits={pumpkin:{deleted:[[2,4]],groups:[{id:'keep',name:'Keep',indices:[[7,9]]}]}};
  for(const asset of ['sf-waterfront','pumpkin','sf-waterfront']) {
    const input={...createViewerState(),asset,hologram,pointEdits:{...pointEdits,'sf-waterfront':{deleted:[[0,100]]}},notes:'Keep both modes'};
    const expected={...input,pointEdits};
    assert.deepEqual(saveViewerState(input),{ok:true});
    assert.deepEqual(loadViewerState(),{state:expected});
    assert.deepEqual(JSON.parse(exportViewerState(input)),{format:'phosphor-inspection-viewer',version:1,state:expected});
  }
  for(const partial of [{version:1,asset:'sf-waterfront'},{version:1,hologram:{enabled:false}},{version:1,hologram:{radius:.5}}]) {
    const raw=JSON.stringify(partial);storage.values.set(KEY,raw);
    assert.deepEqual(loadViewerState(),{state:normalizeViewerState(partial)});
    assert.equal(storage.values.get(KEY),raw);
    assert.equal(storage.values.has(`${KEY}-recovery`),false);
  }
});

test('map translation persists independently from projector aim and runtime scan offsets', () => {
  const state=normalizeViewerState({asset:'sf-waterfront',hologram:{x:.2,z:-.6,offsetX:-1.4,offsetZ:1.8,scanOffsetX:.5,scanOffsetZ:.7}});
  assert.equal(state.hologram.x,.2);assert.equal(state.hologram.z,-.6);
  assert.equal(state.hologram.offsetX,-1.4);assert.equal(state.hologram.offsetZ,1.8);
  assert.equal(Object.hasOwn(state.hologram,'scanOffsetX'),false);
  assert.equal(Object.hasOwn(state.hologram,'scanOffsetZ'),false);
  assert.deepEqual(normalizeViewerState({hologram:{x:.1,radius:.4}}).hologram,{...HOLOGRAM,x:.1,radius:.4});
});

test('legacy ray settings migrate to traced paths without overriding explicit path settings', t => {
  const storage=memoryStorage();useStorage(t,storage);
  storage.values.set(KEY,JSON.stringify({version:1,hologram:{rays:.7}}));
  const loaded=loadViewerState();
  assert.equal(loaded.warning,undefined);
  assert.equal(loaded.state.hologram.pathGain,.7);
  assert.equal(loaded.state.hologram.falloff,1);
  assert.equal(Object.hasOwn(loaded.state.hologram,'rays'),false);
  const state=normalizeViewerState({hologram:{rays:.7,pathGain:0,falloff:4.5}});
  assert.equal(state.hologram.pathGain,0);
  assert.equal(state.hologram.falloff,4.5);
  saveViewerState(state);
  assert.deepEqual(loadViewerState().state.hologram,state.hologram);
  assert.equal(storage.values.get(KEY).includes('"rays"'),false);
  assert.equal(normalizeViewerState({hologram:Object.create({rays:.9})}).hologram.pathGain,.18);
});

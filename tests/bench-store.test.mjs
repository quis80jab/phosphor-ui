import test from 'node:test';
import assert from 'node:assert/strict';
import { BENCH_CATALOG } from '../dist/bench-widgets.js?v=glyph-1';
import { createReferenceState } from '../dist/reference-screen.js?v=glyph-1';
import { createTransportState } from '../dist/transport-screen.js?v=glyph-1';
import {
  createBenchState, normalizeBenchState, normalizeWidget, saveBenchState,
  loadBenchState, exportBenchState, parseBenchFile
} from '../dist/bench-store.js';

const KEY = 'phosphor-component-workbench-v1';
const LEGACY_KEY = 'phosphor-screen-settings-v1';
const IDS = ['dial', 'wheel', 'bar', 'indicators', 'slider', 'percentage', 'search', 'buttons', 'toggle', 'stepper', 'level', 'segments'];
const envelope = state => JSON.stringify({ format: 'phosphor-workbench', version: 1, state });
function useStorage(t, storage) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: storage });
  t.after(() => previous ? Object.defineProperty(globalThis, 'localStorage', previous) : delete globalThis.localStorage);
}
function memoryStorage(entries = []) {
  const values = new Map(entries);
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}
function oldWorkbench() {
  const state = createBenchState();
  delete state.screens;
  for (const widget of Object.values(state.widgets)) delete widget.mark;
  state.widgets.dial.label = 'MiXeD user label';
  state.widgets.dial.value = 73;
  state.widgets.dial.color = '#a0B1c2';
  state.widgets.dial.notes = 'Keep this EXACTLY.\n日本語 <script>literal</script>';
  return state;
}

test('all real catalog components initialize without sharing defaults', () => {
  assert.deepEqual(BENCH_CATALOG.map(item => item.id).sort(), [...IDS].sort());
  const before = structuredClone(BENCH_CATALOG);
  const first = createBenchState(), second = createBenchState();
  assert.deepEqual(Object.keys(first.widgets).sort(), [...IDS].sort());
  assert.deepEqual(first.optics, { brightness: 100, glow: 25, contrast: 110, grid: 35, refraction: 0 });
  first.widgets.dial.active[0] = !first.widgets.dial.active[0];
  first.widgets.dial.label = 'Edited';
  first.optics.glow = 99;
  assert.notDeepEqual(first, second);
  assert.deepEqual(BENCH_CATALOG, before);
  assert.deepEqual(second, createBenchState());
});

test('notes, newlines, Unicode and literal markup survive JSON roundtrip', () => {
  const state = createBenchState();
  state.widgets.dial.notes = 'Line 1\nLine 2\n日本語 🛰️ <script>alert("x")</script>';
  state.widgets.dial.label = '<img src=x onerror=alert(1)>';
  state.widgets.search.query = 'αβ "quoted" \\ path';
  state.widgets.toggle.disabled = false;
  state.widgets.toggle.active = [false, true, false];
  assert.deepEqual(parseBenchFile(exportBenchState(state)), state);
});

test('bounds and quantization use min as origin and stay on the step grid', () => {
  const input = { min: 10, max: 20, step: 3, value: 20 };
  assert.equal(normalizeWidget(input).value, 19);
  assert.equal(normalizeWidget({ min: -5, max: 5, step: .25, value: -.12 }).value, 0);
  const decimal = normalizeWidget({ min: .1, max: 1, step: .1, value: .35 });
  assert.equal(decimal.value, .4);
  assert.deepEqual(normalizeWidget(decimal), decimal);
  const extremes = normalizeWidget({ min: -1e9, max: 1e9, step: 1e9, value: 1e9, size: 1000, option: -1 });
  assert.equal(extremes.min, -9999); assert.equal(extremes.max, 9999);
  assert.equal(extremes.step, 999); assert.equal(extremes.size, 120); assert.equal(extremes.option, 0);
  assert.ok(extremes.value >= extremes.min && extremes.value <= extremes.max);
  assert.equal(normalizeWidget({ step: 0, size: 0, option: 99 }).step, .01);
  const reversed = normalizeWidget({ min: 9, max: 2 }, { min: -10, max: 10, step: 1 });
  assert.deepEqual([reversed.min, reversed.max], [-10, 10]);
});

test('strings, booleans, color and variants enforce their schema', () => {
  const result = normalizeWidget({
    label: '🛰'.repeat(45), unit: 'u'.repeat(12), notes: 'n'.repeat(4005), query: 'q'.repeat(85),
    disabled: 'false', active: [false, 'false', true], color: 'red', variant: 'unknown'
  }, { disabled: true, active: [true, false, false], color: '#123ABC', variant: 'solid' });
  assert.equal(Array.from(result.label).length, 40); assert.equal(result.unit.length, 10);
  assert.equal(result.notes.length, 4000); assert.equal(result.query.length, 80);
  assert.equal(result.disabled, true); assert.deepEqual(result.active, [false, false, true]);
  assert.equal(result.color, '#123ABC'); assert.equal(result.variant, 'solid');
  assert.equal(normalizeWidget({ disabled: false }, { disabled: true }).disabled, false);
  assert.equal(normalizeWidget({ color: '#a0B1c2' }).color, '#a0B1c2');
});

test('normalization ignores inherited and prototype-pollution fields', () => {
  const inherited = Object.create({ label: 'Inherited', value: 88, disabled: true });
  assert.equal(normalizeWidget(inherited).label, '');
  const input = JSON.parse('{"__proto__":{"polluted":true},"optics":{"__proto__":{"polluted":true}},"widgets":{"__proto__":{"polluted":true},"dial":{"label":"Safe","active":[false,false,false],"__proto__":{"polluted":true}}}}');
  const result = normalizeBenchState(input);
  assert.equal(result.widgets.dial.label, 'Safe');
  assert.equal(Object.hasOwn(result.widgets, '__proto__'), false);
  assert.equal({}.polluted, undefined);
  input.widgets.dial.active[0] = true;
  assert.equal(result.widgets.dial.active[0], false);
});

test('malformed, incomplete and unrelated imports are rejected', () => {
  for (const text of ['{', '{}', JSON.stringify({ format: 'phosphor-workbench', version: 2, state: createBenchState() })]) {
    assert.throws(() => parseBenchFile(text));
  }
  const missing = createBenchState(); delete missing.widgets.dial;
  const empty = createBenchState(); empty.widgets = {};
  const malformed = createBenchState(); malformed.widgets.dial = { value: 'not a number' };
  const unknown = createBenchState(); unknown.widgets.unknown = { label: 'Unknown' };
  const noOptics = createBenchState(); noOptics.optics = {};
  for (const state of [null, {}, missing, empty, malformed, unknown, noOptics]) assert.throws(() => parseBenchFile(envelope(state)));
  assert.throws(() => parseBenchFile(' '.repeat(1024 * 1024 + 1)));
  assert.throws(() => parseBenchFile('🛰'.repeat(300000)), /1 MB/);
});

test('save and load roundtrip without touching old display storage', t => {
  const storage = memoryStorage([['phosphor-config-library-v1', 'old library'], ['phosphor-screen-settings-v1', 'old screen']]);
  useStorage(t, storage);
  assert.deepEqual(loadBenchState(), { state: createBenchState() });
  const state = createBenchState(); state.widgets.segments.label = 'Custom';
  assert.deepEqual(saveBenchState(state), { ok: true });
  assert.deepEqual(loadBenchState(), { state });
  assert.equal(storage.values.get('phosphor-config-library-v1'), 'old library');
  assert.equal(storage.values.get('phosphor-screen-settings-v1'), 'old screen');
});

test('corrupt stored data is preserved and warning names the recovery outcome', t => {
  const raw = '{broken'; const storage = memoryStorage([[KEY, raw]]);
  useStorage(t, storage);
  const result = loadBenchState();
  assert.deepEqual(result.state, createBenchState()); assert.match(result.warning, /recovery copy was kept/);
  assert.equal(storage.values.get(`${KEY}-recovery`), raw); assert.equal(storage.values.get(KEY), raw);
  storage.setItem = () => { throw new Error('quota'); };
  assert.match(loadBenchState().warning, /could not be saved/);
});

test('storage denial and quota failures never report a successful save', t => {
  useStorage(t, { getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } });
  const saved = saveBenchState(createBenchState());
  assert.equal(saved.ok, false); assert.equal(typeof saved.error, 'string');
  const loaded = loadBenchState();
  assert.deepEqual(loaded.state, createBenchState()); assert.match(loaded.warning, /session only/);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('security'); } });
  assert.equal(saveBenchState(createBenchState()).ok, false);
  assert.match(loadBenchState().warning, /unavailable/);
});

test('marks and both screen states roundtrip without case or note changes', () => {
  const state = createBenchState();
  const marks = ['dots', 'hashes', 'blocks', 'lines'];
  BENCH_CATALOG.forEach((item, index) => { state.widgets[item.id].mark = marks[index % marks.length]; });
  state.widgets.dial.label = 'MiXeD Label'; state.widgets.dial.notes = 'Original\nNotes';
  state.screens.selected = 'segments';
  state.screens.menu = { ...createReferenceState(), functions: [true, false, true, false], channels: [false, true, false, true], x: 125, y: 460, selected: 'D-4', confirmed: true, committed: { x: 125, y: 460 } };
  state.screens.transport = { track: 8, elapsed: 123.75, playing: true, stopped: false };
  assert.deepEqual(parseBenchFile(exportBenchState(state)), state);
  assert.deepEqual(normalizeBenchState(state), state);
});

test('invalid marks and selections use defaults; nested state never aliases', () => {
  for (const mark of ['dot', 'hash', 'DOTS', '#', null, {}, ['hashes']]) assert.equal(normalizeWidget({ mark }).mark, 'dots');
  assert.equal(normalizeWidget({ mark: 'invalid' }, { mark: 'lines' }).mark, 'lines');
  const first = createBenchState(), second = createBenchState();
  assert.deepEqual(first.screens, { selected: 'dial', menu: createReferenceState(), transport: createTransportState() });
  first.screens.menu.functions[0] = true; first.screens.menu.committed.x = 1; first.screens.transport.elapsed = 12;
  assert.deepEqual(second.screens.menu, createReferenceState()); assert.deepEqual(second.screens.transport, createTransportState());
  const normalized = normalizeBenchState(first);
  first.screens.menu.channels[0] = !first.screens.menu.channels[0]; first.screens.transport.track = 9;
  assert.notDeepEqual(normalized.screens.menu.channels, first.screens.menu.channels);
  assert.notEqual(normalized.screens.transport.track, first.screens.transport.track);
  assert.equal(normalizeBenchState({ screens: { selected: 'constructor' } }).screens.selected, 'dial');
  const inherited = Object.create({ selected: 'wheel', menu: { x: 1 }, transport: { elapsed: 1 } });
  assert.deepEqual(normalizeBenchState({ screens: inherited }).screens, second.screens);
});

test('old version 1 files migrate missing additions without resetting old values', () => {
  const old = oldWorkbench(), parsed = parseBenchFile(envelope(old));
  assert.deepEqual(parsed.screens, createBenchState().screens);
  for (const widget of Object.values(parsed.widgets)) { assert.equal(widget.mark, 'dots'); delete widget.mark; }
  delete parsed.screens;
  assert.deepEqual(parsed, old);
});

test('load seeds absent screens from legacy storage, preserving every old widget', t => {
  const old = oldWorkbench();
  const legacy = { menu: { ...createReferenceState(), x: 8912, selected: 'A-1' }, transport: { track: 6, elapsed: 250.5, playing: true, stopped: false } };
  const oldRaw = JSON.stringify(old), legacyRaw = JSON.stringify(legacy);
  const storage = memoryStorage([[KEY, oldRaw], [LEGACY_KEY, legacyRaw]]);
  useStorage(t, storage);
  const loaded = loadBenchState();
  assert.equal(loaded.warning, undefined);
  assert.deepEqual(loaded.state.screens, { selected: 'dial', menu: legacy.menu, transport: legacy.transport });
  for (const id of IDS) {
    const { mark, ...originalFields } = loaded.state.widgets[id];
    assert.equal(mark, 'dots'); assert.deepEqual(originalFields, old.widgets[id]);
  }
  assert.equal(storage.values.get(KEY), oldRaw); assert.equal(storage.values.get(LEGACY_KEY), legacyRaw);
});

test('seeding occurs only during load and never overrides saved screens', t => {
  const legacy = { menu: { ...createReferenceState(), x: 12 }, transport: { track: 7, elapsed: 5, playing: false, stopped: false } };
  const storage = memoryStorage([[LEGACY_KEY, JSON.stringify(legacy)]]);
  useStorage(t, storage);
  assert.deepEqual(createBenchState().screens.menu, createReferenceState());
  assert.deepEqual(parseBenchFile(envelope(oldWorkbench())).screens.menu, createReferenceState());
  assert.deepEqual(loadBenchState().state.screens.menu, legacy.menu);
  assert.equal(storage.values.has(KEY), false);
  const saved = createBenchState(); saved.screens.selected = 'search'; saved.screens.menu.x = 8765;
  assert.equal(saveBenchState(saved).ok, true);
  assert.deepEqual(loadBenchState().state, saved);
  const explicitNull = { ...saved, screens: null };
  storage.values.set(KEY, JSON.stringify(explicitNull));
  assert.deepEqual(loadBenchState().state.screens, createBenchState().screens);
});

test('invalid or unavailable legacy storage cannot erase a valid old workbench', t => {
  const old = oldWorkbench(), raw = JSON.stringify(old);
  const storage = memoryStorage([[KEY, raw]]);
  useStorage(t, storage);
  for (const legacy of ['{broken', 'null', '[]', '"unrelated"', '{"menu":"wrong","transport":[]}']) {
    storage.values.set(LEGACY_KEY, legacy);
    const loaded = loadBenchState();
    assert.equal(loaded.warning, undefined);
    assert.equal(loaded.state.widgets.dial.notes, old.widgets.dial.notes);
    assert.deepEqual(loaded.state.screens, createBenchState().screens);
    assert.equal(storage.values.get(KEY), raw); assert.equal(storage.values.get(LEGACY_KEY), legacy);
  }
  storage.getItem = key => { if (key === LEGACY_KEY) throw new Error('denied'); return storage.values.get(key) ?? null; };
  assert.equal(loadBenchState().state.widgets.dial.notes, old.widgets.dial.notes);
});

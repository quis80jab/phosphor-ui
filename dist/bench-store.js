import { BENCH_CATALOG } from './bench-widgets.js?v=glyph-2';
import { createReferenceState, normalizeReferenceState } from './reference-screen.js?v=glyph-2';
import { createTransportState, normalizeTransportState } from './transport-screen.js?v=glyph-2';

const STORAGE_KEY = 'phosphor-component-workbench-v1';
const LEGACY_SCREEN_KEY = 'phosphor-screen-settings-v1';
const FORMAT = 'phosphor-workbench';
const MAX_FILE_BYTES = 1024 * 1024;
const OPTICS = Object.freeze({ brightness: 100, glow: 25, contrast: 110, grid: 35, refraction: 0 });
const OPTIC_LIMITS = { brightness: [20, 200], glow: [0, 100], contrast: [50, 220], grid: [0, 100], refraction: [0, 100] };
const BASE_WIDGET = Object.freeze({
  label: '', value: 0, min: 0, max: 100, step: 1, unit: '', color: '#a4ded4',
  size: 100, disabled: false, variant: 'outline', mark: 'dots', notes: '', query: '', active: [false, false, false], option: 0
});
const VARIANTS = ['outline', 'solid', 'minimal'];
const MARKS = ['dots', 'hashes', 'blocks', 'lines'];
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.hasOwn(object, key) ? object[key] : undefined;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function numeric(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}
const number = (value, fallback) => numeric(value) ?? fallback;
const text = (value, length, fallback) => typeof value === 'string' ? Array.from(value).slice(0, length).join('') : fallback;
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

export function normalizeWidget(input, defaults = BASE_WIDGET) {
  const source = isRecord(input) ? input : {};
  const fallback = isRecord(defaults) ? defaults : BASE_WIDGET;
  const get = key => own(source, key);
  const base = key => own(fallback, key) ?? BASE_WIDGET[key];
  let defaultMin = clamp(number(base('min'), 0), -9999, 9999);
  let defaultMax = clamp(number(base('max'), 100), -9999, 9999);
  if (defaultMin >= defaultMax) { defaultMin = 0; defaultMax = 100; }
  let min = clamp(number(get('min'), defaultMin), -9999, 9999);
  let max = clamp(number(get('max'), defaultMax), -9999, 9999);
  if (min >= max) { min = defaultMin; max = defaultMax; }
  const step = clamp(number(get('step'), number(base('step'), 1)), .01, 999);
  const requested = clamp(number(get('value'), number(base('value'), min)), min, max);
  const maxSteps = Math.floor((max - min) / step + 1e-9);
  const steps = clamp(Math.round((requested - min) / step + 1e-9), 0, maxSteps);
  const value = clamp(Number((min + steps * step).toPrecision(15)), min, max);
  const defaultActive = Array.isArray(base('active')) ? base('active') : BASE_WIDGET.active;
  const active = Array.isArray(get('active')) ? get('active') : [];
  return {
    label: text(get('label'), 40, text(base('label'), 40, '')),
    value, min, max, step,
    unit: text(get('unit'), 10, text(base('unit'), 10, '')),
    color: color(get('color')) ? get('color') : color(base('color')) ? base('color') : BASE_WIDGET.color,
    size: Math.round(clamp(number(get('size'), number(base('size'), 100)), 80, 120)),
    disabled: typeof get('disabled') === 'boolean' ? get('disabled') : base('disabled') === true,
    variant: VARIANTS.includes(get('variant')) ? get('variant') : VARIANTS.includes(base('variant')) ? base('variant') : 'outline',
    mark: MARKS.includes(get('mark')) ? get('mark') : MARKS.includes(base('mark')) ? base('mark') : 'dots',
    notes: text(get('notes'), 4000, text(base('notes'), 4000, '')),
    query: text(get('query'), 80, text(base('query'), 80, '')),
    active: [0, 1, 2].map(index => typeof active[index] === 'boolean' ? active[index] : defaultActive[index] === true),
    option: Math.round(clamp(number(get('option'), number(base('option'), 0)), 0, 2))
  };
}

function ownFields(input, fields) {
  if (!isRecord(input)) return {};
  return Object.fromEntries(fields.filter(key => Object.hasOwn(input, key)).map(key => [key, input[key]]));
}

function normalizeScreens(input) {
  const source = isRecord(input) ? input : {};
  const menu = ownFields(own(source, 'menu'), ['functions', 'channels', 'x', 'y', 'selected', 'confirmed', 'committed']);
  if (Object.hasOwn(menu, 'committed')) menu.committed = ownFields(menu.committed, ['x', 'y']);
  const transport = ownFields(own(source, 'transport'), ['track', 'elapsed', 'playing', 'stopped']);
  const selected = own(source, 'selected');
  return {
    selected: BENCH_CATALOG.some(item => item.id === selected) ? selected : 'dial',
    menu: normalizeReferenceState(Object.keys(menu).length ? menu : createReferenceState()),
    transport: normalizeTransportState(Object.keys(transport).length ? transport : createTransportState())
  };
}

export function normalizeBenchState(input) {
  const source = isRecord(input) ? input : {};
  const opticsInput = isRecord(own(source, 'optics')) ? own(source, 'optics') : {};
  const widgetsInput = isRecord(own(source, 'widgets')) ? own(source, 'widgets') : {};
  const optics = {};
  for (const [key, fallback] of Object.entries(OPTICS)) {
    optics[key] = Math.round(clamp(number(own(opticsInput, key), fallback), ...OPTIC_LIMITS[key]));
  }
  const widgets = {};
  for (const item of BENCH_CATALOG) widgets[item.id] = normalizeWidget(own(widgetsInput, item.id), item.defaults);
  return { version: 1, optics, widgets, screens: normalizeScreens(own(source, 'screens')) };
}

export function createBenchState() {
  return normalizeBenchState({});
}

function validWidget(input) {
  if (!isRecord(input)) return false;
  return Object.keys(BASE_WIDGET).some(key => {
    const value = own(input, key);
    if (['label', 'unit', 'notes', 'query'].includes(key)) return typeof value === 'string';
    if (key === 'disabled') return typeof value === 'boolean';
    if (key === 'active') return Array.isArray(value) && value.length === 3 && value.every(item => typeof item === 'boolean');
    if (key === 'color') return color(value);
    if (key === 'variant') return VARIANTS.includes(value);
    if (key === 'mark') return MARKS.includes(value);
    return numeric(value) !== undefined;
  });
}

function validateState(input) {
  if (!isRecord(input) || own(input, 'version') !== 1 || !isRecord(own(input, 'optics')) || !isRecord(own(input, 'widgets'))) {
    throw new Error('Choose a version 1 workbench export with optics and widget settings.');
  }
  if (!Object.keys(OPTICS).some(key => numeric(own(input.optics, key)) !== undefined)) {
    throw new Error('The workbench file has no valid optical settings.');
  }
  const known = new Set(BENCH_CATALOG.map(item => item.id));
  if (Object.keys(input.widgets).some(id => !known.has(id))) throw new Error('The workbench file contains an unknown component.');
  for (const item of BENCH_CATALOG) {
    if (!validWidget(own(input.widgets, item.id))) throw new Error(`The workbench file is missing valid settings for ${item.id}.`);
  }
  return normalizeBenchState(input);
}

export function saveBenchState(state) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeBenchState(state)));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save in this browser. Export your workbench to keep a backup.' };
  }
}

function seedLegacyScreens(state) {
  try {
    const legacy = JSON.parse(globalThis.localStorage.getItem(LEGACY_SCREEN_KEY) || 'null');
    if (!isRecord(legacy)) return state;
    const screens = { ...state.screens };
    for (const key of ['menu', 'transport']) {
      if (isRecord(own(legacy, key))) screens[key] = own(legacy, key);
    }
    return { ...state, screens: normalizeScreens(screens) };
  } catch { return state; }
}

export function loadBenchState() {
  let raw;
  try { raw = globalThis.localStorage.getItem(STORAGE_KEY); }
  catch { return { state: createBenchState(), warning: 'Browser storage is unavailable. Changes are session only; export a backup.' }; }
  if (raw === null) return { state: seedLegacyScreens(createBenchState()) };
  try {
    const saved = JSON.parse(raw);
    const state = validateState(saved);
    return { state: Object.hasOwn(saved, 'screens') ? state : seedLegacyScreens(state) };
  }
  catch {
    let recovered = false;
    try { globalThis.localStorage.setItem(`${STORAGE_KEY}-recovery`, raw); recovered = true; } catch {}
    return {
      state: createBenchState(),
      warning: recovered
        ? 'Saved workbench data could not be read. A recovery copy was kept; defaults are shown.'
        : 'Saved workbench data could not be read. Defaults are shown; a recovery copy could not be saved.'
    };
  }
}

export function exportBenchState(state) {
  return JSON.stringify({ format: FORMAT, version: 1, state: normalizeBenchState(state) }, null, 2);
}

export function parseBenchFile(source) {
  if (typeof source !== 'string' || source.length > MAX_FILE_BYTES || new TextEncoder().encode(source).byteLength > MAX_FILE_BYTES) {
    throw new Error('Choose a JSON workbench file no larger than 1 MB.');
  }
  let data;
  try { data = JSON.parse(source); } catch { throw new Error('This file is not valid JSON.'); }
  if (!isRecord(data) || own(data, 'format') !== FORMAT || own(data, 'version') !== 1) {
    throw new Error('Choose a Phosphor workbench export (version 1).');
  }
  return validateState(own(data, 'state'));
}

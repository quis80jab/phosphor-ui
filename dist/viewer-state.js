import { IMPORTED_SCENES } from './imported-scenes.js?v=splats-1';
import { SCAN_SITES } from './scan-sites.js?v=scan-1';
import { normalizePointEditSnapshot } from './point-edit-state.js?v=points-1';

const STORAGE_KEY = 'phosphor-inspection-viewer-v1';
const FORMAT = 'phosphor-inspection-viewer';
const ASSETS = ['calibration', 'surface', 'thermal', 'sf-waterfront', 'mcap-replay', ...Object.keys(SCAN_SITES), ...Object.keys(IMPORTED_SCENES)];
const MARKS = ['dots', 'hashes', 'blocks', 'lines'];
const SPEEDS = [.25, .5, 1, 2];
const VIEWS = ['iso', 'front', 'top', 'right'];
const RENDER_MODES = ['voxels', 'vfd', 'smooth'];
const DEFAULT_LAYERS = Object.freeze({ rgb: true, thermal: false, defect: true });
const DEFAULT_HOLOGRAM = Object.freeze({ enabled:true, x:-.3, z:0, radius:.6, height:3, intensity:1, edge:1.4, pathGain:.18, falloff:1, offsetX:0, offsetZ:0, zoom:1 });
const HOLOGRAM_LIMITS = { x:[-1,1], z:[-1,1], radius:[.2,1], height:[1,5], intensity:[.2,3], edge:[0,3], pathGain:[0,1], falloff:[0,8], offsetX:[-4,4], offsetZ:[-4,4], zoom:[.55,12] };
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.hasOwn(object, key) ? object[key] : undefined;

function numeric(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return undefined;
  const result = Number(value);
  return Number.isFinite(result) ? result : undefined;
}

export function normalizeViewerState(input) {
  const source = isRecord(input) ? input : {};
  const layersInput = isRecord(own(source, 'layers')) ? own(source, 'layers') : {};
  const layers = {};
  for (const [key, fallback] of Object.entries(DEFAULT_LAYERS)) {
    const value = own(layersInput, key);
    layers[key] = typeof value === 'boolean' ? value : fallback;
  }
  const asset = own(source, 'asset'), mark = own(source, 'mark'), view = own(source, 'view');
  const speed = numeric(own(source, 'speed')), notes = own(source, 'notes');
  const edits = own(source, 'pointEdits'), pointEdits = {};
  if (isRecord(edits)) for (const id of Object.keys(IMPORTED_SCENES)) {
    if (isRecord(own(edits, id))) pointEdits[id] = normalizePointEditSnapshot(own(edits, id));
  }
  const hologramInput = isRecord(own(source, 'hologram')) ? own(source, 'hologram') : {};
  const hologram = { enabled:typeof own(hologramInput, 'enabled') === 'boolean' ? own(hologramInput, 'enabled') : DEFAULT_HOLOGRAM.enabled };
  for (const [key, [min, max]] of Object.entries(HOLOGRAM_LIMITS)) {
    const legacy = key === 'pathGain' ? numeric(own(hologramInput, 'rays')) : undefined;
    hologram[key] = Math.min(max, Math.max(min, numeric(own(hologramInput, key)) ?? legacy ?? DEFAULT_HOLOGRAM[key]));
  }
  return {
    version: 1,
    asset: ASSETS.includes(asset) ? asset : 'calibration',
    // Preserve existing comparisons; the old splats label uses the VFD shader.
    renderMode: RENDER_MODES.includes(own(source, 'renderMode')) ? source.renderMode : own(source, 'renderMode') === 'splats' ? 'vfd' : 'voxels',
    voxelScale: Math.min(8, Math.max(.25, numeric(own(source, 'voxelScale')) ?? 1)),
    pointEdits,
    hologram,
    layers,
    mark: MARKS.includes(mark) ? mark : 'dots',
    frame: Math.min(1, Math.max(0, numeric(own(source, 'frame')) ?? 0)),
    speed: SPEEDS.includes(speed) ? speed : 1,
    loop: typeof own(source, 'loop') === 'boolean' ? own(source, 'loop') : true,
    view: VIEWS.includes(view) ? view : 'iso',
    notes: typeof notes === 'string' ? Array.from(notes).slice(0, 4000).join('') : ''
  };
}

export function createViewerState() {
  return normalizeViewerState({});
}

function validSavedState(input) {
  if (!isRecord(input) || own(input, 'version') !== 1) return false;
  return ASSETS.includes(own(input, 'asset')) || MARKS.includes(own(input, 'mark')) ||
    (isRecord(own(input, 'hologram')) && (typeof own(input.hologram, 'enabled') === 'boolean'
      || Object.keys(HOLOGRAM_LIMITS).some(key => numeric(own(input.hologram, key)) !== undefined)
      || numeric(own(input.hologram, 'rays')) !== undefined)) ||
    numeric(own(input, 'voxelScale')) !== undefined ||
    (isRecord(own(input, 'pointEdits')) && Object.keys(IMPORTED_SCENES).some(id => isRecord(own(input.pointEdits, id)))) ||
    VIEWS.includes(own(input, 'view')) || SPEEDS.includes(numeric(own(input, 'speed'))) ||
    numeric(own(input, 'frame')) !== undefined || typeof own(input, 'loop') === 'boolean' ||
    typeof own(input, 'notes') === 'string' ||
    (isRecord(own(input, 'layers')) && Object.keys(DEFAULT_LAYERS).some(key => typeof own(input.layers, key) === 'boolean'));
}

export function loadViewerState() {
  let raw;
  try { raw = globalThis.localStorage.getItem(STORAGE_KEY); }
  catch {
    return { state: createViewerState(), warning: 'Browser storage is unavailable. Viewer changes are session only; export a backup.' };
  }
  if (raw === null) return { state: createViewerState() };
  try {
    const saved = JSON.parse(raw);
    if (!validSavedState(saved)) throw new Error('Invalid viewer state');
    return { state: normalizeViewerState(saved) };
  } catch {
    let recovered = false;
    try { globalThis.localStorage.setItem(`${STORAGE_KEY}-recovery`, raw); recovered = true; } catch {}
    return {
      state: createViewerState(),
      warning: recovered
        ? 'Saved viewer data could not be read. A recovery copy was kept; defaults are shown.'
        : 'Saved viewer data could not be read. Defaults are shown; a recovery copy could not be saved.'
    };
  }
}

export function saveViewerState(state) {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeViewerState(state)));
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not save in this browser. Export the viewer settings to keep a backup.' };
  }
}

export function exportViewerState(state) {
  return JSON.stringify({ format: FORMAT, version: 1, state: normalizeViewerState(state) }, null, 2);
}

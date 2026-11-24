import { normalizeSettings } from './settings.js?v=transport-2';
import { createBenchState } from './bench-store.js?v=glyph-2';
import { createViewerState } from './viewer-state.js?v=scan-1';
import { normalizePagesState } from './ui-pages-state.js';
import { SAAS_STORAGE_KEY, defaultSaasState } from './saas-state.js';
import { DESIGN_STORAGE_KEY, createDefaultDesign } from './blank-state.js?v=designer-2';

export const STORAGE_KEYS_V1 = Object.freeze([
  'phosphor-screen-settings-v1',
  'phosphor-config-library-v1',
  'phosphor-transport-screen-intro-v1',
  'phosphor-component-workbench-v1',
  'phosphor-inspection-viewer-v1',
  'phosphor-viewer-grid-guides',
  'phosphor-ui-pages-v1',
  'phosphor-ui-readiness-v1',
  'phosphor-ui-logistics-v1',
  'phosphor-config-library-v1-recovery',
  'phosphor-component-workbench-v1-recovery',
  'phosphor-inspection-viewer-v1-recovery'
]);
export const STORAGE_KEYS_V2 = Object.freeze([...STORAGE_KEYS_V1, SAAS_STORAGE_KEY]);
export const STORAGE_KEYS = Object.freeze([...STORAGE_KEYS_V2, DESIGN_STORAGE_KEY]);
export const TRANSIENT_EXCLUSIONS = Object.freeze([
  'Free-orbit camera angles and distance; only the saved view preset is included.',
  'Drone flight pose, held state, Direct Operate mode, velocity and joystick input.',
  'Drone gauge sensor-feed selection and sensor zoom.',
  'Viewer playback running state, pointer selection, lasso gestures and undo history.',
  'Open dialogs, focus, scrolling, search filters and uncommitted form drafts.',
  'Fetched OSM tiles, decoded splats, GPU caches and in-memory baked color textures.'
]);
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
const FORMAT = 'phosphor-project-backup';
const FIELDS = ['format', 'version', 'origin', 'createdAt', 'entries', 'transientExclusions'];
const encoder = new TextEncoder();
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function exactFields(value, keys, label) {
  if (!record(value) || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => !keys.includes(key))) {
    throw new Error(`${label} must contain exactly the documented fields.`);
  }
}
function jsonSize(value) {
  let text;
  try { text = JSON.stringify(value); } catch { throw new Error('Project backup must be a JSON object.'); }
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES || encoder.encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Project backup must be no larger than 16 MiB of UTF-8 JSON.');
  }
}
function readEntry(storage, key) {
  const value = storage.getItem(key);
  if (value !== null && typeof value !== 'string') throw new Error(`Storage returned an invalid value for ${key}.`);
  return value;
}

/** Validate the envelope, not the raw stored JSON. Corrupt/recovery data is preserved verbatim. */
export function parseProjectBackup(source) {
  let value = source;
  if (typeof source === 'string') {
    if (source.length > MAX_BACKUP_BYTES || encoder.encode(source).byteLength > MAX_BACKUP_BYTES) {
      throw new Error('Project backup must be no larger than 16 MiB of UTF-8 JSON.');
    }
    try { value = JSON.parse(source); } catch { throw new Error('Project backup is not valid JSON.'); }
  }
  exactFields(value, FIELDS, 'Project backup');
  if (value.format !== FORMAT || ![1, 2, 3].includes(value.version)) throw new Error('Choose a Phosphor project backup, version 1, 2 or 3.');
  const keys = value.version === 1 ? STORAGE_KEYS_V1 : value.version === 2 ? STORAGE_KEYS_V2 : STORAGE_KEYS;
  if (typeof value.origin !== 'string' || !value.origin || value.origin.length > 2048 || /[\u0000-\u001f\u007f]/.test(value.origin)) {
    throw new Error('Project backup needs a valid origin label.');
  }
  if (typeof value.createdAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.createdAt)
    || !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt) {
    throw new Error('Project backup needs a UTC ISO timestamp with milliseconds.');
  }
  exactFields(value.entries, keys, 'Project backup entries');
  const entries = {};
  for (const key of keys) {
    const entry = value.entries[key];
    if (entry !== null && typeof entry !== 'string') throw new Error(`Backup entry ${key} must be a raw string or null.`);
    entries[key] = entry;
  }
  if (!Array.isArray(value.transientExclusions) || value.transientExclusions.length !== TRANSIENT_EXCLUSIONS.length
    || value.transientExclusions.some((entry, index) => entry !== TRANSIENT_EXCLUSIONS[index])) {
    throw new Error('Project backup must retain the documented transient-state exclusions.');
  }
  const snapshot = {format:FORMAT, version:value.version, origin:value.origin, createdAt:value.createdAt, entries,
    transientExclusions:[...TRANSIENT_EXCLUSIONS]};
  jsonSize(snapshot);
  return snapshot;
}

/** Capture only this application's allowlisted settings. Missing keys are explicit nulls. */
export function createProjectBackup(storage, {origin = globalThis.location?.origin || 'unavailable', createdAt = new Date().toISOString()} = {}) {
  if (!storage || typeof storage.getItem !== 'function') throw new Error('Readable storage is required to create a project backup.');
  const entries = {};
  // A storage exception must abort capture; it must never masquerade as missing settings.
  for (const key of STORAGE_KEYS) entries[key] = readEntry(storage, key);
  return parseProjectBackup({format:FORMAT, version:3, origin, createdAt, entries, transientExclusions:[...TRANSIENT_EXCLUSIONS]});
}

/** Merge restores present entries. Replace removes nulls only within the snapshot version's keys. */
export function restoreProjectBackup(source, storage, {mode = 'merge'} = {}) {
  const snapshot = parseProjectBackup(source);
  if (!['merge', 'replace'].includes(mode)) throw new Error('Restore mode must be merge or replace.');
  if (!storage || !['getItem', 'setItem', 'removeItem'].every(method => typeof storage[method] === 'function')) {
    throw new Error('Readable and writable storage is required to restore a project backup.');
  }
  const changes = [];
  // Legacy backups affect only their version's keys, preserving newer app states even in replace mode.
  const keys = Object.keys(snapshot.entries);
  for (const key of keys) {
    const next = snapshot.entries[key];
    if (next === null && mode === 'merge') continue;
    const previous = readEntry(storage, key);
    if (previous !== next) changes.push({key, previous, next});
  }
  const attempted = [];
  try {
    for (const change of changes) {
      attempted.push(change); // Also roll back a storage adapter that mutates before throwing.
      if (change.next === null) storage.removeItem(change.key);
      else storage.setItem(change.key, change.next);
    }
  } catch (cause) {
    const rollbackFailures = [];
    for (const change of attempted.reverse()) {
      try {
        if (change.previous === null) storage.removeItem(change.key);
        else storage.setItem(change.key, change.previous);
      } catch { rollbackFailures.push(change.key); }
    }
    const error = new Error(rollbackFailures.length
      ? 'Restore failed and some original settings could not be restored. Keep the backup and retry when storage is available.'
      : 'Restore failed. Original settings were restored.', {cause});
    error.name = 'ProjectBackupRestoreError'; error.code = 'restore_failed';
    error.rollbackComplete = rollbackFailures.length === 0; error.rollbackFailures = rollbackFailures;
    throw error;
  }
  const written = changes.filter(change => change.next !== null).length;
  return {mode, written, removed:changes.length-written, unchanged:keys.length-changes.length, keys:changes.map(change => change.key)};
}

/** Factory data for consumers; this does not read or write storage or start live operations. */
export function defaultProjectSettings() {
  const workbench = createBenchState();
  return {
    display:normalizeSettings(), configs:[], transportIntro:false,
    workbench, viewer:createViewerState(), viewerGridGuides:false,
    pages:normalizePagesState({optics:{...workbench.optics}}), saas:defaultSaasState(), designer:createDefaultDesign(),
    // These two modules currently keep their factory functions private. Keep this data
    // aligned with ui-readiness.js/defaultState and ui-logistics.js/readState(false).
    readiness:{
      case:{stage:0,description:'Engine Oil Consumption Engine 1',assignee:'',notes:'',recommendation:'Inspect engine 1 oil system and vibration sensor.',scheduled:'2025-05-05',reviewed:false,reviewedAlerts:[],merged:false,history:['Case opened / 19 FEB 2025']},
      caseTab:'Overview',
      parts:{query:'',nsn:'',failure:'',platform:'',lru:'all',sort:'nsn',direction:1,page:0,pageSize:4,selected:'2840-01-345-6789',forecast:'inventory',start:'2025-02',end:'2025-08',series:{actual:true,forecast:true,threshold:true,events:true},orders:{}},
      value:{platform:'',base:'',tab:'value',failure:''},home:{news:-1,resource:-1,updates:false}
    },
    logistics:{layers:{services:true,commands:false,base:true,'3d':false},dismissed:[],selectedSite:'subic',selectedAlert:'cargo',alertsOpen:true,sort:'latest',zoom:1,panX:0,panY:0}
  };
}

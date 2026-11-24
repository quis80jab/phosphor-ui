import { DEFAULT_SETTINGS, normalizeSettings } from './settings.js?v=transport-2';

export const LIBRARY_KEY = 'phosphor-config-library-v1';
export const MAX_CONFIGS = 50;
export const EXPORT_FORMAT = 'phosphor-configs';
export const LENS_LOOK = Object.freeze({
  shape: 'hexagon', pattern: 'staggered', size: 12, glassEnabled: true,
  refraction: 65, dispersion: 25, contrast: 150
});
export const LENS_PRESETS = Object.freeze({
  clear: { refraction: 0, dispersion: 0, contrast: 125 },
  glass: LENS_LOOK,
  prism: { ...LENS_LOOK, size: 14, refraction: 90, dispersion: 65, contrast: 170 }
});

export function cleanName(value) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 48) : '';
}
function recognizedSettings(value) {
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(DEFAULT_SETTINGS).some(key => Object.hasOwn(value, key));
}
export function sanitizeConfigs(value) {
  if (!Array.isArray(value) || value.length > MAX_CONFIGS) throw new Error('Choose a config file with up to 50 saved looks.');
  const ids = new Set();
  return value.map((entry, index) => {
    if (!entry || typeof entry !== 'object' || !cleanName(entry.name) || !recognizedSettings(entry.settings)) throw new Error(`Config ${index + 1} is missing a name or display settings.`);
    let id = typeof entry.id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(entry.id) ? entry.id : `import-${index}`;
    const baseId = id.slice(0, 64);
    let collision = 1;
    while (ids.has(id)) id = `${baseId}-${index}-${collision++}`;
    ids.add(id);
    return { id, name: cleanName(entry.name), sourceName: cleanName(entry.sourceName) || cleanName(entry.name), settings: normalizeSettings(entry.settings) };
  });
}
export function parseConfigFile(text) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('Choose a JSON config file smaller than 1 MB.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (data?.format !== EXPORT_FORMAT || data?.version !== 1) throw new Error('Choose a Phosphor config export (version 1).');
  const configs = sanitizeConfigs(data.configs);
  if (!configs.length) throw new Error('This file contains no configs.');
  return configs;
}
export function exportConfigFile(configs) {
  return JSON.stringify({ format: EXPORT_FORMAT, version: 1, configs: sanitizeConfigs(configs) }, null, 2);
}
export function uniqueName(name, configs) {
  const base = cleanName(name) || 'Untitled look';
  let candidate = base, suffix = 2;
  const names = new Set(configs.map(item => item.name.toLowerCase()));
  while (names.has(candidate.toLowerCase())) { const ending = ` (${suffix++})`; candidate = base.slice(0, 48 - ending.length) + ending; }
  return candidate;
}
export function mergeConfigs(existing, incoming, idFactory) {
  const result = sanitizeConfigs(existing);
  let added = 0;
  for (const item of sanitizeConfigs(incoming)) {
    if (result.some(current => current.sourceName === item.sourceName && JSON.stringify(current.settings) === JSON.stringify(item.settings))) continue;
    if (result.length >= MAX_CONFIGS) throw new Error('The library is full. Export a backup before removing a saved config.');
    result.push({ ...item, id: idFactory(), name: uniqueName(item.name, result) });
    added++;
  }
  return { configs: result, added };
}

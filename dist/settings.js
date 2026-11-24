import { createTransportState, normalizeTransportState } from './transport-screen.js?v=transport-2';
import { createReferenceState, normalizeReferenceState } from './reference-screen.js?v=transport-2';
export const DEFAULT_SETTINGS = Object.freeze({
  shape: 'square', pattern: 'grid', size: 6, fill: 67,
  brightness: 100, bloom: 22, burn: 60, cursorSize: 80,
  refraction: 0, dispersion: 0, contrast: 110,
  phosphor: 'mint', glass: 35, tilt: 0, zoom: 100,
  view: 'composite', signal: 'reference', menu: createReferenceState(), transport: createTransportState(),
  anodeEnabled: true, phosphorEnabled: true, gridEnabled: true,
  filamentEnabled: true, glassEnabled: true, glowEnabled: true,
  anodeOpacity: 8, gridOpacity: 3, gridPitch: 1.5, gridWire: .025,
  filamentOpacity: 8, filamentCount: 5, filamentWidth: .026,
  layerGap: 1.5, reflection: 8
});

export function normalizeSettings(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const result = { ...DEFAULT_SETTINGS };
  for (const [key, options] of Object.entries({
    shape: ['square', 'circle', 'diamond', 'hexagon'],
    pattern: ['grid', 'staggered', 'diagonal'],
    phosphor: ['mint', 'blue', 'native', 'amber', 'white'],
    view: ['composite', 'stack'], signal: ['reference', 'transport', 'cursor', 'test']
  })) if (options.includes(source[key])) result[key] = source[key];
  if (['module', 'macro'].includes(source.view)) result.view = 'composite';
  for (const key of ['anodeEnabled', 'phosphorEnabled', 'gridEnabled', 'filamentEnabled', 'glassEnabled', 'glowEnabled']) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }
  for (const [key, [min, max, step]] of Object.entries({
    size: [3, 16, .5], fill: [35, 90, 1], brightness: [20, 200, 1],
    bloom: [0, 200, 1], burn: [0, 200, 1], cursorSize: [40, 180, 1],
    refraction: [0, 100, 1], dispersion: [0, 100, 1], contrast: [50, 220, 1],
    glass: [0, 100, 1], tilt: [-30, 30, 1], zoom: [70, 160, 1],
    anodeOpacity: [0, 100, 1], gridOpacity: [0, 100, 1], gridPitch: [.5, 3, .1], gridWire: [.005, .08, .005],
    filamentOpacity: [0, 100, 1], filamentCount: [1, 12, 1], filamentWidth: [.01, .12, .002],
    layerGap: [0, 6, .1], reflection: [0, 100, 1]
  })) {
    const raw = source[key];
    if (typeof raw !== 'number' && !(typeof raw === 'string' && raw.trim())) continue;
    const value = Number(raw);
    if (Number.isFinite(value)) result[key] = Number((Math.round(Math.min(max, Math.max(min, value)) / step + 1e-9) * step).toFixed(4));
  }
  result.menu = normalizeReferenceState(source.menu);
  result.transport = normalizeTransportState(source.transport);
  return result;
}

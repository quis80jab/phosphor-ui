import { SCAN_SITES } from './scan-sites.js?v=scan-1';
/** Projector controls use the same native hit targets and VFD paint layer. */
export function mountHologramTools({ getState, getViewer, save, refresh, getAvailable = () => true }) {
  const $ = id => document.getElementById(id);
  const fields = ['zoom', 'x', 'z', 'radius', 'height', 'intensity', 'edge', 'pathGain', 'falloff'];
  let status = {}, signature = '';
  const listeners = [];
  function listen(element, event, handler) {
    element?.addEventListener(event, handler);
    listeners.push(() => element?.removeEventListener(event, handler));
  }
  function sync() {
    // The projector drives the city map, a SLAM replay and the scanned monuments alike.
    const state = getState(), active = state.asset === 'sf-waterfront' || state.asset === 'mcap-replay' || Object.hasOwn(SCAN_SITES, state.asset);
    const rail = $('hologram-tools');
    if (!rail) return;
    const changed = rail.hidden === active;
    rail.hidden = !active;
    $('point-tools').hidden = active;
    if (changed) document.dispatchEvent(new CustomEvent('viewer-grid-layout'));
    const settings = state.hologram;
    if (!settings) return;
    const available = getAvailable();
    $('holo-enabled').setAttribute('aria-pressed', String(settings.enabled));
    $('holo-enabled').textContent = settings.enabled ? 'PROJECTOR ON' : 'FULL MAP';
    $('holo-enabled').disabled = !available;
    $('holo-enabled').title = settings.enabled ? 'Limit building detail and loading to the projector cone.' : 'Full map comparison: load all nine tiles and render without cone clipping.';
    for (const field of fields) {
      const control = $(`holo-${field}`), value = settings[field];
      if (!control) continue;
      control.value = String(value);
      control.disabled = !available;
      control.setAttribute('aria-valuetext', field === 'x' || field === 'z' ? `${Math.round(value * 100)} percent from center` : field === 'falloff' ? `${value.toFixed(1)} inverse-square attenuation` : `${value.toFixed(2)}`);
      const readout = $(`holo-${field}-value`);
      if (readout) readout.textContent = field === 'x' || field === 'z' ? `${Math.round(value * 100)}%` : field === 'radius' || field === 'pathGain' ? `${Math.round(value * 100)}%` : `${value.toFixed(1)}${field === 'height' ? '' : 'X'}`;
    }
    $('holo-retry').disabled = !available || status.status === 'loading';
    const loading = status.status === 'loading' || status.pendingTiles > 0;
    const tileCount = Number(status.loadedTiles) || 0;
    const city = state.asset === 'sf-waterfront', scene = $('hologram-scene');
    if (scene) scene.textContent = city ? 'SF WATERFRONT' : state.asset === 'mcap-replay' ? 'SLAM REPLAY' : (SCAN_SITES[state.asset]?.sceneTitle || '');
    if (!city) { $('holo-status').textContent = `${status.message || 'SCAN'} / ${settings.enabled ? 'DRAG TO SCAN' : 'PROJECTOR OFF'}`; $('holo-status').title = ''; }
    else $('holo-status').textContent = status.error ? (tileCount ? 'PARTIAL MAP / RETRY AVAILABLE' : 'MAP UNAVAILABLE / RETRY') : loading ? (settings.enabled ? 'STREAMING CONE AREA' : 'STREAMING FULL MAP') : tileCount ? (settings.enabled ? 'MAP READY / DRAG TO SCAN' : 'FULL MAP / PROJECTOR OFF') : 'CONNECTING TO OPENSTREETMAP';
    $('holo-status').title = status.error || status.message || '';
    const buildings = Number(status.buildingCount) || 0, estimated = Number(status.estimatedHeights) || 0;
    const tagged = Number(status.taggedColors) || 0;
    $('holo-data-info').textContent = `${tileCount} TILES / ${buildings} BUILDINGS\n${Number(status.voxelCount) || 0} GLOW CELLS\n${estimated} ESTIMATED HEIGHTS\n${tagged ? `${tagged} TAGGED COLORS` : 'HOLOGRAM PALETTE'}\nROOFS SIMPLIFIED`;
    const next = JSON.stringify([active, settings, status]);
    if (signature !== next) { signature = next; refresh(); }
  }
  function apply(field) {
    if (field === 'zoom') getViewer()?.setMapZoom?.(getState().hologram.zoom);
    getViewer()?.setHologramSettings?.(getState().hologram);
    sync(); save();
  }
  for (const field of fields) listen($(`holo-${field}`), 'input', event => {
    const input = event.target, value = Number(input.value);
    if (!Number.isFinite(value)) return;
    getState().hologram[field] = Math.max(Number(input.min), Math.min(Number(input.max), value));
    apply(field);
  });
  listen($('holo-enabled'), 'click', () => { getState().hologram.enabled = !getState().hologram.enabled; apply(); });
  listen($('holo-retry'), 'click', () => { status = { ...status, error: '', status: 'loading' }; sync(); getViewer()?.retryMap?.(); });
  sync();
  return { sync, receive(update) { status = { ...update }; sync(); }, destroy() { listeners.forEach(remove => remove()); } };
}

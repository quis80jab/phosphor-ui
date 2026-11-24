import { mountDirectOperate } from './direct-operate.js?v=hologram-12';
import { mountDroneCluster } from './drone-cluster.js?v=hologram-12';
import { mountMapMarkerFlag } from './map-marker-flag.js?v=hologram-12';
import { installViewerGrid, UI_SCALE } from './viewer-grid.js?v=hologram-12';
import { mountViewerSkin } from './viewer-skin.js?v=hologram-12';
import { createCubeViewer } from './cube-renderer.js?v=scan-5';
import { normalizeViewerState, loadViewerState, saveViewerState, exportViewerState } from './viewer-state.js?v=scan-1';
import { buildReplayAsync } from './mcap-replay.js?v=replay-1';
import { mountViewerTools } from './viewer-tools.js?v=scan-1';
import { mountHologramTools } from './hologram-tools.js?v=scan-2';
import { SCAN_SITES } from './scan-sites.js?v=scan-1';
import { IMPORTED_SCENES } from './imported-scenes.js?v=splats-1';
import { isCaptureAvailable, captureAvailabilityMessage } from './public-assets.js';

installViewerGrid();

const ASSETS = [
  { id: 'sf-waterfront', title: 'SF waterfront', code: 'OSM', meta: 'LIVE HOLOGRAM MAP', terms: 'map osm san francisco waterfront ferry building embarcadero hologram projector' },
  ...Object.values(SCAN_SITES).map(site => ({ id: site.id, title: site.title, code: 'scan.obj', meta: `SCAN / ${site.place}`, terms: site.terms })),
  { id: 'mcap-replay', title: 'SLAM replay', code: 'scan.mcap', meta: 'DEPTH + POSE REPLAY', terms: 'mcap replay slam recording scan depth pose trajectory arachnid flight rosbag' },
  ...Object.entries(IMPORTED_SCENES).map(([id, scene]) => ({ id, title: scene.title, code: 'scene.ply', meta: 'GAUSSIAN SPLATS', terms: `snow globe scan ply scene imported splat ${scene.terms}` })),
  { id: 'calibration', title: 'Calibration', code: 'CUBE_001', meta: 'CALIBRATION / 24 SEC', terms: 'cube target calibration reference' },
  { id: 'surface', title: 'Surface study', code: 'CUBE_002', meta: 'SURFACE / 24 SEC', terms: 'surface texture material defect scratch' },
  { id: 'thermal', title: 'Thermal scan', code: 'CUBE_003', meta: 'THERMAL / 24 SEC', terms: 'thermal heat scan temperature' }
];
const DURATION = 24, FRAMES = 720;
/** Captures the hologram projector draws: the city, a SLAM replay, a scanned monument. */
const isHologram = id => id === 'sf-waterfront' || id === 'mcap-replay' || Object.hasOwn(SCAN_SITES, id);
/** The replay shown, from buildReplay(): {name, data}; its length sets the timeline while it is the capture. */
let replayLoaded = null;
const replayOn = () => state.asset === 'mcap-replay' && !!replayLoaded;
const duration = () => replayOn() && replayLoaded.data.duration > 0 ? replayLoaded.data.duration : DURATION;
const $ = selector => document.querySelector(selector);
const loaded = loadViewerState();
let state = loaded.state, viewer = null, skin = null, pointTools = null, hologramTools = null, droneCluster = null, directOperate = null, playing = false, playFrame = 0, lastTime = 0, saveTimer = 0, dirty = false, suspended = false, actualView = state.view, graphicsAvailable = true, assetAvailable = true, assetStatus = 'ready', assetMessage = '', graphicsError = '';
const query = new URLSearchParams(location.search), requestedMode = query.get('mode');
const requestedScene = Object.hasOwn(IMPORTED_SCENES, query.get('scene')) ? query.get('scene') : 'pumpkin';
if (requestedMode === 'snow-globe' && state.asset !== requestedScene) state = normalizeViewerState({...state,asset:requestedScene,frame:0,view:'iso'});
if ((requestedMode === 'hologram' || query.get('scene') === 'sf-waterfront') && state.asset !== 'sf-waterfront') state = normalizeViewerState({...state,asset:'sf-waterfront',frame:0,view:'iso'});
if (['vfd', 'smooth', 'voxels', 'splats'].includes(query.get('render'))) state = normalizeViewerState({...state,renderMode:query.get('render')});
const unavailableSelection = isCaptureAvailable(state.asset) ? '' : state.asset;
if (unavailableSelection) state = normalizeViewerState({...state, asset:'calibration', frame:0});
const captureButtons = new Map();
let applyingState = false;
const cubeIcon = '<svg viewBox="0 0 30 30" aria-hidden="true"><path d="M15 2 28 9v13L15 29 2 22V9zM2 9l13 7 13-7M15 16v13M15 2v14"/></svg>';

function report(message, error = false) {
  $('#save-status').textContent = message;
  $('#save-status').classList.toggle('error', error);
}
function persist() {
  clearTimeout(saveTimer);
  saveTimer = 0;
  const result = saveViewerState(state);
  dirty = !result.ok;
  $('#note-status').textContent = result.ok ? 'Saved locally' : 'Session only';
  report(result.ok ? 'Saved on this device.' : result.error, !result.ok);
  return result.ok;
}
function scheduleSave() {
  dirty = true;
  clearTimeout(saveTimer);
  $('#note-status').textContent = 'Saving…';
  saveTimer = setTimeout(persist, 450);
}
function formatTime(progress) {
  const total = Math.round(progress * duration() * 100);
  return `${String(Math.floor(total / 6000)).padStart(2, '0')}:${String(Math.floor(total / 100) % 60).padStart(2, '0')}.${String(total % 100).padStart(2, '0')}`;
}
function syncTimeline() {
  const frame = Math.round(state.frame * FRAMES), percent = `${state.frame * 100}%`;
  $('#timeline').value = frame;
  $('#timeline').setAttribute('aria-valuetext', `${(state.frame * duration()).toFixed(2)} seconds of ${duration().toFixed(2)} seconds; frame ${frame} of ${FRAMES}`);
  const end = document.querySelector('.timecode>span'); if (end) end.textContent = `/ ${formatTime(1)}`;
  $('#scrubber-fill').style.width = percent;
  $('#scrubber-head').style.left = percent;
  $('#current-time').textContent = formatTime(state.frame);
  const shown = replayOn() ? viewer?.getReplayFrame() : null;
  $('#frame-readout').textContent = shown ? `FRAME ${String(shown.index + 1).padStart(3, '0')} / ${shown.of} · ${(shown.points / 1000).toFixed(0)}K PTS` : `FRAME ${String(frame).padStart(3, '0')} / ${FRAMES}`;
  skin?.refresh();
}
function syncErrors() {
  $('#scene-loading').hidden = assetStatus !== 'loading' || !graphicsAvailable;
  $('#scene-loading').textContent = assetStatus === 'loading' && assetMessage ? assetMessage : 'LOADING SCENE';
  const message = !graphicsAvailable ? graphicsError || 'The graphics connection was interrupted.' : assetStatus === 'error' ? assetMessage : '';
  $('#viewer-error').hidden = !message;
  if (message) $('#viewer-error').textContent = message;
}
function syncPlayback() {
  const operating=!!viewer?.getDirectOperate();
  const button = $('#play-pause');
  button.setAttribute('aria-label', `${playing ? 'Pause' : 'Play'} ${state.asset === 'sf-waterfront' ? 'map scan' : state.asset === 'mcap-replay' ? 'SLAM replay' : isHologram(state.asset) ? 'scan' : 'turntable'}`);
  button.setAttribute('aria-pressed', String(playing));
  button.textContent = playing ? 'Pause' : 'Play';
  button.disabled = operating || !graphicsAvailable || !assetAvailable;
  for(const control of document.querySelectorAll('[data-view],#reset-view,#stop-playback,#step-back,#step-forward,#timeline'))control.disabled=operating;
  $('#stop-playback').setAttribute('aria-pressed', String(!playing && state.frame === 0));
  $('#playback-status').textContent = !graphicsAvailable ? 'OFFLINE' : assetStatus === 'loading' ? 'LOADING' : assetStatus === 'error' ? 'RETRY' : operating ? 'MANUAL' : playing ? 'PLAYING' : state.frame === 0 ? 'READY' : 'PAUSED';
  $('#loop-toggle').setAttribute('aria-pressed', String(state.loop));
  $('#playback-speed').value = String(state.speed);
  skin?.refresh();
}
function filterCaptures() {
  const query = $('#capture-search').value.trim().toLowerCase(), collection = $('#capture-filter').value;
  let count = 0;
  for (const asset of ASSETS) {
    const visible = (collection === 'all' || collection === asset.id) && `${asset.title} ${asset.code} ${asset.terms}`.toLowerCase().includes(query);
    captureButtons.get(asset.id).hidden = !visible;
    if (visible) count++;
  }
  $('#capture-count').textContent = String(count).padStart(2, '0');
  $('#capture-empty').hidden = count !== 0;
}
function syncSettings() {
  const asset = ASSETS.find(item => item.id === state.asset), imported = IMPORTED_SCENES[state.asset], isSnow = Boolean(imported), isMap = isHologram(state.asset), isCity = state.asset === 'sf-waterfront', isReplay = state.asset === 'mcap-replay', site = SCAN_SITES[state.asset];
  $('#viewer-title').replaceChildren(document.createTextNode(asset.title));
  const code = document.createElement('span'); code.id = 'capture-code'; code.hidden = true; code.textContent = asset.code; $('#viewer-title').append(code);
  $('#cube-canvas').setAttribute('aria-label', isMap ? 'Interactive hologram map. Drag inside the circle to slide the map; drag outside to orbit. Scroll or use plus and minus to scale map geometry inside the fixed projector. Arrow keys slide the map, Home resets, and Space plays or pauses the map scan.' : 'Interactive turntable scene. Drag to rotate, scroll to zoom, use arrow keys to rotate, plus and minus to zoom, Home to reset, and Space to play or pause.');
  $('#map-compass').hidden = !isMap;
  $('#scene-name').textContent = isCity ? 'SAN FRANCISCO WATERFRONT' : site ? site.sceneTitle : isSnow ? imported.sceneTitle : isReplay ? (replayLoaded ? replayLoaded.name.toUpperCase() : 'NO RECORDING') : 'TURNTABLE';
  $('.eyebrow').textContent = isCity ? 'LIVE OPENSTREETMAP' : site ? `SCAN / ${site.place} / ${site.location.latitude.toFixed(4)} N ${site.location.longitude.toFixed(4)} E` : isSnow ? 'IMPORTED SCENE' : isReplay ? 'MCAP / SLAM REPLAY' : 'SPATIAL INSPECTION';
  $('.hud-left>span').textContent = isCity ? 'HOLOGRAM / OSM' : site ? `HOLOGRAM / ${Math.round(site.fit.heightM)} M TALL` : isSnow ? 'SNOW GLOBE' : isReplay ? (replayLoaded ? `${replayLoaded.data.frames.length} FRAMES / ${replayLoaded.data.posed ? 'POSED' : 'NO POSE'}` : 'DEPTH + POSE') : 'OBJECT / CUBE';
  for (const [id, button] of captureButtons) button.setAttribute('aria-pressed', String(id === state.asset));
  for (const button of document.querySelectorAll('[data-layer]')) {
    const unavailable = (isSnow || isMap || isReplay) && button.dataset.layer !== 'rgb';
    const enabled = unavailable ? false : state.layers[button.dataset.layer];
    button.disabled = unavailable;
    button.title = unavailable ? (isCity ? 'OpenStreetMap has no thermal or defect data.' : site ? 'The scan has geometry only.' : isReplay ? 'The replay draws depth, colour and pose only.' : 'The imported PLY has RGB data only.') : '';
    button.setAttribute('aria-pressed', String(enabled === (button.dataset.enabled === 'true')));
  }
  const renderLabel = { voxels:'VFD VOXELS', vfd:'VFD SPLATS', smooth:'SMOOTH' }[state.renderMode];
  $('#layer-readout').textContent = isMap ? `${state.layers.rgb ? 'PALETTE' : 'PHOSPHOR'} / HOLOGRAM` : isSnow ? `${state.layers.rgb ? 'RGB' : 'PHOSPHOR'} / ${renderLabel}` : Object.entries(state.layers).filter(([, enabled]) => enabled).map(([id]) => id.toUpperCase()).join(' / ') || 'WIREFRAME';
  $('#render-control').hidden = !isSnow;
  $('#scene-rendering').value = state.renderMode;
  $('#thermal-legend').hidden = isMap || isSnow || !state.layers.thermal;
  const credit = imported || site;
  $('#scene-credit').hidden = !credit;
  if ($('#map-credit')) $('#map-credit').hidden = !isCity;
  if (credit) {
    const author = $('#scene-credit a:first-child'), license = $('#scene-credit a:last-child');
    author.textContent = credit.author.toUpperCase(); author.href = credit.sourceUrl;
    author.setAttribute('aria-label', `Scene by ${credit.author}`);
    license.textContent = credit.license.replace(' 4.0', ''); license.href = credit.licenseUrl;
    license.setAttribute('aria-label', credit.license);
  }
  $('#viewer-mark').value = state.mark;
  $('#pattern-readout').textContent = state.mark.toUpperCase();
  for (const button of document.querySelectorAll('[data-view]')) button.setAttribute('aria-pressed', String(actualView === button.dataset.view));
  if (document.activeElement !== $('#viewer-notes')) $('#viewer-notes').value = state.notes;
  $('#note-count').textContent = `${Array.from(state.notes).length} / 4000`;
  syncTimeline(); syncPlayback();
  pointTools?.sync(); hologramTools?.sync();
}
function applyState(next) {
  state = normalizeViewerState(next);
  if (!isCaptureAvailable(state.asset)) {
    report(captureAvailabilityMessage(state.asset));
    state = normalizeViewerState({...state, asset:'calibration', frame:0});
  }
  if(!isHologram(state.asset))droneCluster?.close();
  applyingState = true;
  const requestedView = state.view;
  actualView = requestedView;
  viewer?.setEditTool('orbit');
  viewer?.setVoxelScale(state.voxelScale);
  viewer?.setRenderMode(state.renderMode);
  viewer?.setHologramSettings(state.hologram);
  viewer?.setMapTranslation?.({x:state.hologram.offsetX,z:state.hologram.offsetZ});
  viewer?.setMapZoom?.(state.hologram.zoom);
  viewer?.setAsset(state.asset);
  viewer?.setLayers(state.layers);
  viewer?.setAppearance({ mark: state.mark });
  viewer?.setFrame(state.frame);
  state.view = requestedView;
  viewer?.setView(requestedView);
  applyingState = false;
  syncSettings();
}
function setFrame(progress) {
  state.frame = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  dirty = true;
  viewer?.setFrame(state.frame);
  syncTimeline();
}
function pause({ save = true } = {}) {
  playing = false;
  cancelAnimationFrame(playFrame);
  playFrame = 0; lastTime = 0;
  syncPlayback();
  if (save && dirty) scheduleSave();
}
function tick(now) {
  if (!playing || suspended || document.hidden) return;
  if (!lastTime) lastTime = now;
  const delta = Math.min((now - lastTime) / 1000, .25);
  lastTime = now;
  let next = state.frame + delta * state.speed / duration();
  if (next >= 1) {
    if (state.loop) next %= 1;
    else { setFrame(1); pause(); return; }
  }
  setFrame(next);
  playFrame = requestAnimationFrame(tick);
}
function togglePlayback() {
  if(viewer?.getDirectOperate())return;
  if (playing) { pause(); return; }
  if (!viewer || !graphicsAvailable || !assetAvailable || suspended) return;
  if (state.frame >= 1) setFrame(0);
  playing = true; lastTime = 0; syncPlayback();
  playFrame = requestAnimationFrame(tick);
}
function seek(frame) {
  if(viewer?.getDirectOperate())return;
  pause({ save: false }); setFrame(frame / FRAMES); syncPlayback(); scheduleSave();
}

for (const asset of ASSETS) {
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'capture-item'; button.dataset.vfd = 'capture'; button.setAttribute('aria-label', `Open ${asset.title}`);
  button.innerHTML = `${cubeIcon}<span><span class="capture-name"></span><span class="capture-meta"></span></span>`;
  button.querySelector('.capture-name').textContent = asset.title;
  const available = isCaptureAvailable(asset.id);
  button.disabled = !available;
  button.dataset.captureUnavailable = String(!available);
  button.title = available ? asset.title : `${asset.title}: optional capture data is not bundled.`;
  button.setAttribute('aria-label', available ? `Open ${asset.title}` : `${asset.title}: optional data not bundled`);
  button.querySelector('.capture-meta').textContent = available ? `${asset.code} · ${asset.meta}` : 'OPTIONAL DATA / NOT BUNDLED';
  button.addEventListener('click', () => {
    if (state.asset === asset.id) { if (!assetAvailable) viewer?.setAsset(asset.id); return; }
    pause({ save: false });
    applyState({ ...state, asset: asset.id, frame: 0, view: 'iso' });
    scheduleSave();
  });
  captureButtons.set(asset.id, button); $('#capture-list').append(button);
}

pointTools = mountViewerTools({ getState:()=>state, getViewer:()=>viewer,
  pause:()=>pause({save:false}), save:scheduleSave, refresh:()=>skin?.refresh(),
  getAvailable:()=>graphicsAvailable });

hologramTools = mountHologramTools({ getState:()=>state, getViewer:()=>viewer, save:scheduleSave, refresh:()=>skin?.refresh(), getAvailable:()=>graphicsAvailable });

directOperate = mountDirectOperate({viewport:$('#viewport'),canvas:$('#cube-canvas'),
  onInput:input=>viewer?.setDroneInput(input),
  onExit:()=>viewer?.setDirectOperate(false),
  onLayout:layout=>viewer?.setDirectOperateLayout(layout),
  refresh:root=>skin?.refreshOverlay(root)
});

droneCluster = mountDroneCluster({viewport:$('#viewport'),canvas:$('#cube-canvas'),
  refresh:root=>skin?.refreshOverlay(root),
  onHold:held=>viewer?.setMapMarkerHeld(held),
  onDirectOperate(){pause({save:false});viewer?.setDirectOperate(true);},
  onLocate(){pause({save:false});if(viewer?.focusMapMarker()){syncSettings();scheduleSave();}}
});

const markerFlag = mountMapMarkerFlag({root:$('#map-marker-overlay'),canvas:$('#cube-canvas'),
  refresh:root=>skin?.refreshOverlay(root),
  onView(){pause({save:false});droneCluster.open();}
});

try {
  viewer = createCubeViewer($('#cube-canvas'), {
    onPoseChange(pose) {
      actualView = pose.view || actualView;
      if (viewer && pose.preset) state.view = pose.preset;
      if (viewer && !applyingState && isHologram(state.asset) && Number.isFinite(pose.zoom) && state.hologram.zoom !== pose.zoom) {
        state.hologram.zoom = pose.zoom;
        hologramTools?.sync(); scheduleSave();
      }
      $('#pose-readout').textContent = `AZ ${String(Math.round(pose.yaw)).padStart(3, '0')}° / EL ${String(Math.round(pose.pitch)).padStart(3, '0')}°`;
      const compass = $('#map-compass');
      if (Number.isFinite(pose.mapHeading)) {
        compass.dataset.heading = String(pose.mapHeading);
        compass.dataset.elevation = String(pose.mapElevation);
        compass.dataset.gesture = pose.mapGesture || 'idle';
        const heading = Math.round(pose.mapHeading) % 360, elevation = Math.round(pose.mapElevation);
        compass.textContent = `HDG ${String(heading).padStart(3,'0')} / EL ${elevation}`;
        compass.setAttribute('aria-label',`Map compass: heading ${heading} degrees, elevation ${elevation} degrees${pose.mapOrbiting ? ', orbiting' : ''}`);
      }
      document.querySelectorAll('[data-view]').forEach(button => button.setAttribute('aria-pressed', String(actualView === button.dataset.view)));
    },
    onInteraction() { pause(); },
    onPointEdit(update) { pointTools?.receive(update); },
    onMapState(update) { hologramTools?.receive(update); },
    onMapMarker(marker) { markerFlag.update(marker?.directOperate ? null : marker); droneCluster?.receive(marker); directOperate?.receive(marker); },
    onDirectOperateChange(active) {
      $('#viewport').classList.toggle('is-direct-operate',active);
      if(active){droneCluster?.close();directOperate?.open();}
      else{directOperate?.close();if(isHologram(state.asset)&&graphicsAvailable)droneCluster?.open();}
      syncPlayback();
    },
    onMapTranslation(offset) {
      state.hologram.offsetX = offset.x; state.hologram.offsetZ = offset.z;
      hologramTools?.sync(); scheduleSave();
    },
    onAssetState(update) {
      if (update.asset !== state.asset) return;
      assetStatus = update.status; assetMessage = update.message || '';
      assetAvailable = assetStatus === 'ready';
      syncErrors(); syncPlayback();
      pointTools?.sync(); hologramTools?.sync();
      skin?.refresh();
    },
    onError(error) {
      graphicsAvailable = false;
      graphicsError = typeof error === 'string' ? error : error?.message || 'The graphics connection was interrupted. Reload to restore the viewer.';
      pause(); syncErrors(); pointTools?.sync(); hologramTools?.sync();
    }
  });
  viewer.setPointEdits(state.pointEdits);
  applyState(state);
} catch (error) {
  graphicsAvailable = false; graphicsError = 'The 3D viewer needs WebGL 2. Enable graphics acceleration and reload.';
  syncErrors();
  syncSettings();
  console.error(error);
}

$('#capture-search').addEventListener('input', filterCaptures);
$('#capture-filter').addEventListener('change', filterCaptures);
$('#clear-search').addEventListener('click', () => { $('#capture-search').value = ''; $('#capture-filter').value = 'all'; filterCaptures(); });
for (const button of document.querySelectorAll('[data-layer]')) button.addEventListener('click', () => {
  const layer = button.dataset.layer;
  state.layers[layer] = button.dataset.enabled === 'true';
  viewer?.setLayers(state.layers); syncSettings(); scheduleSave();
});
$('#viewer-mark').addEventListener('change', event => {
  state.mark = event.target.value;
  viewer?.setAppearance({ mark: state.mark }); syncSettings(); scheduleSave();
});
$('#scene-rendering').addEventListener('change', event => {
  pause({ save: false });
  state.renderMode = event.target.value;
  viewer?.setRenderMode(state.renderMode); syncSettings(); scheduleSave();
});
for (const button of document.querySelectorAll('[data-view]')) button.addEventListener('click', () => {
  pause({ save: false }); state.view = button.dataset.view;
  viewer?.setView(state.view); syncSettings(); scheduleSave();
});
$('#reset-view').addEventListener('click', () => {
  pause({ save: false }); state.view = 'iso'; setFrame(0); viewer?.resetView(); syncSettings(); scheduleSave();
});
$('#play-pause').addEventListener('click', togglePlayback);
$('#stop-playback').addEventListener('click', () => seek(0));
$('#step-back').addEventListener('click', () => stepReplay(-1) || seek(Math.round(state.frame * FRAMES) - 1));
$('#step-forward').addEventListener('click', () => stepReplay(1) || seek(Math.round(state.frame * FRAMES) + 1));
$('#timeline').addEventListener('pointerdown', () => pause({ save: false }));
$('#timeline').addEventListener('input', event => seek(Number(event.target.value)));
$('#loop-toggle').addEventListener('click', () => { state.loop = !state.loop; syncPlayback(); scheduleSave(); });
$('#playback-speed').addEventListener('change', event => { state.speed = Number(event.target.value); syncPlayback(); scheduleSave(); });
$('#cube-canvas').addEventListener('keydown', event => { if (event.code === 'Space') { event.preventDefault(); togglePlayback(); } });
$('#viewer-notes').addEventListener('input', event => { state.notes = Array.from(event.target.value).slice(0, 4000).join(''); $('#note-count').textContent = `${Array.from(state.notes).length} / 4000`; scheduleSave(); });
$('#save-viewer').addEventListener('click', persist);
$('#export-viewer').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([exportViewerState(state)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'phosphor-viewer.json'; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000); report('Viewer setup exported.');
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('pagehide', () => { suspended = true; pause({ save: false }); if (dirty) persist(); });
window.addEventListener('pageshow', () => { suspended = false; });
if (unavailableSelection) report(captureAvailabilityMessage(unavailableSelection));
else if (loaded.warning) report(loaded.warning, true);
if (requestedMode === 'snow-globe' || requestedMode === 'hologram') scheduleSave();

const narrowLayout = matchMedia(`(width < ${800 * UI_SCALE}px)`);
function syncRailLayout(){ $('#viewer-notes').closest('details').open = !narrowLayout.matches; }
narrowLayout.addEventListener('change', syncRailLayout); syncRailLayout();
$('#cube-canvas').addEventListener('cube-renderer-state', event => { graphicsAvailable = event.detail.available; if (graphicsAvailable) graphicsError = ''; else pause(); syncErrors(); syncPlayback(); pointTools?.sync(); hologramTools?.sync(); });

try { skin = mountViewerSkin({getState:()=>state,getPlaying:()=>playing}); } catch(error) { console.error('VFD control renderer unavailable',error); }

// ------------------------------------------------------------------------ SLAM replay of an .mcap
// As arachnid-flight replays a scan: open a recording (button, drop on the view, or ?mcap=<url>),
// and the timeline walks it in recording time, the cloud growing frame by frame.
/** Steps the replay one recording frame; false when no replay is shown, so the timeline steps instead. */
function stepReplay(delta) {
  if (!replayOn() || viewer?.getDirectOperate()) return false;
  const info = viewer?.getReplayFrame();
  if (!info) return false;
  const {frames, duration: length} = replayLoaded.data, k = Math.max(0, Math.min(frames.length - 1, info.index + delta));
  pause({ save: false });
  setFrame(length > 0 ? frames[k].timeS / length : k / Math.max(1, frames.length - 1));
  syncPlayback(); scheduleSave();
  return true;
}
async function openReplay(bytes, name) {
  if (!viewer || !graphicsAvailable) return;
  pause({ save: false });
  if (state.asset !== 'mcap-replay') applyState({ ...state, asset: 'mcap-replay', frame: 0, view: 'iso' });
  assetStatus = 'loading'; assetMessage = `READING ${name.toUpperCase()}`; assetAvailable = false; syncErrors(); syncPlayback();
  await new Promise(resolve => setTimeout(resolve, 30)); // let the loading line paint before the parse
  try {
    const data = await buildReplayAsync(bytes);
    replayLoaded = { name, data };
    viewer.loadReplay(data);
    const source = $('#replay-source');
    source.hidden = false;
    source.textContent = `${name} · ${data.frames.length} FRAMES · ${(data.pointCount / 1000).toFixed(0)}K PTS${data.posed ? '' : ' · NO POSE'}${data.truncated ? ' · CUT' : ''}`;
    setFrame(0); syncSettings(); scheduleSave();
  } catch (error) {
    console.error(error);
    assetStatus = 'error'; assetAvailable = false; assetMessage = `COULD NOT REPLAY ${name.toUpperCase()}: ${error.message}`;
    syncErrors(); syncPlayback();
  }
}
$('#open-mcap').addEventListener('click', () => $('#mcap-file').click());
function loadRecording(url, name) {
  return fetch(url).then(response => { if (!response.ok) throw new Error(`HTTP ${response.status}`); return response.arrayBuffer(); })
    .then(bytes => openReplay(bytes, name))
    .catch(error => { assetStatus = 'error'; assetAvailable = false; assetMessage = `COULD NOT FETCH ${name.toUpperCase()}: ${error.message}`; syncErrors(); syncPlayback(); });
}
$('#mcap-file').addEventListener('change', async event => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (file) openReplay(await file.arrayBuffer(), file.name);
});
$('#viewport').addEventListener('dragover', event => { if ([...(event.dataTransfer?.items || [])].some(item => item.kind === 'file')) event.preventDefault(); });
$('#viewport').addEventListener('drop', async event => {
  const file = [...(event.dataTransfer?.files || [])].find(item => /\.mcap$/i.test(item.name));
  if (!file) return;
  event.preventDefault();
  openReplay(await file.arrayBuffer(), file.name);
});
if (query.get('mcap')) {
  const url = query.get('mcap'), name = decodeURIComponent(url.split(/[?#]/)[0].split('/').pop() || 'recording.mcap');
  loadRecording(url, name);
}

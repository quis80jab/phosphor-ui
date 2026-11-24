import { mountGridMenus } from './viewer-grid-menus.js?v=pane-140';
import { createViewerGridRenderer } from './viewer-grid-renderer.js?v=vfd-splats-1';
import { paintGridControl } from './viewer-grid-paint.js?v=hologram-12';
import { loadBenchState } from './bench-store.js?v=grid-1';
import { PIXEL_PITCH, UI_PIXELS, UI_CELL, pixelBounds } from './viewer-grid.js?v=pane-140';

const LABELS = '.field-label,.eyebrow,.note-meta>span,#save-status,.viewport-hud>span,.viewport-bottom>span,.thermal-legend>span,.no-results>p';
function visible(element) {
  if (!element.isConnected || element.closest('[hidden]')) return false;
  for (let node = element; node; node = node.parentElement) {
    if (node.tagName === 'DETAILS' && !node.open && !node.querySelector(':scope > summary')?.contains(element)) return false;
    const style = getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

/** One screen-sized bitmap, painted in physical grid coordinates with no asset resizing. */
export function mountViewerSkin({ getState = () => ({}), getPlaying = () => false } = {}) {
  const output = document.getElementById('viewer-ui-gl');
  const sceneCanvas = document.getElementById('cube-canvas');
  const source = document.createElement('canvas'), ctx = source.getContext('2d');
  if (!ctx || !output) throw new Error('The display framebuffer is unavailable.');
  let renderer, scheduled = 0, destroyed = false, available = true;
  let hovered = null, held = null, lastSignature = '', guides = false;
  const entries = [];
  let inventoryDirty = true, layoutDirty = true;
  let optics = { brightness:110, glow:40, contrast:110, grid:50, refraction:0 };
  try { optics = loadBenchState().state.optics || optics; } catch { /* Keep the display defaults. */ }
  try { guides = localStorage.getItem('phosphor-viewer-grid-guides') === 'true'; } catch { /* Optional guide state. */ }
  const guideButton = document.getElementById('grid-toggle');
  guideButton?.setAttribute('aria-pressed', String(guides));
  function tagLabels() {
    for (const element of document.querySelectorAll(LABELS)) {
      if (!element.dataset.vfd) { element.dataset.vfd = 'label'; element.dataset.vfdTone = 'dim'; }
    }
    for (const element of document.querySelectorAll('.hud-right>span,.thermal-legend>span:last-child')) element.dataset.vfdAlign = 'right';
  }
  function inventory() {
    tagLabels(); entries.length = 0;
    for (const element of document.querySelectorAll('[data-vfd]')) {
      entries.push({ element, type:element.dataset.vfd, bounds:null, onScreen:false });
    }
    const overlayOrder = entry => entry.element.closest('.grid-select-menu') ? 6 : entry.element.closest('.direct-operate') ? 4 : entry.element.closest('.drone-cluster-header') ? 3.25 : entry.element.closest('.drone-cluster') ? 3 : entry.element.closest('.map-marker-overlay') ? 2.5 : entry.type === 'alert' ? 5 : entry.type === 'panel' ? 0 : ['lasso-overlay','marker-tether','marker-panel'].includes(entry.type) ? 1 : 2;
    entries.sort((a,b) => overlayOrder(a) - overlayOrder(b));
    inventoryDirty = false; layoutDirty = true;
  }
  function measure() {
    measureScene();
    for (const entry of entries) measureEntry(entry);
    layoutDirty = false;
  }
  function measureEntry(entry) {
      const rect = entry.element.getBoundingClientRect();
      entry.bounds = pixelBounds(rect);
      const menu = entry.element.closest('.grid-select-menu');
      entry.clip = null;
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight, clipped = false;
      for (let parent = entry.element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent), clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX), clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY);
        if (!clipX && !clipY) continue;
        const bounds = parent.getBoundingClientRect(); clipped = true;
        if (clipX) { left = Math.max(left,bounds.left+parent.clientLeft); right = Math.min(right,bounds.left+parent.clientLeft+parent.clientWidth); }
        if (clipY) { top = Math.max(top,bounds.top+parent.clientTop); bottom = Math.min(bottom,bounds.top+parent.clientTop+parent.clientHeight); }
      }
      if (menu && menu !== entry.element) {
        const bounds = menu.getBoundingClientRect();
        left = Math.max(left,bounds.left+UI_CELL); top = Math.max(top,bounds.top+UI_CELL);
        right = Math.min(right,bounds.right-UI_CELL); bottom = Math.min(bottom,bounds.bottom-UI_CELL); clipped = true;
      }
      if (clipped) entry.clip = pixelBounds({left,top,width:Math.max(0,right-left),height:Math.max(0,bottom-top)});
      entry.onScreen = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight && visible(entry.element);
  }
  function refreshOverlay(root) {
    if (destroyed) return;
    if (!inventoryDirty && !layoutDirty) for (const entry of entries) {
      if (entry.element === root || root.contains(entry.element)) measureEntry(entry);
    }
    refresh();
  }
  function interactive(target) { return target instanceof Element ? target.closest('button,a,input,select,summary,textarea') : null; }
  function focused(element) { return element === hovered || element === held || element === document.activeElement || element.contains(document.activeElement); }
  function signature(entry) {
    const element = entry.element;
    return [entry.onScreen, entry.type, element.dataset.vfdLabel, element.dataset.vfdTone, element.dataset.vfdAlign, element.dataset.vfdLines, element.dataset.vfdMultiline,
      element.dataset.x, element.dataset.y, element.dataset.side, element.dataset.speed, element.dataset.verticalSpeed, element.dataset.yaw, element.dataset.available, element.dataset.latitude, element.dataset.longitude, element.dataset.altitude, element.dataset.axis, element.dataset.value, element.dataset.roll, element.dataset.pitch, element.dataset.feed, element.dataset.zoom, element.getAttribute('aria-expanded'), element.dataset.bins, element.dataset.selectedBins, element.dataset.points, element.dataset.heading, element.dataset.elevation, element.dataset.gesture, ...Object.values(entry.bounds), element.textContent, element.value,
      element.getAttribute('aria-pressed'),element.getAttribute('aria-current'),element.getAttribute('aria-selected'),element.disabled,
      element.selectedIndex,element.selectionStart,element.selectionEnd,element.scrollLeft,
      focused(element), element === held].join('|');
  }
  function flush() {
    scheduled = 0;
    if (destroyed || document.hidden || !available) return;
    try {
      if (inventoryDirty) inventory();
      const width = Math.ceil(innerWidth / PIXEL_PITCH), height = Math.ceil(innerHeight / PIXEL_PITCH);
      if (source.width !== width || source.height !== height) {
        source.width = width; source.height = height; layoutDirty = true; lastSignature = '';
      }
      if (layoutDirty) measure();
      const state = getState(), playing = getPlaying();
      renderer.setPattern(state.mark);
      syncSceneGrid(state);
      const nextSignature = [guides, state.frame, state.renderMode, playing, ...entries.map(signature)].join('\n');
      if (nextSignature === lastSignature) return;
      ctx.setTransform(1,0,0,1,0,0); ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0,0,width,height);
      if (guides) {
        ctx.fillStyle = '#23453d';
        // Guides share the UI origin, while the shader's pixel mask never moves.
        const offset = ((Math.round(scrollY / PIXEL_PITCH) % UI_PIXELS) + UI_PIXELS) % UI_PIXELS;
        for (let x = 0; x < width; x += UI_PIXELS) for (let y = -offset; y < height; y += UI_PIXELS) ctx.fillRect(x,y,1,1);
      }
      let controls = 0;
      for (const entry of entries) {
        if (!entry.onScreen) continue;
        ctx.save();
        if (entry.clip) { ctx.beginPath(); ctx.rect(entry.clip.x,entry.clip.y,entry.clip.width,entry.clip.height); ctx.clip(); }
        paintGridControl(ctx,{element:entry.element,type:entry.type,...entry.bounds,
          focused:focused(entry.element),held:entry.element===held,playing,state});
        ctx.restore();
        controls++;
      }
      lastSignature = nextSignature;
      renderer.invalidate();
      document.body.classList.add('vfd-rendered'); output.style.visibility = '';
      output.dataset.controls = String(controls);
      output.dataset.uiPixels = String(UI_PIXELS);
      output.dataset.gridGuides = String(guides);
      output.dataset.composites = String((Number(output.dataset.composites)||0)+1);
    } catch (error) { fallback(); console.error('VFD grid unavailable:',error); }
  }
  function refresh() { if (!scheduled && !destroyed && !document.hidden) scheduled = requestAnimationFrame(flush); }
  function relayout() { layoutDirty = true; refresh(); }
  function measureScene() {
    renderer?.setSceneBounds(sceneCanvas ? pixelBounds(sceneCanvas.getBoundingClientRect()) : null);
  }
  function syncSceneGrid(state = getState()) {
    renderer.setSceneGrid(state.renderMode !== 'smooth' || sceneCanvas?.dataset.sceneRepresentation !== 'gaussian-splats');
  }
  function sceneFrame() {
    if (destroyed) return;
    measureScene();
    syncSceneGrid();
    renderer.setSceneMonochrome(sceneCanvas?.dataset.sceneMonochrome === 'true');
    renderer.setSceneFrame();
  }
  function sceneState(event) {
    if (event.detail?.available === false) renderer.setSceneAvailable(false);
  }
  function fallback() { available = false; document.body.classList.remove('vfd-rendered'); output.style.visibility = 'hidden'; }
  function renderState(event) {
    available = event.detail?.available !== false;
    if (!available) fallback(); else { lastSignature = ''; relayout(); }
  }
  function pointer(event) {
    if (event.type === 'pointerover') hovered = interactive(event.target);
    else if (event.type === 'pointerout') hovered = interactive(event.relatedTarget);
    else if (event.type === 'pointerdown') held = interactive(event.target);
    else held = null;
    refresh();
  }
  function toggleGuides() {
    guides = !guides; guideButton.setAttribute('aria-pressed',String(guides));
    try { localStorage.setItem('phosphor-viewer-grid-guides',String(guides)); } catch { /* Session display remains usable. */ }
    refresh();
  }
  output.addEventListener('viewer-grid-renderer-state',renderState);
  renderer = createViewerGridRenderer(output,source,optics,sceneCanvas);
  sceneCanvas?.addEventListener('cube-renderer-frame',sceneFrame);
  sceneCanvas?.addEventListener('cube-renderer-state',sceneState);
  const observer = new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      if (record.target === output || record.target === document.body) continue;
      if (record.type === 'childList' && [...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1)) inventoryDirty = true;
      if (record.attributeName === 'data-vfd') inventoryDirty = true;
      if (record.attributeName === 'hidden' || record.attributeName === 'open') layoutDirty = true;
      changed = true;
    }
    if (changed) refresh();
  });
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,
    attributeFilter:['hidden','open','aria-pressed','aria-current','aria-selected','disabled','data-vfd','data-vfd-label','data-vfd-tone','data-vfd-align','data-vfd-lines','data-vfd-multiline','data-bins','data-selected-bins','data-points','data-heading','data-elevation','data-gesture']});
  const sizeObserver = new ResizeObserver(relayout);
  sizeObserver.observe(document.querySelector('.workspace'));
  sizeObserver.observe(document.querySelector('.left-rail'));
  sizeObserver.observe(document.getElementById('viewer-error'));
  const pointTools = document.getElementById('point-tools');
  if (pointTools) sizeObserver.observe(pointTools);
  const hologramTools = document.getElementById('hologram-tools');
  if (hologramTools) sizeObserver.observe(hologramTools);
  const changes = ['input','change','focusin','focusout','selectionchange','visibilitychange'];
  const pointers = ['pointerover','pointerout','pointerdown','pointerup','pointercancel'];
  changes.forEach(event=>document.addEventListener(event,refresh,true));
  pointers.forEach(event=>document.addEventListener(event,pointer,true));
  document.addEventListener('toggle',relayout,true);
  document.addEventListener('viewer-grid-layout',relayout);
  window.addEventListener('resize',relayout);
  window.addEventListener('scroll',relayout,{capture:true,passive:true});
  guideButton?.addEventListener('click',toggleGuides);
  const menus = mountGridMenus({refresh:()=>{ inventoryDirty = true; relayout(); }});
  flush();
  return { refresh, refreshOverlay, destroy() {
    destroyed = true; menus.destroy(); cancelAnimationFrame(scheduled); observer.disconnect(); sizeObserver.disconnect(); renderer.destroy();
    sceneCanvas?.removeEventListener('cube-renderer-frame',sceneFrame);
    sceneCanvas?.removeEventListener('cube-renderer-state',sceneState);
    changes.forEach(event=>document.removeEventListener(event,refresh,true));
    pointers.forEach(event=>document.removeEventListener(event,pointer,true));
    document.removeEventListener('toggle',relayout,true); document.removeEventListener('viewer-grid-layout',relayout);
    window.removeEventListener('resize',relayout); window.removeEventListener('scroll',relayout,true);
    guideButton?.removeEventListener('click',toggleGuides); output.removeEventListener('viewer-grid-renderer-state',renderState);
    document.body.classList.remove('vfd-rendered');
    output.style.visibility = 'hidden';
  }};
}

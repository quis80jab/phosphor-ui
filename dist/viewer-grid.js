/** Compact UI, one shared display lattice, and eight display pixels per UI cell. */
export const PANE_ENLARGEMENT = 1.4;
export const UI_SCALE = 1 / PANE_ENLARGEMENT;
export const PIXEL_PITCH = 2 * UI_SCALE;
export const UI_PIXELS = 8;
export const UI_CELL = PIXEL_PITCH * UI_PIXELS;
export const TOOL_RAIL_CELLS = 20;
export const TOOL_RAIL_BREAKPOINT = 88 * UI_CELL;
export const floorCell = value => Math.floor(value / UI_CELL + 1e-9) * UI_CELL;

export function gridMetrics(width, height, { tools = false } = {}) {
  const surfaceWidth = Math.max(UI_CELL, floorCell(width));
  const compact = width < 800 * UI_SCALE;
  const railWidth = compact ? surfaceWidth : Math.min(256 * UI_SCALE, Math.max(224 * UI_SCALE, floorCell(surfaceWidth / 5)));
  const toolRailWidth = tools && width >= TOOL_RAIL_BREAKPOINT ? TOOL_RAIL_CELLS * UI_CELL : 0;
  const mainWidth = compact ? surfaceWidth : surfaceWidth - railWidth - toolRailWidth;
  const viewportWidth = Math.max(UI_CELL, mainWidth - UI_CELL * 4);
  // Grow the previous pane height by 40%, rounded to the shared layout lattice.
  // Width uses all remaining room: no horizontal overflow or clipped controls.
  const referenceCell = 16, referenceFloor = value => Math.floor(value / referenceCell) * referenceCell;
  const referenceWidth = Math.max(referenceCell, referenceFloor(width));
  const referenceRail = compact ? 0 : Math.max(224, referenceFloor(referenceWidth / 5));
  const referencePane = Math.max(referenceCell, referenceWidth - referenceRail - referenceCell * 4);
  const referenceHeight = Math.max(compact ? 256 : 320, Math.min(640, referenceFloor(referencePane / (compact ? 1 : 1.9))));
  const viewportHeight = Math.round(referenceHeight * PANE_ENLARGEMENT / UI_CELL) * UI_CELL;
  return { surfaceWidth, railWidth, toolRailWidth, toolsStacked:tools && !toolRailWidth, mainWidth, viewportWidth, viewportHeight, compact,
    pixelColumns: Math.ceil(width / PIXEL_PITCH), pixelRows: Math.ceil(height / PIXEL_PITCH),
    uiColumns: surfaceWidth / UI_CELL };
}

/** Positions are expressed in display pixels, never resized texture coordinates. */
export function pixelBounds(rect) {
  const x = Math.round(rect.left / PIXEL_PITCH), y = Math.round(rect.top / PIXEL_PITCH);
  return { x, y, width: Math.round(rect.width / PIXEL_PITCH), height: Math.round(rect.height / PIXEL_PITCH) };
}

export function installViewerGrid() {
  function alignPixels() {
    const correction = ((scrollY % PIXEL_PITCH) + PIXEL_PITCH) % PIXEL_PITCH;
    document.documentElement.style.setProperty('--pixel-scroll-correction', `${correction}px`);
  }
  function resize() {
    const metrics = gridMetrics(innerWidth, innerHeight, {tools:Boolean(document.getElementById('point-histogram'))}), root = document.documentElement;
    root.style.setProperty('--ui-scale', String(UI_SCALE));
    for (const [name, value] of Object.entries({ 'surface-width': metrics.surfaceWidth,
      'rail-width': metrics.railWidth, 'tool-rail-width':TOOL_RAIL_CELLS * UI_CELL, 'viewer-height': metrics.viewportHeight, 'surface-height': floorCell(innerHeight) })) {
      root.style.setProperty(`--${name}`, `${value}px`);
    }
    document.body.dataset.gridMode = metrics.compact ? 'compact' : 'wide';
    const navLabels = metrics.compact ? ['VIEW','PARTS','OPTICS'] : ['VIEWER','COMPONENTS','OPTICAL LAYERS'];
    document.querySelectorAll('.app-header nav a').forEach((link,index) => { link.dataset.vfdLabel = navLabels[index]; });
    document.body.dataset.pixelPitch = String(PIXEL_PITCH);
    document.body.dataset.uiPixels = String(UI_PIXELS);
    document.body.dataset.uiScale = String(UI_SCALE);
    document.dispatchEvent(new CustomEvent('viewer-grid-layout'));
  }
  resize(); alignPixels(); window.addEventListener('resize', resize);
  window.addEventListener('scroll', alignPixels, { passive:true });
  return () => { window.removeEventListener('resize', resize); window.removeEventListener('scroll', alignPixels); };
}

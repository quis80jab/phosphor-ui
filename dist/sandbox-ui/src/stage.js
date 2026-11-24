// The stage: one page's display. It holds the bitmap every element is painted into, Phosphor's one compositor
// over that bitmap, and for each element a place in layout cells with the real inputs that make it work.
// A page adds elements by their ladder id, listens to what a person does, and sets new states; the stage paints.
import {createViewerGridRenderer} from '../../viewer-grid-renderer.js?v=vfd-splats-1';
import {PIXEL_PITCH, UI_CELL, UI_PIXELS, pixelBounds} from './phosphor.js';
import {byId, paintElement} from './ladder.js';
import {ADAPTERS} from './adapters.js';
import {text, wrap, LINE} from './paint/primitives.js';
import {PANEL, DIM} from './palette.js';

const OPTICS = {brightness: 110, glow: 40, contrast: 110, grid: 50, refraction: 0};   // the kit's own defaults
// The real controls are there and work; only the painting is seen.
const STYLE = `.pk-host{position:relative;overflow:hidden}.pk-item{position:absolute;margin:0;overflow:hidden;color:transparent;user-select:none}
.pk{position:absolute;margin:0;padding:0;border:0;background:transparent;color:transparent;font:inherit;opacity:0;outline:none;appearance:none;-webkit-appearance:none;caret-color:transparent}
.pk:disabled{cursor:default!important}`;

export function createStage({host, plain = false, optics = OPTICS, pattern = 'dots'} = {}) {
  const doc = host.ownerDocument, win = doc.defaultView, items = new Map(), cleanup = [];
  let frame = 0, timer = 0, destroyed = false, renderer = null, animate = null;

  const style = doc.createElement('style');
  style.textContent = STYLE;
  doc.head.append(style);
  host.classList.add('pk-host');

  const source = doc.createElement('canvas'), ctx = source.getContext('2d'), output = doc.createElement('canvas');
  for (const canvas of [source, output]) {
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {position: 'fixed', inset: '0', width: '100vw', height: '100vh', pointerEvents: 'none'});
  }
  source.style.imageRendering = 'pixelated';
  function showPlain() {
    renderer?.destroy();
    renderer = null;
    output.remove();
    doc.body.append(source);
    doc.documentElement.dataset.display = 'plain';
  }
  if (plain) showPlain();
  else {
    doc.body.append(output);
    output.addEventListener('viewer-grid-renderer-state', event => { if (!event.detail.available) { showPlain(); request(); } });
    try {
      renderer = createViewerGridRenderer(output, source, optics);
      renderer.setPattern(pattern);
      doc.documentElement.dataset.display = 'phosphor';
    } catch {
      showPlain();
    }
  }

  function request() {
    if (!destroyed && !frame) frame = win.requestAnimationFrame(paint);
  }

  function paintWords(box, item) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, box.width, box.height);
    ctx.clip();
    wrap(String(item.said).toUpperCase(), box.width / item.scale).forEach((line, i) => text(ctx, line, box.x, box.y + 1 + i * LINE * item.scale, item.colour, {scale: item.scale}));
    ctx.restore();
  }

  function paint(now) {
    frame = 0;
    if (destroyed) return;
    animate?.(now);
    const w = Math.ceil(win.innerWidth / PIXEL_PITCH), h = Math.ceil(win.innerHeight / PIXEL_PITCH);
    if (source.width !== w) source.width = w;
    if (source.height !== h) source.height = h;
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, 0, w, h);
    let moving = !!animate;
    for (const item of items.values()) {
      const rect = item.node.getBoundingClientRect();
      if (rect.width === 0 || rect.bottom < 0 || rect.top > win.innerHeight) continue;
      const box = pixelBounds(rect);
      if (item.kind === 'words') { paintWords(box, item); continue; }
      if (item.live) moving = true;
      const state = {...(item.live ? item.live(now / 1000) : item.state), ...item.ui};
      if (item.entry) paintElement(ctx, item.entry, box, state);
      else paintElement(ctx, {paint: item.paint}, box, state);
    }
    renderer?.invalidate();
    // Something on show is moving: paint again, about fifteen times a second.
    if (moving && !timer && !doc.hidden) timer = win.setTimeout(() => { timer = 0; request(); }, 66);
  }

  function place(item, cells) {
    item.cells = cells;
    Object.assign(item.node.style, {left: `${cells.col * UI_CELL}px`, top: `${cells.row * UI_CELL}px`, width: `${cells.cols * UI_CELL}px`, height: `${cells.rows * UI_CELL}px`});
    item.adapter?.sync?.(item.state);
    request();
  }

  function remove(id) {
    const item = items.get(id);
    if (!item) return;
    item.node.remove();
    items.delete(id);
    request();
  }

  const handle = item => ({
    id: item.id,
    node: item.node,
    get state() { return item.state; },
    /** New facts for the element: it is painted again and its real inputs follow. */
    set(patch) { Object.assign(item.state, patch); item.adapter?.sync?.(item.state); if (patch.label !== undefined && !item.adapter) item.node.setAttribute('aria-label', patch.label); request(); },
    say(said) { item.said = said; item.node.textContent = said; request(); },
    place(cells) { place(item, cells); },
    remove() { remove(item.id); },
  });

  /**
   * Put an element on the stage. `element` is its id in the ladder (or give `paint` for one of the page's own),
   * `cells` its place `{col, row, cols, rows}`, `state` what it shows, `on` what to call when a person acts
   * (`change(state, patch)`, `press()`, `key(name)`, `point(place)`, `enter()`). `inert` leaves the real inputs out;
   * `live(t)` gives a state for the time, for samples that move.
   */
  function add(spec) {
    remove(spec.id);
    const entry = spec.element ? byId[spec.element] : null;
    if (spec.element && !entry) throw new Error(`The ladder has no element "${spec.element}".`);
    const node = doc.createElement('div');
    node.className = 'pk-item';
    node.dataset.item = spec.id;
    host.append(node);
    const item = {id: spec.id, kind: 'element', entry, paint: spec.paint, state: {...spec.state}, ui: {}, node, cells: null, live: spec.live || null, adapter: null};
    const on = spec.on || {};
    const api = {
      node, doc,
      get state() { return item.state; },
      box: () => ({x: 0, y: 0, width: item.cells.cols * UI_PIXELS, height: item.cells.rows * UI_PIXELS}),
      ui(patch) { Object.assign(item.ui, patch); request(); },
      change(patch, event) { Object.assign(item.state, patch); item.adapter?.sync?.(item.state); request(); on.change?.(item.state, patch, event); },
      emit(name, ...detail) { on[name]?.(...detail, item.state); request(); },
    };
    const adapt = spec.inert ? null : spec.adapter || (entry ? ADAPTERS[entry.id] : null);
    if (adapt) item.adapter = adapt(api) || {};
    else { node.setAttribute('role', 'img'); node.setAttribute('aria-label', spec.label ?? entry?.title ?? spec.id); }
    items.set(spec.id, item);
    place(item, spec.cells);
    return handle(item);
  }

  /** Words painted on the display, and present as text for a reader's tools. */
  function words(id, cells, said, {scale = 1, colour = DIM} = {}) {
    remove(id);
    const node = doc.createElement('p');
    node.className = 'pk-item';
    node.textContent = said;
    host.append(node);
    const item = {id, kind: 'words', said, scale, colour, node, cells: null, ui: {}, state: {}};
    items.set(id, item);
    place(item, cells);
    return handle(item);
  }

  function listen(target, name, handler, options) {
    target.addEventListener(name, handler, options);
    cleanup.push(() => target.removeEventListener(name, handler, options));
  }
  listen(win, 'scroll', request, {passive: true, capture: true});
  listen(win, 'resize', request);
  listen(doc, 'visibilitychange', request);
  listen(win, 'pagehide', event => { if (!event.persisted) destroy(); });

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    win.cancelAnimationFrame(frame);
    win.clearTimeout(timer);
    cleanup.forEach(undo => undo());
    renderer?.destroy();
    source.remove();
    output.remove();
    style.remove();
    host.replaceChildren();
    items.clear();
  }

  return {
    add, words, remove, request, destroy,
    get: id => { const item = items.get(id); return item ? handle(item) : null; },
    clear() { for (const id of [...items.keys()]) remove(id); },
    /** How many layout cells fit across the page. */
    columns: () => Math.max(1, Math.floor(doc.documentElement.clientWidth / UI_CELL)),
    /** The page's height, in cells. */
    rows(count) { host.style.height = `${count * UI_CELL}px`; },
    /** Call `step(now)` before every painting, or stop with null: for what plays in time. */
    animate(step) { animate = step; request(); },
  };
}

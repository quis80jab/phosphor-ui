import { createViewerGridRenderer } from './viewer-grid-renderer.js?v=pane-140';
import { PIXEL_PITCH, UI_CELL, UI_PIXELS, pixelBounds } from './viewer-grid.js?v=pane-140';
import { paintGridControl } from './viewer-grid-paint.js?v=pane-140';
import { pixelText, glyphRect } from './vfd-glyphs.js?v=grid-1';
import { mountGridMenus } from './viewer-grid-menus.js?v=pane-140';
import { loadBenchState } from './bench-store.js?v=grid-1';

const MINT = '#a9e9df', DIM = '#558c7e', INK = '#06231f';
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const scaleOf = el => clamp(Math.round(Number(el.dataset.vfdScale) || 1), 1, 3);
const cleanText = value => String(value ?? '').replace(/\r\n?/g, '\n')
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
  .replace(/[\u2013\u2014]/g, '-').replaceAll('…', '...').replaceAll('×', 'X');
const isActive = el => !!el.checked || ['aria-pressed', 'aria-selected', 'aria-checked'].some(key => el.getAttribute(key) === 'true') || el.getAttribute('aria-current') === 'page';
const editable = el => /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

function contentOf(el) {
  if (el.dataset.vfdLabel !== undefined) return el.dataset.vfdLabel;
  if (editable(el) || el.tagName === 'OUTPUT') return el.value ?? el.textContent;
  const visit = node => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1 || node.hidden || /^(SCRIPT|STYLE|SVG)$/.test(node.tagName)) return '';
    if (node.tagName === 'BR') return '\n';
    if (node !== el && node.hasAttribute('data-vfd')) return '';
    if (getComputedStyle(node).display === 'none') return '';
    return [...node.childNodes].map(visit).join('');
  };
  return visit(el);
}
function textRows(value, columns, limit, wrap = true) {
  const rows = [], capacity = Math.max(1, columns);
  for (const paragraph of cleanText(value).split('\n')) {
    if (!wrap) { rows.push(paragraph); continue; }
    let row = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      if (row && row.length + 1 + word.length <= capacity) { row += ' ' + word; continue; }
      if (row) { rows.push(row); row = ''; }
      let rest = word;
      while (rest.length > capacity) { rows.push(rest.slice(0, capacity)); rest = rest.slice(capacity); }
      row = rest;
    }
    rows.push(row);
  }
  const visible = rows.slice(0, Math.max(1, limit));
  if (rows.length > visible.length && capacity >= 3) visible[visible.length - 1] = visible.at(-1).slice(0, capacity - 3).padEnd(capacity - 3, ' ') + '...';
  return visible.map(row => row.length > capacity ? (capacity >= 3 ? row.slice(0, capacity - 3) + '...' : row.slice(0, capacity)) : row);
}
function inkOf(el) {
  let value = el.dataset.vfdColor;
  const variable = value?.match(/^var\((--[\w-]+)\)$/);
  if (variable) value = getComputedStyle(el).getPropertyValue(variable[1]).trim();
  return value && CSS.supports('color', value) ? value : el.dataset.vfdTone === 'dim' || el.classList.contains('muted') ? DIM : MINT;
}
function paintLabel(ctx, el, bounds, options = {}) {
  const { x, y, width, height } = bounds, scale = scaleOf(el), advance = 6 * scale;
  const color = options.color || inkOf(el), align = options.align || el.dataset.vfdAlign || 'left';
  const lineHeight = 10 * scale, maxLines = Math.max(1, Math.floor((height + 3 * scale) / lineHeight));
  let value = cleanText(options.text ?? contentOf(el));
  if (el.dataset.vfdCase !== 'preserve') value = value.toUpperCase();
  const rows = textRows(value, Math.floor((width + scale) / advance), Math.min(maxLines, Number(el.dataset.vfdLines) || maxLines), el.dataset.vfdWrap !== 'false');
  const blockHeight = rows.length * lineHeight - 3 * scale;
  const valign = el.dataset.vfdValign || 'middle';
  const top = y + (valign === 'top' ? 0 : valign === 'bottom' ? Math.max(0, height - blockHeight) : Math.max(0, Math.floor((height - blockHeight) / 2)));
  rows.forEach((row, index) => {
    const rowWidth = Math.max(0, row.length * advance - scale);
    const left = x + (align === 'center' ? Math.floor((width - rowWidth) / 2) : align === 'right' ? width - rowWidth : 0);
    pixelText(ctx, row, left, top + index * lineHeight, color, scale);
  });
}
function frameProxy(el) {
  return { dataset: { ...el.dataset, vfdLabel: ' ' }, textContent: '', disabled: el.disabled,
    getAttribute: key => key === 'aria-pressed' && el.checked ? 'true' : el.getAttribute(key) };
}

// Rows retain native string offsets so keyboard and pointer selection share the same value.
function editingRows(value, capacity, wrap) {
  const result = []; let start = 0;
  for (const paragraph of value.split('\n')) {
    if (!wrap || paragraph.length <= capacity) result.push({ text: paragraph, start });
    else {
      let offset = 0;
      while (offset < paragraph.length) {
        let end = Math.min(paragraph.length, offset + capacity);
        if (end < paragraph.length) {
          const space = paragraph.lastIndexOf(' ', end - 1);
          if (space >= offset) end = space + 1;
        }
        result.push({ text: paragraph.slice(offset, end), start: start + offset }); offset = end;
      }
    }
    start += paragraph.length + 1;
  }
  return result.length ? result : [{ text: '', start: 0 }];
}
function paintField(ctx, el, bounds, focused) {
  const { x, y, width, height } = bounds, scale = scaleOf(el), style = getComputedStyle(el);
  paintGridControl(ctx, { element: frameProxy(el), type: 'button', ...bounds, focused });
  const multiline = el.tagName === 'TEXTAREA', advance = 6 * scale;
  const padLeft = Math.max(5, Math.round(((parseFloat(style.paddingLeft) || UI_CELL) + (parseFloat(style.borderLeftWidth) || 0)) / PIXEL_PITCH));
  const padRight = Math.max(5, Math.round(((parseFloat(style.paddingRight) || UI_CELL) + (parseFloat(style.borderRightWidth) || 0)) / PIXEL_PITCH));
  const padTop = Math.max(5, Math.round(((parseFloat(style.paddingTop) || UI_CELL) + (parseFloat(style.borderTopWidth) || 0)) / PIXEL_PITCH));
  const left = x + padLeft, innerWidth = Math.max(0, width - padLeft - padRight);
  const lineHeight = Math.max(9 * scale, Math.round((parseFloat(style.lineHeight) || 10 * scale * PIXEL_PITCH) / PIXEL_PITCH));
  // The local font uses an 800/1000 ascent and a 700/1000 cap height.
  const capInset = Math.round((lineHeight - 10 * scale) / 2 + scale);
  const top = multiline ? y + padTop + capInset : y + Math.floor((height - 7 * scale) / 2);
  const actual = String(el.value ?? ''), value = actual || String(el.placeholder || '');
  const wrap = multiline && el.wrap !== 'off', capacity = Math.max(1, Math.floor(innerWidth / advance));
  const rows = editingRows(value, capacity, wrap);
  const scrollX = Math.round((el.scrollLeft || 0) / PIXEL_PITCH), scrollY = multiline ? Math.round((el.scrollTop || 0) / PIXEL_PITCH) : 0;
  const selectionStart = el.selectionStart ?? null, selectionEnd = el.selectionEnd ?? null;
  ctx.save(); ctx.beginPath(); ctx.rect(left, y + 4, innerWidth, Math.max(0, height - 8)); ctx.clip();
  rows.forEach((row, index) => {
    const yy = top + index * lineHeight - scrollY, xx = left - scrollX;
    if (yy + 9 * scale < y + 4 || yy > y + height - 4) return;
    const from = Math.max(0, (selectionStart ?? 0) - row.start), to = Math.min(row.text.length, (selectionEnd ?? 0) - row.start);
    if (focused && actual && to > from) { ctx.fillStyle = MINT; ctx.fillRect(xx + from * advance, yy - scale, (to - from) * advance, 9 * scale); }
    pixelText(ctx, row.text, xx, yy, actual ? inkOf(el) : DIM, scale);
    if (focused && actual && to > from) pixelText(ctx, row.text.slice(from, to), xx + from * advance, yy, INK, scale);
    const end = row.start + row.text.length;
    const ownsEnd = index === rows.length - 1 || rows[index + 1].start !== end;
    if (focused && selectionStart !== null && selectionStart === selectionEnd && selectionStart >= row.start && (selectionStart < end || selectionStart === end && ownsEnd)) {
      ctx.fillStyle = MINT; ctx.fillRect(xx + (selectionStart - row.start) * advance, yy - scale, 1, 9 * scale);
    }
  });
  ctx.restore();
}

/** A full-window integer framebuffer; native nodes remain the interaction surface. */
export function mountUIPagesSkin({ getState = () => ({}) } = {}) {
  const output = document.getElementById('ui-pages-gl');
  if (!(output instanceof HTMLCanvasElement)) throw new Error('UI pages require canvas#ui-pages-gl.');
  const source = document.createElement('canvas'), ctx = source.getContext('2d', { alpha: true });
  if (!ctx) throw new Error('The UI framebuffer could not be created.');
  let optics = { brightness: 110, glow: 40, contrast: 110, grid: 50, refraction: 0 };
  try { optics = { ...optics, ...loadBenchState().state.optics }; } catch {}
  optics = { ...optics, ...(getState()?.optics || {}) };
  let renderer = null, graphicsAvailable = false, destroyed = false, raf = 0, revision = 1;
  let inventoryDirty = true, layoutDirty = true, paintDirty = true, entries = [], selects = [], menus = null, scrollbars = [];
  let hovered = null, held = null, lastError = '', isPainting = false;
  const removers = [], observed = new Set();
  const on = (target, name, handler, options) => { target.addEventListener(name, handler, options); removers.push(() => target.removeEventListener(name, handler, options)); };
  const setReady = ready => {
    document.body.classList.toggle('ui-vfd-ready', ready);
    output.style.visibility = ready ? 'visible' : 'hidden';
    output.dataset.uiPagesStatus = ready ? 'ready' : 'fallback';
  };
  const schedule = () => { if (!destroyed && !raf && !document.hidden) raf = requestAnimationFrame(draw); };
  const requestPaint = (force = false) => { if (force) revision++; paintDirty = true; schedule(); };
  const relayout = () => { layoutDirty = true; requestPaint(); };
  const refresh = () => { requestPaint(true); };
  const resizeObserver = new ResizeObserver(() => { if (!destroyed) relayout(); });

  function inventory() {
    inventoryDirty = false;
    const old = new Map(entries.map(entry => [entry.element, entry]));
    entries = [...document.querySelectorAll('[data-vfd]')].filter(el => el !== output).map((element, order) => ({ ...(old.get(element) || {}), element, order, type: element.dataset.vfd || 'label' }));
    const current = new Set(entries.map(entry => entry.element));
    for (const el of observed) if (!current.has(el)) { resizeObserver.unobserve(el); observed.delete(el); }
    for (const el of current) if (!observed.has(el)) { resizeObserver.observe(el); observed.add(el); }
    const nextSelects = [...document.querySelectorAll('select')].filter(el => !el.multiple && el.size <= 1);
    if (nextSelects.length !== selects.length || nextSelects.some((el, index) => el !== selects[index])) {
      menus?.destroy(); selects = nextSelects; menus = mountGridMenus({ refresh: () => { inventoryDirty = true; relayout(); } });
    }
    layoutDirty = true;
  }
  function measure() {
    layoutDirty = false;
    const styles = new Map(), rects = new Map(), scrollNodes = new Map();
    const styleOf = el => { if (!styles.has(el)) styles.set(el, getComputedStyle(el)); return styles.get(el); };
    const rectOf = el => { if (!rects.has(el)) rects.set(el, el.getBoundingClientRect()); return rects.get(el); };
    for (const entry of entries) {
      const el = entry.element, rect = rectOf(el);
      entry.bounds = pixelBounds(rect); entry.visible = el.isConnected && rect.width > 0 && rect.height > 0;
      let left = 0, top = 0, right = innerWidth, bottom = innerHeight, layer = 0;
      for (let node = el; entry.visible && node; node = node.parentElement) {
        const style = styleOf(node);
        if (node.hidden || style.display === 'none' || style.visibility === 'hidden' || node.tagName === 'DIALOG' && !node.open) { entry.visible = false; break; }
        if (node.tagName === 'DETAILS' && !node.open && node !== el) {
          const summary = [...node.children].find(child => child.tagName === 'SUMMARY');
          if (!summary?.contains(el)) { entry.visible = false; break; }
        }
        if (node.dataset.vfdLayer !== undefined && Number.isFinite(Number(node.dataset.vfdLayer))) layer = Math.max(layer, Number(node.dataset.vfdLayer));
        else if (style.position !== 'static' && style.zIndex !== 'auto' && Number.isFinite(Number(style.zIndex))) layer = Math.max(layer, Number(style.zIndex));
        if (node.classList.contains('grid-select-menu')) layer = 1000000;
        if (node !== document.body && node !== document.documentElement && /^(auto|scroll)$/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) {
          const previous = scrollNodes.get(node);
          scrollNodes.set(node, { node, order: Math.max(entry.order, previous?.order ?? 0) + .1 });
        }
        if (node === el || node === document.body || node === document.documentElement) continue;
        const clipX = /^(auto|scroll|hidden|clip)$/.test(style.overflowX) || node.dataset.vfdClip === 'true';
        const clipY = /^(auto|scroll|hidden|clip)$/.test(style.overflowY) || node.dataset.vfdClip === 'true';
        if (clipX || clipY) {
          const r = rectOf(node), inset = node.classList.contains('grid-select-menu') ? UI_CELL : 0;
          if (clipX) { left = Math.max(left, r.left + node.clientLeft + inset); right = Math.min(right, r.left + node.clientLeft + node.clientWidth - inset); }
          if (clipY) { top = Math.max(top, r.top + node.clientTop + inset); bottom = Math.min(bottom, r.top + node.clientTop + node.clientHeight - inset); }
        }
      }
      entry.layer = layer;
      entry.clip = { x: Math.round(left / PIXEL_PITCH), y: Math.round(top / PIXEL_PITCH), width: Math.max(0, Math.round(right / PIXEL_PITCH) - Math.round(left / PIXEL_PITCH)), height: Math.max(0, Math.round(bottom / PIXEL_PITCH) - Math.round(top / PIXEL_PITCH)) };
      entry.visible &&= right > left && bottom > top && rect.right > left && rect.left < right && rect.bottom > top && rect.top < bottom;
    }
    entries.sort((a, b) => a.layer - b.layer || a.order - b.order);
    scrollbars = [...scrollNodes.values()].map(({ node, order }) => {
      const representative = entries.find(entry => entry.visible && (entry.element === node || node.contains(entry.element)));
      if (!representative) return null;
      const r = rectOf(node), bounds = pixelBounds(r);
      const trackHeight = Math.max(0, Math.round(node.clientHeight / PIXEL_PITCH) - 8);
      const thumbHeight = Math.min(trackHeight, Math.max(UI_PIXELS, Math.round(trackHeight * node.clientHeight / node.scrollHeight)));
      return { node, order, layer: representative.layer, clip: representative.clip, x: bounds.x + bounds.width - 4,
        y: bounds.y + Math.round(node.clientTop / PIXEL_PITCH) + 4, trackHeight, thumbHeight,
        offset: Math.round((trackHeight - thumbHeight) * node.scrollTop / Math.max(1, node.scrollHeight - node.clientHeight)) };
    }).filter(Boolean);
  }
  function paintCanvas(entry) {
    const el = entry.element, { width, height } = entry.bounds;
    if (!(el instanceof HTMLCanvasElement) || typeof el.vfdDraw !== 'function' || width < 1 || height < 1) return;
    const changedSize = el.width !== width || el.height !== height;
    if (changedSize) { el.width = width; el.height = height; }
    if (changedSize || entry.canvasRevision !== revision || entry.drawFunction !== el.vfdDraw) {
      const drawContext = el.getContext('2d');
      if (!drawContext) return;
      drawContext.resetTransform(); drawContext.clearRect(0, 0, width, height); drawContext.imageSmoothingEnabled = false;
      drawContext.save();
      try { el.vfdDraw(drawContext, width, height); } finally { drawContext.restore(); }
      entry.canvasRevision = revision; entry.drawFunction = el.vfdDraw;
    }
    // No resampling: each source pixel already occupies one shared display pixel.
    ctx.drawImage(el, entry.bounds.x, entry.bounds.y);
  }
  function paintEntry(entry, state) {
    if (!entry.visible) return;
    const { element: el, type, bounds, clip } = entry;
    const focused = document.activeElement === el || el.contains(document.activeElement), pressed = held === el;
    ctx.save(); ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.width, clip.height); ctx.clip();
    ctx.beginPath(); ctx.rect(bounds.x, bounds.y, bounds.width, bounds.height); ctx.clip();
    if (type === 'canvas') {
      paintCanvas(entry);
      if (focused) glyphRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, MINT);
    }
    else if (type === 'label') {
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') ctx.globalAlpha *= .4;
      paintLabel(ctx, el, bounds);
      if (focused && el.matches('a,button,summary,[tabindex]')) glyphRect(ctx, bounds.x, bounds.y, bounds.width, bounds.height, MINT);
    } else if (type === 'button') {
      paintGridControl(ctx, { element: frameProxy(el), type, ...bounds, focused: focused || hovered === el, held: pressed, state });
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') ctx.globalAlpha *= .4;
      paintLabel(ctx, el, { x: bounds.x + 5, y: bounds.y + 4, width: Math.max(0, bounds.width - 10), height: Math.max(0, bounds.height - 8) }, { align: 'center', color: isActive(el) || pressed ? INK : inkOf(el) });
    } else if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' && !['range', 'checkbox', 'radio', 'button', 'submit'].includes(el.type)) {
      paintField(ctx, el, bounds, focused);
    } else if (type === 'slider') {
      const range = el.matches('input[type=range]') ? el : el.querySelector('input[type=range]');
      const min = Number(range?.min || 0), max = Number(range?.max || 100), value = Number(range?.value ?? state.frame ?? 0);
      paintGridControl(ctx, { element: el, type, ...bounds, focused, held: pressed, state: { ...state, frame: range ? clamp((value - min) / (max - min || 1), 0, 1) : state.frame } });
    } else paintGridControl(ctx, { element: el, type, ...bounds, focused, held: pressed, playing: !!state.playing, state });
    ctx.restore();
  }
  function draw() {
    raf = 0;
    if (destroyed || document.hidden || isPainting) return;
    isPainting = true;
    try {
      if (inventoryDirty) inventory();
      if (layoutDirty) measure();
      const width = Math.ceil(innerWidth / PIXEL_PITCH), height = Math.ceil(innerHeight / PIXEL_PITCH);
      if (source.width !== width || source.height !== height) { source.width = width; source.height = height; paintDirty = true; }
      if (!paintDirty) return;
      paintDirty = false; ctx.resetTransform(); ctx.clearRect(0, 0, width, height); ctx.imageSmoothingEnabled = false;
      const state = getState() || {};
      if (state.guides) {
        ctx.fillStyle = '#16372f';
        const scroll = Math.round(scrollY / PIXEL_PITCH) % UI_PIXELS;
        for (let x = 0; x < width; x += UI_PIXELS) ctx.fillRect(x, 0, 1, height);
        for (let y = -scroll; y < height; y += UI_PIXELS) ctx.fillRect(0, y, width, 1);
      }
      const ordered = [...entries, ...scrollbars].sort((a, b) => a.layer - b.layer || a.order - b.order);
      for (const entry of ordered) {
        if (!entry.node) { paintEntry(entry, state); continue; }
        const { x, y, clip, trackHeight, thumbHeight, offset } = entry;
        ctx.save(); ctx.beginPath(); ctx.rect(clip.x, clip.y, clip.width, clip.height); ctx.clip();
        ctx.fillStyle = DIM; ctx.fillRect(x + 1, y, 1, trackHeight);
        ctx.fillStyle = MINT; ctx.fillRect(x, y + offset, 3, thumbHeight); ctx.restore();
      }
      renderer?.setPattern(state.mark || 'dots'); renderer?.invalidate();
      setReady(!!renderer && graphicsAvailable); lastError = '';
    } catch (error) {
      setReady(false);
      const message = String(error?.message || error);
      if (message !== lastError) { console.error('UI pages display fallback:', error); lastError = message; }
    } finally { isPainting = false; }
  }

  on(output, 'viewer-grid-renderer-state', event => {
    graphicsAvailable = !!event.detail?.available;
    if (!graphicsAvailable) setReady(false);
    else { layoutDirty = true; requestPaint(true); }
  });
  try { renderer = createViewerGridRenderer(output, source, optics); } catch (error) { lastError = String(error?.message || error); setReady(false); console.warn('UI pages uses native display fallback:', error); }
  const mutationObserver = new MutationObserver(records => {
    let changed = false, structure = false;
    for (const record of records) {
      if (record.target === output) continue;
      if (record.type === 'attributes' && record.target === document.body && record.attributeName === 'class') {
        const withoutReady = value => String(value || '').split(/\s+/).filter(name => name && name !== 'ui-vfd-ready').sort().join(' ');
        if (withoutReady(record.oldValue) === withoutReady(document.body.className)) continue;
      }
      changed = true;
      if (record.type === 'childList' || record.attributeName === 'data-vfd' || record.attributeName === 'multiple' || record.attributeName === 'size') structure = true;
    }
    if (changed) { inventoryDirty ||= structure; layoutDirty = true; requestPaint(true); }
  });
  mutationObserver.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeOldValue: true,
    attributeFilter: ['hidden', 'open', 'class', 'style', 'aria-pressed', 'aria-selected', 'aria-checked', 'aria-current', 'aria-expanded', 'aria-disabled', 'disabled', 'readonly', 'value', 'placeholder', 'min', 'max', 'step', 'type', 'multiple', 'size', 'data-vfd', 'data-vfd-label', 'data-vfd-tone', 'data-vfd-align', 'data-vfd-valign', 'data-vfd-scale', 'data-vfd-color', 'data-vfd-layer', 'data-vfd-opaque', 'data-vfd-clip', 'data-vfd-wrap', 'data-vfd-lines', 'data-vfd-case', 'data-catalog-hidden'] });
  const targetOf = event => event.target instanceof Element ? event.target.closest('[data-vfd]') : null;
  on(document, 'pointerover', event => { const next = targetOf(event); if (hovered !== next) { hovered = next; requestPaint(); } }, true);
  on(document, 'pointerout', event => { if (!event.relatedTarget || !hovered?.contains(event.relatedTarget)) { hovered = null; requestPaint(); } }, true);
  on(document, 'pointerdown', event => { held = targetOf(event); requestPaint(); }, true);
  const release = () => { if (held) { held = null; requestPaint(); } };
  on(window, 'pointerup', release, true); on(window, 'pointercancel', release, true); on(window, 'blur', release);
  for (const name of ['input', 'change', 'focusin', 'focusout', 'select', 'selectionchange', 'keyup']) on(document, name, () => requestPaint(name === 'input' || name === 'change'), true);
  on(document, 'scroll', relayout, true); on(window, 'scroll', relayout, true); on(window, 'resize', relayout);
  on(window, 'pageshow', relayout); on(document, 'visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else relayout(); });
  if (window.visualViewport) { on(window.visualViewport, 'resize', relayout); on(window.visualViewport, 'scroll', relayout); }
  document.fonts?.ready?.then(() => { if (!destroyed) relayout(); });
  setReady(false); schedule();
  return {
    refresh, relayout,
    setOptics(patch = {}) { optics = { ...optics, ...patch }; renderer?.setOptics(optics); requestPaint(); return { ...optics }; },
    destroy() {
      if (destroyed) return; destroyed = true; cancelAnimationFrame(raf); raf = 0;
      mutationObserver.disconnect(); resizeObserver.disconnect(); menus?.destroy(); removers.forEach(remove => remove());
      renderer?.destroy(); setReady(false); entries = []; selects = []; observed.clear();
    }
  };
}

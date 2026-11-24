import { BENCH_CATALOG, paintWidget } from './bench-widgets.js?v=glyph-2';
import { REFERENCE_BUTTONS, createReferenceState, normalizeReferenceState, activateReference, paintReference } from './reference-screen.js?v=glyph-2';
import { TRANSPORT_BUTTONS, createTransportState, normalizeTransportState, activateTransport, advanceTransport, paintTransport } from './transport-screen.js?v=glyph-2';
import { pixelText, glyphRect } from './vfd-glyphs.js?v=glyph-2';

const WIDTH = 768, HEIGHT = 512, COLOR = '#9fdfd0', INK = '#06231f';
const POSITION = { x: 12, y: 26, width: 352, height: 176 };
const TRANSPORT = { x: 404, y: 26, width: 352, height: 176 };
const WIDGET = { x: 12, y: 258, width: 352, height: 220 };
const SHORT_LABELS = ['DIAL', 'WHEEL', 'BAR', 'STATUS', 'SLIDER', 'PERCENT', 'SEARCH', 'BUTTONS', 'TOGGLE', 'STEPPER', 'LEVEL', 'MODES'];
const LOOKUP = new Map(BENCH_CATALOG.map(item => [item.id, item]));
const NUMERIC = new Set(['dial', 'wheel', 'bar', 'slider', 'percentage', 'stepper', 'level']);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const rectStyle = (element, x, y, width, height) => Object.assign(element.style, {
  position: 'absolute', left: `${x}px`, top: `${y}px`, width: `${width}px`, height: `${height}px`
});

/** A single test console whose native controls map onto its pixel artwork. */
export function mountBenchConsole(element, { getState, onScreensChange, onWidgetChange, onEditWidget }) {
  const source = document.createElement('canvas'); source.width = WIDTH; source.height = HEIGHT;
  const context = source.getContext('2d', { alpha: false });
  const referenceScratch = document.createElement('canvas'); referenceScratch.width = 256; referenceScratch.height = 128;
  const referenceContext = referenceScratch.getContext('2d', { alpha: false });
  const widgetScratch = document.createElement('canvas'); widgetScratch.width = 320; widgetScratch.height = 200;
  const widgetContext = widgetScratch.getContext('2d', { alpha: false });
  if (!context || !referenceContext || !widgetContext) throw new Error('Could not create the combined display.');
  context.imageSmoothingEnabled = false;
  const overlay = document.createElement('div');
  overlay.className = 'bench-console-overlay';
  overlay.setAttribute('role', 'group'); overlay.setAttribute('aria-label', 'Combined VFD test console');
  rectStyle(overlay, 0, 0, WIDTH, HEIGHT);
  Object.assign(overlay.style, { transformOrigin: '0 0', pointerEvents: 'none', zIndex: '2' });
  element.append(overlay);
  const status = document.createElement('span');
  status.className = 'console-status'; status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'off');
  Object.assign(status.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap' });
  overlay.append(status);
  const positionHits = new Map(), transportHits = new Map(), pickerHits = new Map();
  let widgetHits = [], mountedWidget = null, timer = 0, destroyed = false, pageSuspended = false;
  let feedback = { area: null, hovered: null, focused: null };

  function current() {
    const state = getState() || {}, screens = state.screens || {};
    const selected = LOOKUP.has(screens.selected) ? screens.selected : 'dial';
    return {
      selected, meta: LOOKUP.get(selected), widget: state.widgets?.[selected] || LOOKUP.get(selected).defaults,
      menu: normalizeReferenceState(screens.menu || createReferenceState()),
      transport: normalizeTransportState(screens.transport || createTransportState())
    };
  }
  function canPlay() {
    if (destroyed || pageSuspended || document.hidden || !current().transport.playing) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }
  function schedulePlayback() {
    if (!canPlay()) { clearTimeout(timer); timer = 0; return; }
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      if (!canPlay()) return;
      onScreensChange({ transport: advanceTransport(current().transport, 1) }, { quiet: true });
      refresh();
    }, 1000);
  }
  function sizeOverlay() {
    const rect = element.getBoundingClientRect();
    overlay.style.transform = `scale(${rect.width / WIDTH},${rect.height / HEIGHT})`;
    schedulePlayback();
  }
  function focusStyle(hit, focused) {
    hit.style.outline = focused ? '1px solid #b8f5db' : 'none';
    hit.style.outlineOffset = '-1px';
  }
  function hit(parent, tag, label, x, y, width, height) {
    const control = document.createElement(tag); control.className = 'console-hit';
    if (tag === 'button') control.type = 'button';
    control.setAttribute('aria-label', label); rectStyle(control, x, y, width, height);
    Object.assign(control.style, { padding: '0', margin: '0', minWidth: '0', minHeight: '0', border: '0', borderRadius: '0', background: 'transparent', boxShadow: 'none', color: 'transparent', pointerEvents: 'auto', cursor: 'pointer', touchAction: 'none', appearance: 'none', outline: 'none' });
    for (const event of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'click', 'keydown', 'keyup']) control.addEventListener(event, e => e.stopPropagation());
    control.addEventListener('focus', () => focusStyle(control, true));
    control.addEventListener('blur', () => focusStyle(control, false));
    parent.append(control); return control;
  }
  function artworkButton(area, definition, target) {
    const channelLabel = definition.kind === 'channel' ? `${['A-1', 'B-2', 'C-3', 'D-4'][definition.channel]} ${definition.label}` : definition.label;
    const label = area === 'position' ? `Position ${channelLabel}` : `Transport ${definition.id === 'play' ? 'Play' : definition.label}`;
    const region = area === 'position' ? POSITION : TRANSPORT, scale = region.width / 256;
    const control = hit(overlay, 'button', label, region.x + definition.x * scale, region.y + definition.y * scale, definition.width * scale, definition.height * scale);
    control.dataset.consoleControl = `${area}-${definition.id}`;
    control.addEventListener('click', () => {
      const state = current();
      onScreensChange(area === 'position' ? { menu: activateReference(state.menu, definition.id) } : { transport: activateTransport(state.transport, definition.id) });
      refresh();
    });
    control.addEventListener('keydown', event => {
      const id = area === 'position'
        ? { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[event.key]
        : { ArrowLeft: 'previous', ArrowRight: 'next', Escape: 'stop' }[event.key];
      if (!id) return;
      event.preventDefault(); const state = current();
      onScreensChange(area === 'position' ? { menu: activateReference(state.menu, id) } : { transport: activateTransport(state.transport, id) });
      refresh();
    });
    control.addEventListener('pointerenter', event => {
      if (event.pointerType === 'touch') return;
      feedback = { ...feedback, area, hovered: definition.id }; paint();
    });
    control.addEventListener('pointerleave', () => { if (feedback.hovered === definition.id) { feedback.hovered = null; paint(); } });
    control.addEventListener('focus', () => { feedback = { ...feedback, area, focused: definition.id }; paint(); });
    control.addEventListener('blur', () => { if (feedback.focused === definition.id) { feedback.focused = null; paint(); } });
    target.set(definition.id, control);
  }
  for (const definition of REFERENCE_BUTTONS) artworkButton('position', definition, positionHits);
  for (const definition of TRANSPORT_BUTTONS) artworkButton('transport', definition, transportHits);
  for (const [index, meta] of BENCH_CATALOG.entries()) {
    const control = hit(overlay, 'button', `Select ${meta.name}`, 404 + index % 3 * 118, 254 + Math.floor(index / 3) * 54, 112, 46);
    control.dataset.consoleWidget = meta.id;
    control.addEventListener('click', () => { onScreensChange({ selected: meta.id }); refresh(); });
    pickerHits.set(meta.id, control);
  }
  const edit = hit(overlay, 'button', 'Edit selected component notes', 620, 220, 132, 22);
  edit.addEventListener('click', () => onEditWidget?.(current().selected));
  const widgetClip = document.createElement('div');
  rectStyle(widgetClip, WIDGET.x, WIDGET.y, WIDGET.width, WIDGET.height);
  Object.assign(widgetClip.style, { overflow: 'hidden', pointerEvents: 'none' }); overlay.append(widgetClip);
  const widgetMap = document.createElement('div'); rectStyle(widgetMap, 0, 0, 320, 200);
  Object.assign(widgetMap.style, { transform: `scale(${WIDGET.width / 320})`, transformOrigin: '0 0', pointerEvents: 'none' }); widgetClip.append(widgetMap);
  const widgetScale = document.createElement('div'); rectStyle(widgetScale, 0, 0, 320, 200);
  Object.assign(widgetScale.style, { transformOrigin: '160px 110px', pointerEvents: 'none' }); widgetMap.append(widgetScale);

  function updateWidget(patch) {
    const state = current(); if (state.widget.disabled) return;
    onWidgetChange(state.selected, patch); refresh();
  }
  function valueChange(value) {
    const c = current().widget;
    const stepped = c.min + Math.round((clamp(value, c.min, c.max) - c.min) / c.step) * c.step;
    updateWidget({ value: clamp(Number(stepped.toPrecision(15)), c.min, c.max) });
  }
  function widgetHit(tag, label, x, y, width, height) {
    const control = hit(widgetScale, tag, label, x, y, width, height); widgetHits.push(control); return control;
  }
  function numericControl(seek = false, centerOnly = false) {
    const control = widgetHit('div', `Console ${current().meta.name}`, centerOnly ? 90 : seek ? 24 : 50, centerOnly ? 70 : seek ? 75 : 35, centerOnly ? 140 : seek ? 272 : 220, centerOnly ? 80 : seek ? 65 : 135);
    control.setAttribute('role', 'slider'); control.tabIndex = 0; control.style.cursor = seek ? 'ew-resize' : 'ns-resize';
    let drag = null;
    control.addEventListener('keydown', event => {
      const c = current().widget; if (c.disabled) return;
      const step = c.step * (event.shiftKey ? 10 : 1);
      const values = { ArrowUp: c.value + step, ArrowRight: c.value + step, ArrowDown: c.value - step, ArrowLeft: c.value - step, Home: c.min, End: c.max, PageUp: c.value + (c.max - c.min) / 10, PageDown: c.value - (c.max - c.min) / 10 };
      if (!(event.key in values)) return;
      event.preventDefault(); valueChange(values[event.key]);
    });
    function seekTo(event) {
      const rect = control.getBoundingClientRect(), c = current().widget;
      valueChange(c.min + clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) * (c.max - c.min));
    }
    control.addEventListener('pointerdown', event => {
      if (current().widget.disabled || event.isPrimary === false) return;
      event.preventDefault(); control.focus(); control.setPointerCapture(event.pointerId);
      drag = { y: event.clientY, value: current().widget.value }; if (seek) seekTo(event);
    });
    control.addEventListener('pointermove', event => {
      if (!drag || current().widget.disabled) return;
      if (seek) seekTo(event);
      else {
        const c = current().widget, scale = Math.max(.05, element.getBoundingClientRect().width / WIDTH * WIDGET.width / 320 * c.size / 100);
        valueChange(drag.value + (drag.y - event.clientY) / scale * (c.max - c.min) / 160);
      }
    });
    const end = event => { drag = null; if (control.hasPointerCapture(event.pointerId)) control.releasePointerCapture(event.pointerId); };
    control.addEventListener('pointerup', end); control.addEventListener('pointercancel', end); control.addEventListener('lostpointercapture', () => { drag = null; });
    if (!seek) control.addEventListener('wheel', event => {
      if (current().widget.disabled) return;
      event.preventDefault(); const c = current().widget; valueChange(c.value + (event.deltaY < 0 ? c.step : -c.step));
    }, { passive: false });
  }
  function mountSelected(id) {
    if (mountedWidget === id) return;
    mountedWidget = id; widgetHits = []; widgetScale.replaceChildren();
    const name = current().meta.name;
    if (NUMERIC.has(id)) numericControl(id === 'bar' || id === 'slider', id === 'stepper');
    if (['buttons', 'indicators', 'segments'].includes(id)) {
      const labels = id === 'buttons' ? ['ARM', 'HOLD', 'RESET'] : id === 'indicators' ? ['READY', 'WARN', 'FAULT'] : ['AUTO', 'MANUAL', 'TEST'];
      labels.forEach((label, index) => {
        const control = widgetHit('button', `Console ${name} ${label}`, 20 + index * 95, id === 'indicators' ? 60 : 80, 90, id === 'indicators' ? 90 : 44);
        control.dataset[id === 'segments' ? 'option' : 'active'] = index;
        control.addEventListener('click', () => {
          if (id === 'segments') updateWidget({ option: index });
          else { const active = [...current().widget.active]; active[index] = !active[index]; updateWidget({ active }); }
        });
      });
    }
    if (id === 'toggle') {
      const control = widgetHit('button', 'Console toggle circuit', 110, 75, 100, 50); control.dataset.active = '0';
      control.addEventListener('click', () => { const active = [...current().widget.active]; active[0] = !active[0]; updateWidget({ active }); });
    }
    if (id === 'stepper') for (const [label, x, sign] of [['Decrease', 25, -1], ['Increase', 240, 1]]) {
      const control = widgetHit('button', `Console ${label} stepper`, x, 80, 55, 45);
      control.addEventListener('click', () => { const c = current().widget; valueChange(c.value + sign * c.step); });
    }
    if (id === 'search') {
      const control = widgetHit('input', 'Console search display layers', 20, 60, 280, 38);
      control.type = 'search'; control.maxLength = 80; control.autocomplete = 'off'; control.spellcheck = false;
      Object.assign(control.style, { font: '15px monospace', caretColor: COLOR, padding: '8px 12px', cursor: 'text' });
      control.addEventListener('input', () => updateWidget({ query: control.value }));
      control.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); control.value = ''; updateWidget({ query: '' }); } });
    }
  }
  function referencePressed(id, menu) {
    if (/^f[1-4]$/.test(id)) return menu.functions[Number(id[1]) - 1];
    const channel = /^channel-([0-3])-(on|off)$/.exec(id);
    if (channel) return menu.channels[Number(channel[1])] === (channel[2] === 'on');
    if (id === 'set') return menu.confirmed;
    if (id.startsWith('item-')) return id === `item-${menu.selected.toLowerCase().replace('-', '')}`;
    return null;
  }
  function syncControls(state) {
    for (const [id, control] of positionHits) {
      const pressed = referencePressed(id, state.menu);
      if (pressed === null) control.removeAttribute('aria-pressed'); else control.setAttribute('aria-pressed', String(pressed));
    }
    for (const [id, control] of transportHits) {
      if (id === 'play') { control.setAttribute('aria-label', `Transport ${state.transport.playing ? 'Pause' : 'Play'}`); control.setAttribute('aria-pressed', String(state.transport.playing)); }
      else if (id === 'stop') control.setAttribute('aria-pressed', String(state.transport.stopped));
    }
    for (const [id, control] of pickerHits) control.setAttribute('aria-pressed', String(id === state.selected));
    mountSelected(state.selected);
    widgetScale.style.transform = `scale(${state.widget.size / 100})`;
    for (const control of widgetHits) {
      const c = state.widget; control.disabled = c.disabled;
      if (control.getAttribute('role') === 'slider') {
        control.setAttribute('aria-valuemin', c.min); control.setAttribute('aria-valuemax', c.max); control.setAttribute('aria-valuenow', c.value);
        control.setAttribute('aria-valuetext', `${c.value} ${c.unit}`); control.setAttribute('aria-disabled', String(c.disabled)); control.tabIndex = c.disabled ? -1 : 0;
      }
      if (control.dataset.active !== undefined) control.setAttribute('aria-pressed', String(c.active[Number(control.dataset.active)]));
      if (control.dataset.option !== undefined) control.setAttribute('aria-pressed', String(c.option === Number(control.dataset.option)));
      if (control.type === 'search' && document.activeElement !== control) control.value = c.query;
    }
    const elapsed = Math.floor(state.transport.elapsed);
    status.textContent = `Position X ${(state.menu.x / 100).toFixed(2)}, Y ${(state.menu.y / 100).toFixed(2)}. Track ${state.transport.track}. ${state.transport.playing ? 'Playing' : state.transport.stopped ? 'Stopped' : 'Paused'}. ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}. Selected ${state.meta.name}.`;
    element.dataset.consoleSelected = state.selected;
  }
  function paint() {
    if (destroyed) return;
    const state = current();
    context.save(); context.setTransform(1, 0, 0, 1, 0, 0); context.globalAlpha = 1; context.globalCompositeOperation = 'source-over'; context.imageSmoothingEnabled = false;
    context.fillStyle = '#00100c'; context.fillRect(0, 0, WIDTH, HEIGHT);
    glyphRect(context, 2, 2, 764, 508, COLOR, { double: true });
    pixelText(context, 'POSITION / CHANNELS', 12, 10, COLOR, 1);
    pixelText(context, 'CHARACTER + GRAPHIC', 404, 10, COLOR, 1);
    const refFeedback = feedback.area === 'position' ? { hoveredId: feedback.hovered, focusedId: feedback.focused } : {};
    paintReference(referenceContext, state.menu, { color: COLOR, ...refFeedback });
    context.drawImage(referenceScratch, POSITION.x, POSITION.y, POSITION.width, POSITION.height);
    const transportFeedback = feedback.area === 'transport' ? { hoveredId: feedback.hovered, focusedId: feedback.focused } : {};
    paintTransport(referenceContext, state.transport, { color: COLOR, ...transportFeedback });
    context.drawImage(referenceScratch, TRANSPORT.x, TRANSPORT.y, TRANSPORT.width, TRANSPORT.height);
    glyphRect(context, 402, 24, 356, 180, COLOR, { double: true });
    glyphRect(context, 10, 216, 748, 30, COLOR, { double: false });
    pixelText(context, `COMPONENT TEST / ${SHORT_LABELS[BENCH_CATALOG.findIndex(item => item.id === state.selected)]}`, 20, 225, COLOR, 1);
    glyphRect(context, 620, 220, 132, 22, COLOR, { double: true });
    pixelText(context, 'EDIT / NOTES', 686, 228, COLOR, 1, { align: 'center' });
    paintWidget(widgetContext, state.selected, state.widget);
    context.drawImage(widgetScratch, WIDGET.x, WIDGET.y, WIDGET.width, WIDGET.height);
    glyphRect(context, 10, 256, 356, 224, COLOR, { double: true });
    BENCH_CATALOG.forEach((meta, index) => {
      const x = 404 + index % 3 * 118, y = 254 + Math.floor(index / 3) * 54, selected = meta.id === state.selected;
      if (selected) { context.fillStyle = COLOR; context.fillRect(x + 3, y + 3, 106, 40); }
      glyphRect(context, x, y, 112, 46, COLOR, { double: true });
      pixelText(context, SHORT_LABELS[index], x + 56, y + 16, selected ? INK : COLOR, 2, { align: 'center', maxWidth: 104 });
    });
    pixelText(context, 'LIVE CONTROLS / SAVED WITH WORKBENCH', 12, 493, COLOR, 1);
    pixelText(context, state.widget.disabled ? 'COMPONENT OFFLINE' : 'COMPONENT ONLINE', 756, 493, COLOR, 1, { align: 'right' });
    context.restore();
    element.dispatchEvent(new CustomEvent('bench-console-paint'));
  }
  function refresh() {
    if (destroyed) return;
    const state = current(); syncControls(state); paint(); schedulePlayback();
  }
  function hidden() { schedulePlayback(); }
  function pageHide() { pageSuspended = true; schedulePlayback(); }
  function pageShow() { pageSuspended = false; refresh(); }
  const resizeObserver = new ResizeObserver(sizeOverlay); resizeObserver.observe(element);
  const intersectionObserver = typeof IntersectionObserver === 'function' ? new IntersectionObserver(schedulePlayback) : null;
  intersectionObserver?.observe(element);
  window.addEventListener('scroll', schedulePlayback, { passive: true, capture: true });
  window.addEventListener('resize', sizeOverlay);
  window.addEventListener('pagehide', pageHide); window.addEventListener('pageshow', pageShow);
  document.addEventListener('visibilitychange', hidden);
  sizeOverlay(); refresh();
  return {
    source, refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true; clearTimeout(timer); timer = 0; resizeObserver.disconnect(); intersectionObserver?.disconnect();
      window.removeEventListener('scroll', schedulePlayback, true); window.removeEventListener('resize', sizeOverlay);
      window.removeEventListener('pagehide', pageHide); window.removeEventListener('pageshow', pageShow);
      document.removeEventListener('visibilitychange', hidden); overlay.remove();
      positionHits.clear(); transportHits.clear(); pickerHits.clear(); widgetHits = [];
    }
  };
}

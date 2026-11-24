// The real inputs behind the painted controls. Phosphor's rule: the DOM carries focus, keys, the pointer and a
// reader's tools; the painting only shows. Each adapter puts ordinary HTML controls exactly over a painted
// element's parts (the painters say where their parts are) and reports what a person did:
// `api.change(patch)` for a new value, `api.emit(name, detail)` for an action, `api.ui(patch)` for a passing
// state (the keyboard on it, the pointer over it, held down).
import {PIXEL_PITCH} from './phosphor.js';
import {segmentBoxes, sliderTrack, tabBoxes} from './paint/controls.js';
import {transportKeys, mapTransform} from './paint/site.js';
import {viewTransform, panned, zoomed} from './paint/map.js';
import {clamp} from './paint/primitives.js';

const css = pixels => `${pixels * PIXEL_PITCH}px`;   // display pixels as CSS pixels

/** Put a control at display pixels of its element's own box; no width fills the element. */
function placeAt(el, left = 0, width, top = 0, height) {
  Object.assign(el.style, {left: css(left), top: css(top), width: width === undefined ? '100%' : css(width), height: height === undefined ? '100%' : css(height)});
}

/** One real control inside an element, reporting the keyboard, the pointer and a press as `key`. */
function control(api, tag, {type, label, key = true, cursor = 'pointer'} = {}) {
  const el = api.doc.createElement(tag);
  if (type) el.type = type;
  if (label) el.setAttribute('aria-label', label);
  el.className = 'pk';
  el.style.cursor = cursor;
  placeAt(el);
  el.addEventListener('focus', () => api.ui({focused: el.matches(':focus-visible') ? key : false}));
  el.addEventListener('blur', () => api.ui({focused: false, held: false}));
  el.addEventListener('pointerenter', () => api.ui({hovered: key}));
  el.addEventListener('pointerleave', () => api.ui({hovered: false, held: false}));
  el.addEventListener('pointerdown', () => api.ui({held: key}));
  for (const name of ['pointerup', 'pointercancel']) el.addEventListener(name, () => api.ui({held: false}));
  el.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') api.ui({held: key, focused: key}); });
  el.addEventListener('keyup', () => api.ui({held: false}));
  api.node.append(el);
  return el;
}

/** A row that can be chosen: one button over the whole element; a press says so. */
function pressable(describe) {
  return api => {
    const el = control(api, 'button', {type: 'button'});
    el.addEventListener('click', event => api.emit('press', event));
    return {sync: s => { el.disabled = !!s.disabled; el.setAttribute('aria-label', describe(s)); el.setAttribute('aria-pressed', String(!!s.selected)); }};
  };
}

/** Controls kept in step with a list: made when the list grows, removed when it shrinks. */
function each(api, list, made, make) {
  while (made.length > list.length) made.pop().remove();
  list.forEach((entry, i) => { if (!made[i]) made[i] = make(i); });
  return made;
}

let groups = 0;

export const ADAPTERS = {
  button(api) {
    const el = control(api, 'button', {type: 'button'});
    el.addEventListener('click', event => api.emit('press', event));
    // `name` says what a button of one sign ("+") does.
    return {sync: s => { el.disabled = !!s.disabled; el.setAttribute('aria-label', s.name ?? s.label ?? 'Button'); }};
  },

  toggle(api) {
    const el = control(api, 'button', {type: 'button'});
    el.addEventListener('click', event => api.change({value: !api.state.value}, event));
    return {sync: s => { el.disabled = !!s.disabled; el.setAttribute('aria-label', s.label ?? 'Switch'); el.setAttribute('aria-pressed', String(!!s.value)); }};
  },

  checkbox(api) {
    const el = control(api, 'input', {type: 'checkbox'});
    el.addEventListener('change', event => api.change({value: el.checked}, event));
    return {sync: s => { el.checked = !!s.value; el.setAttribute('aria-label', s.label ?? 'Option'); }};
  },

  segmented(api) {
    const name = `pk-group-${groups += 1}`, radios = [];
    api.node.setAttribute('role', 'radiogroup');
    return {sync: s => {
      const options = s.options || [];
      api.node.setAttribute('aria-label', s.label ?? 'Choose one');
      each(api, options, radios, i => {
        const el = control(api, 'input', {type: 'radio'});
        el.name = name;
        el.addEventListener('change', event => { if (el.checked) api.change({value: i}, event); });
        return el;
      });
      segmentBoxes(api.box(), options.length).forEach(({x, width}, i) => {
        placeAt(radios[i], x, width);
        radios[i].setAttribute('aria-label', options[i]);
        radios[i].checked = i === s.value;
      });
    }};
  },

  slider(api) {
    const el = control(api, 'input', {type: 'range'});
    const fromPointer = event => {
      const rect = api.node.getBoundingClientRect(), {min, max, x0, span} = sliderTrack(api.box(), api.state);
      const step = Number(api.state.step) || 1, share = clamp(((event.clientX - rect.left) / PIXEL_PITCH - x0) / span, 0, 1);
      const value = Number(clamp(min + Math.round(share * (max - min) / step) * step, min, max).toFixed(6));
      if (value !== api.state.value) api.change({value}, event);
    };
    // The pointer is read against the painted track, so the thumb is where the finger is.
    el.addEventListener('pointerdown', event => { el.setPointerCapture(event.pointerId); el.focus(); fromPointer(event); event.preventDefault(); });
    el.addEventListener('pointermove', event => { if (el.hasPointerCapture(event.pointerId)) fromPointer(event); });
    el.addEventListener('input', event => api.change({value: Number(el.value)}, event));   // the keys
    return {sync: s => {
      const {min, max} = sliderTrack(api.box(), s);
      el.min = String(min); el.max = String(max); el.step = String(s.step ?? 1); el.value = String(s.value ?? min);
      el.disabled = !!s.disabled;
      el.setAttribute('aria-label', s.label ?? 'Slider');
      if (s.unit) el.setAttribute('aria-valuetext', `${s.value} ${s.unit}`);
    }};
  },

  stepper(api) {
    const key = which => {
      const el = control(api, 'button', {type: 'button', key: which, label: which === 'up' ? 'Raise' : 'Lower'});
      el.addEventListener('click', event => {
        const s = api.state, step = Number(s.step) || 1, next = Number(s.value || 0) + (which === 'up' ? step : -step);
        api.change({value: Number(clamp(next, s.min ?? -Infinity, s.max ?? Infinity).toFixed(6))}, event);
      });
      return el;
    };
    const down = key('down'), up = key('up');
    return {sync: s => {
      const box = api.box(), what = s.label ? `${s.label}: ` : '';
      placeAt(down, 0, box.height); placeAt(up, box.width - box.height, box.height);
      down.disabled = up.disabled = !!s.disabled;
      down.setAttribute('aria-label', `${what}lower`); up.setAttribute('aria-label', `${what}raise`);
    }};
  },

  field(api) {
    const el = control(api, 'input', {type: 'text', cursor: 'text'});
    el.spellcheck = false;
    el.autocomplete = 'off';
    const caret = () => api.ui({caret: el.selectionStart ?? undefined});
    el.addEventListener('input', event => { api.change({value: el.value}, event); caret(); });
    for (const name of ['keyup', 'click', 'select', 'focus']) el.addEventListener(name, caret);
    el.addEventListener('keydown', event => { if (event.key === 'Enter') api.emit('enter', event); });
    return {sync: s => {
      if (el.value !== String(s.value ?? '')) el.value = s.value ?? '';
      el.setAttribute('aria-label', s.label ?? s.placeholder ?? 'Text');
      el.disabled = !!s.disabled;
    }};
  },

  select(api) {
    const el = control(api, 'select');
    el.addEventListener('change', event => api.change({value: el.value, index: el.selectedIndex}, event));
    return {sync: s => {
      const options = s.options?.length ? s.options : [s.value ?? ''];
      if (el.options.length !== options.length || [...el.options].some((option, i) => option.value !== options[i])) {
        el.replaceChildren(...options.map(words => { const option = api.doc.createElement('option'); option.value = words; option.textContent = words; return option; }));
      }
      el.value = s.value ?? options[0];
      el.setAttribute('aria-label', s.label ?? 'Choose');
      el.disabled = !!s.disabled;
    }};
  },

  tabs(api) {
    const tabs = [];
    api.node.setAttribute('role', 'tablist');
    return {sync: s => {
      const names = s.options || [], boxes = tabBoxes(api.box(), names);
      each(api, boxes, tabs, i => {
        const el = control(api, 'button', {type: 'button', key: i});
        el.setAttribute('role', 'tab');
        el.addEventListener('click', event => api.change({value: i}, event));
        return el;
      });
      boxes.forEach(({x, width}, i) => { placeAt(tabs[i], x, width); tabs[i].setAttribute('aria-label', names[i]); tabs[i].setAttribute('aria-selected', String(i === s.value)); });
    }};
  },

  transport(api) {
    const names = {stop: 'Stop', previous: 'Back', play: 'Play or pause', next: 'On'}, keys = {};
    for (const key of Object.keys(names)) {
      keys[key] = control(api, 'button', {type: 'button', key, label: names[key]});
      keys[key].addEventListener('click', event => api.emit('key', key, event));
    }
    return {sync: () => transportKeys(api.box()).forEach(({key, x, width}) => placeAt(keys[key], x, width))};
  },

  planMap(api) {
    const el = control(api, 'button', {type: 'button', label: 'The plan seen from above. A click gives a place on the ground.', cursor: 'crosshair'});
    el.addEventListener('click', event => {
      const rect = api.node.getBoundingClientRect(), to = mapTransform(api.box(), api.state);
      api.emit('point', to.toWorld((event.clientX - rect.left) / PIXEL_PITCH, (event.clientY - rect.top) / PIXEL_PITCH));
    });
    return {};
  },

  /**
   * The site map. A drag does what its `mode` says: 'move' pans, 'loop' draws a loop, 'box' a rectangle; a press
   * without a drag gives the place (`point`), a finished drawing its corners (`lasso`). The wheel zooms once the
   * map has the keyboard (or with Ctrl, as a pinch arrives), so a page can still be scrolled past it.
   * Keys: the arrows move it, plus and minus zoom, 0 asks for the whole (`fit`), Escape drops a drawing.
   */
  siteMap(api) {
    const el = control(api, 'div', {cursor: 'crosshair'});
    el.tabIndex = 0;
    el.setAttribute('role', 'application');
    el.setAttribute('aria-roledescription', 'map');
    el.style.touchAction = 'none';
    let drag = null;
    const at = event => { const rect = api.node.getBoundingClientRect(); return [(event.clientX - rect.left) / PIXEL_PITCH, (event.clientY - rect.top) / PIXEL_PITCH]; };
    const world = (px, py) => viewTransform(api.box(), api.state).toWorld(px, py);
    const drop = () => { drag = null; api.ui({drawing: null}); };
    el.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      // Held, so a drag that leaves the map still ends on it; a pointer that cannot be held is followed while it is over the map.
      try { el.setPointerCapture(event.pointerId); } catch { /* not held */ }
      const [px, py] = at(event), from = world(px, py), mode = api.state.mode || 'move';
      drag = {id: event.pointerId, mode, px, py, travelled: 0, from, points: [from]};
    });
    el.addEventListener('pointermove', event => {
      if (!drag || event.pointerId !== drag.id) return;
      const [px, py] = at(event), dx = px - drag.px, dy = py - drag.py;
      if (drag.mode === 'move') {
        drag.travelled += Math.hypot(dx, dy);
        drag.px = px; drag.py = py;
        if (dx || dy) api.change(panned(api.box(), api.state, dx, dy), event);
        return;
      }
      if (drag.mode === 'box') {
        const to = world(px, py), a = drag.from;
        drag.travelled = Math.hypot(dx, dy);
        drag.points = [a, {x: to.x, y: a.y}, to, {x: a.x, y: to.y}];
      } else if (Math.hypot(dx, dy) >= 2) {
        drag.travelled += Math.hypot(dx, dy);
        drag.px = px; drag.py = py;
        drag.points.push(world(px, py));
      } else return;
      api.ui({drawing: drag.points.slice()});
    });
    el.addEventListener('pointerup', event => {
      const done = drag;
      if (!done) return;
      drop();
      if (done.travelled < 4) api.emit('point', done.from, event);
      else if (done.mode !== 'move') api.emit('lasso', done.points, done.mode, event);   // a loop too poor to pick with is the page's to refuse, in words
    });
    el.addEventListener('pointercancel', drop);
    el.addEventListener('wheel', event => {
      if (!(event.ctrlKey || event.metaKey || api.doc.activeElement === el)) return;
      event.preventDefault();
      const [px, py] = at(event);
      api.change(zoomed(api.box(), api.state, Math.exp(clamp(event.deltaY, -80, 80) * (event.ctrlKey ? 0.01 : 0.0025)), px, py), event);
    }, {passive: false});
    el.addEventListener('keydown', event => {
      const box = api.box(), step = Math.round(Math.min(box.width, box.height) / 8);
      const move = {ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step]}[event.key];
      if (move) api.change(panned(box, api.state, ...move), event);
      else if (event.key === '+' || event.key === '=') api.change(zoomed(box, api.state, 0.8), event);
      else if (event.key === '-' || event.key === '_') api.change(zoomed(box, api.state, 1.25), event);
      else if (event.key === '0') api.emit('fit', event);
      else if (event.key === 'Escape' && drag) drop();
      else return;
      event.preventDefault();
    });
    return {sync: s => {
      el.style.cursor = (s.mode || 'move') === 'move' ? 'grab' : 'crosshair';
      el.setAttribute('aria-label', s.label ?? 'The site seen from above. The arrow keys move it, plus and minus zoom.');
    }};
  },

  row: pressable(s => `${s.title ?? ''} ${s.detail ?? ''}`.trim()),
  tableRow: pressable(s => (s.cells || []).join(', ')),
  mission: pressable(s => `${s.name ?? 'Mission'}: ${s.steps ?? 0} of ${s.most ?? 50} steps ${s.time ?? ''}`.trim()),
  place: pressable(s => `${s.name ?? ''}, ${s.where ?? ''}`),
};

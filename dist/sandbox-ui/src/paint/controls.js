// Layer 2: what a person presses, drags or types into. Each is painted whole at the size it is given.
// A state says how it stands: `focused` (it has the keyboard), `held` (pressed now), `disabled` (set by the caller's alpha).
import {frame, centred, text, fill, hline, vline, outline, triangle, lamp, circle, line, inset, part, clamp, textWidth, number, GLYPH_H} from './primitives.js';
import {MINT, DIM, INK, PANEL} from '../palette.js';

const middle = box => box.y + Math.floor((box.height - GLYPH_H) / 2);

/** A button: lit all through while it is held or `active`. */
export function button(ctx, box, s = {}) {
  const active = !!(s.held || s.active);
  frame(ctx, box, {active, focused: !!s.focused, hovered: !!s.hovered});
  centred(ctx, s.label ?? 'BUTTON', inset(box, 5), active ? INK : MINT);
}

/** A switch with its lamp: on or off, said in words too. */
export function toggle(ctx, box, s = {}) {
  const on = !!s.value, held = !!s.held;
  frame(ctx, box, {focused: !!s.focused, active: held, hovered: !!s.hovered});
  const ink = held ? INK : MINT, quiet = held ? INK : DIM, y = middle(box);
  lamp(ctx, box.x + 8, y, 7, on, on ? ink : quiet);
  text(ctx, s.label ?? 'SWITCH', box.x + 20, y, ink, {room: box.width - 20 - 30});
  text(ctx, on ? 'ON' : 'OFF', box.x + box.width - 8, y, on ? ink : quiet, {align: 'right'});
}

/** A tick box: filled when chosen. */
export function checkbox(ctx, box, s = {}) {
  const y = box.y + Math.floor((box.height - 9) / 2), label = String(s.label ?? 'OPTION');
  outline(ctx, box.x + 2, y, 9, 9, s.value || s.focused || s.hovered ? MINT : DIM);
  if (s.value) fill(ctx, box.x + 4, y + 2, 5, 5, MINT);
  text(ctx, label, box.x + 16, y + 1, MINT, {room: box.width - 18});
  if (s.focused) hline(ctx, box.x + 16, y + 10, Math.min(box.width - 18, textWidth(label)), DIM, true);
}

/** One of several, side by side: the chosen one is lit. */
export function segmented(ctx, box, s = {}) {
  const options = s.options?.length ? s.options : ['A', 'B'];
  const chosen = clamp(Math.round(Number(s.value) || 0), 0, options.length - 1);
  outline(ctx, box.x, box.y, box.width, box.height, s.focused || s.hovered ? MINT : DIM);
  segmentBoxes(box, options.length).forEach(({x, width: w}, i) => {
    const label = options[i];
    if (i === chosen) fill(ctx, x + 2, box.y + 3, w - 4, box.height - 6, MINT);
    else if (i > 0 && i - 1 !== chosen) vline(ctx, x, box.y + 4, box.height - 8, DIM);
    centred(ctx, label, {x: x + 3, y: box.y + 1, width: w - 6, height: box.height - 2}, i === chosen ? INK : MINT);
  });
}

/** Where a segmented control's parts are: one `{x, width}` a choice, in the box's own pixels. */
export function segmentBoxes(box, count) {
  const width = Math.floor((box.width - 2) / count);
  return Array.from({length: count}, (_, i) => ({x: box.x + 1 + i * width, width: i === count - 1 ? box.width - 2 - i * width : width}));
}

const sliderLabel = (value, s) => `${number(value, s.decimals ?? 0)}${s.unit ? ` ${s.unit}` : ''}`;

/** A slider's range and where its track runs: the same for every value, so a drag reads true. */
export function sliderTrack(box, s = {}) {
  const min = Number.isFinite(s.min) ? s.min : 0, max = Number.isFinite(s.max) && s.max > min ? s.max : min + 100;
  const room = Math.max(30, textWidth(sliderLabel(min, s)) + 8, textWidth(sliderLabel(max, s)) + 8);
  const x0 = box.x + 8, x1 = box.x + box.width - room - 8;
  return {min, max, x0, span: Math.max(1, x1 - x0)};
}

/** A value on a track, with its number and unit at the right. */
export function slider(ctx, box, s = {}) {
  const {min, max, x0, span} = sliderTrack(box, s);
  const value = clamp(Number.isFinite(s.value) ? s.value : min, min, max), share = (value - min) / (max - min);
  const label = sliderLabel(value, s);
  frame(ctx, box, {focused: !!s.focused, hovered: !!s.hovered, double: false});
  const mid = box.y + Math.floor(box.height / 2), thumb = x0 + Math.round(span * share);
  hline(ctx, x0, mid, span + 1, DIM, true);
  for (let i = 0; i <= 4; i += 1) vline(ctx, x0 + Math.round(span * i / 4), mid + 3, 3, DIM);
  fill(ctx, x0, mid - 1, thumb - x0, 3, MINT);
  fill(ctx, thumb - 2, mid - 6, 5, 13, MINT);
  if (!s.held) {
    fill(ctx, thumb - 1, mid - 5, 3, 11, PANEL);
    fill(ctx, thumb, mid - 3, 1, 7, MINT);
  }
  text(ctx, label, box.x + box.width - 6, middle(box), MINT, {align: 'right', upper: false});
}

/** A number with a key to lower it and a key to raise it. `held` and `focused` name the key: 'down' or 'up'. */
export function stepper(ctx, box, s = {}) {
  const side = box.height, left = part(box, 0, 0, side, side), right = part(box, box.width - side, 0, side, side);
  frame(ctx, left, {active: s.held === 'down', focused: s.focused === 'down', hovered: s.hovered === 'down'});
  frame(ctx, right, {active: s.held === 'up', focused: s.focused === 'up', hovered: s.hovered === 'up'});
  centred(ctx, '-', left, s.held === 'down' ? INK : MINT);
  centred(ctx, '+', right, s.held === 'up' ? INK : MINT);
  const mid = part(box, side, 0, box.width - 2 * side, side);
  hline(ctx, mid.x, box.y, mid.width, DIM);
  hline(ctx, mid.x, box.y + side - 1, mid.width, DIM);
  const shown = `${number(s.value ?? 0, s.decimals ?? 0, !!s.signed)}${s.unit ? ` ${s.unit}` : ''}`;
  centred(ctx, shown, inset(mid, 3), MINT, {upper: false});
}

/** A line of text to type into; `icon: 'search'` puts a glass before it. `caret` is where the next letter goes. */
export function field(ctx, box, s = {}) {
  frame(ctx, box, {focused: !!s.focused, hovered: !!s.hovered, double: false});
  const y = middle(box), value = String(s.value ?? '');
  let x = box.x + 8;
  if (s.icon === 'search') {
    circle(ctx, x + 3, y + 3, 3, s.focused ? MINT : DIM);
    line(ctx, x + 6, y + 6, x + 8, y + 8, s.focused ? MINT : DIM);
    x += 14;
  }
  const room = box.x + box.width - 6 - x;
  if (value) {
    text(ctx, value, x, y, MINT, {room, upper: s.upper !== false});
    const before = Number.isInteger(s.caret) ? [...value].slice(0, s.caret).join('') : value;
    if (s.focused) fill(ctx, Math.min(x + textWidth(before) + (before ? 1 : 0), box.x + box.width - 5), y - 1, 1, 9, MINT);
  } else {
    text(ctx, s.placeholder ?? '', x, y, DIM, {room});
    if (s.focused) fill(ctx, x, y - 1, 1, 9, MINT);
  }
}

/** One value of a list, closed: the value and an arrow that says there are more. */
export function select(ctx, box, s = {}) {
  const held = !!s.held, ink = held ? INK : MINT, cell = Math.min(box.height, box.width);
  frame(ctx, box, {focused: !!s.focused, active: held, hovered: !!s.hovered, double: false});
  vline(ctx, box.x + box.width - cell, box.y + 4, box.height - 8, held ? INK : DIM);
  text(ctx, s.value ?? '', box.x + 8, middle(box), ink, {room: box.width - cell - 12});
  triangle(ctx, box.x + box.width - Math.floor(cell / 2) - 4, box.y + Math.floor(box.height / 2) - 2, 'down', 4, ink);
}

/** Section names along a rule: the open one is lit. */
export function tabs(ctx, box, s = {}) {
  const names = s.options?.length ? s.options : ['ONE', 'TWO'];
  const chosen = clamp(Math.round(Number(s.value) || 0), 0, names.length - 1), base = box.y + box.height - 1;
  hline(ctx, box.x, base, box.width, DIM);
  tabBoxes(box, names).forEach(({x, width: w}, i) => {
    const name = names[i];
    if (i === chosen) {
      fill(ctx, x, box.y + 3, w, box.height - 4, MINT);
      text(ctx, name, x + 8, middle(box) + 1, INK);
      hline(ctx, x, base, w, MINT);
    } else {
      text(ctx, name, x + 8, middle(box) + 1, s.focused === i || s.hovered === i ? MINT : DIM);
    }
  });
}

/** Where each section's name stands: one `{x, width}` a name that fits, in the box's own pixels. */
export function tabBoxes(box, names) {
  const boxes = [];
  let x = box.x;
  for (const name of names) {
    const width = textWidth(name) + 16;
    if (x + width > box.x + box.width) break;
    boxes.push({x, width});
    x += width + 2;
  }
  return boxes;
}

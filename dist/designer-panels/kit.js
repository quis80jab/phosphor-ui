// What the panel painters share: the catalogue's elements at a box, wrapped words, lists, tables,
// charts (saas-viz.js, drawn into the box), and the small tags a panel carries. Every call paints whole
// display pixels inside the box it is given; nothing here keeps state.
import {byId, paintElement} from '../sandbox-ui/src/ladder.js';
import {text, fill, outline, hline, vline, wrap, textWidth, clamp, line, triangle, circle} from '../sandbox-ui/src/paint/primitives.js';
import {MINT, DIM, INK, PANEL, AMBER, RED} from '../sandbox-ui/src/palette.js';
import {paintVFDChart} from '../saas-viz.js';

export {text, fill, outline, hline, vline, wrap, textWidth, clamp, line, triangle, circle, MINT, DIM, INK, PANEL, AMBER, RED};

/** A box inside a box, in whole pixels and never negative. */
export const part = (b, x, y, w, h) => ({x: Math.round(b.x + x), y: Math.round(b.y + y), width: Math.max(0, Math.round(w)), height: Math.max(0, Math.round(h))});
/** True when a box has room for something of this size. */
export const fits = (b, w, h) => b.width >= w && b.height >= h;

/** The part of a panel's inner box above the first box nested in the panel (nested boxes are cut out of it). */
export function above(inner, children = []) {
  const tops = children.filter(c => c.y > inner.y && c.x < inner.x + inner.width && c.x + c.width > inner.x).map(c => c.y);
  return tops.length ? {...inner, height: Math.max(0, Math.min(inner.height, Math.min(...tops) - inner.y - 4))} : inner;
}

/** One element of the catalogue, painted at a box when the box is big enough to hold it. */
export function el(ctx, id, box, state = {}) {
  if (box.width >= 8 && box.height >= 7) paintElement(ctx, byId[id], box, state);
}

/** Words wrapped to a box, one line every 10 pixels; gives back the height used. */
export function words(ctx, value, box, colour = DIM, {upper = true, gap = 10} = {}) {
  const lines = wrap(upper ? String(value ?? '').toUpperCase() : String(value ?? ''), Math.max(1, box.width));
  const most = Math.max(0, Math.floor((box.height + gap - 7) / gap));
  lines.slice(0, most).forEach((row, i) => text(ctx, row, box.x, box.y + i * gap, colour, {room: box.width, upper}));
  return Math.min(lines.length, most) * gap;
}

/** Names and values, one every `pitch` pixels: rows are [name, value, colour?]. Gives back the height used. */
export function facts(ctx, box, rows, {pitch = 16} = {}) {
  let used = 0;
  rows.forEach(([key, value, colour], i) => {
    if ((i + 1) * pitch - (pitch - 14) > box.height) return;
    el(ctx, 'keyvalue', part(box, 0, i * pitch, box.width, 14), {key, value: String(value ?? '--'), colour});
    used = (i + 1) * pitch;
  });
  return used;
}

/** Rows of a list: items are {title, detail, level, selected}. Gives back the box of each row painted. */
export function rows(ctx, box, items, {pitch = 20} = {}) {
  const boxes = [];
  items.forEach((item, i) => {
    if ((i + 1) * pitch > box.height + 2) return;
    const row = part(box, 0, i * pitch, box.width, pitch - 2);
    el(ctx, 'row', row, {title: item.title, detail: item.detail ?? '', selected: !!item.selected, level: item.level ?? 'ok'});
    boxes.push(row);
  });
  return boxes;
}

/** A table: a head of {title, share, align} columns and rows of cells. Gives back the box of each row. */
export function table(ctx, box, columns, cells, {pitch = 16, selected = -1} = {}) {
  el(ctx, 'tableHead', part(box, 0, 0, box.width, 14), {columns});
  const boxes = [];
  cells.forEach((row, i) => {
    if (16 + (i + 1) * pitch > box.height + 2) return;
    const at = part(box, 0, 16 + i * pitch, box.width, pitch - 2);
    el(ctx, 'tableRow', at, {columns, cells: row, selected: i === selected});
    boxes.push(at);
  });
  return boxes;
}

/** A chart of saas-viz.js drawn inside a box: its painter draws from (0, 0), so its calls are moved here. */
export function chart(ctx, box, spec) {
  if (box.width < 24 || box.height < 20) return;
  const dx = box.x, dy = box.y;
  const moved = {
    get fillStyle() { return ctx.fillStyle; }, set fillStyle(value) { ctx.fillStyle = value; },
    get imageSmoothingEnabled() { return false; }, set imageSmoothingEnabled(value) { /* always off on this display */ },
    save: () => ctx.save(), restore: () => ctx.restore(), beginPath: () => ctx.beginPath(), clip: rule => ctx.clip(rule),
    rect: (x, y, w, h) => ctx.rect(x + dx, y + dy, w, h), fillRect: (x, y, w, h) => ctx.fillRect(x + dx, y + dy, w, h),
  };
  paintVFDChart(moved, box.width, box.height, spec);
}

const TAGS = {
  WORKS: {fill: MINT, ink: INK}, 'NO UI': {line: MINT, ink: MINT}, LEAD: {line: AMBER, ink: AMBER}, PLAN: {dotted: DIM, ink: DIM},
  SAMPLE: {ink: AMBER}, DESIGN: {ink: DIM}, SIM: {line: DIM, ink: MINT}, 'DJI SIM': {line: AMBER, ink: AMBER}, REAL: {fill: MINT, ink: INK},
};

/** A small tag ending at `right`, at `y`; gives back its width (0 when there is no room before `left`). */
export function tag(ctx, right, y, label, left = -Infinity) {
  const style = TAGS[label] ?? {ink: DIM}, width = textWidth(label) + (style.ink && !style.fill && !style.line && !style.dotted ? 0 : 8);
  const x = right - width;
  if (x < left) return 0;
  if (style.fill) fill(ctx, x, y, width, 11, style.fill);
  if (style.line) outline(ctx, x, y, width, 11, style.line);
  if (style.dotted) { hline(ctx, x, y, width, style.dotted, true); hline(ctx, x, y + 10, width, style.dotted, true); vline(ctx, x, y, 11, style.dotted, true); vline(ctx, x + width - 1, y, 11, style.dotted, true); }
  text(ctx, label, x + (width - textWidth(label)) / 2, y + 2, style.ink);
  return width;
}

/** The word of an origin as a tag: 'sim', 'dji-simulator', 'real'. */
export const ORIGIN_TAG = {sim: 'SIM', 'dji-simulator': 'DJI SIM', real: 'REAL'};

/** A plain button drawn whole at its box. */
export function button(ctx, box, label, {held = false, disabled = false} = {}) {
  el(ctx, 'button', box, {label: String(label).toUpperCase(), held, disabled});
}

/** One of several, painted, with the box of each option (for clicks): options are words. */
export function choice(ctx, box, options, value) {
  el(ctx, 'segmented', box, {options, value});
  const each = box.width / Math.max(1, options.length);
  return options.map((_, i) => part(box, i * each, 0, each, box.height));
}

/** A line of small words with a lamp: for lists of states. */
export function lampLine(ctx, x, y, width, title, detail, colour = MINT) {
  fill(ctx, x, y + 1, 5, 5, colour);
  text(ctx, title, x + 9, y, MINT, {room: width - 9 - (detail ? textWidth(detail) + 8 : 0)});
  if (detail) text(ctx, detail, x + width, y, DIM, {align: 'right', room: width - 20});
}

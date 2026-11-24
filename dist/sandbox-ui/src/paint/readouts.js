// Layer 3: what says one thing. A label, a value with its unit, a state, a row of a list or a table.
import {frame, text, fill, hline, outline, lamp, bar, wrap, clamp, textWidth, number, GLYPH_H, LINE} from './primitives.js';
import {MINT, DIM, INK, PANEL, AMBER, RED, levelColour} from '../palette.js';

const middle = box => box.y + Math.floor((box.height - GLYPH_H) / 2);

/** Words. `variant`: 'title' (twice the size) or 'caption' (quiet). */
export function label(ctx, box, s = {}) {
  const scale = s.variant === 'title' ? 2 : 1, colour = s.variant === 'caption' ? DIM : s.colour || MINT;
  const y = box.y + Math.floor((box.height - GLYPH_H * scale) / 2), align = s.align || 'left';
  const x = align === 'right' ? box.x + box.width : align === 'center' ? box.x + Math.floor(box.width / 2) : box.x;
  text(ctx, s.text ?? '', x, y, colour, {align, room: box.width, scale});
}

/** A name and its value at the two ends of a dotted line. */
export function keyvalue(ctx, box, s = {}) {
  const y = middle(box), value = String(s.value ?? '--');
  const vw = Math.min(textWidth(value), box.width), keyRoom = Math.max(0, box.width - vw - 12);
  const done = text(ctx, s.key ?? '', box.x, y, DIM, {room: keyRoom});
  text(ctx, value, box.x + box.width, y, s.colour || MINT, {align: 'right', room: box.width});
  const from = box.x + done.width + 4, to = box.x + box.width - vw - 4;
  if (to - from > 6) hline(ctx, from, y + 6, to - from, DIM, true);
}

/** A number that matters, large, with its unit and what it is. The catalogue's `value` view. */
export function value(ctx, box, s = {}) {
  text(ctx, s.caption ?? '', box.x, box.y + 1, DIM, {room: box.width});
  const shown = typeof s.value === 'number' ? number(s.value, s.decimals ?? 1, !!s.signed) : String(s.value ?? '--');
  const unitRoom = s.unit ? textWidth(s.unit) + 4 : 0;
  const done = text(ctx, shown, box.x, box.y + 12, levelColour(s.level || 'ok'), {scale: 2, room: box.width - unitRoom});
  if (s.unit) text(ctx, s.unit, box.x + done.width + 4, box.y + 19, DIM, {upper: false});
}

/** A lamp and a word: ok, warn, fail or off. */
export function badge(ctx, box, s = {}) {
  const colour = levelColour(s.level || 'ok'), y = middle(box);
  lamp(ctx, box.x + 1, y, 7, s.level !== 'off', colour);
  text(ctx, s.text ?? '', box.x + 13, y, colour, {room: box.width - 13});
}

const ORIGINS = {real: 'REAL', 'dji-simulator': 'DJI SIM', sim: 'SIM'};

/**
 * Where data comes from: the real aircraft, DJI's simulator, or our simulation.
 * It stands on every view of a Device, so the three are never mistaken for one another.
 */
export function origin(ctx, box, s = {}) {
  const kind = ORIGINS[s.origin] ? s.origin : 'sim', name = ORIGINS[kind];
  const w = Math.min(box.width, textWidth(name) + 10), h = Math.min(box.height, 13);
  const x = s.align === 'right' ? box.x + box.width - w : box.x, y = box.y + Math.floor((box.height - h) / 2);
  const ty = y + Math.floor((h - GLYPH_H) / 2);
  if (kind === 'real') {
    fill(ctx, x, y, w, h, MINT);
    text(ctx, name, x + 5, ty, INK, {room: w - 6});
  } else if (kind === 'dji-simulator') {
    outline(ctx, x, y, w, h, AMBER);
    text(ctx, name, x + 5, ty, AMBER, {room: w - 6});
  } else {
    outline(ctx, x, y, w, h, DIM);
    hline(ctx, x + 2, y + h - 2, w - 4, DIM, true);
    text(ctx, name, x + 5, ty - (h >= 13 ? 1 : 0), MINT, {room: w - 6});
  }
}

/** How far along, as a bar and a percentage. */
export function progress(ctx, box, s = {}) {
  const share = clamp(Number(s.value) || 0, 0, 1), h = Math.min(box.height, 11), y = box.y + Math.floor((box.height - h) / 2);
  bar(ctx, box.x, y, box.width - 30, h, share, levelColour(s.level || 'ok'));
  text(ctx, `${Math.round(share * 100)}%`, box.x + box.width, y + Math.floor((h - GLYPH_H) / 2), MINT, {align: 'right'});
}

/** A meter of blocks: amber near its top, red at it. */
export function level(ctx, box, s = {}) {
  const count = s.segments || 12, lit = Math.round(count * clamp(Number(s.value) || 0, 0, 1));
  const step = Math.floor((box.width + 2) / count);
  for (let i = 0; i < count; i += 1) {
    const x = box.x + i * step, colour = i >= count * (s.fail ?? 0.9) ? RED : i >= count * (s.warn ?? 0.75) ? AMBER : MINT;
    if (i < lit) fill(ctx, x, box.y, step - 2, box.height, colour);
    else outline(ctx, x, box.y, step - 2, box.height, DIM);
  }
}

/** A row of a list: its lamp, its name, a detail at the right. Lit when chosen. */
export function row(ctx, box, s = {}) {
  const selected = !!s.selected, ink = selected ? INK : MINT, quiet = selected ? INK : DIM, y = middle(box);
  if (selected) fill(ctx, box.x, box.y + 1, box.width, box.height - 2, MINT);
  else if (s.focused) outline(ctx, box.x, box.y, box.width, box.height, DIM);
  lamp(ctx, box.x + 4, y, 7, s.level !== 'off', selected ? INK : levelColour(s.level || 'ok'));
  const detail = String(s.detail ?? ''), dw = textWidth(detail);
  text(ctx, s.title ?? '', box.x + 16, y, ink, {room: box.width - 16 - dw - 12});
  if (detail) text(ctx, detail, box.x + box.width - 5, y, quiet, {align: 'right', room: box.width - 24});
}

/** A table's columns in a box: each `{title, share, align}` gets its place. */
function columnsOf(box, columns) {
  const total = columns.reduce((sum, column) => sum + (column.share || 1), 0) || 1;
  let x = box.x;
  return columns.map((column, i) => {
    const width = i === columns.length - 1 ? box.x + box.width - x : Math.round(box.width * (column.share || 1) / total);
    const placed = {...column, x, width};
    x += width;
    return placed;
  });
}

const cellText = (ctx, column, words, y, colour) => text(ctx, words, column.align === 'right' ? column.x + column.width - 4 : column.x + 4, y, colour,
  {align: column.align === 'right' ? 'right' : 'left', room: column.width - 8});

/** A table's head: the column names over a rule. */
export function tableHead(ctx, box, s = {}) {
  if (!s.columns?.length) return;   // no table yet: nothing, not even its rule
  for (const column of columnsOf(box, s.columns || [])) cellText(ctx, column, column.title ?? '', middle(box), DIM);
  hline(ctx, box.x, box.y + box.height - 1, box.width, DIM);
}

/** A table's row: one cell under each column. Lit when chosen. */
export function tableRow(ctx, box, s = {}) {
  const selected = !!s.selected;
  if (selected) fill(ctx, box.x, box.y + 1, box.width, box.height - 2, MINT);
  columnsOf(box, s.columns || []).forEach((column, i) => cellText(ctx, column, s.cells?.[i] ?? '', middle(box), selected ? INK : MINT));
  if (!selected) hline(ctx, box.x, box.y + box.height - 1, box.width, DIM, true);
}

/** Something a person must read: an error (red), a warning (amber) or a note. */
export function alert(ctx, box, s = {}) {
  const kind = s.level || 'warn', colour = kind === 'note' ? MINT : levelColour(kind);
  const tag = {error: 'ERROR', fail: 'ERROR', warn: 'WARNING', note: 'NOTE'}[kind] || 'NOTE';
  fill(ctx, box.x, box.y, box.width, box.height, PANEL);
  frame(ctx, box, {colour, quiet: kind === 'note' ? DIM : colour});
  const lines = wrap(`${tag}: ${String(s.text ?? '')}`.toUpperCase(), box.width - 16);
  const most = Math.max(0, Math.floor((box.height - 14 + 3) / LINE));
  lines.slice(0, most).forEach((words, i) => text(ctx, words, box.x + 8, box.y + 7 + i * LINE, colour, {room: box.width - 16}));
}

/** A small square that shows a class by its fill: 'solid', 'half', 'dot' or empty. */
export function swatch(ctx, x, y, size, item = {}) {
  const colour = item.colour || MINT;
  outline(ctx, x, y, size, size, colour);
  if (item.mark === 'solid') fill(ctx, x + 2, y + 2, size - 4, size - 4, colour);
  else if (item.mark === 'half') { for (let i = 2; i < size - 2; i += 2) fill(ctx, x + 2, y + i, size - 4, 1, colour); }
  else if (item.mark === 'dot') fill(ctx, x + 3, y + 3, size - 6, size - 6, colour);
}

/** What the fills and colours of a picture mean. */
export function legend(ctx, box, s = {}) {
  const y = box.y + Math.floor((box.height - 9) / 2);
  let x = box.x;
  for (const item of s.items || []) {
    const w = 14 + textWidth(item.label);
    if (x + w > box.x + box.width) break;
    swatch(ctx, x, y, 9, item);
    text(ctx, item.label, x + 14, y + 1, MINT);
    x += w + 10;
  }
}

/** The steps of a piece of work in order: done, now, to do, or failed. */
export function steps(ctx, box, s = {}) {
  const items = s.items || [], n = items.length;
  if (!n) return;
  const pitch = Math.floor(box.width / n), y = box.y + 2;
  items.forEach((item, i) => {
    const cx = box.x + i * pitch + Math.floor(pitch / 2), state = item.state || 'todo';
    if (i < n - 1) hline(ctx, cx + 6, y + 4, pitch - 12, state === 'done' ? MINT : DIM, state !== 'done');
    if (state === 'done') fill(ctx, cx - 4, y, 9, 9, MINT);
    else if (state === 'now') { outline(ctx, cx - 4, y, 9, 9, MINT); fill(ctx, cx - 1, y + 3, 3, 3, MINT); }
    else if (state === 'fail') { outline(ctx, cx - 4, y, 9, 9, RED); fill(ctx, cx - 2, y + 2, 5, 5, RED); }
    else outline(ctx, cx - 4, y, 9, 9, DIM);
    text(ctx, item.label ?? '', cx, y + 14, state === 'todo' ? DIM : state === 'fail' ? RED : MINT, {align: 'center', room: pitch - 4});
  });
}

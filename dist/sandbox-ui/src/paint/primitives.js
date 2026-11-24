// Layer 1: the marks every element is made of. Rules, frames, text runs, lamps, bars, lines.
// Every call takes whole display pixels and paints whole display pixels; nothing here scales a picture.
import {pixelText, glyphMark} from '../phosphor.js';
import {MINT, DIM, INK} from '../palette.js';

export const ADVANCE = 6;   // a glyph is 5 wide and the next starts 6 on
export const GLYPH_H = 7;
export const LINE = 10;     // one text line and its gap

export const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
export const textWidth = (value, scale = 1) => Math.max(0, [...String(value ?? '')].length * ADVANCE - 1) * scale;
export const inset = (box, d) => ({x: box.x + d, y: box.y + d, width: box.width - 2 * d, height: box.height - 2 * d});
/** A box's piece: `dx`, `dy` from its corner, `width` by `height`. */
export const part = (box, dx, dy, width, height) => ({x: box.x + dx, y: box.y + dy, width, height});

export function fill(ctx, x, y, w, h, colour) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 1 || h < 1) return;
  ctx.fillStyle = colour;
  ctx.fillRect(x, y, w, h);
}

/** A run of text. Capitals by default, as the display's labels are. `room` cuts it with dots. */
export function text(ctx, value, x, y, colour = MINT, {align = 'left', room, scale = 1, upper = true} = {}) {
  const shown = upper ? String(value ?? '').toUpperCase() : String(value ?? '');
  const options = room === undefined ? {align} : {align, maxWidth: Math.max(0, room)};
  return pixelText(ctx, shown, Math.round(x), Math.round(y), colour, scale, options);
}

/** Text in the middle of a box. */
export function centred(ctx, value, box, colour = MINT, {scale = 1, upper = true} = {}) {
  const x = box.x + Math.floor(box.width / 2);
  const y = box.y + Math.floor((box.height - GLYPH_H * scale) / 2);
  return text(ctx, value, x, y, colour, {align: 'center', room: box.width, scale, upper});
}

export function hline(ctx, x, y, w, colour, dotted = false) {
  if (!dotted) return fill(ctx, x, y, w, 1, colour);
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = colour;
  for (let i = 0; i < w; i += 2) ctx.fillRect(x + i, y, 1, 1);
}

export function vline(ctx, x, y, h, colour, dotted = false) {
  if (!dotted) return fill(ctx, x, y, 1, h, colour);
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = colour;
  for (let i = 0; i < h; i += 2) ctx.fillRect(x, y + i, 1, 1);
}

/** A one-pixel outline. */
export function outline(ctx, x, y, w, h, colour) {
  if (w < 1 || h < 1) return;
  fill(ctx, x, y, w, 1, colour);
  fill(ctx, x, y + h - 1, w, 1, colour);
  fill(ctx, x, y, 1, h, colour);
  fill(ctx, x + w - 1, y, 1, h, colour);
}

/**
 * A control's frame: two outlines three pixels apart. Lit all through when it is active;
 * two small marks in its corners when it has the keyboard; its outer line lit under the pointer.
 */
export function frame(ctx, box, {active = false, focused = false, hovered = false, colour = MINT, quiet = DIM, double = true} = {}) {
  const {x, y, width: w, height: h} = box;
  if (active && w > 8 && h > 8) fill(ctx, x + 4, y + 4, w - 8, h - 8, colour);
  outline(ctx, x, y, w, h, focused || active || hovered ? colour : quiet);
  if (double && w >= 9 && h >= 9) outline(ctx, x + 3, y + 3, w - 6, h - 6, active ? colour : quiet);
  if (focused && w >= 13 && h >= 13) {
    const mark = active ? INK : colour;
    fill(ctx, x + 5, y + 5, 2, 1, mark);
    fill(ctx, x + w - 7, y + h - 6, 2, 1, mark);
  }
}

/** A solid arrow head in a square of 2r + 1 from its corner (x, y): 'left', 'right', 'up' or 'down'. */
export function triangle(ctx, x, y, direction, radius, colour) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = colour;
  for (let i = 0; i <= radius * 2; i += 1) {
    const length = radius + 1 - Math.abs(i - radius);
    if (direction === 'right') ctx.fillRect(x, y + i, length, 1);
    else if (direction === 'left') ctx.fillRect(x + radius + 1 - length, y + i, length, 1);
    else if (direction === 'down') ctx.fillRect(x + i, y, 1, length);
    else ctx.fillRect(x + i, y + radius + 1 - length, 1, length);
  }
}

/** A lamp: lit solid, or an empty outline. */
export function lamp(ctx, x, y, size, on, colour = MINT) {
  if (on) fill(ctx, x, y, size, size, colour);
  else outline(ctx, x, y, size, size, colour);
}

/** A field of the display's marks ('dots', 'hashes', 'blocks', 'lines'), one every six pixels. */
export function pattern(ctx, x, y, w, h, mark, colour) {
  x = Math.round(x); y = Math.round(y);
  for (let yy = y; yy + 4 <= y + h; yy += 6) for (let xx = x; xx + 4 <= x + w; xx += 6) glyphMark(ctx, xx, yy, mark, colour, 4);
}

/** A straight line between two pixels, kept inside `clip` when one is given. */
export function line(ctx, x0, y0, x1, y1, colour, {clip, dotted = false} = {}) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let error = dx + dy, step = 0;
  ctx.fillStyle = colour;
  for (let guard = 0; guard < 8192; guard += 1) {
    const inside = !clip || (x0 >= clip.x && y0 >= clip.y && x0 < clip.x + clip.width && y0 < clip.y + clip.height);
    if (inside && (!dotted || step % 2 === 0)) ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x0 += sx; }
    if (twice <= dx) { error += dx; y0 += sy; }
    step += 1;
  }
}

/** A circle's outline, kept inside `clip` when one is given. */
export function circle(ctx, cx, cy, radius, colour, {clip, dotted = false} = {}) {
  cx = Math.round(cx); cy = Math.round(cy); radius = Math.round(radius);
  if (radius < 1) return;
  ctx.fillStyle = colour;
  const dot = (x, y, n) => {
    if (dotted && n % 2) return;
    if (clip && (x < clip.x || y < clip.y || x >= clip.x + clip.width || y >= clip.y + clip.height)) return;
    ctx.fillRect(x, y, 1, 1);
  };
  let x = radius, y = 0, error = 1 - radius;
  while (x >= y) {
    dot(cx + x, cy + y, y); dot(cx - x, cy + y, y); dot(cx + x, cy - y, y); dot(cx - x, cy - y, y);
    dot(cx + y, cy + x, y); dot(cx - y, cy + x, y); dot(cx + y, cy - x, y); dot(cx - y, cy - x, y);
    y += 1;
    if (error < 0) error += 2 * y + 1;
    else { x -= 1; error += 2 * (y - x) + 1; }
  }
}

/** A bar in its outline, lit from the left by `fraction`; `segments` cuts it into blocks. */
export function bar(ctx, x, y, w, h, fraction, colour = MINT, {quiet = DIM, segments = 0} = {}) {
  outline(ctx, x, y, w, h, quiet);
  const room = w - 4, share = clamp(Number(fraction) || 0, 0, 1);
  if (room < 1 || h < 5) return;
  if (!segments) return fill(ctx, x + 2, y + 2, Math.round(room * share), h - 4, colour);
  const step = Math.floor((room + 1) / segments), lit = Math.round(segments * share);
  for (let i = 0; i < lit; i += 1) fill(ctx, x + 2 + i * step, y + 2, step - 1, h - 4, colour);
}

/** Text broken into lines of at most `room` pixels, at spaces. */
export function wrap(value, room) {
  const most = Math.max(1, Math.floor((room + 1) / ADVANCE));
  const lines = [];
  let current = '';
  for (const word of String(value ?? '').split(/\s+/).filter(Boolean)) {
    if (current && current.length + 1 + word.length > most) { lines.push(current); current = word; }
    else current = current ? `${current} ${word}` : word;
  }
  if (current) lines.push(current);
  return lines;
}

/** A number as text with a fixed count of decimals and always a sign when `signed`. */
export function number(value, decimals = 0, signed = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '--';
  const shown = Math.abs(n).toFixed(decimals);
  return `${n < 0 ? '-' : signed ? '+' : ''}${shown}`;
}

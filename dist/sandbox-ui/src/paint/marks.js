// Layer 1 on show: the marks by themselves, so the bench can show what every element is made of.
import {text, fill, hline, vline, outline, frame, triangle, lamp, pattern, line, circle, bar, centred, part} from './primitives.js';
import {MINT, DIM, INK, AMBER, RED} from '../palette.js';

/** Rules: whole, dotted, across and down. */
export function rules(ctx, box) {
  hline(ctx, box.x, box.y + 2, box.width, MINT);
  hline(ctx, box.x, box.y + 8, box.width, DIM);
  hline(ctx, box.x, box.y + 14, box.width, MINT, true);
  vline(ctx, box.x + 2, box.y + 18, box.height - 18, MINT);
  vline(ctx, box.x + 8, box.y + 18, box.height - 18, DIM, true);
  line(ctx, box.x + 16, box.y + box.height - 1, box.x + box.width - 1, box.y + 18, MINT, {clip: box});
}

/** A frame in the state it is given. */
export function frames(ctx, box, s = {}) {
  frame(ctx, box, s);
  centred(ctx, s.label ?? '', box, s.active ? INK : MINT);
}

/** The glyphs: capitals, small letters, figures and signs, at one and two sizes. */
export function glyphs(ctx, box) {
  text(ctx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', box.x, box.y + 1, MINT, {room: box.width});
  text(ctx, 'abcdefghijklmnopqrstuvwxyz', box.x, box.y + 11, MINT, {room: box.width, upper: false});
  text(ctx, '0123456789 +-:.,/%°<>()[]', box.x, box.y + 21, DIM, {room: box.width});
  text(ctx, 'PHOSPHOR 12.5 m', box.x, box.y + 33, MINT, {room: box.width, scale: 2, upper: false});
}

/** Lamps: lit and unlit, in the three colours a level can have. */
export function lamps(ctx, box) {
  [[MINT, 'OK'], [AMBER, 'WARN'], [RED, 'FAIL']].forEach(([colour, name], i) => {
    const x = box.x + i * 64;
    if (x + 60 > box.x + box.width) return;
    lamp(ctx, x, box.y + 1, 7, true, colour);
    lamp(ctx, x + 11, box.y + 1, 7, false, colour);
    text(ctx, name, x + 23, box.y + 1, colour);
  });
}

/** The four fills of the display, each named. */
export function patterns(ctx, box) {
  ['dots', 'hashes', 'blocks', 'lines'].forEach((mark, i) => {
    const cell = part(box, i * Math.floor(box.width / 4), 0, Math.floor(box.width / 4) - 6, box.height - 11);
    outline(ctx, cell.x, cell.y, cell.width, cell.height, DIM);
    pattern(ctx, cell.x + 3, cell.y + 3, cell.width - 6, cell.height - 6, mark, MINT);
    text(ctx, mark, cell.x, box.y + box.height - 8, DIM, {room: cell.width});
  });
}

/** Bars: whole, and cut into blocks. */
export function bars(ctx, box, s = {}) {
  bar(ctx, box.x, box.y, box.width, 9, s.value ?? 0.6, MINT);
  bar(ctx, box.x, box.y + 13, box.width, 9, s.value ?? 0.6, MINT, {segments: 12});
}

/** Arrow heads, a circle and a slanted line. */
export function shapes(ctx, box) {
  ['left', 'up', 'down', 'right'].forEach((direction, i) => triangle(ctx, box.x + i * 16, box.y + 4, direction, 4, MINT));
  circle(ctx, box.x + 80, box.y + 9, 8, MINT);
  circle(ctx, box.x + 104, box.y + 9, 8, DIM, {dotted: true});
  fill(ctx, box.x + 122, box.y + 2, 14, 14, MINT);
  outline(ctx, box.x + 142, box.y + 2, 14, 14, MINT);
}

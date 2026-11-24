// Layer 5: a site seen from above. Building outlines round a place, in the site frame's metres, north up:
// where the search landed, the area the outlines were asked for, the loop a person draws, and the target it makes.
// The view is a middle and a width in metres, so the same numbers pan and zoom the painting and read the pointer.
import {frame, text, fill, triangle, line, inset, clamp, textWidth, GLYPH_H} from './primitives.js';
import {MINT, DIM, AMBER, PANEL} from '../palette.js';

/** The least and the most metres across a site map: a doorway, and the widest area that is asked for. */
export const MAP_LIMITS = {least_m: 20, most_m: 2400};

/**
 * How a site map fits the ground in its box: `centre` (metres, east and north) is the map's middle and
 * `across_m` the metres across its shorter side. North is up. Gives the way to pixels and the way back.
 */
export function viewTransform(box, s = {}) {
  const view = inset(box, 2), centre = s.centre || {x: 0, y: 0};
  const across = clamp(Number(s.across_m) || 300, MAP_LIMITS.least_m, MAP_LIMITS.most_m);
  const perMetre = Math.max(8, Math.min(view.width, view.height)) / across;
  const cx = view.x + Math.floor(view.width / 2), cy = view.y + Math.floor(view.height / 2);
  return {
    view, perMetre, across,
    toPixel: (x, y) => [Math.round(cx + (x - centre.x) * perMetre), Math.round(cy - (y - centre.y) * perMetre)],
    toWorld: (px, py) => ({x: centre.x + (px - cx) / perMetre, y: centre.y - (py - cy) / perMetre}),
  };
}

/** A straight stroke between two pixels, cut to `clip` first, so a corner far off the map costs nothing. */
function stroke(ctx, x0, y0, x1, y1, colour, clip, dotted = false) {
  const left = clip.x - 1, right = clip.x + clip.width, top = clip.y - 1, bottom = clip.y + clip.height;
  const dx = x1 - x0, dy = y1 - y0;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, x0 - left], [dx, right - x0], [-dy, y0 - top], [dy, bottom - y0]]) {
    if (p === 0) { if (q < 0) return; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return; if (t > t0) t0 = t; }
    else { if (t < t0) return; if (t < t1) t1 = t; }
  }
  line(ctx, x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy, colour, {clip, dotted});
}

/** The inside of a polygon (its rings read even-odd, in pixels) as a field of dots: one pixel in four. */
function dots(ctx, rings, colour, clip) {
  const top = Math.max(clip.y, Math.min(...rings.flat().map(p => p[1]))), bottom = Math.min(clip.y + clip.height - 1, Math.max(...rings.flat().map(p => p[1])));
  ctx.fillStyle = colour;
  for (let y = top + (top % 2); y <= bottom; y += 2) {
    const crossings = [];
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 1) {
        const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
        if ((ay <= y) !== (by <= y)) crossings.push(ax + (y - ay) * (bx - ax) / (by - ay));
      }
    }
    crossings.sort((a, b) => a - b);
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const from = Math.max(clip.x, Math.ceil(crossings[i]) + 1), to = Math.min(clip.x + clip.width - 1, Math.floor(crossings[i + 1]) - 1);
      for (let x = from + ((from + y / 2) % 2 ? 1 : 0); x <= to; x += 2) ctx.fillRect(x, y, 1, 1);
    }
  }
}

/** A round number of metres whose bar is long enough to read. */
function scaleLength(perMetre) {
  for (const metres of [2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (metres * perMetre >= 28) return metres;
  return 1000;
}

/** The spacing of the ground's dots: ten metres where that leaves room, else fifty, else a hundred, else none. */
function gridStep(perMetre) {
  for (const metres of [10, 50, 100]) if (metres * perMetre >= 8) return metres;
  return 0;
}

const inside = (clip, x, y, w, h) => x >= clip.x && y >= clip.y && x + w <= clip.x + clip.width && y + h <= clip.y + clip.height;

/** How wide a run of text is once it is cut to its room. */
const shownWidth = (words, room) => Math.max(0, Math.min([...String(words)].length, Math.floor((room + 1) / 6)) * 6 - 1);

/** One outline as the map takes it: its corners, and its box in metres so it can be left out when it is off the view. */
export function footprintMark(ring, more = {}) {
  const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
  return {ring, min: {x: Math.min(...xs), y: Math.min(...ys)}, max: {x: Math.max(...xs), y: Math.max(...ys)}, ...more};
}

/**
 * A site from above. `footprints` are the area's outlines (`{ring, min, max, name, part}`: its corners, its
 * box in metres, a name where the source has one, and whether it is part of the target); `area` the square they
 * were asked for; `place` where the search landed; `target` the outline made (`{outline, holes}`); `lasso` the loop
 * that made it; `drawing` a loop under the hand. `mode` says what a drag does: 'move', 'loop' or 'box'.
 */
export function siteMap(ctx, box, s = {}) {
  const drawingNow = !!s.drawing?.length;
  frame(ctx, box, {focused: !!s.focused, hovered: !!s.hovered || drawingNow, colour: drawingNow ? AMBER : MINT, double: false});
  const {view: clip, perMetre, toPixel, toWorld} = viewTransform(box, s);
  if (clip.width < 8 || clip.height < 8) return;
  const a = toWorld(clip.x, clip.y + clip.height), b = toWorld(clip.x + clip.width, clip.y);
  const step = gridStep(perMetre);
  if (step) {
    ctx.fillStyle = DIM;
    for (let gx = Math.ceil(a.x / step) * step; gx <= b.x; gx += step) {
      for (let gy = Math.ceil(a.y / step) * step; gy <= b.y; gy += step) {
        const [px, py] = toPixel(gx, gy);
        if (inside(clip, px, py, 1, 1)) ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  const ring = (points, colour, dotted = false, open = false) => {
    const pixels = points.map(p => toPixel(p.x, p.y));
    for (let i = 0; i + (open ? 1 : 0) < pixels.length; i += 1) stroke(ctx, ...pixels[i], ...pixels[(i + 1) % pixels.length], colour, clip, dotted);
    return pixels;
  };
  if (s.area?.length) ring(s.area, DIM, true);

  // The outlines of the area: those that reach into the view, the target's own left to the target.
  const labels = [];
  for (const footprint of s.footprints || []) {
    if (footprint.max.x < a.x || footprint.min.x > b.x || footprint.max.y < a.y || footprint.min.y > b.y) continue;
    if (!footprint.part) ring(footprint.ring, DIM);
    if (footprint.name) labels.push(footprint);
  }
  const target = s.target?.outline?.length ? s.target : null;
  if (target) {
    const rings = [target.outline, ...(target.holes || [])].map(points => ring(points, MINT));
    dots(ctx, rings, MINT, clip);
    if (perMetre >= 1.5) for (const [px, py] of rings[0]) if (inside(clip, px - 1, py - 1, 3, 3)) fill(ctx, px - 1, py - 1, 3, 3, MINT);
  }
  if (s.lasso?.length > 2 && !drawingNow) ring(s.lasso, AMBER, true);

  // Names, where an outline is wide enough to carry one and no other name is in the way.
  const taken = [];
  for (const footprint of labels) {
    if (taken.length >= 24) break;
    const wide = (footprint.max.x - footprint.min.x) * perMetre;
    if (wide < 24) continue;
    const words = String(footprint.name).toUpperCase(), room = Math.max(40, Math.round(wide) + 24), w = shownWidth(words, room);
    const [px, py] = toPixel((footprint.min.x + footprint.max.x) / 2, (footprint.min.y + footprint.max.y) / 2);
    const rect = {x: px - Math.ceil(w / 2) - 2, y: py - 5, width: w + 4, height: GLYPH_H + 4};
    if (!inside(clip, rect.x, rect.y, rect.width, rect.height)) continue;
    if (taken.some(other => rect.x < other.x + other.width && other.x < rect.x + rect.width && rect.y < other.y + other.height && other.y < rect.y + rect.height)) continue;
    taken.push(rect);
    fill(ctx, rect.x, rect.y, rect.width, rect.height, PANEL);
    text(ctx, words, px, py - 3, footprint.part ? MINT : DIM, {align: 'center', room});
  }

  if (s.place) {
    // Where the search landed: a cross with its middle left open.
    const [px, py] = toPixel(s.place.x, s.place.y);
    stroke(ctx, px - 7, py, px - 3, py, AMBER, clip); stroke(ctx, px + 3, py, px + 7, py, AMBER, clip);
    stroke(ctx, px, py - 7, px, py - 3, AMBER, clip); stroke(ctx, px, py + 3, px, py + 7, AMBER, clip);
  }
  if (drawingNow) {
    // A loop under the hand: what is drawn whole, and dotted the way back to where it began.
    const pixels = ring(s.drawing, AMBER, false, true);
    if (pixels.length > 2) stroke(ctx, ...pixels[pixels.length - 1], ...pixels[0], AMBER, clip, true);
  }

  // North, a round length, and what a drag does.
  if (clip.width >= 60 && clip.height >= 40) {
    triangle(ctx, clip.x + clip.width - 11, clip.y + 3, 'up', 2, DIM);
    text(ctx, 'N', clip.x + clip.width - 11, clip.y + 9, DIM);
    const metres = scaleLength(perMetre), length = Math.max(2, Math.round(metres * perMetre)), y = clip.y + clip.height - 5, words = `${metres} M`;
    if (length + textWidth(words) + 14 < clip.width) {
      fill(ctx, clip.x + 3, y - 8, length + textWidth(words) + 9, 12, PANEL);
      fill(ctx, clip.x + 4, y, length, 1, MINT);
      fill(ctx, clip.x + 4, y - 2, 1, 3, MINT);
      fill(ctx, clip.x + 3 + length, y - 2, 1, 3, MINT);
      text(ctx, words, clip.x + 8 + length, y - 6, MINT);
    }
    if (s.caption) {
      const room = clip.width - 26, w = shownWidth(s.caption, room);
      fill(ctx, clip.x + 2, clip.y + 1, w + 4, GLYPH_H + 4, PANEL);
      text(ctx, s.caption, clip.x + 4, clip.y + 3, s.captionLevel === 'warn' ? AMBER : s.captionLevel === 'lit' ? MINT : DIM, {room});
    }
  }
}

/** The view moved by pixels of the painting, as a drag or an arrow key does. */
export function panned(box, s, dx, dy) {
  const {perMetre} = viewTransform(box, s), centre = s.centre || {x: 0, y: 0};
  return {centre: {x: centre.x - dx / perMetre, y: centre.y + dy / perMetre}};
}

/** The view made `factor` times wider or narrower, the ground under a pixel staying where it is. */
export function zoomed(box, s, factor, px, py) {
  const to = viewTransform(box, s), across = clamp(to.across * factor, MAP_LIMITS.least_m, MAP_LIMITS.most_m);
  if (px === undefined) return {across_m: across};
  const held = to.toWorld(px, py), after = viewTransform(box, {...s, across_m: across}).toWorld(px, py), centre = s.centre || {x: 0, y: 0};
  return {across_m: across, centre: {x: centre.x + held.x - after.x, y: centre.y + held.y - after.y}};
}

/** The view that shows a ring whole, with a margin. */
export function fitted(ring, margin = 1.25, least_m = 40) {
  if (!ring?.length) return {centre: {x: 0, y: 0}, across_m: 300};
  const xs = ring.map(p => p.x), ys = ring.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  return {centre: {x: (x0 + x1) / 2, y: (y0 + y1) / 2}, across_m: clamp(Math.max(x1 - x0, y1 - y0, least_m / margin) * margin, MAP_LIMITS.least_m, MAP_LIMITS.most_m)};
}

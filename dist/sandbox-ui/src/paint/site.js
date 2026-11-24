// Layer 5: one element per thing the sandbox makes: a place found, a target, a check of a plan,
// the coverage of a target, a mission, a waypoint, a run being played, and the fence that decides what can be flown.
import {frame, text, fill, hline, outline, triangle, line, circle, inset, part, clamp, number, textWidth, GLYPH_H, LINE} from './primitives.js';
import {MINT, DIM, INK, AMBER, RED, levelColour} from '../palette.js';

const middle = box => box.y + Math.floor((box.height - GLYPH_H) / 2);

/** A place a search found: its name, where it is, and who answered. */
export function place(ctx, box, s = {}) {
  const selected = !!s.selected, ink = selected ? INK : MINT, quiet = selected ? INK : DIM;
  if (selected) fill(ctx, box.x, box.y + 1, box.width, box.height - 2, MINT);
  fill(ctx, box.x + 5, box.y + 4, 1, box.height - 8, ink);
  fill(ctx, box.x + 6, box.y + 4, 6, 4, ink);
  text(ctx, s.name ?? '', box.x + 18, box.y + 3, ink, {room: box.width - 18 - 66});
  text(ctx, s.where ?? '', box.x + 18, box.y + 13, quiet, {room: box.width - 22, upper: false});
  text(ctx, s.source ?? '', box.x + box.width - 4, box.y + 3, quiet, {align: 'right', room: 60});
}

/** A target: its outline, ground and roof, each with where the number came from. A guess is amber and says so. */
export function target(ctx, box, s = {}) {
  text(ctx, s.name ?? 'TARGET', box.x, box.y + 1, MINT, {room: box.width});
  const rows = [['OUTLINE', s.outline], ['GROUND', s.ground, s.groundSource, s.groundGuess], ['ROOF', s.roof, s.roofSource, s.roofGuess], ['SURFACES', s.surfaces]];
  rows.forEach(([key, shown, source, guess], i) => {
    const y = box.y + 13 + i * LINE;
    text(ctx, key, box.x, y, DIM);
    const done = text(ctx, shown ?? '--', box.x + 58, y, guess ? AMBER : MINT, {room: box.width - 58, upper: false});
    if (source) text(ctx, guess ? `${source} (GUESS)` : source, box.x + box.width, y, guess ? AMBER : DIM, {align: 'right', room: box.width - 58 - done.width - 8});
  });
}

/** One finding of the plan's checker: an error (red) or a warning (amber), its code and what it says. */
export function check(ctx, box, s = {}) {
  const kind = s.level === 'error' ? 'error' : 'warn', colour = levelColour(kind), y = middle(box);
  fill(ctx, box.x, y - 1, 9, 9, colour);
  text(ctx, kind === 'error' ? '!' : '?', box.x + 2, y, INK);
  const count = s.count ? `x${s.count}` : '', countRoom = count ? 30 : 0;
  const done = text(ctx, s.code ?? '', box.x + 14, y, colour, {room: Math.floor(box.width / 2)});
  text(ctx, s.message ?? '', box.x + 14 + done.width + 8, y, MINT, {room: box.width - 14 - done.width - 8 - countRoom});
  if (count) text(ctx, count, box.x + box.width, y, DIM, {align: 'right'});
}

/** The four classes of coverage, by fill as well as colour: the display is nearly one colour. */
export const COVERAGE_CLASSES = [
  {key: 'unseen', label: 'NOT SEEN', colour: RED, mark: 'none'},
  {key: 'few', label: 'ONCE OR TWICE', colour: AMBER, mark: 'half'},
  {key: 'three', label: 'THREE OR MORE', colour: MINT, mark: 'dot'},
  {key: 'fine', label: 'THREE AT 5 MM', colour: MINT, mark: 'solid'},
];

function stripe(ctx, x, y, w, h, cls) {
  if (w < 1) return;
  if (cls.mark === 'solid') return fill(ctx, x, y, w, h, cls.colour);
  if (cls.mark === 'half') { for (let i = 0; i < h; i += 2) fill(ctx, x, y + i, w, 1, cls.colour); return; }
  if (cls.mark === 'dot') {
    ctx.fillStyle = cls.colour;
    for (let row = 0; row < h; row += 2) for (let xx = x + ((row >> 1) % 2); xx < x + w; xx += 2) ctx.fillRect(xx, y + row, 1, 1);
    return;
  }
  fill(ctx, x, y + Math.floor(h / 2), w, 1, cls.colour);
}

/** How much of each face of the target the plan's views see: one bar a face, the share seen at its end. */
export function coverage(ctx, box, s = {}) {
  const labelWidth = 34, barX = box.x + labelWidth, barWidth = box.width - labelWidth - 30;
  (s.faces || []).forEach((face, i) => {
    const y = box.y + i * 12;
    if (y + 10 > box.y + box.height) return;
    text(ctx, face.name ?? '', box.x, y + 1, DIM, {room: labelWidth - 4});
    outline(ctx, barX, y, barWidth, 9, DIM);
    const end = barX + barWidth - 1;
    let x = barX + 1;
    for (const cls of COVERAGE_CLASSES) {
      const w = Math.min(Math.round((barWidth - 2) * clamp(Number(face[cls.key]) || 0, 0, 1)), end - x);
      stripe(ctx, x, y + 1, w, 7, cls);
      x += Math.max(0, w);
    }
    const seen = 1 - clamp(Number(face.unseen) || 0, 0, 1);
    text(ctx, `${Math.round(seen * 100)}%`, box.x + box.width, y + 1, seen >= 0.95 ? MINT : seen >= 0.5 ? AMBER : RED, {align: 'right'});
  });
}

/** A mission document: its steps against the most a mission may hold, how long it flies, and what it cannot carry. */
export function mission(ctx, box, s = {}) {
  const selected = !!s.selected, ink = selected ? INK : MINT, quiet = selected ? INK : DIM, y = middle(box);
  if (selected) fill(ctx, box.x, box.y + 1, box.width, box.height - 2, MINT);
  else outline(ctx, box.x, box.y, box.width, box.height, DIM);
  const most = s.most ?? 50, count = s.steps ?? 0;
  const name = text(ctx, s.name ?? 'MISSION', box.x + 6, y, ink, {room: box.width - 12});
  let x = box.x + 6 + name.width + 10;
  const steps = text(ctx, `${count}/${most} STEPS`, x, y, count > most ? RED : ink, {room: box.x + box.width - 6 - x});
  x += steps.width + 10;
  const time = text(ctx, s.time ?? '', x, y, quiet, {room: Math.max(0, box.x + box.width - 6 - x)});
  x += time.width + 10;
  if (s.loss && box.x + box.width - 6 - x > 30) text(ctx, s.loss, box.x + box.width - 6, y, selected ? INK : AMBER, {align: 'right', room: box.x + box.width - 6 - x});
}

/**
 * A waypoint: where it is from home, and where the camera should look.
 * `aimLost` strikes the aim through: today's missions carry no heading and no camera pitch.
 */
export function waypoint(ctx, box, s = {}) {
  const selected = !!s.selected, ink = selected ? INK : MINT, quiet = selected ? INK : DIM, y = middle(box);
  if (selected) fill(ctx, box.x, box.y, box.width, box.height, MINT);
  let x = box.x;
  for (const [shown, width] of [[`#${s.index ?? 0}`, 30], [`E ${number(s.east, 1, true)}`, 56], [`N ${number(s.north, 1, true)}`, 56], [`U ${number(s.up, 1)}`, 44]]) {
    if (x + width > box.x + box.width) break;
    text(ctx, shown, x + 2, y, shown[0] === '#' ? quiet : ink, {room: width - 4});
    x += width;
  }
  const heading = s.heading === undefined ? '---' : String(Math.round(s.heading)).padStart(3, '0');
  const pitch = s.pitch === undefined ? '---' : number(s.pitch, 0, true);
  const room = box.x + box.width - x - 4;
  if (room < 30) return;
  const done = text(ctx, `HDG ${heading}  PIT ${pitch}`, x + 2, y, s.aimLost ? AMBER : ink, {room});
  if (s.aimLost) hline(ctx, x + 2, y + 3, done.width, AMBER);
}

/** Playing a run back: stop, back, play or pause, on, the time and how far through. Names for `held` and `focused`: the key's. */
export function transport(ctx, box, s = {}) {
  const side = box.height;
  transportKeys(box).forEach(({key, x}) => {
    const k = {x, y: box.y, width: side, height: side}, active = s.held === key || (key === 'play' && !!s.playing);
    frame(ctx, k, {active, focused: s.focused === key, hovered: s.hovered === key});
    const cx = k.x + Math.floor(side / 2), cy = k.y + Math.floor(side / 2), ink = active ? INK : MINT;
    if (key === 'stop') fill(ctx, cx - 3, cy - 3, 7, 7, ink);
    else if (key === 'play' && s.playing) { fill(ctx, cx - 3, cy - 4, 2, 9, ink); fill(ctx, cx + 2, cy - 4, 2, 9, ink); }
    else if (key === 'play') triangle(ctx, cx - 2, cy - 4, 'right', 4, ink);
    else if (key === 'previous') { fill(ctx, cx - 5, cy - 4, 1, 9, ink); triangle(ctx, cx - 3, cy - 4, 'left', 4, ink); }
    else { triangle(ctx, cx - 2, cy - 4, 'right', 4, ink); fill(ctx, cx + 4, cy - 4, 1, 9, ink); }
  });
  const x = box.x + 4 * (side + 2) + 4, room = box.x + box.width - x;
  if (room < 40) return;
  text(ctx, `${s.at ?? '00:00'} / ${s.of ?? '00:00'}`, box.x + box.width, box.y + 2, MINT, {align: 'right', room});
  const y = box.y + box.height - 8, share = clamp(Number(s.share) || 0, 0, 1);
  hline(ctx, x, y + 2, room, DIM, true);
  fill(ctx, x, y + 1, Math.round(room * share), 3, MINT);
  fill(ctx, x + Math.round((room - 3) * share), y - 1, 3, 7, MINT);
}

/** Where the four keys of the playback stand: one `{key, x, width}` each, in the box's own pixels. */
export function transportKeys(box) {
  const side = box.height;
  return ['stop', 'previous', 'play', 'next'].map((key, i) => ({key, x: box.x + i * (side + 2), width: side}));
}

/**
 * How a plan's map fits the ground in its box: `centre` (metres, east and north) is the map's middle and
 * `reach` the metres from there to the nearer edge. North is up. Gives the way to pixels and the way back.
 */
export function mapTransform(box, s = {}) {
  const view = inset(box, 2), centre = s.centre || {x: 0, y: 0}, reach = Math.max(1, Number(s.reach) || 40);
  const perMetre = (Math.min(view.width, view.height) / 2 - 2) / reach;
  const cx = view.x + Math.floor(view.width / 2), cy = view.y + Math.floor(view.height / 2);
  return {
    view, perMetre,
    toPixel: (x, y) => [Math.round(cx + (x - centre.x) * perMetre), Math.round(cy - (y - centre.y) * perMetre)],
    toWorld: (px, py) => ({x: centre.x + (px - cx) / perMetre, y: centre.y - (py - cy) / perMetre}),
  };
}

/** A small square mark, painted only when it lies whole inside `clip`. */
function mark(ctx, x, y, size, colour, clip, hollow = false) {
  const left = x - Math.floor(size / 2), top = y - Math.floor(size / 2);
  if (left < clip.x || top < clip.y || left + size > clip.x + clip.width || top + size > clip.y + clip.height) return;
  if (hollow) outline(ctx, left, top, size, size, colour);
  else fill(ctx, left, top, size, size, colour);
}

/** A cross of two diagonal strokes, `reach` pixels from its middle each way. */
function cross(ctx, x, y, reach, colour, clip) {
  line(ctx, x - reach, y - reach, x + reach, y + reach, colour, {clip});
  line(ctx, x - reach, y + reach, x + reach, y - reach, colour, {clip});
}

/**
 * A plan seen from above, north up: the target's outline, what stands round it, home and its fence,
 * the path (scan legs whole, the ways out and back dotted), each view with the way it looks,
 * what the repair moved (amber), what the checks found (red), and the aircraft on a run with its trail.
 * A run under the guard adds what the plan does not know (red), where a sensor met it (lit), the trail
 * dotted red where no sensor looked the way it flew, each stop (a red square), each way round (amber dots),
 * each step left out and a strike (red crosses).
 */
export function planMap(ctx, box, s = {}) {
  outline(ctx, box.x, box.y, box.width, box.height, s.placing ? AMBER : DIM);
  const {view: clip, perMetre, toPixel, toWorld} = mapTransform(box, s);
  if (clip.width < 8 || clip.height < 8) return;
  // A dot every ten metres, so a distance can be read.
  const a = toWorld(clip.x, clip.y + clip.height), b = toWorld(clip.x + clip.width, clip.y);
  ctx.fillStyle = DIM;
  for (let gx = Math.ceil(a.x / 10) * 10; gx <= b.x; gx += 10) {
    for (let gy = Math.ceil(a.y / 10) * 10; gy <= b.y; gy += 10) {
      const [px, py] = toPixel(gx, gy);
      if (px >= clip.x && py >= clip.y && px < clip.x + clip.width && py < clip.y + clip.height) ctx.fillRect(px, py, 1, 1);
    }
  }
  const ring = (points, colour, dotted = false) => points.forEach((p, i) => {
    const q = points[(i + 1) % points.length];
    line(ctx, ...toPixel(p.x, p.y), ...toPixel(q.x, q.y), colour, {clip, dotted});
  });
  if (s.home && s.fence_m) circle(ctx, ...toPixel(s.home.x, s.home.y), s.fence_m * perMetre, s.fenceBroken ? RED : DIM, {clip, dotted: !s.fenceBroken});
  for (const other of s.obstacles || []) ring(other, DIM);
  for (const other of s.unknown || []) {
    ring(other, RED);
    // A pole is under a pixel or two across: a mark round its middle, so it is found.
    const cx = other.reduce((sum, p) => sum + p.x, 0) / other.length, cy = other.reduce((sum, p) => sum + p.y, 0) / other.length;
    const across = Math.max(...other.map(p => Math.hypot(p.x - cx, p.y - cy))) * perMetre;
    if (across < 4) { mark(ctx, ...toPixel(cx, cy), 7, RED, clip, true); mark(ctx, ...toPixel(cx, cy), 3, RED, clip); }
  }
  if (s.outline?.length) ring(s.outline, MINT);
  for (const leg of s.legs || []) {
    const scan = leg.kind === 'scan';
    for (let i = 1; i < leg.points.length; i += 1) {
      line(ctx, ...toPixel(leg.points[i - 1].x, leg.points[i - 1].y), ...toPixel(leg.points[i].x, leg.points[i].y), scan ? MINT : DIM, {clip, dotted: !scan});
    }
    for (const p of leg.points) {
      if (p.heading === undefined) continue;
      // A view: a dot, and a short stroke the way the camera looks (clockwise from north).
      const [px, py] = toPixel(p.x, p.y), r = p.heading * Math.PI / 180;
      line(ctx, px, py, px + Math.sin(r) * 4, py - Math.cos(r) * 4, MINT, {clip});
    }
  }
  for (const p of s.repairs || []) mark(ctx, ...toPixel(p.x, p.y), 5, AMBER, clip, true);
  for (const p of s.problems || []) mark(ctx, ...toPixel(p.x, p.y), 3, RED, clip);
  for (const way of s.ways || []) for (let i = 1; i < way.length; i += 1) line(ctx, ...toPixel(way[i - 1].x, way[i - 1].y), ...toPixel(way[i].x, way[i].y), AMBER, {clip, dotted: true});
  if (s.trail?.length > 1) for (let i = 1; i < s.trail.length; i += 1) {
    const blind = !!s.trail[i].blind;
    line(ctx, ...toPixel(s.trail[i - 1].x, s.trail[i - 1].y), ...toPixel(s.trail[i].x, s.trail[i].y), blind ? RED : AMBER, {clip, dotted: blind});
  }
  ctx.fillStyle = MINT;
  for (const p of s.sensed || []) {
    const [px, py] = toPixel(p.x, p.y);
    if (px >= clip.x && py >= clip.y && px < clip.x + clip.width && py < clip.y + clip.height) ctx.fillRect(px, py, 1, 1);
  }
  for (const p of s.stops || []) mark(ctx, ...toPixel(p.x, p.y), 5, RED, clip, true);
  for (const p of s.leftOut || []) cross(ctx, ...toPixel(p.x, p.y), 2, RED, clip);
  if (s.struck) { const [px, py] = toPixel(s.struck.x, s.struck.y); cross(ctx, px, py, 5, RED, clip); mark(ctx, px, py, 3, RED, clip); }
  if (s.home) {
    const [hx, hy] = toPixel(s.home.x, s.home.y);
    mark(ctx, hx, hy, 5, AMBER, clip, true);
    mark(ctx, hx, hy, 1, AMBER, clip);
  }
  if (s.aircraft) {
    const [px, py] = toPixel(s.aircraft.x, s.aircraft.y);
    line(ctx, px - 4, py, px + 4, py, AMBER, {clip});
    line(ctx, px, py - 4, px, py + 4, AMBER, {clip});
    mark(ctx, px, py, 3, AMBER, clip);
  }
  // North, and ten metres.
  if (clip.width >= 60 && clip.height >= 40) {
    triangle(ctx, clip.x + clip.width - 11, clip.y + 3, 'up', 2, DIM);
    text(ctx, 'N', clip.x + clip.width - 11, clip.y + 9, DIM);
    const ten = Math.max(2, Math.round(10 * perMetre)), y = clip.y + clip.height - 5;
    if (ten + 36 < clip.width) {
      fill(ctx, clip.x + 4, y, ten, 1, DIM);
      fill(ctx, clip.x + 4, y - 2, 1, 3, DIM);
      fill(ctx, clip.x + 3 + ten, y - 2, 1, 3, DIM);
      text(ctx, '10 M', clip.x + 8 + ten, y - 6, DIM);
    }
    if (s.placing) text(ctx, typeof s.placing === 'string' ? s.placing : 'CLICK THE GROUND TO SET HOME', clip.x + 4, clip.y + 3, AMBER, {room: clip.width - 22});
    else if (s.caption) text(ctx, s.caption, clip.x + 4, clip.y + 3, DIM, {room: clip.width - 22});
  }
}

/**
 * The fence round home, seen from above: the circle no waypoint may leave, the building, home,
 * and the farthest waypoint with its distance. Red when it is outside: the plan is then refused whole.
 */
export function fence(ctx, box, s = {}) {
  const size = Math.max(16, Math.min(box.width, box.height - 12)), sq = part(box, Math.floor((box.width - size) / 2), 0, size, size), clip = inset(sq, 1);
  outline(ctx, sq.x, sq.y, size, size, DIM);
  const cx = sq.x + Math.floor(size / 2), cy = sq.y + Math.floor(size / 2);
  const limit = Number(s.limit) || 30, far = Math.max(0, Number(s.farthest) || 0), outside = far > limit, colour = outside ? RED : MINT;
  const perMetre = (size / 2 - 3) / (Math.max(limit, far) * 1.1);
  circle(ctx, cx, cy, limit * perMetre, outside ? RED : DIM, {clip, dotted: !outside});
  const b = s.building;
  if (b) {
    const x0 = cx + (b.east - b.width / 2) * perMetre, x1 = cx + (b.east + b.width / 2) * perMetre;
    const y0 = cy - (b.north + b.depth / 2) * perMetre, y1 = cy - (b.north - b.depth / 2) * perMetre;
    line(ctx, x0, y0, x1, y0, MINT, {clip}); line(ctx, x1, y0, x1, y1, MINT, {clip});
    line(ctx, x1, y1, x0, y1, MINT, {clip}); line(ctx, x0, y1, x0, y0, MINT, {clip});
  }
  const a = (Number(s.bearing) || 0) * Math.PI / 180, fx = Math.round(cx + Math.sin(a) * far * perMetre), fy = Math.round(cy - Math.cos(a) * far * perMetre);
  line(ctx, cx, cy, fx, fy, colour, {clip, dotted: true});
  fill(ctx, clamp(fx - 1, clip.x, clip.x + clip.width - 3), clamp(fy - 1, clip.y, clip.y + clip.height - 3), 3, 3, colour);
  fill(ctx, cx - 1, cy - 1, 3, 3, AMBER);
  text(ctx, `${number(far, 1)} OF ${number(limit, 0)} M`, box.x + Math.floor(box.width / 2), sq.y + size + 3, colour, {align: 'center', room: box.width});
}

const SOURCES = {osm: 'OSM', 'google-3d-tiles': 'GOOGLE 3D', 'google-geocoding': 'GOOGLE', 'own-scan': 'OWN SCAN', synthetic: 'SYNTHETIC'};

/**
 * Where a layer came from: its source in a tag, the terms it came under, and the day it was fetched.
 * Google's is amber: its terms limit what may be kept and made from it. A synthetic one is quiet.
 */
export function provenance(ctx, box, s = {}) {
  const name = s.source ? SOURCES[s.source] || String(s.source).toUpperCase() : '';
  const colour = String(s.source ?? '').startsWith('google') ? AMBER : s.source === 'synthetic' ? DIM : MINT;
  const h = Math.min(box.height, 13), y = box.y + Math.floor((box.height - h) / 2), ty = y + Math.floor((h - GLYPH_H) / 2);
  // No source yet: no tag, only the words.
  const w = name ? Math.min(box.width, textWidth(name) + 10) : -6;
  if (name) {
    outline(ctx, box.x, y, w, h, colour);
    text(ctx, name, box.x + 5, ty, colour, {room: w - 6});
  }
  const when = String(s.when ?? ''), whenRoom = when ? Math.min(textWidth(when), Math.max(0, box.width - w - 12)) : 0;
  text(ctx, s.terms ?? '', box.x + w + 6, ty, DIM, {room: box.width - w - 6 - (whenRoom ? whenRoom + 8 : 0)});
  if (whenRoom) text(ctx, when, box.x + box.width, ty, DIM, {align: 'right', room: whenRoom});
}

// Layer 4: one element per interface of the synthetic sample catalogue, drawn for what the interface carries.
// The catalogue gives each interface a view (value, image, video, raw); these are those views, made for this display.
import {text, fill, hline, vline, outline, triangle, lamp, line, centred, inset, part, clamp, textWidth, number, GLYPH_H, LINE} from './primitives.js';
import {origin} from './readouts.js';
import {MINT, DIM, INK, PANEL, AMBER, RED, THERMAL} from '../palette.js';

const middle = box => box.y + Math.floor((box.height - GLYPH_H) / 2);

/**
 * Roll and pitch as the horizon seen from the aircraft (interfaces `imu`, and `attitude` as proposed).
 * Positive roll banks right, so the horizon's right end rises; positive pitch lifts the nose, so the horizon sinks.
 */
export function attitude(ctx, box, s = {}) {
  const roll = Number(s.roll) || 0, pitch = Number(s.pitch) || 0;
  const size = Math.max(16, Math.min(box.width, box.height - 12)), sq = part(box, Math.floor((box.width - size) / 2), 0, size, size);
  outline(ctx, sq.x, sq.y, size, size, DIM);
  const clip = inset(sq, 2), cx = sq.x + Math.floor(size / 2), cy = sq.y + Math.floor(size / 2);
  const perDegree = size / 60, r = roll * Math.PI / 180;
  const ux = Math.cos(r), uy = -Math.sin(r);   // along the horizon, on the screen
  const nx = -uy, ny = ux;                     // across it, towards the ground
  const at = (along, down) => [cx + ux * along + nx * down, cy + uy * along + ny * down];
  const horizon = pitch * perDegree;
  line(ctx, ...at(-size, horizon), ...at(size, horizon), MINT, {clip});
  for (const mark of [-20, -10, 10, 20]) {
    const down = horizon - mark * perDegree, half = mark % 20 === 0 ? 10 : 6;
    line(ctx, ...at(-half, down), ...at(half, down), DIM, {clip, dotted: mark < 0});
  }
  // The aircraft itself stays where it is.
  fill(ctx, cx - 14, cy, 9, 1, AMBER);
  fill(ctx, cx + 6, cy, 9, 1, AMBER);
  fill(ctx, cx - 1, cy - 1, 3, 3, AMBER);
  vline(ctx, cx, clip.y, 3, DIM);
  triangle(ctx, clamp(Math.round(cx + roll * size / 120), clip.x + 3, clip.x + clip.width - 4) - 3, clip.y, 'down', 3, MINT);
  const y = sq.y + size + 3, half = Math.floor(box.width / 2);
  text(ctx, `R ${number(roll, 1, true)}`, box.x, y, MINT, {room: half});
  text(ctx, `P ${number(pitch, 1, true)}`, box.x + box.width, y, MINT, {align: 'right', room: half});
}

const CARDINAL = {0: 'N', 90: 'E', 180: 'S', 270: 'W'};

/** The heading on a tape that slides under a fixed pointer: clockwise from north, 0 to below 360. */
export function heading(ctx, box, s = {}) {
  const value = (((Number(s.value) || 0) % 360) + 360) % 360;
  const cx = box.x + Math.floor(box.width / 2), perDegree = box.width / 90, base = box.y + box.height - 1;
  hline(ctx, box.x, base, box.width, DIM);
  for (let deg = Math.ceil((value - 45) / 5) * 5; deg <= value + 45; deg += 5) {
    const x = Math.round(cx + (deg - value) * perDegree), norm = ((deg % 360) + 360) % 360;
    if (x < box.x || x >= box.x + box.width) continue;
    const major = norm % 30 === 0, tall = major ? 6 : norm % 10 === 0 ? 4 : 2;
    vline(ctx, x, base - tall, tall, major ? MINT : DIM);
    if (!major) continue;
    const name = CARDINAL[norm] ?? String(norm).padStart(3, '0'), w = textWidth(name);
    if (x - Math.ceil(w / 2) >= box.x && x + Math.ceil(w / 2) < box.x + box.width) text(ctx, name, x, base - 15, CARDINAL[norm] ? MINT : DIM, {align: 'center'});
  }
  const shown = `${String(Math.round(value) % 360).padStart(3, '0')}°`, w = textWidth(shown) + 8, left = cx - Math.floor(w / 2);
  fill(ctx, left, box.y, w, 11, PANEL);
  outline(ctx, left, box.y, w, 11, MINT);
  text(ctx, shown, left + 4, box.y + 2, MINT);
  triangle(ctx, cx - 2, box.y + 11, 'down', 2, MINT);
}

/** A height on a tape that slides past a fixed box (interface `height`, as proposed): metres, up positive. */
export function altitude(ctx, box, s = {}) {
  const value = Number(s.value) || 0, span = s.span || 20, perMetre = box.height / span;
  const cy = box.y + Math.floor(box.height / 2), right = box.x + box.width - 1;
  vline(ctx, right, box.y, box.height, DIM);
  for (let m = Math.ceil(value - span / 2); m <= Math.floor(value + span / 2); m += 1) {
    const y = Math.round(cy - (m - value) * perMetre);
    if (y < box.y || y >= box.y + box.height) continue;
    const major = m % 5 === 0;
    hline(ctx, right - (major ? 6 : 3), y, major ? 6 : 3, major ? MINT : DIM);
    if (major && y - 3 >= box.y && y + 4 < box.y + box.height) text(ctx, String(m), right - 9, y - 3, DIM, {align: 'right', room: box.width - 10});
  }
  const shown = number(value, 1), unit = s.unit ?? 'm';
  const w = Math.min(box.width - 4, textWidth(shown) + textWidth(unit) + 12);
  fill(ctx, box.x, cy - 6, w, 13, PANEL);
  outline(ctx, box.x, cy - 6, w, 13, MINT);
  const done = text(ctx, shown, box.x + 4, cy - 3, MINT, {room: w - 8});
  text(ctx, unit, box.x + 4 + done.width + 3, cy - 3, DIM, {room: w - 8 - done.width - 3, upper: false});
  triangle(ctx, box.x + w, cy - 2, 'right', 2, MINT);
}

/** A place on Earth and how good the fix is (interface `position.geo`, as proposed). */
export function position(ctx, box, s = {}) {
  [['LAT', s.latitude], ['LON', s.longitude], ['ALT', s.altitude]].forEach(([key, shown], i) => {
    text(ctx, key, box.x, box.y + 1 + i * LINE, DIM);
    text(ctx, shown ?? '--', box.x + 26, box.y + 1 + i * LINE, MINT, {room: box.width - 26 - 44, upper: false});
  });
  // DJI's GPS level, 0 to 5: flight needs 3 or more.
  const fix = clamp(Math.round(Number(s.fix) || 0), 0, 5), good = fix >= 3, x0 = box.x + box.width - 28;
  for (let i = 0; i < 5; i += 1) {
    const h = 3 + i * 2;
    if (i < fix) fill(ctx, x0 + i * 6, box.y + 12 - h, 4, h, good ? MINT : AMBER);
    else outline(ctx, x0 + i * 6, box.y + 12 - h, 4, h, DIM);
  }
  text(ctx, `FIX ${fix}`, box.x + box.width, box.y + 16, good ? MINT : AMBER, {align: 'right'});
  if (s.satellites !== undefined) text(ctx, `${s.satellites} SAT`, box.x + box.width, box.y + 26, DIM, {align: 'right'});
}

/** What is left in the batteries, with the two limits marked: the reserve and the least to start (interface `battery`, as proposed). */
export function battery(ctx, box, s = {}) {
  const percent = clamp(Number(s.percent) || 0, 0, 100), reserve = s.reserve ?? 20, start = s.start ?? 30;
  const colour = percent <= reserve ? RED : percent <= start ? AMBER : MINT;
  const shown = `${Math.round(percent)}%${s.volts === undefined ? '' : `  ${number(s.volts, 1)} V`}`, room = textWidth(shown) + 8;
  const h = Math.min(box.height - 4, 15), y = box.y + Math.floor((box.height - h) / 2), w = box.width - room - 4;
  outline(ctx, box.x, y, w, h, DIM);
  fill(ctx, box.x + w, y + 4, 2, h - 8, DIM);
  const step = Math.floor((w - 3) / 10), lit = Math.ceil(percent / 10);
  for (let i = 0; i < lit; i += 1) fill(ctx, box.x + 2 + i * step, y + 2, step - 1, h - 4, colour);
  for (const limit of [reserve, start]) fill(ctx, box.x + 2 + Math.round((w - 4) * limit / 100), y - 2, 1, 2, AMBER);
  text(ctx, shown, box.x + box.width, y + Math.floor((h - GLYPH_H) / 2), colour, {align: 'right', upper: false});
}

/** One gimbal's pitch as a needle, and its three angles (interface `gimbal.attitude`). */
export function gimbal(ctx, box, s = {}) {
  const side = Math.min(box.height, box.width), sq = part(box, 0, 0, side, side), clip = inset(sq, 1);
  outline(ctx, sq.x, sq.y, side, side, DIM);
  const px = sq.x + Math.floor(side / 4), py = sq.y + Math.floor(side / 3), reach = Math.floor(side * 0.6);
  hline(ctx, px, py, reach, DIM, true);
  const a = (Number(s.pitch) || 0) * Math.PI / 180;   // looking down is negative
  line(ctx, px, py, px + Math.cos(a) * reach, py - Math.sin(a) * reach, MINT, {clip});
  fill(ctx, px - 1, py - 1, 3, 3, AMBER);
  const x = box.x + side + 8, room = box.width - side - 8;
  text(ctx, s.name ?? 'GIMBAL', x, box.y + 1, DIM, {room});
  [['PIT', s.pitch], ['YAW', s.yaw], ['ROL', s.roll]].forEach(([key, shown], i) =>
    text(ctx, `${key} ${number(shown ?? 0, 1, true)}°`, x, box.y + 12 + i * LINE, MINT, {room}));
}

/** A thermal camera's spot and area temperatures over the ramp of its colours (interface `thermal.spot`). */
export function thermal(ctx, box, s = {}) {
  text(ctx, s.caption ?? 'SPOT', box.x, box.y + 1, DIM, {room: box.width});
  const done = text(ctx, number(s.spot, 1), box.x, box.y + 11, MINT, {scale: 2});
  text(ctx, '°C', box.x + done.width + 4, box.y + 18, DIM);
  text(ctx, `AREA ${number(s.min, 1)} TO ${number(s.max, 1)}`, box.x + box.width, box.y + 18, DIM, {align: 'right', room: box.width - done.width - 24});
  // The ramp: one colour for each display pixel.
  const y = box.y + box.height - 7, w = box.width;
  for (let i = 0; i < w; i += 1) {
    const p = i / Math.max(1, w - 1) * (THERMAL.length - 1), k = Math.min(THERMAL.length - 2, Math.floor(p)), mix = p - k;
    const colour = THERMAL[k].map((channel, axis) => Math.round(channel + (THERMAL[k + 1][axis] - channel) * mix));
    fill(ctx, box.x + i, y, 1, 5, `rgb(${colour.join(',')})`);
  }
  const spot = Number(s.spot), low = Number(s.low ?? s.min), high = Number(s.high ?? s.max);
  if (![spot, low, high].every(Number.isFinite)) return;   // nothing measured yet: the ramp alone
  const at = box.x + Math.round((w - 1) * clamp((spot - low) / Math.max(1e-9, high - low), 0, 1));
  triangle(ctx, clamp(at - 2, box.x, box.x + w - 5), y - 4, 'down', 2, MINT);
}

/**
 * A picture or a video stream (interfaces `image.jpeg`, `image.raw`, `video.h264`, `dji.video-frame`):
 * its name, where it comes from, the frame the picture goes in, and its size, rate and encoding.
 * The frame holds a quiet weave, never a made-up scene.
 */
export function picture(ctx, box, s = {}) {
  const head = 12, foot = 11, view = part(box, 0, head, box.width, box.height - head - foot), clip = inset(view, 1);
  const lost = s.signal === false;
  text(ctx, s.name ?? 'CAMERA', box.x, box.y + 2, MINT, {room: box.width - 54});
  origin(ctx, part(box, box.width - 52, 0, 52, 11), {origin: s.origin, align: 'right'});
  outline(ctx, view.x, view.y, view.width, view.height, lost ? RED : DIM);
  if (lost) {
    centred(ctx, 'NO SIGNAL', view, RED);
  } else {
    for (let d = -view.height; d < view.width; d += 16) line(ctx, view.x + d, view.y + view.height - 1, view.x + d + view.height, view.y, DIM, {clip, dotted: true});
    const cx = view.x + Math.floor(view.width / 2), cy = view.y + Math.floor(view.height / 2);
    fill(ctx, cx - 5, cy, 11, 1, MINT);
    fill(ctx, cx, cy - 5, 1, 11, MINT);
  }
  for (const [right, bottom] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = view.x + (right ? view.width - 8 : 2), y = view.y + (bottom ? view.height - 3 : 2);
    fill(ctx, x, y, 6, 1, MINT);
    fill(ctx, right ? x + 5 : x, bottom ? y - 5 : y, 1, 6, MINT);
  }
  const y = box.y + box.height - 8;
  text(ctx, [s.size, s.rate, s.encoding].filter(Boolean).join('  '), box.x, y, DIM, {room: box.width - 44});
  if (s.kind === 'video') {
    lamp(ctx, box.x + box.width - 35, y, 7, !lost, lost ? RED : MINT);
    text(ctx, 'LIVE', box.x + box.width, y, lost ? RED : MINT, {align: 'right'});
  } else {
    text(ctx, 'STILL', box.x + box.width, y, DIM, {align: 'right'});
  }
}

/** Frames nobody reads by eye (interface `duml.raw`): that they flow, how many, how fast, and the last bytes. */
export function raw(ctx, box, s = {}) {
  const y = middle(box);
  outline(ctx, box.x, y - 3, 25, 13, DIM);
  text(ctx, 'RAW', box.x + 4, y, DIM);
  const done = text(ctx, `${s.name ?? ''}  ${s.count ?? 0} FR  ${number(s.rate, 1)} HZ`, box.x + 31, y, MINT, {room: box.width - 31});
  const left = box.width - 31 - done.width - 10;
  if (left > 30 && s.bytes) text(ctx, s.bytes, box.x + box.width, y, DIM, {align: 'right', room: left});
}

/** The operator's heartbeat and who holds control (interface `heartbeat.operator`). `state`: 'held', 'other' or 'lost'. */
export function lease(ctx, box, s = {}) {
  const state = s.state || 'held', colour = state === 'held' ? MINT : state === 'other' ? AMBER : RED, y = middle(box);
  const words = {held: 'IN CONTROL', other: 'ANOTHER HOLDS CONTROL', lost: 'NO HEARTBEAT'}[state] || 'NO HEARTBEAT';
  lamp(ctx, box.x + 1, y, 7, state === 'held' && s.beat !== false, colour);
  const age = s.age === undefined ? '' : `${number(s.age, 1)} S`, ageRoom = age ? textWidth(age) + 8 : 0;
  // Where there is little room the state is said alone: it is what matters.
  const named = box.width >= 67 + textWidth(words) + ageRoom, x = box.x + (named ? 67 : 13);
  if (named) text(ctx, 'OPERATOR', box.x + 13, y, DIM);
  text(ctx, words, x, y, colour, {room: box.x + box.width - x - ageRoom});
  if (age) text(ctx, age, box.x + box.width, y, state === 'held' ? DIM : colour, {align: 'right'});
}

/** A line of text with the time it came (interface `text`). */
export function textline(ctx, box, s = {}) {
  const y = middle(box), done = s.time ? text(ctx, s.time, box.x, y, DIM, {room: box.width}) : {width: -6};
  text(ctx, s.text ?? '', box.x + done.width + 6, y, MINT, {room: box.width - done.width - 6, upper: false});
}

/** Which payload camera the downlink shows (interface `camera.link`). */
export function cameraLink(ctx, box, s = {}) {
  const names = s.cameras?.length ? s.cameras : ['XT2', 'Z30'], shown = clamp(Number(s.shown) || 0, 0, names.length - 1), y = middle(box);
  text(ctx, 'DOWNLINK', box.x, y, DIM, {room: box.width});
  let x = box.x + 54;
  names.forEach((name, i) => {
    const w = textWidth(name) + 12;
    if (x + w > box.x + box.width) return;
    if (i === shown) { fill(ctx, x, y - 3, w, 13, MINT); text(ctx, name, x + 6, y, INK); }
    else { outline(ctx, x, y - 3, w, 13, DIM); text(ctx, name, x + 6, y, DIM); }
    x += w + 4;
  });
  if (s.mode && box.x + box.width - x > 30) text(ctx, s.mode, box.x + box.width, y, DIM, {align: 'right', room: box.x + box.width - x - 4});
}

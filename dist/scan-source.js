// Point sources for the hologram projector: a scanned monument (assets/scans/*.bin, written by
// tools/import-obj-scan.mjs) or a SLAM replay (mcap-replay.js), fitted under the projector the
// way the city map is, with metres kept in proportion. A monument also brings its real outline
// (OpenStreetMap, from scan-sites.js) and a drone orbit round it for flight-plan tests.

/** Fits under the projector: the footprint about 1.3 stage units across, at most 1.6 tall. */
const FOOTPRINT = 1.3, HEIGHT = 1.6;

/** Reads a scan file: {count, metresPerUnit, min, max, positions (metres, x east, y up, z south), colors}. */
export function parseScanFile(buffer) {
  const bytes = buffer instanceof ArrayBuffer ? buffer : buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const view = new DataView(bytes);
  if (new TextDecoder().decode(new Uint8Array(bytes, 0, 4)) !== 'PHSC' || view.getUint32(4, true) !== 1) throw new Error('Not a Phosphor scan file (PHSC, version 1).');
  const count = view.getUint32(8, true), floats = i => view.getFloat32(i, true);
  return {
    count, metresPerUnit: floats(12), min: [floats(16), floats(20), floats(24)], max: [floats(28), floats(32), floats(36)],
    positions: new Float32Array(bytes, 40, count * 3), colors: new Uint8Array(bytes, 40 + count * 12, count * 3),
  };
}

/** The scale and shift that put a box of metres under the projector centred at `centre` {x, z}. */
export function stageFit(min, max, centre = {x: 0, z: 0}) {
  const across = Math.max(max[0] - min[0], max[2] - min[2], 1e-3), tall = Math.max(max[1] - min[1], 1e-3);
  const s = Math.min(FOOTPRINT / across, HEIGHT / tall);
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2, floor = min[1];
  return {s, apply: (x, y, z) => [(x - cx) * s + centre.x, (y - floor) * s, (z - cz) * s + centre.z], invert: (x, y, z) => [(x - centre.x) / s + cx, y / s + floor, (z - centre.z) / s + cz], metresPerStageUnit: 1 / s};
}

/** Copies points into stage units. */
function toStage(positions, count, fit) {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const [x, y, z] = fit.apply(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
    out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
  }
  return out;
}

/** A drone orbit round a footprint: just outside it, at two thirds of the height. */
function orbitFor(min, max, fit, centre) {
  const half = Math.hypot(max[0] - min[0], max[2] - min[2]) / 2 * fit.s;
  return {center: [centre.x, centre.z], radius: half * 1.15, height: (max[1] - min[1]) * fit.s * 0.66};
}

/** A monument as a point source; `site` is its SCAN_SITES entry. */
export function monumentSource(scan, site, centre) {
  const fit = stageFit(scan.min, scan.max, centre);
  const [oe, on] = site.location.scanOrigin;
  // The OSM outline is in metres east and north of its centre; the scan's origin sits at (oe, on).
  const outline = site.location.outline.map(([e, n]) => { const [x, , z] = fit.apply(e - oe, 0, -(n - on)); return [x, z]; });
  const {latitude, longitude} = site.location, perLat = 111320, perLon = perLat * Math.cos(latitude * Math.PI / 180);
  // Stage back to the real site: scan metres, then east and north of the outline's centre, then degrees.
  const toLonLat = (x, z) => { const [sx, , sz] = fit.invert(x, 0, z), east = sx + oe, north = -sz + on; return [longitude + east / perLon, latitude + north / perLat]; };
  return {positions: toStage(scan.positions, scan.count, fit), colors: scan.colors, count: scan.count, label: `${site.sceneTitle} / ${site.place}`, outline, orbit: orbitFor(scan.min, scan.max, fit, centre), fit, toLonLat, metresPerUnit: 1 / fit.s};
}

/** A SLAM replay as a point source; `count` grows as the replay plays. */
export function replaySource(replay, centre, name = 'SLAM REPLAY') {
  const n = replay.pointCount, min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n * 3; i += 1) { const a = i % 3, v = replay.positions[i]; if (v < min[a]) min[a] = v; if (v > max[a]) max[a] = v; }
  // The robust bounds keep stray far points from shrinking the scene; the floor is the real lowest point.
  const lo = [replay.bounds.min[0], min[1], replay.bounds.min[2]], hi = [replay.bounds.max[0], replay.bounds.max[1], replay.bounds.max[2]];
  const fit = stageFit(lo, hi, centre);
  // A replay has no place on Earth: its marker shows no latitude or longitude.
  return {positions: toStage(replay.positions, n, fit), colors: replay.colors, count: replay.frames.length ? replay.frames[0].end : 0, label: name.toUpperCase(), orbit: orbitFor(lo, hi, fit, centre), fit, toLonLat: () => [NaN, NaN], metresPerUnit: 1 / fit.s};
}

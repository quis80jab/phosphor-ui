#!/usr/bin/env node
// Turns a scanned mesh (.obj, y up) into the viewer's point scan file: points sampled over the
// surface in proportion to area, scaled so the scan stands at a given real height in metres,
// centred on its footprint with its lowest point on the ground, and shaded by the direction each
// surface faces (the published Funes models carry no texture). Deterministic: the same input
// gives the same bytes.
//
//   node tools/import-obj-scan.mjs <in.obj> <out.bin> --height-m 21 [--yaw-deg -12] [--points 300000]
//
// --yaw-deg turns the scan counter-clockwise seen from above, so that +x is east and -z north,
// as the viewer's map stage has them.
//
// File: "PHSC" | u32 version 1 | u32 count | f32 metresPerUnit | f32 min[3] | f32 max[3]
//       | f32 xyz * count (metres, y up) | u8 rgb * count
import {readFileSync, writeFileSync} from 'node:fs';

const [input, output, ...rest] = process.argv.slice(2);
const flag = (name, fallback) => { const i = rest.indexOf(name); return i >= 0 ? Number(rest[i + 1]) : fallback; };
if (!input || !output) { console.error('usage: import-obj-scan.mjs <in.obj> <out.bin> --height-m <metres> [--points N]'); process.exit(2); }
const heightM = flag('--height-m', NaN), wanted = flag('--points', 300000), yaw = flag('--yaw-deg', 0) * Math.PI / 180;
if (!(heightM > 0)) { console.error('--height-m is required: the real height of the object, in metres'); process.exit(2); }

const vertices = [], faces = [];
for (const line of readFileSync(input, 'utf8').split('\n')) {
  if (line.startsWith('v ')) { const [, x, y, z] = line.trim().split(/\s+/); vertices.push(+x, +y, +z); }
  else if (line.startsWith('f ')) {
    const ids = line.trim().split(/\s+/).slice(1).map(token => { const k = parseInt(token, 10); return k < 0 ? vertices.length / 3 + k : k - 1; });
    for (let i = 1; i + 1 < ids.length; i += 1) faces.push(ids[0], ids[i], ids[i + 1]);
  }
}
const n = faces.length / 3;

// Triangle areas, cumulative, for sampling in proportion to area.
const cumulative = new Float64Array(n);
let total = 0;
const at = k => [vertices[k * 3], vertices[k * 3 + 1], vertices[k * 3 + 2]];
for (let t = 0; t < n; t += 1) {
  const a = at(faces[t * 3]), b = at(faces[t * 3 + 1]), c = at(faces[t * 3 + 2]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  total += Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]) / 2;
  cumulative[t] = total;
}
let seed = 0x9e3779b9;
const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };

const count = wanted, xyz = new Float32Array(count * 3), rgb = new Uint8Array(count * 3);
const light = [0.45, 0.8, 0.4], ln = Math.hypot(...light);
for (let i = 0; i < count; i += 1) {
  const r = random() * total;
  let lo = 0, hi = n - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (cumulative[mid] < r) lo = mid + 1; else hi = mid; }
  const a = at(faces[lo * 3]), b = at(faces[lo * 3 + 1]), c = at(faces[lo * 3 + 2]);
  let s = random(), t = random(); if (s + t > 1) { s = 1 - s; t = 1 - t; }
  for (let axis = 0; axis < 3; axis += 1) xyz[i * 3 + axis] = a[axis] + s * (b[axis] - a[axis]) + t * (c[axis] - a[axis]);
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], len = Math.hypot(...normal) || 1;
  const lambert = Math.abs(normal[0] * light[0] + normal[1] * light[1] + normal[2] * light[2]) / len / ln;
  const shade = 0.35 + 0.65 * lambert, stone = [214, 204, 186];
  for (let axis = 0; axis < 3; axis += 1) rgb[i * 3 + axis] = Math.round(stone[axis] * shade);
}

// Scale so the sampled surface (not stray vertices or slivers) stands heightM tall.
let minY = Infinity, maxY = -Infinity;
for (let i = 1; i < count * 3; i += 3) { minY = Math.min(minY, xyz[i]); maxY = Math.max(maxY, xyz[i]); }
const scale = heightM / (maxY - minY);
for (let i = 0; i < count * 3; i += 1) xyz[i] *= scale;
// Heading: in the (east, north) = (x, -z) plane, turn by yaw counter-clockwise.
if (yaw) for (let i = 0; i < count; i += 1) {
  const e = xyz[i * 3], north = -xyz[i * 3 + 2], c = Math.cos(yaw), s = Math.sin(yaw);
  xyz[i * 3] = e * c - north * s; xyz[i * 3 + 2] = -(e * s + north * c);
}

// Centre on the footprint, lowest point on the ground.
const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < count * 3; i += 1) { min[i % 3] = Math.min(min[i % 3], xyz[i]); max[i % 3] = Math.max(max[i % 3], xyz[i]); }
const shift = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
for (let i = 0; i < count * 3; i += 1) xyz[i] -= shift[i % 3];
for (let axis = 0; axis < 3; axis += 1) { min[axis] -= shift[axis]; max[axis] -= shift[axis]; }

const head = new ArrayBuffer(4 + 4 + 4 + 4 + 24), view = new DataView(head);
new Uint8Array(head).set(new TextEncoder().encode('PHSC'));
view.setUint32(4, 1, true); view.setUint32(8, count, true); view.setFloat32(12, scale, true);
[...min, ...max].forEach((value, i) => view.setFloat32(16 + i * 4, value, true));
writeFileSync(output, Buffer.concat([Buffer.from(head), Buffer.from(xyz.buffer), Buffer.from(rgb.buffer)]));
console.log(`${output}: ${count} points from ${n} triangles; ${(max[0] - min[0]).toFixed(1)} x ${(max[1] - min[1]).toFixed(1)} x ${(max[2] - min[2]).toFixed(1)} m`);

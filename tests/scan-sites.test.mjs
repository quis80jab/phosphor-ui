// Scanned monuments under the hologram projector: the scan files, their placement on the real site
// (OpenStreetMap outline, latitude and longitude), and the point cells the projector lights.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {SCAN_SITES} from '../dist/scan-sites.js';
import {parseScanFile, monumentSource, stageFit} from '../dist/scan-source.js';
import {buildPointVoxels} from '../dist/hologram-voxels.js';

const here = file => new URL(file, import.meta.url);
const metresBetween = ([lon1, lat1], [lon2, lat2]) => Math.hypot((lon1 - lon2) * 111320 * Math.cos(lat1 * Math.PI / 180), (lat1 - lat2) * 111320);

test('each monument names its source, authors and licence, and stands on its real site', () => {
  for (const site of Object.values(SCAN_SITES)) {
    assert.ok(site.author && site.sourceUrl.startsWith('https://funes.world/') && site.license === 'CC BY-NC 4.0', `${site.id}: credited`);
    assert.ok(site.location.osmWay > 0 && site.location.outline.length >= 4, `${site.id}: has its OSM outline`);
    assert.deepEqual(site.fit.axisDeg.scan, site.fit.axisDeg.osm, `${site.id}: turned onto the outline's axis`);
  }
  assert.ok(Math.abs(SCAN_SITES['arch-of-constantine'].location.latitude - 41.8898) < 0.001, 'the Arch is in Rome');
  assert.ok(Math.abs(SCAN_SITES['cologne-cathedral'].location.latitude - 50.9413) < 0.001, 'the Cathedral is in Cologne');
});

/** Eight synthetic corner points exercise the PHSC format without redistributing a scan. */
function scanFixture(site) {
  const [oe, on] = site.location.scanOrigin;
  const xs = site.location.outline.map(([x]) => x - oe), zs = site.location.outline.map(([, y]) => -(y - on));
  const min = [Math.min(...xs), 0, Math.min(...zs)], max = [Math.max(...xs), site.fit.heightM, Math.max(...zs)];
  const count = 8, buffer = new ArrayBuffer(40 + count * 15), view = new DataView(buffer);
  new Uint8Array(buffer).set(new TextEncoder().encode('PHSC'));
  view.setUint32(4, 1, true); view.setUint32(8, count, true); view.setFloat32(12, 1, true);
  [...min, ...max].forEach((v, i) => view.setFloat32(16 + i * 4, v, true));
  const points = new Float32Array(buffer, 40, count * 3), colors = new Uint8Array(buffer, 40 + count * 12, count * 3);
  for (let i = 0; i < count; i++) {
    points.set([i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]], i * 3);
    colors.set([32 + i, 160, 224], i * 3);
  }
  return buffer;
}

test('synthetic scan files retain bounds, positions, colours and fitted height', () => {
  for (const site of Object.values(SCAN_SITES)) {
    const scan = parseScanFile(scanFixture(site));
    assert.equal(scan.count, 8);
    assert.equal(scan.metresPerUnit, 1);
    assert.ok(Math.abs(scan.max[1] - scan.min[1] - site.fit.heightM) < 0.05);
    assert.equal(scan.min[1], 0);
    assert.deepEqual([...scan.positions.slice(0, 3)], scan.min);
    assert.deepEqual([...scan.positions.slice(-3)], scan.max);
    assert.deepEqual([...scan.colors.slice(0, 3)], [32, 160, 224]);
    assert.deepEqual([...scan.colors.slice(-3)], [39, 160, 224]);
  }
});

test('the scan decoder rejects incompatible magic and version', () => {
  const site = Object.values(SCAN_SITES)[0], badMagic = scanFixture(site), badVersion = scanFixture(site);
  new Uint8Array(badMagic)[0] = 0;
  new DataView(badVersion).setUint32(4, 2, true);
  assert.throws(() => parseScanFile(badMagic), /Not a Phosphor scan/);
  assert.throws(() => parseScanFile(badVersion), /Not a Phosphor scan/);
});

test('optional real scan files, when installed, match their declared fitted height', t => {
  const installed = Object.values(SCAN_SITES).filter(site => existsSync(here(`../dist/${site.file.slice(2)}`)));
  if (!installed.length) return t.skip('Optional third-party scan payloads are not distributed; the decoder and placement are tested with synthetic PHSC data.');
  for (const site of installed) {
    const scan = parseScanFile(readFileSync(here(`../dist/${site.file.slice(2)}`)));
    assert.equal(scan.count, 300000);
    assert.ok(Math.abs(scan.max[1] - scan.min[1] - site.fit.heightM) < 0.05, `${site.id}: ${site.fit.heightM} m tall`);
    assert.equal(scan.min[1], 0, 'standing on the ground');
  }
});

test('on the stage a monument keeps its place: centre back to its real latitude and longitude, outline and orbit under the projector', () => {
  const centre = {x: -0.6, z: 0};
  for (const site of Object.values(SCAN_SITES)) {
    const scan = parseScanFile(scanFixture(site)), source = monumentSource(scan, site, centre);
    const [oe, on] = site.location.scanOrigin, back = source.toLonLat(...source.fit.apply(-oe, 0, on).filter((_, i) => i !== 1));
    assert.ok(metresBetween(back, [site.location.longitude, site.location.latitude]) < 0.01, `${site.id}: the outline centre maps back to the site`);
    assert.ok(metresBetween(source.toLonLat(centre.x, centre.z), [site.location.longitude, site.location.latitude]) < 30, `${site.id}: the scan centre is on the site`);
    for (const [x, z] of source.outline) assert.ok(Math.hypot(x - centre.x, z - centre.z) < 1.3, `${site.id}: outline under the projector`);
    assert.ok(source.orbit.radius > 0.3 && source.orbit.radius < 1.3 && source.orbit.height > 0, `${site.id}: the drone orbit circles it`);
  }
});

test('a stage fit keeps metres in proportion and fits the footprint', () => {
  const fit = stageFit([-10, 0, -5], [10, 8, 5]);
  assert.ok(Math.abs(fit.s - 1.3 / 20) < 1e-12);
  assert.deepEqual(fit.invert(...fit.apply(3, 4, -2)).map(v => +v.toFixed(9)), [3, 4, -2]);
});

test('point cells: the mean colour of their points, tops marked as edges, coarsened to fit the budget', () => {
  const positions = [], colors = [];
  for (let x = 0; x < 10; x += 1) for (let y = 0; y < 10; y += 1) { positions.push(x * 0.1 + 0.05, y * 0.1 + 0.05, 0.05); colors.push(200, 100, x < 5 ? 0 : 255); }
  const cells = buildPointVoxels({positions: new Float32Array(positions), colors: new Uint8Array(colors)}, {cellSize: 0.1});
  assert.equal(cells.count, 100);
  assert.equal(cells.edges.reduce((n, v) => n + v, 0), 10, 'one top cell a column');
  assert.ok(Math.abs(cells.colors[0] - 200 / 255) < 1e-6);
  const coarse = buildPointVoxels({positions: new Float32Array(positions), colors: new Uint8Array(colors)}, {cellSize: 0.1, maxCells: 30});
  assert.ok(coarse.count <= 30 && coarse.coarsened);
});

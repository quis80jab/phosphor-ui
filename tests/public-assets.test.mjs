import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, statSync, existsSync} from 'node:fs';
import {isCaptureAvailable, OPTIONAL_CAPTURE_IDS} from '../dist/public-assets.js';
import {IMPORTED_SCENES} from '../dist/imported-scenes.js';
import {SCAN_SITES} from '../dist/scan-sites.js';

const file = path => new URL(`../dist/${path}`, import.meta.url);

test('every enabled packaged capture has its complete payload', () => {
  for (const [id, scene] of Object.entries(IMPORTED_SCENES)) {
    if (!isCaptureAvailable(id)) continue;
    const manifest = JSON.parse(readFileSync(file(`assets/${scene.assetPrefix}-splats.json`), 'utf8'));
    for (const chunk of manifest.chunks) assert.equal(statSync(file(`assets/${chunk.url}`)).size, chunk.bytes);
    assert.equal(manifest.chunks.reduce((sum, c) => sum + c.bytes, 0), manifest.compressedBytes);
    assert.ok(existsSync(file(`assets/${scene.assetPrefix}-license.txt`)), 'capture attribution is included');
  }
  for (const [id, scene] of Object.entries(SCAN_SITES)) {
    if (isCaptureAvailable(id)) assert.ok(existsSync(file(scene.file)), `${id}: enabled scan file exists`);
  }
});

test('optional capture list names known scenes, and the local recording importer stays available', () => {
  assert.equal(new Set(OPTIONAL_CAPTURE_IDS).size, OPTIONAL_CAPTURE_IDS.length);
  for (const id of OPTIONAL_CAPTURE_IDS) assert.ok(Object.hasOwn(IMPORTED_SCENES, id) || Object.hasOwn(SCAN_SITES, id));
  for (const id of ['calibration', 'surface', 'thermal', 'sf-waterfront', 'mcap-replay', 'pumpkin']) assert.ok(isCaptureAvailable(id));
  assert.equal(existsSync(file('assets/replay/tank-test.mcap')), false, 'no private recording is distributed');
  const html = readFileSync(file('viewer.html'), 'utf8');
  assert.match(html, /id="open-mcap"/);
  assert.doesNotMatch(html, /load-tank-test/);
});

// Records what today's designer preview paints for the owner's saved layout, so the demo adapter can
// be held to it: node tools/record-designer-fixture.mjs
// It imports today's two preview modules directly (designer-elements.js and designer-topology.js),
// runs tests/helpers/designer-sequence.mjs over handoff/designer/owner-base.flow-design.json, and
// writes tests/fixtures/designer-demo.json. Run it only from code those two files have not changed in.
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {normalizeDesign} from '../dist/blank-state.js';
import * as elements from '../dist/designer-elements.js';
import * as topology from '../dist/designer-topology.js';
import {runSequence} from '../tests/helpers/designer-sequence.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = normalizeDesign(JSON.parse(await readFile(path.join(root, 'handoff/designer/owner-base.flow-design.json'), 'utf8')));
const sourceHash = async file => createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
const result = runSequence(base, elements, topology);
const fixture = {
  format: 'designer-demo-fixture', version: 1,
  source: {'dist/designer-elements.js': await sourceHash('dist/designer-elements.js'), 'dist/designer-topology.js': await sourceHash('dist/designer-topology.js')},
  ...result,
};
await writeFile(path.join(root, 'tests/fixtures/designer-demo.json'), JSON.stringify(fixture, null, 2) + '\n');
console.log(`Recorded ${Object.keys(result.before).length} painted boxes, ${result.clicks.length} clicks that changed something.`);

// Makes the layout to import into the designer from the outline (dist/designer-outline.js) and the
// owner's latest export:
//
//   node tools/build-designer-layout.mjs [--base <exported layout.json>] [--out <file>] [--check]
//
// The editor owns the geometry. Every box of the base is kept as it is: its id, place, label and link.
// A box of the outline is added only when no box of the base has its id, so running this again on a
// newer export never moves a box the owner placed. Linked pages of the outline that the base lacks are
// added. The result passes the editor's own normalizeDesign before it is written.
//
// Defaults: --base handoff/designer/arachnid.flow-design.json, --out handoff/designer/arachnid.flow-design.json.
// --check writes nothing and fails when the file on disk differs from what would be written.
import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizeDesign, DESIGN_PAGES} from '../dist/blank-state.js';
import {OUTLINE} from '../dist/designer-outline.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** The layout: the base with the outline's missing pages and boxes added. Pure; throws when the result is not a valid layout. */
export function buildLayout(base) {
  const design = normalizeDesign(base), ids = new Set(Object.values(design.pages).flat().map(shape => shape.id));
  const main = new Set(DESIGN_PAGES.map(page => page.id));
  for (const page of OUTLINE) {
    if (!main.has(page.id) && !design.hiddenPages.some(entry => entry.id === page.id)) {
      design.hiddenPages.push({id: page.id, label: page.label});
      design.pages[page.id] = [];
    }
  }
  for (const page of OUTLINE) {
    for (const panel of page.panels) {
      if (panel.kept || ids.has(panel.id)) continue;
      const [x, y, width, height] = panel.box;
      design.pages[page.id].push({id: panel.id, type: 'rectangle', x, y, width, height, label: panel.label, link: panel.link});
      ids.add(panel.id);
    }
  }
  return normalizeDesign(design);
}

const isMain = import.meta.url === `file://${process.argv[1]}` || fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '');
if (isMain) {
  const args = process.argv.slice(2), value = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const basePath = path.resolve(root, value('--base') ?? 'handoff/designer/arachnid.flow-design.json');
  const outPath = path.resolve(root, value('--out') ?? 'handoff/designer/arachnid.flow-design.json');
  const layout = buildLayout(JSON.parse(await readFile(basePath, 'utf8')));
  const text = JSON.stringify(layout, null, 2) + '\n';
  const counts = Object.fromEntries(Object.entries(layout.pages).map(([id, shapes]) => [id, shapes.length]));
  if (args.includes('--check')) {
    const now = await readFile(outPath, 'utf8').catch(() => '');
    if (now !== text) { console.error(`${path.relative(root, outPath)} is not what the outline and the base make. Run without --check.`); process.exit(1); }
    console.log(`${path.relative(root, outPath)} is up to date.`);
  } else {
    await writeFile(outPath, text);
    console.log(`Wrote ${path.relative(root, outPath)}: ${Object.values(counts).reduce((a, b) => a + b, 0)} boxes on ${Object.keys(counts).length} pages (${layout.hiddenPages.length} linked).`);
    console.log(JSON.stringify(counts));
  }
}

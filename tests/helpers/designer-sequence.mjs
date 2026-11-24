// One fixed run through the designer's preview: paint every saved box of a layout as blank.js does in
// UI PREVIEW (largest first, with the page's boxes for nested clipping), paint the System topology in
// the free area, click it on a grid, click every box at a few points, then paint everything again.
// Used twice: once to record what today's code paints (tools/record-designer-fixture.mjs), and once
// in the tests to check that the demo adapter still paints exactly that.
import {raster, digest} from './raster.mjs';

const UI_PIXELS = 8;
/** Points inside a box, as fractions of its width and height, that reach today's demo controls. */
const POINTS = [[0.5, 0.5], [0.5, 0.06], [0.5, 0.15], [0.5, 0.33], [0.5, 0.45], [0.5, 0.52], [0.25, 0.04], [0.75, 0.04], [0.5, 0.85]];

/** The free area left of the System sidebar, as blank.js's topologyBounds() works it out. */
export function freeTopologyBounds(items) {
  if (items.some(r => r.type === 'rectangle' && /^(system )?topology$/i.test(r.label.trim()))) return null;
  const right = items.filter(r => r.x > 0), edge = right.length ? Math.min(...right.map(r => r.x)) : 77;
  if (edge < 40) return null;
  return {x: 0, y: 0, width: edge * UI_PIXELS, height: Math.max(64, ...items.map(r => r.y + r.height)) * UI_PIXELS};
}

function paintAll(design, preview, topology) {
  const out = {};
  for (const [page, items] of Object.entries(design.pages)) {
    const sorted = [...items].sort((a, b) => b.width * b.height - a.width * a.height);
    for (const rect of sorted) {
      if (rect.type !== 'rectangle' || !preview.hasDesignElement(rect, page)) continue;
      const ctx = raster();
      preview.paintDesignElement(ctx, rect, {page, allRects: items});
      out[`${page}/${rect.id}`] = digest(ctx.calls);
    }
    if (page === 'system') {
      const bounds = freeTopologyBounds(items);
      if (bounds) { const ctx = raster(); topology.paintSystemTopology(ctx, bounds); out['system/free-topology'] = digest(ctx.calls); }
    }
  }
  return out;
}

/** Runs the sequence and returns what it saw: digests before, the click results, digests after. */
export function runSequence(design, preview, topology) {
  const before = paintAll(design, preview, topology), clicks = [];
  const system = design.pages.system || [], bounds = freeTopologyBounds(system);
  if (bounds) {
    for (let y = 4; y < bounds.height; y += 24) for (let x = 4; x < bounds.width; x += 24) {
      if (topology.activateSystemTopology({x: bounds.x + x, y: bounds.y + y}, bounds)) clicks.push(`topology@${x},${y}`);
    }
  }
  for (const [page, items] of Object.entries(design.pages)) {
    for (const rect of items) {
      if (rect.type !== 'rectangle') continue;
      for (const [px, py] of POINTS) {
        const result = preview.activateDesignElement(rect, {x: px, y: py}, {page, allRects: items});
        if (result) clicks.push(`${page}/${rect.id}@${px},${py}=${JSON.stringify(result)}`);
      }
    }
  }
  const after = paintAll(design, preview, topology);
  return {before, clicks, after};
}

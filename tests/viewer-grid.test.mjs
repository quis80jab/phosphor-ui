import test from 'node:test';
import assert from 'node:assert/strict';
import { PANE_ENLARGEMENT, UI_SCALE, PIXEL_PITCH, UI_PIXELS, UI_CELL, gridMetrics, pixelBounds } from '../dist/viewer-grid.js';
import { paintGridControl } from '../dist/viewer-grid-paint.js';
import { pixelText } from '../dist/vfd-glyphs.js';

const close = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} should be near ${expected}`);

test('compact UI keeps exactly eight shared display pixels in each layout cell', () => {
  assert.equal(UI_SCALE, 1 / 1.4);
  assert.equal(PIXEL_PITCH, 2 * UI_SCALE);
  assert.equal(UI_PIXELS, 8);
  assert.equal(UI_CELL, 16 * UI_SCALE);
  assert.equal(UI_CELL, PIXEL_PITCH * UI_PIXELS);
});

test('responsive layouts remain divisible and the framebuffer covers odd viewport sizes', () => {
  for (const width of [320, 375, 383, 384, 571, 800 * UI_SCALE, 799, 800, 801, 1024, 1199, 1200, 1441, 1920, 3840]) {
    for (const height of [568, 667, 901]) {
      const grid = gridMetrics(width, height);
      for (const field of ['surfaceWidth', 'railWidth', 'mainWidth', 'viewportWidth', 'viewportHeight']) {
        close(grid[field] / UI_CELL, Math.round(grid[field] / UI_CELL));
        assert.ok(grid[field] > 0);
      }
      assert.ok(grid.surfaceWidth <= width && width - grid.surfaceWidth < UI_CELL);
      close(grid.uiColumns * UI_CELL, grid.surfaceWidth);
      if (grid.compact) {
        assert.equal(grid.railWidth, grid.surfaceWidth);
        assert.equal(grid.mainWidth, grid.surfaceWidth);
      } else {
        close(grid.railWidth + grid.mainWidth, grid.surfaceWidth);
        assert.ok(grid.railWidth <= 256 * UI_SCALE + 1e-8, 'the compact rail must release space to the pane');
      }
      close(grid.viewportWidth + 4 * UI_CELL, grid.mainWidth);
      assert.ok(grid.viewportWidth + 4 * UI_CELL + (grid.compact ? 0 : grid.railWidth) <= width + 1e-8, 'the pane and UI must fit without horizontal overflow');
      assert.ok(grid.viewportHeight >= (grid.compact ? 256 : 320) * PANE_ENLARGEMENT - UI_CELL / 2);
      assert.ok(grid.viewportHeight <= 640 * PANE_ENLARGEMENT + UI_CELL / 2);
      assert.ok(grid.pixelColumns * PIXEL_PITCH >= width);
      assert.ok(grid.pixelColumns * PIXEL_PITCH - width < PIXEL_PITCH);
      assert.ok(grid.pixelRows * PIXEL_PITCH >= height);
      assert.ok(grid.pixelRows * PIXEL_PITCH - height < PIXEL_PITCH);
    }
  }
});

test('the compact breakpoint agrees with the scaled 800px CSS layout boundary', () => {
  const boundary = 800 * UI_SCALE;
  for (const width of [boundary - UI_CELL, boundary - 1, boundary - .01]) assert.equal(gridMetrics(width, 600).compact, true);
  for (const width of [boundary, boundary + .01, boundary + UI_CELL]) assert.equal(gridMetrics(width, 600).compact, false);
});

test('desktop pane gains 40 percent height and uses the space released by the compact rail', () => {
  const grid = gridMetrics(1441, 1193);
  close(grid.viewportHeight, 560 * PANE_ENLARGEMENT, UI_CELL / 2);
  close(grid.viewportHeight, 788.5714285714286);
  close(grid.viewportWidth, 1211.4285714285716);
  assert.ok(grid.viewportWidth > 1088);
  close(grid.railWidth, 256 * UI_SCALE);
  assert.ok(grid.surfaceWidth <= 1441);
  close(grid.viewportWidth + grid.railWidth + UI_CELL * 4, grid.surfaceWidth);
});

test('changing viewport height never stretches the UI or its pixel lattice', () => {
  for (const width of [375, 800, 1440]) {
    const short = gridMetrics(width, 480), tall = gridMetrics(width, 1103);
    const { pixelRows: shortRows, ...shortLayout } = short;
    const { pixelRows: tallRows, ...tallLayout } = tall;
    assert.deepEqual(shortLayout, tallLayout);
    assert.ok(tallRows > shortRows);
  }
});

test('aligned rectangles and adjoining edges map exactly, including offscreen origins', () => {
  for (const left of [-160, -16, 0, 16, 640]) {
    const rect = { left: left * UI_SCALE, top: -32 * UI_SCALE, width: 96 * UI_SCALE, height: 48 * UI_SCALE };
    const before = { ...rect }, first = pixelBounds(rect);
    const next = pixelBounds({ ...rect, left: rect.left + rect.width });
    assert.deepEqual(rect, before, 'measurement must not mutate the DOM rectangle');
    assert.deepEqual(first, { x: left / 2, y: -16, width: 48, height: 24 });
    assert.equal(first.x + first.width, next.x, 'adjacent controls must not gain a gap or overlap');
  }
});

test('fractional scrolling snaps position to the same lattice without scaling controls', () => {
  for (const top of [-100.75, -0.5, 0.25, 5, 17.75]) {
    const bounds = pixelBounds({ left: 16 * UI_SCALE, top, width: 96 * UI_SCALE, height: 48 * UI_SCALE });
    assert.ok(Number.isInteger(bounds.y));
    assert.ok(Math.abs(bounds.y * PIXEL_PITCH - top) <= PIXEL_PITCH / 2 + 1e-8);
    assert.deepEqual([bounds.width, bounds.height], [48, 24]);
  }
});

// A small raster sink exercises the actual painter without a browser, GPU, or storage.
// It deliberately has no image-scaling or text-font API: artwork must use integer cells.
function rasterContext() {
  const pixels = new Map(), stack = [];
  let path = null, clip = [-Infinity, -Infinity, Infinity, Infinity];
  const ctx = {
    pixels, fillStyle: '#000', globalAlpha: 1,
    save() { stack.push({ clip: [...clip], fillStyle: this.fillStyle, globalAlpha: this.globalAlpha }); },
    restore() { const state = stack.pop(); clip = state.clip; this.fillStyle = state.fillStyle; this.globalAlpha = state.globalAlpha; },
    beginPath() { path = null; },
    rect(x, y, width, height) { path = [x, y, x + width, y + height]; },
    clip() { clip = [Math.max(clip[0], path[0]), Math.max(clip[1], path[1]), Math.min(clip[2], path[2]), Math.min(clip[3], path[3])]; },
    fillRect(x, y, width, height) {
      assert.ok([x, y, width, height].every(Number.isInteger), 'paint must stay on integer display cells');
      for (let yy = Math.max(y, clip[1]); yy < Math.min(y + height, clip[3]); yy++) {
        for (let xx = Math.max(x, clip[0]); xx < Math.min(x + width, clip[2]); xx++) {
          pixels.set(`${xx},${yy}`, { color: this.fillStyle, alpha: this.globalAlpha });
        }
      }
    }
  };
  return ctx;
}

function element(textContent = 'A', extra = {}) {
  return { textContent, dataset: {}, getAttribute: () => null, ...extra };
}

function coloredShape(ctx, color = '#a9e9df') {
  const points = [...ctx.pixels].filter(([, value]) => value.color === color).map(([key]) => key.split(',').map(Number));
  assert.ok(points.length, 'expected visible glyph pixels');
  const minX = Math.min(...points.map(([x]) => x)), minY = Math.min(...points.map(([, y]) => y));
  return points.map(([x, y]) => `${x - minX},${y - minY}`).sort();
}

test('resizing buttons changes their frames, never the glyph pixel size', () => {
  let originalShape;
  for (const [width, height] of [[24, 24], [48, 24], [96, 40]]) {
    const ctx = rasterContext();
    paintGridControl(ctx, { element: element(), type: 'button', x: 8, y: 16, width, height });
    const shape = coloredShape(ctx);
    if (originalShape) assert.deepEqual(shape, originalShape);
    else originalShape = shape;
    const points = shape.map(point => point.split(',').map(Number));
    assert.equal(Math.max(...points.map(([x]) => x)) + 1, 5);
    assert.equal(Math.max(...points.map(([, y]) => y)) + 1, 7);
    for (const key of ctx.pixels.keys()) {
      const [x, y] = key.split(',').map(Number);
      assert.ok(x >= 8 && x < 8 + width && y >= 16 && y < 16 + height);
    }
  }
});

test('moving a control translates its raster without changing or resampling it', () => {
  const first = rasterContext(), moved = rasterContext();
  const options = { element: element('ON'), type: 'button', width: 32, height: 24 };
  paintGridControl(first, { ...options, x: 0, y: 0 });
  paintGridControl(moved, { ...options, x: 24, y: -8 });
  const translated = [...moved.pixels].map(([key, value]) => {
    const [x, y] = key.split(',').map(Number);
    return [`${x - 24},${y + 8}`, value];
  });
  assert.deepEqual(new Map(translated), first.pixels);
});

test('minimum layer and camera key spans retain their complete labels', () => {
  for (const [label, width] of [['OFF', 32], ['ON', 32], ['FRONT', 40], ['RIGHT', 40], ['ISO', 40], ['LOOP', 40]]) {
    const minimum = rasterContext(), roomy = rasterContext();
    paintGridControl(minimum, { element: element(label), type: 'button', width, height: 24 });
    paintGridControl(roomy, { element: element(label), type: 'button', width: 120, height: 24 });
    assert.deepEqual(coloredShape(minimum), coloredShape(roomy), `${label} must remain fully readable`);
  }
});

test('hidden capture identifiers do not reappear in the painted title', () => {
  const plain = rasterContext(), withHiddenCode = rasterContext();
  const title = { nodeType: 3, textContent: 'Calibration' };
  const code = { nodeType: 1, id: 'capture-code', hidden: true, textContent: 'CUBE_001' };
  for (const [ctx, childNodes] of [[plain, [title]], [withHiddenCode, [title, code]]]) {
    paintGridControl(ctx, { element: element('Calibration', { id: 'viewer-title', childNodes }), type: 'label', width: 120, height: 24 });
  }
  assert.deepEqual(withHiddenCode.pixels, plain.pixels);
});

test('opaque alerts retain every message glyph when wrapped to mobile widths', () => {
  const messages = [
    'Snow globe could not load. Select it again to retry.',
    'The graphics connection was interrupted. Waiting for the viewer to recover.',
    'Download failed: ' + 'long-unbroken-response-token-'.repeat(4)
  ];
  for (const message of messages) {
    const reference = rasterContext();
    pixelText(reference, message.toUpperCase(), 0, 0, '#ffc782');
    for (const width of [80, 112, 240]) {
      const height = 280, ctx = rasterContext();
      ctx.fillStyle = '#abcdef'; ctx.fillRect(0, 0, width, height);
      paintGridControl(ctx, { element: element(message), type: 'alert', width, height });
      let messagePixels = 0;
      for (const [key, value] of ctx.pixels) {
        const [x, y] = key.split(',').map(Number);
        assert.notEqual(value.color, '#abcdef', 'scene color must not leak through the alert backing');
        assert.equal(value.alpha, 1);
        if (x >= 8 && x < width - 8 && y >= 8 && y < height - 8 && value.color === '#ffc782') messagePixels++;
      }
      assert.equal(messagePixels, reference.pixels.size, 'wrapping must not truncate words or add ellipses');
    }
  }
});

test('thermal ramp paints opaque one-cell columns with the original cold and hot colors', () => {
  const ctx = rasterContext();
  paintGridControl(ctx, { element: element(''), type: 'thermal-ramp', x: 8, y: 16, width: 61, height: 8 });
  assert.equal(ctx.pixels.size, 61 * 8);
  for (const [column, color] of [[0, 'rgb(40,67,138)'], [20, 'rgb(54,189,162)'], [40, 'rgb(228,208,94)'], [60, 'rgb(231,130,64)']]) {
    for (let row = 0; row < 8; row++) assert.deepEqual(ctx.pixels.get(`${8 + column},${16 + row}`), { color, alpha: 1 });
  }
  for (let column = 0; column < 61; column++) {
    const first = ctx.pixels.get(`${8 + column},16`);
    for (let row = 1; row < 8; row++) assert.deepEqual(ctx.pixels.get(`${8 + column},${16 + row}`), first);
  }
});

test('the editing rail takes whole UI cells and stacks before the viewer becomes narrow', () => {
  const breakpoint = 88 * UI_CELL;
  for (const width of [375, 768, breakpoint - .01, breakpoint, 1280, 1441, 1920]) {
    const legacy = gridMetrics(width, 900), grid = gridMetrics(width, 900, {tools:true});
    const right = width >= breakpoint ? 20 * UI_CELL : 0;
    close(grid.toolRailWidth, right);
    assert.equal(grid.toolsStacked, right === 0);
    close(grid.mainWidth, legacy.mainWidth - right);
    close(grid.viewportWidth, legacy.viewportWidth - right);
    for (const key of ['mainWidth','viewportWidth','toolRailWidth']) close(grid[key] / UI_CELL, Math.round(grid[key] / UI_CELL));
    close(grid.mainWidth + grid.toolRailWidth + (grid.compact ? 0 : grid.railWidth), grid.surfaceWidth);
    assert.equal(grid.viewportHeight, legacy.viewportHeight, 'adding tools preserves the enlarged pane height');
  }
});

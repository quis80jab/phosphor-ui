// A stand-in for a canvas 2D context, for painter tests: it records every fillRect, keeps the lit
// pixels inside the current clip, and supports the calls the painters make (fillStyle, fillRect,
// save, restore, beginPath, rect, clip, including the even-odd clip that keeps a parent from
// painting through the boxes nested in it). Every fillRect must use whole display pixels.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

export function raster({strict = true} = {}) {
  const pixels = new Map(), calls = [], stack = [];
  let path = [], clips = [];
  const inside = (x, y) => clips.every(test => test(x, y));
  const ctx = {
    pixels, calls, fillStyle: '#000', imageSmoothingEnabled: false,
    save() { stack.push({clips: [...clips], fillStyle: this.fillStyle}); },
    restore() { const top = stack.pop(); if (!top) return; clips = top.clips; this.fillStyle = top.fillStyle; },
    beginPath() { path = []; },
    rect(x, y, w, h) { path.push([x, y, x + w, y + h]); },
    clip(rule) {
      const rects = path.map(r => [...r]);
      if (rule === 'evenodd' && rects.length > 1) clips.push((x, y) => rects.filter(([a, b, c, d]) => x >= a && y >= b && x < c && y < d).length % 2 === 1);
      else clips.push((x, y) => rects.some(([a, b, c, d]) => x >= a && y >= b && x < c && y < d));
    },
    fillRect(x, y, w, h) {
      if (strict) assert.ok([x, y, w, h].every(Number.isInteger), `whole display pixels only, got ${[x, y, w, h]}`);
      calls.push([x, y, w, h, this.fillStyle]);
      for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) if (inside(xx, yy)) pixels.set(`${xx},${yy}`, this.fillStyle);
    },
  };
  return ctx;
}

/**
 * A faster stand-in that keeps no pixels, for painting many boxes or large ones: it records every
 * fillRect, checks whole pixels, and keeps the bounding box of what the plain clips let through
 * (an even-odd cut-out only takes pixels away, so it cannot widen that box). `depth` is how many
 * saves are still open, so a painter that restores more than it saves is caught.
 */
export function recorder({strict = true} = {}) {
  const calls = [], stack = [];
  let path = [], clip = null, bounds = null;
  const meet = (a, b) => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  return {
    calls, fillStyle: '#000', imageSmoothingEnabled: false, unbalanced: false,
    get bounds() { return bounds; },
    get depth() { return stack.length; },
    save() { stack.push({clip, fillStyle: this.fillStyle}); },
    restore() { const top = stack.pop(); if (!top) { this.unbalanced = true; return; } clip = top.clip; this.fillStyle = top.fillStyle; },
    beginPath() { path = []; },
    rect(x, y, w, h) { path.push([x, y, x + w, y + h]); },
    clip(rule) {
      if (rule === 'evenodd' && path.length > 1) return;
      const box = path.reduce((a, r) => a ? [Math.min(a[0], r[0]), Math.min(a[1], r[1]), Math.max(a[2], r[2]), Math.max(a[3], r[3])] : [...r], null);
      if (box) clip = clip ? meet(clip, box) : box;
    },
    fillRect(x, y, w, h) {
      if (strict) assert.ok([x, y, w, h].every(Number.isInteger), `whole display pixels only, got ${[x, y, w, h]}`);
      calls.push([x, y, w, h, this.fillStyle]);
      const r = clip ? meet([x, y, x + w, y + h], clip) : [x, y, x + w, y + h];
      if (r[2] <= r[0] || r[3] <= r[1]) return;
      bounds = bounds ? [Math.min(bounds[0], r[0]), Math.min(bounds[1], r[1]), Math.max(bounds[2], r[2]), Math.max(bounds[3], r[3])] : r;
    },
  };
}

/** True when everything a recorder let through lies inside the box (display pixels). */
export const boundsInside = (ctx, box) => !ctx.bounds || (ctx.bounds[0] >= box.x && ctx.bounds[1] >= box.y && ctx.bounds[2] <= box.x + box.width && ctx.bounds[3] <= box.y + box.height);

/** A short, stable fingerprint of every fillRect a painter made, in order. */
export function digest(calls) {
  return createHash('sha256').update(JSON.stringify(calls)).digest('hex').slice(0, 16);
}

/** The lit pixels as [x, y] pairs. */
export const litPixels = ctx => [...ctx.pixels.keys()].map(key => key.split(',').map(Number));

/** True when every lit pixel lies inside the box (display pixels). */
export function insideBox(ctx, box) {
  return litPixels(ctx).every(([x, y]) => x >= box.x && y >= box.y && x < box.x + box.width && y < box.y + box.height);
}

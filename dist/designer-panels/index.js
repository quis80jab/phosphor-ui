// The registry of the atlas adapter's panel painters, one module a page, and the three calls the
// dispatcher (designer-preview.js) makes: has a box a painter, paint it, pass it a click.
//
// A box finds its painter by its label, as today's preview does (trimmed, lower case, spaces
// collapsed): first the painter of its own page, then one shared by every page. Step boxes
// ("step 3: simulate"), view tabs ("view: chains") and any linked box with no painter of its own get
// the shared ones. A box with none stays a wireframe. Each painter draws inside its box only; the
// boxes nested in it are cut out, so a parent never paints through its children.
//
// A painter registers the places a click can land while it paints (env.hit); a click runs the one on
// top and returns true (repaint) or {navigate: pageId}, which blank.js already follows.
import {UI_PIXELS} from '../viewer-grid.js';
import {bindingOf, PANEL_STATES} from '../designer-panel-map.js';
import {getArchSelection} from '../designer-arch-view.js';
import {SAMPLE} from '../designer-records.js';
import {ui} from './state.js';
import {text, fill, outline, hline, part, tag, MINT, DIM, PANEL} from './kit.js';
import SHARED from './shared.js';
import SITE from './site.js';
import STEPS from './steps.js';
import SYSTEM from './system.js';
import WORK from './work.js';
import BESIDE from './beside.js';

const registry = new Map();
for (const module of [SHARED, SITE, STEPS, SYSTEM, WORK, BESIDE]) for (const [key, entry] of Object.entries(module)) registry.set(key, entry);

const nameOf = rect => String(rect.label || '').trim().toLowerCase().replace(/\s+/g, ' ');
const boxOf = rect => ({x: rect.x * UI_PIXELS, y: rect.y * UI_PIXELS, width: rect.width * UI_PIXELS, height: rect.height * UI_PIXELS});
const contains = (outer, inner) => inner.id !== outer.id && inner.width * inner.height < outer.width * outer.height && inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

/** The painter of a box on a page, or null. */
function find(rect, page) {
  if (!rect || rect.type !== 'rectangle') return null;
  const name = nameOf(rect);
  return registry.get(`${page}/${name}`) ?? registry.get(`*/${name}`)
    ?? (/^step \d: /.test(name) ? registry.get('*/step') : null)
    ?? (name.startsWith('view: ') ? registry.get('*/view') : null)
    ?? (rect.link ? registry.get('*/link') : null);
}

/** The names a page knows, for the manifest and the tests. */
export function registeredLabels() {
  return [...registry.keys()].sort();
}

export const hasPanel = (rect, page) => find(rect, page) !== null;

const regions = new Map();

/** The frame of a panel: its label, the mark of what exists today, SAMPLE or DESIGN. Gives back the inner box. */
function frameOf(ctx, rect, b, entry) {
  const style = entry.header ?? 'full';
  if (style === 'none') return b;
  fill(ctx, b.x, b.y, b.width, b.height, PANEL);
  outline(ctx, b.x, b.y, b.width, b.height, DIM);
  if (b.width < 64 || b.height < 16) { text(ctx, rect.label, b.x + 3, b.y + 3, MINT, {room: b.width - 6}); return part(b, 0, 0, 0, 0); }
  const binding = bindingOf(rect.id), state = binding ? PANEL_STATES[binding.state]?.mark : null;
  let right = b.x + b.width - 6;
  const left = b.x + 8 + Math.min(120, rect.label.length * 6) + 8;
  if (state) { const used = tag(ctx, right, b.y + 3, state, left); if (used) right -= used + 4; }
  const data = entry.data === false ? null : entry.data ?? 'SAMPLE';
  if (data) { const used = tag(ctx, right, b.y + 3, data, left); if (used) right -= used + 4; }
  text(ctx, rect.label, b.x + 8, b.y + 5, MINT, {room: right - b.x - 12});
  const compact = style === 'compact' || b.height < 48;
  if (!compact) hline(ctx, b.x + 8, b.y + 18, b.width - 16, DIM);
  return compact ? part(b, 8, 18, b.width - 16, b.height - 22) : part(b, 8, 24, b.width - 16, b.height - 32);
}

/** Paints a box at its saved bounds; false when it has no painter. */
export function paintPanel(ctx, rect, {page, allRects = []} = {}) {
  const entry = find(rect, page);
  if (!entry) return false;
  const b = boxOf(rect), list = [];
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height); ctx.clip();
  const children = allRects.filter(other => other.type === 'rectangle' && contains(rect, other));
  const direct = children.filter(child => !children.some(other => other !== child && contains(other, child)));
  if (direct.length) {
    ctx.beginPath(); ctx.rect(b.x, b.y, b.width, b.height);
    for (const child of direct) { const c = boxOf(child); ctx.rect(c.x, c.y, c.width, c.height); }
    ctx.clip('evenodd');
  }
  try {
    const inner = frameOf(ctx, rect, b, entry);
    const env = {rect, page, box: b, children: direct.map(boxOf), ui, sample: SAMPLE, arch: getArchSelection(), binding: bindingOf(rect.id), hit: (box, run) => list.push({box, run})};
    if (inner.width > 0 && inner.height > 0) entry.paint(ctx, inner, env);
  } finally {
    ctx.restore();
  }
  regions.set(rect.id, list);
  return true;
}

const NOWHERE = {fillStyle: '', globalAlpha: 1, imageSmoothingEnabled: false, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, fillRect() {}};

/** A click at {x, y} (0 to 1 inside the box): true, false, or {navigate: pageId}. */
export function activatePanel(rect, point, {page, allRects = []} = {}) {
  if (!find(rect, page)) return false;
  paintPanel(NOWHERE, rect, {page, allRects});
  const b = boxOf(rect), clamp = v => Math.min(1, Math.max(0, Number(v) || 0));
  const px = b.x + clamp(point?.x) * b.width, py = b.y + clamp(point?.y) * b.height;
  const hit = [...(regions.get(rect.id) ?? [])].reverse().find(entry => px >= entry.box.x && py >= entry.box.y && px < entry.box.x + entry.box.width && py < entry.box.y + entry.box.height);
  if (!hit) return false;
  const result = hit.run({x: px, y: py});
  return result === undefined ? true : result;
}

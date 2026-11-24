// Painters every page shares: the step chain at the bottom of Site and its steps, the view tabs of
// System, and any linked box without a painter of its own. A linked box opens its page on a click in
// UI PREVIEW (blank.js follows the link before a painter is asked), so these only paint.
import {STEPS, OUTLINE} from '../designer-outline.js';
import {SAMPLE} from '../designer-records.js';
import {el, text, fill, outline, hline, textWidth, part, MINT, DIM, INK, PANEL, AMBER} from './kit.js';

const labelOf = id => OUTLINE.find(page => page.id === id)?.label ?? id;

/** Where the sample flight stands at each step: done, the step to take now, or still to do. */
function stepState(n) {
  const flight = SAMPLE.flights.find(entry => entry.id === 'f2'), simulated = SAMPLE.runs.some(run => run.flight === 'f2' && run.origin === 'sim' && run.outcome === 'COMPLETED');
  if (n === 1 || n === 2) return flight ? 'done' : 'todo';
  if (n === 3) return simulated ? 'done' : 'now';
  if (n === 4) return simulated ? 'now' : 'locked';
  return SAMPLE.recordings.length ? 'done' : 'todo';
}

function stepBox(ctx, b, env, {top, name, n}) {
  const current = n && STEPS[n - 1].page === env.page, state = n ? stepState(n) : null;
  fill(ctx, b.x, b.y, b.width, b.height, current ? MINT : PANEL);
  outline(ctx, b.x, b.y, b.width, b.height, current ? MINT : state === 'locked' ? AMBER : DIM);
  if (!current && b.width >= 9 && b.height >= 9) outline(ctx, b.x + 2, b.y + 2, b.width - 4, b.height - 4, state === 'now' ? MINT : PANEL);
  const ink = current ? INK : state === 'locked' ? AMBER : MINT;
  text(ctx, top, b.x + 5, b.y + 5, current ? INK : DIM, {room: b.width - 10});
  text(ctx, name, b.x + 5, b.y + Math.max(14, b.height - 12), ink, {room: b.width - 10});
  if (state && b.width >= 40) {
    const word = current ? 'HERE' : {done: 'DONE', now: 'NEXT', locked: 'LOCKED', todo: ''}[state];
    if (word) text(ctx, word, b.x + b.width - 5, b.y + 5, current ? INK : state === 'locked' ? AMBER : DIM, {align: 'right', room: b.width - 10 - textWidth(top) - 4});
  }
}

export default {
  '*/step': {header: 'none', data: false, paint(ctx, b, env) {
    const n = Number(env.rect.label.match(/^step (\d)/i)[1]), step = STEPS[n - 1];
    stepBox(ctx, b, env, {top: String(n), name: step.name, n});
  }},
  '*/return': {header: 'none', data: false, paint(ctx, b, env) {
    stepBox(ctx, b, env, {top: '< RETURN', name: env.rect.link ? labelOf(env.rect.link).replace(/^Site: /, '').toUpperCase() : ''});
  }},
  '*/next': {header: 'none', data: false, paint(ctx, b, env) {
    stepBox(ctx, b, env, {top: 'NEXT >', name: env.rect.link ? labelOf(env.rect.link).replace(/^Site: /, '').toUpperCase() : ''});
  }},
  '*/view': {header: 'none', data: false, paint(ctx, b, env) {
    const current = !env.rect.link, name = env.rect.label.replace(/^view:\s*/i, '').toUpperCase();
    fill(ctx, b.x, b.y, b.width, b.height, current ? MINT : PANEL);
    outline(ctx, b.x, b.y, b.width, b.height, current ? MINT : DIM);
    text(ctx, name, b.x + Math.floor(b.width / 2), b.y + Math.floor((b.height - 7) / 2), current ? INK : MINT, {align: 'center', room: b.width - 8});
  }},
  '*/link': {header: 'none', data: false, paint(ctx, b, env) {
    el(ctx, 'button', b, {label: env.rect.label.toUpperCase()});
    if (b.height >= 40 && env.rect.link) text(ctx, `> ${labelOf(env.rect.link).toUpperCase()}`, b.x + 8, b.y + b.height - 11, AMBER, {room: b.width - 16});
  }},
};

export {stepState};

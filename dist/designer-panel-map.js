// The panel map: for every box of the outline, keyed by its element ID, what paints it and what will
// feed it (the export's guide: "a separate host-owned map keyed by element ID"). Built from
// designer-outline.js, so the layout and the bindings cannot drift apart.
import {OUTLINE} from './designer-outline.js';

/** Example status marks used by the synthetic panel bindings. */
export const PANEL_STATES = Object.freeze({
  working: {mark: 'WORKS', says: 'INTERACTIVE VISUAL EXAMPLE'},
  headless: {mark: 'NO UI', says: 'DATA-ONLY VISUAL EXAMPLE'},
  lead: {mark: 'LEAD', says: 'SYNTHETIC EXTERNAL MODULE'},
  planned: {mark: 'PLAN', says: 'PLACEHOLDER EXAMPLE'},
});

/** The host adapters of the guide that a panel can name. */
export const ADAPTERS = Object.freeze(['domain', 'telemetry', 'commands', 'session', 'layout', 'router', 'none']);

export const PANEL_MAP = Object.freeze(Object.fromEntries(OUTLINE.flatMap(page => page.panels.map(panel => [panel.id, Object.freeze({
  page: page.id, label: panel.label, el: panel.map.el ?? null, adapter: panel.map.adapter ?? 'none', feed: panel.map.feed ?? null,
  by: panel.map.by ?? null, state: panel.map.state ?? 'planned', where: panel.map.where ?? null,
})]))));

/** The binding of a box, or null for a box the outline does not know (one the owner drew later). */
export const bindingOf = id => PANEL_MAP[id] ?? null;

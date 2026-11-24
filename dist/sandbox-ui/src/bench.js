// The bench: every element of the ladder, layer by layer from the bottom. Each element that a person can work
// comes first as a working one ("try it": a real input sits behind it), then in the states it can stand in.
// Lit by Phosphor's compositor; with `?plain` the painted bitmap is shown as it is.
import {UI_PIXELS} from './phosphor.js';
import {ELEMENTS, LAYERS} from './ladder.js';
import {ADAPTERS} from './adapters.js';
import {createStage} from './stage.js';
import {MINT, DIM} from './palette.js';

const MARGIN = 3;   // cells kept free at the left and right
const stage = createStage({host: document.getElementById('bench'), plain: new URLSearchParams(location.search).has('plain')});

/** What a working sample does when a person acts on it, beyond keeping its own value. */
function behaviour(entry, say) {
  let presses = 0;
  if (entry.id === 'button') return {press: () => say(`try it: pressed ${presses += 1} time${presses === 1 ? '' : 's'}`)};
  if (['row', 'tableRow', 'mission', 'place'].includes(entry.id)) return {press: (event, state) => stage.get(`${entry.id}:try`).set({selected: !state.selected})};
  if (entry.id === 'planMap') return {point: place => { stage.get('planMap:try').set({home: {x: Math.round(place.x), y: Math.round(place.y)}}); say(`try it: home at ${Math.round(place.x)} east, ${Math.round(place.y)} north`); }};
  if (entry.id === 'siteMap') {
    return {
      change: state => say(`try it: ${Math.round(state.across_m)} m across`),
      lasso: ring => { stage.get('siteMap:try').set({lasso: ring}); say(`try it: a loop of ${ring.length} corners`); },
      point: place => say(`try it: a click at ${Math.round(place.x)} east, ${Math.round(place.y)} north`),
      fit: () => { stage.get('siteMap:try').set({centre: {x: 0, y: 0}, across_m: 150}); say('try it: the whole area'); },
    };
  }
  if (entry.id === 'transport') {
    return {key: (key, event, state) => {
      const item = stage.get('transport:try');
      if (key === 'play') item.set({playing: !state.playing});
      else if (key === 'stop') item.set({playing: false, share: 0});
      else item.set({share: Math.min(1, Math.max(0, (state.share || 0) + (key === 'next' ? 0.1 : -0.1)))});
    }};
  }
  return {change: state => { if (entry.id === 'field') say(`try it: ${state.value ? `"${state.value}"` : 'type here'}`); }};
}

function build() {
  stage.clear();
  const columns = Math.max(40, stage.columns());
  let row = 2;
  const words = (id, said, scale, colour, rows) => { stage.words(id, {col: MARGIN, row, cols: columns - 2 * MARGIN, rows}, said, {scale, colour}); row += rows; };
  words('title', 'PHOSPHOR CATALOG: THE ELEMENTS, FROM THE BOTTOM UP', 2, MINT, 3);
  words('about', `${ELEMENTS.length} ELEMENTS ON ${LAYERS.length} LAYERS. EACH IS PAINTED WHOLE AT THE SIZE IT IS GIVEN: A CELL IS ${UI_PIXELS} BY ${UI_PIXELS} DISPLAY PIXELS. WHERE IT SAYS TRY IT, A REAL INPUT IS BEHIND THE PAINTING: USE THE POINTER OR THE TAB KEY.`, 1, DIM, 4);
  for (const layer of LAYERS) {
    row += 2;
    words(`layer:${layer.id}`, `${layer.id}  ${layer.title}`, 2, MINT, 3);
    words(`layer:${layer.id}:about`, layer.about, 1, DIM, 2);
    for (const entry of ELEMENTS.filter(candidate => candidate.layer === layer.id)) {
      row += 1;
      words(`${entry.id}:head`, `${entry.title}  /  FROM ${entry.from}`, 1, DIM, 2);
      const [cols, rows] = entry.cells;
      const shown = [];
      if (ADAPTERS[entry.id]) shown.push({key: 'try', name: 'try it', state: entry.states[0][1], working: true});
      entry.states.forEach(([name, state], i) => shown.push({key: `state:${i}`, name, state}));
      if (entry.live) shown.push({key: 'moving', name: 'moving', live: entry.live});
      let col = MARGIN;
      for (const sample of shown) {
        // A sample's slot is as wide as its name needs, so the name under it is never cut.
        const slot = Math.max(cols, Math.ceil(Math.max(sample.name.length, sample.working ? 34 : 0) * 6 / UI_PIXELS) + 1);
        if (col > MARGIN && col + slot > columns - MARGIN) { row += rows + 3; col = MARGIN; }
        const caption = stage.words(`${entry.id}:${sample.key}:name`, {col, row: row + rows, cols: slot, rows: 2}, sample.name, {colour: sample.working ? MINT : DIM});
        stage.add({
          id: `${entry.id}:${sample.key}`, element: entry.id, cells: {col, row, cols, rows},
          state: sample.state || {}, live: sample.live, inert: !sample.working,
          on: sample.working ? behaviour(entry, said => caption.say(said)) : undefined,
        });
        col += slot + 2;
      }
      row += rows + 3;
    }
  }
  stage.rows(row + 2);
}

// The working playback moves while it plays.
let last = 0;
stage.animate(now => {
  const item = stage.get('transport:try');
  if (!item?.state.playing) { last = now; return; }
  const passed = now - last;
  if (passed < 60) return;
  last = now;
  // The sample run is 4 min 43 s long and plays in twenty seconds.
  const share = (item.state.share || 0) + passed / 20000, at = Math.round(Math.min(1, share) * 283);
  item.set({share: share >= 1 ? 0 : share, playing: share < 1, at: `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`});
});

build();
let width = stage.columns();
addEventListener('resize', () => { if (stage.columns() !== width) { width = stage.columns(); build(); } });

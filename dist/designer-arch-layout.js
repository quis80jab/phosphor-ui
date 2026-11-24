// The geometry of the topology, and nothing else: where each node stands and how each link runs, in
// whole display pixels, for whatever box it is given. Pure; no painting, no state.
//
// Tiers stand in rows on one column grid shared by every tier, so the gaps between columns line up
// from top to bottom as lanes. A line runs only straight down from a node into the channel under its
// row (or up into the channel over it), across inside a channel, and down a lane; so no line can pass
// through a node. Lines in one channel or one lane get tracks of their own, three pixels apart.
// Bottom ports sit at even offsets from a node's middle and top ports at odd ones, and the column
// pitch is even, so a line leaving one node and a line arriving at another never share a column.
// If the tiers do not fit, nodes step down from full to medium to compact; then the tiers go on pages.

export const FORMS = Object.freeze([
  Object.freeze({name: 'full', width: 104, height: 44}),
  Object.freeze({name: 'medium', width: 88, height: 30}),
  Object.freeze({name: 'compact', width: 72, height: 16}),
]);
const GAP = 12, MARGIN = 8, LABEL = 12, TRACK = 3, CHANNEL = 8, MOST_WIDTH = 150;

/** Rows of a tier: n nodes over at most `columns` a row, balanced (7 over 5 is 4 and 3). */
function rowsOf(ids, columns) {
  const count = Math.ceil(ids.length / columns), rows = [];
  let at = 0;
  for (let r = 0; r < count; r += 1) {
    const size = Math.ceil((ids.length - at) / (count - r));
    rows.push(ids.slice(at, at + size));
    at += size;
  }
  return rows;
}

/** First-fit tracks for intervals: each gets the lowest track no earlier interval on it overlaps. */
function assignTracks(items) {
  const tracks = [];
  for (const item of [...items].sort((a, b) => a.from - b.from || a.to - b.to)) {
    let t = 0;
    while ((tracks[t] ||= []).some(([a, b]) => item.from <= b + 2 && a <= item.to + 2)) t += 1;
    tracks[t].push([item.from, item.to]);
    item.track = t;
  }
  return tracks.length;
}

/**
 * Lays out `tiers` ([{id, label, nodes: [id]}], top to bottom) and `links` ([{id, from, to}]) in
 * `body` ({x, y, width, height}, display pixels). `page` picks a page when they do not fit on one.
 * Returns {form, columns, nodeWidth, pages, page, tierPages, rows, boxes, routes, labels, height, fits}.
 */
export function layoutTiers(tiers, links, body, {page = 0} = {}) {
  for (const form of FORMS) {
    const attempt = tryForm(form, tiers, links, body, tiers.map(tier => tier.id));
    if (attempt && attempt.height <= body.height) return {...attempt, pages: 1, page: 0, tierPages: [tiers.map(tier => tier.id)], fits: true};
  }
  // On pages: whole tiers a page, in compact form, as many as fit.
  const form = FORMS[FORMS.length - 1], pages = [];
  let current = [];
  for (const tier of tiers) {
    const trial = tryForm(form, tiers, links, body, [...current, tier.id]);
    if (current.length && (!trial || trial.height > body.height)) { pages.push(current); current = [tier.id]; }
    else current.push(tier.id);
  }
  if (current.length) pages.push(current);
  const chosen = Math.min(Math.max(0, page), pages.length - 1);
  const attempt = tryForm(form, tiers, links, body, pages[chosen]);
  if (!attempt) return {form: null, columns: 0, nodeWidth: 0, pages: pages.length, page: chosen, tierPages: pages, rows: [], boxes: {}, routes: [], labels: [], height: 0, fits: false};
  return {...attempt, pages: pages.length, page: chosen, tierPages: pages, fits: attempt.height <= body.height};
}

/**
 * One form in one body. `gap` (between columns) and `margin` (either side of the grid) start at their
 * least; when more lanes run down a gap than it holds, the layout is made again with the gap or the
 * margin wide enough for them, so a lane never runs along or through a node.
 */
function tryForm(form, tiers, links, body, shownTiers, gap = GAP, margin = MARGIN) {
  const usable = body.width - 2 * margin, fit = Math.floor((usable + gap) / (form.width + gap));
  if (fit < 1) return null;
  // Only as many columns as the widest balanced row needs: 8 nodes over 5 is two rows of 4, so 4.
  const widest = Math.max(1, ...tiers.filter(tier => shownTiers.includes(tier.id)).map(tier => Math.ceil(tier.nodes.length / Math.ceil(tier.nodes.length / fit))));
  const columns = Math.min(fit, widest);
  let nodeWidth = Math.min(MOST_WIDTH, Math.floor((usable - (columns - 1) * gap) / columns));
  nodeWidth -= nodeWidth % 2; // an even pitch keeps bottom and top ports in different columns
  if (nodeWidth < form.width) return null;
  const pitch = nodeWidth + gap, gridWidth = columns * nodeWidth + (columns - 1) * gap;
  const left = body.x + margin + Math.floor((usable - gridWidth) / 2);
  const shown = tiers.filter(tier => shownTiers.includes(tier.id));
  const rows = [], rowOf = {}, colOf = {};
  for (const tier of shown) {
    rowsOf(tier.nodes, columns).forEach((ids, index) => {
      const start = Math.floor((columns - ids.length) / 2);
      ids.forEach((id, i) => { rowOf[id] = rows.length; colOf[id] = start + i; });
      rows.push({tier: tier.id, label: index === 0 ? tier.label : null, ids});
    });
  }
  const visible = links.filter(link => rowOf[link.from] !== undefined && rowOf[link.to] !== undefined);
  const outside = links.filter(link => (rowOf[link.from] === undefined) !== (rowOf[link.to] === undefined));

  // Ports: each node's bottom and top links, ordered by where their other end stands.
  const portX = {}, xOfCol = col => left + col * pitch, centre = id => xOfCol(colOf[id]) + nodeWidth / 2;
  const sides = {};
  const edge = (link, id, side, other) => { (sides[`${id}|${side}`] ||= []).push({link, other}); };
  for (const link of visible) {
    let a = link.from, z = link.to;
    if (rowOf[a] > rowOf[z]) [a, z] = [z, a];
    if (rowOf[a] === rowOf[z]) { edge(link, a, 'bottom', z); edge(link, z, 'bottom', a); }
    else { edge(link, a, 'bottom', z); edge(link, z, 'top', a); }
  }
  for (const [key, list] of Object.entries(sides)) {
    const [id, side] = key.split('|');
    list.sort((p, q) => (colOf[p.other] - colOf[q.other]) || (rowOf[p.other] - rowOf[q.other]));
    const offsets = list.map((_, i) => {
      const k = i - Math.floor((list.length - 1) / 2), base = 6 * k;
      return side === 'bottom' ? base : base + 3;
    });
    const half = nodeWidth / 2 - 6;
    list.forEach((entry, i) => { portX[`${entry.link.id}|${id}|${side}`] = Math.round(centre(id) + Math.max(-half, Math.min(half, offsets[i]))); });
  }

  // Routes, as channel and lane uses; their tracks first, then the y of each channel.
  const plans = visible.map(link => {
    let a = link.from, z = link.to;
    if (rowOf[a] > rowOf[z]) [a, z] = [z, a];
    const ra = rowOf[a], rz = rowOf[z];
    const x1 = portX[`${link.id}|${a}|bottom`], x2 = portX[`${link.id}|${z}|${ra === rz ? 'bottom' : 'top'}`];
    if (ra === rz || rz === ra + 1) return {link, a, z, ra, rz, x1, x2, h: [{channel: ra, from: Math.min(x1, x2), to: Math.max(x1, x2)}], lane: null};
    // Down a lane: the gap nearest the lower end, on the side of the upper one.
    const lowerCol = colOf[z], gapIndex = x1 < x2 ? lowerCol : lowerCol + 1;
    const gapLeft = gapIndex === 0 ? body.x + 1 : gapIndex === columns ? xOfCol(columns - 1) + nodeWidth + 1 : xOfCol(gapIndex - 1) + nodeWidth + 1;
    return {link, a, z, ra, rz, x1, x2, gapIndex, gapLeft, h: [{channel: ra, from: Math.min(x1, gapLeft), to: Math.max(x1, gapLeft)}, {channel: rz - 1, from: Math.min(gapLeft, x2), to: Math.max(gapLeft, x2)}], lane: {from: ra, to: rz - 1}};
  });
  const channelTracks = rows.map((_, r) => assignTracks(plans.flatMap(plan => plan.h.filter(seg => seg.channel === r))));
  const gaps = {};
  for (const plan of plans) if (plan.lane) (gaps[plan.gapIndex] ||= []).push(plan.lane);
  const lanes = Object.entries(gaps).map(([index, list]) => [Number(index), assignTracks(list)]);
  // Lanes stand TRACK apart from 2 pixels into a gap, with a pixel to spare before the next column:
  // n lanes need a gap of TRACK * n + 2 (kept even), and a margin of TRACK * n + 4 outside the grid.
  const inner = Math.max(0, ...lanes.filter(([index]) => index > 0 && index < columns).map(([, n]) => n));
  const outer = Math.max(0, ...lanes.filter(([index]) => index === 0 || index === columns).map(([, n]) => n));
  const needGap = Math.max(GAP, 2 * Math.ceil((TRACK * inner + 2) / 2)), needMargin = Math.max(MARGIN, TRACK * outer + 4);
  if (needGap > gap || needMargin > margin) return gap > 64 || margin > 64 ? null : tryForm(form, tiers, links, body, shownTiers, Math.max(gap, needGap), Math.max(margin, needMargin));

  // Vertical places: a label line over the first row of each tier, then the rows and their channels.
  let y = body.y;
  const rowTop = [], channelTop = [], labels = [];
  rows.forEach((row, r) => {
    if (row.label) { labels.push({text: row.label, x: body.x + margin, y: y + 2}); y += LABEL; }
    rowTop[r] = y; y += form.height;
    channelTop[r] = y; y += CHANNEL + TRACK * Math.max(1, channelTracks[r]);
  });
  const trackY = (channel, track) => channelTop[channel] + 4 + TRACK * track;
  const boxes = {};
  for (const [id, r] of Object.entries(rowOf)) boxes[id] = {x: xOfCol(colOf[id]), y: rowTop[r], width: nodeWidth, height: form.height};

  const routes = plans.map(plan => {
    const {link, a, z, ra, rz, x1, x2} = plan, bottomA = rowTop[ra] + form.height;
    if (!plan.lane) {
      const ty = trackY(ra, plan.h[0].track), endY = ra === rz ? rowTop[rz] + form.height : rowTop[rz];
      return {link: link.id, from: a, to: z, points: [[x1, bottomA], [x1, ty], [x2, ty], [x2, endY]]};
    }
    const t1 = trackY(ra, plan.h[0].track), t2 = trackY(rz - 1, plan.h[1].track), laneX = plan.gapLeft + 2 + TRACK * plan.lane.track;
    return {link: link.id, from: a, to: z, points: [[x1, bottomA], [x1, t1], [laneX, t1], [laneX, t2], [x2, t2], [x2, rowTop[rz]]]};
  });
  // A link to a node on another page ends in a stub under its node, tagged with the far tier.
  const stubs = outside.map(link => {
    const here = rowOf[link.from] !== undefined ? link.from : link.to, there = here === link.from ? link.to : link.from;
    const box = boxes[here];
    return {link: link.id, from: here, to: there, points: [[box.x + 4, box.y + box.height], [box.x + 4, box.y + box.height + 5]]};
  });
  return {form, columns, nodeWidth, rows: rows.map((row, r) => ({...row, y: rowTop[r]})), boxes, routes, stubs, labels, height: y - body.y};
}

/** The node under a point, or null. */
export function nodeAt(layout, point) {
  for (const [id, box] of Object.entries(layout.boxes)) {
    if (point.x >= box.x && point.y >= box.y && point.x < box.x + box.width && point.y < box.y + box.height) return id;
  }
  return null;
}

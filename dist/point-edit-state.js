export const MAX_POINT_COUNT = 2000000;
export const MAX_POINT_GROUPS = 32;
const MAX_UNDO = 32;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (value, key) => Object.hasOwn(value, key) ? value[key] : undefined;
const validCount = count => Number.isSafeInteger(count) && count >= 0 && count <= MAX_POINT_COUNT;
const groupId = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$/.test(value)
  && !['constructor', 'prototype', '__proto__'].includes(value);
const groupName = (value, fallback) => typeof value === 'string'
  ? Array.from(value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()).slice(0, 32).join('') || fallback : fallback;
const copyRanges = ranges => ranges.map(pair => [...pair]);
const rangeCount = ranges => ranges.reduce((sum, [start, end]) => sum + end - start + 1, 0);

/** Inclusive original-index ranges, sorted, clipped, and merged without expanding IDs. */
export function normalizeIndexRanges(input, count = MAX_POINT_COUNT) {
  if (!validCount(count)) throw new RangeError('Point count must be an integer between zero and two million.');
  if (!Array.isArray(input) || !count) return [];
  const ranges = [];
  for (const pair of input) {
    if (!Array.isArray(pair) || pair.length !== 2) continue;
    const [start, end] = pair;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || end < 0 || start >= count) continue;
    ranges.push([Math.max(0, start), Math.min(count - 1, end)]);
  }
  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged = [];
  for (const pair of ranges) {
    const previous = merged.at(-1);
    if (previous && pair[0] <= previous[1] + 1) previous[1] = Math.max(previous[1], pair[1]);
    else merged.push(pair);
  }
  return merged;
}

export function normalizePointEditSnapshot(input, count = MAX_POINT_COUNT) {
  const source = record(input) ? input : {};
  const deleted = normalizeIndexRanges(own(source, 'deleted'), count), groups = [], ids = new Set();
  const entries = own(source, 'groups');
  if (Array.isArray(entries)) for (const entry of entries) {
    if (groups.length >= MAX_POINT_GROUPS) break;
    if (!record(entry)) continue;
    let id = own(entry, 'id');
    if (!groupId(id) || ids.has(id)) {
      let serial = groups.length + 1;
      do { id = `group-${serial++}`; } while (ids.has(id));
    }
    ids.add(id);
    groups.push({ id, name: groupName(own(entry, 'name'), `GROUP ${groups.length + 1}`),
      indices: normalizeIndexRanges(own(entry, 'indices'), count) });
  }
  return { deleted, groups };
}

function maskRanges(mask) {
  const result = [];
  for (let i = 0; i < mask.length; i++) if (mask[i]) {
    const start = i;
    while (i + 1 < mask.length && mask[i + 1]) i++;
    result.push([start, i]);
  }
  return result;
}

function intersectionCount(a, b) {
  let i = 0, j = 0, count = 0;
  while (i < a.length && j < b.length) {
    const start = Math.max(a[i][0], b[j][0]), end = Math.min(a[i][1], b[j][1]);
    if (end >= start) count += end - start + 1;
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return count;
}

/** Original indices never move. Selection and undo belong only to this session. */
export function createPointEditModel(count, snapshot) {
  if (!validCount(count)) throw new RangeError('Point count must be an integer between zero and two million.');
  const initial = normalizePointEditSnapshot(snapshot, count);
  const deletedMask = new Uint8Array(count), selectedMask = new Uint8Array(count), history = [];
  let deletedRanges = initial.deleted, groups = initial.groups;
  let deleted = rangeCount(deletedRanges), selected = 0, revision = 0, groupSummary = null;
  for (const [start, end] of deletedRanges) deletedMask.fill(1, start, end + 1);
  const touch = () => { revision++; groupSummary = null; };
  function remember(entry) { history.push(entry); if (history.length > MAX_UNDO) history.shift(); }
  function validIndex(id) { return Number.isInteger(id) && id >= 0 && id < count; }
  function clearSelection() {
    if (!selected) return false;
    selectedMask.fill(0); selected = 0; return true;
  }
  function applySelection(ids, mode = 'replace') {
    if (!['replace', 'add', 'subtract', 'toggle'].includes(mode)) throw new Error('Unknown selection operation.');
    if (!ids || typeof ids[Symbol.iterator] !== 'function') return false;
    // Build a distinct hit mask so duplicate IDs cannot toggle twice. Reusing
    // the source selection mask through getSelectedIds is also safe.
    const hits = new Uint8Array(count);
    for (const id of ids) if (validIndex(id) && !deletedMask[id]) hits[id] = 1;
    let changed = false;
    for (let id = 0; id < count; id++) {
      const before = selectedMask[id];
      const after = mode === 'replace' ? hits[id] : mode === 'add' ? before | hits[id]
        : mode === 'subtract' ? before & (1 - hits[id]) : before ^ hits[id];
      if (before !== after) { selectedMask[id] = after; selected += after - before; changed = true; }
    }
    return changed;
  }
  function selectAllVisible() {
    let changed = false;
    for (let id = 0; id < count; id++) {
      const next = deletedMask[id] ? 0 : 1;
      if (selectedMask[id] !== next) { selectedMask[id] = next; changed = true; }
    }
    selected = count - deleted; return changed;
  }
  function getSelectedIds() {
    const ids = new Uint32Array(selected); let next = 0;
    for (let id = 0; id < count; id++) if (selectedMask[id]) ids[next++] = id;
    return ids;
  }
  function deleteSelected() {
    if (!selected) return 0;
    const ranges = maskRanges(selectedMask), removed = selected;
    remember({ type: 'delete', ranges });
    for (const [start, end] of ranges) deletedMask.fill(1, start, end + 1);
    deleted += removed; clearSelection(); deletedRanges = maskRanges(deletedMask); touch();
    return removed;
  }
  function createGroup(name) {
    if (groups.length >= MAX_POINT_GROUPS) return null;
    const ids = new Set(groups.map(group => group.id)); let serial = 1, id;
    do { id = `group-${serial++}`; } while (ids.has(id));
    remember({ type: 'groups', groups });
    groups = [...groups, { id, name: groupName(name, `GROUP ${groups.length + 1}`), indices: maskRanges(selectedMask) }];
    touch(); return id;
  }
  function selectGroup(id, mode = 'replace') {
    const group = groups.find(group => group.id === id); if (!group) return false;
    function* indices() { for (const [start, end] of group.indices) for (let index = start; index <= end; index++) yield index; }
    return applySelection(indices(), mode);
  }
  function removeGroup(id) {
    if (!groups.some(group => group.id === id)) return false;
    remember({ type: 'groups', groups }); groups = groups.filter(group => group.id !== id); touch(); return true;
  }
  function renameGroup(id, name) {
    const group = groups.find(group => group.id === id); if (!group) return false;
    const next = groupName(name, group.name); if (next === group.name) return false;
    remember({ type: 'groups', groups }); groups = groups.map(group => group.id === id ? { ...group, name: next } : group); touch(); return true;
  }
  function resetEdits() {
    if (!deleted && !groups.length) return false;
    remember({ type: 'reset', deletedRanges, groups });
    deletedMask.fill(0); deletedRanges = []; deleted = 0; groups = []; touch(); return true;
  }
  function restoreDeleted() {
    if (!deleted) return 0;
    const restored = deleted;
    remember({ type: 'restore', deletedRanges });
    deletedMask.fill(0); deletedRanges = []; deleted = 0; touch(); return restored;
  }
  function undo() {
    const entry = history.pop(); if (!entry) return false;
    if (entry.type === 'delete') {
      for (const [start, end] of entry.ranges) for (let id = start; id <= end; id++) {
        if (deletedMask[id]) { deletedMask[id] = 0; deleted--; }
        if (!selectedMask[id]) { selectedMask[id] = 1; selected++; }
      }
      deletedRanges = maskRanges(deletedMask);
    } else if (entry.type === 'groups') groups = entry.groups;
    else {
      deletedRanges = entry.deletedRanges;
      if (entry.type === 'reset') groups = entry.groups;
      deleted = rangeCount(deletedRanges);
      deletedMask.fill(0);
      for (const [start, end] of deletedRanges) deletedMask.fill(1, start, end + 1);
      for (let id = 0; id < count; id++) if (deletedMask[id] && selectedMask[id]) { selectedMask[id] = 0; selected--; }
    }
    touch(); return true;
  }
  function getSnapshot() {
    return { deleted: copyRanges(deletedRanges), groups: groups.map(group => ({ ...group, indices: copyRanges(group.indices) })) };
  }
  function getSummary() {
    if (!groupSummary) groupSummary = groups.map(group => {
      const total = rangeCount(group.indices);
      return { id: group.id, name: group.name, count: total, visibleCount: total - intersectionCount(group.indices, deletedRanges) };
    });
    return { total: count, visible: count - deleted, deleted, selected, groups: groupSummary.map(group => ({ ...group })),
      undoCount: history.length, canUndo: history.length > 0, revision };
  }
  return { count, getSnapshot, getSummary, getSelectedIds, applySelection, selectAllVisible, clearSelection,
    deleteSelected, undo, createGroup, selectGroup, removeGroup, renameGroup, resetEdits, restoreDeleted,
    // Read-only views for projection and rendering. Mutations must use this API.
    getDeletedMask: () => deletedMask, getSelectionMask: () => selectedMask };
}

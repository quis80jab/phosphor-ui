import { SCAN_SITES } from './scan-sites.js?v=scan-1';
/** Native controls are hit targets; the shared VFD skin paints their visible UI. */
export function mountViewerTools({ getState, getViewer, pause, save, refresh, getAvailable = () => true }) {
  const $ = id => document.getElementById(id);
  let asset = '', tool = 'orbit', summary = {}, groupSignature = '', destroyed = false;
  const listeners = [];
  function listen(element, event, fn) { element?.addEventListener(event, fn); listeners.push(() => element?.removeEventListener(event, fn)); }
  function status(message) { $('edit-status').textContent = message; refresh(); }
  function action(method, ...args) {
    pause();
    try {
      const result = getViewer()?.[method]?.(...args);
      if (result?.catch) result.catch(error => status(error?.message || 'The edit could not finish. Try again.'));
      return result;
    } catch (error) { status(error?.message || 'The edit could not finish. Try again.'); }
  }
  function groups() {
    const rows = Array.isArray(summary.groups) ? summary.groups : [];
    const signature = JSON.stringify(rows);
    if (signature === groupSignature) return;
    groupSignature = signature;
    const container = $('point-groups'); container.replaceChildren();
    if (!rows.length) {
      const empty = document.createElement('p'); empty.dataset.vfd = 'label'; empty.dataset.vfdTone = 'dim'; empty.textContent = 'NO GROUPS'; container.append(empty);
    }
    for (const group of rows) {
      const row = document.createElement('div'); row.className = 'point-group';
      const select = document.createElement('button'); select.type = 'button'; select.dataset.vfd = 'button'; select.textContent = group.name;
      select.dataset.groupId = group.id; select.title = `${group.name}: ${group.visibleCount ?? group.count ?? 0} visible points`;
      select.setAttribute('aria-label', `Select group ${group.name}`);
      select.addEventListener('click', () => action('selectGroup', group.id));
      const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.vfd = 'button'; remove.textContent = 'X';
      remove.setAttribute('aria-label', `Remove group ${group.name}`); remove.title = 'Remove group; keeps its points';
      remove.addEventListener('click', () => action('removeGroup', group.id));
      const count = document.createElement('span'); count.dataset.vfd = 'label'; count.dataset.vfdTone = 'dim'; count.textContent = `${(group.visibleCount ?? group.count ?? 0).toLocaleString()} POINTS`;
      row.append(select, remove, count); container.append(row);
    }
    document.dispatchEvent(new CustomEvent('viewer-grid-layout'));
  }
  function sync() {
    if (destroyed) return;
    const state = getState();
    if (asset !== state.asset) { asset = state.asset; summary = {}; tool = 'orbit'; groupSignature = ''; getViewer()?.setEditTool?.(tool); }
    const imported = ['pumpkin', 'shopping-center', 'snow-globe'].includes(asset);
    const ready = imported && getAvailable() && !summary.busy && Number(summary.total) > 0;
    $('voxel-size').value = String(state.voxelScale ?? 1);
    $('voxel-size').disabled = !imported || state.renderMode !== 'voxels';
    $('voxel-size').setAttribute('aria-valuetext', `${Number(state.voxelScale ?? 1).toFixed(2)} times display cell size`);
    $('voxel-size-value').textContent = `${Number(state.voxelScale ?? 1).toFixed(2)}X`;
    for (const button of document.querySelectorAll('[data-edit-tool]')) {
      button.setAttribute('aria-pressed', String(button.dataset.editTool === tool)); button.disabled = button.dataset.editTool !== 'orbit' && !ready;
    }
    const selected = Number(summary.selected) || 0;
    $('select-all').disabled = !ready || !summary.visible;
    $('clear-selection').disabled = !ready || !selected;
    $('delete-selection').disabled = !ready || !selected;
    $('undo-edit').disabled = !ready || !summary.canUndo;
    $('restore-points').disabled = !ready || !summary.deleted;
    $('create-group').disabled = !ready || !selected || (summary.groups?.length ?? 0) >= 32;
    $('group-name').disabled = !ready;
    $('point-count').textContent = (Number(summary.visible) || 0).toLocaleString();
    $('selected-count').textContent = selected.toLocaleString();
    $('deleted-count').textContent = (Number(summary.deleted) || 0).toLocaleString();
    const histogram = $('point-histogram');
    histogram.dataset.bins = JSON.stringify(summary.histogram || []);
    histogram.dataset.selectedBins = JSON.stringify(summary.selectedHistogram || []);
    histogram.setAttribute('aria-label', `Brightness histogram: ${Number(summary.visible) || 0} visible points, ${selected} selected`);
    groups();
    for (const button of $('point-groups').querySelectorAll('button')) button.disabled = !ready;
    $('edit-status').textContent = !imported ? 'SELECT AN IMPORTED SCENE' : summary.busy ? (summary.message || 'PREPARING POINTS') : !ready ? 'LOADING SCENE' : summary.message || (selected ? 'SELECTION READY' : 'READY TO SELECT');
    const hint = document.querySelector('.viewport-bottom>span');
    if (hint) hint.textContent = asset === 'sf-waterfront' || asset === 'mcap-replay' || Object.hasOwn(SCAN_SITES, asset) ? 'INSIDE: PAN / OUTSIDE: ORBIT' : tool === 'orbit' ? 'DRAG TO ORBIT' : tool === 'select' ? 'CLICK A POINT' : 'LASSO / ENTER TO CLOSE';
    refresh();
  }
  function receive(update) {
    if (destroyed || update.asset !== getState().asset) return;
    if (asset !== update.asset) { asset = update.asset; summary = {}; groupSignature = ''; tool = 'orbit'; }
    summary = { ...update.summary, message:update.message || update.summary?.message };
    if (update.snapshot) {
      const state = getState(); state.pointEdits = { ...state.pointEdits, [asset]:update.snapshot };
      if (update.changed) save();
    }
    sync();
  }
  for (const button of document.querySelectorAll('[data-edit-tool]')) listen(button, 'click', () => {
    tool = button.dataset.editTool; action('setEditTool', tool); sync();
  });
  listen($('voxel-size'), 'input', event => {
    const value = Math.max(.25, Math.min(8, Number(event.target.value) || 1));
    getState().voxelScale = value; action('setVoxelScale', value); sync(); save();
  });
  for (const [id, method] of [['select-all','selectAll'],['clear-selection','clearSelection'],['delete-selection','deleteSelected'],['undo-edit','undoEdit'],['restore-points','restorePoints']]) listen($(id), 'click', () => action(method));
  function createGroup() {
    if ($('create-group').disabled) return;
    const name = $('group-name').value.trim() || `Group ${(summary.groups?.length ?? 0) + 1}`;
    action('createGroup', name); $('group-name').value = ''; refresh();
  }
  listen($('create-group'), 'click', createGroup);
  listen($('group-name'), 'keydown', event => { if (event.key === 'Enter') { event.preventDefault(); createGroup(); } });
  listen($('cube-canvas'), 'keydown', event => {
    if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); if (!$('delete-selection').disabled) action('deleteSelected'); }
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) { event.preventDefault(); if (!$('undo-edit').disabled) action('undoEdit'); }
  });
  sync();
  return { sync, receive, destroy() { destroyed = true; listeners.forEach(remove => remove()); } };
}

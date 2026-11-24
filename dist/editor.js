import { DEFAULT_SETTINGS, normalizeSettings } from './settings.js?v=transport-2';
import { LIBRARY_KEY, MAX_CONFIGS, LENS_PRESETS, cleanName, sanitizeConfigs, parseConfigFile, exportConfigFile, uniqueName, mergeConfigs } from './config-store.js?v=transport-2';

const STORAGE_KEY = 'phosphor-screen-settings-v1';
const INTRO_KEY = 'phosphor-transport-screen-intro-v1';
export function readSavedSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const saved = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const migrated = Object.hasOwn(saved, 'anodeEnabled') ? saved : { ...saved, view: 'composite', tilt: 0, zoom: 100, fill: 67 };
    return normalizeSettings(!Object.hasOwn(saved, 'contrast') ? { ...migrated, contrast: 100 } : migrated);
  } catch { return { ...DEFAULT_SETTINGS }; }
}

export function mountEditor(effect) {
  const panel = document.querySelector('#display-editor');
  const launcher = document.querySelector('#show-editor');
  const hide = document.querySelector('#hide-editor');
  const status = document.querySelector('#editor-status');
  const note = document.querySelector('#config-note');
  const configSelect = document.querySelector('#saved-config');
  const configName = document.querySelector('#config-name');
  const inputs = [...panel.querySelectorAll('[data-setting]')];
  const shapes = [...panel.querySelectorAll('[data-shape]')];
  const tabs = [...panel.querySelectorAll('[data-tab]')];
  const id = () => crypto.randomUUID();
  let saveTimer, configs = [], undoEntry = null;

  function notice(message, error = false) { note.textContent = message; note.classList.toggle('error', error); }
  try { configs = sanitizeConfigs(JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]')); }
  catch {
    try { const raw = localStorage.getItem(LIBRARY_KEY); if (raw) localStorage.setItem(`${LIBRARY_KEY}-recovery`, raw); } catch {}
    notice('The saved library could not be read. A recovery copy was kept when storage was available.', true);
  }
  function persistLibrary(next) {
    const checked = sanitizeConfigs(next);
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(checked));
    configs = checked;
  }
  function syncView(settings) {
    const baked = document.querySelector('#screen').dataset.vfdMode === 'baked';
    document.querySelectorAll('[data-view]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.view === (baked ? 'composite' : settings.view)));
      button.disabled = baked && button.dataset.view === 'stack';
    });
  }
  function sync(settings) {
    for (const input of inputs) {
      const name = input.dataset.setting;
      if (input.type === 'checkbox') input.checked = settings[name];
      else input.value = settings[name];
      if (input.type === 'range') {
        const progress = (Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min)) * 100;
        input.style.setProperty('--range-fill', `${progress}%`);
        const unit = input.dataset.unit ?? '%';
        panel.querySelector(`[data-output="${name}"]`).textContent = `${settings[name]}${unit}`;
      }
    }
    for (const layer of panel.querySelectorAll('[data-layer]')) {
      const enabled = settings[`${layer.dataset.layer}Enabled`];
      layer.dataset.enabled = String(enabled);
      layer.querySelector('fieldset.layer-controls').disabled = !enabled;
    }
    const enabledCount = ['anode', 'phosphor', 'grid', 'filament', 'glass', 'glow'].filter(key => settings[`${key}Enabled`]).length;
    document.querySelector('#layer-count').textContent = `${enabledCount} layers active`;
    document.querySelector('#dot-dimension').textContent = `${(.3 * settings.fill / 67).toFixed(3)} mm dots`;
    for (const button of shapes) button.setAttribute('aria-pressed', String(button.dataset.shape === settings.shape));
    for (const button of panel.querySelectorAll('[data-lens-preset]')) {
      const preset = LENS_PRESETS[button.dataset.lensPreset];
      button.setAttribute('aria-pressed', String(Object.entries(preset).every(([key,value]) => settings[key] === value)));
    }
    syncView(settings);
    document.documentElement.style.setProperty('--display-brightness', settings.brightness / 100);
    const reference = ['reference','transport'].includes(settings.signal);
    const transport = settings.signal === 'transport';
    document.querySelector('.matrix-heading').textContent = transport ? 'Character + graphic interface.' : settings.signal === 'reference' ? 'Position setting interface.' : 'Phosphor display laboratory.';
    document.querySelector('.brand span').textContent = transport ? 'GU126×64F' : 'MN12864K';
    document.querySelectorAll('[data-screen-choice]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.screenChoice === settings.signal)));
    const captions = transport ? ['CHARACTER + GRAPHIC','Track transport','Live controls'] : ['POSITION SETTING','Four channels','Live controls'];
    document.querySelectorAll('.reference-caption span').forEach((span,index) => span.textContent = captions[index]);
    document.body.classList.toggle('reference-active', reference);
    document.querySelector('.button-stage').hidden = reference;
    document.querySelector('.scene-caption').hidden = reference;
    document.querySelector('.reference-caption').hidden = !reference;
    document.querySelector('.scene-hint').textContent = transport ? 'Play / pause, skip tracks, or stop. Space plays; left and right change tracks. Demo playback.' : reference ? 'Click the display buttons. Arrow keys adjust position; SET confirms it.' : '57.45 × 28.65 mm active area · Move across the matrix to move the cursor.';
    document.querySelector('#screen').setAttribute('aria-label', transport ? 'Interactive character and graphic VFD screen. GU126x64F-K612A4, 8 line 21 characters, SPI and RS232 Serial Interface. Stop, previous track, play or pause, and next track controls with track number and timer.' : reference ? 'Interactive position setting screen matching the supplied reference, with F1 through F4, four ON and OFF channel pairs, directional controls and SET.' : `An MN12864K active matrix with 128 by 64 square phosphor dots, ${enabledCount} enabled optical layers, and ${settings.phosphor} phosphor. ${settings.phosphorEnabled ? 'Demo text is illuminated.' : 'Phosphor is hidden; the demo signal is preserved.'} Move your pointer or use arrow keys to move the cursor.`);
  }
  function saveCurrent() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(effect.getSettings())); status.textContent = 'Current look saved'; }
    catch { status.textContent = 'Current look is session only'; }
  }
  function update(patch) {
    sync(effect.configure(patch));
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 150);
  }
  function selectTab(name, focus = false) {
    for (const tab of tabs) {
      const active = tab.dataset.tab === name;
      tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
      document.querySelector(`#panel-${tab.dataset.tab}`).hidden = !active;
      if (active && focus) tab.focus();
    }
    panel.querySelector('.editor-scroll').scrollTop = 0;
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => selectTab(tab.dataset.tab));
    tab.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      if (next !== undefined) { event.preventDefault(); selectTab(tabs[next].dataset.tab, true); }
    });
  });
  for (const input of inputs) input.addEventListener('input', () => update({ [input.dataset.setting]: input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value }));
  panel.querySelectorAll('.layer-switch').forEach(label => label.addEventListener('click', event => event.stopPropagation()));
  for (const button of shapes) button.addEventListener('click', () => update({ shape: button.dataset.shape }));
  document.querySelectorAll('[data-screen-choice]').forEach(button => button.addEventListener('click', () => update({signal:button.dataset.screenChoice,view:'composite'})));
  document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => update({ view: button.dataset.view })));
  panel.querySelectorAll('[data-lens-preset]').forEach(button => button.addEventListener('click', () => update(LENS_PRESETS[button.dataset.lensPreset])));
  document.querySelector('#lens-to-configs').addEventListener('click', () => { selectTab('configs'); configName.focus(); });
  document.querySelector('#reset-display').addEventListener('click', () => { update({ ...DEFAULT_SETTINGS, signal:effect.getSettings().signal }); status.textContent = 'Screen defaults restored'; });

  function renderLibrary(selected = configSelect.value) {
    configSelect.replaceChildren(new Option('Choose a config', ''));
    for (const config of configs) configSelect.add(new Option(config.name, config.id));
    configSelect.value = configs.some(config => config.id === selected) ? selected : '';
    const hasSelection = Boolean(configSelect.value);
    document.querySelector('#load-config').disabled = !hasSelection;
    document.querySelector('#delete-config').disabled = !hasSelection;
    document.querySelector('#export-configs').disabled = !configs.length;
  }
  function refreshLibrary() {
    configs = sanitizeConfigs(JSON.parse(localStorage.getItem(LIBRARY_KEY) || '[]'));
    renderLibrary();
  }
  function refreshForEdit() {
    try { refreshLibrary(); return true; }
    catch { notice('Could not read the latest saved library. Your configs were not changed.', true); return false; }
  }
  window.addEventListener('storage', event => {
    if (event.key === LIBRARY_KEY) {
      if (refreshForEdit()) notice('Saved configs updated in another tab.');
    }
  });
  configSelect.addEventListener('change', () => renderLibrary());
  document.querySelector('#save-config-form').addEventListener('submit', event => {
    event.preventDefault();
    if (!refreshForEdit()) return;
    const name = cleanName(configName.value);
    if (!name) { notice('Give this look a name first.', true); configName.focus(); return; }
    if (configs.length >= MAX_CONFIGS) { notice('Your library has 50 configs. Export a backup before removing one.', true); return; }
    const config = { id: id(), name: uniqueName(name, configs), settings: effect.getSettings() };
    try {
      persistLibrary([...configs, config]); renderLibrary(config.id); configName.value = '';
      notice(`Saved “${config.name}”.`); saveCurrent();
    } catch { notice('Could not save to this browser. Export a backup of the existing library.', true); }
  });
  document.querySelector('#load-config').addEventListener('click', () => {
    if (!refreshForEdit()) return;
    const config = configs.find(entry => entry.id === configSelect.value);
    if (!config) return;
    update(config.settings); notice(`Loaded “${config.name}”.`);
  });
  document.querySelector('#delete-config').addEventListener('click', () => {
    if (!refreshForEdit()) return;
    const index = configs.findIndex(entry => entry.id === configSelect.value);
    if (index < 0) return;
    const removed = configs[index];
    try {
      persistLibrary(configs.filter(entry => entry.id !== removed.id)); undoEntry = { config: removed, index };
      renderLibrary(); document.querySelector('#undo-delete').hidden = false; notice(`Deleted “${removed.name}”. Undo is available.`);
    } catch { notice('Could not delete this config. Your library is unchanged.', true); }
  });
  document.querySelector('#undo-delete').addEventListener('click', () => {
    if (!undoEntry || !refreshForEdit()) return;
    if (configs.length >= MAX_CONFIGS) { notice('Make room in the library before restoring this config.', true); return; }
    const restored = { ...undoEntry.config }, next = [...configs];
    if (configs.some(entry => entry.id === restored.id)) restored.id = id();
    next.splice(Math.min(undoEntry.index, next.length), 0, restored);
    try { persistLibrary(next); undoEntry = null; renderLibrary(restored.id); document.querySelector('#undo-delete').hidden = true; notice(`Restored “${restored.name}”.`); }
    catch { notice('Could not restore the config. Try again.', true); }
  });
  document.querySelector('#export-configs').addEventListener('click', () => {
    if (!refreshForEdit()) return;
    const blob = new Blob([exportConfigFile(configs)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'phosphor-configs.json'; document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000); notice(`Exported ${configs.length} configs.`);
  });
  const fileInput = document.querySelector('#config-file');
  document.querySelector('#import-configs').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Choose a JSON config file smaller than 1 MB.');
      const imported = parseConfigFile(await file.text());
      refreshLibrary();
      const result = mergeConfigs(configs, imported, id);
      persistLibrary(result.configs); renderLibrary(); notice(result.added ? `Imported ${result.added} configs.` : 'These configs are already saved.');
    } catch (error) { notice(error instanceof Error ? error.message : 'Could not import these configs.', true); }
    fileInput.value = '';
  });

  function setOpen(open) {
    panel.hidden = !open; launcher.hidden = open; launcher.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('editor-open', open); requestAnimationFrame(() => effect.refreshLayout());
    if (open) hide.focus(); else launcher.focus();
  }
  hide.addEventListener('click', () => setOpen(false)); launcher.addEventListener('click', () => setOpen(true));
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); } });
  window.addEventListener('pagehide', () => { clearTimeout(saveTimer); saveCurrent(); });

  // Preserve prior looks before introducing the second reference interface.
  try {
    if (!localStorage.getItem(INTRO_KEY)) {
      const next = [...configs];
      const prior = effect.getSettings();
      const introduced = { ...prior, signal:'transport', view:'composite', tilt:0, zoom:100 };
      const hasPrior = Boolean(localStorage.getItem(STORAGE_KEY));
      if (hasPrior && !next.some(entry => JSON.stringify(entry.settings) === JSON.stringify(prior))) {
        if (next.length >= MAX_CONFIGS) throw new Error('The library is full.');
        next.push({ id: id(), name: uniqueName('Before transport screen', next), settings: prior });
      }
      if (!hasPrior && next.length < MAX_CONFIGS) next.push({ id: id(), name: uniqueName('Position setting', next), settings: { ...DEFAULT_SETTINGS, signal:'reference' } });
      if (next.length < MAX_CONFIGS) next.push({ id: id(), name: uniqueName('Character + graphic', next), settings: introduced });
      persistLibrary(next);
      localStorage.setItem(INTRO_KEY, '1');
      update(introduced);
      renderLibrary(next.at(-1)?.id);
      notice(hasPrior ? 'Your previous display settings are preserved in the library.' : 'Save your looks here. Export a copy to keep a backup.');
    } else renderLibrary();
  } catch { renderLibrary(); notice('Your existing settings are unchanged. Save or export a config before resetting.', true); }
  sync(effect.getSettings());

  const canvas = document.querySelector('#screen');
  canvas.addEventListener('vfd-menu-state', () => {
    sync(effect.getSettings());
    clearTimeout(saveTimer); saveTimer = setTimeout(saveCurrent,150);
  });
  const bakeButton = document.querySelector('#bake-color');
  const previewButton = document.querySelector('#preview-bake');
  const downloadButton = document.querySelector('#download-bake');
  const bakeStatus = document.querySelector('#bake-status');
  let bakedBlob = null;
  function syncBake() {
    syncView(effect.getSettings());
    const available = effect.hasBake();
    previewButton.disabled = downloadButton.disabled = !available || !bakedBlob;
    if (!available) {
      bakedBlob = null;
      previewButton.setAttribute('aria-pressed', 'false');
      previewButton.textContent = 'Preview bake';
      document.querySelector('#render-mode').textContent = 'LIVE OPTICS';
      bakeStatus.textContent = 'Flatten the enabled layers into a color texture.';
    }
  }
  canvas.addEventListener('vfd-bake-state', syncBake);
  canvas.addEventListener('vfd-context-state', event => {
    bakeButton.disabled = !event.detail.available;
    const error = document.querySelector('#render-error');
    error.hidden = event.detail.available;
    error.textContent = event.detail.available ? '' : 'The graphics connection was interrupted. Waiting for the display to recover…';
    if (event.detail.available) syncBake();
  });
  bakeButton.addEventListener('click', async () => {
    bakeButton.disabled = true;
    bakeStatus.textContent = 'Baking the current light…';
    try {
      const result = await effect.bakeColor();
      bakedBlob = result.blob;
      syncBake();
      const showing = effect.setBaked(true);
      previewButton.setAttribute('aria-pressed', String(showing));
      previewButton.textContent = showing ? 'Return to live' : 'Preview bake';
      document.querySelector('#render-mode').textContent = showing ? 'BAKED TEXTURE' : 'LIVE OPTICS';
      bakeStatus.textContent = `${result.width} × ${result.height} color texture ready. Enabled layers are flattened; the live setup is preserved.`;
    } catch (error) {
      bakeStatus.textContent = error instanceof Error ? error.message : 'Could not bake this frame. Try again.';
    } finally { bakeButton.disabled = false; }
  });
  previewButton.addEventListener('click', () => {
    const enabled = previewButton.getAttribute('aria-pressed') !== 'true';
    const showing = effect.setBaked(enabled);
    previewButton.setAttribute('aria-pressed', String(showing));
    previewButton.textContent = showing ? 'Return to live' : 'Preview bake';
    document.querySelector('#render-mode').textContent = showing ? 'BAKED TEXTURE' : 'LIVE OPTICS';
  });
  downloadButton.addEventListener('click', () => {
    if (!bakedBlob || !effect.hasBake()) return;
    const url = URL.createObjectURL(bakedBlob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = effect.getSettings().signal === 'transport' ? 'GU126x64F-transport-color-1024x512.png' : 'MN12864K-color-1024x512.png';
    document.body.append(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    bakeStatus.textContent = 'Downloaded the baked color texture.';
  });
}

import { UI_CELL, UI_SCALE } from './viewer-grid.js?v=pane-140';
const GRID = UI_CELL;
const OPTION_HEIGHT = GRID * 3;
let nextMenuId = 0;
const snapUp = value => Math.ceil(value / GRID) * GRID;
const snapDown = value => Math.floor(value / GRID) * GRID;
const restoreAttribute = (element, name, value) => value === null ? element.removeAttribute(name) : element.setAttribute(name, value);

/** Preserve native select values/events while painting their popup on the VFD grid. */
export function mountGridMenus({ refresh = () => {} } = {}) {
  const selects = [...document.querySelectorAll('select')].filter(select => !select.multiple && select.size <= 1);
  const originals = new Map(selects.map(select => [select, {
    expanded: select.getAttribute('aria-expanded'),
    controls: select.getAttribute('aria-controls'),
    popup: select.getAttribute('aria-haspopup')
  }]));
  const recentPointer = new WeakMap();
  let current = null, destroyed = false;

  function changed() { if (!destroyed) refresh(); }
  function close({ focus = false } = {}) {
    if (!current) return;
    const { select, menu } = current;
    current = null;
    menu.remove();
    select.setAttribute('aria-expanded', 'false');
    restoreAttribute(select, 'aria-controls', originals.get(select)?.controls ?? null);
    if (focus && select.isConnected && !select.disabled) select.focus({ preventScroll: true });
    changed();
  }
  function focusOption(index) {
    if (!current) return;
    const { buttons, menu } = current, button = buttons[index];
    if (!button || button.disabled) return;
    current.index = index;
    buttons.forEach((entry, entryIndex) => { entry.tabIndex = entryIndex === index ? 0 : -1; });
    menu.setAttribute('aria-activedescendant', button.id);
    button.focus({ preventScroll: true });
    const top = button.offsetTop, bottom = top + button.offsetHeight;
    if (top < menu.scrollTop + GRID) menu.scrollTop = Math.max(0, top - GRID);
    else if (bottom > menu.scrollTop + menu.clientHeight - GRID) menu.scrollTop = bottom - menu.clientHeight + GRID;
    changed();
  }
  function move(direction, edge = false) {
    if (!current) return;
    const enabled = current.buttons.map((button, index) => button.disabled ? -1 : index).filter(index => index >= 0);
    if (!enabled.length) return;
    const position = enabled.indexOf(current.index);
    const index = edge ? (direction > 0 ? enabled.at(-1) : enabled[0]) :
      enabled[(position + direction + enabled.length) % enabled.length];
    focusOption(index);
  }
  function commit(index) {
    if (!current || current.buttons[index]?.disabled) return;
    const { select, options } = current, option = options[index];
    if (!option || option.disabled) return;
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    close();
    if (select.isConnected && !select.disabled) select.focus({ preventScroll: true });
    changed();
  }
  function position(menu, select, labels) {
    const rect = select.getBoundingClientRect();
    const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    const margin = viewportWidth >= GRID * 4 ? GRID : 0;
    const availableWidth = Math.max(GRID, snapDown(viewportWidth - margin * 2));
    const preferredWidth = snapUp(Math.max(rect.width, ...labels.map(label => [...label].length * 12 * UI_SCALE + GRID * 4)));
    const width = Math.min(availableWidth, preferredWidth);
    const maxHeight = Math.max(GRID, snapDown(viewportHeight - margin * 2));
    const naturalHeight = labels.length * OPTION_HEIGHT + Math.max(0, labels.length - 1) * GRID + GRID * 2;
    const height = Math.min(maxHeight, naturalHeight);
    const maxLeft = Math.max(margin, snapDown(viewportWidth - width - margin));
    const left = Math.max(margin, Math.min(maxLeft, snapDown(rect.left)));
    const below = snapUp(rect.bottom + GRID), above = snapDown(rect.top - height - GRID);
    const top = below + height <= viewportHeight - margin ? below : above >= margin ? above : margin;
    Object.assign(menu.style, {
      position: 'fixed', left: `${left}px`, top: `${top}px`, width: `${width}px`,
      maxHeight: `${maxHeight}px`, boxSizing: 'border-box', overflowY: 'auto',
      overscrollBehavior: 'contain', zIndex: '15', display: 'flex', flexDirection: 'column',
      padding: `${GRID}px`, gap: `${GRID}px`, fontFamily: '"Phosphor Pixel", monospace', fontSize: `${20 * UI_SCALE}px`
    });
  }
  function open(select, direction = 1) {
    if (destroyed || select.disabled || !select.isConnected) return;
    if (current?.select === select) { close({ focus: true }); return; }
    close();
    const options = [...select.options], labels = options.map(option => option.label || option.textContent || option.value);
    if (!options.length) return;
    const menu = document.createElement('div');
    menu.id = `viewer-grid-menu-${++nextMenuId}`;
    menu.className = 'grid-select-menu';
    menu.dataset.vfd = 'panel'; menu.dataset.vfdOpaque = 'true';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', select.getAttribute('aria-label') || select.labels?.[0]?.textContent?.trim() || 'Choose an option');
    const buttons = options.map((option, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.id = `${menu.id}-option-${index}`;
      button.setAttribute('role', 'option'); button.setAttribute('aria-selected', String(option.selected));
      button.dataset.vfd = 'button'; button.textContent = labels[index];
      button.tabIndex = -1;
      button.disabled = option.disabled || option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.disabled;
      Object.assign(button.style, { height: `${OPTION_HEIGHT}px`, minHeight: `${OPTION_HEIGHT}px`, flex: `0 0 ${OPTION_HEIGHT}px`, width: '100%', font: 'inherit' });
      button.addEventListener('click', () => commit(index));
      button.addEventListener('focus', () => {
        if (current?.menu !== menu) return;
        current.index = index;
        buttons.forEach((entry, entryIndex) => { entry.tabIndex = entryIndex === index ? 0 : -1; });
        menu.setAttribute('aria-activedescendant', button.id); changed();
      });
      menu.append(button); return button;
    });
    position(menu, select, labels);
    current = { select, menu, buttons, options, index: -1 };
    select.setAttribute('aria-expanded', 'true'); select.setAttribute('aria-controls', menu.id);
    document.body.append(menu);
    const selected = buttons.findIndex((button, index) => options[index].selected && !button.disabled);
    const enabled = buttons.map((button, index) => button.disabled ? -1 : index).filter(index => index >= 0);
    focusOption(selected >= 0 ? selected : direction < 0 ? enabled.at(-1) : enabled[0]);
    changed();
  }
  function pointer(event) {
    const select = event.currentTarget;
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    if (event.type === 'mousedown' && performance.now() - (recentPointer.get(select) ?? -Infinity) < 700) return;
    if (event.type === 'pointerdown') recentPointer.set(select, performance.now());
    open(select);
  }
  function click(event) {
    event.preventDefault();
    // Accessibility activation can dispatch a click without pointer events.
    if (event.detail === 0 && !current) open(event.currentTarget);
  }
  function selectKey(event) {
    if (['Enter', ' ', 'Spacebar', 'ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      if (current?.select === event.currentTarget) move(event.key === 'ArrowUp' ? -1 : 1);
      else open(event.currentTarget, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Escape' && current?.select === event.currentTarget) {
      event.preventDefault(); close({ focus: true });
    }
  }
  function menuKey(event) {
    if (!current || !current.menu.contains(event.target)) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); move(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault(); move(event.key === 'End' ? 1 : -1, true);
    } else if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault(); commit(current.index);
    } else if (event.key === 'Escape') {
      event.preventDefault(); close({ focus: true });
    } else if (event.key === 'Tab') close({ focus: true });
  }
  function outside(event) {
    if (!current || current.menu.contains(event.target) || current.select.contains(event.target)) return;
    close();
  }
  function scroll(event) {
    if (!current) return;
    if (event.target === current.menu || current.menu.contains(event.target)) { changed(); return; }
    close();
  }
  function nativeChange(event) {
    if (current?.select === event.currentTarget) close();
    changed();
  }
  function resize() { close(); }
  for (const select of selects) {
    select.setAttribute('aria-haspopup', 'listbox'); select.setAttribute('aria-expanded', 'false');
    select.addEventListener('pointerdown', pointer); select.addEventListener('mousedown', pointer);
    select.addEventListener('click', click); select.addEventListener('keydown', selectKey);
    select.addEventListener('change', nativeChange);
  }
  document.addEventListener('pointerdown', outside, true);
  document.addEventListener('mousedown', outside, true);
  document.addEventListener('keydown', menuKey);
  document.addEventListener('focusin', outside);
  window.addEventListener('scroll', scroll, { capture: true, passive: true });
  window.addEventListener('resize', resize);
  return {
    destroy() {
      if (destroyed) return;
      close(); destroyed = true;
      for (const select of selects) {
        select.removeEventListener('pointerdown', pointer); select.removeEventListener('mousedown', pointer);
        select.removeEventListener('click', click); select.removeEventListener('keydown', selectKey);
        select.removeEventListener('change', nativeChange);
        const original = originals.get(select);
        restoreAttribute(select, 'aria-expanded', original.expanded);
        restoreAttribute(select, 'aria-controls', original.controls);
        restoreAttribute(select, 'aria-haspopup', original.popup);
      }
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('mousedown', outside, true);
      document.removeEventListener('keydown', menuKey);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('scroll', scroll, true); window.removeEventListener('resize', resize);
    }
  };
}

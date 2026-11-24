import { REFERENCE_BUTTONS } from './reference-screen.js?v=transport-2';
import { TRANSPORT_BUTTONS } from './transport-screen.js?v=transport-2';

export function mountReferenceControls(canvas, effect) {
  const container = document.createElement('div');
  container.className = 'reference-controls';
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', 'Display menu controls');
  const status = document.createElement('span');
  status.className = 'reference-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  container.append(status);
  Object.assign(container.style, {
    position: 'absolute', left: '0', top: '0', width: '256px', height: '128px',
    transformOrigin: '0 0', pointerEvents: 'none'
  });
  let destroyed = false;
  let hoveredId = null;
  let focusedId = null;
  let currentScreen = null;
  const buttons = new Map();
  const directionKeys = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const transportKeys = { ArrowLeft: 'previous', ArrowRight: 'next' };
  const transportLabels = { stop: 'Stop', previous: 'Previous track', play: 'Play', next: 'Next track' };

  function feedback(patch) {
    const nextHovered = Object.hasOwn(patch, 'hoveredId') ? patch.hoveredId : hoveredId;
    const nextFocused = Object.hasOwn(patch, 'focusedId') ? patch.focusedId : focusedId;
    if (nextHovered === hoveredId && nextFocused === focusedId) return;
    hoveredId = nextHovered;
    focusedId = nextFocused;
    effect.setControlFeedback({ hoveredId, focusedId });
  }

  function pressed(id, menu) {
    const functionMatch = /^f([1-4])$/.exec(id);
    if (functionMatch) return Boolean(menu.functions?.[Number(functionMatch[1]) - 1]);
    const channelMatch = /^channel-([0-3])-(off|on)$/.exec(id);
    if (channelMatch) return Boolean(menu.channels?.[Number(channelMatch[1])]) === (channelMatch[2] === 'on');
    if (id === 'set') return Boolean(menu.confirmed);
    const itemMatch = /^item-([a-d])([1-4])$/.exec(id);
    if (itemMatch) return menu.selected === `${itemMatch[1].toUpperCase()}-${itemMatch[2]}`;
    return null;
  }

  function refresh() {
    if (destroyed) return;
    const settings = effect.getSettings();
    const projection = effect.getControlProjection();
    const matrix = projection?.matrix;
    const validMatrix = matrix?.length === 6 && Array.from(matrix).every(Number.isFinite);
    const isTransport = settings.signal === 'transport';
    const visible = Boolean(projection?.visible && validMatrix && ['reference', 'transport'].includes(settings.signal) &&
      settings.phosphorEnabled !== false && settings.view !== 'stack' && canvas.dataset.vfdMode !== 'baked');
    container.hidden = !visible;
    container.setAttribute('aria-label', isTransport ? 'Transport controls' : 'Position setting controls');
    status.setAttribute('aria-live', isTransport ? 'off' : 'polite');
    const menu = settings.menu || {};
    const transport = settings.transport || {};
    const elapsed = Math.max(0, Math.floor(Number(transport.elapsed) || 0));
    const statusText = isTransport
      ? `Track ${transport.track ?? 1}. ${transport.playing ? 'Playing' : transport.stopped ? 'Stopped' : 'Paused'}. Elapsed ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}.`
      : `X: ${((menu.x || 0) / 100).toFixed(2)} mm. Y: ${((menu.y || 0) / 100).toFixed(2)} mm. ${menu.confirmed ? 'Position confirmed.' : 'Position unconfirmed.'}`;
    if (status.textContent !== statusText) status.textContent = statusText;
    if (validMatrix) container.style.transform = `matrix(${Array.from(matrix).join(',')})`;
    for (const [id, button] of buttons) {
      const active = button.dataset.screen === settings.signal;
      button.hidden = !active;
      button.disabled = !visible || !active;
      const value = button.dataset.screen === 'transport'
        ? id === 'play' ? Boolean(transport.playing) : id === 'stop' ? Boolean(transport.stopped) : null
        : pressed(id, menu);
      if (button.dataset.screen === 'transport' && id === 'play') button.setAttribute('aria-label', transport.playing ? 'Pause' : 'Play');
      if (value === null) button.removeAttribute('aria-pressed');
      else button.setAttribute('aria-pressed', String(value));
    }
    const changedScreen = currentScreen !== settings.signal;
    currentScreen = settings.signal;
    if (!visible || changedScreen) feedback({ hoveredId: null, focusedId: null });
  }

  const controls = [
    ...REFERENCE_BUTTONS.map(control => ({ ...control, screen: 'reference' })),
    ...TRANSPORT_BUTTONS.map(control => ({ ...control, screen: 'transport' }))
  ];
  for (const control of controls) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'reference-control';
    button.dataset.control = control.id;
    button.dataset.kind = control.kind;
    button.dataset.screen = control.screen;
    button.setAttribute('aria-label', control.screen === 'transport' ? transportLabels[control.id] : control.kind === 'channel' ? `${['A-1','B-2','C-3','D-4'][control.channel]} ${control.label}` : control.label);
    Object.assign(button.style, {
      position: 'absolute', left: `${control.x}px`, top: `${control.y}px`,
      width: `${control.width}px`, height: `${control.height}px`, pointerEvents: 'auto'
    });
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'keyup']) {
      button.addEventListener(type, event => event.stopPropagation());
    }
    button.addEventListener('click', event => {
      event.stopPropagation();
      if (button.disabled || destroyed) return;
      effect.activateControl(control.id);
      refresh();
    });
    button.addEventListener('keydown', event => {
      event.stopPropagation();
      const direction = (control.screen === 'transport' ? transportKeys : directionKeys)[event.key];
      if (!direction || button.disabled || destroyed) return;
      event.preventDefault();
      effect.activateControl(direction);
      refresh();
    });
    button.addEventListener('pointerenter', event => {
      if (!button.disabled && event.pointerType !== 'touch') feedback({ hoveredId: control.id });
    });
    button.addEventListener('pointerleave', () => {
      if (hoveredId === control.id) feedback({ hoveredId: null });
    });
    button.addEventListener('pointercancel', () => {
      if (hoveredId === control.id) feedback({ hoveredId: null });
    });
    button.addEventListener('focus', () => {
      if (!button.disabled) feedback({ focusedId: control.id });
    });
    button.addEventListener('blur', () => {
      if (focusedId === control.id) feedback({ focusedId: null });
    });
    buttons.set(control.id, button);
    container.append(button);
  }
  canvas.parentElement.append(container);
  const events = ['vfd-layout', 'vfd-menu-state', 'vfd-bake-state', 'vfd-context-state'];
  for (const type of events) canvas.addEventListener(type, refresh);
  refresh();

  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      for (const type of events) canvas.removeEventListener(type, refresh);
      feedback({ hoveredId: null, focusedId: null });
      container.remove();
    }
  };
}

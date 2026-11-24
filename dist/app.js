import { mountReferenceControls } from './reference-controls.js?v=transport-2';
import { initVFD } from './vfd-renderer.js?v=transport-2';
import { readSavedSettings, mountEditor } from './editor.js?v=transport-2';
const screen = document.querySelector('#screen');
const main = screen.parentElement;
const buttons = [...document.querySelectorAll('.phosphor-button')];
let effect;
try {
  effect = initVFD(screen, buttons, readSavedSettings());
} catch (error) {
  const message = document.querySelector('#render-error');
  message.hidden = false;
  message.textContent = 'The 3D display needs WebGL 2. Enable hardware acceleration and reload this page.';
  document.querySelector('#bake-color').disabled = true;
  console.error(error);
}
if (effect) {
mountEditor(effect);
mountReferenceControls(screen,effect);
effect.refreshLayout();
const bounds = screen.getBoundingClientRect();
let position = { x: bounds.left + bounds.width * .5, y: bounds.top + bounds.height * .5 };
function move(event) {
  if (!event.isPrimary) return;
  position = { x: event.clientX, y: event.clientY };
  effect.move(position.x, position.y);
  if (event.pointerType !== 'touch') main.classList.add('has-pointer');
}
main.addEventListener('pointermove', move, { passive: true });
main.addEventListener('pointerdown', event => {
  if (!event.isPrimary) return;
  move(event);
  effect.pulse();
  if (!event.target.closest('button')) main.setPointerCapture(event.pointerId);
});
main.addEventListener('pointerup', event => {
  if (main.hasPointerCapture(event.pointerId)) main.releasePointerCapture(event.pointerId);
});
main.addEventListener('pointerleave', () => main.classList.remove('has-pointer'));
window.addEventListener('blur', () => main.classList.remove('has-pointer'));
main.addEventListener('keydown', event => {
  if (event.target.closest('button')) return;
  if (effect.getSettings().signal === 'transport') {
    const action = {ArrowLeft:'previous',ArrowRight:'next',Enter:'play',' ':'play',Escape:'stop'}[event.key];
    if (action) { event.preventDefault(); effect.activateControl(action); }
    return;
  }
  if (effect.getSettings().signal === 'reference') {
    const action = {ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',Enter:'set',' ':'set',F1:'f1',F2:'f2',F3:'f3',F4:'f4'}[event.key];
    if (action) { event.preventDefault(); effect.activateControl(action); }
    return;
  }
  const step = event.shiftKey ? 50 : 15;
  const delta = {ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
  if (delta) {
    event.preventDefault();
    const rect = screen.getBoundingClientRect();
    position.x = Math.max(rect.left + 4, Math.min(rect.right - 4, position.x + delta[0]));
    position.y = Math.max(rect.top + 4, Math.min(rect.bottom - 4, position.y + delta[1]));
    effect.move(position.x, position.y);
  } else if (event.key === ' ' || event.key === 'Enter') {
    event.preventDefault();effect.pulse();
  }
});
buttons.forEach((button, index) => {
  button.addEventListener('pointerenter', () => effect.setButton(index, { hovered: true }));
  button.addEventListener('pointerleave', () => effect.setButton(index, { hovered: false, pressed: false }));
  button.addEventListener('focus', () => effect.setButton(index, { focused: button.matches(':focus-visible') }));
  button.addEventListener('blur', () => effect.setButton(index, { focused: false, pressed: false }));
  button.addEventListener('pointerdown', () => effect.setButton(index, { pressed: true }));
  button.addEventListener('pointerup', () => effect.setButton(index, { pressed: false }));
  button.addEventListener('pointercancel', () => effect.setButton(index, { pressed: false, hovered: false }));
  button.addEventListener('click', event => {
    const active = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(active));
    effect.setButton(index, { active, pressed: false });
    if (event.detail === 0) {
      effect.pulse();
    }
  });
});
window.addEventListener('pagehide', () => effect.suspend());
window.addEventListener('pageshow', () => effect.resume());

}

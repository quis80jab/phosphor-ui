// Layer 6: elements put together. Nothing is drawn here that a lower layer does not draw:
// a panel is a frame, a title and the elements inside it, each at whole pixels of its own.
import {text, fill, hline, outline, part} from './primitives.js';
import {MINT, DIM, PANEL} from '../palette.js';
import {button, toggle, segmented, slider, select} from './controls.js';
import {label, keyvalue, value, badge, origin, tableHead, tableRow, alert, steps} from './readouts.js';
import {attitude, heading, altitude, position, battery, lease} from './views.js';
import {target, check, mission, transport} from './site.js';

/** A panel's frame and title. Gives back the room inside it. `from` puts the origin tag in its head. */
export function panel(ctx, box, title, {from} = {}) {
  fill(ctx, box.x, box.y, box.width, box.height, PANEL);
  outline(ctx, box.x, box.y, box.width, box.height, DIM);
  outline(ctx, box.x + 3, box.y + 3, box.width - 6, box.height - 6, DIM);
  text(ctx, title, box.x + 8, box.y + 8, MINT, {room: box.width - 16 - (from ? 58 : 0)});
  if (from) origin(ctx, part(box, box.width - 60, 6, 52, 11), {origin: from, align: 'right'});
  hline(ctx, box.x + 8, box.y + 19, box.width - 16, DIM);
  return {x: box.x + 8, y: box.y + 24, width: box.width - 16, height: box.height - 32};
}

const SENSOR_COLUMNS = [{title: 'SENSOR', share: 3}, {title: 'PORT', share: 3}, {title: 'HZ', share: 1.4, align: 'right'}];

/** A Device as the operator's resource says it: what it is, where it runs, whether it is ready, and its Sensors' ports. */
export function deviceCard(ctx, box, s = {}) {
  const inner = panel(ctx, box, s.name ?? 'DEVICE', {from: s.origin});
  keyvalue(ctx, part(inner, 0, 0, inner.width, 10), {key: 'ROLE', value: s.role});
  keyvalue(ctx, part(inner, 0, 10, inner.width, 10), {key: 'MODEL', value: s.model});
  keyvalue(ctx, part(inner, 0, 20, inner.width, 10), {key: 'CLUSTER', value: s.cluster});
  badge(ctx, part(inner, 0, 32, inner.width, 10), {level: s.ready ? 'ok' : 'fail', text: s.ready ? 'READY' : 'NOT READY'});
  tableHead(ctx, part(inner, 0, 46, inner.width, 12), {columns: SENSOR_COLUMNS});
  (s.sensors || []).forEach((sensor, i) => {
    if (58 + (i + 1) * 12 > inner.height) return;
    tableRow(ctx, part(inner, 0, 58 + i * 12, inner.width, 12), {columns: SENSOR_COLUMNS, cells: [sensor.name, sensor.port, sensor.rate]});
  });
}

/** A Module as its resource says it: how it runs, its ports bound or not, whether it brings an app. */
export function moduleTile(ctx, box, s = {}) {
  const inner = panel(ctx, box, s.name ?? 'MODULE');
  keyvalue(ctx, part(inner, 0, 0, inner.width, 10), {key: 'RUNS', value: s.runs});
  keyvalue(ctx, part(inner, 0, 10, inner.width, 10), {key: 'INPUTS', value: s.inputs});
  keyvalue(ctx, part(inner, 0, 20, inner.width, 10), {key: 'OUTPUTS', value: s.outputs});
  keyvalue(ctx, part(inner, 0, 30, inner.width, 10), {key: 'APP', value: s.app});
  badge(ctx, part(inner, 0, 44, inner.width, 10), {level: s.level || 'ok', text: s.health ?? 'READY'});
}

/** One aircraft's state at a glance: horizon, height, heading, speed, place, batteries, and who holds control. */
export function flightCluster(ctx, box, s = {}) {
  const inner = panel(ctx, box, s.name ?? 'FLIGHT', {from: s.origin});
  attitude(ctx, part(inner, 0, 0, 112, 124), {roll: s.roll, pitch: s.pitch});
  altitude(ctx, part(inner, 120, 0, 60, 112), {value: s.height});
  const x = 190, w = inner.width - x;
  value(ctx, part(inner, x, 0, w, 32), {caption: 'GROUND SPEED', value: s.speed, unit: 'm/s'});
  position(ctx, part(inner, x, 36, w, 36), {latitude: s.latitude, longitude: s.longitude, altitude: s.altitude, fix: s.fix, satellites: s.satellites});
  battery(ctx, part(inner, x, 78, w, 22), {percent: s.battery, volts: s.volts});
  lease(ctx, part(inner, x, 102, w, 12), {state: s.lease, age: s.leaseAge});
  heading(ctx, part(inner, 0, 134, inner.width, 32), {value: s.heading});
}

export const GENERATORS = ['RINGS', 'FACADE', 'ROOF', 'ORBIT', 'HELIX', 'WHOLE'];

/** What a plan is made from: the generator, the camera, how far to stand off and stay clear, home, and the two actions. */
export function planPanel(ctx, box, s = {}) {
  const inner = panel(ctx, box, 'FLIGHT PLAN');
  label(ctx, part(inner, 0, 0, inner.width, 10), {text: 'GENERATOR', variant: 'caption'});
  segmented(ctx, part(inner, 0, 12, inner.width, 24), {options: GENERATORS, value: s.generator ?? 0});
  label(ctx, part(inner, 0, 42, 90, 24), {text: 'CAMERA', variant: 'caption'});
  select(ctx, part(inner, 96, 42, inner.width - 96, 24), {value: s.camera ?? 'XT2 VISUAL'});
  label(ctx, part(inner, 0, 72, 90, 24), {text: 'STANDOFF', variant: 'caption'});
  slider(ctx, part(inner, 96, 72, inner.width - 96, 24), {min: 2, max: 20, value: s.standoff ?? 8, unit: 'm'});
  label(ctx, part(inner, 0, 102, 90, 24), {text: 'CLEARANCE', variant: 'caption'});
  slider(ctx, part(inner, 96, 102, inner.width - 96, 24), {min: 1, max: 10, value: s.clearance ?? 3, unit: 'm'});
  toggle(ctx, part(inner, 0, 132, inner.width, 24), {label: 'HOME SET BY HAND', value: !!s.homeByHand});
  const half = Math.floor((inner.width - 8) / 2);
  button(ctx, part(inner, 0, 162, half, 24), {label: 'MAKE THE PLAN', focused: true});
  button(ctx, part(inner, half + 8, 162, inner.width - half - 8, 24), {label: 'BEST OF ALL SIX'});
}

/** The target a lasso made, and that its bundle is written. */
export function targetPanel(ctx, box, s = {}) {
  const inner = panel(ctx, box, 'TARGET');
  target(ctx, part(inner, 0, 0, inner.width, 54), s);
  badge(ctx, part(inner, 0, 60, inner.width, 10), {level: s.written ? 'ok' : 'off', text: s.written ? 'BUNDLE WRITTEN  5 LAYERS' : 'NOT SAVED'});
}

/** What the checker found in a plan: errors first. */
export function checksPanel(ctx, box, s = {}) {
  const list = s.checks || [], errors = list.filter(c => c.level === 'error').length;
  const inner = panel(ctx, box, `CHECKS  ${errors} ERROR${errors === 1 ? '' : 'S'}  ${list.length - errors} WARNING${list.length - errors === 1 ? '' : 'S'}`);
  list.forEach((item, i) => { if ((i + 1) * 12 <= inner.height) check(ctx, part(inner, 0, i * 12, inner.width, 12), item); });
}

/** The missions a plan became, and why one was refused. */
export function missionsPanel(ctx, box, s = {}) {
  const inner = panel(ctx, box, 'MISSIONS');
  (s.missions || []).forEach((item, i) => { if (i * 18 + 16 <= inner.height) mission(ctx, part(inner, 0, i * 18, inner.width, 16), item); });
  const used = (s.missions || []).length * 18 + 4;
  if (s.refusal && inner.height - used >= 24) alert(ctx, part(inner, 0, used, inner.width, inner.height - used), {level: 'error', text: s.refusal});
}

/** A run of a mission being played back. */
export function runPanel(ctx, box, s = {}) {
  const inner = panel(ctx, box, 'SIMULATED RUN', {from: s.origin ?? 'sim'});
  transport(ctx, part(inner, 0, 0, inner.width, 24), s);
  steps(ctx, part(inner, 0, 30, inner.width, 24), {items: s.steps});
  keyvalue(ctx, part(inner, 0, 60, inner.width, 10), {key: 'STATE', value: s.state});
  keyvalue(ctx, part(inner, 0, 72, inner.width, 10), {key: 'NEAREST TO THE TARGET', value: s.nearest});
}

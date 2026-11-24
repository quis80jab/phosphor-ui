// The ladder, bottom to top: every element, the layer it stands on, what it is drawn from,
// its size in layout cells (a cell is 8 by 8 display pixels) and the states the bench shows it in.
// `from` names what is under the element: an interface of the catalogue, a resource, a thing the sandbox makes, or a hand.
import * as marks from './paint/marks.js';
import * as controls from './paint/controls.js';
import * as readouts from './paint/readouts.js';
import * as views from './paint/views.js';
import * as site from './paint/site.js';
import * as panels from './paint/panels.js';
import * as map from './paint/map.js';
import {COVERAGE_CLASSES} from './paint/site.js';

export const LAYERS = [
  {id: 1, title: 'Marks', about: "Rules, frames, glyphs and lamps: what every element is made of. Under them is only Phosphor's lattice."},
  {id: 2, title: 'Controls', about: 'What a person presses, drags or types into.'},
  {id: 3, title: 'Readouts', about: 'What says one thing: a value, a state, a row.'},
  {id: 4, title: 'Views of the interfaces', about: "One element for each interface of the synthetic sample catalogue, drawn for what it carries."},
  {id: 5, title: 'Site and plan', about: 'One element for each thing the sandbox makes: a place, a target, a check, a mission.'},
  {id: 6, title: 'Panels', about: 'Elements put together: a Device, a Module, a flight cluster, a plan.'},
];

const GENERATORS = panels.GENERATORS;
const TABLE = [{title: 'BUNDLE', share: 4}, {title: 'SOURCE', share: 3}, {title: 'LAYERS', share: 1.4, align: 'right'}];
const hand = 'a hand';

// A sample plan for the map: a ring of views eight metres off a ten-metre box, each looking at it.
const RING = Array.from({length: 24}, (_, i) => {
  const a = i * 15 * Math.PI / 180;
  return {x: Math.round(13 * Math.sin(a) * 10) / 10, y: Math.round(13 * Math.cos(a) * 10) / 10, heading: (i * 15 + 180) % 360};
});
const BOX = [{x: -5, y: -5}, {x: 5, y: -5}, {x: 5, y: 5}, {x: -5, y: 5}];
const MAP = {
  centre: {x: 0, y: -13}, reach: 34, outline: BOX, home: {x: 0, y: -13}, fence_m: 30,
  legs: [{kind: 'take-off', points: [{x: 0, y: -13}, RING[12]]}, {kind: 'scan', points: [...RING.slice(12), ...RING.slice(0, 13)]}],
};
const interfaces = (...names) => names.map(name => `interface ${name}`).join(', ');

// A sample site for the map: a hall, a shed and an L-shaped block round a made-up place, nobody's.
const oblong = (x, y, w, d) => [{x: x - w / 2, y: y - d / 2}, {x: x + w / 2, y: y - d / 2}, {x: x + w / 2, y: y + d / 2}, {x: x - w / 2, y: y + d / 2}];
const SHED = oblong(-6, 4, 12, 10), HALL = oblong(34, 22, 40, 20);
const BLOCK = [{x: -52, y: -40}, {x: -18, y: -40}, {x: -18, y: -26}, {x: -38, y: -26}, {x: -38, y: -8}, {x: -52, y: -8}];
const outlines = part => [map.footprintMark(SHED, {name: 'SHED', part}), map.footprintMark(HALL, {name: 'HALL A'}), map.footprintMark(BLOCK),
  map.footprintMark(oblong(44, -34, 26, 18)), map.footprintMark(oblong(-44, 36, 18, 14)), map.footprintMark(oblong(8, -52, 14, 9))];
const SITE = {centre: {x: 0, y: 0}, across_m: 150, area: oblong(0, 0, 140, 140), place: {x: 0, y: 0}, footprints: outlines(false), mode: 'loop'};
const LOOP = [{x: -16, y: -5}, {x: -2, y: -8}, {x: 5, y: -2}, {x: 4, y: 10}, {x: -4, y: 14}, {x: -15, y: 12}];

export const ELEMENTS = [
  // Layer 1: marks.
  {id: 'rules', layer: 1, title: 'Rules', from: 'the lattice', cells: [24, 5], paint: marks.rules, states: [['whole and dotted', {}]]},
  {id: 'frames', layer: 1, title: 'Frames', from: 'the lattice', cells: [14, 3], paint: marks.frames,
    states: [['at rest', {label: 'REST'}], ['with the keyboard', {label: 'FOCUS', focused: true}], ['lit', {label: 'ACTIVE', active: true}], ['single', {label: 'SINGLE', double: false}]]},
  {id: 'glyphs', layer: 1, title: 'Glyphs', from: "Phosphor's 5 by 7 font", cells: [40, 6], paint: marks.glyphs, states: [['one and two sizes', {}]]},
  {id: 'lamps', layer: 1, title: 'Lamps', from: 'the lattice', cells: [24, 2], paint: marks.lamps, states: [['lit and unlit', {}]]},
  {id: 'patterns', layer: 1, title: 'Fills', from: "Phosphor's four marks", cells: [40, 6], paint: marks.patterns, states: [['the four', {}]]},
  {id: 'bars', layer: 1, title: 'Bars', from: 'the lattice', cells: [24, 3], paint: marks.bars, states: [['at 60 %', {value: 0.6}]]},
  {id: 'shapes', layer: 1, title: 'Shapes', from: 'the lattice', cells: [24, 3], paint: marks.shapes, states: [['heads, circles, blocks', {}]]},

  // Layer 2: controls.
  {id: 'button', layer: 2, title: 'Button', from: hand, cells: [16, 3], paint: controls.button,
    states: [['at rest', {label: 'MAKE THE PLAN'}], ['with the keyboard', {label: 'MAKE THE PLAN', focused: true}], ['held', {label: 'MAKE THE PLAN', held: true}], ['disabled', {label: 'MAKE THE PLAN', disabled: true}]]},
  {id: 'toggle', layer: 2, title: 'Switch', from: hand, cells: [22, 3], paint: controls.toggle,
    states: [['off', {label: 'GOOGLE 3D', value: false}], ['on', {label: 'GOOGLE 3D', value: true}], ['on, with the keyboard', {label: 'GOOGLE 3D', value: true, focused: true}]]},
  {id: 'checkbox', layer: 2, title: 'Tick box', from: hand, cells: [18, 2], paint: controls.checkbox,
    states: [['empty', {label: 'FOOTPRINTS'}], ['chosen', {label: 'FOOTPRINTS', value: true}], ['with the keyboard', {label: 'FOOTPRINTS', value: true, focused: true}]]},
  {id: 'segmented', layer: 2, title: 'One of several', from: hand, cells: [40, 3], paint: controls.segmented,
    states: [['the generators', {options: GENERATORS, value: 0}], ['another chosen, with the keyboard', {options: GENERATORS, value: 3, focused: true}]]},
  {id: 'slider', layer: 2, title: 'Slider', from: hand, cells: [32, 3], paint: controls.slider,
    states: [['standoff', {min: 2, max: 20, value: 8, unit: 'm'}], ['held', {min: 2, max: 20, value: 14, unit: 'm', held: true, focused: true}], ['clearance', {min: 1, max: 10, value: 3, unit: 'm'}]]},
  {id: 'stepper', layer: 2, title: 'Stepper', from: hand, cells: [20, 3], paint: controls.stepper,
    states: [['camera pitch', {value: -15, unit: '°', signed: true}], ['raising', {value: -10, unit: '°', signed: true, held: 'up'}]]},
  {id: 'field', layer: 2, title: 'Text field', from: hand, cells: [32, 3], paint: controls.field,
    states: [['empty', {placeholder: 'A NAME, OR LATITUDE AND LONGITUDE', icon: 'search'}], ['typing', {value: '10, 10', icon: 'search', focused: true}], ['plain', {value: 'HALL A'}]]},
  {id: 'select', layer: 2, title: 'List, closed', from: hand, cells: [24, 3], paint: controls.select,
    states: [['the camera', {value: 'XT2 VISUAL'}], ['with the keyboard', {value: 'Z30', focused: true}], ['held', {value: 'D455 COLOUR', held: true}]]},
  {id: 'tabs', layer: 2, title: 'Sections', from: hand, cells: [44, 3], paint: controls.tabs,
    states: [['the shell', {options: ['DEVICES', 'MODULES', 'CHAINS', 'ACTIVITY'], value: 0}], ['another open', {options: ['DEVICES', 'MODULES', 'CHAINS', 'ACTIVITY'], value: 2}]]},

  // Layer 3: readouts.
  {id: 'label', layer: 3, title: 'Words', from: 'a name', cells: [28, 3], paint: readouts.label,
    states: [['a title', {text: 'FLIGHT PLAN', variant: 'title'}], ['plain', {text: 'HOME FOUND FOR YOU'}], ['a caption', {text: 'METRES FROM THE OUTLINE', variant: 'caption'}]]},
  {id: 'keyvalue', layer: 3, title: 'Name and value', from: 'a field of a resource', cells: [32, 2], paint: readouts.keyvalue,
    states: [['a model', {key: 'MODEL', value: 'DJI-M210'}], ['a count', {key: 'WAYPOINTS', value: '73'}]]},
  {id: 'value', layer: 3, title: 'Value with its unit', from: "the catalogue's value view", cells: [18, 4], paint: readouts.value,
    states: [['speed', {caption: 'GROUND SPEED', value: 1.1, unit: 'm/s'}], ['a warning', {caption: 'PIXEL SIZE', value: 7.4, unit: 'mm', level: 'warn'}], ['nothing yet', {caption: 'HEIGHT', value: '--', unit: 'm'}]]},
  {id: 'badge', layer: 3, title: 'State', from: "a resource's condition", cells: [16, 2], paint: readouts.badge,
    states: [['ready', {level: 'ok', text: 'READY'}], ['held', {level: 'warn', text: 'HELD'}], ['not ready', {level: 'fail', text: 'NOT READY'}], ['off', {level: 'off', text: 'NOT BOUND'}]]},
  {id: 'origin', layer: 3, title: 'Origin', from: 'the origin label of the simulation contracts', cells: [10, 2], paint: readouts.origin,
    states: [['the real aircraft', {origin: 'real'}], ["DJI's simulator", {origin: 'dji-simulator'}], ['our simulation', {origin: 'sim'}]]},
  {id: 'progress', layer: 3, title: 'Progress', from: 'a job', cells: [32, 2], paint: readouts.progress,
    states: [['under way', {value: 0.42}], ['done', {value: 1}]]},
  {id: 'level', layer: 3, title: 'Meter', from: 'a share of a limit', cells: [24, 2], paint: readouts.level,
    states: [['a motor at 22 % of the load', {value: 0.62}], ['near the limit', {value: 0.84}], ['over', {value: 1}]]},
  {id: 'row', layer: 3, title: 'Row of a list', from: 'a resource', cells: [36, 2], paint: readouts.row,
    states: [['a Device', {title: 'SIM-M210', detail: 'ROBOT', level: 'ok'}], ['chosen', {title: 'SIM-M210', detail: 'ROBOT', selected: true}], ['not ready', {title: 'DOG-STATION', detail: 'ROBOT', level: 'fail'}]]},
  {id: 'tableHead', layer: 3, title: "Table's head", from: 'records', cells: [44, 2], paint: readouts.tableHead, states: [['bundles', {columns: TABLE}]]},
  {id: 'tableRow', layer: 3, title: "Table's row", from: 'records', cells: [44, 2], paint: readouts.tableRow,
    states: [['a bundle', {columns: TABLE, cells: ['HALL-A-20261123', 'OSM', '5']}], ['chosen', {columns: TABLE, cells: ['HALL-A-20261123', 'OSM', '5'], selected: true}]]},
  {id: 'alert', layer: 3, title: 'Alert', from: 'a refusal, a warning, a note', cells: [44, 4], paint: readouts.alert,
    states: [['an error', {level: 'error', text: '105 of 198 waypoints are outside the 30 m fence. The plan is refused whole.'}],
      ['a warning', {level: 'warn', text: 'Roof height is a guess: 10 m. No height in OpenStreetMap, no mesh.'}],
      ['a note', {level: 'note', text: 'Home was found for you. Set it by hand with a click on the ground.'}]]},
  {id: 'legend', layer: 3, title: 'Legend', from: 'the classes of a picture', cells: [56, 2], paint: readouts.legend, states: [['coverage', {items: COVERAGE_CLASSES}]]},
  {id: 'steps', layer: 3, title: 'Steps in order', from: 'a piece of work', cells: [48, 3], paint: readouts.steps,
    states: [['a plan on its way', {items: [{label: 'PLAN', state: 'done'}, {label: 'CHECKS', state: 'done'}, {label: 'MISSIONS', state: 'now'}, {label: 'RUN', state: 'todo'}]}],
      ['stopped by the checks', {items: [{label: 'PLAN', state: 'done'}, {label: 'CHECKS', state: 'fail'}, {label: 'MISSIONS', state: 'todo'}, {label: 'RUN', state: 'todo'}]}]]},

  // Layer 4: one view per interface.
  {id: 'attitude', layer: 4, title: 'Horizon', from: interfaces('imu', 'attitude'), cells: [14, 15], paint: views.attitude,
    states: [['level', {roll: 0, pitch: 0}], ['banking right, nose down', {roll: 18, pitch: -6}]], live: t => ({roll: 20 * Math.sin(t / 1.7), pitch: 8 * Math.sin(t / 2.9)})},
  {id: 'heading', layer: 4, title: 'Heading', from: interfaces('attitude'), cells: [36, 4], paint: views.heading,
    states: [['east by north', {value: 87}], ['across north', {value: 358}]], live: t => ({value: (t * 12) % 360})},
  {id: 'altitude', layer: 4, title: 'Height', from: interfaces('height'), cells: [8, 14], paint: views.altitude,
    states: [['after take-off', {value: 4.7}], ['on the ground', {value: 0}]], live: t => ({value: 6 + 4 * Math.sin(t / 2.3)})},
  {id: 'position', layer: 4, title: 'Position', from: interfaces('position.geo'), cells: [28, 5], paint: views.position,
    states: [['a good fix', {latitude: '10.00000 N', longitude: '10.00000 E', altitude: '312.4 m', fix: 5, satellites: 17}], ['too weak to fly', {latitude: '10.00000 N', longitude: '10.00000 E', altitude: '--', fix: 2, satellites: 6}]]},
  {id: 'battery', layer: 4, title: 'Batteries', from: interfaces('battery'), cells: [28, 3], paint: views.battery,
    states: [['plenty', {percent: 89, volts: 23.4}], ['below the least to start', {percent: 27, volts: 21.9}], ['below the reserve', {percent: 18, volts: 21.2}]]},
  {id: 'gimbal', layer: 4, title: 'Gimbal', from: interfaces('gimbal.attitude'), cells: [24, 5], paint: views.gimbal,
    states: [['looking down', {name: 'GIMBAL 0  XT2', pitch: -45, yaw: 12, roll: 0}], ['level', {name: 'GIMBAL 2  Z30', pitch: 0, yaw: -90, roll: 0}]]},
  {id: 'thermal', layer: 4, title: 'Thermal spot', from: interfaces('thermal.spot'), cells: [28, 5], paint: views.thermal,
    states: [['a warm spot', {spot: 41.2, min: 22.0, max: 57.9}]]},
  {id: 'picture', layer: 4, title: 'Picture and video', from: interfaces('image.jpeg', 'image.raw', 'video.h264', 'dji.video-frame'), cells: [32, 20], paint: views.picture,
    states: [['a picture', {name: 'D455 COLOUR', origin: 'sim', size: '640X480', rate: '15 HZ', encoding: 'RGB8'}],
      ['a video', {name: 'XT2 VISUAL', origin: 'real', size: '1280X720', rate: '30 HZ', encoding: 'H264', kind: 'video'}],
      ['no signal', {name: 'Z30', origin: 'dji-simulator', kind: 'video', signal: false}]]},
  {id: 'raw', layer: 4, title: 'Raw frames', from: interfaces('duml.raw'), cells: [44, 2], paint: views.raw,
    states: [['flowing', {name: 'DUML', count: 1024, rate: 2.0, bytes: '55 0D 04 33 02 0E'}]]},
  {id: 'lease', layer: 4, title: 'Heartbeat and control', from: interfaces('heartbeat.operator'), cells: [36, 2], paint: views.lease,
    states: [['in control', {state: 'held', age: 0.2}], ['another holds it', {state: 'other', age: 0.2}], ['lost', {state: 'lost', age: 4.1}]]},
  {id: 'textline', layer: 4, title: 'Line of text', from: interfaces('text'), cells: [44, 2], paint: views.textline,
    states: [['a line', {time: '14:05:09', text: 'flight: simulator only'}]]},
  {id: 'cameraLink', layer: 4, title: 'Camera on the downlink', from: interfaces('camera.link'), cells: [36, 2], paint: views.cameraLink,
    states: [['the XT2', {cameras: ['XT2', 'Z30'], shown: 0, mode: 'LINKED'}], ['the Z30', {cameras: ['XT2', 'Z30'], shown: 1, mode: 'LINKED'}]]},

  // Layer 5: what the sandbox makes.
  {id: 'place', layer: 5, title: 'Place found', from: 'a search answer', cells: [44, 3], paint: site.place,
    states: [['typed', {name: 'TYPED COORDINATES', where: '10.00000 N  10.00000 E', source: 'TYPED'}], ['chosen', {name: 'TYPED COORDINATES', where: '10.00000 N  10.00000 E', source: 'TYPED', selected: true}]]},
  {id: 'target', layer: 5, title: 'Target', from: 'a target of the site bundle', cells: [40, 7], paint: site.target,
    states: [['from a mesh', {name: 'HALL A', outline: '40.0 x 20.0 m', ground: '300.0 m', groundSource: 'MESH', roof: '312.0 m', roofSource: 'MESH', surfaces: '26 triangles'}],
      ['a guessed roof', {name: 'SHED', outline: '10.0 x 10.0 m', ground: '300.0 m', groundSource: 'FRAME', groundGuess: true, roof: '310.0 m', roofSource: 'DEFAULT', roofGuess: true, surfaces: 'outline pushed up'}]]},
  {id: 'check', layer: 5, title: 'Check', from: "a finding of the plan's checker", cells: [44, 2], paint: site.check,
    states: [['an error', {level: 'error', code: 'TOO_CLOSE', message: 'NEARER THAN 3 M TO AN OBSTACLE', count: 24}], ['a warning', {level: 'warn', code: 'SEVERAL_MISSIONS', message: 'THE PLAN NEEDS 2 MISSIONS'}]]},
  {id: 'coverage', layer: 5, title: 'Coverage by face', from: 'the coverage of a plan', cells: [40, 8], paint: site.coverage,
    states: [['rings round a box', {faces: [
      {name: 'NORTH', unseen: 0, few: 0.05, three: 0.15, fine: 0.8}, {name: 'EAST', unseen: 0, few: 0.1, three: 0.2, fine: 0.7},
      {name: 'SOUTH', unseen: 0, few: 0.05, three: 0.15, fine: 0.8}, {name: 'WEST', unseen: 0.02, few: 0.18, three: 0.2, fine: 0.6},
      {name: 'ROOF', unseen: 1, few: 0, three: 0, fine: 0}]}]]},
  {id: 'mission', layer: 5, title: 'Mission', from: 'a mission document', cells: [44, 2], paint: site.mission,
    states: [['fits', {name: 'MISSION 1', steps: 50, time: '4:43', loss: 'NO HEADING, NO PITCH'}], ['chosen', {name: 'MISSION 2', steps: 29, time: '3:05', loss: 'NO HEADING, NO PITCH', selected: true}], ['too long', {name: 'MISSION 1', steps: 62, time: '6:10'}]]},
  {id: 'waypoint', layer: 5, title: 'Waypoint', from: 'a waypoint of a plan', cells: [48, 2], paint: site.waypoint,
    states: [['in the plan', {index: 12, east: 8, north: -13, up: 6, heading: 90, pitch: -15}], ['in a mission: the aim is lost', {index: 12, east: 8, north: -13, up: 6, heading: 90, pitch: -15, aimLost: true}]]},
  {id: 'transport', layer: 5, title: 'Playback', from: 'a run', cells: [40, 3], paint: site.transport,
    states: [['stopped', {at: '00:00', of: '04:43', share: 0}], ['playing', {at: '02:14', of: '04:43', share: 0.47, playing: true}]]},
  {id: 'planMap', layer: 5, title: 'Plan seen from above', from: 'a flight plan on its scene', cells: [30, 30], paint: site.planMap,
    states: [['a ring round a box', MAP],
      ['a run under way, one waypoint moved', {...MAP, repairs: [RING[6]], trail: [{x: 0, y: -13}, ...RING.slice(12, 20)], aircraft: RING[19]}],
      ['outside the fence, and setting home by hand', {...MAP, fenceBroken: true, problems: RING.slice(21).concat(RING.slice(0, 4)).map(p => ({x: p.x * 2.6, y: p.y * 2.6 + 20})), placing: true}],
      // A run under the guard: a pole the plan did not know on the ring, seen, stopped for and flown round; one step left out; a stretch flown blind.
      ['under the guard: a pole not in the plan, a stop and a way round', {...MAP, unknown: [[{x: -11.6, y: 6.2}, {x: -11, y: 6.2}, {x: -11, y: 6.8}, {x: -11.6, y: 6.8}]],
        sensed: [{x: -11.5, y: 6.1}, {x: -11.2, y: 6.1}, {x: -11.7, y: 6.4}],
        trail: [{x: 0, y: -13}, ...RING.slice(12, 16).map((p, i) => ({x: p.x, y: p.y, blind: i > 1})), {x: -12.6, y: 3.2}, {x: -15.5, y: 6.5}, {x: -9.2, y: 9.2}],
        stops: [{x: -12.6, y: 3.2}], ways: [[{x: -12.6, y: 3.2}, {x: -15.5, y: 6.5}, {x: -9.2, y: 9.2}]], leftOut: [RING[19]], aircraft: {x: -9.2, y: 9.2}}],
      ['without the guard: the pole is struck', {...MAP, unknown: [[{x: -11.6, y: 6.2}, {x: -11, y: 6.2}, {x: -11, y: 6.8}, {x: -11.6, y: 6.8}]],
        trail: [{x: 0, y: -13}, ...RING.slice(12, 19).map(p => ({x: p.x, y: p.y, blind: true}))], struck: {x: -11.3, y: 6.5}, aircraft: {x: -11.3, y: 6.5}}]]},
  {id: 'siteMap', layer: 5, title: 'Site seen from above', from: 'the footprints of an area, a loop and the target it makes', cells: [34, 34], paint: map.siteMap,
    states: [['outlines round a place', {...SITE, caption: 'DRAW A LOOP ROUND A BUILDING'}],
      ['a loop under the hand', {...SITE, drawing: LOOP.slice(0, 5)}],
      ['the target it made', {...SITE, footprints: outlines(true), lasso: LOOP, target: {outline: SHED, holes: []}}],
      ['closer, with the keyboard', {...SITE, ...map.fitted(SHED, 2.4), footprints: outlines(true), target: {outline: SHED, holes: []}, mode: 'move', focused: true}]]},
  {id: 'provenance', layer: 5, title: 'Where a layer came from', from: "a layer's provenance in the site bundle", cells: [50, 2], paint: site.provenance,
    states: [['OpenStreetMap', {source: 'osm', terms: 'ODBL, (C) OPENSTREETMAP CONTRIBUTORS', when: '2026-11-23'}],
      ["Google's tiles", {source: 'google-3d-tiles', terms: 'GOOGLE MAP TILES API; INTERNAL USE', when: '2026-11-23'}], ['made for tests', {source: 'synthetic', terms: 'MADE FOR TESTS'}]]},
  {id: 'fence', layer: 5, title: 'Fence', from: "the aircraft's limits", cells: [14, 15], paint: site.fence,
    states: [['inside', {limit: 30, farthest: 26.7, bearing: 40, building: {east: 0, north: 13, width: 10, depth: 10}}], ['outside: refused', {limit: 30, farthest: 38.5, bearing: 62, building: {east: 0, north: 20, width: 40, depth: 20}}]]},

  // Layer 6: panels.
  {id: 'deviceCard', layer: 6, title: 'Device', from: 'resource Device, with its Sensors', cells: [40, 17], paint: panels.deviceCard,
    states: [['the simulated aircraft', {name: 'SIM-M210', origin: 'sim', role: 'ROBOT', model: 'DJI-M210', cluster: 'DEMO-ROBOT-SIM', ready: true,
      sensors: [{name: 'FLIGHT', port: 'IMU', rate: '10'}, {name: 'FLIGHT', port: 'POSITION', rate: '50'}, {name: 'FLIGHT', port: 'BATTERY', rate: '5'}]}]]},
  {id: 'moduleTile', layer: 6, title: 'Module', from: 'resource Module', cells: [30, 11], paint: panels.moduleTile,
    states: [['the Site module', {name: 'SITE', runs: 'LIVE', inputs: 'NONE', outputs: 'NONE', app: 'DEMO-APP-SITE', level: 'ok', health: 'READY'}]]},
  {id: 'flightCluster', layer: 6, title: 'Flight cluster', from: 'the flight side of a Device', cells: [46, 25], paint: panels.flightCluster,
    states: [['a simulated flight', {name: 'SIM-M210', origin: 'sim', roll: 4, pitch: -3, height: 4.7, speed: 1.1, heading: 87, latitude: '10.00000 N', longitude: '10.00000 E', altitude: '304.7 m', fix: 5, satellites: 17, battery: 89, volts: 23.4, lease: 'held', leaseAge: 0.2}]],
    live: t => ({name: 'SIM-M210', origin: 'sim', roll: 12 * Math.sin(t / 1.9), pitch: 5 * Math.sin(t / 3.1), height: 6 + 3 * Math.sin(t / 2.7), speed: 1.1 + 0.4 * Math.sin(t / 1.3), heading: (t * 9) % 360,
      latitude: '10.00000 N', longitude: '10.00000 E', altitude: '306.0 m', fix: 5, satellites: 17, battery: 89, volts: 23.4, lease: 'held', leaseAge: 0.2})},
  {id: 'planPanel', layer: 6, title: 'Plan settings', from: 'the planning packages', cells: [42, 28], paint: panels.planPanel,
    states: [['rings, XT2', {generator: 0, camera: 'XT2 VISUAL', standoff: 8, clearance: 3, homeByHand: false}]]},
  {id: 'targetPanel', layer: 6, title: 'Target panel', from: 'the Site module', cells: [40, 13], paint: panels.targetPanel,
    states: [['a target, saved', {name: 'HALL A', outline: '40.0 x 20.0 m', ground: '300.0 m', groundSource: 'MESH', roof: '312.0 m', roofSource: 'MESH', surfaces: '26 triangles', written: true}]]},
  {id: 'checksPanel', layer: 6, title: 'Checks', from: "the plan's checker", cells: [44, 11], paint: panels.checksPanel,
    states: [['one error, two warnings', {checks: [{level: 'error', code: 'OUTSIDE_FENCE', message: 'BEYOND 30 M FROM HOME', count: 105},
      {level: 'warn', code: 'SEVERAL_MISSIONS', message: 'THE PLAN NEEDS 3 MISSIONS'}, {level: 'warn', code: 'AIM_LOST', message: 'A MISSION CARRIES NO HEADING'}]}]]},
  {id: 'missionsPanel', layer: 6, title: 'Missions', from: 'the mission export', cells: [44, 15], paint: panels.missionsPanel,
    states: [['two missions', {missions: [{name: 'MISSION 1', steps: 50, time: '4:43', loss: 'NO HEADING, NO PITCH'}, {name: 'MISSION 2', steps: 29, time: '3:05', loss: 'NO HEADING, NO PITCH', selected: true}]}],
      ['refused', {missions: [], refusal: '105 of 198 waypoints are outside the 30 m fence. Nothing is exported.'}]]},
  {id: 'runPanel', layer: 6, title: 'Run', from: "the mission package's executor", cells: [44, 15], paint: panels.runPanel,
    states: [['a run being played', {origin: 'sim', at: '02:14', of: '04:43', share: 0.47, playing: true, state: 'GO TO  STEP 23 OF 50', nearest: '3.25 M',
      steps: [{label: 'TAKE OFF', state: 'done'}, {label: 'SCAN', state: 'now'}, {label: 'RETURN', state: 'todo'}, {label: 'LAND', state: 'todo'}]}]]},
];

export const byId = Object.fromEntries(ELEMENTS.map(entry => [entry.id, entry]));

/** Paint one element whole, inside its box and nowhere else. A disabled one is painted fainter. */
export function paintElement(ctx, entry, box, state = {}) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.width, box.height);
  ctx.clip();
  if (state.disabled) ctx.globalAlpha *= 0.4;
  entry.paint(ctx, box, state);
  ctx.restore();
}

/**
 * The top of the ladder: each window of the flow board (docs/sandbox-window-flow) and the elements it is made of.
 * A window with none says why.
 */
export const WINDOWS = {
  signin: {elements: ['label', 'field', 'button', 'alert']},
  shell: {elements: ['tabs', 'deviceCard', 'moduleTile', 'lease', 'row']},
  devpage: {elements: [], why: 'A plain page for development. It goes away when the shell exists.'},
  search: {elements: ['field', 'button', 'place', 'segmented', 'alert']},
  earth: {elements: ['siteMap', 'provenance', 'button', 'toggle', 'legend', 'label']},
  lasso: {elements: ['siteMap', 'segmented', 'row', 'alert']},
  target: {elements: ['targetPanel', 'target', 'field', 'stepper', 'keyvalue', 'provenance', 'alert', 'button']},
  outline: {elements: ['siteMap', 'button', 'stepper', 'row']},
  bundles: {elements: ['tableHead', 'tableRow', 'button', 'badge']},
  plansetup: {elements: ['planPanel', 'segmented', 'select', 'slider', 'toggle', 'button']},
  plandrawn: {elements: ['planMap', 'checksPanel', 'check', 'waypoint', 'fence', 'keyvalue']},
  coverage: {elements: ['coverage', 'legend', 'value', 'progress']},
  missions: {elements: ['missionsPanel', 'mission', 'alert', 'fence', 'steps']},
  browsersim: {elements: ['planMap', 'runPanel', 'transport', 'steps', 'flightCluster', 'origin']},
  save: {elements: ['button', 'badge', 'keyvalue']},
  edit: {elements: ['waypoint', 'stepper', 'heading', 'gimbal', 'button']},
  device: {elements: ['deviceCard', 'origin', 'row', 'badge']},
  simrun: {elements: ['flightCluster', 'runPanel', 'lease', 'steps', 'origin']},
  live: {elements: ['flightCluster', 'attitude', 'heading', 'altitude', 'position', 'battery', 'origin']},
  record: {elements: ['button', 'badge', 'progress', 'textline']},
  control: {elements: ['lease', 'button', 'alert', 'flightCluster']},
  video: {elements: ['picture', 'cameraLink', 'thermal', 'gimbal', 'origin']},
  recordings: {elements: ['tableHead', 'tableRow', 'origin', 'field', 'tabs']},
  viewer: {elements: ['transport', 'checkbox', 'legend', 'textline', 'raw']},
  jobs: {elements: ['row', 'progress', 'steps', 'badge']},
  compare: {elements: ['tableHead', 'tableRow', 'value', 'level']},
  expected: {elements: ['coverage', 'value', 'legend']},
  wb: {elements: ['level', 'value', 'alert', 'keyvalue']},
  checklist: {elements: ['checkbox', 'steps', 'button']},
  simkit: {elements: ['row', 'progress', 'select']},
  train: {elements: ['value', 'progress', 'row']},
  assistant: {elements: ['field', 'textline', 'button']},
  rancher: {elements: [], why: "Rancher's own pages."},
};

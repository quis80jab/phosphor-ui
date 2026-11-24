// Synthetic System example with four views (devices, modules, chains, activity) and a page for
// one Device. Everything here is read from synthetic fixtures and marked SAMPLE.
// The diagrams and these panels share one selection
// (designer-arch-view.js): a node picked anywhere fills the six boxes of the System tab.
//
// Device management only shows what the lease would allow. Nothing here signs, sends or commands; with
// the observer's view chosen its buttons do nothing at all.
import {NODES, MODULES, INTERFACES, STATES, OWNERS, ORIGINS, LINK_KINDS, TIERS, COMMAND_PATH, SAFETY, OPEN_WITH_THE_LEAD, CHAINS, nodeById, interfaceById, linksOf, sensorsOf, modulesOn} from '../designer-architecture.js';
import {paintArchView, activateArchView, selectArch, setArchPerson} from '../designer-arch-view.js';
import {SAMPLE} from '../designer-records.js';
import {el, text, fill, facts, rows, table, words, part, above, choice, button, lampLine, ORIGIN_TAG, MINT, DIM, AMBER} from './kit.js';

const COLOUR = {running: MINT, built: MINT, designed: AMBER, named: DIM, planned: DIM};
const LEVEL = {running: 'ok', built: 'ok', designed: 'warn', named: 'off', planned: 'off'};
const WHOSE = {lead: 'DEMO CORE', work: 'DEMO EXTRA', dji: 'DEMO VENDOR', bought: 'DEMO DEVICE', people: 'DEMO PERSON'};
const stateWord = state => STATES[state]?.label ?? String(state).toUpperCase();
const kindWord = node => node.kind === 'person' ? 'PERSON' : node.kind === 'cluster' ? 'CLUSTER' : node.role ? `${node.kind} / ${node.role}`.toUpperCase() : node.kind.toUpperCase();
const tierWord = node => TIERS.find(tier => tier.id === node.tier)?.label ?? '--';
const clusterOf = node => node.cluster ?? (node.parent === 'ground' || node.id === 'ground' ? 'GROUND CLUSTER' : node.parent ? clusterOf(nodeById[node.parent]) : '--');
const otherEnd = (link, id) => nodeById[link.from === id ? link.to : link.from];
const isRobot = node => node?.kind === 'device' && node.role === 'robot';
// The rc-link driver's ports and the interface each gives (design 18 G, L); the lab link gives a heartbeat.
const PORT_INTERFACE = {XT2: 'dji.video-frame', Z30: 'dji.video-frame', THERMAL: 'thermal.spot', GIMBAL_ATTITUDE: 'gimbal.attitude', CAMERA_LINK: 'camera.link', DUML: 'duml.raw', HEARTBEAT: 'heartbeat.operator'};

/** What a module entry of a node's run list is called without its pod prefix. */
const bare = name => name.replace(/^(MODULE|DEVICE|SENSOR|SYSTEM)-/, '');

/** The node the Device page shows: the picked device, a sensor's device, or the robot. */
function deviceOf(arch) {
  const node = arch.node;
  if (node?.kind === 'device' || node?.kind === 'cluster') return {node, shown: true};
  const parent = node?.parent ? nodeById[node.parent] : null;
  if (parent?.kind === 'device') return {node: parent, shown: true};
  return {node: nodeById['flight-orin'], shown: false};
}

/** The things that run on a node: its modules first, then the pods named in its run list. */
function installedOn(node) {
  const modules = modulesOn(node.id), names = new Set(modules.map(module => module.name));
  return [
    ...modules.map(module => ({title: module.name, detail: stateWord(module.state), level: LEVEL[module.state], module})),
    ...node.runs.filter(run => !names.has(bare(run))).map(run => ({title: run.replace(/^STATIC POD: /, ''), detail: run.startsWith('STATIC POD') ? 'STATIC POD' : 'POD', level: 'ok'})),
  ];
}

const diagram = kind => ({header: 'none', data: 'SAMPLE', paint(ctx, b, env) {
  paintArchView(ctx, kind, b);
  env.hit(b, point => activateArchView(kind, point, b));
}});

export default {
  // ------------------------------------------------------------------------------- System: devices
  'system/topology': diagram('topology'),

  'system/device details': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node, module} = env.arch, item = node ?? module;
    text(ctx, item.name, b.x, b.y, MINT, {room: b.width - 70});
    text(ctx, stateWord(item.state), b.x + b.width, b.y, COLOUR[item.state], {align: 'right', room: 66});
  }},

  'system/device info': {header: 'compact', data: 'SAMPLE', paint(ctx, b, env) {
    const {node, module} = env.arch;
    facts(ctx, b, node
      ? [['MODEL', node.model ?? '--'], ['KIND', kindWord(node)], ['WHOSE', WHOSE[node.owner]]]
      : [['RUNS', module.runs === 'job' ? 'AS A JOB' : 'LIVE'], ['WHERE', String(module.where).toUpperCase()], ['WHOSE', WHOSE[module.owner]]], {pitch: 14});
  }},

  'system/location': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node, module} = env.arch;
    if (!node) { facts(ctx, b, [['WHERE', String(module.where).toUpperCase()], ['APP', module.app ?? 'NONE']]); return; }
    const used = facts(ctx, b, [['TIER', tierWord(node)], ['ON', node.parent ? nodeById[node.parent].name : '--'], ['CLUSTER', clusterOf(node)], ['ORIGIN', ORIGINS[node.origin] ?? '--']], {pitch: 15});
    if (node.today && b.height > used + 10) words(ctx, node.today, part(b, 0, used + 2, b.width, b.height - used - 2), AMBER);
  }},

  'system/installed modules': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node, module} = env.arch, room = above(b, env.children);
    if (module) {
      const list = [...module.inputs.map(name => ({title: `IN: ${name}`, detail: interfaceById[name] ? stateWord(interfaceById[name].state) : '', level: 'ok'})), ...module.outputs.map(name => ({title: `OUT: ${name}`, detail: interfaceById[name] ? stateWord(interfaceById[name].state) : '', level: 'ok'}))];
      if (list.length) rows(ctx, room, list, {pitch: 18}); else words(ctx, 'NO PORTS: AN APP ONLY', room, DIM);
      return;
    }
    const list = installedOn(node);
    if (!list.length) { words(ctx, `NOTHING RUNS ON ${node.name}`, room, DIM); return; }
    rows(ctx, room, list, {pitch: 18}).forEach((row, i) => {
      if (list[i].module) env.hit(row, () => { selectArch(list[i].module.id); return {navigate: 'system-modules'}; });
    });
  }},

  'system/sensor types': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node} = env.arch;
    if (!node) { words(ctx, 'A MODULE HAS NO SENSORS: SEE ITS INPUTS', b, DIM); return; }
    if (node.kind === 'sensor') { facts(ctx, b, [['MODEL', node.model ?? '--'], ['ON', node.parent ? nodeById[node.parent].name : '--'], ['ORIGIN', ORIGINS[node.origin] ?? '--']], {pitch: 15}); return; }
    const list = sensorsOf(node.id);
    if (!list.length) { words(ctx, `NO SENSORS ON ${node.name}`, b, DIM); return; }
    rows(ctx, b, list.map(sensor => ({title: sensor.name, detail: `${ORIGINS[sensor.origin] ?? ''} ${stateWord(sensor.state)}`.trim(), level: LEVEL[sensor.state]})), {pitch: 18})
      .forEach((row, i) => env.hit(row, () => selectArch(list[i].id)));
  }},

  'system/device management': {data: false, paint(ctx, b, env) {
    const {node} = env.arch, operator = env.arch.person === 'operator', robot = isRobot(node) ? node : null, leases = env.ui.leases;
    choice(ctx, part(b, 0, 0, b.width, 22), ['OPERATOR', 'OBSERVER'], operator ? 0 : 1).forEach((box, i) => env.hit(box, () => setArchPerson(i === 0 ? 'operator' : 'observer')));
    const held = robot && operator && leases[robot.id];
    if (!robot) text(ctx, 'ONLY A ROBOT HAS A LEASE', b.x, b.y + 32, DIM, {room: b.width});
    else if (held) el(ctx, 'lease', part(b, 0, 28, b.width, 14), {state: 'held', age: 0.2});
    else if (!operator && leases[robot.id]) el(ctx, 'lease', part(b, 0, 28, b.width, 14), {state: 'other'});
    else lampLine(ctx, b.x, b.y + 31, b.width, `NOBODY HOLDS ${robot.name}`, '', DIM);
    const half = Math.floor((b.width - 6) / 2), labels = [held ? 'RELEASE' : 'TAKE THE LEASE', 'HOLD', 'RETURN', 'STOP'];
    labels.forEach((label, i) => {
      const box = part(b, (i % 2) * (half + 6), 50 + Math.floor(i / 2) * 28, i % 2 ? b.width - half - 6 : half, 24);
      if (box.y + box.height > b.y + b.height) return;
      // Inert for the observer and for anything that is not a robot: drawn disabled, no click lands.
      const usable = operator && robot && (i === 0 || held);
      button(ctx, box, label, {disabled: !usable});
      if (usable) env.hit(box, () => {
        if (i === 0) leases[robot.id] = !leases[robot.id];
        else env.ui.lastCommand = label;
        return true;
      });
    });
    const note = !operator ? 'OBSERVER: WATCHES; NO LEASE, NO COMMANDS' : !robot ? 'PICK A ROBOT ON THE TOPOLOGY' : env.ui.lastCommand && held ? `${env.ui.lastCommand}: PREVIEW ONLY, NOTHING SENT` : 'PREVIEW ONLY: NOTHING IS SENT';
    if (b.height > 112) words(ctx, note, part(b, 0, 108, b.width, b.height - 108), operator ? DIM : AMBER);
  }},

  'system/links': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node} = env.arch;
    if (!node) { words(ctx, 'A MODULE IS JOINED BY ITS INTERFACES: SEE CHAINS', b, DIM); return; }
    const list = linksOf(node.id).slice(0, 4);
    if (!list.length) { words(ctx, `NO LINKS DRAWN FOR ${node.name}`, b, DIM); return; }
    const picked = list.find(link => link.id === env.ui.link) ?? list[0];
    rows(ctx, b, list.map(link => ({title: otherEnd(link, node.id).name, detail: LINK_KINDS[link.kind].label, level: LEVEL[link.state], selected: link === picked})), {pitch: 18})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.link === list[i].id) return false; env.ui.link = list[i].id; return true; }));
    const top = list.length * 18 + 4;
    facts(ctx, part(b, 0, top, b.width, b.height - top), [['CARRIES', picked.carries], ['MEASURED', picked.measured ?? '--'], ['TODAY', picked.today ?? 'AS DESIGNED', picked.today ? AMBER : undefined], ['STATE', stateWord(picked.state), COLOUR[picked.state]], ['SOURCE', picked.source]], {pitch: 14});
  }},

  'system/command path': diagram('command-path'),

  'system/deploy': {paint(ctx, b, env) {
    const columns = [{title: 'CLUSTER', share: 2}, {title: 'DEMO QUEUE', share: 3}];
    const at = SAMPLE.deploys.findIndex(entry => entry.node === env.arch.node?.id);
    table(ctx, b, columns, SAMPLE.deploys.map(entry => [entry.cluster, entry.holds]), {selected: at});
  }},

  'system/telemetry of the picked device': {paint(ctx, b, env) {
    const {node} = env.arch, t = SAMPLE.telemetry, source = NODES.find(entry => entry.name === t.device);
    if (node?.id !== source.id) {
      const why = !node ? 'A MODULE: SEE ITS OUTPUTS' : isRobot(node) ? `NOTHING FROM ${node.name} YET: ${node.today ?? stateWord(node.state)}` : `${node.name} SENDS NO TELEMETRY OF ITS OWN`;
      words(ctx, why, b, isRobot(node) ? AMBER : DIM);
      return;
    }
    const half = Math.floor((b.width - 8) / 2);
    facts(ctx, part(b, 0, 0, half, b.height), [['UP', `${t.up_m.toFixed(1)} M`], ['SPEED', `${t.speed_mps.toFixed(1)} M/S`], ['HEADING', `${t.heading_deg}`], ['BATTERY', `${t.battery_pct} %`]], {pitch: 15});
    facts(ctx, part(b, half + 8, 0, b.width - half - 8, b.height), [['CONTROL', t.control], ['WHERE', t.step], ['FROM', ORIGIN_TAG[t.origin]], ['LAST', t.at]], {pitch: 15});
  }},

  // ------------------------------------------------------------------------------- System: modules
  'system-modules/modules': {data: 'SAMPLE', paint(ctx, b, env) {
    const columns = [{title: 'MODULE', share: 3}, {title: 'WHOSE', share: 1.5}, {title: 'STATE', share: 1.3, align: 'right'}];
    table(ctx, b, columns, MODULES.map(module => [module.name, WHOSE[module.owner], stateWord(module.state)]), {selected: MODULES.findIndex(module => module.id === env.arch.id)})
      .forEach((row, i) => env.hit(row, () => selectArch(MODULES[i].id)));
    let y = 16 + MODULES.length * 16 + 10;
    for (const [id, entry] of Object.entries(STATES)) {
      if (y + 8 > b.height) break;
      lampLine(ctx, b.x, b.y + y, b.width, entry.label, entry.says, COLOUR[id]);
      y += 13;
    }
  }},

  'system-modules/the picked module': {data: 'SAMPLE', paint(ctx, b, env) {
    const {module, node} = env.arch;
    if (!module) {
      const list = modulesOn(node.id);
      words(ctx, list.length ? `ON ${node.name}: PICK ONE` : `PICK A MODULE: NONE RUNS ON ${node.name}`, part(b, 0, 0, b.width, 20), DIM);
      rows(ctx, part(b, 0, 24, b.width, b.height - 24), list.map(entry => ({title: entry.name, detail: stateWord(entry.state), level: LEVEL[entry.state]})), {pitch: 18})
        .forEach((row, i) => env.hit(row, () => selectArch(list[i].id)));
      return;
    }
    el(ctx, 'moduleTile', part(b, 0, 0, b.width, 88), {name: module.name, runs: module.runs === 'job' ? 'JOB' : 'LIVE', inputs: module.inputs.join(', ') || 'NONE', outputs: module.outputs.join(', ') || 'NONE', app: module.app ?? 'NO APP', level: LEVEL[module.state], health: stateWord(module.state)});
    const used = 96 + facts(ctx, part(b, 0, 96, b.width, b.height - 96), [['WHERE', String(module.where).toUpperCase()], ['WHOSE', OWNERS[module.owner]], ['TODAY', module.today ?? '--', module.today ? AMBER : undefined], ['SOURCE', module.source]], {pitch: 15});
    if (b.height > used + 12) words(ctx, module.says, part(b, 0, used + 4, b.width, b.height - used - 4), MINT);
  }},

  'system-modules/module apps in the shell': {data: 'SAMPLE', paint(ctx, b) {
    const apps = MODULES.filter(module => module.app);
    let y = 0;
    for (const module of apps) {
      if (y + 8 > b.height - 24) break;
      fill(ctx, b.x, b.y + y + 1, 5, 5, COLOUR[module.state]);
      text(ctx, `<${module.app.toLowerCase()}>`, b.x + 9, b.y + y, MINT, {upper: false, room: b.width - 80});
      text(ctx, stateWord(module.state), b.x + b.width, b.y + y, COLOUR[module.state], {align: 'right', room: 70});
      y += 12;
    }
    words(ctx, OPEN_WITH_THE_LEAD[0], part(b, 0, Math.max(y + 2, b.height - 20), b.width, 20), AMBER);
  }},

  'system-modules/interfaces': {data: 'SAMPLE', paint(ctx, b) {
    const columns = [{title: 'INTERFACE', share: 2.2}, {title: 'MESSAGE TYPE', share: 3.2}, {title: 'STATE', share: 1.3, align: 'right'}];
    const half = Math.floor((b.width - 12) / 2), lead = INTERFACES.filter(entry => entry.owner === 'lead'), proposed = INTERFACES.filter(entry => entry.owner !== 'lead');
    const cell = entry => [entry.id, entry.type, stateWord(entry.state)];
    table(ctx, part(b, 0, 0, half, b.height), columns, lead.map(cell), {pitch: 13});
    table(ctx, part(b, half + 12, 0, b.width - half - 12, b.height), columns, proposed.map(cell), {pitch: 13});
    const below = 16 + proposed.length * 13 + 8;
    words(ctx, `SYNTHETIC EXTENSION PORTS: ${proposed.map(entry => entry.id).join(', ')}`, part(b, half + 12, below, b.width - half - 12, b.height - below), AMBER, {upper: false});
  }},

  // -------------------------------------------------------------------------------- System: chains
  'system-chains/chains': diagram('chains'),

  'system-chains/the picked step of a chain': {data: 'SAMPLE', paint(ctx, b, env) {
    const id = env.arch.id, item = env.arch.node ?? env.arch.module;
    const chains = CHAINS.filter(chain => chain.steps.some(step => (step.node ?? step.module) === id));
    if (!chains.length) { words(ctx, `${item.name} IS IN NO CHAIN YET: PICK A BOX ON A CHAIN`, b, DIM); return; }
    const half = Math.floor((b.width - 12) / 2), lines = [];
    for (const chain of chains.slice(0, 2)) {
      const at = chain.steps.findIndex(step => (step.node ?? step.module) === id);
      const before = chain.steps.slice(0, at).reverse().find(step => step.iface), after = chain.steps.slice(at + 1).find(step => step.iface);
      lines.push([chain.name, `IN ${before ? `${before.iface} (${interfaceById[before.iface].type})` : 'NOTHING'}; OUT ${after ? `${after.iface} (${interfaceById[after.iface].type})` : 'NOTHING'}`]);
    }
    let y = 0;
    for (const [name, detail] of lines) {
      text(ctx, name, b.x, b.y + y, MINT, {room: half});
      y += 12 + words(ctx, detail, part(b, 0, y + 12, half, 30), DIM, {upper: false});
    }
    words(ctx, item.says, part(b, half + 12, 0, b.width - half - 12, b.height), MINT);
  }},

  // ------------------------------------------------------------------------------ System: activity
  'system-activity/command log': {paint(ctx, b) {
    const list = SAMPLE.activity.filter(entry => entry.kind === 'command' || entry.kind === 'lease');
    list.forEach((entry, i) => { if ((i + 1) * 16 <= b.height - 40) el(ctx, 'textline', part(b, 0, i * 16, b.width, 14), {time: entry.time, text: `${entry.who}: ${entry.text}`}); });
    words(ctx, `${SAFETY.unsigned}. ALL LOG ROWS ARE SYNTHETIC FIXTURES`, part(b, 0, b.height - 30, b.width, 30), AMBER);
  }},

  'system-activity/leases': {paint(ctx, b, env) {
    const robots = NODES.filter(isRobot), operator = env.arch.person === 'operator';
    robots.forEach((robot, i) => {
      const held = env.ui.leases[robot.id];
      if (held) el(ctx, 'lease', part(b, 0, i * 18, b.width, 14), {state: operator ? 'held' : 'other'});
      else lampLine(ctx, b.x, b.y + i * 18 + 3, b.width, robot.name, 'NOBODY HOLDS IT', DIM);
    });
    let y = robots.length * 18 + 8;
    for (const entry of SAMPLE.activity.filter(item => item.kind === 'lease')) {
      if (y + 14 > b.height - 30) break;
      el(ctx, 'textline', part(b, 0, y, b.width, 14), {time: entry.time, text: entry.text});
      y += 16;
    }
    const lease = COMMAND_PATH.find(step => step.id === 'cp-lease');
    words(ctx, `ONE ROBOT, ONE OPERATOR: ${lease.says}`, part(b, 0, b.height - 30, b.width, 30), DIM);
  }},

  'system-activity/deploys': {paint(ctx, b) {
    const list = SAMPLE.activity.filter(entry => entry.kind === 'deploy');
    list.forEach((entry, i) => el(ctx, 'textline', part(b, 0, i * 16, b.width, 14), {time: entry.time, text: entry.text}));
    const top = list.length * 16 + 8;
    rows(ctx, part(b, 0, top, b.width, b.height - top), SAMPLE.deploys.map(entry => ({title: entry.cluster, detail: entry.last, level: entry.holds === 'NOTHING HELD' ? 'ok' : entry.last === '--' ? 'off' : 'warn'})), {pitch: 18});
  }},

  // ----------------------------------------------------------------------------------------- Device
  'system-device/device': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node, shown} = deviceOf(env.arch);
    let y = 0;
    if (!shown) { text(ctx, `NOT A DEVICE PICKED: SHOWING ${node.name}`, b.x, b.y, AMBER, {room: b.width}); y = 14; }
    el(ctx, 'deviceCard', part(b, 0, y, b.width, 136), {name: node.name, origin: node.origin ?? 'real', role: (node.role ?? node.kind).toUpperCase(), model: node.model ?? '--', cluster: clusterOf(node), ready: node.state === 'running', sensors: sensorsOf(node.id).map(sensor => ({name: sensor.name, port: ORIGINS[sensor.origin] ?? '', rate: ''}))});
    y += 144;
    y += facts(ctx, part(b, 0, y, b.width, b.height - y), [['STATE', stateWord(node.state), COLOUR[node.state]], ['WHOSE', OWNERS[node.owner]], ['SOURCE', node.source]], {pitch: 15});
    if (b.height > y + 12) words(ctx, node.today ? `TODAY: ${node.today}` : node.says, part(b, 0, y + 4, b.width, b.height - y - 4), node.today ? AMBER : MINT);
  }},

  'system-device/ports': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node} = deviceOf(env.arch);
    if (!node.ports.length) { words(ctx, `NO PORTS NAMED FOR ${node.name} YET${node.today ? `. TODAY: ${node.today}` : ''}`, b, DIM); return; }
    rows(ctx, b, node.ports.map(port => ({title: port, detail: PORT_INTERFACE[port] ?? '', level: 'ok'})), {pitch: 18});
  }},

  'system-device/sensors': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node} = deviceOf(env.arch), list = sensorsOf(node.id);
    if (!list.length) { words(ctx, `NO SENSOR RESOURCE ON ${node.name}`, b, DIM); return; }
    rows(ctx, b, list.map(sensor => ({title: sensor.name, detail: stateWord(sensor.state), level: LEVEL[sensor.state], selected: sensor.id === env.arch.id})), {pitch: 18})
      .forEach((row, i) => env.hit(row, () => selectArch(list[i].id)));
  }},

  'system-device/driver': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node} = deviceOf(env.arch), driver = node.runs.find(run => run.startsWith('DEVICE-') || run.includes('DRIVER'));
    facts(ctx, b, [['DRIVER', driver ? bare(driver) : 'NONE'], ['TOPICS', `/${node.id.replace(/-/g, '_')}/...`]], {pitch: 15});
  }},

  'system-device/static pods': {data: 'SAMPLE', paint(ctx, b, env) {
    const {node} = deviceOf(env.arch), pods = node.runs.filter(run => run.startsWith('STATIC POD'));
    if (!pods.length) { words(ctx, 'NO STATIC WORKLOADS IN THIS SYNTHETIC EXAMPLE', b, DIM); return; }
    rows(ctx, b, pods.map(pod => ({title: pod.replace(/^STATIC POD: /, ''), detail: 'FROM DISK', level: LEVEL[node.state]})), {pitch: 18});
  }},

  'system-device/logs': {paint(ctx, b, env) {
    const {node} = deviceOf(env.arch), logs = nodeById.logs;
    words(ctx, `${logs.model}: ${logs.says}`, part(b, 0, 0, b.width, 20), DIM);
    const mine = SAMPLE.activity.filter(entry => entry.text.includes(node.name)), list = mine.length ? mine : SAMPLE.activity;
    if (!mine.length) text(ctx, `NO LINES NAME ${node.name}: THE LATEST OF ALL`, b.x, b.y + 22, AMBER, {room: b.width});
    list.forEach((entry, i) => { if (36 + (i + 1) * 16 <= b.height + 2) el(ctx, 'textline', part(b, 0, 36 + i * 16, b.width, 14), {time: entry.time, text: `${entry.who}: ${entry.text}`}); });
  }},
};

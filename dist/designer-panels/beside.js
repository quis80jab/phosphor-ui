// Supplemental public visual examples: bench, files, pipeline, assistant and account forms.
// Account forms are local UI studies without an authentication backend.
import {SAMPLE, recordingById} from '../designer-records.js';
import {MODULES, SAFETY, COMMAND_PATH, nodeById, moduleById} from '../designer-architecture.js';
import {OUTLINE, LINKED_PAGES} from '../designer-outline.js';
import {previewData} from '../designer-data.js';
import {el, text, fill, outline, hline, triangle, facts, rows, table, chart, words, part, button, lampLine, textWidth, MINT, DIM, INK, PANEL, AMBER, RED} from './kit.js';

const CHECK = {done: ['ok', MINT, 'DONE'], now: ['warn', AMBER, 'NOW'], todo: ['off', DIM, '']};
const notInDesign = 'VISUAL FORM EXAMPLE ONLY; NO AUTHENTICATION SERVICE';
const field = (ctx, b, y, placeholder) => el(ctx, 'field', part(b, 0, y, b.width, 24), {placeholder});

/** A page of the pipeline as boxes in a row joined by arrows; gives back each stage's box. */
function stageRow(ctx, b, stages, picked) {
  const gap = 26, width = Math.floor((b.width - gap * (stages.length - 1)) / stages.length), height = Math.min(76, b.height);
  return stages.map((stage, i) => {
    const box = part(b, i * (width + gap), Math.floor((b.height - height) / 2), width, height), here = i === picked;
    fill(ctx, box.x, box.y, box.width, box.height, here ? MINT : PANEL);
    outline(ctx, box.x, box.y, box.width, box.height, here ? MINT : stage.job ? DIM : AMBER);
    text(ctx, stage.name, box.x + 6, box.y + 6, here ? INK : MINT, {room: box.width - 12});
    text(ctx, stage.detail, box.x + 6, box.y + 20, here ? INK : DIM, {room: box.width - 12});
    if (stage.job && box.height >= 50) {
      fill(ctx, box.x + 6, box.y + box.height - 14, Math.round((box.width - 12) * stage.job.done), 6, here ? INK : MINT);
      outline(ctx, box.x + 6, box.y + box.height - 14, box.width - 12, 6, here ? INK : DIM);
    }
    if (i < stages.length - 1) {
      const y = box.y + Math.floor(box.height / 2);
      hline(ctx, box.x + box.width + 3, y, gap - 8, DIM);
      triangle(ctx, box.x + box.width + gap - 5, y, 'right', 2, DIM);
    }
    return box;
  });
}

export default {
  // ----------------------------------------------------------------------------------------- Bench
  'bench/weight and balance': {paint(ctx, b) {
    const bench = SAMPLE.bench, margin = bench.mtow_kg - bench.mass_kg, side = Math.min(b.height, Math.floor(b.width / 2)) - 8;
    const used = facts(ctx, part(b, 0, 0, b.width - side - 12, b.height), [['MASS', `${bench.mass_kg.toFixed(2)} KG`], ['MOST AT TAKE-OFF', `${bench.mtow_kg.toFixed(2)} KG`], ['MARGIN', `${margin.toFixed(2)} KG`, margin < 0.6 ? AMBER : undefined], ['BALANCE', bench.cg]], {pitch: 16});
    words(ctx, bench.note, part(b, 0, used + 6, b.width - side - 12, b.height - used - 6), AMBER);
    // From above, nose up: the centre of the frame and where the weight sits, one pixel a millimetre or more.
    const box = part(b, b.width - side, 0, side, side), cx = box.x + Math.floor(side / 2), cy = box.y + Math.floor(side / 2), per = Math.max(2, Math.floor(side / 40));
    outline(ctx, box.x, box.y, box.width, box.height, DIM);
    hline(ctx, box.x + 4, cy, side - 8, DIM, true);
    for (let y = box.y + 4; y < box.y + side - 4; y += 2) fill(ctx, cx, y, 1, 1, DIM);
    text(ctx, 'NOSE', cx, box.y + 4, DIM, {align: 'center'});
    const gx = cx + bench.cg_cm.right * per * 3, gy = cy + bench.cg_cm.back * per * 3;
    outline(ctx, cx - 3, cy - 3, 7, 7, MINT);
    fill(ctx, gx - 2, gy - 2, 5, 5, AMBER);
    text(ctx, 'WEIGHT', gx + 6, gy + 2, AMBER);
  }},
  'bench/props-off checklist': {paint(ctx, b, env) {
    const list = SAMPLE.bench.checklist.map(([title, state], i) => ({title, state: env.ui.benchChecks[i] ? 'done' : state}));
    rows(ctx, b, list.map(item => ({title: item.title, detail: CHECK[item.state][2], level: CHECK[item.state][0]})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => { if (SAMPLE.bench.checklist[i][1] === 'done') return false; env.ui.benchChecks[i] = !env.ui.benchChecks[i]; return true; }));
    const top = list.length * 20 + 6;
    words(ctx, 'PROPS OFF, ON THE BENCH. A TICK HERE IS THIS PREVIEW ONLY; THE BENCH MODULE KEEPS THE REAL ONE', part(b, 0, top, b.width, b.height - top), DIM);
  }},
  'bench/the aircraft': {data: 'SAMPLE', paint(ctx, b) {
    const aircraft = nodeById.aircraft;
    const used = facts(ctx, b, [['AIRCRAFT', aircraft.model], ['TODAY', aircraft.today, AMBER]], {pitch: 16});
    words(ctx, `DEMO LIMITS: ${SAFETY.limits}`, part(b, 0, used + 6, b.width, b.height - used - 6), MINT);
  }},

  // ----------------------------------------------------------------------------------------- Files
  'files/sites': {paint(ctx, b) {
    table(ctx, b, [{title: 'SITE', share: 3}, {title: 'TARGETS', share: 1.4, align: 'right'}, {title: 'KEPT', share: 2, align: 'right'}], SAMPLE.sitesKept.map(site => [site.name, String(site.targets), site.kept]));
  }},
  'files/flights': {paint(ctx, b) {
    table(ctx, b, [{title: 'FLIGHT', share: 2}, {title: 'STATE', share: 2}, {title: 'MISSIONS', share: 1.6, align: 'right'}], SAMPLE.flights.map(flight => [flight.name, flight.state, String(flight.missions.length)]));
  }},
  'files/recordings': {paint(ctx, b) {
    table(ctx, b, [{title: 'RECORDING', share: 3.4}, {title: 'LENGTH', share: 1.4, align: 'right'}, {title: 'SIZE', share: 1.4, align: 'right'}], SAMPLE.recordings.map(rec => [rec.name, rec.length, rec.size]));
    const top = 16 + SAMPLE.recordings.length * 16 + 8;
    words(ctx, 'EACH WITH ITS TRUTH IN A FILE OF ITS OWN', part(b, 0, top, b.width, b.height - top), DIM);
  }},
  'files/results': {paint(ctx, b) {
    table(ctx, b, [{title: 'RESULT', share: 3}, {title: 'FROM', share: 3}, {title: 'KIND', share: 2}, {title: 'STATE', share: 2}, {title: 'SIZE', share: 1.4, align: 'right'}], SAMPLE.results.map(result => [result.name, recordingById(result.from).name, result.kind, result.state, result.size]));
    const minio = nodeById.minio, top = 16 + SAMPLE.results.length * 16 + 8;
    words(ctx, `DEMO FILE STORE (${minio.state.toUpperCase()}). TODAY: ${minio.today}`, part(b, 0, top, b.width, b.height - top), AMBER);
  }},

  // ------------------------------------------------------------------------------- Pipeline editor
  'pipeline/pipeline': {paint(ctx, b, env) {
    const stages = [{name: 'RECORDING', detail: recordingById('rec3').name}, ...SAMPLE.pipeline.map(job => ({name: job.stage, detail: job.where, job})), {name: 'CASES', detail: `${SAMPLE.cases.length} OPENED`}];
    stageRow(ctx, part(b, 0, 0, b.width, b.height - 20), stages, env.ui.stagePick + 1)
      .forEach((box, i) => { if (stages[i].job) env.hit(box, () => { if (env.ui.stagePick === i - 1) return false; env.ui.stagePick = i - 1; return true; }); });
    text(ctx, 'RUN 3 THROUGH THE INSPECTION CHAIN. A STAGE IS A JOB ON A GPU; ITS SETTINGS ARE EDITED HERE', b.x, b.y + b.height - 9, DIM, {room: b.width});
  }},
  'pipeline/the picked stage': {paint(ctx, b, env) {
    const job = SAMPLE.pipeline[env.ui.stagePick];
    const used = facts(ctx, part(b, 0, 0, b.width, b.height), [['STAGE', job.stage], ['TAKES', job.takes], ['GIVES', job.gives], ['RUNS ON', job.where], ['TIME', `${job.minutes} MIN OF ${job.target}`, job.minutes > job.target ? AMBER : undefined]], {pitch: 16});
    chart(ctx, part(b, 0, used + 4, b.width, b.height - used - 4), {type: 'bullet', value: job.minutes, max: Math.max(job.minutes, job.target) * 1.2, target: job.target, unit: 'MIN'});
  }},
  'pipeline/jobs': {paint(ctx, b) {
    const list = SAMPLE.events.filter(event => event.kind === 'job');
    rows(ctx, b, list.map(event => ({title: event.title, detail: `${event.who}, ${event.state.toUpperCase()}`, level: event.state === 'active' ? 'warn' : 'ok'})), {pitch: 20});
    const recon = moduleById['m-recon'], top = list.length * 20 + 6;
    words(ctx, `${recon.name}: ${recon.says}. TODAY: ${recon.today}`, part(b, 0, top, b.width, b.height - top), DIM);
  }},

  // ------------------------------------------------------------------------------------- Assistant
  'assistant/conversation': {paint(ctx, b) {
    let y = 0;
    for (const [who, said] of SAMPLE.assistant.conversation) {
      if (y + 20 > b.height - 32) break;
      text(ctx, who, b.x, b.y + y, who === 'YOU' ? DIM : AMBER); y += 11;
      y += words(ctx, said, part(b, 12, y, b.width - 12, b.height - 32 - y), MINT) + 8;
    }
    el(ctx, 'field', part(b, 0, b.height - 24, b.width, 24), {placeholder: 'ASK ABOUT A SITE OR A PLAN'});
  }},
  'assistant/what it may do': {data: 'SAMPLE', paint(ctx, b) {
    SAMPLE.assistant.may.forEach((item, i) => { if (i * 14 + 8 <= b.height) lampLine(ctx, b.x, b.y + i * 14, b.width, item, '', MINT); });
  }},
  'assistant/what it may not do': {data: 'SAMPLE', paint(ctx, b) {
    SAMPLE.assistant.mayNot.forEach((item, i) => { if (i * 14 + 8 <= b.height) lampLine(ctx, b.x, b.y + i * 14, b.width, item, '', RED); });
    const top = SAMPLE.assistant.mayNot.length * 14 + 8;
    words(ctx, moduleById['m-assistant'].says, part(b, 0, top, b.width, b.height - top), AMBER);
  }},

  // ------------------------------------------------------------------------------ Sim Kit, training
  'simkit/scenarios': {paint(ctx, b, env) {
    const list = SAMPLE.scenarios, picked = list[env.ui.scenarioPick];
    rows(ctx, b, list.map((item, i) => ({title: item.name, detail: item.state, level: item.state === 'PLANNED' ? 'off' : 'ok', selected: i === env.ui.scenarioPick})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.scenarioPick === i) return false; env.ui.scenarioPick = i; return true; }));
    const top = list.length * 20 + 8;
    facts(ctx, part(b, 0, top, b.width, b.height - top), [['TARGET', picked.target], ['SENSORS', picked.sensors]], {pitch: 16});
  }},
  'simkit/render jobs': {paint(ctx, b, env) {
    const list = SAMPLE.renders, picked = list[env.ui.renderPick];
    rows(ctx, b, list.map((item, i) => ({title: item.name, detail: item.state, level: item.state === 'PLANNED' ? 'off' : 'ok', selected: i === env.ui.renderPick})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.renderPick === i) return false; env.ui.renderPick = i; return true; }));
    const top = list.length * 20 + 8;
    facts(ctx, part(b, 0, top, b.width, b.height - top), [['KERNEL', picked.kernel], ['FRAMES', picked.frames ?? '--']], {pitch: 16});
    words(ctx, `${moduleById['m-simkit'].says}. ${moduleById['m-simkit'].state.toUpperCase()}`, part(b, 0, top + 40, b.width, b.height - top - 40), AMBER);
  }},
  'simkit/training runs': {paint(ctx, b, env) {
    const list = SAMPLE.training, picked = list[env.ui.trainingPick];
    rows(ctx, b, list.map((item, i) => ({title: item.name, detail: item.state, level: item.state === 'PLANNED' ? 'off' : 'ok', selected: i === env.ui.trainingPick})), {pitch: 20})
      .forEach((row, i) => env.hit(row, () => { if (env.ui.trainingPick === i) return false; env.ui.trainingPick = i; return true; }));
    const top = list.length * 20 + 8;
    facts(ctx, part(b, 0, top, b.width, b.height - top), [['DATA', picked.data], ['SCORE', picked.score === null ? '--' : `${picked.score.toFixed(2)} MAP50`], ['RUNS ON', nodeById.rtx2080.name]], {pitch: 16});
  }},
  'simkit/truth': {paint(ctx, b) {
    SAMPLE.recordings.forEach((rec, i) => lampLine(ctx, b.x, b.y + i * 14, b.width, rec.name, rec.truth, MINT));
    const top = SAMPLE.recordings.length * 14 + 8;
    words(ctx, 'THE TRUTH OF A SIMULATED RUN IS KEPT BESIDE IT, NEVER IN THE RECORDING THE PIPELINE READS: A MODEL IS SCORED AGAINST IT, NOT TRAINED ON IT', part(b, 0, top, b.width, b.height - top), DIM);
  }},

  // -------------------------------------------------------------------------------------- Settings
  'settings/units and time': {data: false, paint(ctx, b) {
    facts(ctx, b, [['LENGTH', 'METRES'], ['SPEED', 'METRES A SECOND'], ['HEIGHT', 'ABOVE HOME, AS A MISSION GIVES IT'], ['TEMPERATURE', 'DEGREES C'], ['TIME', SAMPLE.timeZone]], {pitch: 16});
  }},
  'settings/preview data': {data: false, paint(ctx, b) {
    text(ctx, `THIS PREVIEW: ${previewData().toUpperCase()}`, b.x, b.y, MINT, {room: b.width});
    words(ctx, 'SYNTHETIC TOPOLOGY AND RECORDS. ADD ?data=demo FOR THE COMPACT COMPONENT PREVIEW', part(b, 0, 16, b.width, b.height - 16), DIM, {upper: false});
  }},
  'settings/layout': {data: false, paint(ctx, b) {
    const tabs = OUTLINE.length - LINKED_PAGES.length;
    const used = facts(ctx, b, [['LAYOUT', 'VERSION 2'], ['PAGES', `${tabs} TABS, ${LINKED_PAGES.length} LINKED`]], {pitch: 16});
    words(ctx, 'EXPORT FIRST, THEN IMPORT: AN IMPORT REPLACES THE WHOLE LAYOUT OF THIS BROWSER', part(b, 0, used + 6, b.width, b.height - used - 6), AMBER);
  }},

  // ------------------------------------------------------------------------------- Sign in, and not
  'sign-in/sign in': {data: false, paint(ctx, b) {
    field(ctx, b, 0, 'USER NAME');
    field(ctx, b, 30, 'PASSWORD');
    button(ctx, part(b, 0, 62, b.width, 24), 'SIGN IN');
    words(ctx, COMMAND_PATH.find(step => step.id === 'cp-sign-in').says, part(b, 0, 96, b.width, b.height - 96), DIM);
  }},
  'sign-in/about sign-in': {data: 'SAMPLE', paint(ctx, b) {
    words(ctx, `THE SHELL SIGNS YOU IN. ${nodeById.operator.today}. ${nodeById.observer.says}`, b, DIM);
  }},
  'sign-up/sign up': {data: false, paint(ctx, b) {
    field(ctx, b, 0, 'USER NAME');
    field(ctx, b, 30, 'PASSWORD');
    button(ctx, part(b, 0, 62, b.width, 24), 'SIGN UP', {disabled: true});
    words(ctx, notInDesign, part(b, 0, 96, b.width, b.height - 96), AMBER);
  }},
  'reset-password/reset password': {data: false, paint(ctx, b) {
    field(ctx, b, 0, 'USER NAME');
    button(ctx, part(b, 0, 32, b.width, 24), 'SEND A RESET', {disabled: true});
    words(ctx, notInDesign, part(b, 0, 66, b.width, b.height - 66), AMBER);
  }},
};

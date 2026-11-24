// The SLAM replay of an .mcap in the inspection viewer: a synthetic recording (written here, in the
// ARACHNID payload format) of a camera stepping sideways past a wall 2 m ahead must come back as
// posed world points, frame by frame, and the replay scene must draw exactly the frames whose time has come.
import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReplay, buildReplayAsync, frameAt} from '../dist/mcap-replay.js';
import {createReplayScene} from '../dist/mcap-replay-scene.js';

const W = 16, H = 12, FX = 12, FRAMES = 4, STEP_M = 0.5, WALL_MM = 2000;

/** A minimal MCAP: magic, header, schemas, channels, messages, data end, footer, magic. */
function writeMcap(channels, messages) {
  const parts = [], u8 = v => Uint8Array.of(v), u16 = v => { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v, true); return b; };
  const u32 = v => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v, true); return b; };
  const u64 = v => { const b = new Uint8Array(8); const d = new DataView(b.buffer); d.setUint32(0, v % 2 ** 32, true); d.setUint32(4, Math.floor(v / 2 ** 32), true); return b; };
  const str = s => { const t = new TextEncoder().encode(s); return [u32(t.length), t]; };
  const cat = list => { const flat = list.flat(), out = new Uint8Array(flat.reduce((n, b) => n + b.length, 0)); let o = 0; for (const b of flat) { out.set(b, o); o += b.length; } return out; };
  const record = (op, body) => { const content = cat(body); parts.push(u8(op), u64(content.length), content); };
  const magic = Uint8Array.of(0x89, 0x4d, 0x43, 0x41, 0x50, 0x30, 0x0d, 0x0a);
  parts.push(magic);
  record(0x01, [str(''), str('phosphor-test')]);
  channels.forEach((c, i) => {
    record(0x03, [u16(i + 1), str(c.schema), str(c.encoding === 'cdr' ? 'ros2msg' : 'jsonschema'), u32(0)]);
    record(0x04, [u16(i + 1), u16(i + 1), str(c.topic), str(c.encoding), u32(0)]);
  });
  messages.forEach((m, seq) => record(0x05, [u16(m.channel), u32(seq), u64(m.time), u64(m.time), m.data]));
  record(0x0f, [u32(0)]);
  record(0x02, [u64(0), u64(0), u32(0)]);
  parts.push(magic);
  return cat(parts);
}

function depthPayload(ns) {
  const head = new Uint8Array(8 + 2 + 3 + 4 + 4 + 8 + 4), d = new DataView(head.buffer), id = new TextEncoder().encode('cam');
  d.setUint32(0, ns % 2 ** 32, true); d.setUint32(4, Math.floor(ns / 2 ** 32), true); d.setUint16(8, 3, true); head.set(id, 10);
  d.setUint32(13, W, true); d.setUint32(17, H, true); d.setFloat64(21, 0.001, true); d.setUint32(29, W * H * 2, true);
  const pixels = new Uint8Array(W * H * 2);
  for (let i = 0; i < W * H; i += 1) { pixels[i * 2] = WALL_MM & 255; pixels[i * 2 + 1] = WALL_MM >> 8; }
  const out = new Uint8Array(head.length + pixels.length); out.set(head); out.set(pixels, head.length); return out;
}
const json = value => new TextEncoder().encode(JSON.stringify(value));

function recording() {
  const channels = [
    {topic: '/cam/depth/camera_info', schema: 'arachnid.sensor.CameraInfo', encoding: 'json'},
    {topic: '/cam/depth', schema: 'arachnid.sensor.DepthImage', encoding: 'cdr'},
    {topic: '/arkit/pose', schema: 'arachnid.geometry.PoseStamped', encoding: 'json'},
  ];
  const t0 = 1_700_000_000_000_000_000 / 1e3, messages = [{channel: 1, time: t0, data: json({timestamp_ns: t0, width: W, height: H, fx: FX, fy: FX, cx: W / 2, cy: H / 2})}];
  for (let i = 0; i < FRAMES; i += 1) {
    const ns = t0 + i * 1e9; // one frame a second
    messages.push({channel: 2, time: ns, data: depthPayload(ns)});
    messages.push({channel: 3, time: ns, data: json({timestamp_ns: ns, translation: {x: i * STEP_M, y: 0, z: 0}, rotation: {x: 0, y: 0, z: 0, w: 1}})});
  }
  return writeMcap(channels, messages);
}

test('a recording becomes posed world points, one contiguous range a frame, in time order', () => {
  const replay = buildReplay(recording());
  assert.equal(replay.frames.length, FRAMES);
  assert.ok(replay.posed, 'the poses are used');
  assert.equal(replay.duration, FRAMES - 1, 'one frame a second');
  for (const [i, frame] of replay.frames.entries()) {
    assert.ok(frame.end > frame.start, `frame ${i} adds points`);
    if (i) assert.equal(frame.start, replay.frames[i - 1].end, 'ranges follow one another');
    let sumX = 0;
    for (let k = frame.start; k < frame.end; k += 1) {
      assert.ok(Math.abs(replay.positions[k * 3 + 2] + WALL_MM / 1000) < 1e-5, 'the wall stands 2 m ahead (-z)');
      sumX += replay.positions[k * 3];
    }
    const meanX = sumX / (frame.end - frame.start);
    assert.ok(Math.abs(meanX - (i * STEP_M - 2 / FX / 2)) < 0.2, `frame ${i} sits where its pose puts it (${meanX.toFixed(3)})`);
    assert.deepEqual(frame.position, [i * STEP_M, 0, 0]);
  }
  assert.ok(!replay.coloured && replay.colors[0] > 0, 'no colour stream: points get the phosphor colour');
});

test('the timeline picks the last frame whose time has come', () => {
  const replay = buildReplay(recording());
  assert.equal(frameAt(replay, 0), 0);
  assert.equal(frameAt(replay, 0.32), 0);
  assert.equal(frameAt(replay, 0.34), 1);
  assert.equal(frameAt(replay, 1), FRAMES - 1);
  assert.equal(frameAt(replay, 7), FRAMES - 1, 'clamped');
});

test('the async build gives the same replay, and a recording without depth says so', async () => {
  const bytes = recording(), a = buildReplay(bytes), b = await buildReplayAsync(bytes);
  assert.deepEqual([...b.positions], [...a.positions]);
  const noDepth = writeMcap([{topic: '/arkit/pose', schema: 'arachnid.geometry.PoseStamped', encoding: 'json'}], [{channel: 1, time: 1, data: json({timestamp_ns: 1, translation: {x: 0, y: 0, z: 0}, rotation: {x: 0, y: 0, z: 0, w: 1}})}]);
  assert.throws(() => buildReplay(noDepth), /no depth stream/);
});

test('the replay scene draws the cloud so far, the frame now, the trail and the frustum', () => {
  const replay = buildReplay(recording()), scene = createReplayScene();
  scene.load(replay);
  const [cloud, live, trail, frustum] = scene.group.children[0].children;
  for (const [progress, k] of [[0, 0], [0.5, 1], [1, FRAMES - 1]]) {
    assert.equal(scene.setFrame(progress), k);
    assert.equal(cloud.geometry.drawRange.count, replay.frames[k].end, 'the cloud is every frame so far');
    assert.equal(live.geometry.drawRange.start, replay.frames[k].start, 'the frame now is lit');
    assert.equal(trail.geometry.drawRange.count, k + 1, 'the trail reaches the camera');
    assert.deepEqual(frustum.position.toArray(), replay.frames[k].position, 'the frustum stands at the pose');
  }
  assert.equal(scene.metadata.frames, FRAMES);
  assert.ok(scene.metadata.bounds.max[0] - scene.metadata.bounds.min[0] <= 3.41, 'fitted to the stage');
  assert.deepEqual(scene.frameInfo().index, FRAMES - 1);
  scene.dispose();
  assert.equal(scene.loaded, false);
});

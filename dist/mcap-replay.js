// SLAM replay of an ARACHNID recording (.mcap), as arachnid-flight's scan viewer replays one: every
// depth frame is deprojected through the camera intrinsics, carried into the world by the pose of
// its moment (world = R(q) * camera + t, camera frame x right, y up, -z forward), coloured from the
// colour frame when there is one, and appended in time order. A frame's points are a contiguous
// range, so the replay of frame k is the first `frames[k].end` points.
//
// The container and payload decoding is the reader arachnid-flight and Splat Studio use
// (vendor/scan-reader, copied from the Studio's glass/reader). Pure: no DOM, no three.js.
import {parseMcap, decodeMcapDepthImage, decodeMcapColorImage, decodeMcapCameraInfo, decodeMcapPoseStamped, colorImageToRGB, decodeJpegToRGB} from './vendor/scan-reader/scan-viewer.js';

const SCHEMA = {
  depth: 'arachnid.sensor.DepthImage', color: 'arachnid.sensor.ColorImage',
  info: 'arachnid.sensor.CameraInfo', pose: 'arachnid.geometry.PoseStamped',
};
export const REPLAY_DEFAULTS = Object.freeze({pointsPerFrame: 3000, near: 0.3, far: 6, maxFrames: 2000});

/** The ARACHNID recording's channels by kind; the busiest stream of each kind wins, as in arachnid-flight. */
function channelsOf(connections, messages) {
  const count = new Map();
  for (const m of messages) count.set(m.conn, (count.get(m.conn) || 0) + 1);
  const pick = kind => [...connections].filter(([, c]) => c.msgType === SCHEMA[kind] || c.schemaName === SCHEMA[kind])
    .sort((a, b) => (count.get(b[0]) || 0) - (count.get(a[0]) || 0)).map(([id]) => id);
  const depth = pick('depth')[0];
  if (depth === undefined) throw new Error(`This recording has no depth stream (${SCHEMA.depth}), so there is nothing to replay.`);
  const space = (connections.get(depth).topic || '').replace(/\/[^/]+$/, '');
  const infos = pick('info');
  return {
    depth, color: pick('color')[0] ?? null, pose: pick('pose')[0] ?? null,
    info: infos.find(id => space && (connections.get(id).topic || '').startsWith(space)) ?? infos[0] ?? null,
    topics: [...connections].map(([id, c]) => ({topic: c.topic, schema: c.msgType, messages: count.get(id) || 0})),
  };
}

/** The rotation matrix of a unit quaternion, row-major. */
function rotation({qx, qy, qz, qw}) {
  const n = Math.hypot(qx, qy, qz, qw) || 1, x = qx / n, y = qy / n, z = qz / n, w = qw / n;
  return [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y),
    2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x),
    2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)];
}

/** The pose of each depth frame: one to one when the counts match, else the nearest in time. */
function pairPoses(depthTimes, poses) {
  if (!poses.length) return depthTimes.map(() => null);
  if (poses.length === depthTimes.length) return poses;
  const sorted = [...poses].sort((a, b) => a.timeMs - b.timeMs);
  let k = 0;
  return depthTimes.map(t => {
    while (k + 1 < sorted.length && Math.abs(sorted[k + 1].timeMs - t) <= Math.abs(sorted[k].timeMs - t)) k += 1;
    return sorted[k];
  });
}

/** True for a pose arachnid-flight would also refuse (librealsense's pre-tracking garbage). */
const bogus = p => !p || !Number.isFinite(Math.hypot(p.tx, p.ty, p.tz)) || Math.hypot(p.tx, p.ty, p.tz) > 1e6 || Math.abs(Math.hypot(p.qx, p.qy, p.qz, p.qw) - 1) > 0.5;

/**
 * Builds the replay from the bytes of an .mcap. Returns
 * {frames: [{index, timeS, position, quaternion, start, end}], positions, colors, trail, bounds,
 *  duration, intrinsics, posed, coloured, topics, pointCount}.
 */
/** Parses the container and decodes depth, poses and intrinsics; colour frames stay encoded. */
function prepare(arrayBuffer, opts) {
  const buffer = arrayBuffer instanceof ArrayBuffer ? arrayBuffer : arrayBuffer.buffer.slice(arrayBuffer.byteOffset, arrayBuffer.byteOffset + arrayBuffer.byteLength);
  const {connections, messages} = parseMcap(buffer);
  const ch = channelsOf(connections, messages);
  const of = id => id === null ? [] : messages.filter(m => m.conn === id);
  const encoding = id => ({messageEncoding: id === null ? undefined : connections.get(id)?.messageEncoding});

  const infoMessage = of(ch.info)[0];
  const intrinsics = infoMessage ? decodeMcapCameraInfo(infoMessage.data, encoding(ch.info)) : null;
  if (!intrinsics || !(intrinsics.fx > 0) || !(intrinsics.fy > 0)) throw new Error('This recording has no camera intrinsics (CameraInfo), so its depth cannot be placed in space.');

  const allDepth = of(ch.depth), depthMessages = allDepth.slice(0, opts.maxFrames);
  const depths = depthMessages.map(m => decodeMcapDepthImage(m.data, encoding(ch.depth)));
  const colorMessages = of(ch.color);
  const poses = of(ch.pose).map(m => { try { return decodeMcapPoseStamped(m.data, encoding(ch.pose)); } catch { return null; } }).filter(Boolean);
  // Colour frames pair with depth frames by index when the counts match, else by nearest time.
  const times = colorMessages.map(m => m.timeMs);
  const colorIndex = depthMessages.map((m, i) => {
    if (!colorMessages.length) return -1;
    if (colorMessages.length === depthMessages.length) return i;
    let best = 0; for (let k = 1; k < times.length; k += 1) if (Math.abs(times[k] - m.timeMs) < Math.abs(times[best] - m.timeMs)) best = k;
    return best;
  });
  const decodeColor = k => { try { return colorImageToRGB(decodeMcapColorImage(colorMessages[k].data, encoding(ch.color))); } catch { return null; } };
  return {ch, intrinsics, depthMessages, depths, poses, colorMessages, colorIndex, decodeColor, truncated: allDepth.length > depthMessages.length};
}

/**
 * Builds the replay from the bytes of an .mcap. Returns
 * {frames: [{index, timeS, position, quaternion, start, end}], positions, colors, trail, bounds,
 *  duration, intrinsics, posed, coloured, topics, pointCount}. JPEG colour frames need an
 *  asynchronous decoder: buildReplayAsync() decodes them; here they leave their points uncoloured.
 */
export function buildReplay(arrayBuffer, options = {}) {
  const opts = {...REPLAY_DEFAULTS, ...options}, prepared = prepare(arrayBuffer, opts);
  const cache = new Map(), colorFor = i => { const k = prepared.colorIndex[i]; if (k < 0) return null; if (!cache.has(k)) cache.set(k, prepared.decodeColor(k)); return cache.get(k); };
  return assemble(prepared, colorFor, opts);
}

/** As buildReplay, decoding JPEG colour frames with the browser's image decoder first. */
export async function buildReplayAsync(arrayBuffer, options = {}) {
  const opts = {...REPLAY_DEFAULTS, ...options}, prepared = prepare(arrayBuffer, opts), cache = new Map();
  for (const k of new Set(prepared.colorIndex.filter(k => k >= 0))) {
    let image = prepared.decodeColor(k);
    if (image && !image.rgb && image.jpeg) { try { image = await decodeJpegToRGB(image.jpeg); } catch { image = null; } }
    cache.set(k, image);
  }
  return assemble(prepared, i => { const k = prepared.colorIndex[i]; return k < 0 ? null : cache.get(k) ?? null; }, opts);
}

function assemble(prepared, colorFor, opts) {
  const {ch, intrinsics, depths, poses, colorMessages} = prepared;
  const paired = pairPoses(depths.map(d => d.timestampMs), poses);
  const posed = paired.length > 0 && !bogus(paired[0]);

  const positions = new Float32Array(depths.length * opts.pointsPerFrame * 3), colors = new Uint8Array(depths.length * opts.pointsPerFrame * 3);
  const frames = [], trail = [];
  const t0 = depths.length ? depths[0].timestampMs : 0;
  let n = 0;
  for (const [i, depth] of depths.entries()) {
    const pose = posed ? paired[i] : null, start = n;
    const R = pose ? rotation(pose) : [1, 0, 0, 0, 1, 0, 0, 0, 1], t = pose ? [pose.tx, pose.ty, pose.tz] : [0, 0, 0];
    const w = depth.width, h = depth.height, scale = depth.depthScaleM > 0 ? depth.depthScaleM : 0.001;
    const sx = (intrinsics.width && intrinsics.width !== w) ? intrinsics.width / w : 1, sy = (intrinsics.height && intrinsics.height !== h) ? intrinsics.height / h : 1;
    const fx = intrinsics.fx / sx, fy = intrinsics.fy / sy, cx = intrinsics.cx / sx, cy = intrinsics.cy / sy;
    const src = depth.data, found = colorFor(i), color = found?.rgb ? found : null, cw = color?.width || 0, chh = color?.height || 0;
    const stride = Math.max(1, Math.round(Math.sqrt((w * h) / (opts.pointsPerFrame / 0.9))));
    let kept = 0;
    for (let v = 0; v < h && kept < opts.pointsPerFrame; v += stride) {
      for (let u = 0; u < w && kept < opts.pointsPerFrame; u += stride) {
        const o = (v * w + u) * 2, z = (src[o] | (src[o + 1] << 8)) * scale;
        if (!(z > opts.near && z < opts.far)) continue;
        const x = (u - cx) * z / fx, y = -(v - cy) * z / fy, zc = -z;
        const p = n * 3;
        positions[p] = R[0] * x + R[1] * y + R[2] * zc + t[0];
        positions[p + 1] = R[3] * x + R[4] * y + R[5] * zc + t[1];
        positions[p + 2] = R[6] * x + R[7] * y + R[8] * zc + t[2];
        if (color) {
          const ci = (((v * chh / h) | 0) * cw + ((u * cw / w) | 0)) * 3;
          colors[p] = color.rgb[ci]; colors[p + 1] = color.rgb[ci + 1]; colors[p + 2] = color.rgb[ci + 2];
        } else { colors[p] = 120; colors[p + 1] = 230; colors[p + 2] = 200; }
        n += 1; kept += 1;
      }
    }
    trail.push(t[0], t[1], t[2]);
    frames.push({index: i, timeS: (depth.timestampMs - t0) / 1000, position: t, quaternion: pose ? [pose.qx, pose.qy, pose.qz, pose.qw] : [0, 0, 0, 1], start, end: n});
  }
  if (!n) throw new Error(`No depth between ${opts.near} and ${opts.far} m in this recording.`);

  // Bounds from the 2nd to 98th percentile on each axis, so a few stray far points do not shrink the scene.
  const bounds = {min: [0, 0, 0], max: [0, 0, 0]};
  for (let axis = 0; axis < 3; axis += 1) {
    const step = Math.max(1, Math.floor(n / 20000)), sample = [];
    for (let k = 0; k < n; k += step) sample.push(positions[k * 3 + axis]);
    for (let k = axis; k < trail.length; k += 3) sample.push(trail[k]);
    sample.sort((a, b) => a - b);
    bounds.min[axis] = sample[Math.floor(sample.length * 0.02)];
    bounds.max[axis] = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.98))];
  }
  return {
    frames, positions: positions.subarray(0, n * 3), colors: colors.subarray(0, n * 3), trail: new Float32Array(trail), bounds,
    duration: frames.length > 1 ? frames.at(-1).timeS : 0, intrinsics, posed, coloured: colorMessages.length > 0,
    topics: ch.topics, pointCount: n, truncated: prepared.truncated,
  };
}

/** The frame on screen at a timeline position (0 to 1): the last frame whose time has come. */
export function frameAt(replay, progress) {
  const frames = replay.frames;
  if (!frames.length) return -1;
  if (!(replay.duration > 0)) return Math.round(Math.min(1, Math.max(0, progress)) * (frames.length - 1));
  const t = Math.min(1, Math.max(0, progress)) * replay.duration;
  let lo = 0, hi = frames.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (frames[mid].timeS <= t) lo = mid; else hi = mid - 1; }
  return lo;
}

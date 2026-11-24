// The SLAM replay drawn in the inspection viewer: the cloud so far, the frame being added lit in
// phosphor, the camera's trail and its frustum at the current pose. The recording is fitted into
// the viewer's stage (centred on the floor, its longest side about four units), as imported scenes are.
import * as THREE from './vendor/three.module.js';
import {frameAt} from './mcap-replay.js?v=replay-1';
export {frameAt};

const STAGE = 3.4, FRUSTUM_M = 0.35, LIVE = '#b7ffe0', TRAIL = '#ffb86c', FRUSTUM = '#dbfff0';

export function createReplayScene() {
  const group = new THREE.Group(); group.name = 'mcap-replay'; group.visible = false;
  const world = new THREE.Group(); group.add(world);
  const disposables = [];
  let replay = null, cloud = null, live = null, trail = null, frustum = null, current = -1;
  const metadata = {count: 0, frames: 0, duration: 0, frame: -1, bounds: {min: [-1, -1.48, -1], max: [1, 1, 1]}};

  function clear() {
    for (const item of disposables.splice(0)) item.dispose?.();
    world.clear();
    replay = cloud = live = trail = frustum = null; current = -1;
  }

  /** Shows a replay built by buildReplay(); replaces any shown before. With {fit} (scan-source.js) it
   *  follows the hologram stage's placement; with {cloud: false} the projector draws the cloud as cells
   *  and this draws only the frame now, the trail and the frustum. */
  function load(data, {fit = null, cloud: drawCloud = true} = {}) {
    clear();
    replay = data;
    // Two geometries over the same attributes: each keeps its own draw range (all so far, the frame now).
    const position = new THREE.BufferAttribute(data.positions, 3), color = new THREE.BufferAttribute(data.colors, 3, true);
    const geometry = new THREE.BufferGeometry().setAttribute('position', position).setAttribute('color', color);
    const liveGeometry = new THREE.BufferGeometry().setAttribute('position', position);
    disposables.push(geometry, liveGeometry);
    const cloudMaterial = new THREE.PointsMaterial({size: 2, sizeAttenuation: false, vertexColors: true, toneMapped: false, fog: false});
    const liveMaterial = new THREE.PointsMaterial({size: 3, sizeAttenuation: false, color: LIVE, toneMapped: false, fog: false, depthTest: false, transparent: true, opacity: .9});
    disposables.push(cloudMaterial, liveMaterial);
    cloud = new THREE.Points(geometry, cloudMaterial); cloud.frustumCulled = false;
    live = new THREE.Points(liveGeometry, liveMaterial); live.frustumCulled = false; live.renderOrder = 20;
    const trailGeometry = new THREE.BufferGeometry(); trailGeometry.setAttribute('position', new THREE.BufferAttribute(data.trail, 3));
    const trailMaterial = new THREE.LineBasicMaterial({color: TRAIL, toneMapped: false, fog: false, depthTest: false, transparent: true});
    trail = new THREE.Line(trailGeometry, trailMaterial); trail.frustumCulled = false; trail.renderOrder = 21;
    frustum = new THREE.LineSegments(frustumGeometry(data.intrinsics), new THREE.LineBasicMaterial({color: FRUSTUM, toneMapped: false, fog: false, depthTest: false, transparent: true}));
    frustum.renderOrder = 22;
    disposables.push(trailGeometry, trailMaterial, frustum.geometry, frustum.material);
    world.add(cloud, live, trail, frustum);
    cloud.visible = drawCloud;

    // Fit: centre the middle of the scene on the stage, its floor on the stage floor.
    const {min, max} = data.bounds, size = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2], 1e-3), s = STAGE / size;
    if (fit) { world.scale.setScalar(fit.s); world.position.set(...fit.apply(0, 0, 0)); }
    else { world.scale.setScalar(s); world.position.set(-(min[0] + max[0]) / 2 * s, -1.48 - min[1] * s, -(min[2] + max[2]) / 2 * s); }
    Object.assign(metadata, {count: data.pointCount, frames: data.frames.length, duration: data.duration, scale: s,
      bounds: {min: [(min[0] - (min[0] + max[0]) / 2) * s, -1.48, (min[2] - (min[2] + max[2]) / 2) * s], max: [(max[0] - (min[0] + max[0]) / 2) * s, -1.48 + (max[1] - min[1]) * s, (max[2] - (min[2] + max[2]) / 2) * s]}});
    current = -1;
    setFrame(0);
  }

  /** Moves the replay to a timeline position (0 to 1); gives back the frame shown. */
  function setFrame(progress) {
    if (!replay) return -1;
    const k = frameAt(replay, progress);
    if (k === current) return k;
    current = k;
    const frame = replay.frames[k];
    cloud.geometry.setDrawRange(0, frame.end);
    live.geometry.setDrawRange(frame.start, frame.end - frame.start);
    trail.geometry.setDrawRange(0, k + 1);
    frustum.position.set(...frame.position);
    frustum.quaternion.set(...frame.quaternion);
    metadata.frame = k;
    return k;
  }

  return {
    group, metadata, load, setFrame, clear,
    get loaded() { return !!replay; },
    get replay() { return replay; },
    frameInfo() { if (!replay || current < 0) return null; const f = replay.frames[current]; return {index: current, of: replay.frames.length, timeS: f.timeS, duration: replay.duration, points: f.end, added: f.end - f.start}; },
    dispose() { clear(); },
  };
}

/** A camera frustum from the intrinsics: the apex at the camera, the image rectangle FRUSTUM_M ahead. */
function frustumGeometry(intr) {
  const w = intr.width || 2 * intr.cx, h = intr.height || 2 * intr.cy, d = FRUSTUM_M;
  const corner = (u, v) => [(u - intr.cx) * d / intr.fx, -(v - intr.cy) * d / intr.fy, -d];
  const a = corner(0, 0), b = corner(w, 0), c = corner(w, h), e = corner(0, h), o = [0, 0, 0];
  const up = [0, -(0 - intr.cy) * d / intr.fy * 1.25, -d];
  const segments = [o, a, o, b, o, c, o, e, a, b, b, c, c, e, e, a, a, up, up, b];
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(segments.flat(), 3));
}

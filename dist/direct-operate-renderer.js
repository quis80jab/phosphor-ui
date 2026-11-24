import * as THREE from './vendor/three.module.js';

const radians = THREE.MathUtils.degToRad;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const validMarker = marker => marker?.position?.length === 3 && marker.position.every(Number.isFinite)
  && Number.isFinite(marker.metersToWorld) && marker.metersToWorld > 0;

/** Three cameras share the scene and framebuffer, then the universal VFD pass. */
export function createDirectOperateRenderer(scene) {
  const rig = new THREE.Group(); rig.name = 'direct-operate-drone'; rig.visible = false; scene.add(rig);
  const resources = [], keep = value => (resources.push(value), value);
  const hull = keep(new THREE.MeshBasicMaterial({ color: '#8ab4b0', toneMapped: false }));
  const dark = keep(new THREE.MeshBasicMaterial({ color: '#173c42', toneMapped: false }));
  const mint = keep(new THREE.MeshBasicMaterial({ color: '#bcffe0', toneMapped: false }));
  const red = keep(new THREE.MeshBasicMaterial({ color: '#ff5469', toneMapped: false }));
  const rotorMaterial = keep(new THREE.MeshBasicMaterial({ color: '#7bd6c4', transparent: true, opacity: .36, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }));
  function box(x, y, z, px, py, pz, material = hull) {
    const mesh = new THREE.Mesh(keep(new THREE.BoxGeometry(x, y, z)), material);
    mesh.position.set(px, py, pz); rig.add(mesh); return mesh;
  }
  // Dimensions are metres; the map's projection and geometry zoom supply scale.
  box(.29, .13, .43, 0, 0, 0);
  box(.22, .035, .28, 0, .083, .03, dark);
  box(.12, .065, .06, 0, -.015, -.235, red);
  box(.09, .08, .09, 0, -.115, -.13, dark);
  box(.055, .045, .02, 0, -.115, -.185, mint);
  const rotors = [];
  for (const x of [-.39, .39]) for (const z of [-.39, .39]) {
    const arm = box(Math.hypot(x, z), .035, .045, x / 2, .005, z / 2, dark);
    arm.rotation.y = -Math.atan2(z, x);
    box(.08, .09, .08, x, .035, z, hull);
    box(.035, .035, .035, x, .1, z, z < 0 ? red : mint);
    const disk = new THREE.Mesh(keep(new THREE.CircleGeometry(.205, 12)), rotorMaterial);
    disk.rotation.x = -Math.PI / 2; disk.position.set(x, .095, z); rig.add(disk);
    const rotor = box(.39, .012, .035, x, .103, z, mint); rotors.push(rotor);
    box(.025, .15, .025, x * .6, -.1, z * .65, dark);
  }
  const chase = new THREE.PerspectiveCamera(48, 1, .001, 80); chase.name = 'direct-operate-chase';
  const map = new THREE.PerspectiveCamera(48, 1, .001, 80); map.name = 'direct-operate-map'; map.up.set(0, 0, -1);
  const feed = new THREE.PerspectiveCamera(65, 1, .0005, 80); feed.name = 'direct-operate-feed';
  const forward = new THREE.Vector3(), target = new THREE.Vector3(), offset = new THREE.Vector3();
  const attitude = new THREE.Euler(0, 0, 0, 'YXZ');
  const cameraMount = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), radians(-8));
  const previousViewport = new THREE.Vector4(), previousScissor = new THREE.Vector4();
  let active = false, ready = false, disposed = false;
  let layout = { map: { x: .38, y: .46, width: .24, height: .2 }, feed: { x: .36, y: .7, width: .28, height: .25 } };
  function normalizeRect(rect) {
    if (!rect || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(rect[key]))) return null;
    const x = clamp(rect.x, 0, 1), y = clamp(rect.y, 0, 1);
    const width = clamp(rect.width, 0, 1 - x), height = clamp(rect.height, 0, 1 - y);
    return width > 0 && height > 0 ? { x, y, width, height } : null;
  }
  function viewport(rect, width, height) {
    if (!rect) return null;
    const x = Math.round(rect.x * width), top = Math.round(rect.y * height);
    const w = Math.round((rect.x + rect.width) * width) - x;
    const h = Math.round((rect.y + rect.height) * height) - top;
    return w > 0 && h > 0 ? [x, height - top - h, w, h] : null;
  }
  return {
    rig, cameras: { chase, map, feed },
    setActive(value) { active = !!value && !disposed; rig.visible = active && ready; },
    setLayout(value = {}) { layout = { map: normalizeRect(value.map), feed: normalizeRect(value.feed) }; },
    update(marker, time = 0, aspect = 1) {
      ready = active && validMarker(marker); rig.visible = ready;
      if (!ready) return false;
      const scale = marker.metersToWorld, heading = radians(marker.heading ?? marker.yaw ?? 0);
      rig.position.set(...marker.position); rig.scale.setScalar(scale);
      attitude.set(radians(marker.pitch || 0), -radians(marker.yaw ?? marker.heading ?? 0), -radians(marker.roll || 0), 'YXZ');
      rig.quaternion.setFromEuler(attitude); rig.updateMatrixWorld(true);
      for (const [index, rotor] of rotors.entries()) rotor.rotation.y = time * .045 * (index % 2 ? 1 : -1);
      forward.set(Math.sin(heading), 0, -Math.cos(heading));
      chase.position.copy(rig.position).addScaledVector(forward, -8 * scale); chase.position.y += 5 * scale;
      // Keep the aircraft above the stacked camera windows, around 40% frame height.
      target.copy(rig.position); target.y -= 1.2 * scale;
      chase.up.set(0, 1, 0); chase.lookAt(target); chase.aspect = aspect; chase.updateProjectionMatrix(); chase.updateMatrixWorld(true);
      // North stays at the top of this map; it follows position, not yaw.
      map.position.copy(rig.position); map.position.y += 70 * scale;
      map.lookAt(rig.position); map.updateMatrixWorld(true);
      offset.set(0, -.11, -.26).applyQuaternion(rig.quaternion).multiplyScalar(scale);
      feed.position.copy(rig.position).add(offset); feed.quaternion.copy(rig.quaternion).multiply(cameraMount); feed.updateMatrixWorld(true);
      return true;
    },
    render(renderer, world, width, height) {
      if (!active || !ready) return false;
      renderer.getViewport(previousViewport); renderer.getScissor(previousScissor);
      const previousScissorTest = renderer.getScissorTest(), previousAutoClear = renderer.autoClear;
      const rigVisible = rig.visible;
      try {
        renderer.autoClear = true;
        renderer.setScissorTest(false); renderer.setViewport(0, 0, width, height);
        renderer.render(world, chase);
        for (const [name, camera] of [['map', map], ['feed', feed]]) {
          const bounds = viewport(layout[name], width, height); if (!bounds) continue;
          camera.aspect = bounds[2] / bounds[3]; camera.updateProjectionMatrix();
          renderer.setScissorTest(true); renderer.setViewport(...bounds); renderer.setScissor(...bounds);
          rig.visible = name !== 'feed';
          renderer.render(world, camera);
        }
      } finally {
        rig.visible = rigVisible; renderer.autoClear = previousAutoClear;
        renderer.setViewport(previousViewport); renderer.setScissor(previousScissor); renderer.setScissorTest(previousScissorTest);
      }
      return true;
    },
    dispose() {
      if (disposed) return; disposed = true; active = ready = false;
      rig.removeFromParent(); for (const resource of resources) resource.dispose(); rig.clear();
    }
  };
}

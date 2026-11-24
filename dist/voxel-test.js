import * as THREE from './vendor/three.module.js';

const VERTEX = `
  attribute vec3 voxelOffset;
  attribute vec3 voxelColor;
  uniform float uVoxelSize;
  varying vec3 vColor, vNormal;
  void main() {
    vColor = voxelColor;
    vNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(voxelOffset + position * uVoxelSize, 1.0);
  }
`;
const FRAGMENT = `
  varying vec3 vColor, vNormal;
  void main() {
    float light = 0.73 + 0.27 * max(dot(normalize(vNormal), normalize(vec3(-0.45, 0.82, 0.55))), 0.0);
    gl_FragColor = vec4(vColor * light, 1.0);
    #include <colorspace_fragment>
  }
`;
const abortError = signal => signal?.reason instanceof Error ? signal.reason : new DOMException('Voxel rebuild cancelled.', 'AbortError');
function checkAbort(signal) { if (signal?.aborted) throw abortError(signal); }
const linear = value => { const v = Math.max(0, Math.min(1, value)); return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; };

/** Copy Spark's reused decoded record before asking it for the next record. */
export async function extractVoxelPoints(mesh, { signal, onProgress } = {}) {
  checkAbort(signal);
  const count = mesh.numSplats;
  if (!Number.isSafeInteger(count) || count < 1 || !mesh.extSplats?.getSplat) throw new Error('The original splats are not ready for the voxel test.');
  mesh.updateMatrix();
  const m = mesh.matrix.elements.slice(), points = new Float32Array(count * 7);
  let index = 0;
  while (index < count) {
    checkAbort(signal);
    const stop = performance.now() + 7;
    do {
      const end = Math.min(count, index + 1024);
      for (; index < end; index++) {
        const record = mesh.extSplats.getSplat(index), offset = index * 7;
        const x = record.center.x, y = record.center.y, z = record.center.z;
        points[offset] = m[0] * x + m[4] * y + m[8] * z + m[12];
        points[offset + 1] = m[1] * x + m[5] * y + m[9] * z + m[13];
        points[offset + 2] = m[2] * x + m[6] * y + m[10] * z + m[14];
        // PLY DC colors are sRGB values. Average in linear light, then let the
        // shared VFD compositor apply color/brightness to the rendered cubes.
        points[offset + 3] = linear(record.color.r);
        points[offset + 4] = linear(record.color.g);
        points[offset + 5] = linear(record.color.b);
        points[offset + 6] = record.opacity;
      }
    } while (index < count && performance.now() < stop);
    onProgress?.({ stage:'extract', progress:index / count * .4 });
    if (index < count) await new Promise(resolve => setTimeout(resolve, 0));
  }
  checkAbort(signal);
  return points;
}

function binInWorker(points, voxelSize, signal, onProgress) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./voxel-test-worker.js?v=voxels-1', import.meta.url), { type:'module' });
    let settled = false;
    const finish = (error, result) => {
      if (settled) return;
      settled = true; signal?.removeEventListener('abort', abort); worker.terminate();
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(abortError(signal));
    signal?.addEventListener('abort', abort, { once:true });
    worker.onerror = event => { event.preventDefault?.(); finish(new Error(event.message || 'Voxel aggregation failed.')); };
    worker.onmessage = ({ data }) => {
      if (data.id !== 1 || settled) return;
      if (data.type === 'progress') onProgress?.({ stage:'bin', progress:.4 + data.progress * .59 });
      else if (data.type === 'error') finish(new Error(data.message));
      else if (data.type === 'result') finish(null, data);
    };
    try { worker.postMessage({ type:'build', id:1, voxelSize, points }, [points.buffer]); }
    catch (error) { finish(error); }
  });
}

/** Genuine world-space cubes, rebuilt at the pane's display-pixel pitch. */
export async function createVoxelTest(mesh, { voxelSize, signal, onProgress } = {}) {
  if (!Number.isFinite(voxelSize) || voxelSize <= 0) throw new Error('The voxel pitch must be positive.');
  const points = await extractVoxelPoints(mesh, { signal, onProgress });
  const data = await binInWorker(points, voxelSize, signal, onProgress);
  checkAbort(signal);
  const base = new THREE.BoxGeometry(1, 1, 1), geometry = new THREE.InstancedBufferGeometry();
  geometry.index = base.index;
  for (const [name, attribute] of Object.entries(base.attributes)) geometry.setAttribute(name, attribute);
  geometry.setAttribute('voxelOffset', new THREE.InstancedBufferAttribute(data.positions, 3));
  geometry.setAttribute('voxelColor', new THREE.InstancedBufferAttribute(data.colors, 3));
  geometry.instanceCount = data.count;
  geometry.boundingBox = new THREE.Box3(new THREE.Vector3(...data.bounds.min), new THREE.Vector3(...data.bounds.max));
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  const material = new THREE.ShaderMaterial({ vertexShader:VERTEX, fragmentShader:FRAGMENT,
    uniforms:{ uVoxelSize:{ value:voxelSize } }, transparent:false, depthTest:true, depthWrite:true, toneMapped:false });
  const cubes = new THREE.Mesh(geometry, material); cubes.name = 'pane-matched-voxels';
  const group = new THREE.Group(); group.name = 'voxel-test'; group.add(cubes);
  group.userData.representation = 'colored-voxels'; group.userData.voxelCount = data.count;
  let disposed = false;
  const result = {
    group, metadata:{ count:data.count, voxelSize, bounds:data.bounds, processed:data.processed, skipped:data.skipped },
    restore() {
      if (disposed) return;
      for (const attribute of Object.values(geometry.attributes)) attribute.needsUpdate = true;
      geometry.index.needsUpdate = true; material.needsUpdate = true;
    },
    dispose() {
      if (disposed) return;
      disposed = true; group.removeFromParent(); group.clear(); geometry.dispose(); base.dispose(); material.dispose();
    }
  };
  try { onProgress?.({ stage:'ready', progress:1 }); checkAbort(signal); return result; }
  catch (error) { result.dispose(); throw error; }
}

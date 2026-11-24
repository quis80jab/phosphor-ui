const STRIDE = 7;
const TRANSPARENT = 1e-6;
const BATCH = 32768;

// Hash only chooses a bucket. Full, untruncated coordinates resolve collisions.
function hashCell(x, y, z) {
  let hash = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663) ^ Math.imul(z | 0, 83492791);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** Sparse center voxelization. Input RGB is already linear; no color conversion. */
export function binVoxelPoints(points, voxelSize, { onProgress } = {}) {
  if (!(points instanceof Float32Array) || points.length % STRIDE !== 0) {
    throw new Error('Voxel input must contain seven floats per source point.');
  }
  if (!Number.isFinite(voxelSize) || voxelSize <= 0) throw new Error('The voxel size must be positive and finite.');
  const total = points.length / STRIDE;
  let capacity = Math.min(total, BATCH), count = 0, processed = 0, skipped = 0;
  let cells = new Float64Array(capacity * 3);
  let sums = new Float64Array(capacity * 4);
  let next = new Int32Array(capacity);
  const buckets = new Map();
  const progress = value => onProgress?.(value);

  function grow() {
    const size = Math.min(total, Math.max(1, capacity * 2));
    const newCells = new Float64Array(size * 3), newSums = new Float64Array(size * 4), newNext = new Int32Array(size);
    newCells.set(cells); newSums.set(sums); newNext.set(next);
    cells = newCells; sums = newSums; next = newNext; capacity = size;
  }

  progress(0);
  for (let i = 0; i < total; i++) {
    const p = i * STRIDE;
    const x = points[p], y = points[p + 1], z = points[p + 2];
    const r = points[p + 3], g = points[p + 4], b = points[p + 5], alpha = points[p + 6];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)
      || !Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)
      || !Number.isFinite(alpha) || alpha <= TRANSPARENT) {
      skipped++;
    } else {
      const ix = Math.floor(x / voxelSize), iy = Math.floor(y / voxelSize), iz = Math.floor(z / voxelSize);
      if (!Number.isFinite(ix) || !Number.isFinite(iy) || !Number.isFinite(iz)) {
        throw new Error('The requested voxel size is too small for these coordinates.');
      }
      const hash = hashCell(ix, iy, iz), head = buckets.get(hash) ?? -1;
      let cell = head;
      while (cell !== -1) {
        const c = cell * 3;
        if (cells[c] === ix && cells[c + 1] === iy && cells[c + 2] === iz) break;
        cell = next[cell];
      }
      if (cell === -1) {
        if (count === capacity) grow();
        cell = count++;
        cells[cell * 3] = ix; cells[cell * 3 + 1] = iy; cells[cell * 3 + 2] = iz;
        next[cell] = head; buckets.set(hash, cell);
      }
      const sum = cell * 4;
      sums[sum] += r * alpha; sums[sum + 1] += g * alpha; sums[sum + 2] += b * alpha; sums[sum + 3] += alpha;
      processed++;
    }
    if ((i + 1) % BATCH === 0) progress(.85 * (i + 1) / total);
  }

  const positions = new Float32Array(count * 3), colors = new Float32Array(count * 3);
  const min = count ? [Infinity, Infinity, Infinity] : [0, 0, 0];
  const max = count ? [-Infinity, -Infinity, -Infinity] : [0, 0, 0];
  const half = voxelSize / 2;
  for (let cell = 0; cell < count; cell++) {
    const c = cell * 3, sum = cell * 4, weight = sums[sum + 3];
    for (let axis = 0; axis < 3; axis++) {
      const position = (cells[c + axis] + .5) * voxelSize;
      positions[c + axis] = position;
      colors[c + axis] = sums[sum + axis] / weight;
      if (!Number.isFinite(positions[c + axis])) throw new Error('Voxel positions exceed the renderable coordinate range.');
      // Bounds cover the actual Float32 centers sent to the GPU.
      min[axis] = Math.min(min[axis], positions[c + axis] - half);
      max[axis] = Math.max(max[axis], positions[c + axis] + half);
    }
    if ((cell + 1) % BATCH === 0) progress(.85 + .15 * (cell + 1) / count);
  }
  progress(1);
  return { voxelSize, count, processed, skipped, positions, colors, bounds: { min, max } };
}

if (typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope) {
  self.onmessage = ({ data }) => {
    if (data?.type !== 'build') return;
    const { id, points, voxelSize } = data;
    try {
      const result = binVoxelPoints(points, voxelSize, {
        onProgress: progress => self.postMessage({ type: 'progress', id, progress })
      });
      self.postMessage({ type: 'result', id, ...result }, [result.positions.buffer, result.colors.buffer]);
    } catch (error) {
      self.postMessage({ type: 'error', id, message: error instanceof Error ? error.message : String(error) });
    }
  };
}

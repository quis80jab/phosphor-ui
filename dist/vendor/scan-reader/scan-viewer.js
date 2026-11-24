/* scan-viewer.js — load + decode + visualize an ARACHNID librealsense
   `.bag` directly in the browser, then feed the resulting point clouds
   to `pc-renderer.js` so the existing INSPECT panel renders them.

   Design constraints
   ──────────────────
   • Pure browser code. No npm install. No bundler. Drops straight into
     the static folder + index.html via a normal <script type="module">.
   • Parses ros1 bag v2.0 — the format librealsense's
     `rs2_create_record_device` emits via `RSBagRecorder` on the iPad.
   • Extracts only what we need for a 3D preview:
       sensor_msgs/Image       on /device_0/sensor_0/Depth_0/image/data
       sensor_msgs/CameraInfo  on /device_0/sensor_0/Depth_0/info/camera_info
     Other librealsense topics (`*_metadata`, `*_info`,
     `*_pose/transform/data`, etc.) are skipped — we don't need them
     for a depth-only preview.
   • Deprojects each Z16 depth pixel to a `(x, y, z)` point using the
     camera_info K matrix. Filters out invalid (z=0) pixels — same
     behavior as `RSPointCloudC.swift` on the iPad.
   • Stride-samples to ~5–10k points per frame so SceneKit / Three.js
     has predictable frame time.

   Public API
   ──────────
       const v = await ScanViewer.load(presignedBagUrl);
       v.frameCount        → number of depth frames decoded
       v.intrinsics        → { fx, fy, cx, cy, w, h }
       v.frame(i)          → Float32Array of [x,y,z, x,y,z, …] (camera frame, meters)
       v.timestamp(i)      → ms since epoch (rs2 hardware-clock domain)

   The actual rendering uses `pc-renderer.js`'s existing
   `mountPointCloudRenderer(canvas).setPoints(pts)` pathway —
   `scan-viewer.js` is purely the source-data layer.

   Bag format references
   ─────────────────────
     http://wiki.ros.org/Bags/Format/2.0
     http://wiki.ros.org/sensor_msgs
   librealsense deprojection (rs2_deproject_pixel_to_point) is the
   inverse of the camera projection: x = (u-cx)*z/fx, y = (v-cy)*z/fy.
*/

// ─── vendored fzstd (MCAP zstd chunk decompression) ────────────────────
// MCAP_MIGRATION.md §1.4 standardises new MCAPs on zstd chunk compression,
// and constraint C5 keeps this viewer dependency-free (no npm, no bundler)
// — so fzstd 0.1.1 is vendored verbatim at static/vendor/fzstd.js.
//
// The vendored module attaches itself to `globalThis.fzstd` on load, which
// is exactly what `mcapDecompressChunk()` looks up further down; importing
// it here means every consumer of scan-viewer.js (scan-inspect.js, the
// build-scan-report.mjs node script, a bare <script type="module">) gets
// zstd support with no HTML changes. The `||` keeps an already-present
// global (e.g. a plain <script> tag having loaded fzstd first) authoritative,
// and the throw at the decompress site survives as the last-resort guard.
import * as fzstdModule from "./vendor/fzstd.js";
globalThis.fzstd = globalThis.fzstd || fzstdModule;

const ROSBAG_MAGIC = "#ROSBAG V2.0\n";
const OP = {
  CHUNK_INFO: 0x02, BAG_HEADER: 0x03, INDEX_DATA: 0x04,
  MESSAGE_DATA: 0x05, CHUNK: 0x06, CONNECTION: 0x07,
};

// ─── lz4 frame decompression ───────────────────────────────────────────
// librealsense's `rs2_create_record_device` writes its bag chunks
// compressed with lz4-frame by default. We need to decompress them
// before we can read the inner Connection / MessageData records.
//
// Spec: https://github.com/lz4/lz4/blob/dev/doc/lz4_Frame_format.md
// Block: https://github.com/lz4/lz4/blob/dev/doc/lz4_Block_format.md
//
// We trust the file from S3 and skip checksum verification — speed
// matters more than tampering detection here.

const LZ4_MAGIC_FRAME = 0x184D2204;     // little-endian: 04 22 4D 18

function lz4DecodeBlock(src, dst, dstStart) {
  // lz4 block format: token byte, literals, match-offset (2 bytes LE),
  // back-reference copy of `matchLen + 4` bytes.
  let sp = 0, dp = dstStart;
  while (sp < src.length) {
    const token = src[sp++];
    let litLen = token >> 4;
    if (litLen === 0xF) {
      let b;
      do { b = src[sp++]; litLen += b; } while (b === 0xFF);
    }
    // Copy literals
    for (let i = 0; i < litLen; i++) dst[dp++] = src[sp++];
    // End of block: last literals run, no match
    if (sp >= src.length) break;
    // Match offset (2 bytes LE)
    const matchOff = src[sp] | (src[sp + 1] << 8);
    sp += 2;
    let matchLen = token & 0xF;
    if (matchLen === 0xF) {
      let b;
      do { b = src[sp++]; matchLen += b; } while (b === 0xFF);
    }
    matchLen += 4;     // minMatch
    // Back-reference copy. NOT memcpy — overlapping copies for
    // run-length expansion are intentional and required.
    let mp = dp - matchOff;
    for (let i = 0; i < matchLen; i++) dst[dp++] = dst[mp++];
  }
  return dp - dstStart;
}

function lz4DecompressFrame(src) {
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  if (src.length < 7 || dv.getUint32(0, true) !== LZ4_MAGIC_FRAME) {
    throw new Error("lz4: not a frame (missing magic)");
  }
  let p = 4;
  const flg = src[p++];
  const bd  = src[p++];
  const version = (flg >> 6) & 0x3;
  if (version !== 1) throw new Error(`lz4: unsupported frame version ${version}`);
  const blockChecksum   = (flg >> 4) & 1;
  const contentSizeFlag = (flg >> 3) & 1;
  const contentChecksum = (flg >> 2) & 1;
  // bd's bits 4-6 = block max size class. We don't enforce — just
  // allocate the dst dynamically.
  if (contentSizeFlag) p += 8;          // skip content_size
  // We DON'T verify the dictionary-id flag (bit 0) — librealsense
  // doesn't use it.
  p += 1;                                // header checksum byte (skipped)

  // Iterate blocks.
  let outChunks = [];
  let outTotal = 0;
  while (p + 4 <= src.length) {
    const raw = dv.getUint32(p, true); p += 4;
    if (raw === 0) break;                // EndMark
    const isUncompressed = (raw & 0x80000000) >>> 31;
    const blockSize = raw & 0x7FFFFFFF;
    if (p + blockSize > src.length) {
      throw new Error(`lz4: block extends past frame (p=${p}, blockSize=${blockSize}, total=${src.length})`);
    }
    const blockSrc = src.subarray(p, p + blockSize);
    p += blockSize;
    if (blockChecksum) p += 4;
    if (isUncompressed) {
      outChunks.push(blockSrc);
      outTotal += blockSize;
    } else {
      // Allocate generously — lz4 max ratio is ~255×, but we never
      // see anywhere near that. 16× is plenty for librealsense bags;
      // we trim afterward.
      const dst = new Uint8Array(Math.max(blockSize * 16, 256 * 1024));
      const written = lz4DecodeBlock(blockSrc, dst, 0);
      outChunks.push(dst.subarray(0, written));
      outTotal += written;
    }
  }
  // Concatenate.
  const out = new Uint8Array(outTotal);
  let off = 0;
  for (const c of outChunks) { out.set(c, off); off += c.length; }
  return out;
}

// ─── Tiny binary helpers ────────────────────────────────────────────────

/** MAD-based outlier trim on a tuple list `[[x,y,z,r,g,b], ...]`.
 *  Drops tuples whose position is > k*MAD from the median on any axis.
 *  Returns a NEW array containing only the surviving tuples. Keeps
 *  the [r,g,b] payload in sync with positions, unlike the static
 *  `ScanViewer.trimMAD` which operates on flat Float32Arrays.
 *
 *  No-op if the tuple list has fewer than 4 entries (not enough signal
 *  to compute a meaningful MAD). */
function trimTupleList(tuples, k = 4) {
  if (!Array.isArray(tuples) || tuples.length < 4) return tuples;
  const n = tuples.length;
  const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    xs[j] = tuples[j][0];
    ys[j] = tuples[j][1];
    zs[j] = tuples[j][2];
  }
  const median = (arr) => {
    const sorted = Array.from(arr).sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
  };
  const mx = median(xs), my = median(ys), mz = median(zs);
  const ax = new Float32Array(n), ay = new Float32Array(n), az = new Float32Array(n);
  for (let j = 0; j < n; j++) {
    ax[j] = Math.abs(xs[j] - mx);
    ay[j] = Math.abs(ys[j] - my);
    az[j] = Math.abs(zs[j] - mz);
  }
  const tx = k * Math.max(1e-4, median(ax));
  const ty = k * Math.max(1e-4, median(ay));
  const tz = k * Math.max(1e-4, median(az));
  const out = [];
  for (let j = 0; j < n; j++) {
    if (ax[j] <= tx && ay[j] <= ty && az[j] <= tz) {
      out.push(tuples[j]);
    }
  }
  return out;
}

/** RANSAC plane removal. Best-fit a single plane via random 3-point
 *  sampling (30 iters); drop every tuple within `distThresh` of it.
 *  `distThresh` adapts to the cloud's spatial extent so dense LiDAR
 *  scenes and sparse RGB-D bags both behave. No-op on tiny clouds. */
function cullPlaneRANSAC(tuples) {
  if (!Array.isArray(tuples) || tuples.length < 50) return tuples;
  const n = tuples.length;
  // Adaptive thresh — max(3 cm, 1% of bbox diag). Computed from a
  // 256-point sub-sample to keep it cheap.
  const stride = Math.max(1, (n / 256) | 0);
  let mnx = Infinity, mny = Infinity, mnz = Infinity;
  let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (let j = 0; j < n; j += stride) {
    const x = tuples[j][0], y = tuples[j][1], z = tuples[j][2];
    if (x < mnx) mnx = x; if (x > mxx) mxx = x;
    if (y < mny) mny = y; if (y > mxy) mxy = y;
    if (z < mnz) mnz = z; if (z > mxz) mxz = z;
  }
  const diag = Math.hypot(mxx - mnx, mxy - mny, mxz - mnz);
  const distThresh = Math.max(0.03, 0.01 * diag);

  // 30 iterations of random 3-point plane fits. For each, count
  // inliers within distThresh; remember the best plane.
  let bestN = 0;
  let bestNX = 0, bestNY = 0, bestNZ = 0, bestD = 0;
  for (let iter = 0; iter < 30; iter++) {
    const a = tuples[(Math.random() * n) | 0];
    const b = tuples[(Math.random() * n) | 0];
    const c = tuples[(Math.random() * n) | 0];
    // Edge vectors
    const e1x = b[0] - a[0], e1y = b[1] - a[1], e1z = b[2] - a[2];
    const e2x = c[0] - a[0], e2y = c[1] - a[1], e2z = c[2] - a[2];
    // Normal = e1 × e2
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nm = Math.hypot(nx, ny, nz);
    if (nm < 1e-6) continue;        // degenerate triangle
    nx /= nm; ny /= nm; nz /= nm;
    const d = -(nx * a[0] + ny * a[1] + nz * a[2]);
    let count = 0;
    // Walk a sub-sample to keep the inner loop fast (full walk on the
    // winning plane done in the final filter pass below).
    for (let j = 0; j < n; j += stride) {
      const t = tuples[j];
      const dist = Math.abs(nx * t[0] + ny * t[1] + nz * t[2] + d);
      if (dist <= distThresh) count++;
    }
    if (count > bestN) {
      bestN = count; bestNX = nx; bestNY = ny; bestNZ = nz; bestD = d;
    }
  }
  // Require the winning plane to cover at least 15% of the cloud before
  // we trust it. Below that, just leave the cloud alone.
  if (bestN * stride < n * 0.15) return tuples;
  const kept = [];
  for (let j = 0; j < n; j++) {
    const t = tuples[j];
    const dist = Math.abs(bestNX * t[0] + bestNY * t[1] + bestNZ * t[2] + bestD);
    if (dist > distThresh) kept.push(t);
  }
  return kept;
}

/** Background-points cull — voxel-density + largest-connected-component.
 *
 *  Algorithm (robust to multi-modal point distributions like tank + sky
 *  + ground, which the old IQR-on-distance approach failed on):
 *    1. Compute bbox; pick voxel size = max(0.06 m, diag / 80).
 *    2. Bin every point into a sparse 3D voxel grid.
 *    3. Threshold voxel occupancy: keep voxels with point-count above
 *       the per-voxel median (this strips sparse outlier voxels).
 *    4. Find the largest connected component (6-neighbour BFS) over
 *       the dense voxel set.
 *    5. Drop any point whose voxel isn't in that component.
 *
 *  Why this works where IQR didn't: the OLD pass kept points within
 *  1.5×IQR of the median-distance — but for a tank scan the bimodal
 *  distance distribution (close tank surface + distant ground/sky)
 *  meant the cutoff sat in the trough between modes, and the
 *  background bulk survived intact. Voxel-LCC instead asks "what's
 *  the biggest contiguous chunk?" — guaranteed-correct on bimodal
 *  geometry, no thresholding tuning required. */
function cullBackgroundIQR(tuples) {
  if (!Array.isArray(tuples) || tuples.length < 100) return tuples;
  const n = tuples.length;

  // Bbox + voxel size.
  let mnx = Infinity, mny = Infinity, mnz = Infinity;
  let mxx = -Infinity, mxy = -Infinity, mxz = -Infinity;
  for (let j = 0; j < n; j++) {
    const t = tuples[j];
    if (t[0] < mnx) mnx = t[0]; if (t[0] > mxx) mxx = t[0];
    if (t[1] < mny) mny = t[1]; if (t[1] > mxy) mxy = t[1];
    if (t[2] < mnz) mnz = t[2]; if (t[2] > mxz) mxz = t[2];
  }
  const diag = Math.hypot(mxx - mnx, mxy - mny, mxz - mnz);
  if (!Number.isFinite(diag) || diag < 0.1) return tuples;
  const v = Math.max(0.06, diag / 80);
  const invV = 1 / v;

  // Bin: voxelKey → { count, idxList? }. We only need counts +
  // membership; per-voxel point lists would balloon memory.
  const voxelCount = new Map();   // key (string) -> count
  const pointVoxel = new Int32Array(n * 3);    // packed (ix, iy, iz) triples
  for (let j = 0; j < n; j++) {
    const t = tuples[j];
    const ix = Math.floor((t[0] - mnx) * invV);
    const iy = Math.floor((t[1] - mny) * invV);
    const iz = Math.floor((t[2] - mnz) * invV);
    pointVoxel[j * 3]     = ix;
    pointVoxel[j * 3 + 1] = iy;
    pointVoxel[j * 3 + 2] = iz;
    const key = ix + "," + iy + "," + iz;
    voxelCount.set(key, (voxelCount.get(key) || 0) + 1);
  }
  if (voxelCount.size === 0) return tuples;

  // Density threshold — median voxel count. (Mean is too sensitive to
  // a single super-dense object voxel.) Voxels at-or-above stay; the
  // rest are "sparse" and won't seed the connectivity walk.
  const counts = Array.from(voxelCount.values()).sort((a, b) => a - b);
  const medianCount = counts[counts.length >> 1] || 1;
  const dense = new Set();
  for (const [k, c] of voxelCount) if (c >= medianCount) dense.add(k);
  if (dense.size === 0) return tuples;

  // Largest-connected-component over the dense voxel set. 6-neighbour
  // BFS, ascending point count from each unvisited seed; keep the
  // component that contains the most ORIGINAL points.
  const NB = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
  const visited = new Set();
  let bestComp = null;
  let bestPts  = 0;
  // Iterate dense voxels in descending count so we hit the most
  // populated seed first — usually the right cluster.
  const denseEntries = Array.from(dense, k => [k, voxelCount.get(k)])
    .sort((a, b) => b[1] - a[1]);
  for (const [seed] of denseEntries) {
    if (visited.has(seed)) continue;
    const comp = new Set();
    const stack = [seed];
    let pts = 0;
    while (stack.length) {
      const k = stack.pop();
      if (comp.has(k)) continue;
      comp.add(k);
      visited.add(k);
      pts += voxelCount.get(k) || 0;
      const parts = k.split(",");
      const ix = +parts[0], iy = +parts[1], iz = +parts[2];
      for (const [dx, dy, dz] of NB) {
        const nk = (ix + dx) + "," + (iy + dy) + "," + (iz + dz);
        if (dense.has(nk) && !comp.has(nk)) stack.push(nk);
      }
    }
    if (pts > bestPts) { bestPts = pts; bestComp = comp; }
  }
  if (!bestComp || bestPts < n * 0.10) return tuples;

  // Keep only points whose voxel is in the winning component.
  const kept = [];
  for (let j = 0; j < n; j++) {
    const k = pointVoxel[j * 3] + "," + pointVoxel[j * 3 + 1] + "," + pointVoxel[j * 3 + 2];
    if (bestComp.has(k)) kept.push(tuples[j]);
  }
  return kept.length > 0 ? kept : tuples;
}

/** Compose the optional cloud filters into one call site. Order: trim
 *  (MAD) → plane (RANSAC) → background (IQR). Each takes + returns
 *  the [x,y,z,r,g,b] tuple list shape used by pc-renderer. */
function applyCloudFilters(tuples, doTrim, doCullPlane, doCullBackground, opts) {
  let t = tuples;
  if (doTrim)            t = trimTupleList(t, opts?.trimK ?? 4);
  if (doCullPlane)       t = cullPlaneRANSAC(t);
  if (doCullBackground)  t = cullBackgroundIQR(t);
  return t;
}

function u32(dv, off) { return dv.getUint32(off, true); }
function u64(dv, off) {
  // ros1 timestamps are uint64 nanoseconds; we narrow to a safe-range
  // float (Number) at ms precision, which is plenty for replay.
  const lo = dv.getUint32(off,     true);
  const hi = dv.getUint32(off + 4, true);
  return hi * 4294967296 + lo;
}

/** Parse a rosbag header block: sequence of [u32 fieldLen][bytes "key=value"].
 *  Defensive against truncation — if the buffer ends mid-field we stop
 *  rather than reading off the end. */
function parseHeader(buf) {
  const out = {};
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let i = 0;
  while (i + 4 <= buf.byteLength) {
    const n = dv.getUint32(i, true);
    i += 4;
    if (i + n > buf.byteLength) break;       // truncated tail — stop cleanly
    const kv = buf.subarray(i, i + n);
    i += n;
    let eq = 0;
    while (eq < kv.length && kv[eq] !== 0x3D /* '=' */) eq++;
    const key = new TextDecoder("utf-8").decode(kv.subarray(0, eq));
    out[key] = kv.subarray(eq + 1);
  }
  return out;
}

/** Helper: read a length-prefixed string from a ROS message. */
function readRosString(dv, off) {
  const len = dv.getUint32(off, true);
  off += 4;
  const bytes = new Uint8Array(dv.buffer, dv.byteOffset + off, len);
  return { value: new TextDecoder("utf-8").decode(bytes), next: off + len };
}

// ─── Bag parser ────────────────────────────────────────────────────────

/**
 * Walks a rosbag v2.0 file. Returns:
 *   { connections: Map<connId, {topic, msgType}>,
 *     messages:    [{conn, time, data}, …] }
 *
 * Only "compression: none" chunks are decompressed; bz2/lz4 throw with
 * a clear error so the caller can surface a sensible UI message. Real
 * librealsense iPad bags are uncompressed, so this is fine.
 */
function parseBag(arrayBuffer) {
  const all = new Uint8Array(arrayBuffer);
  const magic = new TextDecoder("ascii").decode(all.subarray(0, ROSBAG_MAGIC.length));
  if (magic !== ROSBAG_MAGIC) {
    throw new Error(`not a rosbag (magic="${magic.trim()}")`);
  }
  let pos = ROSBAG_MAGIC.length;
  const dv = new DataView(arrayBuffer);

  const connections = new Map();   // connId → { topic, msgType }
  const messages = [];             // [{ connId, time, data:Uint8Array }]

  function ingestRecord(hdr, data) {
    const op = hdr.op?.[0];
    // librealsense bag flavor uses non-standard op codes: it stores
    // MessageData with op=0x02 (the standard's ChunkInfo slot) and
    // Chunk with op=0x05 (the standard's MessageData slot). We detect
    // by which fields are present in the header rather than purely by
    // op number, so we accept both flavors transparently.
    const looksLikeMessage    = hdr.conn  !== undefined && hdr.time !== undefined;
    const looksLikeConnection = hdr.topic !== undefined && (op === OP.CONNECTION || op === undefined);
    if (looksLikeConnection) {
      const connBuf = hdr.conn ?? hdr.conn_id;
      let conn = connBuf
        ? u32(new DataView(connBuf.buffer, connBuf.byteOffset, 4), 0)
        : null;
      const topic = new TextDecoder("utf-8").decode(hdr.topic);
      const meta = parseHeader(data);
      const msgType = meta.type ? new TextDecoder("utf-8").decode(meta.type) : "?";
      if (conn === null) conn = -(connections.size + 1);
      // Don't clobber a previous connection record with the same id —
      // librealsense emits the same connection in every chunk.
      if (!connections.has(conn)) connections.set(conn, { topic, msgType });
    } else if (looksLikeMessage) {
      const conn = u32(new DataView(hdr.conn.buffer, hdr.conn.byteOffset, 4), 0);
      const timeNs = u64(new DataView(hdr.time.buffer, hdr.time.byteOffset, 8), 0);
      messages.push({ conn, timeMs: timeNs / 1e6, data });
    }
    // BAG_HEADER, IndexData, ChunkInfo: nothing for a sequential reader
  }

  while (pos + 4 <= all.length) {
    const hdrLen = u32(dv, pos);
    if (pos + 4 + hdrLen + 4 > all.length) break;     // truncated tail
    pos += 4;
    const hdr = parseHeader(all.subarray(pos, pos + hdrLen)); pos += hdrLen;
    const dataLen = u32(dv, pos); pos += 4;
    if (pos + dataLen > all.length) break;            // truncated data
    const data = all.subarray(pos, pos + dataLen); pos += dataLen;

    const op = hdr.op?.[0];
    // librealsense's bag flavor packs message data into records
    // tagged op=0x05 with `compression` + `size` header fields — that's
    // the standard rosbag *Chunk* (op=0x06) layout but with op=0x05
    // (which the spec assigns to MessageData). So we treat ANY record
    // that has a `compression` header field as a chunk regardless of
    // op number. Standard rosbag Chunk (op=0x06, no compression="none"
    // case) also routes here.
    const isChunk = op === OP.CHUNK || hdr.compression !== undefined;
    if (isChunk) {
      const compStr = hdr.compression
        ? new TextDecoder("ascii").decode(hdr.compression)
        : "none";
      let inner;
      if (compStr === "none") {
        inner = data;
      } else if (compStr === "lz4") {
        inner = lz4DecompressFrame(data);
      } else {
        // bz2 not supported in pure JS yet — skip the chunk so we get
        // a partial render rather than failing the whole bag.
        console.warn(`[scan-viewer] skipping chunk with compression="${compStr}"`);
        continue;
      }
      // Walk inner records (Connection + MessageData).
      let cp = 0;
      const cdv = new DataView(inner.buffer, inner.byteOffset, inner.byteLength);
      while (cp + 4 <= inner.length) {
        const cHdrLen = cdv.getUint32(cp, true);
        if (cp + 4 + cHdrLen + 4 > inner.length) break;
        cp += 4;
        const cHdr = parseHeader(inner.subarray(cp, cp + cHdrLen)); cp += cHdrLen;
        const cDataLen = cdv.getUint32(cp, true); cp += 4;
        if (cp + cDataLen > inner.length) break;
        const cData = inner.subarray(cp, cp + cDataLen); cp += cDataLen;
        ingestRecord(cHdr, cData);
      }
    } else {
      ingestRecord(hdr, data);
    }
  }

  return { connections, messages };
}

// ─── ROS message decoders ──────────────────────────────────────────────

/**
 * Decode `sensor_msgs/Image`.
 *
 *   std_msgs/Header header
 *     uint32 seq
 *     time stamp (uint32 sec + uint32 nsec)
 *     string frame_id
 *   uint32 height
 *   uint32 width
 *   string encoding
 *   uint8 is_bigendian
 *   uint32 step
 *   uint8[] data
 */
function decodeImage(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  // std_msgs/Header: seq(u32), stamp.sec(u32), stamp.nsec(u32), frame_id(string)
  off += 4;                          // seq
  const stampSec  = dv.getUint32(off, true); off += 4;
  const stampNsec = dv.getUint32(off, true); off += 4;
  const fid = readRosString(dv, off); off = fid.next;
  const height = dv.getUint32(off, true); off += 4;
  const width  = dv.getUint32(off, true); off += 4;
  const enc = readRosString(dv, off); off = enc.next;
  const isBigEndian = dv.getUint8(off); off += 1;
  const step = dv.getUint32(off, true); off += 4;
  const dataLen = dv.getUint32(off, true); off += 4;
  const dataBytes = new Uint8Array(bytes.buffer, bytes.byteOffset + off, dataLen);
  return {
    width, height,
    encoding: enc.value,
    step,
    isBigEndian: !!isBigEndian,
    timestampMs: stampSec * 1000 + stampNsec / 1e6,
    data: dataBytes,
  };
}

/**
 * Convert a decoded `sensor_msgs/Image` (color stream) to packed
 * planar RGB (width*height*3 Uint8Array). Handles the encodings
 * librealsense + our iPad recorder actually produce:
 *
 *   bgra8 / 8UC4  →  swap to RGB, drop A          (iPad: BGRA from CIContext)
 *   rgba8         →  drop A
 *   rgb8          →  passthrough
 *   bgr8          →  channel swap                  (D455 default)
 *   yuv422 (yuyv) →  ITU-R BT.601 conversion       (some librealsense color modes)
 *
 * Returns null for unrecognized encodings so callers can fall back to
 * the depth-heatmap colorization path.
 */
function colorImageToRGB(img) {
  const { width, height, encoding, data } = img;
  const n = width * height;
  const rgb = new Uint8Array(n * 3);
  switch (encoding) {
    case "rgb8":
      rgb.set(data.subarray(0, n * 3));
      return { width, height, rgb };
    case "bgr8":
      for (let i = 0; i < n; i++) {
        rgb[i*3+0] = data[i*3+2];
        rgb[i*3+1] = data[i*3+1];
        rgb[i*3+2] = data[i*3+0];
      }
      return { width, height, rgb };
    case "bgra8":
    case "8UC4":
      for (let i = 0; i < n; i++) {
        rgb[i*3+0] = data[i*4+2];
        rgb[i*3+1] = data[i*4+1];
        rgb[i*3+2] = data[i*4+0];
      }
      return { width, height, rgb };
    case "rgba8":
      for (let i = 0; i < n; i++) {
        rgb[i*3+0] = data[i*4+0];
        rgb[i*3+1] = data[i*4+1];
        rgb[i*3+2] = data[i*4+2];
      }
      return { width, height, rgb };
    case "yuv422": {
      // YUYV layout: 2 pixels per 4 bytes [Y0, U, Y1, V]. ITU-R BT.601.
      for (let i = 0, j = 0; i < n; i += 2, j += 4) {
        const y0 = data[j], u = data[j+1] - 128, y1 = data[j+2], v = data[j+3] - 128;
        const cr = v, cb = u;
        const r0 = y0 + 1.402 * cr;
        const g0 = y0 - 0.344136 * cb - 0.714136 * cr;
        const b0 = y0 + 1.772 * cb;
        const r1 = y1 + 1.402 * cr;
        const g1 = y1 - 0.344136 * cb - 0.714136 * cr;
        const b1 = y1 + 1.772 * cb;
        const k0 = i*3, k1 = (i+1)*3;
        rgb[k0+0] = r0 < 0 ? 0 : r0 > 255 ? 255 : r0;
        rgb[k0+1] = g0 < 0 ? 0 : g0 > 255 ? 255 : g0;
        rgb[k0+2] = b0 < 0 ? 0 : b0 > 255 ? 255 : b0;
        rgb[k1+0] = r1 < 0 ? 0 : r1 > 255 ? 255 : r1;
        rgb[k1+1] = g1 < 0 ? 0 : g1 > 255 ? 255 : g1;
        rgb[k1+2] = b1 < 0 ? 0 : b1 > 255 ? 255 : b1;
      }
      return { width, height, rgb };
    }
    case "jpeg":
    case "jpg":
      // MCAP ColorImage encoding enum 3 (and the JSON projection's
      // "jpeg"). A JPEG cannot be unpacked synchronously in a browser —
      // createImageBitmap / <img> are both async — so emit a PENDING
      // colour frame carrying the compressed bytes. `hydrateColorFrames()`
      // (awaited inside load(), and per-chunk in indexed mode) fills in
      // `.rgb`. Consumers already guard on `img.rgb`, so a frame that
      // never hydrates degrades to the depth heatmap.
      return { width, height, rgb: null, jpeg: data, encoding: "jpeg" };
    default:
      return null;
  }
}

/**
 * Decode `geometry_msgs/Transform`. Layout:
 *
 *   geometry_msgs/Vector3 translation     // 3× float64
 *   geometry_msgs/Quaternion rotation     // 4× float64 (x, y, z, w)
 *
 * librealsense's bag DOES NOT prepend a std_msgs/Header to its
 * Pose-stream Transform messages — they are raw 56-byte structs.
 * (sensor_msgs/Image and CameraInfo do have headers; the pose topic
 * is exempt.)
 */
function decodeTransform(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return {
    tx: dv.getFloat64( 0, true),
    ty: dv.getFloat64( 8, true),
    tz: dv.getFloat64(16, true),
    qx: dv.getFloat64(24, true),
    qy: dv.getFloat64(32, true),
    qz: dv.getFloat64(40, true),
    qw: dv.getFloat64(48, true),
  };
}

/**
 * Decode `sensor_msgs/CameraInfo`. We only need fx/fy/cx/cy from the
 * 3×3 K matrix, so this skips all the distortion / rectification
 * fields — but we still walk past them for offset correctness.
 *
 *   std_msgs/Header header
 *   uint32 height
 *   uint32 width
 *   string distortion_model
 *   float64[] D
 *   float64[9] K           ← what we want
 */
function decodeCameraInfo(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 0;
  off += 4;                          // header.seq
  off += 4 + 4;                      // header.stamp
  const fid = readRosString(dv, off); off = fid.next;
  const height = dv.getUint32(off, true); off += 4;
  const width  = dv.getUint32(off, true); off += 4;
  const dm = readRosString(dv, off); off = dm.next;
  const dLen = dv.getUint32(off, true); off += 4;
  off += dLen * 8;                   // skip D (float64 array)
  // K is fixed-size 9 × float64
  const K = new Float64Array(9);
  for (let i = 0; i < 9; i++) {
    K[i] = dv.getFloat64(off, true); off += 8;
  }
  return {
    width, height,
    fx: K[0], fy: K[4], cx: K[2], cy: K[5],
  };
}

// ─── Deprojection ──────────────────────────────────────────────────────

/**
 * Convert a Z16 depth image into a point cloud. Returns a Float32Array
 * of `[x0,y0,z0, x1,y1,z1, …]` in meters in the depth-camera frame.
 *
 * librealsense's bag uses a "depth_units" multiplier (0.001 m for our
 * iPad bags — pixel value × 0.001 = meters). It's stored in the bag
 * but on a separate metadata topic; for our recorder it's hard-coded
 * 0.001 because we set it that way in `RSBagRecorder.swift`.
 *
 * Stride-samples to ~`maxPoints` so the cloud renderer doesn't choke.
 */
function deproject(image, intr, opts = {}) {
  const maxPoints = opts.maxPoints ?? 4000;           // halved from 8000 for smoother scrubbing
  // Precedence: explicit caller option > the scale RECORDED IN THE FRAME
  // (DepthImage carries depth_scale_m; decodeMcapDepthImage surfaces it as
  // depthScaleM) > the librealsense default. The hardcoded 0.001 was
  // correct for every sensor we happen to own and silently wrong for any
  // other -- the same defect class as the substituted intrinsics.
  const depthUnits = opts.depthUnits ?? image.depthScaleM ?? 0.001;
  // Clip points beyond `far` so the D455's 65.535 m invalid-depth
  // sentinel (Z16 0xFFFF × 0.001 m) doesn't pollute the cloud's
  // bounding box (and therefore the camera-fit distance).
  const far = opts.far ?? 100;                        // generous default for non-INSPECT callers
  const { fx, fy, cx, cy } = intr;
  const w = image.width, h = image.height;
  // Gate check G6 at the moment of damage: CameraInfo that does not
  // describe THIS frame's grid deprojects every pixel through the wrong
  // ray -- a 1.8x focal error plus principal-point shear that still looks
  // like a scene. Scan-level failure, so throwing on the first frame is
  // the correct loudness.
  if (Number.isFinite(intr.width) && Number.isFinite(intr.height) &&
      intr.width > 0 && intr.height > 0 && (intr.width !== w || intr.height !== h)) {
    throw new Error(`CameraInfo is ${intr.width}x${intr.height} but the depth frame is ${w}x${h} — wrong calibration for this stream`);
  }
  // Z16 little-endian, two bytes per pixel. The image bytes inside
  // the bag's chunk arrive at arbitrary byteOffsets (the bag never
  // word-aligns its records), so we can't construct Uint16Array
  // directly on them — the typed-array constructor requires a
  // byteOffset that's a multiple of 2. Copy into a fresh buffer.
  const src = image.data;
  const pixels = new Uint16Array(src.length / 2);
  for (let i = 0, j = 0; i < pixels.length; i++, j += 2) {
    pixels[i] = src[j] | (src[j + 1] << 8);
  }

  // Stride such that we keep ~maxPoints valid samples; assume ~94% of
  // pixels are valid (matches the iPad LiDAR's typical fill rate). We
  // walk the grid in row-major order, sampling every `s`-th pixel.
  const totalPixels = w * h;
  const targetSampled = maxPoints / 0.94;
  const s = Math.max(1, Math.round(Math.sqrt(totalPixels / targetSampled)));

  const pts = new Float32Array(maxPoints * 3);
  // Parallel RGB sampling: if a color image is provided, write one
  // [r, g, b] tuple for every accepted depth pixel into `colors`. The
  // recorder records color at depth dims (256×192 BGRA), so
  // depth-pixel (u, v) maps directly to color-pixel (u, v). If the
  // dimensions disagree (e.g. orin D455 colors at 1280×720), scale.
  const colorImg = opts.colorImg;  // { width, height, rgb, valid? }
  const colors   = colorImg ? new Uint8Array(maxPoints * 3) : null;
  // Optional parallel validity plane (one byte per colour pixel, 1 = a real
  // sample). Thermal warps use it to say "this depth pixel is outside my
  // FOV" WITHOUT stealing the red channel's LSB for the message -- the old
  // in-band tag halved red resolution and would destroy any greyscale
  // thermal plane whose r==g==b.
  const valids   = colorImg && colorImg.valid ? new Uint8Array(maxPoints) : null;
  const cw = colorImg ? colorImg.width  : 0;
  const ch = colorImg ? colorImg.height : 0;
  const sameDims = colorImg && cw === w && ch === h;
  let p = 0, cp = 0, vp = 0;
  for (let v = 0; v < h && p < pts.length; v += s) {
    for (let u = 0; u < w && p < pts.length; u += s) {
      const z = pixels[v * w + u] * depthUnits;
      if (z <= 0 || z > far) continue;     // also drops 0xFFFF invalid-depth sentinel
      pts[p++] = (u - cx) * z / fx;       // x (right)
      pts[p++] = -(v - cy) * z / fy;      // y (Three.js y-up: flip image-y)
      pts[p++] = -z;                       // z (-z forward in Three.js)
      if (colors) {
        const uC = sameDims ? u : ((u * cw / w) | 0);
        const vC = sameDims ? v : ((v * ch / h) | 0);
        const ci = (vC * cw + uC) * 3;
        colors[cp++] = colorImg.rgb[ci    ];
        colors[cp++] = colorImg.rgb[ci + 1];
        colors[cp++] = colorImg.rgb[ci + 2];
        if (valids) valids[vp++] = colorImg.valid[vC * cw + uC];
      }
    }
  }
  if (colors) {
    // Return both positions and colors as Float32Array + Uint8Array
    // packed into the same return wrapper. Callers that didn't ask
    // for color get back a plain Float32Array (back-compat).
    return { positions: pts.subarray(0, p), colors: colors.subarray(0, cp),
             valids: valids ? valids.subarray(0, vp) : null };
  }
  // Trim to the actually-filled prefix so the renderer sees correct count.
  return pts.subarray(0, p);
}

// ─── MCAP parser ───────────────────────────────────────────────────────
//
// MCAP (https://mcap.dev/) is Foxglove's container format that ARACHNID
// is migrating to. Spec: orin-drone/docs/MCAP_MIGRATION.md.
//
// Our browser parser is intentionally dependency-free (constraint C5 in
// the spec): no @mcap/core, no bundler. We hand-roll a tiny record walker
// that handles just the opcodes a scan needs — Header, Schema, Channel,
// Message, Chunk. Other opcodes (MessageIndex, ChunkIndex, Statistics,
// Metadata, Footer, etc.) are skipped by length.
//
// Output of parseMcap() matches parseBag()'s shape so the downstream
// frame-assembly code in load() can branch only on payload-decoder
// choice, not on container traversal:
//
//   { connections: Map<channelId, {topic, msgType, schemaName, schemaEncoding, messageEncoding}>,
//     messages:    [{ conn, timeMs, data }, …] }
//
// MCAP spec reference:
//   https://mcap.dev/spec
//
// MCAP magic: 0x89 'M' 'C' 'A' 'P' '0' \r \n
const MCAP_MAGIC = new Uint8Array([0x89, 0x4D, 0x43, 0x41, 0x50, 0x30, 0x0D, 0x0A]);

// Record opcodes we care about.
const MCAP_OP = {
  HEADER:        0x01,
  FOOTER:        0x02,
  SCHEMA:        0x03,
  CHANNEL:       0x04,
  MESSAGE:       0x05,
  CHUNK:         0x06,
  MESSAGE_INDEX: 0x07,
  CHUNK_INDEX:   0x08,
  ATTACHMENT:    0x09,
  STATISTICS:    0x0B,
  METADATA:      0x0C,
  DATA_END:      0x0F,
};

/** Compare a Uint8Array prefix against the MCAP magic. */
function isMcapMagic(buf) {
  if (!buf || buf.length < MCAP_MAGIC.length) return false;
  for (let i = 0; i < MCAP_MAGIC.length; i++) {
    if (buf[i] !== MCAP_MAGIC[i]) return false;
  }
  return true;
}

/** Read a length-prefixed UTF-8 string (u32 LE len + bytes) from `bytes`
 *  starting at `off`. Returns `{value, next}`. */
function mcapReadStr(bytes, off) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(off, true);
  off += 4;
  const v = new TextDecoder("utf-8").decode(bytes.subarray(off, off + n));
  return { value: v, next: off + n };
}

/** Read a length-prefixed byte sequence (u32 LE len + bytes). */
function mcapReadBytes(bytes, off) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const n = dv.getUint32(off, true);
  off += 4;
  return { value: bytes.subarray(off, off + n), next: off + n };
}

/** Read a uint64 little-endian as a JS Number (safe up to 2^53). */
function mcapReadU64(bytes, off) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const lo = dv.getUint32(off,     true);
  const hi = dv.getUint32(off + 4, true);
  return hi * 4294967296 + lo;
}

/**
 * Decompress an MCAP chunk's compressed_data payload.
 *
 *   compression == ""     → already raw, return as-is
 *   compression == "lz4"  → uses our existing lz4DecompressFrame
 *   compression == "zstd" → uses window.fzstd.decompress(bytes, dst?)
 *                           if the vendored fzstd library is loaded;
 *                           otherwise throws with a clear error so the
 *                           caller can surface a sensible UI message.
 *
 * The spec (§1.4) standardises on zstd for new MCAPs, but uncompressed
 * and lz4 are both legal — keep all three paths so test fixtures and
 * future producer changes don't break.
 */
function mcapDecompressChunk(compression, compressed) {
  if (!compression || compression.length === 0) return compressed;
  if (compression === "lz4")  return lz4DecompressFrame(compressed);
  if (compression === "zstd") {
    // Vendored fzstd (static/vendor/fzstd.js) is imported at the top of this
    // module and attaches to globalThis.fzstd. We tolerate either named
    // export (.decompress) or default. The throw is kept as the last-resort
    // guard for a host where that import somehow didn't land, so we surface
    // a clear message instead of silently shipping broken bytes.
    const f = (typeof window !== "undefined" ? window.fzstd : globalThis.fzstd) || null;
    if (f && typeof f.decompress === "function") {
      return f.decompress(compressed);
    }
    throw new Error("mcap: zstd chunk encountered but fzstd is not loaded — check static/vendor/fzstd.js");
  }
  throw new Error(`mcap: unsupported chunk compression "${compression}"`);
}

/**
 * Walk an MCAP file and return `{connections, messages}` matching the
 * shape parseBag() returns so load() can run a single frame-assembly
 * pipeline regardless of container format.
 *
 *   connections : Map<channelId, {
 *                   topic, msgType, schemaName,
 *                   schemaEncoding, messageEncoding
 *                 }>
 *   messages    : [{ conn, timeMs, data }, …]   // chronological order
 *
 * `msgType` is set to the schema name so the existing routing code in
 * load() can branch on it the same way it does on ROS msgtype strings.
 */
function parseMcap(arrayBuffer) {
  const all = new Uint8Array(arrayBuffer);
  if (!isMcapMagic(all)) {
    throw new Error("not an MCAP file (magic mismatch)");
  }
  // Trailing magic: spec says the same 8 bytes terminate the file.
  // We don't enforce — truncated MCAPs in the wild still get a best-
  // effort parse so the user sees as much as possible.

  // Schema and Channel records describe the streams. Messages reference
  // a channel_id which references a schema_id.
  const schemas  = new Map();      // schema_id  → { name, encoding, data }
  const channels = new Map();      // channel_id → { schemaId, topic, messageEncoding, metadata }
  const connections = new Map();   // channel_id → { topic, msgType, … } (downstream shape)
  const messages = [];             // chronological message list

  /** Resolve a channel_id to the connections-Map shape. Idempotent. */
  function resolveConn(channelId) {
    if (connections.has(channelId)) return;
    const ch = channels.get(channelId);
    if (!ch) return;
    const sch = schemas.get(ch.schemaId) || { name: "?", encoding: "?" };
    connections.set(channelId, {
      topic:           ch.topic,
      msgType:         sch.name,         // routing key — mirrors rosbag1 path
      schemaName:      sch.name,
      schemaEncoding:  sch.encoding,
      messageEncoding: ch.messageEncoding,
    });
  }

  function ingestSchema(body) {
    const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
    let off = 0;
    const id = dv.getUint16(off, true); off += 2;
    const nm = mcapReadStr(body, off);  off = nm.next;
    const en = mcapReadStr(body, off);  off = en.next;
    const da = mcapReadBytes(body, off); off = da.next;
    schemas.set(id, { name: nm.value, encoding: en.value, data: da.value });
  }

  function ingestChannel(body) {
    const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
    let off = 0;
    const id = dv.getUint16(off, true); off += 2;
    const schemaId = dv.getUint16(off, true); off += 2;
    const tp = mcapReadStr(body, off); off = tp.next;
    const me = mcapReadStr(body, off); off = me.next;
    // metadata: Map<string,string> as u32 byteLen + ((u32 keyLen + key)
    // + (u32 valLen + val))* — we don't need it, skip past for offset
    // correctness only.
    const metaLen = dv.getUint32(off, true); off += 4;
    off += metaLen;
    channels.set(id, {
      schemaId,
      topic:           tp.value,
      messageEncoding: me.value,
    });
    resolveConn(id);
  }

  function ingestMessage(body) {
    const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
    let off = 0;
    const channelId = dv.getUint16(off, true); off += 2;
    off += 4;                                                  // sequence (u32) — ignored
    const logTimeNs = mcapReadU64(body, off);  off += 8;
    off += 8;                                                  // publish_time (u64) — same domain
    // Remaining bytes are the message payload.
    const data = body.subarray(off);
    resolveConn(channelId);
    messages.push({ conn: channelId, timeMs: logTimeNs / 1e6, data });
  }

  function ingestChunk(body) {
    const dv = new DataView(body.buffer, body.byteOffset, body.byteLength);
    let off = 0;
    off += 8;                                                  // message_start_time (u64)
    off += 8;                                                  // message_end_time (u64)
    off += 8;                                                  // uncompressed_size (u64)
    off += 4;                                                  // uncompressed_crc (u32)
    const compStr = mcapReadStr(body, off); off = compStr.next;
    // Chunk records, unlike the file-level records, store the
    // compressed-data length as u64 (not u32). The spec calls this
    // field `records` and notes it can be huge for big chunks.
    const recordsLen = mcapReadU64(body, off); off += 8;
    const compressed = body.subarray(off, off + recordsLen);
    let inner;
    try {
      inner = mcapDecompressChunk(compStr.value, compressed);
    } catch (e) {
      console.warn(`[scan-viewer] skipping mcap chunk: ${e.message}`);
      return;
    }
    walkRecords(inner);
  }

  /** Walk a record stream — either the top-level MCAP body (post-magic)
   *  or the inflated contents of a Chunk record. Record header is
   *  `u8 op | u64 dataLen | dataLen bytes`. */
  function walkRecords(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    let p = 0;
    while (p + 9 <= buf.length) {
      const op = buf[p]; p += 1;
      const dataLen = mcapReadU64(buf, p); p += 8;
      if (p + dataLen > buf.length) break;                     // truncated tail
      const body = buf.subarray(p, p + dataLen);
      p += dataLen;
      switch (op) {
        case MCAP_OP.SCHEMA:        ingestSchema(body);  break;
        case MCAP_OP.CHANNEL:       ingestChannel(body); break;
        case MCAP_OP.MESSAGE:       ingestMessage(body); break;
        case MCAP_OP.CHUNK:         ingestChunk(body);   break;
        case MCAP_OP.HEADER:
        case MCAP_OP.FOOTER:
        case MCAP_OP.MESSAGE_INDEX:
        case MCAP_OP.CHUNK_INDEX:
        case MCAP_OP.ATTACHMENT:
        case MCAP_OP.STATISTICS:
        case MCAP_OP.METADATA:
        case MCAP_OP.DATA_END:
        default:
          // Skip — nothing the browser viewer needs.
          break;
      }
    }
  }

  // Walk everything after the leading magic.
  walkRecords(all.subarray(MCAP_MAGIC.length));
  return { connections, messages };
}

// ─── CDR + payload decoders for MCAP `arachnid.*` schemas ──────────────
//
// NORMATIVE WIRE FORMAT (MCAP_MIGRATION.md §1.3). Until the schema IDL
// lands, THREE places carry the spec and must stay in sync:
//
//   • mesh-worker/build_mesh.py                     (_decode_cdr_* + comment)
//   • mesh-worker/tests/fixtures/make_synthetic_cdr_mcap.py   (producer)
//   • this block                                    (browser consumer)
//
// Everything is LITTLE-ENDIAN and TIGHTLY PACKED. There is NO CDR
// encapsulation header, NO 4/8-byte alignment padding, and strings are
// u16-length-prefixed utf-8 WITHOUT a trailing NUL. (An earlier revision
// of this file assumed ROS 2 "real" CDR — aligned fields, u32+NUL strings,
// an `encoding` string and a `step` field on the wire. No producer ever
// emitted that; the packed layout below is what the Orin recorder and the
// fixture generator actually write.)
//
//   shared header (every cdr sensor payload starts with it)
//     u64  timestamp_ns          ns since UNIX epoch (hardware capture time)
//     u16  frame_id_len
//     u8[] frame_id              utf-8, frame_id_len bytes
//
//   arachnid.sensor.DepthImage   message_encoding "cdr"
//     header | u32 width | u32 height | f64 depth_scale_m
//            | u32 data_len | u8[] data          (Z16 raw, little-endian)
//
//   arachnid.sensor.ColorImage   message_encoding "cdr"
//     header | u32 width | u32 height | u8 encoding_enum
//            | u32 data_len | u8[] data          (raw pixels, or JPEG stream)
//     encoding_enum: 0 = bgr8, 1 = rgb8, 2 = bgra8, 3 = jpeg
//
//   arachnid.sensor.Imu          message_encoding "cdr"
//     header | f32[3] linear_accel_mps2 | f32[3] angular_vel_rps
//
// CameraInfo / PoseStamped / RelayInfo / ThermalImage stay JSON payloads
// even on a file whose channels are stamped "cdr" (some transitional
// producers stamp the whole file). Mirroring
// `build_mesh._decode_arachnid_payload()`, the dispatcher below routes on
// SCHEMA NAME and falls back to JSON.parse for every schema it has no CDR
// layout for. JSON `data` fields are base64 and get decoded to bytes here,
// so both encodings hand the frame assembler an identical dict.

/** ColorImage encoding enum → spec string (§1.3). Index IS the enum. */
const MCAP_CDR_COLOR_ENCODINGS = ["bgr8", "rgb8", "bgra8", "jpeg"];

/**
 * Little-endian, tightly-packed struct reader. Deliberately NOT a CDR
 * reader — no alignment, no encapsulation header. Also used by the MCAP
 * summary/index parser further down, which has the same "packed LE"
 * property (its strings are u32-prefixed, hence both `str16` and `str32`).
 */
class PackedReader {
  constructor(bytes) {
    this.bytes = bytes;
    this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = 0;
  }
  get remaining() { return this.bytes.length - this.pos; }
  _need(n) {
    if (this.pos + n > this.bytes.length) {
      throw new Error(
        `packed payload truncated: need ${n} bytes at offset ${this.pos}, ` +
        `only ${this.bytes.length - this.pos} remain`);
    }
  }
  u8()  { this._need(1); const v = this.dv.getUint8(this.pos);           this.pos += 1; return v; }
  u16() { this._need(2); const v = this.dv.getUint16(this.pos,  true);   this.pos += 2; return v; }
  u32() { this._need(4); const v = this.dv.getUint32(this.pos,  true);   this.pos += 4; return v; }
  f32() { this._need(4); const v = this.dv.getFloat32(this.pos, true);   this.pos += 4; return v; }
  f64() { this._need(8); const v = this.dv.getFloat64(this.pos, true);   this.pos += 8; return v; }
  /** u64 → JS Number. Exact to 2^53, which covers ns timestamps to 2255
   *  and file offsets to 9 PB. */
  u64() {
    this._need(8);
    const lo = this.dv.getUint32(this.pos,     true);
    const hi = this.dv.getUint32(this.pos + 4, true);
    this.pos += 8;
    return hi * 4294967296 + lo;
  }
  /** u16-length-prefixed utf-8 (arachnid CDR frame_id). */
  str16() {
    const n = this.u16(); this._need(n);
    const s = new TextDecoder("utf-8").decode(this.bytes.subarray(this.pos, this.pos + n));
    this.pos += n; return s;
  }
  /** u32-length-prefixed utf-8 (MCAP container strings). */
  str32() {
    const n = this.u32(); this._need(n);
    const s = new TextDecoder("utf-8").decode(this.bytes.subarray(this.pos, this.pos + n));
    this.pos += n; return s;
  }
  /** u32-length-prefixed byte blob. Returns a VIEW (no copy). */
  blob32() {
    const n = this.u32(); this._need(n);
    const b = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n; return b;
  }
}

/** Read the shared `u64 timestamp_ns | u16 frame_id_len | frame_id` prefix. */
function cdrReadHeader(r) {
  return { timestamp_ns: r.u64(), frame_id: r.str16() };
}

/** `arachnid.sensor.DepthImage` (cdr) → the same dict shape the JSON
 *  branch yields (`data` already raw bytes). */
function decodeCdrDepthImage(bytes) {
  const r = new PackedReader(bytes);
  const h = cdrReadHeader(r);
  const width  = r.u32();
  const height = r.u32();
  const depth_scale_m = r.f64();
  const data = r.blob32();
  return {
    timestamp_ns:  h.timestamp_ns,
    frame_id:      h.frame_id,
    width, height,
    depth_scale_m,
    encoding: "mono16",
    step:     width * 2,
    data,
  };
}

/** `arachnid.sensor.ColorImage` (cdr). The u8 enum is widened back to its
 *  spec string so `colorImageToRGB()`'s existing encoding switch is
 *  untouched (and gains only a `jpeg` case). */
function decodeCdrColorImage(bytes) {
  const r = new PackedReader(bytes);
  const h = cdrReadHeader(r);
  const width  = r.u32();
  const height = r.u32();
  const encEnum = r.u8();
  const encoding = MCAP_CDR_COLOR_ENCODINGS[encEnum];
  if (encoding === undefined) {
    throw new Error(`ColorImage CDR: unknown encoding enum ${encEnum} ` +
                    `(expected 0..${MCAP_CDR_COLOR_ENCODINGS.length - 1})`);
  }
  const data = r.blob32();
  const chans = encoding === "bgra8" ? 4 : (encoding === "jpeg" ? 0 : 3);
  return {
    timestamp_ns: h.timestamp_ns,
    frame_id:     h.frame_id,
    width, height,
    encoding,
    step: chans * width,          // 0 for jpeg — compressed, no row stride
    data,
  };
}

/** `arachnid.sensor.Imu` (cdr). The viewer doesn't render IMU today; the
 *  decoder exists so the CDR table is complete and the fixture round-trip
 *  test has one canonical parser (mirrors build_mesh._decode_cdr_imu). */
function decodeCdrImu(bytes) {
  const r = new PackedReader(bytes);
  const h = cdrReadHeader(r);
  const ax = r.f32(), ay = r.f32(), az = r.f32();
  const gx = r.f32(), gy = r.f32(), gz = r.f32();
  return {
    timestamp_ns: h.timestamp_ns,
    frame_id:     h.frame_id,
    linear_accel_mps2: [ax, ay, az],
    angular_vel_rps:   [gx, gy, gz],
  };
}

/** Schema name → CDR decoder. A function (not a module-level object) so it
 *  can name the `MCAP_SCHEMA_*` consts, which are declared further down. */
function cdrDecoderFor(schemaName) {
  switch (schemaName) {
    case MCAP_SCHEMA_DEPTH: return decodeCdrDepthImage;
    case MCAP_SCHEMA_COLOR: return decodeCdrColorImage;
    case MCAP_SCHEMA_IMU:   return decodeCdrImu;
    default:                return null;
  }
}

/** base64 → Uint8Array. `atob` in the browser and in Node ≥ 16; the
 *  Buffer branch is a belt-and-braces fallback for odd worker hosts. */
function b64ToBytes(s) {
  if (typeof atob === "function") {
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(s, "base64"));
  throw new Error("scan-viewer: no base64 decoder available (atob/Buffer missing)");
}

/** Coerce whatever a payload's `data` field ended up as into Uint8Array. */
function toBytes(d) {
  if (d instanceof Uint8Array) return d;
  if (typeof d === "string")   return b64ToBytes(d);
  if (Array.isArray(d))        return Uint8Array.from(d);
  if (ArrayBuffer.isView(d))   return new Uint8Array(d.buffer, d.byteOffset, d.byteLength);
  if (d instanceof ArrayBuffer) return new Uint8Array(d);
  return new Uint8Array(0);
}

/** JSON payload → dict, with `data` base64-decoded to bytes so the JSON
 *  and CDR branches return the identical shape. */
function decodeJsonPayload(bytes) {
  const o = JSON.parse(new TextDecoder("utf-8").decode(bytes));
  if (o && o.data !== undefined && !(o.data instanceof Uint8Array)) {
    o.data = toBytes(o.data);
  }
  return o;
}

/** Cheap JSON sniff — our JSON payloads are always a single object. */
function looksLikeJson(bytes) {
  if (!bytes || bytes.length < 2) return false;
  if (bytes[0] !== 0x7b) return false;                  // '{'
  let i = bytes.length - 1;
  while (i > 0 && (bytes[i] === 0x0a || bytes[i] === 0x0d ||
                   bytes[i] === 0x20 || bytes[i] === 0x09)) i--;
  return bytes[i] === 0x7d;                             // '}'
}

/**
 * Decode one `arachnid.*` MCAP message body into a plain dict. This is the
 * browser mirror of `build_mesh._decode_arachnid_payload()` and follows the
 * same dispatch rule:
 *
 *   message_encoding "json"/"jsonschema" → JSON.parse
 *   message_encoding "cdr"               → CDR table BY SCHEMA NAME, and
 *                                          JSON.parse for the JSON-payload
 *                                          schemas (CameraInfo, PoseStamped,
 *                                          RelayInfo, ThermalImage) that ride
 *                                          a cdr-stamped file
 *   anything else / absent               → sniff JSON, then the CDR table
 *
 * Both branches return the same keys, so every caller downstream stays
 * encoding-agnostic.
 */
function decodeArachnidPayload(schemaName, messageEncoding, bytes) {
  const enc  = String(messageEncoding || "");
  const cdrFn = cdrDecoderFor(schemaName);
  if (enc === "json" || enc === "jsonschema") return decodeJsonPayload(bytes);
  if (enc === "cdr") {
    if (cdrFn) return cdrFn(bytes);
    // JSON-payload schema on a cdr-tagged channel — the documented
    // transitional case. JSON bodies still parse.
    return decodeJsonPayload(bytes);
  }
  // Unknown/absent encoding. Python tries JSON first; we gate that on a
  // sniff so a CDR body whose timestamp low byte happens to be 0x7b can't
  // be mistaken for JSON.
  if (looksLikeJson(bytes)) {
    try { return decodeJsonPayload(bytes); } catch (_) { /* fall through */ }
  }
  if (cdrFn) return cdrFn(bytes);
  return decodeJsonPayload(bytes);          // throws with a real JSON error
}

/** Decode `arachnid.sensor.DepthImage` (cdr OR json). Returns the same
 *  shape as decodeImage(): { width, height, encoding, step, isBigEndian,
 *  timestampMs, data } plus `depthScaleM`.
 *
 *  `opts.messageEncoding` comes off the channel; omitting it keeps the
 *  legacy single-argument call working via the sniffing branch. */
function decodeMcapDepthImage(bytes, opts = {}) {
  const d = decodeArachnidPayload(MCAP_SCHEMA_DEPTH, opts.messageEncoding, bytes);
  const width  = d.width  | 0;
  const height = d.height | 0;
  return {
    width, height,
    encoding: d.encoding || "mono16",
    step: d.step || width * 2,
    isBigEndian: false,
    timestampMs: (d.timestamp_ns ?? 0) / 1e6,
    data: toBytes(d.data),
    depthScaleM: d.depth_scale_m ?? 0.001,   // not in the rosbag1 path — extra signal
  };
}

/** Decode `arachnid.sensor.ColorImage` (cdr OR json). Same shape as
 *  decodeImage(); `encoding` may be "jpeg", which colorImageToRGB()
 *  turns into a PENDING color frame for async hydration. */
/** Decode `arachnid.sensor.IrPair` -> the raw stereo pair. Both imagers
 *  arrive as ONE image from ONE frameset; splitting is the consumer's job
 *  and uses the message's own split_col, never width/2. */
function decodeMcapIrPair(bytes, opts = {}) {
  const d = decodeArachnidPayload(MCAP_SCHEMA_IR_PAIR, opts.messageEncoding, bytes);
  const width  = d.width  | 0;
  const height = d.height | 0;
  return {
    width, height,
    splitCol: (d.split_col | 0) || (width >> 1),
    layout: d.layout || "lr",
    encoding: d.encoding || "png",
    baselineM: d.baseline_m ?? null,
    timestampMs: (d.timestamp_ns ?? 0) / 1e6,
    data: toBytes(d.data),
  };
}

function decodeMcapColorImage(bytes, opts = {}) {
  const d = decodeArachnidPayload(MCAP_SCHEMA_COLOR, opts.messageEncoding, bytes);
  const width  = d.width  | 0;
  const height = d.height | 0;
  return {
    width, height,
    encoding: d.encoding || "bgr8",
    step: d.step ?? 0,
    isBigEndian: false,
    timestampMs: (d.timestamp_ns ?? 0) / 1e6,
    data: toBytes(d.data),
  };
}

/** Decode `arachnid.sensor.Imu` (cdr OR json) →
 *  { timestampMs, accel:[x,y,z], gyro:[x,y,z] }. Not rendered today; kept
 *  so the CDR surface is complete and testable. */
function decodeMcapImu(bytes, opts = {}) {
  const d = decodeArachnidPayload(MCAP_SCHEMA_IMU, opts.messageEncoding, bytes);
  return {
    timestampMs: (d.timestamp_ns ?? 0) / 1e6,
    frameId: d.frame_id || "",
    accel: (d.linear_accel_mps2 || [0, 0, 0]).map(Number),
    gyro:  (d.angular_vel_rps   || [0, 0, 0]).map(Number),
  };
}

/** Decode `arachnid.sensor.CameraInfo` (JSON payload, §1.2.3). Returns the
 *  same shape as decodeCameraInfo(): { width, height, fx, fy, cx, cy }. */
function decodeMcapCameraInfo(bytes, opts = {}) {
  const json = decodeArachnidPayload(MCAP_SCHEMA_CAMERA_INFO, opts.messageEncoding, bytes);
  let fx = json.fx, fy = json.fy, cx = json.cx, cy = json.cy;
  // If the producer wrote only K, derive fx/fy/cx/cy from the matrix.
  // K is row-major 3x3: [fx, 0, cx, 0, fy, cy, 0, 0, 1].
  if ((fx === undefined || fy === undefined) && Array.isArray(json.K) && json.K.length === 9) {
    fx = fx ?? json.K[0];
    fy = fy ?? json.K[4];
    cx = cx ?? json.K[2];
    cy = cy ?? json.K[5];
  }
  return {
    width:  json.width,
    height: json.height,
    fx, fy, cx, cy,
  };
}

/** Decode `arachnid.geometry.PoseStamped` (JSON payload, §1.2.5). Returns
 *  the same shape as decodeTransform() + a `timeMs` field so the loader can
 *  match by timestamp per spec §5.13. */
function decodeMcapPoseStamped(bytes, opts = {}) {
  const d = decodeArachnidPayload(MCAP_SCHEMA_POSE, opts.messageEncoding, bytes);
  const t = d.translation || {};
  const q = d.rotation    || {};
  const n = (v, dflt) => (Number.isFinite(Number(v)) ? Number(v) : dflt);
  return {
    tx: n(t.x, 0), ty: n(t.y, 0), tz: n(t.z, 0),
    qx: n(q.x, 0), qy: n(q.y, 0), qz: n(q.z, 0), qw: n(q.w, 1),
    timeMs: (d.timestamp_ns ?? 0) / 1e6,
  };
}

// ─── JPEG color hydration ──────────────────────────────────────────────
//
// A `jpeg`-encoded ColorImage cannot be unpacked synchronously in a
// browser: the only decoders on the platform (createImageBitmap, <img>)
// are async. The synchronous assembly pass therefore emits a PENDING
// color frame — `{ width, height, rgb: null, jpeg: <bytes>, encoding }` —
// and `hydrateColorFrames()` (awaited inside load()) fills `.rgb` in.
//
// Every consumer already guards on `img.rgb` (scan-inspect's drawMiniRgb,
// ScanViewer.colorsForFrame), so a frame that never hydrates degrades to
// the depth heatmap instead of rendering garbage — and the compressed
// bytes stay reachable on `.jpeg` for anything that wants them (a future
// <img src=blob:> path, or a Node-side test).

/** JPEG bytes → { width, height, rgb: Uint8Array } via the platform image
 *  decoder. Returns null in hosts without createImageBitmap + a canvas
 *  (Node, some workers) — the caller leaves the frame pending. */
async function decodeJpegToRGB(jpegBytes) {
  if (typeof createImageBitmap !== "function" || typeof Blob !== "function") return null;
  const bmp = await createImageBitmap(new Blob([jpegBytes], { type: "image/jpeg" }));
  const w = bmp.width, h = bmp.height;
  let ctx = null;
  if (typeof OffscreenCanvas === "function") {
    ctx = new OffscreenCanvas(w, h).getContext("2d", { willReadFrequently: true });
  } else if (typeof document !== "undefined" && document.createElement) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    ctx = c.getContext("2d", { willReadFrequently: true });
  }
  if (!ctx) { bmp.close?.(); return null; }
  ctx.drawImage(bmp, 0, 0);
  bmp.close?.();
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const rgb = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    rgb[i]     = rgba[j];
    rgb[i + 1] = rgba[j + 1];
    rgb[i + 2] = rgba[j + 2];
  }
  return { width: w, height: h, rgb };
}

/** In-place hydration of every PENDING (jpeg) entry in a colorFrames array.
 *  Decodes in small parallel batches — createImageBitmap is off-main-thread
 *  in every current engine, so 8 at a time keeps a 30 fps bag's colour
 *  decode well under the fetch time it hides behind. */
/** Decode IrPair PNGs into ImageBitmaps, index-parallel to the depth
 *  frames. Mirrors hydrateColorFrames(): batched, tolerant of a host with
 *  no createImageBitmap, and it leaves the entry null rather than throwing
 *  so one bad frame cannot take the scan down.
 *
 *  The bitmap stays whole -- both imagers in one image. drawMiniIr() cuts
 *  it at split_col when it blits, so nothing here has to know the layout. */
async function hydrateIrPairs(pairs, { batch = 4, range } = {}) {
  if (!Array.isArray(pairs) || pairs.length === 0) return pairs;
  const lo = range ? Math.max(0, range[0]) : 0;
  const hi = range ? Math.min(pairs.length, range[1]) : pairs.length;
  const pending = [];
  for (let i = lo; i < hi; i++) {
    const p = pairs[i];
    if (p && !p.bitmap && p.data && p.data.length) pending.push(i);
  }
  if (pending.length === 0) return pairs;
  if (typeof createImageBitmap !== "function") {
    console.warn(`[scan-viewer] ${pending.length} IR pair(s) left undecoded — ` +
                 `this host has no createImageBitmap (IR panes stay hidden)`);
    return pairs;
  }
  for (let b = 0; b < pending.length; b += batch) {
    await Promise.all(pending.slice(b, b + batch).map(async (i) => {
      try {
        const type = pairs[i].encoding === "png" ? "image/png" : "image/jpeg";
        pairs[i] = { ...pairs[i],
                     bitmap: await createImageBitmap(new Blob([pairs[i].data], { type })) };
      } catch (e) {
        pairs[i] = null;   // hidden pane beats a broken one
      }
    }));
  }
  return pairs;
}

async function hydrateColorFrames(colorFrames, { onProgress, batch = 8, range } = {}) {
  if (!Array.isArray(colorFrames) || colorFrames.length === 0) return colorFrames;
  const lo = range ? Math.max(0, range[0]) : 0;
  const hi = range ? Math.min(colorFrames.length, range[1]) : colorFrames.length;
  const pending = [];
  for (let i = lo; i < hi; i++) {
    const c = colorFrames[i];
    if (c && !c.rgb && c.jpeg) pending.push(i);
  }
  if (pending.length === 0) return colorFrames;
  if (typeof createImageBitmap !== "function") {
    console.warn(`[scan-viewer] ${pending.length} JPEG colour frame(s) left undecoded — ` +
                 `this host has no createImageBitmap (points fall back to the depth heatmap)`);
    return colorFrames;
  }
  let done = 0;
  for (let b = 0; b < pending.length; b += batch) {
    const slice = pending.slice(b, b + batch);
    await Promise.all(slice.map(async (i) => {
      try {
        const out = await decodeJpegToRGB(colorFrames[i].jpeg);
        if (out) {
          colorFrames[i] = { ...colorFrames[i], width: out.width, height: out.height, rgb: out.rgb };
        }
      } catch (e) {
        console.warn(`[scan-viewer] jpeg colour frame ${i} decode failed:`, e);
      }
    }));
    done += slice.length;
    onProgress?.({ stage: "decode-color", pct: done / pending.length });
  }
  return colorFrames;
}

/**
 * Detect bag format from a URL + optional first-bytes prefix.
 *
 * Per spec §3.3.1 the ladder is:
 *   1. File extension (.mcap vs .bag) — authoritative.
 *   2. Magic-byte sniff on the first 8 bytes — used when the extension
 *      is missing/ambiguous OR as a sanity check.
 *
 * Returns "rosbag1" | "mcap". Throws if neither matches.
 *
 * The Range-header fetch fallback (spec lines around §3.3.1) lives in
 * the caller — this helper is pure-sync so it's easy to unit test.
 */
function detectFormat(url, prefix) {
  // 1) Extension — strip query string + hash before reading the suffix.
  const path = String(url || "").split("?")[0].split("#")[0];
  const dot  = path.lastIndexOf(".");
  const ext  = dot >= 0 ? path.slice(dot + 1).toLowerCase() : "";
  if (ext === "mcap") return "mcap";
  if (ext === "bag")  return "rosbag1";
  // 2) Magic sniff. Caller must pass at least the first 8 bytes if no
  //    extension is available.
  if (prefix && prefix.length >= 8) {
    if (isMcapMagic(prefix)) return "mcap";
    const head = new TextDecoder("ascii").decode(prefix.subarray(0, 8));
    if (head.startsWith("#ROSBAG ")) return "rosbag1";
  }
  throw new Error(`scan-viewer: cannot detect bag format from URL "${url}" (no .bag/.mcap extension, magic bytes inconclusive)`);
}

// ─── Public API ────────────────────────────────────────────────────────

const DEPTH_TOPIC       = "/device_0/sensor_0/Depth_0/image/data";
const CAMERA_INFO_TOPIC = "/device_0/sensor_0/Depth_0/info/camera_info";
// Pose and color may live under any sensor index depending on which
// streams the recorder enabled, in what order. (iPad: depth=sensor_0,
// color=sensor_1, pose=sensor_2 when all three are on; depth=sensor_0,
// pose=sensor_1 when color is off.) Match by suffix instead of full
// path so the parser works across configurations.
const POSE_TOPIC_SUFFIX  = "Pose_0/pose/transform/data";
const COLOR_TOPIC_SUFFIX = "Color_0/image/data";

// Schema names for MCAP routing (spec §1.2). Per spec §3.3, the browser
// viewer routes by SCHEMA NAME first, namespace (topic prefix) second.
// This means a future merged Orin + iPad scan with both `/d455/depth` and
// `/ipad/lidar/depth` is unambiguous: both are `arachnid.sensor.DepthImage`
// and both get ingested. Phase 1 we still pick the highest-frame-count
// stream as "primary" but the dispatcher accepts multiple.
const MCAP_SCHEMA_DEPTH       = "arachnid.sensor.DepthImage";
const MCAP_SCHEMA_COLOR       = "arachnid.sensor.ColorImage";
const MCAP_SCHEMA_CAMERA_INFO = "arachnid.sensor.CameraInfo";
const MCAP_SCHEMA_POSE        = "arachnid.geometry.PoseStamped";
// The raw stereo pair: one image, left|right, from ONE frameset. Split on
// the message's own split_col, never width/2 -- a layout that is not two
// equal halves would otherwise mis-split silently.
const MCAP_SCHEMA_IR_PAIR     = "arachnid.sensor.IrPair";
// Salvage provenance. A recovered file used to carry this only as MCAP
// metadata, which every consumer skips — so a salvaged scan was
// indistinguishable from an intact one. As a message it reaches us.
const MCAP_SCHEMA_PROVENANCE  = "arachnid.meta.Provenance";
// Pre-arm gravity stamp (recorder measures it motors-off; absent when the
// scan started in motion). Surfaced as viewer.gravity for leveling UIs.
const MCAP_SCHEMA_GRAVITY     = "arachnid.calib.Gravity";
// IMU + meta exist in the spec but the browser viewer doesn't RENDER them
// today. IMU is still named here because it is one of the three CDR-binary
// schemas (§1.3) and `cdrDecoderFor()` dispatches on it — decoding an IMU
// payload must not silently fall through to JSON.parse. RelayInfo/Thermal
// stay JSON, so they need no entry.
const MCAP_SCHEMA_IMU         = "arachnid.sensor.Imu";
// const MCAP_SCHEMA_META        = "arachnid.meta.RelayInfo";

class ScanViewer {
  constructor({ intrinsics, depthFrames, depthMessages, poseFrames, colorFrames, irPairs, provenance, gravity }) {
    this.intrinsics  = intrinsics;
    this._frames     = depthFrames;     // [{ width, height, data, timestampMs }]
    this._depthMsgs  = depthMessages;
    this._poses      = poseFrames || [];// [{ tx, ty, tz, qx, qy, qz, qw, timeMs }]
    this._colorImgs  = colorFrames || [];// [{ width, height, rgb }] parallel to _frames
    // [{ width, height, splitCol, bitmap }] parallel to _frames, or []. Kept
    // whole -- drawMiniIr() cuts at splitCol when it blits.
    this._irPairs    = irPairs || [];
    // Non-null when the file was rebuilt from a torn original.
    this.provenance  = provenance || null;
    this.gravity     = gravity || null;
    this._cache      = new Map();       // index → Float32Array (camera-frame)
    this._worldCache = new Map();       // index → Float32Array (world-frame)
    this._colorCache = new Map();       // index → Uint8Array (parallel to camera-frame)
  }

  get frameCount() { return this._frames.length; }

  /** True if pose data is available + passed sanity checks at load.
   *  Consumers use this to decide whether to render a world-frame
   *  cumulative cloud or fall back to per-frame-only rendering. */
  get hasPose() { return this._poses.length > 0; }

  /** Inject an EXTERNAL pose track for bags with no native pose stream.
   *
   *  The rig (Orin D455) records no pose topic, so its scan-preview/scan-mobile
   *  bags decode with `hasPose === false` and the cloud renders camera-frame —
   *  every frame stacked at the origin, i.e. a frustum cone, not a posed
   *  reconstruction. The `scan.pose.jsonl` sidecar (make_pose_track.py SLAM /
   *  pose_bridge.py ARKit) is the SAME ARKit-convention track the mesh-worker
   *  uses to pose the MESH, so feeding it here makes `worldFrame()` apply it
   *  exactly like a native pose — no frame conversion (the deproject already
   *  emits the ARKit camera frame: y-up, -z-forward).
   *
   *  `poses`: [{ tx, ty, tz, qx, qy, qz, qw, timeMs }] (timeMs same epoch base
   *  as `timestamp(i)`, so `poseFor()` matches nearest-by-timestamp). Returns
   *  true when a non-empty track was applied. */
  setExternalPoses(poses) {
    if (!Array.isArray(poses) || poses.length === 0) return false;
    poses.sort((a, b) => a.timeMs - b.timeMs);
    this._poses = poses;
    this._posesExternal = true;        // force timestamp matching in poseFor (never 1:1 by index)
    this._worldCache.clear();          // drop any camera-frame results cached as "world"
    return true;
  }

  /** True if the bag contains a color stream paired with depth — INSPECT
   *  uses this to decide whether COLOR view-mode renders real RGB
   *  (via per-point sampling) or falls back to the depth-heatmap
   *  colorization. */
  get hasColor() { return this._colorImgs.length > 0; }

  timestamp(i) { return this._frames[i]?.timestampMs ?? null; }

  /** Raw RGB image for depth-frame `i`, or `null` if no color stream
   *  is paired with this bag. Used by the mini-camera widget in the
   *  INSPECT panel — it ImageData-draws this directly onto a 2D
   *  canvas overlay so playback stays synced to the cloud scrub. */
  colorImageFor(i) {
    if (!this.hasColor) return null;
    return this._colorImgs[i] || null;
  }

  /** Per-scan depth display range: p05/p95 of sampled valid pixels, padded.
   *  The old fixed default (0.30-5.00 m) was the retracted door-card window
   *  measured with the lens 37 cm from a car panel: every aerial frame
   *  (p50 18-25 m) saturated to one flat colour and read as "depth is
   *  dead" -- the exact wrong conclusion the retraction documents. Points
   *  always survived (deproject uses far ?? 100); only the RAMP lied. */
  _autoRange() {
    if (this._rangeCache) return this._rangeCache;
    const zs = [];
    const n = this._frames.length;
    const step = Math.max(1, Math.floor(n / 12));
    for (let i = 0; i < n; i += step) {
      const f = this._frames[i];
      if (!f || !f.data) continue;
      const scale = f.depthScaleM ?? 0.001;
      const bytes = f.data, len = Math.floor(bytes.length / 2);
      for (let k = 0; k < len; k += 97) {
        const v = bytes[2 * k] | (bytes[2 * k + 1] << 8);
        if (v !== 0 && v !== 65535) zs.push(v * scale);
      }
    }
    if (zs.length < 500) {
      return (this._rangeCache = { near: 0.30, far: 5.00 });   // too little data to argue
    }
    zs.sort((a, b) => a - b);
    const p05 = zs[Math.floor(zs.length * 0.05)];
    const p95 = zs[Math.floor(zs.length * 0.95)];
    return (this._rangeCache = {
      near: Math.max(0.1, p05 * 0.8),
      far:  Math.min(65.0, Math.max(p95 * 1.25, p05 + 0.5)),
    });
  }

  /** Stereo pair for depth-frame `i`, or null. Index-parallel to depth,
   *  like _colorImgs -- no nearest-timestamp search needed, because the
   *  pair and its depth frame came off the same frameset. */
  irPairFor(i) {
    if (!this._irPairs) return null;
    return this._irPairs[i] || null;
  }

  /**
   * Returns the deprojected point cloud for frame `i`, in
   * Three.js-friendly coordinates (y up, -z forward). Cached.
   */
  frame(i, opts) {
    if (i < 0 || i >= this._frames.length) return null;
    // Cache by (index, maxPoints, near, far) so a dense call (4000-pt
    // for the highlighted current frame) doesn't poison the cache for
    // a later sparse call (400-pt for accum buckets) and vice versa.
    const mp = opts?.maxPoints ?? 4000;
    const cacheKey = `${i}|${mp}|${opts?.near ?? this._autoRange().near}|${opts?.far ?? this._autoRange().far}`;
    if (this._cache.has(cacheKey)) return this._cache.get(cacheKey);
    // Strip any caller-supplied colour plane: with colorImg set, deproject
    // returns the {positions, colors} wrapper instead of a bare positions
    // array. This path only ever wants positions — and the wrapper leaking
    // through here was latent for as long as some earlier heatmap call had
    // always pre-seeded the cache (a fresh viewer going straight to a
    // thermal render threw "Invalid array length").
    const pOpts = opts?.colorImg ? { ...opts, colorImg: undefined } : opts;
    const pts = deproject(this._frames[i], this.intrinsics, pOpts);
    this._cache.set(cacheKey, pts);
    return pts;
  }

  /** Returns a Uint8Array of `[r,g,b, r,g,b, …]` sampled at the SAME
   *  depth pixels that `frame(i, opts)` deprojected, in the same order.
   *  Returns `null` when the bag has no color stream.
   *
   *  Cached by the same (frame, maxPoints, near, far) key so subsequent
   *  scrubs over the same frame are allocation-free.  */
  colorsForFrame(i, opts) {
    // `opts.colorImg` lets a caller substitute its OWN colour plane for
    // the bag's (INSPECT's thermal-on-geometry mode warps the nearest
    // ATH1 frame into a synthetic `{width,height,rgb}` and passes it in).
    // Such a caller must also pass `opts.colorKey` — a stable identity
    // string for that image — so the per-frame colour cache doesn't hand
    // back a different image's samples.
    if (!this.hasColor && !opts?.colorImg) return null;
    if (i < 0 || i >= this._frames.length) return null;
    const colorImg = opts?.colorImg || this._colorImgs[i];
    // `!colorImg.rgb` covers a PENDING jpeg frame (bytes carried, pixels
    // not yet decoded — see hydrateColorFrames). Returning null makes
    // pointsForRenderer fall back to the depth heatmap for that frame
    // instead of sampling an absent buffer.
    if (!colorImg || !colorImg.rgb) return null;
    const mp = opts?.maxPoints ?? 4000;
    const cacheKey = `${i}|${mp}|${opts?.near ?? this._autoRange().near}|${opts?.far ?? this._autoRange().far}|${opts?.colorKey ?? ""}`;
    if (this._colorCache.has(cacheKey)) return this._colorCache.get(cacheKey);
    // Re-run deproject with colorImg so positions + colors come out in
    // lockstep. Positions get cached too, replacing whatever positions-
    // only entry was there (they're identical pixel-for-pixel).
    const r = deproject(this._frames[i], this.intrinsics, { ...opts, colorImg });
    if (r && r.positions && r.colors) {
      if (!this._validCache) this._validCache = new Map();
      this._validCache.set(cacheKey, r.valids || null);
      // Positions are identical pixel-for-pixel to `frame(i, opts)`, so
      // seed that cache too — but only on the un-keyed (bag colour) path,
      // where our cacheKey matches frame()'s. A caller-supplied colorImg
      // suffixes the key, and a positions entry under it would never be
      // read back.
      if (!opts?.colorKey) this._cache.set(cacheKey, r.positions);
      this._colorCache.set(cacheKey, r.colors);
      return r.colors;
    }
    return null;
  }

  /** Parallel per-point validity for the SAME (i, opts) as colorsForFrame:
   *  1 = the colour plane really sampled that point, 0 = out of its FOV.
   *  null when the plane carries no `valid` array (bag colour, or a legacy
   *  thermal warp still using the red-LSB tag). */
  colorValidsForFrame(i, opts) {
    const mp = opts?.maxPoints ?? 4000;
    const cacheKey = `${i}|${mp}|${opts?.near ?? this._autoRange().near}|${opts?.far ?? this._autoRange().far}|${opts?.colorKey ?? ""}`;
    if (!this._validCache || !this._validCache.has(cacheKey)) this.colorsForFrame(i, opts);
    return this._validCache ? (this._validCache.get(cacheKey) ?? null) : null;
  }

  /**
   * Returns the pose for depth frame `i`. null if no poses were recorded.
   *
   * Pairing strategy:
   *
   *   pose_count == depth_count → 1:1 by index (what RSBagRecorder
   *                                produces — depth + pose are pushed
   *                                in lock-step inside the iPad app)
   *   else                       → nearest by timestamp
   *
   * Why not always-by-timestamp: librealsense's chunk-header timestamps
   * (the only timestamp our parser sees on poses, since
   * geometry_msgs/Transform has no embedded Header) are sentinel values
   * (`2^29 ns`, then non-monotonic chunk-write times) — NOT real frame
   * timestamps. Matching by them silently sticks every depth frame to
   * the same pose and the world-frame cumulative cloud collapses to a
   * single shifted snapshot.
   */
  poseFor(i) {
    const P = this._poses, n = P.length;
    if (n === 0) return null;

    // (1) NATIVE lock-step stream, equal counts → 1:1 by index. RSBagRecorder
    //     pushes depth+pose together, so pose[i] pairs with depth[i]. (Desktop
    //     scan-preview.bag / full scan.bag take this path.)
    if (!this._posesExternal && n === this._frames.length) {
      return P[i] ?? null;
    }

    // (2) EXTERNAL sidecar track (scan.pose.jsonl): real epoch timestamps on
    //     both poses and frames → nearest-by-timestamp is correct.
    if (this._posesExternal) {
      const ts = this.timestamp(i);
      if (ts === null) return P[0];
      let best = P[0], bestDt = Math.abs(P[0].timeMs - ts);
      for (let k = 1; k < n; k++) {
        const dt = Math.abs(P[k].timeMs - ts);
        if (dt < bestDt) { best = P[k]; bestDt = dt; }
      }
      return best;
    }

    // (3) NATIVE stream, UNEQUAL counts → scan-mobile.bag decimates DEPTH
    //     (e.g. 2192→105) but keeps ALL poses (2192). The pose topic
    //     (geometry_msgs/Transform) carries no header, so its timeMs is a
    //     librealsense SENTINEL — nearest-by-timestamp sticks every frame to a
    //     single pose (the static-cone bug: translation spread → 0). The kept
    //     depth frames are a uniform, ORDERED subset of the original 1:1 pose
    //     list, so recover the pairing by PROPORTIONAL index instead.
    const fc = this._frames.length;
    if (fc <= 1) return P[0];
    const k = Math.round(i * (n - 1) / (fc - 1));
    return P[Math.max(0, Math.min(n - 1, k))] ?? null;
  }

  /**
   * Returns frame `i`'s points in WORLD coordinates by applying the
   * per-frame pose transform to the camera-frame deprojection. Cached.
   * If no pose data is available, falls back to camera-frame.
   *
   * Math: world_p = R(q) * cam_p + t, where q = (qx, qy, qz, qw) and
   * t = (tx, ty, tz). We rotate using the standard quaternion-vector
   * rotation: v' = q * v * q*. Implementation expanded inline to avoid
   * allocating intermediate quaternions per point.
   */
  worldFrame(i, opts) {
    if (i < 0 || i >= this._frames.length) return null;
    const mp = opts?.maxPoints ?? 4000;
    const cacheKey = `${i}|${mp}|${opts?.near ?? this._autoRange().near}|${opts?.far ?? this._autoRange().far}`;
    if (this._worldCache.has(cacheKey)) return this._worldCache.get(cacheKey);
    const cam = this.frame(i, opts);
    const pose = this.poseFor(i);
    if (!cam || !pose) {
      this._worldCache.set(cacheKey, cam);
      return cam;
    }
    const out = new Float32Array(cam.length);
    const { tx, ty, tz, qx, qy, qz, qw } = pose;
    // Precompute quaternion-rotation matrix terms.
    const xx = qx*qx, yy = qy*qy, zz = qz*qz;
    const xy = qx*qy, xz = qx*qz, yz = qy*qz;
    const wx = qw*qx, wy = qw*qy, wz = qw*qz;
    const m00 = 1 - 2*(yy + zz), m01 =     2*(xy - wz), m02 =     2*(xz + wy);
    const m10 =     2*(xy + wz), m11 = 1 - 2*(xx + zz), m12 =     2*(yz - wx);
    const m20 =     2*(xz - wy), m21 =     2*(yz + wx), m22 = 1 - 2*(xx + yy);
    for (let k = 0; k < cam.length; k += 3) {
      const x = cam[k], y = cam[k+1], z = cam[k+2];
      out[k]   = m00*x + m01*y + m02*z + tx;
      out[k+1] = m10*x + m11*y + m12*z + ty;
      out[k+2] = m20*x + m21*y + m22*z + tz;
    }
    this._worldCache.set(cacheKey, out);
    return out;
  }

  /**
   * Adapter for `pc-renderer.js`'s `setPoints([[x,y,z,r,g,b], …])` —
   * converts the flat Float32Array into the tuple format the renderer
   * expects. `world: true` uses pose-transformed world-frame points.
   * Color is the heatmap-derived `(r, g, b)` 0–1 floats based on the
   * camera-frame point's z distance, so the cloud reads visually like
   * the iPad app's renderer (red→green→blue near→far).
   */
  pointsForRenderer(i, opts = {}) {
    // Cache the rendered tuples per (frame, world|cam, color-source) so
    // scrubbing back over already-visited frames is allocation-free
    // and ~10× faster. Without this, every scrub event allocates ~4000
    // new tuple Arrays + does the heatmap math per pixel — the hot path
    // dominating frame time during scrubbing.
    if (!this._renderCache) this._renderCache = new Map();
    // colorSource: "heatmap" (depth-ramp), "rgb" (per-pixel from color
    // bag stream), "white" (current-frame highlight in INSPECT POINTS),
    // "thermal" (per-pixel from a CALLER-SUPPLIED colour plane — INSPECT
    // warps the time-nearest ATH1 thermal frame into `opts.colorImg`).
    // Falls back from "rgb" to "heatmap" if hasColor is false, and from
    // "thermal" to "heatmap" if no colour plane was supplied.
    let src = opts.colorSource || (opts.whiteFrame ? "white" : "heatmap");
    if (src === "rgb"     && !this.hasColor && !opts.colorImg) src = "heatmap";
    if (src === "thermal" && !opts.colorImg)                   src = "heatmap";
    // `trimOutliers: true` runs the cached tuple list through a per-
    // frame MAD trim (kept tuples are cached under a distinct key).
    const trim = !!opts.trimOutliers;
    const cullP = !!opts.cullDominantPlane;
    const cullB = !!opts.cullBackground;
    const cacheKey = `${i}|${opts.world ? "w" : "c"}|${src}|${opts.near ?? this._autoRange().near}|${opts.far ?? this._autoRange().far}|${opts.maxPoints ?? 4000}|${trim ? "t" : "_"}|${cullP ? "p" : "_"}|${cullB ? "b" : "_"}|${opts.colorKey ?? ""}`;
    const cached = this._renderCache.get(cacheKey);
    if (cached) return cached;

    const flatCam   = this.frame(i, opts);
    if (!flatCam) return [];
    const flat      = opts.world ? this.worldFrame(i, opts) : flatCam;
    const out = new Array(flat.length / 3);

    // Depth-ramp colour, shared by the "heatmap" source and by the
    // per-point fallback inside the "thermal" source. Uses the CAMERA-
    // frame z so hue reflects distance at capture time, not world position.
    const near = opts.near ?? this._autoRange().near;
    const far  = opts.far  ?? this._autoRange().far;
    const denom = Math.max(0.001, far - near);
    // Scale to 0-255: pc-renderer.js's setPoints / addToAccum divide
    // colors by 255 (legacy contract from the SLAM live-stream where
    // RGB arrived as uint8 bytes). Skipping this scale makes every
    // point ~0.004 brightness — invisible on the dark background.
    const heatRGB = (zCam) => {
      let t = (zCam - near) / denom;
      if (t < 0) t = 0; else if (t > 1) t = 1;
      if (t < 0.5) { const s = t * 2;         return [(1 - s) * 255, s * 255, 0]; }
      const s = (t - 0.5) * 2;                return [0, (1 - s) * 255, s * 255];
    };

    if (src === "white") {
      // INSPECT POINTS mode: bright white per-frame highlight.
      for (let k = 0, j = 0; k < flat.length; k += 3, j++) {
        out[j] = [flat[k], flat[k + 1], flat[k + 2], 255, 255, 255];
      }
      const finalW = applyCloudFilters(out, trim, cullP, cullB, opts);
      this._renderCache.set(cacheKey, finalW);
      return finalW;
    }

    if (src === "rgb" || src === "thermal") {
      // Real camera color per point. colorsForFrame walks deproject
      // again with the color image and returns Uint8 RGB in lockstep
      // with the cached positions array.
      //
      // "thermal": the supplied plane covers a NARROWER FOV than the
      // colour camera, so some depth pixels have no thermal sample at
      // all; they fall back to the depth heatmap rather than smearing
      // the thermal edge pixel across the out-of-FOV border. Coverage
      // rides in the plane's parallel `valid` array; the red-LSB check
      // remains ONLY for legacy planes that still tag in-band.
      const tagged = src === "thermal";
      const rgb = this.colorsForFrame(i, opts);
      const valid = tagged ? this.colorValidsForFrame(i, opts) : null;
      if (rgb && rgb.length === flat.length) {
        for (let k = 0, j = 0; k < flat.length; k += 3, j++) {
          if (tagged && (valid ? !valid[j] : (rgb[k] & 1) === 0)) {
            const h = heatRGB(-flatCam[k + 2]);
            out[j] = [flat[k], flat[k + 1], flat[k + 2], h[0], h[1], h[2]];
            continue;
          }
          out[j] = [flat[k], flat[k + 1], flat[k + 2], rgb[k], rgb[k+1], rgb[k+2]];
        }
        const finalR = applyCloudFilters(out, trim, cullP, cullB, opts);
        this._renderCache.set(cacheKey, finalR);
        return finalR;
      }
      // Length mismatch (shouldn't happen, but be defensive) — fall
      // through to heatmap so we never render a blank cloud.
    }

    for (let k = 0, j = 0; k < flat.length; k += 3, j++) {
      const h = heatRGB(-flatCam[k + 2]);
      out[j] = [flat[k], flat[k + 1], flat[k + 2], h[0], h[1], h[2]];
    }
    const finalTuples = applyCloudFilters(out, trim, cullP, cullB, opts);
    this._renderCache.set(cacheKey, finalTuples);
    return finalTuples;
  }

  /**
   * Returns the union of every frame's world-frame points, stride-
   * sampled to fit `maxPoints`. Used by the INSPECT panel to render
   * a dim "history" cloud underneath the per-frame highlight.
   */
  accumPointsForRenderer(opts = {}) {
    const maxPoints = opts.maxPoints ?? 200_000;
    const near = opts.near ?? this._autoRange().near;
    const far  = opts.far  ?? this._autoRange().far;
    const denom = Math.max(0.001, far - near);
    // Sample every Nth frame so we don't blow MAX_ACCUM. Per-frame
    // we already cap to ~5–8k points via deproject(), so:
    //     frameCount * pointsPerFrame ≤ maxPoints
    const ppf = (this.frame(0, opts) || []).length / 3 || 5000;
    const stride = Math.max(1, Math.ceil(this.frameCount * ppf / maxPoints));
    const out = [];
    for (let i = 0; i < this.frameCount; i += stride) {
      const flatCam = this.frame(i, opts);
      const flat    = this.worldFrame(i, opts);
      if (!flat) continue;
      for (let k = 0; k < flat.length; k += 3) {
        const zCam = -flatCam[k + 2];
        let t = (zCam - near) / denom;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        let r, g, b;
        if (t < 0.5) { const s = t * 2;       r = 1 - s; g = s;     b = 0; }
        else         { const s = (t - 0.5) * 2; r = 0;   g = 1 - s; b = s; }
        // 0-255 scale to match pc-renderer's div-by-255 contract.
        out.push([flat[k], flat[k + 1], flat[k + 2], r * 255, g * 255, b * 255]);
      }
      if (out.length >= maxPoints) break;
    }
    return out;
  }

  /**
   * Compute the world-frame bounding box across all decoded frames.
   * Used by the INSPECT panel to auto-fit the OrbitControls camera so
   * the user sees the whole walked path on bag load instead of having
   * to manually zoom out from the hard-coded default position.
   *
   * Returns { center: [cx,cy,cz], size: [sx,sy,sz], radius } or null
   * if the bag is empty / no points decoded.
   */
  worldBoundingBox(opts = {}) {
    const stride = opts.stride ?? Math.max(1, Math.floor(this.frameCount / 50));
    let xMin = Infinity, yMin = Infinity, zMin = Infinity;
    let xMax = -Infinity, yMax = -Infinity, zMax = -Infinity;
    let n = 0;
    for (let i = 0; i < this.frameCount; i += stride) {
      const flat = opts.world && this.hasPose ? this.worldFrame(i, opts) : this.frame(i, opts);
      if (!flat || flat.length === 0) continue;
      for (let k = 0; k < flat.length; k += 3) {
        const x = flat[k], y = flat[k+1], z = flat[k+2];
        if (x < xMin) xMin = x; if (x > xMax) xMax = x;
        if (y < yMin) yMin = y; if (y > yMax) yMax = y;
        if (z < zMin) zMin = z; if (z > zMax) zMax = z;
        n++;
      }
    }
    if (n === 0) return null;
    return {
      center: [(xMin+xMax)/2, (yMin+yMax)/2, (zMin+zMax)/2],
      size:   [xMax-xMin, yMax-yMin, zMax-zMin],
      radius: Math.hypot((xMax-xMin)/2, (yMax-yMin)/2, (zMax-zMin)/2),
      min: [xMin, yMin, zMin],
      max: [xMax, yMax, zMax],
    };
  }

  /** Drop statistical outliers from a flat `[x,y,z,...]` Float32Array
   *  via per-axis MAD (median absolute deviation) thresholding.
   *
   *  A point is kept iff for every axis the |coord - median| is within
   *  `k * MAD`. Default `k = 4` is forgiving — it preserves legitimate
   *  spread (e.g. a long walked path: the median is mid-path, MAD is
   *  ~half the path length, threshold is ~2× the path length, so
   *  nothing legitimate gets cut) while still trimming the obvious
   *  flyers from depth-edge artifacts and isolated bad pixels.
   *
   *  MAD is used instead of std-dev because std-dev is inflated by the
   *  very outliers we're trying to remove. Median + MAD is robust to
   *  ~50% contamination.
   *
   *  Returns a new Float32Array containing only the kept coords. */
  static trimMAD(positions, opts = {}) {
    const k = opts.k ?? 4;
    if (!positions || positions.length < 12) return positions;
    const n = positions.length / 3;
    // Single-pass split into per-axis buffers.
    const xs = new Float32Array(n), ys = new Float32Array(n), zs = new Float32Array(n);
    for (let i = 0, j = 0; i < positions.length; i += 3, j++) {
      xs[j] = positions[i]; ys[j] = positions[i+1]; zs[j] = positions[i+2];
    }
    const median = (arr) => {
      const sorted = Array.from(arr).sort((a, b) => a - b);
      return sorted[sorted.length >> 1];
    };
    const mx = median(xs), my = median(ys), mz = median(zs);
    // MAD = median absolute deviation from the median.
    const ax = new Float32Array(n), ay = new Float32Array(n), az = new Float32Array(n);
    for (let j = 0; j < n; j++) {
      ax[j] = Math.abs(xs[j] - mx);
      ay[j] = Math.abs(ys[j] - my);
      az[j] = Math.abs(zs[j] - mz);
    }
    // Floor MADs so tiny clusters don't produce zero thresholds.
    const madx = Math.max(1e-4, median(ax));
    const mady = Math.max(1e-4, median(ay));
    const madz = Math.max(1e-4, median(az));
    const tx = k * madx, ty = k * mady, tz = k * madz;
    // Filter — single pass, copy survivors into a fresh Float32Array.
    const kept = new Float32Array(positions.length);
    let w = 0;
    for (let i = 0; i < positions.length; i += 3) {
      const dx = Math.abs(positions[i]   - mx);
      const dy = Math.abs(positions[i+1] - my);
      const dz = Math.abs(positions[i+2] - mz);
      if (dx <= tx && dy <= ty && dz <= tz) {
        kept[w]   = positions[i];
        kept[w+1] = positions[i+1];
        kept[w+2] = positions[i+2];
        w += 3;
      }
    }
    return kept.subarray(0, w);
  }

  /** Robust centering — for the camera-framing step. AABB-based
   *  `worldBoundingBox` gets pushed around by a handful of far-depth
   *  outliers (the corners of the depth image at max range), parking
   *  the OrbitControls camera way too far back AND offsetting the
   *  target into empty space if the cloud is walked-path-shaped.
   *
   *  This computes the mean of the actual points as the centre, and
   *  the 90th-percentile distance-from-centre as the radius. Both
   *  survive a few stray outliers and produce a frame that's tight
   *  around the bulk of the cloud no matter how irregular the path.
   *
   *  Returns the same shape as `worldBoundingBox` so callers stay
   *  compatible (center / radius / size / min / max). */
  robustCenteringSphere(opts = {}) {
    const stride = opts.stride ?? Math.max(1, Math.floor(this.frameCount / 50));
    // Pass 1 — gather raw samples across the whole bag.
    const raw = [];
    for (let i = 0; i < this.frameCount; i += stride) {
      const flat = opts.world && this.hasPose ? this.worldFrame(i, opts) : this.frame(i, opts);
      if (!flat || flat.length === 0) continue;
      for (let k = 0; k < flat.length; k += 3) {
        raw.push(flat[k], flat[k+1], flat[k+2]);
      }
    }
    if (raw.length === 0) return null;
    // Strip statistical outliers BEFORE computing centroid + radius —
    // a single bad-depth point at 100 m can hijack both numbers and
    // park the camera in empty space. Default k=4 keeps real geometry.
    const cleaned = ScanViewer.trimMAD(new Float32Array(raw), { k: opts.trimK ?? 4 });
    // Centroid + AABB on the cleaned set.
    let sx = 0, sy = 0, sz = 0;
    let xMin = Infinity, yMin = Infinity, zMin = Infinity;
    let xMax = -Infinity, yMax = -Infinity, zMax = -Infinity;
    const n = cleaned.length / 3;
    const stash = cleaned;
    for (let k = 0; k < cleaned.length; k += 3) {
      const x = cleaned[k], y = cleaned[k+1], z = cleaned[k+2];
      sx += x; sy += y; sz += z;
      if (x < xMin) xMin = x; if (x > xMax) xMax = x;
      if (y < yMin) yMin = y; if (y > yMax) yMax = y;
      if (z < zMin) zMin = z; if (z > zMax) zMax = z;
    }
    if (n === 0) return null;
    const cx = sx / n, cy = sy / n, cz = sz / n;
    // Pass 2 — distance from centroid for each kept point.
    const dists = new Float32Array(n);
    for (let i = 0, j = 0; i < stash.length; i += 3, j++) {
      const dx = stash[i] - cx, dy = stash[i+1] - cy, dz = stash[i+2] - cz;
      dists[j] = Math.hypot(dx, dy, dz);
    }
    dists.sort();
    const p90 = dists[Math.floor(n * 0.90)] || 1.5;
    // Clamp the radius to a reasonable absolute range so a single
    // pathological point can't blow it up and a single tightly-packed
    // cluster can't collapse the camera into the cloud.
    const radius = Math.max(0.5, Math.min(50, p90 * 1.15));
    return {
      center: [cx, cy, cz],
      size:   [xMax - xMin, yMax - yMin, zMax - zMin],
      radius,
      min: [xMin, yMin, zMin],
      max: [xMax, yMax, zMax],
    };
  }
}

// ─── Indexed (HTTP-Range) MCAP loading ─────────────────────────────────
//
// The eager path streams the WHOLE file into one Uint8Array before the
// first frame exists — a 600 MB rig bag costs 600 MB of heap and a full
// download before anything renders. MCAP is designed for better: the file
// ends with a Summary section holding one ChunkIndex per chunk (byte
// offset + length + the chunk's message time range) and, in the data
// section, one MessageIndex per (chunk, channel) listing every message's
// log_time. Read the tail, and you know where every frame lives WITHOUT
// touching a byte of pixel data. Scrubbing then fetches + inflates only
// the chunk(s) covering the playhead, held in a small LRU.
//
// ┌─ PRODUCTION PREREQUISITE — S3 BUCKET CORS ──────────────────────────┐
// │ A previous attempt at client-side Range GETs against presigned S3   │
// │ URLs died on the CORS preflight (which is why api/aws/bag/exists.js │
// │ is server-side). Indexed mode therefore CAPABILITY-DETECTS: it      │
// │ issues one tiny Range request first and, if the response is not a   │
// │ 206 with a readable Content-Range, logs the reason and falls back   │
// │ to the untouched full-file path.                                    │
// │                                                                     │
// │ To unlock indexed mode in production the scans bucket needs its     │
// │ CORS rule extended with:                                            │
// │     AllowedHeaders : "Range"  (plus the existing entries)           │
// │     ExposeHeaders  : "Content-Range", "Accept-Ranges",              │
// │                      "Content-Length"                               │
// │ Without ExposeHeaders the browser gets the 206 but                  │
// │ `response.headers.get("Content-Range")` reads null, so we cannot    │
// │ learn the file size — detection treats that as unsupported.         │
// └─────────────────────────────────────────────────────────────────────┘
//
// Consumer note: the frame-access contract downstream (scan-inspect.js)
// is EAGER — it walks `viewer.frame(i)` for every i on load to build the
// accumulated cloud. So `load(url)` still returns a fully-decoded
// ScanViewer by default; indexed mode is opt-in via
// `load(url, { indexed: true })` and returns an `IndexedScanViewer` whose
// accessors have the same signatures but return null for frames whose
// chunk is not resident. Call `await v.ensureFrame(i)` / `v.seekMs(t)`
// before reading, or `await v.ensureAll()` for eager parity.

/** Footer record + trailing magic: op(1) + u64 len(8) + 20-byte body + 8. */
const MCAP_FOOTER_TAIL_BYTES = 1 + 8 + 20 + 8;
/** How much of the file tail to grab in the first probe. Big enough to
 *  swallow the Footer + the Summary of a typical scan (~130 chunks) in one
 *  round trip; a larger Summary just costs one extra Range GET. 64 KiB is
 *  0.01 % of a 600 MB bag — and, on a fixture smaller than the probe, the
 *  server simply returns the whole file, which is still correct. */
const MCAP_TAIL_PROBE_BYTES = 64 * 1024;
/** Message-index blocks are scattered (one run after every chunk) so they
 *  cannot be coalesced into a single Range. Fetch them N-at-a-time instead:
 *  a 150-chunk bag becomes ~19 round trips rather than 150 serial ones. */
const MCAP_INDEX_FETCH_CONCURRENCY = 8;
/** Decoded chunks kept resident. 4 covers a scrub jitter of ±1 chunk plus
 *  the sequential-playback prefetch without unbounded growth. */
const MCAP_CHUNK_LRU = 4;

/** Parse a Schema record body → { id, name, encoding, data }. */
function mcapParseSchemaRecord(body) {
  const r = new PackedReader(body);
  const id = r.u16();
  return { id, name: r.str32(), encoding: r.str32(), data: r.blob32() };
}

/** Parse a Channel record body → { id, schemaId, topic, messageEncoding }. */
function mcapParseChannelRecord(body) {
  const r = new PackedReader(body);
  const id = r.u16();
  const schemaId = r.u16();
  const topic = r.str32();
  const messageEncoding = r.str32();
  // metadata Map<string,string> — skipped by length for offset correctness.
  return { id, schemaId, topic, messageEncoding };
}

/** Parse a Message record body → { channelId, logTimeNs, data }. */
function mcapParseMessageRecord(body) {
  const r = new PackedReader(body);
  const channelId = r.u16();
  r.u32();                                   // sequence — ignored
  const logTimeNs = r.u64();
  r.u64();                                   // publish_time — same domain
  return { channelId, logTimeNs, data: body.subarray(r.pos) };
}

/** Parse a ChunkIndex record body (MCAP spec §Summary). */
function mcapParseChunkIndexRecord(body) {
  const r = new PackedReader(body);
  const messageStartTime = r.u64();
  const messageEndTime   = r.u64();
  const chunkStartOffset = r.u64();
  const chunkLength      = r.u64();
  const miByteLen = r.u32();
  const miEnd = r.pos + miByteLen;
  const messageIndexOffsets = new Map();     // channelId → absolute file offset
  while (r.pos < miEnd) {
    const cid = r.u16();
    messageIndexOffsets.set(cid, r.u64());
  }
  r.pos = miEnd;
  const messageIndexLength = r.u64();
  const compression        = r.str32();
  const compressedSize     = r.u64();
  const uncompressedSize   = r.u64();
  return {
    messageStartTime, messageEndTime, chunkStartOffset, chunkLength,
    messageIndexOffsets, messageIndexLength,
    compression, compressedSize, uncompressedSize,
  };
}

/** Parse a MessageIndex record body → { channelId, entries:[{t, off}] }. */
function mcapParseMessageIndexRecord(body) {
  const r = new PackedReader(body);
  const channelId = r.u16();
  const byteLen = r.u32();
  const end = r.pos + byteLen;
  const entries = [];
  while (r.pos < end) {
    const t = r.u64();
    const off = r.u64();
    entries.push({ t, off });
  }
  return { channelId, entries };
}

/** Inflate a Chunk record BODY (everything after `op | u64 len`) into its
 *  uncompressed inner record stream. Shares mcapDecompressChunk() with the
 *  eager path so zstd/lz4/none behave identically in both modes. */
function mcapInflateChunkBody(body) {
  const r = new PackedReader(body);
  r.u64();                                   // message_start_time
  r.u64();                                   // message_end_time
  r.u64();                                   // uncompressed_size
  r.u32();                                   // uncompressed_crc
  const compression = r.str32();
  const recordsLen = r.u64();
  const compressed = body.subarray(r.pos, r.pos + recordsLen);
  return mcapDecompressChunk(compression, compressed);
}

/** Walk `op | u64 dataLen | body` records, calling cb(op, body, offset).
 *  `offset` is relative to the start of `buf`. */
function mcapWalkRecords(buf, cb) {
  let p = 0;
  while (p + 9 <= buf.length) {
    const op = buf[p];
    const dataLen = mcapReadU64(buf, p + 1);
    const bodyStart = p + 9;
    if (bodyStart + dataLen > buf.length) break;        // truncated tail
    cb(op, buf.subarray(bodyStart, bodyStart + dataLen), p);
    p = bodyStart + dataLen;
  }
}

/**
 * One Range GET. Returns `{ ok: true, bytes, start, end, total }` on a
 * usable 206, or `{ ok: false, reason }` on anything the browser can't
 * work with (CORS rejection, 200 full-body, opaque headers).
 */
async function mcapRangeGet(url, spec, { fetchImpl, log, purpose } = {}) {
  const doFetch = fetchImpl || ((u, o) => fetch(u, o));
  let r;
  try {
    r = await doFetch(url, { headers: { Range: spec } });
  } catch (e) {
    return { ok: false, reason: `Range request rejected (${e && e.message}) — ` +
                                `almost always the S3 CORS preflight` };
  }
  if (r.status === 200) {
    try { r.body?.cancel?.(); } catch (_) { /* ignore */ }
    return { ok: false, reason: "server ignored Range and returned 200 (full body)" };
  }
  if (r.status !== 206) {
    return { ok: false, reason: `Range request returned ${r.status} ${r.statusText || ""}`.trim() };
  }
  const cr = r.headers.get("content-range");
  if (!cr) {
    return { ok: false, reason: "206 with no readable Content-Range — the bucket must " +
                                "ExposeHeaders: Content-Range for cross-origin reads" };
  }
  const m = /bytes\s+(\d+)-(\d+)\/(\d+|\*)/i.exec(cr);
  const bytes = new Uint8Array(await r.arrayBuffer());
  const rec = {
    spec, purpose: purpose || "?", status: 206,
    contentRange: cr, bytes: bytes.length,
  };
  log?.push(rec);
  return {
    ok: true, bytes,
    start: m ? +m[1] : 0,
    end:   m ? +m[2] : bytes.length - 1,
    total: m && m[3] !== "*" ? +m[3] : null,
  };
}

/**
 * Range-backed MCAP reader: summary + per-chunk message index up front,
 * chunk bodies on demand behind an LRU.
 *
 * `IndexedMcapSource.open()` returns null when the transport can't do
 * Range (the caller then falls back to the full-file load) — it never
 * throws for a capability problem, only for a genuinely malformed file.
 */
class IndexedMcapSource {
  constructor(url, opts) {
    this.url = url;
    this.fetchImpl = opts.fetchImpl;
    this.requestLog = opts.requestLog || [];
    this.schemas  = new Map();     // schemaId  → { name, encoding }
    this.channels = new Map();     // channelId → { schemaId, topic, messageEncoding }
    this.connections = new Map();  // channelId → downstream connection shape
    this.chunks = [];              // [ChunkIndex]
    this.chanTimeline = new Map(); // channelId → [{ t, chunk, off }] (chunk, off order)
    this._lru = [];                // chunkIdx, most-recent last
    this._chunkCache = new Map();  // chunkIdx → [{ conn, timeMs, data }]
    this._inflight = new Map();    // chunkIdx → Promise (dedupe scrub vs prefetch)
    this.fileSize = 0;
    this.mode = "indexed";
  }

  get chunkCount() { return this.chunks.length; }

  static async open(url, { fetchImpl, requestLog, tailBytes = MCAP_TAIL_PROBE_BYTES } = {}) {
    const src = new IndexedMcapSource(url, { fetchImpl, requestLog });
    const log = src.requestLog;

    // 1) Tail probe — doubles as the Range capability detector.
    const tail = await mcapRangeGet(url, `bytes=-${tailBytes}`,
                                    { fetchImpl, log, purpose: "tail" });
    if (!tail.ok) { src.unsupportedReason = tail.reason; return null; }
    const tb = tail.bytes;
    if (!isMcapMagic(tb.subarray(tb.length - MCAP_MAGIC.length))) {
      src.unsupportedReason = "file tail has no MCAP magic (truncated or not an mcap)";
      return null;
    }
    src.fileSize = tail.total ?? (tail.start + tb.length);

    // 2) Footer record sits immediately before the trailing magic.
    const fo = tb.length - MCAP_FOOTER_TAIL_BYTES;
    if (fo < 0 || tb[fo] !== MCAP_OP.FOOTER || mcapReadU64(tb, fo + 1) !== 20) {
      src.unsupportedReason = "no well-formed Footer record at the file tail";
      return null;
    }
    const summaryStart = mcapReadU64(tb, fo + 9);
    if (!summaryStart) {
      src.unsupportedReason = "file has no Summary section (summary_start = 0)";
      return null;
    }

    // 3) Summary: Schema + Channel + ChunkIndex records. Usually already
    //    inside the tail probe — reuse those bytes instead of re-fetching.
    const summaryEnd = src.fileSize - MCAP_MAGIC.length;   // exclusive
    let summary;
    if (summaryStart >= tail.start) {
      summary = tb.subarray(summaryStart - tail.start, summaryEnd - tail.start);
    } else {
      const s = await mcapRangeGet(url, `bytes=${summaryStart}-${summaryEnd - 1}`,
                                   { fetchImpl, log, purpose: "summary" });
      if (!s.ok) { src.unsupportedReason = s.reason; return null; }
      summary = s.bytes;
    }
    mcapWalkRecords(summary, (op, body) => {
      switch (op) {
        case MCAP_OP.SCHEMA: {
          const s = mcapParseSchemaRecord(body);
          src.schemas.set(s.id, s);
          break;
        }
        case MCAP_OP.CHANNEL: {
          const c = mcapParseChannelRecord(body);
          src.channels.set(c.id, c);
          break;
        }
        case MCAP_OP.CHUNK_INDEX:
          src.chunks.push(mcapParseChunkIndexRecord(body));
          break;
        default: break;
      }
    });
    if (src.chunks.length === 0) {
      src.unsupportedReason = "summary has no ChunkIndex records (unchunked or index-less mcap)";
      return null;
    }
    src.chunks.sort((a, b) => a.chunkStartOffset - b.chunkStartOffset);
    for (const [id, ch] of src.channels) {
      const sch = src.schemas.get(ch.schemaId) || { name: "?", encoding: "?" };
      src.connections.set(id, {
        topic:           ch.topic,
        msgType:         sch.name,
        schemaName:      sch.name,
        schemaEncoding:  sch.encoding,
        messageEncoding: ch.messageEncoding,
      });
    }

    // 4) MessageIndex blocks — one contiguous run right after each chunk.
    //    This is what makes the timeline (frame count + every timestamp)
    //    known without inflating a single pixel.
    const blocks = new Array(src.chunks.length);
    for (let base = 0; base < src.chunks.length; base += MCAP_INDEX_FETCH_CONCURRENCY) {
      const batch = [];
      for (let ci = base;
           ci < Math.min(base + MCAP_INDEX_FETCH_CONCURRENCY, src.chunks.length); ci++) {
        const c = src.chunks[ci];
        if (c.messageIndexOffsets.size === 0 || !c.messageIndexLength) {
          src.unsupportedReason = `chunk ${ci} has no MessageIndex records`;
          return null;
        }
        let lo = Infinity;
        for (const off of c.messageIndexOffsets.values()) lo = Math.min(lo, off);
        const at = ci;
        batch.push(
          mcapRangeGet(url, `bytes=${lo}-${lo + c.messageIndexLength - 1}`,
                       { fetchImpl, log, purpose: `message-index/${at}` })
            .then((r) => { blocks[at] = r; }));
      }
      await Promise.all(batch);
    }
    for (let ci = 0; ci < blocks.length; ci++) {
      const mi = blocks[ci];
      if (!mi || !mi.ok) { src.unsupportedReason = mi ? mi.reason : "message-index fetch failed"; return null; }
      mcapWalkRecords(mi.bytes, (op, body) => {
        if (op !== MCAP_OP.MESSAGE_INDEX) return;
        const rec = mcapParseMessageIndexRecord(body);
        let arr = src.chanTimeline.get(rec.channelId);
        if (!arr) { arr = []; src.chanTimeline.set(rec.channelId, arr); }
        for (const e of rec.entries) arr.push({ t: e.t, chunk: ci, off: e.off });
      });
    }
    // Canonical order = (chunk asc, offset asc). That is exactly the order
    // the eager full-file walk produces, so frame indices match mode to mode.
    for (const arr of src.chanTimeline.values()) {
      arr.sort((a, b) => (a.chunk - b.chunk) || (a.off - b.off));
    }
    return src;
  }

  /** Chunk index covering `tNs`, or the nearest one. */
  chunkForTime(tNs) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i];
      if (tNs >= c.messageStartTime && tNs <= c.messageEndTime) return i;
      const d = tNs < c.messageStartTime ? c.messageStartTime - tNs : tNs - c.messageEndTime;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  hasChunk(i) { return this._chunkCache.has(i); }

  /** Fetch + inflate chunk `i` → [{ conn, timeMs, data }] in record order.
   *  LRU-cached; `onEvict(chunkIdx)` lets the viewer drop derived frames. */
  async chunkMessages(i, { lruLimit = MCAP_CHUNK_LRU, onEvict } = {}) {
    const hit = this._chunkCache.get(i);
    if (hit) {
      this._lru = this._lru.filter((x) => x !== i);
      this._lru.push(i);
      return hit;
    }
    // Dedupe: a scrub and a sequential prefetch can ask for the same chunk
    // in the same tick — one Range GET, both awaiters get the result.
    const pending = this._inflight.get(i);
    if (pending) return pending;
    const p = this._fetchChunk(i, { lruLimit, onEvict })
      .finally(() => { this._inflight.delete(i); });
    this._inflight.set(i, p);
    return p;
  }

  async _fetchChunk(i, { lruLimit, onEvict }) {
    const c = this.chunks[i];
    if (!c) throw new Error(`mcap: no chunk ${i}`);
    const res = await mcapRangeGet(
      this.url,
      `bytes=${c.chunkStartOffset}-${c.chunkStartOffset + c.chunkLength - 1}`,
      { fetchImpl: this.fetchImpl, log: this.requestLog, purpose: `chunk/${i}` });
    if (!res.ok) throw new Error(`mcap: chunk ${i} range fetch failed — ${res.reason}`);
    const raw = res.bytes;
    if (raw[0] !== MCAP_OP.CHUNK) throw new Error(`mcap: byte at chunk ${i} offset is op 0x${raw[0].toString(16)}, expected Chunk`);
    const bodyLen = mcapReadU64(raw, 1);
    const inner = mcapInflateChunkBody(raw.subarray(9, 9 + bodyLen));
    const msgs = [];
    mcapWalkRecords(inner, (op, body) => {
      if (op !== MCAP_OP.MESSAGE) return;
      const m = mcapParseMessageRecord(body);
      msgs.push({ conn: m.channelId, timeMs: m.logTimeNs / 1e6, data: m.data });
    });
    this._chunkCache.set(i, msgs);
    this._lru.push(i);
    while (this._lru.length > lruLimit) {
      const drop = this._lru.shift();
      this._chunkCache.delete(drop);
      onEvict?.(drop);
    }
    return msgs;
  }
}

/**
 * ScanViewer backed by an IndexedMcapSource. Same accessor surface; the
 * only difference is that a frame whose chunk isn't resident reads as
 * `null` until you `await ensureFrame(i)` / `await seekMs(t)`.
 */
class IndexedScanViewer extends ScanViewer {
  constructor({ source, intrinsics, depthConn, colorConn, poseConn }) {
    const depthTl = source.chanTimeline.get(depthConn) || [];
    const colorTl = colorConn != null ? (source.chanTimeline.get(colorConn) || []) : [];
    super({
      intrinsics,
      depthFrames:   new Array(depthTl.length),
      depthMessages: [],
      poseFrames:    [],
      colorFrames:   new Array(depthTl.length),
    });
    this._src = source;
    this._depthConn = depthConn;
    this._colorConn = colorConn;
    this._poseConn  = poseConn;
    this._depthTl = depthTl;
    this._colorTl = colorTl;
    this._resident = new Set();
    this._lruLimit = MCAP_CHUNK_LRU;
    this._posesExternal = true;     // MCAP poses carry real ns timestamps
    this._poseSeen = new Set();
    // chunkIdx → [global depth index, …] in record order.
    this._depthByChunk = new Map();
    depthTl.forEach((e, i) => {
      let a = this._depthByChunk.get(e.chunk);
      if (!a) { a = []; this._depthByChunk.set(e.chunk, a); }
      a.push(i);
    });
    this._colorByChunk = new Map();
    colorTl.forEach((e, i) => {
      let a = this._colorByChunk.get(e.chunk);
      if (!a) { a = []; this._colorByChunk.set(e.chunk, a); }
      a.push(i);
    });
  }

  get frameCount()   { return this._depthTl.length; }
  get chunkCount()   { return this._src.chunkCount; }
  get residentChunks() { return [...this._resident].sort((a, b) => a - b); }
  get hasColor()     { return this._colorTl.length > 0; }
  get hasPose()      { return this._poses.length > 0 || this._poseConn != null; }
  get requestLog()   { return this._src.requestLog; }

  /** Timestamps are known for EVERY frame from the message index — no
   *  chunk fetch required. This is what keeps the scrubber honest. */
  timestamp(i) {
    const e = this._depthTl[i];
    return e ? e.t / 1e6 : null;
  }

  /** Chunk that holds frame `i`. */
  chunkForFrame(i) { return this._depthTl[i]?.chunk ?? -1; }

  /** Once a sidecar track is injected, stop merging the file's own pose
   *  messages in as later chunks load — otherwise the two tracks
   *  interleave and nearest-by-timestamp picks arbitrarily between them. */
  setExternalPoses(poses) {
    const applied = super.setExternalPoses(poses);
    if (applied) this._externalPoseTrack = true;
    return applied;
  }

  frame(i, opts) {
    if (i < 0 || i >= this._depthTl.length) return null;
    if (!this._frames[i]) return null;               // chunk not resident
    return super.frame(i, opts);
  }

  /** Nearest frame index to a wall-clock ms timestamp. */
  frameAtMs(tMs) {
    const tNs = tMs * 1e6;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < this._depthTl.length; i++) {
      const d = Math.abs(this._depthTl[i].t - tNs);
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** Make frame `i` readable. Fetches + inflates its chunk if needed and
   *  (for sequential playback) warms the next one in the background. */
  async ensureFrame(i, { prefetch = true } = {}) {
    const e = this._depthTl[i];
    if (!e) return false;
    await this._loadChunk(e.chunk);
    if (prefetch && e.chunk + 1 < this._src.chunkCount &&
        !this._resident.has(e.chunk + 1)) {
      this._loadChunk(e.chunk + 1).catch((err) =>
        console.warn(`[scan-viewer] prefetch of chunk ${e.chunk + 1} failed:`, err));
    }
    return !!this._frames[i];
  }

  /** Scrub to a timestamp (ms). Returns the frame index now resident. */
  async seekMs(tMs) {
    const i = this.frameAtMs(tMs);
    if (i < 0) return -1;
    await this.ensureFrame(i);
    return i;
  }

  /** Eager parity: load every chunk, LRU disabled. Used by the report
   *  builder and by anything that needs the whole timeline at once. */
  async ensureAll({ onProgress } = {}) {
    const prev = this._lruLimit;
    this._lruLimit = Infinity;
    try {
      for (let c = 0; c < this._src.chunkCount; c++) {
        await this._loadChunk(c);
        onProgress?.({ stage: "decode", pct: (c + 1) / this._src.chunkCount });
      }
    } finally { this._lruLimit = prev; }
    return this;
  }

  async _loadChunk(c) {
    if (this._resident.has(c)) return;
    const msgs = await this._src.chunkMessages(c, {
      lruLimit: this._lruLimit,
      onEvict: (dropped) => this._evictChunk(dropped),
    });
    if (this._resident.has(c)) return;               // raced with a prefetch
    const depthEnc = this._src.connections.get(this._depthConn)?.messageEncoding;
    const colorEnc = this._colorConn != null
      ? this._src.connections.get(this._colorConn)?.messageEncoding : null;
    const poseEnc  = this._poseConn != null
      ? this._src.connections.get(this._poseConn)?.messageEncoding : null;

    const depthIdx = this._depthByChunk.get(c) || [];
    const colorIdx = this._colorByChunk.get(c) || [];
    let di = 0, cidx = 0;
    for (const m of msgs) {
      if (m.conn === this._depthConn) {
        const gi = depthIdx[di++];
        if (gi === undefined) continue;
        try { this._frames[gi] = decodeMcapDepthImage(m.data, { messageEncoding: depthEnc }); }
        catch (err) { console.warn(`[scan-viewer] indexed depth frame ${gi} decode failed:`, err); }
      } else if (this._colorConn != null && m.conn === this._colorConn) {
        // The eager path pairs colour POSITIONALLY with depth
        // (colorFrames[k] ↔ depthFrames[k]); every ARACHNID recorder
        // writes the two streams in lock-step. The colour timeline index
        // IS that k, so store it straight at `gi`.
        const gi = colorIdx[cidx++];
        if (gi === undefined) continue;
        try {
          const raw = decodeMcapColorImage(m.data, { messageEncoding: colorEnc });
          this._colorImgs[gi] = colorImageToRGB(raw);
        } catch (err) {
          console.warn(`[scan-viewer] indexed colour frame ${gi} decode failed:`, err);
          this._colorImgs[gi] = null;
        }
      } else if (this._poseConn != null && m.conn === this._poseConn &&
                 !this._externalPoseTrack) {
        try {
          const p = decodeMcapPoseStamped(m.data, { messageEncoding: poseEnc });
          const key = `${p.timeMs}`;
          if (!this._poseSeen.has(key)) { this._poseSeen.add(key); this._poses.push(p); }
        } catch (_) { /* skip malformed pose */ }
      }
    }
    this._poses.sort((a, b) => a.timeMs - b.timeMs);
    this._resident.add(c);
    if (depthIdx.length) {
      await hydrateColorFrames(this._colorImgs, {
        range: [depthIdx[0], depthIdx[depthIdx.length - 1] + 1],
      });
    }
  }

  /** Drop every derived product of a chunk that fell out of the LRU. */
  _evictChunk(c) {
    if (!this._resident.has(c)) return;
    this._resident.delete(c);
    for (const gi of (this._depthByChunk.get(c) || [])) {
      this._frames[gi] = undefined;
      this._colorImgs[gi] = undefined;
      const pfx = `${gi}|`;
      for (const map of [this._cache, this._worldCache, this._colorCache, this._renderCache]) {
        if (!map) continue;
        for (const k of map.keys()) if (String(k).startsWith(pfx)) map.delete(k);
      }
    }
  }
}

/**
 * Build an IndexedScanViewer for `url`, or return null when the transport
 * can't do Range (caller falls back to the full-file path).
 */
async function loadIndexedMcap(url, { onProgress, fetchImpl, requestLog, source } = {}) {
  let src = source || null;
  if (!src) {
    try {
      src = await IndexedMcapSource.open(url, { fetchImpl, requestLog });
    } catch (e) {
      console.warn(`[scan-viewer] indexed mcap open threw (${e.message}) — full-file fallback`);
      return null;
    }
  }
  if (!src) return null;

  // Channel routing — schema name first, exactly like assembleFromMcap().
  const count = (id) => (src.chanTimeline.get(id) || []).length;
  const depthChans = [], colorChans = [], infoChans = [], poseChans = [], irChans = [], provChans = [], gravChans = [];
  for (const [id, c] of src.connections) {
    switch (c.msgType) {
      case MCAP_SCHEMA_DEPTH:       depthChans.push(id); break;
      case MCAP_SCHEMA_COLOR:       colorChans.push(id); break;
      case MCAP_SCHEMA_CAMERA_INFO: infoChans.push(id);  break;
      case MCAP_SCHEMA_POSE:        poseChans.push(id);  break;
      case MCAP_SCHEMA_IR_PAIR:     irChans.push(id);    break;
      case MCAP_SCHEMA_PROVENANCE:  provChans.push(id);  break;
      case MCAP_SCHEMA_GRAVITY:     gravChans.push(id);  break;
    }
  }
  if (depthChans.length === 0) {
    console.warn(`[scan-viewer] indexed mcap has no ${MCAP_SCHEMA_DEPTH} channel — full-file fallback`);
    return null;
  }
  const byCountDesc = (a, b) => count(b) - count(a);
  depthChans.sort(byCountDesc);
  colorChans.sort(byCountDesc);
  poseChans.sort(byCountDesc);
  const depthConn = depthChans[0];
  const colorConn = colorChans[0] ?? null;
  const poseConn  = poseChans[0]  ?? null;
  const depthTopic = src.connections.get(depthConn)?.topic || "";
  // Match the depth topic ITSELF, not its parent namespace. The old
  // depthTopic.replace(/\/[^/]+$/, "") gives "/d455", and the FIRST
  // CameraInfo starting with that wins -- registration order is lazy
  // and depends on which feed delivers first. Harmless while depth was
  // the only calibrated stream; a coin flip now that /d455/ir_pair can
  // carry its own camera_info, and the wrong fx silently deprojects
  // the whole cloud.
  const depthPrefix = depthTopic + "/";
  let infoConn = null;
  for (const id of infoChans) {
    const t = (src.connections ? src.connections.get(id) : connections.get(id))?.topic || "";
    if (t.startsWith(depthPrefix)) { infoConn = id; break; }
  }
  if (infoConn === null && infoChans.length > 0) infoConn = infoChans[0];

  // CameraInfo lives in whichever chunk holds its first message — load
  // that one now so intrinsics are ready before the first render.
  let intrinsics = null;
  if (infoConn !== null) {
    const tl = src.chanTimeline.get(infoConn) || [];
    if (tl.length) {
      try {
        const msgs = await src.chunkMessages(tl[0].chunk);
        const m = msgs.find((x) => x.conn === infoConn);
        if (m) {
          intrinsics = decodeMcapCameraInfo(m.data, {
            messageEncoding: src.connections.get(infoConn)?.messageEncoding });
        }
      } catch (e) {
        console.warn("[scan-viewer] indexed camera_info fetch failed:", e);
      }
    }
  }
  if (!intrinsics) {
    // No fallback, deliberately. This used to substitute iPad LiDAR
    // intrinsics (256x192, fx=215) and RENDER -- a scan deprojected
    // through another sensor's geometry looks like a plausible scene
    // and is wrong everywhere. build_mesh already throws on this;
    // the browser now agrees with the worker.
    throw new Error("no CameraInfo in this recording — refusing to deproject with substituted intrinsics (producer must emit camera_info; PIPELINE-DESIGN §2.3)");
  }

  const v = new IndexedScanViewer({ source: src, intrinsics, depthConn, colorConn, poseConn });
  console.info(`[scan-viewer] mcap load mode: INDEXED — ${v.frameCount} frames across ` +
               `${src.chunkCount} chunk(s), ${(src.fileSize / 1e6).toFixed(1)} MB on the wire ` +
               `left unfetched until scrubbed`);
  onProgress?.({ stage: "ready", pct: 1, format: "mcap", mode: "indexed",
                 frameCount: v.frameCount, poseCount: v._poses.length,
                 colorCount: v.hasColor ? v.frameCount : 0,
                 chunkCount: src.chunkCount });
  return v;
}

/**
 * Orchestrator: fetch a bag from `bagUrl` (presigned S3 URL or any
 * other CORS-allowed http URL), parse it, and return a `ScanViewer`
 * ready to feed `pc-renderer.js`.
 *
 * Format dispatch (per spec §3.3.1):
 *   1. Detect by URL extension (.bag → rosbag1, .mcap → mcap).
 *   2. Fall back to magic-byte sniff on the first 8 bytes if the
 *      extension is missing/unrecognized.
 *   3. Route to assembleFromRosbag1() or assembleFromMcap(). Both
 *      produce identical Frame contracts (intrinsics + depthFrames +
 *      poseFrames + colorFrames) so ScanViewer doesn't care which
 *      container the data came from.
 *
 * The rosbag1 path is unchanged from before MCAP — constraint C1
 * (32 existing scans must keep working forever).
 */
async function load(bagUrl, { onProgress, indexed = false, fetchImpl, requestLog } = {}) {
  if (typeof bagUrl !== "string" || !bagUrl.startsWith("http")) {
    throw new Error(`scan-viewer.load: expected http(s) URL, got ${bagUrl}`);
  }
  onProgress?.({ stage: "fetch", pct: 0 });

  // ─── Optional indexed (HTTP-Range) path ───
  // OFF by default: the current consumer (scan-inspect.js) reads frames
  // eagerly — it walks every `frame(i)` on load to build the accumulated
  // cloud — so returning a lazily-populated viewer from the default call
  // would silently render a partial map. Opt in with `{ indexed: true }`;
  // see the IndexedMcapSource block for the S3 CORS prerequisite and the
  // consumer changes needed to make it the default.
  if (indexed) {
    let looksMcap = false;
    try { looksMcap = detectFormat(bagUrl) === "mcap"; } catch (_) { looksMcap = false; }
    if (looksMcap) {
      const v = await loadIndexedMcap(bagUrl, { onProgress, fetchImpl, requestLog });
      if (v) return v;
      console.info("[scan-viewer] mcap load mode: FULL (indexed unavailable — see warning above)");
    } else {
      console.info("[scan-viewer] mcap load mode: FULL (indexed mode is mcap-only)");
    }
  }

  const doFetch = fetchImpl || ((u, o) => fetch(u, o));
  const r = await doFetch(bagUrl);
  if (!r.ok) throw new Error(`bag fetch failed: ${r.status} ${r.statusText}`);
  const total = +(r.headers.get("Content-Length") || 0);
  // Stream the body so we can show progress on big bags.
  const reader = r.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (total) onProgress?.({
      stage: "fetch",
      pct: received / total,
      receivedBytes: received,
      totalBytes: total,
    });
  }
  const buf = new Uint8Array(received);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  onProgress?.({ stage: "parse", pct: 0 });

  // ─── Format detection ───
  // Extension is authoritative (spec §2.1). If the URL has no extension
  // (rare for presigned S3 URLs but theoretically possible), fall through
  // to magic-byte sniff on the already-downloaded prefix.
  let fmt;
  try {
    fmt = detectFormat(bagUrl, buf.subarray(0, 16));
  } catch (_) {
    // Last-ditch: ask the bytes directly.
    if (isMcapMagic(buf)) fmt = "mcap";
    else if (new TextDecoder("ascii").decode(buf.subarray(0, 13)) === ROSBAG_MAGIC) fmt = "rosbag1";
    else throw new Error(`scan-viewer: could not determine format of "${bagUrl}"`);
  }

  // Telemetry (spec §5.17) — fire-and-forget; window.analytics may not
  // exist. Used to monitor Phase 2/3 rollout.
  try {
    const a = (typeof window !== "undefined") ? window.analytics : null;
    if (a && typeof a.event === "function") a.event("scan_format_loaded", { format: fmt });
  } catch (_) { /* ignore telemetry failure */ }

  let assembled;
  if (fmt === "mcap") {
    assembled = assembleFromMcap(buf, { onProgress });
  } else {
    assembled = assembleFromRosbag1(buf, { onProgress });
  }

  // JPEG colour frames arrive from assembly as PENDING (compressed bytes,
  // no pixels) because the platform image decoder is async. Resolve them
  // before handing the viewer over so `hasColor`/`colorImageFor` mean the
  // same thing they always did. Hosts without createImageBitmap (Node)
  // leave the frames pending — every consumer guards on `.rgb`.
  await hydrateColorFrames(assembled.colorFrames, { onProgress });
  // Same reason, same shape: IrPair payloads are PNG and the platform
  // decoder is async, so resolve them before irPairFor() can be called.
  await hydrateIrPairs(assembled.irPairs);

  onProgress?.({ stage: "ready", pct: 1,
                 format:     fmt,
                 frameCount: assembled.depthFrames.length,
                 poseCount:  assembled.poseFrames.length,
                 colorCount: assembled.colorFrames.length });
  return new ScanViewer(assembled);
}

/**
 * Walk a rosbag1 buffer and produce the assembled-frames object that
 * the ScanViewer constructor expects. This is the legacy / authoritative
 * path used by all 32 existing scans on S3 — kept structurally identical
 * to the pre-MCAP load() so behaviour is byte-for-byte preserved.
 */
function assembleFromRosbag1(buf, { onProgress } = {}) {
  const { connections, messages } = parseBag(buf.buffer);

  // Normalise msgtype across ROS 1 / ROS 2 namespace styles.
  // The iPad-emitted bags use ROS 1 form ("sensor_msgs/Image"), but
  // the GCP pipeline's scan-preview.bag is written by rosbags which
  // canonicalises to ROS 2 form ("sensor_msgs/msg/Image"). Strip the
  // optional middle "/msg/" segment so the equality checks below
  // accept either style.
  const normMsgType = (t) => String(t || "").replace("/msg/", "/");

  // Find the connections we care about.
  let depthConn = null, infoConn = null, poseConn = null, colorConn = null;
  for (const [id, c] of connections) {
    if (c.topic === DEPTH_TOPIC)       depthConn = id;
    if (c.topic === CAMERA_INFO_TOPIC) infoConn  = id;
    const mt = normMsgType(c.msgType);
    // Pose/color sensor index depends on which other streams are on.
    // The pose topic ends in `Pose_0/pose/transform/data`; color in
    // `Color_0/image/data`. Match by suffix + msgType so we don't
    // confuse them with `tf/N` transform topics or metadata topics.
    if (c.topic.endsWith(POSE_TOPIC_SUFFIX) &&
        mt === "geometry_msgs/Transform") poseConn = id;
    if (c.topic.endsWith(COLOR_TOPIC_SUFFIX) &&
        mt === "sensor_msgs/Image")        colorConn = id;
  }
  if (depthConn === null) throw new Error(`bag has no ${DEPTH_TOPIC}`);

  // CameraInfo: take the FIRST one (intrinsics don't change per frame
  // for our recorder, but the bag emits one per frame anyway).
  let intrinsics = null;
  if (infoConn !== null) {
    const m = messages.find(x => x.conn === infoConn);
    if (m) {
      intrinsics = decodeCameraInfo(m.data);
    }
  }
  if (!intrinsics) {
    // No fallback, deliberately. This used to substitute iPad LiDAR
    // intrinsics (256x192, fx=215) and RENDER -- a scan deprojected
    // through another sensor's geometry looks like a plausible scene
    // and is wrong everywhere. build_mesh already throws on this;
    // the browser now agrees with the worker.
    throw new Error("no CameraInfo in this recording — refusing to deproject with substituted intrinsics (producer must emit camera_info; PIPELINE-DESIGN §2.3)");
  }

  // Decode all depth frames.
  const depthFrames = [];
  const depthMessages = [];
  let i = 0;
  for (const m of messages) {
    if (m.conn !== depthConn) continue;
    try {
      depthFrames.push(decodeImage(m.data));
      depthMessages.push(m);
    } catch (e) {
      console.warn(`[scan-viewer] frame ${i} decode failed:`, e);
    }
    i++;
    if (onProgress && i % 30 === 0) {
      onProgress({ stage: "decode", pct: i / Math.max(1, messages.length) });
    }
  }

  if (depthFrames.length === 0) throw new Error("bag had 0 depth frames");

  // Decode pose frames if present (used for world-frame accumulated
  // cloud + per-frame highlight in the INSPECT panel). Failures here
  // are non-fatal — the viewer falls back to camera-frame rendering.
  let poseFrames = [];
  if (poseConn !== null) {
    for (const m of messages) {
      if (m.conn !== poseConn) continue;
      try {
        const t = decodeTransform(m.data);
        poseFrames.push({ ...t, timeMs: m.timeMs });
      } catch (e) { /* skip malformed pose */ }
    }
  }

  // Sanity-check poses: librealsense bags from the iPad recorder
  // sometimes contain garbage Transform bytes (translation in the
  // 1e28 range, zero quaternion) when tracking wasn't yet stable.
  // Drop the whole pose array if it looks broken; downstream
  // worldFrame() then falls through to camera-frame rendering.
  poseFrames = sanityCheckPoses(poseFrames);

  // Decode color frames if present. The recorder writes color at depth
  // resolution (256×192 BGRA8 on iPad; depth-aligned on D455 via
  // rs2_align), so each color image pairs by index with the
  // same-position depth frame. Failures are non-fatal — the viewer
  // falls back to the depth heatmap.
  const colorImgs = [];
  if (colorConn !== null) {
    let ci = 0;
    for (const m of messages) {
      if (m.conn !== colorConn) continue;
      try {
        const raw = decodeImage(m.data);
        const rgb = colorImageToRGB(raw);
        colorImgs.push(rgb);   // may be null for unknown encoding
      } catch (e) {
        console.warn(`[scan-viewer] color frame ${ci} decode failed:`, e);
        colorImgs.push(null);
      }
      ci++;
    }
    // Trim trailing nulls so hasColor reflects real data
    while (colorImgs.length && colorImgs[colorImgs.length - 1] === null) {
      colorImgs.pop();
    }
  }

  return {
    intrinsics,
    depthFrames,
    depthMessages,
    poseFrames,
    colorFrames: colorImgs,
  };
}

/**
 * Walk an MCAP buffer and produce the assembled-frames object that the
 * ScanViewer constructor expects. Mirrors assembleFromRosbag1()'s output
 * shape exactly so the constructor stays format-agnostic.
 *
 * Topic routing follows spec §3.3: **schema name first, namespace second.**
 * That means depth comes from any channel with schema
 * `arachnid.sensor.DepthImage`, regardless of whether the topic is
 * `/d455/depth` (Orin) or `/ipad/lidar/depth` (iPad). When multiple
 * candidates exist (future merged Orin+iPad scan), we pick the channel
 * with the most messages as the primary depth stream.
 *
 * CameraInfo routing pairs by depth-topic prefix where possible, so a
 * future combined scan still associates the right intrinsics with the
 * right depth stream.
 */
function assembleFromMcap(buf, { onProgress } = {}) {
  const { connections, messages } = parseMcap(buf.buffer);

  // Count messages per channel — used to pick the primary depth stream
  // when more than one is present. Linear single pass.
  const msgCount = new Map();
  for (const m of messages) {
    msgCount.set(m.conn, (msgCount.get(m.conn) || 0) + 1);
  }

  // Collect channels by schema name.
  const depthChans = [];
  const colorChans = [];
  const infoChans  = [];
  const poseChans  = [];
  const irChans    = [];
  const provChans  = [];
  const gravChans  = [];
  for (const [id, c] of connections) {
    switch (c.msgType) {
      case MCAP_SCHEMA_DEPTH:       depthChans.push(id); break;
      case MCAP_SCHEMA_COLOR:       colorChans.push(id); break;
      case MCAP_SCHEMA_CAMERA_INFO: infoChans.push(id);  break;
      case MCAP_SCHEMA_POSE:        poseChans.push(id);  break;
      case MCAP_SCHEMA_IR_PAIR:     irChans.push(id);    break;
      case MCAP_SCHEMA_PROVENANCE:  provChans.push(id);  break;
      case MCAP_SCHEMA_GRAVITY:     gravChans.push(id);  break;
    }
  }
  if (depthChans.length === 0) {
    throw new Error(`mcap has no ${MCAP_SCHEMA_DEPTH} channel`);
  }

  // Sort by frame count desc → pick primary.
  const byCountDesc = (a, b) => (msgCount.get(b) || 0) - (msgCount.get(a) || 0);
  depthChans.sort(byCountDesc);
  colorChans.sort(byCountDesc);
  const depthConn = depthChans[0];
  const colorConn = colorChans[0] ?? null;
  // Topic for the chosen depth stream — used to disambiguate which
  // camera_info / pose / color channels pair with it.
  const depthTopic     = connections.get(depthConn)?.topic || "";
  const depthNamespace = depthTopic.replace(/\/[^/]+$/, "");      // strip trailing /depth

  // CameraInfo: prefer the one whose topic shares the depth's namespace
  // (e.g. /d455/depth/camera_info pairs with /d455/depth). Fall back to
  // any CameraInfo if no namespace match.
  let infoConn = null;
  for (const id of infoChans) {
    const t = connections.get(id)?.topic || "";
    if (depthNamespace && t.startsWith(depthNamespace)) { infoConn = id; break; }
  }
  if (infoConn === null && infoChans.length > 0) infoConn = infoChans[0];

  // Pose: per spec §1.1 the pose topic is `/arkit/pose` (Orin-relayed)
  // or `/ipad/arkit/pose` (iPad standalone). Take whichever has the most
  // messages — we don't enforce a particular topic, since spec §3.3
  // says route by schema name first.
  poseChans.sort(byCountDesc);
  const poseConn = poseChans[0] ?? null;

  // Per-channel payload encoding (§1.3). Passed into every decoder so the
  // dispatcher can pick CDR vs JSON by (schema name, message_encoding)
  // instead of guessing from the bytes.
  const encOf = (id) => (id == null ? undefined : connections.get(id)?.messageEncoding);
  const depthEnc = encOf(depthConn);
  const colorEnc = encOf(colorConn);
  const infoEnc  = encOf(infoConn);
  const poseEnc  = encOf(poseConn);

  // Decode CameraInfo.
  let intrinsics = null;
  if (infoConn !== null) {
    const m = messages.find(x => x.conn === infoConn);
    if (m) {
      try {
        intrinsics = decodeMcapCameraInfo(m.data, { messageEncoding: infoEnc });
      } catch (e) {
        console.warn("[scan-viewer] mcap camera_info decode failed:", e);
      }
    }
  }
  if (!intrinsics) {
    // No fallback, deliberately. This used to substitute iPad LiDAR
    // intrinsics (256x192, fx=215) and RENDER -- a scan deprojected
    // through another sensor's geometry looks like a plausible scene
    // and is wrong everywhere. build_mesh already throws on this;
    // the browser now agrees with the worker.
    throw new Error("no CameraInfo in this recording — refusing to deproject with substituted intrinsics (producer must emit camera_info; PIPELINE-DESIGN §2.3)");
  }

  // Decode depth frames.
  const depthFrames   = [];
  const depthMessages = [];
  let i = 0;
  for (const m of messages) {
    if (m.conn !== depthConn) continue;
    try {
      depthFrames.push(decodeMcapDepthImage(m.data, { messageEncoding: depthEnc }));
      depthMessages.push(m);
    } catch (e) {
      console.warn(`[scan-viewer] mcap frame ${i} decode failed:`, e);
    }
    i++;
    if (onProgress && i % 30 === 0) {
      onProgress({ stage: "decode", pct: i / Math.max(1, messages.length) });
    }
  }
  if (depthFrames.length === 0) throw new Error("mcap had 0 depth frames");

  // Decode pose frames.
  let poseFrames = [];
  if (poseConn !== null) {
    for (const m of messages) {
      if (m.conn !== poseConn) continue;
      try {
        const p = decodeMcapPoseStamped(m.data, { messageEncoding: poseEnc });
        // decodeMcapPoseStamped already sets p.timeMs from timestamp_ns
        // in the message body (spec §5.13 — wall-clock ns). Override the
        // outer m.timeMs in case the producer's log_time differs.
        poseFrames.push(p);
      } catch (e) { /* skip malformed pose */ }
    }
  }
  poseFrames = sanityCheckPoses(poseFrames);

  // Decode color frames.
  const colorImgs = [];
  if (colorConn !== null) {
    let ci = 0;
    for (const m of messages) {
      if (m.conn !== colorConn) continue;
      try {
        const raw = decodeMcapColorImage(m.data, { messageEncoding: colorEnc });
        const rgb = colorImageToRGB(raw);
        colorImgs.push(rgb);
      } catch (e) {
        console.warn(`[scan-viewer] mcap color frame ${ci} decode failed:`, e);
        colorImgs.push(null);
      }
      ci++;
    }
    while (colorImgs.length && colorImgs[colorImgs.length - 1] === null) {
      colorImgs.pop();
    }
  }

  // Stereo pairs, paired POSITIONALLY with depth exactly as colour is --
  // the recorder writes both off the same tick. Left undecoded here on
  // purpose: PNG decoding is async, so load() runs hydrateIrPairs() before
  // handing the viewer over, mirroring hydrateColorFrames().
  const irPairs = [];
  const irConn = irChans[0] ?? null;
  if (irConn !== null) {
    const irEnc = encOf(irConn);
    let ii = 0;
    for (const m of messages) {
      if (m.conn !== irConn) continue;
      try {
        irPairs.push(decodeMcapIrPair(m.data, { messageEncoding: irEnc }));
      } catch (e) {
        console.warn(`[scan-viewer] mcap IR pair ${ii} decode failed:`, e);
        irPairs.push(null);
      }
      ii++;
    }
  }

  // Provenance: if this file was salvaged, say so LOUDLY and attach the
  // record. A recovered file may end mid-scene; nothing downstream should
  // treat its completeness as a fact.
  let provenance = null;
  let gravity = null;
  const gravConn = gravChans[0] ?? null;
  if (gravConn !== null) {
    for (const m of messages) {
      if (m.conn !== gravConn) continue;
      try { gravity = JSON.parse(new TextDecoder().decode(m.data)); } catch (_) {}
      break;
    }
  }
  const provConn = provChans[0] ?? null;
  if (provConn !== null) {
    for (const m of messages) {
      if (m.conn !== provConn) continue;
      try {
        provenance = JSON.parse(new TextDecoder().decode(m.data));
        console.warn(`[scan-viewer] SALVAGED RECORDING: recovered ` +
          `${provenance.messages_recovered} msgs from ${provenance.source} ` +
          `(${provenance.bytes_lost} bytes lost) — content may end mid-scene`);
      } catch (_) { /* a malformed provenance record is not fatal */ }
      break;
    }
  }

  return {
    intrinsics,
    depthFrames,
    depthMessages,
    poseFrames,
    colorFrames: colorImgs,
    irPairs,
    provenance,
    gravity,
  };
}

/** Drop poses that look like librealsense's "pre-tracking" garbage
 *  (translation in the 1e28 range, zero quaternion). Returns the array
 *  unchanged if it passes the sanity check, or an empty array otherwise.
 *  Shared between the rosbag1 and MCAP assembly paths. */
function sanityCheckPoses(poseFrames) {
  if (poseFrames.length === 0) return poseFrames;
  const p = poseFrames[0];
  const tMag = Math.hypot(p.tx, p.ty, p.tz);
  const qMag = Math.hypot(p.qx, p.qy, p.qz, p.qw);
  if (!Number.isFinite(tMag) || tMag > 1e6 || qMag < 0.5 || qMag > 1.5) {
    console.warn(`[scan-viewer] poses look bogus (|t|=${tMag.toExponential(1)}, |q|=${qMag.toFixed(3)}) — disabling world-frame transform`);
    return [];
  }
  // Spread test (gate check G11). A first-sample test passes an
  // identity-at-origin track cleanly (|t|=0, |q|=1), and that is exactly
  // what a whole generation of scans contains: writers emitted
  // position/Euler while this reader decodes translation/quaternion, so
  // every field fell through to its default. A track with ~zero
  // translation spread AND all-identity rotations carries no information
  // -- fusing frames through it sums the scan at the origin. Ten or more
  // samples so a genuinely stationary two-pose scan is not rejected.
  if (poseFrames.length >= 10) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity,
        minZ = Infinity, maxZ = -Infinity, maxRot = 0;
    for (const f of poseFrames) {
      if (f.tx < minX) minX = f.tx; if (f.tx > maxX) maxX = f.tx;
      if (f.ty < minY) minY = f.ty; if (f.ty > maxY) maxY = f.ty;
      if (f.tz < minZ) minZ = f.tz; if (f.tz > maxZ) maxZ = f.tz;
      const rot = Math.hypot(f.qx, f.qy, f.qz);   // 0 for identity
      if (rot > maxRot) maxRot = rot;
    }
    const spread = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ);
    if (spread < 1e-6 && maxRot < 1e-6) {
      console.warn(`[scan-viewer] pose track is ${poseFrames.length} identical identity poses — a decode-to-defaults artifact, not a trajectory. Disabling world-frame transform.`);
      return [];
    }
  }
  return poseFrames;
}

// Export for both ES-module and global usage.
const ScanViewerNS = {
  load, parseBag, parseMcap,
  decodeImage, decodeCameraInfo, decodeTransform, colorImageToRGB,
  decodeMcapDepthImage, decodeMcapColorImage, decodeMcapImu,
  decodeMcapCameraInfo, decodeMcapPoseStamped,
  decodeArachnidPayload, hydrateColorFrames, decodeJpegToRGB,
  decodeMcapIrPair, hydrateIrPairs,
  deproject, lz4DecompressFrame,
  detectFormat, isMcapMagic,
  ScanViewer, IndexedScanViewer, IndexedMcapSource, loadIndexedMcap,
};
if (typeof window !== "undefined") {
  window.ScanViewer = ScanViewerNS;
}
export {
  ScanViewerNS as default,
  load, parseBag, parseMcap,
  decodeImage, decodeCameraInfo, decodeTransform, colorImageToRGB,
  decodeMcapDepthImage, decodeMcapColorImage, decodeMcapImu,
  decodeMcapCameraInfo, decodeMcapPoseStamped,
  decodeArachnidPayload, hydrateColorFrames, decodeJpegToRGB,
  decodeMcapIrPair, hydrateIrPairs,
  deproject, lz4DecompressFrame,
  detectFormat, isMcapMagic,
  ScanViewer, IndexedScanViewer, IndexedMcapSource, loadIndexedMcap,
};

import * as THREE from './vendor/three.module.js';
import { SplatMesh } from './vendor/spark.module.js';

function abortError(signal) {
  return signal?.reason instanceof Error ? signal.reason : new DOMException('Scene loading was cancelled.', 'AbortError');
}
function checkAbort(signal) { if (signal?.aborted) throw abortError(signal); }
function validateManifest(manifest) {
  const vector = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
  if (!manifest || manifest.encoding !== 'gzip' || !Number.isSafeInteger(manifest.count) || manifest.count < 1
    || manifest.source?.vertices !== manifest.count || !Number.isSafeInteger(manifest.source?.bytes) || manifest.source.bytes < 1
    || !Number.isInteger(manifest.shDegree) || manifest.shDegree < 0 || manifest.shDegree > 3
    || !Number.isSafeInteger(manifest.compressedBytes) || manifest.compressedBytes < 1
    || !Array.isArray(manifest.chunks) || !manifest.chunks.length
    || manifest.chunks.some(chunk => typeof chunk.url !== 'string' || !chunk.url || !Number.isSafeInteger(chunk.bytes) || chunk.bytes < 1)
    || manifest.chunks.reduce((sum, chunk) => sum + chunk.bytes, 0) !== manifest.compressedBytes
    || !vector(manifest.transform?.sourceCenter) || !Number.isFinite(manifest.transform?.scale) || manifest.transform.scale <= 0
    || !Array.isArray(manifest.transform?.rotation) || manifest.transform.rotation.length !== 9 || !manifest.transform.rotation.every(Number.isFinite)
    || !vector(manifest.bounds?.min) || !vector(manifest.bounds?.max)) throw new Error('The original splat manifest is invalid.');
  return manifest;
}

/** Load every original Gaussian from lossless gzip PLY transport. No voxelization. */
export async function createSnowGlobe({ assetPrefix = 'snow-globe', signal, onProgress } = {}) {
  checkAbort(signal);
  if (typeof assetPrefix !== 'string' || !/^[a-z0-9][a-z0-9_-]*$/i.test(assetPrefix)) throw new Error('The scene asset prefix is invalid.');
  if (typeof DecompressionStream !== 'function') throw new Error('This browser cannot decode the original compressed splats.');
  const controller = new AbortController();
  const abort = () => controller.abort(abortError(signal));
  signal?.addEventListener('abort', abort, { once:true });
  let mesh = null, chunkReader = null, decodedReader = null, finished = false;
  let downloaded = 0, decoded = 0, streamError = null, progressValue = 0, lastReport = 0, lastStage = '';
  const report = (stage, loaded, total, progress, force = false) => {
    progressValue = Math.max(progressValue, Math.min(1, progress));
    const now = performance.now();
    if (force || stage !== lastStage || now - lastReport > 100) {
      lastReport = now; lastStage = stage;
      onProgress?.({ stage, loaded, total, progress:progressValue });
    }
  };
  try {
    report('metadata', 0, 1, 0, true);
    const manifestURL = new URL(`./assets/${assetPrefix}-splats.json`, import.meta.url);
    const response = await fetch(manifestURL, { signal:controller.signal });
    if (!response.ok) throw new Error(`Could not load the original splat manifest (HTTP ${response.status}).`);
    const manifest = validateManifest(await response.json());
    checkAbort(signal);
    let chunkIndex = 0, chunkBytes = 0;
    const compressed = new ReadableStream({
      async pull(output) {
        try {
          while (true) {
            checkAbort(controller.signal);
            if (!chunkReader) {
              if (chunkIndex >= manifest.chunks.length) { output.close(); return; }
              const part = await fetch(new URL(manifest.chunks[chunkIndex].url, manifestURL), { signal:controller.signal });
              if (!part.ok || !part.body) throw new Error(`Could not load splat part ${chunkIndex + 1} (HTTP ${part.status}).`);
              chunkReader = part.body.getReader(); chunkBytes = 0;
            }
            const next = await chunkReader.read();
            if (next.done) {
              chunkReader.releaseLock(); chunkReader = null;
              if (chunkBytes !== manifest.chunks[chunkIndex].bytes) throw new Error('An original splat download is incomplete.');
              chunkIndex++; continue;
            }
            chunkBytes += next.value.byteLength;
            if (chunkBytes > manifest.chunks[chunkIndex].bytes) throw new Error('An original splat download has an unexpected size.');
            downloaded += next.value.byteLength;
            report('download', downloaded, manifest.compressedBytes, 0.03 + 0.82 * downloaded / manifest.compressedBytes);
            output.enqueue(next.value); return;
          }
        } catch (error) { output.error(error); }
      },
      async cancel(reason) {
        controller.abort(reason);
        await chunkReader?.cancel(reason).catch(() => {});
      }
    }, { highWaterMark:1 });
    decodedReader = compressed.pipeThrough(new DecompressionStream('gzip')).getReader();
    let inputController;
    // Spark's asynchronous status reader does not catch read rejection. Deliver
    // EOF on a transport failure and report the original error after decoding ends.
    const input = new ReadableStream({
      start(output) { inputController = output; },
      async pull(output) {
        try {
          checkAbort(controller.signal);
          const next = await decodedReader.read();
          if (next.done) { finished = true; output.close(); return; }
          decoded += next.value.byteLength;
          if (decoded > manifest.source.bytes) throw new Error('The decoded PLY is larger than its original source.');
          output.enqueue(next.value);
        } catch (error) {
          streamError = error; finished = true; output.close();
          await decodedReader.cancel(error).catch(() => {});
        }
      },
      async cancel(reason) {
        controller.abort(reason);
        await decodedReader.cancel(reason).catch(() => {});
      }
    }, { highWaterMark:0 });
    mesh = new SplatMesh({
      stream:input, streamLength:manifest.source.bytes, fileName:`${assetPrefix}.ply`,
      extSplats:true, lod:false, enableLod:false, nonLod:true, editable:false, raycastable:false,
      onProgress(event) {
        if (downloaded === manifest.compressedBytes) report('decode', event.loaded || decoded, manifest.source.bytes, 0.9);
      }
    });
    try { await mesh.initialized; }
    catch (error) { throw signal?.aborted ? abortError(signal) : streamError || error; }
    checkAbort(signal);
    if (streamError) throw streamError;
    // Verify the gzip trailer even when the PLY reader stops at its declared count.
    while (!finished) {
      const next = await decodedReader.read();
      if (next.done) { finished = true; inputController.close(); break; }
      decoded += next.value.byteLength;
    }
    if (decoded !== manifest.source.bytes || downloaded !== manifest.compressedBytes) throw new Error('The decoded splat file does not match its original byte length.');
    if (mesh.numSplats !== manifest.count) throw new Error(`Expected ${manifest.count} original splats; decoded ${mesh.numSplats}.`);
    if (mesh.extSplats?.getNumSh() !== manifest.shDegree) throw new Error('The decoded splat file is missing original spherical harmonic bands.');
    mesh.maxSh = 3; mesh.enableLod = false; mesh.updateGenerator();
    const r = manifest.transform.rotation;
    const rotation = new THREE.Matrix4().set(r[0],r[1],r[2],0,r[3],r[4],r[5],0,r[6],r[7],r[8],0,0,0,0,1);
    mesh.quaternion.setFromRotationMatrix(rotation);
    mesh.scale.setScalar(manifest.transform.scale);
    mesh.position.set(...manifest.transform.sourceCenter).applyMatrix4(rotation).multiplyScalar(-manifest.transform.scale);
    mesh.name = `${assetPrefix}-original-splats`;
    const group = new THREE.Group(); group.name = assetPrefix; group.add(mesh);
    group.userData.representation = 'gaussian-splats'; group.userData.splatCount = mesh.numSplats;
    let disposed = false;
    const result = {
      group, mesh,
      metadata:{ ...manifest, assetPrefix, count:mesh.numSplats, renderedCount:mesh.numSplats, representation:'gaussian-splats', gpuEncoding:'Spark ExtSplats' },
      restore() {
        if (disposed) return;
        mesh.extSplats.needsUpdate = true;
        for (const texture of mesh.extSplats.textures || []) texture.needsUpdate = true;
        for (const value of Object.values(mesh.extSplats.extra || {})) if (value?.value?.isTexture) value.value.needsUpdate = true;
        mesh.updateGenerator(); mesh.updateVersion();
      },
      dispose() {
        if (disposed) return;
        disposed = true; group.removeFromParent(); group.clear(); mesh.dispose();
      }
    };
    try { report('ready', mesh.numSplats, mesh.numSplats, 1, true); checkAbort(signal); return result; }
    catch (error) { result.dispose(); mesh = null; throw error; }
  } catch (error) {
    mesh?.dispose();
    throw signal?.aborted ? abortError(signal) : error;
  } finally {
    signal?.removeEventListener('abort', abort);
    if (!finished) controller.abort();
    await decodedReader?.cancel().catch(() => {});
    decodedReader?.releaseLock();
    await chunkReader?.cancel().catch(() => {});
    chunkReader?.releaseLock();
  }
}

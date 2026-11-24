import * as THREE from './vendor/three.module.js';

const VERTEX = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const FRAGMENT = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uSource;
  uniform vec2 uSourceSize;
  uniform float uBrightness, uGlow, uContrast, uGrid, uRefraction;

  vec3 sampleLight(vec2 uv) {
    return texture2D(uSource, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
  }
  vec3 bright(vec2 uv) {
    vec3 color = sampleLight(uv);
    return color * smoothstep(0.055, 0.48, max(color.r, max(color.g, color.b)));
  }
  vec3 encodeSRGB(vec3 color) {
    color = clamp(color, 0.0, 1.0);
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), color));
  }
  void main() {
    vec2 texel = 1.0 / uSourceSize;
    vec2 lensCell = fract(vUv * vec2(20.0, 12.5)) * 2.0 - 1.0;
    float bevel = smoothstep(0.3, 1.0, max(abs(lensCell.x), abs(lensCell.y)));
    vec2 uv = vUv + lensCell * texel * uRefraction * (0.25 + 1.6 * bevel);
    vec3 signal = pow(max(sampleLight(uv), vec3(0.0)), vec3(uContrast));

    // Square phosphor apertures stay subtle at thumbnail sizes.
    vec2 cells = fract(vUv * (uSourceSize * 0.5));
    vec2 edge = min(cells, 1.0 - cells);
    float aperture = smoothstep(0.04, 0.17, min(edge.x, edge.y));
    float mask = mix(1.0, 0.40 + 0.60 * aperture, uGrid);
    vec3 color = signal * mask * uBrightness;
    color += vec3(0.0014, 0.0034, 0.0031) * aperture * uGrid;

    // Fixed source-pixel offsets keep the glow stable across card and PNG sizes.
    vec2 nearStep = texel * 1.2;
    vec2 farStep = texel * 2.6;
    vec3 glow = bright(uv) * 0.20;
    glow += (bright(uv + vec2(nearStep.x, 0.0)) + bright(uv - vec2(nearStep.x, 0.0))
           + bright(uv + vec2(0.0, nearStep.y)) + bright(uv - vec2(0.0, nearStep.y))) * 0.11;
    glow += (bright(uv + nearStep) + bright(uv - nearStep)
           + bright(uv + vec2(nearStep.x, -nearStep.y)) + bright(uv + vec2(-nearStep.x, nearStep.y))) * 0.055;
    glow += (bright(uv + vec2(farStep.x, 0.0)) + bright(uv - vec2(farStep.x, 0.0))
           + bright(uv + vec2(0.0, farStep.y)) + bright(uv - vec2(0.0, farStep.y))) * 0.035;
    color += glow * uGlow * uBrightness * 0.45;

    float reflection = pow(max(0.0, 1.0 - abs(vUv.x + vUv.y * 0.6 - 0.9) * 2.8), 10.0);
    color += vec3(0.0015, 0.0026, 0.0025) * reflection;
    vec2 q = abs(vUv * uSourceSize - uSourceSize * 0.5) - (uSourceSize * 0.5 - 5.0);
    float roundedEdge = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 5.0;
    float alpha = 1.0 - smoothstep(-0.5, 0.5, roundedEdge);
    // Explicit encoding is shared by the screen and raw RGBA export target.
    gl_FragColor = vec4(encodeSRGB(color), alpha);
  }
`;

const clamp = (value, min, max, fallback) => Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Number(value))) : fallback;

function createSourceTexture(source) {
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function isEntryVisible(element) {
  if (element.isConnected === false || element.closest('[hidden]')) return false;
  // WebKit can report non-zero boxes for content inside a closed disclosure.
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.tagName === 'DETAILS' && !ancestor.open) {
      const summary = Array.from(ancestor.children).find(child => child.tagName === 'SUMMARY');
      if (!summary?.contains(element)) return false;
    }
  }
  if (typeof element.checkVisibility === 'function') {
    try { return element.checkVisibility({ checkVisibilityCSS: true, checkOpacity: true }); }
    catch { /* Older engines fall through to the computed-style check. */ }
  }
  const ownStyle = getComputedStyle(element);
  if (ownStyle.visibility === 'hidden' || ownStyle.visibility === 'collapse') return false;
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    const style = getComputedStyle(ancestor);
    if (style.display === 'none' || Number(style.opacity) === 0) return false;
  }
  return true;
}

/** One GPU context for every widget, with DOM input controls layered above it. */
export function createBenchRenderer(canvas, entries, initialOptics = {}) {
  const entryIds = new Set();
  for (const entry of entries) {
    if (!entry?.id || !entry.element || !entry.source || entryIds.has(entry.id)) {
      throw new Error('Each component preview needs a unique id, element, and source canvas.');
    }
    entryIds.add(entry.id);
  }
  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: true, powerPreference: 'high-performance',
    preserveDrawingBuffer: true
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = false;
  renderer.setClearColor(0x000000, 0);
  let destroyed = false, contextLost = false, frame = 0;
  let width = 1, height = 1, pixelRatio = 1;
  const views = new Map();
  for (const entry of entries) {
    const texture = createSourceTexture(entry.source);
    views.set(entry.id, { ...entry, texture, sourceWidth: entry.source.width, sourceHeight: entry.source.height });
  }
  const uniforms = {
    uSource: { value: null }, uSourceSize: { value: new THREE.Vector2(320, 200) },
    uBrightness: { value: 1 }, uGlow: { value: 0.25 }, uContrast: { value: 1.1 },
    uGrid: { value: 0.35 }, uRefraction: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 1;
  scene.add(new THREE.Mesh(geometry, material));

  function updateSize() {
    const rect = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(rect.width));
    const nextHeight = Math.max(1, Math.round(rect.height));
    const nextRatio = Math.min(window.devicePixelRatio || 1, 2);
    if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) return rect;
    width = nextWidth; height = nextHeight; pixelRatio = nextRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    return rect;
  }
  function updateTexture(view) {
    if (view.sourceWidth !== view.source.width || view.sourceHeight !== view.source.height) {
      view.texture.dispose();
      view.texture = createSourceTexture(view.source);
      view.sourceWidth = view.source.width; view.sourceHeight = view.source.height;
    }
    view.texture.needsUpdate = true;
  }
  function useView(view) {
    if (view.sourceWidth !== view.source.width || view.sourceHeight !== view.source.height) updateTexture(view);
    uniforms.uSource.value = view.texture;
    uniforms.uSourceSize.value.set(view.source.width || 320, view.source.height || 200);
  }
  function render() {
    frame = 0;
    if (destroyed || contextLost || document.hidden) return;
    const canvasRect = updateSize();
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, width, height);
    renderer.clear(true, true, true);
    renderer.setScissorTest(true);
    let visibleCount = 0;
    for (const view of views.values()) {
      if (!isEntryVisible(view.element)) continue;
      const rect = view.element.getBoundingClientRect();
      const left = rect.left - canvasRect.left, top = rect.top - canvasRect.top;
      const right = left + rect.width, bottom = top + rect.height;
      if (rect.width <= 0 || rect.height <= 0 || right <= 0 || bottom <= 0 || left >= width || top >= height) continue;
      const clipLeft = Math.max(0, left), clipTop = Math.max(0, top);
      const clipRight = Math.min(width, right), clipBottom = Math.min(height, bottom);
      // Keep the full viewport even when part of the preview has scrolled away.
      renderer.setViewport(left, height - bottom, rect.width, rect.height);
      renderer.setScissor(clipLeft, height - clipBottom, clipRight - clipLeft, clipBottom - clipTop);
      useView(view);
      renderer.render(scene, camera);
      visibleCount++;
    }
    renderer.setScissorTest(false);
    canvas.dataset.visiblePreviews = String(visibleCount);
  }
  function requestDraw() {
    if (!frame && !destroyed && !contextLost && !document.hidden) frame = requestAnimationFrame(render);
  }
  function invalidate(id) {
    if (destroyed) return;
    if (id === undefined) for (const view of views.values()) updateTexture(view);
    else if (views.has(id)) updateTexture(views.get(id));
    requestDraw();
  }
  function setOptics(optics = {}) {
    uniforms.uBrightness.value = clamp(optics.brightness, 20, 200, 100) / 100;
    uniforms.uGlow.value = clamp(optics.glow, 0, 150, 25) / 100;
    uniforms.uContrast.value = clamp(optics.contrast, 50, 220, 110) / 100;
    uniforms.uGrid.value = clamp(optics.grid, 0, 100, 35) / 100;
    uniforms.uRefraction.value = clamp(optics.refraction, 0, 100, 0) / 100;
    requestDraw();
  }
  async function exportPNG(id) {
    const view = views.get(id);
    if (!view) throw new Error('This component preview is unavailable.');
    if (destroyed || contextLost) throw new Error('The graphics connection is unavailable.');
    const exportWidth = 1024, exportHeight = 640;
    const target = new THREE.WebGLRenderTarget(exportWidth, exportHeight, {
      type: THREE.UnsignedByteType, format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
      depthBuffer: false, stencilBuffer: false
    });
    const pixels = new Uint8Array(exportWidth * exportHeight * 4);
    try {
      updateTexture(view);
      renderer.setRenderTarget(target);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, exportWidth, exportHeight);
      renderer.clear(true, false, false);
      useView(view);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, exportWidth, exportHeight, pixels);
    } finally {
      renderer.setRenderTarget(null);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, width, height);
      target.dispose();
      requestDraw();
    }
    const output = document.createElement('canvas');
    output.width = exportWidth; output.height = exportHeight;
    const context = output.getContext('2d');
    if (!context) throw new Error('Could not prepare the PNG image.');
    const image = context.createImageData(exportWidth, exportHeight), stride = exportWidth * 4;
    for (let row = 0; row < exportHeight; row++) {
      image.data.set(pixels.subarray((exportHeight - 1 - row) * stride, (exportHeight - row) * stride), row * stride);
    }
    // The blended render target is premultiplied; ImageData expects straight RGBA.
    for (let offset = 0; offset < image.data.length; offset += 4) {
      const alpha = image.data[offset + 3];
      if (alpha > 0 && alpha < 255) {
        image.data[offset] = Math.min(255, Math.round(image.data[offset] * 255 / alpha));
        image.data[offset + 1] = Math.min(255, Math.round(image.data[offset + 1] * 255 / alpha));
        image.data[offset + 2] = Math.min(255, Math.round(image.data[offset + 2] * 255 / alpha));
      }
    }
    context.putImageData(image, 0, 0);
    return new Promise((resolve, reject) => output.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not encode the PNG image.')), 'image/png'));
  }
  function emitState(available) {
    canvas.dataset.rendererStatus = available ? 'ready' : 'context-lost';
    canvas.dispatchEvent(new CustomEvent('bench-renderer-state', { detail: { available } }));
  }
  function lost(event) {
    event.preventDefault(); contextLost = true;
    cancelAnimationFrame(frame); frame = 0;
    emitState(false);
  }
  function restored() {
    contextLost = false;
    for (const view of views.values()) updateTexture(view);
    emitState(true); requestDraw();
  }
  function visibility() {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else requestDraw();
  }
  const observer = new ResizeObserver(requestDraw);
  observer.observe(canvas);
  for (const view of views.values()) observer.observe(view.element);
  window.addEventListener('resize', requestDraw);
  window.addEventListener('scroll', requestDraw, { capture: true, passive: true });
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  canvas.dataset.renderer = 'three';
  canvas.dataset.threeRevision = THREE.REVISION;
  emitState(true);
  setOptics(initialOptics);

  return {
    invalidate, setOptics, exportPNG, draw: requestDraw,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', requestDraw);
      window.removeEventListener('scroll', requestDraw, true);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      for (const view of views.values()) view.texture.dispose();
      material.dispose(); geometry.dispose(); renderer.dispose();
      canvas.dataset.rendererStatus = 'disposed';
    }
  };
}

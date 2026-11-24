import * as THREE from './vendor/three.module.js';
import { PIXEL_PITCH, UI_SCALE } from './viewer-grid.js?v=pane-140';

const SEAM_WIDTH = 0.16 * UI_SCALE;
const PATTERNS = ['dots', 'hashes', 'blocks', 'lines'];

const VERTEX = `
  void main() {
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = `
  precision highp float;
  uniform sampler2D uSource, uScene;
  uniform vec2 uSourceSize, uSceneSize, uResolution;
  uniform vec4 uSceneBounds;
  uniform float uSceneAvailable, uSceneMonochrome, uScenePixelated, uSceneAreaSample, uPixelRatio, uPixelPitch, uSeamWidth, uPattern;
  uniform vec3 uSceneMint;
  uniform float uBrightness, uGlow, uContrast, uGrid, uRefraction;

  vec4 sceneSampleAt(vec2 point) {
    // Clamp to real texel centers, including clipped pane edges and tiny sources.
    vec2 halfTexel = 0.5 / uSceneSize;
    vec2 uv = clamp((point - uSceneBounds.xy) / uSceneBounds.zw, halfTexel, 1.0 - halfTexel);
    return texture2D(uScene, vec2(uv.x, 1.0 - uv.y));
  }

  vec4 sceneCell(vec2 point) {
    // These offsets belong to the viewport lattice, never to the pane or its
    // framebuffer resolution. Every fragment in a cell receives the same light.
    vec2 cell = floor(point);
    vec4 a = sceneSampleAt(cell + vec2(0.25, 0.25));
    vec4 b = sceneSampleAt(cell + vec2(0.75, 0.25));
    vec4 c = sceneSampleAt(cell + vec2(0.25, 0.75));
    vec4 d = sceneSampleAt(cell + vec2(0.75, 0.75));
    float alpha = (a.a + b.a + c.a + d.a) * 0.25;
    vec3 premultiplied = (a.rgb * a.a + b.rgb * b.a + c.rgb * c.a + d.rgb * d.a) * 0.25;
    return vec4(alpha > 0.00001 ? premultiplied / alpha : vec3(0.0), alpha);
  }

  vec4 sourcePixel(vec2 point) {
    vec2 cell = floor(point);
    if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uSourceSize.x || cell.y >= uSourceSize.y) {
      return vec4(0.0);
    }
    // UI artwork stays at fixed logical texel centers, independent of display DPR.
    vec2 uv = (cell + 0.5) / uSourceSize;
    vec4 ui = texture2D(uSource, vec2(uv.x, 1.0 - uv.y));
    vec4 scene = vec4(0.0);
    // Auto mode preserves existing continuous native scenes and discrete
    // procedural art. Explicit grid mode filters full native frames per cell.
    vec2 local = point - uSceneBounds.xy;
    if (uSceneAvailable > 0.5 && local.x >= 0.0 && local.y >= 0.0
      && local.x < uSceneBounds.z && local.y < uSceneBounds.w) {
      if (uSceneAreaSample > 0.5) scene = sceneCell(point);
      else scene = sceneSampleAt(uScenePixelated > 0.5 ? floor(point) + 0.5 : point);
      if (uSceneMonochrome > 0.5) {
        float luminance = dot(scene.rgb, vec3(0.2126, 0.7152, 0.0722));
        scene.rgb = uSceneMint * luminance;
      }
    }
    // Source-over in linear light; return straight RGB for the shared optical pass.
    float alpha = ui.a + scene.a * (1.0 - ui.a);
    vec3 premultiplied = ui.rgb * ui.a + scene.rgb * scene.a * (1.0 - ui.a);
    return vec4(alpha > 0.00001 ? premultiplied / alpha : vec3(0.0), alpha);
  }

  vec3 phosphorLight(vec2 point) {
    vec4 source = sourcePixel(point);
    vec3 color = pow(max(source.rgb, vec3(0.0)), vec3(uContrast));
    float peak = max(color.r, max(color.g, color.b));
    return color * source.a * smoothstep(0.05, 0.45, peak);
  }

  vec3 encodeSRGB(vec3 color) {
    color = clamp(color, 0.0, 1.0);
    return mix(color * 12.92, 1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), color));
  }

  void main() {
    // Anchor the lattice to the viewport's top left, never to an individual control.
    vec2 screenPixel = vec2(gl_FragCoord.x, uResolution.y - gl_FragCoord.y);
    float pitch = uPixelPitch * uPixelRatio;
    vec2 point = screenPixel / pitch;
    vec2 localCSS = mod(screenPixel / uPixelRatio, uPixelPitch);
    vec2 local = localCSS / uPixelPitch;
    // Integrate the proportionally scaled seam over each physical fragment. Its width does not
    // grow to one hardware pixel on low-DPR screens or change at pane boundaries.
    vec2 edgeCoverage = clamp((vec2(uSeamWidth) - localCSS + 0.5 / uPixelRatio) * uPixelRatio, 0.0, 1.0);
    float seam = 1.0 - (1.0 - edgeCoverage.x) * (1.0 - edgeCoverage.y);
    float patternShade = 0.0;
    if (uPattern < 0.5) {
      vec2 corner = max(abs(local - 0.5) * 2.0 - 0.4, 0.0) / 0.6;
      patternShade = 0.12 * corner.x * corner.y;
    } else if (uPattern < 1.5) {
      vec2 bands = 1.0 - smoothstep(vec2(0.07), vec2(0.19), min(abs(local - 0.3), abs(local - 0.7)));
      patternShade = 0.035 * (1.0 - max(bands.x, bands.y));
    } else if (uPattern > 2.5) {
      patternShade = 0.035 * (0.5 + 0.5 * cos(local.y * 6.2831853));
    }
    float apertureAlpha = clamp((seam * 0.42 + patternShade) * uGrid, 0.0, 0.65);

    // A lens changes the light across a cell; it never moves the source or grid.
    float facet = 1.0 + uRefraction * 0.12 * (local.x - local.y);
    vec4 source = sourcePixel(point);
    vec3 signal = pow(max(source.rgb, vec3(0.0)), vec3(uContrast));
    signal *= uBrightness * facet;

    // Glow follows the same global cells. In continuous mode it preserves the
    // scene's subcell position; forced grid mode samples each neighboring cell.
    vec3 glow = phosphorLight(point) * 0.20;
    glow += (phosphorLight(point + vec2(1.0, 0.0)) + phosphorLight(point + vec2(-1.0, 0.0))
           + phosphorLight(point + vec2(0.0, 1.0)) + phosphorLight(point + vec2(0.0, -1.0))) * 0.14;
    glow += (phosphorLight(point + vec2(1.0, 1.0)) + phosphorLight(point + vec2(-1.0, -1.0))
           + phosphorLight(point + vec2(1.0, -1.0)) + phosphorLight(point + vec2(-1.0, 1.0))) * 0.06;
    glow *= uGlow * uBrightness * 0.45;

    float haloAlpha = clamp(max(glow.r, max(glow.g, glow.b)) * 2.0, 0.0, 0.6);
    float contentAlpha = source.a + (1.0 - source.a) * haloAlpha;
    vec3 light = signal * source.a + glow;
    vec3 color = contentAlpha > 0.00001 ? encodeSRGB(light / contentAlpha) : vec3(0.0);
    // One black aperture layer covers UI, scene, and the transparent background.
    // Keep premultiplied coverage correct when the page remains visible underneath.
    float alpha = contentAlpha + (1.0 - contentAlpha) * apertureAlpha;
    vec3 premultiplied = color * contentAlpha * (1.0 - apertureAlpha);
    gl_FragColor = vec4(alpha > 0.00001 ? premultiplied / alpha : vec3(0.0), alpha);
  }
`;

const clamp = (value, min, max, fallback) => Number.isFinite(Number(value))
  ? Math.min(max, Math.max(min, Number(value))) : fallback;

function makeTexture(source, filter = THREE.NearestFilter) {
  const texture = new THREE.CanvasTexture(source);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = filter;
  texture.magFilter = filter;
  texture.generateMipmaps = false;
  texture.flipY = true;
  return texture;
}

/** Render the complete UI in one fixed screen-space lattice and one draw call. */
export function createViewerGridRenderer(canvas, sourceCanvas, initialOptics = {}, sceneCanvas = null) {
  if (!canvas || !sourceCanvas || !Number.isFinite(PIXEL_PITCH) || PIXEL_PITCH < 1) {
    throw new Error('The viewer grid requires an output canvas, source canvas, and positive pixel pitch.');
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas, alpha: true, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: true, powerPreference: 'high-performance'
    });
  } catch (error) {
    canvas.dataset.rendererStatus = 'error';
    canvas.dispatchEvent(new CustomEvent('viewer-grid-renderer-state', { detail: { available: false } }));
    throw error;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.autoClear = true;
  renderer.setClearColor(0x000000, 0);

  let texture = makeTexture(sourceCanvas);
  let sourceWidth = sourceCanvas.width, sourceHeight = sourceCanvas.height;
  let sceneTexture = sceneCanvas ? makeTexture(sceneCanvas, THREE.LinearFilter) : null;
  let sceneWidth = sceneCanvas?.width || 0, sceneHeight = sceneCanvas?.height || 0;
  let sceneAvailable = Boolean(sceneCanvas);
  // null retains legacy auto detection until a caller explicitly chooses a mode.
  let sceneGrid = null;
  let width = 0, height = 0, pixelRatio = 0;
  let frame = 0, destroyed = false, contextLost = false;
  const uniforms = {
    uSource: { value: texture },
    uScene: { value: sceneTexture || texture },
    uSourceSize: { value: new THREE.Vector2(sourceWidth, sourceHeight) },
    uSceneSize: { value: new THREE.Vector2(Math.max(1, sceneWidth), Math.max(1, sceneHeight)) },
    uSceneBounds: { value: new THREE.Vector4() }, uSceneAvailable: { value: sceneAvailable ? 1 : 0 },
    uSceneMonochrome: { value: 0 }, uScenePixelated: { value: 0 }, uSceneAreaSample: { value: 0 },
    uSceneMint: { value: new THREE.Color('#9ce5d2') },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uPixelRatio: { value: 1 }, uPixelPitch: { value: PIXEL_PITCH },
    uSeamWidth: { value: SEAM_WIDTH }, uPattern: { value: 0 },
    uBrightness: { value: 1 }, uGlow: { value: 0.25 }, uContrast: { value: 1.1 },
    uGrid: { value: 0.35 }, uRefraction: { value: 0 }
  };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX, fragmentShader: FRAGMENT, uniforms,
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const quad = new THREE.Mesh(geometry, material);
  quad.frustumCulled = false;
  scene.add(quad);

  function emitState(available, status = available ? 'ready' : 'context-lost') {
    canvas.dataset.rendererStatus = status;
    canvas.dispatchEvent(new CustomEvent('viewer-grid-renderer-state', { detail: { available } }));
  }

  function updateTexture() {
    if (sourceWidth !== sourceCanvas.width || sourceHeight !== sourceCanvas.height) {
      texture.dispose();
      texture = makeTexture(sourceCanvas);
      sourceWidth = sourceCanvas.width; sourceHeight = sourceCanvas.height;
      uniforms.uSource.value = texture;
      if (!sceneTexture) uniforms.uScene.value = texture;
      uniforms.uSourceSize.value.set(sourceWidth, sourceHeight);
    }
    texture.needsUpdate = true;
    canvas.dataset.sourceWidth = String(sourceWidth);
    canvas.dataset.sourceHeight = String(sourceHeight);
  }

  function sceneDiagnostics() {
    const bounds = uniforms.uSceneBounds.value;
    const matchingGrid = bounds.z > 0 && bounds.w > 0 && sceneWidth === bounds.z && sceneHeight === bounds.w;
    const pixelated = sceneGrid === null ? matchingGrid : sceneGrid;
    const areaSample = sceneGrid === true && !matchingGrid;
    uniforms.uScenePixelated.value = pixelated ? 1 : 0;
    uniforms.uSceneAreaSample.value = areaSample ? 1 : 0;
    const filter = pixelated && !areaSample ? THREE.NearestFilter : THREE.LinearFilter;
    if (sceneTexture && (sceneTexture.minFilter !== filter || sceneTexture.magFilter !== filter)) {
      sceneTexture.minFilter = filter;
      sceneTexture.magFilter = filter;
      sceneTexture.needsUpdate = true;
    }
    canvas.dataset.sharedScene = String(Boolean(sceneTexture && sceneAvailable && bounds.z > 0 && bounds.w > 0));
    canvas.dataset.scenePixelated = String(pixelated);
    canvas.dataset.sceneGrid = sceneGrid === null ? 'auto' : String(sceneGrid);
    canvas.dataset.sceneSampling = areaSample ? 'area4' : pixelated ? 'nearest' : 'continuous';
    canvas.dataset.sceneWidth = String(sceneWidth);
    canvas.dataset.sceneHeight = String(sceneHeight);
  }

  function updateSceneTexture() {
    if (!sceneCanvas) return;
    if (!sceneTexture || sceneWidth !== sceneCanvas.width || sceneHeight !== sceneCanvas.height) {
      sceneTexture?.dispose();
      sceneTexture = makeTexture(sceneCanvas, THREE.LinearFilter);
      sceneWidth = sceneCanvas.width; sceneHeight = sceneCanvas.height;
      uniforms.uScene.value = sceneTexture;
      uniforms.uSceneSize.value.set(Math.max(1, sceneWidth), Math.max(1, sceneHeight));
    }
    sceneTexture.needsUpdate = true;
    sceneDiagnostics();
  }

  function setSceneFrame() {
    if (destroyed || !sceneCanvas) return;
    updateSceneTexture();
    setSceneAvailable(sceneWidth > 0 && sceneHeight > 0);
    requestDraw();
  }

  function setSceneBounds(bounds) {
    if (destroyed) return;
    const target = uniforms.uSceneBounds.value;
    if (bounds && [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) {
      target.set(Math.round(bounds.x), Math.round(bounds.y), Math.max(0, Math.round(bounds.width)), Math.max(0, Math.round(bounds.height)));
    } else target.set(0, 0, 0, 0);
    sceneDiagnostics(); requestDraw();
  }

  function setSceneAvailable(available) {
    if (destroyed) return;
    sceneAvailable = Boolean(available && sceneCanvas && sceneWidth > 0 && sceneHeight > 0);
    uniforms.uSceneAvailable.value = sceneAvailable ? 1 : 0;
    sceneDiagnostics(); requestDraw();
  }

  /** Rasterize native scene light on the same viewport cells as the UI artwork. */
  function setSceneGrid(enabled) {
    if (destroyed) return;
    const next = Boolean(enabled);
    if (sceneGrid === next) return;
    sceneGrid = next;
    sceneDiagnostics(); requestDraw();
  }

  // Only the imported scene is tinted; UI, test patterns, and calibration
  // retain their own colors unless the caller explicitly enables this mode.
  function setSceneMonochrome(enabled) {
    if (destroyed) return;
    const next = enabled ? 1 : 0;
    if (uniforms.uSceneMonochrome.value === next) return;
    uniforms.uSceneMonochrome.value = next;
    canvas.dataset.sceneMonochrome = String(Boolean(next));
    requestDraw();
  }

  function setPattern(mark) {
    if (destroyed) return;
    const pattern = PATTERNS.indexOf(mark);
    if (pattern < 0 || pattern === uniforms.uPattern.value) return;
    uniforms.uPattern.value = pattern;
    canvas.dataset.pattern = mark;
    requestDraw();
  }

  function updateSize() {
    const nextWidth = Math.max(1, Math.round(window.innerWidth));
    const nextHeight = Math.max(1, Math.round(window.innerHeight));
    const nativeRatio = Number(window.devicePixelRatio);
    const nextRatio = Number.isFinite(nativeRatio) && nativeRatio > 0 ? nativeRatio : 1;
    if (width === nextWidth && height === nextHeight && pixelRatio === nextRatio) return;
    width = nextWidth; height = nextHeight; pixelRatio = nextRatio;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(width, height, false);
    // Three rounds backing dimensions down; use the actual buffer height so
    // fractional DPR cannot introduce a vertical phase shift.
    uniforms.uResolution.value.set(canvas.width, canvas.height);
    uniforms.uPixelRatio.value = pixelRatio;
    canvas.dataset.pixelRatio = String(pixelRatio);
  }

  function render() {
    frame = 0;
    if (destroyed || contextLost || document.hidden) return;
    try {
      updateSize();
      if (sourceWidth !== sourceCanvas.width || sourceHeight !== sourceCanvas.height) updateTexture();
      renderer.render(scene, camera);
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
    } catch (error) {
      emitState(false, 'error');
      canvas.dataset.rendererError = error instanceof Error ? error.message : String(error);
    }
  }

  function requestDraw() {
    if (!frame && !destroyed && !contextLost && !document.hidden) frame = requestAnimationFrame(render);
  }

  function invalidate() {
    if (destroyed) return;
    updateTexture();
    requestDraw();
  }

  function setOptics(optics = {}) {
    if (destroyed) return;
    uniforms.uBrightness.value = clamp(optics.brightness, 20, 200, 100) / 100;
    uniforms.uGlow.value = clamp(optics.glow, 0, 150, 25) / 100;
    uniforms.uContrast.value = clamp(optics.contrast, 50, 220, 110) / 100;
    uniforms.uGrid.value = clamp(optics.grid, 0, 100, 35) / 100;
    uniforms.uRefraction.value = clamp(optics.refraction, 0, 100, 0) / 100;
    requestDraw();
  }

  function lost(event) {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(frame); frame = 0;
    canvas.dataset.drawCalls = '0';
    emitState(false);
  }

  function restored() {
    if (destroyed) return;
    contextLost = false;
    width = 0; height = 0; pixelRatio = 0;
    delete canvas.dataset.rendererError;
    updateTexture();
    updateSceneTexture();
    emitState(true);
    requestDraw();
  }

  function visibility() {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else requestDraw();
  }

  const observer = new ResizeObserver(requestDraw);
  observer.observe(canvas);
  window.addEventListener('resize', requestDraw);
  window.addEventListener('pageshow', requestDraw);
  window.visualViewport?.addEventListener('resize', requestDraw);
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', lost);
  canvas.addEventListener('webglcontextrestored', restored);
  canvas.dataset.renderer = 'three-viewer-grid';
  canvas.dataset.threeRevision = THREE.REVISION;
  canvas.dataset.pixelPitch = String(PIXEL_PITCH);
  canvas.dataset.seamWidth = String(SEAM_WIDTH);
  canvas.dataset.pattern = PATTERNS[0];
  canvas.dataset.drawCalls = '0';
  canvas.dataset.sceneMonochrome = 'false';
  updateTexture();
  sceneDiagnostics();
  emitState(true);
  setOptics(initialOptics);

  return {
    invalidate, setOptics, setSceneFrame, setSceneBounds, setSceneAvailable, setSceneMonochrome, setSceneGrid, setPattern,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', requestDraw);
      window.removeEventListener('pageshow', requestDraw);
      window.visualViewport?.removeEventListener('resize', requestDraw);
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', lost);
      canvas.removeEventListener('webglcontextrestored', restored);
      texture.dispose(); sceneTexture?.dispose(); material.dispose(); geometry.dispose(); renderer.dispose();
      canvas.dataset.rendererStatus = 'disposed';
      canvas.dataset.drawCalls = '0';
      canvas.dataset.sharedScene = 'false';
    }
  };
}

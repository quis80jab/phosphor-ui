import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { UI_SCALE } from '../dist/viewer-grid.js';
const root = new URL('../dist/', import.meta.url);
const Three = await import(new URL('vendor/three.module.js', root));
class Target {
  constructor() { this.listeners = new Map(); this.dataset = {}; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) { for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event); }
}
const queue = new Map(); let nextFrame = 0;
const window = Object.assign(new Target(), { innerWidth: 801, innerHeight: 603, devicePixelRatio: 1.25, visualViewport: new Target() });
const document = Object.assign(new Target(), { hidden: false });
const canvas = new Target();
const source = { width: 401, height: 302 };
const textureRecords = [];
class TrackedTexture extends Three.CanvasTexture {
  constructor(source) { super(source); this.disposals = 0; textureRecords.push(this); }
  dispose() { this.disposals++; super.dispose(); }
}
let gpu;
class Renderer {
  constructor(options) { this.options = options; this.info = { render: { calls: 0 } }; this.frames = 0; gpu = this; }
  setClearColor() {}
  setPixelRatio(ratio) { this.ratio = ratio; }
  setSize(w, h, style) { assert.equal(style, false); this.size = [w, h]; canvas.width = Math.floor(w * this.ratio); canvas.height = Math.floor(h * this.ratio); }
  render(scene) { this.frames++; this.info.render.calls = 1; this.uniforms = scene.children[0].material.uniforms; this.fragmentShader = scene.children[0].material.fragmentShader; }
  dispose() { this.disposed = true; }
}
const observers = [];
class ResizeObserver { constructor(cb) { this.cb = cb; observers.push(this); } observe() {} disconnect() { this.disconnected = true; } }
class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } }
const THREE = { ...Three, WebGLRenderer: Renderer, CanvasTexture: TrackedTexture };
let code = await readFile(new URL('viewer-grid-renderer.js', root), 'utf8');
code = code.replace(/^import .*\n/gm, '').replace('export function createViewerGridRenderer', 'function createViewerGridRenderer');
const compile = new Function('THREE','PIXEL_PITCH','UI_SCALE','window','document','requestAnimationFrame','cancelAnimationFrame','ResizeObserver','CustomEvent', code + '\nreturn createViewerGridRenderer;');
const factory = scale => compile(
  THREE, 2 * scale, scale, window, document,
  cb => { queue.set(++nextFrame, cb); return nextFrame; }, id => queue.delete(id), ResizeObserver, CustomEvent
);
const create = factory(1);
const flush = () => { const callbacks = [...queue.values()]; queue.clear(); for (const cb of callbacks) cb(); };
test('native DPR, fixed UI pixels, independent scene resolution and renderer lifecycle', () => {
const states = [];
canvas.addEventListener('viewer-grid-renderer-state', e => states.push(e.detail.available));
const view = create(canvas, source, { grid: 0, glow: 0 });
assert.equal(queue.size, 1); flush();
assert.deepEqual(gpu.size, [801, 603]); assert.equal(gpu.ratio, 1.25);
assert.equal(canvas.width, 1001); assert.equal(canvas.dataset.drawCalls, '1');
assert.equal(gpu.uniforms.uPixelPitch.value, 2); assert.equal(gpu.uniforms.uGrid.value, 0);
assert.equal(gpu.uniforms.uGlow.value, 0);
const firstTexture = gpu.uniforms.uSource.value;
view.invalidate(); view.invalidate(); view.invalidate();
assert.equal(queue.size, 1); flush();
assert.equal(textureRecords.length, 1); assert.equal(gpu.uniforms.uSource.value, firstTexture);
source.width = 501; source.height = 351; view.invalidate(); flush();
assert.equal(textureRecords.length, 2); assert.equal(firstTexture.disposals, 1);
assert.deepEqual(gpu.uniforms.uSourceSize.value.toArray(), [501, 351]);
assert.equal(gpu.uniforms.uSource.value.minFilter, Three.NearestFilter);
assert.equal(gpu.uniforms.uSource.value.magFilter, Three.NearestFilter);
window.devicePixelRatio = 1.6; window.dispatchEvent({ type: 'resize' }); flush();
assert.equal(gpu.ratio, 1.6); assert.equal(canvas.width, 1281);
assert.deepEqual(gpu.uniforms.uResolution.value.toArray(), [1281, 964]);
assert.deepEqual([source.width, source.height], [501, 351]);
view.invalidate(); let prevented = false;
canvas.dispatchEvent({ type: 'webglcontextlost', preventDefault() { prevented = true; } });
assert.equal(prevented, true); assert.equal(queue.size, 0); assert.equal(canvas.dataset.rendererStatus, 'context-lost');
view.invalidate(); assert.equal(queue.size, 0);
canvas.dispatchEvent({ type: 'webglcontextrestored' }); assert.equal(queue.size, 1); flush();
assert.equal(canvas.dataset.rendererStatus, 'ready');
document.hidden = true; view.invalidate(); assert.equal(queue.size, 0);
document.hidden = false; document.dispatchEvent({ type: 'visibilitychange' }); flush();
view.destroy(); view.destroy(); view.invalidate();
assert.equal(queue.size, 0); assert.equal(textureRecords[1].disposals, 1);
assert.equal(gpu.disposed, true); assert.equal(observers[0].disconnected, true);
assert.equal(canvas.dataset.rendererStatus, 'disposed');
assert.equal(canvas.listeners.get('webglcontextlost').size, 0);
assert.equal(window.listeners.get('resize').size, 0);
assert.deepEqual(states, [true, false, true]);

// Backing resolution follows the browser exactly, including fractional zoom
// and high-DPR displays. UI source dimensions and physical pitch never change.
for (const dpr of [0.8, 1, 1.25, 1.5, 2, 3]) {
  window.devicePixelRatio = dpr;
  const probe = create(canvas, source); flush();
  assert.equal(gpu.ratio, dpr);
  assert.deepEqual(gpu.uniforms.uResolution.value.toArray(), [Math.floor(801 * dpr), Math.floor(603 * dpr)]);
  assert.equal(gpu.uniforms.uPixelPitch.value, 2);
  assert.deepEqual(gpu.uniforms.uSourceSize.value.toArray(), [501,351]);
  probe.destroy();
}
const before = textureRecords.length;
const sceneSource = {width:320,height:180};
const shared = create(canvas,source,{grid:50,glow:20},sceneSource);
shared.setSceneBounds({x:24,y:-4,width:320,height:180}); flush();
assert.equal(textureRecords.length,before+2);
assert.equal(canvas.dataset.sharedScene,'true');
assert.equal(canvas.dataset.seamWidth,'0.16');
assert.deepEqual(gpu.uniforms.uSceneBounds.value.toArray(),[24,-4,320,180]);
assert.deepEqual(gpu.uniforms.uSceneSize.value.toArray(),[320,180]);
assert.equal(gpu.uniforms.uSceneAvailable.value,1);
let uiTexture=gpu.uniforms.uSource.value;
let sceneTexture=gpu.uniforms.uScene.value;
let uiVersion=uiTexture.version, sceneVersion=sceneTexture.version;
shared.setSceneFrame(); shared.setSceneFrame(); assert.equal(queue.size,1); flush();
assert.equal(uiTexture.version,uiVersion);
assert.ok(sceneTexture.version>sceneVersion);
assert.equal(sceneTexture.colorSpace,Three.SRGBColorSpace);
assert.equal(sceneTexture.minFilter,Three.NearestFilter); assert.equal(sceneTexture.magFilter,Three.NearestFilter);
assert.equal(gpu.uniforms.uScenePixelated.value,1);
assert.equal(canvas.dataset.scenePixelated,'true');
assert.equal(sceneTexture.generateMipmaps,false);
sceneSource.width=1280;sceneSource.height=720;
shared.setSceneFrame(); flush();
assert.equal(sceneTexture.disposals,1);
assert.equal(textureRecords.length,before+3);
sceneTexture=gpu.uniforms.uScene.value;
assert.deepEqual(gpu.uniforms.uSceneSize.value.toArray(),[1280,720]);
assert.deepEqual(gpu.uniforms.uSceneBounds.value.toArray(),[24,-4,320,180]);
assert.equal(gpu.uniforms.uSource.value.minFilter,Three.NearestFilter);
assert.equal(gpu.uniforms.uScene.value.minFilter,Three.LinearFilter);
assert.equal(gpu.uniforms.uScenePixelated.value,0);
assert.equal(canvas.dataset.scenePixelated,'false');
assert.equal(uiTexture.version,uiVersion);
// Both dimensions must agree, and either bounds changes or new scene frames
// must immediately switch sampling without retaining the previous mode.
shared.setSceneBounds({x:24,y:-4,width:1280,height:720}); flush();
assert.equal(gpu.uniforms.uScenePixelated.value,1);
assert.equal(sceneTexture.minFilter,Three.NearestFilter);
shared.setSceneBounds({x:24,y:-4,width:320,height:180}); flush();
assert.equal(gpu.uniforms.uScenePixelated.value,0);
assert.equal(sceneTexture.minFilter,Three.LinearFilter);
for (const [width,height,pixelated] of [[320,180,true],[320,181,false],[1280,720,false],[320,180,true],[1280,720,false]]) {
  const previous = sceneTexture;
  sceneSource.width=width; sceneSource.height=height;
  shared.setSceneFrame(); flush();
  sceneTexture=gpu.uniforms.uScene.value;
  assert.equal(previous.disposals,1);
  assert.equal(gpu.uniforms.uScenePixelated.value,Number(pixelated));
  assert.equal(canvas.dataset.scenePixelated,String(pixelated));
  assert.equal(sceneTexture.minFilter,pixelated ? Three.NearestFilter : Three.LinearFilter);
  assert.equal(sceneTexture.magFilter,sceneTexture.minFilter);
  assert.equal(uiTexture.version,uiVersion);
  assert.deepEqual(gpu.uniforms.uSceneBounds.value.toArray(),[24,-4,320,180]);
}
shared.setSceneMonochrome(true); flush(); assert.equal(gpu.uniforms.uSceneMonochrome.value,1); assert.equal(canvas.dataset.sceneMonochrome,'true'); shared.setSceneMonochrome(false); flush(); assert.equal(gpu.uniforms.uSceneMonochrome.value,0); shared.setSceneAvailable(false);flush();
assert.equal(gpu.uniforms.uSceneAvailable.value,0); assert.equal(canvas.dataset.sharedScene,'false');
shared.setSceneFrame();flush();
assert.equal(gpu.uniforms.uSceneAvailable.value,1); assert.equal(canvas.dataset.sharedScene,'true');
for(const [index,mark] of ['dots','hashes','blocks','lines'].entries()){
  shared.setPattern(mark);flush();
  assert.equal(gpu.uniforms.uPattern.value,index);
  assert.equal(gpu.uniforms.uPixelPitch.value,2);
}
shared.setPattern('invalid');assert.equal(queue.size,0);assert.equal(gpu.uniforms.uPattern.value,3);
canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});
uiVersion=uiTexture.version; sceneVersion=sceneTexture.version;
shared.setSceneFrame(); assert.equal(queue.size,0);
canvas.dispatchEvent({type:'webglcontextrestored'});flush();
assert.ok(uiTexture.version>uiVersion);assert.ok(sceneTexture.version>sceneVersion);
shared.setSceneBounds(null);flush();assert.equal(canvas.dataset.sharedScene,'false');
assert.deepEqual(gpu.uniforms.uSceneBounds.value.toArray(),[0,0,0,0]);
shared.destroy();
assert.equal(uiTexture.disposals,1);assert.equal(sceneTexture.disposals,1);
const totalTextures=textureRecords.length;
shared.setSceneFrame();shared.setSceneBounds({x:0,y:0,width:480,height:256});shared.setSceneAvailable(true);shared.setPattern('dots');
assert.equal(queue.size,0);assert.equal(textureRecords.length,totalTextures);
const seamMean = dpr => {
  const pitch=2*dpr;let coverage=0;
  for(let y=0;y<pitch;y++)for(let x=0;x<pitch;x++){
    const edgeX=Math.min(1,Math.max(0,(.16-(x+.5)/dpr+.5/dpr)*dpr));
    const edgeY=Math.min(1,Math.max(0,(.16-(y+.5)/dpr+.5/dpr)*dpr));
    coverage+=1-(1-edgeX)*(1-edgeY);
  }
  return coverage/(pitch*pitch);
};
assert.ok(Math.abs(seamMean(1)-seamMean(2))<1e-12);
assert.ok(Math.abs(seamMean(1)-(1-(1-.16/2)**2))<1e-12);
});


test('compact UI scales the shared VFD grid while splats retain native resolution', () => {
  const createScaled = factory(UI_SCALE);
  const pitch = 2 * UI_SCALE, seam = .16 * UI_SCALE;
  const uiSource = {width:Math.ceil(801 / pitch),height:Math.ceil(603 / pitch)};
  for (const dpr of [1.25, 2]) {
    window.devicePixelRatio = dpr;
    const sceneSource = {width:Math.round(640 * dpr),height:Math.round(360 * dpr)};
    const sceneSize = {...sceneSource};
    const view = createScaled(canvas,uiSource,{},sceneSource);
    view.setSceneBounds({x:16,y:32,width:640 / pitch,height:360 / pitch}); flush();
    assert.equal(gpu.ratio,dpr);
    assert.deepEqual(gpu.uniforms.uResolution.value.toArray(),[Math.floor(801*dpr),Math.floor(603*dpr)]);
    assert.equal(gpu.uniforms.uPixelPitch.value,pitch);
    assert.equal(gpu.uniforms.uSeamWidth.value,seam);
    assert.equal(Number(canvas.dataset.seamWidth),seam);
    assert.equal(gpu.uniforms.uSeamWidth.value / gpu.uniforms.uPixelPitch.value,.08);
    assert.deepEqual(gpu.uniforms.uSourceSize.value.toArray(),[uiSource.width,uiSource.height]);
    assert.deepEqual(gpu.uniforms.uSceneSize.value.toArray(),[sceneSize.width,sceneSize.height]);
    assert.equal(gpu.uniforms.uScenePixelated.value,0);
    assert.equal(gpu.uniforms.uScene.value.minFilter,Three.LinearFilter);
    assert.equal(gpu.uniforms.uSource.value.minFilter,Three.NearestFilter);
    const uiVersion = gpu.uniforms.uSource.value.version;
    view.setSceneFrame(); flush();
    assert.deepEqual(sceneSource,sceneSize);
    assert.equal(gpu.uniforms.uSource.value.version,uiVersion);
    view.destroy();
    assert.equal(queue.size,0);
  }
});

test('explicit scene grid filters native frames without reducing the source or reallocating on toggles', () => {
  const createScaled = factory(UI_SCALE), pitch = 2 * UI_SCALE;
  const ui = { width: Math.ceil(801 / pitch), height: Math.ceil(603 / pitch) };
  const native = { width: 1440, height: 960 };
  const view = createScaled(canvas, ui, {}, native);
  view.setSceneBounds({ x: 27, y: -13, width: 448, height: 336 }); flush();
  assert.equal(canvas.dataset.sceneGrid, 'auto');
  assert.equal(canvas.dataset.sceneSampling, 'continuous');
  assert.equal(gpu.uniforms.uScenePixelated.value, 0);
  const sceneTexture = gpu.uniforms.uScene.value, uiTexture = gpu.uniforms.uSource.value;
  const allocated = textureRecords.length, version = sceneTexture.version;
  view.setSceneGrid(true); view.setSceneGrid(true);
  assert.equal(queue.size, 1); flush();
  assert.equal(canvas.dataset.sceneGrid, 'true');
  assert.equal(canvas.dataset.scenePixelated, 'true');
  assert.equal(canvas.dataset.sceneSampling, 'area4');
  assert.equal(gpu.uniforms.uScenePixelated.value, 1);
  assert.equal(gpu.uniforms.uSceneAreaSample.value, 1);
  assert.equal(gpu.uniforms.uScene.value, sceneTexture);
  assert.equal(gpu.uniforms.uSource.value, uiTexture);
  assert.equal(textureRecords.length, allocated);
  assert.equal(sceneTexture.version, version, 'grid toggle must not re-upload the native frame');
  assert.equal(sceneTexture.minFilter, Three.LinearFilter, 'four area samples retain native interpolation');
  assert.deepEqual(native, { width: 1440, height: 960 });
  assert.deepEqual(gpu.uniforms.uSceneSize.value.toArray(), [1440, 960]);
  assert.deepEqual([canvas.dataset.sceneWidth, canvas.dataset.sceneHeight], ['1440', '960']);

  // DPR changes resize only the display buffer, never the lattice or scene source.
  for (const dpr of [0.8, 1, 1.25, 2, 3]) {
    window.devicePixelRatio = dpr; window.dispatchEvent({ type: 'resize' }); flush();
    assert.equal(gpu.uniforms.uPixelRatio.value, dpr);
    assert.equal(gpu.uniforms.uPixelPitch.value, pitch);
    assert.deepEqual(gpu.uniforms.uResolution.value.toArray(), [Math.floor(801 * dpr), Math.floor(603 * dpr)]);
    assert.deepEqual(gpu.uniforms.uSceneBounds.value.toArray(), [27, -13, 448, 336]);
    assert.equal(gpu.uniforms.uSceneAreaSample.value, 1);
    assert.equal(textureRecords.length, allocated);
  }
  view.setSceneGrid(false); flush();
  assert.equal(canvas.dataset.sceneGrid, 'false');
  assert.equal(canvas.dataset.sceneSampling, 'continuous');
  assert.equal(gpu.uniforms.uScenePixelated.value, 0);
  assert.equal(gpu.uniforms.uSceneAreaSample.value, 0);
  assert.equal(textureRecords.length, allocated);
  assert.equal(sceneTexture.version, version);

  view.setSceneGrid(true); flush();
  canvas.dispatchEvent({ type: 'webglcontextlost', preventDefault() {} });
  view.setSceneGrid(false); assert.equal(queue.size, 0);
  view.setSceneGrid(true); assert.equal(queue.size, 0);
  canvas.dispatchEvent({ type: 'webglcontextrestored' }); flush();
  assert.equal(canvas.dataset.sceneGrid, 'true');
  assert.equal(gpu.uniforms.uSceneAreaSample.value, 1);
  assert.equal(gpu.uniforms.uScene.value, sceneTexture);
  assert.equal(textureRecords.length, allocated);

  native.width = 1800; native.height = 1200; view.setSceneFrame(); flush();
  assert.equal(sceneTexture.disposals, 1);
  assert.equal(textureRecords.length, allocated + 1);
  assert.deepEqual(gpu.uniforms.uSceneSize.value.toArray(), [1800, 1200]);
  assert.equal(canvas.dataset.sceneSampling, 'area4');
  assert.equal(gpu.uniforms.uSceneAreaSample.value, 1);
  const resized = gpu.uniforms.uScene.value;
  // A procedural frame matching the grid gets its exact cell-center texel.
  view.setSceneBounds({ x: 27, y: -13, width: 1800, height: 1200 }); flush();
  assert.equal(canvas.dataset.sceneSampling, 'nearest');
  assert.equal(gpu.uniforms.uScenePixelated.value, 1);
  assert.equal(gpu.uniforms.uSceneAreaSample.value, 0);
  assert.equal(resized.minFilter, Three.NearestFilter);
  view.setSceneGrid(false); flush();
  assert.equal(canvas.dataset.sceneSampling, 'continuous');
  assert.equal(gpu.uniforms.uScenePixelated.value, 0);
  assert.equal(resized.minFilter, Three.LinearFilter);
  assert.equal(textureRecords.length, allocated + 1);
  view.destroy(); view.setSceneGrid(true);
  assert.equal(queue.size, 0);
  assert.equal(textureRecords.length, allocated + 1);
});

test('shader cell phase, edge clamp and area alpha contract use the global display grid', () => {
  const native = { width: 1440, height: 960 };
  const view = create(canvas, source, {}, native);
  view.setSceneBounds({ x: 27, y: -13, width: 448, height: 336 }); view.setSceneGrid(true); flush();
  const shader = gpu.fragmentShader;
  const cellBody = shader.match(/vec4 sceneCell\(vec2 point\) \{([\s\S]*?)\n  \}/)?.[1];
  const sampleBody = shader.match(/vec4 sceneSampleAt\(vec2 point\) \{([\s\S]*?)\n  \}/)?.[1];
  assert.match(cellBody, /vec2 cell = floor\(point\)/);
  assert.doesNotMatch(cellBody, /floor\(point\s*-\s*uSceneBounds/);
  const offsets = [...cellBody.matchAll(/sceneSampleAt\(cell \+ vec2\((\d\.\d+), (\d\.\d+)\)\)/g)].map(match => [Number(match[1]), Number(match[2])]);
  assert.deepEqual(offsets, [[.25,.25],[.75,.25],[.25,.75],[.75,.75]]);
  assert.match(sampleBody, /halfTexel = 0\.5 \/ uSceneSize/);
  assert.match(sampleBody, /clamp\(\(point - uSceneBounds.xy\) \/ uSceneBounds.zw, halfTexel, 1.0 - halfTexel\)/);
  assert.match(cellBody, /a.rgb \* a.a \+ b.rgb \* b.a \+ c.rgb \* c.a \+ d.rgb \* d.a/);
  assert.match(cellBody, /alpha > 0\.00001 \? premultiplied \/ alpha : vec3\(0\.0\)/);
  // Numeric edge/phase cases guard the coordinate contract used by the GLSL.
  const taps = (point, bounds, size) => offsets.map(offset => offset.map((value, axis) => {
    const uv = (Math.floor(point[axis]) + value - bounds[axis]) / bounds[axis + 2];
    const halfTexel = .5 / size[axis];
    return Math.max(halfTexel, Math.min(1 - halfTexel, uv));
  }));
  const bounds = [27,-13,448,336], dims = [1440,960];
  assert.deepEqual(taps([40.01,20.01],bounds,dims), taps([40.99,20.99],bounds,dims));
  assert.notDeepEqual(taps([41.01,20.01],bounds,dims), taps([40.99,20.99],bounds,dims));
  assert.deepEqual(taps([27,-13],bounds,[1,1]), [[.5,.5],[.5,.5],[.5,.5],[.5,.5]]);
  const clamped = taps([26.99,-13.1],bounds,dims);
  assert.ok(clamped.every(tap => tap[0] === .5 / 1440 && tap[1] === .5 / 960));
  assert.ok(taps([475,323],bounds,dims).every(tap => tap[0] === 1 - .5 / 1440 && tap[1] === 1 - .5 / 960));
  const nearEdge = taps([474.99,322.99],bounds,dims);
  assert.ok(nearEdge.every(tap => tap.every((v, axis) => v >= .5 / dims[axis] && v <= 1 - .5 / dims[axis])));
  // Transparent bright RGB contributes no color: averaging straight RGB would fail.
  const rgba = [[1,0,0,1],[0,1,0,0],[0,0,1,0],[1,1,1,0]];
  const alpha = rgba.reduce((sum, value) => sum + value[3],0) / 4;
  const rgb = [0,1,2].map(axis => rgba.reduce((sum,value) => sum + value[axis] * value[3],0) / 4 / alpha);
  assert.deepEqual([...rgb,alpha],[1,0,0,.25]);
  view.destroy();
});

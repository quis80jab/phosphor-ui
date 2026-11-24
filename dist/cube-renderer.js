import { createSnowGlobe } from './snow-globe.js?v=splats-1';
import { IMPORTED_SCENES } from './imported-scenes.js?v=splats-1';
import { SparkRenderer } from './vendor/spark.module.js';
import { createVoxelTest } from './voxel-test.js?v=points-1';
import { createHologramMap, MAP_DEFAULTS, mapSpot } from './hologram-map.js?v=scan-5';
import { createDirectOperateRenderer } from './direct-operate-renderer.js?v=operate-1';
import { createPointEditor } from './viewer-point-editor.js?v=points-1';
import { PIXEL_PITCH } from './viewer-grid.js?v=pane-140';
import * as THREE from './vendor/three.module.js';
import { pixelText, glyphMark } from './vfd-glyphs.js?v=cube-2';
import { createReplayScene } from './mcap-replay-scene.js?v=scan-1';
import { SCAN_SITES } from './scan-sites.js?v=scan-1';
import { parseScanFile, monumentSource, replaySource } from './scan-source.js?v=scan-2';

const EDGE = 2.8, HALF = EDGE / 2, TEXTURE_SIZE = 512, TAU = Math.PI * 2;
const ASSETS = ['calibration', 'surface', 'thermal', 'sf-waterfront', 'mcap-replay', ...Object.keys(SCAN_SITES), ...Object.keys(IMPORTED_SCENES)];
// The hologram projector draws the city map, a SLAM replay or a scanned monument, with the same controls.
const HOLOGRAM = new Set(['sf-waterfront', 'mcap-replay', ...Object.keys(SCAN_SITES)]);
const isMap = id => HOLOGRAM.has(id);
const isScanSite = id => Object.hasOwn(SCAN_SITES, id);
const isReplay = id => id === 'mcap-replay';
const isNativeScene = id => isImported(id) || isMap(id);
const isImported = id => Object.hasOwn(IMPORTED_SCENES, id);
const MARKS = ['dots', 'hashes', 'blocks', 'lines'];
const FACES = [
  { label: 'R', normal: [1, 0, 0], rotation: [0, Math.PI / 2, 0], tint: '#6dc9c5' },
  { label: 'L', normal: [-1, 0, 0], rotation: [0, -Math.PI / 2, 0], tint: '#66b3b7' },
  { label: 'T', normal: [0, 1, 0], rotation: [-Math.PI / 2, 0, 0], tint: '#b7efd8' },
  { label: 'B', normal: [0, -1, 0], rotation: [Math.PI / 2, 0, 0], tint: '#598d9b' },
  { label: 'F', normal: [0, 0, 1], rotation: [0, 0, 0], tint: '#91e8cb' },
  { label: 'A', normal: [0, 0, -1], rotation: [0, Math.PI, 0], tint: '#7bc6bd' }
];
const VIEWS = {
  iso: { direction: [5, 3.9, 6.2], up: [0, 1, 0] },
  front: { direction: [0, 0, 1], up: [0, 1, 0] },
  top: { direction: [0, 1, 0.001], up: [0, 0, -1] },
  right: { direction: [1, 0, 0], up: [0, 1, 0] }
};
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const noise = (x, y, seed) => { const value = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453; return value - Math.floor(value); };
const gaussian = (u, v, x, y, radius) => Math.exp(-((u - x) ** 2 + (v - y) ** 2) / (radius ** 2));
const heatPalette = ['#31538f', '#357fb8', '#3cb9c4', '#8fd7ad', '#e4df7b', '#ffb86c', '#ff866c', '#ff9eb5'];

function canvasSource(width = TEXTURE_SIZE, height = TEXTURE_SIZE) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not create the inspection glyph textures.');
  context.imageSmoothingEnabled = false; return { canvas, context };
}
function textureFrom(canvas) {
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.NearestFilter; texture.magFilter = THREE.NearestFilter; texture.generateMipmaps = false;
  return texture;
}
function mountFace(object, face, distance) {
  object.position.set(...face.normal).multiplyScalar(distance); object.rotation.set(...face.rotation); return object;
}
function colorAt(hex, intensity) {
  const number = parseInt(hex.slice(1), 16);
  return `rgb(${Math.round((number >> 16 & 255) * intensity)},${Math.round((number >> 8 & 255) * intensity)},${Math.round((number & 255) * intensity)})`;
}
function paintFace(context, faceIndex, asset, mark, density, thermal = false) {
  const face = FACES[faceIndex], seed = ASSETS.indexOf(asset) * 13 + faceIndex * 3;
  context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  const margin = 26, top = 52, span = TEXTURE_SIZE - margin * 2, rowSpan = TEXTURE_SIZE - top - margin;
  const spacing = span / density, rows = Math.max(8, Math.floor(rowSpan / spacing)), size = Math.max(4, Math.floor(spacing * .58));
  for (let row = 0; row < rows; row++) for (let column = 0; column < density; column++) {
    const u = (column + .5) / density, v = (row + .5) / rows, variation = noise(column, row, seed);
    const x = Math.round(margin + (column + .5) * spacing - size / 2), y = Math.round(top + (row + .5) * rowSpan / rows - size / 2);
    if (thermal) {
      const hotU = .28 + (faceIndex % 3) * .14, hotV = .32 + (faceIndex % 2) * .22;
      const heat = clamp(.19 + gaussian(u, v, hotU, hotV, asset === 'thermal' ? .34 : .29) * (asset === 'thermal' ? .94 : .84)
        + gaussian(u, v, .76 - faceIndex * .035, .72, .25) * .68 + variation * .055, 0, 1);
      context.globalAlpha = .66 + heat * .34;
      glyphMark(context, x, y, mark, heatPalette[Math.min(7, Math.floor(heat * 8))], size + (heat > .7 ? 1 : 0));
    } else {
      let tint = face.tint, strength = .42 + variation * .5;
      if (asset === 'calibration') {
        const stripe = Math.floor(u * 6) % 3;
        tint = [face.tint, '#6cc3d1', '#a9debc'][stripe];
        if ((column + row) % 7 === 0) strength = .98;
        if (Math.abs(u - .5) < .024 || Math.abs(v - .5) < .025) strength = .98;
      } else if (asset === 'surface') {
        const patch = gaussian(u, v, .62, .52, .25) + gaussian(u, v, .18, .8, .16);
        if (patch > .48) { tint = '#c5b48c'; strength = .36 + variation * .48; }
        else strength = .26 + variation * .7;
        if (variation < .09) continue;
      } else { tint = column % 5 === 0 ? '#b1e9d4' : '#6faebd'; strength = .35 + variation * .45; }
      context.globalAlpha = 1; glyphMark(context, x, y, mark, colorAt(tint, strength), size);
    }
  }
  context.globalAlpha = 1;
  if (!thermal) {
    pixelText(context, `${face.label} / ${asset === 'calibration' ? 'CAL' : asset === 'surface' ? 'SURFACE' : 'THERMAL'}`, 26, 20, face.tint, 2);
    context.fillStyle = colorAt(face.tint, .4); context.fillRect(26, 42, 460, 1);
    // Pixel registration brackets are physically part of each face texture.
    for (const [x, y, sx, sy] of [[14, 14, 1, 1], [498, 14, -1, 1], [14, 498, 1, -1], [498, 498, -1, -1]]) {
      context.fillStyle = face.tint; context.fillRect(Math.min(x, x + sx * 12), y, 13, 2); context.fillRect(x, Math.min(y, y + sy * 12), 2, 13);
    }
  }
}
function appendSegment(positions, colors, x1, y1, x2, y2, width, color) {
  const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy); if (!length) return;
  const nx = -dy / length * width / 2, ny = dx / length * width / 2;
  const vertices = [[x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x2 + nx, y2 + ny], [x2 + nx, y2 + ny], [x1 - nx, y1 - ny], [x2 - nx, y2 - ny]];
  for (const [x, y] of vertices) { positions.push(x, y, 0); colors.push(color.r, color.g, color.b); }
}
function defectGeometry(faceIndex, asset) {
  const positions = [], colors = [], amber = new THREE.Color('#f0c185'), rose = new THREE.Color('#ffa7b7');
  const seed = ASSETS.indexOf(asset), u = .28 + (faceIndex % 3) * .15, v = .32 + (faceIndex % 2) * .23;
  const x = (u - .5) * EDGE, y = (.5 - v) * EDGE, half = asset === 'thermal' ? .27 : .22;
  const segment = (a, b, c, d, color = amber, width = .014) => appendSegment(positions, colors, a, b, c, d, width, color);
  for (const [sx, sy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    segment(x + sx * half, y + sy * half, x + sx * (half - .1), y + sy * half);
    segment(x + sx * half, y + sy * half, x + sx * half, y + sy * (half - .1));
  }
  segment(x - .055, y, x + .055, y); segment(x, y - .055, x, y + .055);
  if (asset !== 'calibration') {
    const startX = .12 + faceIndex * .025, startY = -.25;
    let previous = [startX, startY];
    for (let index = 1; index <= 9; index++) {
      const next = [startX + index * .045 + (noise(index, faceIndex, seed) - .5) * .12, startY - index * .055];
      segment(...previous, ...next, rose, .018); previous = next;
      if (index === 4 || index === 7) segment(previous[0], previous[1], previous[0] - .15, previous[1] - .08, rose, .011);
    }
  } else {
    const bx = .55, by = -.48;
    segment(bx - .08, by - .08, bx + .08, by + .08, rose, .018);
    segment(bx - .08, by + .08, bx + .08, by - .08, rose, .018);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return { geometry, labelPosition: [u * 512 + 36, v * 512 - 18] };
}
function faceGridGeometry() {
  const positions = [];
  for (let index = 1; index < 8; index++) {
    const offset = -HALF + index * EDGE / 8;
    positions.push(-HALF, offset, 0, HALF, offset, 0, offset, -HALF, 0, offset, HALF, 0);
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

/** Discrete VFD glyphs and real face-anchored inspection overlays. No playback loop. */
export function createCubeViewer(canvas, { onPoseChange, onInteraction, onError, onAssetState, onPointEdit, onMapState, onMapTranslation, onMapMarker, onDirectOperateChange } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: true });
  } catch (error) { onError?.(error); throw error; }
  renderer.setClearColor('#020a0d', 1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#020a0d'); scene.fog = new THREE.FogExp2('#020a0d', .035);
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 80);
  const directView = createDirectOperateRenderer(scene);
  const cube = new THREE.Group(); cube.position.y = .12; scene.add(cube);
  const importedPivot = new THREE.Group(); importedPivot.name = 'imported-scenes'; importedPivot.visible = false; scene.add(importedPivot);
  const rgbGroup = new THREE.Group(), thermalGroup = new THREE.Group(), defectGroup = new THREE.Group();
  cube.add(rgbGroup, thermalGroup, defectGroup);
  const resources = [], keep = item => (resources.push(item), item), textures = [];
  const boxGeometry = keep(new THREE.BoxGeometry(EDGE, EDGE, EDGE));
  const base = new THREE.Mesh(boxGeometry, keep(new THREE.MeshBasicMaterial({ color: '#030e11', toneMapped: false })));
  base.renderOrder = 0; cube.add(base);
  const planeGeometry = keep(new THREE.PlaneGeometry(EDGE, EDGE));
  const gridGeometry = keep(faceGridGeometry());
  const gridMaterial = keep(new THREE.LineBasicMaterial({ color: '#72b9ad', transparent: true, opacity: .11, depthWrite: false }));
  const defectMaterial = keep(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: .98, depthWrite: false, toneMapped: false, side: THREE.FrontSide }));
  const faceViews = [];
  for (const [index, face] of FACES.entries()) {
    const rgb = canvasSource(), thermal = canvasSource(), labels = canvasSource();
    const rgbTexture = keep(textureFrom(rgb.canvas)), thermalTexture = keep(textureFrom(thermal.canvas)), labelTexture = keep(textureFrom(labels.canvas));
    textures.push(rgbTexture, thermalTexture, labelTexture);
    const rgbMaterial = keep(new THREE.MeshBasicMaterial({ map: rgbTexture, transparent: true, alphaTest: .02, depthWrite: false, toneMapped: false }));
    const thermalMaterial = keep(new THREE.MeshBasicMaterial({ map: thermalTexture, transparent: true, opacity: .97, alphaTest: .015, depthWrite: false, toneMapped: false }));
    const labelMaterial = keep(new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, alphaTest: .02, depthWrite: false, toneMapped: false }));
    const rgbPlane = mountFace(new THREE.Mesh(planeGeometry, rgbMaterial), face, HALF + .006); rgbPlane.renderOrder = 2; rgbGroup.add(rgbPlane);
    const thermalPlane = mountFace(new THREE.Mesh(planeGeometry, thermalMaterial), face, HALF + .010); thermalPlane.renderOrder = 3; thermalGroup.add(thermalPlane);
    const labelPlane = mountFace(new THREE.Mesh(planeGeometry, labelMaterial), face, HALF + .026); labelPlane.renderOrder = 6; defectGroup.add(labelPlane);
    const defectMesh = mountFace(new THREE.Mesh(new THREE.BufferGeometry(), defectMaterial), face, HALF + .021); defectMesh.renderOrder = 5; defectGroup.add(defectMesh);
    const grid = mountFace(new THREE.LineSegments(gridGeometry, gridMaterial), face, HALF + .015); grid.renderOrder = 4; cube.add(grid);
    faceViews.push({ index, face, rgb, thermal, labels, rgbTexture, thermalTexture, labelTexture, defectMesh });
  }
  const edgeGeometry = keep(new THREE.EdgesGeometry(boxGeometry));
  const edges = new THREE.LineSegments(edgeGeometry, keep(new THREE.LineBasicMaterial({ color: '#b2efd9', transparent: true, opacity: .94, depthWrite: false })));
  edges.renderOrder = 7; cube.add(edges);
  const cornerPositions = [];
  for (const x of [-HALF, HALF]) for (const y of [-HALF, HALF]) for (const z of [-HALF, HALF]) cornerPositions.push(x, y, z);
  const cornerGeometry = keep(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(cornerPositions, 3)));
  cube.add(new THREE.Points(cornerGeometry, keep(new THREE.PointsMaterial({ color: '#dbfff0', size: .039, transparent: true, opacity: .95, depthWrite: false, sizeAttenuation: true }))));

  const floor = new THREE.GridHelper(10, 40, '#284e4c', '#153233'); floor.position.y = -1.48;
  floor.material.transparent = true; floor.material.opacity = .38; floor.material.depthWrite = false; scene.add(floor);
  keep(floor.geometry); keep(floor.material);
  const ringPoints = [];
  for (let i = 0; i <= 128; i++) { const angle = i / 128 * TAU; ringPoints.push(new THREE.Vector3(Math.cos(angle) * 2.05, -1.475, Math.sin(angle) * 2.05)); }
  const turntableRing = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(ringPoints)), keep(new THREE.LineBasicMaterial({ color: '#49766b', transparent: true, opacity: .5, depthWrite: false }))); scene.add(turntableRing);
  const axes = new THREE.Group(); axes.position.set(-2.25, -1.45, 1.5); scene.add(axes);
  for (const [axis, endpoint, color] of [['X', [.58, 0, 0], '#dbb78d'], ['Y', [0, .58, 0], '#99dac1'], ['Z', [0, 0, .58], '#80bbc9']]) {
    axes.add(new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(...endpoint)])), keep(new THREE.LineBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false }))));
    const label = canvasSource(32, 32); pixelText(label.context, axis, 8, 5, color, 3);
    const texture = keep(textureFrom(label.canvas)); textures.push(texture);
    const sprite = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false })));
    sprite.position.set(...endpoint).multiplyScalar(1.2); sprite.scale.set(.17, .17, 1); axes.add(sprite);
  }

  let asset = 'calibration', mark = 'dots', density = 28, frame = 0, yaw = 0, pitch = 0, zoom = 1, view = 'iso', customView = false;
  let layers = { rgb: true, thermal: false, defect: true };
  const imported = new Map();
  let spark = null, cacheClock = 0, renderMode = 'voxels', voxelScale = 1, editTool = 'orbit';
  let pointEdits = {}, selectionGesture = null, polygon = [], polygonMode = 'replace';
  const lassoGeometry = keep(new THREE.BufferGeometry());
  const lassoMaterial = keep(new THREE.ShaderMaterial({ transparent:true, depthTest:false, depthWrite:false, toneMapped:false,
    vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',
    fragmentShader:'void main(){gl_FragColor=vec4(0.72,1.0,0.87,0.95);\n#include <colorspace_fragment>\n}' }));
  const lassoOverlay = new THREE.Mesh(lassoGeometry,lassoMaterial); lassoOverlay.frustumCulled=false; lassoOverlay.renderOrder=110; lassoOverlay.visible=false; scene.add(lassoOverlay);
  let mapResult=null, mapSettings={...MAP_DEFAULTS}, mapState=null;
  // What the projector shows: the city (null source), a scan, or the replay; and the replay's trail and frustum.
  let replay=null, replayData=null, replayShown=-1, sourceKey='', scanStatus=null;
  const scans=new Map();
  function setSource(key,source){if(sourceKey===key)return false;sourceKey=key;mapResult.setPointSource?.(source);return true;}
  function sourceOverride(){
    if(isReplay(asset)&&!replayData)return{status:'error',message:'NO RECORDING YET: OPEN AN .MCAP, OR DROP ONE ON THE VIEW'};
    if(isScanSite(asset)&&scanStatus?.id===asset&&scanStatus.status!=='ready')return scanStatus;
    return null;
  }
  function applySource(){
    if(!mapResult||destroyed)return;
    if(replay)replay.group.visible=isReplay(asset)&&!!replayData;
    if(isReplay(asset)){
      if(!replayData){setSource('replay:none',{positions:new Float32Array(),colors:new Uint8Array(),count:0,label:'NO RECORDING'});return;}
      if(setSource(`replay:${replayData.pointCount}:${replayData.frames.length}`,replayData.source)){replayShown=-1;}
      updateReplayFrame();return;
    }
    if(isScanSite(asset)){
      const id=asset,entry=scans.get(id);
      if(entry?.source){scanStatus={id,status:'ready'};setSource(`scan:${id}`,entry.source);return;}
      setSource(`scan:${id}:loading`,{positions:new Float32Array(),colors:new Uint8Array(),count:0,label:'LOADING SCAN'});
      scanStatus={id,status:'loading',message:`LOADING ${SCAN_SITES[id].sceneTitle}`};emitAsset(id,'loading',scanStatus.message);
      if(entry?.promise)return;
      const promise=fetch(SCAN_SITES[id].file).then(response=>{if(!response.ok)throw new Error(`Scan file returned ${response.status}`);return response.arrayBuffer();})
        .then(bytes=>{if(destroyed)return;const source=monumentSource(parseScanFile(bytes),SCAN_SITES[id],mapSpot(mapSettings));scans.set(id,{source});if(asset===id){scanStatus={id,status:'ready'};applySource();emitAsset(id,'ready');}})
        .catch(error=>{scans.delete(id);if(asset===id){scanStatus={id,status:'error',message:`COULD NOT LOAD THE SCAN: ${error.message}`};emitAsset(id,'error',scanStatus.message);}});
      scans.set(id,{promise});return;
    }
    setSource('osm',null);
  }
  function updateReplayFrame(){
    if(!isReplay(asset)||!replayData||!replay?.loaded||!mapResult)return;
    const k=replay.setFrame(frame);
    if(k!==replayShown){replayShown=k;canvas.dataset.replayFrame=String(k);mapResult.updatePointCount?.(replayData.frames[k].end);}
  }
  let directOperate=false, directStageVisibility=null;
  let mapTranslation={x:0,z:0};
  let mapView='iso',mapCustomView=false,mapZoom=1,mapYaw=Math.atan2(5,6.2),mapPitch=Math.atan2(3.9,Math.hypot(5,6.2));
  const mapRaycaster=new THREE.Raycaster(),mapGround=new THREE.Plane(new THREE.Vector3(0,1,0),1);
  const markerProjected=new THREE.Vector3(),markerCameraSpace=new THREE.Vector3();
  const maxCachedSplats = 2250000;
  let width = 0, height = 0, dpr = 0, scheduled = 0, destroyed = false, contextLost = false, dragging = null, lastError = '';
  function clearDroneInput(){mapResult?.clearDroneInput?.();}
  function setDirectOperate(value){
    const next=!!value;
    if(next&&(destroyed||contextLost||document.hidden||!isMap(asset)||!mapResult?.setDirectOperate))return false;
    if(next===directOperate)return true;
    if(next){
      const marker=mapResult.getMarkerState?.();
      if(!marker?.position?.every(Number.isFinite)||!Number.isFinite(marker.metersToWorld)||marker.metersToWorld<=0)return false;
      if(mapResult.setDirectOperate(true)===false)return false;
      cancelPointGesture();clearDroneInput();directOperate=true;
      directStageVisibility=[floor.visible,turntableRing.visible,axes.visible];
      floor.visible=turntableRing.visible=axes.visible=false;
      // Keep saved projector settings intact while the flight cameras see the city.
      mapResult.setSettings({...mapSettings,enabled:false});
    }else{
      clearDroneInput();mapResult?.setDirectOperate?.(false);directOperate=false;
      mapResult?.setSettings(mapSettings);
      if(directStageVisibility)[floor.visible,turntableRing.visible,axes.visible]=directStageVisibility;
      directStageVisibility=null;
    }
    directView.setActive(directOperate);canvas.dataset.directOperate=String(directOperate);
    canvas.style.cursor=directOperate?'default':isMap(asset)||editTool==='orbit'?'grab':'crosshair';
    onDirectOperateChange?.(directOperate);requestDraw();return true;
  }
  function report(error) {
    clearDroneInput();
    if(directOperate)setDirectOperate(false);
    clearMapMarker();
    const message = error instanceof Error ? error.message : String(error);
    canvas.dataset.rendererStatus = 'error';
    if (message !== lastError) { lastError = message; onError?.(error instanceof Error ? error : new Error(message)); }
    // Restoring the map can dirty its scene. Do not retry a broken renderer in a loop.
    cancelAnimationFrame(scheduled);scheduled=0;
  }
  function pose() {
    const map=isMap(asset),mapGesture=map&&dragging?dragging.mode:'idle';
    return { view:map?(mapCustomView?'custom':mapView):(customView?'custom':view),preset:map?mapView:view,frame,
      yaw:map?0:(yaw+frame*TAU)*180/Math.PI,pitch:map?0:pitch*180/Math.PI,zoom:map?mapZoom:zoom,
      mapHeading:((-mapYaw*180/Math.PI)%360+360)%360,mapElevation:mapPitch*180/Math.PI,mapGesture,mapOrbiting:mapGesture==='orbit' };
  }
  function emitPose() {const current=pose();canvas.dataset.mapGesture=current.mapGesture;canvas.dataset.mapHeading=current.mapHeading.toFixed(2);canvas.dataset.mapElevation=current.mapElevation.toFixed(2);onPoseChange?.(current);}
  function resetMapCamera(name='iso',resetZoom=false){
    mapView=name;mapCustomView=false;const direction=VIEWS[name].direction;
    mapYaw=Math.atan2(direction[0],direction[2]);mapPitch=Math.atan2(direction[1],Math.hypot(direction[0],direction[2]));
    if(resetZoom)mapZoom=1;
  }
  // The timeline sweeps the city; on a scan or a replay it is the replay's time, so nothing sweeps.
  function mapScan(){return asset==='sf-waterfront'?{x:.65*Math.sin(frame*TAU),z:.3*Math.sin(frame*TAU*2)}:{x:0,z:0};}
  function applyMapTranslation(){
    const scan=mapScan(),actual={x:clamp(mapTranslation.x+scan.x,-4,4),z:clamp(mapTranslation.z+scan.z,-4,4)};
    mapResult?.setTranslation?.(actual);
    canvas.dataset.mapBaseX=String(mapTranslation.x);canvas.dataset.mapBaseZ=String(mapTranslation.z);
    canvas.dataset.mapOffsetX=String(actual.x);canvas.dataset.mapOffsetZ=String(actual.z);
  }
  function changeMapTranslation(next,notify=false){
    mapTranslation={x:clamp(finite(next.x,mapTranslation.x),-4,4),z:clamp(finite(next.z,mapTranslation.z),-4,4)};
    applyMapTranslation();if(notify)onMapTranslation?.({...mapTranslation});requestDraw();
  }
  function applyPose() {
    cube.rotation.set(pitch, yaw + frame * TAU, 0, 'YXZ');
    if(isMap(asset)){importedPivot.rotation.set(0,0,0);mapResult?.setZoom?.(mapZoom);applyMapTranslation();updateReplayFrame();}
    else importedPivot.rotation.copy(cube.rotation);
    const map=isMap(asset),preset = VIEWS[map?mapView:view], aspect = width / Math.max(1, height);
    const distance = Math.max(isMap(asset)?7.5+Math.max(0,mapSettings.height-3.5)*2.5:7.5, 5.4 / Math.max(.25, aspect)) / (map?1:zoom);
    const targetY=isMap(asset)?(mapSettings.height-3)*.35-.1:.08;
    if(map&&mapCustomView)camera.position.set(Math.sin(mapYaw)*Math.cos(mapPitch),Math.sin(mapPitch),Math.cos(mapYaw)*Math.cos(mapPitch)).multiplyScalar(distance);
    else camera.position.set(...preset.direction).normalize().multiplyScalar(distance);
    camera.position.y += targetY; camera.up.set(...(map&&mapCustomView?[0,1,0]:preset.up)); camera.lookAt(0, targetY, 0); camera.updateMatrixWorld();
    if(isMap(asset)&&mapResult){const rows=Math.max(1,Math.round(canvas.getBoundingClientRect().height/PIXEL_PITCH));mapResult.setCellSize(2*distance*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/rows);}
    const current=pose();canvas.dataset.mapZoom=String(mapZoom);canvas.dataset.cubeView=current.view;canvas.dataset.cubePreset=current.preset; canvas.dataset.cubeFrame = frame.toFixed(4);
  }
  function paintTextures() {
    if (isNativeScene(asset)) { mapResult?.setAppearance({mark});canvas.dataset.cubeMark = mark; return; }
    for (const item of faceViews) {
      paintFace(item.rgb.context, item.index, asset, mark, density, false);
      paintFace(item.thermal.context, item.index, asset, mark, density, true);
      item.rgbTexture.needsUpdate = item.thermalTexture.needsUpdate = true;
    }
    canvas.dataset.cubeMark = mark; canvas.dataset.cubeDensity = String(density);
  }
  function buildDefects() {
    for (const item of faceViews) {
      item.defectMesh.geometry.dispose();
      const generated = defectGeometry(item.index, asset); item.defectMesh.geometry = generated.geometry;
      const g = item.labels.context; g.clearRect(0, 0, 512, 512);
      // Defects are marked geometrically, without serial-number labels.
      item.labelTexture.needsUpdate = true;
    }
  }
  function applyLayers() {
    canvas.dataset.sceneMonochrome = String(isNativeScene(asset) && !layers.rgb);
    rgbGroup.visible = layers.rgb; thermalGroup.visible = layers.thermal; defectGroup.visible = layers.defect;
    base.visible = layers.rgb || layers.thermal || layers.defect;
    canvas.dataset.cubeLayers = Object.keys(layers).filter(key => layers[key]).join(',');
  }
  function emitAsset(id, status, message = '') {
    if (destroyed || asset !== id) return;
    const override = isMap(id)?sourceOverride():null; if (override && status === 'ready') { status = override.status; message = override.message || ''; }
    canvas.dataset.sceneStatus = status;
    const entry = imported.get(id), metadata = isMap(id)?mapResult?.metadata:entry?.result?.metadata;
    const voxel = renderMode === 'voxels' ? entry?.voxel?.metadata : null;
    onAssetState?.({asset:id,status,message,metadata:metadata ? { ...metadata, renderMode, voxelCount:voxel?.count, voxelSize:voxel?.voxelSize, gridColumns:voxel?.gridColumns, gridRows:voxel?.gridRows } : undefined});
  }
  function arrangeScene() {
    if(!isMap(asset))clearMapMarker();
    const isScene = isNativeScene(asset), active = isMap(asset)?mapResult:imported.get(asset)?.result;
    cube.visible = !isScene; importedPivot.visible = isScene;
    if (spark) spark.visible = isImported(asset) && renderMode !== 'voxels';
    if(mapResult){mapResult.group.visible=isMap(asset);mapResult.setActive(isMap(asset));}
    for (const [id, entry] of imported) {
      if (entry.result) entry.result.group.visible = id === asset && !!entry.editor && renderMode !== 'voxels';
      if (entry.voxel) entry.voxel.group.visible = id === asset && renderMode === 'voxels' && entry.voxel.metadata.editRevision === entry.editor?.deleteRevision;
      if (entry.editor) entry.editor.group.visible = id === asset;
    }
    const floorY = isScene && active ? active.metadata.bounds.min[1] - .04 : -1.48;
    floor.position.y = floorY;
    turntableRing.position.y = floorY + 1.475;
    axes.position.y = floorY + .03;
    canvas.dataset.sceneMode = isScene ? asset : 'cube';
    canvas.dataset.sceneMonochrome = String(isScene && !layers.rgb);
    canvas.dataset.sceneRepresentation = isReplay(asset)?'slam-replay':isScanSite(asset)?'monument-scan':isMap(asset)?'osm-buildings':isScene ? (renderMode === 'voxels' ? 'colored-voxels' : 'gaussian-splats') : 'demo';
    canvas.dataset.sceneRenderMode = renderMode;
    for (const key of ['sceneVoxels','sceneGridColumns','sceneGridRows','sceneVoxelSize']) delete canvas.dataset[key];
    const activeEntry = imported.get(asset);
    const voxel = isScene && renderMode === 'voxels' && activeEntry?.voxel?.metadata.editRevision === activeEntry?.editor?.deleteRevision ? activeEntry?.voxel : null;
    canvas.dataset.voxelScale = String(voxelScale);
    if (voxel) {
      canvas.dataset.sceneVoxels = String(voxel.metadata.count);
      canvas.dataset.sceneGridColumns = String(voxel.metadata.gridColumns);
      canvas.dataset.sceneGridRows = String(voxel.metadata.gridRows);
      canvas.dataset.sceneVoxelSize = String(voxel.metadata.voxelSize);
    }
    if (isImported(asset) && active) canvas.dataset.sceneSplats = String(active.metadata.count);
    else delete canvas.dataset.sceneSplats;
  }
  function ensureMap() {
    if(destroyed)return;
    if(!mapResult){
      mapResult=createHologramMap({onDirty:requestDraw,onProgress(update){
        if(destroyed)return;mapState=update;canvas.dataset.mapLoadedTiles=String(update.loadedTiles);canvas.dataset.mapBuildingCount=String(update.buildingCount);canvas.dataset.mapDetailedBuildings=String(update.detailedBuildings||0);
        canvas.dataset.mapTraceVoxels=String(update.traceVoxels||0);canvas.dataset.mapVisibleVoxels=String(update.visibleVoxels||0);canvas.dataset.mapVoxelCount=String(update.voxelCount||0);canvas.dataset.mapCellSize=String(update.voxelCellSize||0);onMapState?.({...update});
        if(isMap(asset))emitAsset(asset,update.status,update.message);
      }});
      importedPivot.add(mapResult.group);mapResult.setSettings(mapSettings);mapResult.setAppearance({mark});
    }
    mapResult.setActive(true);applySource();arrangeScene();applyPose();
    const state=mapResult.getStatus();mapState=state;onMapState?.({...state});emitAsset(asset,state.status,state.message);requestDraw();
  }
  function ensureSpark() {
    if (spark || contextLost || destroyed) return;
    spark = new SparkRenderer({ renderer, onDirty:requestDraw, accumExtSplats:true });
    spark.visible = isImported(asset) && renderMode !== 'voxels'; scene.add(spark);
  }
  function trimImportedCache() {
    let count = [...imported.values()].reduce((sum, entry) => sum + (entry.result?.metadata.count || 0), 0);
    const inactive = [...imported.entries()].filter(([id, entry]) => id !== asset && entry.result).sort((a,b) => a[1].touched - b[1].touched);
    for (const [, entry] of inactive) {
      if (count <= maxCachedSplats) break;
      count -= entry.result.metadata.count; cancelVoxelBuild(entry); entry.voxel?.dispose(); entry.voxel = null; entry.voxelKey = entry.voxelFailedKey = null; entry.editorController?.abort(); entry.editor?.dispose(); entry.editor = null; entry.editorPromise = null; entry.result.dispose(); entry.result = null;
    }
  }
  function ensureImported(id) {
    const definition = IMPORTED_SCENES[id];
    if (!definition || destroyed) return;
    let entry = imported.get(id);
    if (!entry) { entry = { result:null, promise:null, controller:null, touched:0, voxel:null, voxelKey:null, voxelRequested:null, voxelFailedKey:null, voxelController:null, voxelTimer:0, editor:null, editorPromise:null, editorController:null, snapshotKey:'' }; imported.set(id, entry); }
    entry.touched = ++cacheClock;
    try { if (renderMode !== 'voxels') ensureSpark(); } catch (error) { report(error); emitAsset(id, 'error', 'The native splat renderer could not start.'); return; }
    if (entry.result) { if (!entry.editor) { ensurePointEditor(id,entry); return; } arrangeScene(); emitPoints(id,entry,{snapshot:entry.editor.getSnapshot(),changed:false}); if (renderMode === 'voxels') scheduleVoxel(true, true); else emitAsset(id, 'ready'); requestDraw(); return; }
    if (entry.promise) { emitAsset(id, 'loading'); return; }
    const controller = new AbortController();
    entry.controller = controller;
    emitAsset(id, 'loading', 'LOADING ORIGINAL SPLATS');
    entry.promise = createSnowGlobe({assetPrefix:definition.assetPrefix,signal:controller.signal,
      onProgress(update) {
        if (update.stage === 'ready') return;
        emitAsset(id, 'loading', update.stage === 'decode' ? 'PREPARING SPLATS' : `LOADING ${Math.round(update.progress * 100)}%`);
      }
    }).then(result => {
      if (destroyed) { result.dispose(); return; }
      entry.result = result;
      result.group.visible = false;
      importedPivot.add(result.group);
      trimImportedCache();
      if (asset === id) { arrangeScene(); applyPose(); ensurePointEditor(id,entry); requestDraw(); }
    }).catch(error => {
      if (destroyed || error?.name === 'AbortError') return;
      emitAsset(id, 'error', `${definition.title} could not load. Select it again to retry.`);
      console.error(`${definition.title} load failed:`, error);
    }).finally(() => {
      if (entry.controller === controller) { entry.promise = null; entry.controller = null; }
    });
  }
  function emitPoints(id,entry,update={}) {
    if (destroyed || id !== asset) return;
    const summary = entry?.editor?.getSummary() || {total:entry?.result?.metadata.count || 0,visible:0,selected:0,deleted:0,groups:[],histogram:Array(32).fill(0),selectedHistogram:Array(32).fill(0),canUndo:false,busy:!!entry?.editorPromise};
    canvas.dataset.pointSelected=String(summary.selected); canvas.dataset.pointDeleted=String(summary.deleted); canvas.dataset.editTool=editTool;
    onPointEdit?.({asset:id,...update,changed:!!update.changed,summary:{...summary,tool:editTool}});
  }
  function ensurePointEditor(id,entry) {
    if (entry.editorPromise || !entry.result || destroyed) return;
    const source=entry.result, controller=new AbortController(); entry.editorController=controller;
    emitAsset(id,'loading','PREPARING POINT TOOLS');
    entry.editorPromise=createPointEditor(source.mesh,{signal:controller.signal,snapshot:pointEdits[id],onDirty:requestDraw,
      onProgress(progress){if(entry.result===source && !controller.signal.aborted)emitAsset(id,'loading',`PREPARING POINT TOOLS ${Math.round(progress*100)}%`);},
      onChange(update){
        if(destroyed || entry.result!==source || !entry.editor)return;
        if(update.snapshot){pointEdits[id]=update.snapshot;entry.snapshotKey=JSON.stringify(update.snapshot);}
        if(update.deletedChanged){cancelVoxelBuild(entry);entry.voxelFailedKey=null;arrangeScene();if(id===asset)scheduleVoxel(true,true);}
        emitPoints(id,entry,update);requestDraw();
      }
    }).then(editor=>{
      if(destroyed || controller.signal.aborted || entry.result!==source){editor.dispose();return;}
      entry.editor=editor; importedPivot.add(editor.group);
      // Settings can arrive while extraction yields; hydrate the newest saved edits.
      if(JSON.stringify(pointEdits[id] || {})!==entry.preparingSnapshotKey)editor.replaceSnapshot(pointEdits[id]);
      const snapshot=editor.getSnapshot();pointEdits[id]=snapshot;entry.snapshotKey=JSON.stringify(snapshot);
      if(id===asset){arrangeScene();emitPoints(id,entry,{snapshot,changed:false});if(renderMode==='voxels')scheduleVoxel(true,true);else emitAsset(id,'ready');requestDraw();}
      else editor.group.visible=false;
    }).catch(error=>{if(!destroyed && !controller.signal.aborted && entry.result===source){emitAsset(id,'error','Point tools could not prepare. Select this scene again to retry.');emitPoints(id,entry,{message:'Point tools could not prepare.'});console.error('Point tools failed:',error);}})
      .finally(()=>{if(entry.editorController===controller){entry.editorController=null;entry.editorPromise=null;}});
    entry.preparingSnapshotKey=JSON.stringify(pointEdits[id] || {});emitPoints(id,entry);
  }
  function cancelVoxelBuild(entry) {
    clearTimeout(entry.voxelTimer); entry.voxelTimer = 0;
    entry.voxelController?.abort(); entry.voxelController = null; entry.voxelRequested = null;
  }
  function voxelSpec() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    const columns = Math.max(1, Math.round(rect.width / PIXEL_PITCH));
    const rows = Math.max(1, Math.round(rect.height / PIXEL_PITCH));
    // Match the same camera distance used in applyPose(), including narrow
    // panes. Geometry approximates one display cell at the turntable plane.
    const aspect = Math.max(1, Math.round(rect.width)) / Math.max(1, Math.round(rect.height));
    const distance = Math.max(7.5, 5.4 / Math.max(.25, aspect)) / zoom;
    const voxelSize = voxelScale * 2 * distance * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / rows;
    const editRevision=imported.get(asset)?.editor?.deleteRevision || 0;
    return { columns, rows, voxelSize, editRevision, key:`${columns}x${rows}:${voxelSize.toPrecision(9)}:edit${editRevision}` };
  }
  function scheduleVoxel(immediate = false, retry = false) {
    if (destroyed || contextLost || renderMode !== 'voxels' || !isImported(asset)) return;
    const id = asset, entry = imported.get(id), spec = voxelSpec();
    if (!entry?.result || !entry.editor || !spec) return;
    if (entry.voxelKey === spec.key && entry.voxel) {
      if (entry.voxelRequested && entry.voxelRequested !== spec.key) cancelVoxelBuild(entry);
      entry.voxelFailedKey = null;
      if (immediate || canvas.dataset.sceneStatus !== 'ready') emitAsset(id, 'ready');
      return;
    }
    if (entry.voxelRequested === spec.key && (entry.voxelTimer || entry.voxelController)) return;
    // A failed pitch stays failed during playback/orbit. A new pitch or an
    // explicit mode/asset retry can rebuild it without an automatic retry loop.
    if (!retry && entry.voxelFailedKey === spec.key) return;
    cancelVoxelBuild(entry); entry.voxelRequested = spec.key; entry.voxelFailedKey = null;
    emitAsset(id, 'loading', `VOXEL GRID ${spec.columns} × ${spec.rows}`);
    entry.voxelTimer = setTimeout(() => {
      entry.voxelTimer = 0;
      if (destroyed || contextLost || asset !== id || renderMode !== 'voxels' || entry.voxelRequested !== spec.key) return;
      const source = entry.result, controller = new AbortController(); entry.voxelController = controller;
      createVoxelTest(source.mesh, { voxelSize:spec.voxelSize, signal:controller.signal,
        onProgress(update) {
          if (controller.signal.aborted || entry.voxelController !== controller || asset !== id || renderMode !== 'voxels' || update.stage === 'ready') return;
          emitAsset(id, 'loading', `VOXELIZING ${Math.round(update.progress * 100)}% / ${spec.columns} × ${spec.rows}`);
        }
      }).then(result => {
        if (destroyed || controller.signal.aborted || asset !== id || renderMode !== 'voxels' || entry.result !== source || entry.voxelController !== controller || entry.voxelRequested !== spec.key) { result.dispose(); return; }
        const previous = entry.voxel;
        result.metadata.gridColumns = spec.columns; result.metadata.gridRows = spec.rows; result.metadata.editRevision = spec.editRevision;
        entry.voxel = result; entry.voxelKey = spec.key; entry.voxelFailedKey = null;
        importedPivot.add(result.group); previous?.dispose();
        arrangeScene(); emitAsset(id, 'ready'); requestDraw();
      }).catch(error => {
        if (destroyed || controller.signal.aborted || error?.name === 'AbortError' || asset !== id || renderMode !== 'voxels' || entry.voxelController !== controller) return;
        entry.voxelFailedKey = spec.key;
        emitAsset(id, 'error', 'The voxel geometry could not build. Select VFD VOXELS again to retry.');
        console.error('Pane voxel geometry failed:', error);
      }).finally(() => { if (entry.voxelController === controller) { entry.voxelController = null; entry.voxelRequested = null; } });
    }, immediate ? 0 : 180);
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const native = isNativeScene(asset);
    const nextWidth = Math.max(1, Math.round(rect.width / (native ? 1 : PIXEL_PITCH)));
    const nextHeight = Math.max(1, Math.round(rect.height / (native ? 1 : PIXEL_PITCH)));
    const nextDpr = native && Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0 ? window.devicePixelRatio : 1;
    if (width !== nextWidth || height !== nextHeight || dpr !== nextDpr) {
      clearLasso(); width = nextWidth; height = nextHeight; dpr = nextDpr;
      renderer.setPixelRatio(dpr); renderer.setSize(width, height, false);
      camera.aspect = width / height; camera.updateProjectionMatrix(); applyPose(); scheduleVoxel();
    }
    canvas.dataset.scenePixelRatio = String(dpr);
    canvas.dataset.sceneResolution = native ? 'native' : 'display-pixels';
    return true;
  }
  function clearMapMarker(){
    canvas.dataset.mapMarkerVisible='false';
    onMapMarker?.(null);
  }
  function emitMapMarker(marker,renderCamera=camera){
    if(!marker?.position||marker.position.length!==3||!marker.position.every(Number.isFinite)){clearMapMarker();return;}
    markerProjected.set(...marker.position).project(renderCamera);
    markerCameraSpace.set(...marker.position).applyMatrix4(renderCamera.matrixWorldInverse);
    const finiteProjection=[markerProjected.x,markerProjected.y,markerProjected.z].every(Number.isFinite);
    const visible=(directOperate||!!marker.visible)&&finiteProjection&&markerCameraSpace.z<0&&Math.abs(markerProjected.x)<=1&&Math.abs(markerProjected.y)<=1&&Math.abs(markerProjected.z)<=1;
    const screen={x:finiteProjection?clamp((markerProjected.x+1)/2,0,1):.5,y:finiteProjection?clamp((1-markerProjected.y)/2,0,1):.5};
    canvas.dataset.mapMarkerX=String(marker.position[0]);canvas.dataset.mapMarkerZ=String(marker.position[2]);canvas.dataset.mapMarkerVisible=String(visible);
    onMapMarker?.({...marker,screen,visible});
  }
  function render(time=0) {
    scheduled = 0;
    if (destroyed || contextLost || document.hidden) return;
    try {
      if (!resize()) {clearDroneInput();mapResult?.suspendMarkerAnimation?.();clearMapMarker();return;}
      const mapAnimating=isMap(asset)&&mapResult?.updateAnimation?.(time);
      const marker=isMap(asset)?mapResult?.getMarkerState?.():null;
      let renderCamera=camera;
      if(directOperate&&directView.update(marker,time,width/Math.max(1,height))){
        directView.render(renderer,scene,width,height);renderCamera=directView.cameras.chase;
      }else{if(directOperate)setDirectOperate(false);renderer.render(scene,camera);}
      canvas.dataset.rendererStatus = 'ready';
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      emitMapMarker(marker,renderCamera);
      canvas.dispatchEvent(new CustomEvent('cube-renderer-frame'));
      if(mapAnimating||directOperate)requestDraw();
    } catch (error) { report(error); }
  }
  function requestDraw() {
    if (!scheduled && !destroyed && !contextLost && !document.hidden) scheduled = requestAnimationFrame(render);
  }
  function interaction(type) { onInteraction?.({ type }); }
  function updatePose() { applyPose(); emitPose(); scheduleVoxel(); requestDraw(); }
  function mapGroundPoint(clientX,clientY){
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
    mapRaycaster.setFromCamera(new THREE.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),camera);
    // Ground rays near the horizon are ill-conditioned. The front/right preset
    // fallback below uses screen axes on the same ground plane instead.
    if(Math.abs(mapRaycaster.ray.direction.y)<.04)return null;
    const hit=mapRaycaster.ray.intersectPlane(mapGround,new THREE.Vector3());
    return hit&&hit.distanceTo(camera.position)<60?hit:null;
  }
  function insideMapSpot(clientX,clientY){
    if(!mapSettings.enabled)return false;
    const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return false;
    const spot=mapSpot(mapSettings),hit=mapGroundPoint(clientX,clientY),ring=[],point=new THREE.Vector3();
    // A visible portion stays pannable even if another arc is behind the camera.
    if(hit&&Math.hypot(hit.x-spot.x,hit.z-spot.z)<=spot.radius)return true;
    // Project the actual ground circle. A small screen-space touch envelope
    // remains usable when FRONT/RIGHT foreshorten it almost to a line.
    for(let index=0;index<64;index++){
      const angle=index/64*TAU;point.set(spot.x+Math.cos(angle)*spot.radius,-1,spot.z+Math.sin(angle)*spot.radius).project(camera);
      if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||point.z<-1||point.z>1)return false;
      ring.push([rect.left+(point.x+1)*rect.width/2,rect.top+(1-point.y)*rect.height/2]);
    }
    let inside=false;
    for(let index=0,previous=ring.length-1;index<ring.length;previous=index++){
      const [ax,ay]=ring[previous],[bx,by]=ring[index],dx=bx-ax,dy=by-ay;
      if((ay>clientY)!==(by>clientY)&&clientX<(bx-ax)*(clientY-ay)/(by-ay)+ax)inside=!inside;
      const t=clamp(((clientX-ax)*dx+(clientY-ay)*dy)/Math.max(1e-12,dx*dx+dy*dy),0,1);
      if(Math.hypot(clientX-ax-t*dx,clientY-ay-t*dy)<=8)return true;
    }
    return inside;
  }
  function panMap(fromX,fromY,toX,toY){
    const from=mapGroundPoint(fromX,fromY),to=mapGroundPoint(toX,toY);let delta;
    if(from&&to)delta=to.sub(from);
    else{
      const rect=canvas.getBoundingClientRect(),right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0),up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      right.y=up.y=0;right.normalize();
      if(up.lengthSq()<.001){camera.getWorldDirection(up);up.y=0;}up.normalize();
      const scale=2*camera.position.distanceTo(new THREE.Vector3(0,-1,0))*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/Math.max(1,rect.height);
      delta=right.multiplyScalar((toX-fromX)*scale).add(up.multiplyScalar((fromY-toY)*scale));
    }
    if(Number.isFinite(delta.x)&&Number.isFinite(delta.z))changeMapTranslation({x:mapTranslation.x+delta.x/mapZoom,z:mapTranslation.z+delta.z/mapZoom},true);
  }
  function pointOnCanvas(event){const rect=canvas.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function selectionMode(event){return event.altKey?'subtract':event.shiftKey?'add':'replace';}
  function drawLasso(){
    if(polygon.length<1){lassoOverlay.visible=false;requestDraw();return;}
    const rect=canvas.getBoundingClientRect(),vertices=[],colors=[],lineColor=new THREE.Color('#b9ffe2');
    const path=selectionGesture?.path?.length>1?selectionGesture.path:polygon;
    const overlay=document.getElementById?.('selection-overlay');
    if(overlay){overlay.dataset.points=JSON.stringify(path.map(point=>[point.x,point.y]));lassoOverlay.visible=false;requestDraw();return;}
    for(let i=0;i<path.length-1;i++)appendSegment(vertices,colors,path[i].x,path[i].y,path[i+1].x,path[i+1].y,PIXEL_PITCH*1.3,lineColor);
    if(path.length>1)appendSegment(vertices,colors,path.at(-1).x,path.at(-1).y,path[0].x,path[0].y,PIXEL_PITCH*.7,lineColor);
    for(const point of path)appendSegment(vertices,colors,point.x-2,point.y,point.x+2,point.y,3,lineColor);
    for(let i=0;i<vertices.length;i+=3){vertices[i]=vertices[i]/rect.width*2-1;vertices[i+1]=1-vertices[i+1]/rect.height*2;}
    lassoGeometry.dispose();lassoGeometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));lassoOverlay.visible=true;requestDraw();
  }
  function clearLasso(){selectionGesture=null;polygon=[];lassoOverlay.visible=false;const overlay=document.getElementById?.('selection-overlay');if(overlay)overlay.dataset.points='[]';requestDraw();}
  function cancelPointGesture(){clearLasso();imported.get(asset)?.editor?.cancel();const previous=dragging;dragging=null;if(previous&&canvas.hasPointerCapture(previous.id))canvas.releasePointerCapture(previous.id);canvas.style.cursor=isMap(asset)||editTool==='orbit'?'grab':'crosshair';if(previous)emitPose();}
  function runSelection(options){const editor=imported.get(asset)?.editor;if(!editor||contextLost)return;editor.selectScreen({camera,pivot:importedPivot,rect:canvas.getBoundingClientRect(),...options}).catch(error=>{if(!destroyed)emitPoints(asset,imported.get(asset),{message:error.message});});}
  function pointerDown(event) {
    if (directOperate || event.isPrimary === false || event.button !== 0 || contextLost || dragging || selectionGesture) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    if(editTool!=='orbit' && isImported(asset)){
      const editor=imported.get(asset)?.editor;if(!editor||editor.busy)return;
      interaction(editTool);const point=pointOnCanvas(event);canvas.setPointerCapture(event.pointerId);
      selectionGesture={id:event.pointerId,start:point,last:point,path:[point],mode:selectionMode(event)};
      if(editTool==='lasso'){if(!polygon.length)polygonMode=selectionGesture.mode;polygon.push(point);drawLasso();}return;
    }
    const mode=isMap(asset)?(insideMapSpot(event.clientX,event.clientY)?'pan':'orbit'):'orbit';
    canvas.setPointerCapture(event.pointerId); dragging = { id: event.pointerId, x: event.clientX, y: event.clientY,mode };
    canvas.style.cursor = 'grabbing'; interaction('drag');emitPose();
  }
  function pointerMove(event) {
    if(directOperate)return;
    if(selectionGesture && event.pointerId===selectionGesture.id){const point=pointOnCanvas(event);selectionGesture.last=point;
      if(editTool==='lasso'&&Math.hypot(point.x-selectionGesture.path.at(-1).x,point.y-selectionGesture.path.at(-1).y)>=2){selectionGesture.path.push(point);drawLasso();}return;}
    if (!dragging || event.pointerId !== dragging.id) return;
    const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
    if(isMap(asset)){
      if(dx||dy){if(dragging.mode==='pan')panMap(dragging.x,dragging.y,event.clientX,event.clientY);else{mapYaw=(mapYaw-dx*.008)%TAU;mapPitch=clamp(mapPitch+dy*.007,0,Math.PI/2-.01);mapCustomView=true;updatePose();}}
      dragging.x=event.clientX;dragging.y=event.clientY;return;
    }
    dragging.x = event.clientX; dragging.y = event.clientY;
    if (dx || dy) customView = true;
    yaw += dx * .008; pitch = clamp(pitch + dy * .007, -1.45, 1.45); updatePose();
  }
  function pointerEnd(event) {
    if(selectionGesture && event.pointerId===selectionGesture.id){
      const gesture=selectionGesture;selectionGesture=null;
      if(event.type==='pointercancel'||event.type==='lostpointercapture'){clearLasso();return;}
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      if(editTool==='select')runSelection({point:gesture.last,mode:gesture.mode});
      else if(gesture.path.length>=3 && gesture.path.some(point=>Math.hypot(point.x-gesture.start.x,point.y-gesture.start.y)>=4)){const path=gesture.path;clearLasso();runSelection({polygon:path,mode:gesture.mode});}
      else drawLasso();return;
    }
    if (!dragging || event.pointerId !== dragging.id) return;
    dragging = null; canvas.style.cursor = isMap(asset)||editTool==='orbit'?'grab':'crosshair';
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);emitPose();
  }
  function wheel(event) {
    if (contextLost) return;
    if(directOperate){event.preventDefault();return;}
    event.preventDefault(); interaction('wheel');
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? Math.max(canvas.getBoundingClientRect().height, 1) : 1);
    if(isMap(asset))mapZoom=clamp(mapZoom*Math.exp(-delta*.0012),.55,12);else zoom = clamp(zoom * Math.exp(-delta * .0012), .55, 2.2);updatePose();
  }
  function keydown(event) {
    if (contextLost) return;
    if(directOperate){if(event.key.startsWith('Arrow')||['+','=','-','_','Home'].includes(event.key))event.preventDefault();return;}
    if(event.key==='Escape'){event.preventDefault();cancelPointGesture();return;}
    if(event.key==='Enter'&&editTool==='lasso'&&polygon.length>=3){event.preventDefault();const path=polygon.slice(),mode=polygonMode;clearLasso();interaction('lasso');runSelection({polygon:path,mode});return;}
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if(editTool!=='orbit' && isImported(asset) && event.key.startsWith('Arrow'))return;
    if(isMap(asset)&&event.key.startsWith('Arrow')){
      const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];if(!direction)return;
      const rect=canvas.getBoundingClientRect(),x=rect.left+rect.width/2,y=rect.top+rect.height/2,amount=event.shiftKey?72:24;
      event.preventDefault();interaction('keyboard');panMap(x,y,x+direction[0]*amount,y+direction[1]*amount);return;
    }
    const step = THREE.MathUtils.degToRad(event.shiftKey ? 15 : 5);
    if (event.key === 'ArrowLeft') yaw -= step;
    else if (event.key === 'ArrowRight') yaw += step;
    else if (event.key === 'ArrowUp') pitch = clamp(pitch - step, -1.45, 1.45);
    else if (event.key === 'ArrowDown') pitch = clamp(pitch + step, -1.45, 1.45);
    else if (['+', '='].includes(event.key)) {if(isMap(asset))mapZoom=clamp(mapZoom*1.1,.55,12);else zoom=clamp(zoom*1.1,.55,2.2);}
    else if (['-', '_'].includes(event.key)) {if(isMap(asset))mapZoom=clamp(mapZoom/1.1,.55,12);else zoom=clamp(zoom/1.1,.55,2.2);}
    else if (event.key === 'Home') {cancelPointGesture();if(isMap(asset)){resetMapCamera('iso',true);changeMapTranslation({x:0,z:0},true);}else{view='iso';customView=false;yaw=pitch=0;zoom=1;}}
    else return;
    if (event.key.startsWith('Arrow')) customView = true;
    event.preventDefault(); interaction('keyboard'); updatePose();
  }
  function lost(event) {
    event.preventDefault();setDirectOperate(false);clearDroneInput();cancelPointGesture(); contextLost = true; cancelAnimationFrame(scheduled); scheduled = 0; dragging = null;
    if (spark) { spark.removeFromParent(); spark.dispose(); spark = null; }
    mapResult?.setActive(false);
    clearMapMarker();
    for (const entry of imported.values()) cancelVoxelBuild(entry);
    canvas.dataset.rendererStatus = 'context-lost';
    canvas.dispatchEvent(new CustomEvent('cube-renderer-state', { detail: { available: false } }));
    onError?.(new Error('The graphics connection was interrupted. Waiting for the viewer to recover.'));
  }
  function restored() {
    contextLost = false; lastError = ''; mapResult?.restore();mapResult?.setActive(isMap(asset)); for (const texture of textures) texture.needsUpdate = true;
    for (const entry of imported.values()) { entry.result?.restore(); entry.voxel?.restore(); entry.editor?.restore(); }
    try { if (isImported(asset) && renderMode !== 'voxels') ensureSpark(); } catch (error) { report(error); return; }
    canvas.dataset.rendererStatus = 'ready'; canvas.dispatchEvent(new CustomEvent('cube-renderer-state', { detail: { available: true } })); scheduleVoxel(true, true); requestDraw();
  }
  function visibility() {
    if (document.hidden) {clearDroneInput();cancelAnimationFrame(scheduled); scheduled = 0; mapResult?.suspendMarkerAnimation?.();clearMapMarker(); }
    else requestDraw();
  }
  function blur(){clearDroneInput();mapResult?.suspendMarkerAnimation?.();}
  const observer = new ResizeObserver(requestDraw); observer.observe(canvas);
  window.addEventListener('resize', requestDraw); window.addEventListener('scroll',requestDraw,{passive:true});window.addEventListener('blur',blur); document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('pointerdown', pointerDown); canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerEnd); canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', pointerEnd); canvas.addEventListener('wheel', wheel, { passive: false }); canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('webglcontextlost', lost); canvas.addEventListener('webglcontextrestored', restored);
  const previousTouchAction = canvas.style.touchAction, previousCursor = canvas.style.cursor;
  canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
  canvas.dataset.renderer = 'three'; canvas.dataset.threeRevision = THREE.REVISION; canvas.dataset.rendererStatus = 'ready'; canvas.dataset.cubeAsset = asset;canvas.dataset.directOperate='false';
  paintTextures(); buildDefects(); arrangeScene(); applyLayers(); resize(); applyPose(); emitPose(); requestDraw();

  return {
    setDirectOperate,
    getDirectOperate(){return directOperate;},
    setDroneInput(value={}){if(!directOperate||destroyed||contextLost||document.hidden)return false;const accepted=mapResult?.setDroneInput?.(value);requestDraw();return accepted!==false;},
    clearDroneInput,
    setDirectOperateLayout(value){if(destroyed)return;directView.setLayout(value);if(directOperate)requestDraw();},
    setMapMarkerHeld(value){
      if(directOperate||destroyed||contextLost||!isMap(asset)||!mapResult?.setMarkerHeld)return false;
      const next=!!value;if(mapResult.getMarkerState?.().held===next)return true;
      const accepted=mapResult.setMarkerHeld(next);if(accepted!==false)requestDraw();return accepted!==false;
    },
    focusMapMarker(){
      if(directOperate||destroyed||contextLost||!isMap(asset))return false;
      const marker=mapResult?.getMarkerState?.(),source=marker?.sourcePosition;
      if(!source||source.length!==3||!source.every(Number.isFinite))return false;
      cancelPointGesture();mapZoom=Math.max(4,mapZoom);
      const spot=mapSpot(mapSettings),scan=mapScan();
      // Geometry zoom pivots around the fixed projector. Translation is in
      // source coordinates, and the scan remains a separate additive offset.
      changeMapTranslation({x:spot.x-source[0]-scan.x,z:spot.z-source[2]-scan.z},true);
      updatePose();return true;
    },
    setMapZoom(value){if(destroyed||directOperate)return;mapZoom=clamp(finite(value,mapZoom),.55,12);mapResult?.setZoom?.(mapZoom);if(isMap(asset))updatePose();},
    getMapZoom(){return mapZoom;},
    setMapTranslation(value={}){if(!destroyed&&!directOperate)changeMapTranslation(value);},
    getMapTranslation(){return{...mapTranslation};},
    setHologramSettings(patch={}){if(destroyed)return;const next={...mapSettings};if(typeof patch.enabled==='boolean')next.enabled=patch.enabled;for(const [key,min,max]of[['x',-1,1],['z',-1,1],['radius',.2,1],['height',1,5],['intensity',.2,3],['edge',0,3],['pathGain',0,1],['falloff',0,8]])if(patch[key]!==undefined)next[key]=clamp(finite(patch[key],next[key]),min,max);mapSettings=next;mapResult?.setSettings(directOperate?{...next,enabled:false}:next);if(isMap(asset))updatePose();},
    /** Shows a replay built by buildReplay() (mcap-replay.js) in the SLAM replay capture. */
    loadReplay(data){
      if(destroyed)return false;
      if(!mapResult)ensureMap();
      if(!replay){replay=createReplayScene();mapResult.overlays.add(replay.group);}
      const source=replaySource(data,mapSpot(mapSettings));
      replayData={...data,source};replay.load(data,{fit:source.fit,cloud:false});replayShown=-1;sourceKey='';
      canvas.dataset.replayFrames=String(data.frames.length);canvas.dataset.replayPoints=String(data.pointCount);
      if(isReplay(asset)){applySource();arrangeScene();applyPose();emitAsset(asset,'ready');}
      requestDraw();return true;
    },
    getReplayFrame(){return replay?.frameInfo()??null;},
    retryMap(){if(destroyed)return;if(!mapResult&&isMap(asset))ensureMap();else mapResult?.retry();},
    getMapStatus(){return mapResult?.getStatus() || mapState || {status:'idle',loadedTiles:0,totalTiles:9,pendingTiles:0,buildingCount:0,estimatedHeights:0,taggedColors:0,error:''};},
    setVoxelScale(value){if(destroyed)return;const next=clamp(finite(value,voxelScale),.25,8);if(next===voxelScale)return;voxelScale=next;canvas.dataset.voxelScale=String(next);scheduleVoxel();if(isMap(asset))applyPose();requestDraw();},
    setEditTool(tool){if(destroyed||tool===editTool||!['orbit','select','lasso'].includes(tool))return;cancelPointGesture();editTool=tool;canvas.style.cursor=tool==='orbit'?'grab':'crosshair';emitPoints(asset,imported.get(asset));},
    setPointEdits(edits={}){if(destroyed)return;pointEdits={...edits};for(const [id,entry]of imported){if(!entry.editor)continue;const key=JSON.stringify(pointEdits[id]||{});if(key!==entry.snapshotKey){entry.snapshotKey=key;entry.editor.replaceSnapshot(pointEdits[id]);}}},
    deleteSelected(){return imported.get(asset)?.editor?.deleteSelected();},
    restorePoints(){return imported.get(asset)?.editor?.restorePoints();},
    undoEdit(){return imported.get(asset)?.editor?.undo();},
    clearSelection(){return imported.get(asset)?.editor?.clearSelection();},
    selectAll(){return imported.get(asset)?.editor?.selectAll();},
    createGroup(name){return imported.get(asset)?.editor?.createGroup(name);},
    selectGroup(id){return imported.get(asset)?.editor?.selectGroup(id);},
    removeGroup(id){return imported.get(asset)?.editor?.removeGroup(id);},
    setRenderMode(mode) {
      if (destroyed) return;
      const nextMode = mode === 'splats' ? 'vfd' : mode;
      if (!['voxels','vfd','smooth'].includes(nextMode)) return;
      if (renderMode !== nextMode) {
        cancelPointGesture();for (const entry of imported.values()) cancelVoxelBuild(entry);
        renderMode = nextMode; arrangeScene();
      }
      if (isImported(asset)) ensureImported(asset);
      requestDraw();
    },
    setFrame(progress) {
      if (destroyed || directOperate) return;
      frame = clamp(finite(progress, frame), 0, 1); updatePose();
    },
    setLayers(patch = {}) {
      if (destroyed) return;
      for (const key of Object.keys(layers)) if (typeof patch[key] === 'boolean') layers[key] = patch[key];
      applyLayers(); requestDraw();
    },
    setAppearance(patch = {}) {
      if (destroyed) return;
      const nextMark = MARKS.includes(patch.mark) ? patch.mark : mark;
      const nextDensity = Math.round(clamp(finite(patch.density, density), 12, 48));
      if (nextMark === mark && nextDensity === density) return;
      mark = nextMark; density = nextDensity; paintTextures(); requestDraw();
    },
    setView(name) {
      if (destroyed || directOperate || !Object.hasOwn(VIEWS, name)) return;
      cancelPointGesture();if(isMap(asset))resetMapCamera(name);else{view = name; customView = false; yaw = pitch = 0;}updatePose();
    },
    setAsset(id) {
      if (destroyed || !ASSETS.includes(id)) return;
      if (id === asset) { if (isImported(id)) ensureImported(id);else if(isMap(id))ensureMap(); return; }
      setDirectOperate(false);clearDroneInput();cancelPointGesture();for (const entry of imported.values()) cancelVoxelBuild(entry);
      asset = id; canvas.dataset.cubeAsset = id; emitPoints(id,imported.get(id));
      arrangeScene();
      if (isImported(id)) ensureImported(id);
      else if(isMap(id))ensureMap();
      else { canvas.dataset.sceneStatus = 'ready'; onAssetState?.({asset:id,status:'ready'}); paintTextures(); buildDefects(); }
      updatePose();
    },
    resetView() {
      if (destroyed || directOperate) return;
      cancelPointGesture();if(isMap(asset)){resetMapCamera('iso',true);changeMapTranslation({x:0,z:0},true);}else{view='iso';customView=false;yaw=pitch=0;zoom=1;}updatePose();
    },
    destroy() {
      if (destroyed) return;
      setDirectOperate(false);clearDroneInput();destroyed = true;directView.dispose();clearMapMarker();cancelPointGesture();mapResult?.dispose();mapResult=null;replay?.dispose();replay=null;
      if (spark) { spark.removeFromParent(); spark.dispose(); spark = null; }
      for (const entry of imported.values()) { cancelVoxelBuild(entry); entry.voxel?.dispose(); entry.controller?.abort(); entry.editorController?.abort(); entry.editor?.dispose(); entry.result?.dispose(); }
      imported.clear();
      cancelAnimationFrame(scheduled); observer.disconnect();
      window.removeEventListener('resize', requestDraw); window.removeEventListener('scroll',requestDraw);window.removeEventListener('blur',blur); document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', pointerDown); canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerEnd); canvas.removeEventListener('pointercancel', pointerEnd); canvas.removeEventListener('lostpointercapture', pointerEnd);
      canvas.removeEventListener('wheel', wheel); canvas.removeEventListener('keydown', keydown);
      canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored);
      for (const item of faceViews) item.defectMesh.geometry.dispose();
      for (const resource of resources) resource.dispose?.(); renderer.dispose();
      canvas.style.touchAction = previousTouchAction; canvas.style.cursor = previousCursor; canvas.dataset.rendererStatus = 'disposed';
    }
  };
}

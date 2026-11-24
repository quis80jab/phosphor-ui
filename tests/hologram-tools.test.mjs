import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mountHologramTools } from '../dist/hologram-tools.js';
import { normalizeViewerState, saveViewerState, loadViewerState } from '../dist/viewer-state.js';

// Use the real markup's IDs/range limits so a controller/HTML mismatch fails here.
const html = await readFile(new URL('../dist/viewer.html', import.meta.url), 'utf8');
const fields = ['zoom','x','z','radius','height','intensity','edge','pathGain','falloff'];
const clone = value => JSON.parse(JSON.stringify(value));
class Control extends EventTarget {
  constructor(attributes) {
    super(); this.attributes = new Map(Object.entries(attributes));
    this.value = attributes.value ?? ''; this.min = attributes.min ?? ''; this.max = attributes.max ?? '';
    this.disabled = Object.hasOwn(attributes,'disabled'); this.hidden = Object.hasOwn(attributes,'hidden');
    this.textContent = ''; this.title = '';
  }
  setAttribute(name,value) { this.attributes.set(name,String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}
function setup(initial = {asset:'sf-waterfront'}) {
  const controls = new Map();
  for (const match of html.matchAll(/<[a-z][^>]*\bid="[^"]+"[^>]*>/gi)) {
    const attrs = Object.fromEntries([...match[0].matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(part=>[part[1],part[2]??'']));
    controls.set(attrs.id,new Control(attrs));
  }
  const document = new EventTarget(); document.getElementById = id => controls.get(id) || null;
  const previousDocument = globalThis.document; globalThis.document = document;
  let state = normalizeViewerState(initial), available = true, settingsCalls = [], retryCalls = 0, saves = [], redraws = 0, layouts = 0;
  let viewer = {setHologramSettings(settings){settingsCalls.push(clone(settings));},retryMap(){retryCalls++;}};
  document.addEventListener('viewer-grid-layout',()=>layouts++);
  const controller = mountHologramTools({getState:()=>state,getViewer:()=>viewer,getAvailable:()=>available,
    save:()=>saves.push(clone(state)),refresh:()=>redraws++});
  return {
    controller,controls,get state(){return state;},setState(next){state=normalizeViewerState(next);},
    setAvailable(value){available=value;},setViewer(value){viewer=value;},
    get settingsCalls(){return settingsCalls;},get retryCalls(){return retryCalls;},get saves(){return saves;},
    get redraws(){return redraws;},get layouts(){return layouts;},
    input(field,value){const element=controls.get('holo-'+field);element.value=String(value);element.dispatchEvent(new Event('input'));},
    close(){controller.destroy();globalThis.document=previousDocument;}
  };
}

test('saved projector values hydrate controls and survive real viewer-state storage', () => {
  const saved = {asset:'sf-waterfront',voxelScale:2,notes:'Retain this',hologram:{enabled:false,x:-.35,z:.6,radius:.7,height:4.2,intensity:1.8,edge:.9,pathGain:.31,falloff:2.4,zoom:4.5}};
  const storage = new Map(), previous = globalThis.localStorage;
  globalThis.localStorage = {getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
  assert.equal(saveViewerState(saved).ok,true);
  const loaded=loadViewerState();assert.equal(loaded.warning,undefined);
  const h=setup(loaded.state);
  try {
    for(const field of fields) assert.equal(Number(h.controls.get('holo-'+field).value),saved.hologram[field]);
    assert.equal(h.controls.get('holo-enabled').getAttribute('aria-pressed'),'false');
    assert.equal(h.controls.get('holo-enabled').textContent,'FULL MAP');
    assert.equal(h.controls.get('holo-x-value').textContent,'-35%');
    assert.equal(h.controls.get('holo-z-value').textContent,'60%');
    assert.equal(h.controls.get('holo-radius-value').textContent,'70%');
    assert.equal(h.controls.get('holo-height-value').textContent,'4.2');
    assert.equal(h.controls.get('holo-intensity-value').textContent,'1.8X');
    assert.equal(h.controls.get('holo-pathGain-value').textContent,'31%');
    assert.equal(h.controls.get('holo-falloff-value').textContent,'2.4X');
    assert.equal(h.saves.length,0,'hydration must not overwrite persisted values');
    assert.equal(h.settingsCalls.length,0,'renderer initialization remains with the viewer controller');
  } finally {h.close();globalThis.localStorage=previous;}
});

test('native inputs send bounded settings to the renderer and save without touching other viewer state', () => {
  const h=setup({asset:'sf-waterfront',notes:'Keep',voxelScale:3,frame:.4,renderMode:'smooth'});
  try {
    const before=clone(h.state);delete before.hologram;
    const values={x:-.24,z:.83,radius:.67,height:2.4,intensity:2.2,edge:0,pathGain:.64,falloff:3.2};
    for(const [field,value]of Object.entries(values))h.input(field,value);
    assert.equal(h.settingsCalls.length,8);assert.equal(h.saves.length,8);
    assert.deepEqual(h.settingsCalls.at(-1),{enabled:true,...values,offsetX:0,offsetZ:0,zoom:1});
    const remaining=clone(h.state);delete remaining.hologram;assert.deepEqual(remaining,before);
    h.input('radius',99);assert.equal(h.state.hologram.radius,1);
    h.input('height',-5);assert.equal(h.state.hologram.height,1);
    h.input('falloff',99);assert.equal(h.state.hologram.falloff,8);
    h.input('pathGain',-1);assert.equal(h.state.hologram.pathGain,0);
    const calls=h.settingsCalls.length;h.input('x','not-a-number');assert.equal(h.settingsCalls.length,calls);
    h.controls.get('holo-enabled').click();assert.equal(h.state.hologram.enabled,false);
    assert.equal(h.settingsCalls.at(-1).enabled,false);assert.equal(h.saves.at(-1).hologram.enabled,false);
  }finally{h.close();}
});

test('scene switches swap tool rails, preserve projector state and emit layout changes only when needed',()=>{
  const h=setup({asset:'pumpkin',hologram:{x:.31,radius:.6}});
  try{
    assert.equal(h.controls.get('hologram-tools').hidden,true);assert.equal(h.controls.get('point-tools').hidden,false);
    const initialLayouts=h.layouts,saved=clone(h.state.hologram);
    h.state.asset='sf-waterfront';h.controller.sync();
    assert.equal(h.controls.get('hologram-tools').hidden,false);assert.equal(h.controls.get('point-tools').hidden,true);
    assert.equal(h.layouts,initialLayouts+1);h.controller.sync();assert.equal(h.layouts,initialLayouts+1);
    h.controller.receive({status:'ready',loadedTiles:3,buildingCount:257,estimatedHeights:137,taggedColors:0});
    h.state.asset='calibration';h.controller.sync();assert.equal(h.controls.get('hologram-tools').hidden,true);
    h.state.asset='sf-waterfront';h.controller.sync();
    assert.deepEqual(h.state.hologram,saved);assert.equal(h.controls.get('holo-status').textContent,'MAP READY / DRAG TO SCAN');
    assert.equal(h.saves.length,0,'switching rails does not modify settings');
  }finally{h.close();}
});

test('streaming, partial failure, retry and graphics recovery keep status and controls consistent',()=>{
  const h=setup();
  try{
    h.controller.receive({status:'loading',pendingTiles:2,loadedTiles:1});
    assert.equal(h.controls.get('holo-status').textContent,'STREAMING CONE AREA');assert.equal(h.controls.get('holo-retry').disabled,true);
    h.controller.receive({status:'ready',pendingTiles:0,loadedTiles:2,buildingCount:257,estimatedHeights:137,taggedColors:0,error:'Network interrupted'});
    assert.equal(h.controls.get('holo-status').textContent,'PARTIAL MAP / RETRY AVAILABLE');assert.equal(h.controls.get('holo-retry').disabled,false);
    assert.equal(h.controls.get('holo-status').title,'Network interrupted');
    assert.equal(h.controls.get('holo-data-info').textContent,'2 TILES / 257 BUILDINGS\n0 GLOW CELLS\n137 ESTIMATED HEIGHTS\nHOLOGRAM PALETTE\nROOFS SIMPLIFIED');
    h.controls.get('holo-retry').click();assert.equal(h.retryCalls,1);assert.equal(h.controls.get('holo-retry').disabled,true);
    assert.equal(h.controls.get('holo-status').textContent,'STREAMING CONE AREA');
    h.controller.receive({status:'ready',pendingTiles:0,loadedTiles:3,taggedColors:4});
    assert.match(h.controls.get('holo-data-info').textContent,/4 TAGGED COLORS/);
    h.setAvailable(false);h.controller.sync();
    for(const field of fields)assert.equal(h.controls.get('holo-'+field).disabled,true);
    assert.equal(h.controls.get('holo-enabled').disabled,true);assert.equal(h.controls.get('holo-retry').disabled,true);
    h.setAvailable(true);h.controller.sync();
    for(const field of fields)assert.equal(h.controls.get('holo-'+field).disabled,false);
    assert.equal(h.controls.get('holo-enabled').disabled,false);assert.equal(h.controls.get('holo-retry').disabled,false);
  }finally{h.close();}
});

test('controls tolerate pending renderer creation and destruction removes native event handlers',()=>{
  const h=setup();
  try{
    h.setViewer(null);h.input('edge',2.3);assert.equal(h.state.hologram.edge,2.3);assert.equal(h.saves.length,1);
    h.controller.destroy();const before=clone(h.state),saves=h.saves.length;
    h.input('edge',.2);h.controls.get('holo-enabled').click();h.controls.get('holo-retry').click();
    assert.deepEqual(h.state,before);assert.equal(h.saves.length,saves);assert.equal(h.retryCalls,0);
  }finally{h.close();}
});

test('map scale uses geometry zoom, persists, and keeps projector controls unchanged',()=>{
  const h=setup({asset:'sf-waterfront',hologram:{x:.3,z:-.2,radius:.7}}),zooms=[];
  try{
    h.setViewer({setMapZoom(value){zooms.push(value);},setHologramSettings(){}});
    const before=clone(h.state.hologram);
    h.input('zoom',4.5);
    assert.deepEqual(zooms,[4.5]);assert.equal(h.saves.at(-1).hologram.zoom,4.5);
    assert.equal(h.controls.get('holo-zoom-value').textContent,'4.5X');
    assert.deepEqual({...h.state.hologram,zoom:1},before);
    h.input('zoom',100);assert.equal(zooms.at(-1),12);
    h.input('zoom',0);assert.equal(zooms.at(-1),.55);
  }finally{h.close();}
});

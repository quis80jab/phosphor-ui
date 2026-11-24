import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {createPointEditModel} from '../dist/point-edit-state.js';
import * as THREE from '../dist/vendor/three.module.js';
import {mapSpot} from '../dist/hologram-map.js';

// Exercise controller lifecycle with real Three scene objects; GPU pixels and
// worker aggregation have separate browser and worker tests.
function fixture() {
  const context = new Proxy({}, { get:(object,key)=>object[key]??(()=>{}), set:(object,key,value)=>(object[key]=value,true) });
  class Element {
    constructor(){this.style={};this.dataset={};this.listeners=new Map();this.rect={left:0,top:0,width:1211,height:789};this.captures=new Set();}
    getContext(){return context;} getBoundingClientRect(){return this.rect;}
    addEventListener(name,fn){const entries=this.listeners.get(name)||[];entries.push(fn);this.listeners.set(name,entries);}
    removeEventListener(name,fn){this.listeners.set(name,(this.listeners.get(name)||[]).filter(entry=>entry!==fn));}
    dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event);}
    focus(){} setPointerCapture(id){this.captures.add(id);} hasPointerCapture(id){return this.captures.has(id);} releasePointerCapture(id){this.captures.delete(id);}
  }
  const frames=new Map(),timers=new Map(),sources=[],builds=[],renderers=[],sparks=[],editors=[],maps=[];let nextId=0;
  const globals={document:globalThis.document,window:globalThis.window,ResizeObserver:globalThis.ResizeObserver,requestAnimationFrame:globalThis.requestAnimationFrame,cancelAnimationFrame:globalThis.cancelAnimationFrame};
  globalThis.document=Object.assign(new Element(),{hidden:false,createElement:()=>new Element()});
  globalThis.window=Object.assign(new Element(),{devicePixelRatio:2});
  globalThis.ResizeObserver=class {observe(){}disconnect(){}};
  globalThis.requestAnimationFrame=fn=>{frames.set(++nextId,fn);return nextId;};
  globalThis.cancelAnimationFrame=id=>frames.delete(id);
  globalThis.CubeVoxelTest={mapSpot,
    setTimeout:fn=>{timers.set(++nextId,fn);return nextId;},clearTimeout:id=>timers.delete(id),
    source:options=>new Promise((resolve,reject)=>sources.push({...options,resolve,reject})),
    voxel:(mesh,options)=>new Promise((resolve,reject)=>builds.push({mesh,...options,resolve,reject})),
    editor:async(mesh,options)=>{
      let model=createPointEditModel(mesh.numSplats,options.snapshot),revision=0;
      const group=new THREE.Group(),editor={group,options,disposals:0,restores:0,selections:[],get deleteRevision(){return revision;},getSummary:()=>({...model.getSummary(),histogram:Array(32).fill(0),selectedHistogram:Array(32).fill(0),busy:false}),getSnapshot:()=>model.getSnapshot(),
        get busy(){return false;},cancel(){},restore(){this.restores++;},dispose(){this.disposals++;group.removeFromParent();},
        mutate(fn){const before=model.getSummary(),value=fn();if(before.revision!==model.getSummary().revision){const deletedChanged=before.deleted!==model.getSummary().deleted;if(deletedChanged)revision++;options.onChange({snapshot:model.getSnapshot(),changed:true,deletedChanged});}return value;},
        replaceSnapshot(value){const old=model.getSummary().deleted;model=createPointEditModel(mesh.numSplats,value);const deletedChanged=old!==model.getSummary().deleted;if(deletedChanged)revision++;options.onChange({snapshot:model.getSnapshot(),changed:false,deletedChanged});},
        selectAll(){model.selectAllVisible();options.onChange({changed:false});},clearSelection(){model.clearSelection();options.onChange({changed:false});},
        deleteSelected(){return this.mutate(()=>model.deleteSelected());},undo(){return this.mutate(()=>model.undo());},restorePoints(){return this.mutate(()=>model.restoreDeleted());},
        createGroup(name){return this.mutate(()=>model.createGroup(name));},removeGroup(id){return this.mutate(()=>model.removeGroup(id));},selectGroup(id){model.selectGroup(id);options.onChange({changed:false});},
        async selectScreen(spec){this.selections.push(spec);model.applySelection([0]);options.onChange({changed:false});}
      };editors.push(editor);return editor;
    },
    map:options=>{const group=new THREE.Group(),map={group,options,settings:{},translation:{x:0,z:0},zoom:1,active:true,disposals:0,retries:0,restores:0,metadata:{count:5,bounds:{min:[-2,-1,-2],max:[2,1,2]}},getStatus:()=>({status:'loading',loadedTiles:0,totalTiles:9,buildingCount:0}),setSettings(value){this.settings={...value};},setTranslation(value){this.translation={...value};},setZoom(value){this.zoom=value;},setAppearance(){},setCellSize(value){this.cell=value;},setActive(value){this.active=value;},retry(){this.retries++;},restore(){this.restores++;},dispose(){this.disposals++;group.removeFromParent();}};maps.push(map);return map;},
    Renderer:class {
      constructor(){this.info={render:{calls:1}};this.autoClear=true;this.viewport=new THREE.Vector4();this.scissor=new THREE.Vector4();this.scissorTest=false;this.passes=[];renderers.push(this);}
      setClearColor(){}setPixelRatio(value){this.dpr=value;}setSize(w,h){this.size=[w,h];this.setViewport(0,0,w,h);}
      getViewport(target){return target.copy(this.viewport);}getScissor(target){return target.copy(this.scissor);}getScissorTest(){return this.scissorTest;}
      setViewport(...values){this.viewport.copy(values[0]?.isVector4?values[0]:new THREE.Vector4(...values));}
      setScissor(...values){this.scissor.copy(values[0]?.isVector4?values[0]:new THREE.Vector4(...values));}setScissorTest(value){this.scissorTest=value;}
      render(scene,camera){this.scene=scene;this.camera=camera;const rig=scene.getObjectByName('direct-operate-drone');
        this.passes.push({name:camera.name,camera:camera.clone(),viewport:this.viewport.clone(),scissor:this.scissor.clone(),scissorTest:this.scissorTest,rigVisible:rig?.visible,rigPosition:rig?.position.clone(),rigScale:rig?.scale.clone(),rigQuaternion:rig?.quaternion.clone()});
        if(this.throwCamera===camera.name)throw new Error('render pass failed');
      }
      dispose(){this.disposed=true;}
    },
    Spark:class extends THREE.Group {constructor(options){super();this.options=options;this.disposals=0;sparks.push(this);}dispose(){this.disposals++;}}
  };
  return {Element,frames,timers,sources,builds,renderers,sparks,editors,maps,
    flush(time=0){for(const [id,fn]of [...frames]){frames.delete(id);fn(time);}},
    runTimers(){for(const [id,fn]of [...timers]){timers.delete(id);fn();}},
    restore(){for(const [key,value]of Object.entries(globals)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}delete globalThis.CubeVoxelTest;}
  };
}
async function viewerFactory() {
  const base=new URL('../dist/',import.meta.url);
  let source=await readFile(new URL('cube-renderer.js',base),'utf8');
  source=source.replace(/^import \{ createSnowGlobe \}.*$/m,'const createSnowGlobe=globalThis.CubeVoxelTest.source;');
  source=source.replace(/^import \{ createHologramMap.*$/m,"const createHologramMap=globalThis.CubeVoxelTest.map;const mapSpot=globalThis.CubeVoxelTest.mapSpot;const MAP_DEFAULTS={enabled:true,x:-.3,z:0,radius:.6,height:3,intensity:1,edge:1.4,pathGain:.18,falloff:1};");
  source=source.replace(/^import \{ createPointEditor \}.*$/m,'const createPointEditor=globalThis.CubeVoxelTest.editor;');
  source=source.replace(/^import \{ createVoxelTest \}.*$/m,'const createVoxelTest=globalThis.CubeVoxelTest.voxel;');
  source=source.replace(/^import \{ SparkRenderer \}.*$/m,'const SparkRenderer=globalThis.CubeVoxelTest.Spark;');
  source=source.replace("import * as THREE from './vendor/three.module.js';",`import * as REAL_THREE from ${JSON.stringify(new URL('vendor/three.module.js',base).href)}; const THREE={...REAL_THREE,WebGLRenderer:globalThis.CubeVoxelTest.Renderer};const {setTimeout,clearTimeout}=globalThis.CubeVoxelTest;`);
  for(const file of ['viewer-grid.js','vfd-glyphs.js','imported-scenes.js','direct-operate-renderer.js','mcap-replay-scene.js','scan-sites.js','scan-source.js'])source=source.replace(new RegExp("'\\./"+file.replace('.','\\.')+"[^']*'"),JSON.stringify(new URL(file,base).href));
  return (await import('data:text/javascript;base64,'+Buffer.from(source+'\n//'+Math.random()).toString('base64'))).createCubeViewer;
}
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
function result(id,count=236452,pitch=.01){const group=new THREE.Group();group.name=id;return{group,mesh:{name:id,numSplats:count},metadata:{count,voxelSize:pitch,bounds:{min:[-2,-1,-2],max:[2,1,2]}},disposals:0,restores:0,restore(){this.restores++;},dispose(){this.disposals++;group.removeFromParent();group.clear();}};}

test('native-backed voxel/VFD/smooth modes retain originals and reject stale or failed rebuilds',async t=>{
  const f=fixture();const createViewer=await viewerFactory();
  const canvas=new f.Element(),states=[],viewer=createViewer(canvas,{onAssetState:state=>states.push(state)});t.after(()=>{viewer.destroy();f.restore();});
  f.flush();const gpu=f.renderers[0];assert.deepEqual(gpu.size,[848,552]);assert.equal(gpu.dpr,1);
  viewer.setAsset('pumpkin');assert.equal(canvas.dataset.sceneRenderMode,'voxels');assert.equal(f.sources.length,1);
  const original=result('pumpkin');f.sources[0].resolve(original);await settle();f.runTimers();f.flush();
  assert.deepEqual(gpu.size,[1211,789]);assert.equal(gpu.dpr,2);assert.equal(f.builds.length,1);assert.equal(original.group.visible,false);
  const firstJob=f.builds[0],pitch=2*7.5*Math.tan(37*Math.PI/360)/552;
  assert.ok(Math.abs(firstJob.voxelSize-pitch)<1e-12);
  const first=result('voxel-a',201184,firstJob.voxelSize);firstJob.resolve(first);await settle();f.flush();
  assert.equal(canvas.dataset.sceneVoxels,'201184');assert.equal(canvas.dataset.sceneGridColumns,'848');assert.equal(canvas.dataset.sceneGridRows,'552');
  assert.equal(canvas.dataset.sceneRepresentation,'colored-voxels');assert.equal(first.group.visible,true);
  viewer.setFrame(.7);viewer.setView('front');f.runTimers();f.flush();assert.equal(f.builds.length,1);
  viewer.setLayers({rgb:false});assert.equal(canvas.dataset.sceneMonochrome,'true');
  for(const mode of ['vfd','smooth','splats']){viewer.setRenderMode(mode);f.flush();assert.equal(f.sources.length,1);assert.equal(f.builds.length,1);assert.equal(original.group.visible,true);assert.equal(first.group.visible,false);assert.deepEqual(gpu.size,[1211,789]);assert.equal(gpu.dpr,2);assert.equal(canvas.dataset.sceneRenderMode,mode==='smooth'?'smooth':'vfd');assert.equal(canvas.dataset.sceneVoxels,undefined);}
  viewer.setRenderMode('voxels');f.runTimers();assert.equal(first.group.visible,true);assert.equal(f.builds.length,1);
  const zoom=delta=>canvas.dispatchEvent({type:'wheel',deltaY:delta,deltaMode:0,preventDefault(){}});
  zoom(-50);f.runTimers();assert.equal(f.builds.length,2);assert.equal(first.disposals,0);assert.equal(first.group.visible,true);
  const staleZoom=f.builds.at(-1);viewer.resetView();assert.equal(staleZoom.signal.aborted,true);assert.equal(canvas.dataset.sceneStatus,'ready');
  const late=result('late-zoom',300000);staleZoom.resolve(late);await settle();assert.equal(late.disposals,1);assert.equal(canvas.dataset.sceneVoxels,'201184');
  zoom(-70);f.runTimers();const staleMode=f.builds.at(-1);viewer.setRenderMode('vfd');assert.equal(staleMode.signal.aborted,true);
  const ignored=result('late-mode');staleMode.resolve(ignored);await settle();assert.equal(ignored.disposals,1);assert.equal(original.group.visible,true);
  viewer.setRenderMode('voxels');f.runTimers();const failed=f.builds.at(-1),nativeError=console.error;console.error=()=>{};
  try{failed.reject(new Error('worker test failure'));await settle();}finally{console.error=nativeError;}
  assert.equal(canvas.dataset.sceneStatus,'error');const failedCount=f.builds.length;
  viewer.setFrame(.2);viewer.setView('right');f.runTimers();assert.equal(f.builds.length,failedCount);assert.equal(first.disposals,0);
  viewer.setRenderMode('voxels');f.runTimers();assert.equal(f.builds.length,failedCount+1);
  const retry=f.builds.at(-1),replacement=result('voxel-b',250000,retry.voxelSize);retry.resolve(replacement);await settle();assert.equal(canvas.dataset.sceneStatus,'ready');assert.equal(first.disposals,1);
  canvas.rect.height=701;window.dispatchEvent({type:'resize'});f.flush();f.runTimers();const resized=f.builds.at(-1);assert.notEqual(resized.voxelSize,retry.voxelSize);assert.deepEqual(gpu.size,[1211,701]);assert.equal(replacement.group.visible,true);
  viewer.setAsset('snow-globe');assert.equal(resized.signal.aborted,true);const lateResize=result('late-resize');resized.resolve(lateResize);await settle();assert.equal(lateResize.disposals,1);
  const second=result('snow-globe',330699);f.sources.at(-1).resolve(second);await settle();f.runTimers();const secondJob=f.builds.at(-1);
  viewer.setAsset('pumpkin');assert.equal(secondJob.signal.aborted,true);const lateScene=result('late-scene');secondJob.resolve(lateScene);await settle();assert.equal(lateScene.disposals,1);assert.equal(f.sources.length,2);
  f.runTimers();const beforeLost=f.builds.at(-1);canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});assert.equal(beforeLost.signal.aborted,true);
  canvas.dispatchEvent({type:'webglcontextrestored'});f.runTimers();assert.equal(original.restores,1);assert.equal(replacement.restores,1);const recovering=f.builds.at(-1);assert.notEqual(recovering,beforeLost);
  viewer.destroy();assert.equal(recovering.signal.aborted,true);assert.equal(original.disposals,1);assert.equal(second.disposals,1);assert.equal(replacement.disposals,1);
  const lateRecovery=result('late-recovery');recovering.resolve(lateRecovery);const lateLost=result('late-lost');beforeLost.resolve(lateLost);await settle();assert.equal(lateRecovery.disposals,1);assert.equal(lateLost.disposals,1);assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
  assert.equal(f.sparks.every(spark=>spark.disposals===1),true);
});

test('point edits invalidate only affected geometry; scale, lasso, delete-all, undo and modes preserve original IDs',async t=>{
  const f=fixture();const createViewer=await viewerFactory(),canvas=new f.Element(),updates=[];
  const viewer=createViewer(canvas,{onPointEdit:update=>updates.push(update)});t.after(()=>{viewer.destroy();f.restore();});
  viewer.setPointEdits({pumpkin:{deleted:[],groups:[]}});viewer.setAsset('pumpkin');f.sources[0].resolve(result('pumpkin',4));await settle();f.flush();f.runTimers();
  const originalJob=f.builds.at(-1),first=result('initial',4,originalJob.voxelSize);originalJob.resolve(first);await settle();const editor=f.editors[0];
  assert.equal(updates.at(-1).changed,false);assert.ok(updates.at(-1).snapshot);
  viewer.selectAll();const group=viewer.createGroup('All original IDs');const buildCount=f.builds.length;f.runTimers();assert.equal(f.builds.length,buildCount);
  viewer.setVoxelScale(2);f.runTimers();const scaleJob=f.builds.at(-1);assert.equal(scaleJob.voxelSize,originalJob.voxelSize*2);assert.equal(first.group.visible,true);
  viewer.deleteSelected();assert.equal(scaleJob.signal.aborted,true);assert.equal(first.group.visible,false);assert.equal(updates.at(-1).summary.deleted,4);assert.equal(updates.at(-1).summary.canUndo,true);assert.equal(updates.at(-1).changed,true);
  f.runTimers();const emptyJob=f.builds.at(-1),empty=result('empty',0,emptyJob.voxelSize);emptyJob.resolve(empty);await settle();assert.equal(canvas.dataset.sceneVoxels,'0');assert.equal(canvas.dataset.sceneStatus,'ready');
  const stale=result('stale-before-delete',4);scaleJob.resolve(stale);await settle();assert.equal(stale.disposals,1);
  viewer.setRenderMode('vfd');assert.equal(canvas.dataset.sceneRepresentation,'gaussian-splats');assert.equal(updates.at(-1).summary.deleted,4);
  viewer.undoEdit();assert.equal(updates.at(-1).summary.deleted,0);assert.equal(updates.at(-1).summary.selected,4);viewer.clearSelection();viewer.selectGroup(group);assert.equal(updates.at(-1).summary.selected,4);
  viewer.setRenderMode('voxels');f.runTimers();assert.equal(f.builds.at(-1).voxelSize,originalJob.voxelSize*2);
  viewer.setEditTool('lasso');const pointer=(type,x,y)=>canvas.dispatchEvent({type,clientX:x,clientY:y,pointerId:1,button:0,preventDefault(){}});
  pointer('pointerdown',10,10);pointer('pointerup',10,10);pointer('pointerdown',50,10);pointer('pointerup',50,10);pointer('pointerdown',30,50);pointer('pointerup',30,50);
  canvas.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});await settle();assert.equal(editor.selections.at(-1).polygon.length,3);
  pointer('pointerdown',10,10);pointer('pointermove',40,10);pointer('pointermove',40,40);pointer('pointermove',10,40);pointer('pointermove',10,10);pointer('pointerup',10,10);await settle();assert.equal(editor.selections.at(-1).polygon.length,5);
  pointer('pointerdown',10,10);pointer('pointerup',10,10);canvas.dispatchEvent({type:'keydown',key:'Escape',preventDefault(){}});const selectionCount=editor.selections.length;canvas.dispatchEvent({type:'keydown',key:'Enter',preventDefault(){}});assert.equal(editor.selections.length,selectionCount);
  viewer.setAsset('snow-globe');const updateCount=updates.length;editor.options.onChange({changed:false});assert.equal(updates.length,updateCount);
  viewer.setAsset('pumpkin');assert.equal(updates.at(-1).summary.groups.length,1);viewer.selectAll();viewer.deleteSelected();viewer.restorePoints();assert.equal(updates.at(-1).summary.deleted,0);
});

test('point preparation cannot attach after cache eviction or destruction; newest saved edits hydrate once ready',async t=>{
  const f=fixture(),pending=[],makeEditor=globalThis.CubeVoxelTest.editor;
  globalThis.CubeVoxelTest.editor=(mesh,options)=>new Promise((resolve,reject)=>pending.push({mesh,options,resolve,reject}));
  const createViewer=await viewerFactory(),canvas=new f.Element(),updates=[],viewer=createViewer(canvas,{onPointEdit:update=>updates.push(update)});t.after(()=>{viewer.destroy();f.restore();});
  viewer.setAsset('pumpkin');f.sources[0].resolve(result('pumpkin',236452));await settle();assert.equal(pending.length,1);
  viewer.setPointEdits({pumpkin:{deleted:[[0,9]],groups:[]}});
  const first=await makeEditor(pending[0].mesh,pending[0].options);pending[0].resolve(first);await settle();assert.equal(updates.at(-1).summary.deleted,10);assert.equal(updates.at(-1).changed,false);
  viewer.setAsset('snow-globe');f.sources.at(-1).resolve(result('snow-globe',330699));await settle();assert.equal(pending.length,2);
  viewer.setAsset('shopping-center');f.sources.at(-1).resolve(result('shopping-center',1989008));await settle();assert.equal(pending.length,3);
  assert.equal(pending[1].options.signal.aborted,true);const oldUpdateCount=updates.length,evicted=await makeEditor(pending[1].mesh,pending[1].options);pending[1].resolve(evicted);await settle();assert.equal(evicted.disposals,1);assert.equal(updates.length,oldUpdateCount);
  viewer.destroy();assert.equal(pending[2].options.signal.aborted,true);const late=await makeEditor(pending[2].mesh,pending[2].options);pending[2].resolve(late);await settle();assert.equal(late.disposals,1);assert.equal(first.disposals,1);
});

test('map scans beneath a fixed native camera, suspends streaming offscreen, and never enters splat editing',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),states=[],viewer=createViewer(canvas,{onAssetState:update=>states.push(update)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setHologramSettings({x:.6,height:5,pathGain:.6,falloff:3.2});viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0];assert.equal(map.settings.x,.6);assert.equal(map.settings.height,5);assert.equal(map.settings.pathGain,.6);assert.equal(map.settings.falloff,3.2);viewer.setHologramSettings({pathGain:0,falloff:8});assert.equal(map.settings.pathGain,0);assert.equal(map.settings.falloff,8);assert.deepEqual(f.renderers[0].size,[1211,789]);assert.equal(f.renderers[0].dpr,2);assert.equal(canvas.dataset.sceneRepresentation,'osm-buildings');assert.equal(f.sources.length,0);assert.equal(f.editors.length,0);assert.equal(f.builds.length,0);
 map.options.onProgress({status:'ready',loadedTiles:1,buildingCount:10,detailedBuildings:3,visibleVoxels:123,traceVoxels:700,voxelCount:234,voxelCellSize:.03});assert.equal(canvas.dataset.mapDetailedBuildings,'3');assert.equal(canvas.dataset.mapVisibleVoxels,'123');assert.equal(canvas.dataset.mapTraceVoxels,'700');assert.equal(canvas.dataset.mapVoxelCount,'234');assert.equal(canvas.dataset.mapCellSize,'0.03');assert.equal(states.at(-1).status,'ready');
 const cameraPosition=f.renderers[0].camera.position.clone(),cameraRotation=f.renderers[0].camera.quaternion.clone();
 viewer.setFrame(.25);f.flush();assert.equal(map.group.parent.rotation.y,0);assert.equal(map.translation.x,.65);assert.ok(Math.abs(map.translation.z)<1e-12);assert.ok(f.renderers[0].camera.position.equals(cameraPosition));assert.ok(f.renderers[0].camera.quaternion.equals(cameraRotation));viewer.retryMap();assert.equal(map.retries,1);
 viewer.setAsset('pumpkin');assert.equal(map.active,false);assert.equal(map.group.visible,false);const before=states.length;map.options.onProgress({status:'ready',loadedTiles:2,buildingCount:20});assert.equal(states.length,before);assert.equal(f.sources.length,1);
 viewer.setAsset('sf-waterfront');assert.equal(map.active,true);assert.equal(f.maps.length,1);canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});assert.equal(map.active,false);canvas.dispatchEvent({type:'webglcontextrestored'});assert.equal(map.restores,1);assert.equal(map.active,true);viewer.destroy();assert.equal(map.disposals,1);
});

test('map dragging ray-projects onto the ground without orbiting; saved base and scan remain independent',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),translations=[],interactions=[],poses=[];
 const viewer=createViewer(canvas,{onMapTranslation:value=>translations.push(value),onInteraction:value=>interactions.push(value),onPoseChange:value=>poses.push(value)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setMapTranslation({x:.3,z:.2});viewer.setAsset('sf-waterfront');viewer.setFrame(.25);f.flush();
 const map=f.maps[0],gpu=f.renderers[0];assert.deepEqual(viewer.getMapTranslation(),{x:.3,z:.2});assert.ok(Math.abs(map.translation.x-.95)<1e-12);assert.ok(Math.abs(map.translation.z-.2)<1e-12);assert.equal(translations.length,0);
 viewer.setFrame(.75);assert.ok(Math.abs(map.translation.x+.35)<1e-12);assert.deepEqual(viewer.getMapTranslation(),{x:.3,z:.2});assert.equal(translations.length,0);
 viewer.setFrame(0);viewer.setMapTranslation({x:0,z:0});f.flush();
 const cameraPosition=gpu.camera.position.clone(),cameraRotation=gpu.camera.quaternion.clone(),pivot=map.group.parent;
 const pointer=(type,x,y)=>canvas.dispatchEvent({type,clientX:x,clientY:y,pointerId:7,button:0,preventDefault(){}});
 const rect=canvas.rect,spot=mapSpot(map.settings),center=new THREE.Vector3(spot.x,-1,spot.z).project(gpu.camera),from={x:(center.x+1)*rect.width/2,y:(1-center.y)*rect.height/2},to={x:from.x+40,y:from.y+20};
 const ground=new THREE.Plane(new THREE.Vector3(0,1,0),1),ray=new THREE.Raycaster();
 const hit=point=>{ray.setFromCamera(new THREE.Vector2(point.x/rect.width*2-1,1-point.y/rect.height*2),gpu.camera);return ray.ray.intersectPlane(ground,new THREE.Vector3());};
 const expected=hit(to).sub(hit(from));pointer('pointerdown',from.x,from.y);pointer('pointermove',to.x,to.y);pointer('pointerup',to.x,to.y);f.flush();
 assert.ok(Math.abs(viewer.getMapTranslation().x-expected.x)<1e-10);assert.ok(Math.abs(viewer.getMapTranslation().z-expected.z)<1e-10);assert.equal(translations.length,1);assert.equal(interactions.at(-1).type,'drag');
 assert.ok(gpu.camera.position.equals(cameraPosition));assert.ok(gpu.camera.quaternion.equals(cameraRotation));assert.equal(pivot.rotation.y,0);assert.equal(pivot.rotation.x,0);assert.equal(poses.at(-1).yaw,0);
 viewer.setMapTranslation({x:100,z:-100});viewer.setFrame(.25);assert.deepEqual(viewer.getMapTranslation(),{x:4,z:-4});assert.equal(map.translation.x,4);assert.ok(map.translation.z>=-4);assert.equal(translations.length,1);
 viewer.setMapTranslation({x:0,z:0});viewer.setFrame(0);viewer.setView('front');f.flush();
 const frontCenter=new THREE.Vector3(spot.x,-1,spot.z).project(gpu.camera),frontFrom={x:(frontCenter.x+1)*rect.width/2,y:(1-frontCenter.y)*rect.height/2};
 pointer('pointerdown',frontFrom.x,frontFrom.y);pointer('pointermove',frontFrom.x+40,frontFrom.y+20);pointer('pointerup',frontFrom.x+40,frontFrom.y+20);assert.ok(Number.isFinite(map.translation.x)&&Number.isFinite(map.translation.z));assert.ok(Math.abs(map.translation.x)+Math.abs(map.translation.z)>0);assert.equal(pivot.rotation.y,0);
 viewer.resetView();assert.deepEqual(viewer.getMapTranslation(),{x:0,z:0});assert.deepEqual(translations.at(-1),{x:0,z:0});
 viewer.setAsset('pumpkin');const before=translations.length;pointer('pointerdown',from.x,from.y);pointer('pointermove',to.x,to.y);pointer('pointerup',to.x,to.y);assert.notEqual(pivot.rotation.y,0);assert.equal(translations.length,before);
 viewer.setAsset('sf-waterfront');assert.equal(pivot.rotation.y,0);assert.equal(pivot.rotation.x,0);viewer.setFrame(1);assert.ok(Math.abs(map.translation.x)<1e-12&&Math.abs(map.translation.z)<1e-12);
});


test('map circle chooses pan in every preset and outside drag orbits a stationary scene with compass bearings',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),poses=[],translations=[];
 const viewer=createViewer(canvas,{onPoseChange:pose=>poses.push(pose),onMapTranslation:offset=>translations.push(offset)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],gpu=f.renderers[0],spot=mapSpot(map.settings);
 const pointer=(type,x,y,id=8)=>canvas.dispatchEvent({type,clientX:x,clientY:y,pointerId:id,button:0,preventDefault(){}});
 const screen=(x,y,z)=>{const p=new THREE.Vector3(x,y,z).project(gpu.camera);return{x:canvas.rect.left+(p.x+1)*canvas.rect.width/2,y:canvas.rect.top+(1-p.y)*canvas.rect.height/2};};
 for(const preset of ['iso','front','top','right']){
  viewer.setView(preset);viewer.setFrame(.25);viewer.setMapTranslation({x:.2,z:-.1});f.flush();
  const center=screen(spot.x,-1,spot.z),position=gpu.camera.position.clone(),rotation=gpu.camera.quaternion.clone();
  pointer('pointerdown',center.x,center.y);assert.equal(canvas.dataset.mapGesture,'pan');assert.equal(poses.at(-1).mapOrbiting,false);
  pointer('pointermove',center.x+24,center.y+12);pointer('pointerup',center.x+24,center.y+12);f.flush();
  assert.ok(gpu.camera.position.equals(position));assert.ok(gpu.camera.quaternion.equals(rotation));assert.equal(canvas.dataset.mapGesture,'idle');assert.ok(Number.isFinite(map.translation.x)&&Number.isFinite(map.translation.z));
  const base=viewer.getMapTranslation(),actual={...map.translation},frame=poses.at(-1).frame,pivot=map.group.parent;
  const headingBefore=poses.at(-1).mapHeading;if(preset==='front')assert.equal(headingBefore,0);if(preset==='right')assert.equal(headingBefore,270);
  pointer('pointerdown',20,20);assert.equal(canvas.dataset.mapGesture,'orbit');assert.equal(poses.at(-1).mapOrbiting,true);
  pointer('pointermove',100,50);pointer('pointerup',100,50);f.flush();
  assert.equal(canvas.dataset.mapGesture,'idle');assert.equal(poses.at(-1).mapOrbiting,false);assert.equal(poses.at(-1).view,'custom');assert.notEqual(poses.at(-1).mapHeading,headingBefore);assert.ok(Number.isFinite(poses.at(-1).mapElevation));
  assert.ok(!gpu.camera.position.equals(position));assert.deepEqual(viewer.getMapTranslation(),base);assert.deepEqual(map.translation,actual);assert.equal(poses.at(-1).frame,frame);assert.equal(pivot.rotation.x,0);assert.equal(pivot.rotation.y,0);assert.equal(map.group.rotation.y,0);
  viewer.setView(preset);f.flush();assert.equal(poses.at(-1).view,preset);assert.equal(poses.at(-1).mapHeading,headingBefore);assert.ok(gpu.camera.position.equals(position));
 }
});

test('map gesture is latched across circle boundaries and cancellation clears capture and compass state',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),poses=[],viewer=createViewer(canvas,{onPoseChange:pose=>poses.push(pose)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setAsset('sf-waterfront');viewer.setView('top');f.flush();const map=f.maps[0],gpu=f.renderers[0],spot=mapSpot(map.settings);
 const project=()=>{const p=new THREE.Vector3(spot.x,-1,spot.z).project(gpu.camera);return{x:(p.x+1)*canvas.rect.width/2,y:(1-p.y)*canvas.rect.height/2};};
 const pointer=(type,x,y)=>canvas.dispatchEvent({type,clientX:x,clientY:y,pointerId:9,button:0,preventDefault(){}});
 let center=project();const cameraBefore=gpu.camera.position.clone();pointer('pointerdown',center.x,center.y);pointer('pointermove',20,20);assert.equal(canvas.dataset.mapGesture,'pan');assert.ok(gpu.camera.position.equals(cameraBefore));pointer('pointercancel',20,20);assert.equal(canvas.dataset.mapGesture,'idle');assert.equal(canvas.hasPointerCapture(9),false);
 viewer.setMapTranslation({x:0,z:0});const savedBase=viewer.getMapTranslation();pointer('pointerdown',20,20);pointer('pointermove',center.x,center.y);assert.equal(canvas.dataset.mapGesture,'orbit');assert.deepEqual(viewer.getMapTranslation(),savedBase);pointer('lostpointercapture',center.x,center.y);assert.equal(canvas.dataset.mapGesture,'idle');assert.equal(poses.at(-1).mapOrbiting,false);
 const orbitHeading=poses.at(-1).mapHeading;pointer('pointermove',50,50);assert.equal(poses.at(-1).mapHeading,orbitHeading);
 for(const cancel of [()=>viewer.setView('front'),()=>viewer.resetView(),()=>viewer.setAsset('pumpkin'),()=>canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}})]){
  viewer.setAsset('sf-waterfront');pointer('pointerdown',20,20);assert.equal(canvas.dataset.mapGesture,'orbit');cancel();assert.equal(canvas.dataset.mapGesture,'idle');assert.equal(canvas.hasPointerCapture(9),false);
 }
});

test('map orbit and zoom stay separate from imported object orbit and return intact',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),poses=[],viewer=createViewer(canvas,{onPoseChange:pose=>poses.push(pose)});t.after(()=>{viewer.destroy();f.restore();});
 const drag=()=>{for(const [type,x,y]of[['pointerdown',20,20],['pointermove',120,60],['pointerup',120,60]])canvas.dispatchEvent({type,clientX:x,clientY:y,pointerId:10,button:0,preventDefault(){}});};
 viewer.setAsset('sf-waterfront');f.flush();drag();canvas.dispatchEvent({type:'wheel',deltaY:-100,deltaMode:0,preventDefault(){}});f.flush();const mapPose={...poses.at(-1)},mapCamera=f.renderers[0].camera.position.clone();
 viewer.setAsset('pumpkin');viewer.setView('right');drag();f.flush();assert.notEqual(f.maps[0].group.parent.rotation.y,0);
 viewer.setAsset('sf-waterfront');f.flush();assert.equal(poses.at(-1).mapHeading,mapPose.mapHeading);assert.equal(poses.at(-1).mapElevation,mapPose.mapElevation);assert.equal(poses.at(-1).zoom,mapPose.zoom);assert.ok(f.renderers[0].camera.position.equals(mapCamera));assert.equal(f.maps[0].group.parent.rotation.y,0);
 viewer.setView('front');assert.equal(poses.at(-1).mapHeading,0);assert.equal(poses.at(-1).mapElevation,0);viewer.setView('right');assert.equal(poses.at(-1).mapHeading,270);viewer.resetView();assert.equal(poses.at(-1).view,'iso');assert.equal(poses.at(-1).zoom,1);
});


test('maximum geometry zoom preserves a large off-center projector circle and its pan hit region',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),poses=[],viewer=createViewer(canvas,{onPoseChange:value=>poses.push(value)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setHologramSettings({x:.6,z:1,radius:1,height:3});viewer.setAsset('sf-waterfront');f.flush();
 canvas.dispatchEvent({type:'wheel',deltaY:-10000,deltaMode:0,preventDefault(){}});f.flush();const camera=f.renderers[0].camera,spot=mapSpot(f.maps[0].settings);
 // Choose a visible interior point by projecting the near half of the disk.
 let chosen=null,clipped=false;for(let i=0;i<128;i++){const a=i/128*Math.PI*2,p=new THREE.Vector3(spot.x+Math.cos(a)*spot.radius,-1,spot.z+Math.sin(a)*spot.radius).project(camera);if(p.z<-1||p.z>1)clipped=true;}
 for(let x=-2;x<=2&&!chosen;x+=.1)for(let z=-2;z<=2;z+=.1){if(x*x+z*z>spot.radius**2)continue;const p=new THREE.Vector3(spot.x+x,-1,spot.z+z).project(camera);if(Math.abs(p.x)<.95&&Math.abs(p.y)<.95&&p.z>-1&&p.z<1){chosen={x:(p.x+1)*canvas.rect.width/2,y:(1-p.y)*canvas.rect.height/2};break;}}
 assert.equal(clipped,false);assert.equal(viewer.getMapZoom(),12);assert.ok(chosen);canvas.dispatchEvent({type:'pointerdown',clientX:chosen.x,clientY:chosen.y,pointerId:11,button:0,preventDefault(){}});assert.equal(canvas.dataset.mapGesture,'pan');
 canvas.dispatchEvent({type:'pointercancel',pointerId:11});assert.equal(canvas.dataset.mapGesture,'idle');
});


test('map geometry zoom leaves the camera, projector footprint and display voxel pitch unchanged in every view',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),poses=[],viewer=createViewer(canvas,{onPoseChange:pose=>poses.push(pose)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setMapZoom(3);viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],camera=f.renderers[0].camera,spot=mapSpot(map.settings);
 assert.equal(map.zoom,3);assert.equal(poses.at(-1).zoom,3);
 const projectRim=()=>Array.from({length:12},(_,i)=>new THREE.Vector3(spot.x+Math.cos(i*Math.PI/6)*spot.radius,-1,spot.z+Math.sin(i*Math.PI/6)*spot.radius).project(camera).toArray());
 for(const preset of ['iso','top','front','right']){
  viewer.setView(preset);viewer.setMapZoom(1);f.flush();const cameraPosition=camera.position.clone(),cameraRotation=camera.quaternion.clone(),footprint=projectRim(),cell=map.cell;
  canvas.dispatchEvent({type:'wheel',deltaY:-1500,deltaMode:0,preventDefault(){}});f.flush();
  assert.ok(viewer.getMapZoom()>5);assert.equal(map.zoom,viewer.getMapZoom());assert.equal(Number(canvas.dataset.mapZoom),map.zoom);
  assert.ok(camera.position.equals(cameraPosition));assert.ok(camera.quaternion.equals(cameraRotation));assert.deepEqual(projectRim(),footprint);assert.equal(map.cell,cell);
  canvas.dispatchEvent({type:'keydown',key:'+',preventDefault(){}});assert.equal(poses.at(-1).zoom,map.zoom);assert.ok(camera.position.equals(cameraPosition));assert.equal(map.cell,cell);
 }
 viewer.setMapZoom(100);assert.equal(map.zoom,12);viewer.setMapZoom(-1);assert.equal(map.zoom,.55);viewer.setMapZoom(NaN);assert.equal(map.zoom,.55);
 viewer.setMapZoom(6);viewer.setView('top');assert.equal(map.zoom,6);canvas.dispatchEvent({type:'keydown',key:'Home',preventDefault(){}});assert.equal(viewer.getMapZoom(),1);assert.equal(map.zoom,1);
});

test('zoomed map panning keeps geometry locked to the pointer by dividing source translation by zoom',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),viewer=createViewer(canvas);t.after(()=>{viewer.destroy();f.restore();});
 viewer.setAsset('sf-waterfront');viewer.setMapZoom(8);f.flush();const map=f.maps[0],camera=f.renderers[0].camera,spot=mapSpot(map.settings),rect=canvas.rect;
 const p=new THREE.Vector3(spot.x,-1,spot.z).project(camera),from={x:(p.x+1)*rect.width/2,y:(1-p.y)*rect.height/2},to={x:from.x+60,y:from.y-18};
 const ground=new THREE.Plane(new THREE.Vector3(0,1,0),1),ray=new THREE.Raycaster();
 const hit=point=>{ray.setFromCamera(new THREE.Vector2(point.x/rect.width*2-1,1-point.y/rect.height*2),camera);return ray.ray.intersectPlane(ground,new THREE.Vector3());};
 const expectedWorld=hit(to).sub(hit(from));
 for(const [type,point]of[['pointerdown',from],['pointermove',to],['pointerup',to]])canvas.dispatchEvent({type,clientX:point.x,clientY:point.y,pointerId:12,button:0,preventDefault(){}});
 assert.ok(Math.abs(viewer.getMapTranslation().x*8-expectedWorld.x)<1e-10);assert.ok(Math.abs(viewer.getMapTranslation().z*8-expectedWorld.z)<1e-10);assert.equal(map.zoom,8);
});

test('map orbit follows the corrected drag direction without reversing imported object rotation',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),poses=[],viewer=createViewer(canvas,{onPoseChange:pose=>poses.push(pose)});t.after(()=>{viewer.destroy();f.restore();});
 const drag=()=>{for(const [type,x,y]of[['pointerdown',20,20],['pointermove',70,40],['pointerup',70,40]])canvas.dispatchEvent({type,clientX:x,clientY:y,pointerId:13,button:0,preventDefault(){}});};
 viewer.setAsset('sf-waterfront');f.flush();const before=poses.at(-1);drag();const after=poses.at(-1),headingDelta=(after.mapHeading-before.mapHeading+540)%360-180;
 assert.ok(headingDelta>0);assert.ok(after.mapElevation>before.mapElevation);assert.ok(Math.abs(headingDelta-50*.008*180/Math.PI)<1e-10);assert.equal(f.maps[0].group.parent.rotation.y,0);
 viewer.setAsset('pumpkin');drag();assert.ok(poses.at(-1).yaw>0);assert.ok(poses.at(-1).pitch>0);
});


test('map marker animates independently of scan playback and suspends with visibility, context loss and scene switches',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),viewer=createViewer(canvas);t.after(()=>{viewer.destroy();f.restore();});
 viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],times=[];
 map.updateAnimation=time=>{times.push(time);return true;};map.getMarkerState=()=>({position:[1,0,2],visible:true});
 viewer.setFrame(0);f.flush(1000);assert.deepEqual(times,[1000]);assert.ok(f.frames.size>0);assert.equal(canvas.dataset.mapMarkerX,'1');
 f.flush(1050);assert.deepEqual(times,[1000,1050]);assert.equal(canvas.dataset.cubeFrame,'0.0000');
 document.hidden=true;document.dispatchEvent({type:'visibilitychange'});assert.equal(f.frames.size,0);
 document.hidden=false;document.dispatchEvent({type:'visibilitychange'});f.flush(2000);assert.equal(times.at(-1),2000);
 canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});f.flush(3000);assert.equal(times.at(-1),2000);assert.equal(f.frames.size,0);
 canvas.dispatchEvent({type:'webglcontextrestored'});f.flush(4000);assert.equal(times.at(-1),4000);
 viewer.setAsset('calibration');f.flush(5000);f.flush(5050);assert.equal(times.at(-1),4000);assert.equal(f.frames.size,0);
 viewer.setAsset('sf-waterfront');f.flush(6000);assert.equal(times.at(-1),6000);viewer.destroy();assert.equal(f.frames.size,0);
});

test('map marker callbacks follow the camera projection and clear unavailable overlays immediately',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),updates=[];
 const viewer=createViewer(canvas,{onMapMarker:value=>updates.push(value)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],gpu=f.renderers[0];
 const marker={name:'Sue Bierman Park',source:'demo',position:[-.53,-.96,-.28],sourcePosition:[-.53,.04,-.28],latitude:37.796,longitude:-122.395,altitude:8,visible:true};
 map.getMarkerState=()=>marker;map.updateAnimation=()=>true;
 for(const preset of ['iso','front','top','right']){
   viewer.setView(preset);f.flush();const point=new THREE.Vector3(...marker.position).project(gpu.camera),emitted=updates.at(-1);
   assert.equal(emitted.visible,true);assert.ok(Math.abs(emitted.screen.x-(point.x+1)/2)<1e-12);assert.ok(Math.abs(emitted.screen.y-(1-point.y)/2)<1e-12);
   assert.equal(emitted.latitude,marker.latitude);assert.equal(emitted.longitude,marker.longitude);assert.equal(emitted.altitude,8);assert.equal(emitted.source,'demo');
 }
 assert.equal(Object.hasOwn(marker,'screen'),false,'presentation fields do not mutate the map state');
 marker.visible=false;f.flush();assert.equal(updates.at(-1).visible,false);
 marker.visible=true;marker.position=gpu.camera.position.clone().add(gpu.camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(-1)).toArray();f.flush();assert.equal(updates.at(-1).visible,false,'points behind the eye do not create a flag');
 marker.position=[1e5,0,0];f.flush();assert.equal(updates.at(-1).visible,false);assert.ok(updates.at(-1).screen.x>=0&&updates.at(-1).screen.x<=1);
 marker.position=[-.53,-.96,-.28];viewer.setView('iso');f.flush();assert.equal(updates.at(-1).visible,true);
 canvas.rect.width=0;f.flush();assert.equal(updates.at(-1),null);
 canvas.rect.width=800;window.dispatchEvent({type:'resize'});f.flush();assert.equal(updates.at(-1).visible,true);
 document.hidden=true;document.dispatchEvent({type:'visibilitychange'});assert.equal(updates.at(-1),null);
 document.hidden=false;document.dispatchEvent({type:'visibilitychange'});f.flush();assert.equal(updates.at(-1).visible,true);
 canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});assert.equal(updates.at(-1),null);
 canvas.dispatchEvent({type:'webglcontextrestored'});f.flush();assert.equal(updates.at(-1).visible,true);
 viewer.setAsset('calibration');assert.equal(updates.at(-1),null);
 viewer.setAsset('sf-waterfront');f.flush();assert.equal(updates.at(-1).visible,true);
 const draw=gpu.render;gpu.render=()=>{throw new Error('test unavailable renderer');};f.flush();assert.equal(updates.at(-1),null);gpu.render=draw;
 viewer.destroy();assert.equal(updates.at(-1),null);
});

test('Marker focus centers the moving marker within the fixed projector and preserves the camera and larger geometry scale',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),translations=[],poses=[];
 const viewer=createViewer(canvas,{onMapTranslation:value=>translations.push(value),onPoseChange:value=>poses.push(value)});t.after(()=>{viewer.destroy();f.restore();});
 assert.equal(viewer.focusMapMarker(),false);
 viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],gpu=f.renderers[0],source=[-.532,.036,-.276];
 assert.equal(viewer.focusMapMarker(),false);
 map.getMarkerState=()=>({sourcePosition:source,visible:true});
 viewer.setFrame(.25);viewer.setView('right');viewer.setHologramSettings({x:.3,z:-.2,radius:.65});f.flush();
 const position=gpu.camera.position.clone(),rotation=gpu.camera.quaternion.clone(),settings={...map.settings},spot=mapSpot(settings);
 for(const scale of [1,8]){
   viewer.setMapZoom(scale);assert.equal(viewer.focusMapMarker(),true);f.flush();const zoom=Math.max(4,scale);
   assert.equal(viewer.getMapZoom(),zoom);assert.equal(map.zoom,zoom);assert.equal(poses.at(-1).zoom,zoom);
   assert.ok(Math.abs(source[0]*zoom+spot.x*(1-zoom)+map.translation.x*zoom-spot.x)<1e-12);
   assert.ok(Math.abs(source[2]*zoom+spot.z*(1-zoom)+map.translation.z*zoom-spot.z)<1e-12);
   assert.deepEqual(translations.at(-1),viewer.getMapTranslation());assert.deepEqual(map.settings,settings);
   assert.ok(gpu.camera.position.equals(position));assert.ok(gpu.camera.quaternion.equals(rotation));
 }
 source[0]=.2;source[2]=.4;assert.equal(viewer.focusMapMarker(),true);assert.ok(Math.abs(map.translation.x-(spot.x-.2))<1e-12,'uses the latest moving position and compensates scan phase');
 source[0]=NaN;assert.equal(viewer.focusMapMarker(),false);source[0]=.2;
 canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});assert.equal(viewer.focusMapMarker(),false);
 viewer.destroy();assert.equal(viewer.focusMapMarker(),false);
});

test('drone hold command requests a fresh telemetry frame and resumes a stopped animation loop',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),updates=[];
 const viewer=createViewer(canvas,{onMapMarker:state=>updates.push(state)});t.after(()=>{viewer.destroy();f.restore();});
 assert.equal(viewer.setMapMarkerHeld(true),false);viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0];
 let held=false,suspensions=0;map.setMarkerHeld=value=>(held=value,true);map.suspendMarkerAnimation=()=>suspensions++;
 map.getMarkerState=()=>({position:[-.53,-.96,-.28],visible:true,held,task:held?'holding':'inspecting',speed:held?0:6.28});map.updateAnimation=()=>!held;
 assert.equal(viewer.setMapMarkerHeld(true),true);f.flush();assert.equal(updates.at(-1).task,'holding');assert.equal(updates.at(-1).speed,0);assert.equal(f.frames.size,0);
 assert.equal(viewer.setMapMarkerHeld(true),true);assert.equal(f.frames.size,0,'repeating the current hold state does not restart draws');
 assert.equal(viewer.setMapMarkerHeld(false),true);f.flush();assert.equal(updates.at(-1).task,'inspecting');assert.ok(f.frames.size>0);
 document.hidden=true;document.dispatchEvent({type:'visibilitychange'});assert.equal(suspensions,1);assert.equal(updates.at(-1),null);assert.equal(f.frames.size,0);
 document.hidden=false;document.dispatchEvent({type:'visibilitychange'});f.flush();assert.ok(f.frames.size>0);
 canvas.rect.width=0;f.flush();assert.equal(suspensions,2);assert.equal(updates.at(-1),null);assert.equal(f.frames.size,0);canvas.rect.width=1211;window.dispatchEvent({type:'resize'});f.flush();assert.ok(f.frames.size>0);
 canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});assert.equal(viewer.setMapMarkerHeld(true),false);
 canvas.dispatchEvent({type:'webglcontextrestored'});viewer.setAsset('calibration');assert.equal(viewer.setMapMarkerHeld(true),false);
 viewer.destroy();assert.equal(viewer.setMapMarkerHeld(true),false);
});

function manualMap(map){
 const marker={position:[-.53,-.96,-.28],sourcePosition:[-.53,.04,-.28],visible:true,metersToWorld:.0045,heading:90,yaw:90,pitch:12,roll:8,directOperate:false};
 map.getMarkerState=()=>({...marker});map.input={};map.clears=0;map.cellUpdates=0;
 map.setDirectOperate=value=>(marker.directOperate=value,true);map.setDroneInput=input=>(map.input={...input},true);
 map.clearDroneInput=()=>{map.input={};map.clears++;};map.setCellSize=()=>{map.cellUpdates++;};
 return marker;
}

test('Direct Operate uses the drone pose for chase, top map, and attitude-coupled real scene feed; it restores exact stage and camera',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),changes=[],telemetry=[];
 const viewer=createViewer(canvas,{onDirectOperateChange:value=>changes.push(value),onMapMarker:marker=>telemetry.push(marker)});t.after(()=>{viewer.destroy();f.restore();});
 assert.equal(viewer.setDirectOperate(true),false);viewer.setAsset('sf-waterfront');viewer.setMapZoom(4);viewer.setMapTranslation({x:.3,z:-.2});viewer.setFrame(.25);viewer.setView('right');f.flush();
 const map=f.maps[0],gpu=f.renderers[0],marker=manualMap(map),originalCamera=gpu.camera,originalPosition=originalCamera.position.clone(),originalRotation=originalCamera.quaternion.clone(),originalSettings={...map.settings},originalTranslation={...map.translation};
 const layout={map:{x:.4,y:.42,width:.2,height:.2},feed:{x:.35,y:.7,width:.3,height:.25}};viewer.setDirectOperateLayout(layout);
 const viewport=gpu.viewport.clone(),scissor=gpu.scissor.clone();gpu.autoClear=false;
 assert.equal(viewer.setDirectOperate(true),true);assert.equal(viewer.getDirectOperate(),true);assert.equal(map.settings.enabled,false);assert.deepEqual(changes,[true]);
 assert.equal(viewer.setDroneInput({yaw:.5,lift:.2,forward:1,strafe:-.1}),true);assert.equal(map.input.forward,1);f.flush(1000);
 let passes=gpu.passes.slice(-3);assert.deepEqual(passes.map(pass=>pass.name),['direct-operate-chase','direct-operate-map','direct-operate-feed']);
 const [chase,overhead,feed]=passes,scale=marker.metersToWorld,position=new THREE.Vector3(...marker.position);
 assert.ok(chase.rigPosition.distanceTo(position)<1e-12);assert.equal(chase.rigScale.x,scale);
 const expected=new THREE.Quaternion().setFromEuler(new THREE.Euler(12*Math.PI/180,-Math.PI/2,-8*Math.PI/180,'YXZ'));
 assert.ok(chase.rigQuaternion.angleTo(expected)<1e-7);assert.ok(chase.camera.position.distanceTo(position.clone().add(new THREE.Vector3(-8*scale,5*scale,0)))<1e-12);
 assert.equal(chase.camera.near,.001);assert.equal(chase.scissorTest,false);assert.deepEqual(chase.viewport.toArray(),[0,0,1211,789]);
 assert.ok(overhead.camera.position.distanceTo(position.clone().add(new THREE.Vector3(0,70*scale,0)))<1e-12);assert.deepEqual(overhead.camera.up.toArray(),[0,0,-1]);
 assert.deepEqual(overhead.viewport.toArray(),[484,300,243,158]);assert.equal(overhead.scissorTest,true);assert.equal(feed.scissorTest,true);
 assert.equal(chase.rigVisible,true);assert.equal(overhead.rigVisible,true);assert.equal(feed.rigVisible,false);assert.equal(gpu.scene.getObjectByName('direct-operate-drone').visible,true);
 const mount=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-8*Math.PI/180);
 assert.ok(feed.camera.quaternion.angleTo(expected.clone().multiply(mount))<1e-7);
 assert.equal(feed.camera.near,.0005);assert.ok(feed.camera.position.distanceTo(position)<scale*.4);
 assert.ok(gpu.viewport.equals(viewport));assert.ok(gpu.scissor.equals(scissor));assert.equal(gpu.scissorTest,false);assert.equal(gpu.autoClear,false);
 const projected=position.clone().project(chase.camera);assert.ok(Math.abs(telemetry.at(-1).screen.x-(projected.x+1)/2)<1e-12);
 assert.ok(telemetry.at(-1).screen.y>.35&&telemetry.at(-1).screen.y<.45,'drone stays above the stacked inset windows');
 const stableCell=map.cellUpdates;marker.position=[-.50,-.95,-.25];marker.heading=marker.yaw=180;marker.roll=-4;marker.pitch=-9;f.flush(1016);passes=gpu.passes.slice(-3);
 assert.ok(passes[0].rigPosition.distanceTo(new THREE.Vector3(...marker.position))<1e-12);assert.ok(passes[0].camera.position.z<marker.position[2]);assert.equal(map.cellUpdates,stableCell,'chase pose does not rebuild pane-sized geometry');
 viewer.setFrame(.8);viewer.setView('top');viewer.setMapZoom(9);viewer.setMapTranslation({x:2,z:2});viewer.resetView();
 canvas.dispatchEvent({type:'wheel',deltaY:-200,deltaMode:0,preventDefault(){}});canvas.dispatchEvent({type:'keydown',key:'ArrowRight',preventDefault(){}});
 canvas.dispatchEvent({type:'pointerdown',clientX:10,clientY:10,pointerId:1,button:0,preventDefault(){}});canvas.dispatchEvent({type:'pointermove',clientX:100,clientY:200,pointerId:1});
 assert.equal(viewer.getMapZoom(),4);assert.deepEqual(map.translation,originalTranslation);assert.ok(originalCamera.position.equals(originalPosition));assert.ok(originalCamera.quaternion.equals(originalRotation));assert.equal(viewer.setMapMarkerHeld(true),false);
 assert.equal(viewer.setDirectOperate(false),true);f.flush();assert.equal(viewer.getDirectOperate(),false);assert.equal(gpu.camera,originalCamera);assert.ok(gpu.camera.position.equals(originalPosition));assert.ok(gpu.camera.quaternion.equals(originalRotation));assert.deepEqual(map.settings,originalSettings);assert.equal(canvas.dataset.cubeFrame,'0.2500');assert.deepEqual(changes,[true,false]);assert.equal(gpu.scene.getObjectByName('direct-operate-drone').visible,false);assert.deepEqual(map.input,{});
});

test('Direct Operate clears commands on blur/hidden/lost context and exits on scene switch or destruction',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),changes=[];
 const viewer=createViewer(canvas,{onDirectOperateChange:value=>changes.push(value)});t.after(()=>{viewer.destroy();f.restore();});
 viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],marker=manualMap(map),gpu=f.renderers[0];let suspensions=0;map.suspendMarkerAnimation=()=>{suspensions++;marker.speed=marker.verticalSpeed=0;};
 assert.equal(viewer.setDirectOperate(true),true);f.flush();const rig=gpu.scene.getObjectByName('direct-operate-drone');let disposalCount=0;rig.traverse(object=>object.geometry?.addEventListener('dispose',()=>disposalCount++));
 marker.speed=3;marker.verticalSpeed=2;viewer.setDroneInput({lift:1});window.dispatchEvent({type:'blur'});assert.deepEqual(map.input,{});assert.equal(viewer.getDirectOperate(),true);assert.equal(suspensions,1);assert.equal(marker.speed,0);assert.equal(marker.verticalSpeed,0);
 viewer.setDroneInput({forward:1});document.hidden=true;document.dispatchEvent({type:'visibilitychange'});assert.deepEqual(map.input,{});assert.equal(f.frames.size,0);assert.equal(viewer.setDroneInput({forward:1}),false);assert.equal(suspensions,2);
 document.hidden=false;document.dispatchEvent({type:'visibilitychange'});f.flush();assert.equal(viewer.getDirectOperate(),true);
 viewer.setDroneInput({yaw:1});canvas.dispatchEvent({type:'webglcontextlost',preventDefault(){}});assert.deepEqual(map.input,{});assert.equal(viewer.getDirectOperate(),false);assert.equal(marker.directOperate,false);assert.equal(map.settings.enabled,true);assert.equal(f.frames.size,0);assert.equal(viewer.setDirectOperate(true),false);
 canvas.dispatchEvent({type:'webglcontextrestored'});f.flush();viewer.setDirectOperate(true);viewer.setDroneInput({strafe:1});viewer.setAsset('calibration');assert.equal(viewer.getDirectOperate(),false);assert.deepEqual(map.input,{});assert.equal(marker.directOperate,false);assert.equal(rig.visible,false);
 viewer.setAsset('sf-waterfront');f.flush();viewer.setDirectOperate(true);f.flush();viewer.destroy();assert.equal(viewer.getDirectOperate(),false);assert.equal(rig.parent,null);assert.ok(disposalCount>0);assert.deepEqual(changes,[true,false,true,false,true,false]);assert.equal(f.frames.size,0);assert.equal((window.listeners.get('blur')||[]).length,0);
});

test('a failed Direct Operate pass restores framebuffer state, exits flight and stops the render loop',async t=>{
 const f=fixture(),createViewer=await viewerFactory(),canvas=new f.Element(),errors=[],changes=[];
 const viewer=createViewer(canvas,{onError:error=>errors.push(error),onDirectOperateChange:value=>changes.push(value)});t.after(()=>{viewer.destroy();f.restore();});viewer.setAsset('sf-waterfront');f.flush();const map=f.maps[0],marker=manualMap(map);
 const settings=map.setSettings;map.setSettings=function(value){settings.call(this,value);this.options.onDirty();};
 const gpu=f.renderers[0];viewer.setDirectOperate(true);gpu.setViewport(2,3,777,555);gpu.setScissor(5,6,222,333);gpu.setScissorTest(true);gpu.autoClear=false;gpu.throwCamera='direct-operate-feed';
 viewer.setDroneInput({forward:1});f.flush();assert.equal(errors.at(-1).message,'render pass failed');assert.deepEqual(gpu.viewport.toArray(),[2,3,777,555]);assert.deepEqual(gpu.scissor.toArray(),[5,6,222,333]);assert.equal(gpu.scissorTest,true);assert.equal(gpu.autoClear,false);assert.equal(gpu.scene.getObjectByName('direct-operate-drone').visible,false);
 assert.equal(viewer.getDirectOperate(),false);assert.equal(marker.directOperate,false);assert.equal(map.settings.enabled,true);assert.deepEqual(map.input,{});assert.deepEqual(changes,[true,false]);assert.equal(f.frames.size,0);assert.equal(canvas.dataset.rendererStatus,'error');const passes=gpu.passes.length;f.flush();assert.equal(gpu.passes.length,passes,'restoration does not repeatedly retry a broken renderer');
});

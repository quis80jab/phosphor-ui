import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createPointEditor,insidePolygon} from '../dist/viewer-point-editor.js';
function source(){
  const records=[[-1,0,0,0],[0,0,0,.5],[0,0,-1,1],[1,0,0,.8]],mesh=new THREE.Object3D();
  mesh.numSplats=records.length;const packed=new Uint32Array(records.length*4),other=new Uint32Array([5,12,19,22]),sh=new Uint32Array([42,9021,17]);
  for(let i=0;i<records.length;i++){packed[i*4]=100+i;packed[i*4+1]=200+i;packed[i*4+2]=300+i;packed[i*4+3]=0x3c00;}
  const reused={center:new THREE.Vector3(),color:new THREE.Color(),opacity:1};
  mesh.extSplats={extArrays:[packed,other,sh],textures:[{}],getSplat(i){const [x,y,z,c]=records[i];reused.center.set(x,y,z);reused.color.setRGB(c,c,c);reused.opacity=packed[i*4+3]&65535?1:0;return reused;}};
  mesh.updateGenerator=()=>mesh.uploads=(mesh.uploads||0)+1;mesh.updateVersion=()=>{};
  return{mesh,packed,other,sh};
}
function view(){const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.z=5;camera.lookAt(0,0,0);camera.updateMatrixWorld();return{camera,pivot:new THREE.Group(),rect:{width:100,height:100}};}
test('original identity, weighted luminance histogram, exact opacity undo, groups and reload recovery',async()=>{
  const {mesh,packed,other,sh}=source(),before=packed.slice(),updates=[];
  const editor=await createPointEditor(mesh,{onChange:update=>updates.push(update)});
  assert.equal(editor.getSummary().histogram.reduce((a,b)=>a+b),4);assert.equal(editor.getSummary().histogram[0],1);assert.equal(editor.getSummary().histogram[31],1);
  await editor.selectScreen({...view(),point:{x:50,y:50}});assert.equal(editor.getSummary().selected,1);
  assert.deepEqual(Array.from(editor.group.children[0].geometry.attributes.position.array.slice(0,3)),[0,0,0]);
  const group=editor.createGroup('Center');assert.equal(typeof group,'string');
  assert.equal(editor.deleteSelected(),1);assert.equal(packed[7],0);assert.equal(editor.getSummary().deleted,1);assert.equal(editor.getSummary().histogram.reduce((a,b)=>a+b),3);
  for(let i=0;i<packed.length;i++)if(i!==7)assert.equal(packed[i],before[i]);assert.deepEqual(Array.from(other),[5,12,19,22]);assert.deepEqual(Array.from(sh),[42,9021,17]);
  assert.equal(editor.undo(),true);assert.deepEqual(packed,before);assert.equal(editor.getSummary().selected,1);
  editor.selectAll();editor.deleteSelected();assert.equal(editor.getSummary().visible,0);assert.equal(editor.getSummary().histogram.reduce((a,b)=>a+b),0);
  assert.ok(updates.at(-1).changed);assert.ok(updates.at(-1).snapshot);assert.ok(updates.at(-1).deletedChanged);
  const snapshot=editor.getSnapshot();editor.replaceSnapshot(snapshot);assert.equal(editor.getSummary().canUndo,false);assert.equal(editor.restorePoints(),4);assert.deepEqual(packed,before);assert.equal(editor.getSummary().groups.length,1);
  editor.selectGroup(group);assert.equal(editor.getSummary().selected,1);assert.equal(updates.at(-1).snapshot,undefined);
  editor.clearSelection();assert.equal(editor.getSummary().selectedHistogram.reduce((a,b)=>a+b),0);editor.dispose();
});
test('polygon selects through depth; modifiers and transform apply to original centers once',async()=>{
  const {mesh}=source(),editor=await createPointEditor(mesh);const polygon=[{x:45,y:45},{x:55,y:45},{x:55,y:55},{x:45,y:55}];
  assert.ok(insidePolygon(50,50,polygon));assert.ok(!insidePolygon(70,70,polygon));
  await editor.selectScreen({...view(),polygon});assert.equal(editor.getSummary().selected,2);
  await editor.selectScreen({...view(),point:{x:50,y:50},mode:'subtract'});assert.equal(editor.getSummary().selected,1);
  assert.deepEqual(Array.from(editor.group.children[0].geometry.attributes.position.array.slice(0,3)),[0,0,-1]);editor.dispose();
  const transformed=source();transformed.mesh.position.set(1,0,0);transformed.mesh.scale.setScalar(2);const changed=await createPointEditor(transformed.mesh);
  changed.selectAll();assert.deepEqual(Array.from(changed.group.children[0].geometry.attributes.position.array),[-1,0,0,1,0,0,1,0,-2,3,0,0]);changed.dispose();
});
test('preparation cancellation leaves original data untouched',async()=>{const {mesh,packed}=source(),before=packed.slice(),controller=new AbortController();controller.abort();await assert.rejects(createPointEditor(mesh,{signal:controller.signal}),{name:'AbortError'});assert.deepEqual(packed,before);});

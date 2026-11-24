import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createVoxelTest} from '../dist/voxel-test.js';
import {binVoxelPoints} from '../dist/voxel-test-worker.js';

test('deleting every original point creates a valid empty instanced grid, then restored opacity rebuilds it',async t=>{
  const originalWorker=globalThis.Worker,workers=[];
  globalThis.Worker=class {
    constructor(){this.terminated=false;workers.push(this);}
    postMessage({id,points,voxelSize}){queueMicrotask(()=>{if(!this.terminated)this.onmessage({data:{type:'result',id,...binVoxelPoints(points,voxelSize)}});});}
    terminate(){this.terminated=true;}
  };
  t.after(()=>{if(originalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=originalWorker;});
  const mesh=new THREE.Object3D(),record={center:new THREE.Vector3(),color:new THREE.Color(1,1,1),opacity:0};let opacity=0;
  mesh.numSplats=2;mesh.extSplats={getSplat(id){record.center.set(id,0,0);record.opacity=opacity;return record;}};
  const empty=await createVoxelTest(mesh,{voxelSize:.1});assert.equal(empty.metadata.count,0);assert.equal(empty.group.children[0].geometry.instanceCount,0);assert.deepEqual(empty.metadata.bounds,{min:[0,0,0],max:[0,0,0]});empty.restore();empty.dispose();
  opacity=1;const restored=await createVoxelTest(mesh,{voxelSize:.1});assert.equal(restored.metadata.count,2);assert.equal(restored.metadata.processed,2);assert.equal(restored.group.children[0].geometry.instanceCount,2);restored.dispose();
  assert.ok(workers.every(worker=>worker.terminated));
});

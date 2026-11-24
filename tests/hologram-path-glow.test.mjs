import test from 'node:test';
import assert from 'node:assert/strict';
import {blendVoxelPaths,PATH_FADE_MS} from '../dist/hologram-path-glow.js';
const trace=(positions,colors=positions.map(()=>1))=>({positions:new Float32Array(positions),colors:new Float32Array(colors)});
const lightAt=(frame,index,elapsed)=>{
 const mix=frame.durations[index]?Math.min(1,elapsed/frame.durations[index]):1;
 return[0,1,2].map(axis=>frame.fromColors[index*3+axis]+(frame.colors[index*3+axis]-frame.fromColors[index*3+axis])*mix);
};
test('the initial path field retains its full configured light without a startup flash',()=>{
 const input=trace([.5,.5,.5],[.2,.4,.8]),frame=blendVoxelPaths(null,input);
 assert.deepEqual(lightAt(frame,0,0),Array.from(input.colors));assert.equal(frame.duration,0);
});
test('entering and leaving cells fade individually without doubling shared-cell light',()=>{
 const first=blendVoxelPaths(null,trace([.5,.5,.5,1.5,.5,.5]));
 const next=blendVoxelPaths(first,trace([.5,.5,.5,2.5,.5,.5]));
 assert.equal(next.targetCount,2);assert.equal(next.positions.length/3,3);
 assert.deepEqual(lightAt(next,0,0),[1,1,1]);assert.deepEqual(lightAt(next,0,90),[1,1,1]);
 assert.deepEqual(lightAt(next,1,0),[0,0,0]);assert.deepEqual(lightAt(next,2,0),[1,1,1]);
 assert.deepEqual(lightAt(next,1,90),[.5,.5,.5]);assert.deepEqual(lightAt(next,2,90),[.5,.5,.5]);
 assert.deepEqual(lightAt(next,1,180),[1,1,1]);assert.deepEqual(lightAt(next,2,180),[0,0,0]);
});
test('retargeting faster than the fade preserves the currently displayed light',()=>{
 let frame=blendVoxelPaths(null,trace([.5,.5,.5]));
 frame=blendVoxelPaths(frame,trace([.5,.5,.5],[.1,.3,.5]));
 for(const colors of[[1,.7,.2],[.2,.6,.8],[1,1,1]]){
  const current=lightAt(frame,0,60);frame=blendVoxelPaths(frame,trace([.5,.5,.5],colors),60);
  lightAt(frame,0,0).forEach((value,axis)=>assert.ok(Math.abs(value-current[axis])<1e-7));
  const halfway=lightAt(frame,0,90);halfway.forEach((value,axis)=>assert.ok(value>=Math.min(current[axis],colors[axis])-1e-7&&value<=Math.max(current[axis],colors[axis])+1e-7));
 }
 assert.deepEqual(lightAt(frame,0,PATH_FADE_MS),[1,1,1]);
});
test('repeated updates do not restart retiring cells or retain invisible trails',()=>{
 const target=trace([1.5,.5,.5]);let frame=blendVoxelPaths(blendVoxelPaths(null,trace([.5,.5,.5])),target);
 frame=blendVoxelPaths(frame,target,60);assert.equal(frame.durations[1],120);
 frame=blendVoxelPaths(frame,target,60);assert.equal(frame.durations[1],60);
 frame=blendVoxelPaths(frame,target,60);assert.equal(frame.positions.length,3);assert.equal(frame.duration,0);assert.deepEqual(lightAt(frame,0,0),[1,1,1]);
});
test('reappearing cells reverse from their current light and rare LOD changes stay bounded',()=>{
 const input=trace([.5,.5,.5,1.5,.5,.5]);let frame=blendVoxelPaths(blendVoxelPaths(null,input),trace([]));
 const current=lightAt(frame,0,60);frame=blendVoxelPaths(frame,input,60);
 lightAt(frame,0,0).forEach((value,axis)=>assert.ok(Math.abs(value-current[axis])<1e-7));
 frame=blendVoxelPaths(frame,trace([2.5,.5,.5]),60,{maxTrailCells:1});assert.equal(frame.positions.length/3,2);assert.equal(frame.targetCount,1);
 const disabled=blendVoxelPaths(frame,trace([]),0,{fade:false});assert.equal(disabled.positions.length,0);
});

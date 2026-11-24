import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVoxelPaths,inverseSquareFalloff} from '../dist/hologram-paths.js';
const keys=(positions,pitch)=>new Set(Array.from({length:positions.length/3},(_,i)=>[0,1,2].map(axis=>Math.floor(positions[i*3+axis]/pitch)).join(',')));
test('paths include every endpoint and source on their original shared lattice without duplicates',()=>{
 const positions=new Float32Array([.5,.5,.5,4.5,.5,.5,.5,4.5,.5]),colors=new Float32Array(positions.length).fill(.6),source=[2.5,6.5,2.5];
 const result=buildVoxelPaths({positions,colors,source,cellSize:1}),cells=keys(result.positions,1);
 assert.equal(result.endpointCount,3);assert.equal(result.multiplier,1);assert.equal(result.count,cells.size);
 for(const point of [[.5,.5,.5],[4.5,.5,.5],[.5,4.5,.5],source])assert.ok(cells.has(point.map(Math.floor).join(',')));
 for(const value of result.positions)assert.equal(value%1,.5);
});
test('path occupancy is generated only by actual segments, including diagonal corner crossings',()=>{
 const result=buildVoxelPaths({positions:[3.5,3.5,3.5],colors:[1,0,0],source:[.5,.5,.5],cellSize:1});
 assert.equal(result.count,4);assert.deepEqual([...keys(result.positions,1)],['0,0,0','1,1,1','2,2,2','3,3,3']);
});
test('budget coarsening keeps every target represented using integer grid multiples',()=>{
 const positions=[.5,.5,.5,50.5,.5,.5,.5,50.5,.5],source=[25.5,80.5,25.5];
 const result=buildVoxelPaths({positions,colors:positions.map(()=>.5),source,cellSize:1,maxCells:80,maxSteps:10000});
 assert.ok(result.multiplier>1);assert.ok(Number.isInteger(result.multiplier));assert.ok(result.count<=80);assert.equal(result.endpointCount,3);
 const cells=keys(result.positions,result.cellSize);for(let i=0;i<positions.length;i+=3)assert.ok(cells.has(positions.slice(i,i+3).map(value=>Math.floor(value/result.cellSize)).join(',')));
});
const thresholdPlane=()=>{
 const positions=[];for(let x=-10;x<10;x++)for(let z=-10;z<10;z++)positions.push((x+.5)*.04,.02,(z+.5)*.04);
 return{positions,colors:positions.map(()=>.5),cellSize:.04,maxSteps:18000};
};
test('tiny source movements retain the previous path grid after crossing a budget threshold',()=>{
 const spec=thresholdPlane();
 const fine=buildVoxelPaths({...spec,source:[0,1.340,0]});assert.equal(fine.multiplier,1);
 let result=buildVoxelPaths({...spec,source:[0,1.341,0],previousMultiplier:fine.multiplier});assert.equal(result.multiplier,2);
 const energy=(trace,height)=>{let sum=0;for(let i=0;i<trace.positions.length;i+=3)sum+=inverseSquareFalloff(Math.hypot(trace.positions[i],trace.positions[i+1]-height,trace.positions[i+2]));return sum;};
 let previousEnergy=energy(result,1.341);
 for(const height of [1.340,1.341,1.339,1.342,1.340]){
  result=buildVoxelPaths({...spec,source:[0,height,0],previousMultiplier:result.multiplier});
  assert.equal(result.multiplier,2);assert.ok(result.steps<=spec.maxSteps);
  const nextEnergy=energy(result,height);assert.ok(Math.abs(nextEnergy/previousEnergy-1)<.03,'neighboring frames must not lose most of their path light');previousEnergy=nextEnergy;
 }
});
test('a retained path grid refines again once there is substantial budget headroom',()=>{
 const spec=thresholdPlane(),coarse=buildVoxelPaths({...spec,source:[0,1.341,0]});
 assert.equal(coarse.multiplier,2);
 const refined=buildVoxelPaths({...spec,source:[0,.6,0],previousMultiplier:coarse.multiplier});
 assert.equal(refined.multiplier,1);assert.equal(refined.endpointCount,spec.positions.length/3);assert.ok(refined.steps<=spec.maxSteps);
});
test('an empty lit region retains its grid for the next nonempty frame',()=>{
 const empty=buildVoxelPaths({positions:[],colors:[],source:[0,0,0],cellSize:.04,previousMultiplier:2});
 assert.equal(empty.count,0);assert.equal(empty.multiplier,2);assert.equal(empty.cellSize,.08);
 const next=buildVoxelPaths({...thresholdPlane(),source:[0,1.340,0],previousMultiplier:empty.multiplier});assert.equal(next.multiplier,2);
});
test('retained grids and attempted refinement still obey actual occupancy budgets',()=>{
 const spec={positions:[.5,.5,.5],colors:[.5,.5,.5],source:[.5,100.5,.5],cellSize:1,maxCells:30,maxSteps:10000};
 const coarse=buildVoxelPaths(spec);assert.equal(coarse.multiplier,4);
 const retained=buildVoxelPaths({...spec,previousMultiplier:coarse.multiplier});
 assert.equal(retained.multiplier,4);assert.ok(retained.count<=spec.maxCells);assert.ok(retained.steps<=spec.maxSteps);
 const cells=keys(retained.positions,retained.cellSize);
 for(const point of [spec.positions,spec.source])assert.ok(cells.has(point.map(value=>Math.floor(value/retained.cellSize)).join(',')));
});
test('previous grid multipliers must be finite positive integers',()=>{
 const spec={positions:[],colors:[],source:[0,0,0],cellSize:1};
 for(const previousMultiplier of [0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>buildVoxelPaths({...spec,previousMultiplier}),/multiplier.*positive integer/);
});
test('inverse-square falloff is finite, monotonic and dialable without changing its square tail',()=>{
 assert.equal(inverseSquareFalloff(0,8),1);assert.equal(inverseSquareFalloff(2,1),.2);assert.equal(inverseSquareFalloff(20,0),1);
 assert.ok(inverseSquareFalloff(2,3)<inverseSquareFalloff(2,1));assert.ok(Math.abs(inverseSquareFalloff(100,1)/inverseSquareFalloff(200,1)-4)<.001);
});
test('empty scenes trace nothing and invalid endpoint coordinates fail explicitly',()=>{
 assert.equal(buildVoxelPaths({positions:[],colors:[],source:[0,0,0],cellSize:1}).count,0);
 assert.throws(()=>buildVoxelPaths({positions:[NaN,0,0],colors:[1,1,1],source:[0,0,0],cellSize:1}),/finite/);
});

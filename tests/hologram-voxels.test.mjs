import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapVoxels } from '../dist/hologram-voxels.js';

const rectangle=(x,z,width,depth)=>[[x,z],[x+width,z],[x+width,z+depth],[x,z+depth],[x,z]];
const building=(id,outer,height,options={})=>({id,height,minHeight:0,outers:[{outer,holes:[]}],...options});
const triples=array=>Array.from({length:array.length/3},(_,index)=>Array.from(array.subarray(index*3,index*3+3)));
const keys=result=>new Set(triples(result.positions).map(point=>point.join(',')));
function assertLattice(result) {
  assert.equal(result.positions.length,result.count*3);
  assert.equal(result.colors.length,result.count*3);
  assert.ok(result.edges instanceof Uint8Array);
  assert.equal(result.edges.length,result.count);
  assert.equal(keys(result).size,result.count,'occupied cells must be unique');
  for(const center of result.positions) {
    const index=center/result.cellSize-.5;
    assert.ok(Math.abs(index-Math.round(index))<1e-4,'every cell uses the same source-local lattice');
  }
}

test('courtyards remain empty and building interiors contain only the roof shell',()=>{
  const outer=rectangle(0,0,5,5),hole=rectangle(2,2,1,1);
  const result=buildMapVoxels([building('courtyard',outer,4,{outers:[{outer,holes:[hole]}]})],{cellSize:1});
  const occupied=keys(result);
  assert.equal(result.count,84);
  assert.equal(result.coarsened,false);
  for(let y=.5;y<4;y++)assert.equal(occupied.has(`2.5,${y},2.5`),false,'courtyard must not be filled');
  assert.equal(occupied.has('1.5,1.5,1.5'),false,'interior volume is not voxelized');
  assert.equal(occupied.has('1.5,3.5,1.5'),true,'interior roof is retained');
  assert.equal(occupied.has('1.5,1.5,2.5'),true,'courtyard wall is retained');
  assertLattice(result);
});

test('projected elevated structures retain their underside and minimum height',()=>{
  const result=buildMapVoxels([building('raised',rectangle(0,0,3,3),8,{minHeight:4})],{
    cellSize:1,heightScale:.5,project:([x,z])=>[x-4,z+2],getColor:()=>[.12,.34,.56]
  });
  const occupied=keys(result);
  assert.equal(occupied.has('-2.5,2.5,3.5'),true,'interior underside is retained');
  assert.equal(occupied.has('-2.5,3.5,3.5'),true,'roof uses scaled height');
  assert.ok(triples(result.positions).every(([,y])=>y>=2.5&&y<=3.5));
  assert.deepEqual(result.bounds,{min:[-4,2,2],max:[-1,4,5]});
  assert.ok(Math.abs(result.colors[0]-.12)<1e-7,'linear colors are not gamma converted');
  assertLattice(result);
});

test('overlaps share cells, tagged color wins and negative coordinates retain global phase',()=>{
  const plain=building('a',rectangle(-3,-2,3,2),2);
  const tagged=building('b',rectangle(-3,-2,3,2),2,{colorTagged:true});
  const options={cellSize:.5,getColor:item=>item.colorTagged?[.2,.4,.6]:[.8,.8,.8]};
  const single=buildMapVoxels([plain],options);
  const result=buildMapVoxels([plain,tagged,plain],options);
  const reordered=buildMapVoxels([tagged,plain],options);
  assert.equal(result.count,single.count,'duplicate and overlapping source cells merge');
  assert.deepEqual(result.positions,reordered.positions);
  assert.deepEqual(result.colors,reordered.colors);
  assert.ok(triples(result.colors).every(color=>color.every((value,index)=>Math.abs(value-[.2,.4,.6][index])<1e-7)));
  assertLattice(result);
});

test('large buildings generate a surface shell without walking the solid volume',()=>{
  const result=buildMapVoxels([building('large',rectangle(0,0,100,100),100)],{cellSize:1,maxCells:100000});
  assert.equal(result.count,49204,'roof plus perimeter columns is the full surface shell');
  assert.equal(result.coarsened,false);
  assert.equal(keys(result).has('50.5,50.5,50.5'),false);
  assertLattice(result);
});

test('capacity uniformly coarsens the lattice while retaining separate source buildings',()=>{
  const result=buildMapVoxels([
    building('west',rectangle(-100,-50,40,40),100),
    building('east',rectangle(60,10,40,40),80)
  ],{cellSize:.000001,maxCells:1000});
  assert.ok(result.count>0&&result.count<=1000);
  assert.equal(result.requestedCellSize,.000001);
  assert.equal(result.coarsened,true);
  assert.ok(result.cellSize>result.requestedCellSize);
  const points=triples(result.positions);
  assert.ok(points.some(([x])=>x<0));
  assert.ok(points.some(([x])=>x>0));
  assertLattice(result);
});

test('bounded coverage, sub-cell footprints and empty input remain well-defined',()=>{
  const clipped=buildMapVoxels([building('clipped',rectangle(-100,-100,200,200),1)],{
    cellSize:1,bounds:{minX:0,maxX:2,minZ:0,maxZ:2}
  });
  assert.equal(clipped.count,4);
  assert.deepEqual(clipped.bounds,{min:[0,0,0],max:[2,1,2]});
  const thin=buildMapVoxels([building('thin',rectangle(.1,.1,.1,.1),.1)],{cellSize:1});
  assert.equal(thin.count,1,'a footprint smaller than the grid remains represented');
  assert.deepEqual(Array.from(thin.positions),[.5,.5,.5]);
  const empty=buildMapVoxels([],{cellSize:1});
  assert.equal(empty.count,0);assert.deepEqual(empty.bounds,{min:[0,0,0],max:[0,0,0]});
  assert.throws(()=>buildMapVoxels([],{cellSize:0}),/positive/);
  assert.throws(()=>buildMapVoxels([],{cellSize:1,maxCells:1.5}),/positive integer/);
  assert.throws(()=>buildMapVoxels([],{cellSize:1,bounds:{minX:1,maxX:0,minZ:0,maxZ:1}}),/positive width/);
});

const edgeKeys=result=>new Set(triples(result.positions).filter((_,index)=>result.edges[index]).map(point=>point.join(',')));

test('wireframe flags only real roof/base perimeter and vertical building corners',()=>{
  const outer=[[0,0],[3,0],[6,0],[6,6],[0,6],[0,0]];
  const result=buildMapVoxels([building('box',outer,6)],{cellSize:1});
  const edges=edgeKeys(result);
  assert.equal(edges.size,56,'four vertical columns plus the roof and base rings');
  assert.equal(edges.has('0.5,2.5,0.5'),true,'vertical corner survives between roof and base');
  assert.equal(edges.has('3.5,2.5,0.5'),false,'collinear OSM node is not a facade edge');
  assert.equal(edges.has('3.5,5.5,0.5'),true,'roof perimeter is a wireframe edge');
  assert.equal(edges.has('3.5,0.5,0.5'),true,'ground perimeter is a wireframe edge');
  assert.equal(edges.has('3.5,5.5,3.5'),false,'flat roof interior is not a feature edge');
  assertLattice(result);
});

test('courtyard and elevated underside wireframes remain three dimensional',()=>{
  const outer=rectangle(0,0,8,8),hole=rectangle(2,2,4,4);
  const result=buildMapVoxels([building('courtyard',outer,8,{minHeight:2,outers:[{outer,holes:[hole]}]})],{cellSize:1});
  const edges=edgeKeys(result);
  assert.equal(edges.has('3.5,2.5,1.5'),true,'courtyard underside perimeter');
  assert.equal(edges.has('3.5,7.5,1.5'),true,'courtyard roof perimeter');
  assert.equal(edges.has('3.5,4.5,1.5'),false,'courtyard facade is not filled');
  assert.ok(edges.has('2.5,4.5,1.5')||edges.has('1.5,4.5,2.5'),'courtyard vertical corner maps to an occupied wall column');
  assert.ok([...edges].every(key=>Number(key.split(',')[1])>=2.5));
  assertLattice(result);
});

test('rotated facade stair steps do not create spurious full-height feature edges',()=>{
  const result=buildMapVoxels([building('diamond',[[0,3],[3,0],[6,3],[3,6],[0,3]],4)],{cellSize:.25});
  const middle=triples(result.positions).filter(([,y],index)=>Math.abs(y-1.125)<1e-7&&result.edges[index]);
  assert.equal(middle.length,4,'only four original corners extend vertically');
  const midShell=triples(result.positions).filter(([,y])=>Math.abs(y-1.125)<1e-7);
  assert.ok(midShell.length>40,'most quantized facade columns are deliberately not wireframe');
  assertLattice(result);
});

test('clipped windows do not invent building feature edges and duplicate edges remain deterministic',()=>{
  const giant=buildMapVoxels([building('clipped',rectangle(-100,-100,200,200),4)],{cellSize:1,bounds:{minX:0,maxX:4,minZ:0,maxZ:4}});
  assert.equal(edgeKeys(giant).size,0,'the clip is in a flat building interior');
  const a=building('a',rectangle(0,0,6,6),6),b=building('b',rectangle(0,0,6,6),6,{colorTagged:true});
  const first=buildMapVoxels([a,b],{cellSize:1}),second=buildMapVoxels([b,a],{cellSize:1});
  assert.deepEqual(first.edges,second.edges);
  assert.equal(edgeKeys(first).size,56);
});

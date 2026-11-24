const finite3=value=>value?.length===3&&value.every(Number.isFinite);
/** Softened point-source attenuation: finite at the source, inverse-square at distance. */
export function inverseSquareFalloff(distance,falloff=1){return 1/(1+Math.max(0,falloff)*Math.max(0,distance)**2);}

// Walk every source-to-target segment through the common grid. Shared cells are
// emitted once; overlapping paths never accumulate unbounded additive energy.
function trace(positions,colors,source,pitch,maxCells,maxSteps){
 const count=positions.length/3;
 const min=source.map(value=>Math.floor(value/pitch)),max=min.slice();
 for(let i=0;i<positions.length;i++) {const axis=i%3,index=Math.floor(positions[i]/pitch);min[axis]=Math.min(min[axis],index);max[axis]=Math.max(max[axis],index);}
 const nx=max[0]-min[0]+1,ny=max[1]-min[1]+1,nz=max[2]-min[2]+1,volume=nx*ny*nz;
 if(volume>16000000)return null;
 const occupied=new Uint32Array(volume),outPositions=new Float32Array(maxCells*3),outColors=new Float32Array(maxCells*3);
 const start=source.map(value=>Math.floor(value/pitch));let used=0,steps=0;
 for(let target=0;target<count;target++){
  const offset=target*3,end=[positions[offset],positions[offset+1],positions[offset+2]],goal=end.map(value=>Math.floor(value/pitch));
  const cell=start.slice(),delta=end.map((value,axis)=>value-source[axis]),step=delta.map(Math.sign);
  const tDelta=delta.map(value=>value===0?Infinity:pitch/Math.abs(value));
  const tMax=delta.map((value,axis)=>value===0?Infinity:((cell[axis]+(value>0?1:0))*pitch-source[axis])/value);
  for(;;){
   if(++steps>maxSteps)return null;
   const key=(cell[0]-min[0])+nx*((cell[1]-min[1])+ny*(cell[2]-min[2]));
   let index=occupied[key]-1;
   if(index<0){
    if(used===maxCells)return null;
    index=used++;occupied[key]=index+1;
    for(let axis=0;axis<3;axis++){outPositions[index*3+axis]=(cell[axis]+.5)*pitch;outColors[index*3+axis]=colors[offset+axis]??.5;}
   }else for(let axis=0;axis<3;axis++)outColors[index*3+axis]=Math.max(outColors[index*3+axis],colors[offset+axis]??.5);
   if(cell[0]===goal[0]&&cell[1]===goal[1]&&cell[2]===goal[2])break;
   const next=Math.min(...tMax);
   // Simultaneous crossings preserve a straight diagonal instead of adding
   // unrelated corner-adjacent voxels that the ray only touches at a point.
   for(let axis=0;axis<3;axis++)if(tMax[axis]<=next+1e-12){cell[axis]+=step[axis];tMax[axis]+=tDelta[axis];}
  }
 }
 return{positions:outPositions.slice(0,used*3),colors:outColors.slice(0,used*3),count:used,steps};
}

/** All targets remain represented; budget pressure coarsens by integer grid multiples. */
export function buildVoxelPaths({positions,colors,source,cellSize,maxCells=120000,maxSteps=2000000,previousMultiplier=1}={}){
 if(!positions||positions.length%3||!colors||colors.length!==positions.length||!finite3(source)||!Number.isFinite(cellSize)||cellSize<=0)throw new Error('Voxel paths require finite source, positions, colors, and a positive cell size.');
 if(!Number.isSafeInteger(maxCells)||maxCells<1||!Number.isSafeInteger(maxSteps)||maxSteps<1)throw new Error('Voxel path budgets must be positive integers.');
 if(!Number.isSafeInteger(previousMultiplier)||previousMultiplier<1)throw new Error('Previous voxel path multiplier must be a positive integer.');
 for(const value of positions)if(!Number.isFinite(value))throw new Error('Voxel path endpoints must be finite.');
 const count=positions.length/3;
 if(!count)return{positions:new Float32Array(),colors:new Float32Array(),count:0,steps:0,cellSize:cellSize*previousMultiplier,multiplier:previousMultiplier,endpointCount:0};
 // The Manhattan distance bounds DDA work; select a grid multiple before tracing.
 let estimate=count;const low=source.slice(),high=source.slice();
 for(let i=0;i<positions.length;i++){const axis=i%3;estimate+=Math.abs(positions[i]-source[axis])/cellSize;low[axis]=Math.min(low[axis],positions[i]);high[axis]=Math.max(high[axis],positions[i]);}
 const volume=low.reduce((product,value,axis)=>product*(Math.ceil((high[axis]-value)/cellSize)+1),1);
 // A projected bundle occupies a sizable fraction of its bounding box. Avoid
 // spending a full fine-grid traversal only to discover the cell budget late.
 const workMultiple=estimate/Math.max(1,maxSteps-count),volumeMultiple=Math.cbrt(volume/(maxCells*6));
 let multiplier=Math.max(1,Math.ceil(workMultiple),Math.ceil(volumeMultiple));
 // Retain the last grid near a budget boundary. Refinement needs 30% spare
 // estimated work and volume, so a tiny pan cannot alternate entire lattices.
 if(previousMultiplier>multiplier){
  const refineMultiple=Math.max(1,Math.ceil(workMultiple/.7),Math.ceil(volumeMultiple/Math.cbrt(.7)));
  multiplier=Math.min(previousMultiplier,refineMultiple);
 }
 for(let pass=0;pass<20;pass++){
  const result=trace(positions,colors,source,cellSize*multiplier,maxCells,Math.max(maxSteps,count));
  if(result)return{...result,cellSize:cellSize*multiplier,multiplier,endpointCount:count};
  // Estimates are only a starting point: a failed refinement retries the known
  // grid before coarsening further, and every result still passes hard budgets.
  multiplier=multiplier<previousMultiplier?previousMultiplier:multiplier*2;
 }
 throw new Error('Voxel path budget is too small for the endpoints.');
}

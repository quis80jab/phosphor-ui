export const PATH_FADE_MS=180;
const clamp=value=>Math.min(1,Math.max(0,value));
const bits=positions=>{
 const values=positions instanceof Float32Array?positions:new Float32Array(positions);
 return new Uint32Array(values.buffer,values.byteOffset,values.length);
};
function hash(values,words,i){
 // Normalize signed zero, which represents the same lattice position. Colliding
 // hashes are always checked against all three coordinates before matching.
 let value=Math.imul(values[i]===0?0:words[i],0x9e3779b1);
 value=Math.imul(value^(values[i+1]===0?0:words[i+1]),0x85ebca6b);
 value=Math.imul(value^(values[i+2]===0?0:words[i+2]),0xc2b2ae35);
 return(value^(value>>>16))>>>0;
}
const same=(a,i,b,j)=>a[i]===b[j]&&a[i+1]===b[j+1]&&a[i+2]===b[j+2];

/** Retarget from the light already on screen, never restart a disappearing cell's fade. */
export function blendVoxelPaths(previous,next,elapsedMs=0,{fade=true,maxTrailCells=240000}={}){
 const targetCount=next.positions.length/3;
 if(!fade||!previous?.positions.length)return{positions:next.positions,colors:next.colors,fromColors:next.colors.slice(),durations:new Float32Array(targetCount),targetCount,duration:0};
 const elapsed=Math.max(0,elapsedMs),oldCount=previous.positions.length/3;
 const oldBits=bits(previous.positions),nextBits=bits(next.positions);
 let bucketCount=1;while(bucketCount<oldCount*2)bucketCount*=2;
 const buckets=new Uint32Array(bucketCount),links=new Uint32Array(oldCount),consumed=new Uint8Array(oldCount),matches=new Uint32Array(targetCount),mask=bucketCount-1;
 for(let index=0;index<oldCount;index++){
  const i=index*3,bucket=hash(previous.positions,oldBits,i)&mask;
  // Normally unique by construction; retain last-value matching if a caller
  // supplies duplicate cells, just as the earlier Map implementation did.
  for(let item=buckets[bucket];item;item=links[item-1])if(same(previous.positions,(item-1)*3,previous.positions,i))consumed[item-1]=1;
  links[index]=buckets[bucket];buckets[bucket]=index+1;
 }
 for(let index=0;index<targetCount;index++){
  const i=index*3,bucket=hash(next.positions,nextBits,i)&mask;
  for(let item=buckets[bucket];item;item=links[item-1]){
   const oldIndex=item-1;
   if(!consumed[oldIndex]&&same(previous.positions,oldIndex*3,next.positions,i)){matches[index]=item;consumed[oldIndex]=1;break;}
  }
 }
 let retiring=new Uint32Array(oldCount),retiringCount=0;
 const peaks=new Float64Array(oldCount);
 for(let index=0;index<oldCount;index++){
  if(consumed[index])continue;
  const i=index*3,oldDuration=previous.durations[index],mix=oldDuration?clamp(elapsed/oldDuration):1;
  const r=previous.fromColors[i]+(previous.colors[i]-previous.fromColors[i])*mix;
  const g=previous.fromColors[i+1]+(previous.colors[i+1]-previous.fromColors[i+1])*mix;
  const b=previous.fromColors[i+2]+(previous.colors[i+2]-previous.fromColors[i+2])*mix;
  const peak=Math.max(r,g,b),wasRetiring=previous.colors[i]===0&&previous.colors[i+1]===0&&previous.colors[i+2]===0;
  if(peak<1/4096||(wasRetiring&&oldDuration<=elapsed))continue;
  retiring[retiringCount++]=index;peaks[index]=peak;
 }
 // Keep memory/draw cost bounded even during overlapping streaming responses.
 // Ordinary 60ms map updates retain the complete 180ms trail, including LOD changes.
 if(retiringCount>maxTrailCells){retiring=retiring.subarray(0,retiringCount);retiring.sort((a,b)=>peaks[b]-peaks[a]);retiringCount=maxTrailCells;}
 const count=targetCount+retiringCount,positions=new Float32Array(count*3),colors=new Float32Array(count*3),fromColors=new Float32Array(count*3),durations=new Float32Array(count);
 positions.set(next.positions);colors.set(next.colors);let duration=0;
 function writeCurrent(index,offset){
  const i=index*3,oldDuration=previous.durations[index],mix=oldDuration?clamp(elapsed/oldDuration):1;
  for(let axis=0;axis<3;axis++)fromColors[offset*3+axis]=previous.fromColors[i+axis]+(previous.colors[i+axis]-previous.fromColors[i+axis])*mix;
 }
 for(let index=0;index<targetCount;index++){
  const oldIndex=matches[index]-1,i=index*3;
  if(oldIndex>=0){
   writeCurrent(oldIndex,index);
   const j=oldIndex*3,unchanged=same(previous.colors,j,next.colors,i);
   durations[index]=unchanged?Math.max(0,previous.durations[oldIndex]-elapsed):PATH_FADE_MS;
  }else durations[index]=PATH_FADE_MS;
  duration=Math.max(duration,durations[index]);
 }
 for(let index=0;index<retiringCount;index++){
  const oldIndex=retiring[index],i=oldIndex*3,offset=targetCount+index;
  for(let axis=0;axis<3;axis++)positions[offset*3+axis]=previous.positions[i+axis];
  writeCurrent(oldIndex,offset);
  const wasRetiring=previous.colors[i]===0&&previous.colors[i+1]===0&&previous.colors[i+2]===0;
  const remaining=wasRetiring?Math.max(0,previous.durations[oldIndex]-elapsed):PATH_FADE_MS;
  durations[offset]=remaining;duration=Math.max(duration,remaining);
 }
 return{positions,colors,fromColors,durations,targetCount,duration};
}

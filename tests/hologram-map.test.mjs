import test from 'node:test';
import assert from 'node:assert/strict';
import {createHologramMap,MAP_BOUNDS,MAP_DEFAULTS,createMapTiles,mapSpot,tileMeetsSpot,mapQuery,coastlineLand,projectMapPoint,unprojectMapPoint,hologramGlowParameters,hologramBandAtHeight,hologramVoxelEmission,hologramConeContains,HOLOGRAM_LIGHTING,MAP_ORBIT_MARKER} from '../dist/hologram-map.js';
const settle=async()=>{for(let i=0;i<16;i++)await Promise.resolve();};
const ring=(lon,lat)=>[{lon:lon-.00015,lat:lat-.00015},{lon:lon+.00015,lat:lat-.00015},{lon:lon+.00015,lat:lat+.00015},{lon:lon-.00015,lat:lat+.00015},{lon:lon-.00015,lat:lat-.00015}];
const elements=[{type:'way',id:1,tags:{building:'yes',height:'30'},geometry:ring(-122.3945,37.7955)},{type:'way',id:2,tags:{building:'yes'},geometry:ring(-122.3988,37.7987)}];
function network(){const requests=[];let count=0,max=0;const fetchImpl=(url,{signal})=>new Promise((resolve,reject)=>{count++;max=Math.max(max,count);const request={url,signal,done:false,finish(data={elements}){if(this.done)return;this.done=true;count--;resolve({ok:true,json:async()=>data});},fail(){if(this.done)return;this.done=true;count--;reject(new Error('Offline test'));}};signal.addEventListener('abort',()=>{if(!request.done){request.done=true;count--;reject(new DOMException('Aborted','AbortError'));}},{once:true});requests.push(request);});return{fetchImpl,requests,get max(){return max;},async drain(){for(let pass=0;pass<20;pass++){await settle();const pending=requests.filter(r=>!r.done);if(!pending.length)break;for(const request of pending)request.finish();}await settle();}};}
test('localized map tiles use one meter plane and complete-ring Overpass queries',()=>{
 const tiles=createMapTiles(),selected=tiles.filter(tile=>tileMeetsSpot(tile,mapSpot(MAP_DEFAULTS)));assert.equal(tiles.length,9);assert.ok(selected.length>0&&selected.length<9);assert.deepEqual(projectMapPoint([-122.3945,37.7955]),[0,-0]);assert.ok(Math.abs(projectMapPoint([MAP_BOUNDS.east,37.7955])[0]-2)<1e-8);
 const query=mapQuery(tiles[0].bounds);assert.match(query,/building:part/);assert.match(query,/relation\[type=multipolygon\]/);assert.ok(query.endsWith('out geom;'));assert.ok(!/out geom\(/.test(query));
});
test('map source projection round-trips longitude and latitude without swapping axes',()=>{
 for(const point of[MAP_ORBIT_MARKER.center,[MAP_BOUNDS.west,MAP_BOUNDS.south],[MAP_BOUNDS.east,MAP_BOUNDS.north],[-122.3945,37.7955]])assert.deepEqual(unprojectMapPoint(projectMapPoint(point)),point);
});
test('directed coastline fragments join across internal OSM-way endpoints and retain land-left',()=>{
 const bounds={west:0,south:0,east:10,north:10};const polygons=coastlineLand([{points:[[5,5],[5,12]]},{points:[[5,-2],[5,5]]}],bounds);assert.equal(polygons.length,1);assert.ok(polygons[0].outer.some(([x])=>x===0));assert.ok(!polygons[0].outer.some(([x])=>x===10));
});
test('live queue stays bounded/local, deduplicates source IDs, changes detailed CPU geometry, and disposes',async t=>{
 const net=network(),updates=[],map=createHologramMap({fetchImpl:net.fetchImpl,onProgress:update=>updates.push(update)});t.after(()=>map.dispose());await settle();assert.equal(net.requests.length,2);await net.drain();assert.ok(net.requests.length<=10);assert.equal(net.max,2);assert.equal(map.getStatus().buildingCount,2);assert.equal(map.getStatus().estimatedHeights,1);assert.equal(map.getStatus().detailedBuildings,1);assert.equal(map.getStatus().status,'ready');
 const initialRequests=net.requests.length;map.setSettings({x:-.8,z:-.8,radius:.2});await new Promise(resolve=>setTimeout(resolve,70));await net.drain();assert.equal(map.getStatus().detailedBuildings,1);assert.ok(net.requests.length>=initialRequests);assert.ok(net.requests.length<=10);
 const totalBefore=net.requests.length;map.setSettings(MAP_DEFAULTS);await new Promise(resolve=>setTimeout(resolve,70));await net.drain();assert.equal(net.requests.length,totalBefore);
 map.restore();map.dispose();assert.equal(map.group.children.length,0);assert.ok(net.requests.every(request=>request.done));
});
test('offline errors remain honest and retryable; switching away aborts, and a late response cannot revive disposed geometry',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await settle();map.setActive(false);await settle();assert.ok(net.requests.every(request=>request.signal.aborted));const count=net.requests.length;map.setActive(true);await settle();assert.ok(net.requests.length>count);
 for(let pass=0;pass<15;pass++){for(const request of net.requests.filter(r=>!r.done))request.fail();await settle();}assert.equal(map.getStatus().status,'error');assert.equal(map.getStatus().buildingCount,0);assert.ok(map.getStatus().error);
 map.retry();await settle();assert.ok(net.requests.some(request=>!request.done));map.dispose();await settle();assert.equal(map.group.children.length,0);assert.ok(net.requests.every(request=>request.done));
});

test('inactive abort during pending JSON resets tile state so reactivation retries instead of remaining loading',async t=>{
 const calls=[];const map=createHologramMap({fetchImpl:async(url,{signal})=>{const item={url,signal};calls.push(item);return{ok:true,json:()=>new Promise(resolve=>item.resolve=resolve)};}});t.after(()=>map.dispose());
 await settle();assert.equal(calls.length,2);map.setActive(false);map.setActive(true);assert.equal(calls.length,2);for(const call of calls.slice())call.resolve({elements});await settle();assert.equal(calls.length,4);assert.ok(calls.slice(0,2).every(call=>call.signal.aborted));assert.ok(calls.slice(2).every(call=>!call.signal.aborted));
 map.dispose();for(const call of calls.slice(2))call.resolve({elements});await settle();assert.equal(map.group.children.length,0);
});

test('a richer tile response replaces same-ID cached voxel topology, height, and color',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await settle();
 const original={type:'way',id:99,tags:{building:'yes',height:'10','building:colour':'#ff0000'},geometry:ring(-122.3945,37.7955)};
 net.requests[0].finish({elements:[]});net.requests[1].finish({elements:[original]});await settle();
 const detail=map.group.getObjectByName('hologram-voxel-cells');const initialGeometry=detail.geometry;
 const maxY=geometry=>{let value=0;const positions=geometry.attributes.voxelOffset.array;for(let i=1;i<positions.length;i+=3)value=Math.max(value,positions[i]);return value;};
 const oldHeight=maxY(initialGeometry);assert.ok(oldHeight>0);assert.equal(initialGeometry.attributes.voxelColor.array[0],1);assert.equal(initialGeometry.attributes.voxelColor.array[2],0);
 const triangle=[{lon:-122.39465,lat:37.79535},{lon:-122.39435,lat:37.79535},{lon:-122.3945,lat:37.79565},{lon:-122.39465,lat:37.79535}];
 const richer={...original,tags:{...original.tags,height:'50','building:colour':'#0000ff'},geometry:triangle};
 net.requests.find(request=>!request.done).finish({elements:[richer]});await settle();
 assert.ok(maxY(detail.geometry)>oldHeight*3);assert.notEqual(detail.geometry.instanceCount,initialGeometry.instanceCount);assert.equal(detail.geometry.attributes.voxelColor.array[0],0);assert.equal(detail.geometry.attributes.voxelColor.array[2],1);
 const refreshedGeometry=detail.geometry;map.setSettings({height:4,intensity:2,edge:2,pathGain:.5,falloff:2});assert.equal(detail.geometry,refreshedGeometry);
});

test('map content translates under a fixed projector while voxel instances refresh throughout dragging without rebaking',async t=>{
 const net=network(),updates=[],map=createHologramMap({fetchImpl:net.fetchImpl,onProgress:update=>updates.push(update)});t.after(()=>map.dispose());await net.drain();
 const content=map.group.getObjectByName('map-content'),apex=map.group.getObjectByName('map-projector-apex'),rays=map.group.getObjectByName('map-projector-voxel-paths'),rim=map.group.getObjectByName('map-projector-rim'),cells=map.group.getObjectByName('hologram-voxel-cells'),halo=map.group.getObjectByName('hologram-cell-glow');
 const apexPosition=apex.position.clone(),rayPosition=rays.position.clone(),rimPoints=Array.from(rim.geometry.attributes.position.array),builds=map.getStatus().voxelBuilds;
 assert.ok(cells.geometry.instanceCount>0);assert.equal(cells.geometry.instanceCount,halo.geometry.attributes.position.count);assert.ok(map.getStatus().voxelCount>=cells.geometry.instanceCount);
 const start=updates.length;for(let i=1;i<=8;i++){map.setTranslation({x:i*.06,z:.1});await new Promise(resolve=>setTimeout(resolve,20));}
 assert.ok(updates.slice(start).some(update=>update.translation.x>0&&update.translation.x<.48));await new Promise(resolve=>setTimeout(resolve,70));await net.drain();
 assert.deepEqual(apex.position,apexPosition);assert.deepEqual(rays.position,rayPosition);assert.deepEqual(Array.from(rim.geometry.attributes.position.array),rimPoints);assert.equal(content.position.x,.48);assert.equal(content.position.z,.1);assert.equal(cells.material.uniforms.uOffset.value.x,.48);assert.equal(map.getStatus().voxelBuilds,builds);
 assert.equal(map.metadata.visibleVoxels,cells.geometry.instanceCount);assert.equal(map.metadata.voxelCellSize,map.getStatus().voxelCellSize);
 map.setTranslation({x:100,z:-100});assert.deepEqual(map.getStatus().translation,{x:4,z:-4});
});

test('EDGE controls a bounded horizontal bleed while zero preserves only the ordinary halo',async t=>{
 assert.deepEqual(hologramGlowParameters(0,2),{haloPixels:14,bleedPixels:14,streakStrength:0});
 const normal=hologramGlowParameters(1.4,1),strong=hologramGlowParameters(3,1);assert.ok(normal.bleedPixels>=24&&normal.bleedPixels<=36);assert.equal(strong.bleedPixels,36);assert.ok(strong.streakStrength>normal.streakStrength);assert.equal(hologramGlowParameters(1.4,1.5).bleedPixels,normal.bleedPixels*1.5);
 const map=createHologramMap({fetchImpl:(_,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}))});t.after(()=>map.dispose());const halo=map.group.getObjectByName('hologram-cell-glow'),cells=map.group.getObjectByName('hologram-voxel-cells'),geometry=cells.geometry;
 map.setSettings({edge:0});assert.equal(halo.material.uniforms.uBleed.value.y,0);assert.equal(halo.material.uniforms.uBleed.value.x,halo.material.uniforms.uHaloSize.value);
 map.setSettings({edge:3});assert.ok(halo.material.uniforms.uBleed.value.y>0);assert.ok(halo.material.uniforms.uBleed.value.x>halo.material.uniforms.uHaloSize.value);assert.equal(cells.geometry,geometry);
});

test('a low projector preserves full-height wireframes but excludes filled cells above its apex',async t=>{
 const tall={type:'way',id:501,tags:{building:'yes',height:'500'},geometry:ring(-122.3945,37.7955)};
 const map=createHologramMap({fetchImpl:async()=>({ok:true,json:async()=>({elements:[tall]})})});t.after(()=>map.dispose());map.setSettings({x:0,z:0,height:1});await settle();
 const cells=map.group.getObjectByName('hologram-voxel-cells');
 const highEdges=()=>{const found=[];const a=cells.geometry.attributes.voxelOffset.array,e=cells.geometry.attributes.voxelEdge.array;for(let i=0;i<e.length;i++)if(a[i*3+1]>1){assert.equal(e[i],1,'only feature edges survive above the source');found.push(Array.from(a.slice(i*3,i*3+3)).join(','));}return found;};
 const initialHighEdges=highEdges();assert.ok(initialHighEdges.length>0);assert.ok(initialHighEdges.some(key=>Number(key.split(',')[1])>2));
 const originalCount=map.getStatus().voxelCount,contextCount=cells.geometry.instanceCount;
 map.setSettings({enabled:false});await new Promise(resolve=>setTimeout(resolve,70));await settle();assert.equal(map.getStatus().voxelCount,originalCount);assert.ok(cells.geometry.instanceCount>contextCount);
 map.setSettings({enabled:true,height:1});await new Promise(resolve=>setTimeout(resolve,70));assert.deepEqual(highEdges(),initialHighEdges);assert.equal(map.getStatus().voxelCount,originalCount);
});

test('outer building preview uses the same cells in a thirty-percent full-height footprint band',async t=>{
 assert.deepEqual(hologramBandAtHeight(2,4,0),{inner:2,outer:2.6,insideHeight:true});assert.deepEqual(hologramBandAtHeight(2,4,2),{inner:1,outer:2.6,insideHeight:true});assert.deepEqual(hologramBandAtHeight(2,4,5),{inner:0,outer:2.6,insideHeight:false});assert.equal(1+HOLOGRAM_LIGHTING.buildingEdgeBoost,1.2);
 const outside={type:'way',id:999,tags:{building:'yes',height:'9'},geometry:ring(-122.39285,37.7955)},map=createHologramMap({fetchImpl:async()=>({ok:true,json:async()=>({elements:[outside]})})});t.after(()=>map.dispose());map.setSettings({edge:0});await settle();
 const cells=map.group.getObjectByName('hologram-voxel-cells'),halo=map.group.getObjectByName('hologram-cell-glow'),positions=cells.geometry.attributes.voxelOffset.array,pitch=map.getStatus().voxelCellSize,spot=mapSpot(MAP_DEFAULTS);let bandCells=0;
 for(let i=0;i<positions.length;i+=3){const x=positions[i],y=positions[i+1],z=positions[i+2],band=hologramBandAtHeight(spot.radius,MAP_DEFAULTS.height,y),d=Math.hypot(x-spot.x,z-spot.z);if(d>band.inner&&d<band.outer){bandCells++;assert.equal(cells.geometry.attributes.voxelEdge.array[i/3],1);}for(const value of[x,y,z])assert.ok(Math.abs(value/pitch-.5-Math.round(value/pitch-.5))<1e-5);}
 assert.ok(bandCells>0);assert.equal(cells.material.uniforms.uOutlineScale.value,1.3);assert.equal(cells.material.uniforms.uOutlineFadeStart.value,1.225);assert.equal(cells.material.uniforms.uBuildingEdgeBoost.value,.2);assert.equal(cells.material.uniforms.uOutlineGain,undefined);assert.equal(halo.material.uniforms.uBuildingEdgeBoost.value,.2);assert.equal(halo.geometry.attributes.position.count,cells.geometry.instanceCount);
 const geometry=cells.geometry,builds=map.getStatus().voxelBuilds;map.setSettings({edge:2.5});assert.equal(cells.geometry,geometry);assert.equal(map.getStatus().voxelBuilds,builds);
});


test('wireframe edges are 20% above local emission, only edge cells survive outside the cone',()=>{
 assert.equal(hologramVoxelEmission(2,4,0,1,false),1);
 assert.equal(hologramVoxelEmission(2,4,0,1,true),1.2);
 assert.equal(hologramVoxelEmission(2,4,0,2.1,false),0);
 assert.equal(hologramVoxelEmission(2,4,0,2.1,true),1.2);
 assert.equal(hologramVoxelEmission(2,4,0,2.45,true),1.2,'full gain through the first three quarters of the context band');
 assert.ok(Math.abs(hologramVoxelEmission(2,4,0,2.525,true)-.6)<1e-12);
 assert.equal(hologramVoxelEmission(2,4,0,2.6,true),0);
 assert.equal(hologramVoxelEmission(2,4,5,1,true),1.2,'above-apex edges remain visible');
 assert.equal(hologramVoxelEmission(2,4,5,1,false),0,'above-apex facade fill remains clipped');
 assert.equal(hologramVoxelEmission(2,4,-1,1,true),0,'no context below the map');
});
test('actual lit endpoints trace to a fixed source, gain/falloff stay shader-only and lifecycle is complete',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await net.drain();
 const paths=map.group.getObjectByName('map-projector-voxel-paths'),cells=map.group.getObjectByName('hologram-voxel-cells');
 assert.equal(map.group.getObjectByName('map-projector-rays'),undefined);assert.equal(paths.parent,map.group);assert.ok(paths.geometry.attributes.position.count>0);const a=cells.geometry.attributes.voxelOffset.array,spot=mapSpot(MAP_DEFAULTS);let coneCount=0;
 for(let i=0;i<a.length;i+=3)if(hologramConeContains(spot.radius,MAP_DEFAULTS.height,a[i+1],Math.hypot(a[i]-spot.x,a[i+2]-spot.z)))coneCount++;
 assert.equal(map.getStatus().traceEndpoints,cells.geometry.instanceCount);assert.ok(coneCount<=cells.geometry.instanceCount);assert.equal(map.getStatus().traceVoxels,paths.geometry.attributes.position.count);
 const original=paths.geometry,builds=map.getStatus().voxelBuilds;
 map.setSettings({pathGain:.55,falloff:4});assert.equal(paths.geometry,original);assert.equal(paths.material.uniforms.uPathGain.value,.55);assert.equal(paths.material.uniforms.uFalloff.value,4);assert.equal(map.getStatus().voxelBuilds,builds);
 map.setSettings({x:.1,height:4});await new Promise(resolve=>setTimeout(resolve,70));await net.drain();assert.notEqual(paths.geometry,original);assert.equal(paths.material.uniforms.uSpot.value.x,.2);assert.equal(paths.material.uniforms.uSpot.value.w,4);
 const attribute=paths.geometry.attributes.position,version=attribute.version;map.restore();assert.ok(attribute.version>version);
 let disposed=0;paths.geometry.addEventListener('dispose',()=>disposed++);paths.material.addEventListener('dispose',()=>disposed++);map.dispose();assert.equal(disposed,2);
});


test('context-only side buildings and above-apex wireframes trace to the projector with shared falloff',async t=>{
 const side={type:'way',id:701,tags:{building:'yes',height:'30'},geometry:ring(-122.3913,37.7955)};
 const raised={type:'way',id:702,tags:{building:'yes',height:'500',min_height:'300'},geometry:ring(-122.3945,37.7955)};
 const map=createHologramMap({fetchImpl:async()=>({ok:true,json:async()=>({elements:[side,raised]})})});t.after(()=>map.dispose());map.setSettings({x:0,z:0,height:1});await settle();
 const cells=map.group.getObjectByName('hologram-voxel-cells'),paths=map.group.getObjectByName('map-projector-voxel-paths'),positions=cells.geometry.attributes.voxelOffset.array;
 assert.ok(cells.geometry.instanceCount>0);assert.ok([...cells.geometry.attributes.voxelEdge.array].every(edge=>edge===1));
 assert.ok(Array.from({length:positions.length/3},(_,i)=>positions[i*3+1]).some(y=>y>2),'complete tall wireframe retained');
 assert.ok(Array.from({length:positions.length/3},(_,i)=>positions[i*3]).some(x=>x>1.2),'expanded footprint retains side building');
 assert.equal(map.getStatus().traceEndpoints,cells.geometry.instanceCount);assert.ok(paths.geometry.attributes.position.count>0);
 const pitch=map.getStatus().voxelCellSize*map.getStatus().traceGridMultiple,key=(x,y,z)=>[x,y,z].map(v=>Math.floor(v/pitch)).join(',');
 const keys=new Set(),traced=paths.geometry.attributes.position.array;
 for(let i=0;i<traced.length;i+=3)keys.add(key(traced[i],traced[i+1],traced[i+2]));
 for(let i=0;i<positions.length;i+=3)assert.ok(keys.has(key(positions[i],positions[i+1],positions[i+2])),'every visible wireframe cell is a path endpoint');
 const geometry=paths.geometry;map.setSettings({pathGain:.4,falloff:6});assert.equal(paths.geometry,geometry);assert.equal(paths.material.uniforms.uPathGain.value,.4);assert.equal(paths.material.uniforms.uFalloff.value,6);
 map.setSettings({pathGain:0});assert.equal(paths.visible,false);assert.equal(paths.geometry,geometry);map.setSettings({pathGain:.4});assert.equal(paths.visible,true);
 const source=map.group.getObjectByName('map-projector-apex').position.clone();map.setTranslation({x:-.6,z:0});await new Promise(resolve=>setTimeout(resolve,70));
 assert.ok(map.getStatus().traceEndpoints>0,'moving the map keeps the visible cells connected to the fixed source');assert.deepEqual(map.group.getObjectByName('map-projector-apex').position,source);
 map.setSettings({enabled:false});await new Promise(resolve=>setTimeout(resolve,70));assert.equal(paths.visible,false);assert.equal(map.getStatus().traceEndpoints,0);assert.equal(paths.geometry.attributes.position.count,0);
});


test('projector zoom magnifies geometry around the illuminated geographic point on a fixed stage',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());map.setSettings({x:0,z:0});await net.drain();
 const content=map.group.getObjectByName('map-content'),stage=map.group.getObjectByName('map-stage'),apex=map.group.getObjectByName('map-projector-apex'),rim=map.group.getObjectByName('map-projector-rim'),cells=map.group.getObjectByName('hologram-voxel-cells');
 const stageGeometry=stage.geometry,stagePosition=stage.position.clone(),stageScale=stage.scale.clone(),apexPosition=apex.position.clone(),rimGeometry=Array.from(rim.geometry.attributes.position.array),displayPitch=map.getStatus().voxelCellSize;
 const maximumY=()=>{let y=0;for(let i=1;i<cells.geometry.attributes.voxelOffset.array.length;i+=3)y=Math.max(y,cells.geometry.attributes.voxelOffset.array[i]*content.scale.y);return y;};
 const originalHeight=maximumY();map.setTranslation({x:.1,z:-.05});map.setZoom(4);await new Promise(resolve=>setTimeout(resolve,75));await net.drain();
 assert.equal(map.getStatus().zoom,4);assert.equal(map.metadata.zoom,4);assert.equal(content.scale.x,4);assert.equal(content.scale.y,4);assert.equal(content.position.x,.4);assert.equal(content.position.z,-.2);
 assert.ok(Math.abs(maximumY()-originalHeight*4)<displayPitch*4,'physical building height magnifies, keeping voxel sampling pitch');
 assert.ok(Math.abs(map.getStatus().voxelCellSize-displayPitch)<1e-10);assert.equal(cells.material.uniforms.uVoxelSize.value*content.scale.x,displayPitch);assert.equal(cells.material.uniforms.uZoom.value,4);
 assert.equal(stage.parent,map.group);assert.equal(stage.geometry,stageGeometry);assert.deepEqual(stage.position,stagePosition);assert.deepEqual(stage.scale,stageScale);assert.equal(stage.material.uniforms.uZoom.value,1);assert.equal(stage.material.uniforms.uOffset.value.length(),0);
 assert.deepEqual(apex.position,apexPosition);assert.deepEqual(Array.from(rim.geometry.attributes.position.array),rimGeometry);assert.equal(cells.material.uniforms.uSpot.value.x,0);assert.equal(cells.material.uniforms.uSpot.value.w,3);
 assert.equal(-.1*content.scale.x+content.position.x,0,'the same geographic point stays beneath the projector');assert.equal(.05*content.scale.z+content.position.z,0);
 const buildings=map.getStatus().voxelBuilds;map.setTranslation({x:.11,z:-.05});await new Promise(resolve=>setTimeout(resolve,75));assert.equal(map.getStatus().voxelBuilds,buildings,'a small close-up pan reuses its padded source cache');
 map.setZoom(100);assert.equal(map.getStatus().zoom,12);map.setZoom(.1);assert.equal(map.getStatus().zoom,.55);
});

test('zoomed paths start at transformed lit cells and terminate at the stationary projector on the same lattice',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());map.setSettings({x:0,z:0});await net.drain();map.setTranslation({x:.05,z:-.025});map.setZoom(6);await new Promise(resolve=>setTimeout(resolve,75));await net.drain();
 const cells=map.group.getObjectByName('hologram-voxel-cells'),content=map.group.getObjectByName('map-content'),paths=map.group.getObjectByName('map-projector-voxel-paths'),apex=map.group.getObjectByName('map-projector-apex');
 const scale=content.scale.x,pitch=map.getStatus().voxelCellSize,step=pitch*map.getStatus().traceGridMultiple,offset=content.position;
 const key=(x,y,z)=>[Math.floor(x/step),Math.floor(y/step),Math.floor(z/step)].join(',');
 const pathKeys=new Set();let sourceDistance=Infinity;const traced=paths.geometry.attributes.position.array;
 for(let i=0;i<traced.length;i+=3){pathKeys.add(key(traced[i],traced[i+1],traced[i+2]));sourceDistance=Math.min(sourceDistance,Math.hypot(traced[i]-apex.position.x,traced[i+1]-apex.position.y,traced[i+2]-apex.position.z));}
 let endpointCount=0;const a=cells.geometry.attributes.voxelOffset.array;
 for(let i=0;i<a.length;i+=3){const x=a[i]*scale+offset.x,y=a[i+1]*scale,z=a[i+2]*scale+offset.z;endpointCount++;assert.ok(pathKeys.has(key(x,y,z)),'every visible transformed voxel, including wireframes, has a traced path');}
 assert.ok(endpointCount>0);assert.equal(map.getStatus().traceEndpoints,endpointCount);assert.ok(sourceDistance<=step*Math.sqrt(3));assert.equal(paths.parent,map.group);assert.equal(paths.scale.x,1);assert.equal(paths.position.length(),0);
 const previous=paths.geometry;map.setSettings({falloff:5});assert.equal(paths.geometry,previous);assert.equal(paths.material.uniforms.uFalloff.value,5);assert.equal(paths.material.uniforms.uSpot.value.w,3);
});

test('pier close-up streams the inverse footprint and bounds sampling while retaining a fixed display pitch',async t=>{
 const pier={type:'way',id:25489482,tags:{building:'yes',height:'10'},geometry:ring(-122.39415965,37.7973889)};
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());map.setTranslation({x:-.73614,z:.9561591881});map.setZoom(12);
 for(let pass=0;pass<12;pass++){await settle();const pending=net.requests.filter(r=>!r.done);if(!pending.length)break;for(const request of pending)request.finish({elements:[pier]});}await settle();
 assert.ok(net.requests.length<=3,'only the pier footprint plus contextual map is requested');assert.ok(map.getStatus().visibleVoxels>0);assert.ok(map.getStatus().voxelCount<=80000);assert.ok(Math.abs(map.getStatus().voxelCellSize-.04)<1e-8);assert.equal(map.getStatus().detailedBuildings,1);
 const content=map.group.getObjectByName('map-content'),point=projectMapPoint([-122.39415965,37.7973889]);assert.ok(Math.abs(point[0]*12+content.position.x+.6)<.001);assert.ok(Math.abs(point[1]*12+content.position.z)<.001);
 map.setSettings({radius:.2});await new Promise(resolve=>setTimeout(resolve,75));const builds=map.getStatus().voxelBuilds;map.setTranslation({x:-.73604,z:.9561591881});await new Promise(resolve=>setTimeout(resolve,75));assert.equal(map.getStatus().voxelBuilds,builds,'minimum-radius close-up retains a cache margin for small pans');
 map.setTranslation({x:-4,z:4});await new Promise(resolve=>setTimeout(resolve,75));assert.equal(map.getStatus().visibleVoxels,0);assert.equal(map.getStatus().traceEndpoints,0);
});

test('panning keeps path cells on the stationary projector grid and fades while the drone is held',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await net.drain();
 const paths=map.group.getObjectByName('map-projector-voxel-paths');map.setMarkerHeld(true);assert.equal(map.updateAnimation(0),false);
 const source=map.group.getObjectByName('map-projector-apex').position.clone();
 map.setTranslation({x:.013,z:.007});await new Promise(resolve=>setTimeout(resolve,75));
 const geometry=paths.geometry,position=geometry.attributes.position.array,from=geometry.attributes.pathFromColor.array,color=geometry.attributes.color.array;
 const pitch=map.getStatus().voxelCellSize*map.getStatus().traceGridMultiple;
 for(const value of position)assert.ok(Math.abs(value/pitch-Math.floor(value/pitch)-.5)<1e-4,'panning cannot shift the path lattice');
 assert.ok(from.some((value,index)=>value!==color[index]),'changed occupancy carries a fade');
 assert.equal(map.updateAnimation(16),true,'path fade requests frames even when the drone is held');
 assert.equal(paths.material.uniforms.uPathElapsed.value,16);assert.equal(paths.geometry,geometry,'animation advances a uniform, not geometry');
 map.suspendMarkerAnimation();map.updateAnimation(10000);assert.equal(paths.material.uniforms.uPathElapsed.value,16,'resume preserves the displayed brightness');
 for(let time=10016;time<=10224;time+=16)map.updateAnimation(time);
 assert.equal(map.updateAnimation(10240),false);assert.equal(geometry.drawRange.count,map.getStatus().traceVoxels,'fully faded retired cells stop drawing');
 assert.deepEqual(map.group.getObjectByName('map-projector-apex').position,source);
 map.setSettings({enabled:false});await new Promise(resolve=>setTimeout(resolve,75));assert.equal(paths.visible,false);assert.equal(paths.geometry.attributes.position.count,0);
});


test('red park marker follows a ten-second demo circle without rebuilding map or projection paths',async t=>{
 const net=network();let progress=0,dirty=0;const map=createHologramMap({fetchImpl:net.fetchImpl,onProgress:()=>progress++,onDirty:()=>dirty++});t.after(()=>map.dispose());
 assert.equal(map.updateAnimation(0),false);assert.equal(map.getMarkerState().visible,false);await net.drain();
 const marker=map.group.getObjectByName('map-park-orbit-marker'),content=map.group.getObjectByName('map-content'),cells=map.group.getObjectByName('hologram-voxel-cells'),paths=map.group.getObjectByName('map-projector-voxel-paths');
 assert.equal(marker.parent,content);assert.equal(marker.isPoints,true);assert.equal(marker.material.depthWrite,false);assert.equal(marker.material.depthTest,true);assert.equal(marker.material.toneMapped,false);
 const cellsGeometry=cells.geometry,pathsGeometry=paths.geometry,markerGeometry=marker.geometry,builds=map.getStatus().voxelBuilds,events=[progress,dirty],center=projectMapPoint(MAP_ORBIT_MARKER.center);
 const samples=[];for(const time of[0,2500,5000,7500,10000]){assert.equal(map.updateAnimation(time),true);samples.push(map.getMarkerState());}
 assert.equal(samples[0].name,'Sue Bierman Park');assert.equal(samples[0].source,'demo');assert.ok(samples.every(sample=>sample.visible));assert.deepEqual(samples[4].sourcePosition,samples[0].sourcePosition);
 const radius=Math.hypot(samples[0].sourcePosition[0]-center[0],samples[0].sourcePosition[2]-center[1]);assert.ok(radius>.04&&radius<.05);
 for(const sample of samples)assert.ok(Math.abs(Math.hypot(sample.sourcePosition[0]-center[0],sample.sourcePosition[2]-center[1])-radius)<1e-7);
 assert.ok(samples[0].sourcePosition[0]>samples[2].sourcePosition[0]);assert.ok(samples[1].sourcePosition[2]>samples[3].sourcePosition[2]);
 const metersLat=111320,metersLon=metersLat*Math.cos(37.7955*Math.PI/180);
 for(const sample of samples){
  assert.ok(Math.abs(Math.hypot((sample.longitude-MAP_ORBIT_MARKER.center[0])*metersLon,(sample.latitude-MAP_ORBIT_MARKER.center[1])*metersLat)-10)<.0001,'GPS follows the ten-metre circle');
  assert.ok(Math.abs(sample.altitude-8)<.00001,'altitude stays in source metres above the demo plane');
 }
 assert.ok(samples[0].longitude>samples[2].longitude);assert.ok(samples[1].latitude<samples[3].latitude,'positive source Z travels south');
 for(let frame=0;frame<120;frame++)map.updateAnimation(frame*16.667);
 assert.equal(cells.geometry,cellsGeometry);assert.equal(paths.geometry,pathsGeometry);assert.equal(marker.geometry,markerGeometry);assert.equal(map.getStatus().voxelBuilds,builds);assert.deepEqual([progress,dirty],events,'animation emits no map progress or redraw callbacks');
});

test('park marker uses map transforms with a fixed pixel size and honors stage/cone visibility',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await net.drain();map.updateAnimation(2500);
 const before=map.getMarkerState(),marker=map.group.getObjectByName('map-park-orbit-marker'),pointSize=marker.material.uniforms.uMarkerSize.value,spot=mapSpot(MAP_DEFAULTS);
 map.setTranslation({x:.1,z:.15});map.setZoom(3);map.updateAnimation(2500);const after=map.getMarkerState();
 assert.deepEqual(after.sourcePosition,before.sourcePosition);assert.ok(Math.abs(after.position[0]-(spot.x+3*(before.sourcePosition[0]+.1-spot.x)))<1e-10);assert.ok(Math.abs(after.position[2]-(spot.z+3*(before.sourcePosition[2]+.15-spot.z)))<1e-10);assert.ok(Math.abs(after.position[1]-(before.sourcePosition[1]*3-1))<1e-10);assert.equal(marker.material.uniforms.uMarkerSize.value,pointSize);
 assert.deepEqual([after.longitude,after.latitude,after.altitude],[before.longitude,before.latitude,before.altitude],'display translation and scale never change geographic coordinates');
 map.setZoom(1);map.setTranslation({x:1.6,z:0});map.updateAnimation(0);assert.equal(map.getMarkerState().visible,false,'point inside stage but outside the cone is hidden');
 map.setSettings({enabled:false});assert.equal(map.updateAnimation(0),true);assert.equal(map.getMarkerState().visible,true,'full-map comparison also animates the point');
 map.setTranslation({x:4,z:4});map.updateAnimation(0);assert.equal(map.getMarkerState().visible,false,'fixed stage also clips the point');
 map.setActive(false);assert.equal(marker.visible,false);const inactive=map.getMarkerState().sourcePosition;assert.equal(map.updateAnimation(5000),false);assert.deepEqual(map.getMarkerState().sourcePosition,inactive);
 map.setTranslation({x:0,z:0});map.setActive(true);assert.equal(map.updateAnimation(5000),true);assert.equal(map.getMarkerState().visible,true);
});

test('park marker GPU state restores and disposes exactly once',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});await net.drain();map.updateAnimation(0);
 const marker=map.group.getObjectByName('map-park-orbit-marker'),attribute=marker.geometry.attributes.position,version=attribute.version,materialVersion=marker.material.version;map.restore();assert.ok(attribute.version>version);assert.ok(marker.material.version>materialVersion);
 let geometryDisposals=0,materialDisposals=0;marker.geometry.addEventListener('dispose',()=>geometryDisposals++);marker.material.addEventListener('dispose',()=>materialDisposals++);map.dispose();map.dispose();assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(map.updateAnimation(1000),false);assert.equal(map.getMarkerState().visible,false);
});

test('drone demo telemetry follows the circular tangent and remains independent of display transforms',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await net.drain();
 const headings=[180,270,0,90];
 for(let index=0;index<4;index++){
  map.updateAnimation(index*2500);const state=map.getMarkerState();
  assert.equal(state.id,'DEMO-01');assert.equal(state.sensorKit,'RGB / TIR / DEPTH');assert.equal(state.source,'demo');
  assert.equal(state.heading,headings[index]);assert.equal(state.yaw,headings[index]);assert.equal(state.pitch,0);
  assert.equal(state.task,'inspecting');assert.equal(state.held,false);assert.ok(Math.abs(state.speed-2*Math.PI)<1e-12);
  assert.ok(Math.abs(state.roll-Math.atan(state.speed**2/(10*9.80665))*180/Math.PI)<1e-12);
  const futurePhase=(index*2500+1)/10000*2*Math.PI,center=projectMapPoint(MAP_ORBIT_MARKER.center);
  const radius=10*(4/((MAP_BOUNDS.east-MAP_BOUNDS.west)*111320*Math.cos(37.7955*Math.PI/180)));
  const dx=center[0]+Math.cos(futurePhase)*radius-state.sourcePosition[0],dz=center[1]+Math.sin(futurePhase)*radius-state.sourcePosition[2];
  const bearing=(Math.atan2(dx,-dz)*180/Math.PI+360)%360;
  assert.ok(Math.abs(((bearing-state.heading+540)%360)-180)<.1,'heading points along source motion, not map camera');
 }
 const before=map.getMarkerState();map.setTranslation({x:.4,z:-.2});map.setZoom(4);map.setSettings({x:.3,z:.2});const after=map.getMarkerState();
 for(const key of['heading','yaw','roll','pitch','speed','latitude','longitude','altitude'])assert.equal(after[key],before[key]);
});

test('holding freezes the drone exactly and resume or time discontinuities do not teleport it',async t=>{
 const net=network();let dirties=0;const map=createHologramMap({fetchImpl:net.fetchImpl,onDirty:()=>dirties++});t.after(()=>map.dispose());await net.drain();
 map.updateAnimation(100);map.updateAnimation(1100);const inspecting=map.getMarkerState(),beforeDirty=dirties;
 assert.equal(map.setMarkerHeld(true),true);assert.equal(dirties,beforeDirty+1);map.setMarkerHeld(true);assert.equal(dirties,beforeDirty+1,'idempotent command does not redraw');
 for(const time of[1200,999999]){assert.equal(map.updateAnimation(time),false);const held=map.getMarkerState();assert.deepEqual(held.sourcePosition,inspecting.sourcePosition);assert.equal(held.heading,inspecting.heading);assert.equal(held.speed,0);assert.equal(held.roll,0);assert.equal(held.task,'holding');assert.equal(held.held,true);}
 map.setMarkerHeld(false);assert.equal(map.updateAnimation(1000000),true);assert.deepEqual(map.getMarkerState().sourcePosition,inspecting.sourcePosition);
 map.updateAnimation(1000100);const resumed=map.getMarkerState();assert.notDeepEqual(resumed.sourcePosition,inspecting.sourcePosition);assert.equal(resumed.task,'inspecting');assert.ok(Math.abs(resumed.heading-inspecting.heading-3.6)<1e-10);
 map.setActive(false);map.setActive(true);map.updateAnimation(1002100);assert.deepEqual(map.getMarkerState().sourcePosition,resumed.sourcePosition,'short context-loss recovery resets the animation clock');
 map.suspendMarkerAnimation();map.updateAnimation(9000000);assert.deepEqual(map.getMarkerState().sourcePosition,resumed.sourcePosition);
 map.setActive(false);map.updateAnimation(9100000);map.setActive(true);map.updateAnimation(9200000);assert.deepEqual(map.getMarkerState().sourcePosition,resumed.sourcePosition);
 map.updateAnimation(99999999);assert.deepEqual(map.getMarkerState().sourcePosition,resumed.sourcePosition,'unexpected large forward gaps are ignored');
 map.updateAnimation(-100);assert.deepEqual(map.getMarkerState().sourcePosition,resumed.sourcePosition,'backward clock jumps are ignored');
 map.dispose();assert.equal(map.setMarkerHeld(true),false);
});

test('direct flight preserves entry pose, drives geographic telemetry, brakes, and holds on exit',async t=>{
 const net=network();let dirties=0;const map=createHologramMap({fetchImpl:net.fetchImpl,onDirty:()=>dirties++});t.after(()=>map.dispose());await net.drain();
 map.updateAnimation(0);map.updateAnimation(5000);const before=map.getMarkerState();assert.equal(before.heading,0);
 assert.equal(map.setDirectOperate(true),true);let state=map.getMarkerState();assert.deepEqual(state.sourcePosition,before.sourcePosition);assert.equal(state.heading,before.heading);assert.equal(state.speed,0);assert.equal(state.directOperate,true);assert.equal(state.source,'demo');assert.equal(map.setMarkerHeld(true),false);
 map.updateAnimation(6000);const dirty=dirties;assert.equal(map.setDroneInput({forward:1,lift:1}),true);assert.ok(dirties>dirty);
 for(let time=6100;time<=8000;time+=100)assert.equal(map.updateAnimation(time),true);
 state=map.getMarkerState();assert.ok(state.latitude>before.latitude);assert.equal(state.longitude,before.longitude);assert.ok(state.altitude>before.altitude);assert.ok(state.speed>0&&state.speed<=8);assert.equal(state.verticalSpeed,3);assert.ok(state.pitch<0);assert.equal(state.task,'direct operate');
 const flown=state;map.setTranslation({x:.3,z:.1});map.setZoom(3);state=map.getMarkerState();for(const key of['latitude','longitude','altitude','heading','yaw','roll','pitch','speed','verticalSpeed'])assert.equal(state[key],flown[key]);assert.equal(state.metersToWorld,before.metersToWorld*3);
 map.clearDroneInput();for(let time=8100;time<=11000;time+=100)map.updateAnimation(time);state=map.getMarkerState();assert.equal(state.speed,0);assert.equal(state.verticalSpeed,0);const stopped=state;
 assert.equal(map.setDirectOperate(false),true);map.updateAnimation(12000);state=map.getMarkerState();assert.deepEqual(state.sourcePosition,stopped.sourcePosition);assert.equal(state.held,true);assert.equal(state.directOperate,false);assert.equal(state.task,'holding');assert.equal(map.updateAnimation(13000),false);
 assert.equal(map.setDirectOperate(true),true);map.updateAnimation(14000);map.updateAnimation(14100);assert.deepEqual(map.getMarkerState().sourcePosition,stopped.sourcePosition);assert.equal(map.getMarkerState().speed,0);
});

test('inspection resumes tangentially from the manually flown altitude and location',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await net.drain();map.updateAnimation(0);map.setDirectOperate(true);map.updateAnimation(100);map.setDroneInput({yaw:.2,lift:.5,forward:1,strafe:.2});
 for(let time=200;time<=2100;time+=100)map.updateAnimation(time);
 const flown=map.getMarkerState();assert.equal(map.setDirectOperate(false),true);const held=map.getMarkerState();assert.deepEqual(held.sourcePosition,flown.sourcePosition);assert.ok(Math.abs(held.heading-flown.heading)<1e-8);
 map.setMarkerHeld(false);map.updateAnimation(3000);assert.deepEqual(map.getMarkerState().sourcePosition,flown.sourcePosition,'first resumed frame holds the exact flown point');
 map.updateAnimation(3100);const resumed=map.getMarkerState();assert.equal(resumed.altitude,flown.altitude);assert.ok(Math.abs(resumed.heading-(flown.heading+3.6))<1e-8);assert.equal(resumed.task,'inspecting');
 const distance=Math.hypot(resumed.sourcePosition[0]-flown.sourcePosition[0],resumed.sourcePosition[2]-flown.sourcePosition[2])/resumed.metersToWorld;assert.ok(distance>0&&distance<1,'resume advances less than one metre without returning to the original park circle');
});

test('direct commands cannot survive inactive, suspend, large clock gaps, or disposal',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());assert.equal(map.setDirectOperate(true),false);assert.equal(map.setDroneInput({forward:1}),false);await net.drain();map.setDirectOperate(true);let time=0;map.updateAnimation(time);
 for(const interrupt of[()=>map.suspendMarkerAnimation(),()=>{map.setActive(false);assert.equal(map.setDroneInput({forward:1}),false);map.setActive(true);},()=>{time+=10000;map.updateAnimation(time);},()=>{time-=1000;map.updateAnimation(time);},()=>{map.setActive(false);map.setActive(false);map.setActive(true);}]){
  map.setDroneInput({yaw:1,lift:1,forward:1,strafe:1});for(let i=0;i<5;i++){time+=100;map.updateAnimation(time);}const before=map.getMarkerState();assert.ok(before.speed>0);
  interrupt();for(let i=0;i<5;i++){time+=100;map.updateAnimation(time);}const after=map.getMarkerState();assert.deepEqual(after.sourcePosition,before.sourcePosition);assert.equal(after.heading,before.heading);assert.equal(after.speed,0);assert.equal(after.verticalSpeed,0);assert.equal(after.roll,0);assert.equal(after.pitch,0);
 }
 map.dispose();assert.equal(map.setDirectOperate(true),false);assert.equal(map.setDroneInput({forward:1}),false);assert.equal(map.clearDroneInput(),false);assert.equal(map.getMarkerState().visible,false);
});

test('direct map context bypasses the fixed stage then restores clipping without changing transforms',async t=>{
 const net=network(),map=createHologramMap({fetchImpl:net.fetchImpl});t.after(()=>map.dispose());await net.drain();map.setSettings({enabled:false});await net.drain();map.setZoom(4);map.setTranslation({x:4,z:4});await new Promise(resolve=>setTimeout(resolve,80));
 const cells=map.group.getObjectByName('hologram-voxel-cells'),content=map.group.getObjectByName('map-content'),marker=map.group.getObjectByName('map-park-orbit-marker'),bounds=cells.material.uniforms.uBounds.value.toArray(),position=content.position.toArray(),zoom=map.metadata.zoom;
 assert.equal(cells.geometry.instanceCount,0);assert.equal(map.getMarkerState().visible,false);map.setDirectOperate(true);await new Promise(resolve=>setTimeout(resolve,80));
 assert.ok(cells.geometry.instanceCount>0);assert.notDeepEqual(cells.material.uniforms.uBounds.value.toArray(),bounds);assert.equal(map.getMarkerState().visible,true);assert.equal(marker.visible,false,'physical drone rig replaces the fixed-pixel dot');assert.deepEqual(content.position.toArray(),position);assert.equal(map.metadata.zoom,zoom);
 map.setDirectOperate(false);await new Promise(resolve=>setTimeout(resolve,80));assert.deepEqual(cells.material.uniforms.uBounds.value.toArray(),bounds);assert.deepEqual(content.position.toArray(),position);assert.equal(map.metadata.zoom,zoom);assert.equal(cells.geometry.instanceCount,0);assert.equal(map.getMarkerState().visible,false);assert.equal(cells.material.uniforms.uEnabled.value,0,'Direct does not overwrite caller-owned projector settings');
 map.setSettings({enabled:true});assert.equal(cells.material.uniforms.uEnabled.value,1);
});

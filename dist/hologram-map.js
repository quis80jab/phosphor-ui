import * as THREE from './vendor/three.module.js';
import { normalizeMapElements } from './hologram-data.js?v=hologram-1';
import { buildMapVoxels, buildPointVoxels } from './hologram-voxels.js?v=scan-1';
import { buildVoxelPaths } from './hologram-paths.js?v=hologram-6';
import { blendVoxelPaths } from './hologram-path-glow.js?v=hologram-1';
import { createDroneFlight } from './drone-flight.js?v=direct-1';

export const MAP_BOUNDS=Object.freeze({south:37.7925,west:-122.3995,north:37.7995,east:-122.3895});
export const HOLOGRAM_LIGHTING=Object.freeze({outlineScale:1.3,outlineFadeStart:1.225,buildingEdgeBoost:.2});
export const MAP_DEFAULTS=Object.freeze({enabled:true,x:-.3,z:0,radius:.6,height:3,intensity:1,edge:1.4,pathGain:.18,falloff:1});
// Demo track over the verified eastern Sue Bierman Park footprint (OSM relation
// 13790250 / outer way 175516006). The circle and altitude are visual test data,
// not a live asset, surveillance feed, or surveyed terrain measurement.
export const MAP_ORBIT_MARKER=Object.freeze({name:'Sue Bierman Park',source:'demo',center:Object.freeze([-122.395830215,37.796044765]),radiusMeters:10,heightMeters:8,periodMs:10000});
const ENDPOINT='https://ovp.dresel.systems/api-na/interpreter';
const CENTER=[-122.3945,37.7955],METERS_LAT=111320,METERS_LON=METERS_LAT*Math.cos(CENTER[1]*Math.PI/180);
const WORLD_SCALE=4/((MAP_BOUNDS.east-MAP_BOUNDS.west)*METERS_LON),GROUND=-1;
const clamp=(value,low,high)=>Math.min(high,Math.max(low,value));
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
/** Runtime shader controls in physical pixels; EDGE zero keeps only the soft halo. */
export function hologramGlowParameters(edge=MAP_DEFAULTS.edge,dpr=1){
 const gain=clamp(number(edge,MAP_DEFAULTS.edge),0,3),ratio=Math.max(.1,number(dpr,1));
 return{haloPixels:7*ratio,bleedPixels:(7+29*clamp(gain/2,0,1))*ratio,streakStrength:.45*gain};
}
/** The fill cone narrows with height; wireframe context keeps its ground footprint. */
export function hologramBandAtHeight(radius,height,y){const ground=Math.max(0,radius),inner=ground*Math.max(0,1-y/Math.max(.1,height));return{inner,outer:ground*HOLOGRAM_LIGHTING.outlineScale,insideHeight:y>=0&&y<=height};}
/** Cone membership controls facade fill; contextual wireframe edges extend beyond it. */
export function hologramConeContains(radius,height,y,distanceToAxis){const band=hologramBandAtHeight(radius,height,y);return band.insideHeight&&band.inner>.00001&&distanceToAxis<=band.inner;}
/** Matches shader coverage: complete feature edges, with a relative 20% gain. */
export function hologramVoxelEmission(radius,height,y,distanceToAxis,isEdge,enabled=true){
 const gain=1+(isEdge?HOLOGRAM_LIGHTING.buildingEdgeBoost:0);
 if(!enabled)return gain;
 if(!isEdge)return hologramConeContains(radius,height,y,distanceToAxis)?1:0;
 if(y<0||radius<=.00001)return 0;
 const start=radius*HOLOGRAM_LIGHTING.outlineFadeStart,outer=radius*HOLOGRAM_LIGHTING.outlineScale;
 const t=clamp((distanceToAxis-start)/(outer-start),0,1);
 return gain*(1-t*t*(3-2*t));
}
export function projectMapPoint(point){return[(point[0]-CENTER[0])*METERS_LON*WORLD_SCALE,-(point[1]-CENTER[1])*METERS_LAT*WORLD_SCALE];}
/** Source-plane [x,z] to [longitude,latitude]; display pan and zoom are excluded. */
export function unprojectMapPoint(point){return[CENTER[0]+point[0]/(METERS_LON*WORLD_SCALE),CENTER[1]-point[1]/(METERS_LAT*WORLD_SCALE)];}
const SW=projectMapPoint([MAP_BOUNDS.west,MAP_BOUNDS.south]),NE=projectMapPoint([MAP_BOUNDS.east,MAP_BOUNDS.north]);
const LIMITS={minX:SW[0],maxX:NE[0],minZ:NE[1],maxZ:SW[1]};
const MAP_HEIGHT=LIMITS.maxZ-LIMITS.minZ,MAP_MID_Z=(LIMITS.maxZ+LIMITS.minZ)/2;
/** The stage the projector lights, in stage units: a point source (a scan) is fitted inside it. */
export const STAGE_LIMITS=Object.freeze({...LIMITS});
const PALETTE=['#5ec8c8','#7dd6c8','#71b7da','#b3dfab','#b9b0df','#d6c995'];
const hash=id=>Array.from(String(id)).reduce((value,char)=>(Math.imul(value,31)+char.charCodeAt(0))>>>0,0);
export function mapSpot(settings){return{x:settings.x*2,z:settings.z*MAP_HEIGHT/2,radius:settings.radius*2};}
export function createMapTiles(){const tiles=[];for(let row=0;row<3;row++)for(let column=0;column<3;column++){
  const south=MAP_BOUNDS.south+row*(MAP_BOUNDS.north-MAP_BOUNDS.south)/3,north=MAP_BOUNDS.south+(row+1)*(MAP_BOUNDS.north-MAP_BOUNDS.south)/3;
  const west=MAP_BOUNDS.west+column*(MAP_BOUNDS.east-MAP_BOUNDS.west)/3,east=MAP_BOUNDS.west+(column+1)*(MAP_BOUNDS.east-MAP_BOUNDS.west)/3;
  const a=projectMapPoint([west,north]),b=projectMapPoint([east,south]);tiles.push({id:`${row}:${column}`,bounds:{south,west,north,east},minX:a[0],minZ:a[1],maxX:b[0],maxZ:b[1],state:'idle'});
}return tiles;}
export function tileMeetsSpot(tile,spot){return Math.hypot(spot.x-clamp(spot.x,tile.minX,tile.maxX),spot.z-clamp(spot.z,tile.minZ,tile.maxZ))<=spot.radius;}
export function mapQuery(bounds,context=false){const bbox=[bounds.south,bounds.west,bounds.north,bounds.east].join(',');const selectors=context?['way[highway]','way[natural=coastline]','way[natural=water]','relation[type=multipolygon][natural=water]','way[man_made=pier]']:['way[building]','way["building:part"]','relation[type=multipolygon][building]','relation[type=multipolygon]["building:part"]'];return `[out:json][timeout:22][maxsize:33554432];(${selectors.map(selector=>`${selector}(${bbox});`).join('')});out geom;`;}

const VERTEX=`attribute vec3 color; uniform vec2 uOffset;uniform float uZoom; varying vec3 vColor,vMap,vNormal,vSource,vAnchor;varying float vBuildingEdge;
void main(){vColor=color;vBuildingEdge=0.0;vSource=position;vMap=vec3(position.x*uZoom,position.y,position.z*uZoom)+vec3(uOffset.x,0.0,uOffset.y);vAnchor=vMap;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position.x,position.y/uZoom,position.z,1.0);}`;
const VOXEL_VERTEX=`attribute vec3 voxelOffset,voxelColor;attribute float voxelEdge;uniform float uVoxelSize,uZoom;uniform vec2 uOffset;varying vec3 vColor,vMap,vNormal,vSource,vAnchor;varying float vBuildingEdge;
void main(){vec3 local=voxelOffset+position*uVoxelSize*.55;vSource=local;vMap=local*uZoom+vec3(uOffset.x,0.0,uOffset.y);vAnchor=voxelOffset*uZoom+vec3(uOffset.x,0.0,uOffset.y);vBuildingEdge=voxelEdge;vColor=voxelColor;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(local,1.0);}`;
const CELL_LIGHT=`
float cellCoverage(float radius,float distanceToAxis,float buildingEdge,float y){
 if(y<0.0||uSpot.z<=.00001)return 0.0;
 float cone=step(y,uSpot.w)*step(.00001,radius)*step(distanceToAxis,radius);
 // Context is a full-height footprint cylinder, not another narrowing cone.
 float context=1.0-smoothstep(uSpot.z*uOutlineFadeStart,uSpot.z*uOutlineScale,distanceToAxis);
 return buildingEdge>.5?max(cone,context):cone;
}`;
const HALO_VERTEX=`attribute vec3 color;attribute float buildingEdge;uniform vec2 uOffset,uBleed;uniform float uZoom,uHaloSize,uEnabled,uCell,uOutlineScale,uOutlineFadeStart,uBuildingEdgeBoost;uniform vec4 uSpot,uLight;varying vec3 vColor,vMap;varying float vSpriteScale,vStreak,vEdge,vBuildingEdge;
${CELL_LIGHT}
void main(){
 vColor=color;vBuildingEdge=buildingEdge;vMap=position*uZoom+vec3(uOffset.x,0.0,uOffset.y);
 float radius=uSpot.z*max(0.0,1.0-vMap.y/max(.1,uSpot.w));
 float heightMask=step(0.0,vMap.y)*step(vMap.y,uSpot.w);
 float distanceToAxis=length(vMap.xz-uSpot.xy);
 float band=cellCoverage(radius,distanceToAxis,buildingEdge,vMap.y);
 float edge=exp(-abs(distanceToAxis-radius)/max(uCell*3.0,radius*.025))*uEnabled*heightMask*band;
 vEdge=edge*uLight.y;vStreak=edge*uBleed.y;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
 gl_PointSize=mix(uHaloSize,uBleed.x,clamp(edge,0.0,1.0));vSpriteScale=gl_PointSize/uHaloSize;
}`;
const HALO_FRAGMENT=`varying vec3 vColor,vMap;varying float vSpriteScale,vStreak,vEdge,vBuildingEdge;uniform vec4 uSpot,uLight;uniform float uEnabled,uCell,uOutlineScale,uOutlineFadeStart,uBuildingEdgeBoost;
${CELL_LIGHT}
void main(){
 float radius=uSpot.z*max(0.0,1.0-vMap.y/max(.1,uSpot.w));
 float distanceToAxis=length(vMap.xz-uSpot.xy);
 float lit=mix(1.0,cellCoverage(radius,distanceToAxis,vBuildingEdge,vMap.y),uEnabled);
 if(lit<.015)discard;
 vec2 point=gl_PointCoord-.5;vec2 haloPoint=point*vSpriteScale;
 float d=dot(haloPoint,haloPoint);
 float glow=exp(-d*18.0)*.11*lit;
 float burn=exp(-d*24.0)*vEdge*.26;
 // Horizontal bleed is fixed to the screen, independent of the map orientation.
 float streak=exp(-point.x*point.x*11.0)*exp(-haloPoint.y*haloPoint.y*100.0)*vStreak;
 float fade=1.0-smoothstep(.42,.5,abs(point.x));
 float alpha=min(1.0,(glow+burn+streak*fade)*uLight.x*(1.0+uBuildingEdgeBoost*vBuildingEdge));
 vec3 tint=mix(vColor*.75+vec3(.06,.15,.13),vec3(.78,1.0,.92),clamp(vEdge,0.0,1.0));
 gl_FragColor=vec4(tint,alpha);
 #include <colorspace_fragment>
}`;
const FRAGMENT=`precision highp float;
varying vec3 vColor,vMap,vNormal,vSource,vAnchor;varying float vBuildingEdge;
uniform vec4 uSpot;uniform vec4 uLight;uniform vec4 uBounds;uniform float uEnabled,uDetail,uCell,uMark,uOutlineScale,uOutlineFadeStart,uBuildingEdgeBoost;
${CELL_LIGHT}
void main(){
 // The presentation stage stays fixed while geographic content magnifies beneath it.
 if(vMap.x<uBounds.x||vMap.x>uBounds.y||vMap.z<uBounds.z||vMap.z>uBounds.w)discard;
 vec3 anchor=uDetail>.5?vAnchor:vMap;
 float radius=uSpot.z*max(0.0,1.0-anchor.y/max(.1,uSpot.w));
 float distanceToAxis=length(anchor.xz-uSpot.xy);
 float feather=max(uCell*2.0,radius*.035);
 float lit=mix(1.0,1.0-smoothstep(radius-feather,radius+feather,distanceToAxis),uEnabled);
 float cellLit=mix(1.0,cellCoverage(radius,distanceToAxis,vBuildingEdge,anchor.y),uEnabled);
 if(uDetail>.5&&cellLit<.015)discard;
 float heightMask=step(0.0,anchor.y)*step(anchor.y,uSpot.w);
 float rim=exp(-abs(distanceToAxis-radius)/max(uCell*2.0,radius*.025))*uLight.y*uEnabled*heightMask;
 vec2 cell=fract(vMap.xz/max(.001,uCell*5.0));
 float pattern=1.0;
 if(uMark<.5)pattern=.55+.45*step(length(cell-.5),.46);
 else if(uMark<1.5)pattern=.65+.35*max(step(abs(cell.x-.5),.13),step(abs(cell.y-.5),.13));
 else if(uMark>2.5)pattern=.65+.35*step(cell.y,.66);
 float shade=.76+.24*max(dot(normalize(vNormal+vec3(.0001)),normalize(vec3(-.4,.85,.4))),0.0);
 vec3 color=vColor*shade*(mix(.105*pattern,1.0,lit)*uLight.x)+vec3(.45,.95,.83)*rim*.28;
 if(uDetail>.5)color=(vColor*(1.1+.55*shade)*cellLit*uLight.x+vec3(.78,1.0,.92)*rim*1.2*cellLit)*(1.0+uBuildingEdgeBoost*vBuildingEdge);
 gl_FragColor=vec4(color,1.0);
 #include <colorspace_fragment>
}`;
const MARKER_VERTEX=`uniform float uMarkerSize;
void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=uMarkerSize;}`;
const MARKER_FRAGMENT=`void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float core=1.0-smoothstep(.16,.22,d);float halo=exp(-d*d*16.0)*(1.0-smoothstep(.40,.5,d))*.32;gl_FragColor=vec4(1.0,.025,.04,max(core,halo));
#include <colorspace_fragment>
}`;
const PATH_VERTEX=`attribute vec3 color,pathFromColor;attribute float pathDuration;uniform float uPathElapsed;uniform vec4 uSpot;uniform float uPathSize,uFalloff;varying vec3 vColor;varying float vAttenuation;
void main(){float blend=pathDuration>0.0?clamp(uPathElapsed/pathDuration,0.0,1.0):1.0;vColor=mix(pathFromColor,color,blend);vec3 delta=position-vec3(uSpot.x,uSpot.w,uSpot.y);vAttenuation=1.0/(1.0+uFalloff*dot(delta,delta));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=uPathSize;}`;
const PATH_FRAGMENT=`uniform float uPathGain;uniform vec4 uLight;varying vec3 vColor;varying float vAttenuation;
void main(){vec2 p=abs(gl_PointCoord-.5);float core=1.0-smoothstep(.22,.34,max(p.x,p.y));float glow=exp(-dot(p,p)*18.0);float alpha=(core*.12+glow*.025)*uPathGain*uLight.x*vAttenuation;gl_FragColor=vec4(vColor,alpha);
#include <colorspace_fragment>
}`;

function geometry(positions,normals,colors){const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));result.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return result;}
function lineGeometry(lines,color,y=.006){const p=[],n=[],c=[],tint=new THREE.Color(color);for(const line of lines)for(let i=1;i<line.length;i++){for(const point of [line[i-1],line[i]]){const [x,z]=projectMapPoint(point);p.push(x,y,z);n.push(0,1,0);c.push(tint.r,tint.g,tint.b);}}return geometry(p,n,c);}
function shapeFor(polygon){const points=polygon.outer.map(point=>{const [x,z]=projectMapPoint(point);return new THREE.Vector2(x,-z);});const shape=new THREE.Shape(points);for(const ring of polygon.holes||[])shape.holes.push(new THREE.Path(ring.map(point=>{const [x,z]=projectMapPoint(point);return new THREE.Vector2(x,-z);})));return shape;}
function flatGeometry(polygons,color,y=0){const p=[],n=[],c=[],tint=new THREE.Color(color);for(const polygon of polygons){const g=new THREE.ShapeGeometry(shapeFor(polygon)).toNonIndexed();g.rotateX(-Math.PI/2);const a=g.attributes.position.array;for(let i=0;i<a.length;i+=3){p.push(a[i],y,a[i+2]);n.push(0,1,0);c.push(tint.r,tint.g,tint.b);}g.dispose();}return geometry(p,n,c);}
function buildingSignature(building){return JSON.stringify([building.outers,building.height,building.minHeight,building.color,building.colorTagged]);}
function buildingColor(building){const color=new THREE.Color(building.colorTagged?building.color:PALETTE[hash(building.id)%PALETTE.length]);return[color.r,color.g,color.b];}
// Clip real directed coastline segments against the bounded map. Closing each
// crossing along the rectangle counterclockwise retains OSM's land-left side.
export function coastlineLand(coastlines,bounds=MAP_BOUNDS){
 const {west:w,east:e,south:s,north:n}=bounds,width=e-w,height=n-s,perimeter=2*(width+height),polygons=[];
 const at=t=>{t=(t+perimeter)%perimeter;if(t<=width)return[w+t,s];if((t-=width)<=height)return[e,s+t];if((t-=height)<=width)return[e-t,n];return[w,n-(t-width)];};
 const param=p=>Math.abs(p[1]-s)<1e-8?p[0]-w:Math.abs(p[0]-e)<1e-8?width+p[1]-s:Math.abs(p[1]-n)<1e-8?width+height+e-p[0]:2*width+height+n-p[1];
 function clip(a,b){const dx=b[0]-a[0],dy=b[1]-a[1];let t0=0,t1=1;for(const [p,q]of[[-dx,a[0]-w],[dx,e-a[0]],[-dy,a[1]-s],[dy,n-a[1]]]){if(Math.abs(p)<1e-14){if(q<0)return null;}else{const t=q/p;if(p<0)t0=Math.max(t0,t);else t1=Math.min(t1,t);if(t0>t1)return null;}}return[[a[0]+t0*dx,a[1]+t0*dy],[a[0]+t1*dx,a[1]+t1*dy]];}
 function finish(path){if(path.length<2)return;const first=path[0],last=path.at(-1),onBoundary=p=>Math.abs(p[0]-w)<1e-8||Math.abs(p[0]-e)<1e-8||Math.abs(p[1]-s)<1e-8||Math.abs(p[1]-n)<1e-8;if(!onBoundary(first)||!onBoundary(last))return;let end=param(first),start=param(last);if(end<=start)end+=perimeter;const ring=path.slice();for(let turn=0;turn<2;turn++)for(const corner of[width,width+height,2*width+height,perimeter]){const t=corner+turn*perimeter;if(t>start+1e-10&&t<end-1e-10)ring.push(at(t));}ring.push(first);if(ring.length>=4)polygons.push({outer:ring,holes:[]});}
 const chains=coastlines.map(line=>line.points.slice()).filter(points=>points.length>1),equal=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-8;
 for(let i=0;i<chains.length;i++){let changed=true;while(changed){changed=false;for(let j=i+1;j<chains.length;j++){if(equal(chains[i].at(-1),chains[j][0])){chains[i].push(...chains[j].slice(1));chains.splice(j,1);changed=true;break;}if(equal(chains[j].at(-1),chains[i][0])){chains[i]=[...chains[j],...chains[i].slice(1)];chains.splice(j,1);changed=true;break;}}}}
 for(const points of chains){if(equal(points[0],points.at(-1))){let area=0;for(let i=1;i<points.length;i++)area+=points[i-1][0]*points[i][1]-points[i][0]*points[i-1][1];if(area>0)polygons.push({outer:points,holes:[]});continue;}const line={points};let path=[];for(let i=1;i<line.points.length;i++){const segment=clip(line.points[i-1],line.points[i]);if(!segment){finish(path);path=[];continue;}if(path.length&&Math.hypot(path.at(-1)[0]-segment[0][0],path.at(-1)[1]-segment[0][1])>1e-8){finish(path);path=[];}if(!path.length)path.push(segment[0]);path.push(segment[1]);}finish(path);}return polygons;
}

/** Live OSM geometry with a map-space projector; never a synthetic map fallback. */
export function createHologramMap({signal,onProgress=()=>{},onDirty=()=>{},fetchImpl=globalThis.fetch}={}){
 // A point source (a scan or a SLAM replay) replaces the OpenStreetMap buildings while it is set.
 let pointSource=null,osmContextLoaded=false;
 let settings={...MAP_DEFAULTS},active=true,disposed=false,contextLoaded=false,inflight=0,cellSize=.01,detailTimer=0,dataVersion=0;
 let zoom=1,translation={x:0,z:0},voxelBuildBounds=null,voxelSource=null,sourceSignature='',sourceRevision=0,voxelRevision=-1,voxelRequestedSize=0,voxelBuilds=0,buildingBounds=[];
 const group=new THREE.Group();group.name='sf-waterfront-live-osm';group.position.y=GROUND;
 const content=new THREE.Group();content.name='map-content';group.add(content);
 const sourceElements=new Map(),tiles=createMapTiles(),contextTile={id:'context',state:'idle',bounds:MAP_BOUNDS},controllers=new Set();
 let normalized={buildings:[],roads:[],coastlines:[],piers:[],water:[]},status={status:'loading',loadedTiles:0,totalTiles:9,pendingTiles:0,buildingCount:0,estimatedHeights:0,taggedColors:0,error:'',message:'CONNECTING TO OPENSTREETMAP'};
 let pathFrame=null,pathLastTime=null,pathGridMultiple=1,pathBasePitch=0;
 const uniforms={uPathElapsed:{value:0},uOutlineScale:{value:HOLOGRAM_LIGHTING.outlineScale},uOutlineFadeStart:{value:HOLOGRAM_LIGHTING.outlineFadeStart},uBuildingEdgeBoost:{value:HOLOGRAM_LIGHTING.buildingEdgeBoost},uPathGain:{value:MAP_DEFAULTS.pathGain},uFalloff:{value:MAP_DEFAULTS.falloff},uPathSize:{value:5*(globalThis.devicePixelRatio||1)},uOffset:{value:new THREE.Vector2()},uZoom:{value:1},uVoxelSize:{value:.04},uHaloSize:{value:7*(globalThis.devicePixelRatio||1)},uBleed:{value:new THREE.Vector2()},uSpot:{value:new THREE.Vector4(0,0,.84,3)},uLight:{value:new THREE.Vector4(1,1.4,0,0)},uBounds:{value:new THREE.Vector4(LIMITS.minX,LIMITS.maxX,LIMITS.minZ,LIMITS.maxZ)},uEnabled:{value:1},uDetail:{value:0},uCell:{value:.01},uMark:{value:0}};
 const material=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms,side:THREE.DoubleSide,toneMapped:false});
 const detailMaterial=new THREE.ShaderMaterial({vertexShader:VOXEL_VERTEX,fragmentShader:FRAGMENT,uniforms:{...uniforms,uDetail:{value:1}},toneMapped:false});
 const haloMaterial=new THREE.ShaderMaterial({vertexShader:HALO_VERTEX,fragmentShader:HALO_FRAGMENT,uniforms,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
 const objects=[];function addObject(g,mat=material,line=false){const object=line?new THREE.LineSegments(g,mat):new THREE.Mesh(g,mat);object.frustumCulled=false;content.add(object);objects.push(object);return object;}
 const rectangle={outer:[[MAP_BOUNDS.west,MAP_BOUNDS.south],[MAP_BOUNDS.east,MAP_BOUNDS.south],[MAP_BOUNDS.east,MAP_BOUNDS.north],[MAP_BOUNDS.west,MAP_BOUNDS.north]],holes:[]};
 const baseMaterial=new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:FRAGMENT,uniforms:{...uniforms,uOffset:{value:new THREE.Vector2()},uZoom:{value:1}},side:THREE.DoubleSide,toneMapped:false});
 const base=addObject(flatGeometry([rectangle],'#0b2732',-.012),baseMaterial);base.name='map-stage';group.add(base);
 const land=addObject(geometry([],[],[])),water=addObject(geometry([],[],[])),piers=addObject(geometry([],[],[]));
 const roads=addObject(geometry([],[],[]),material,true),coast=addObject(geometry([],[],[]),material,true),details=addObject(geometry([],[],[]),detailMaterial);
 details.name='hologram-voxel-cells';const halo=new THREE.Points(geometry([],[],[]),haloMaterial);halo.name='hologram-cell-glow';halo.frustumCulled=false;halo.renderOrder=1;content.add(halo);objects.push(halo);
 const pathMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:PATH_VERTEX,fragmentShader:PATH_FRAGMENT,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
 const paths=new THREE.Points(geometry([],[],[]),pathMaterial);paths.name='map-projector-voxel-paths';paths.frustumCulled=false;paths.renderOrder=2;group.add(paths);objects.push(paths);
 const markerCenter=projectMapPoint(MAP_ORBIT_MARKER.center),markerHome=[...markerCenter];
 let markerRadius=MAP_ORBIT_MARKER.radiusMeters*WORLD_SCALE,markerHeight=MAP_ORBIT_MARKER.heightMeters*WORLD_SCALE;
 let markerHeld=false,markerPhase=0,markerLastTime=null,directOperate=false,markerInView=false;
 const flight=createDroneFlight({bounds:Object.fromEntries(Object.entries(LIMITS).map(([key,value])=>[key,value/WORLD_SCALE]))});
 function orbitHeading(){return(markerPhase*180/Math.PI+180)%360;}
 function orbitSpeed(){return markerRadius/WORLD_SCALE*2*Math.PI/(MAP_ORBIT_MARKER.periodMs/1000);}
 function orbitBank(){return markerRadius>0?Math.atan(orbitSpeed()**2/(markerRadius/WORLD_SCALE*9.80665))*180/Math.PI:0;}
 const markerPosition=new THREE.Float32BufferAttribute([markerCenter[0]+markerRadius,markerHeight,markerCenter[1]],3).setUsage(THREE.DynamicDrawUsage);
 const markerGeometry=new THREE.BufferGeometry();markerGeometry.setAttribute('position',markerPosition);
 const markerMaterial=new THREE.ShaderMaterial({vertexShader:MARKER_VERTEX,fragmentShader:MARKER_FRAGMENT,uniforms:{uMarkerSize:{value:10*(globalThis.devicePixelRatio||1)}},transparent:true,depthWrite:false,toneMapped:false});
 const marker=new THREE.Points(markerGeometry,markerMaterial);marker.name='map-park-orbit-marker';marker.frustumCulled=false;marker.renderOrder=3;marker.visible=false;content.add(marker);objects.push(marker);
 function markerDisplayPosition(){return[markerPosition.getX(0)*zoom+content.position.x,markerPosition.getY(0)*zoom,markerPosition.getZ(0)*zoom+content.position.z];}
 function refreshMarkerVisibility(){
  const [x,y,z]=markerDisplayPosition(),spot=mapSpot(settings);
  markerInView=!disposed&&active&&contextLoaded&&(directOperate||(x>=LIMITS.minX&&x<=LIMITS.maxX&&z>=LIMITS.minZ&&z<=LIMITS.maxZ&&(!settings.enabled||hologramConeContains(spot.radius,settings.height,y,Math.hypot(x-spot.x,z-spot.z)))));
  // The third-person drone mesh replaces the old fixed-pixel map dot in Direct.
  marker.visible=markerInView&&!directOperate;
 }
 function suspendMarker(){markerLastTime=null;flight.clearInput(true);}
 function applyFlightPosition(){const pose=flight.getState();markerPosition.setXYZ(0,pose.x*WORLD_SCALE,pose.altitude*WORLD_SCALE,pose.z*WORLD_SCALE);markerPosition.needsUpdate=true;}
 function reanchorInspection(){
  // Resume tangentially from the flown point. Shrink the circle only near the
  // map boundary so every point stays inside the available source geography.
  const pose=flight.getState();markerPhase=((pose.heading-180+360)%360)*Math.PI/180;
  const x=markerPosition.getX(0),z=markerPosition.getZ(0),cos=Math.cos(markerPhase),sin=Math.sin(markerPhase);
  markerRadius=pointSource?.orbit?.radius??MAP_ORBIT_MARKER.radiusMeters*WORLD_SCALE;
  for(const[distance,factor]of[[LIMITS.maxX-x,1-cos],[x-LIMITS.minX,1+cos],[LIMITS.maxZ-z,1-sin],[z-LIMITS.minZ,1+sin]])if(factor>1e-10)markerRadius=Math.min(markerRadius,Math.max(0,distance/factor));
  markerCenter[0]=x-cos*markerRadius;markerCenter[1]=z-sin*markerRadius;markerHeight=markerPosition.getY(0);
 }
 function updateMarkerAnimation(timeMs){
  if(disposed||!active||!contextLoaded){markerInView=marker.visible=false;suspendMarker();return false;}
  const now=number(timeMs,0),delta=markerLastTime===null?0:now-markerLastTime;markerLastTime=now;
  // Hidden tabs, restored contexts, and a paused demo resume at the last point.
  // An unexpected clock discontinuity must not teleport the track either.
  if(directOperate){flight.advance(delta/1000);applyFlightPosition();}
  else if(!markerHeld){
   if(delta>=0&&delta<=5000)markerPhase=(markerPhase+delta/MAP_ORBIT_MARKER.periodMs*Math.PI*2)%(Math.PI*2);
   markerPosition.setXYZ(0,markerCenter[0]+Math.cos(markerPhase)*markerRadius,markerHeight,markerCenter[1]+Math.sin(markerPhase)*markerRadius);markerPosition.needsUpdate=true;
  }
  markerMaterial.uniforms.uMarkerSize.value=10*(globalThis.devicePixelRatio||1);refreshMarkerVisibility();return directOperate||!markerHeld;
 }


 const apexGeometry=new THREE.SphereGeometry(.025,8,6),apexMaterial=new THREE.MeshBasicMaterial({color:'#c2ffdf',toneMapped:false});const apex=new THREE.Mesh(apexGeometry,apexMaterial);apex.name='map-projector-apex';group.add(apex);
 const rimGeometry=new THREE.BufferGeometry(),rimMaterial=new THREE.LineBasicMaterial({color:'#a7f7d7',transparent:true,opacity:.5,depthWrite:false,toneMapped:false});const rim=new THREE.LineLoop(rimGeometry,rimMaterial);rim.name='map-projector-rim';group.add(rim);
 function replace(object,g){object.geometry.dispose();object.geometry=g;}
 function emit(){if(disposed)return;if(pointSource){status={...status,zoom,translation:{...translation},voxelCount:voxelSource?.count||0,voxelBuilds,voxelCellSize:voxelSource?voxelSource.cellSize*zoom:cellSize*4,coarsened:!!voxelSource?.coarsened,status:'ready',error:'',buildingCount:0,loadedTiles:0,pendingTiles:0,message:pointSource.label||'SCAN'};onProgress({...status});return;}const desired=desiredTiles(),loaded=tiles.filter(tile=>tile.state==='ready').length,failed=[contextTile,...tiles].filter(tile=>tile.state==='error');
  status={...status,zoom,translation:{...translation},voxelCount:voxelSource?.count||0,voxelBuilds,voxelCellSize:voxelSource?voxelSource.cellSize*zoom:cellSize*4,coarsened:!!voxelSource?.coarsened,status:contextLoaded||loaded?'ready':failed.length&&!inflight?'error':'loading',loadedTiles:loaded,pendingTiles:desired.filter(tile=>tile.state!=='ready'&&tile.state!=='error').length+(contextTile.state==='loading'?1:0),buildingCount:normalized.buildings.length,estimatedHeights:normalized.buildings.filter(item=>item.heightEstimated).length,taggedColors:normalized.buildings.filter(item=>item.colorTagged).length,error:failed.length?'Some live map tiles could not load. Retry the map source.':'',message:loaded?`LIVE OSM / ${loaded} OF 9 TILES`:contextLoaded?'COASTLINE READY / STREAMING BUILDINGS':'STREAMING OPENSTREETMAP'};onProgress({...status});}
 function sourceSpot(){const axis=mapSpot(settings);return{...axis,radius:hologramBandAtHeight(axis.radius,settings.height,0).outer/zoom,x:axis.x-translation.x,z:axis.z-translation.z};}
 function desiredTiles(){const spot=sourceSpot();return tiles.filter(tile=>!settings.enabled||tileMeetsSpot(tile,spot)).sort((a,b)=>Math.hypot((a.minX+a.maxX)/2-spot.x,(a.minZ+a.maxZ)/2-spot.z)-Math.hypot((b.minX+b.maxX)/2-spot.x,(b.minZ+b.maxZ)/2-spot.z));}
 function updatePathAnimation(timeMs){
  if(disposed||!active||!contextLoaded){pathLastTime=null;return false;}
  const now=number(timeMs,0),delta=pathLastTime===null?0:now-pathLastTime;pathLastTime=now;
  if(!pathFrame||uniforms.uPathElapsed.value>=pathFrame.duration)return false;
  // A hidden tab or a restored GPU context must not advance a whole fade at once.
  if(delta>=0&&delta<=5000)uniforms.uPathElapsed.value=Math.min(pathFrame.duration,uniforms.uPathElapsed.value+Math.min(delta,64));
  if(uniforms.uPathElapsed.value>=pathFrame.duration)paths.geometry.setDrawRange(0,pathFrame.targetCount);
  return uniforms.uPathElapsed.value<pathFrame.duration;
 }
 function replacePathGeometry(trace){
  // Streaming can return unchanged buildings. Keep an in-flight fade and its GPU
  // buffers intact when the lit target field has not actually changed.
  if(paths.visible&&pathFrame&&pathFrame.targetCount*3===trace.positions.length&&trace.positions.every((value,i)=>value===pathFrame.positions[i]&&trace.colors[i]===pathFrame.colors[i]))return;
  pathFrame=blendVoxelPaths(pathFrame,trace,uniforms.uPathElapsed.value,{fade:pathLastTime!==null&&active&&paths.visible});
  uniforms.uPathElapsed.value=0;
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pathFrame.positions,3));g.setAttribute('color',new THREE.BufferAttribute(pathFrame.colors,3));
  g.setAttribute('pathFromColor',new THREE.BufferAttribute(pathFrame.fromColors,3));g.setAttribute('pathDuration',new THREE.BufferAttribute(pathFrame.durations,1));replace(paths,g);
 }
 function updateGlow(){const glow=hologramGlowParameters(settings.edge,globalThis.devicePixelRatio||1);uniforms.uHaloSize.value=glow.haloPixels;uniforms.uPathSize.value=5*(globalThis.devicePixelRatio||1);uniforms.uBleed.value.set(glow.bleedPixels,glow.streakStrength);}
 function updateTransform(){
  const spot=mapSpot(settings),x=spot.x*(1-zoom)+translation.x*zoom,z=spot.z*(1-zoom)+translation.z*zoom;
  content.scale.setScalar(zoom);content.position.set(x,0,z);uniforms.uOffset.value.set(x,z);uniforms.uZoom.value=zoom;
  uniforms.uBounds.value.set(directOperate?LIMITS.minX*zoom+x:LIMITS.minX,directOperate?LIMITS.maxX*zoom+x:LIMITS.maxX,directOperate?LIMITS.minZ*zoom+z:LIMITS.minZ,directOperate?LIMITS.maxZ*zoom+z:LIMITS.maxZ);refreshMarkerVisibility();
 }
 function updateProjector(){updateGlow();updateTransform();const spot=mapSpot(settings);uniforms.uSpot.value.set(spot.x,spot.z,spot.radius,settings.height);uniforms.uLight.value.set(settings.intensity,settings.edge,0,0);uniforms.uEnabled.value=settings.enabled?1:0;
  paths.visible=settings.enabled&&settings.pathGain>0;uniforms.uPathGain.value=settings.pathGain;uniforms.uFalloff.value=settings.falloff;
  apex.position.set(spot.x,settings.height,spot.z);apex.visible=settings.enabled;
  const points=[];for(let i=0;i<96;i++){const angle=i/96*Math.PI*2;points.push(new THREE.Vector3(spot.x+Math.cos(angle)*spot.radius,.012,spot.z+Math.sin(angle)*spot.radius));}rimGeometry.dispose();rimGeometry.setFromPoints(points);rim.visible=settings.enabled;rimMaterial.opacity=Math.min(.8,settings.edge*.32);onDirty();}
 function sourceWindow(padding,sourceCell){
  if(directOperate||zoom<=1)return{...LIMITS,empty:false};
  const spot=sourceSpot(),axis=mapSpot(settings),guard=sourceCell*4+padding*axis.radius/zoom;
  const raw=settings.enabled?{minX:spot.x-spot.radius,maxX:spot.x+spot.radius,minZ:spot.z-spot.radius,maxZ:spot.z+spot.radius}:{minX:(LIMITS.minX-content.position.x)/zoom,maxX:(LIMITS.maxX-content.position.x)/zoom,minZ:(LIMITS.minZ-content.position.z)/zoom,maxZ:(LIMITS.maxZ-content.position.z)/zoom};
  const result={minX:Math.max(LIMITS.minX,raw.minX-guard),maxX:Math.min(LIMITS.maxX,raw.maxX+guard),minZ:Math.max(LIMITS.minZ,raw.minZ-guard),maxZ:Math.min(LIMITS.maxZ,raw.maxZ+guard)};
  return{...result,empty:result.minX>=result.maxX||result.minZ>=result.maxZ};
 }
 function containsWindow(outer,inner){return !!outer&&(inner.empty||(!outer.empty&&outer.minX<=inner.minX&&outer.maxX>=inner.maxX&&outer.minZ<=inner.minZ&&outer.maxZ>=inner.maxZ));}
 function scheduleDetails(){if(!detailTimer&&!disposed)detailTimer=setTimeout(updateDetails,60);}
 function updateDetails(){
  clearTimeout(detailTimer);detailTimer=0;if(disposed)return;
  const requestedCellSize=Math.max(.008,cellSize*4)/zoom;
  // At close range, sample only source geometry which can reach the fixed stage.
  // A padded cache keeps clipping walls outside the visible context and avoids
  // rebuilding source shells on every small pan. The display pitch never grows
  // with magnification; source-space samples become correspondingly finer.
  const needed=sourceWindow(0,requestedCellSize);
  if(sourceRevision!==voxelRevision||Math.abs(requestedCellSize-voxelRequestedSize)>1e-7||!containsWindow(voxelBuildBounds,needed)){
   voxelBuildBounds=sourceWindow(.35,requestedCellSize);
   voxelSource=pointSource?buildPointVoxels(pointSource,{cellSize:requestedCellSize,bounds:voxelBuildBounds.empty?LIMITS:voxelBuildBounds,maxCells:80000}):buildMapVoxels(voxelBuildBounds.empty?[]:normalized.buildings,{project:projectMapPoint,heightScale:WORLD_SCALE,cellSize:requestedCellSize,bounds:voxelBuildBounds.empty?LIMITS:voxelBuildBounds,maxCells:80000,getColor:buildingColor});
   voxelRevision=sourceRevision;voxelRequestedSize=requestedCellSize;voxelBuilds++;
  }
  const spot=mapSpot(settings),positions=[],colors=[],edges=[],pathPositions=[],pathColors=[];
  for(let i=0;i<voxelSource.count;i++){const j=i*3,x=voxelSource.positions[j],y=voxelSource.positions[j+1],z=voxelSource.positions[j+2],isEdge=voxelSource.edges?.[i]||0;
   const displayX=x*zoom+content.position.x,displayY=y*zoom,displayZ=z*zoom+content.position.z;
   if(!directOperate&&(displayX<LIMITS.minX||displayX>LIMITS.maxX||displayZ<LIMITS.minZ||displayZ>LIMITS.maxZ))continue;
   const distance=Math.hypot(displayX-spot.x,displayZ-spot.z),emission=hologramVoxelEmission(spot.radius,settings.height,displayY,distance,isEdge,settings.enabled);
   if(emission/(1+isEdge*HOLOGRAM_LIGHTING.buildingEdgeBoost)<.015)continue;
   positions.push(x,y,z);edges.push(isEdge);colors.push(voxelSource.colors[j],voxelSource.colors[j+1],voxelSource.colors[j+2]);
   // Every emitted cell connects to the projector, including contextual feature
   // edges. Its existing fade and relative edge gain carry into the path color.
   if(settings.enabled){
    pathPositions.push(displayX,displayY,displayZ);
    for(let axis=0;axis<3;axis++)pathColors.push(voxelSource.colors[j+axis]*emission);
   }
  }
  const baseGeometry=new THREE.BoxGeometry(1,1,1),g=new THREE.InstancedBufferGeometry();g.index=baseGeometry.index;for(const [name,attribute]of Object.entries(baseGeometry.attributes))g.setAttribute(name,attribute);
  g.setAttribute('voxelOffset',new THREE.InstancedBufferAttribute(new Float32Array(positions),3));g.setAttribute('voxelColor',new THREE.InstancedBufferAttribute(new Float32Array(colors),3));g.setAttribute('voxelEdge',new THREE.InstancedBufferAttribute(new Float32Array(edges),1));g.instanceCount=positions.length/3;replace(details,g);baseGeometry.dispose();
  const haloGeometry=new THREE.BufferGeometry();haloGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));haloGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));haloGeometry.setAttribute('buildingEdge',new THREE.Float32BufferAttribute(edges,1));replace(halo,haloGeometry);
  uniforms.uVoxelSize.value=voxelSource.cellSize;status.visibleVoxels=g.instanceCount;
  // Anchor the path lattice in projector space. Panning moves endpoints through
  // stationary cells instead of shifting every illuminated cell in the cone.
  const pitch=voxelSource.cellSize*zoom;
  if(Math.abs(pitch-pathBasePitch)>1e-7)pathGridMultiple=1;
  pathBasePitch=pitch;
  const trace=settings.enabled?buildVoxelPaths({positions:pathPositions,colors:pathColors,source:[spot.x,settings.height,spot.z],cellSize:pitch,previousMultiplier:pathGridMultiple}):{positions:new Float32Array(),colors:new Float32Array(),count:0,multiplier:pathGridMultiple,endpointCount:0};
  pathGridMultiple=trace.multiplier;replacePathGeometry(trace);
  status.traceVoxels=trace.count;status.traceEndpoints=trace.endpointCount;status.traceGridMultiple=trace.multiplier;

  const visibleSpot=sourceSpot();status.detailedBuildings=buildingBounds.filter(bounds=>!settings.enabled||tileMeetsSpot(bounds,visibleSpot)).length;
  emit();onDirty();pump();
 }
 async function rebuildData(){const version=++dataVersion;normalized=normalizeMapElements([...sourceElements.values()],MAP_BOUNDS);
  const signature=JSON.stringify(normalized.buildings.map(building=>[building.id,buildingSignature(building)]));if(signature!==sourceSignature){sourceSignature=signature;sourceRevision++;}
  buildingBounds=normalized.buildings.map(building=>{let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const polygon of building.outers)for(const point of polygon.outer){const[x,z]=projectMapPoint(point);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);}return{minX,maxX,minZ,maxZ};});
  await Promise.resolve();if(disposed||version!==dataVersion)return;
  replace(land,flatGeometry(coastlineLand(normalized.coastlines),'#173c39',-.006));
  replace(water,flatGeometry((normalized.water||[]).flatMap(item=>item.outers),'#123949',-.003));
  replace(piers,flatGeometry(normalized.piers.filter(item=>item.closed).map(item=>({outer:item.points,holes:[]})),'#456564',.002));
  replace(roads,lineGeometry(normalized.roads.map(item=>item.points),'#77a99b',.008));replace(coast,lineGeometry(normalized.coastlines.map(item=>item.points),'#7bc8ce',.01));
  updateDetails();emit();onDirty();}
 async function fetchTile(tile){tile.state='loading';inflight++;const controller=new AbortController();controllers.add(controller);const timeout=setTimeout(()=>controller.abort(),28000);emit();
  try{const url=ENDPOINT+'?data='+encodeURIComponent(mapQuery(tile.bounds,tile.id==='context'));const response=await fetchImpl(url,{signal:controller.signal,headers:{Accept:'application/json'}});if(!response.ok)throw new Error(`Map endpoint returned ${response.status}`);const data=await response.json();if(!Array.isArray(data.elements)||data.remark)throw new Error(data.remark||'The map response had no elements array.');if(disposed||controller.signal.aborted)return;
   for(const element of data.elements)sourceElements.set(`${element.type}/${element.id}`,element);tile.state='ready';tile.count=data.elements.length;if(tile.id==='context'){osmContextLoaded=true;contextLoaded=true;}await rebuildData();
  }catch(error){if(disposed)return;tile.state=controller.signal.reason==='inactive'?'idle':'error';tile.error=error?.message||String(error);}
  finally{clearTimeout(timeout);controllers.delete(controller);inflight--;if(!disposed){if(tile.state==='loading'&&controller.signal.aborted)tile.state=controller.signal.reason==='inactive'?'idle':'error';emit();pump();}}}
 function pump(){if(disposed||!active)return;if(pointSource){emit();return;}const queue=[contextTile,...desiredTiles()];for(const tile of queue){if(inflight>=2)break;if(tile.state==='idle')void fetchTile(tile);}emit();}
 function abort(){api.dispose();}
 // The real outline of a scanned building (from OpenStreetMap) drawn on the stage under the scan.
 const outlineGeometry=new THREE.BufferGeometry(),outlineMaterial=new THREE.MeshBasicMaterial({color:'#ffb86c',transparent:true,opacity:.95,depthWrite:false,depthTest:false,side:THREE.DoubleSide,toneMapped:false});
 const outline=new THREE.Mesh(outlineGeometry,outlineMaterial);outline.name='scan-site-outline';outline.frustumCulled=false;outline.visible=false;outline.renderOrder=6;content.add(outline);
 const overlays=new THREE.Group();overlays.name='scan-overlays';content.add(overlays);
 /** A closed outline as a flat band on the ground, `width` stage units wide: a line would be one device pixel. */
 function outlineBand(points,width){
  const positions=[];
  for(let i=0;i<points.length;i++){
   const [ax,az]=points[i],[bx,bz]=points[(i+1)%points.length],length=Math.hypot(bx-ax,bz-az);if(!length)continue;
   const nx=-(bz-az)/length*width/2,nz=(bx-ax)/length*width/2;
   positions.push(ax-nx,.014,az-nz,bx-nx,.014,bz-nz,bx+nx,.014,bz+nz,ax-nx,.014,az-nz,bx+nx,.014,bz+nz,ax+nx,.014,az+nz);
  }
  return new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 }
 function setPointSource(source){
  if(disposed)return;
  const next=source&&source.positions?source:null;
  pointSource=next;sourceRevision++;
  for(const object of[land,water,piers,roads,coast])object.visible=!next;
  contextLoaded=!!next||osmContextLoaded;
  // setFromPoints only refills an existing buffer, never grows it: give each outline a geometry of its own.
  outline.geometry.dispose();outline.geometry=outlineBand(next?.outline||[],.012);outline.visible=!!next?.outline?.length;
  // The drone's demo orbit circles the scan; without a scan it returns to the park.
  const orbit=next?.orbit;
  if(orbit){markerCenter[0]=orbit.center[0];markerCenter[1]=orbit.center[1];markerRadius=orbit.radius;markerHeight=orbit.height;}
  else{markerCenter[0]=markerHome[0];markerCenter[1]=markerHome[1];markerRadius=MAP_ORBIT_MARKER.radiusMeters*WORLD_SCALE;markerHeight=MAP_ORBIT_MARKER.heightMeters*WORLD_SCALE;}
  voxelBuildBounds=null;updateTransform();scheduleDetails();if(!next)pump();emit();onDirty();
 }
 const api={group,
  /** Draws a point scan instead of OpenStreetMap: {positions, colors, count, label, outline?, orbit?} in stage units, or null. */
  setPointSource,
  /** Same source, fewer points (a replay advancing): rebuilds the cells without moving the orbit. */
  updatePointCount(count){if(disposed||!pointSource)return;if(pointSource.count===count)return;pointSource={...pointSource,count};sourceRevision++;scheduleDetails();},
  get overlays(){return overlays;},
  updateAnimation(timeMs){const glow=updatePathAnimation(timeMs),marker=updateMarkerAnimation(timeMs);return glow||marker;},
  suspendMarkerAnimation(){suspendMarker();pathLastTime=null;},
  setDirectOperate(value){
   if(disposed)return false;const next=!!value;if(next===directOperate)return true;
   if(next){
    if(!active||!contextLoaded)return false;
    flight.reset({x:markerPosition.getX(0)/WORLD_SCALE,z:markerPosition.getZ(0)/WORLD_SCALE,altitude:markerPosition.getY(0)/WORLD_SCALE,heading:orbitHeading()});markerHeld=false;
   }else{flight.clearInput(true);reanchorInspection();markerHeld=true;}
   directOperate=next;markerLastTime=null;updateTransform();scheduleDetails();pump();onDirty();return true;
  },
  setDroneInput(input={}){if(disposed||!active||!contextLoaded||!directOperate)return false;if(flight.setInput(input))onDirty();return true;},
  clearDroneInput(){if(disposed)return false;if(flight.clearInput())onDirty();return true;},
  setMarkerHeld(value){if(disposed||directOperate)return false;const next=!!value;if(next!==markerHeld){markerHeld=next;markerLastTime=null;onDirty();}return true;},
  getMarkerState(){
   const position=markerDisplayPosition();position[1]+=GROUND;const sourcePosition=[markerPosition.getX(0),markerPosition.getY(0),markerPosition.getZ(0)],[longitude,latitude]=pointSource?.toLonLat?pointSource.toLonLat(sourcePosition[0],sourcePosition[2]):unprojectMapPoint([sourcePosition[0],sourcePosition[2]]),pose=flight.getState(),heading=directOperate?pose.heading:orbitHeading();
   return{id:'DEMO-01',sensorKit:'RGB / TIR / DEPTH',name:MAP_ORBIT_MARKER.name,source:MAP_ORBIT_MARKER.source,position,sourcePosition,longitude,latitude,altitude:pointSource?.metresPerUnit?sourcePosition[1]*pointSource.metresPerUnit:sourcePosition[1]/WORLD_SCALE,heading,yaw:heading,roll:directOperate?pose.roll:markerHeld?0:orbitBank(),pitch:directOperate?pose.pitch:0,speed:directOperate?pose.speed:markerHeld?0:orbitSpeed(),verticalSpeed:directOperate?pose.verticalSpeed:0,task:directOperate?'direct operate':markerHeld?'holding':'inspecting',held:markerHeld,directOperate,metersToWorld:WORLD_SCALE*zoom,visible:markerInView};
  },
  get metadata(){return{zoom,count:pointSource?pointSource.count:normalized.buildings.length,voxelCount:voxelSource?.count||0,visibleVoxels:status.visibleVoxels||0,traceVoxels:status.traceVoxels||0,traceEndpoints:status.traceEndpoints||0,traceGridMultiple:status.traceGridMultiple||1,voxelCellSize:voxelSource?voxelSource.cellSize*zoom:cellSize*4,translation:{...translation},bounds:{min:[LIMITS.minX,GROUND,LIMITS.minZ],max:[LIMITS.maxX,GROUND+1.7,LIMITS.maxZ]},source:'OpenStreetMap',representation:'osm-buildings',heightEstimates:status.estimatedHeights,colorPalette:'Hologram display palette; OSM colors where tagged',attribution:'© OpenStreetMap contributors',sourceUrl:'https://www.openstreetmap.org/copyright'};},
  getStatus:()=>({...status,zoom,translation:{...translation}}),
  setTranslation(patch={}){if(disposed)return;const next={x:clamp(number(patch.x,translation.x),-4,4),z:clamp(number(patch.z,translation.z),-4,4)};if(next.x===translation.x&&next.z===translation.z)return;translation=next;updateTransform();scheduleDetails();onDirty();},
  setZoom(value){if(disposed)return;const next=clamp(number(value,zoom),.55,12);if(next===zoom)return;zoom=next;updateTransform();scheduleDetails();pump();onDirty();},
  setSettings(patch={}){if(disposed)return;const next={...settings};if(typeof patch.enabled==='boolean')next.enabled=patch.enabled;for(const [key,low,high]of[['x',-1,1],['z',-1,1],['radius',.2,1],['height',1,5],['intensity',.2,3],['edge',0,3],['pathGain',0,1],['falloff',0,8]])if(patch[key]!==undefined)next[key]=clamp(number(patch[key],next[key]),low,high);const geometryChanged=next.enabled!==settings.enabled||next.x!==settings.x||next.z!==settings.z||next.radius!==settings.radius||next.height!==settings.height;settings=next;updateProjector();if(geometryChanged){scheduleDetails();pump();}},
  setAppearance({mark}={}){const index=['dots','hashes','blocks','lines'].indexOf(mark);if(index>=0){uniforms.uMark.value=index;onDirty();}},
  setCellSize(size){if(Number.isFinite(size)&&size>0&&Math.abs(size-cellSize)>1e-7){cellSize=size;uniforms.uCell.value=cellSize;updateGlow();scheduleDetails();onDirty();}},
  setActive(value){const next=!!value;if(next!==active||!next){suspendMarker();pathLastTime=null;}active=next;refreshMarkerVisibility();if(active)pump();else for(const controller of controllers)controller.abort('inactive');},
  retry(){for(const tile of[contextTile,...tiles])if(tile.state==='error')tile.state='idle';pump();},
  restore(){pathLastTime=null;for(const object of objects){for(const attribute of Object.values(object.geometry.attributes))attribute.needsUpdate=true;if(object.geometry.index)object.geometry.index.needsUpdate=true;}material.needsUpdate=baseMaterial.needsUpdate=detailMaterial.needsUpdate=haloMaterial.needsUpdate=pathMaterial.needsUpdate=markerMaterial.needsUpdate=apexMaterial.needsUpdate=rimMaterial.needsUpdate=true;onDirty();},
  dispose(){if(disposed)return;disposed=true;suspendMarker();markerInView=marker.visible=false;dataVersion++;clearTimeout(detailTimer);signal?.removeEventListener('abort',abort);for(const controller of controllers)controller.abort();controllers.clear();for(const object of objects)object.geometry.dispose();material.dispose();baseMaterial.dispose();detailMaterial.dispose();haloMaterial.dispose();pathMaterial.dispose();markerMaterial.dispose();apexGeometry.dispose();apexMaterial.dispose();rimGeometry.dispose();rimMaterial.dispose();group.removeFromParent();group.clear();sourceElements.clear();voxelSource=null;pathFrame=null;pathLastTime=null;sourceSignature='';buildingBounds=[];}
 };
 if(signal?.aborted){api.dispose();return api;}signal?.addEventListener('abort',abort,{once:true});updateProjector();queueMicrotask(pump);return api;
}

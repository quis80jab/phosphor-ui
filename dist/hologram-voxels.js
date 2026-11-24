const HARD_LIMIT = 100000;
const key2 = (x,z) => `${x},${z}`;
const key3 = (x,y,z) => `${x},${y},${z}`;
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

function inside(point,ring) {
  let result=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i],b=ring[j];
    if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;
  }
  return result;
}
function within(point,polygon) {return inside(point,polygon.outer)&&!polygon.holes.some(hole=>inside(point,hole));}
function projectRing(ring,project) {
  if(!Array.isArray(ring)||ring.length<3)return null;
  const points=[];
  for(const point of ring) {
    const projected=project(point);
    if(!projected||!Number.isFinite(projected[0])||!Number.isFinite(projected[1]))return null;
    if(!points.length||projected[0]!==points.at(-1)[0]||projected[1]!==points.at(-1)[1])points.push([projected[0],projected[1]]);
  }
  if(points.length>1&&points[0][0]===points.at(-1)[0]&&points[0][1]===points.at(-1)[1])points.pop();
  return points.length>=3?points:null;
}
function prepare(buildings,project,heightScale,getColor,bounds) {
  const result=[],seen=new Set();
  for(const building of [...buildings].sort((a,b)=>String(a.id).localeCompare(String(b.id)))) {
    if(seen.has(building.id))continue;seen.add(building.id);
    const minY=Number(building.minHeight??0)*heightScale,maxY=Number(building.height)*heightScale;
    if(!Number.isFinite(minY)||!Number.isFinite(maxY)||minY<0||maxY<=minY)continue;
    const raw=getColor(building),color=[0,1,2].map(i=>Number.isFinite(raw?.[i])?clamp(raw[i],0,1):.5);
    for(const source of building.outers||[]) {
      const outer=projectRing(source.outer,project);if(!outer)continue;
      const holes=(source.holes||[]).map(hole=>projectRing(hole,project)).filter(Boolean);
      const xs=outer.map(point=>point[0]),zs=outer.map(point=>point[1]);
      const minX=Math.max(bounds.minX,Math.min(...xs)),maxX=Math.min(bounds.maxX,Math.max(...xs));
      const minZ=Math.max(bounds.minZ,Math.min(...zs)),maxZ=Math.min(bounds.maxZ,Math.max(...zs));
      if(minX>=maxX||minZ>=maxZ)continue;
      result.push({outer,holes,minX,maxX,minZ,maxZ,minY,maxY,color,priority:building.colorTagged?1:0});
    }
  }
  return result;
}

// Center coverage quantizes the original footprint without filling its holes.
// A footprint thinner than one cell still gets one occupied cell on its real edge.
function thinPoint(polygon) {
  const ring=polygon.outer,extent=Math.max(polygon.maxX-polygon.minX,polygon.maxZ-polygon.minZ);
  const middle=[(polygon.minX+polygon.maxX)/2,(polygon.minZ+polygon.maxZ)/2];
  if(within(middle,polygon))return middle;
  for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);
    if(!length)continue;
    const amount=Math.max(1e-10,extent*1e-6);
    for(const side of [-1,1]) {
      const point=[(a[0]+b[0])/2-side*dz/length*amount,(a[1]+b[1])/2+side*dx/length*amount];
      if(point[0]>=polygon.minX&&point[0]<=polygon.maxX&&point[1]>=polygon.minZ&&point[1]<=polygon.maxZ&&within(point,polygon))return point;
    }
  }
  return null;
}

function segmentDistanceSquared(x,z,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
  const t=length?clamp(((x-a[0])*dx+(z-a[1])*dz)/length,0,1):0;
  return (x-a[0]-t*dx)**2+(z-a[1]-t*dz)**2;
}

// Feature edges belong to the extruded source polygon, not to every stair step
// of its rasterized facade. Keep this classification on the same shell cells.
function featureColumns(polygon,footprint,pitch,boundary) {
  const rings=[polygon.outer,...polygon.holes],perimeter=new Set(),corners=new Set(),boundaryKeys=new Set(boundary.map(([x,z])=>key2(x,z)));
  const reach=pitch*Math.SQRT1_2+pitch*1e-7,reachSquared=reach*reach;
  const segments=[];
  for(const ring of rings)for(let i=0;i<ring.length;i++) {
    const a=ring[i],b=ring[(i+1)%ring.length];
    if(Math.max(a[0],b[0])+reach<polygon.minX||Math.min(a[0],b[0])-reach>polygon.maxX||Math.max(a[1],b[1])+reach<polygon.minZ||Math.min(a[1],b[1])-reach>polygon.maxZ)continue;
    segments.push([a,b]);
  }
  for(const [ix,iz]of boundary) {
    const x=(ix+.5)*pitch,z=(iz+.5)*pitch;
    if(segments.some(([a,b])=>x>=Math.min(a[0],b[0])-reach&&x<=Math.max(a[0],b[0])+reach&&z>=Math.min(a[1],b[1])-reach&&z<=Math.max(a[1],b[1])+reach&&segmentDistanceSquared(x,z,a,b)<=reachSquared))perimeter.add(key2(ix,iz));
  }
  for(const ring of rings)for(let i=0;i<ring.length;i++) {
    const a=ring[(i+ring.length-1)%ring.length],b=ring[i],c=ring[(i+1)%ring.length];
    const ax=b[0]-a[0],az=b[1]-a[1],bx=c[0]-b[0],bz=c[1]-b[1];
    const product=Math.hypot(ax,az)*Math.hypot(bx,bz);
    // Redundant collinear OSM nodes are not vertical building edges.
    if(!product||Math.abs(ax*bz-az*bx)<=product*1e-7)continue;
    const cx=Math.floor(b[0]/pitch),cz=Math.floor(b[1]/pitch);
    // Center coverage can put the first occupied sample more than half a
    // cell inside a rotated tip. Select one nearby boundary column only.
    let best=null,distance=4*pitch*pitch;
    for(let iz=cz-2;iz<=cz+2;iz++)for(let ix=cx-2;ix<=cx+2;ix++) {
      const key=key2(ix,iz);if(!boundaryKeys.has(key))continue;
      const d=((ix+.5)*pitch-b[0])**2+((iz+.5)*pitch-b[1])**2;
      if(d<distance){best=key;distance=d;}
    }
    if(best!==null)corners.add(best);
  }
  // A sub-cell footprint is represented by a single shell column; it is the
  // only possible wireframe sample and must not disappear from outline mode.
  if(footprint.size===1)for(const key of footprint.keys()){perimeter.add(key);corners.add(key);}
  return{perimeter,corners};
}

function attempt(polygons,pitch,maxCells) {
  const cells=new Map();let work=0;
  const maxWork=maxCells*32;
  function add(ix,iy,iz,polygon,edge=false) {
    if(++work>maxWork)return false;
    const key=key3(ix,iy,iz),existing=cells.get(key);
    if(!existing)cells.set(key,{ix,iy,iz,color:polygon.color,priority:polygon.priority,edge});
    else {existing.edge ||= edge;if(polygon.priority>existing.priority){existing.color=polygon.color;existing.priority=polygon.priority;}}
    return cells.size<=maxCells;
  }
  for(const polygon of polygons) {
    const footprint=new Map(),minX=Math.floor(polygon.minX/pitch),maxX=Math.ceil(polygon.maxX/pitch)-1;
    const minZ=Math.floor(polygon.minZ/pitch),maxZ=Math.ceil(polygon.maxZ/pitch)-1;
    const minY=Math.floor(polygon.minY/pitch),maxY=Math.max(minY,Math.ceil(polygon.maxY/pitch)-1);
    const rings=[polygon.outer,...polygon.holes];
    for(let iz=minZ;iz<=maxZ;iz++) {
      if(++work>maxWork)return null;
      const z=(iz+.5)*pitch,crossings=[];
      for(const ring of rings)for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
        const a=ring[i],b=ring[j];
        if((a[1]>z)!==(b[1]>z))crossings.push(a[0]+(b[0]-a[0])*(z-a[1])/(b[1]-a[1]));
      }
      crossings.sort((a,b)=>a-b);
      for(let edge=0;edge+1<crossings.length;edge+=2) {
        const first=Math.max(minX,Math.ceil(crossings[edge]/pitch-.5));
        const last=Math.min(maxX,Math.ceil(crossings[edge+1]/pitch-.5)-1);
        for(let ix=first;ix<=last;ix++) {
          if(++work>maxWork)return null;
          footprint.set(key2(ix,iz),[ix,iz]);
          if(!add(ix,maxY,iz,polygon))return null;
          if(polygon.minY>0&&!add(ix,minY,iz,polygon))return null;
        }
      }
    }
    if(!footprint.size) {
      const point=thinPoint(polygon);
      if(point) {
        const ix=Math.floor(point[0]/pitch),iz=Math.floor(point[1]/pitch);
        footprint.set(key2(ix,iz),[ix,iz]);
        if(!add(ix,maxY,iz,polygon))return null;
      }
    }
    // Only boundary columns are extruded. Interior volume is never walked.
    const boundary=[...footprint.values()].filter(([ix,iz])=>!(footprint.has(key2(ix-1,iz))&&footprint.has(key2(ix+1,iz))&&footprint.has(key2(ix,iz-1))&&footprint.has(key2(ix,iz+1))));
    const features=featureColumns(polygon,footprint,pitch,boundary);
    for(const [ix,iz]of boundary) {
      const key=key2(ix,iz),corner=features.corners.has(key),perimeter=features.perimeter.has(key);
      for(let iy=minY;iy<=maxY;iy++)if(!add(ix,iy,iz,polygon,corner||(perimeter&&(iy===minY||iy===maxY))))return null;
    }
  }
  return cells;
}

/** One world-space cube shell, bounded by coarsening the whole map uniformly. */
export function buildMapVoxels(buildings,{project=point=>point,heightScale=1,cellSize,bounds,maxCells=80000,getColor=()=>[.5,.5,.5]}={}) {
  if(!Array.isArray(buildings)||typeof project!=='function'||typeof getColor!=='function')throw new Error('Voxel buildings and projection are required.');
  if(!Number.isFinite(cellSize)||cellSize<=0||!Number.isFinite(heightScale)||heightScale<=0)throw new Error('Voxel cell size and height scale must be positive.');
  if(!Number.isSafeInteger(maxCells)||maxCells<1)throw new Error('Voxel cell budget must be a positive integer.');
  maxCells=Math.min(maxCells,HARD_LIMIT);
  const clip=bounds||{minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity};
  if(!(clip.minX<clip.maxX&&clip.minZ<clip.maxZ))throw new Error('Voxel bounds must have positive width and depth.');
  const polygons=prepare(buildings,project,heightScale,getColor,clip),requestedCellSize=cellSize;
  // Conservative preflight avoids billions of empty row iterations for an
  // accidentally microscopic pitch. Actual occupancy still decides the budget.
  const surface=polygons.reduce((sum,p)=>sum+(p.maxX-p.minX)*(p.maxZ-p.minZ)*(p.minY>0?2:1)+2*((p.maxX-p.minX)+(p.maxZ-p.minZ))*(p.maxY-p.minY),0);
  if(!Number.isFinite(surface))throw new Error('Map extents exceed the voxel coordinate range.');
  let pitch=Math.max(cellSize,Math.sqrt(surface/(maxCells*4))),cells=null;
  for(let pass=0;pass<40;pass++) {
    cells=attempt(polygons,pitch,maxCells);if(cells)break;
    pitch*=1.35;
  }
  if(!cells)throw new Error('The voxel budget is too small for this map lattice.');
  const positions=new Float32Array(cells.size*3),colors=new Float32Array(cells.size*3),edges=new Uint8Array(cells.size);
  const min=cells.size?[Infinity,Infinity,Infinity]:[0,0,0],max=cells.size?[-Infinity,-Infinity,-Infinity]:[0,0,0];
  let index=0;
  for(const cell of cells.values()) {
    const center=[(cell.ix+.5)*pitch,(cell.iy+.5)*pitch,(cell.iz+.5)*pitch];
    positions.set(center,index*3);colors.set(cell.color,index*3);edges[index]=cell.edge?1:0;
    for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],positions[index*3+axis]-pitch/2);max[axis]=Math.max(max[axis],positions[index*3+axis]+pitch/2);}
    index++;
  }
  return {positions,colors,edges,count:cells.size,cellSize:pitch,requestedCellSize,coarsened:pitch>requestedCellSize*(1+1e-12),bounds:{min,max}};
}

/**
 * A point scan (a monument, a SLAM replay) as the same cube shell the map draws: points snapped to
 * cells of `cellSize`, each cell coloured by the mean of its points, a cell with nothing above it
 * marked as edge. The pitch grows uniformly until the cells fit `maxCells`.
 * positions: xyz in stage units (y up from the ground); colors: rgb 0..1 or 0..255 (bytes).
 */
export function buildPointVoxels({positions,colors,count=positions.length/3},{cellSize,bounds,maxCells=80000}={}) {
  if(!(cellSize>0))throw new Error('Voxel cell size must be positive.');
  const clip=bounds||{minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity},scale=colors instanceof Uint8Array?1/255:1,requestedCellSize=cellSize;
  let pitch=cellSize,cells=null;
  for(let pass=0;pass<40&&!cells;pass++){
    const map=new Map();
    for(let i=0;i<count;i++){
      const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
      if(!(x>=clip.minX&&x<=clip.maxX&&z>=clip.minZ&&z<=clip.maxZ&&y>=0))continue;
      const ix=Math.floor(x/pitch),iy=Math.floor(y/pitch),iz=Math.floor(z/pitch),key=`${ix},${iy},${iz}`;
      let cell=map.get(key);
      if(!cell){if(map.size>=maxCells){pitch*=1.35;break;}cell={ix,iy,iz,r:0,g:0,b:0,n:0};map.set(key,cell);}
      cell.r+=colors[i*3];cell.g+=colors[i*3+1];cell.b+=colors[i*3+2];cell.n++;
      if(i===count-1)cells=map;
    }
    if(count===0)cells=map;
  }
  if(!cells)throw new Error('The voxel budget is too small for this scan.');
  const out=new Float32Array(cells.size*3),tints=new Float32Array(cells.size*3),edges=new Uint8Array(cells.size);
  const min=cells.size?[Infinity,Infinity,Infinity]:[0,0,0],max=cells.size?[-Infinity,-Infinity,-Infinity]:[0,0,0];
  let index=0;
  for(const cell of cells.values()){
    out[index*3]=(cell.ix+.5)*pitch;out[index*3+1]=(cell.iy+.5)*pitch;out[index*3+2]=(cell.iz+.5)*pitch;
    tints[index*3]=cell.r/cell.n*scale;tints[index*3+1]=cell.g/cell.n*scale;tints[index*3+2]=cell.b/cell.n*scale;
    const {ix,iy,iz}=cell;
    // A scan is all surface, so every cell would be an edge; mark only the tops (rooflines, cornices), as the map marks a building's outline.
    edges[index]=cells.has(`${ix},${iy+1},${iz}`)?0:1;
    for(let axis=0;axis<3;axis++){min[axis]=Math.min(min[axis],out[index*3+axis]-pitch/2);max[axis]=Math.max(max[axis],out[index*3+axis]+pitch/2);}
    index++;
  }
  return {positions:out,colors:tints,edges,count:cells.size,cellSize:pitch,requestedCellSize,coarsened:pitch>requestedCellSize*(1+1e-12),bounds:{min,max}};
}

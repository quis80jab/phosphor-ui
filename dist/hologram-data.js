// OSM multipolygons may contain split/reversed ways and disjoint outer rings.
// Geometry remains in [longitude, latitude]; the renderer owns projection.
export const DEFAULT_BUILDING_HEIGHT = 9;
export const ESTIMATED_LEVEL_HEIGHT = 3;
const DEFAULT_COLOR = '#a8b3b8';
const COLORS = { black:'#000000', white:'#ffffff', red:'#ff0000', green:'#008000', blue:'#0000ff',
  yellow:'#ffff00', cyan:'#00ffff', aqua:'#00ffff', magenta:'#ff00ff', fuchsia:'#ff00ff',
  gray:'#808080', grey:'#808080', silver:'#c0c0c0', brown:'#a52a2a', beige:'#f5f5dc',
  orange:'#ffa500', purple:'#800080', pink:'#ffc0cb', navy:'#000080', teal:'#008080',
  olive:'#808000', maroon:'#800000', lime:'#00ff00', gold:'#ffd700', tan:'#d2b48c',
  lightgray:'#d3d3d3', lightgrey:'#d3d3d3', darkgray:'#a9a9a9', darkgrey:'#a9a9a9',
  lightblue:'#add8e6', darkblue:'#00008b', darkgreen:'#006400', darkred:'#8b0000',
  ivory:'#fffff0', cream:'#fffdd0', brick:'#e96b39', 'brick-red':'#e96b39' };
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const numericId = value => Number.isSafeInteger(value) || typeof value === 'string' && /^\d+$/.test(value);
const positiveTag = value => typeof value === 'string' && value !== '' && value !== 'no';
const isBuilding = tags => positiveTag(tags.building) || positiveTag(tags['building:part']);
const isWater = tags => tags.natural === 'water' || tags.waterway === 'riverbank' || tags.landuse === 'reservoir';

/** OSM height defaults to metres; feet/inches use 7'4" or an explicit unit. */
export function parseOSMDistance(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  const feet = text.match(/^(\d+(?:\.\d+)?)\s*'\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in))?$/);
  if (feet) return Number(feet[1]) * .3048 + Number(feet[2] || 0) * .0254;
  const measured = text.match(/^(\d+(?:\.\d+)?|\.\d+)\s*(m|meters?|metres?|ft|feet|foot|in|inches?|cm)?$/);
  if (!measured) return null;
  const amount = Number(measured[1]), unit = measured[2] || 'm';
  const scale = /^(ft|feet|foot)$/.test(unit) ? .3048 : /^(in|inch|inches)$/.test(unit) ? .0254 : unit === 'cm' ? .01 : 1;
  const result = amount * scale;
  return Number.isFinite(result) ? result : null;
}

function levels(value) {
  const number = typeof value === 'number' ? value : typeof value === 'string' && /^\d+(?:\.0+)?$/.test(value.trim()) ? Number(value) : NaN;
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
function buildingMetadata(tags) {
  let minHeight = parseOSMDistance(tags.min_height);
  if (minHeight === null) minHeight = (levels(tags['building:min_level'] ?? tags.min_level) ?? 0) * ESTIMATED_LEVEL_HEIGHT;
  const taggedHeight = parseOSMDistance(tags.height), levelCount = levels(tags['building:levels']);
  let height = taggedHeight > 0 ? taggedHeight : levelCount > 0
    ? levelCount * ESTIMATED_LEVEL_HEIGHT + (parseOSMDistance(tags['roof:height']) ?? 0)
    : minHeight + DEFAULT_BUILDING_HEIGHT;
  if (minHeight >= height) minHeight = 0; // Contradictory lower-edge tags cannot create inverted solids.
  const rawColor = tags['building:colour'] ?? tags['building:color'] ?? tags.colour ?? tags.color;
  const colorTag = typeof rawColor === 'string' ? rawColor.trim().toLowerCase() : '';
  const color = /^#[0-9a-f]{6}$/.test(colorTag) ? colorTag : /^#[0-9a-f]{3}$/.test(colorTag)
    ? `#${[...colorTag.slice(1)].map(character => character + character).join('')}`
    : Object.hasOwn(COLORS, colorTag) ? COLORS[colorTag] : DEFAULT_COLOR;
  return { height, minHeight, heightEstimated:!(taggedHeight > 0), color, colorTagged:color !== DEFAULT_COLOR || colorTag === DEFAULT_COLOR,
    isPart:positiveTag(tags['building:part']) };
}

function normalizedBounds(input) {
  if (input == null) return null;
  const bounds = Array.isArray(input) ? {south:input[0],west:input[1],north:input[2],east:input[3]}
    : {south:input.south ?? input.minlat,west:input.west ?? input.minlon,north:input.north ?? input.maxlat,east:input.east ?? input.maxlon};
  if (!Object.values(bounds).every(Number.isFinite) || bounds.south >= bounds.north || bounds.west >= bounds.east
    || bounds.south < -90 || bounds.north > 90 || bounds.west < -180 || bounds.east > 180) throw new Error('Map bounds must be south, west, north, east coordinates.');
  return bounds;
}
function coordinate(value) {
  const point = Array.isArray(value) ? value : [value?.lon,value?.lat];
  return Number.isFinite(point[0]) && Number.isFinite(point[1]) && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 90 ? [point[0],point[1]] : null;
}
const sameCoordinate = (a,b) => a[0] === b[0] && a[1] === b[1];
const sameEndpoint = (a,b) => a.node != null && b.node != null ? String(a.node) === String(b.node) : sameCoordinate(a.point,b.point);
function pathOf(element, nodes) {
  const nodeIds = Array.isArray(element?.nodes) ? element.nodes : [];
  const raw = Array.isArray(element?.geometry) && element.geometry.length ? element.geometry : nodeIds.map(id => nodes.get(String(id)));
  return raw.map((value,index) => {
    const point = coordinate(value) || coordinate(nodes.get(String(nodeIds[index])));
    return point ? {point,node:nodeIds.length === raw.length && numericId(nodeIds[index]) ? nodeIds[index] : null} : null;
  });
}
function completePath(path) { return path.length >= 2 && path.every(Boolean); }
function signedArea(points) {
  const [x,y] = points[0]; let area = 0;
  for (let i = 1; i < points.length; i++) area += (points[i-1][0]-x)*(points[i][1]-y)-(points[i][0]-x)*(points[i-1][1]-y);
  return area / 2;
}
function ring(path) {
  if (!completePath(path) || !sameEndpoint(path[0],path.at(-1))) return null;
  const result = [];
  for (const item of path) if (!result.length || !sameCoordinate(result.at(-1),item.point)) result.push([...item.point]);
  if (!sameCoordinate(result[0],result.at(-1))) result.push([...result[0]]);
  return result.length >= 4 && Math.abs(signedArea(result)) > 1e-16 ? result : null;
}
const orient = (points, outer) => (signedArea(points) > 0) === outer ? points : [...points].reverse();
function boundaryPoint(point, polygon) {
  for(let i=1;i<polygon.length;i++) {
    const a=polygon[i-1],b=polygon[i];
    const cross=(point[0]-a[0])*(b[1]-a[1])-(point[1]-a[1])*(b[0]-a[0]);
    if(Math.abs(cross)<1e-14&&point[0]>=Math.min(a[0],b[0])&&point[0]<=Math.max(a[0],b[0])&&point[1]>=Math.min(a[1],b[1])&&point[1]<=Math.max(a[1],b[1]))return true;
  }
  return false;
}
function contains(point, polygon) {
  if(boundaryPoint(point,polygon))return true;
  let inside = false;
  for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
    const a=polygon[i],b=polygon[j];
    if ((a[1]>point[1])!==(b[1]>point[1]) && point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
  }
  return inside;
}
function containsPart(outline,part) {
  const inOutline=point=>contains(point,outline.outer)&&!outline.holes.some(hole=>contains(point,hole)&&!boundaryPoint(point,hole));
  for(let i=0;i<part.outer.length-1;i++) {
    const a=part.outer[i],b=part.outer[i+1];
    if(!inOutline(a)||!inOutline([(a[0]+b[0])/2,(a[1]+b[1])/2]))return false;
  }
  // A feature inside an outline's courtyard is a separate building. Do not
  // discard that enclosing outline or fill its holes during part matching.
  return !outline.holes.some(hole=>hole.some(point=>contains(point,part.outer)&&!part.holes.some(inner=>contains(point,inner))));
}
function preferBuildingParts(result,relations) {
  const parts=result.buildings.filter(building=>building.isPart),explicit=new Set();
  const partIds=new Set(parts.map(part=>part.id));
  for(const relation of relations.values())if(relation.tags?.type==='building'&&Array.isArray(relation.members)) {
    if(relation.members.some(member=>member.role==='part'&&partIds.has(`${member.type}/${member.ref}`))) {
      for(const member of relation.members)if(member.role==='outline')explicit.add(`${member.type}/${member.ref}`);
    }
  }
  // Simple 3D Buildings uses parts instead of the enclosing 2D outline:
  // https://wiki.openstreetmap.org/wiki/Simple_3D_buildings#Building_outlines
  // Match each disjoint outer separately, retaining unrelated islands.
  result.buildings=result.buildings.flatMap(building=>{
    if(building.isPart)return [building];
    const outers=explicit.has(building.id)?[]:building.outers.filter(outline=>!parts.some(part=>part.outers.some(polygon=>containsPart(outline,polygon))));
    if(outers.length===building.outers.length)return [building];
    result.suppressedOutlines.push(building.id);
    return outers.length?[{...building,outers}]:[];
  });
}
function intersects(points,bounds) {
  if (!bounds) return true;
  let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
  for (const [x,y] of points) {west=Math.min(west,x);east=Math.max(east,x);south=Math.min(south,y);north=Math.max(north,y);}
  return west<=bounds.east && east>=bounds.west && south<=bounds.north && north>=bounds.south;
}

function stitch(segments) {
  const used = new Set(), rings = [];
  for (let start=0;start<segments.length;start++) {
    if (used.has(start)) continue;
    let path=[...segments[start].path]; const members=new Set([start]);
    while (!sameEndpoint(path[0],path.at(-1))) {
      let next=-1,reverse=false;
      for (let i=0;i<segments.length;i++) {
        if (used.has(i)||members.has(i)) continue;
        if (sameEndpoint(path.at(-1),segments[i].path[0])) {next=i;break;}
        if (sameEndpoint(path.at(-1),segments[i].path.at(-1))) {next=i;reverse=true;break;}
      }
      if (next<0) break;
      const addition=reverse?[...segments[next].path].reverse():segments[next].path;
      path.push(...addition.slice(1));members.add(next);
    }
    const polygon=ring(path);
    if (polygon) {for(const index of members)used.add(index);rings.push({points:polygon,ids:[...members].map(index=>segments[index].id)});}
  }
  return {rings,complete:used.size===segments.length};
}

/** Normalize actual OSM geometry; missing footprints and coastlines are never fabricated. */
export function normalizeMapElements(elements, inputBounds) {
  const bounds=normalizedBounds(inputBounds), nodes=new Map(), ways=new Map(), relations=new Map();
  const result={buildings:[],roads:[],coastlines:[],piers:[],water:[],bounds,warnings:[],suppressedOutlines:[]};
  if (!Array.isArray(elements)) return result;
  for (const element of elements) {
    if (!record(element)||!numericId(element.id)) continue;
    const target=element.type==='node'?nodes:element.type==='way'?ways:element.type==='relation'?relations:null;
    if (!target) continue;
    const key=String(element.id), previous=target.get(key);
    if (!previous) target.set(key,element);
    else {
      const merged={...previous,...element,tags:{...previous.tags,...element.tags}};
      for(const field of ['geometry','nodes','members'])if((previous[field]?.length||0)>(element[field]?.length||0))merged[field]=previous[field];
      if(Array.isArray(previous.geometry)&&previous.geometry.filter(point=>coordinate(point)).length>(element.geometry?.filter(point=>coordinate(point)).length||0))merged.geometry=previous.geometry;
      target.set(key,merged);
    }
  }
  const consumed={buildings:new Set(),water:new Set(),piers:new Set()};
  for(const relation of relations.values()) {
    if (!Array.isArray(relation.members)||relation.tags?.type!=='multipolygon') continue;
    const members=relation.members.filter(member=>member.type==='way'&&numericId(member.ref));
    const outerTagged=members.find(member=>member.role!=='inner'&&record(ways.get(String(member.ref))?.tags));
    const tags={...(outerTagged?ways.get(String(outerTagged.ref)).tags:{}),...relation.tags};
    const kind=isBuilding(tags)?'buildings':isWater(tags)?'water':tags.man_made==='pier'?'piers':null;
    if (!kind) continue;
    const outer=[],inner=[];let missing=false;
    for(const member of members) {
      if (member.role && member.role!=='outer' && member.role!=='inner') continue;
      const way=ways.get(String(member.ref)), direct=pathOf(member,nodes), referenced=way?pathOf(way,nodes):[];
      const path=completePath(referenced)?referenced:direct;
      if(!completePath(path)){missing=true;continue;}
      (member.role==='inner'?inner:outer).push({id:String(member.ref),path});
    }
    const outside=stitch(outer),inside=stitch(inner);
    if(missing||!outside.complete||!inside.complete||!outside.rings.length){result.warnings.push(`relation/${relation.id}: incomplete polygon geometry`);continue;}
    const polygons=outside.rings.map(item=>({outer:orient(item.points,true),holes:[],ids:item.ids}));
    let orphan=false;
    for(const hole of inside.rings) {
      const owner=polygons.filter(polygon=>hole.points.slice(0,-1).every(point=>contains(point,polygon.outer)))
        .sort((a,b)=>Math.abs(signedArea(a.outer))-Math.abs(signedArea(b.outer)))[0];
      if(!owner){orphan=true;break;}
      owner.holes.push(orient(hole.points,false));owner.ids.push(...hole.ids);
    }
    if(orphan){result.warnings.push(`relation/${relation.id}: hole outside its outer ring`);continue;}
    const visible=polygons.filter(polygon=>intersects(polygon.outer,bounds));
    if(!visible.length)continue;
    const id=`relation/${relation.id}`,outers=visible.map(({outer,holes})=>({outer,holes}));
    if(kind==='buildings')result.buildings.push({id,outers,...buildingMetadata(tags)});
    else if(kind==='water')result.water.push({id,outers});
    else for(const [index,polygon]of visible.entries())result.piers.push({id:`${id}/${index}`,points:polygon.outer,closed:true,holes:polygon.holes});
    for(const polygon of visible)for(const memberId of polygon.ids)consumed[kind].add(memberId);
  }
  for(const [key,way]of ways) {
    const tags=record(way.tags)?way.tags:{},path=pathOf(way,nodes),polygon=ring(path),id=`way/${key}`;
    if(polygon&&intersects(polygon,bounds)) {
      if(isBuilding(tags)&&!consumed.buildings.has(key))result.buildings.push({id,outers:[{outer:orient(polygon,true),holes:[]}],...buildingMetadata(tags)});
      if(isWater(tags)&&!consumed.water.has(key))result.water.push({id,outers:[{outer:orient(polygon,true),holes:[]}]});
    }
    // Missing geometry breaks a line; do not connect endpoints across unknown land.
    const paths=[];let part=[];
    for(const item of [...path,null]) {
      if(item) {if(!part.length||!sameCoordinate(part.at(-1),item.point))part.push([...item.point]);}
      else {if(part.length>=2)paths.push(part);part=[];}
    }
    for(const [index,points]of paths.entries()) {
      if(!intersects(points,bounds))continue;
      const partId=paths.length===1?id:`${id}/${index}`;
      if(positiveTag(tags.highway))result.roads.push({id:partId,kind:tags.highway,points});
      if(tags.natural==='coastline')result.coastlines.push({id:partId,points});
      if(tags.man_made==='pier'&&!consumed.piers.has(key))result.piers.push({id:partId,points,closed:points.length>=4&&sameCoordinate(points[0],points.at(-1))});
    }
  }
  preferBuildingParts(result,relations);
  return result;
}

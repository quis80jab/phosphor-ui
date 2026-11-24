import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMapElements, parseOSMDistance } from '../dist/hologram-data.js';

const geometry = points => points.map(([lon,lat]) => ({lon,lat}));
const way = (id,points,tags={}) => ({type:'way',id,tags,geometry:geometry(points)});
const square = (x,y,size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const relation = (id,members,tags={building:'yes'}) => ({type:'relation',id,tags:{type:'multipolygon',...tags},members});
const member = (ref,role='outer',points) => ({type:'way',ref,role,...(points?{geometry:geometry(points)}:{})});
const area = points => points.reduce((sum,p,i) => i ? sum+points[i-1][0]*p[1]-p[0]*points[i-1][1] : sum,0)/2;

test('heights parse metres and feet/inches conservatively', () => {
  for(const [input,expected]of [[12,12],['12',12],['12 m',12],['12m',12],['3.5 metres',3.5],['10 ft',3.048],[`7'4"`,2.2352],['6 in',.1524],['250 cm',2.5]]) {
    assert.ok(Math.abs(parseOSMDistance(input)-expected)<1e-9,`${input} should be ${expected} metres`);
  }
  for(const invalid of [null,true,'','12;14','about 10','10,5','-3 m',NaN,Infinity,[],{}])assert.equal(parseOSMDistance(invalid),null);
});

test('building tags distinguish explicit height and colour from documented estimates', () => {
  const elements=[
    way(1,square(0,0,1),{building:'yes',height:'30 ft',min_height:`3'3"`,'building:colour':'#AbC'}),
    way(2,square(2,0,1),{building:'yes','building:levels':'4','building:min_level':'1','roof:height':'2','building:colour':'beige'}),
    way(3,square(4,0,1),{'building:part':'yes','building:levels':'1.5','building:colour':'javascript:bad'}),
    way(4,square(6,0,1),{building:'yes',min_height:'12 m'}),
    way(5,square(8,0,1),{building:'yes',height:'8',min_height:'20'})
  ];
  const {buildings}=normalizeMapElements(elements);
  assert.equal(buildings.length,5);
  assert.equal(buildings[0].height,9.144);assert.ok(Math.abs(buildings[0].minHeight-.9906)<1e-9);
  assert.equal(buildings[0].heightEstimated,false);assert.equal(buildings[0].color,'#aabbcc');assert.equal(buildings[0].colorTagged,true);
  assert.equal(buildings[1].height,14);assert.equal(buildings[1].minHeight,3);assert.equal(buildings[1].heightEstimated,true);assert.equal(buildings[1].color,'#f5f5dc');
  assert.equal(buildings[2].height,9);assert.equal(buildings[2].heightEstimated,true);assert.equal(buildings[2].colorTagged,false);
  assert.equal(buildings[3].height,21);assert.equal(buildings[3].minHeight,12);
  assert.equal(buildings[4].height,8);assert.equal(buildings[4].minHeight,0,'contradictory minimum height must not invert a solid');
});

test('multipolygons stitch unordered reversed members, keep courtyards and disjoint outers, and deduplicate member ways', () => {
  const outerA=[[0,0],[4,0],[4,4]],outerB=[[0,0],[0,4],[4,4]],hole=square(1,1,1),island=square(6,0,2);
  const elements=[way(1,outerA,{building:'yes'}),way(2,outerB),way(3,hole,{building:'yes'}),way(4,island,{building:'yes',highway:'pedestrian'}),
    relation(10,[member(2),member(3,'inner'),member(4),member(1)],{building:'yes',height:'22'})];
  const before=JSON.stringify(elements),result=normalizeMapElements(elements);
  assert.equal(JSON.stringify(elements),before,'normalization must not mutate source geometry');
  assert.equal(result.buildings.length,1);assert.equal(result.buildings[0].id,'relation/10');
  const polygons=result.buildings[0].outers;assert.equal(polygons.length,2);
  assert.equal(polygons.reduce((sum,polygon)=>sum+polygon.holes.length,0),1);
  assert.ok(polygons.every(polygon=>area(polygon.outer)>0));assert.ok(area(polygons.find(polygon=>polygon.holes.length).holes[0])<0);
  assert.deepEqual(new Set(polygons.flatMap(polygon=>polygon.outer.map(point=>point.join(',')))),new Set([...outerA,...outerB,...island].map(point=>point.join(','))));
  assert.equal(result.roads.length,1,'relation ownership only deduplicates the same feature category');
  assert.deepEqual(result.warnings,[]);
});

test('nested outer islands assign each hole to its smallest containing polygon', () => {
  const result=normalizeMapElements([relation(1,[
    member(1,'outer',square(0,0,10)),member(2,'inner',square(2,2,6)),
    member(3,'outer',square(3,3,2)),member(4,'inner',square(3.5,3.5,.5))
  ])]);
  const polygons=result.buildings[0].outers.sort((a,b)=>area(b.outer)-area(a.outer));
  assert.equal(polygons[0].holes.length,1);assert.equal(polygons[1].holes.length,1);
  assert.equal(Math.abs(area(polygons[0].holes[0])),36);
  assert.equal(Math.abs(area(polygons[1].holes[0])),.25);
});

test('invalid relation geometry cannot consume an otherwise valid standalone footprint', () => {
  const standalone=way(1,square(0,0,4),{building:'yes',height:'11'});
  const result=normalizeMapElements([standalone,relation(10,[member(1),member(2,'inner',[[1,1],[2,1],[2,2]])])]);
  assert.deepEqual(result.buildings.map(item=>item.id),['way/1']);
  assert.match(result.warnings[0],/incomplete polygon/);
  const bad=normalizeMapElements([way(2,[[0,0],[1,0],[1,1]],{building:'yes'}),way(3,[[0,0],[1,0],[2,0],[0,0]],{building:'yes'}),way(4,square(0,0,2),{building:'no'})]);
  assert.equal(bad.buildings.length,0,'open or degenerate footprints are never invented or closed with a shortcut');
});

test('water holes, directed coastlines, pier topology and node-based roads retain original coordinates', () => {
  const coast=[[.1,.2],[.3,.4],[.5,.6]],pier=[[1,0],[2,0]],lake=square(3,0,2);
  const elements=[way(1,coast,{natural:'coastline'}),way(2,pier,{man_made:'pier'}),way(3,square(0,2,1),{man_made:'pier'}),
    way(4,lake,{natural:'water'}),relation(5,[member(4),member(6,'inner',square(3.5,.5,.5))],{natural:'water'}),
    {type:'node',id:70,lon:7,lat:0},{type:'node',id:71,lon:8,lat:0},
    {type:'way',id:7,nodes:[70,71],tags:{highway:'service'}}];
  const result=normalizeMapElements(elements);
  assert.deepEqual(result.coastlines,[{id:'way/1',points:coast}]);
  assert.deepEqual(result.piers[0],{id:'way/2',points:pier,closed:false});assert.equal(result.piers[1].closed,true);
  assert.equal(result.water.length,1);assert.equal(result.water[0].id,'relation/5');assert.equal(result.water[0].outers[0].holes.length,1);
  assert.deepEqual(result.roads,[{id:'way/7',kind:'service',points:[[7,0],[8,0]]}]);
  const broken=normalizeMapElements([{type:'way',id:9,tags:{highway:'path'},geometry:[{lon:0,lat:0},{lon:1,lat:1},null,{lon:3,lat:3},{lon:4,lat:4}]}]);
  assert.deepEqual(broken.roads.map(item=>item.points),[[[0,0],[1,1]],[[3,3],[4,4]]]);
});

test('bbox filtering retains intersecting real outlines and crossing lines without clipping them into fake footprints', () => {
  const enclosing=square(-2,-2,4),crossing=[[-3,0],[3,0]];
  const result=normalizeMapElements([way(1,enclosing,{building:'yes'}),way(2,square(3,3,1),{building:'yes'}),
    way(3,crossing,{highway:'primary'}),way(4,[[4,4],[5,5]],{natural:'coastline'})],[-1,-1,1,1]);
  assert.deepEqual(result.bounds,{south:-1,west:-1,north:1,east:1});
  assert.equal(result.buildings.length,1);assert.deepEqual(result.buildings[0].outers[0].outer,enclosing);
  assert.deepEqual(result.roads[0].points,crossing);assert.deepEqual(result.coastlines,[]);
  assert.throws(()=>normalizeMapElements([],[1,0,-1,1]),/bounds/);
  const empty=normalizeMapElements([],[-1,-1,1,1]);
  for(const key of ['buildings','roads','coastlines','piers','water'])assert.deepEqual(empty[key],[]);
});

test('union input deduplicates type and ID while preserving useful tags and geometry', () => {
  const first=way(1,square(0,0,1),{building:'yes'}),duplicate={type:'way',id:1,tags:{height:'18'}};
  const result=normalizeMapElements([first,duplicate,first]);
  assert.equal(result.buildings.length,1);assert.equal(result.buildings[0].height,18);
  const partial={...first,geometry:first.geometry.map((point,index)=>index===2?null:point)};
  assert.equal(normalizeMapElements([first,partial]).buildings.length,1,'partial duplicates must not replace complete geometry');
});

test('3D parts replace their containing outline while preserving unrelated outer islands and courtyards', () => {
  const result=normalizeMapElements([
    relation(1,[member(1,'outer',square(0,0,4)),member(2,'outer',square(6,0,2))]),
    way(3,square(1,1,1),{'building:part':'yes',height:'20'}),
    relation(4,[member(4,'outer',square(0,6,4)),member(5,'inner',square(1,7,2))]),
    way(6,square(1.5,7.5,.5),{'building:part':'yes'})
  ]);
  const outline=result.buildings.find(item=>item.id==='relation/1');
  assert.equal(outline.outers.length,1);assert.deepEqual(outline.outers[0].outer,square(6,0,2));
  assert.equal(result.buildings.find(item=>item.id==='relation/4').outers[0].holes.length,1,'a separate courtyard feature must not suppress its surrounding building');
  assert.equal(result.buildings.find(item=>item.id==='way/3').isPart,true);
  assert.deepEqual(result.suppressedOutlines,['relation/1']);
});

test('explicit building relations associate overhanging parts without coordinate guesses', () => {
  const result=normalizeMapElements([
    way(1,square(0,0,2),{building:'yes'}),way(2,square(1,1,3),{'building:part':'yes'}),
    {type:'relation',id:3,tags:{type:'building'},members:[member(1,'outline'),member(2,'part')]}
  ]);
  assert.deepEqual(result.buildings.map(item=>item.id),['way/2']);
  assert.deepEqual(result.suppressedOutlines,['way/1']);
});

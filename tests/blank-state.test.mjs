import test from 'node:test';
import assert from 'node:assert/strict';
import {DESIGN_STORAGE_KEY,DESIGN_PAGES,DEFAULT_HIDDEN_PAGES,createDefaultDesign,normalizeDesign,readDesign,saveDesign} from '../dist/blank-state.js';

const rectangle=(patch={})=>({id:'rect-1',type:'rectangle',x:2,y:3,width:16,height:8,label:'Main panel',link:null,...patch});
const memory=(initial=[])=>{
  const data=new Map(initial),writes=[];
  return{data,writes,getItem:key=>data.get(key)??null,setItem(key,value){writes.push([key,value]);data.set(key,value);}};
};
const design=()=>{
  const state=createDefaultDesign();state.pages.home.push(rectangle());
  state.pages.system.push(rectangle({id:'topology',x:0,y:0,width:20,height:12,label:'Device topology',link:'assets'}));
  return state;
};
const legacyDesign=()=>{
  const state=design();
  return{format:state.format,version:1,pages:Object.fromEntries(DESIGN_PAGES.map(({id})=>[id,state.pages[id].map(({type,...shape})=>shape)]))};
};
const withHiddenPages=hiddenPages=>({
  format:'phosphor-flow-designer',version:2,hiddenPages,
  pages:Object.fromEntries([...DESIGN_PAGES,...hiddenPages].map(({id})=>[id,[]]))
});

test('seven main and three default hidden pages have independent arrays and fresh defaults',()=>{
  assert.deepEqual(DESIGN_PAGES.map(page=>page.id),['home','site','cases','assets','system','calendar','analyze']);
  assert.match(DESIGN_PAGES.find(page=>page.id==='assets').description,/planes, tanks, sites/i);
  assert.match(DESIGN_PAGES.find(page=>page.id==='system').description,/topology.*modules.*telemetry.*direct control/i);
  const first=createDefaultDesign();assert.equal(first.version,2);assert.deepEqual(first.hiddenPages,DEFAULT_HIDDEN_PAGES);assert.equal(Object.keys(first.pages).length,10);first.pages.home.push(rectangle());
  for(const id of ['site','cases','assets','system','calendar','analyze','sign-in','sign-up','reset-password'])assert.equal(first.pages[id].length,0);
  first.hiddenPages[0].label='Changed';assert.equal(DEFAULT_HIDDEN_PAGES[0].label,'Sign in');assert.equal(createDefaultDesign().hiddenPages[0].label,'Sign in');
  assert.equal(createDefaultDesign().pages.home.length,0);
  assert.ok(Object.isFrozen(DEFAULT_HIDDEN_PAGES));assert.ok(DEFAULT_HIDDEN_PAGES.every(Object.isFrozen));
});

test('all page layouts, labels, and flow links survive save and reload without touching other labs',()=>{
  const storage=memory([['phosphor-inspection-viewer-v1','viewer original']]),state=design();
  state.pages.assets.push(rectangle({id:'asset-note',label:'Planes & tanks <overview>',link:'system',x:508,y:509,width:4,height:3}));
  const normalized=saveDesign(storage,state),loaded=readDesign(storage);
  assert.deepEqual(normalized,state);assert.deepEqual(loaded,{state,error:null,blocked:false});
  assert.equal(storage.data.get('phosphor-inspection-viewer-v1'),'viewer original');
  assert.deepEqual(storage.writes.map(([key])=>key),[DESIGN_STORAGE_KEY]);
  assert.equal(JSON.parse(storage.data.get(DESIGN_STORAGE_KEY)).pages.assets[0].label,'Planes & tanks <overview>');
});

test('normalization returns a deep copy and never mutates saved or caller-owned layouts',()=>{
  const input=design(),original=structuredClone(input),copy=normalizeDesign(input);
  copy.pages.home[0].label='Changed';copy.pages.system.push(rectangle({id:'other'}));copy.hiddenPages[0].label='Changed';
  assert.deepEqual(input,original);assert.notEqual(copy.pages,input.pages);assert.notEqual(copy.pages.home[0],input.pages.home[0]);
});

test('malformed documents, missing pages, duplicate IDs, invalid links, and excess rectangles are rejected',()=>{
  const edits=[
    x=>{x.version=3;},x=>{x.format='other';},x=>{delete x.pages.site;},x=>{x.pages.other=[];},
    x=>{x.extra=true;},x=>{x.pages.home=null;},x=>{delete x.pages.home[0];},x=>{delete x.pages.home[0].link;},
    x=>{x.pages.home[0].extra=1;},x=>{delete x.pages.home[0].type;},x=>{x.pages.home[0].type='circle';},x=>{x.pages.home[0].id='';},x=>{x.pages.home[0].id='bad id';},
    x=>{x.pages.system[0].id=x.pages.home[0].id;},x=>{x.pages.home.push({...x.pages.home[0]});},
    x=>{x.pages.home[0].link='missing';},x=>{x.pages.home[0].label='a'.repeat(81);},
    x=>{x.pages.home[0].label='bad\u0000label';},x=>{x.pages.home[0].label=7;},
    x=>{x.pages.home=Array.from({length:201},(_,i)=>rectangle({id:`rect-${i}`}));}
  ];
  for(const edit of edits){const input=design();edit(input);const before=structuredClone(input);assert.throws(()=>normalizeDesign(input));assert.deepEqual(input,before);}
  for(const input of [null,[],{},'{}',new Date()])assert.throws(()=>normalizeDesign(input));
});

test('only finite integer grid geometry within the canvas is accepted, including boundary cells',()=>{
  for(const [field,value]of[['x',-1],['y',512],['x',.5],['y','2'],['x',Infinity],['y',NaN],['width',3],['height',2],['width',0],['height',513],['x',509],['y',510]]){
    const input=createDefaultDesign();input.pages.home.push(rectangle({x:0,y:0,width:4,height:3,[field]:value}));
    assert.throws(()=>normalizeDesign(input),`${field}=${value}`);
  }
  const boundary=createDefaultDesign();boundary.pages.home.push(rectangle({x:508,y:509,width:4,height:3}));
  assert.deepEqual(normalizeDesign(boundary),boundary);
});

test('absent storage starts empty; corrupt data and blocked reads remain untouched with autosave blocked',()=>{
  const empty=memory();assert.deepEqual(readDesign(empty),{state:createDefaultDesign(),error:null,blocked:false});assert.equal(empty.writes.length,0);
  for(const raw of ['{broken','null','[]','{}',JSON.stringify({...design(),version:7}),'x'.repeat(1024*1024+1)]){
    const storage=memory([[DESIGN_STORAGE_KEY,raw]]),loaded=readDesign(storage);
    assert.equal(loaded.blocked,true);assert.ok(loaded.error);assert.deepEqual(loaded.state,createDefaultDesign());
    assert.equal(storage.data.get(DESIGN_STORAGE_KEY),raw);assert.equal(storage.writes.length,0);
  }
  const blocked={getItem(){throw new Error('denied');},setItem(){assert.fail('read must never write');}};
  assert.equal(readDesign(blocked).blocked,true);assert.equal(readDesign({}).blocked,true);
});

test('save failures are explicit and invalid edits cannot replace valid stored data',()=>{
  const storage=memory([[DESIGN_STORAGE_KEY,'original']]),bad=design();bad.pages.home[0].width=-1;
  assert.throws(()=>saveDesign(storage,bad));assert.equal(storage.data.get(DESIGN_STORAGE_KEY),'original');assert.equal(storage.writes.length,0);
  assert.throws(()=>saveDesign({setItem(){throw new Error('quota');}},design()),/quota/);
  assert.throws(()=>saveDesign({},design()),/unavailable/);
});

test('version 1 layouts migrate without writing until explicitly saved to the original storage key',()=>{
  const legacy=legacyDesign();
  legacy.pages.cases.push({...legacy.pages.home[0],id:'case-panel',label:'  Preserve my label  ',link:'system',x:508,y:509,width:4,height:3});
  const original=structuredClone(legacy),raw=JSON.stringify(legacy),storage=memory([[DESIGN_STORAGE_KEY,raw],['other-settings','keep']]);
  const expected=createDefaultDesign();
  for(const {id}of DESIGN_PAGES)expected.pages[id]=legacy.pages[id].map(shape=>({...shape,type:'rectangle'}));
  const loaded=readDesign(storage);
  assert.deepEqual(loaded,{state:expected,error:null,blocked:false});assert.deepEqual(normalizeDesign(legacy),expected);
  assert.deepEqual(legacy,original);assert.equal(storage.writes.length,0);assert.equal(storage.data.get(DESIGN_STORAGE_KEY),raw);
  loaded.state.pages.home[0].label='Edited after migration';
  const saved=saveDesign(storage,loaded.state);
  assert.equal(saved.version,2);assert.deepEqual(JSON.parse(storage.data.get(DESIGN_STORAGE_KEY)),saved);
  assert.deepEqual(storage.writes.map(([key])=>key),[DESIGN_STORAGE_KEY]);assert.equal(storage.data.get('other-settings'),'keep');
  assert.deepEqual(readDesign(storage).state,saved);assert.equal(saved.pages.cases[0].label,'  Preserve my label  ');
});

test('version 1 migration rejects incomplete or mixed-version documents and preserves malformed storage',()=>{
  const edits=[
    state=>{state.hiddenPages=[];},state=>{state.pages['sign-in']=[];},state=>{delete state.pages.assets;},
    state=>{state.pages.home[0].type='rectangle';},state=>{state.pages.home[0].link='sign-in';},
    state=>{state.pages.home[0].width=1;},state=>{state.pages.home[0].x=.5;},
    state=>{state.pages.system[0].id=state.pages.home[0].id;},state=>{delete state.pages.home[0].label;}
  ];
  for(const edit of edits){
    const legacy=legacyDesign();edit(legacy);const raw=JSON.stringify(legacy),storage=memory([[DESIGN_STORAGE_KEY,raw]]);
    assert.throws(()=>normalizeDesign(legacy));assert.equal(readDesign(storage).blocked,true);
    assert.equal(storage.data.get(DESIGN_STORAGE_KEY),raw);assert.equal(storage.writes.length,0);
  }
});

test('one-cell horizontal and vertical dividers preserve boundary geometry and links through storage',()=>{
  const state=design(),storage=memory();
  state.pages.home.push(rectangle({id:'horizontal',type:'divider',x:0,y:511,width:512,height:1,label:'Section boundary',link:'sign-in'}));
  state.pages['sign-in'].push(rectangle({id:'vertical',type:'divider',x:511,y:0,width:1,height:512,link:'home'}));
  saveDesign(storage,state);assert.deepEqual(readDesign(storage),{state,error:null,blocked:false});
  for(const [width,height]of[[1,1],[3,1],[1,3],[4,2],[2,4],[4,4]]){
    const invalid=createDefaultDesign();invalid.pages.home.push(rectangle({type:'divider',x:0,y:0,width,height}));
    assert.throws(()=>normalizeDesign(invalid),`${width}x${height} divider`);
  }
});

test('hidden-page navigation supports custom definitions, trimmed labels, and intentionally empty lists',()=>{
  const state=withHiddenPages([{id:'operator-login',label:'  Operator login  '},{id:'recovery-2',label:'Recovery'}]);
  state.pages.home.push(rectangle({link:'operator-login'}));
  state.pages['operator-login'].push(rectangle({id:'recover-link',link:'recovery-2'}));
  state.pages['recovery-2'].push(rectangle({id:'home-link',link:'home'}));
  const before=structuredClone(state),normalized=normalizeDesign(state);
  assert.deepEqual(normalized.hiddenPages,[{id:'operator-login',label:'Operator login'},{id:'recovery-2',label:'Recovery'}]);
  assert.deepEqual(normalized.pages,state.pages);assert.deepEqual(state,before);
  const storage=memory();saveDesign(storage,state);assert.deepEqual(readDesign(storage).state,normalized);
  const noHidden=withHiddenPages([]);assert.deepEqual(normalizeDesign(noHidden),noHidden);
  saveDesign(storage,noHidden);assert.deepEqual(readDesign(storage).state,noHidden);
  state.pages['recovery-2'][0].id=state.pages.home[0].id;assert.throws(()=>normalizeDesign(state),/Duplicate/);
});

test('hidden pages reject reserved, ambiguous, duplicate, and unsafe identifiers',()=>{
  for(const id of ['home','constructor','prototype','tostring','hasownproperty','__proto__','format','version','pages','hiddenpages','','Upper','has space','has_under','-start','end-','two--gaps','a'.repeat(65)]){
    assert.throws(()=>normalizeDesign(withHiddenPages([{id,label:'Test'}])),id||'empty identifier');
  }
  assert.throws(()=>normalizeDesign(withHiddenPages([{id:'login',label:'Login'},{id:'login',label:'Another login'}])),/Duplicate/);
  const boundary=withHiddenPages([{id:'a'.repeat(64),label:'a'.repeat(40)}]);assert.deepEqual(normalizeDesign(boundary),boundary);
});

test('hidden pages require a complete page map, valid labels, and no more than 32 definitions',()=>{
  const edits=[
    state=>{delete state.hiddenPages;},state=>{state.hiddenPages=null;},state=>{delete state.hiddenPages[0];},
    state=>{delete state.hiddenPages[0].id;},state=>{delete state.hiddenPages[0].label;},state=>{state.hiddenPages[0].extra=true;},
    state=>{state.hiddenPages[0].label='';},state=>{state.hiddenPages[0].label='   ';},state=>{state.hiddenPages[0].label=1;},
    state=>{state.hiddenPages[0].label='a'.repeat(41);},state=>{state.hiddenPages[0].label='Bad\nlabel';},state=>{state.hiddenPages[0].label='Bad\u0085label';},
    state=>{delete state.pages['sign-in'];},state=>{state.pages.extra=[];},state=>{state.pages['sign-in']={};},
    state=>{state.pages.home.push(rectangle({link:'deleted-hidden-page'}));}
  ];
  for(const edit of edits){const state=createDefaultDesign();edit(state);assert.throws(()=>normalizeDesign(state));}
  const max=withHiddenPages(Array.from({length:32},(_,i)=>({id:`hidden-${i}`,label:`Hidden ${i}`})));
  assert.deepEqual(normalizeDesign(max),max);max.hiddenPages.push({id:'too-many',label:'Too many'});max.pages['too-many']=[];
  assert.throws(()=>normalizeDesign(max),/32/);
});

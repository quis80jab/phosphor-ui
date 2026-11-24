import test from 'node:test';
import assert from 'node:assert/strict';
import {SAAS_STORAGE_KEY,FLEET,INSPECTIONS,defaultSaasState,normalizeSaasState,loadSaasState,saveSaasState,filterFleet,filterInspections,updateInspection,getDashboardData} from '../dist/saas-state.js';
const memory = values => {const data=new Map(values);return {data,getItem:key=>data.get(key) ?? null,setItem:(key,value)=>data.set(key,value)};};

test('workspace preferences, chart notes and review changes round-trip independently of prior labs',()=>{
  const storage=memory([['phosphor-component-workbench-v1','original']]);
  const state=updateInspection({...defaultSaasState(),workspaceName:'Waterfront ops',range:'7d',site:'waterfront',componentNotes:{gauge:'Increase target contrast'}},'IN-0248',{status:'approved',note:'Validated edge finding.'});
  assert.equal(saveSaasState(state,storage).error,undefined);
  assert.deepEqual(loadSaasState(storage).state,state);
  assert.equal(storage.data.get('phosphor-component-workbench-v1'),'original');
  assert.equal(storage.data.size,2);
});
test('normalization limits unsafe values, rejects unknown IDs, and does not share defaults',()=>{
  const state=normalizeSaasState({page:'missing',range:'forever',site:'other',workspaceName:'\n   ',brightness:Infinity,contrast:999,glow:-2,grid:NaN,notifications:'yes',chartColor:'red',chartPattern:'unknown',componentNotes:{line:'x'.repeat(5000),unknown:'no'},inspectionOverrides:{'IN-0248':{status:'flying',note:'a'.repeat(4500),token:'x'},unknown:{status:'approved'}}});
  assert.equal(state.page,'overview');assert.equal(state.range,'30d');assert.equal(state.site,'all');
  assert.equal(state.workspaceName,'Phosphor field ops');assert.equal(state.brightness,100);assert.equal(state.contrast,220);assert.equal(state.glow,0);assert.equal(state.grid,50);
  assert.deepEqual(Object.keys(state.componentNotes),['line']);assert.equal(state.componentNotes.line.length,4000);
  assert.deepEqual(Object.keys(state.inspectionOverrides),['IN-0248']);assert.deepEqual(Object.keys(state.inspectionOverrides['IN-0248']),['note']);assert.equal(state.inspectionOverrides['IN-0248'].note.length,4000);
  const first=defaultSaasState();first.componentNotes.line='changed';assert.deepEqual(defaultSaasState().componentNotes,{});
});
test('corrupt and blocked storage return an explicit error without replacing the stored source',()=>{
  const storage=memory([[SAAS_STORAGE_KEY,'{broken']]);
  assert.ok(loadSaasState(storage).error);assert.equal(storage.data.get(SAAS_STORAGE_KEY),'{broken');
  const broken={getItem(){throw new Error('denied');},setItem(){throw new Error('quota');}};
  assert.ok(loadSaasState(broken).error);assert.ok(saveSaasState(defaultSaasState(),broken).error);
  assert.equal(loadSaasState(memory()).state.page,'overview');
  for(const raw of ['[]','null','{"version":999}', 'a'.repeat(131073)]) assert.ok(loadSaasState(memory([[SAAS_STORAGE_KEY,raw]])).error);
});
test('search and filters combine without mutating fixtures',()=>{
  assert.equal(FLEET.length,8);assert.equal(INSPECTIONS.length,10);
  assert.equal(filterFleet({site:'waterfront',status:'active'}).length,2);
  assert.equal(filterFleet({query:'thermal kestrel'}).at(0).id,'PH-01');
  assert.equal(filterFleet({query:'does not exist'}).length,0);
  const rows=filterFleet();rows[0].battery=-1;assert.equal(FLEET[0].battery,86);
  const state=updateInspection(defaultSaasState(),'IN-0248',{status:'approved',note:'Verified rust'});
  assert.equal(filterInspections(state,{status:'approved',query:'verified rust'}).at(0).id,'IN-0248');
  assert.equal(filterInspections(state,{status:'review',site:'waterfront'}).length,1);
  assert.equal(INSPECTIONS[0].status,'review');
});
test('review changes preserve state and reject impossible record updates',()=>{
  const state=defaultSaasState(), next=updateInspection(state,'IN-0248',{status:'approved'});
  assert.deepEqual(state.inspectionOverrides,{});assert.equal(next.inspectionOverrides['IN-0248'].status,'approved');
  assert.throws(()=>updateInspection(state,'not-a-record',{status:'approved'}));
  assert.throws(()=>updateInspection(state,'IN-0248',{status:'complete'}));
  assert.throws(()=>updateInspection(state,'IN-0248',{note:7}));
  assert.throws(()=>updateInspection(state,'IN-0248',{findings:0}));
});
test('dashboard site splits reconcile, ranges recalculate, and queue follows reviews',()=>{
  for(const range of ['7d','30d','90d']) {
    const all=getDashboardData({range}), waterfront=getDashboardData({range,site:'waterfront'}), shipyard=getDashboardData({range,site:'shipyard'});
    assert.equal(all.demo,true);assert.equal(all.metrics.inspections,waterfront.metrics.inspections+shipyard.metrics.inspections);
    assert.equal(all.metrics.findings,waterfront.metrics.findings+shipyard.metrics.findings);
    assert.equal(all.metrics.totalDrones,waterfront.metrics.totalDrones+shipyard.metrics.totalDrones);
    assert.equal(all.metrics.inspections,all.volume.reduce((sum,item)=>sum+item.value,0));
    assert.equal(all.metrics.totalDrones,all.fleetStatus.reduce((sum,item)=>sum+item.value,0));
    assert.ok(all.coverageTrend.every(item=>item.value>=0 && item.value<=100));
  }
  assert.ok(getDashboardData({range:'90d'}).metrics.inspections > getDashboardData({range:'30d'}).metrics.inspections);
  const before=getDashboardData({}),after=getDashboardData({state:updateInspection(defaultSaasState(),'IN-0248',{status:'approved'})});
  assert.equal(before.metrics.reviewQueue-after.metrics.reviewQueue,1);
});

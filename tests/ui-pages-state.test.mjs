import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPONENTS, normalizePagesState, loadPagesState, savePagesState } from '../dist/ui-pages-state.js';

test('component notes survive page and selection changes without touching existing workbench storage',()=>{
  const data=new Map([['phosphor-component-workbench-v1','existing-user-settings']]);
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const state=loadPagesState(storage);state.notes.workflow='Use a clearer current-stage indicator';state.notes.forecast='Increase threshold contrast';state.selected='forecast';state.page='parts';
  assert.equal(savePagesState(state,storage),true);
  const loaded=loadPagesState(storage);assert.deepEqual(loaded.notes,state.notes);assert.equal(loaded.selected,'forecast');assert.equal(loaded.page,'parts');
  assert.equal(data.get('phosphor-component-workbench-v1'),'existing-user-settings');
});
test('invalid saved values cannot break navigation or shader settings',()=>{
  const state=normalizePagesState({page:'missing',selected:'missing',mark:'wrong',guides:'yes',optics:{brightness:Infinity,contrast:999,grid:-5},notes:{workflow:'x'.repeat(4500),unknown:'ignore'}});
  assert.equal(state.page,'catalog');assert.equal(state.selected,'workflow');assert.equal(state.mark,'dots');assert.equal(state.guides,false);assert.deepEqual(state.optics,{contrast:220,grid:0});assert.equal(state.notes.workflow.length,4000);assert.equal(state.notes.unknown,undefined);
});
test('blocked browser storage reports save failure and corrupt storage loads a usable default',()=>{
  assert.equal(savePagesState({}, {setItem(){throw new Error('quota');}}),false);
  assert.equal(loadPagesState({getItem:()=>'{broken'}).page,'catalog');
  assert.equal(new Set(COMPONENTS.map(c=>c.id)).size,23);
});

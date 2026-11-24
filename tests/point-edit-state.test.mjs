import test from 'node:test';
import assert from 'node:assert/strict';
import { createPointEditModel, normalizeIndexRanges, normalizePointEditSnapshot } from '../dist/point-edit-state.js';

test('inclusive ranges normalize without coercion, index expansion or aliased inputs', () => {
  const input=[[8,20],[3,4],[-3,1],[1,3],[10,11],[7,6],['2',3],[NaN,8],[2.1,5],[30,40]];
  const result=normalizeIndexRanges(input,12);
  assert.deepEqual(result,[[0,4],[8,11]]);
  input[1][0]=99; assert.equal(result[0][0],0);
  assert.deepEqual(normalizeIndexRanges([[0,0]],0),[]);
  for(const count of [-1,2.5,2000001])assert.throws(()=>createPointEditModel(count),/Point count/);
});

test('group normalization preserves empty groups with safe unique IDs and bounded names', () => {
  const snapshot=normalizePointEditSnapshot({deleted:[[0,99]],groups:[
    {id:'safe',name:' 🛰'.repeat(40),indices:[[3,8]]},
    {id:'safe',name:'Duplicate',indices:[]},
    {id:'__proto__',name:'',indices:[[99,100]]},
    ...Array.from({length:40},(_,i)=>({id:`g${i}`,name:`Group ${i}`,indices:[]}))
  ]},5);
  assert.deepEqual(snapshot.deleted,[[0,4]]);
  assert.equal(snapshot.groups.length,32);
  assert.equal(new Set(snapshot.groups.map(group=>group.id)).size,32);
  assert.equal(Array.from(snapshot.groups[0].name).length,32);
  assert.deepEqual(snapshot.groups[0].indices,[[3,4]]);
  assert.deepEqual(snapshot.groups[2].indices,[]);
  assert.ok(snapshot.groups.every(group=>group.id!=='__proto__'));
  assert.deepEqual(normalizePointEditSnapshot(Object.create({deleted:[[0,9]],groups:[{}]}),10),{deleted:[],groups:[]});
});

test('selection uses stable original indices and skips deleted or invalid IDs', () => {
  const model=createPointEditModel(8,{deleted:[[2,3]]});
  const mask=model.getSelectionMask(),deleted=model.getDeletedMask();
  assert.equal(model.applySelection([0,2,4,4,-1,8,'6']),true);
  assert.deepEqual([...model.getSelectedIds()],[0,4]);
  assert.equal(model.applySelection([0,4]),false);
  model.applySelection([6,7],'add');model.applySelection([4],'subtract');
  model.applySelection([6,6,1],'toggle');
  assert.deepEqual([...model.getSelectedIds()],[0,1,7]);
  assert.equal(model.getSelectionMask(),mask);assert.equal(model.getDeletedMask(),deleted);
  assert.equal(model.getSummary().revision,0);assert.equal(model.getSummary().undoCount,0);
  assert.equal(model.selectAllVisible(),true);
  assert.deepEqual([...model.getSelectedIds()],[0,1,4,5,6,7]);
  assert.equal(model.selectAllVisible(),false);
  assert.equal(model.clearSelection(),true);assert.equal(model.clearSelection(),false);
  assert.throws(()=>model.applySelection([],'unknown'),/selection/);
});

test('delete, groups and undo retain original membership without persisting live selection', () => {
  const model=createPointEditModel(10);
  model.applySelection([1,2,4]);const id=model.createGroup('Door');
  assert.equal(model.deleteSelected(),3);
  assert.deepEqual(model.getSnapshot(),{deleted:[[1,2],[4,4]],groups:[{id,name:'Door',indices:[[1,2],[4,4]]}]});
  assert.equal(model.selectGroup(id),false);
  assert.deepEqual(model.getSummary().groups,[{id,name:'Door',count:3,visibleCount:0}]);
  assert.equal(model.undo(),true);
  assert.deepEqual([...model.getSelectedIds()],[1,2,4]);
  assert.equal(model.getSummary().deleted,0);
  assert.equal(model.getSummary().groups[0].visibleCount,3);
  const saved=model.getSnapshot();saved.groups[0].indices[0][0]=9;
  assert.equal(model.getSnapshot().groups[0].indices[0][0],1);
  assert.equal(model.renameGroup(id,'Cabin'),true);
  assert.equal(model.removeGroup(id),true);
  assert.equal(model.undo(),true);assert.equal(model.getSummary().groups[0].name,'Cabin');
  assert.equal(model.undo(),true);assert.equal(model.getSummary().groups[0].name,'Door');
  const restored=createPointEditModel(10,model.getSnapshot());
  assert.equal(restored.getSummary().selected,0);assert.equal(restored.getSummary().canUndo,false);
});

test('reset and undo restore edits while removing selections that become deleted again', () => {
  const model=createPointEditModel(8,{deleted:[[1,3]],groups:[{id:'empty',name:'Empty',indices:[]}]});
  assert.equal(model.resetEdits(),true);model.selectAllVisible();
  assert.equal(model.undo(),true);
  assert.deepEqual([...model.getSelectedIds()],[0,4,5,6,7]);
  assert.equal(model.getSummary().deleted,3);assert.equal(model.getSummary().selected,5);
  assert.deepEqual(model.getSummary().groups,[{id:'empty',name:'Empty',count:0,visibleCount:0}]);
  assert.equal(model.undo(),false);
});

test('persisted deletions can be restored after reload without removing groups or selection', () => {
  const snapshot={deleted:[[1,3],[6,6]],groups:[{id:'saved',name:'Saved group',indices:[[1,4]]}]};
  const model=createPointEditModel(8,snapshot);
  model.applySelection([0,4]);
  assert.equal(model.getSummary().canUndo,false);
  assert.equal(model.restoreDeleted(),4);
  assert.deepEqual(model.getSnapshot(),{deleted:[],groups:snapshot.groups});
  assert.deepEqual([...model.getSelectedIds()],[0,4]);
  assert.equal(model.getSummary().visible,8);
  assert.equal(model.getSummary().groups[0].visibleCount,4);
  assert.equal(model.getSummary().undoCount,1);
  assert.equal(model.restoreDeleted(),0);
  assert.equal(model.getSummary().undoCount,1,'restoring nothing must not create an undo entry');
  model.applySelection([2,6],'add');
  assert.equal(model.undo(),true);
  assert.deepEqual(model.getSnapshot(),snapshot);
  assert.deepEqual([...model.getSelectedIds()],[0,4]);
  assert.equal(model.getSummary().visible,4);
  assert.equal(model.getSummary().groups[0].visibleCount,1);
  assert.equal(model.getSummary().canUndo,false);
});

test('undo is capped at 32 actual edit mutations and groups at 32', () => {
  const model=createPointEditModel(5),id=model.createGroup('Empty');
  for(let i=0;i<40;i++)model.renameGroup(id,`Name ${i}`);
  assert.equal(model.renameGroup(id,'Name 39'),false);
  assert.equal(model.getSummary().undoCount,32);
  for(let i=0;i<32;i++)assert.equal(model.undo(),true);
  assert.equal(model.undo(),false);assert.equal(model.getSummary().groups[0].name,'Name 7');
  for(let i=1;i<32;i++)assert.ok(model.createGroup(`Group ${i}`));
  assert.equal(model.createGroup('Excess'),null);
});

test('two-million-point select-all remains compact and clips persisted ranges to the real asset', () => {
  const model=createPointEditModel(2000000);
  model.selectAllVisible();const id=model.createGroup('All');
  assert.equal(model.getSummary().selected,2000000);
  assert.equal(model.deleteSelected(),2000000);
  const snapshot=model.getSnapshot();
  assert.deepEqual(snapshot,{deleted:[[0,1999999]],groups:[{id,name:'All',indices:[[0,1999999]]}]});
  assert.ok(JSON.stringify(snapshot).length<160);
  assert.equal(model.getSummary().visible,0);
  assert.equal(model.undo(),true);assert.equal(model.getSummary().visible,2000000);
  const smaller=createPointEditModel(236452,snapshot);
  assert.deepEqual(smaller.getSnapshot().deleted,[[0,236451]]);
  assert.equal(smaller.getSummary().groups[0].count,236452);
});

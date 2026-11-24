import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLogisticsCommand } from '../dist/ui-logistics.js';

test('local command search resolves exact locations and explicit map commands',()=>{
  assert.deepEqual(resolveLogisticsCommand('  Find SUBIC BAY  '),{type:'focus',site:'subic'});
  assert.deepEqual(resolveLogisticsCommand('Port of Manila'),{type:'focus',site:'manila'});
  assert.deepEqual(resolveLogisticsCommand('show Busan'),{type:'focus',site:'busan'});
  assert.deepEqual(resolveLogisticsCommand('hide bases'),{type:'layer',layer:'base',enabled:false});
  assert.deepEqual(resolveLogisticsCommand('show 3d'),{type:'layer',layer:'3d',enabled:true});
  assert.deepEqual(resolveLogisticsCommand('zoom out'),{type:'zoom',delta:-1});
  assert.deepEqual(resolveLogisticsCommand('reset map'),{type:'reset'});
});

test('alert commands preserve deterministic demo-only meanings',()=>{
  assert.deepEqual(resolveLogisticsCommand('show urgent'),{type:'alerts',filter:'critical'});
  assert.deepEqual(resolveLogisticsCommand('all alerts'),{type:'alerts',filter:'all'});
  assert.deepEqual(resolveLogisticsCommand('restore all alerts'),{type:'restore'});
  assert.deepEqual(resolveLogisticsCommand(''),{type:'help'});
  assert.deepEqual(resolveLogisticsCommand('reroute the shipment automatically'),{type:'unknown',query:'reroute the shipment automatically'});
});

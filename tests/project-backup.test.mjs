import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {STORAGE_KEYS, STORAGE_KEYS_V1, STORAGE_KEYS_V2, TRANSIENT_EXCLUSIONS, MAX_BACKUP_BYTES, createProjectBackup, parseProjectBackup, restoreProjectBackup, defaultProjectSettings} from '../dist/project-backup.js';

const stamp = {origin:'https://example.test', createdAt:'2026-11-23T20:00:00.000Z'};
function memory(initial = {}) {
  const values = new Map(Object.entries(initial)), writes = [];
  return {values,writes,getItem:key=>values.get(key)??null,
    setItem(key,value){writes.push(['set',key,value]);values.set(key,String(value));},
    removeItem(key){writes.push(['remove',key]);values.delete(key);}};
}
const blank = () => createProjectBackup(memory(),stamp);

test('capture reads the exact allowlist, records missing keys and preserves raw strings',()=>{
  const raw=' {"notes":"日本語 🛰️\\n  spacing", "bad":true} ',recovery='{broken json';
  const source=memory({[STORAGE_KEYS[0]]:raw,[STORAGE_KEYS[9]]:recovery,'unrelated-secret':'do not capture'}),reads=[];
  const backup=createProjectBackup({getItem:key=>{reads.push(key);return source.getItem(key);}},stamp);
  assert.deepEqual(reads,STORAGE_KEYS);assert.equal(backup.entries[STORAGE_KEYS[0]],raw);assert.equal(backup.entries[STORAGE_KEYS[9]],recovery);
  assert.equal(backup.entries[STORAGE_KEYS[1]],null);assert.equal(Object.keys(backup.entries).length,14);
  assert.equal(JSON.stringify(backup).includes('unrelated-secret'),false);
  assert.deepEqual(parseProjectBackup(JSON.stringify(backup)),backup);
  assert.deepEqual(backup.transientExclusions,TRANSIENT_EXCLUSIONS);
});

test('capture fails on denied storage and invalid adapters rather than recording absence',()=>{
  let reads=0;assert.throws(()=>createProjectBackup({getItem(){if(++reads===3)throw new Error('denied');return null;}},stamp),/denied/);
  assert.equal(reads,3);assert.throws(()=>createProjectBackup({getItem:()=>undefined},stamp),/invalid value/);
  assert.throws(()=>createProjectBackup(null,stamp),/Readable storage/);
});

test('parse rejects unsupported format/version, missing or unknown fields and wrong raw types',()=>{
  for(const mutate of [
    x=>{x.format='other';},x=>{x.version=4;},x=>{delete x.entries[STORAGE_KEYS[0]];},
    x=>{x.entries['unrelated-secret']='x';},x=>{x.entries[STORAGE_KEYS[0]]={};},
    x=>{x.runtimeFlightInput={forward:1};},x=>{x.transientExclusions=[];},
    x=>{x.createdAt='2026-02-31T20:00:00.000Z';},x=>{x.origin='bad\norigin';}
  ]){const input=blank();mutate(input);assert.throws(()=>parseProjectBackup(input));}
  assert.throws(()=>parseProjectBackup('{broken'),/not valid JSON/);
  assert.throws(()=>parseProjectBackup([]));
  const original=blank(),parsed=parseProjectBackup(original);parsed.entries[STORAGE_KEYS[0]]='changed';
  assert.equal(original.entries[STORAGE_KEYS[0]],null,'returned data does not alias input');
});

test('size limit counts UTF-8 bytes for strings and object inputs',()=>{
  const input=blank();input.entries[STORAGE_KEYS[0]]='€'.repeat(Math.ceil(MAX_BACKUP_BYTES/3));
  const text=JSON.stringify(input);assert.ok(text.length<MAX_BACKUP_BYTES);
  assert.throws(()=>parseProjectBackup(text),/16 MiB/);assert.throws(()=>parseProjectBackup(input),/16 MiB/);
});

test('merge restores present values only, including corrupt originals and recovery records',()=>{
  const backup=blank();backup.entries[STORAGE_KEYS[0]]='{legacy';backup.entries[STORAGE_KEYS[9]]='  broken backup\n';
  const target=memory({[STORAGE_KEYS[1]]:'keep missing value','unrelated-secret':'untouched'});
  const result=restoreProjectBackup(backup,target);
  assert.deepEqual(result,{mode:'merge',written:2,removed:0,unchanged:12,keys:[STORAGE_KEYS[0],STORAGE_KEYS[9]]});
  assert.equal(target.getItem(STORAGE_KEYS[1]),'keep missing value');assert.equal(target.getItem(STORAGE_KEYS[9]),'  broken backup\n');
  assert.equal(target.getItem('unrelated-secret'),'untouched');assert.equal(target.getItem(STORAGE_KEYS[0]),'{legacy');
  target.writes.length=0;assert.equal(restoreProjectBackup(backup,target).written,0);assert.deepEqual(target.writes,[]);
});

test('replace removes only allowlisted null entries and leaves unrelated storage intact',()=>{
  const backup=blank();backup.entries[STORAGE_KEYS[0]]='saved';
  const target=memory(Object.fromEntries([...STORAGE_KEYS.map(key=>[key,'old']),['unrelated-secret','untouched']]));
  const result=restoreProjectBackup(backup,target,{mode:'replace'});
  assert.equal(result.written,1);assert.equal(result.removed,13);assert.equal(target.values.size,2);
  assert.equal(target.getItem(STORAGE_KEYS[0]),'saved');assert.equal(target.getItem('unrelated-secret'),'untouched');
});

test('all validation and destination reads finish before any writes',()=>{
  const invalid=blank();invalid.entries['unknown']='bad';const target=memory();
  assert.throws(()=>restoreProjectBackup(invalid,target));assert.deepEqual(target.writes,[]);
  assert.throws(()=>restoreProjectBackup(blank(),target,{mode:'erase-everything'}));assert.deepEqual(target.writes,[]);
  const backup=blank();backup.entries[STORAGE_KEYS[0]]='a';backup.entries[STORAGE_KEYS[1]]='b';
  const get=target.getItem;target.getItem=key=>{if(key===STORAGE_KEYS[1])throw new Error('blocked read');return get(key);};
  assert.throws(()=>restoreProjectBackup(backup,target),/blocked read/);assert.deepEqual(target.writes,[]);
});

test('failed restore rolls back earlier changes and a failing adapter that mutates before throwing',()=>{
  const backup=blank();backup.entries[STORAGE_KEYS[0]]='next';backup.entries[STORAGE_KEYS[1]]='next';
  const target=memory({[STORAGE_KEYS[0]]:'old','unrelated-secret':'untouched'}),before=new Map(target.values),set=target.setItem;
  let failed=false;target.setItem=(key,value)=>{set(key,value);if(key===STORAGE_KEYS[1]&&!failed){failed=true;throw new Error('quota');}};
  assert.throws(()=>restoreProjectBackup(backup,target),error=>error.name==='ProjectBackupRestoreError'&&error.rollbackComplete===true&&error.code==='restore_failed');
  assert.deepEqual(target.values,before);
});

test('rollback failure is reported with exact affected keys instead of claiming atomic success',()=>{
  const backup=blank();backup.entries[STORAGE_KEYS[0]]='next';backup.entries[STORAGE_KEYS[1]]='next';
  const target=memory({[STORAGE_KEYS[0]]:'old'}),set=target.setItem;
  target.setItem=(key,value)=>{if(key===STORAGE_KEYS[1]||value==='old')throw new Error('blocked');set(key,value);};
  assert.throws(()=>restoreProjectBackup(backup,target),error=>error.rollbackComplete===false&&error.rollbackFailures.length===1&&error.rollbackFailures[0]===STORAGE_KEYS[0]);
});

test('factory settings are independent, include effective optics and match private demo factories',async()=>{
  const defaults=defaultProjectSettings(),other=defaultProjectSettings();
  assert.equal(defaults.saas.workspaceName,'Phosphor field ops');
  assert.equal(defaults.designer.version,2);
  assert.deepEqual(Object.keys(defaults.designer.pages),['home','site','cases','assets','system','calendar','analyze','sign-in','sign-up','reset-password']);
  assert.deepEqual(defaults.designer.hiddenPages.map(page=>page.id),['sign-in','sign-up','reset-password']);
  defaults.designer.hiddenPages[0].label='Edited sign in';assert.notEqual(other.designer.hiddenPages[0].label,'Edited sign in');
  defaults.designer.pages.home.push({id:'draft'});assert.deepEqual(other.designer.pages.home,[]);
  defaults.designer.pages['sign-in'].push({id:'hidden-draft'});assert.deepEqual(other.designer.pages['sign-in'],[]);
  defaults.saas.componentNotes.line='edit';assert.deepEqual(other.saas.componentNotes,{});
  assert.equal(defaults.display.shape,'square');assert.equal(defaults.viewer.hologram.pathGain,.18);
  assert.equal(Object.keys(defaults.workbench.widgets).length,12);assert.deepEqual(defaults.pages.optics,defaults.workbench.optics);
  defaults.workbench.optics.glow=99;defaults.pages.notes.workflow='edit';defaults.readiness.case.history.push('new');
  assert.equal(other.workbench.optics.glow,25);assert.deepEqual(other.pages.notes,{});assert.equal(other.readiness.case.history.length,1);
  const readiness=await readFile(new URL('../dist/ui-readiness.js',import.meta.url),'utf8');
  const factory=readiness.slice(readiness.indexOf('function defaultState()'),readiness.indexOf('function readState()'));
  const expected=vm.runInNewContext(`${factory};JSON.stringify(defaultState())`,{PARTS:[{nsn:'2840-01-345-6789'}]});
  assert.deepEqual(other.readiness,JSON.parse(expected));
  const logistics=await readFile(new URL('../dist/ui-logistics.js',import.meta.url),'utf8');
  const reader=logistics.slice(logistics.indexOf('function readState('),logistics.indexOf('/** Three-column logistics'));
  assert.deepEqual(other.logistics,JSON.parse(vm.runInNewContext(`${reader};JSON.stringify(readState(false))`)));
});

test('published JSON schema covers the same strict key and exclusion contracts',async()=>{
  const schema=JSON.parse(await readFile(new URL('../dist/project-backup.schema.json',import.meta.url),'utf8'));
  assert.equal(schema.additionalProperties,false);
  assert.deepEqual(schema.properties.version.enum,[1,2,3]);
  assert.deepEqual(schema.oneOf.map(branch=>branch.properties.version.const),[1,2,3]);
  assert.equal(schema.$defs.entriesV1.additionalProperties,false);assert.equal(schema.$defs.entriesV2.additionalProperties,false);assert.equal(schema.$defs.entriesV3.additionalProperties,false);
  assert.deepEqual(schema.$defs.entriesV1.required,STORAGE_KEYS_V1);assert.deepEqual(schema.$defs.entriesV2.required,STORAGE_KEYS_V2);assert.deepEqual(schema.$defs.entriesV3.required,STORAGE_KEYS);
  assert.deepEqual(schema.properties.transientExclusions.prefixItems.map(entry=>entry.const),TRANSIENT_EXCLUSIONS);
});


test('version 3 captures and restores the exact SaaS workspace and designer raw strings',()=>{
  const raw='  {"version":1,"workspaceName":"Team 2","componentNotes":{"line":"check spacing"}}  ';
  const key='phosphor-saas-workspace-v1';
  const designerKey='phosphor-flow-designer-v1',designerRaw='  {"format":"phosphor-flow-designer","version":1,"pages":{"home":[{"label":"start"}]}}  ';
  const backup=createProjectBackup(memory({[key]:raw,[designerKey]:designerRaw}),stamp);
  assert.equal(backup.version,3);assert.equal(backup.entries[designerKey],designerRaw);assert.equal(backup.entries[key],raw);
  assert.equal(STORAGE_KEYS.length,14);assert.equal(STORAGE_KEYS_V2.length,13);assert.equal(STORAGE_KEYS_V1.length,12);
  const target=memory();restoreProjectBackup(JSON.stringify(backup),target);
  assert.equal(target.getItem(key),raw);assert.equal(target.getItem(designerKey),designerRaw);
});

test('legacy version 1 envelopes retain all raw strings and never overwrite newer SaaS state',()=>{
  const legacy={...blank(),version:1,entries:Object.fromEntries(STORAGE_KEYS_V1.map(key=>[key,null]))};
  legacy.entries[STORAGE_KEYS_V1[0]]='  {legacy raw whitespace}  ';
  const parsed=parseProjectBackup(JSON.stringify(legacy));
  assert.equal(parsed.version,1);assert.deepEqual(parsed.entries,legacy.entries);
  const saas='{"version":1,"workspaceName":"Do not change"}';
  for(const mode of ['merge','replace']) {
    const target=memory({[STORAGE_KEYS_V1[0]]:'old',[STORAGE_KEYS_V1[1]]:'remove only in replace','phosphor-saas-workspace-v1':saas});
    const result=restoreProjectBackup(parsed,target,{mode});
    assert.equal(target.getItem('phosphor-saas-workspace-v1'),saas);
    assert.equal(target.getItem(STORAGE_KEYS_V1[0]),legacy.entries[STORAGE_KEYS_V1[0]]);
    assert.equal(target.writes.some(write=>write[1]==='phosphor-saas-workspace-v1'),false);
    assert.equal(result.written+result.removed+result.unchanged,12);
    assert.equal(target.getItem(STORAGE_KEYS_V1[1]),mode==='merge'?'remove only in replace':null);
  }
  const forgedLegacy=structuredClone(legacy);forgedLegacy.entries['phosphor-saas-workspace-v1']='bad';
  assert.throws(()=>parseProjectBackup(forgedLegacy));
  const incompleteV2=structuredClone(legacy);incompleteV2.version=2;
  assert.throws(()=>parseProjectBackup(incompleteV2));
});


test('legacy v1 and v2 restores cannot erase or overwrite newer designer state',()=>{
  const designerKey='phosphor-flow-designer-v1',designerRaw='{"pages":{"home":[{"label":"keep design"}]}}';
  for(const version of [1,2])for(const mode of ['merge','replace']){
    const keys=version===1?STORAGE_KEYS_V1:STORAGE_KEYS_V2;
    const legacy={...blank(),version,entries:Object.fromEntries(keys.map(key=>[key,null]))};
    legacy.entries[STORAGE_KEYS_V1[0]]='  exact legacy raw string  ';
    if(version===2)legacy.entries['phosphor-saas-workspace-v1']='  {"workspaceName":"legacy SaaS"}  ';
    const parsed=parseProjectBackup(JSON.stringify(legacy));assert.equal(parsed.version,version);assert.deepEqual(parsed.entries,legacy.entries);
    const target=memory({[designerKey]:designerRaw,'phosphor-saas-workspace-v1':'keep in v1'});
    restoreProjectBackup(parsed,target,{mode});
    assert.equal(target.getItem(designerKey),designerRaw);assert.equal(target.writes.some(write=>write[1]===designerKey),false);
    assert.equal(target.getItem(STORAGE_KEYS_V1[0]),legacy.entries[STORAGE_KEYS_V1[0]]);
    assert.equal(target.getItem('phosphor-saas-workspace-v1'),version===1?'keep in v1':legacy.entries['phosphor-saas-workspace-v1']);
    const forged={...legacy,entries:{...legacy.entries,[designerKey]:null}};assert.throws(()=>parseProjectBackup(forged));
  }
  const incomplete=blank();delete incomplete.entries[designerKey];assert.throws(()=>parseProjectBackup(incomplete));
});

import {createProjectBackup,parseProjectBackup,restoreProjectBackup} from './project-backup.js?v=designer-2';
import {mountUIPagesSkin} from './ui-pages-skin.js?v=handoff-1';
const $=selector=>document.querySelector(selector);
const names={'phosphor-saas-workspace-v1':'SAAS WORKSPACE','phosphor-screen-settings-v1':'OPTICAL LOOK','phosphor-config-library-v1':'NAMED LOOKS','phosphor-transport-screen-intro-v1':'INTRO STATE','phosphor-component-workbench-v1':'COMPONENT WORKBENCH','phosphor-inspection-viewer-v1':'3D VIEWER','phosphor-viewer-grid-guides':'GRID GUIDES','phosphor-ui-pages-v1':'UI PAGES / NOTES','phosphor-ui-readiness-v1':'READINESS WORKFLOW','phosphor-ui-logistics-v1':'LOGISTICS MAP','phosphor-config-library-v1-recovery':'LOOK RECOVERY','phosphor-component-workbench-v1-recovery':'WORKBENCH RECOVERY','phosphor-inspection-viewer-v1-recovery':'VIEWER RECOVERY'};
let snapshot=null,pending=null,skin=null;
function refresh(){skin?.refresh();}
function report(message){$('#backup-status').textContent=message;refresh();}
function capture(){
  try{
    snapshot=createProjectBackup(localStorage,{origin:location.origin,createdAt:new Date().toISOString()});
    $('#snapshot-json').value=JSON.stringify(snapshot,null,2);
    $('#backup-origin').textContent=`SOURCE / ${snapshot.origin}`;
    const list=$('#backup-entries');list.replaceChildren();
    let present=0;
    Object.entries(snapshot.entries).forEach(([key,value])=>{
      const row=document.createElement('div');row.className='handoff-entry';
      const label=document.createElement('span'),status=document.createElement('span');
      label.dataset.vfd='label';status.dataset.vfd='label';status.dataset.vfdAlign='right';label.textContent=names[key]||key;
      status.textContent=value===null?'ABSENT':`${new TextEncoder().encode(value).byteLength} B`;if(value!==null)present++;
      row.append(label,status);list.append(row);
    });
    $('#download-backup').disabled=false;report(`${present} SAVED ENTRIES CAPTURED. READY TO DOWNLOAD.`);
  }catch(error){snapshot=null;$('#snapshot-json').value='';$('#download-backup').disabled=true;report(error.message);}
}
$('#refresh-backup').addEventListener('click',capture);
$('#download-backup').addEventListener('click',()=>{
  capture();if(!snapshot)return;
  const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='phosphor-all-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);report('ALL SETTINGS EXPORTED. KEEP THIS FILE WITH THE UI HANDOFF.');
});
$('#choose-backup').addEventListener('click',()=>$('#backup-file').click());
$('#backup-file').addEventListener('change',async event=>{
  pending=null;$('#restore-backup').disabled=true;
  const file=event.target.files?.[0];if(!file)return;
  try{pending=parseProjectBackup(await file.text());$('#restore-status').textContent=`READY / ${Object.values(pending.entries).filter(v=>v!==null).length} SAVED ENTRIES FROM ${pending.origin}. RESTORE MERGES THESE ENTRIES, THEN RELOAD YOUR LAB TABS.`;$('#restore-backup').disabled=false;}
  catch(error){$('#restore-status').textContent=error.message;}
  event.target.value='';refresh();
});
$('#restore-backup').addEventListener('click',()=>{
  if(!pending)return;
  try{restoreProjectBackup(pending,localStorage,{mode:'merge'});pending=null;$('#restore-backup').disabled=true;$('#restore-status').textContent='RESTORED. RELOAD THE LAB TABS TO USE THESE SETTINGS.';capture();}
  catch(error){$('#restore-status').textContent=error.message;}
  refresh();
});
window.addEventListener('storage',capture);
capture();
try{skin=mountUIPagesSkin({getState:()=>({mark:'dots',guides:false})});}catch(error){console.warn('Handoff uses native controls:',error.message);}

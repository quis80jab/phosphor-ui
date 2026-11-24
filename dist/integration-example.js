import {mountPhosphorKit} from './phosphor-kit.js';

const state={enabled:true,level:62,query:'',actions:0};
const output=document.getElementById('host-state');
const kit=mountPhosphorKit({
  container:document.getElementById('kit-mount'),columns:48,
  controls:[
    {id:'title',type:'label',value:'SENSOR CONSOLE / DEMO',layout:{column:1,row:1,columns:46,rows:2}},
    {id:'enabled',type:'toggle',label:'OUTPUT ON',value:true,layout:{column:1,row:4,columns:15,rows:3}},
    {id:'capture',type:'button',label:'CAPTURE',layout:{column:17,row:4,columns:14,rows:3}},
    {id:'readout',type:'label',value:'LEVEL 62%',layout:{column:33,row:4,columns:14,rows:3}},
    {id:'level',type:'slider',label:'Signal level',min:0,max:100,step:1,value:62,layout:{column:1,row:8,columns:46,rows:3}},
    {id:'query',type:'search',label:'Search sensor channels',placeholder:'SEARCH CHANNELS',layout:{column:1,row:12,columns:46,rows:3}},
    {id:'result',type:'label',value:'COLOR / THERMAL / DEPTH',layout:{column:1,row:16,columns:46,rows:2}}
  ],
  onChange({id,value}){
    if(id==='enabled'){state.enabled=value;kit.update('enabled',{label:value?'OUTPUT ON':'OUTPUT OFF'});kit.update('capture',{disabled:!value});}
    if(id==='level'){state.level=value;kit.update('readout',{value:`LEVEL ${value}%`});}
    if(id==='capture')state.actions=value;
    if(id==='query'){state.query=value;const matches=['COLOR','THERMAL','DEPTH'].filter(item=>item.includes(value.toUpperCase()));kit.update('result',{value:matches.join(' / ')||'NO CHANNELS'});}
    output.textContent=JSON.stringify(state,null,2);
  }
});
output.textContent=JSON.stringify(state,null,2);
window.addEventListener('pagehide',event=>{if(!event.persisted)kit.destroy();});

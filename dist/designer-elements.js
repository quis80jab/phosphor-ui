// Label-driven previews made with the actual sandbox element painters. No renderer,
// network calls or persistent data: the designer owns the single VFD compositor.
import {UI_PIXELS} from './viewer-grid.js';
import {byId,paintElement} from './sandbox-ui/src/ladder.js';
import {text,fill,outline,hline,line,wrap,clamp} from './sandbox-ui/src/paint/primitives.js';
import {footprintMark,viewTransform} from './sandbox-ui/src/paint/map.js';
import {MINT,DIM,PANEL,AMBER} from './sandbox-ui/src/palette.js';
import {paintSystemTopology,activateSystemTopology,getSystemTopologyState} from './designer-topology.js';

const demo={asset:0,mode:0,pending:0,recent:0,note:0,module:0,control:false,paused:false,event:0,metric:0,heading:42};
const MODES=['OVERVIEW','INSPECT','COMPARE'];
const ASSETS=[
  {name:'HANGAR A',kind:'STRUCTURE',x:-50,y:35,w:45,h:28,health:'INSPECTION DUE',coverage:.81},
  {name:'TANK 02',kind:'STORAGE',x:38,y:28,w:22,h:22,health:'REVIEW READY',coverage:.94},
  {name:'APRON B',kind:'SITE',x:-18,y:-28,w:70,h:25,health:'SCAN QUEUED',coverage:.67},
  {name:'WORKSHOP',kind:'STRUCTURE',x:62,y:-35,w:26,h:30,health:'UP TO DATE',coverage:.98}
];
const EVENTS=[['09:00','SITE INSPECTION','HANGAR A'],['11:30','REVIEW SCAN','TANK 02'],['14:00','DEVICE CHECK','SIM-DRONE-01']];
const METRICS=[['COVERAGE',.86,'86.0','%'],['DEFECT RATE',.12,'1.2','%'],['CONFIDENCE',.94,'94.0','%']];
const names=new Set(['site map: assets highlighted','data panel','asset details','details','telemetry','coordinates','compass','mode','pending','recent','notes','device details','device info','location','installed modules','sensor types','device management','event details','analysis details','topology','system topology']);
const nameOf=rect=>String(rect.label||'').trim().toLowerCase().replace(/\s+/g,' ');
const boxOf=rect=>({x:rect.x*UI_PIXELS,y:rect.y*UI_PIXELS,width:rect.width*UI_PIXELS,height:rect.height*UI_PIXELS});
const contains=(outer,inner)=>inner.id!==outer.id&&inner.width*inner.height<outer.width*outer.height&&inner.x>=outer.x&&inner.y>=outer.y&&inner.x+inner.width<=outer.x+outer.width&&inner.y+inner.height<=outer.y+outer.height;
const part=(b,x,y,w,h)=>({x:Math.round(b.x+x),y:Math.round(b.y+y),width:Math.max(0,Math.round(w)),height:Math.max(0,Math.round(h))});
const el=(ctx,id,b,s={})=>{if(b.width>=8&&b.height>=7)paintElement(ctx,byId[id],b,s);};
const asset=()=>ASSETS[demo.asset];
function words(ctx,value,b,color=DIM){wrap(String(value).toUpperCase(),Math.max(1,b.width)).slice(0,Math.floor(b.height/10)).forEach((row,i)=>text(ctx,row,b.x,b.y+i*10,color,{room:b.width}));}
function header(ctx,rect,b,{demoTag=false,compact=false}={}){
  fill(ctx,b.x,b.y,b.width,b.height,PANEL);outline(ctx,b.x,b.y,b.width,b.height,DIM);
  const height=compact?16:24,tag=demoTag&&b.width>=150;
  text(ctx,rect.label,b.x+8,b.y+5,MINT,{room:b.width-16-(tag?36:0)});
  if(tag)text(ctx,'DEMO',b.x+b.width-8,b.y+5,AMBER,{align:'right'});
  if(!compact)hline(ctx,b.x+8,b.y+18,b.width-16,DIM);
  return part(b,8,height,b.width-16,b.height-height-8);
}
function kv(ctx,b,key,value,row=0){el(ctx,'keyvalue',part(b,0,row*16,b.width,14),{key,value});}
function button(ctx,b,label,active=false){el(ctx,'button',b,{label,held:active});}
function rows(ctx,b,items,selected=-1,height=24){items.forEach((item,i)=>{if((i+1)*height<=b.height)el(ctx,'row',part(b,0,i*height,b.width,height-2),{title:item[0],detail:item[1]||'',selected:i===selected,level:i===selected?'ok':'off'});});}
function chart(ctx,b,values,color=MINT){
  if(b.width<24||b.height<20)return;
  for(let i=0;i<4;i++)hline(ctx,b.x,b.y+Math.floor(i*(b.height-1)/3),b.width,DIM,true);
  values.forEach((v,i)=>{if(!i)return;line(ctx,b.x+Math.round((i-1)*(b.width-1)/(values.length-1)),b.y+Math.round((1-values[i-1])*(b.height-1)),b.x+Math.round(i*(b.width-1)/(values.length-1)),b.y+Math.round((1-v)*(b.height-1)),color,{clip:b});});
}
function ring(a){return[{x:a.x-a.w/2,y:a.y-a.h/2},{x:a.x+a.w/2,y:a.y-a.h/2},{x:a.x+a.w/2,y:a.y+a.h/2},{x:a.x-a.w/2,y:a.y+a.h/2}];}
function mapState(){return{centre:{x:0,y:0},across_m:190,mode:'move',footprints:ASSETS.map((a,i)=>footprintMark(ring(a),{name:a.name,part:i===demo.asset})),target:{outline:ring(asset()),holes:[]},caption:`DEMO / ${MODES[demo.mode]} / SELECT AN ASSET`};}
function mapBox(b){return part(b,8,24,b.width-16,b.height-32);}
const selectedModules=()=>getSystemTopologyState().selected.modules.map((name,i)=>[name.toUpperCase(),i===0?'RUNNING':'READY']);

/** Saved rectangles are in UI cells. Each preview is repainted at its current size. */
export function hasDesignElement(rect,page){return rect.type!=='divider'&&names.has(nameOf(rect))&&(nameOf(rect)!=='details'||page==='site');}

/** Draw a named element. Nested designer boxes retain their own content and borders. */
export function paintDesignElement(ctx,rect,{page,allRects=[]}={}){
  if(!hasDesignElement(rect,page))return false;
  const b=boxOf(rect),name=nameOf(rect),system=getSystemTopologyState(),node=system.selected;
  ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.width,b.height);ctx.clip();
  // The parent's content never paints through the named boxes placed inside it.
  const children=allRects.filter(r=>contains(rect,r));
  const direct=children.filter(r=>!children.some(other=>other!==r&&contains(other,r)));
  if(direct.length){ctx.beginPath();ctx.rect(b.x,b.y,b.width,b.height);for(const child of direct){const c=boxOf(child);ctx.rect(c.x,c.y,c.width,c.height);}ctx.clip('evenodd');}
  if(b.width<64||b.height<16){fill(ctx,b.x,b.y,b.width,b.height,PANEL);outline(ctx,b.x,b.y,b.width,b.height,DIM);text(ctx,rect.label,b.x+3,b.y+3,MINT,{room:b.width-6});ctx.restore();return true;}
  const compact=['coordinates','compass','mode'].includes(name);
  let inner=compact?b:header(ctx,rect,b,{demoTag:['data panel','details','device details','event details','analysis details','site map: assets highlighted'].includes(name),compact:['asset details','telemetry'].includes(name)});
  switch(name){
    case 'topology':case 'system topology':paintSystemTopology(ctx,b);break;
    case 'site map: assets highlighted':
      el(ctx,'siteMap',mapBox(b),mapState());
      break;
    case 'data panel':
      text(ctx,'SAN FRANCISCO / WATERFRONT',inner.x,inner.y,MINT,{room:inner.width-180});
      text(ctx,'4 ASSETS / 2 TASKS',inner.x+inner.width,inner.y,DIM,{align:'right',room:170});
      break;
    case 'telemetry':{
      // A shallow strip leaves room for the user's three nested fields below it.
      const items=[['ALT','42.8 M'],['SPEED','1.2 M/S'],['BATTERY','89%'],['LINK','SIM']];
      const width=Math.floor(inner.width/items.length);
      items.forEach(([key,value],i)=>el(ctx,'keyvalue',part(inner,i*width,-2,width-16,14),{key,value}));
      break;
    }
    case 'coordinates':
      fill(ctx,b.x,b.y,b.width,b.height,PANEL);text(ctx,rect.label,b.x+3,b.y+2,DIM,{room:b.width-6});
      text(ctx,'37.795 / -122.393',b.x+3,b.y+13,MINT,{room:b.width-6});break;
    case 'compass':
      fill(ctx,b.x,b.y,b.width,b.height,PANEL);el(ctx,'heading',part(b,2,0,b.width-4,b.height),{value:demo.heading});break;
    case 'mode':
      el(ctx,'button',b,{label:`MODE: ${MODES[demo.mode]}`});break;
    case 'asset details':
      text(ctx,asset().name,inner.x,inner.y,MINT,{room:Math.min(78,inner.width)});
      text(ctx,asset().kind,inner.x,inner.y+12,DIM,{room:Math.min(78,inner.width)});break;
    case 'pending':
      el(ctx,'row',part(inner,0,0,inner.width,20),{title:demo.pending?'SCAN NEXT':'2 TASKS',selected:!!demo.pending,level:'warn'});
      text(ctx,demo.pending?'SITE B / 14:00':'CLICK TO REVIEW',inner.x,inner.y+24,DIM,{room:inner.width});break;
    case 'recent':
      el(ctx,'row',part(inner,0,0,inner.width,20),{title:demo.recent?'TANK 02':'HANGAR A',selected:true});
      text(ctx,demo.recent?'09:18 / REVIEW':'08:42 / COMPLETE',inner.x,inner.y+24,DIM,{room:inner.width});break;
    case 'notes':
      words(ctx,demo.note?'CHECK ROOF SEAM BEFORE NEXT SCAN.':'NO NEW NOTES. CLICK FOR DEMO NOTE.',inner,MINT);break;
    case 'details':{
      el(ctx,'badge',part(inner,0,0,inner.width,16),{text:asset().health,level:'warn'});
      kv(ctx,inner,'ASSET',asset().name,2);kv(ctx,inner,'TYPE',asset().kind,3);kv(ctx,inner,'SOURCE','DEMO GEOMETRY',4);
      el(ctx,'value',part(inner,0,88,inner.width,32),{caption:'COVERAGE',value:(asset().coverage*100).toFixed(0),unit:'%'});
      el(ctx,'progress',part(inner,0,128,inner.width,16),{value:asset().coverage});
      el(ctx,'label',part(inner,0,160,inner.width,16),{text:'INSPECTION ACTIVITY',variant:'caption'});
      rows(ctx,part(inner,0,184,inner.width,96),[['SCAN IMPORTED','08:42'],['REVIEW QUEUED','09:00'],['REPORT DRAFT','OPEN']],demo.pending,26);
      if(inner.height>340){button(ctx,part(inner,0,296,inner.width,24),'NEXT ASSET');words(ctx,'Choose a highlighted asset on the map to update these details.',part(inner,0,336,inner.width,56));}
      break;
    }
    case 'device details':
      text(ctx,node.name,inner.x,inner.y,MINT,{room:inner.width});break;
    case 'device info':
      kv(ctx,inner,'TYPE',node.type.toUpperCase());kv(ctx,inner,'MODEL',node.model.toUpperCase(),1);break;
    case 'location':
      if(node.id==='drone'||node.id==='rgb'||node.id==='thermal'){
        el(ctx,'position',part(inner,0,0,inner.width,36),{latitude:'37.795 N',longitude:'122.393 W',altitude:'42.8 M',fix:5,satellites:17});
        el(ctx,'heading',part(inner,0,52,inner.width,28),{value:demo.heading});
      }else{
        kv(ctx,inner,'LOCATION',node.location.toUpperCase());kv(ctx,inner,'SITE','DEMO WATERFRONT',1);
        el(ctx,'badge',part(inner,0,48,inner.width,18),{text:node.type==='admin'||node.type==='viewer'?'LOGICAL ROLE':'FIXED NODE',level:'off'});
      }
      if(inner.height>92)text(ctx,'DEMO LOCATION',inner.x,inner.y+88,DIM,{room:inner.width});break;
    case 'installed modules':{
      const modules=selectedModules();rows(ctx,part(inner,0,0,inner.width,150),modules,Math.min(demo.module,modules.length-1),28);
      const picked=modules[Math.min(demo.module,modules.length-1)];
      el(ctx,'badge',part(inner,0,156,inner.width,16),{text:`${picked[0]} / ${picked[1]}`,level:picked[1]==='INSTALLED'?'off':'ok'});
      words(ctx,'SELECT A MODULE TO INSPECT ITS STATE.',part(inner,0,184,inner.width,34));break;
    }
    case 'sensor types':
      if(node.sensors.length)rows(ctx,inner,node.sensors.map(sensor=>[sensor.toUpperCase(),'']),-1,18);
      else{el(ctx,'badge',part(inner,0,0,inner.width,18),{text:'NO DIRECT SENSORS',level:'off'});words(ctx,'Select a drone or sensor node to inspect attached sensors.',part(inner,0,28,inner.width,44));}break;
    case 'device management':
      el(ctx,'badge',part(inner,0,0,inner.width,18),{text:system.accessRole==='admin'?'ADMIN / CAN CONTROL':'VIEWER / READ ONLY',level:system.accessRole==='admin'?'ok':'off'});
      if(system.accessRole==='viewer'){
        el(ctx,'button',part(inner,0,32,inner.width,24),{label:'CONTROL NOT PERMITTED',disabled:true});
        words(ctx,'Observe and review only. Select Admin in the topology to try demo controls.',part(inner,0,72,inner.width,64),AMBER);
      }else if(node.type==='admin'||node.type==='viewer'){
        rows(ctx,part(inner,0,28,inner.width,70),[['OBSERVE','ALLOWED'],['CONFIGURE',node.type==='admin'?'ALLOWED':'DENIED'],['CONTROL',node.type==='admin'?'ALLOWED':'DENIED']],-1,20);
        words(ctx,'ROLE PERMISSIONS / DEMO',part(inner,0,108,inner.width,24),AMBER);
      }else{
        button(ctx,part(inner,0,32,inner.width,24),demo.control?'RELEASE DEMO CONTROL':'TAKE DEMO CONTROL',demo.control);
        button(ctx,part(inner,0,64,inner.width,24),demo.paused?'RESUME DEMO':'PAUSE DEMO',demo.paused);
        words(ctx,'DEMO ONLY. NO DEVICE COMMANDS ARE SENT.',part(inner,0,104,inner.width,40),AMBER);
      }break;
    case 'event details':{
      const event=EVENTS[demo.event];
      el(ctx,'badge',part(inner,0,0,inner.width,16),{text:'SAMPLE SCHEDULE',level:'off'});
      el(ctx,'label',part(inner,0,32,inner.width,20),{text:'TUESDAY / NOV 24'});
      rows(ctx,part(inner,0,64,inner.width,120),EVENTS.map(e=>[e[1],e[0]]),demo.event,32);
      hline(ctx,inner.x,inner.y+178,inner.width,DIM);
      words(ctx,event[1],part(inner,0,198,inner.width,30),MINT);
      kv(ctx,part(inner,0,238,inner.width,60),'START',event[0]);kv(ctx,part(inner,0,238,inner.width,60),'ASSET',event[2],1);kv(ctx,part(inner,0,238,inner.width,60),'STATUS','PLANNED',2);
      button(ctx,part(inner,0,310,inner.width,24),'NEXT EVENT');
      words(ctx,'Select a schedule row to inspect the event. All dates and events are example data.',part(inner,0,356,inner.width,64));break;
    }
    case 'analysis details':{
      const metric=METRICS[demo.metric];
      el(ctx,'segmented',part(inner,0,0,inner.width,24),{options:['COVERAGE','DEFECTS','QUALITY'],value:demo.metric});
      el(ctx,'value',part(inner,0,48,inner.width,32),{caption:metric[0],value:metric[2],unit:metric[3]});
      el(ctx,'progress',part(inner,0,92,inner.width,16),{value:metric[1]});
      text(ctx,'LAST 7 SCANS / DEMO',inner.x,inner.y+134,DIM,{room:inner.width});
      chart(ctx,part(inner,0,156,inner.width,104),demo.metric===1?[.8,.65,.72,.4,.52,.3,.12]:[.3,.44,.4,.64,.72,.68,metric[1]],demo.metric===1?AMBER:MINT);
      kv(ctx,part(inner,0,286,inner.width,64),'ASSET',asset().name);kv(ctx,part(inner,0,286,inner.width,64),'SCANS','7',1);kv(ctx,part(inner,0,286,inner.width,64),'SOURCE','SAMPLE DATA',2);
      button(ctx,part(inner,0,356,inner.width,24),'NEXT METRIC');
      words(ctx,'Select a metric to compare its sample trend. No live analysis has been run.',part(inner,0,404,inner.width,60));break;
    }
  }
  ctx.restore();return true;
}

/** Pointer coordinates are normalized within the saved box. Demo state is ephemeral. */
export function activateDesignElement(rect,point,{page}={}){
  if(!hasDesignElement(rect,page))return false;
  const name=nameOf(rect),b=boxOf(rect),px=clamp(Number(point.x)||0,0,1)*b.width,py=clamp(Number(point.y)||0,0,1)*b.height;
  switch(name){
    case 'topology':case 'system topology':return activateSystemTopology({x:b.x+px,y:b.y+py},b);
    case 'site map: assets highlighted':{
      const inner=mapBox({x:0,y:0,width:b.width,height:b.height}),to=viewTransform(inner,mapState()),world=to.toWorld(px,py);
      const hit=ASSETS.findIndex(a=>Math.abs(world.x-a.x)<=a.w/2&&Math.abs(world.y-a.y)<=a.h/2);
      if(hit<0)return false;demo.asset=hit;return true;
    }
    case 'mode':demo.mode=(demo.mode+1)%MODES.length;return true;
    case 'compass':demo.heading=(demo.heading+15)%360;return true;
    case 'pending':demo.pending=1-demo.pending;return true;
    case 'recent':demo.recent=1-demo.recent;demo.asset=demo.recent;return true;
    case 'notes':demo.note=1-demo.note;return true;
    case 'details':if(py>=320&&py<=344){demo.asset=(demo.asset+1)%ASSETS.length;return true;}return false;
    case 'installed modules':{const index=Math.floor((py-24)/28);if(index<0||index>=selectedModules().length)return false;demo.module=index;return true;}
    case 'device management':{const system=getSystemTopologyState();if(system.accessRole!=='admin'||['admin','viewer'].includes(system.selected.type))return false;if(py>=56&&py<=80){demo.control=!demo.control;return true;}if(py>=88&&py<=112){demo.paused=!demo.paused;return true;}return false;}
    case 'event details':{const index=Math.floor((py-88)/32);if(index>=0&&index<EVENTS.length){demo.event=index;return true;}if(py>=334&&py<=358){demo.event=(demo.event+1)%EVENTS.length;return true;}return false;}
    case 'analysis details':if(py>=24&&py<=48){demo.metric=clamp(Math.floor((px-8)/((b.width-16)/3)),0,2);return true;}if(py>=380&&py<=404){demo.metric=(demo.metric+1)%METRICS.length;return true;}return false;
    default:return false;
  }
}

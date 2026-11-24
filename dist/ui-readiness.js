import { pixelText, glyphRect } from './vfd-glyphs.js?v=glyph-1';
import { UI_CELL } from './viewer-grid.js?v=ui-pages-1';

const STORAGE_KEY = 'phosphor-ui-readiness-v1';
const MINT = '#b8ecdb', BLUE = '#76bfe9', DIM = '#416b70', AMBER = '#e7bf82', ROSE = '#e69baa';
const STAGES = ['Open', 'Maintenance Recommended', 'Maintenance Scheduled', 'Complete / Awaiting Verification', 'Closed'];
const CASE_TABS = ['Overview', 'Maintenance', 'Attached Alerts', 'Related Cases', 'Part List'];
const PARTS = [
  { nsn:'2840-01-345-6789', name:'Vibration Sensor Assembly', failure:'Engine Oil Consumption', wuc:'0HGTD', platforms:['B-1B','KC-135','C-5'], qty:27, unscheduled:75, scheduled:11, reorder:15, lead:15, lru:1 },
  { nsn:'2910-00-987-6543', name:'Pneumatic System Gasket Kit', failure:'Bleed Air Valve Unresponsive', wuc:'BIP1G', platforms:['B-1B'], qty:29, unscheduled:2, scheduled:0, reorder:4, lead:179, lru:.01 },
  { nsn:'2940-01-111-2223', name:'Engine Oil Filter Assembly', failure:'Engine Oil Consumption', wuc:'0HGTD', platforms:['B-1B'], qty:11, unscheduled:69, scheduled:9, reorder:4, lead:45, lru:8.67 },
  { nsn:'9150-00-555-4446', name:'Synthetic Engine Oil', failure:'Engine Oil Consumption', wuc:'0HGTD', platforms:['B-1B','C-5'], qty:42, unscheduled:8, scheduled:2, reorder:8, lead:30, lru:.25 }
];
const VALUE_ROWS = [
  { platform:'B-1B', base:'Dyess AFB', realized:1200000, potential:15400000, hours:380, realizedHours:37 },
  { platform:'B-1B', base:'Ellsworth AFB', realized:533050, potential:6867688, hours:233, realizedHours:18 },
  { platform:'C-5', base:'Dover AFB', realized:0, potential:5350000, hours:139, realizedHours:0 },
  { platform:'C-5', base:'Travis AFB', realized:0, potential:4000000, hours:102, realizedHours:0 }
];
const NEWS = [
  ['Mission capability, one decision at a time', 'Turn detected changes into maintenance actions before the next mission.', 'Review the attached alerts, record the maintenance recommendation, then track the case through verification. This workspace is an interactive demonstration; every figure is demo data.', 'cases'],
  ['Predict demand before the next inspection', 'Connect failure modes, parts and the maintenance schedule.', 'The inventory forecast combines current stock with scheduled and unscheduled demand. Select a national stock number to compare projected stock with its reorder threshold.', 'parts'],
  ['Make readiness outcomes visible', 'Follow realized value and the opportunity still ahead.', 'Compare platform-level value and non-mission-capable hours avoided. Filters let you inspect the sample fleet by platform and possessing base.', 'value']
];
const RESOURCES = [
  ['Workflow guide', 'Review alerts, recommend work, schedule maintenance, complete the task and verify the result. The Case page saves your progress locally.', 'cases'],
  ['Inventory FAQ', 'RO is the reorder threshold. LRU is the demo line-replaceable-unit risk score. A forecast below RO signals a replenishment review; it is not a live procurement order.', 'parts'],
  ['Value methodology', 'Realized and unrealized value are shown separately. The sample measures combine estimated economic value and non-mission-capable hours avoided.', 'value']
];
export const READINESS_COMPONENTS = Object.freeze({hero:'home',news:'home',updates:'home',resources:'home','case-header':'cases',tabs:'cases',workflow:'cases',actions:'cases',filters:'parts',table:'parts',pagination:'parts',forecast:'parts','chart-legend':'parts',metrics:'value','stacked-bars':'value',distribution:'value'});
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text = (value, tag = 'span', cls = '', extra = '') => `<${tag} data-vfd="label"${cls ? ` class="${cls}"` : ''}${extra ? ` ${extra}` : ''}>${escape(value)}</${tag}>`;
const button = (label, action, value = '', {active=false,disabled=false}={}) => `<button type="button" data-vfd="button" data-action="${action}" data-value="${escape(value)}"${active ? ' class="current" aria-pressed="true"' : ' aria-pressed="false"'}${disabled ? ' disabled' : ''}>${escape(label)}</button>`;
const heading = (label, subtitle = '') => `<div class="panel-head">${text(label,'h2')}${subtitle ? text(subtitle,'span','muted') : ''}</div>`;
const panel = (id, body, cls = '') => `<section class="panel ${cls}" data-vfd="panel"${id ? ` data-ui-component="${id}"` : ''}>${body}</section>`;
const field = (label, control) => `<label class="field">${text(label)}${control}</label>`;
const input = (control, value, placeholder = '', type = 'text', extra = '') => `<input data-vfd="search" data-control="${control}" type="${type}" value="${escape(value)}" placeholder="${escape(placeholder)}" aria-label="${escape(placeholder || control)}" ${extra}>`;
const select = (control, value, options, label) => `<select data-vfd="select" data-control="${control}" aria-label="${escape(label || control)}">${options.map(option => { const [v,l] = Array.isArray(option) ? option : [option,option]; return `<option data-vfd="label" value="${escape(v)}"${String(v) === String(value) ? ' selected' : ''}>${escape(l)}</option>`; }).join('')}</select>`;
const canvas = (id, title, height = 240) => `<canvas data-vfd="canvas" data-chart="${id}" class="chart" style="width:100%;height:calc(${Math.max(8,Math.round(height/UI_CELL))} * var(--cell))" role="img" aria-label="${escape(title)}"></canvas>`;
const dollars = n => '$' + Math.round(n).toLocaleString('en-US');
const metric = (name, value, foot) => `<div class="metric">${text(name,'span','eyebrow')}${text(value,'strong','', 'data-vfd-scale="2"')}${text(foot,'span','muted')}</div>`;
const safeString = (value, fallback = '', limit = 1200) => typeof value === 'string' ? value.slice(0,limit) : fallback;
const choice = (value, choices, fallback) => choices.includes(value) ? value : fallback;
const bounded = (value, min, max, fallback) => Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : fallback;
function defaultState() {
  return {case:{stage:0,description:'Engine Oil Consumption Engine 1',assignee:'',notes:'',recommendation:'Inspect engine 1 oil system and vibration sensor.',scheduled:'2025-05-05',reviewed:false,reviewedAlerts:[],merged:false,history:['Case opened / 19 FEB 2025']},caseTab:'Overview',
    parts:{query:'',nsn:'',failure:'',platform:'',lru:'all',sort:'nsn',direction:1,page:0,pageSize:4,selected:PARTS[0].nsn,forecast:'inventory',start:'2025-02',end:'2025-08',series:{actual:true,forecast:true,threshold:true,events:true},orders:{}},
    value:{platform:'',base:'',tab:'value',failure:''},home:{news:-1,resource:-1,updates:false}};
}
function readState() {
  const state = defaultState(); let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return state; }
  if (!saved || typeof saved !== 'object') return state;
  const c = saved.case || {}, p = saved.parts || {}, v = saved.value || {}, h = saved.home || {};
  Object.assign(state.case,{stage:Math.round(bounded(c.stage,0,4,0)),description:safeString(c.description,state.case.description,160),assignee:safeString(c.assignee,'',80),notes:safeString(c.notes),recommendation:safeString(c.recommendation,state.case.recommendation,300),scheduled:/^\d{4}-\d{2}-\d{2}$/.test(c.scheduled) ? c.scheduled : state.case.scheduled,reviewed:c.reviewed===true,merged:c.merged===true,history:Array.isArray(c.history) ? c.history.slice(-20).map(x=>safeString(x,'',160)) : state.case.history});
  state.case.reviewedAlerts=Array.isArray(c.reviewedAlerts)?c.reviewedAlerts.filter(id=>/^A-2500(13[6-9]|14[0-2])$/.test(id)).slice(0,7):[];
  if(c.reviewed&&!state.case.reviewedAlerts.includes('A-2500142'))state.case.reviewedAlerts.push('A-2500142');
  state.case.reviewed=state.case.reviewedAlerts.includes('A-2500142');
  state.caseTab=choice(saved.caseTab,CASE_TABS,'Overview');
  Object.assign(state.parts,{query:safeString(p.query,'',100),nsn:choice(p.nsn,['',...PARTS.map(x=>x.nsn)],''),failure:choice(p.failure,['',...PARTS.map(x=>x.failure)],''),platform:choice(p.platform,['','B-1B','C-5','KC-135'],''),lru:choice(p.lru,['all','risk','stable'],'all'),sort:choice(p.sort,['nsn','name','qty','unscheduled','scheduled','reorder','lead','lru'],'nsn'),direction:p.direction===-1 ? -1 : 1,page:Math.round(bounded(p.page,0,20,0)),pageSize:choice(p.pageSize,[2,4],4),selected:choice(p.selected,PARTS.map(x=>x.nsn),PARTS[0].nsn),forecast:choice(p.forecast,['inventory','demand'],'inventory'),start:choice(p.start,['2025-02','2025-03','2025-04','2025-05'],'2025-02'),end:choice(p.end,['2025-05','2025-06','2025-07','2025-08'],'2025-08')});
  for (const key of ['actual','forecast','threshold','events']) state.parts.series[key]=p.series?.[key]!==false;
  for (const part of PARTS) if (p.orders?.[part.nsn]) state.parts.orders[part.nsn]=Math.round(bounded(p.orders[part.nsn],0,1000,0));
  Object.assign(state.value,{platform:choice(v.platform,['','B-1B','C-5'],''),base:choice(v.base,['',...VALUE_ROWS.map(x=>x.base)],''),tab:choice(v.tab,['value','hours'],'value'),failure:choice(v.failure,['','Oil Consumption','Overheat','Vibration','Bleed Air'],'')});
  Object.assign(state.home,{news:Math.round(bounded(h.news,-1,2,-1)),resource:Math.round(bounded(h.resource,-1,2,-1)),updates:h.updates===true});
  return state;
}
function visibleParts(state) {
  const p=state.parts, query=p.query.toLowerCase().trim();
  return PARTS.filter(part=>(!query || `${part.nsn} ${part.name} ${part.failure} ${part.platforms.join(' ')}`.toLowerCase().includes(query)) && (!p.nsn || part.nsn===p.nsn) && (!p.failure || part.failure===p.failure) && (!p.platform || part.platforms.includes(p.platform)) && (p.lru==='all' || (p.lru==='risk' ? part.lru>1 : part.lru<=1)))
    .sort((a,b)=>p.direction*(typeof a[p.sort]==='number' ? a[p.sort]-b[p.sort] : a[p.sort].localeCompare(b[p.sort])));
}
function valueRows(state) { return VALUE_ROWS.filter(row=>(!state.value.platform || row.platform===state.value.platform) && (!state.value.base || row.base===state.value.base)); }

// Chart marks are snapped to logical display pixels; the shared renderer owns scaling.
function line(ctx,x0,y0,x1,y1,color=MINT,dashed=false) {
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let err=dx+dy,n=0;
  ctx.fillStyle=color;
  for (;;) {if(!dashed || n%8<4)ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}n++;}
}
function prepare(ctx,width,height) {const w=Math.max(1,Math.floor(width)),h=Math.max(1,Math.floor(height));ctx.clearRect(0,0,w,h);ctx.imageSmoothingEnabled=false;return [w,h];}
function aircraft(ctx,cx,cy,size,color) {
  const points=[[-1,0],[-.55,-.08],[-.2,-.1],[.1,-.48],[.27,-.47],[.08,-.09],[.7,-.08],[1,0],[.7,.08],[.08,.09],[.27,.47],[.1,.48],[-.2,.1],[-.55,.08],[-.75,.25],[-.9,.24],[-.83,.06],[-1,0]];
  for(let i=1;i<points.length;i++)line(ctx,cx+points[i-1][0]*size,cy+points[i-1][1]*size,cx+points[i][0]*size,cy+points[i][1]*size,color);
  line(ctx,cx-size*.7,cy,cx+size*.8,cy,DIM);
}
function drawHero(ctx,width,height,variant=0) {
  const [w,h]=prepare(ctx,width,height);
  for(let x=8;x<w;x+=16)for(let y=8;y<h;y+=16){ctx.fillStyle='#16383d';ctx.fillRect(x,y,1,1);}
  aircraft(ctx,w*.58,h*.42,Math.min(w*.3,h*.65),MINT);
  if(variant===0)aircraft(ctx,w*.28,h*.75,Math.min(w*.16,h*.32),BLUE);
  glyphRect(ctx,4,4,w-8,h-8,DIM);
  pixelText(ctx,['READINESS / FLEET OPERATIONS','MISSION CAPABILITY','PREDICTIVE MAINTENANCE','READY FOR THE NEXT MISSION'][variant]||'FLEET',12,12,BLUE,1,{maxWidth:w-24});
  pixelText(ctx,'DEMO / 2025',w-12,h-19,DIM,1,{align:'right',maxWidth:w-24});
}
function drawForecast(ctx,width,height,state) {
  const [w,h]=prepare(ctx,width,height),p=PARTS.find(x=>x.nsn===state.parts.selected),mode=state.parts.forecast;
  const left=30,right=w-12,top=20,bottom=h-31,span=right-left,high=mode==='inventory'?Math.max(35,p.qty+12):90;
  const start=Number(state.parts.start.slice(5))-2,end=Number(state.parts.end.slice(5))-2,range=Math.max(1,end-start);
  const x=month=>Math.round(left+(month-start)/range*span),y=value=>Math.round(bottom-value/high*(bottom-top));
  for(let i=0;i<=4;i++){const val=high*i/4;line(ctx,left,y(val),right,y(val),'#26484e');pixelText(ctx,String(Math.round(val)),left-6,y(val)-3,DIM,1,{align:'right'});}
  const months=['FEB','MAR','APR','MAY','JUN','JUL','AUG'];
  for(let m=start;m<=end;m++)pixelText(ctx,months[m],x(m),bottom+11,DIM,1,{align:m===start?'left':m===end?'right':'center'});
  const reorder=p.reorder;
  if(mode==='inventory'&&state.parts.series.threshold)line(ctx,left,y(reorder),right,y(reorder),ROSE,true);
  const series=mode==='inventory' ? [29,28,10,22,27,25,23,19,17,14,15].map(v=>Math.max(0,v+(p.qty-27))) : [0,1,19,19,19,21,23,27,29,32,31].map(v=>Math.round(v*(p.unscheduled+p.scheduled)/86));
  const positions=[0,.12,.53,1,2,3,3.1,3.28,4,5.35,5.85];
  ctx.save();ctx.beginPath();ctx.rect(left,top,span,bottom-top+1);ctx.clip();
  for(let i=1;i<series.length;i++){const forecast=positions[i]>=3,horizontalForecast=positions[i-1]>=3;if(state.parts.series[horizontalForecast?'forecast':'actual'])line(ctx,x(positions[i-1]),y(series[i-1]),x(positions[i]),y(series[i-1]),horizontalForecast?BLUE:MINT,horizontalForecast);if(state.parts.series[forecast?'forecast':'actual'])line(ctx,x(positions[i]),y(series[i-1]),x(positions[i]),y(series[i]),forecast?BLUE:MINT,forecast);}
  if(state.parts.series.forecast)line(ctx,x(positions.at(-1)),y(series.at(-1)),x(6),y(series.at(-1)),BLUE,true);
  if(state.parts.series.events&&start<=3&&end>=3)line(ctx,x(3),top,x(3),bottom,DIM,true);
  ctx.restore();
  if(state.parts.series.events&&start<=3&&end>=3)pixelText(ctx,'TODAY',x(3)+4,top,MINT,1,{maxWidth:Math.max(1,right-x(3)-4)});
  for(const [month,color]of[[3.1,MINT],[3.28,MINT],[4,MINT],[5.35,AMBER],[5.85,ROSE]])if(state.parts.series.events&&month>=start&&month<=end){ctx.fillStyle=color;ctx.fillRect(x(month)-2,bottom-2,5,5);}
  pixelText(ctx,mode==='inventory'?'STOCK / UNITS':'CUMULATIVE DEMAND',left,4,BLUE,1);
}
function drawValue(ctx,width,height,state) {
  const [w,h]=prepare(ctx,width,height),rows=valueRows(state),hours=state.value.tab==='hours';
  const groups=['B-1B','C-5'].map(platform=>({platform,rows:rows.filter(r=>r.platform===platform)})).filter(g=>g.rows.length);
  const left=43,right=w-8,top=24,bottom=h-26,span=right-left;
  if(!groups.length){pixelText(ctx,'NO PLATFORMS MATCH THESE FILTERS',12,24,AMBER,1,{maxWidth:w-24});return;}
  const totals=groups.map(g=>g.rows.reduce((sum,r)=>sum+(hours?r.hours:r.realized+r.potential),0)),max=Math.max(...totals)*1.15;
  for(let i=0;i<=4;i++){const x=Math.round(left+span*i/4);line(ctx,x,top,x,bottom,'#26484e');pixelText(ctx,hours?String(Math.round(max*i/4)):('$'+(max*i/4/1e6).toFixed(1)+'M'),x,bottom+10,DIM,1,{align:i===4?'right':i===0?'left':'center'});}
  groups.forEach((g,i)=>{const barHeight=Math.max(12,Math.floor((bottom-top)/groups.length*.48)),y=Math.round(top+(i+.5)*(bottom-top)/groups.length-barHeight/2),real=g.rows.reduce((n,r)=>n+(hours?r.realizedHours:r.realized),0),total=totals[i];
    pixelText(ctx,g.platform,3,y+Math.floor(barHeight/2)-3,MINT,1);
    ctx.fillStyle=BLUE;ctx.fillRect(left,y,Math.max(1,Math.round(total/max*span)),barHeight);
    if(real){ctx.fillStyle=MINT;ctx.fillRect(left,y,Math.max(1,Math.round(real/max*span)),barHeight);}
    pixelText(ctx,hours?`${total} H`:dollars(total),left+5,y+Math.floor(barHeight/2)-3,'#061b23',1,{maxWidth:Math.round(total/max*span)-10});
  });
}
function drawDistribution(ctx,width,height,state) {
  const [w,h]=prepare(ctx,width,height),labels=['OIL CONSUMPTION','OVERHEAT','VIBRATION','BLEED AIR'],weights=[.43,.27,.19,.11],colors=[MINT,BLUE,AMBER,ROSE];
  const total=valueRows(state).reduce((n,r)=>n+r.realized+r.potential,0),left=8,right=w-8,barY=17;
  if(!total){pixelText(ctx,'NO FAILURE DATA MATCHES THESE FILTERS',12,24,AMBER,1,{maxWidth:w-24});return;}
  let x=left;for(let i=0;i<4;i++){const end=i===3?right:Math.round(x+(right-left)*weights[i]);ctx.fillStyle=colors[i];ctx.fillRect(x,barY,Math.max(0,end-x-2),18);x=end;}
  for(let i=0;i<4;i++){const y=49+i*Math.max(16,Math.floor((h-57)/4));ctx.fillStyle=colors[i];ctx.fillRect(left,y,5,5);pixelText(ctx,labels[i],left+11,y-1,MINT,1,{maxWidth:Math.max(20,w*.6)});pixelText(ctx,dollars(total*weights[i]),right,y-1,colors[i],1,{align:'right',maxWidth:w*.38});}
}

export function mountReadiness(host, page, { refresh=()=>{}, navigate=()=>{}, notify=()=>{}, component=null } = {}) {
  if(!['home','cases','parts','value'].includes(page)) throw new Error('Unknown readiness page.');
  let state=readState(),disposed=false,editing=false,closeConfirm=false,resetConfirm=false,partEditing=false,help=false,error='',draft={};
  let partDraft={},filterDraft={...state.parts},valueDraft={...state.value};
  if(component==='actions'||component==='workflow')state.caseTab='Overview';
  const save=()=>{try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{notify('Local storage is unavailable. Changes remain in this session.');}};
  const notice=message=>{notify(message);};
  const row=(label,value)=>`<div class="row">${text(label,'span','muted')}${text(value,'strong')}</div>`;
  function homeHTML(){
    return `<div class="stack">${panel('hero',`<div class="split"><div class="stack">${text('PHOSPHOR / READINESS','span','eyebrow')}${text('Keep the next mission moving.','h1','', 'data-vfd-scale="3"')}${text('See fleet health, turn alerts into action, and prepare the parts you will need.','p')}${text('INTERACTIVE WORKSPACE / DEMO DATA','span','badge')}<div class="toolbar">${button('Review cases','navigate','cases')}${button('Explore fleet value','navigate','value')}</div></div>${canvas('hero','Pixel aircraft formation',230)}</div>`)}
    <div class="split"><div class="main-stack">${panel('news',heading('News','FIELD NOTES / 03')+`<div class="grid-3">${NEWS.map((n,i)=>`<article class="card" data-vfd="panel">${canvas(`news-${i}`,n[0],100)}${text(n[0],'h3')}${text(n[1],'p','muted')}${button(state.home.news===i?'Less detail':'Read story','news',i,{active:state.home.news===i})}${state.home.news===i?text(n[2],'p')+button('Open workspace','navigate',n[3]):''}</article>`).join('')}</div>`)}</div><div class="stack">${panel('updates',heading('System updates','LOCAL DEMO')+row('02 MAY 2025','Version 19.1')+text('Inventory forecasts and maintenance verification are ready to explore.','p','muted')+button(state.home.updates?'Hide updates':'All updates','updates','',{active:state.home.updates})+(state.home.updates?`<div class="stack">${row('Version 19.0','Case workflow')}${text('Added platform-level value, attached alert review, and saved case details.','p','muted')}${text('Your changes are saved in this browser. No operational systems are connected.','p','muted')}</div>`:''))}
    ${panel('resources',heading('Resources')+RESOURCES.map((r,i)=>`<div class="card">${button(r[0],'resource',i,{active:state.home.resource===i})}${state.home.resource===i?text(r[1],'p','muted')+button('Try this workflow','navigate',r[2]):''}</div>`).join(''))}</div></div></div>`;
  }
  function workflowHTML(){return panel('workflow',heading('Case status')+`<ol class="step-list">${STAGES.map((label,i)=>`<li class="step ${i===state.case.stage?'current':''}"${i===state.case.stage?' aria-current="step"':''}>${text(`${i<state.case.stage?'[X]':i===state.case.stage?'[>]':'[ ]'} ${label}`,'strong')}${text(i<state.case.stage?'Completed':i===state.case.stage?'Current stage':'Not started','span','muted')}</li>`).join('')}</ol>`+text('Progress is saved locally.','p','muted'));}
  function actionsHTML(){const c=state.case,next=['Recommend maintenance','Schedule maintenance','Mark maintenance complete','Verify and close','Reopen case'][c.stage];
    return panel('actions',heading('Quick action guide',STAGES[c.stage])+text('Review the latest evidence and move this case to its next maintenance step.','p','muted')+`<div class="stack">${button(c.reviewed?'Alert reviewed':'Review latest alert','review','',{active:c.reviewed})}${text('Alert A-2500142 / Engine oil consumption / High','span','muted')}${button(c.merged?'Related case consolidated':'Consolidate related case','merge','',{disabled:c.merged||c.stage===4})}${text(c.merged?'C-2500018 is linked. Seven alerts are now attached.':'C-2500018 / Same aircraft and failure mode / 2 alerts','span','muted')}
    ${c.stage===0?field('Maintenance recommendation',input('recommendation',c.recommendation,'Enter a maintenance recommendation','text','maxlength="300"')):''}${c.stage===1?field('Scheduled date',input('scheduled',c.scheduled,'Scheduled maintenance date','date')):''}${c.stage===2?text(`Scheduled for ${c.scheduled}. Confirm the recorded work is complete.`,'p'):''}${c.stage===3?text('Review the maintenance result before verifying this demonstration case.','p'):''}${button(next,'advance')}
    ${c.stage<4?button('Close without maintenance','close-open'):''}${closeConfirm?`<div class="card" data-vfd="panel">${text('Close this demo case without completing the remaining stages?','p')}${button('Confirm close','close-confirm')}${button('Keep open','close-cancel')}</div>`:''}${error?text(error,'p','badge','role="alert"'):''}</div>`);
  }
  function casesHTML(){const c=state.case;
    const header=panel('case-header',`<div class="panel-head"><div>${text('CASES / C-2500019','span','eyebrow')}${text(c.description,'h1','', 'data-vfd-scale="2"')}${text('C-5 / CF-59696','p','muted')}</div><div class="toolbar">${button(editing?'Cancel edit':'Edit case detail','case-edit')}${button('Reset demo case','reset-open')}</div></div><div class="metrics">${metric('STATUS',STAGES[c.stage],'Saved locally')}${metric('AIRCRAFT','CF-59696','Platform C-5')}${metric('ATTACHED ALERTS',c.merged?'07':'05','Created 19 FEB 2025')}${metric('ASSIGNEE',c.assignee||'UNASSIGNED','Demo maintenance team')}</div>${text('Failure modes: Engine overheat / Engine oil consumption / Engine vibration','p','muted')}
    ${editing?`<div class="card stack" data-vfd="panel">${field('Case description',input('case-description',draft.description,'Case description','text','maxlength="160"'))}${field('Assignee',input('case-assignee',draft.assignee,'Maintenance team or assignee','text','maxlength="80"'))}${field('Case note',input('case-notes',draft.notes,'Add an edit or maintenance note','text','maxlength="1200"'))}${button('Save case details','case-save')}</div>`:''}
    ${resetConfirm?`<div class="card" data-vfd="panel">${text('Reset this case to its original demo data?','p')}${button('Reset case','reset-confirm')}${button('Keep changes','reset-cancel')}</div>`:''}`);
    const tabs=`<div data-ui-component="tabs"><div class="tabs" role="tablist" aria-label="Case detail tabs">${CASE_TABS.map(tab=>button(tab,'case-tab',tab,{active:state.caseTab===tab})).join('')}</div>${caseContent()}</div>`;
    return `<div class="stack">${header}${tabs}</div>`;
  }
  function caseContent(){const c=state.case;
    if(state.caseTab==='Overview')return `<div class="split">${workflowHTML()}${actionsHTML()}</div>`;
    if(state.caseTab==='Maintenance')return panel('',heading('Maintenance record')+row('Status',STAGES[c.stage])+row('Recommendation',c.recommendation)+row('Schedule',c.scheduled)+row('Case note',c.notes||'No note added')+`<div class="stack">${c.history.map(item=>text(item,'p','muted')).join('')}</div>`+button('Return to actions','case-tab','Overview'));
    if(state.caseTab==='Attached Alerts')return panel('',heading('Attached alerts',`${c.merged?7:5} linked detections`)+`<div class="table-wrap"><table class="data-table"><thead><tr>${['Alert','Failure mode','Severity','Review'].map(x=>text(x,'th')).join('')}</tr></thead><tbody>${Array.from({length:c.merged?7:5},(_,i)=>`<tr>${text(`A-2500${142-i}`,'td')}${text(['Oil consumption','Engine overheat','Engine vibration'][i%3],'td')}${text(i<2?'HIGH':'WATCH','td')}<td>${button(c.reviewedAlerts.includes(`A-2500${142-i}`)?'Reviewed':'Review','review',`A-2500${142-i}`,{active:c.reviewedAlerts.includes(`A-2500${142-i}`)})}</td></tr>`).join('')}</tbody></table></div>`);
    if(state.caseTab==='Related Cases')return panel('',heading('Related cases')+row('C-2500018','CF-59696 / Oil consumption')+text(c.merged?'Consolidated into C-2500019. The source case is closed in this demo.':'Two compatible alerts can be consolidated with the current case.','p')+button(c.merged?'Consolidated':'Consolidate related case','merge','',{disabled:c.merged||c.stage===4}));
    return panel('',heading('Related parts')+PARTS.filter(p=>p.platforms.includes('C-5')).map(p=>`<div class="row">${text(`${p.nsn} / ${p.name}`)}${button('View inventory','part-navigate',p.nsn)}</div>`).join(''));
  }
  function partFilters(){return panel('filters',heading('Spare parts filter')+`<div class="stack">${field('National stock number',select('filter-nsn',filterDraft.nsn,[['','All NSNs'],...PARTS.map(x=>[x.nsn,x.nsn])],'National stock number'))}${field('Failure mode',select('filter-failure',filterDraft.failure,[['','All failure modes'],...Array.from(new Set(PARTS.map(x=>x.failure)))],'Failure mode'))}${field('Platform',select('filter-platform',filterDraft.platform,[['','All platforms'],'B-1B','C-5','KC-135'],'Platform'))}${field('LRU risk',select('filter-lru',filterDraft.lru,[['all','All risk scores'],['risk','Above 1 / at risk'],['stable','1 or below']],'LRU risk'))}<div class="toolbar">${button('Apply filters','parts-filter')}${button('Clear all','parts-clear')}</div>${text(`${visibleParts(state).length} matching NSNs`,'span','muted')}</div>`,'filter-panel');}
  function partTable(){const p=state.parts,rows=visibleParts(state),pages=Math.max(1,Math.ceil(rows.length/p.pageSize));p.page=Math.min(p.page,pages-1);const start=p.page*p.pageSize,shown=rows.slice(start,start+p.pageSize);
    const columns=[['nsn','NSN'],['name','DESCRIPTION'],['qty','STOCK'],['unscheduled','UNSCHED'],['scheduled','SCHED'],['reorder','RO'],['lead','LEAD/D'],['lru','LRU']];
    return panel('table',heading('All NSNs','SELECT A ROW TO VIEW ITS FORECAST')+`<div class="toolbar">${input('parts-query',p.query,'Search NSN, part or failure mode')}${button('Inventory help','parts-help','',{active:help})}</div>${help?text('Stock is on-hand inventory. UNSCHED and SCHED show associated demand. RO is the reorder threshold; LRU above 1 is flagged for review.','p','muted'):''}<div class="table-wrap"><table class="data-table"><thead><tr>${columns.map(([key,title])=>`<th aria-sort="${p.sort===key?(p.direction===1?'ascending':'descending'):'none'}">${button(`${title}${p.sort===key?(p.direction===1?' +':' -'):''}`,'parts-sort',key)}</th>`).join('')}</tr></thead><tbody>${shown.length?shown.map(part=>`<tr data-action="part-select" data-value="${part.nsn}" class="${p.selected===part.nsn?'current':''}" aria-selected="${p.selected===part.nsn}"><td>${button(part.nsn,'part-select',part.nsn,{active:p.selected===part.nsn})}</td>${text(part.name,'td')}${text(part.qty,'td')}${text(part.unscheduled,'td')}${text(part.scheduled,'td')}${text(part.reorder,'td')}${text(part.lead,'td')}${text(part.lru.toFixed(2)+(part.lru>1?' !':''),'td')}</tr>`).join(''):`<tr><td colspan="8">${text('No NSNs match these filters.','p','empty')}${button('Clear filters','parts-clear')}</td></tr>`}</tbody></table></div>
    <div class="toolbar" data-ui-component="pagination">${field('Rows per page',select('parts-page-size',p.pageSize,[2,4],'Rows per page'))}${text(rows.length?`${start+1}-${Math.min(start+p.pageSize,rows.length)} OF ${rows.length}`:'0 RESULTS','span','muted')}${button('Previous','parts-page',-1,{disabled:p.page===0})}${text(`${p.page+1} / ${pages}`)}${button('Next','parts-page',1,{disabled:p.page>=pages-1})}</div>`);
  }
  function forecastHTML(){const p=PARTS.find(x=>x.nsn===state.parts.selected),orders=state.parts.orders[p.nsn]||0;
    return panel('forecast',heading('NSN detail',p.nsn)+text(p.name,'h3')+`<div class="toolbar">${button('Inventory forecast','forecast-tab','inventory',{active:state.parts.forecast==='inventory'})}${button('Demand profile','forecast-tab','demand',{active:state.parts.forecast==='demand'})}${field('From',select('forecast-start',state.parts.start,[['2025-02','FEB 2025'],['2025-03','MAR 2025'],['2025-04','APR 2025'],['2025-05','MAY 2025']],'Forecast start'))}${field('Through',select('forecast-end',state.parts.end,[['2025-05','MAY 2025'],['2025-06','JUN 2025'],['2025-07','JUL 2025'],['2025-08','AUG 2025']],'Forecast end'))}</div>${canvas('forecast',`Actual and forecast inventory for ${p.nsn}`,290)}
    <div class="toolbar" data-ui-component="chart-legend">${[['actual','ACTUAL'],['forecast','FORECAST'],['threshold','REORDER LINE'],['events','EVENT MARKERS']].map(([key,label])=>button(label,'forecast-series',key,{active:state.parts.series[key]})).join('')}${text('[+] MAINTENANCE / [R] REORDER / [S] REPLENISHMENT','span','muted')}</div>
    <div class="row">${text(`REORDER ${p.reorder} / LEAD TIME ${p.lead} DAYS / ${p.platforms.join(', ')}`,'span','muted')}${button(partEditing?'Cancel order':'Plan replenishment','part-edit')}</div>${orders?text(`Demo replenishment saved: ${orders} units. Current stock remains ${p.qty} until received.`,'p','badge'):''}
    ${partEditing?`<div class="card stack" data-vfd="panel">${field('Units to replenish',input('order-qty',partDraft.qty,'Replenishment quantity','number','min="1" max="1000" step="1"'))}${text('This saves a local planning entry. It does not place an order.','p','muted')}${button('Save plan','order-save')}${error?text(error,'p','badge','role="alert"'):''}</div>`:''}`);
  }
  function partsHTML(){return `<div class="filter-layout">${partFilters()}<div class="main-stack">${panel('',`<div class="metrics">${metric('NSNS MONITORED',PARTS.length,'Reference inventory')}${metric('INSUFFICIENT NSNS',PARTS.filter(p=>p.lru>1).length,'LRU risk above 1')}${metric('PLANNED REPLENISHMENTS',Object.keys(state.parts.orders).length,'Local demo plans')}</div>`)}${partTable()}${forecastHTML()}</div></div>`;}
  function valueHTML(){const rows=valueRows(state),real=rows.reduce((n,r)=>n+r.realized,0),potential=rows.reduce((n,r)=>n+r.potential,0),hours=rows.reduce((n,r)=>n+r.hours,0),realHours=rows.reduce((n,r)=>n+r.realizedHours,0);
    return `<div class="stack">${panel('metrics',heading('Performance metrics','DEMO VALUE / NOT ACTUAL SAVINGS')+`<div class="metrics">${metric('OVERALL BUSINESS VALUE',dollars(real+potential),`${hours} NMC hours avoided`)}${metric('REALIZED IMPACT',dollars(real),`${realHours} realized hours avoided`)}${metric('UNREALIZED POTENTIAL',dollars(potential),`${hours-realHours} potential hours avoided`)}</div>`)}<div class="filter-layout">${panel('',heading('Filter panel')+`<div class="stack">${field('Platform',select('value-platform',valueDraft.platform,[['','All platforms'],'B-1B','C-5'],'Value platform'))}${field('Possessing base',select('value-base',valueDraft.base,[['','All bases'],...VALUE_ROWS.map(r=>r.base)],'Possessing base'))}<div class="toolbar">${button('Apply filters','value-filter')}${button('Clear all','value-clear')}</div>${text(`${rows.length} platform / base records`,'span','muted')}</div>`,'filter-panel')}<div class="main-stack">${panel('stacked-bars',heading('Platform-level insights')+`<div class="tabs">${button('$ Value','value-tab','value',{active:state.value.tab==='value'})}${button('Hours avoided','value-tab','hours',{active:state.value.tab==='hours'})}</div>${canvas('value','Realized and unrealized value by platform',280)}<div class="toolbar">${text('REALIZED / MINT','span')}${text('UNREALIZED / BLUE','span')}</div>`)}${panel('distribution',heading('Failure mode distribution','SAMPLE ALLOCATION ACROSS SELECTED RECORDS')+canvas('distribution','Failure mode share of selected value',200)+`<div class="toolbar">${['Oil Consumption','Overheat','Vibration','Bleed Air'].map(f=>button(f,'failure-select',f,{active:state.value.failure===f})).join('')}</div>`+(state.value.failure?text(`${state.value.failure}: ${dollars((real+potential)*[.43,.27,.19,.11][['Oil Consumption','Overheat','Vibration','Bleed Air'].indexOf(state.value.failure)])} demo value. Select Cases to review the maintenance workflow.`,'p','badge')+button('Review cases','navigate','cases'):''))}</div></div></div>`;
  }
  function render(){if(disposed)return;
    const active=host.ownerDocument.activeElement,focus=host.contains(active)?{control:active.dataset.control,action:active.dataset.action,value:active.dataset.value,start:active.selectionStart,end:active.selectionEnd}:null;
    host.innerHTML=page==='home'?homeHTML():page==='cases'?casesHTML():page==='parts'?partsHTML():valueHTML();
    if(component){
      const find=id=>host.querySelector(`[data-ui-component="${id}"]`);
      if(component==='chart-legend'||component==='pagination'){const target=find(component==='chart-legend'?'forecast':'table');if(target)host.replaceChildren(target);}
      else if(component==='filters'||component==='workflow'||component==='actions'){
        const wrapper=host.ownerDocument.createElement('div');wrapper.className=component==='filters'?'filter-layout':'split';
        for(const id of component==='filters'?['filters','table']:['workflow','actions']){const target=find(id);if(target)wrapper.append(target);}host.replaceChildren(wrapper);
      }else{const target=find(component);if(target)host.replaceChildren(target);}
    }
    for(const el of host.querySelectorAll('[data-chart]')){const id=el.dataset.chart;el.vfdDraw=(ctx,w,h)=>{if(id==='hero')drawHero(ctx,w,h);else if(id.startsWith('news-'))drawHero(ctx,w,h,Number(id.at(-1))+1);else if(id==='forecast')drawForecast(ctx,w,h,state);else if(id==='value')drawValue(ctx,w,h,state);else drawDistribution(ctx,w,h,state);};}
    if(focus){const candidates=host.querySelectorAll(focus.control?'[data-control]':'[data-action]');const next=Array.from(candidates).find(el=>focus.control?el.dataset.control===focus.control:el.dataset.action===focus.action&&el.dataset.value===focus.value);if(next){next.focus({preventScroll:true});if(typeof next.setSelectionRange==='function'&&focus.start!==null)try{next.setSelectionRange(focus.start,focus.end);}catch{}}}
    refresh();
  }
  function caseHistory(message){state.case.history.push(message);state.case.history=state.case.history.slice(-20);}
  function onClick(event){const target=event.target.closest('[data-action]');if(!target||!host.contains(target)||target.disabled)return;const {action,value}=target.dataset;error='';
    if(action==='navigate'){navigate(value);return;}
    if(action==='news')state.home.news=state.home.news===Number(value)?-1:Number(value);
    else if(action==='resource')state.home.resource=state.home.resource===Number(value)?-1:Number(value);
    else if(action==='updates')state.home.updates=!state.home.updates;
    else if(action==='case-tab')state.caseTab=choice(value,CASE_TABS,'Overview');
    else if(action==='case-edit'){editing=!editing;draft={...state.case};}
    else if(action==='case-save'){if(!draft.description.trim()){error='Add a case description before saving.';notice(error);return;}Object.assign(state.case,{description:draft.description.trim(),assignee:draft.assignee.trim(),notes:draft.notes.trim()});editing=false;caseHistory('Case details updated');notice('Case details saved.');}
    else if(action==='reset-open')resetConfirm=true;
    else if(action==='reset-cancel')resetConfirm=false;
    else if(action==='reset-confirm'){state.case=defaultState().case;state.caseTab='Overview';resetConfirm=editing=closeConfirm=false;notice('Case reset to its demo state.');}
    else if(action==='review'){const id=value||'A-2500142';if(!state.case.reviewedAlerts.includes(id)){state.case.reviewedAlerts.push(id);caseHistory(`${id} reviewed`);}state.case.reviewed=state.case.reviewedAlerts.includes('A-2500142');notice(`${id} marked reviewed.`);}
    else if(action==='merge'){if(!state.case.merged&&state.case.stage<4){state.case.merged=true;caseHistory('C-2500018 consolidated / 2 alerts added');notice('Related case consolidated.');}}
    else if(action==='advance'){const c=state.case;if(c.stage===0&&!c.recommendation.trim())error='Enter a maintenance recommendation first.';else if(c.stage===1&&!/^\d{4}-\d{2}-\d{2}$/.test(c.scheduled))error='Choose a scheduled maintenance date.';else{c.stage=c.stage===4?0:c.stage+1;caseHistory(STAGES[c.stage]);notice(`Case updated: ${STAGES[c.stage]}.`);}}
    else if(action==='close-open')closeConfirm=true;
    else if(action==='close-cancel')closeConfirm=false;
    else if(action==='close-confirm'){state.case.stage=4;closeConfirm=false;caseHistory('Case closed without further maintenance');notice('Demo case closed.');}
    else if(action==='part-navigate'){state.parts.selected=value;save();navigate('parts');return;}
    else if(action==='parts-filter'){Object.assign(state.parts,{nsn:filterDraft.nsn,failure:filterDraft.failure,platform:filterDraft.platform,lru:filterDraft.lru,page:0});}
    else if(action==='parts-clear'){Object.assign(state.parts,{query:'',nsn:'',failure:'',platform:'',lru:'all',page:0});filterDraft={...state.parts};}
    else if(action==='parts-sort'){state.parts.direction=state.parts.sort===value?-state.parts.direction:1;state.parts.sort=value;state.parts.page=0;}
    else if(action==='parts-page')state.parts.page=Math.max(0,state.parts.page+Number(value));
    else if(action==='parts-help')help=!help;
    else if(action==='part-select'){state.parts.selected=value;partEditing=false;}
    else if(action==='forecast-tab')state.parts.forecast=value;
    else if(action==='forecast-series')state.parts.series[value]=!state.parts.series[value];
    else if(action==='part-edit'){partEditing=!partEditing;partDraft={qty:state.parts.orders[state.parts.selected]||15};}
    else if(action==='order-save'){const qty=Number(partDraft.qty);if(!Number.isInteger(qty)||qty<1||qty>1000)error='Enter a whole number from 1 to 1000.';else{state.parts.orders[state.parts.selected]=qty;partEditing=false;notice('Local replenishment plan saved.');}}
    else if(action==='value-filter'){Object.assign(state.value,{platform:valueDraft.platform,base:valueDraft.base});}
    else if(action==='value-clear'){state.value.platform=state.value.base='';valueDraft={...state.value};}
    else if(action==='value-tab')state.value.tab=value;
    else if(action==='failure-select')state.value.failure=state.value.failure===value?'':value;
    save();render();
  }
  function onInput(event){const el=event.target,control=el.dataset.control;if(!control)return;const value=el.value;
    if(control.startsWith('case-')){draft[control.slice(5)==='description'?'description':control.slice(5)==='assignee'?'assignee':'notes']=value;return;}
    if(control==='recommendation'){state.case.recommendation=value;save();return;}
    if(control==='scheduled'){state.case.scheduled=value;save();return;}
    if(control==='order-qty'){partDraft.qty=value;return;}
    if(control.startsWith('filter-')){filterDraft[control.slice(7)]=value;return;}
    if(control==='value-platform'||control==='value-base'){valueDraft[control.slice(6)]=value;return;}
    if(control==='parts-query'){state.parts.query=value;state.parts.page=0;}
    else if(control==='parts-page-size'){state.parts.pageSize=Number(value);state.parts.page=0;}
    else if(control==='forecast-start'){state.parts.start=value;if(state.parts.end<value)state.parts.end=value;}
    else if(control==='forecast-end'){state.parts.end=value;if(state.parts.start>value)state.parts.start=value;}
    else return;
    save();render();
  }
  host.addEventListener('click',onClick);host.addEventListener('input',onInput);host.addEventListener('change',onInput);render();
  return ()=>{if(disposed)return;disposed=true;host.removeEventListener('click',onClick);host.removeEventListener('input',onInput);host.removeEventListener('change',onInput);for(const el of host.querySelectorAll('[data-chart]'))delete el.vfdDraw;};
}
export function mountReadinessComponent(host,id,options={}) {
  const page=READINESS_COMPONENTS[id];if(!page)throw new Error('Unknown readiness component.');
  return mountReadiness(host,page,{...options,component:id});
}

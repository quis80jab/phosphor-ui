import { pixelText, glyphRect } from './vfd-glyphs.js';
import { PIXEL_PITCH, UI_CELL } from './viewer-grid.js?v=pane-140';

const STORAGE_KEY = 'phosphor-ui-logistics-v1';
const SITES = [
  {id:'subic',name:'Subic Bay',code:'SUBIC',type:'port',lon:120.2,lat:14.8,risk:'high',detail:'JV-24601 / customs hold / 14 days'},
  {id:'manila',name:'Port of Manila',code:'MANILA',type:'port',lon:121,lat:14.2,risk:'high',detail:'Class IX repair parts / berth congestion'},
  {id:'busan',name:'Port of Busan',code:'BUSAN',type:'port',lon:129,lat:35.1,risk:'high',detail:'Weather closure risk / alternate port review'},
  {id:'shanghai',name:'Shanghai',code:'SHANGHAI',type:'port',lon:121.5,lat:31.2,risk:'low',detail:'Seaport / scheduled capacity available'},
  {id:'singapore',name:'Singapore',code:'SINGAPORE',type:'port',lon:103.8,lat:1.3,risk:'low',detail:'Seaport / scheduled capacity available'},
  {id:'tokyo',name:'Tokyo',code:'TOKYO',type:'port',lon:139.7,lat:35.7,risk:'low',detail:'Seaport / scheduled capacity available'},
  {id:'seoul',name:'Seoul airport',code:'SEOUL AIR',type:'airport',lon:126.5,lat:37.5,risk:'low',detail:'Airport / scheduled capacity available'},
  {id:'clark',name:'Clark base',code:'CLARK',type:'base',lon:120.6,lat:16,risk:'low',detail:'Base / receiving point available'},
  {id:'yokosuka',name:'Yokosuka base',code:'YOKOSUKA',type:'base',lon:140.3,lat:34.5,risk:'low',detail:'Base / receiving point available'}
];
const ALERTS = [
  {id:'cargo',title:'Frustrated cargo: JV-24601',short:'FRUSTRATED CARGO',subtitle:'Delayed high-priority shipment',site:'subic',category:'cargo',priority:3,time:'07:36',detail:'Demo vessel JV-24601 has been held in customs at Subic Bay for 14 days. Critical supply delivery is delayed.',action:'Review clearance documents and compare alternate receiving ports.'},
  {id:'closure',title:'At risk of closure: Busan',short:'BUSAN CLOSURE',subtitle:'Loss of facility',site:'busan',category:'lanes',priority:3,time:'07:20',detail:'The demo weather scenario places Busan at risk of a temporary port closure. Arrivals require an alternate routing review.',action:'Compare available seaports before changing the shipment plan.'},
  {id:'congestion',title:'Severe congestion: Manila',short:'MANILA CONGESTION',subtitle:'Supply-chain impact',site:'manila',category:'demand',priority:2,time:'06:55',detail:'Congestion in the demo Manila scenario delays Class IX repair parts. The receiving depot has an unmet-demand risk.',action:'Review the repair-parts queue and available transport capacity.'}
];
const INSIGHTS = [
  {id:'critical',count:14,title:'ACTIVE CRITICAL ALERTS',detail:'Priority events in the demo snapshot'},
  {id:'cargo',count:10,title:'FRUSTRATED CARGO RISKS',detail:'High-priority shipments held in port'},
  {id:'demand',count:15,title:'UNMET DEMAND RISKS',detail:'Depots approaching inventory shortfall'},
  {id:'lanes',count:8,title:'LANE DISRUPTIONS',detail:'Weather and facility constraints'}
];
const SUPPLIES = [
  {code:'II',name:'Clothing + equipment',risk:'low'},
  {code:'IIIP',name:'Packaged POL',risk:'high'},
  {code:'IIIB',name:'Bulk POL',risk:'high'},
  {code:'IV',name:'Construction materials',risk:'low'},
  {code:'VIII',name:'Medical supplies',risk:'low'},
  {code:'IX',name:'Repair parts',risk:'high'}
];
// Approximate, intentionally schematic geography. These are not navigation data.
const LAND = [
  [[73,53],[91,54],[110,53],[126,50],[139,49],[141,44],[134,41],[128,42],[124,39],[122,33],[121,28],[116,23],[110,21],[108,17],[109,12],[106,9],[104,4],[102,2],[100,5],[99,10],[96,17],[92,21],[86,24],[80,29],[75,39]],
  [[125,41],[129,42],[130,38],[128,35],[126,34],[125,38]],
  [[140,41],[142,40],[141,37],[138,35],[134,34],[131,32],[130,34],[134,36],[137,38]],
  [[141,45],[145,44],[145,42],[142,41],[140,43]],
  [[130,32],[132,31],[131,29],[129,31]],
  [[121,25],[122,24],[121,22],[120,22],[120,24]],
  [[120,19],[122,18],[122,16],[121,14],[120,15]],
  [[122,13],[124,12],[125,10],[123,10],[122,11]],
  [[124,9],[126,8],[126,6],[123,6],[122,7]],
  [[117,8],[119,7],[118,4],[116,1],[114,2],[115,5]],
  [[109,7],[116,7],[119,4],[118,0],[115,-3],[110,-2],[108,1]],
  [[96,5],[100,1],[104,-4],[105,-6],[101,-5],[98,-1],[95,3]],
  [[106,-6],[113,-7],[116,-8],[110,-8],[106,-7]],
  [[119,1],[122,2],[124,1],[122,-2],[121,-5],[119,-4]],
  [[131,-3],[140,-4],[144,-6],[141,-8],[135,-7]]
];
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));
const escape = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const label = (value,attributes='') => `<span data-vfd="label" ${attributes}>${escape(value)}</span>`;

export function resolveLogisticsCommand(value) {
  const query = String(value || '').trim().toLowerCase().replace(/\s+/g,' ');
  if (!query) return {type:'help'};
  if (/^(reset|reset map|home)$/.test(query)) return {type:'reset'};
  if (/^(restore alerts|restore all alerts)$/.test(query)) return {type:'restore'};
  if (/^(show )?(all )?alerts$/.test(query)) return {type:'alerts',filter:'all'};
  if (/^(show )?(urgent|critical)( alerts)?$/.test(query)) return {type:'alerts',filter:'critical'};
  if (/^(zoom in|zoom out)$/.test(query)) return {type:'zoom',delta:query.endsWith('in') ? 1 : -1};
  const layer = query.match(/^(show|hide) (services|commands|bases?|3d)$/);
  if (layer) return {type:'layer',layer:layer[2].startsWith('base')?'base':layer[2],enabled:layer[1]==='show'};
  const name = query.replace(/^(find|focus|show|open)\s+/,'');
  const site = SITES.find(site=>[site.id,site.name.toLowerCase(),site.code.toLowerCase()].includes(name));
  return site ? {type:'focus',site:site.id} : {type:'unknown',query};
}

function readState(restore = true) {
  const state = {layers:{services:true,commands:false,base:true,'3d':false},dismissed:[],selectedSite:'subic',selectedAlert:'cargo',alertsOpen:true,sort:'latest',zoom:1,panX:0,panY:0};
  if(!restore)return state;
  try {
    const saved=JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || typeof saved!=='object') return state;
    for(const key of Object.keys(state.layers))if(typeof saved.layers?.[key]==='boolean')state.layers[key]=saved.layers[key];
    if(Array.isArray(saved.dismissed))state.dismissed=[...new Set(saved.dismissed.filter(id=>ALERTS.some(alert=>alert.id===id)))];
    if(SITES.some(site=>site.id===saved.selectedSite))state.selectedSite=saved.selectedSite;
    if(ALERTS.some(alert=>alert.id===saved.selectedAlert))state.selectedAlert=saved.selectedAlert;
    if(typeof saved.alertsOpen==='boolean')state.alertsOpen=saved.alertsOpen;
    if(['latest','oldest','priority'].includes(saved.sort))state.sort=saved.sort;
    for(const [key,min,max]of[['zoom',.7,3],['panX',-1,1],['panY',-1,1]])if(Number.isFinite(saved[key]))state[key]=clamp(saved[key],min,max);
  }catch{/* The local demo remains usable without storage. */}
  return state;
}

/** Three-column logistics prototype, with deterministic local interactions only. */
export function mountLogistics(host,{refresh=()=>{},navigate=()=>{},notify=()=>{}}={}) {
  if(!host)throw new Error('The logistics page needs a host element.');
  const isPreview=host.classList.contains('catalog-preview'),state=readState(!isPreview);let alive=true,filter='all',query='',hits=[],mapWidth=0,mapHeight=0,drag=null,layoutFrame=0;
  const stylesheet=document.createElement('link');stylesheet.rel='stylesheet';stylesheet.href=new URL('./ui-logistics.css',import.meta.url).href;document.head.append(stylesheet);
  const events=[];
  const on=(element,type,fn,options)=>{element.addEventListener(type,fn,options);events.push(()=>element.removeEventListener(type,fn,options));};
  const persist=()=>{if(isPreview)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));}catch{/* Demo state still works for this session. */}};
  host.innerHTML=`
    <section class="logistics-demo stack" aria-label="Logistics demonstration">
      <section class="panel logistics-command" data-vfd="panel" data-ui-component="command-search" aria-label="Local demo command search">
        <div class="panel-head"><h2 data-vfd="label" data-vfd-scale="2">LOGISTICS COMMAND</h2>${label('LOCAL DEMO','class="badge"')}</div>
        <form class="row logistics-command-form"><input data-vfd="search" type="search" name="command" aria-label="Demo command search" placeholder="Find Subic Bay or try show urgent" autocomplete="off"><button data-vfd="button" type="submit">RUN</button><button data-vfd="button" type="button" data-action="toggle-alerts">ALERTS</button></form>
        <div class="toolbar logistics-command-examples"><button data-vfd="button" data-action="command" data-command="Subic Bay">SUBIC BAY</button><button data-vfd="button" data-action="command" data-command="show urgent">SHOW URGENT</button><button data-vfd="button" data-action="command" data-command="reset map">RESET MAP</button></div>
        <p class="muted logistics-command-status" data-vfd="label" role="status">LOCAL COMMANDS / DEMO RECORDS / NO LIVE DATA</p>
      </section>
      <div class="logistics-layout">
        <aside class="stack logistics-insights" aria-label="Logistics insights">
          <section class="panel" data-vfd="panel" data-ui-component="insights">
            <div class="panel-head"><h2 data-vfd="label" data-vfd-scale="2">INSIGHTS</h2></div>
            <button class="logistics-accordion" data-vfd="button" data-action="accordion" aria-expanded="true" aria-controls="logistics-attention">NEEDS ATTENTION</button>
            <div id="logistics-attention" class="stack logistics-attention">${INSIGHTS.map(item=>`<div class="logistics-insight card" data-vfd="panel">${label(item.count,'data-vfd-scale="2" class="logistics-count"')}${label(item.title,'class="logistics-insight-title"')}<p data-vfd="label" class="muted">${escape(item.detail)}</p><button data-vfd="button" data-action="filter" data-filter="${item.id}">REVIEW</button></div>`).join('')}
            <p class="muted" data-vfd="label">SIMULATED TOTALS / 3 SAMPLE ALERTS</p></div>
          </section>
          <section class="panel" data-vfd="panel" data-ui-component="supply-status">
            <button class="logistics-accordion" data-vfd="button" data-action="accordion" aria-expanded="true" aria-controls="logistics-supply">SUPPLY STATUS</button>
            <div id="logistics-supply" class="stack">${SUPPLIES.map(supply=>`<div class="logistics-supply-row card" data-vfd="panel"><div class="row">${label(`CLASS ${supply.code}`)}${label(`${supply.risk.toUpperCase()} RISK`,`class="badge logistics-${supply.risk}"`)}</div>${label(supply.name,'class="muted"')}</div>`).join('')}<button data-vfd="button" data-action="readiness">VIEW READINESS</button></div>
          </section>
        </aside>
        <main class="main-stack logistics-map-column">
          <section class="panel logistics-map-panel" data-vfd="panel" data-ui-component="map">
            <div class="panel-head"><h2 data-vfd="label" data-vfd-scale="2">PACIFIC LOGISTICS</h2>${label('24 MAY 2024','class="muted"')}</div>
            <div class="toolbar logistics-map-toolbar" data-ui-component="map-toolbar" aria-label="Map layers">${['services','commands','base','3d'].map(key=>`<button data-vfd="button" data-action="layer" data-layer="${key}" aria-pressed="${state.layers[key]}">${key.toUpperCase()}</button>`).join('')}</div>
            <div class="logistics-map-surface"><canvas data-vfd="canvas" class="logistics-map" tabindex="0" role="img" aria-label="Schematic Asia logistics map. Drag to pan. Arrow keys pan, plus and minus zoom, and Home resets. Use location buttons below to select a marker."></canvas></div>
            <div class="toolbar logistics-map-controls" aria-label="Map navigation"><button data-vfd="button" data-action="pan" data-x="-1" data-y="0" aria-label="Pan map west">WEST</button><button data-vfd="button" data-action="pan" data-x="0" data-y="-1" aria-label="Pan map north">NORTH</button><button data-vfd="button" data-action="pan" data-x="0" data-y="1" aria-label="Pan map south">SOUTH</button><button data-vfd="button" data-action="pan" data-x="1" data-y="0" aria-label="Pan map east">EAST</button><button data-vfd="button" data-action="zoom" data-delta="1" aria-label="Zoom map in">+</button><button data-vfd="button" data-action="zoom" data-delta="-1" aria-label="Zoom map out">-</button><button data-vfd="button" data-action="reset">RESET</button>${label('100%','class="logistics-zoom muted"')}</div>
            <div class="logistics-legend panel" data-vfd="panel" data-ui-component="map-legend"><h3 data-vfd="label">LEGEND</h3><div class="toolbar">${label('A AIRPORT')}${label('P SEAPORT')}${label('B BASE')}${label('+ LOW RISK','class="logistics-low" data-vfd-color="#a9ead8"')}${label('! HIGH RISK','class="logistics-high" data-vfd-color="#ff9b8d"')}</div><p class="muted" data-vfd="label">APPROXIMATE SCHEMATIC / DEMO DATA</p></div>
            <div class="logistics-locations" aria-label="Map location markers"></div>
            <div class="card logistics-location-detail" data-vfd="panel" aria-live="polite"></div>
          </section>
        </main>
        <aside class="panel logistics-alerts" data-vfd="panel" data-ui-component="alerts" aria-label="Demo logistics alerts">
          <div class="panel-head"><h2 data-vfd="label" data-vfd-scale="2">ALERTS</h2><button data-vfd="button" data-action="toggle-alerts" aria-label="Close alerts drawer">X</button></div>
          <p data-vfd="label" class="muted">SAMPLE UPDATES / DEMO SNAPSHOT</p>
          <input data-vfd="search" class="logistics-alert-search" type="search" aria-label="Search logistics alerts" placeholder="Search alerts" autocomplete="off">
          <label class="field"><span data-vfd="label">SORT BY</span><select data-vfd="select" class="logistics-alert-sort" aria-label="Sort logistics alerts"><option data-vfd="label" value="latest">LATEST FIRST</option><option data-vfd="label" value="oldest">OLDEST FIRST</option><option data-vfd="label" value="priority">PRIORITY</option></select></label>
          <div class="row"><span class="logistics-alert-count" data-vfd="label" role="status"></span><button data-vfd="button" data-action="clear-filter">ALL</button><button data-vfd="button" data-action="restore">RESTORE</button></div>
          <div class="logistics-alert-list stack"></div>
        </aside>
      </div>
    </section>`;
  const root=host.querySelector('.logistics-demo'),canvas=root.querySelector('canvas'),layout=root.querySelector('.logistics-layout');
  const commandInput=root.querySelector('[name="command"]'),commandStatus=root.querySelector('.logistics-command-status');
  const alertInput=root.querySelector('.logistics-alert-search'),sortInput=root.querySelector('.logistics-alert-sort');
  sortInput.value=state.sort;
  const siteVisible=site=>site.type==='base'?state.layers.base:state.layers.services;
  const style=(element,name,value)=>{if(element.style[name]!==value)element.style[name]=value;};
  function quantizeLayout(){
    const cellCount=value=>Math.max(1,Math.floor(value/UI_CELL+1e-7));
    if(!isPreview){
      const cells=cellCount(root.getBoundingClientRect().width);
      style(layout,'width',`${cells*UI_CELL}px`);
      let columns=[cells];
      if(innerWidth>799){
        if(innerWidth>1199&&state.alertsOpen){
          const available=cells-2,left=Math.max(13,Math.round(available/5.05)),right=Math.max(17,Math.round(available*1.25/5.05));
          columns=[left,Math.max(1,available-left-right),right];
        }else{
          const available=cells-1,left=Math.min(22,Math.max(13,Math.round(available/(state.alertsOpen?3.5:5))));
          columns=[left,Math.max(1,available-left)];
        }
      }
      style(layout,'gridTemplateColumns',columns.map(count=>`${count*UI_CELL}px`).join(' '));
    }
    function equalColumns(element,count,minCells=1){
      if(!element||element.getBoundingClientRect().width<UI_CELL)return;
      const gap=parseFloat(getComputedStyle(element).columnGap)||0;
      const available=element.getBoundingClientRect().width;
      while(count>1&&cellCount((available-gap*(count-1))/count)<minCells)count--;
      const cells=cellCount((available-gap*(count-1))/count);
      style(element,'gridTemplateColumns',`repeat(${count}, ${cells*UI_CELL}px)`);
    }
    equalColumns(root.querySelector('.logistics-locations'),innerWidth>479?3:2,8);
    const alerts=root.querySelector('.logistics-alert-list');
    if(innerWidth>799&&innerWidth<=1199)equalColumns(alerts,3,20);else style(alerts,'gridTemplateColumns','');
  }

  function point(lon,lat,width,height) {
    const available=Math.min(width/70,height/60)*.88*state.zoom;
    let x=(lon-112)*available,y=(25-lat)*available;
    if(state.layers['3d']){x+=y*.18;y*=.78;}
    return [Math.round(width/2+x+state.panX*width),Math.round(height/2+y+state.panY*height)];
  }
  function line(ctx,x0,y0,x1,y1,color,dashed=false) {
    x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
    const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
    let error=dx+dy,step=0;ctx.fillStyle=color;
    for(;;){if(!dashed||step%6<3)ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const twice=2*error;if(twice>=dy){error+=dy;x0+=sx;}if(twice<=dx){error+=dx;y0+=sy;}step++;}
  }
  function polygon(ctx,vertices,color,width,height) {
    const minY=Math.max(0,Math.min(...vertices.map(p=>p[1]))),maxY=Math.min(height-1,Math.max(...vertices.map(p=>p[1])));
    ctx.fillStyle=color;
    for(let y=Math.ceil(minY/2)*2;y<=maxY;y+=2){
      const intersections=[];
      for(let i=0;i<vertices.length;i++){const a=vertices[i],b=vertices[(i+1)%vertices.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))intersections.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}
      intersections.sort((a,b)=>a-b);
      for(let i=0;i+1<intersections.length;i+=2){const from=Math.max(0,Math.ceil(intersections[i]/2)*2),to=Math.min(width,intersections[i+1]);for(let x=from;x<to;x+=2)ctx.fillRect(x,y,1,1);}
    }
  }
  function mapDraw(ctx,width,height) {
    width=Math.max(1,Math.floor(width));height=Math.max(1,Math.floor(height));mapWidth=width;mapHeight=height;hits=[];
    ctx.save();ctx.beginPath();ctx.rect(0,0,width,height);ctx.clip();ctx.fillStyle='#061713';ctx.fillRect(0,0,width,height);
    for(let lon=80;lon<=150;lon+=10){const a=point(lon,-10,width,height),b=point(lon,55,width,height);line(ctx,...a,...b,'#173d35',true);}
    for(let lat=-10;lat<=50;lat+=10){const a=point(75,lat,width,height),b=point(150,lat,width,height);line(ctx,...a,...b,'#173d35',true);}
    for(const outline of LAND){
      const vertices=outline.map(([lon,lat])=>point(lon,lat,width,height));
      if(state.layers['3d'])polygon(ctx,vertices.map(([x,y])=>[x,y+6]),'#245348',width,height);
      polygon(ctx,vertices,'#397361',width,height);
      for(let i=0;i<vertices.length;i++)line(ctx,...vertices[i],...vertices[(i+1)%vertices.length],'#69aa8a');
    }
    if(state.layers.commands){
      const center=SITES.find(site=>site.id===state.selectedSite)||SITES[0];
      for(const id of['busan','singapore','tokyo']){const target=SITES.find(site=>site.id===id);if(target===center)continue;line(ctx,...point(center.lon,center.lat,width,height),...point(target.lon,target.lat,width,height),'#8ccabd',true);}
    }
    for(const site of SITES.filter(siteVisible)){
      const anchor=point(site.lon,site.lat,width,height),offset={subic:[-10,0],manila:[9,13],clark:[7,-13],yokosuka:[11,11]}[site.id]||[0,0];
      const x=anchor[0]+offset[0],y=anchor[1]+offset[1];if(x<-12||x>width+12||y<-12||y>height+12)continue;
      if(offset[0]||offset[1])line(ctx,...anchor,x,y,'#63977f');
      const selected=site.id===state.selectedSite,color=site.risk==='high'?'#ff9b8d':'#a9ead8',radius=selected?7:5;
      ctx.fillStyle='#082820';ctx.fillRect(x-radius,y-radius,radius*2+1,radius*2+1);
      glyphRect(ctx,x-radius,y-radius,radius*2+1,radius*2+1,color);
      pixelText(ctx,site.type==='port'?'P':site.type==='airport'?'A':'B',x-2,y-3,color);
      if(selected){line(ctx,x-10,y,x-8,y,color);line(ctx,x+8,y,x+10,y,color);line(ctx,x,y-10,x,y-8,color);line(ctx,x,y+8,x,y+10,color);const labelX=clamp(x+11,3,Math.max(3,width-site.code.length*6-3)),labelY=clamp(y-12,3,height-10);ctx.fillStyle='#061713';ctx.fillRect(labelX-2,labelY-2,site.code.length*6+3,11);pixelText(ctx,site.code,labelX,labelY,color);}
      hits.push({id:site.id,x,y,radius:10});
    }
    pixelText(ctx,'ASIA / PACIFIC',8,8,'#9bd1bc');
    pixelText(ctx,state.layers['3d']?'3D RELIEF / SCHEMATIC':'SCHEMATIC / DEMO',8,height-15,'#6b9f8d');
    ctx.restore();
  }
  canvas.vfdDraw=mapDraw;
  function drawFallback(){
    if(!alive)return;const rect=canvas.getBoundingClientRect();if(rect.width<1||rect.height<1)return;
    const width=Math.max(1,Math.round(rect.width/PIXEL_PITCH)),height=Math.max(1,Math.round(rect.height/PIXEL_PITCH));
    if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
    const ctx=canvas.getContext('2d');if(ctx){ctx.imageSmoothingEnabled=false;mapDraw(ctx,width,height);}
  }
  function redraw(){quantizeLayout();drawFallback();refresh();}
  function updateMap(){
    const focusedSite=document.activeElement?.closest('.logistics-locations')?.contains(document.activeElement)?document.activeElement.dataset.site:null;
    root.querySelectorAll('[data-layer]').forEach(button=>button.setAttribute('aria-pressed',String(state.layers[button.dataset.layer])));
    root.querySelector('.logistics-zoom').textContent=`${Math.round(state.zoom*100)}%`;
    root.querySelector('.logistics-locations').innerHTML=SITES.filter(siteVisible).map(site=>`<button data-vfd="button" data-action="site" data-site="${site.id}" aria-label="Select ${escape(site.name)} marker" aria-pressed="${site.id===state.selectedSite}">${escape(site.code)}</button>`).join('')||'<p data-vfd="label" class="muted">ENABLE SERVICES OR BASE TO SHOW LOCATIONS</p>';
    const site=SITES.find(site=>site.id===state.selectedSite)||SITES[0];
    root.querySelector('.logistics-location-detail').innerHTML=`<div class="row">${label(site.name.toUpperCase())}${label(`${site.risk.toUpperCase()} RISK`,`class="badge logistics-${site.risk}"`)}</div><p data-vfd="label" class="muted">${escape(site.detail)}</p><button data-vfd="button" data-action="site-alerts" data-site="${site.id}">RELATED ALERTS</button>`;
    if(focusedSite)root.querySelector(`.logistics-locations [data-site="${focusedSite}"]`)?.focus({preventScroll:true});
    persist();redraw();
  }
  function visibleAlerts(){
    const text=query.trim().toLowerCase();
    return ALERTS.filter(alert=>!state.dismissed.includes(alert.id))
      .filter(alert=>filter==='all'||filter==='critical'&&alert.priority===3||filter===alert.category||filter===alert.site)
      .filter(alert=>!text||`${alert.title} ${alert.subtitle} ${alert.detail} ${alert.site}`.toLowerCase().includes(text))
      .sort((a,b)=>state.sort==='priority'?b.priority-a.priority||b.time.localeCompare(a.time):state.sort==='oldest'?a.time.localeCompare(b.time):b.time.localeCompare(a.time));
  }
  function updateAlerts(){
    const active=document.activeElement,inDrawer=root.querySelector('.logistics-alerts').contains(active);
    const focus=root.querySelector('.logistics-alert-list').contains(active)?{action:active.dataset.action,id:active.dataset.alert,site:active.dataset.site}:null;
    root.querySelector('.logistics-alerts').hidden=!state.alertsOpen;layout.dataset.alertsOpen=String(state.alertsOpen);
    root.querySelector('.logistics-command-form [data-action="toggle-alerts"]').setAttribute('aria-pressed',String(state.alertsOpen));
    const alerts=visibleAlerts();root.querySelector('.logistics-alert-count').textContent=`${alerts.length} SAMPLE${alerts.length===1?'':'S'}`;
    root.querySelector('[data-action="restore"]').disabled=state.dismissed.length===0;
    root.querySelector('.logistics-alert-list').innerHTML=alerts.length?alerts.map(alert=>{
      const selected=state.selectedAlert===alert.id,site=SITES.find(site=>site.id===alert.site);
      return `<article class="card logistics-alert-card" data-vfd="panel"><div class="row">${label(alert.priority===3?'URGENT':'HIGH','class="badge logistics-high"')}${label(alert.time,'class="muted"')}</div><button data-vfd="button" data-action="alert" data-alert="${alert.id}" aria-label="Select alert ${escape(alert.title)}" aria-pressed="${selected}">${escape(alert.short)}</button><p data-vfd="label">${escape(alert.subtitle)}</p>${selected?`<p data-vfd="label" class="logistics-alert-detail">${escape(alert.detail)}</p><div class="logistics-alert-guidance"><span data-vfd="label" class="eyebrow">DEMO REVIEW STEP</span><p data-vfd="label" class="muted">${escape(alert.action)}</p></div><div class="row">${label('TRIGGERED','class="muted"')}${label('24 MAY 2024')}</div>`:''}<div class="toolbar"><button data-vfd="button" data-action="site" data-site="${alert.site}" aria-label="Focus ${escape(site.name)} on map">${escape(site.code)}</button><button data-vfd="button" data-action="dismiss" data-alert="${alert.id}" aria-label="Dismiss demo alert ${escape(alert.title)}">DISMISS</button></div></article>`;
    }).join(''):`<div class="empty"><h3 data-vfd="label">NO MATCHING ALERTS</h3><p data-vfd="label" class="muted">Clear the search or restore dismissed demo records.</p></div>`;
    if(!state.alertsOpen&&inDrawer)root.querySelector('.logistics-command-form [data-action="toggle-alerts"]').focus({preventScroll:true});
    else if(focus){const target=focus.id?root.querySelector(`.logistics-alert-list [data-action="${focus.action}"][data-alert="${focus.id}"]`):focus.site?root.querySelector(`.logistics-alert-list [data-action="${focus.action}"][data-site="${focus.site}"]`):null;(target||root.querySelector('.logistics-alert-list [data-action="alert"]')||alertInput).focus({preventScroll:true});}
    persist();redraw();
  }
  function focusSite(id){
    const site=SITES.find(item=>item.id===id);if(!site)return;
    state.selectedSite=id;state.layers[site.type==='base'?'base':'services']=true;
    if(mapWidth&&mapHeight){const [x,y]=point(site.lon,site.lat,mapWidth,mapHeight);state.panX=clamp(state.panX+(mapWidth/2-x)/mapWidth,-1,1);state.panY=clamp(state.panY+(mapHeight/2-y)/mapHeight,-1,1);}
    updateMap();
  }
  function resetMap(){state.zoom=1;state.panX=state.panY=0;updateMap();}
  function zoom(delta){state.zoom=clamp(state.zoom*(delta>0?1.2:1/1.2),.7,3);updateMap();}
  function command(value){
    const resolved=resolveLogisticsCommand(value);let message='';
    if(resolved.type==='focus'){focusSite(resolved.site);message=`FOCUSED ${SITES.find(site=>site.id===resolved.site).name.toUpperCase()}`;}
    else if(resolved.type==='reset'){resetMap();message='MAP RESET';}
    else if(resolved.type==='zoom'){zoom(resolved.delta);message=`MAP ZOOM ${Math.round(state.zoom*100)}%`;}
    else if(resolved.type==='layer'){state.layers[resolved.layer]=resolved.enabled;updateMap();message=`${resolved.layer.toUpperCase()} ${resolved.enabled?'ON':'OFF'}`;}
    else if(resolved.type==='alerts'){state.alertsOpen=true;filter=resolved.filter;query='';alertInput.value='';updateAlerts();message=resolved.filter==='critical'?'SHOWING URGENT SAMPLE ALERTS':'SHOWING ALL SAMPLE ALERTS';}
    else if(resolved.type==='restore'){state.dismissed=[];filter='all';query='';alertInput.value='';state.alertsOpen=true;updateAlerts();message='DEMO ALERTS RESTORED';}
    else message='TRY A LOCATION, SHOW URGENT, HIDE SERVICES, OR RESET MAP';
    commandStatus.textContent=`LOCAL DEMO / ${message}`;refresh();
  }
  on(root,'click',event=>{
    const button=event.target.closest('button[data-action]');if(!button||!root.contains(button))return;
    const action=button.dataset.action;
    if(action==='accordion'){const open=button.getAttribute('aria-expanded')!=='true';button.setAttribute('aria-expanded',String(open));root.querySelector(`#${button.getAttribute('aria-controls')}`).hidden=!open;redraw();}
    else if(action==='layer'){state.layers[button.dataset.layer]=!state.layers[button.dataset.layer];updateMap();}
    else if(action==='site')focusSite(button.dataset.site);
    else if(action==='pan'){state.panX=clamp(state.panX-Number(button.dataset.x)*.1,-1,1);state.panY=clamp(state.panY-Number(button.dataset.y)*.1,-1,1);updateMap();}
    else if(action==='zoom')zoom(Number(button.dataset.delta));
    else if(action==='reset')resetMap();
    else if(action==='toggle-alerts'){state.alertsOpen=!state.alertsOpen;updateAlerts();}
    else if(action==='filter'||action==='site-alerts'){filter=button.dataset.filter||button.dataset.site;state.alertsOpen=true;query='';alertInput.value='';updateAlerts();}
    else if(action==='clear-filter'){filter='all';query='';alertInput.value='';updateAlerts();}
    else if(action==='restore'){state.dismissed=[];updateAlerts();notify('Demo alerts restored.');}
    else if(action==='dismiss'){state.dismissed=[...new Set([...state.dismissed,button.dataset.alert])];if(state.selectedAlert===button.dataset.alert)state.selectedAlert=ALERTS.find(alert=>!state.dismissed.includes(alert.id))?.id||'';updateAlerts();notify('Demo alert dismissed. Restore brings it back.');}
    else if(action==='alert'){state.selectedAlert=button.dataset.alert;const alert=ALERTS.find(item=>item.id===state.selectedAlert);focusSite(alert.site);updateAlerts();}
    else if(action==='command'){commandInput.value=button.dataset.command;command(button.dataset.command);}
    else if(action==='readiness')navigate('home');
  });
  on(root.querySelector('form'),'submit',event=>{event.preventDefault();command(commandInput.value);});
  on(alertInput,'input',()=>{query=alertInput.value;updateAlerts();});
  on(sortInput,'change',()=>{state.sort=sortInput.value;updateAlerts();});
  on(canvas,'pointerdown',event=>{if(event.button!==0)return;canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);drag={id:event.pointerId,x:event.clientX,y:event.clientY,startX:event.clientX,startY:event.clientY};});
  on(canvas,'pointermove',event=>{if(!drag||drag.id!==event.pointerId)return;const rect=canvas.getBoundingClientRect();state.panX=clamp(state.panX+(event.clientX-drag.x)/Math.max(1,rect.width),-1,1);state.panY=clamp(state.panY+(event.clientY-drag.y)/Math.max(1,rect.height),-1,1);drag.x=event.clientX;drag.y=event.clientY;redraw();});
  const endDrag=event=>{if(!drag||drag.id!==event.pointerId)return;const moved=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);drag=null;if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);if(event.type==='pointerup'&&moved<5){const rect=canvas.getBoundingClientRect(),x=(event.clientX-rect.left)*mapWidth/rect.width,y=(event.clientY-rect.top)*mapHeight/rect.height;const hit=[...hits].reverse().find(hit=>Math.abs(x-hit.x)<=hit.radius&&Math.abs(y-hit.y)<=hit.radius);if(hit)focusSite(hit.id);}persist();};
  on(canvas,'pointerup',endDrag);on(canvas,'pointercancel',endDrag);
  on(canvas,'lostpointercapture',()=>{drag=null;});
  on(canvas,'wheel',event=>{event.preventDefault();zoom(event.deltaY<0?1:-1);},{passive:false});
  on(canvas,'keydown',event=>{
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='Home')resetMap();else if(['+','='].includes(event.key))zoom(1);else if(['-','_'].includes(event.key))zoom(-1);
    else if(event.key==='ArrowLeft'){state.panX=clamp(state.panX+.1,-1,1);updateMap();}else if(event.key==='ArrowRight'){state.panX=clamp(state.panX-.1,-1,1);updateMap();}
    else if(event.key==='ArrowUp'){state.panY=clamp(state.panY+.1,-1,1);updateMap();}else if(event.key==='ArrowDown'){state.panY=clamp(state.panY-.1,-1,1);updateMap();}else return;event.preventDefault();
  });
  const observer=new ResizeObserver(()=>{if(!layoutFrame)layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;if(alive)redraw();});});
  observer.observe(root);observer.observe(canvas);observer.observe(root.querySelector('.logistics-locations'));
  on(stylesheet,'load',redraw);
  updateMap();updateAlerts();
  return ()=>{alive=false;cancelAnimationFrame(layoutFrame);observer.disconnect();events.forEach(remove=>remove());delete canvas.vfdDraw;stylesheet.remove();host.replaceChildren();};
}

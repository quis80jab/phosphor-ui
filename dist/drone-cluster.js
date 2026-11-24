const FEEDS = ['color','thermal','zoom','depth'];
const number = value => Number.isFinite(value) ? value : null;
const heading = value => ((value % 360) + 360) % 360;

/** Presentation values come from the demo track, never the map camera pose. */
export function droneTelemetry(marker) {
  if (!marker || ![marker.heading,marker.yaw,marker.roll,marker.pitch,marker.altitude].every(Number.isFinite)) return null;
  return {
    id:String(marker.id || 'DEMO-01'), sensorKit:String(marker.sensorKit || 'RGB / TIR / DEPTH'),
    heading:heading(marker.heading), yaw:heading(marker.yaw), roll:marker.roll, pitch:marker.pitch,
    altitude:Math.max(0,marker.altitude), speed:number(marker.speed), held:!!marker.held,
    task:marker.directOperate ? 'DIRECT OPERATE' : marker.held ? 'HOLDING' : 'INSPECTING', source:marker.source === 'demo' ? 'DEMO TELEMETRY' : 'TELEMETRY'
  };
}

export function mountDroneCluster({viewport,canvas,onHold=()=>{},onLocate=()=>{},onDirectOperate=()=>{},refresh=()=>{}}) {
  const doc=viewport.ownerDocument || document, listeners=[];
  function node(tag,className='',text='',attributes={}) {
    const element=doc.createElement(tag);if(className)element.className=className;if(text)element.textContent=text;
    for(const [name,value] of Object.entries(attributes))element.setAttribute(name,String(value));
    return element;
  }
  function append(parent,...children){parent.append(...children);return parent;}
  function bind(element,type,listener,options){element.addEventListener(type,listener,options);listeners.push(()=>element.removeEventListener(type,listener,options));}
  function label(text,className='',extra={}){return node('span',className,text,{'data-vfd':'label',...extra});}
  function button(text,id,extra={}){return node('button','',text,{id,type:'button','data-vfd':'button',...extra});}
  const root=node('section','drone-cluster','',{id:'drone-cluster',role:'dialog','aria-modal':'false','aria-labelledby':'drone-cluster-title','data-vfd':'drone-panel'});
  root.hidden=true;
  const closeButton=button('CLOSE','drone-cluster-close',{'aria-label':'Close drone controls'});
  const title=node('h3','', 'DRONE CONTROL',{id:'drone-cluster-title','data-vfd':'label'});
  const header=append(node('header','drone-cluster-header','',{'data-vfd':'drone-header'}),title,closeButton);
  const status=label('DEMO TELEMETRY','drone-cluster-status',{'data-vfd-tone':'dim'});
  const grid=node('div','drone-cluster-grid');
  function identity(caption,id,value){
    const output=label(value,'drone-cluster-identity-value',{id,'data-vfd-lines':'2'});
    const field=append(node('div','drone-cluster-identity'),label(caption,'drone-cluster-caption',{'data-vfd-tone':'dim'}),output);
    grid.append(field);return output;
  }
  const id=identity('DRONE ID','drone-id','DEMO-01'),kit=identity('SENSOR KIT','drone-sensor-kit','RGB / TIR / DEPTH');
  function gauge(type,name,axis=''){
    const attributes={'data-vfd':type,role:'img','aria-label':`${name} telemetry unavailable`,'data-available':'false'};
    if(axis)attributes['data-axis']=axis;
    const element=node('div',`drone-gauge ${axis?'drone-gauge-small':'drone-gauge-primary'}`,`${name} --`,attributes);
    grid.append(element);return element;
  }
  const direction=gauge('drone-heading','Cardinal heading'),altitude=gauge('drone-altitude','Altitude');
  const yaw=gauge('drone-attitude','Yaw','yaw'),roll=gauge('drone-attitude','Roll','roll'),pitch=gauge('drone-attitude','Pitch','pitch');
  const task=label('INSPECTING','drone-cluster-task-value',{id:'drone-task','data-vfd-lines':'2'});
  const hold=button('HOLD','drone-hold',{'aria-label':'Hold demo drone','aria-pressed':'false'});
  const taskCard=append(node('div','drone-cluster-task'),label('TASK','drone-cluster-caption',{'data-vfd-tone':'dim'}),task,hold);grid.append(taskCard);
  const operate=button('DIRECT OPERATE','drone-direct-operate',{'aria-label':'Direct operate demo drone'});operate.className='drone-direct-button';grid.append(operate);
  const divider=label('FEEDS','drone-cluster-divider',{'data-vfd-tone':'dim'});grid.append(divider);
  const feedButtons=FEEDS.map(feed=>{
    const control=button(feed.toUpperCase(),`drone-feed-${feed}`,{'aria-label':`${feed[0].toUpperCase()+feed.slice(1)} sensor feed`,'aria-pressed':String(feed==='color')});
    grid.append(control);return control;
  });
  const previewLabel=label('SIMULATED SENSOR / COLOR','drone-feed-label',{'data-vfd-tone':'dim'});grid.append(previewLabel);
  const preview=node('div','drone-feed-preview','SIMULATED SENSOR',{'data-vfd':'drone-feed','data-feed':'color','data-zoom':'1','data-available':'false',role:'img','aria-label':'Simulated color sensor preview'});grid.append(preview);
  const zoomValue=label('1.0X','drone-sensor-zoom-value',{'data-vfd-align':'right'});
  const zoomHeading=append(node('div','drone-sensor-zoom-heading'),label('SENSOR ZOOM','',{'data-vfd-tone':'dim'}),zoomValue);
  const zoom=node('input','drone-sensor-zoom','',{id:'drone-sensor-zoom',type:'range',min:'1',max:'8',step:'.25',value:'1','aria-label':'Drone sensor zoom','data-vfd':'slider'});
  const zoomControl=append(node('div','drone-sensor-zoom-control'),zoomHeading,zoom);grid.append(zoomControl);
  append(root,header,status,grid);viewport.append(root);

  let latest=null,opened=false,destroyed=false,lastPaint=-Infinity,receivedHeld,receivedTask,signature='',feed='color',sensorZoom=1,returnFocus=null;
  const gauges=[direction,altitude,yaw,roll,pitch,preview];
  const text=(element,value)=>{if(element.textContent!==value)element.textContent=value;};
  const attribute=(element,key,value)=>{if(element.getAttribute(key)!==String(value))element.setAttribute(key,String(value));};
  const data=(element,key,value)=>{if(element.dataset[key]!==String(value))element.dataset[key]=String(value);};
  function paint(force=false){
    if(destroyed||!opened)return;
    const now=globalThis.performance?.now?.()??Date.now();
    if(!force&&now-lastPaint<100)return;
    const telemetry=droneTelemetry(latest),rounded=telemetry&&Object.fromEntries(Object.entries(telemetry).map(([key,value])=>[key,typeof value==='number'?value.toFixed(1):value]));
    const next=JSON.stringify([rounded,feed,sensorZoom]);
    if(next===signature&&!force)return;
    lastPaint=now;signature=next;
    const available=!!telemetry;
    for(const element of gauges)data(element,'available',available);
    if(hold.disabled===available)hold.disabled=!available;
    if(operate.disabled===available)operate.disabled=!available;
    text(status,available?telemetry.source:'TELEMETRY UNAVAILABLE');
    if(available){
      text(id,telemetry.id);text(kit,telemetry.sensorKit);text(task,telemetry.task);
      data(direction,'heading',rounded.heading);data(altitude,'altitude',rounded.altitude);
      for(const [element,key] of [[yaw,'yaw'],[roll,'roll'],[pitch,'pitch']]){
        data(element,'value',rounded[key]);text(element,`${key.toUpperCase()} ${rounded[key]} DEG`);attribute(element,'aria-label',`${key} ${rounded[key]} degrees`);
      }
      text(direction,`HEADING ${rounded.heading} DEG`);attribute(direction,'aria-label',`Cardinal heading ${rounded.heading} degrees`);
      text(altitude,`ALTITUDE ${rounded.altitude} M`);attribute(altitude,'aria-label',`Altitude ${rounded.altitude} metres`);
      for(const key of ['heading','roll','pitch'])data(preview,key,rounded[key]);
      attribute(hold,'aria-pressed',telemetry.held);attribute(hold,'aria-label',telemetry.held?'Resume demo inspection':'Hold demo drone');text(hold,telemetry.held?'RESUME':'HOLD');
    }else{
      text(task,'UNAVAILABLE');
      for(const [element,name] of [[direction,'Heading'],[altitude,'Altitude'],[yaw,'Yaw'],[roll,'Roll'],[pitch,'Pitch']]){text(element,`${name.toUpperCase()} --`);attribute(element,'aria-label',`${name} telemetry unavailable`);}
    }
    for(let i=0;i<feedButtons.length;i++)attribute(feedButtons[i],'aria-pressed',FEEDS[i]===feed);
    data(preview,'feed',feed);data(preview,'zoom',sensorZoom);
    text(previewLabel,`SIMULATED SENSOR / ${feed.toUpperCase()}`);attribute(preview,'aria-label',available?`Simulated ${feed} sensor preview, ${sensorZoom.toFixed(1)} times zoom`:'Simulated sensor preview unavailable');
    text(zoomValue,`${sensorZoom.toFixed(1)}X`);attribute(zoom,'aria-valuetext',`${sensorZoom.toFixed(1)} times sensor zoom`);
    refresh(root);
  }
  function open(marker){
    if(destroyed)return;
    if(marker!==undefined)latest=marker;
    if(!opened)returnFocus=doc.activeElement;
    opened=true;if(root.hidden)root.hidden=false;paint(true);
    closeButton.focus({preventScroll:true});
  }
  function close(){
    if(!opened||destroyed)return;
    opened=false;root.hidden=true;refresh(root);
    if(root.contains(doc.activeElement)){
      const target=returnFocus?.isConnected&&!returnFocus.closest?.('[hidden]')?returnFocus:canvas;
      target?.focus({preventScroll:true});
    }
  }
  function receive(marker){
    const stateChanged=marker?.held!==receivedHeld||marker?.task!==receivedTask;
    receivedHeld=marker?.held;receivedTask=marker?.task;latest=marker;
    if(!opened||destroyed)return;paint(marker===null||stateChanged);
  }
  bind(closeButton,'click',close);
  bind(operate,'click',()=>{if(droneTelemetry(latest))onDirectOperate();});
  bind(hold,'click',()=>{
    const telemetry=droneTelemetry(latest);if(!telemetry||destroyed)return;
    const held=!telemetry.held;
    if(onHold(held)===false)return;
    latest={...latest,held,task:held?'holding':'inspecting'};paint(true);
  });
  feedButtons.forEach((control,index)=>bind(control,'click',()=>{feed=FEEDS[index];paint(true);}));
  bind(zoom,'input',()=>{sensorZoom=Math.min(8,Math.max(1,Number(zoom.value)||1));paint(true);});
  bind(root,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}});
  for(const event of ['pointerdown','pointermove','pointerup','wheel'])bind(root,event,event=>event.stopPropagation());
  bind(root,'scroll',()=>refresh(root),{passive:true});
  return {root,open,receive,close,destroy(){if(destroyed)return;close();destroyed=true;listeners.forEach(remove=>remove());root.remove();refresh(root);}};
}

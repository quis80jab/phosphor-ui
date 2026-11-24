const zero = () => ({yaw:0,lift:0,forward:0,strafe:0});
const wrap = value => ((value % 360) + 360) % 360;

/** A circular, rescaled dead zone keeps diagonal commands inside the unit disc. */
export function joystickVector(x,y,deadZone=.06) {
  if(!Number.isFinite(x)||!Number.isFinite(y))return{x:0,y:0};
  const distance=Math.hypot(x,y),dead=Math.max(0,Math.min(.99,deadZone));
  if(distance<=dead)return{x:0,y:0};
  const amount=(Math.min(1,distance)-dead)/(1-dead);
  return{x:x/distance*amount,y:y/distance*amount};
}

/** Insets use CSS-pixel measurements normalized to the main canvas, top-left origin. */
export function normalizedOperateRect(rect,canvasRect) {
  if(!rect||!canvasRect||![rect.left,rect.top,rect.width,rect.height,canvasRect.left,canvasRect.top,canvasRect.width,canvasRect.height].every(Number.isFinite)||canvasRect.width<=0||canvasRect.height<=0)return null;
  const x=Math.max(0,Math.min(1,(rect.left-canvasRect.left)/canvasRect.width));
  const y=Math.max(0,Math.min(1,(rect.top-canvasRect.top)/canvasRect.height));
  const right=Math.max(x,Math.min(1,(rect.left+rect.width-canvasRect.left)/canvasRect.width));
  const bottom=Math.max(y,Math.min(1,(rect.top+rect.height-canvasRect.top)/canvasRect.height));
  return{x,y,width:right-x,height:bottom-y};
}

function telemetry(marker) {
  if(!marker||!['heading','altitude','yaw','roll','pitch','speed'].every(key=>Number.isFinite(marker[key])))return null;
  return{...marker,heading:wrap(marker.heading),yaw:wrap(marker.yaw)};
}

export function mountDirectOperate({viewport,canvas,onInput=()=>{},onExit=()=>{},onLayout=()=>{},refresh=()=>{}}) {
  const doc=viewport.ownerDocument||document,win=doc.defaultView||globalThis,listeners=[];
  let opened=false,destroyed=false,latest=null,returnFocus=null,axes=zero(),lastPaint=-Infinity,paintTimer=null,layoutFrame=null;
  const now=()=>globalThis.performance?.now?.()??Date.now();
  function node(tag,className='',text='',attributes={}) {
    const element=doc.createElement(tag);element.className=className;element.textContent=text;
    for(const[key,value]of Object.entries(attributes))element.setAttribute(key,String(value));
    return element;
  }
  function bind(element,type,listener,options){if(!element?.addEventListener)return;element.addEventListener(type,listener,options);listeners.push(()=>element.removeEventListener(type,listener,options));}
  function append(parent,...children){parent.append(...children);return parent;}
  function label(text,className='',extra={}){return node('span',className,text,{'data-vfd':'label',...extra});}
  function button(text,id,aria){return node('button','',text,{id,type:'button','data-vfd':'button','aria-label':aria});}
  const root=node('section','direct-operate','',{id:'direct-operate',role:'dialog','aria-modal':'false','aria-labelledby':'direct-operate-title'});
  root.hidden=true;
  const exitButton=button('EXIT','direct-operate-exit','Exit direct operate');
  const header=append(node('header','direct-operate-header'),node('h3','', 'DIRECT OPERATE / DEMO',{id:'direct-operate-title','data-vfd':'label'}),exitButton);
  const status=label('WAITING FOR TELEMETRY','direct-operate-status',{'data-vfd-tone':'dim'});
  const gps=label('GPS --','direct-operate-position',{'aria-label':'Drone GPS unavailable'});
  const hud=node('div','direct-operate-telemetry','',{'aria-label':'Drone telemetry'});
  const instruments=new Map(['heading','altitude','speed','yaw','roll','pitch'].map(axis=>{
    const field=node('div','direct-operate-instrument',`${axis.toUpperCase()} --`,{'data-vfd':'operate-hud','data-axis':axis,'data-available':'false',role:'img','aria-label':`${axis} unavailable`});
    hud.append(field);return[axis,field];
  }));
  const cameraLabel=label('THIRD PERSON / CHASE','direct-operate-camera-label',{'data-vfd-tone':'dim'});
  const controls=node('div','direct-operate-controls');
  function makeStick(side,title,description) {
    const stick=node('div','direct-operate-stick',description,{id:`direct-operate-${side}`,'data-vfd':'operate-stick','data-side':side,'data-x':'0','data-y':'0','data-available':'false',role:'group','aria-roledescription':'two-axis joystick','aria-label':description,'aria-disabled':'true'});
    const reset=button('CENTER',`direct-operate-${side}-reset`,`Center ${side} joystick`);
    const box=append(node('div',`direct-operate-stick-column direct-operate-${side}`),label(title,'direct-operate-stick-title'),stick,reset);
    return{side,title,description,element:stick,reset,box,pointer:null,x:0,y:0};
  }
  const left=makeStick('left','LIFT / YAW','Left joystick: up and down control altitude; left and right control yaw');
  const right=makeStick('right','MOVE / STRAFE','Right joystick: up and down move forward and back; left and right strafe');
  const map=node('div','direct-operate-map direct-operate-inset','MAP / TOP',{'data-vfd':'operate-frame','data-side':'map',role:'img','aria-label':'Top-down map following the drone'});
  const feed=node('div','direct-operate-feed direct-operate-inset','CAMERA / DEMO',{'data-vfd':'operate-frame','data-side':'feed',role:'img','aria-label':'Simulated onboard camera showing the map from the drone'});
  const stack=append(node('div','direct-operate-insets'),map,feed);
  append(controls,left.box,stack,right.box);append(root,header,status,gps,hud,cameraLabel,controls);viewport.append(root);
  const sticks=[left,right];
  function data(element,key,value){const next=String(value);if(element.dataset[key]!==next)element.dataset[key]=next;}
  function text(element,value){if(element.textContent!==value)element.textContent=value;}
  function attr(element,key,value){const next=String(value);if(element.getAttribute(key)!==next)element.setAttribute(key,next);}
  function emit(){onInput({...axes});}
  function paintStick(stick) {
    data(stick.element,'x',stick.x.toFixed(4));data(stick.element,'y',stick.y.toFixed(4));
    const horizontal=stick.side==='left'?'yaw':'strafe',vertical=stick.side==='left'?'lift':'forward';
    attr(stick.element,'aria-label',`${stick.description}. ${horizontal} ${Math.round(stick.x*100)} percent, ${vertical} ${Math.round(stick.y*100)} percent`);
    text(stick.element,`${stick.title}: ${Math.round(stick.x*100)} / ${Math.round(stick.y*100)}`);
  }
  function setStick(stick,x,y) {
    stick.x=x;stick.y=y;
    if(stick.side==='left'){axes.yaw=x;axes.lift=y;}else{axes.strafe=x;axes.forward=y;}
    paintStick(stick);emit();refresh(root);
  }
  function release(stick,notify=true) {
    const pointer=stick.pointer;stick.pointer=null;
    if(pointer!==null){try{stick.element.releasePointerCapture?.(pointer);}catch{ /* Capture can already be lost. */ }}
    if(notify)setStick(stick,0,0);else{stick.x=0;stick.y=0;paintStick(stick);}
  }
  function clear() {
    sticks.forEach(stick=>release(stick,false));axes=zero();emit();if(opened)refresh(root);
  }
  function measure() {
    if(!opened||destroyed)return;
    const base=canvas.getBoundingClientRect();
    onLayout({map:normalizedOperateRect(map.getBoundingClientRect(),base),feed:normalizedOperateRect(feed.getBoundingClientRect(),base)});
  }
  function scheduleLayout() {
    if(!opened||destroyed)return;
    measure();
    if(layoutFrame===null&&win.requestAnimationFrame)layoutFrame=win.requestAnimationFrame(()=>{layoutFrame=null;measure();refresh(root);});
  }
  function paint(force=false) {
    if(!opened||destroyed)return;
    const delay=100-(now()-lastPaint);
    if(!force&&delay>0){
      if(paintTimer===null)paintTimer=win.setTimeout(()=>{paintTimer=null;paint(true);},delay);
      return;
    }
    if(paintTimer!==null){win.clearTimeout(paintTimer);paintTimer=null;}
    lastPaint=now();const value=telemetry(latest),available=!!value;
    text(status,available?`${value.id||'DEMO-01'} / MANUAL / ${value.held?'HOLD':'DIRECT'} / DEMO TELEMETRY`:'TELEMETRY UNAVAILABLE / CONTROLS NEUTRAL');
    const hasGps=available&&Number.isFinite(value.latitude)&&Number.isFinite(value.longitude);
    const coordinates=hasGps?`${Math.abs(value.latitude).toFixed(6)}${value.latitude>=0?'N':'S'} / ${Math.abs(value.longitude).toFixed(6)}${value.longitude>=0?'E':'W'}`:'--';
    text(gps,`GPS ${coordinates}`);attr(gps,'aria-label',hasGps?`Drone GPS latitude ${value.latitude.toFixed(6)}, longitude ${value.longitude.toFixed(6)}`:'Drone GPS unavailable');
    for(const[axis,element]of instruments){
      data(element,'available',available);data(element,'value',available?value[axis].toFixed(1):'');
      const unit=axis==='altitude'?'metres':axis==='speed'?'metres per second':'degrees';
      attr(element,'aria-label',available?`${axis} ${value[axis].toFixed(1)} ${unit}`:`${axis} unavailable`);
      text(element,`${axis.toUpperCase()} ${available?value[axis].toFixed(1):'--'}`);
    }
    for(const stick of sticks){data(stick.element,'available',available);attr(stick.element,'aria-disabled',!available);stick.reset.disabled=!available;}
    refresh(root);
  }
  function open(marker) {
    if(destroyed)return;
    if(marker!==undefined)latest=marker;
    if(!opened)returnFocus=doc.activeElement;
    opened=true;root.hidden=false;clear();paint(true);scheduleLayout();exitButton.focus({preventScroll:true});
  }
  function close() {
    if(destroyed||!opened)return;
    clear();opened=false;root.hidden=true;
    if(paintTimer!==null){win.clearTimeout(paintTimer);paintTimer=null;}
    if(layoutFrame!==null){win.cancelAnimationFrame?.(layoutFrame);layoutFrame=null;}
    onLayout({map:null,feed:null});refresh(root);
    if(root.contains(doc.activeElement)){
      const target=returnFocus?.isConnected&&!returnFocus.closest?.('[hidden]')?returnFocus:canvas;
      target?.focus({preventScroll:true});
    }
  }
  function receive(marker) {
    const wasAvailable=!!telemetry(latest),value=telemetry(marker);
    const stateChanged=marker?.held!==latest?.held||marker?.task!==latest?.task;
    latest=marker;
    if(!opened||destroyed)return;
    if(!value&&wasAvailable)clear();
    paint(!value||!wasAvailable||stateChanged);
  }
  function exit(){if(!opened||destroyed)return;onExit();close();}
  for(const stick of sticks){
    function move(event){
      if(stick.pointer!==event.pointerId)return;
      event.preventDefault();event.stopPropagation();
      const rect=stick.element.getBoundingClientRect(),radius=Math.min(rect.width,rect.height)*.35;
      const vector=joystickVector((event.clientX-rect.left-rect.width/2)/radius,(rect.top+rect.height/2-event.clientY)/radius);
      setStick(stick,vector.x,vector.y);
    }
    bind(stick.element,'pointerdown',event=>{
      event.preventDefault();event.stopPropagation();
      if(!opened||destroyed||!telemetry(latest)||stick.pointer!==null||(event.pointerType==='mouse'&&event.button!==0))return;
      // A second touch is deliberately accepted even when isPrimary is false.
      stick.pointer=event.pointerId;
      try{stick.element.setPointerCapture?.(event.pointerId);}catch{stick.pointer=null;return;}
      move(event);
    });
    bind(stick.element,'pointermove',move);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])bind(stick.element,type,event=>{
      if(stick.pointer!==event.pointerId)return;event.preventDefault();event.stopPropagation();release(stick);
    });
    bind(stick.reset,'click',()=>release(stick));
    bind(stick.element,'contextmenu',event=>event.preventDefault());
  }
  bind(exitButton,'click',exit);
  bind(root,'keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();exit();}});
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','wheel'])bind(root,type,event=>event.stopPropagation());
  bind(win,'blur',()=>{if(opened)clear();});
  bind(doc,'visibilitychange',()=>{if(opened&&doc.visibilityState==='hidden')clear();});
  bind(win,'resize',scheduleLayout,{passive:true});bind(win,'scroll',scheduleLayout,{passive:true,capture:true});
  const Observer=win.ResizeObserver||globalThis.ResizeObserver;
  const observer=Observer?new Observer(scheduleLayout):null;
  if(observer)for(const element of[canvas,root,map,feed])observer.observe(element);
  return{root,open,close,receive,destroy(){if(destroyed)return;close();destroyed=true;observer?.disconnect();listeners.forEach(remove=>remove());root.remove();refresh(root);}};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import{joystickVector,normalizedOperateRect,mountDirectOperate}from'../dist/direct-operate.js';

const marker={id:'DEMO-01',heading:190.25,yaw:190.25,roll:12,pitch:-4,altitude:28,speed:6,held:false,task:'direct',source:'demo'};
const neutral={yaw:0,lift:0,forward:0,strafe:0};
function fixture(){
  let now=0;const old=Object.getOwnPropertyDescriptor(globalThis,'performance');
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  const doc=new EventTarget(),win=new EventTarget(),timers=new Map();let nextTimer=0;
  Object.assign(doc,{activeElement:null,visibilityState:'visible',defaultView:win,createElement:tag=>new Element(tag)});
  Object.assign(win,{setTimeout:callback=>{timers.set(++nextTimer,callback);return nextTimer;},clearTimeout:id=>timers.delete(id)});
  class Element extends EventTarget{
    constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.ownerDocument=doc;this.isConnected=true;this.rect={left:0,top:0,width:160,height:160};this.captured=new Set();}
    append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}}
    setAttribute(name,value){this.attrs[name]=String(value);if(name==='id')this.id=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
    getAttribute(name){return this.attrs[name]??null;}
    getBoundingClientRect(){return this.rect;}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    closest(selector){if(selector==='[hidden]')for(let node=this;node;node=node.parentElement)if(node.hidden)return node;return null;}
    focus(){doc.activeElement=this;}
    setPointerCapture(id){this.captured.add(id);}
    releasePointerCapture(id){if(this.captured.delete(id))this.dispatchEvent(pointer('lostpointercapture',id,0,0));}
    remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);}
  }
  const viewport=new Element('div'),canvas=new Element('canvas'),opener=new Element('button');viewport.append(canvas,opener);opener.focus();
  canvas.rect={left:100,top:50,width:800,height:600};
  const inputs=[],layouts=[];let exits=0,refreshes=0;
  const ui=mountDirectOperate({viewport,canvas,onInput:value=>inputs.push(value),onExit:()=>exits++,onLayout:value=>layouts.push(value),refresh:()=>refreshes++});
  const find=(predicate,node=ui.root)=>predicate(node)?node:node.children.map(child=>find(predicate,child)).find(Boolean);
  const left=find(node=>node.id==='direct-operate-left'),right=find(node=>node.id==='direct-operate-right');
  left.rect={left:120,top:450,width:160,height:160};right.rect={left:720,top:450,width:160,height:160};
  find(node=>node.dataset.side==='map').rect={left:300,top:300,width:400,height:120};
  find(node=>node.dataset.side==='feed').rect={left:280,top:430,width:440,height:200};
  return{ui,doc,win,canvas,opener,left,right,inputs,layouts,exits:()=>exits,refreshes:()=>refreshes,byId:id=>find(node=>node.id===id),field:axis=>find(node=>node.dataset.axis===axis),
    advance:ms=>now+=ms,flush:()=>{const queued=[...timers.values()];timers.clear();queued.forEach(callback=>callback());},restore:()=>{ui.destroy();Object.defineProperty(globalThis,'performance',old);}};
}
function pointer(type,id,x,y,extra={}){const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0,isPrimary:id===1,...extra});return event;}
function gesture(element,type,id,x,y,extra={}){const rect=element.rect,radius=Math.min(rect.width,rect.height)*.35;element.dispatchEvent(pointer(type,id,rect.left+rect.width/2+x*radius,rect.top+rect.height/2-y*radius,extra));}

test('circular dead zone is continuous and diagonal commands cannot exceed full input',()=>{
  assert.deepEqual(joystickVector(.03,-.04),{x:0,y:0});assert.deepEqual(joystickVector(NaN,1),{x:0,y:0});
  assert.ok(Math.abs(joystickVector(.53,0).x-.5)<1e-12);
  const diagonal=joystickVector(10,10);assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-12);
  assert.ok(Math.abs(diagonal.x-Math.SQRT1_2)<1e-12);assert.ok(joystickVector(.060001,0).x<.00001);
});

test('two simultaneous touch IDs merge all four axes, including non-primary touch',()=>{
  const f=fixture();try{
    f.ui.open(marker);gesture(f.left,'pointerdown',1,.8,.6);gesture(f.right,'pointerdown',2,-.6,.8,{isPrimary:false});
    const input=f.inputs.at(-1);for(const[key,value]of Object.entries({yaw:.8,lift:.6,forward:.8,strafe:-.6}))assert.ok(Math.abs(input[key]-value)<1e-10,key);
    assert.equal(f.left.captured.has(1),true);assert.equal(f.right.captured.has(2),true);
    const count=f.inputs.length;gesture(f.left,'pointerdown',3,-1,-1);assert.equal(f.inputs.length,count,'a third pointer cannot steal an occupied stick');
    gesture(f.left,'pointerup',1,.8,.6);assert.equal(f.inputs.at(-1).yaw,0);assert.equal(f.inputs.at(-1).lift,0);assert.ok(f.inputs.at(-1).forward>.79);
    gesture(f.right,'lostpointercapture',2,-.6,.8);assert.deepEqual(f.inputs.at(-1),neutral);
  }finally{f.restore();}
});

test('cancel, center reset, hidden document and blur neutralize input without keyboard flight',()=>{
  const f=fixture();try{
    f.ui.open(marker);gesture(f.left,'pointerdown',1,1,0);gesture(f.right,'pointerdown',2,0,1);
    gesture(f.left,'pointercancel',1,1,0);assert.equal(f.inputs.at(-1).yaw,0);assert.equal(f.inputs.at(-1).forward,1);
    f.byId('direct-operate-right-reset').dispatchEvent(new Event('click'));assert.deepEqual(f.inputs.at(-1),neutral);
    gesture(f.left,'pointerdown',1,1,0);f.win.dispatchEvent(new Event('blur'));assert.deepEqual(f.inputs.at(-1),neutral);
    gesture(f.right,'pointerdown',2,0,1);f.doc.visibilityState='hidden';f.doc.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(f.inputs.at(-1),neutral);
    const count=f.inputs.length,event=new Event('keydown',{cancelable:true});event.key='ArrowUp';f.ui.root.dispatchEvent(event);assert.equal(f.inputs.length,count);
  }finally{f.restore();}
});

test('telemetry drives the HUD, trailing throttled sample renders, and data loss disables commands',()=>{
  const f=fixture();try{
    f.ui.receive({...marker,heading:-10});f.ui.open();assert.equal(f.field('heading').dataset.value,'350.0');
    f.advance(10);f.ui.receive({...marker,roll:22});assert.equal(f.field('roll').dataset.value,'12.0');f.advance(100);f.flush();assert.equal(f.field('roll').dataset.value,'22.0');
    gesture(f.left,'pointerdown',1,0,1);f.ui.receive(null);assert.deepEqual(f.inputs.at(-1),neutral);assert.equal(f.field('roll').dataset.available,'false');
    assert.equal(f.left.getAttribute('aria-disabled'),'true');const count=f.inputs.length;gesture(f.left,'pointerdown',1,1,0);assert.equal(f.inputs.length,count);
    f.ui.receive(marker);assert.equal(f.left.getAttribute('aria-disabled'),'false');assert.equal(f.field('roll').dataset.value,'12.0');
  }finally{f.restore();}
});

test('open, resize and scroll report normalized map/camera layouts, close clears them and returns focus',()=>{
  const f=fixture();try{
    f.ui.open(marker);assert.equal(f.doc.activeElement,f.byId('direct-operate-exit'));
    assert.deepEqual(f.layouts.at(-1).map,{x:.25,y:250/600,width:.5,height:.2});
    for(const[key,value]of Object.entries({x:.225,y:380/600,width:.55,height:200/600}))assert.ok(Math.abs(f.layouts.at(-1).feed[key]-value)<1e-12);
    const count=f.layouts.length;f.win.dispatchEvent(new Event('resize'));f.win.dispatchEvent(new Event('scroll'));assert.equal(f.layouts.length,count+2);
    gesture(f.left,'pointerdown',1,1,0);f.byId('direct-operate-exit').dispatchEvent(new Event('click'));
    assert.equal(f.exits(),1);assert.equal(f.ui.root.hidden,true);assert.deepEqual(f.inputs.at(-1),neutral);assert.deepEqual(f.layouts.at(-1),{map:null,feed:null});assert.equal(f.doc.activeElement,f.opener);
    f.ui.open();const escape=new Event('keydown',{cancelable:true});escape.key='Escape';f.ui.root.dispatchEvent(escape);assert.equal(f.exits(),2);
    f.ui.destroy();const after=f.inputs.length;f.win.dispatchEvent(new Event('blur'));f.ui.open(marker);assert.equal(f.inputs.length,after);assert.equal(f.ui.root.isConnected,false);
  }finally{f.restore();}
});

test('normalization clips insets to the canvas and rejects a collapsed main canvas',()=>{
  const base={left:100,top:50,width:200,height:100};
  assert.deepEqual(normalizedOperateRect({left:50,top:25,width:150,height:100},base),{x:0,y:0,width:.5,height:.75});
  assert.equal(normalizedOperateRect(base,{...base,width:0}),null);
});

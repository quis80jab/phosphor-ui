import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPhosphorKit,normalizeKitControl,normalizeKitOptics,measureKitClip,resolveKitLayout,PIXEL_PITCH,UI_CELL,UI_PIXELS,BENCH_CATALOG} from '../dist/phosphor-kit.js';

const controls=[
  {id:'power',type:'toggle',label:'OUTPUT',value:true,layout:{column:1,row:1,columns:12,rows:3}},
  {id:'level',type:'slider',label:'LEVEL',value:40,min:0,max:100,layout:{column:14,row:1,columns:20,rows:3}},
  {id:'query',type:'search',label:'SEARCH',layout:{column:1,row:5,columns:33,rows:3}},
  {id:'capture',type:'button',label:'CAPTURE',layout:{column:1,row:9,columns:12,rows:3}},
  {id:'value',type:'label',value:'40%',layout:{column:14,row:9,columns:20,rows:3}}
];
function fixture(){
  let frameId=0;const frames=new Map(),changes=[],renderers=[],observers=[];
  const win=new EventTarget();Object.assign(win,{innerWidth:800,innerHeight:600,requestAnimationFrame:cb=>{frames.set(++frameId,cb);return frameId;},cancelAnimationFrame:id=>frames.delete(id),getComputedStyle:()=>({display:'block'}),ResizeObserver:class{constructor(cb){this.cb=cb;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}});
  let doc;
  class Element extends EventTarget{
    constructor(tag){super();this.tagName=tag.toUpperCase();this.style={};this.dataset={};this.attrs={};this.children=[];this.textContent='';this.value='';this.ownerDocument=doc;this.isConnected=true;this.disabled=false;}
    append(...children){for(const child of children){child.parentElement=this;this.children.push(child);}}
    setAttribute(key,value){this.attrs[key]=String(value);}
    getAttribute(key){return this.attrs[key]??null;}
    closest(selector){if(selector==='[hidden]')for(let n=this;n;n=n.parentElement)if(n.hidden)return n;return null;}
    getBoundingClientRect(){const p=this.parentElement?.getBoundingClientRect?.()||{left:0,top:0};const left=p.left+(parseFloat(this.style.left)||0),top=p.top+(parseFloat(this.style.top)||0),width=parseFloat(this.style.width)||this.baseWidth||0,height=parseFloat(this.style.height)||0;return{left,top,width,height,right:left+width,bottom:top+height};}
    getContext(){return{globalAlpha:1,clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},fillRect(){}};}
    remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(child=>child!==this);}
  }
  doc={defaultView:win,activeElement:null,createElement:tag=>new Element(tag)};doc.head=new Element('head');doc.body=new Element('body');
  const container=new Element('div');container.baseWidth=48*UI_CELL;doc.body.append(container);
  function rendererFactory(){const r={invalidations:0,patterns:[],optics:[],invalidate(){this.invalidations++;},setPattern(value){this.patterns.push(value);},setOptics(value){this.optics.push(value);},destroy(){this.destroyed=true;}};renderers.push(r);return r;}
  const mount=(extra={})=>mountPhosphorKit({container,controls,columns:48,onChange:change=>changes.push(change),rendererFactory,...extra});
  function flush(){const tasks=[...frames.values()];frames.clear();for(const task of tasks)task();}
  return{win,doc,container,changes,renderers,observers,frames,mount,flush};
}

test('kit validates stable component identities and bounds untrusted values',()=>{
  assert.throws(()=>normalizeKitControl({id:'../x',type:'button'}),/stable/);
  assert.throws(()=>normalizeKitControl({id:'x',type:'unknown'}),/Unsupported/);
  assert.equal(normalizeKitControl({id:'x',type:'slider',min:0,max:100,value:999}).value,100);
  assert.equal(normalizeKitControl({id:'x',type:'slider',min:0,max:99,step:10,value:999}).value,90);
  assert.equal(normalizeKitControl({id:'x',type:'slider',min:0,max:100,step:.25,value:12.31}).value,12.25);
  assert.equal(normalizeKitControl({id:'x',type:'toggle',value:'true'}).value,false);
  const f=fixture();assert.throws(()=>f.mount({controls:[controls[0],controls[0]]}),/unique/);
  assert.equal(f.container.children.length,0,'invalid mount has no DOM side effects');
  assert.equal(UI_CELL,PIXEL_PITCH*UI_PIXELS);assert.equal(BENCH_CATALOG.length,12);
});

test('narrow reflow preserves integer cell spans and never scales control heights',()=>{
  const normalized=controls.map(normalizeKitControl),wide=resolveKitLayout(normalized,48,48),narrow=resolveKitLayout(normalized,20,48);
  assert.equal(wide.items[1].column,14);assert.equal(narrow.items[1].column,0);
  assert.equal(narrow.items[1].row,4);assert.equal(narrow.items[1].rows,wide.items[1].rows);
  for(const item of narrow.items){assert.ok(Object.values(item).filter(value=>typeof value==='number').every(Number.isInteger));assert.ok(item.columns<=20);}
  assert.equal(narrow.rows,19);
});

test('unsafe slider ranges reject before mounting while precise origins survive round trips',()=>{
  for(const range of[{min:-1e308,max:1e308,value:1e308},{min:1e308,max:1e308},{min:4,max:4},{min:10,max:2},{min:0,max:Infinity},{min:0,max:1,step:0},{min:0,max:1,step:NaN},{min:1e12-1,max:1e12,step:1e-12}]){
    assert.throws(()=>normalizeKitControl({id:'range',type:'slider',...range}),RangeError);
  }
  for(const range of[{min:100000000000.1,max:100000000001,step:.1,value:100000000000.1},{min:.1234567890123,max:1,step:.1,value:.1234567890123}]){
    const normalized=normalizeKitControl({id:'range',type:'slider',...range});assert.equal(normalized.value,range.min);
    assert.ok(normalized.value>=normalized.min&&normalized.value<=normalized.max);
    assert.deepEqual(normalizeKitControl(JSON.parse(JSON.stringify(normalized))),normalized);
  }
  assert.equal(normalizeKitControl({id:'range',type:'slider',min:.1,max:.3,step:.1,value:.3}).value,.3);
  const f=fixture();assert.throws(()=>f.mount({controls:[{id:'range',type:'slider',min:-1e308,max:1e308}]}),RangeError);assert.equal(f.container.children.length,0);
});

test('optics save only the effective finite shader values, including invalid patches',()=>{
  const optics=normalizeKitOptics({brightness:Infinity,glow:NaN,contrast:-100,grid:900,refraction:undefined,unrelated:Infinity});
  assert.deepEqual(optics,{brightness:110,glow:40,contrast:50,grid:100,refraction:0});
  const f=fixture(),kit=f.mount({optics});kit.setOptics({glow:70});kit.setOptics({glow:NaN,brightness:Infinity});
  assert.equal(kit.getState().optics.glow,70);assert.equal(kit.getState().optics.brightness,110);
  assert.deepEqual(JSON.parse(JSON.stringify(kit.getState())).optics,kit.getState().optics);
  assert.deepEqual(f.renderers[0].optics.at(-1),kit.getState().optics);kit.destroy();
});

test('portalled optics obey nested scroll clipping and ancestor visibility',()=>{
  const node=(rect,style={},parentElement=null)=>({getBoundingClientRect:()=>rect,style,parentElement,closest:()=>null});
  const outer=node({left:10,top:20,right:310,bottom:220,width:300,height:200},{overflow:'hidden',opacity:'.5'});
  const inner=node({left:30,top:40,right:250,bottom:400,width:220,height:360},{overflowX:'auto',overflowY:'visible'},outer);
  const element=node({left:0,top:0,right:500,bottom:500,width:500,height:500},{},inner);
  const win={innerWidth:800,innerHeight:600,getComputedStyle:element=>({display:'block',visibility:'visible',...element.style})};
  assert.deepEqual(measureKitClip(element,win),{left:30,top:20,right:250,bottom:220,opacity:.5});
  outer.style.visibility='hidden';assert.equal(measureKitClip(element,win),null);
  outer.style.visibility='visible';outer.style.display='none';assert.equal(measureKitClip(element,win),null);
  outer.style.display='block';outer.style.opacity='0';assert.equal(measureKitClip(element,win),null);
});

test('native actions update host state; programmatic updates stay silent and disabled actions stay inert',()=>{
  const f=fixture(),kit=f.mount();
  kit.getControlElement('power').dispatchEvent(new Event('click'));assert.equal(kit.getValues().power,false);
  const range=kit.getControlElement('level');range.value='82';range.dispatchEvent(new Event('input'));
  const search=kit.getControlElement('query');search.value='DEPTH';search.dispatchEvent(new Event('input'));
  kit.getControlElement('capture').dispatchEvent(new Event('click'));assert.equal(kit.getValues().capture,1);
  assert.deepEqual(f.changes.map(change=>[change.id,change.value]),[['power',false],['level',82],['query','DEPTH'],['capture',1]]);
  assert.equal(f.changes[3].values.level,82);assert.equal(f.changes[3].event.type,'click');
  kit.update('level',{value:30});assert.equal(range.value,'30');assert.equal(f.changes.length,4);
  kit.update('capture',{disabled:true});kit.getControlElement('capture').dispatchEvent(new Event('click'));assert.equal(f.changes.length,4);
  assert.throws(()=>kit.update('level',{type:'label'}),/cannot change/);
  assert.throws(()=>kit.update('missing',{value:2}),/Unknown control/);
  kit.destroy();
});

test('kit keeps a portable state snapshot and cleans DOM, observers, renderer and pending frames',()=>{
  const f=fixture(),kit=f.mount();
  assert.equal(kit.element.dataset.rendered,'true');assert.equal(kit.canvas.style.width,'100vw');
  kit.setOptics({glow:75});kit.setPattern('hashes');kit.update('value',{value:'75%'});f.flush();
  const saved=kit.getState();assert.equal(saved.format,'phosphor-kit');assert.equal(saved.version,1);assert.equal(saved.optics.glow,75);assert.equal(saved.pattern,'hashes');
  saved.controls[0].layout.column=500;saved.optics.glow=1;assert.equal(kit.getState().controls[0].layout.column,1);assert.equal(kit.getState().optics.glow,75);
  assert.equal(f.renderers[0].patterns.at(-1),'hashes');assert.ok(f.renderers[0].invalidations>0);
  const oldControl=kit.getControlElement('capture');f.win.dispatchEvent(new Event('resize'));assert.ok(f.frames.size>0);
  kit.destroy();kit.destroy();assert.equal(f.frames.size,0);assert.equal(f.renderers[0].destroyed,true);assert.equal(f.observers[0].disconnected,true);
  assert.equal(f.container.children.length,0);assert.equal(f.doc.head.children.length,0);assert.equal(kit.canvas.isConnected,false);
  oldControl.dispatchEvent(new Event('click'));assert.equal(f.changes.length,0);assert.equal(kit.update('level',{value:20}),false);
});

test('a missing GPU retains accessible native controls instead of a blank interface',()=>{
  const f=fixture(),kit=f.mount({rendererFactory(){throw new Error('No WebGL');}});
  assert.equal(kit.element.dataset.rendered,'false');assert.equal(kit.canvas.hidden,true);
  kit.getControlElement('power').dispatchEvent(new Event('click'));assert.equal(kit.getValues().power,false);assert.equal(f.changes.length,1);
  kit.destroy();
});

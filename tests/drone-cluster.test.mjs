import test from 'node:test';
import assert from 'node:assert/strict';
import {droneTelemetry,mountDroneCluster} from '../dist/drone-cluster.js';

const marker={id:'DEMO-01',sensorKit:'RGB / TIR / DEPTH',heading:190.25,yaw:190.25,roll:21.9,pitch:0,altitude:8,speed:6.28,held:false,task:'inspecting',source:'demo',visible:true};

function fixture(){
  let now=0;const old=Object.getOwnPropertyDescriptor(globalThis,'performance');
  Object.defineProperty(globalThis,'performance',{configurable:true,value:{now:()=>now}});
  class Element extends EventTarget{
    constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.hidden=false;this.disabled=false;this.textContent='';this.value='';this.ownerDocument=doc;this.isConnected=true;}
    append(...children){for(const child of children){this.children.push(child);child.parentElement=this;}}
    setAttribute(name,value){this.attrs[name]=String(value);if(name==='id')this.id=value;if(name==='value')this.value=value;if(name.startsWith('data-'))this.dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);}
    getAttribute(name){return this.attrs[name]??null;}
    contains(node){return this===node||this.children.some(child=>child.contains(node));}
    closest(selector){if(selector==='[hidden]')for(let node=this;node;node=node.parentElement)if(node.hidden)return node;return null;}
    focus(){doc.activeElement=this;}
    remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(node=>node!==this);}
  }
  const doc={activeElement:null,createElement:tag=>new Element(tag)};
  const viewport=new Element('div'),canvas=new Element('canvas'),opener=new Element('button');viewport.append(canvas,opener);opener.focus();
  let refreshes=0,operates=0;const holds=[];
  const cluster=mountDroneCluster({viewport,canvas,onHold:held=>{holds.push(held);return true;},onDirectOperate:()=>operates++,refresh:()=>refreshes++});
  const find=(predicate,node=cluster.root)=>predicate(node)?node:node.children.map(child=>find(predicate,child)).find(Boolean);
  return {cluster,doc,canvas,opener,holds,operates:()=>operates,byId:id=>find(node=>node.id===id),gauge:axis=>find(node=>node.dataset.axis===axis),advance:ms=>now+=ms,refreshes:()=>refreshes,restore:()=>Object.defineProperty(globalThis,'performance',old)};
}

test('drone telemetry normalizes bearing and rejects incomplete or invalid samples',()=>{
  assert.equal(droneTelemetry({...marker,heading:-10,yaw:720}).heading,350);
  assert.equal(droneTelemetry({...marker,heading:-10,yaw:720}).yaw,0);
  assert.equal(droneTelemetry({...marker,held:true}).task,'HOLDING');
  assert.equal(droneTelemetry({...marker,directOperate:true}).task,'DIRECT OPERATE');
  assert.equal(droneTelemetry({...marker,altitude:NaN}),null);
  assert.equal(droneTelemetry(null),null);
});

test('Direct Operate dispatches once with available telemetry and rejects stale unavailable controls',()=>{
  const f=fixture();try{
    f.cluster.open(marker);
    const operate=f.byId('drone-direct-operate');
    assert.equal(operate.disabled,false);operate.dispatchEvent(new Event('click'));
    assert.equal(f.operates(),1);assert.deepEqual(f.holds,[]);
    f.cluster.receive(null);assert.equal(operate.disabled,true);
    operate.dispatchEvent(new Event('click'));assert.equal(f.operates(),1);
    f.cluster.destroy();operate.dispatchEvent(new Event('click'));assert.equal(f.operates(),1);
  }finally{f.cluster.destroy();f.restore();}
});

test('View opens two-column controls without commanding map movement; Close and Escape restore focus',()=>{
  const f=fixture();try{
    assert.equal(f.cluster.root.hidden,true);
    f.cluster.receive(marker);f.cluster.open();assert.equal(f.cluster.root.hidden,false);
    assert.equal(f.byId('drone-id').textContent,'DEMO-01');assert.equal(f.byId('drone-task').textContent,'INSPECTING');
    assert.equal(f.doc.activeElement,f.byId('drone-cluster-close'));assert.equal(f.holds.length,0);
    const escape=new Event('keydown',{cancelable:true});escape.key='Escape';f.cluster.root.dispatchEvent(escape);
    assert.equal(f.cluster.root.hidden,true);assert.equal(f.doc.activeElement,f.opener);
    f.cluster.open();f.byId('drone-cluster-close').dispatchEvent(new Event('click'));assert.equal(f.cluster.root.hidden,true);
    f.cluster.destroy();assert.equal(f.cluster.root.isConnected,false);f.cluster.open(marker);assert.equal(f.cluster.root.hidden,true);
  }finally{f.restore();}
});

test('feed selection and sensor zoom change local preview with no map commands',()=>{
  const f=fixture();try{
    f.cluster.open(marker);
    for(const feed of ['thermal','zoom','depth','color']){
      f.byId(`drone-feed-${feed}`).dispatchEvent(new Event('click'));
      assert.equal(f.byId(`drone-feed-${feed}`).getAttribute('aria-pressed'),'true');
      const preview=f.cluster.root.children[2].children.find(node=>node.dataset.vfd==='drone-feed');
      assert.equal(preview.dataset.feed,feed);
    }
    const zoom=f.byId('drone-sensor-zoom');zoom.value='4.5';zoom.dispatchEvent(new Event('input'));
    assert.equal(zoom.getAttribute('aria-valuetext'),'4.5 times sensor zoom');
    const preview=f.cluster.root.children[2].children.find(node=>node.dataset.vfd==='drone-feed');
    assert.equal(preview.dataset.zoom,'4.5');assert.deepEqual(f.holds,[]);
    zoom.value='999';zoom.dispatchEvent(new Event('input'));assert.equal(preview.dataset.zoom,'8');
  }finally{f.cluster.destroy();f.restore();}
});

test('updates throttle but the final hold sample flushes immediately and null data disables commands',()=>{
  const f=fixture();try{
    f.cluster.receive(marker);f.cluster.open();const initial=f.gauge('yaw').dataset.value;
    f.advance(20);f.cluster.receive({...marker,yaw:191});assert.equal(f.gauge('yaw').dataset.value,initial);
    f.advance(100);f.cluster.receive({...marker,yaw:192});assert.equal(f.gauge('yaw').dataset.value,'192.0');
    f.byId('drone-hold').dispatchEvent(new Event('click'));assert.deepEqual(f.holds,[true]);assert.equal(f.byId('drone-task').textContent,'HOLDING');
    f.advance(1);f.cluster.receive({...marker,held:true,task:'holding',roll:0,speed:0});
    assert.equal(f.gauge('roll').dataset.value,'0.0','hold sample flushes even inside throttle window');
    assert.equal(f.byId('drone-hold').textContent,'RESUME');
    f.byId('drone-hold').dispatchEvent(new Event('click'));assert.deepEqual(f.holds,[true,false]);
    f.cluster.receive(null);assert.equal(f.byId('drone-hold').disabled,true);assert.equal(f.byId('drone-task').textContent,'UNAVAILABLE');
    assert.equal(f.gauge('roll').dataset.available,'false');
    f.byId('drone-hold').dispatchEvent(new Event('click'));assert.deepEqual(f.holds,[true,false]);
  }finally{f.cluster.destroy();f.restore();}
});

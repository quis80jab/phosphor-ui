import test from 'node:test';
import assert from 'node:assert/strict';
import {markerCoordinates,markerFlagLayout,mountMapMarkerFlag} from '../dist/map-marker-flag.js';
import {PIXEL_PITCH} from '../dist/viewer-grid.js';

const marker={visible:true,screen:{x:.5,y:.5},latitude:37.796044,longitude:-122.395830};
const rect={left:203.25,top:228.5,width:824,height:696};
test('flag keeps geographic precision and hemisphere labels while invalid data hides it',()=>{
  assert.deepEqual(markerCoordinates(marker),['LAT 37.796044 N','LON 122.395830 W']);
  assert.deepEqual(markerCoordinates({latitude:-.001234,longitude:.000456}),['LAT 0.001234 S','LON 0.000456 E']);
  assert.equal(markerCoordinates({latitude:NaN,longitude:3}),null);
});
test('moving marker labels remain on the global pixel grid, fit pane edges, and stay fixed size',()=>{
  for(const expanded of [false,true])for(const x of [0,.5,1])for(const y of [0,.5,1]){
    const layout=markerFlagLayout({...marker,screen:{x,y}},rect,expanded);
    assert.ok(layout.left>=0&&layout.top>=0);
    assert.ok(layout.left+layout.width<=rect.width&&layout.top+layout.height<=rect.height);
    for(const value of [(layout.left+rect.left)/PIXEL_PITCH,(layout.top+rect.top)/PIXEL_PITCH])assert.ok(Math.abs(value-Math.round(value))<1e-10);
    assert.equal(layout.width,144*PIXEL_PITCH);
    assert.deepEqual(layout.points[0],[x*rect.width,y*rect.height]);
  }
  assert.equal(markerFlagLayout({...marker,visible:false},rect),null);
  assert.equal(markerFlagLayout({...marker,screen:{x:-.1,y:.5}},rect),null);
  assert.equal(markerFlagLayout(marker,{...rect,width:100}),null);
});

test('flag reveals View on activation, follows live GPS, focuses marker on View, and hides on scene exit',()=>{
  const previous={document:globalThis.document,window:globalThis.window};
  class Element extends EventTarget{
    constructor(){super();this.hidden=false;this.dataset={};this.style={};this.textContent='';this.attrs={};}
    setAttribute(key,value){this.attrs[key]=value;}
    getAttribute(key){return this.attrs[key]??null;}
    focus(){globalThis.document.activeElement=this;}
  }
  globalThis.document={activeElement:null};globalThis.window=new EventTarget();
  try{
    const root=new Element(),card=new Element(),flag=new Element(),action=new Element(),coords=new Element(),canvas=new Element();
    root.hidden=true;action.hidden=true;canvas.getBoundingClientRect=()=>rect;
    root.querySelector=selector=>({'.map-marker-card':card,'#map-marker-flag':flag,'#map-marker-view':action,'.map-marker-coordinates':coords}[selector]);
    root.contains=node=>[root,card,flag,action,coords].includes(node);
    let viewed=0,refreshed=0;const control=mountMapMarkerFlag({root,canvas,onView:()=>viewed++,refresh:()=>refreshed++});
    control.update(marker);assert.equal(root.hidden,false);assert.equal(action.hidden,true);
    flag.dispatchEvent(new Event('click'));assert.equal(action.hidden,false);assert.equal(flag.attrs['aria-expanded'],'true');
    action.dispatchEvent(new Event('click'));assert.equal(viewed,1);
    const before=card.style.left;control.update({...marker,screen:{x:.6,y:.5},latitude:37.796050});
    assert.notEqual(card.style.left,before);assert.match(coords.textContent,/37.796050/);
    const escape=new Event('keydown',{cancelable:true});escape.key='Escape';root.dispatchEvent(escape);
    assert.equal(action.hidden,true);assert.equal(document.activeElement,flag);
    control.update(null);assert.equal(root.hidden,true);assert.equal(document.activeElement,canvas);
    control.update(marker);flag.dispatchEvent(new Event('click'));assert.equal(action.hidden,false);
    control.destroy();assert.equal(root.hidden,true);const last=refreshed;control.update(marker);assert.equal(refreshed,last);
    action.dispatchEvent(new Event('click'));assert.equal(viewed,1);
  }finally{Object.assign(globalThis,previous);}
});

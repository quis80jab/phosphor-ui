import test from'node:test';
import assert from'node:assert/strict';
import{paintDirectOperateControl}from'../dist/direct-operate-paint.js';

function raster(){
  const pixels=new Map(),stack=[];let path,clip=[-Infinity,-Infinity,Infinity,Infinity];
  return{pixels,fillStyle:'#000',save(){stack.push({clip:[...clip],fillStyle:this.fillStyle});},restore(){this.fillStyle=stack.at(-1).fillStyle;clip=stack.pop().clip;},
    beginPath(){path=null;},rect(x,y,w,h){path=[x,y,x+w,y+h];},clip(){clip=[Math.max(clip[0],path[0]),Math.max(clip[1],path[1]),Math.min(clip[2],path[2]),Math.min(clip[3],path[3])];},
    fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isInteger),'artwork must use integer VFD pixels');assert.ok(w>=0&&h>=0);for(let yy=Math.max(y,clip[1]);yy<Math.min(y+h,clip[3]);yy++)for(let xx=Math.max(x,clip[0]);xx<Math.min(x+w,clip[2]);xx++)pixels.set(`${xx},${yy}`,this.fillStyle);}};
}
function paint(type,dataset={},options={}){const ctx=raster();assert.equal(paintDirectOperateControl(ctx,{element:{dataset},type,x:0,y:0,width:112,height:112,...options}),true);return ctx;}

test('map and camera framing leaves the rendered scene transparent',()=>{
  for(const side of['map','feed']){
    const ctx=paint('operate-frame',{side});assert.equal(ctx.pixels.has('40,56'),false);assert.equal(ctx.pixels.has('56,20'),false);
    if(side==='map')assert.equal(ctx.pixels.get('56,56'),'#ff6974','the following map marks the drone at its center');
    else assert.equal(ctx.pixels.has('56,56'),false,'onboard imagery has no map marker');
    assert.equal(ctx.pixels.get('0,0'),'#a9e9df');assert.ok(ctx.pixels.has('56,2'),'caption has a dark backing');
  }
});
test('joystick knob reflects signed axes, and unavailable sticks cannot show stale deflection',()=>{
  const center=paint('operate-stick',{x:0,y:0,side:'left'}),upRight=paint('operate-stick',{x:.7,y:.7,side:'left'});
  assert.notDeepEqual(center.pixels,upRight.pixels);
  const knob=[...upRight.pixels].filter(([,color])=>color==='#ffc782').map(([key])=>key.split(',').map(Number));
  assert.ok(knob.every(([x,y])=>x>56&&y<56));
  assert.deepEqual(paint('operate-stick',{x:1,y:1,available:'false'}).pixels,paint('operate-stick',{x:0,y:0,available:'false'}).pixels);
});
test('all overlay artwork uses clipped integer pixels and keeps its shape when moved',()=>{
  for(const type of['operate-stick','operate-frame','operate-hud']){
    const data={side:'left',axis:'roll',value:20,x:.5,y:.2},base=paint(type,data),moved=paint(type,data,{x:17,y:-9});
    assert.deepEqual(base.pixels,new Map([...moved.pixels].map(([key,value])=>{const[x,y]=key.split(',').map(Number);return[`${x-17},${y+9}`,value];})));
    for(const[width,height]of[[1,1],[8,8],[32,24],[112,112]])for(const key of paint(type,data,{width,height}).pixels.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=0&&x<width&&y>=0&&y<height);}
  }
  assert.equal(paintDirectOperateControl(raster(),{type:'other'}),false);
});
test('HUD changes with actual telemetry and unavailable values never resemble a zero sample',()=>{
  for(const axis of['heading','altitude','speed','yaw','roll','pitch']){
    assert.notDeepEqual(paint('operate-hud',{axis,value:0}).pixels,paint('operate-hud',{axis,value:30}).pixels);
    assert.notDeepEqual(paint('operate-hud',{axis,value:0}).pixels,paint('operate-hud',{axis,value:0,available:'false'}).pixels);
  }
});

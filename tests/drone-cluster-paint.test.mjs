import test from 'node:test';
import assert from 'node:assert/strict';
import {paintDroneControl,droneBearingInfo} from '../dist/drone-cluster-paint.js';

function raster(){
  const pixels=new Map(),stack=[];let path,clip=[-Infinity,-Infinity,Infinity,Infinity];
  return{pixels,fillStyle:'#000',calls:0,
    save(){stack.push({clip:[...clip],fillStyle:this.fillStyle});},
    restore(){this.fillStyle=stack.at(-1).fillStyle;clip=stack.pop().clip;},
    beginPath(){path=null;},rect(x,y,w,h){path=[x,y,x+w,y+h];},
    clip(){clip=[Math.max(clip[0],path[0]),Math.max(clip[1],path[1]),Math.min(clip[2],path[2]),Math.min(clip[3],path[3])];},
    fillRect(x,y,w,h){
      this.calls++;assert.ok([x,y,w,h].every(Number.isInteger),'all draw operations occupy integer display pixels');assert.ok(w>=0&&h>=0);
      for(let yy=Math.max(y,clip[1]);yy<Math.min(y+h,clip[3]);yy++)for(let xx=Math.max(x,clip[0]);xx<Math.min(x+w,clip[2]);xx++)pixels.set(`${xx},${yy}`,this.fillStyle);
    }
  };
}
function paint(type,dataset={},options={}){const ctx=raster();assert.equal(paintDroneControl(ctx,{element:{dataset},type,x:0,y:0,width:136,height:96,...options}),true);return ctx;}

test('drone heading reports true cardinal direction and rotates cardinals against heading',()=>{
  assert.deepEqual(droneBearingInfo(0),{heading:0,cardinal:'N',cardinals:[{label:'N',angle:0},{label:'E',angle:90},{label:'S',angle:180},{label:'W',angle:270}]});
  assert.equal(droneBearingInfo(90).cardinal,'E');assert.equal(droneBearingInfo(90).cardinals[0].angle,-90);
  assert.equal(droneBearingInfo(-90).cardinal,'W');assert.equal(droneBearingInfo(405).cardinal,'NE');
  assert.deepEqual(droneBearingInfo(NaN),droneBearingInfo(0));
  assert.notDeepEqual(paint('drone-heading',{heading:0}).pixels,paint('drone-heading',{heading:90}).pixels);
});

test('attitude pointers respect signed pitch and roll while yaw wraps clockwise',()=>{
  for(const axis of ['yaw','roll','pitch']){
    const a=paint('drone-attitude',{axis,value:0},{height:72}),b=paint('drone-attitude',{axis,value:60},{height:72});
    assert.notDeepEqual(a.pixels,b.pixels);
  }
  assert.deepEqual(paint('drone-attitude',{axis:'yaw',value:-90}).pixels,paint('drone-attitude',{axis:'yaw',value:270}).pixels);
  assert.deepEqual(paint('drone-attitude',{axis:'roll',value:120}).pixels,paint('drone-attitude',{axis:'roll',value:90}).pixels);
  assert.notDeepEqual(paint('drone-attitude',{axis:'pitch',value:-25}).pixels,paint('drone-attitude',{axis:'pitch',value:25}).pixels);
});

test('altitude fills segments from bottom to top while zero and max remain distinct',()=>{
  const empty=paint('drone-altitude',{altitude:0}),mid=paint('drone-altitude',{altitude:15}),full=paint('drone-altitude',{altitude:30});
  assert.equal(empty.pixels.get('10,73'),'#193e35');assert.equal(mid.pixels.get('10,73'),'#a9e9df');
  assert.equal(mid.pixels.get('10,25'),'#193e35');assert.equal(full.pixels.get('10,25'),'#a9e9df');
  assert.notDeepEqual(empty.pixels,mid.pixels);assert.notDeepEqual(mid.pixels,full.pixels);
});

test('instruments retain glyph sizes when translated and clip every drawing to their grid cell',()=>{
  for(const type of ['drone-heading','drone-altitude','drone-attitude','drone-feed']){
    const dataset={heading:25,altitude:8,axis:'roll',value:-22,feed:'thermal'};
    const base=paint(type,dataset),moved=paint(type,dataset,{x:17,y:-9});
    const shifted=new Map([...moved.pixels].map(([key,value])=>{const[x,y]=key.split(',').map(Number);return[`${x-17},${y+9}`,value];}));
    assert.deepEqual(base.pixels,shifted);
    for(const[width,height]of[[1,1],[9,13],[32,32],[136,96]]){
      const ctx=paint(type,dataset,{x:-8,y:11,width,height});
      for(const key of ctx.pixels.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=-8&&x<width-8&&y>=11&&y<height+11);}
    }
  }
});

test('simulated feed modes have distinct samples and respond to attitude and magnification',()=>{
  const modes=['color','thermal','zoom','depth'].map(feed=>paint('drone-feed',{feed,heading:0,zoom:1}));
  for(let i=0;i<modes.length;i++)for(let j=i+1;j<modes.length;j++)assert.notDeepEqual(modes[i].pixels,modes[j].pixels);
  const base=paint('drone-feed',{feed:'color',heading:0,zoom:1});
  for(const change of [{heading:90},{roll:35},{pitch:40},{zoom:4}])assert.notDeepEqual(base.pixels,paint('drone-feed',{feed:'color',heading:0,zoom:1,...change}).pixels);
  const large=paint('drone-feed',{feed:'thermal'},{width:400,height:200});
  assert.ok(large.calls<9000,'sampling is bounded independently of a large feed box');
});

test('telemetry unavailable does not display a stale sensor image or plausible zero telemetry',()=>{
  for(const type of ['drone-heading','drone-altitude','drone-attitude','drone-feed']){
    const unavailable=paint(type,{available:'false'});
    assert.notDeepEqual(unavailable.pixels,paint(type,{}).pixels);
    const withStale=paint(type,{available:'false',heading:200,altitude:30,value:60,feed:'thermal'});
    assert.deepEqual(unavailable.pixels,withStale.pixels);
  }
  const ctx=raster();assert.equal(paintDroneControl(ctx,{type:'ordinary-button',width:20,height:20}),false);assert.equal(ctx.calls,0);
});


test('heading cardinals stay between title and readout at every bearing',()=>{
  const header=ctx=>new Map([...ctx.pixels].filter(([key])=>Number(key.split(',')[1])<14));
  const reference=header(paint('drone-heading',{heading:0}));
  for(let heading=0;heading<360;heading+=15){
    const ctx=paint('drone-heading',{heading});
    assert.deepEqual(header(ctx),reference,'rotating cardinals must never paint into the title');
    const northGlyph=[...ctx.pixels].filter(([key,color])=>color==='#ffc782'&&Number(key.split(',')[1])<83);
    assert.ok(northGlyph.length>0);
    for(const[key]of northGlyph){const y=Number(key.split(',')[1]);assert.ok(y>=16&&y<=79,'north glyph stays inside reserved compass region');}
  }
});

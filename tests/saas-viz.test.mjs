import test from 'node:test';
import assert from 'node:assert/strict';
import {paintVFDChart,normalizeVFDChart,vfdChartDomain,formatVFDValue,hitVFDChart,bindVFDChart,VFD_CHART_TYPES} from '../dist/saas-viz.js';

function raster(){
  const pixels=new Map(),stack=[];let path=null,clip=[-Infinity,-Infinity,Infinity,Infinity];
  return{pixels,fillStyle:'',save(){stack.push({clip:[...clip],fillStyle:this.fillStyle});},restore(){const saved=stack.pop();clip=saved.clip;this.fillStyle=saved.fillStyle;},beginPath(){path=null;},rect(x,y,w,h){path=[x,y,x+w,y+h];},clip(){clip=[Math.max(clip[0],path[0]),Math.max(clip[1],path[1]),Math.min(clip[2],path[2]),Math.min(clip[3],path[3])];},fillRect(x,y,w,h){assert.ok([x,y,w,h].every(Number.isInteger),`Noninteger raster: ${[x,y,w,h]}`);assert.ok(w>=0&&h>=0);for(let yy=Math.max(y,clip[1]);yy<Math.min(y+h,clip[3]);yy++)for(let xx=Math.max(x,clip[0]);xx<Math.min(x+w,clip[2]);xx++)pixels.set(`${xx},${yy}`,this.fillStyle);}};
}
const data=[{label:'MON',value:12},{label:'TUE',value:28},{label:'WED',value:19},{label:'THU',value:41},{label:'FRI',value:35}];

test('normalization bounds nonfinite input and is safe to round-trip',()=>{
 const spec=normalizeVFDChart({type:'line',value:Infinity,max:NaN,target:NaN,color:'bad',data:[{label:'ABC\nDEF',value:Infinity},null,{value:-1e18}],series:[{values:[NaN,4,Infinity]}]});
 assert.equal(spec.value,0);assert.equal(spec.max,100);assert.equal(spec.target,null);assert.equal(spec.data[0].value,0);assert.equal(spec.data[0].label,'ABC DEF');assert.equal(spec.data[2].value,-1e12);assert.deepEqual(spec.series[0].values,[0,4,0]);
 assert.deepEqual(normalizeVFDChart(JSON.parse(JSON.stringify(spec))),spec);
 assert.equal(normalizeVFDChart({data:new Array(900).fill(1)}).data.length,512);
});

test('domains include negative values and comparison series without inheriting meter default maximum',()=>{
 assert.deepEqual(vfdChartDomain({data}),{min:0,max:50});
 assert.deepEqual(vfdChartDomain(normalizeVFDChart({data})),{min:0,max:50});
 assert.deepEqual(vfdChartDomain({data:[{value:-25},{value:60}],series:[{values:[-70,140]}]}),{min:-100,max:200});
 assert.deepEqual(vfdChartDomain({data:[{value:0}]}),{min:0,max:1});
 assert.deepEqual(vfdChartDomain({data,max:100}),{min:0,max:100});
 assert.equal(formatVFDValue(1234),'1.2K');assert.equal(formatVFDValue(51.2,'%'),'51.2%');assert.equal(formatVFDValue(75000,'$'),'$75K');
});

test('every primitive rasterizes integer pixels clipped to its actual dimensions',()=>{
 for(const type of VFD_CHART_TYPES)for(const[width,height]of[[8,8],[24,16],[120,80],[320,160]]){
  const ctx=raster();paintVFDChart(ctx,width,height,{type,data,value:73,target:85,max:100,selectedIndex:2,series:[{values:[10,20,30,25,40]}]});
  for(const key of ctx.pixels.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=0&&x<width&&y>=0&&y<height,`${type}: ${key} outside ${width},${height}`);}
  if(width>=120)assert.ok(ctx.pixels.size>50,`${type} should contain readable chart output`);
 }
});

test('empty, zero, negative and single-point data do not produce invalid geometry',()=>{
 for(const type of VFD_CHART_TYPES)for(const items of[[],[{label:'A',value:0}],[{label:'B',value:-15}],[{label:'C',value:Infinity}]]){
  const ctx=raster();assert.doesNotThrow(()=>paintVFDChart(ctx,180,100,{type,data:items,value:-30,max:0,target:Infinity}));
 }
 const ctx=raster();paintVFDChart(ctx,0,100,{type:'line',data});assert.equal(ctx.pixels.size,0);
});

test('selected data changes pixel output and line hit testing reaches both endpoints',()=>{
 const regular=raster(),selected=raster();paintVFDChart(regular,320,160,{type:'line',data});paintVFDChart(selected,320,160,{type:'line',data,selectedIndex:2});assert.notDeepEqual(regular.pixels,selected.pixels);
 assert.equal(hitVFDChart({type:'line',data},320,160,0,80),0);assert.equal(hitVFDChart({type:'line',data},320,160,319,80),4);assert.equal(hitVFDChart({type:'line',data:[]},320,160,10,10),-1);
 assert.equal(hitVFDChart({type:'bar',data},320,160,160,1),0);assert.equal(hitVFDChart({type:'bar',data},320,160,160,159),4);
});

test('donut and heatmap hit tests select visible data regions',()=>{
 const ring={type:'donut',data:[{label:'A',value:50},{label:'B',value:50}]};
 assert.equal(hitVFDChart(ring,180,140,150,55),0);assert.equal(hitVFDChart(ring,180,140,30,55),1);
 const heat={type:'heatmap',columns:3,data:new Array(6).fill(0).map((_,i)=>({label:String(i),value:i}))};
 assert.equal(hitVFDChart(heat,180,100,10,10),0);assert.equal(hitVFDChart(heat,180,100,170,90),5);
});

function canvasFixture(){
 class Canvas extends EventTarget{constructor(){super();this.attrs={};this.width=320;this.height=160;this.oldDraw=()=>{};this.vfdDraw=this.oldDraw;}getAttribute(name){return this.attrs[name]??null;}setAttribute(name,value){this.attrs[name]=String(value);}removeAttribute(name){delete this.attrs[name];}getBoundingClientRect(){return{left:10,top:20,width:640,height:320};}}
 return new Canvas();
}
function key(canvas,value){const event=new Event('keydown',{cancelable:true});Object.defineProperty(event,'key',{value});canvas.dispatchEvent(event);return event;}

test('binding exposes keyboard and pointer selection and restores native attributes on destroy',()=>{
 const canvas=canvasFixture(),changes=[];let renders=0;
 canvas.setAttribute('aria-label','Mission throughput');
 const binding=bindVFDChart(canvas,{getSpec:()=>({type:'line',data}),onSelect:value=>changes.push(value),refresh:()=>renders++});
 assert.equal(canvas.getAttribute('data-vfd'),'canvas');assert.equal(canvas.getAttribute('tabindex'),'0');assert.match(canvas.getAttribute('aria-label'),/Mission throughput.*5 data points/);
 assert.equal(key(canvas,'ArrowRight').defaultPrevented,true);assert.equal(changes.at(-1).index,0);key(canvas,'End');assert.equal(changes.at(-1).index,4);key(canvas,'ArrowLeft');assert.equal(changes.at(-1).index,3);key(canvas,'Home');assert.equal(changes.at(-1).index,0);
 const click=new Event('click');Object.defineProperties(click,{clientX:{value:649},clientY:{value:100}});canvas.dispatchEvent(click);assert.equal(changes.at(-1).index,4);assert.match(canvas.getAttribute('aria-label'),/FRI: 35/);assert.equal(renders,5);
 binding.destroy();assert.equal(canvas.vfdDraw,canvas.oldDraw);assert.equal(canvas.getAttribute('tabindex'),null);assert.equal(canvas.getAttribute('aria-label'),'Mission throughput');key(canvas,'End');assert.equal(changes.length,5);binding.destroy();
});

test('empty bindings leave navigation keys untouched and meter labels expose actual values',()=>{
 const canvas=canvasFixture();const binding=bindVFDChart(canvas,{getSpec:()=>({type:'gauge',label:'BATTERY',value:72,max:100,unit:'%'})});
 assert.match(canvas.getAttribute('aria-label'),/BATTERY. 72%/);assert.equal(key(canvas,'ArrowRight').defaultPrevented,false);binding.destroy();
});

test('bar ink follows the requested color and a zero gauge has no illuminated segments',()=>{
 const bars=raster();paintVFDChart(bars,240,140,{type:'bar',data,color:'#f0a060',showLabels:false});assert.ok([...bars.pixels.values()].includes('#f0a060'));assert.equal([...bars.pixels.values()].includes('#a9e9df'),false);
 const gauge=raster();paintVFDChart(gauge,120,90,{type:'gauge',value:0,color:'#f0a060',showLabels:false});
 // Only the central zero glyph uses the active ink; the outer dial stays unlit.
 for(const[key,ink]of gauge.pixels){const[x,y]=key.split(',').map(Number);if(x<40||x>80||y<32||y>60)assert.notEqual(ink,'#f0a060');}
});

test('compact sparklines use their height and pointer selection shares the compact plot',()=>{
 const spec={type:'sparkline',data:[{label:'A',value:0},{label:'B',value:100},{label:'C',value:0}]};
 const ctx=raster();paintVFDChart(ctx,72,24,spec);
 const ys=[...ctx.pixels.keys()].map(key=>Number(key.split(',')[1]));
 assert.equal(Math.min(...ys),4,'peak starts at the compact four-pixel inset');
 assert.ok(Math.max(...ys)>=19,'baseline retains usable vertical range');
 assert.equal(hitVFDChart(spec,72,24,4,12),0);assert.equal(hitVFDChart(spec,72,24,36,12),1);assert.equal(hitVFDChart(spec,72,24,67,12),2);
});

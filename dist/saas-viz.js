import { pixelText, glyphRect, glyphMark } from './vfd-glyphs.js?v=grid-1';

/** Integer-raster chart primitives. The host's VFD compositor owns all optical effects. */
export const VFD_CHART_COLORS = Object.freeze({mint:'#a9e9df',dim:'#558c7e',grid:'#24473e',ink:'#071612',amber:'#ffc782',blue:'#82c7ef',coral:'#ff8c88'});
export const VFD_CHART_TYPES = Object.freeze(['line','bar','donut','gauge','heatmap','sparkline','bullet']);
const C=VFD_CHART_COLORS, PALETTE=[C.mint,C.blue,C.amber,C.coral,'#b5a4e7'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const number=(v,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?clamp(v,-1e12,1e12):fallback;
const color=(v,fallback=C.mint)=>typeof v==='string'&&/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(v)?v:fallback;
const label=v=>String(v??'').replace(/[\u0000-\u001f]/g,' ').slice(0,100).toUpperCase();
const dimension=v=>Math.max(0,Math.min(8192,Math.floor(number(v))));

export function formatVFDValue(value,unit='') {
  const n=number(value),absolute=Math.abs(n);
  let valueText;
  if(absolute>=1e9)valueText=`${(n/1e9).toFixed(1).replace(/\.0$/,'')}B`;
  else if(absolute>=1e6)valueText=`${(n/1e6).toFixed(1).replace(/\.0$/,'')}M`;
  else if(absolute>=1e3)valueText=`${(n/1e3).toFixed(1).replace(/\.0$/,'')}K`;
  else valueText=Number.isInteger(n)?String(n):n.toFixed(1).replace(/\.0$/,'');
  const suffix=label(unit).slice(0,16);
  return suffix==='$'?`$${valueText}`:valueText+(suffix?(suffix==='%'?'%':` ${suffix}`):'');
}
export function normalizeVFDChart(spec={}) {
  const input=spec&&typeof spec==='object'?spec:{};
  const data=(Array.isArray(input.data)?input.data:[]).slice(0,512).map((item,index)=>({
    label:label(item?.label??index+1),value:number(typeof item==='number'?item:item?.value),color:color(item?.color,input.type==='donut'?PALETTE[index%PALETTE.length]:null)
  }));
  const max=Math.max(1e-12,number(input.max,100));
  const series=(Array.isArray(input.series)?input.series:[]).slice(0,4).map((item,index)=>({label:label(item?.label),color:color(item?.color,PALETTE[(index+1)%PALETTE.length]),values:Array.from({length:data.length},(_,i)=>number(item?.values?.[i]))}));
  return {type:VFD_CHART_TYPES.includes(input.type)?input.type:'line',label:label(input.label||input.title||input.type||'Chart'),data,series,
    color:color(input.color),unit:label(input.unit).slice(0,16),value:clamp(number(input.value),0,max),max,
    domainMax:Object.hasOwn(input,'domainMax')?(typeof input.domainMax==='number'&&Number.isFinite(input.domainMax)&&input.domainMax>0?number(input.domainMax):null):(typeof input.max==='number'&&Number.isFinite(input.max)&&input.max>0?number(input.max):null),
    target:typeof input.target==='number'&&Number.isFinite(input.target)?clamp(input.target,0,max):null,
    selectedIndex:Number.isInteger(input.selectedIndex)&&input.selectedIndex>=0&&input.selectedIndex<data.length?input.selectedIndex:-1,
    showLabels:input.showLabels!==false,columns:clamp(Math.floor(number(input.columns,7)),1,32)};
}
function niceCeil(value){if(value<=0)return 1;const p=10**Math.floor(Math.log10(value)),f=value/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p;}
export function vfdChartDomain(spec={}) {
  const s=normalizeVFDChart(spec),values=[0,...s.data.map(p=>p.value),...s.series.flatMap(x=>x.values)];
  const lo=Math.min(...values),hi=Math.max(...values,s.domainMax??0);
  return {min:lo<0?-niceCeil(-lo):0,max:niceCeil(hi)};
}
function line(ctx,x0,y0,x1,y1,ink=C.mint,dash=0){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let err=dx+dy,index=0;
  ctx.fillStyle=ink;
  for(;;){if(!dash||Math.floor(index/dash)%2===0)ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e=2*err;if(e>=dy){err+=dy;x0+=sx;}if(e<=dx){err+=dx;y0+=sy;}index++;}
}
function text(ctx,value,x,y,ink=C.dim,{align='left',width=Infinity,scale=1}={}){
  pixelText(ctx,label(value),Math.round(x),Math.round(y),ink,scale,{align,maxWidth:width});
}
function dotFill(ctx,x,y,w,h,ink=C.mint,spacing=3){
  ctx.fillStyle=ink;
  const left=Math.round(x),top=Math.round(y),right=Math.round(x+w),bottom=Math.round(y+h);
  for(let yy=top;yy<bottom;yy+=spacing)for(let xx=left;xx<right;xx+=spacing)ctx.fillRect(xx,yy,1,1);
}
function selectedPoint(ctx,x,y,ink=C.amber){glyphRect(ctx,Math.round(x)-3,Math.round(y)-3,7,7,ink);ctx.fillStyle=ink;ctx.fillRect(Math.round(x),Math.round(y),1,1);}
function xyLayout(w,h,labels=true,spark=false){if(spark)return{x:4,y:4,w:Math.max(1,w-8),h:Math.max(1,h-8)};const left=labels&&w>=140?36:5,bottom=labels&&h>=65?19:5;return{x:left,y:14,w:Math.max(1,w-left-8),h:Math.max(1,h-bottom-14)};}
function xyPoint(index,value,total,plot,domain){return{x:plot.x+Math.round((total<2?.5:index/(total-1))*(plot.w-1)),y:plot.y+plot.h-1-Math.round(clamp((value-domain.min)/(domain.max-domain.min),0,1)*(plot.h-1))};}
function empty(ctx,w,h){if(w>=48&&h>=20)text(ctx,'NO DATA',w/2,(h-7)/2,C.dim,{align:'center',width:w-4});}
function axes(ctx,w,h,s,plot,domain){
  const count=plot.h>=100?4:2;
  for(let i=0;i<=count;i++){
    const y=plot.y+Math.round(i*(plot.h-1)/count),value=domain.max-(domain.max-domain.min)*i/count;
    line(ctx,plot.x,y,plot.x+plot.w-1,y,C.grid,2);
    if(s.showLabels&&plot.x>10)text(ctx,formatVFDValue(value),plot.x-7,y-3,C.dim,{align:'right',width:plot.x-8});
  }
  if(s.showLabels&&h>=65&&s.data.length){
    const points=s.data.length<3?[0,s.data.length-1]:[0,Math.floor((s.data.length-1)/2),s.data.length-1];
    for(const i of new Set(points)){const p=xyPoint(i,0,s.data.length,plot,domain),align=s.data.length===1?'center':i===0?'left':i===s.data.length-1?'right':'center';text(ctx,s.data[i].label,p.x,plot.y+plot.h+7,C.dim,{align,width:Math.floor(plot.w/3)-4});}
  }
}
function drawLine(ctx,w,h,s,spark=false){
  if(!s.data.length){empty(ctx,w,h);return;}
  const domain=vfdChartDomain(s),plot=xyLayout(w,h,!spark&&s.showLabels,spark);
  if(!spark)axes(ctx,w,h,s,plot,domain);
  const points=s.data.map((p,i)=>xyPoint(i,p.value,s.data.length,plot,domain));
  if(!spark){
    // Sparse emission under the measured signal, one pixel at each lattice intersection.
    for(let i=0;i<points.length;i++){const p=points[i],next=points[i+1]||p;for(let x=p.x;x<=next.x;x+=3){const ratio=next.x===p.x?0:(x-p.x)/(next.x-p.x),top=Math.round(p.y+(next.y-p.y)*ratio);dotFill(ctx,x,top+3,1,Math.max(0,plot.y+plot.h-top-3),C.grid,3);}}
  }
  for(const series of s.series){const comparison=series.values.map((value,i)=>xyPoint(i,value,s.data.length,plot,domain));for(let i=1;i<comparison.length;i++)line(ctx,comparison[i-1].x,comparison[i-1].y,comparison[i].x,comparison[i].y,series.color,3);}
  for(let i=1;i<points.length;i++)line(ctx,points[i-1].x,points[i-1].y,points[i].x,points[i].y,s.color);
  if(points.length===1){ctx.fillStyle=s.color;ctx.fillRect(points[0].x-1,points[0].y-1,3,3);}
  if(!spark&&points.length<=36)for(const p of points)glyphMark(ctx,p.x-2,p.y-2,'dots',s.color,4);
  if(s.selectedIndex>=0){const p=points[s.selectedIndex];if(!spark)line(ctx,p.x,plot.y,p.x,plot.y+plot.h-1,C.dim,2);selectedPoint(ctx,p.x,p.y);if(!spark)text(ctx,formatVFDValue(s.data[s.selectedIndex].value,s.unit),plot.x+plot.w-1,2,C.amber,{align:'right',width:plot.w});}
  else if(spark)selectedPoint(ctx,points.at(-1).x,points.at(-1).y,s.color);
}
function barLayout(w,h,s){const top=3,gap=6,count=s.data.length;return{x:s.showLabels&&w>=180?Math.min(105,Math.floor(w*.32)):5,y:top,w:Math.max(1,w-(s.showLabels&&w>=180?Math.min(105,Math.floor(w*.32)):5)-44),row:Math.max(1,Math.floor((h-top)/Math.max(1,count))),gap};}
function drawBars(ctx,w,h,s){
  if(!s.data.length){empty(ctx,w,h);return;}
  const b=barLayout(w,h,s),domain=vfdChartDomain(s),range=domain.max-domain.min,zero=b.x+Math.round((-domain.min/range)*(b.w-1));
  for(let i=0;i<s.data.length;i++){
    const p=s.data[i],y=b.y+i*b.row,hh=Math.max(1,Math.min(20,b.row-b.gap)),cy=y+Math.floor(hh/2),x=b.x+Math.round((p.value-domain.min)/range*(b.w-1)),left=Math.min(zero,x),right=Math.max(zero,x),ink=i===s.selectedIndex?C.amber:(p.color||s.color);
    dotFill(ctx,b.x,y,b.w,hh,C.grid,3);dotFill(ctx,left,y,Math.max(1,right-left),hh,ink,2);line(ctx,left,y,right,y,ink);
    if(i===s.selectedIndex)glyphRect(ctx,b.x-2,y-2,b.w+4,hh+4,C.amber);
    if(s.showLabels&&b.x>10)text(ctx,p.label,b.x-10,cy-3,ink,{align:'right',width:b.x-12});
    if(s.showLabels&&b.row>=8)text(ctx,formatVFDValue(p.value),w-3,cy-3,ink,{align:'right',width:39});
  }
}
function ringLayout(w,h,s){const legend=s.showLabels&&w>=260,space=legend?Math.floor(w*.58):w;const r=Math.max(4,Math.floor(Math.min(space-10,h-(legend?8:34))/2));return{cx:Math.floor(space/2),cy:legend?Math.floor(h/2):Math.floor((h-24)/2),r,legend,legendX:space+6};}
function drawDonut(ctx,w,h,s){
  const values=s.data.map(p=>Math.max(0,p.value)),total=values.reduce((a,b)=>a+b,0);
  if(!total){empty(ctx,w,h);return;}
  const ring=ringLayout(w,h,s),{cx,cy,r}=ring,inner=Math.max(1,r-Math.max(8,Math.round(r*.24))),ends=[];let cumulative=0;
  values.forEach(value=>{cumulative+=value/total;ends.push(cumulative);});
  // Test every integer pixel; a tiny angular gap makes the series boundaries visible.
  for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){
    const dx=x-cx,dy=y-cy,d=dx*dx+dy*dy;if(d<inner*inner||d>r*r)continue;
    const angle=((Math.atan2(dy,dx)+Math.PI/2+Math.PI*2)%(Math.PI*2))/(Math.PI*2),index=ends.findIndex(end=>angle<end),start=index>0?ends[index-1]:0;
    if(index<0||angle-start<.006||ends[index]-angle<.006)continue;
    const ink=index===s.selectedIndex?C.amber:s.data[index].color;
    if((x+y)%3!==0||index===s.selectedIndex){ctx.fillStyle=ink;ctx.fillRect(x,y,1,1);}
  }
  const center=s.selectedIndex>=0?s.data[s.selectedIndex].value:total,centerLabel=s.selectedIndex>=0?s.data[s.selectedIndex].label:'TOTAL';
  text(ctx,formatVFDValue(center),cx,cy-9,s.selectedIndex>=0?C.amber:s.color,{align:'center',width:inner*2-6,scale:inner>=33?2:1});
  if(inner>=23)text(ctx,centerLabel,cx,cy+12,C.dim,{align:'center',width:inner*2-8});
  if(ring.legend){const row=Math.max(14,Math.min(25,Math.floor((h-12)/s.data.length)));s.data.forEach((p,i)=>{const y=6+i*row;glyphMark(ctx,ring.legendX,y+2,'blocks',p.color,4);text(ctx,p.label,ring.legendX+10,y,C.dim,{width:w-ring.legendX-12});if(row>=22)text(ctx,`${formatVFDValue(p.value)} / ${Math.round(values[i]/total*100)}%`,ring.legendX+10,y+11,i===s.selectedIndex?C.amber:p.color,{width:w-ring.legendX-12});});}
  else if(s.showLabels){const p=s.selectedIndex>=0?s.data[s.selectedIndex]:s.data[0],pct=Math.round(Math.max(0,p.value)/total*100);text(ctx,`${p.label} / ${pct}%`,w/2,h-12,p.color,{align:'center',width:w-8});}
}
function gaugeLayout(w,h){const r=Math.max(3,Math.floor(Math.min(w/2-10,(h-14)/1.8)));return{cx:Math.floor(w/2),cy:Math.floor(Math.max(r+8,h*.49)),r};}
function drawGauge(ctx,w,h,s){
  const {cx,cy,r}=gaugeLayout(w,h),segments=40,ratio=s.value/s.max;
  for(let i=0;i<segments;i++){
    const angle=(.75+1.5*i/(segments-1))*Math.PI,inner=r-Math.max(5,Math.floor(r*.15)),ink=i<Math.ceil(ratio*segments)?s.color:C.grid;
    for(const offset of[-.008,0,.008])line(ctx,cx+Math.cos(angle+offset)*inner,cy+Math.sin(angle+offset)*inner,cx+Math.cos(angle+offset)*r,cy+Math.sin(angle+offset)*r,ink);
  }
  if(s.target!==null){const angle=(.75+1.5*s.target/s.max)*Math.PI;line(ctx,cx+Math.cos(angle)*(r+1),cy+Math.sin(angle)*(r+1),cx+Math.cos(angle)*(r+6),cy+Math.sin(angle)*(r+6),C.amber);}
  const scale=r>=37?2:1;
  text(ctx,formatVFDValue(s.value),cx,cy-7,s.color,{align:'center',width:Math.max(5,r*2-14),scale});
  if(s.unit&&r>=28)text(ctx,s.unit,cx,cy+13,C.dim,{align:'center',width:r*2-14});
  if(s.showLabels&&h>=70){text(ctx,'0',Math.max(3,cx-r),h-9,C.dim,{width:36});text(ctx,formatVFDValue(s.max),Math.min(w-3,cx+r),h-9,C.dim,{align:'right',width:48});}
}
function heatLayout(w,h,s){const columns=Math.min(s.columns,Math.max(1,s.data.length)),rows=Math.ceil(s.data.length/columns),gap=3;return{columns,rows,gap,x:5,y:5,cw:Math.max(1,Math.floor((w-10+gap)/columns)-gap),ch:Math.max(1,Math.floor((h-10+gap)/Math.max(1,rows))-gap)};}
function drawHeat(ctx,w,h,s){
  if(!s.data.length){empty(ctx,w,h);return;}
  const b=heatLayout(w,h,s),peak=Math.max(1,...s.data.map(p=>p.value));
  for(let i=0;i<s.data.length;i++){
    const p=s.data[i],x=b.x+(i%b.columns)*(b.cw+b.gap),y=b.y+Math.floor(i/b.columns)*(b.ch+b.gap),ratio=clamp(p.value/peak,0,1),ink=i===s.selectedIndex?C.amber:s.color;
    glyphRect(ctx,x,y,b.cw,b.ch,i===s.selectedIndex?C.amber:C.grid);
    if(ratio>0){const spacing=ratio>.75?2:ratio>.4?3:5;dotFill(ctx,x+2,y+2,Math.max(0,b.cw-4),Math.max(0,b.ch-4),ink,spacing);}
    if(i===s.selectedIndex&&b.cw>=26&&b.ch>=16){ctx.fillStyle=C.ink;ctx.fillRect(x+3,y+Math.floor((b.ch-9)/2),b.cw-6,9);text(ctx,formatVFDValue(p.value),x+b.cw/2,y+(b.ch-7)/2,C.amber,{align:'center',width:b.cw-6});}
  }
}
function drawBullet(ctx,w,h,s){
  const x=5,y=Math.max(3,Math.floor(h*.42)),ww=Math.max(1,w-10),hh=Math.max(3,Math.min(18,Math.floor(h*.3))),segments=Math.max(1,Math.floor(ww/6)),lit=Math.round(s.value/s.max*segments);
  for(let i=0;i<segments;i++){const left=x+Math.floor(i*ww/segments),next=x+Math.floor((i+1)*ww/segments),width=Math.max(1,next-left-2);ctx.fillStyle=i<lit?s.color:C.grid;ctx.fillRect(left,y,width,hh);}
  if(s.target!==null){const tx=x+Math.round(s.target/s.max*(ww-1));line(ctx,tx,y-4,tx,y+hh+3,C.amber);}
  if(s.showLabels&&h>=42){text(ctx,formatVFDValue(s.value,s.unit),x,3,s.color,{width:ww*.66});text(ctx,formatVFDValue(s.max),w-5,3,C.dim,{align:'right',width:ww*.3});}
}

/** Paint once at destination display-pixel dimensions; never resize a pre-drawn chart. */
export function paintVFDChart(ctx,width,height,spec={}) {
  const w=dimension(width),h=dimension(height),s=normalizeVFDChart(spec);
  if(w<1||h<1)return{width:w,height:h,type:s.type,items:s.data.length};
  ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();ctx.imageSmoothingEnabled=false;
  try {
    if(w<16||h<12)return{width:w,height:h,type:s.type,items:s.data.length};
    if(s.type==='line'||s.type==='sparkline')drawLine(ctx,w,h,s,s.type==='sparkline');
    else if(s.type==='bar')drawBars(ctx,w,h,s);
    else if(s.type==='donut')drawDonut(ctx,w,h,s);
    else if(s.type==='gauge')drawGauge(ctx,w,h,s);
    else if(s.type==='heatmap')drawHeat(ctx,w,h,s);
    else drawBullet(ctx,w,h,s);
  } finally {ctx.restore();}
  return{width:w,height:h,type:s.type,items:s.data.length};
}

/** Pointer hit testing uses the same plot geometry as the integer painter. */
export function hitVFDChart(spec,width,height,x,y){
  const s=normalizeVFDChart(spec),w=dimension(width),h=dimension(height),n=s.data.length;
  if(!n||w<1||h<1||!Number.isFinite(x)||!Number.isFinite(y))return-1;
  if(s.type==='bar'){const b=barLayout(w,h,s);return clamp(Math.floor((y-b.y)/b.row),0,n-1);}
  if(s.type==='heatmap'){const b=heatLayout(w,h,s),column=clamp(Math.floor((x-b.x)/(b.cw+b.gap)),0,b.columns-1),row=clamp(Math.floor((y-b.y)/(b.ch+b.gap)),0,b.rows-1);return Math.min(n-1,row*b.columns+column);}
  if(s.type==='donut'){
    const ring=ringLayout(w,h,s);
    if(ring.legend&&x>=ring.legendX){const row=Math.max(14,Math.min(25,Math.floor((h-12)/n)));return clamp(Math.floor((y-6)/row),0,n-1);}
    const total=s.data.reduce((sum,p)=>sum+Math.max(0,p.value),0);if(!total)return-1;
    const angle=((Math.atan2(y-ring.cy,x-ring.cx)+Math.PI/2+Math.PI*2)%(Math.PI*2))/(Math.PI*2);let sum=0;
    for(let i=0;i<n;i++){sum+=Math.max(0,s.data[i].value)/total;if(angle<sum)return i;}return n-1;
  }
  const p=xyLayout(w,h,s.type!=='sparkline'&&s.showLabels,s.type==='sparkline');
  return clamp(Math.round((x-p.x)/Math.max(1,p.w-1)*(n-1)),0,n-1);
}

/** Native canvas remains the accessible hit target; shared skin composites vfdDraw. */
export function bindVFDChart(canvas,{getSpec=()=>({}),onSelect=()=>{},refresh=()=>{}}={}) {
  if(!canvas||typeof canvas.addEventListener!=='function')throw new TypeError('A canvas element is required.');
  const previousDraw=canvas.vfdDraw,oldAttributes={};for(const name of['data-vfd','tabindex','role','aria-label'])oldAttributes[name]=canvas.getAttribute(name);
  const originalLabel=oldAttributes['aria-label'];let destroyed=false,selected=-1;
  const current=()=>{const source=getSpec()||{};return normalizeVFDChart({...source,selectedIndex:Number.isInteger(source.selectedIndex)?source.selectedIndex:selected});};
  function updateLabel(){const s=current(),point=s.data[s.selectedIndex];const detail=point?`${point.label}: ${formatVFDValue(point.value,s.unit)}`:s.type==='gauge'||s.type==='bullet'?formatVFDValue(s.value,s.unit):`${s.data.length} data points`;canvas.setAttribute('aria-label',`${originalLabel||s.label}. ${detail}.${s.data.length?' Left and right arrows select data.':''}`);}
  canvas.setAttribute('data-vfd','canvas');canvas.setAttribute('tabindex','0');canvas.setAttribute('role','img');
  const draw=(ctx,w,h)=>paintVFDChart(ctx,w,h,current());canvas.vfdDraw=draw;
  function choose(index,event){const s=current();if(index<0||index>=s.data.length)return;selected=index;const point=s.data[index];onSelect({index,label:point.label,value:point.value,event});if(destroyed)return;updateLabel();refresh();}
  const click=event=>{const box=canvas.getBoundingClientRect();if(!box.width||!box.height)return;choose(hitVFDChart(current(),canvas.width,canvas.height,(event.clientX-box.left)*canvas.width/box.width,(event.clientY-box.top)*canvas.height/box.height),event);};
  const keydown=event=>{const s=current();if(!s.data.length)return;let index=s.selectedIndex;if(event.key==='ArrowRight'||event.key==='ArrowDown')index=index<0?0:Math.min(s.data.length-1,index+1);else if(event.key==='ArrowLeft'||event.key==='ArrowUp')index=index<0?s.data.length-1:Math.max(0,index-1);else if(event.key==='Home')index=0;else if(event.key==='End')index=s.data.length-1;else return;event.preventDefault();choose(index,event);};
  canvas.addEventListener('click',click);canvas.addEventListener('keydown',keydown);updateLabel();
  return{refresh(){if(!destroyed){updateLabel();refresh();}},destroy(){if(destroyed)return;destroyed=true;canvas.removeEventListener('click',click);canvas.removeEventListener('keydown',keydown);if(canvas.vfdDraw===draw)canvas.vfdDraw=previousDraw;for(const[name,value]of Object.entries(oldAttributes)){if(value===null)canvas.removeAttribute(name);else canvas.setAttribute(name,value);}}};
}

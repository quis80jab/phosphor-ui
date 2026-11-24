/** Pixel-glyph sources for the VFD bench. Interaction and storage stay outside this module. */
import { pixelText, glyphMark, glyphRect } from './vfd-glyphs.js?v=glyph-2';
export const BENCH_WIDTH=320;
export const BENCH_HEIGHT=200;

const COMMON={label:'',value:50,min:0,max:100,step:1,unit:'%',color:'#8ce5d3',size:100,disabled:false,variant:'outline',mark:'dots',notes:'',query:'',active:[false,false,false],option:0};
function entry(id,name,category,description,overrides){const defaults={...COMMON,...overrides};defaults.active=Object.freeze([...defaults.active]);return Object.freeze({id,name,category,description,defaults:Object.freeze(defaults)});}
export const BENCH_CATALOG=Object.freeze([
  entry('dial','Rotary dial','Inputs','An indexed dial with a live numeric readout.',{label:'ROTARY DIAL',value:62,color:'#83e8d0'}),
  entry('wheel','Encoder wheel','Inputs','A ridged encoder for precise incremental adjustments.',{label:'ENCODER WHEEL',value:24,min:0,max:99,unit:'',color:'#8bd9ff'}),
  entry('bar','Progress bar','Feedback','A segmented bar for completion or signal strength.',{label:'PROGRESS',value:68,color:'#83e8d0'}),
  entry('indicators','Status indicators','Feedback','Three independently switchable status lamps.',{label:'STATUS ARRAY',value:0,min:0,max:2,unit:'',active:[true,false,false],color:'#79ecc3'}),
  entry('slider','Linear slider','Inputs','A continuous track with a visible thumb and value.',{label:'SIGNAL LEVEL',value:58,color:'#8ccfff'}),
  entry('percentage','Percentage readout','Feedback','A large value supported by a circular progress display.',{label:'CAPACITY',value:76,color:'#a3e2d6'}),
  entry('search','Search field','Inputs','Filter the local optical-layer list.',{label:'FIND A LAYER',value:0,unit:'',query:'',color:'#9bded0'}),
  entry('buttons','Action buttons','Actions','Three independent keys with pressed-state feedback.',{label:'ACTION KEYS',value:0,min:0,max:2,unit:'',color:'#94e3d3'}),
  entry('toggle','Power toggle','Actions','A binary control with an explicit on or off state.',{label:'OUTPUT ENABLE',value:0,min:0,max:1,unit:'',active:[true,false,false],color:'#8de7bb'}),
  entry('stepper','Numeric stepper','Inputs','A bounded numeric value with increment and decrement keys.',{label:'STEP VALUE',value:12,min:0,max:99,unit:'',color:'#9acfff'}),
  entry('level','Level meter','Feedback','A bank of segmented vertical signal meters.',{label:'LEVEL METER',value:-12,min:-60,max:0,step:1,unit:'dB',color:'#86e5be'}),
  entry('segments','Segmented selector','Actions','Choose one mode from three mutually exclusive options.',{label:'CONTROL MODE',value:0,min:0,max:2,unit:'',option:0,color:'#a1d9ff'})
]);

const LOOKUP=new Map(BENCH_CATALOG.map(item=>[item.id,item]));
const LAYERS=['PHOSPHOR','GRID','FILAMENT','GLASS'];
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const finite=(value,fallback)=>Number.isFinite(Number(value))&&value!==null&&value!==''?Number(value):fallback;
function visualConfig(id,input){
  const base=LOOKUP.get(id)?.defaults||COMMON,source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const c={...base,...source};c.min=finite(c.min,base.min);c.max=finite(c.max,base.max);if(c.max<=c.min)c.max=c.min+1;
  c.value=clamp(finite(c.value,base.value),c.min,c.max);c.step=Math.max(.0001,finite(c.step,base.step));c.size=clamp(finite(c.size,100),80,120);
  c.color=/^#[\da-f]{6}$/i.test(c.color||'')?c.color:base.color;c.label=typeof c.label==='string'?c.label:base.label;c.unit=typeof c.unit==='string'?c.unit:base.unit;c.query=typeof c.query==='string'?c.query:'';
  c.variant=['outline','solid','minimal'].includes(c.variant)?c.variant:'outline';c.mark=['dots','hashes','blocks','lines'].includes(c.mark)?c.mark:'dots';c.disabled=c.disabled===true;
  c.active=[0,1,2].map(index=>Array.isArray(c.active)&&c.active[index]===true);c.option=clamp(Math.round(finite(c.option,0)),0,2);
  c.ratio=Number.isFinite(c.max-c.min)&&c.max>c.min?(c.value-c.min)/(c.max-c.min):0;return c;
}
function rgba(hex,alpha){return `rgba(${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)},${alpha})`;}
function numberText(c){const precision=Math.min(3,Math.max(0,(String(c.step).split('.')[1]||'').length));return c.value.toFixed(precision);}
function valueText(c){return `${numberText(c)}${c.unit?` ${c.unit}`:''}`;}
function text(ctx,value,x,y,scale,color,align='left',maxWidth){return pixelText(ctx,value,x,y,color,scale,{align,maxWidth});}
function rect(ctx,x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.max(1,Math.round(w)),Math.max(1,Math.round(h)));}
function pixelLine(ctx,x0,y0,x1,y1,color,width=1){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let error=dx+dy;
  for(let steps=0;steps<1000;steps++){rect(ctx,x0,y0,width,width,color);if(x0===x1&&y0===y1)break;const twice=error*2;if(twice>=dy){error+=dy;x0+=sx;}if(twice<=dx){error+=dx;y0+=sy;}}
}
function pattern(ctx,c,x,y,w,h,alpha=1,size=4,pitch=6){for(let yy=y;yy+size<=y+h;yy+=pitch)for(let xx=x;xx+size<=x+w;xx+=pitch)glyphMark(ctx,xx,yy,c.mark,rgba(c.color,alpha),size);}
function corners(ctx,x,y,w,h,color){for(const [xx,yy,sx,sy] of [[x,y,1,1],[x+w-1,y,-1,1],[x,y+h-1,1,-1],[x+w-1,y+h-1,-1,-1]]){pixelLine(ctx,xx,yy,xx+sx*7,yy,color);pixelLine(ctx,xx,yy,xx,yy+sy*7,color);}}
function face(ctx,c,x,y,w,h,on=false){
  if(c.variant==='solid'||on){rect(ctx,x+3,y+3,w-6,h-6,rgba(c.color,on?.07:.035));pattern(ctx,c,x+5,y+5,w-10,h-10,on?.76:.22);}
  if(c.variant==='minimal'&&!on)corners(ctx,x,y,w,h,rgba(c.color,.5));else glyphRect(ctx,x,y,w,h,rgba(c.color,on?1:.7),{double:c.variant!=='minimal'});
}
function key(ctx,c,x,y,w,h,label,on=false){
  face(ctx,c,x,y,w,h,on);const bandWidth=Math.min(w-10,(label.length*6-1)*2+8),bandX=x+(w-bandWidth)/2,bandY=y+(h-18)/2;
  rect(ctx,bandX,bandY,bandWidth,18,on?c.color:'#020b0e');text(ctx,label,x+w/2,bandY+2,2,on?'#06231f':c.color,'center',w-10);
  for(let xx=x+8;xx+3<x+w-7;xx+=7)glyphMark(ctx,xx,y+h-6,c.mark,rgba(c.color,on?.95:.35),3);
}
function endLabels(ctx,c,y=155){text(ctx,String(c.min),25,y,1,rgba(c.color,.65));text(ctx,String(c.max),295,y,1,rgba(c.color,.65),'right');}
function markArc(ctx,c,cx,cy,r,start,end,count,ratio){
  for(let i=0;i<=count;i++){const angle=start+(end-start)*i/count,on=i/count<=ratio;glyphMark(ctx,Math.round(cx+Math.cos(angle)*r)-2,Math.round(cy+Math.sin(angle)*r)-2,c.mark,rgba(c.color,on?1:.19),5);}
}
function dial(ctx,c){
  const cx=160,cy=96,start=Math.PI*.75,end=Math.PI*2.25,angle=start+(end-start)*c.ratio;
  markArc(ctx,c,cx,cy,54,start,end,40,c.ratio);
  if(c.variant!=='minimal')for(let i=0;i<=8;i++){const a=start+(end-start)*i/8;glyphMark(ctx,cx+Math.cos(a)*44-1,cy+Math.sin(a)*44-1,'blocks',rgba(c.color,.42),2);}
  if(c.variant==='solid')pattern(ctx,c,132,70,56,55,.12,3,7);
  for(let r=32;r<=41;r+=4)glyphMark(ctx,cx+Math.cos(angle)*r-1,cy+Math.sin(angle)*r-1,'blocks',c.color,3);
  glyphRect(ctx,cx+Math.cos(angle)*54-4,cy+Math.sin(angle)*54-4,9,9,c.color);
  rect(ctx,125,79,70,32,'#020b0e');text(ctx,numberText(c),cx,81,4,c.color,'center',70);text(ctx,c.unit||'VALUE',cx,118,1,rgba(c.color,.7),'center',60);
  text(ctx,String(c.min),112,152,1,rgba(c.color,.65),'center');text(ctx,String(c.max),208,152,1,rgba(c.color,.65),'center');text(ctx,'<< ROTATE >>',160,176,1,rgba(c.color,.6),'center');
}
function wheel(ctx,c){
  const points=[[131,45],[189,45],[211,67],[211,123],[189,145],[131,145],[109,123],[109,67]];
  if(c.variant!=='minimal')points.forEach((p,i)=>pixelLine(ctx,...p,...points[(i+1)%points.length],rgba(c.color,.6)));
  for(let i=0;i<32;i++){const angle=i/32*Math.PI*2+c.ratio*Math.PI*2;glyphMark(ctx,160+Math.cos(angle)*44-2,95+Math.sin(angle)*44-2,c.mark,rgba(c.color,.42+.55*Math.max(0,Math.cos(angle-3.6))),5);}
  face(ctx,c,131,78,58,35,c.variant==='solid');rect(ctx,136,83,48,24,'#020b0e');text(ctx,numberText(c),160,85,3,c.color,'center',48);
  const angle=-Math.PI/2+c.ratio*Math.PI*2;glyphRect(ctx,160+Math.cos(angle)*32-3,95+Math.sin(angle)*32-3,7,7,c.color,{fill:true});
  text(ctx,'-',88,87,3,rgba(c.color,.8),'center');text(ctx,'+',232,87,3,rgba(c.color,.8),'center');text(ctx,c.unit||'ENCODER',160,157,1,rgba(c.color,.75),'center');text(ctx,`STEP ${c.step}`,160,176,1,rgba(c.color,.5),'center');
}
function bar(ctx,c){
  text(ctx,valueText(c),295,56,3,c.color,'right',185);face(ctx,c,24,85,272,30);
  const total=42;for(let column=0;column<total;column++)for(let row=0;row<3;row++)glyphMark(ctx,34+column*6,91+row*6,c.mark,rgba(c.color,column<Math.round(total*c.ratio)?1:.16),4);
  endLabels(ctx,c,128);text(ctx,`${Math.round(c.ratio*100)} / 100`,160,162,2,rgba(c.color,.9),'center');
}
function indicators(ctx,c){
  const labels=['READY','WARN','FAULT'],colors=[c.color,'#ffd483','#ff8496'];
  for(let i=0;i<3;i++){
    const cx=65+i*95,on=c.active[i],cc={...c,color:colors[i]};face(ctx,cc,cx-22,73,44,44,on&&c.variant==='solid');
    const alpha=on?1:.17;for(let row=-2;row<=2;row++)for(let col=-2;col<=2;col++)if(Math.abs(row)+Math.abs(col)<=2)glyphMark(ctx,cx+col*6-2,95+row*6-2,c.mark,rgba(cc.color,alpha),5);
    if(on){pixelLine(ctx,cx,78,cx+17,95,rgba(cc.color,.7));pixelLine(ctx,cx+17,95,cx,112,rgba(cc.color,.7));pixelLine(ctx,cx,112,cx-17,95,rgba(cc.color,.7));pixelLine(ctx,cx-17,95,cx,78,rgba(cc.color,.7));}
    text(ctx,labels[i],cx,131,1,rgba(cc.color,on?1:.45),'center');text(ctx,on?'[ON]':'[OFF]',cx,157,1,rgba(cc.color,on?.9:.35),'center');
  }
}
function slider(ctx,c){
  const thumb=Math.round(25+c.ratio*270);text(ctx,valueText(c),295,56,3,c.color,'right',190);
  if(c.variant!=='minimal')glyphRect(ctx,25,95,270,20,rgba(c.color,.5),{double:c.variant==='solid'});
  for(let column=0;column<43;column++){const x=31+column*6;glyphMark(ctx,x,102,c.mark,rgba(c.color,x<=thumb?1:.18),4);}
  for(let i=0;i<=10;i++)glyphMark(ctx,24+i*27,125,'blocks',rgba(c.color,i%5===0?.72:.3),i%5===0?3:2);
  rect(ctx,thumb-7,91,15,28,'#020b0e');glyphRect(ctx,thumb-7,91,15,28,c.color,{double:true});glyphMark(ctx,thumb-2,101,c.mark,c.color,5);
  endLabels(ctx,c,146);text(ctx,'< FINE ADJUST >',160,176,1,rgba(c.color,.55),'center');
}
function percentage(ctx,c){
  const cx=160,cy=109;markArc(ctx,c,cx,cy,57,-Math.PI/2,Math.PI*1.5,59,c.ratio);
  if(c.variant==='solid')pattern(ctx,c,130,83,60,54,.12,4,7);
  rect(ctx,115,84,90,38,'#020b0e');text(ctx,numberText(c),cx,87,5,c.color,'center',90);text(ctx,c.unit||'PERCENT',cx,130,2,rgba(c.color,.85),'center',80);
  text(ctx,'[ LIVE READOUT ]',cx,176,1,rgba(c.color,.5),'center');
}
function search(ctx,c){
  face(ctx,c,20,60,280,38);text(ctx,'>',30,72,2,c.color);text(ctx,c.query||'SEARCH...',51,73,1.5,rgba(c.color,c.query?1:.55),'left',237);
  const matches=LAYERS.filter(item=>item.includes(c.query.trim().toUpperCase()));
  if(!matches.length){text(ctx,'NO MATCHING LAYERS',24,120,1,rgba(c.color,.8));text(ctx,'TRY PHOSPHOR / GRID / FILAMENT / GLASS',24,141,1,rgba(c.color,.45),'left',272);return;}
  matches.forEach((item,index)=>{const y=109+index*18;glyphMark(ctx,25,y+1,c.mark,rgba(c.color,.8),5);text(ctx,item,39,y,1,rgba(c.color,.95));text(ctx,'LAYER',294,y,1,rgba(c.color,.35),'right');});
  text(ctx,`${matches.length} MATCH${matches.length===1?'':'ES'}`,295,176,1,rgba(c.color,.4),'right');
}
function actionButtons(ctx,c){['ARM','HOLD','RESET'].forEach((label,index)=>{const x=20+index*95,on=c.active[index];key(ctx,c,x,80,90,44,label,on);text(ctx,on?'[ON]':'[OFF]',x+45,145,1,rgba(c.color,on?.95:.45),'center');});text(ctx,'INDEPENDENT KEYS',160,176,1,rgba(c.color,.4),'center');}
function toggle(ctx,c){
  const on=c.active[0];glyphRect(ctx,110,75,100,50,rgba(c.color,.75),{double:false});
  [['OFF',112,!on],['ON',161,on]].forEach(([label,x,selected])=>{face(ctx,c,x,77,47,46,selected);rect(ctx,x+4,91,39,19,selected?c.color:'#020b0e');text(ctx,label,x+23.5,94,2,selected?'#06231f':rgba(c.color,.55),'center');});
  text(ctx,on?'OUTPUT ON':'OUTPUT OFF',160,145,2,c.color,'center');text(ctx,'ENABLE / DISABLE',160,176,1,rgba(c.color,.5),'center');
}
function stepper(ctx,c){
  face(ctx,c,25,80,55,45);face(ctx,c,240,80,55,45);text(ctx,'-',52.5,91,3,rgba(c.color,c.value<=c.min?.25:1),'center');text(ctx,'+',267.5,91,3,rgba(c.color,c.value>=c.max?.25:1),'center');
  for(const x of [32,247])for(let i=0;i<6;i++)glyphMark(ctx,x+i*6,118,c.mark,rgba(c.color,.55),3);
  text(ctx,numberText(c),160,86,4,c.color,'center',132);if(c.unit)text(ctx,c.unit,160,122,1,rgba(c.color,.8),'center');endLabels(ctx,c,153);text(ctx,`STEP ${c.step}`,160,176,1,rgba(c.color,.6),'center');
}
function level(ctx,c){
  const factors=[.62,.82,.95,1,.9,.72,.55];
  if(c.variant!=='minimal')glyphRect(ctx,52,57,207,110,rgba(c.color,.4),{double:c.variant==='solid'});
  for(let column=0;column<7;column++)for(let row=0;row<13;row++){
    const on=row/13<c.ratio*factors[column],color=row>=11?'#ffa88a':row>=9?'#e0e59a':c.color;
    for(let i=0;i<3;i++)glyphMark(ctx,61+column*28+i*5,153-row*7,c.mark,rgba(color,on?1:.13),4);
  }
  for(const [label,y] of [['0',64],['-20',96],['-40',128],['-60',157]])text(ctx,label,45,y,1,rgba(c.color,.5),'right');text(ctx,valueText(c),160,169,2,c.color,'center');
}
function segments(ctx,c){
  ['AUTO','MANUAL','TEST'].forEach((label,index)=>{const x=20+index*95,on=c.option===index;key(ctx,c,x,80,90,44,label,on);if(on){glyphMark(ctx,x+41,137,c.mark,c.color,7);}});
  text(ctx,`${['AUTO','MANUAL','TEST'][c.option]} SELECTED`,160,163,2,rgba(c.color,.9),'center');
}
const PAINTERS={dial,wheel,bar,indicators,slider,percentage,search,buttons:actionButtons,toggle,stepper,level,segments};

export function paintWidget(ctx,id,config={}){
  const c=visualConfig(id,config);ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
  rect(ctx,0,0,BENCH_WIDTH,BENCH_HEIGHT,'#020b0e');ctx.beginPath();ctx.rect(0,0,BENCH_WIDTH,BENCH_HEIGHT);ctx.clip();
  text(ctx,c.label,20,15,2,rgba(c.color,c.disabled?.6:1),'left',c.disabled?220:280);
  if(c.disabled)text(ctx,'OFFLINE',300,20,1,rgba(c.color,.55),'right');
  for(let x=20;x<300;x+=6)glyphMark(ctx,x,37,c.mark,rgba(c.color,.3),2);
  ctx.translate(160,110);ctx.scale(c.size/100,c.size/100);ctx.translate(-160,-110);ctx.globalAlpha=c.disabled?.35:1;
  const painter=PAINTERS[id];if(painter)painter(ctx,c);else text(ctx,'UNKNOWN WIDGET',160,100,2,c.color,'center');
  ctx.restore();
}

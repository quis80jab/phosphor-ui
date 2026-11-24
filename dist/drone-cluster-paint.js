import { pixelText, glyphRect } from './vfd-glyphs.js?v=grid-1';

const MINT = '#a9e9df', DIM = '#558c7e', INK = '#06231f', AMBER = '#ffc782';
const TYPES = new Set(['drone-heading','drone-altitude','drone-attitude','drone-feed']);
const clamp = (value, min, max) => Math.max(min,Math.min(max,value));
const finite = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const wrap = value => ((value%360)+360)%360;
const degrees = value => value*Math.PI/180;
const widthOf = text => Math.max(0,[...text].length*6-1);
function text(ctx,value,x,y,width,color=MINT,scale=1){
  pixelText(ctx,value,x+Math.floor(width/2),y,color,scale,{align:'center',maxWidth:Math.max(0,width)});
}
function line(ctx,x0,y0,x1,y1,color){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;
  let error=dx+dy;ctx.fillStyle=color;
  for(;;){ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const twice=2*error;if(twice>=dy){error+=dy;x0+=sx;}if(twice<=dx){error+=dx;y0+=sy;}}
}
function polar(cx,cy,radius,angle){return[cx+Math.sin(degrees(angle))*radius,cy-Math.cos(degrees(angle))*radius];}
function tick(ctx,cx,cy,radius,angle,length,color=DIM){line(ctx,...polar(cx,cy,radius-length,angle),...polar(cx,cy,radius,angle),color);}
function ring(ctx,cx,cy,radius,start=0,end=360,color=DIM){
  ctx.fillStyle=color;for(let angle=start;angle<=end;angle+=3){const[px,py]=polar(cx,cy,radius,angle);ctx.fillRect(Math.round(px),Math.round(py),1,1);}
}
function frame(ctx,x,y,width,height){ctx.fillStyle=INK;ctx.fillRect(x,y,width,height);glyphRect(ctx,x,y,width,height,DIM);}

export function droneBearingInfo(value=0){
  const heading=wrap(finite(value));
  return{heading,cardinal:['N','NE','E','SE','S','SW','W','NW'][Math.round(heading/45)%8],
    cardinals:['N','E','S','W'].map((label,index)=>({label,angle:index*90-heading}))};
}
function heading(ctx,data,x,y,width,height){
  frame(ctx,x,y,width,height);text(ctx,'DIRECTION',x+4,y+5,width-8);
  const info=droneBearingInfo(data.heading),cx=x+Math.floor(width/2),cy=y+Math.floor((height-1)/2);
  // Cardinal glyphs extend 12 cells beyond the ring. Reserve their whole
  // footprint between the title and telemetry footer at every bearing.
  const radius=Math.max(2,Math.min(Math.floor(width/2)-17,Math.floor((height-58)/2)));
  ring(ctx,cx,cy,radius);
  for(let angle=0;angle<360;angle+=30)tick(ctx,cx,cy,radius,angle-info.heading,angle%90===0?4:2);
  for(const cardinal of info.cardinals){
    const[px,py]=polar(cx,cy,radius+9,cardinal.angle);
    pixelText(ctx,cardinal.label,Math.round(px)-2,Math.round(py)-3,cardinal.label==='N'?AMBER:MINT);
  }
  line(ctx,cx,cy-8,cx,cy+7,MINT);line(ctx,cx,cy-8,cx-3,cy-3,MINT);line(ctx,cx,cy-8,cx+3,cy-3,MINT);
  text(ctx,`${String(Math.round(info.heading)%360).padStart(3,'0')}° ${info.cardinal}`,x+4,y+height-13,width-8,AMBER);
}
function altitude(ctx,data,x,y,width,height){
  frame(ctx,x,y,width,height);text(ctx,'ALTITUDE',x+4,y+5,width-8);
  const amount=Math.max(0,finite(data.altitude)),top=y+23,bottom=y+height-22,barX=x+10,barWidth=10;
  const segments=Math.max(1,Math.floor((bottom-top+1)/3)),filled=Math.round(clamp(amount/30,0,1)*segments);
  for(let i=0;i<segments;i++){ctx.fillStyle=i<filled?MINT:'#193e35';ctx.fillRect(barX,bottom-i*3-1,barWidth,2);}
  for(const[ratio,label]of[[0,'0'],[.5,'15'],[1,'30']]){
    const yy=bottom-Math.round(ratio*(bottom-top));line(ctx,barX+barWidth+2,yy,barX+barWidth+5,yy,DIM);
    pixelText(ctx,label,barX+barWidth+8,yy-3,DIM);
  }
  const value=`${Math.min(amount,9999).toFixed(1)} M`,readX=x+48,readWidth=width-52;
  const scale=readWidth>=widthOf(value)*2?2:1;
  text(ctx,value,readX,y+Math.floor(height/2)-4,readWidth,amount>30?AMBER:MINT,scale);
  text(ctx,'ABOVE MAP',x+4,y+height-12,width-8,DIM);
}
function attitude(ctx,data,x,y,width,height){
  const axis=['yaw','roll','pitch'].includes(data.axis)?data.axis:'yaw';
  const value=axis==='yaw'?wrap(finite(data.value)):clamp(finite(data.value),-90,90);
  frame(ctx,x,y,width,height);text(ctx,axis.toUpperCase(),x+4,y+5,width-8);
  const cx=x+Math.floor(width/2),cy=y+Math.floor(height/2)+1;
  const radius=Math.max(2,Math.min(Math.floor(width/2)-10,Math.floor(height/2)-18));
  ring(ctx,cx,cy,radius,axis==='yaw'?0:-90,axis==='yaw'?360:90);
  const start=axis==='yaw'?0:-90,end=axis==='yaw'?359:90;
  for(let angle=start;angle<=end;angle+=30)tick(ctx,cx,cy,radius,angle,angle%90===0?4:2);
  if(axis!=='yaw'){line(ctx,cx-radius-3,cy,cx+radius+3,cy,DIM);tick(ctx,cx,cy,radius,0,5,MINT);}
  line(ctx,cx,cy,...polar(cx,cy,radius-3,value),AMBER);
  ctx.fillStyle=MINT;ctx.fillRect(cx-1,cy-1,3,3);
  const readout=`${axis==='yaw'?'':value>=0?'+':''}${value.toFixed(1)}°`;
  text(ctx,readout,x+4,y+height-12,width-8,AMBER);
}

// A procedural calibration scene: these are simulated sensor samples, not OSM
// temperatures, surveyed depth, or a camera feed from the moving demo marker.
function sceneSample(u,v){
  const road=Math.abs(v+.22*Math.sin(u*2.7))<.12||Math.abs(u-.32)<.09;
  const target=Math.hypot(u+.18,v-.08)<.21;
  const roof=u>.28&&u<.91&&v>-.66&&v<-.2;
  const tree=Math.hypot(u+.72,v+.48)<.19||Math.hypot(u-.78,v-.64)<.2;
  const grid=(Math.floor((u+2)*9)+Math.floor((v+2)*9))%2===0;
  const height=roof?.62:tree?.46:target?.2:0;
  const temperature=roof?.7:target?.96:road?.5:tree?.18:.28+(grid?.06:0);
  const color=roof?(grid?'#c1b99e':'#9d9d89'):target?'#e9c58a':tree?(grid?'#558c7e':'#3e7565'):road?'#647d7d':grid?'#153c32':'#1c493c';
  return{color,temperature,depth:clamp(.65-height*.7+v*.08,0,1)};
}
const THERMAL=['#203350','#376c9b','#67b5a7','#b8cc79','#ffc782','#f18b71'];
const DEPTH=['#c7f1ed','#a2dfd7','#79bcba','#568d99','#395d77','#263a57'];
function feed(ctx,data,x,y,width,height){
  frame(ctx,x,y,width,height);
  const mode=['color','thermal','zoom','depth'].includes(data.feed)?data.feed:'color';
  text(ctx,'SIMULATED SENSOR',x+4,y+5,width-8,DIM);
  const plotWidth=Math.min(136,Math.max(0,width-12)),plotHeight=Math.min(80,Math.max(0,height-32));
  if(plotWidth<2||plotHeight<2)return;
  const left=x+Math.floor((width-plotWidth)/2),top=y+17;
  const angle=degrees(wrap(finite(data.heading))+clamp(finite(data.roll),-90,90)*.2);
  const cos=Math.cos(angle),sin=Math.sin(angle),pitch=clamp(finite(data.pitch),-90,90)/90;
  const magnification=clamp(finite(data.zoom,1),1,8)*(mode==='zoom'?2:1);
  for(let py=0;py<plotHeight;py+=2)for(let px=0;px<plotWidth;px+=2){
    const horizontal=((px+1)/plotWidth*2-1)*1.35/magnification,vertical=((py+1)/plotHeight*2-1)/magnification;
    const u=horizontal*cos-vertical*sin,v=horizontal*sin+vertical*cos+pitch*.3;
    const sample=sceneSample(u,v);
    ctx.fillStyle=mode==='thermal'?THERMAL[Math.min(THERMAL.length-1,Math.floor(sample.temperature*THERMAL.length))]
      :mode==='depth'?DEPTH[Math.min(DEPTH.length-1,Math.floor(sample.depth*DEPTH.length))]:sample.color;
    ctx.fillRect(left+px,top+py,Math.min(2,plotWidth-px),Math.min(2,plotHeight-py));
  }
  const cx=left+Math.floor(plotWidth/2),cy=top+Math.floor(plotHeight/2);
  line(ctx,cx-7,cy,cx-3,cy,MINT);line(ctx,cx+3,cy,cx+7,cy,MINT);
  line(ctx,cx,cy-7,cx,cy-3,MINT);line(ctx,cx,cy+3,cx,cy+7,MINT);
  glyphRect(ctx,left,top,plotWidth,plotHeight,DIM);
  const label=mode==='depth'?'DEPTH / RELATIVE':mode==='thermal'?'THERMAL / TEST':`${mode.toUpperCase()} / ${magnification.toFixed(1)}X`;
  text(ctx,label,x+4,y+height-11,width-8,mode==='thermal'?AMBER:MINT);
}

/** Raster-only instruments for the viewer's existing shared optical pass. */
export function paintDroneControl(ctx,{element,type,x=0,y=0,width=0,height=0,focused=false}={}){
  if(!TYPES.has(type))return false;
  if(!ctx||![x,y,width,height].every(Number.isFinite))return true;
  x=Math.round(x);y=Math.round(y);width=Math.round(width);height=Math.round(height);
  if(width<1||height<1)return true;
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
  const data=element?.dataset||{};
  if(data.available==='false'){
    frame(ctx,x,y,width,height);
    const title=type==='drone-heading'?'DIRECTION':type==='drone-altitude'?'ALTITUDE':type==='drone-attitude'?String(data.axis||'ATTITUDE').toUpperCase():'SIMULATED SENSOR';
    text(ctx,title,x+4,y+5,width-8,DIM);
    text(ctx,'--',x+4,y+Math.max(17,Math.floor(height/2)-13),width-8,MINT);
    text(ctx,'TELEMETRY',x+4,y+Math.floor(height/2)+1,width-8,DIM);
    text(ctx,'UNAVAILABLE',x+4,y+Math.floor(height/2)+11,width-8,DIM);
  } else if(type==='drone-heading')heading(ctx,data,x,y,width,height);
  else if(type==='drone-altitude')altitude(ctx,data,x,y,width,height);
  else if(type==='drone-attitude')attitude(ctx,data,x,y,width,height);
  else feed(ctx,data,x,y,width,height);
  if(focused&&width>4&&height>4)glyphRect(ctx,x+2,y+2,width-4,height-4,MINT);
  ctx.restore();return true;
}

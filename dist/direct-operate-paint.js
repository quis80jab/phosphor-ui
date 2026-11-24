import{pixelText,glyphRect}from'./vfd-glyphs.js?v=grid-1';

const MINT='#a9e9df',DIM='#558c7e',INK='#06231f',AMBER='#ffc782';
const TYPES=new Set(['operate-stick','operate-frame','operate-hud']);
const finite=value=>Number.isFinite(Number(value))?Number(value):0;
function text(ctx,value,x,y,width,color=MINT){pixelText(ctx,value,x+Math.floor(width/2),y,color,1,{align:'center',maxWidth:Math.max(0,width)});}
function line(ctx,x0,y0,x1,y1,color){
  x0=Math.round(x0);y0=Math.round(y0);x1=Math.round(x1);y1=Math.round(y1);
  const dx=Math.abs(x1-x0),sx=x0<x1?1:-1,dy=-Math.abs(y1-y0),sy=y0<y1?1:-1;let error=dx+dy;ctx.fillStyle=color;
  for(;;){ctx.fillRect(x0,y0,1,1);if(x0===x1&&y0===y1)break;const e=error*2;if(e>=dy){error+=dy;x0+=sx;}if(e<=dx){error+=dx;y0+=sy;}}
}
function ring(ctx,x,y,r,color){ctx.fillStyle=color;for(let angle=0;angle<360;angle+=2){const a=angle*Math.PI/180;ctx.fillRect(x+Math.round(Math.cos(a)*r),y+Math.round(Math.sin(a)*r),1,1);}}
function stick(ctx,data,x,y,width,height,focused){
  ctx.fillStyle=INK;ctx.fillRect(x,y,width,height);glyphRect(ctx,x,y,width,height,focused?MINT:DIM);
  const cx=x+Math.floor(width/2),cy=y+Math.floor(height/2),radius=Math.max(1,Math.floor(Math.min(width,height)*.35));
  const available=data.available!=='false',color=available?MINT:DIM;
  ring(ctx,cx,cy,radius,DIM);
  for(let i=-radius+3;i<=radius-3;i+=4){ctx.fillStyle=DIM;ctx.fillRect(cx+i,cy,1,1);ctx.fillRect(cx,cy+i,1,1);}
  const inputX=available?finite(data.x):0,inputY=available?finite(data.y):0,length=Math.max(1,Math.hypot(inputX,inputY));
  const knobX=cx+Math.round(inputX/length*radius),knobY=cy-Math.round(inputY/length*radius);
  line(ctx,cx,cy,knobX,knobY,DIM);glyphRect(ctx,knobX-4,knobY-4,9,9,color);
  ctx.fillStyle=available?AMBER:DIM;ctx.fillRect(knobX-1,knobY-1,3,3);
  const left=data.side==='left';text(ctx,left?'UP':'FWD',x+2,y+3,width-4,color);text(ctx,left?'DOWN':'BACK',x+2,y+height-10,width-4,color);
  pixelText(ctx,'<',x+3,cy-3,color);pixelText(ctx,'>',x+width-8,cy-3,color);
}
function frame(ctx,data,x,y,width,height){
  // Only the border and caption strip are painted: the OSM inset remains visible.
  glyphRect(ctx,x,y,width,height,DIM);ctx.fillStyle=INK;ctx.fillRect(x+1,y+1,Math.max(0,width-2),Math.min(13,Math.max(0,height-2)));
  text(ctx,data.side==='map'?'MAP / TOP':'CAMERA / DEMO',x+3,y+4,width-6,MINT);
  if(data.side==='map'){
    const cx=x+Math.floor(width/2),cy=y+Math.floor(height/2);
    glyphRect(ctx,cx-4,cy-4,9,9,MINT);ctx.fillStyle='#ff6974';ctx.fillRect(cx-1,cy-1,3,3);
  }
  const corner=Math.min(5,Math.floor(Math.min(width,height)/3));
  for(const[cx,cy,sx,sy]of[[x,y,1,1],[x+width-1,y,-1,1],[x,y+height-1,1,-1],[x+width-1,y+height-1,-1,-1]]){
    line(ctx,cx,cy,cx+sx*corner,cy,MINT);line(ctx,cx,cy,cx,cy+sy*corner,MINT);
  }
}
function hud(ctx,data,x,y,width,height){
  ctx.fillStyle=INK;ctx.fillRect(x,y,width,height);glyphRect(ctx,x,y,width,height,DIM);
  const axis=String(data.axis||'').toUpperCase(),value=finite(data.value),available=data.available!=='false';
  text(ctx,axis,x+2,y+4,width-4,DIM);
  const unit=axis==='ALTITUDE'?' M':axis==='SPEED'?' M/S':'°';
  const signed=(axis==='ROLL'||axis==='PITCH')&&value>=0?'+':'';
  let readout=available?`${signed}${value.toFixed(1)}${unit}`:'--';
  if(axis==='HEADING'&&available)readout=`${Math.round(value)%360}° ${['N','NE','E','SE','S','SW','W','NW'][Math.round(value/45)%8]}`;
  text(ctx,readout,x+2,y+Math.max(15,Math.floor(height*.58)),width-4,available?MINT:DIM);
}

/** Raster-only overlays share the existing display lattice and optical pass. */
export function paintDirectOperateControl(ctx,{element,type,x=0,y=0,width=0,height=0,focused=false}={}){
  if(!TYPES.has(type))return false;
  if(!ctx||![x,y,width,height].every(Number.isFinite))return true;
  x=Math.round(x);y=Math.round(y);width=Math.round(width);height=Math.round(height);if(width<1||height<1)return true;
  ctx.save();ctx.beginPath();ctx.rect(x,y,width,height);ctx.clip();
  const data=element?.dataset||{};
  if(type==='operate-stick')stick(ctx,data,x,y,width,height,focused);
  else if(type==='operate-frame')frame(ctx,data,x,y,width,height);
  else hud(ctx,data,x,y,width,height);
  ctx.restore();return true;
}

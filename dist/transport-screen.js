/** Mint transport demonstration, with pure state and 256x128 logical artwork. */
export const TRANSPORT_WIDTH=256;
export const TRANSPORT_HEIGHT=128;
const DURATION=299,TRACK_COUNT=9;
export const TRANSPORT_BUTTONS=Object.freeze([
  Object.freeze({id:'stop',label:'Stop',x:5,y:101,width:34,height:23,kind:'transport'}),
  Object.freeze({id:'previous',label:'Previous track',x:44,y:101,width:34,height:23,kind:'transport'}),
  Object.freeze({id:'play',label:'Play or pause',x:83,y:101,width:34,height:23,kind:'transport'}),
  Object.freeze({id:'next',label:'Next track',x:122,y:101,width:34,height:23,kind:'transport'})
]);

export function createTransportState(){return {track:1,elapsed:209,playing:false,stopped:false};}
function number(value,fallback){
  if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()))return fallback;
  const result=Number(value);return Number.isFinite(result)?result:fallback;
}
export function normalizeTransportState(input={}){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  let track=Math.min(TRACK_COUNT,Math.max(1,Math.round(number(source.track,1))));
  let elapsed=Math.max(0,number(source.elapsed,209));
  const stopped=typeof source.stopped==='boolean'?source.stopped:false;
  const playing=!stopped&&(typeof source.playing==='boolean'?source.playing:false);
  if(stopped)elapsed=0;
  else if(elapsed>=DURATION){track=(track-1+Math.floor(elapsed/DURATION)%TRACK_COUNT)%TRACK_COUNT+1;elapsed%=DURATION;}
  return {track,elapsed,playing,stopped};
}
export function activateTransport(state,id){
  const next=normalizeTransportState(state);
  if(id==='stop')return {...next,elapsed:0,playing:false,stopped:true};
  if(id==='play')return {...next,playing:!next.playing,stopped:false};
  if(id==='previous'||id==='next')return {...next,track:(next.track-1+(id==='next'?1:TRACK_COUNT-1))%TRACK_COUNT+1,elapsed:0,stopped:false};
  return next;
}
export function advanceTransport(state,seconds){
  const next=normalizeTransportState(state),step=number(seconds,0);
  if(!next.playing||step<=0)return next;
  // Fractional seconds are retained, so animation-frame deltas accumulate correctly.
  const total=next.elapsed+step;
  if(!Number.isFinite(total))return next;
  next.track=(next.track-1+Math.floor(total/DURATION)%TRACK_COUNT)%TRACK_COUNT+1;
  next.elapsed=total%DURATION;
  return next;
}

const FONT={
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01110','10001','10000','10111','10001','10001','01110'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  J:['00111','00010','00010','00010','00010','10010','01100'],
  K:['10001','10010','10100','11000','10100','10010','10001'],
  L:['10000','10000','10000','10000','10000','10000','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','11001','11001','10101','10011','10011','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  Q:['01110','10001','10001','10001','10101','10010','01101'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  U:['10001','10001','10001','10001','10001','10001','01110'],
  V:['10001','10001','10001','10001','10001','01010','00100'],
  W:['10001','10001','10001','10101','10101','11011','10001'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
  Z:['11111','00001','00010','00100','01000','10000','11111'],
  a:['00000','00000','01110','00001','01111','10001','01111'],
  b:['10000','10000','10110','11001','10001','10001','11110'],
  c:['00000','00000','01111','10000','10000','10000','01111'],
  d:['00001','00001','01101','10011','10001','10001','01111'],
  e:['00000','00000','01110','10001','11111','10000','01111'],
  f:['00110','01001','01000','11100','01000','01000','01000'],
  g:['00000','00000','01111','10001','01111','00001','01110'],
  h:['10000','10000','10110','11001','10001','10001','10001'],
  i:['00100','00000','01100','00100','00100','00100','01110'],
  j:['00010','00000','00110','00010','00010','10010','01100'],
  k:['10000','10000','10010','10100','11000','10100','10010'],
  l:['01100','00100','00100','00100','00100','00100','01110'],
  m:['00000','00000','11010','10101','10101','10101','10101'],
  n:['00000','00000','10110','11001','10001','10001','10001'],
  o:['00000','00000','01110','10001','10001','10001','01110'],
  p:['00000','00000','11110','10001','11110','10000','10000'],
  q:['00000','00000','01111','10001','01111','00001','00001'],
  r:['00000','00000','10110','11001','10000','10000','10000'],
  s:['00000','00000','01111','10000','01110','00001','11110'],
  t:['01000','01000','11100','01000','01000','01001','00110'],
  u:['00000','00000','10001','10001','10001','10011','01101'],
  v:['00000','00000','10001','10001','10001','01010','00100'],
  w:['00000','00000','10001','10001','10101','10101','01010'],
  x:['00000','00000','10001','01010','00100','01010','10001'],
  y:['00000','00000','10001','10001','01111','00001','01110'],
  z:['00000','00000','11111','00010','00100','01000','11111'],
  '0':['01110','10001','10011','10101','11001','10001','01110'],
  '1':['00100','01100','00100','00100','00100','00100','01110'],
  '2':['01110','10001','00001','00010','00100','01000','11111'],
  '3':['11110','00001','00001','01110','00001','00001','11110'],
  '4':['00010','00110','01010','10010','11111','00010','00010'],
  '5':['11111','10000','10000','11110','00001','00001','11110'],
  '6':['01110','10000','10000','11110','10001','10001','01110'],
  '7':['11111','00001','00010','00100','01000','01000','01000'],
  '8':['01110','10001','10001','01110','10001','10001','01110'],
  '9':['01110','10001','10001','01111','00001','00001','01110'],
  '&':['01100','10010','10100','01000','10101','10010','01101'],
  '+':['00000','00100','00100','11111','00100','00100','00000'],
  '-':['00000','00000','00000','11111','00000','00000','00000'],
  ':':['00000','00100','00100','00000','00100','00100','00000'],
  '.':['00000','00000','00000','00000','00000','00110','00110']
};

function widthOf(value,sx){return (value.length*6-1)*sx;}
function text(ctx,value,x,y,color,sx=2,sy=2){
  ctx.fillStyle=color;
  for(const character of value){
    const glyph=FONT[character];
    if(glyph)for(let row=0;row<7;row++)for(let column=0;column<5;column++)if(glyph[row][column]==='1'){
      // Round both boundaries: even the compact timer remains pixel-crisp.
      const left=Math.round(x+column*sx),top=Math.round(y+row*sy);
      ctx.fillRect(left,top,Math.round(x+(column+1)*sx)-left,Math.round(y+(row+1)*sy)-top);
    }
    x+=6*sx;
  }
}
function centered(ctx,value,y,color,sx=2,sy=2,center=128){text(ctx,value,center-widthOf(value,sx)/2,y,color,sx,sy);}
function frame(ctx,button,color,active,feedback){
  const {x,y,width,height}=button;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1;
  if(active){ctx.fillStyle=color;ctx.globalAlpha=.18;ctx.fillRect(x+3,y+3,width-6,height-6);}
  ctx.globalAlpha=feedback||active?1:.84;
  if(feedback){ctx.shadowColor=color;ctx.shadowBlur=3;}
  ctx.strokeRect(x+.5,y+.5,width-3,height-3);ctx.shadowBlur=0;
  ctx.globalAlpha=.58;ctx.strokeRect(x+2.5,y+2.5,width-7,height-7);
  ctx.globalAlpha=.38;ctx.beginPath();ctx.moveTo(x+width-1.5,y+2);ctx.lineTo(x+width-1.5,y+height-1.5);ctx.lineTo(x+2,y+height-1.5);ctx.stroke();ctx.restore();
}
function triangle(ctx,x,y,direction){ctx.beginPath();ctx.moveTo(x+direction*5,y);ctx.lineTo(x-direction*4,y-6);ctx.lineTo(x-direction*4,y+6);ctx.closePath();ctx.fill();}
function icon(ctx,button,state,color){
  const x=button.x+button.width/2-1,y=button.y+button.height/2-1;ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineWidth=1;
  if(button.id==='stop'){ctx.fillRect(x-5,y-4,10,8);ctx.strokeRect(x-7.5,y-6.5,15,13);}
  else if(button.id==='previous'){triangle(ctx,x-5,y,-1);triangle(ctx,x+4,y,-1);}
  else if(button.id==='next'){triangle(ctx,x-4,y,1);triangle(ctx,x+5,y,1);}
  else if(state.playing){ctx.fillRect(x-6,y-6,4,12);ctx.fillRect(x+2,y-6,4,12);}
  else triangle(ctx,x,y,1);
}
function musicNote(ctx,color){
  ctx.fillStyle=color;ctx.fillRect(12,82,2,10);ctx.fillRect(6,90,7,3);ctx.fillRect(8,89,5,1);
  ctx.fillRect(14,83,3,2);ctx.fillRect(17,85,2,3);ctx.fillRect(15,87,3,1);
}

/** The original 34x23 transport face and icon, shared with other VFD screens. */
export function paintTransportButton(ctx,button,{color='#a1e4d2',active=false,feedback=false,playing=false}={}){
  if(!button||typeof button!=='object')return;
  const key={x:0,y:0,width:34,height:23,...button};
  if(![key.x,key.y,key.width,key.height].every(Number.isFinite)||key.width<8||key.height<8||!['stop','previous','play','next'].includes(key.id))return;
  frame(ctx,key,color,active,feedback);icon(ctx,key,{playing},color);
}

/** Draw only the luminous active screen; no housing or external controls. */
export function paintTransport(ctx,input,{color='#a1e4d2',hoveredId=null,focusedId=null}={}){
  const state=normalizeTransportState(input);ctx.save();ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#00110e';ctx.fillRect(0,0,TRANSPORT_WIDTH,TRANSPORT_HEIGHT);
  centered(ctx,'GU126x64F-K612A4',7,color);
  centered(ctx,'8 line 21 characters',22,color);
  centered(ctx,'SPI & RS232 Serial',37,color);
  centered(ctx,'Interface',52,color);
  musicNote(ctx,color);text(ctx,'CHARACTER + GRAPHIC',22,82,color);
  for(const button of TRANSPORT_BUTTONS){
    const active=button.id==='play'?state.playing:button.id==='stop'?state.stopped:false;
    paintTransportButton(ctx,button,{color,active,feedback:button.id===hoveredId||button.id===focusedId,playing:state.playing});
  }
  const seconds=Math.floor(state.elapsed),time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  centered(ctx,`TRACK ${state.track}`,100,color,1.75,1.35,212);
  centered(ctx,time,113,color,1.75,1.35,212);
  ctx.restore();
}

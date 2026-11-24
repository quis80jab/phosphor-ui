/** Reference menu artwork and interaction state. No DOM or GPU dependencies. */
export const REFERENCE_WIDTH=256;
export const REFERENCE_HEIGHT=128;
const ITEMS=['A-1','B-2','C-3','D-4'];
const DEFAULT_CHANNELS=[true,false,true,true];

export const REFERENCE_BUTTONS=Object.freeze([
  ...[0,1,2,3].map(index=>Object.freeze({id:`f${index+1}`,label:`F${index+1}`,x:1+index*32,y:1,width:29,height:28,kind:'function',channel:index})),
  ...[0,1,2,3].flatMap(channel=>[
    Object.freeze({id:`channel-${channel}-off`,label:'OFF',x:1+channel*32,y:65,width:29,height:29,kind:'channel',channel}),
    Object.freeze({id:`channel-${channel}-on`,label:'ON',x:1+channel*32,y:96,width:29,height:29,kind:'channel',channel})
  ]),
  Object.freeze({id:'up',label:'Up',x:193,y:32,width:29,height:29,kind:'direction'}),
  Object.freeze({id:'left',label:'Left',x:161,y:64,width:29,height:29,kind:'direction'}),
  Object.freeze({id:'set',label:'SET',x:193,y:64,width:29,height:29,kind:'set'}),
  Object.freeze({id:'right',label:'Right',x:225,y:64,width:29,height:29,kind:'direction'}),
  Object.freeze({id:'down',label:'Down',x:193,y:96,width:29,height:29,kind:'direction'}),
  ...ITEMS.map((label,index)=>Object.freeze({id:`item-${label.toLowerCase().replace('-','')}`,label,x:130,y:87+index*10,width:30,height:10,kind:'item',channel:index}))
]);

function coordinate(value,fallback){
  if(typeof value!=='number'&&!(typeof value==='string'&&value.trim()))return fallback;
  const number=Number(value);return Number.isFinite(number)?Math.min(9999,Math.max(0,Math.round(number))):fallback;
}

export function createReferenceState(){
  return {functions:[false,false,false,false],channels:[...DEFAULT_CHANNELS],x:3568,y:1868,selected:'B-2',confirmed:false,committed:{x:3568,y:1868}};
}

export function normalizeReferenceState(input={}){
  const source=input&&typeof input==='object'&&!Array.isArray(input)?input:{};
  const result=createReferenceState();
  for(const name of ['functions','channels'])if(Array.isArray(source[name]))result[name]=result[name].map((fallback,index)=>typeof source[name][index]==='boolean'?source[name][index]:fallback);
  result.x=coordinate(source.x,result.x);result.y=coordinate(source.y,result.y);
  if(ITEMS.includes(source.selected))result.selected=source.selected;
  if(typeof source.confirmed==='boolean')result.confirmed=source.confirmed;
  const committed=source.committed&&typeof source.committed==='object'?source.committed:{};
  result.committed={x:coordinate(committed.x,result.x),y:coordinate(committed.y,result.y)};
  return result;
}

export function activateReference(state,id){
  const next=normalizeReferenceState(state),button=REFERENCE_BUTTONS.find(entry=>entry.id===id);
  if(!button)return next;
  if(button.kind==='set'){
    next.confirmed=!next.confirmed;
    if(next.confirmed)next.committed={x:next.x,y:next.y};
    return next;
  }
  next.confirmed=false;
  if(button.kind==='function')next.functions[button.channel]=!next.functions[button.channel];
  else if(button.kind==='channel')next.channels[button.channel]=id.endsWith('-on');
  else if(button.kind==='item')next.selected=button.label;
  else {
    const delta={up:[0,-1],left:[-1,0],right:[1,0],down:[0,1]}[id];
    next.x=coordinate(next.x+delta[0],next.x);next.y=coordinate(next.y+delta[1],next.y);
  }
  return next;
}

const GLYPHS={
  A:['01110','10001','10001','11111','10001','10001','10001'],
  B:['11110','10001','10001','11110','10001','10001','11110'],
  C:['01111','10000','10000','10000','10000','10000','01111'],
  D:['11110','10001','10001','10001','10001','10001','11110'],
  E:['11111','10000','10000','11110','10000','10000','11111'],
  F:['11111','10000','10000','11110','10000','10000','10000'],
  G:['01110','10001','10000','10111','10001','10001','01110'],
  H:['10001','10001','10001','11111','10001','10001','10001'],
  I:['11111','00100','00100','00100','00100','00100','11111'],
  M:['10001','11011','10101','10101','10001','10001','10001'],
  N:['10001','11001','11001','10101','10011','10011','10001'],
  O:['01110','10001','10001','10001','10001','10001','01110'],
  P:['11110','10001','10001','11110','10000','10000','10000'],
  R:['11110','10001','10001','11110','10100','10010','10001'],
  S:['01111','10000','10000','01110','00001','00001','11110'],
  T:['11111','00100','00100','00100','00100','00100','00100'],
  X:['10001','10001','01010','00100','01010','10001','10001'],
  Y:['10001','10001','01010','00100','00100','00100','00100'],
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
  '-':['00000','00000','00000','11111','00000','00000','00000'],
  '.':['00000','00000','00000','00000','00000','00110','00110'],
  ':':['00000','00100','00100','00000','00100','00100','00000'],
  '>':['10000','01000','00100','00010','00100','01000','10000'],
  '<':['00001','00010','00100','01000','00100','00010','00001'],
  '«':['00101','01010','10100','01010','00101','00000','00000'],
  '»':['10100','01010','00101','01010','10100','00000','00000'],
  m:['00000','00000','11010','10101','10101','10101','10101']
};

function text(ctx,value,x,y,color,{height=1,advance=6}={}){
  ctx.fillStyle=color;x=Math.round(x);y=Math.round(y);
  for(const character of value){
    const glyph=GLYPHS[character]||GLYPHS[character.toUpperCase()];
    if(glyph)for(let row=0;row<7;row++)for(let column=0;column<5;column++)if(glyph[row][column]==='1')ctx.fillRect(x+column,y+row*height,1,height);
    x+=advance;
  }
}
function bevel(ctx,x,y,width,height){
  ctx.beginPath();ctx.moveTo(x+1,y);ctx.lineTo(x+width-2,y);ctx.lineTo(x+width-1,y+1);ctx.lineTo(x+width-1,y+height-2);ctx.lineTo(x+width-2,y+height-1);ctx.lineTo(x+1,y+height-1);ctx.lineTo(x,y+height-2);ctx.lineTo(x,y+1);ctx.closePath();
}
function buttonFace(ctx,button,color,active,feedback){
  const {x,y,width,height}=button;
  ctx.save();
  if(active){ctx.fillStyle=color;ctx.globalAlpha=.91;ctx.fillRect(x+3,y+3,width-6,height-6);}
  ctx.globalAlpha=feedback?1:.8;ctx.strokeStyle=color;ctx.lineWidth=1;
  if(feedback){ctx.shadowColor=color;ctx.shadowBlur=3;}
  bevel(ctx,x+.5,y+.5,width-1,height-1);ctx.stroke();
  ctx.shadowBlur=0;ctx.globalAlpha=.42;ctx.strokeRect(x+2.5,y+2.5,width-5,height-5);
  ctx.restore();
}
function arrow(ctx,id,button,color){
  const x=button.x+button.width/2,y=button.y+button.height/2;
  const vectors={up:[[0,-4],[-6,3],[6,3]],down:[[-6,-3],[6,-3],[0,4]],left:[[-4,0],[3,-6],[3,6]],right:[[4,0],[-3,-6],[-3,6]]};
  ctx.fillStyle=color;ctx.beginPath();vectors[id].forEach(([dx,dy],index)=>index?ctx.lineTo(x+dx,y+dy):ctx.moveTo(x+dx,y+dy));ctx.closePath();ctx.fill();
}

/** The original reference key, reusable without changing its raster geometry. */
export function paintReferenceButton(ctx,button,{color='#a9e9df',active=false,feedback=false}={}){
  if(!button||typeof button!=='object')return;
  const key={x:0,y:0,width:29,height:28,label:'',...button};
  if(![key.x,key.y,key.width,key.height].every(Number.isFinite)||key.width<6||key.height<6)return;
  key.label=typeof key.label==='string'?key.label:'';
  if(key.kind==='direction'&&!['up','down','left','right'].includes(key.id))return;
  buttonFace(ctx,key,color,active,feedback);
  if(key.kind==='direction')arrow(ctx,key.id,key,color);
  else{
    const labelWidth=key.label.length*6-1;
    text(ctx,key.label,key.x+(key.width-labelWidth)/2,key.y+(key.height-14)/2,active?'#06231f':color,{height:2});
  }
}

/** Paint at 256x128 logical pixels; callers may scale the destination context. */
export function paintReference(ctx,input,{color='#a9e9df',hoveredId=null,focusedId=null}={}){
  const state=normalizeReferenceState(input);
  ctx.save();ctx.imageSmoothingEnabled=false;ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#00110e';ctx.fillRect(0,0,REFERENCE_WIDTH,REFERENCE_HEIGHT);
  ctx.strokeStyle=color;ctx.lineWidth=1;ctx.globalAlpha=.62;ctx.strokeRect(.5,.5,255,127);
  ctx.beginPath();ctx.moveTo(128.5,1);ctx.lineTo(128.5,127);ctx.stroke();ctx.globalAlpha=1;
  text(ctx,'« POSITION SETTING »',132,4,color);
  text(ctx,`X:${(state.x/100).toFixed(2)}mm Y:${(state.y/100).toFixed(2)}mm`,132,14,color);
  text(ctx,'OPT',133,24,color);text(ctx,'ENG',133,33,color);text(ctx,'THN',133,42,color);
  ITEMS.forEach((label,index)=>text(ctx,label,7+index*32,43,color));
  for(const button of REFERENCE_BUTTONS){
    const feedback=button.id===hoveredId||button.id===focusedId;
    if(button.kind==='item'){
      const selected=state.selected===button.label;
      if(feedback){ctx.save();ctx.globalAlpha=.13;ctx.fillStyle=color;ctx.fillRect(button.x,button.y,button.width,button.height);ctx.restore();}
      text(ctx,selected?`>${button.label}<`:button.label,selected?130:136,button.y+1,color,{advance:selected?5:6});
      continue;
    }
    const active=button.kind==='function'?state.functions[button.channel]:button.kind==='channel'?state.channels[button.channel]===button.id.endsWith('-on'):button.kind==='set'?state.confirmed:false;
    paintReferenceButton(ctx,button,{color,active,feedback});
  }
  ctx.restore();
}

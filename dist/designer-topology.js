// A demonstration topology vocabulary, painted on the existing display bitmap.
// Selection and role switches are local examples; no network or device actions.
import {text,fill,outline,hline,vline,line,circle,clamp} from './sandbox-ui/src/paint/primitives.js';
import {MINT,DIM,INK,PANEL,AMBER} from './sandbox-ui/src/palette.js';

const NODES=Object.freeze([
  {id:'admin',name:'ADMIN',type:'admin',subtype:'CONFIGURE + CONTROL',model:'Operator role',location:'Control station',sensors:[],modules:['Identity','Configuration','Direct control']},
  {id:'viewer',name:'VIEWER',type:'viewer',subtype:'OBSERVE + REVIEW',model:'Read-only role',location:'Review station',sensors:[],modules:['Identity','Telemetry viewer','Review']},
  {id:'gateway',name:'SITE GATEWAY',type:'device',subtype:'GATEWAY',model:'Network bridge',location:'Site station',sensors:[],modules:['Network bridge','Device registry','Telemetry relay']},
  {id:'drone',name:'SIM-DRONE-01',type:'device',subtype:'DRONE',model:'Simulated aircraft',location:'Demo flight area',sensors:['RGB camera','Thermal camera'],modules:['Flight','Color capture','Thermal capture','Telemetry']},
  {id:'edge',name:'EDGE PROCESSOR',type:'processor',subtype:'EDGE / GPU',model:'GPU compute node',location:'Site station',sensors:['Depth camera'],modules:['Depth processing','Reconstruction','Analysis','Storage']},
  {id:'rgb',name:'RGB CAMERA',type:'sensor',subtype:'COLOR / 30 HZ',model:'RGB camera',location:'Drone payload',sensors:['RGB / 30 HZ'],modules:['Color capture','Frame stream']},
  {id:'thermal',name:'THERMAL CAMERA',type:'sensor',subtype:'THERMAL / 9 HZ',model:'Thermal camera',location:'Drone payload',sensors:['Thermal / 9 HZ'],modules:['Thermal capture','Temperature map']},
  {id:'depth',name:'DEPTH CAMERA',type:'sensor',subtype:'DEPTH / 15 HZ',model:'Depth camera',location:'Edge sensor rig',sensors:['Depth / 15 HZ'],modules:['Depth capture','Point stream']}
].map(node=>Object.freeze({...node,sensors:Object.freeze(node.sensors),modules:Object.freeze(node.modules)})));
let selectedId='drone',accessRole='admin';
const nodeById=id=>NODES.find(node=>node.id===id);
export function getSystemTopologyState(){return{selected:nodeById(selectedId),accessRole};}
const keyColor=type=>type==='access'?AMBER:type==='ethernet'?MINT:DIM;

function geometry(bounds){
  // Slot widths respond to the available canvas; glyphs and strokes never scale.
  const w=Math.max(1,Math.round(bounds.width)),h=Math.max(1,Math.round(bounds.height));
  const nx=Math.round(bounds.x),ny=Math.round(bounds.y),margin=16;
  const nodeWidth=Math.max(88,Math.min(144,Math.floor((w-48)/3)));
  const bottom=Math.max(420,h-126),sensorY=Math.min(510,bottom-70);
  const deviceY=Math.min(350,sensorY-132),gatewayY=Math.min(220,deviceY-120),roleY=Math.min(100,gatewayY-104);
  const left=margin,right=w-margin-nodeWidth,center=Math.floor((w-nodeWidth)/2);
  const slots={admin:[left,roleY],viewer:[right,roleY],gateway:[center,gatewayY],drone:[left+24,deviceY],edge:[right-24,deviceY],rgb:[left,sensorY],thermal:[center,sensorY],depth:[right,sensorY]};
  const nodes=NODES.map(node=>({...node,box:{x:nx+slots[node.id][0],y:ny+slots[node.id][1],width:nodeWidth,height:node.type==='admin'||node.type==='viewer'?56:64}}));
  return{nodes,legendY:ny+Math.max(sensorY+88,h-110),width:w,height:h};
}

function glyph(ctx,type,x,y,size=18,color=MINT,subtype=''){
  const cx=x+Math.floor(size/2),cy=y+Math.floor(size/2);
  if(type==='device'&&subtype==='DRONE'){
    line(ctx,x+3,y+3,x+size-4,y+size-4,color);line(ctx,x+size-4,y+3,x+3,y+size-4,color);
    for(const [dx,dy]of[[0,0],[size-6,0],[0,size-6],[size-6,size-6]])outline(ctx,x+dx,y+dy,6,6,color);
    fill(ctx,cx-2,cy-2,5,5,color);
  }else if(type==='device'){
    outline(ctx,x,y+2,size,size-4,color);hline(ctx,x+3,y+7,size-6,color);
    for(let i=0;i<3;i++)fill(ctx,x+3+i*5,y+size-6,2,2,color);
  }else if(type==='sensor'){
    outline(ctx,x+1,y+3,size-2,size-6,color);circle(ctx,cx,cy,4,color);fill(ctx,cx,cy,1,1,color);hline(ctx,x+4,y+1,5,color);
  }else if(type==='processor'){
    outline(ctx,x+4,y+4,size-8,size-8,color);fill(ctx,cx-2,cy-2,5,5,color);
    for(let i=5;i<size-4;i+=4){vline(ctx,x+i,y,3,color);vline(ctx,x+i,y+size-3,3,color);hline(ctx,x,y+i,3,color);hline(ctx,x+size-3,y+i,3,color);}
  }else if(type==='admin'){
    hline(ctx,x+2,y+1,size-4,color);vline(ctx,x+2,y+1,9,color);vline(ctx,x+size-3,y+1,9,color);
    line(ctx,x+2,y+10,cx,y+size-1,color);line(ctx,cx,y+size-1,x+size-3,y+10,color);
    hline(ctx,cx-3,cy-1,7,color);vline(ctx,cx,cy-4,7,color);
  }else{
    line(ctx,x,cy,cx,y+2,color);line(ctx,cx,y+2,x+size-1,cy,color);line(ctx,x+size-1,cy,cx,y+size-3,color);line(ctx,cx,y+size-3,x,cy,color);circle(ctx,cx,cy,3,color);
  }
}

function stroke(ctx,a,b,type){
  const [x0,y0]=a,[x1,y1]=b,color=keyColor(type);
  if(type==='usb'){line(ctx,x0,y0,x1,y1,color);return;}
  if(type==='ethernet'){
    const dx=y0===y1?0:2,dy=y0===y1?2:0;line(ctx,x0-dx,y0-dy,x1-dx,y1-dy,color);line(ctx,x0+dx,y0+dy,x1+dx,y1+dy,color);return;
  }
  const count=Math.max(Math.abs(x1-x0),Math.abs(y1-y0)),dash=type==='access'?6:1,period=type==='access'?10:4;
  for(let i=0;i<=count;i++)if(i%period<dash)fill(ctx,Math.round(x0+(x1-x0)*i/Math.max(1,count)),Math.round(y0+(y1-y0)*i/Math.max(1,count)),1,1,color);
}
function connector(ctx,points,type,label,labelAt){
  for(let i=1;i<points.length;i++)stroke(ctx,points[i-1],points[i],type);
  const [x,y,room=120]=labelAt,width=Math.min(room,label.length*6+8);
  fill(ctx,Math.round(x-width/2),y-3,width,13,PANEL);text(ctx,label,x,y,keyColor(type),{align:'center',room:width-4});
}
const port=(node,side)=>{const b=node.box;return side==='top'?[b.x+Math.floor(b.width/2),b.y]:side==='left'?[b.x,b.y+Math.floor(b.height/2)]:side==='right'?[b.x+b.width,b.y+Math.floor(b.height/2)]:[b.x+Math.floor(b.width/2),b.y+b.height];};

function paintNode(ctx,node){
  const b=node.box,active=node.id===selectedId,role=node.type==='admin'||node.type==='viewer';
  fill(ctx,b.x,b.y,b.width,b.height,PANEL);outline(ctx,b.x,b.y,b.width,b.height,active?MINT:DIM);
  if(active){outline(ctx,b.x+3,b.y+3,b.width-6,b.height-6,MINT);fill(ctx,b.x+6,b.y+6,2,2,MINT);}
  glyph(ctx,node.type,b.x+9,b.y+12,18,active?MINT:DIM,node.subtype);
  text(ctx,node.type,b.x+34,b.y+8,DIM,{room:b.width-40});
  text(ctx,node.name,b.x+34,b.y+21,MINT,{room:b.width-40});
  hline(ctx,b.x+9,b.y+36,b.width-18,DIM);
  text(ctx,role?node.subtype:node.subtype,b.x+9,b.y+43,role?AMBER:DIM,{room:b.width-18});
  if(role&&node.id===accessRole)fill(ctx,b.x+b.width-10,b.y+7,3,3,AMBER);
}

/** bounds and point use whole DISPLAY PIXELS, unlike designer rectangle storage. */
export function paintSystemTopology(ctx,bounds){
  const b={x:Math.round(bounds.x),y:Math.round(bounds.y),width:Math.round(bounds.width),height:Math.round(bounds.height)};
  if(b.width<80||b.height<80)return;
  ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.width,b.height);ctx.clip();fill(ctx,b.x,b.y,b.width,b.height,PANEL);
  text(ctx,'SYSTEM TOPOLOGY',b.x+16,b.y+12,MINT,{scale:b.width>=400?2:1,room:b.width-32});
  text(ctx,'DEMO / SELECT A NODE TO INSPECT',b.x+16,b.y+38,DIM,{room:b.width-32});
  hline(ctx,b.x+16,b.y+56,b.width-32,DIM);
  text(ctx,`ACCESS: ${accessRole.toUpperCase()} / ${accessRole==='admin'?'CONFIGURE + CONTROL':'READ ONLY'}`,b.x+16,b.y+67,AMBER,{room:b.width-32});
  const g=geometry(b),nodes=Object.fromEntries(g.nodes.map(n=>[n.id,n])),{admin,viewer,gateway,drone,edge,rgb,thermal,depth}=nodes;
  let a=port(admin,'bottom'),z=port(gateway,'top'),mid=Math.round((a[1]+z[1])/2);
  connector(ctx,[a,[a[0],mid],[z[0]-24,mid],[z[0]-24,z[1]]],'access','ADMIN ACCESS',[a[0],mid-14,admin.box.width]);
  a=port(viewer,'bottom');connector(ctx,[a,[a[0],mid],[z[0]+24,mid],[z[0]+24,z[1]]],'access','VIEW ONLY',[a[0],mid-14,viewer.box.width]);
  a=port(gateway,'bottom');z=port(drone,'top');mid=Math.round((a[1]+z[1])/2);
  connector(ctx,[[a[0]-24,a[1]],[a[0]-24,mid],[z[0],mid],z],'wifi','WI-FI',[z[0]+28,mid-14,90]);
  z=port(edge,'top');connector(ctx,[[a[0]+24,a[1]],[a[0]+24,mid],[z[0],mid],z],'ethernet','ETHERNET',[z[0]-28,mid-14,100]);
  a=port(drone,'bottom');z=port(rgb,'top');mid=Math.round((a[1]+z[1])/2);
  connector(ctx,[[a[0]-18,a[1]],[a[0]-18,mid],[z[0],mid],z],'usb','USB / RGB',[z[0],mid+10,100]);
  z=port(thermal,'top');connector(ctx,[[a[0]+18,a[1]],[a[0]+18,mid],[z[0],mid],z],'usb','USB / THERMAL',[z[0],mid+10,118]);
  a=port(edge,'bottom');z=port(depth,'top');connector(ctx,[a,[a[0],mid],[z[0],mid],z],'usb','USB / DEPTH',[z[0],mid+10,108]);
  for(const node of g.nodes)paintNode(ctx,node);
  const legend=g.legendY;hline(ctx,b.x+16,legend,b.width-32,DIM);
  text(ctx,'NODE TYPES',b.x+16,legend+10,DIM,{room:b.width-32});
  const types=['device','sensor','processor','admin','viewer'],slot=Math.floor((b.width-32)/types.length);
  types.forEach((type,i)=>{const x=b.x+16+i*slot;glyph(ctx,type,x,legend+28,14,MINT);text(ctx,type,x+19,legend+32,MINT,{room:slot-22});});
  text(ctx,'CONNECTIONS',b.x+16,legend+55,DIM,{room:b.width-32});
  const links=[['ethernet','ETHERNET'],['wifi','WI-FI'],['usb','USB'],['access','ACCESS']],span=Math.floor((b.width-32)/links.length);
  links.forEach(([type,label],i)=>{const x=b.x+16+i*span;stroke(ctx,[x,legend+79],[x+25,legend+79],type);text(ctx,label,x+32,legend+76,keyColor(type),{room:span-36});});
  ctx.restore();
}

export function activateSystemTopology(point,bounds){
  if(!Number.isFinite(point?.x)||!Number.isFinite(point?.y))return false;
  const node=geometry(bounds).nodes.find(n=>point.x>=n.box.x&&point.y>=n.box.y&&point.x<n.box.x+n.box.width&&point.y<n.box.y+n.box.height);
  if(!node)return false;
  const before=selectedId+'|'+accessRole;selectedId=node.id;if(node.type==='admin'||node.type==='viewer')accessRole=node.type;
  return before!==selectedId+'|'+accessRole;
}

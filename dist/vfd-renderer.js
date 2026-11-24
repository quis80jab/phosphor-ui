import { paintTransport, activateTransport, advanceTransport } from './transport-screen.js?v=transport-2';
import * as THREE from './vendor/three.module.js';
import { REFERENCE_WIDTH, REFERENCE_HEIGHT, paintReference, activateReference } from './reference-screen.js?v=transport-2';
import { normalizeSettings } from './settings.js?v=transport-2';

const W=57.45,H=28.65,COLS=128,ROWS=64,PITCH=.45,DOT=.3;
const HARDWARE=Object.freeze({model:'MN12864K active area',columns:COLS,rows:ROWS,activeWidthMM:W,activeHeightMM:H,pitchMM:PITCH,dotMM:DOT,nativePhosphor:'green'});
const VERTEX=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`;
const LATTICE=`vec2 physicalGrid=(vUv*vec2(57.45,28.65)+vec2(.075))/.45;vec2 cell=floor(physicalGrid);vec2 local=(fract(physicalGrid)-.5)*2.0;float radius=(.3/.45)*(uFill/67.0);float edge=max(abs(local.x),abs(local.y))/radius;float aa=max(fwidth(edge),.018);float aperture=1.0-smoothstep(1.0-aa,1.0+aa,edge);`;
const PHOSPHOR_FRAGMENT=`
precision highp float;varying vec2 vUv;
uniform sampler2D uSignal;uniform float uBrightness,uContrast,uFill,uBurn,uGlass,uRefraction,uDispersion,uLensSize,uReference;uniform int uShape,uPattern;
float lensDistance(vec2 p){vec2 a=abs(p);if(uShape==1)return length(p);if(uShape==2)return a.x+a.y;if(uShape==3)return max(a.y/.8660254,a.x+a.y*.5773503);return max(a.x,a.y);}
vec2 cellAddress(){return floor((vUv*vec2(57.45,28.65)+vec2(.075))/.45);}
vec3 at(vec2 pixel){vec2 sampleUV=uReference>.5?(vUv+(pixel-cellAddress())/vec2(128.0,64.0)):(pixel+.5)/vec2(128.0,64.0);return texture2D(uSignal,clamp(sampleUV,vec2(.001),vec2(.999))).rgb;}
void main(){
${LATTICE}
// Physical phosphor pads are always square. Shape controls the separate optical lens cells.
vec2 lensPosition=physicalGrid/max(uLensSize,1.0);
if(uPattern==1)lensPosition.x+=mod(floor(lensPosition.y),2.0)*.5;
if(uPattern==2)lensPosition=mat2(.707107,-.707107,.707107,.707107)*lensPosition;
vec2 lensLocal=(fract(lensPosition)-.5)*2.0;float lensEdge=clamp(lensDistance(lensLocal),0.0,1.0);
vec2 normal=normalize(lensLocal+vec2(.0001));
if(uShape==3){float angle=atan(normal.y,normal.x);angle=floor((angle-.523599)/1.047198+.5)*1.047198+.523599;normal=vec2(cos(angle),sin(angle));}
float bevel=smoothstep(.4,1.0,lensEdge);vec2 offset=lensLocal*uLensSize*.12*uRefraction*(.2+bevel*1.6);vec2 split=normal*uDispersion*(.18+bevel*.9);
vec3 light=vec3(at(cell+offset+split).r,at(cell+offset).g,at(cell+offset-split).b);
float facing=.5+.5*dot(normal,normalize(vec2(-.65,.76)));light*=1.0+bevel*uRefraction*(facing*.5-.16);
light=pow(max(light,vec3(0.0)),vec3(uContrast));light=min(light*uBrightness*(1.0+uBurn*.13),vec3(1.0));light*=1.0-uGlass*.035;
if(uReference>.5)aperture=mix(.80,1.0,aperture);
float intensity=max(light.r,max(light.g,light.b));gl_FragColor=vec4(light,aperture*smoothstep(0.0,.018,intensity));
#include <colorspace_fragment>
}`;
const ANODE_FRAGMENT=`varying vec2 vUv;uniform float uFill,uOpacity;void main(){${LATTICE}gl_FragColor=vec4(vec3(.008,.012,.014),aperture*uOpacity);\n#include <colorspace_fragment>\n}`;
const GRID_FRAGMENT=`varying vec2 vUv;uniform float uPitch,uWire,uOpacity;void main(){vec2 mm=vUv*vec2(57.45,28.65);vec2 dist=abs(fract(mm/uPitch)-.5)*uPitch;float edge=min(dist.x,dist.y);float aa=max(fwidth(edge),.002);float wire=1.0-smoothstep(uWire*.5-aa,uWire*.5+aa,edge);gl_FragColor=vec4(vec3(.12,.17,.18),wire*uOpacity);\n#include <colorspace_fragment>\n}`;
const GLASS_FRAGMENT=`varying vec2 vUv;uniform float uGlass,uReflection;void main(){float band=pow(max(0.0,1.0-abs(vUv.x+vUv.y*.65-.88)*3.6),8.0);float edge=pow(abs(vUv.y-.5)*2.0,18.0);float alpha=(band*.095+edge*.025)*uGlass*uReflection;gl_FragColor=vec4(vec3(.48,.68,.75),alpha);\n#include <colorspace_fragment>\n}`;
const QUAD_VERTEX=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
const BRIGHT_FRAGMENT=`varying vec2 vUv;uniform sampler2D uTexture;void main(){vec3 c=texture2D(uTexture,vUv).rgb;float b=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(.20,.75,b),1.0);}`;
const BLUR_FRAGMENT=`varying vec2 vUv;uniform sampler2D uTexture;uniform vec2 uStep;void main(){vec3 c=texture2D(uTexture,vUv).rgb*.227027;c+=texture2D(uTexture,vUv+uStep*1.384615).rgb*.316216;c+=texture2D(uTexture,vUv-uStep*1.384615).rgb*.316216;c+=texture2D(uTexture,vUv+uStep*3.230769).rgb*.070270;c+=texture2D(uTexture,vUv-uStep*3.230769).rgb*.070270;gl_FragColor=vec4(c,1.0);}`;
const COMPOSITE_FRAGMENT=`varying vec2 vUv;uniform sampler2D uScene,uBloom;uniform float uStrength;void main(){gl_FragColor=vec4(texture2D(uScene,vUv).rgb+texture2D(uBloom,vUv).rgb*uStrength,1.0);\n#include <colorspace_fragment>\n}`;
const FONT = {
  'A':['010','101','111','101','101'],'B':['110','101','110','101','110'],'C':['011','100','100','100','011'],
  'D':['110','101','101','101','110'],'E':['111','100','110','100','111'],'F':['111','100','110','100','100'],
  'G':['011','100','101','101','011'],'H':['101','101','111','101','101'],'I':['111','010','010','010','111'],
  'K':['101','101','110','101','101'],'L':['100','100','100','100','111'],'M':['101','111','111','101','101'],
  'N':['101','111','111','111','101'],'O':['010','101','101','101','010'],'P':['110','101','110','100','100'],
  'R':['110','101','110','101','101'],'S':['011','100','010','001','110'],'T':['111','010','010','010','010'],
  'U':['101','101','101','101','111'],'V':['101','101','101','101','010'],'W':['101','101','111','111','101'],
  'X':['101','101','010','101','101'],'Y':['101','101','010','010','010'],'Z':['111','001','010','100','111'],
  '0':['111','101','101','101','111'],'1':['010','110','010','010','111'],'2':['110','001','010','100','111'],
  '3':['110','001','010','001','110'],'4':['101','101','111','001','001'],'5':['111','100','110','001','110'],
  '6':['011','100','110','101','010'],'7':['111','001','010','010','010'],'8':['010','101','010','101','010'],
  '9':['010','101','011','001','110'],'-':['000','000','111','000','000'],'.':['000','000','000','000','010']
};

export function initVFD(canvas,buttons=[],initialSettings={}){
  let settings=normalizeSettings(initialSettings),destroyed=false,suspended=false,contextLost=false,frame=0,last=0;
  let width=1,height=1,dpr=1,signalDirty=true,pulseUntil=0,pulseStart=0,bakeRevision=0,baked=false,bakedTexture=null;
  let filamentKey='',currentColor=null,transportTimer=0,baking=false;
  const isArtwork=()=>['reference','transport'].includes(settings.signal);
  const controlFeedback={hoveredId:null,focusedId:null};
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),cursor={x:37,y:27,tx:37,ty:27};
  const states=Array.from(buttons,button=>({color:button.dataset.color||'#46caff',active:false,hovered:false,focused:false,pressed:false}));
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;renderer.info.autoReset=false;renderer.setClearColor(0x0b1218,1);
  canvas.dataset.renderer='three';canvas.dataset.threeRevision=THREE.REVISION;canvas.dataset.rendererStatus='ready';canvas.dataset.vfdMatrix='128x64';
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1218);
  const camera=new THREE.OrthographicCamera(-W,W,H,-H,.1,500);camera.position.z=120;
  const displayRoot=new THREE.Group(),layers=new THREE.Group();displayRoot.add(layers);scene.add(displayRoot);
  const resources=[],keep=value=>(resources.push(value),value);
  const planeGeometry=keep(new THREE.PlaneGeometry(W,H));
  function shader(fragment,uniforms){return keep(new THREE.ShaderMaterial({vertexShader:VERTEX,fragmentShader:fragment,uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));}
  function layer(name,material,index){const mesh=new THREE.Mesh(planeGeometry,material);mesh.name=name;mesh.renderOrder=index;layers.add(mesh);return mesh;}
  const substrateMaterial=keep(new THREE.MeshBasicMaterial({color:0x010405,side:THREE.DoubleSide,toneMapped:false}));
  const substrate=layer('substrate',substrateMaterial,0);
  const anodeUniforms={uFill:{value:67},uOpacity:{value:.18}};
  const anode=layer('anode',shader(ANODE_FRAGMENT,anodeUniforms),1);
  // Keep the GPU texture allocation stable when switching signal modes.
  // The physical 128 × 64 demo draws each logical pixel into a 2 × 2 block.
  const signal=document.createElement('canvas');signal.width=REFERENCE_WIDTH;signal.height=REFERENCE_HEIGHT;
  const g=signal.getContext('2d',{alpha:false});g.imageSmoothingEnabled=false;
  const signalTexture=keep(new THREE.CanvasTexture(signal));signalTexture.minFilter=THREE.NearestFilter;signalTexture.magFilter=THREE.NearestFilter;signalTexture.generateMipmaps=false;signalTexture.colorSpace=THREE.SRGBColorSpace;
  const uniforms={uSignal:{value:signalTexture},uBrightness:{value:1},uContrast:{value:1},uFill:{value:67},uBurn:{value:1},uGlass:{value:.55},uRefraction:{value:0},uDispersion:{value:0},uLensSize:{value:6},uShape:{value:0},uPattern:{value:0},uReference:{value:0}};
  const phosphor=layer('phosphor',shader(PHOSPHOR_FRAGMENT,uniforms),2);
  const gridUniforms={uPitch:{value:1.5},uWire:{value:.025},uOpacity:{value:.12}};
  const grid=layer('grid',shader(GRID_FRAGMENT,gridUniforms),3);
  const filaments=new THREE.Group();filaments.name='filaments';filaments.renderOrder=4;layers.add(filaments);
  const filamentMaterial=keep(new THREE.MeshBasicMaterial({color:0x8b826a,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}));
  const glassUniforms={uGlass:{value:.55},uReflection:{value:.25}};
  const glass=layer('glass',shader(GLASS_FRAGMENT,glassUniforms),5);
  const bakedMaterial=keep(new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,toneMapped:false}));
  const bakedPlane=new THREE.Mesh(planeGeometry,bakedMaterial);bakedPlane.visible=false;displayRoot.add(bakedPlane);
  const flatPositions={substrate:-.025,anode:0,phosphor:.025,grid:.075,filaments:.125,glass:.18};
  // Inspection guides live outside the optical stack, so they cannot enter a bake.
  const guides=new THREE.Group();displayRoot.add(guides);
  const outlineGeometry=keep(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-W/2,-H/2,0),new THREE.Vector3(W/2,-H/2,0),
    new THREE.Vector3(W/2,H/2,0),new THREE.Vector3(-W/2,H/2,0)
  ]));
  const guideEntries=[[anode,0x648e9b],[phosphor,0x59ccff],[grid,0xe1b974],[filaments,0xd893a8],[glass,0xa0b9ed]].map(([optical,color])=>{
    const material=keep(new THREE.LineBasicMaterial({color,transparent:true,opacity:.54,depthTest:false,depthWrite:false}));
    const outline=new THREE.LineLoop(outlineGeometry,material);outline.renderOrder=12;guides.add(outline);return {optical,outline};
  });

  const quadScene=new THREE.Scene(),quadCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1),quad=new THREE.Mesh(keep(new THREE.PlaneGeometry(2,2)));quadScene.add(quad);
  const brightMaterial=keep(new THREE.ShaderMaterial({vertexShader:QUAD_VERTEX,fragmentShader:BRIGHT_FRAGMENT,uniforms:{uTexture:{value:null}},depthTest:false,depthWrite:false}));
  const blurMaterial=keep(new THREE.ShaderMaterial({vertexShader:QUAD_VERTEX,fragmentShader:BLUR_FRAGMENT,uniforms:{uTexture:{value:null},uStep:{value:new THREE.Vector2()}},depthTest:false,depthWrite:false}));
  const compositeMaterial=keep(new THREE.ShaderMaterial({vertexShader:QUAD_VERTEX,fragmentShader:COMPOSITE_FRAGMENT,uniforms:{uScene:{value:null},uBloom:{value:null},uStrength:{value:0}},depthTest:false,depthWrite:false}));
  const sceneType=renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType;
  const options={minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:sceneType,depthBuffer:true};
  const sceneTarget=keep(new THREE.WebGLRenderTarget(1,1,options)),bloomA=keep(new THREE.WebGLRenderTarget(1,1,{...options,depthBuffer:false})),bloomB=keep(new THREE.WebGLRenderTarget(1,1,{...options,depthBuffer:false}));
  const raycaster=new THREE.Raycaster(),ndc=new THREE.Vector2(),intersection=new THREE.Vector3(),rayPlane=new THREE.Plane(),normal=new THREE.Vector3(),worldPoint=new THREE.Vector3();

  function pixelText(text,x,y,color){g.fillStyle=color;for(const letter of text.toUpperCase()){const glyph=FONT[letter];if(glyph)for(let row=0;row<5;row++)for(let col=0;col<3;col++)if(glyph[row][col]==='1')g.fillRect(x+col,y+row,1,1);x+=4;}}
  function phosphorColor(){return {mint:'#a4ded4',blue:'#76d9ff',native:'#61ffac',amber:'#ffbc54',white:'#edfaff'}[settings.phosphor]||'#76d9ff';}
  function paintSignal(now){
    const reference=isArtwork();
    const signalScale=reference?1:REFERENCE_WIDTH/COLS;
    g.setTransform(signalScale,0,0,signalScale,0,0);
    if(reference){
      const paint=settings.signal==='transport'?paintTransport:paintReference;
      paint(g,settings.signal==='transport'?settings.transport:settings.menu,{color:phosphorColor(),...controlFeedback});
      signalTexture.needsUpdate=true;signalDirty=false;return;
    }
    const color=currentColor||phosphorColor();g.fillStyle='#000';g.fillRect(0,0,COLS,ROWS);
    pixelText('MN12864K',5,4,color);pixelText('128X64',99,4,'#275a69');g.fillStyle='#12303a';g.fillRect(5,12,118,1);
    if(settings.signal==='test'){
      const colors=[color,'#fff0c9','#7effbd','#50caff','#a389ff','#ff799b'];
      for(let band=0;band<6;band++){g.fillStyle=colors[band];g.fillRect(5+band*20,18,17,17);for(let j=0;j<5;j++){g.globalAlpha=(j+1)/5;g.fillRect(5+band*20,38+j*2,17,1);}g.globalAlpha=1;}
      pixelText('PHOSPHOR TEST',5,54,color);
    }else{
      const x=Math.round(cursor.x),y=Math.round(cursor.y),scale=settings.cursorSize/100;
      g.save();g.translate(x,y);g.scale(scale,scale);g.fillStyle=color;g.beginPath();g.moveTo(0,0);g.lineTo(0,25);g.lineTo(7,18);g.lineTo(13,29);g.lineTo(18,26);g.lineTo(12,15);g.lineTo(23,15);g.closePath();g.fill();g.restore();
      if(settings.burn>0){g.save();g.globalCompositeOperation='lighter';const radius=6*Math.sqrt(settings.burn/100),hot=g.createRadialGradient(x+.5,y+.5,0,x+.5,y+.5,radius);hot.addColorStop(0,'#ffffff');hot.addColorStop(.18,'#d7f6ff');hot.addColorStop(.5,'#168bff70');hot.addColorStop(1,'#0873ff00');g.fillStyle=hot;g.fillRect(x-radius,y-radius,radius*2,radius*2);g.fillStyle='#fff';g.fillRect(x,y,Math.max(1,Math.round(settings.burn/80)),Math.max(1,Math.round(settings.burn/80)));g.restore();}
      pixelText('PHOSPHOR',75,23,color);pixelText('LIVE',75,32,'#356879');
      for(let i=0;i<3;i++){g.fillStyle=['#265367','#2e7890',color][i];g.fillRect(75,40+i*3,35-i*8,1);}
      const colors=['#46caff','#498dff','#a68aff','#83f5bd','#ffc46b','#ff7caa'];
      for(let i=0;i<6;i++){const state=states[i]||{};g.strokeStyle=colors[i];g.globalAlpha=state.active||state.hovered||state.focused?1:.35;g.strokeRect(5+i*20+.5,53.5,17,7);g.fillStyle=colors[i];g.globalAlpha=state.active?.8:.22;g.fillRect(7+i*20,55,14,4);g.globalAlpha=1;}
    }
    if(!reduced.matches&&now<pulseUntil){const progress=(now-pulseStart)/650;g.strokeStyle=color;g.globalAlpha=(1-progress)*.85;g.beginPath();g.arc(cursor.x,cursor.y,2+progress*30,0,Math.PI*2);g.stroke();g.globalAlpha=1;}
    signalTexture.needsUpdate=true;signalDirty=false;
  }
  function rebuildFilaments(){
    const key=`${settings.filamentCount}:${settings.filamentWidth}`;if(key===filamentKey)return;filamentKey=key;
    for(const child of [...filaments.children]){child.geometry.dispose();filaments.remove(child);}
    for(let i=0;i<settings.filamentCount;i++){const line=new THREE.Mesh(new THREE.PlaneGeometry(W,settings.filamentWidth),filamentMaterial);line.position.y=-H/2+(i+.5)*H/settings.filamentCount;line.renderOrder=4;filaments.add(line);}
  }
  function layout(){
    const exploded=settings.view==='stack'&&!baked;
    let index=0;for(const item of layers.children){item.position.z=exploded?(item.name==='substrate'?-.1:index++*settings.layerGap):flatPositions[item.name];}
    guides.visible=exploded;for(const {optical,outline} of guideEntries){outline.visible=optical.visible;outline.position.z=optical.position.z+.006;}
    layers.visible=!baked;bakedPlane.visible=baked;
    displayRoot.rotation.set(THREE.MathUtils.degToRad(exploded?-42+settings.tilt*.5:settings.tilt),THREE.MathUtils.degToRad(exploded?-18:0),0);
    displayRoot.position.z=exploded?-settings.layerGap*2:0;displayRoot.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(baked?bakedPlane:layers),extent=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
    const aspect=width/height,pad=1.11,halfHeight=Math.max(extent.y,extent.x/aspect)*pad/2*100/settings.zoom;
    camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;camera.top=halfHeight;camera.bottom=-halfHeight;
    camera.position.set(center.x,center.y,120);camera.lookAt(center.x,center.y,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    canvas.dataset.vfdView=exploded?'stack':'composite';canvas.dataset.vfdMode=baked?'baked':'simulation';
    canvas.dispatchEvent(new CustomEvent('vfd-layout'));
  }
  function getControlProjection(){
    const visible=isArtwork()&&settings.view==='composite'&&settings.phosphorEnabled&&!baked&&!contextLost;
    if(!visible)return {visible:false,matrix:[1,0,0,1,0,0]};
    phosphor.updateWorldMatrix(true,false);
    const project=(x,y)=>{const p=new THREE.Vector3(x,y,0);phosphor.localToWorld(p);p.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};};
    const tl=project(-W/2,H/2),tr=project(W/2,H/2),bl=project(-W/2,-H/2);
    return {visible:true,matrix:[(tr.x-tl.x)/REFERENCE_WIDTH,(tr.y-tl.y)/REFERENCE_WIDTH,(bl.x-tl.x)/REFERENCE_HEIGHT,(bl.y-tl.y)/REFERENCE_HEIGHT,tl.x,tl.y]};
  }
  function emitMenu(){canvas.dispatchEvent(new CustomEvent('vfd-menu-state',{detail:{menu:settings.menu,transport:settings.transport,signal:settings.signal}}));}
  function scheduleTransport(){
    if(destroyed||suspended||contextLost||document.hidden||baked||baking||settings.signal!=='transport'||!settings.transport.playing){clearTimeout(transportTimer);transportTimer=0;return;}
    if(transportTimer)return;
    transportTimer=setTimeout(()=>{
      transportTimer=0;
      if(bakedTexture)invalidateBake();else bakeRevision++;
      settings={...settings,transport:advanceTransport(settings.transport,1)};
      signalDirty=true;emitMenu();requestDraw();scheduleTransport();
    },1000);
  }
  function activateControl(id){
    if(!isArtwork()||baked||!settings.phosphorEnabled)return;
    const key=settings.signal==='transport'?'transport':'menu';
    const next=key==='transport'?activateTransport(settings.transport,id):activateReference(settings.menu,id);
    if(JSON.stringify(next)===JSON.stringify(settings[key]))return;
    invalidateBake();settings=normalizeSettings({...settings,[key]:next});signalDirty=true;
    layout();emitMenu();requestDraw();scheduleTransport();
  }
  function applySettings(){
    uniforms.uReference.value=isArtwork()?1:0;
    canvas.dataset.displayScreen=settings.signal;
    uniforms.uBrightness.value=settings.brightness/100;uniforms.uContrast.value=settings.contrast/100;uniforms.uFill.value=settings.fill;uniforms.uBurn.value=settings.burn/100;
    uniforms.uGlass.value=settings.glassEnabled?settings.glass/100:0;uniforms.uRefraction.value=settings.glassEnabled?settings.refraction/100:0;uniforms.uDispersion.value=settings.glassEnabled?settings.dispersion/100:0;uniforms.uLensSize.value=settings.size;
    uniforms.uShape.value=['square','circle','diamond','hexagon'].indexOf(settings.shape);uniforms.uPattern.value=['grid','staggered','diagonal'].indexOf(settings.pattern);
    anodeUniforms.uFill.value=settings.fill;anodeUniforms.uOpacity.value=settings.anodeOpacity/100;
    gridUniforms.uPitch.value=settings.gridPitch;gridUniforms.uWire.value=settings.gridWire;gridUniforms.uOpacity.value=settings.gridOpacity/100;
    glassUniforms.uGlass.value=settings.glass/100;glassUniforms.uReflection.value=settings.reflection/100;filamentMaterial.opacity=settings.filamentOpacity/100;
    anode.visible=settings.anodeEnabled;phosphor.visible=settings.phosphorEnabled;grid.visible=settings.gridEnabled;filaments.visible=settings.filamentEnabled;glass.visible=settings.glassEnabled;
    rebuildFilaments();layout();signalDirty=true;
    canvas.dataset.vfdLayers=['anode','phosphor','grid','filament','glass','glow'].filter(name=>settings[`${name}Enabled`]).join(',');
  }
  function resize(){if(destroyed)return;const rect=canvas.getBoundingClientRect();width=Math.max(1,rect.width);height=Math.max(1,rect.height);dpr=Math.min(devicePixelRatio||1,2);renderer.setPixelRatio(dpr);renderer.setSize(width,height,false);sceneTarget.setSize(Math.round(width*dpr),Math.round(height*dpr));bloomA.setSize(Math.max(1,Math.round(width*dpr/2)),Math.max(1,Math.round(height*dpr/2)));bloomB.setSize(bloomA.width,bloomA.height);layout();requestDraw();}
  function processBloom(source,a,b){
    quad.material=brightMaterial;brightMaterial.uniforms.uTexture.value=source.texture;renderer.setRenderTarget(a);renderer.render(quadScene,quadCamera);
    quad.material=blurMaterial;blurMaterial.uniforms.uTexture.value=a.texture;blurMaterial.uniforms.uStep.value.set((.7+settings.bloom/80)/a.width,0);renderer.setRenderTarget(b);renderer.render(quadScene,quadCamera);
    blurMaterial.uniforms.uTexture.value=b.texture;blurMaterial.uniforms.uStep.value.set(0,(.7+settings.bloom/80)/a.height);renderer.setRenderTarget(a);renderer.render(quadScene,quadCamera);
  }
  function glowStrength(){return settings.glowEnabled&&settings.phosphorEnabled?settings.bloom/100*1.4:0;}
  function renderScene(){renderer.info.reset();renderer.setRenderTarget(sceneTarget);renderer.render(scene,camera);const strength=baked?0:glowStrength();if(strength>0)processBloom(sceneTarget,bloomA,bloomB);quad.material=compositeMaterial;compositeMaterial.uniforms.uScene.value=sceneTarget.texture;compositeMaterial.uniforms.uBloom.value=bloomA.texture;compositeMaterial.uniforms.uStrength.value=strength;renderer.setRenderTarget(null);renderer.render(quadScene,quadCamera);}
  function draw(now){frame=0;if(destroyed||suspended||document.hidden||contextLost)return;const dt=Math.min(50,last?now-last:16);last=now;const ease=reduced.matches?1:1-Math.exp(-dt/35),beforeX=cursor.x,beforeY=cursor.y;cursor.x+=(cursor.tx-cursor.x)*ease;cursor.y+=(cursor.ty-cursor.y)*ease;const moving=Math.abs(cursor.x-cursor.tx)+Math.abs(cursor.y-cursor.ty)>.02;const pulseFinished=pulseUntil>0&&now>=pulseUntil;if(pulseFinished)pulseUntil=0;if(!baked&&(signalDirty||beforeX!==cursor.x||beforeY!==cursor.y||now<pulseUntil||pulseFinished))paintSignal(now);renderScene();if(!baked&&(moving||(!reduced.matches&&now<pulseUntil)))requestDraw();}
  function requestDraw(){if(!frame&&!destroyed&&!suspended&&!document.hidden&&!contextLost)frame=requestAnimationFrame(draw);}
  function emitBake(reason){canvas.dispatchEvent(new CustomEvent('vfd-bake-state',{detail:{available:Boolean(bakedTexture),baked,reason}}));}
  function invalidateBake(){bakeRevision++;if(bakedTexture){bakedTexture.dispose();bakedTexture=null;}baked=false;bakedMaterial.map=null;bakedMaterial.needsUpdate=true;emitBake('invalidated');}
  function move(x,y){if(destroyed||baked||isArtwork())return;const rect=canvas.getBoundingClientRect();ndc.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);raycaster.setFromCamera(ndc,camera);phosphor.updateWorldMatrix(true,false);phosphor.getWorldPosition(worldPoint);normal.set(0,0,1).transformDirection(phosphor.matrixWorld);rayPlane.setFromNormalAndCoplanarPoint(normal,worldPoint);if(raycaster.ray.intersectPlane(rayPlane,intersection)){const local=phosphor.worldToLocal(intersection.clone());cursor.tx=THREE.MathUtils.clamp((local.x/W+.5)*COLS,1,125);cursor.ty=THREE.MathUtils.clamp((.5-local.y/H)*ROWS,14,50);signalDirty=true;requestDraw();}}
  async function createBake(){
    if(destroyed||contextLost)throw new Error('The display renderer is unavailable.');const revision=bakeRevision;if(isArtwork()){controlFeedback.hoveredId=null;controlFeedback.focusedId=null;signalDirty=true;}if(signalDirty&&!baked)paintSignal(performance.now());
    const target=new THREE.WebGLRenderTarget(1024,512,{...options,depthBuffer:true}),a=new THREE.WebGLRenderTarget(512,256,{...options,depthBuffer:false}),b=new THREE.WebGLRenderTarget(512,256,{...options,depthBuffer:false}),encoded=new THREE.WebGLRenderTarget(1024,512,{minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,type:THREE.UnsignedByteType,depthBuffer:false});
    const bakeScene=new THREE.Scene();bakeScene.background=new THREE.Color(0x010405);const flat=layers.clone(true);flat.visible=true;flat.position.set(0,0,0);flat.rotation.set(0,0,0);for(const child of flat.children)child.position.z=flatPositions[child.name];bakeScene.add(flat);
    const bakeCamera=new THREE.OrthographicCamera(-W/2,W/2,H/2,-H/2,.1,100);bakeCamera.position.z=10;
    const encodeFragment=COMPOSITE_FRAGMENT.replace('#include <colorspace_fragment>','gl_FragColor.rgb=clamp(gl_FragColor.rgb,0.0,1.0);gl_FragColor.rgb=mix(gl_FragColor.rgb*12.92,1.055*pow(gl_FragColor.rgb,vec3(1.0/2.4))-.055,step(vec3(.0031308),gl_FragColor.rgb));');
    const encodeMaterial=new THREE.ShaderMaterial({vertexShader:QUAD_VERTEX,fragmentShader:encodeFragment,uniforms:{uScene:{value:target.texture},uBloom:{value:a.texture},uStrength:{value:glowStrength()}},depthTest:false,depthWrite:false});
    const pixels=new Uint8Array(1024*512*4);
    try{renderer.setRenderTarget(target);renderer.render(bakeScene,bakeCamera);processBloom(target,a,b);quad.material=encodeMaterial;renderer.setRenderTarget(encoded);renderer.render(quadScene,quadCamera);renderer.readRenderTargetPixels(encoded,0,0,1024,512,pixels);}finally{renderer.setRenderTarget(null);target.dispose();a.dispose();b.dispose();encoded.dispose();encodeMaterial.dispose();}
    const output=document.createElement('canvas');output.width=1024;output.height=512;const context=output.getContext('2d'),image=context.createImageData(1024,512);for(let row=0;row<512;row++)image.data.set(pixels.subarray((511-row)*4096,(512-row)*4096),row*4096);context.putImageData(image,0,0);
    const blob=await new Promise((resolve,reject)=>output.toBlob(value=>value?resolve(value):reject(new Error('Could not encode baked color.')),'image/png'));
    if(revision!==bakeRevision||destroyed)throw new Error('Display settings changed while baking. Please bake again.');
    if(bakedTexture)bakedTexture.dispose();bakedTexture=new THREE.CanvasTexture(output);bakedTexture.colorSpace=THREE.SRGBColorSpace;bakedTexture.minFilter=THREE.LinearFilter;bakedTexture.magFilter=THREE.LinearFilter;bakedTexture.generateMipmaps=false;bakedMaterial.map=bakedTexture;bakedMaterial.needsUpdate=true;emitBake('created');requestDraw();return {blob,width:1024,height:512};
  }
  async function bakeColor(){baking=true;scheduleTransport();try{return await createBake();}finally{baking=false;scheduleTransport();}}
  function visibility(){if(document.hidden){cancelAnimationFrame(frame);frame=0;last=0;}else requestDraw();scheduleTransport();}
  function lost(event){event.preventDefault();contextLost=true;cancelAnimationFrame(frame);frame=0;canvas.dataset.rendererStatus='context-lost';canvas.dispatchEvent(new CustomEvent('vfd-context-state',{detail:{available:false}}));scheduleTransport();}
  function restored(){contextLost=false;signalTexture.needsUpdate=true;if(bakedTexture)bakedTexture.needsUpdate=true;canvas.dataset.rendererStatus='ready';canvas.dispatchEvent(new CustomEvent('vfd-context-state',{detail:{available:true}}));requestDraw();scheduleTransport();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',requestDraw);canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);applySettings();resize();scheduleTransport();
  return {
    move,pulse(){if(baked||isArtwork())return;pulseStart=performance.now();pulseUntil=reduced.matches?pulseStart:pulseStart+650;signalDirty=true;requestDraw();},
    configure(patch={}){const next=normalizeSettings({...settings,...patch});const changed=Object.keys(next).filter(key=>['menu','transport'].includes(key)?JSON.stringify(next[key])!==JSON.stringify(settings[key]):next[key]!==settings[key]);if(changed.some(key=>!['view','tilt','zoom','layerGap'].includes(key)))invalidateBake();settings=next;applySettings();emitMenu();requestDraw();scheduleTransport();return {...settings};},getSettings(){return {...settings};},refreshLayout:resize,
    setButton(index,state={}){if(!states[index])return;const colorChanged='active' in state&&Boolean(state.active)!==states[index].active;if(colorChanged){invalidateBake();layout();}Object.assign(states[index],state);if(state.active===true)currentColor=states[index].color;else if(state.active===false){const activeState=states.find(s=>s.active);currentColor=activeState?.color||null;}if(!baked)signalDirty=true;requestDraw();},
    getControlProjection,activateControl,setControlFeedback(patch={}){Object.assign(controlFeedback,patch);if(isArtwork()&&!baked){signalDirty=true;requestDraw();}},
    bakeColor,setBaked(value){if(value&&!bakedTexture)return false;baked=Boolean(value);if(!baked)signalDirty=true;layout();emitBake('mode');requestDraw();scheduleTransport();return baked;},hasBake(){return Boolean(bakedTexture);},
    suspend(){suspended=true;cancelAnimationFrame(frame);frame=0;last=0;scheduleTransport();},resume(){suspended=false;requestDraw();scheduleTransport();},
    getDiagnostics(){return {engine:'Three.js',revision:THREE.REVISION,hardware:{...HARDWARE},matrixPixels:COLS*ROWS,phosphorShape:'square',actualDotMM:DOT*settings.fill/67,dpr,viewport:{width,height},projection:'orthographic',view:settings.view,mode:baked?'baked':'simulation',hasBake:Boolean(bakedTexture),bakeSize:bakedTexture?[1024,512]:null,contextLost,drawCalls:renderer.info.render.calls,layerCounts:{anodePads:settings.anodeEnabled?COLS*ROWS:0,phosphorPads:settings.phosphorEnabled?COLS*ROWS:0,gridWires:settings.gridEnabled?Math.floor(W/settings.gridPitch)+Math.floor(H/settings.gridPitch):0,filaments:settings.filamentEnabled?settings.filamentCount:0,glass:settings.glassEnabled?1:0},enabledLayers:canvas.dataset.vfdLayers.split(','),layerSpacingMM:settings.layerGap,construction:'Exact active matrix dimensions; grid, filament, and glass parameters are tunable optical reconstruction.'};},
    destroy(){destroyed=true;clearTimeout(transportTimer);cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',requestDraw);canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);if(bakedTexture)bakedTexture.dispose();for(const child of filaments.children)child.geometry.dispose();for(const resource of resources)resource.dispose?.();renderer.dispose();}
  };
}

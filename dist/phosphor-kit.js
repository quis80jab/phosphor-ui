import {paintGridControl} from './viewer-grid-paint.js?v=hologram-12';
import {createViewerGridRenderer} from './viewer-grid-renderer.js?v=vfd-splats-1';
import {PIXEL_PITCH,UI_CELL,UI_PIXELS,pixelBounds} from './viewer-grid.js?v=pane-140';
export {paintGridControl,createViewerGridRenderer,PIXEL_PITCH,UI_CELL,UI_PIXELS};
export {pixelText,glyphRect,glyphMark} from './vfd-glyphs.js?v=grid-1';
export {paintWidget,BENCH_CATALOG,BENCH_WIDTH,BENCH_HEIGHT} from './bench-widgets.js';

export const KIT_VERSION=1;
export const KIT_CONTROL_TYPES=Object.freeze(['button','toggle','slider','search','label']);
const PATTERNS=['dots','hashes','blocks','lines'];
const cleanText=value=>String(value??'').slice(0,4000);
const number=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const integer=(value,fallback,min=0,max=512)=>clamp(Math.round(number(value,fallback)),min,max);
const DEFAULT_OPTICS=Object.freeze({brightness:110,glow:40,contrast:110,grid:50,refraction:0});
const OPTIC_RANGES={brightness:[20,200],glow:[0,150],contrast:[50,220],grid:[0,100],refraction:[0,100]};
let sequence=0;

/** The saved look contains only finite values actually accepted by the compositor. */
export function normalizeKitOptics(input={},base=DEFAULT_OPTICS){
  return Object.fromEntries(Object.entries(OPTIC_RANGES).map(([key,[min,max]])=>[key,clamp(number(input?.[key],number(base?.[key],DEFAULT_OPTICS[key])),min,max)]));
}
function sliderRange(input){
  const min=input.min===undefined?0:Number(input.min),max=input.max===undefined?100:Number(input.max),step=input.step===undefined?1:Number(input.step);
  const span=max-min,count=span/step;
  if(![min,max,step,span,count].every(Number.isFinite)||Math.abs(min)>1e12||Math.abs(max)>1e12||max<=min||step<1e-12||step>2e12||count>Number.MAX_SAFE_INTEGER||min+step===min||max-step===max){
    throw new RangeError('Slider range must be finite, ordered, within +/-1e12, and have a representable positive step (1e-12 to 2e12).');
  }
  const decimals=value=>{const[mantissa,exponent='0']=String(value).toLowerCase().split('e');return Math.max(0,(mantissa.split('.')[1]||'').length-Number(exponent));};
  const steps=Math.floor(count+Math.min(1e-7,Number.EPSILON*Math.max(1,count)*2)),index=clamp(Math.round((clamp(number(input.value,min),min,max)-min)/step),0,steps);
  // Round decimal step noise, never significant digits of the range origin.
  const snapped=index===0?min:Number((min+index*step).toFixed(Math.min(100,Math.max(decimals(min),decimals(step)))));
  return{min,max,step,value:clamp(snapped,min,max)};
}

/** Intersect the portalled framebuffer with visible ancestor scroll/clip regions. */
export function measureKitClip(element,win){
  const rect=element.getBoundingClientRect();let left=Math.max(0,rect.left),top=Math.max(0,rect.top),right=Math.min(win.innerWidth,rect.right),bottom=Math.min(win.innerHeight,rect.bottom),opacity=1;
  if(element.closest?.('[hidden]'))return null;
  for(let node=element;node;node=node.parentElement){
    const style=win.getComputedStyle(node);
    if(style.display==='none'||style.visibility==='hidden'||style.visibility==='collapse')return null;
    opacity*=clamp(number(style.opacity,1),0,1);if(opacity===0)return null;
    if(node===element)continue;
    const box=node.getBoundingClientRect(),x=style.overflowX||style.overflow,y=style.overflowY||style.overflow;
    const x0=box.left+(node.clientLeft||0),y0=box.top+(node.clientTop||0);
    const x1=x0+(Number.isFinite(node.clientWidth)?node.clientWidth:box.width),y1=y0+(Number.isFinite(node.clientHeight)?node.clientHeight:box.height);
    if(['auto','scroll','hidden','clip'].includes(x)){left=Math.max(left,x0);right=Math.min(right,x1);}
    if(['auto','scroll','hidden','clip'].includes(y)){top=Math.max(top,y0);bottom=Math.min(bottom,y1);}
  }
  return right>left&&bottom>top?{left,top,right,bottom,opacity}:null;
}

/** All layout numbers are UI cells; one UI cell contains 8 x 8 display pixels. */
export function normalizeKitControl(input={}){
  if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('A control must be an object.');
  if(typeof input.id!=='string'||!/^[a-zA-Z][\w-]{0,79}$/.test(input.id))throw new TypeError('Each control requires a stable alphanumeric id.');
  if(!KIT_CONTROL_TYPES.includes(input.type))throw new TypeError(`Unsupported kit control: ${input.type}`);
  const range=input.type==='slider'?sliderRange(input):{min:0,max:100,step:1};
  const{min,max,step}=range;
  let value=input.value;
  if(input.type==='slider')value=range.value;
  else if(input.type==='toggle')value=value===true;
  else if(input.type==='button')value=integer(value,0,0,Number.MAX_SAFE_INTEGER);
  else value=cleanText(value);
  const layout=input.layout||{};
  return{id:input.id,type:input.type,label:cleanText(input.label||input.id),value,min,max,step,placeholder:cleanText(input.placeholder),disabled:input.disabled===true,
    layout:{column:integer(layout.column,0),row:integer(layout.row,0),columns:integer(layout.columns,16,1),rows:integer(layout.rows,3,1)}};
}

/** Preserve supplied desktop placement; narrow containers reflow without scaling glyphs. */
export function resolveKitLayout(controls,availableColumns,designColumns=48){
  const columns=integer(availableColumns,designColumns,1),design=integer(designColumns,48,1);let nextRow=0;
  const items=controls.map(control=>{
    const requested=control.layout,stack=columns<design;
    const result={id:control.id,column:stack?0:Math.min(requested.column,columns-1),row:stack?nextRow:requested.row,
      columns:Math.min(requested.columns,stack?columns:columns-Math.min(requested.column,columns-1)),rows:requested.rows};
    if(stack)nextRow+=result.rows+1;
    return result;
  });
  return{columns,rows:Math.max(1,...items.map(item=>item.row+item.rows)),items};
}

/**
 * Mount destination-sized VFD controls in an ordinary DOM container.
 * onChange({id,type,value,values,event}) runs for user actions only. update() is silent.
 * Public methods: render(), update(id, patch), getValues(), getState(), setOptics(patch),
 * setPattern(mark), getControlElement(id), destroy(). Keep one kit per page when possible.
 * The existing shared compositor is viewport-sized and clipped to this container;
 * it never resizes glyph assets. Raw bench painters retain their native 320 x 200 art.
 * No state is written to storage. Persist getState() in the host program explicitly.
 */
export function mountPhosphorKit({container,controls=[],columns=48,optics={},pattern='dots',onChange=()=>{},rendererFactory=createViewerGridRenderer}={}){
  if(!container?.ownerDocument)throw new TypeError('A DOM container is required.');
  const configs=controls.map(normalizeKitControl);
  if(new Set(configs.map(control=>control.id)).size!==configs.length)throw new Error('Control ids must be unique.');
  const doc=container.ownerDocument,win=doc.defaultView||window,id=`phosphor-kit-${++sequence}`,listeners=[],records=new Map();
  let destroyed=false,frame=0,renderer=null,held=null,ready=false,currentPattern=PATTERNS.includes(pattern)?pattern:'dots';
  let currentOptics=normalizeKitOptics(optics);
  const element=doc.createElement('section');element.className='phosphor-kit';element.id=id;element.setAttribute('aria-label','Phosphor controls');
  const canvas=doc.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.className='phosphor-kit-output';
  Object.assign(canvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'20'});
  const source=doc.createElement('canvas'),ctx=source.getContext('2d');if(!ctx)throw new Error('A 2D canvas is required.');
  const style=doc.createElement('style'),fontURL=new URL('./fonts/phosphor-pixel.woff',import.meta.url).href;
  style.textContent=`@font-face{font-family:PhosphorKitPixel;src:url('${fontURL}') format('woff')}#${id}{position:relative;background:#061713;min-width:0;box-sizing:border-box}#${id} [data-kit-control]{position:absolute;box-sizing:border-box;margin:0;padding:0 ${8*PIXEL_PITCH}px;color:#a9e9df;border:${PIXEL_PITCH}px solid #558c7e;background:#06231f;border-radius:0;font:${10*PIXEL_PITCH}px/${10*PIXEL_PITCH}px PhosphorKitPixel,monospace;min-width:0;overflow:hidden}#${id} input[type=search]{padding-left:${20*PIXEL_PITCH}px;font-size:${10*PIXEL_PITCH}px}#${id} [data-kind=label]{display:flex;align-items:center;border:0;background:transparent;padding:0}#${id}[data-rendered=true] [data-kit-control]{color:transparent!important;caret-color:transparent!important;background:transparent!important;border-color:transparent!important;outline:0;box-shadow:none}#${id}[data-rendered=true] input[type=range]{opacity:0}#${id} button{cursor:pointer}#${id} button:disabled{cursor:default;opacity:.4}#${id} input[type=search]::-webkit-search-cancel-button{display:none}`;
  container.append(element);doc.head.append(style);doc.body.append(canvas);
  function bind(target,type,handler,options){target.addEventListener(type,handler,options);listeners.push(()=>target.removeEventListener(type,handler,options));}
  function values(){return Object.fromEntries([...records].map(([key,{config}])=>[key,config.value]));}
  function requestPaint(){if(!destroyed&&!frame)frame=win.requestAnimationFrame(render);}
  function apply(record){
    const {control,config}=record;control.dataset.kind=config.type;control.dataset.vfd=config.type==='toggle'?'button':config.type;
    control.disabled=config.disabled;control.setAttribute('aria-label',config.label);
    if(config.type==='slider'){control.min=String(config.min);control.max=String(config.max);control.step=String(config.step);control.value=String(config.value);}
    else if(config.type==='search'){control.value=config.value;control.placeholder=config.placeholder;}
    else{control.textContent=config.type==='label'?config.value||config.label:config.label;if(config.type==='toggle')control.setAttribute('aria-pressed',String(config.value));}
  }
  function change(record,event){
    if(destroyed||record.config.disabled)return;
    const {control,config}=record;
    const value=config.type==='button'?config.value+1:config.type==='toggle'?!config.value:config.type==='slider'?Number(control.value):control.value;
    record.config=normalizeKitControl({...config,value});apply(record);requestPaint();
    onChange({id:config.id,type:config.type,value:record.config.value,values:values(),event});
  }
  for(const config of configs){
    const tag=['button','toggle'].includes(config.type)?'button':['slider','search'].includes(config.type)?'input':'span';
    const control=doc.createElement(tag);control.dataset.kitControl=config.id;control.id=`${id}-${config.id}`;
    if(tag==='button')control.type='button';if(config.type==='slider')control.type='range';if(config.type==='search'){control.type='search';control.maxLength=4000;}
    const record={control,config};records.set(config.id,record);apply(record);element.append(control);
    if(config.type!=='label')bind(control,['button','toggle'].includes(config.type)?'click':'input',event=>change(record,event));
    for(const event of ['focus','blur','keyup','select','scroll'])bind(control,event,requestPaint);
    bind(control,'pointerdown',()=>{held=control;requestPaint();});
  }
  function layout(){
    const available=Math.max(1,Math.floor(container.getBoundingClientRect().width/UI_CELL)),resolved=resolveKitLayout([...records.values()].map(record=>record.config),Math.min(integer(columns,48,1),available),columns);
    element.style.width=`${resolved.columns*UI_CELL}px`;element.style.height=`${resolved.rows*UI_CELL}px`;
    for(const item of resolved.items){const control=records.get(item.id).control;Object.assign(control.style,{left:`${item.column*UI_CELL}px`,top:`${item.row*UI_CELL}px`,width:`${item.columns*UI_CELL}px`,height:`${item.rows*UI_CELL}px`});}
  }
  function render(){
    if(frame){win.cancelAnimationFrame(frame);frame=0;}if(destroyed)return;
    layout();const w=Math.ceil(win.innerWidth/PIXEL_PITCH),h=Math.ceil(win.innerHeight/PIXEL_PITCH);
    if(source.width!==w)source.width=w;if(source.height!==h)source.height=h;ctx.clearRect(0,0,w,h);
    const bounds=element.getBoundingClientRect(),clip=measureKitClip(element,win),visible=!!clip;
    canvas.hidden=!ready||!visible;
    if(clip){canvas.style.clipPath=`inset(${clip.top}px ${win.innerWidth-clip.right}px ${win.innerHeight-clip.bottom}px ${clip.left}px)`;canvas.style.opacity=String(clip.opacity);}
    if(visible){
      const panel=pixelBounds(bounds);ctx.fillStyle='#061713';ctx.fillRect(panel.x,panel.y,panel.width,panel.height);
      for(const {control} of records.values())paintGridControl(ctx,{element:control,type:control.dataset.vfd,...pixelBounds(control.getBoundingClientRect()),focused:doc.activeElement===control,held:held===control});
    }
    renderer?.invalidate();
  }
  bind(canvas,'viewer-grid-renderer-state',event=>{ready=event.detail.available;element.dataset.rendered=String(ready);requestPaint();});
  try{renderer=rendererFactory(canvas,source,currentOptics);ready=true;element.dataset.rendered='true';renderer.setPattern(currentPattern);}
  catch{ready=false;element.dataset.rendered='false';canvas.hidden=true;}
  for(const event of ['resize','scroll'])bind(win,event,requestPaint,{passive:true,capture:true});
  for(const event of ['pointerup','pointercancel','blur'])bind(win,event,()=>{held=null;requestPaint();});
  const observer=win.ResizeObserver?new win.ResizeObserver(requestPaint):null;
  const ancestorObserver=win.MutationObserver?new win.MutationObserver(requestPaint):null;
  for(let ancestor=container;ancestor;ancestor=ancestor.parentElement){observer?.observe(ancestor);ancestorObserver?.observe(ancestor,{attributes:true,attributeFilter:['hidden','style','class']});}
  render();
  return{element,canvas,render,getValues:values,getControlElement:key=>records.get(key)?.control||null,
    getState(){return{format:'phosphor-kit',version:KIT_VERSION,columns:integer(columns,48,1),controls:[...records.values()].map(record=>({...record.config,layout:{...record.config.layout}})),optics:{...currentOptics},pattern:currentPattern};},
    update(key,patch={}){if(destroyed)return false;const record=records.get(key);if(!record)throw new Error(`Unknown control: ${key}`);if(patch.type!==undefined&&patch.type!==record.config.type)throw new Error('Control type cannot change after mount.');record.config=normalizeKitControl({...record.config,...patch,id:key,layout:{...record.config.layout,...patch.layout}});apply(record);requestPaint();return true;},
    setOptics(patch={}){if(destroyed)return;currentOptics=normalizeKitOptics(patch,currentOptics);renderer?.setOptics(currentOptics);},
    setPattern(mark){if(destroyed)return;if(!PATTERNS.includes(mark))throw new Error('Unknown display pattern.');currentPattern=mark;renderer?.setPattern(mark);},
    destroy(){if(destroyed)return;destroyed=true;win.cancelAnimationFrame(frame);observer?.disconnect();ancestorObserver?.disconnect();listeners.forEach(remove=>remove());renderer?.destroy();element.remove();canvas.remove();style.remove();}
  };
}

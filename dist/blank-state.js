/** Browser-local flow layouts. Coordinates are integer UI-grid cells, not CSS pixels. */
export const DESIGN_STORAGE_KEY='phosphor-flow-designer-v1';
export const DESIGN_PAGES=Object.freeze([
  {id:'home',label:'Home',description:''},
  {id:'site',label:'Site',description:''},
  {id:'cases',label:'Cases',description:''},
  {id:'assets',label:'Assets',description:'Planes, tanks, sites'},
  {id:'system',label:'System',description:'System and device topology, running and installed modules, telemetry, direct control'},
  {id:'calendar',label:'Calendar',description:''},
  {id:'analyze',label:'Analyze',description:''}
].map(page=>Object.freeze(page)));
export const DEFAULT_HIDDEN_PAGES=Object.freeze([
  {id:'sign-in',label:'Sign in'},
  {id:'sign-up',label:'Sign up'},
  {id:'reset-password',label:'Reset password'}
].map(page=>Object.freeze(page)));

const FORMAT='phosphor-flow-designer',MAX_BYTES=1024*1024;
const PAGE_IDS=DESIGN_PAGES.map(page=>page.id);
const RECTANGLE_FIELDS=['id','x','y','width','height','label','link'];
const SHAPE_FIELDS=['id','type','x','y','width','height','label','link'];
const RESERVED_PAGE_IDS=new Set(['prototype','format','version','pages','hiddenpages',...Object.getOwnPropertyNames(Object.prototype).map(name=>name.toLowerCase())]);
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&[Object.prototype,null].includes(Object.getPrototypeOf(value));
const encoder=new TextEncoder();

function fields(value,expected,label){
  if(!record(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key))){
    throw new Error(`${label} must contain exactly the documented fields.`);
  }
}
function gridValue(value,min,max,label){
  if(!Number.isSafeInteger(value)||value<min||value>max)throw new Error(`${label} must be a whole grid-cell value from ${min} to ${max}.`);
  return value;
}

export function createDefaultDesign(){
  const hiddenPages=DEFAULT_HIDDEN_PAGES.map(page=>({...page}));
  return{format:FORMAT,version:2,hiddenPages,pages:Object.fromEntries([...PAGE_IDS,...hiddenPages.map(page=>page.id)].map(id=>[id,[]]))};
}

function hiddenPagesOf(input){
  if(!Array.isArray(input)||input.length>32)throw new Error('Flow design must contain at most 32 hidden pages.');
  const ids=new Set(PAGE_IDS),result=[];
  for(let index=0;index<input.length;index++){
    if(!Object.hasOwn(input,index))throw new Error('Flow design contains a missing hidden page.');
    const page=input[index];fields(page,['id','label'],'Hidden page');
    if(typeof page.id!=='string'||page.id.length>64||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.id)||RESERVED_PAGE_IDS.has(page.id))throw new Error('Hidden page needs a safe lowercase identifier.');
    if(ids.has(page.id))throw new Error(`Duplicate or main-page identifier: ${page.id}.`);
    ids.add(page.id);
    if(typeof page.label!=='string'||/[\u0000-\u001f\u007f-\u009f]/.test(page.label)||!page.label.trim()||page.label.trim().length>40)throw new Error('Hidden page needs a meaningful label of at most 40 characters without control characters.');
    result.push({id:page.id,label:page.label.trim()});
  }
  return result;
}

/** Reject incomplete layouts. Version 1 migrates in memory; reading never writes storage. */
export function normalizeDesign(input){
  if(!record(input)||input.format!==FORMAT||![1,2].includes(input.version))throw new Error('Choose a Phosphor flow design, version 1 or 2.');
  const legacy=input.version===1;
  fields(input,legacy?['format','version','pages']:['format','version','hiddenPages','pages'],'Flow design');
  const hiddenPages=legacy?DEFAULT_HIDDEN_PAGES.map(page=>({...page})):hiddenPagesOf(input.hiddenPages);
  const sourcePageIds=legacy?PAGE_IDS:[...PAGE_IDS,...hiddenPages.map(page=>page.id)];
  fields(input.pages,sourcePageIds,'Flow design pages');
  const result={format:FORMAT,version:2,hiddenPages,pages:Object.fromEntries([...PAGE_IDS,...hiddenPages.map(page=>page.id)].map(id=>[id,[]]))},ids=new Set();
  for(const page of sourcePageIds){
    const shapes=input.pages[page];
    if(!Array.isArray(shapes)||shapes.length>200)throw new Error(`Page ${page} must contain at most 200 shapes.`);
    for(let index=0;index<shapes.length;index++)if(!Object.hasOwn(shapes,index))throw new Error(`Page ${page} contains a missing shape.`);
    result.pages[page]=shapes.map((shape,index)=>{
      const label=`Shape ${index+1} on ${page}`;
      fields(shape,legacy?RECTANGLE_FIELDS:SHAPE_FIELDS,label);
      if(typeof shape.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(shape.id))throw new Error(`${label} needs a valid identifier.`);
      if(ids.has(shape.id))throw new Error(`Duplicate shape identifier: ${shape.id}.`);
      ids.add(shape.id);
      const type=legacy?'rectangle':shape.type;
      if(!['rectangle','divider'].includes(type))throw new Error(`${label} needs a supported shape type.`);
      const x=gridValue(shape.x,0,511,`${label} x`),y=gridValue(shape.y,0,511,`${label} y`);
      const width=gridValue(shape.width,type==='rectangle'?4:1,512,`${label} width`),height=gridValue(shape.height,type==='rectangle'?3:1,512,`${label} height`);
      if(type==='divider'&&!((height===1&&width>=4)||(width===1&&height>=4)))throw new Error(`${label} divider must be one cell thick and at least four cells long.`);
      if(x+width>512||y+height>512)throw new Error(`${label} extends beyond the 512-cell canvas bounds.`);
      if(typeof shape.label!=='string'||shape.label.length>80||/[\u0000-\u001f\u007f]/.test(shape.label))throw new Error(`${label} needs a label of at most 80 characters without control characters.`);
      if(shape.link!==null&&!sourcePageIds.includes(shape.link))throw new Error(`${label} links to an unknown page.`);
      return{id:shape.id,type,x,y,width,height,label:shape.label,link:shape.link};
    });
  }
  return result;
}

export function readDesign(storage){
  try{
    const target=storage??globalThis.localStorage;
    if(!target||typeof target.getItem!=='function')throw new Error('Browser storage is unavailable.');
    const raw=target.getItem(DESIGN_STORAGE_KEY);
    if(raw===null)return{state:createDefaultDesign(),error:null,blocked:false};
    if(typeof raw!=='string'||raw.length>MAX_BYTES||encoder.encode(raw).byteLength>MAX_BYTES)throw new Error('Saved flow design is too large or unreadable.');
    return{state:normalizeDesign(JSON.parse(raw)),error:null,blocked:false};
  }catch{
    return{state:createDefaultDesign(),error:'Saved layout could not be read. Original data was left untouched; automatic saving is paused.',blocked:true};
  }
}

/** The caller must honor readDesign().blocked before enabling automatic saves. */
export function saveDesign(storage,state){
  const normalized=normalizeDesign(state),raw=JSON.stringify(normalized);
  if(encoder.encode(raw).byteLength>MAX_BYTES)throw new Error('Flow design exceeds the storage size limit.');
  const target=storage??globalThis.localStorage;
  if(!target||typeof target.setItem!=='function')throw new Error('Browser storage is unavailable.');
  target.setItem(DESIGN_STORAGE_KEY,raw);
  return normalized;
}

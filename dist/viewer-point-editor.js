import * as THREE from './vendor/three.module.js';
import { createPointEditModel } from './point-edit-state.js?v=points-1';
import { PIXEL_PITCH } from './viewer-grid.js?v=pane-140';

const abortError=()=>new DOMException('Point operation cancelled.','AbortError');
const check=signal=>{if(signal?.aborted)throw abortError();};
const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
const linear=value=>{const v=Math.max(0,Math.min(1,value));return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;};
export function insidePolygon(x,y,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}

/** Original record IDs remain the edit identity; only the packed opacity word changes. */
export async function createPointEditor(mesh,{snapshot,signal,onProgress=()=>{},onChange=()=>{},onDirty=()=>{}}={}){
  check(signal);
  const count=mesh.numSplats,ext=mesh.extSplats,packed=ext?.extArrays?.[0];
  if(!Number.isSafeInteger(count)||count<1||!packed||packed.length<count*4)throw new Error('Original point records are unavailable.');
  mesh.updateMatrix();const m=mesh.matrix.elements.slice();
  const positions=new Float32Array(count*3),opacityWords=new Uint32Array(count),bins=new Uint8Array(count);
  for(let i=0;i<count;){check(signal);const stop=performance.now()+7;do{const end=Math.min(count,i+2048);for(;i<end;i++){
    const record=ext.getSplat(i),x=record.center.x,y=record.center.y,z=record.center.z,j=i*3;
    positions[j]=m[0]*x+m[4]*y+m[8]*z+m[12];positions[j+1]=m[1]*x+m[5]*y+m[9]*z+m[13];positions[j+2]=m[2]*x+m[6]*y+m[10]*z+m[14];
    opacityWords[i]=packed[i*4+3];
    const luminance=.2126*linear(record.color.r)+.7152*linear(record.color.g)+.0722*linear(record.color.b);
    bins[i]=Math.max(0,Math.min(31,Math.floor(luminance*32)));
  }}while(i<count&&performance.now()<stop);onProgress(i/count);if(i<count)await pause();}
  check(signal);
  let model=createPointEditModel(count,snapshot),disposed=false,busy=false,job=null,deleteRevision=0;
  const group=new THREE.Group();group.name='original-point-selection';
  const geometry=new THREE.BufferGeometry(),material=new THREE.PointsMaterial({color:'#ffd184',size:PIXEL_PITCH*2.25,sizeAttenuation:false,transparent:true,opacity:.85,depthTest:false,depthWrite:false,toneMapped:false});
  const highlightPositions=new THREE.BufferAttribute(new Float32Array(count*3),3);highlightPositions.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('position',highlightPositions);geometry.setDrawRange(0,0);
  const highlights=new THREE.Points(geometry,material);highlights.frustumCulled=false;highlights.renderOrder=100;group.add(highlights);
  let histogram=Array(32).fill(0),selectedHistogram=Array(32).fill(0);
  function summary(){return {...model.getSummary(),histogram:[...histogram],selectedHistogram:[...selectedHistogram],busy};}
  function emit({changed=false,includeSnapshot=false,message='',deletedChanged=false}={}){if(!disposed)onChange({summary:summary(),...(includeSnapshot?{snapshot:model.getSnapshot()}:{}),changed,message,deletedChanged});}
  function upload(){ext.needsUpdate=true;for(const texture of ext.textures||[])texture.needsUpdate=true;mesh.updateGenerator?.();mesh.updateVersion?.();}
  function applyDeletion(){const deleted=model.getDeletedMask();let changed=false;histogram=Array(32).fill(0);for(let i=0;i<count;i++){
    // Spark2.4 ExtSplats stores opacity in extArrays[0][4*i+3]. Preserve
    // every other packed word and every SH array exactly, including on undo.
    const value=deleted[i]?((opacityWords[i]&0xffff0000)>>>0):opacityWords[i];
    if(packed[i*4+3]!==value){packed[i*4+3]=value;changed=true;}
    if(!deleted[i])histogram[bins[i]]++;
  }if(changed){deleteRevision++;upload();}return changed;}
  function updateHighlight(){const ids=model.getSelectedIds(),data=highlightPositions.array;selectedHistogram=Array(32).fill(0);for(let i=0;i<ids.length;i++){const id=ids[i],j=id*3;data[i*3]=positions[j];data[i*3+1]=positions[j+1];data[i*3+2]=positions[j+2];selectedHistogram[bins[id]]++;}highlightPositions.clearUpdateRanges();if(ids.length)highlightPositions.addUpdateRange(0,ids.length*3);highlightPositions.needsUpdate=true;geometry.setDrawRange(0,ids.length);onDirty();}
  function cancel(){if(job){job.abort();job=null;}if(busy){busy=false;emit();}}
  function selectionChanged(){updateHighlight();emit();}
  function mutate(operation,message){if(disposed||busy)return null;const before=model.getSummary().revision,result=operation();if(model.getSummary().revision!==before){const deletedChanged=applyDeletion();updateHighlight();emit({changed:true,includeSnapshot:true,message,deletedChanged});}return result;}
  applyDeletion();updateHighlight();
  return {
    group,get deleteRevision(){return deleteRevision;},get busy(){return busy;},getSnapshot:()=>model.getSnapshot(),getSummary:summary,
    replaceSnapshot(value){if(disposed)return;cancel();model=createPointEditModel(count,value);const deletedChanged=applyDeletion();updateHighlight();emit({includeSnapshot:true,deletedChanged});},
    clearSelection(){if(!disposed&&!busy&&model.clearSelection())selectionChanged();},
    selectAll(){if(!disposed&&!busy&&model.selectAllVisible())selectionChanged();},
    deleteSelected(){return mutate(()=>model.deleteSelected(),'Selected original points hidden.');},
    restorePoints(){return mutate(()=>model.restoreDeleted(),'Hidden original points restored.');},
    undo(){return mutate(()=>model.undo(),'Last point edit undone.');},
    createGroup(name){return mutate(()=>model.createGroup(name),'Selection saved as a group.');},
    selectGroup(id,mode='replace'){if(!disposed&&!busy&&model.selectGroup(id,mode))selectionChanged();},
    removeGroup(id){return mutate(()=>model.removeGroup(id),'Point group removed.');},
    cancel,
    async selectScreen({camera,pivot,rect,point,polygon,mode='replace'}){
      if(disposed)return;cancel();const controller=new AbortController();job=controller;busy=true;emit();
      pivot.updateWorldMatrix(true,false);camera.updateMatrixWorld();
      const matrix=new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(pivot.matrixWorld),e=matrix.elements;
      const deleted=model.getDeletedMask(),hits=polygon?new Uint32Array(count):null;let hitCount=0,nearest=-1,nearestDistance=12*12,nearestDepth=Infinity;
      try{for(let i=0;i<count;){check(controller.signal);const stop=performance.now()+7;do{const end=Math.min(count,i+4096);for(;i<end;i++){
        if(deleted[i]||(opacityWords[i]&0xffff)===0)continue;const j=i*3,x=positions[j],y=positions[j+1],z=positions[j+2];
        const w=e[3]*x+e[7]*y+e[11]*z+e[15];if(w<=0)continue;
        const nx=(e[0]*x+e[4]*y+e[8]*z+e[12])/w,ny=(e[1]*x+e[5]*y+e[9]*z+e[13])/w,nz=(e[2]*x+e[6]*y+e[10]*z+e[14])/w;
        if(nx< -1||nx>1||ny< -1||ny>1||nz< -1||nz>1)continue;
        const sx=(nx*.5+.5)*rect.width,sy=(-ny*.5+.5)*rect.height;
        if(polygon){if(insidePolygon(sx,sy,polygon))hits[hitCount++]=i;}
        else{const d=(sx-point.x)**2+(sy-point.y)**2;if(d<nearestDistance-0.0001||(Math.abs(d-nearestDistance)<0.0001&&nz<nearestDepth)){nearest=i;nearestDistance=d;nearestDepth=nz;}}
      }}while(i<count&&performance.now()<stop);if(i<count)await pause();}
      check(controller.signal);if(job!==controller||disposed)return;
      model.applySelection(polygon?hits.subarray(0,hitCount):nearest<0?[]:[nearest],mode);busy=false;job=null;selectionChanged();
      }catch(error){if(error?.name!=='AbortError')throw error;}finally{if(job===controller){job=null;busy=false;emit();}}
    },
    restore(){if(disposed)return;geometry.attributes.position.needsUpdate=true;material.needsUpdate=true;upload();},
    dispose(){if(disposed)return;cancel();disposed=true;group.removeFromParent();group.clear();geometry.dispose();material.dispose();}
  };
}

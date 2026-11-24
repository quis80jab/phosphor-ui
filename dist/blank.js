import {mountUIPagesSkin} from './ui-pages-skin.js';
import {PIXEL_PITCH,UI_CELL,UI_PIXELS,floorCell} from './viewer-grid.js';
import {glyphRect,pixelText} from './vfd-glyphs.js';
import {DESIGN_PAGES,readDesign,saveDesign,normalizeDesign} from './blank-state.js?v=designer-2';
import {paintDesignElement,activateDesignElement,hasDesignElement} from './designer-preview.js';
import {paintSystemTopology,activateSystemTopology} from './designer-arch-view.js';
import {groupDesignPages} from './designer-navigation.js';

const $=id=>document.getElementById(id),clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const loaded=readDesign();let state=loaded.state,saveBlocked=loaded.blocked;
let page=new URL(location.href).searchParams.get('page')||'home',tool='select',selected=null,skin=null,gesture=null,draft=null,guides=false,labelTimer=0,preview=false;
let committed=JSON.stringify(state),undo=[],redo=[],toolPosition=null,toolDrag=null;
const tabs=[],railGroups=new Map(),expandedGroups=new Set(),boards=new Map(),toolbox=$('design-tools');
const pages=()=>[...DESIGN_PAGES,...state.hiddenPages.map(item=>({...item,description:'APP FLOW / LINKED PAGE'}))];
const rows=()=>state.pages[page]||[],selection=()=>rows().find(rect=>rect.id===selected);
const serialize=()=>JSON.stringify(state);
function status(message){$('design-status').textContent=message;skin?.refresh();}
function paint(){skin?.refresh();}
function save(){
  if(saveBlocked){status('AUTO SAVE PAUSED / EXPORT TO KEEP YOUR WORK');return false;}
  try{saveDesign(undefined,state);status('SAVED LOCALLY');return true;}catch{status('SAVE FAILED / EXPORT TO KEEP YOUR WORK');return false;}
}
function commit(persist=true){
  clearTimeout(labelTimer);labelTimer=0;const next=serialize();
  if(next===committed)return;
  undo.push({data:committed,page});if(undo.length>60)undo.shift();redo=[];committed=next;if(persist)save();updateInspector();
}
function historyStep(direction){
  cancelGesture();commit();const source=direction==='undo'?undo:redo,target=direction==='undo'?redo:undo;
  const entry=source.pop();if(!entry)return;
  target.push({data:committed,page:entry.page});state=JSON.parse(entry.data);committed=entry.data;selected=null;
  syncPages();selectPage(entry.page,{push:true});save();updateInspector();paint();
}
function updateInspector(){
  const rect=selection(),list=$('rectangle-selection'),value=rect?.id||'';
  const options=[new Option(rows().length?'SELECT ELEMENT':'NO ELEMENTS',''),...rows().map((r,i)=>new Option(r.label||`${r.type.toUpperCase()} ${i+1}`,r.id))];
  // Avoid rebuilding a focused text editor during continuous typing.
  list.replaceChildren(...options);list.value=value;list.disabled=!rows().length||preview;
  const input=$('rectangle-label');input.disabled=!rect||preview;if(document.activeElement!==input)input.value=rect?.label||'';
  $('rectangle-link').disabled=!rect||preview;$('rectangle-link').value=rect?.link||'';
  $('delete-rectangle').disabled=!rect||preview;$('follow-link').disabled=!rect?.link||preview;
  $('undo-design').disabled=!undo.length;$('redo-design').disabled=!redo.length;
  for(const button of document.querySelectorAll('[data-tool]')){button.setAttribute('aria-pressed',String(button.dataset.tool===tool));button.disabled=preview;}
  $('preview-design').setAttribute('aria-pressed',String(preview));$('preview-design').textContent=preview?'EDIT LAYOUT':'UI PREVIEW';
  toolbox.hidden=preview;
  document.body.dataset.tool=preview?'preview':tool;paint();
}
function setTool(next){cancelGesture();commit();tool=next;updateInspector();if(next==='label'&&selection())focusLabel();}
function focusLabel(){if(!selection())return;expandTools();$('rectangle-label').focus();$('rectangle-label').select();}
function removeSelection(){cancelGesture();commit();if(!selection())return;state.pages[page]=rows().filter(rect=>rect.id!==selected);selected=null;commit();paint();}
function selectPage(id,{focus=false,push=false}={}){
  cancelGesture();commit();const item=pages().find(entry=>entry.id===id)||DESIGN_PAGES[0];page=item.id;selected=null;
  updateRail(true);
  for(const [id,canvas]of boards)canvas.parentElement.hidden=id!==page;
  $('blank-title').textContent=item.label.toUpperCase();$('page-scope').textContent=item.description;
  document.title=item.label+' · Phosphor';
  const url=new URL(location.href);url.searchParams.set('page',page);if(url.href!==location.href)history[push?'pushState':'replaceState'](null,'',url);
  if(focus)($('tab-'+page)||boards.get(page)).focus();updateInspector();layout();
  revealRailPage();
}
function sizeBoard(id){
  const canvas=boards.get(id),panel=canvas.parentElement;if(panel.hidden)return;
  const items=state.pages[id],topology=preview&&id==='system'&&topologyBounds(),right=Math.max(48,topology?topology.width/UI_PIXELS+2:0,...items.map(r=>r.x+r.width+2)),bottom=Math.max(40,topology?topology.height/UI_PIXELS+2:0,...items.map(r=>r.y+r.height+2));
  canvas.style.width=clamp(Math.max(Math.floor(panel.clientWidth/UI_CELL),right),48,512)*UI_CELL+'px';
  canvas.style.height=clamp(Math.max(Math.floor(panel.clientHeight/UI_CELL),bottom),40,512)*UI_CELL+'px';
}
function layout(){
  const root=document.documentElement,width=floorCell(innerWidth);
  root.style.setProperty('--surface-width',`${width}px`);root.style.setProperty('--pixel',`${PIXEL_PITCH}px`);root.style.setProperty('--cell',`${UI_CELL}px`);
  root.style.setProperty('--blank-rail-width',`${(width<UI_CELL*56?12:18)*UI_CELL}px`);root.style.setProperty('--blank-height',`${floorCell(innerHeight)}px`);
  document.body.dataset.pixelPitch=PIXEL_PITCH;document.body.dataset.uiPixels=UI_PIXELS;
  sizeBoard(page);positionTools(toolPosition);positionLinkedDialog();skin?.relayout();
}
function wrapLabel(value,columns,limit){
  const words=value.toUpperCase().split(/\s+/),lines=[];let line='';
  for(let word of words){if(!word)continue;if(line&&line.length+1+word.length<=columns){line+=' '+word;continue;}if(line)lines.push(line);line='';while(word.length>columns){lines.push(word.slice(0,columns));word=word.slice(columns);}line=word;}
  if(line)lines.push(line);return lines.slice(0,limit);
}
function drawPage(ctx,width,height,id){
  const topology=preview&&id==='system'&&topologyBounds();if(topology)paintSystemTopology(ctx,topology);
  if(!preview&&(guides||(['rectangle','divider'].includes(tool)&&id===page))){
    ctx.fillStyle='#17352f';for(let y=0;y<height;y+=UI_PIXELS)for(let x=0;x<width;x+=UI_PIXELS)ctx.fillRect(x,y,1,1);
  }
  const rectangles=[...state.pages[id]];if(preview)rectangles.sort((a,b)=>b.width*b.height-a.width*a.height);if(draft&&id===page)rectangles.push(draft);
  for(const rect of rectangles){
    if(preview&&rect.type==='rectangle'&&hasDesignElement(rect,id)){paintDesignElement(ctx,rect,{page:id,allRects:state.pages[id]});continue;}
    const x=rect.x*UI_PIXELS,y=rect.y*UI_PIXELS,w=rect.width*UI_PIXELS,h=rect.height*UI_PIXELS,active=id===page&&(rect.id===selected||rect===draft);
    const color=active?'#c9fff1':'#6ca99a';
    if(rect.type==='divider'){
      const horizontal=rect.height===1;ctx.fillStyle=color;
      ctx.fillRect(x+(horizontal?0:4),y+(horizontal?4:0),horizontal?w:1,horizontal?1:h);
      if(rect.label)pixelText(ctx,rect.label.toUpperCase(),x+(horizontal?4:10),Math.max(0,y+(horizontal?-7:4)),color,1,{maxWidth:horizontal?w-8:Math.max(0,width-x-12)});
      if(active){const end=resizePoint(rect);ctx.fillRect(end.x*UI_PIXELS-2,end.y*UI_PIXELS-2,5,5);}continue;
    }
    glyphRect(ctx,x,y,w,h,color);
    ctx.save();ctx.beginPath();ctx.rect(x+3,y+3,Math.max(0,w-6),Math.max(0,h-6));ctx.clip();
    const text=wrapLabel(rect.label,Math.max(1,Math.floor((w-12)/6)),Math.max(1,Math.floor((h-(rect.link?21:10))/10)));
    text.forEach((line,index)=>pixelText(ctx,line,x+6,y+6+index*10,color));
    if(rect.link)pixelText(ctx,'> '+pages().find(p=>p.id===rect.link).label.toUpperCase(),x+6,y+h-13,'#ffc782');
    ctx.restore();
    if(active){ctx.fillStyle='#c9fff1';ctx.fillRect(x+w-3,y+h-3,5,5);}
  }
}
function boardPoint(event,canvas){const r=canvas.getBoundingClientRect();return{x:(event.clientX-r.left)/UI_CELL,y:(event.clientY-r.top)/UI_CELL};}
function boardBounds(canvas){return{width:Math.round(parseFloat(canvas.style.width)/UI_CELL),height:Math.round(parseFloat(canvas.style.height)/UI_CELL)};}
function hitRect(point){const items=preview?[...rows()].sort((a,b)=>b.width*b.height-a.width*a.height):rows();return items.findLast(r=>point.x>=r.x&&point.x<=r.x+r.width&&point.y>=r.y&&point.y<=r.y+r.height);}
function topologyBounds(){
  const items=state.pages.system;if(items.some(r=>r.type==='rectangle'&&/^(system )?topology$/i.test(r.label.trim())))return null;
  const right=items.filter(r=>r.x>0),edge=right.length?Math.min(...right.map(r=>r.x)):77;
  if(edge<40)return null;
  return{x:0,y:0,width:edge*UI_PIXELS,height:Math.max(64,...items.map(r=>r.y+r.height))*UI_PIXELS};
}
function resizePoint(rect){return{x:rect.x+rect.width-(rect.type==='divider'&&rect.width===1?.5:0),y:rect.y+rect.height-(rect.type==='divider'&&rect.height===1?.5:0)};}
function pointerDown(event,canvas){
  if(event.button!==0||gesture)return;commit();const point=boardPoint(event,canvas),bounds=boardBounds(canvas);canvas.focus({preventScroll:true});
  const rect=hitRect(point),chosen=selection();
  if(preview){
    event.preventDefault();if(!rect){if(page==='system'){const b=topologyBounds();if(b)activateSystemTopology({x:point.x*UI_PIXELS,y:point.y*UI_PIXELS},b);paint();}return;}
    if(rect.link){selectPage(rect.link,{push:true});return;}
    const result=activateDesignElement(rect,{x:(point.x-rect.x)/rect.width,y:(point.y-rect.y)/rect.height},{page,allRects:rows()});
    if(result?.navigate)selectPage(result.navigate,{push:true});paint();return;
  }
  if(['rectangle','divider'].includes(tool)){
    if(rows().length>=200){status('PAGE LIMIT REACHED / DELETE AN ELEMENT FIRST');return;}
    selected=null;gesture={type:'draw',shape:tool,start:point,bounds,canvas,pointer:event.pointerId,before:serialize()};
  }else if(tool==='label'){
    event.preventDefault();selected=rect?.id||null;updateInspector();if(rect)focusLabel();return;
  }else{
    const end=chosen&&resizePoint(chosen),resize=end&&Math.abs(point.x-end.x)<1&&Math.abs(point.y-end.y)<1;
    selected=resize?chosen.id:rect?.id||null;updateInspector();if(!selected)return;
    gesture={type:resize?'resize':'move',start:point,rect:{...selection()},bounds,canvas,pointer:event.pointerId,before:serialize()};
  }
  canvas.setPointerCapture(event.pointerId);event.preventDefault();updateInspector();
}
function pointerMove(event,canvas){
  if(!gesture||gesture.canvas!==canvas||gesture.pointer!==event.pointerId)return;
  const point=boardPoint(event,canvas),g=gesture,dx=Math.round(point.x-g.start.x),dy=Math.round(point.y-g.start.y);
  if(g.type==='draw'){
    const ax=clamp(Math.round(g.start.x),0,g.bounds.width-4),ay=clamp(Math.round(g.start.y),0,g.bounds.height-3);
    const bx=clamp(Math.round(point.x),0,g.bounds.width),by=clamp(Math.round(point.y),0,g.bounds.height);
    const x=clamp(Math.min(ax,bx),0,g.bounds.width-4),y=clamp(Math.min(ay,by),0,g.bounds.height-3);
    if(g.shape==='divider'){
      const horizontal=Math.abs(dx)>=Math.abs(dy),sx=clamp(Math.round(g.start.x),0,g.bounds.width-1),sy=clamp(Math.round(g.start.y),0,g.bounds.height-1);
      const lx=horizontal?clamp(Math.min(sx,bx),0,g.bounds.width-4):sx,ly=horizontal?sy:clamp(Math.min(sy,by),0,g.bounds.height-4);
      draft={id:'draft',type:'divider',x:lx,y:ly,width:horizontal?clamp(Math.abs(bx-sx),4,g.bounds.width-lx):1,height:horizontal?1:clamp(Math.abs(by-sy),4,g.bounds.height-ly),label:'',link:null};
      g.moved=Math.max(Math.abs(dx),Math.abs(dy))>=2;
    }else{
      draft={id:'draft',type:'rectangle',x,y,width:clamp(Math.abs(bx-ax),4,g.bounds.width-x),height:clamp(Math.abs(by-ay),3,g.bounds.height-y),label:'',link:null};
      g.moved=Math.abs(point.x-g.start.x)>=2&&Math.abs(point.y-g.start.y)>=2;
    }
  }else{
    const rect=selection();if(!rect)return;
    if(g.type==='move'){rect.x=clamp(g.rect.x+dx,0,g.bounds.width-rect.width);rect.y=clamp(g.rect.y+dy,0,g.bounds.height-rect.height);}
    else if(rect.type==='divider'){if(g.rect.height===1)rect.width=clamp(g.rect.width+dx,4,g.bounds.width-rect.x);else rect.height=clamp(g.rect.height+dy,4,g.bounds.height-rect.y);}
    else{rect.width=clamp(g.rect.width+dx,4,g.bounds.width-rect.x);rect.height=clamp(g.rect.height+dy,3,g.bounds.height-rect.y);}
  }
  paint();
}
function finishGesture(event){
  if(!gesture||gesture.pointer!==event.pointerId)return;const g=gesture;pointerMove(event,g.canvas);gesture=null;
  if(g.type==='draw'&&g.moved&&draft){const rect={...draft,id:'rect-'+crypto.randomUUID()};rows().push(rect);selected=rect.id;}
  draft=null;if(g.canvas.hasPointerCapture(g.pointer))g.canvas.releasePointerCapture(g.pointer);
  commit();updateInspector();paint();
}
function cancelGesture(){
  if(!gesture)return;const g=gesture;gesture=null;draft=null;state=JSON.parse(g.before);
  if(g.canvas.hasPointerCapture(g.pointer))g.canvas.releasePointerCapture(g.pointer);updateInspector();paint();
}
function positionTools(position){
  const width=toolbox.offsetWidth,height=toolbox.offsetHeight;
  const x=clamp(Math.round((position?.x??innerWidth-width-2*UI_CELL)/UI_CELL)*UI_CELL,0,Math.max(0,floorCell(innerWidth-width)));
  const y=clamp(Math.round((position?.y??9*UI_CELL)/UI_CELL)*UI_CELL,0,Math.max(0,floorCell(innerHeight-height)));
  toolbox.style.left=x+'px';toolbox.style.top=y+'px';toolbox.style.right='auto';
  if(position)toolPosition={x,y};skin?.relayout();
}
function expandTools(){
  toolbox.dataset.collapsed='false';$('tools-body').hidden=false;$('tools-collapse').textContent='-';$('tools-collapse').setAttribute('aria-expanded','true');$('tools-collapse').setAttribute('aria-label','Collapse toolbox');positionTools(toolPosition);
}

function addBoard(item){
  const panel=document.createElement('section');panel.id='panel-'+item.id;panel.className='blank-page';panel.role='region';
  panel.setAttribute('aria-labelledby','tab-'+item.id);panel.hidden=item.id!==page;
  const canvas=document.createElement('canvas');canvas.id='canvas-'+item.id;canvas.className='design-board';canvas.dataset.vfd='canvas';canvas.tabIndex=0;canvas.setAttribute('aria-label',item.label+' design canvas. R draws boxes, D draws dividers, V selects, T labels, Delete removes the selection.');canvas.vfdDraw=(ctx,w,h)=>drawPage(ctx,w,h,item.id);panel.append(canvas);$('design-pages').append(panel);boards.set(item.id,canvas);
  canvas.addEventListener('pointerdown',event=>pointerDown(event,canvas));canvas.addEventListener('pointermove',event=>pointerMove(event,canvas));canvas.addEventListener('pointerup',finishGesture);canvas.addEventListener('pointercancel',cancelGesture);canvas.addEventListener('lostpointercapture',()=>{if(gesture?.canvas===canvas)cancelGesture();});
  canvas.addEventListener('dblclick',event=>{if(preview||['rectangle','divider'].includes(tool))return;const rect=hitRect(boardPoint(event,canvas));if(rect){selected=rect.id;updateInspector();focusLabel();}});
}
function syncPages(){
  const registry=pages(),ids=new Set(registry.map(item=>item.id));
  syncRail();
  for(const [id,canvas]of boards)if(!ids.has(id)){canvas.parentElement.remove();boards.delete(id);}
  for(const item of registry){
    if(!boards.has(item.id))addBoard(item);
    else if(state.hiddenPages.some(entry=>entry.id===item.id)){
      const canvas=boards.get(item.id);canvas.setAttribute('aria-label',item.label+' design canvas. R draws boxes, D draws dividers, V selects, T labels, Delete removes the selection.');
    }
  }
  const link=$('rectangle-link'),previous=link.value;link.replaceChildren(new Option('NONE',''),...registry.map(item=>new Option(item.label.toUpperCase()+(DESIGN_PAGES.includes(item)?'':' / LINKED'),item.id)));link.value=ids.has(previous)?previous:'';
  const picker=$('linked-page-picker'),chosen=picker.value;picker.replaceChildren(...state.hiddenPages.map(item=>new Option(item.label.toUpperCase(),item.id)));picker.value=state.hiddenPages.some(item=>item.id===chosen)?chosen:state.hiddenPages[0]?.id||'';picker.disabled=!state.hiddenPages.length;$('open-linked-page').disabled=!state.hiddenPages.length;
}
function positionLinkedDialog(){
  const panel=$('linked-pages-dialog');panel.style.left=Math.max(0,floorCell((innerWidth-panel.offsetWidth)/2))+'px';panel.style.top=Math.max(0,floorCell((innerHeight-panel.offsetHeight)/2))+'px';
}
function openLinkedPages(){
  cancelGesture();commit();syncPages();if(state.hiddenPages.some(item=>item.id===page))$('linked-page-picker').value=page;
  $('linked-backdrop').hidden=false;$('ui-shell').inert=true;toolbox.inert=true;positionLinkedDialog();$('close-linked-pages').focus();skin?.relayout();
}
function closeLinkedPages(){
  $('linked-backdrop').hidden=true;$('ui-shell').inert=false;toolbox.inert=false;$('show-linked-pages').focus();skin?.relayout();
}
function createLinkedPage(){
  const label=$('new-linked-page').value.trim(),message=$('linked-page-status');
  if(!label){message.textContent='ENTER A PAGE NAME';paint();$('new-linked-page').focus();return;}
  if(state.hiddenPages.length>=32){message.textContent='LINKED PAGE LIMIT REACHED';paint();return;}
  const base='page-'+(label.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45).replace(/-$/,'')||'untitled');let id=base,suffix=2;
  while(Object.hasOwn(state.pages,id))id=base+'-'+suffix++;
  const next=structuredClone(state);next.hiddenPages.push({id,label});next.pages[id]=[];
  try{state=normalizeDesign(next);}catch(error){message.textContent=error.message;paint();return;}
  // Page creation and its empty canvas are one reversible edit.
  commit();syncPages();preview=false;$('new-linked-page').value='';message.textContent='Each page has its own saved canvas.';closeLinkedPages();selectPage(id,{push:true,focus:true});
}
function revealRailPage(){
  const link=$('tab-'+page),rail=$('design-tabs');if(!link||link.closest('[hidden]'))return;
  const item=link.getBoundingClientRect(),bounds=rail.getBoundingClientRect();
  if(item.top<bounds.top)rail.scrollTop-=Math.ceil((bounds.top-item.top)/UI_CELL)*UI_CELL;
  else if(item.bottom>bounds.bottom)rail.scrollTop+=Math.ceil((item.bottom-bounds.bottom)/UI_CELL)*UI_CELL;
}
function updateRail(reveal=false){
  for(const group of railGroups.values()){
    const childActive=group.children.some(item=>item.id===page);
    if(reveal&&(childActive||group.id===page))expandedGroups.add(group.id);
    group.list.hidden=!expandedGroups.has(group.id);
    if(group.toggle){
      group.toggle.textContent=group.list.hidden?'+':'-';
      group.toggle.setAttribute('aria-expanded',String(!group.list.hidden));
      group.toggle.setAttribute('aria-label',(group.list.hidden?'Expand ':'Collapse ')+group.label+' pages');
    }
    group.link.dataset.vfdColor=childActive?'#d6bd83':'#a9e9df';
  }
  for(const tab of tabs){if(tab.dataset.page===page)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}
  const expandable=[...railGroups.values()].filter(group=>group.children.length);
  const all=expandable.length>0&&expandable.every(group=>expandedGroups.has(group.id));
  $('expand-page-groups').textContent=all?'COLLAPSE ALL':'EXPAND ALL';$('expand-page-groups').disabled=!expandable.length;
  skin?.relayout();
}
function setRailExpanded(id,expanded){if(expanded)expandedGroups.add(id);else expandedGroups.delete(id);updateRail();}
function syncRail(){
  const rail=$('design-tabs'),previousFocus=document.activeElement?.id,scrollTop=rail.scrollTop;
  const fragment=document.createDocumentFragment();tabs.length=0;railGroups.clear();
  function pageLink(item,parent,child=false){
    const link=document.createElement('a'),url=new URL(location.href);url.searchParams.set('page',item.id);
    link.href=url.href;link.id='tab-'+item.id;link.className='rail-page';link.dataset.page=item.id;link.dataset.group=parent;link.dataset.vfd='button';
    link.textContent=(item.railLabel||item.label).toUpperCase();link.setAttribute('aria-label',item.label);link.title=item.label;link.setAttribute('aria-controls','panel-'+item.id);
    link.addEventListener('click',event=>{if(event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();selectPage(item.id,{push:true});});
    link.addEventListener('keydown',event=>{
      const group=railGroups.get(parent),visible=tabs.filter(tab=>!tab.closest('[hidden]')),i=visible.indexOf(link);
      const next={ArrowDown:(i+1)%visible.length,ArrowUp:(i+visible.length-1)%visible.length,Home:0,End:visible.length-1}[event.key];
      if(next!==undefined){event.preventDefault();visible[next]?.focus();return;}
      if(event.key==='ArrowRight'&&group.children.length){event.preventDefault();if(group.list.hidden)setRailExpanded(parent,true);else if(!child)group.list.querySelector('a')?.focus();}
      if(event.key==='ArrowLeft'){event.preventDefault();if(child)group.link.focus();else setRailExpanded(parent,false);}
    });
    tabs.push(link);return link;
  }
  for(const item of groupDesignPages(state.hiddenPages)){
    const section=document.createElement('div'),heading=document.createElement('div'),list=document.createElement('div');
    section.className='rail-page-group';heading.className='rail-group-heading';list.className='rail-children';list.id='rail-children-'+item.id;
    const group={...item,list,link:pageLink(item,item.id),toggle:null};railGroups.set(item.id,group);heading.append(group.link);
    if(item.children.length){
      const toggle=document.createElement('button');toggle.type='button';toggle.className='rail-disclosure';toggle.id='rail-toggle-'+item.id;toggle.dataset.vfd='button';toggle.setAttribute('aria-controls',list.id);group.toggle=toggle;
      toggle.addEventListener('click',()=>setRailExpanded(item.id,list.hidden));heading.append(toggle);
      for(const child of item.children)list.append(pageLink(child,item.id,true));
    }
    section.append(heading,list);fragment.append(section);
  }
  rail.replaceChildren(fragment);updateRail(true);rail.scrollTop=scrollTop;
  if(previousFocus&&rail.contains($(previousFocus)))$(previousFocus).focus({preventScroll:true});
}
syncPages();
$('expand-page-groups').addEventListener('click',()=>{
  const groups=[...railGroups.values()].filter(group=>group.children.length),expand=groups.some(group=>!expandedGroups.has(group.id));
  for(const group of groups){if(expand)expandedGroups.add(group.id);else expandedGroups.delete(group.id);}updateRail();
});
$('preview-design').addEventListener('click',()=>{cancelGesture();commit();preview=!preview;selected=null;updateInspector();layout();status(saveBlocked?'AUTO SAVE PAUSED / EXPORT TO KEEP YOUR WORK':preview?'UI PREVIEW / DEMO DATA':'LAYOUT EDITOR');});
$('rail-divider').vfdDraw=(ctx,w,h)=>{ctx.fillStyle='#558c7e';ctx.fillRect(0,Math.floor(h/2),w,1);};
$('show-linked-pages').addEventListener('click',openLinkedPages);$('close-linked-pages').addEventListener('click',closeLinkedPages);
$('open-linked-page').addEventListener('click',()=>{const id=$('linked-page-picker').value;if(!id)return;closeLinkedPages();selectPage(id,{push:true,focus:true});});
$('create-linked-page').addEventListener('click',createLinkedPage);
$('new-linked-page').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();createLinkedPage();}});
$('linked-backdrop').addEventListener('click',event=>{if(event.target===$('linked-backdrop'))closeLinkedPages();});
$('linked-pages-dialog').addEventListener('keydown',event=>{
  if(event.key==='Escape'&&!document.querySelector('.grid-select-menu')){event.preventDefault();event.stopPropagation();closeLinkedPages();return;}
  if(event.key==='Tab'&&!document.querySelector('.grid-select-menu')){
    const controls=[...$('linked-pages-dialog').querySelectorAll('button,input,select')].filter(el=>!el.disabled),first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
});
for(const button of document.querySelectorAll('[data-tool]'))button.addEventListener('click',()=>setTool(button.dataset.tool));
$('delete-rectangle').addEventListener('click',removeSelection);
$('rectangle-selection').addEventListener('change',event=>{commit();selected=event.target.value||null;updateInspector();});
$('rectangle-label').addEventListener('input',event=>{const rect=selection();if(!rect)return;rect.label=event.target.value;paint();clearTimeout(labelTimer);labelTimer=setTimeout(commit,400);});
$('rectangle-label').addEventListener('change',commit);
$('rectangle-label').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit();boards.get(page).focus({preventScroll:true});}});
$('rectangle-link').addEventListener('change',event=>{const rect=selection();if(rect){rect.link=event.target.value||null;commit();updateInspector();}});
$('follow-link').addEventListener('click',()=>{const destination=selection()?.link;if(destination)selectPage(destination,{push:true});});
$('undo-design').addEventListener('click',()=>historyStep('undo'));$('redo-design').addEventListener('click',()=>historyStep('redo'));
$('design-grid').addEventListener('click',event=>{guides=!guides;event.currentTarget.setAttribute('aria-pressed',String(guides));paint();});
$('tools-collapse').addEventListener('click',()=>{if($('tools-body').hidden){expandTools();return;}toolbox.dataset.collapsed='true';$('tools-body').hidden=true;$('tools-collapse').textContent='+';$('tools-collapse').setAttribute('aria-expanded','false');$('tools-collapse').setAttribute('aria-label','Expand toolbox');positionTools(toolPosition);});
const dragHandle=$('tools-drag');
dragHandle.addEventListener('pointerdown',event=>{if(event.button!==0)return;const r=toolbox.getBoundingClientRect();toolDrag={pointer:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top};dragHandle.setPointerCapture(event.pointerId);event.preventDefault();});
dragHandle.addEventListener('pointermove',event=>{if(toolDrag?.pointer!==event.pointerId)return;positionTools({x:toolDrag.left+event.clientX-toolDrag.x,y:toolDrag.top+event.clientY-toolDrag.y});});
for(const name of ['pointerup','pointercancel','lostpointercapture'])dragHandle.addEventListener(name,()=>{toolDrag=null;});
dragHandle.addEventListener('keydown',event=>{const steps={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key],r=toolbox.getBoundingClientRect();if(steps){event.preventDefault();event.stopPropagation();positionTools({x:r.left+steps[0]*UI_CELL,y:r.top+steps[1]*UI_CELL});}else if(event.key==='Home'){event.preventDefault();toolPosition=null;positionTools(null);}});
$('export-design').addEventListener('click',()=>{cancelGesture();commit();const blob=new Blob([JSON.stringify(normalizeDesign(state),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='phosphor-flow-design.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('LAYOUT EXPORTED');});
$('import-design').addEventListener('click',()=>$('design-file').click());
$('design-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{if(file.size>1024*1024)throw new Error('Layout must be under 1 MB.');const next=normalizeDesign(JSON.parse(await file.text()));cancelGesture();commit();state=next;selected=null;saveBlocked=false;commit(false);syncPages();selectPage(page);const saved=save();layout();updateInspector();status(saved?'LAYOUT IMPORTED / SAVED LOCALLY':'LAYOUT IMPORTED / SAVE FAILED. EXPORT TO KEEP.');}catch(error){status('IMPORT FAILED / '+error.message);}finally{event.target.value='';}
});
document.addEventListener('keydown',event=>{
  if(!$('linked-backdrop').hidden)return;
  if(event.target.closest('input,textarea,select,[contenteditable=true],.blank-rail')||document.querySelector('.grid-select-menu'))return;
  if(event.key==='Escape'){event.preventDefault();if(gesture)cancelGesture();else{selected=null;tool='select';updateInspector();}return;}
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){event.preventDefault();historyStep(event.shiftKey?'redo':'undo');return;}
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(preview)return;
  if(['Delete','Backspace'].includes(event.key)){event.preventDefault();removeSelection();return;}
  const modes={r:'rectangle',d:'divider',v:'select',t:'label'};if(modes[event.key.toLowerCase()]){event.preventDefault();setTool(modes[event.key.toLowerCase()]);return;}
  const rect=selection(),step=event.shiftKey?4:1,delta={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
  if(rect&&delta&&event.target===boards.get(page)){event.preventDefault();const bounds=boardBounds(boards.get(page));rect.x=clamp(rect.x+delta[0],0,bounds.width-rect.width);rect.y=clamp(rect.y+delta[1],0,bounds.height-rect.height);commit();paint();}
});
window.addEventListener('popstate',()=>selectPage(new URL(location.href).searchParams.get('page')));
window.addEventListener('resize',()=>{cancelGesture();layout();});window.addEventListener('pageshow',layout);
window.addEventListener('blur',cancelGesture);
selectPage(new URL(location.href).searchParams.get('page'));layout();skin=mountUIPagesSkin();
status(loaded.error||(Object.values(state.pages).some(items=>items.length)?'SAVED LAYOUT RESTORED':'DRAW A RECTANGLE TO BEGIN'));
window.addEventListener('pagehide',event=>{cancelGesture();commit();if(!event.persisted)skin?.destroy();});

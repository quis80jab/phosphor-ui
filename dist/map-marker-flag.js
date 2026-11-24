import { PIXEL_PITCH } from './viewer-grid.js?v=pane-140';

export function markerCoordinates(marker) {
  if (!Number.isFinite(marker?.latitude) || !Number.isFinite(marker?.longitude)) return null;
  return [
    `LAT ${Math.abs(marker.latitude).toFixed(6)} ${marker.latitude < 0 ? 'S' : 'N'}`,
    `LON ${Math.abs(marker.longitude).toFixed(6)} ${marker.longitude < 0 ? 'W' : 'E'}`
  ];
}

/** Move the annotation on the global pixel lattice, without scaling its glyphs. */
export function markerFlagLayout(marker, rect, expanded = false) {
  if (!marker?.visible || !Number.isFinite(marker.screen?.x) || !Number.isFinite(marker.screen?.y)
    || marker.screen.x < 0 || marker.screen.x > 1 || marker.screen.y < 0 || marker.screen.y > 1) return null;
  const p = PIXEL_PITCH, width = 144*p, height = (expanded ? 72 : 44)*p, margin = 8*p;
  if (rect.width < width+2*margin || rect.height < height+2*margin) return null;
  const anchor = [marker.screen.x*rect.width, marker.screen.y*rect.height];
  const snap = (value, origin) => Math.round((origin+value)/p)*p-origin;
  const left = snap(Math.max(margin,Math.min(rect.width-width-margin,anchor[0]+12*p)),rect.left);
  const above = anchor[1]-height-12*p;
  const top = snap(Math.max(margin,Math.min(rect.height-height-margin,above >= margin ? above : anchor[1]+12*p)),rect.top);
  const end = [Math.max(left,Math.min(left+width,anchor[0])),Math.max(top,Math.min(top+height,anchor[1]))];
  return {left,top,width,height,points:[anchor,end]};
}

export function mountMapMarkerFlag({root,canvas,onView,refresh=()=>{}}) {
  const card=root.querySelector('.map-marker-card'),flag=root.querySelector('#map-marker-flag');
  const action=root.querySelector('#map-marker-view'),coordinates=root.querySelector('.map-marker-coordinates');
  let latest=null,expanded=false,signature='',destroyed=false;
  function hide(){
    if(!root.hidden){root.hidden=true;refresh(root);}
    if(root.contains(document.activeElement))canvas.focus({preventScroll:true});
  }
  function update(marker){
    if(destroyed)return;
    latest=marker;
    const rows=markerCoordinates(marker),rect=canvas.getBoundingClientRect();
    const layout=rows&&markerFlagLayout(marker,rect,expanded);
    if(!layout){hide();return;}
    const next=JSON.stringify([layout,rows,expanded]);
    if(next===signature&&!root.hidden)return;
    signature=next;if(root.hidden)root.hidden=false;
    card.style.left=`${layout.left}px`;card.style.top=`${layout.top}px`;
    card.style.height=`${layout.height}px`;
    root.dataset.points=JSON.stringify(layout.points);
    flag.dataset.latitude=rows[0];flag.dataset.longitude=rows[1];
    const label=rows.join('\n');if(coordinates.textContent!==label)coordinates.textContent=label;
    if(action.hidden===expanded)action.hidden=!expanded;
    if(flag.getAttribute('aria-expanded')!==String(expanded))flag.setAttribute('aria-expanded',String(expanded));
    refresh(root);
  }
  function toggle(){expanded=!expanded;update(latest);}
  function view(){onView?.();}
  function key(event){if(event.key==='Escape'&&expanded){event.preventDefault();expanded=false;update(latest);flag.focus({preventScroll:true});}}
  function reposition(){update(latest);}
  flag.addEventListener('click',toggle);action.addEventListener('click',view);root.addEventListener('keydown',key);
  window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,{capture:true,passive:true});
  return {update,destroy(){destroyed=true;hide();flag.removeEventListener('click',toggle);action.removeEventListener('click',view);root.removeEventListener('keydown',key);window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);}};
}

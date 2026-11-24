import {DESIGN_PAGES} from './blank-state.js?v=designer-2';

// Navigation metadata is separate from the saved document: grouping never rewrites layouts.
const parents=new Map([
  ['sign-in','home'],['sign-up','home'],['reset-password','home'],['settings','home'],
  ['files','assets'],['bench','system'],['simkit','system'],
  ['pipeline','analyze'],['assistant','analyze']
]);
const shortLabels=new Map([['simkit','Sim / training']]);

export function groupDesignPages(linkedPages=[]){
  const groups=DESIGN_PAGES.map(item=>({...item,children:[]}));
  for(const item of linkedPages){
    const id=item.id.replace(/^page-/,''),label=item.label.toLowerCase();
    const parent=parents.get(item.id)||groups.find(group=>id.startsWith(group.id+'-')||label.startsWith(group.label.toLowerCase()+':'))?.id||'home';
    const group=groups.find(entry=>entry.id===parent);
    const railLabel=shortLabels.get(item.id)||item.label.replace(new RegExp('^'+group.label+':\\s*','i'),'');
    group.children.push({...item,railLabel});
  }
  return groups;
}

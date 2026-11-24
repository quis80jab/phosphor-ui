export const PAGE_IDS = ['catalog','home','cases','parts','value','logistics'];
export const COMPONENTS = [
  {id:'hero',name:'Hero / mission banner',page:'home',family:'CONTENT',description:'A mission introduction with a raster aircraft illustration and direct entry into the application.',reference:'READINESS WELCOME'},
  {id:'news',name:'News cards',page:'home',family:'CONTENT',description:'A repeatable story card combining an illustration, title, summary and detail action.',reference:'READINESS WELCOME'},
  {id:'updates',name:'System updates',page:'home',family:'CONTENT',description:'An expandable release feed for changes, dates and supporting detail.',reference:'READINESS WELCOME'},
  {id:'resources',name:'Resource list',page:'home',family:'CONTENT',description:'A compact list of training, help and handbook entries with readable detail views.',reference:'READINESS WELCOME'},
  {id:'case-header',name:'Record header',page:'cases',family:'WORKFLOW',description:'Case identity, editable metadata, status and primary actions in a single record summary.',reference:'CASE DETAIL'},
  {id:'tabs',name:'Section tabs',page:'cases',family:'NAVIGATION',description:'Switch between the overview, maintenance, alerts, related cases and associated parts.',reference:'CASE DETAIL'},
  {id:'workflow',name:'Status stepper',page:'cases',family:'WORKFLOW',description:'Five maintenance stages with clear completed, current and upcoming states.',reference:'CASE STATUS'},
  {id:'actions',name:'Quick action guide',page:'cases',family:'WORKFLOW',description:'Contextual actions advance the case through recommendation, scheduling and verification.',reference:'QUICK ACTION GUIDE'},
  {id:'filters',name:'Filter panel',page:'parts',family:'INPUT',description:'Stock number, failure, platform and risk filters with explicit apply and clear actions.',reference:'SPARE PARTS'},
  {id:'table',name:'Search / data table',page:'parts',family:'DATA',description:'Searchable and sortable inventory rows. Select a stock number to inspect its demand forecast.',reference:'SPARE PARTS'},
  {id:'pagination',name:'Pagination',page:'parts',family:'NAVIGATION',description:'Page size and directional controls keep a large record set manageable.',reference:'SPARE PARTS'},
  {id:'forecast',name:'Inventory forecast',page:'parts',family:'CHART',description:'Actual and forecast inventory, reorder threshold and dated maintenance events on one timeline.',reference:'NSN DETAIL'},
  {id:'chart-legend',name:'Chart legend',page:'parts',family:'CHART',description:'Toggle actual, forecast, threshold and event series to isolate the information you need.',reference:'NSN DETAIL'},
  {id:'metrics',name:'Metric summary',page:'value',family:'DATA',description:'Total, realized and unrealized value paired with avoided maintenance hours.',reference:'VALUE DASHBOARD'},
  {id:'stacked-bars',name:'Stacked comparison',page:'value',family:'CHART',description:'Compare realized and potential impact by platform, switching between value and hours.',reference:'VALUE DASHBOARD'},
  {id:'distribution',name:'Failure distribution',page:'value',family:'CHART',description:'A breakdown of demo failure modes complements the platform-level comparison.',reference:'VALUE DASHBOARD'},
  {id:'insights',name:'Attention summary',page:'logistics',family:'DATA',description:'Expandable critical risk counts route attention to the corresponding alerts.',reference:'LOGISTICS INSIGHTS'},
  {id:'supply-status',name:'Supply risk list',page:'logistics',family:'DATA',description:'Supply classes combine names, descriptions and colored risk indicators.',reference:'LOGISTICS INSIGHTS'},
  {id:'map',name:'Interactive map',page:'logistics',family:'SPATIAL',description:'Pan and zoom a pixel map, select a port or airport and inspect its linked alert.',reference:'LOGISTICS MAP'},
  {id:'map-legend',name:'Map legend',page:'logistics',family:'SPATIAL',description:'Identify airport and seaport markers and their risk states.',reference:'LOGISTICS MAP'},
  {id:'map-toolbar',name:'Layer controls',page:'logistics',family:'INPUT',description:'Toggle services, commands, bases and the map projection; zoom or reset the view.',reference:'LOGISTICS MAP'},
  {id:'alerts',name:'Alert drawer',page:'logistics',family:'WORKFLOW',description:'Search and sort priority cards, inspect targets, and acknowledge a selected alert.',reference:'LOGISTICS ALERTS'},
  {id:'command-search',name:'Command search',page:'logistics',family:'INPUT',description:'A local command bar searches the demo records and moves the map to matching locations.',reference:'LOGISTICS SEARCH'}
];
const KEY='phosphor-ui-pages-v1';
const limits={brightness:[20,200],glow:[0,100],contrast:[50,220],grid:[0,100],refraction:[0,100]};
export function normalizePagesState(input={}){
  const source=input&&typeof input==='object'?input:{};
  const notes={};for(const item of COMPONENTS)if(typeof source.notes?.[item.id]==='string')notes[item.id]=source.notes[item.id].slice(0,4000);
  const optics={};for(const [key,[min,max]]of Object.entries(limits)){const n=source.optics?.[key];if(typeof n==='number'&&Number.isFinite(n))optics[key]=Math.max(min,Math.min(max,Math.round(n)));}
  return {version:1,page:PAGE_IDS.includes(source.page)?source.page:'catalog',selected:COMPONENTS.some(c=>c.id===source.selected)?source.selected:'workflow',mark:['dots','hashes','blocks','lines'].includes(source.mark)?source.mark:'dots',guides:source.guides===true,notes,optics};
}
export function loadPagesState(storage=globalThis.localStorage){try{return normalizePagesState(JSON.parse(storage.getItem(KEY)||'{}'));}catch{return normalizePagesState();}}
export function savePagesState(state,storage=globalThis.localStorage){try{storage.setItem(KEY,JSON.stringify(normalizePagesState(state)));return true;}catch{return false;}}

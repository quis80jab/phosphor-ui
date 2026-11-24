/** Local, deterministic SaaS prototype data. No live telemetry or customer records. */
export const SAAS_STORAGE_KEY = 'phosphor-saas-workspace-v1';
export const SAAS_PAGES = Object.freeze(['overview', 'fleet', 'inspections', 'analytics', 'components', 'workspace']);
export const COMPONENT_IDS = Object.freeze(['line', 'bar', 'donut', 'gauge', 'heatmap', 'sparkline', 'bullet']);
export const SITE_IDS = Object.freeze(['all', 'waterfront', 'shipyard']);
export const RANGE_IDS = Object.freeze(['7d', '30d', '90d']);
export const INSPECTION_STATUSES = Object.freeze(['review', 'approved', 'scheduled']);

const freezeRecords = entries => Object.freeze(entries.map(entry => Object.freeze(entry)));
export const FLEET = freezeRecords([
  {id:'PH-01', name:'Kestrel', site:'waterfront', status:'active', battery:86, signal:98, altitude:42, flightHours:128.4, sensor:'RGB / THERMAL / DEPTH', mission:'Pier 27 facade survey'},
  {id:'PH-02', name:'Tern', site:'waterfront', status:'active', battery:72, signal:95, altitude:28, flightHours:96.2, sensor:'RGB / THERMAL', mission:'Embarcadero deck inspection'},
  {id:'PH-03', name:'Osprey', site:'shipyard', status:'active', battery:64, signal:93, altitude:35, flightHours:164.8, sensor:'RGB / DEPTH', mission:'Drydock structural scan'},
  {id:'PH-04', name:'Merlin', site:'waterfront', status:'ready', battery:100, signal:100, altitude:0, flightHours:82.1, sensor:'RGB / THERMAL / DEPTH', mission:'Available for assignment'},
  {id:'PH-05', name:'Peregrine', site:'shipyard', status:'ready', battery:98, signal:99, altitude:0, flightHours:112.6, sensor:'RGB / THERMAL', mission:'Available for assignment'},
  {id:'PH-06', name:'Swift', site:'waterfront', status:'service', battery:41, signal:0, altitude:0, flightHours:210.3, sensor:'RGB / DEPTH', mission:'Rotor inspection due'},
  {id:'PH-07', name:'Gannet', site:'shipyard', status:'ready', battery:100, signal:99, altitude:0, flightHours:74.5, sensor:'RGB / THERMAL / DEPTH', mission:'Available for assignment'},
  {id:'PH-08', name:'Harrier', site:'waterfront', status:'ready', battery:95, signal:97, altitude:0, flightHours:61.7, sensor:'RGB / THERMAL', mission:'Available for assignment'}
]);
export const INSPECTIONS = freezeRecords([
  {id:'IN-0248', title:'Pier 27 facade survey', asset:'Pier 27 / east facade', site:'waterfront', severity:'high', status:'review', coverage:98, findings:6, date:'2026-11-23', droneId:'PH-01'},
  {id:'IN-0247', title:'Drydock structural scan', asset:'Drydock 2 / steel truss', site:'shipyard', severity:'medium', status:'review', coverage:96, findings:4, date:'2026-11-23', droneId:'PH-03'},
  {id:'IN-0246', title:'Embarcadero deck inspection', asset:'Pier 15 / deck surface', site:'waterfront', severity:'medium', status:'review', coverage:94, findings:3, date:'2026-11-22', droneId:'PH-02'},
  {id:'IN-0245', title:'Crane rail alignment', asset:'Berth 4 / crane rail', site:'shipyard', severity:'high', status:'review', coverage:99, findings:5, date:'2026-11-22', droneId:'PH-05'},
  {id:'IN-0244', title:'Roof thermal sweep', asset:'Ferry terminal / roof', site:'waterfront', severity:'low', status:'approved', coverage:100, findings:1, date:'2026-11-21', droneId:'PH-04'},
  {id:'IN-0243', title:'Seawall condition assessment', asset:'Pier 9 / seawall', site:'waterfront', severity:'low', status:'approved', coverage:97, findings:2, date:'2026-11-21', droneId:'PH-08'},
  {id:'IN-0242', title:'Storage tank exterior', asset:'Tank 6 / external shell', site:'shipyard', severity:'medium', status:'approved', coverage:98, findings:2, date:'2026-11-20', droneId:'PH-07'},
  {id:'IN-0241', title:'Loading bay condition scan', asset:'Berth 2 / loading bay', site:'shipyard', severity:'low', status:'review', coverage:95, findings:1, date:'2026-11-20', droneId:'PH-03'},
  {id:'IN-0250', title:'Pier 35 underside survey', asset:'Pier 35 / underside', site:'waterfront', severity:'medium', status:'scheduled', coverage:0, findings:0, date:'2026-11-24', droneId:'PH-04'},
  {id:'IN-0251', title:'Warehouse roof survey', asset:'Warehouse 3 / roof', site:'shipyard', severity:'low', status:'scheduled', coverage:0, findings:0, date:'2026-11-24', droneId:'PH-07'}
]);
const inspectionIds = new Set(INSPECTIONS.map(item => item.id));
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const own = (object,key) => Object.prototype.hasOwnProperty.call(object,key);
const option = (value,values,fallback) => values.includes(value) ? value : fallback;
const number = (value,fallback,min,max) => typeof value === 'number' && Number.isFinite(value) ? Math.max(min,Math.min(max,Math.round(value))) : fallback;
const note = value => String(value).replace(/\u0000/g,'').slice(0,4000);
const safeString = (value,fallback,limit) => typeof value === 'string' && value.trim() ? value.trim().replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,limit) : fallback;

export function defaultSaasState() {
  return {version:1, page:'overview', range:'30d', site:'all', workspaceName:'Phosphor field ops',
    notifications:true, digest:false, unit:'metric', brightness:100, contrast:110, grid:50, glow:40,
    chartColor:'mint', chartPattern:'dots', selectedComponent:'line', componentNotes:{}, inspectionOverrides:{}};
}

/** Strip unknown keys and bound all values before UI use or persistence. */
export function normalizeSaasState(input = {}) {
  const source = record(input) ? input : {}, defaults = defaultSaasState();
  const componentNotes = {}, inspectionOverrides = {};
  if (record(source.componentNotes)) for (const id of COMPONENT_IDS) {
    if (own(source.componentNotes,id) && typeof source.componentNotes[id] === 'string') componentNotes[id] = note(source.componentNotes[id]);
  }
  if (record(source.inspectionOverrides)) for (const id of inspectionIds) {
    const entry = source.inspectionOverrides[id];
    if (!own(source.inspectionOverrides,id) || !record(entry)) continue;
    const patch = {};
    if (INSPECTION_STATUSES.includes(entry.status)) patch.status = entry.status;
    if (typeof entry.note === 'string') patch.note = note(entry.note);
    if (Object.keys(patch).length) inspectionOverrides[id] = patch;
  }
  return {...defaults,
    page:option(source.page,SAAS_PAGES,defaults.page),
    range:option(source.range,RANGE_IDS,defaults.range), site:option(source.site,SITE_IDS,defaults.site),
    workspaceName:safeString(source.workspaceName,defaults.workspaceName,64),
    notifications:typeof source.notifications === 'boolean' ? source.notifications : defaults.notifications,
    digest:typeof source.digest === 'boolean' ? source.digest : defaults.digest,
    unit:option(source.unit,['metric','imperial'],defaults.unit),
    brightness:number(source.brightness,defaults.brightness,20,200), contrast:number(source.contrast,defaults.contrast,50,220),
    grid:number(source.grid,defaults.grid,0,100), glow:number(source.glow,defaults.glow,0,100),
    chartColor:option(source.chartColor,['mint','blue','amber'],defaults.chartColor),
    chartPattern:option(source.chartPattern,['dots','hash','square'],defaults.chartPattern),
    selectedComponent:option(source.selectedComponent,COMPONENT_IDS,defaults.selectedComponent),
    componentNotes, inspectionOverrides};
}

export function loadSaasState(storage) {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target.getItem(SAAS_STORAGE_KEY);
    if (raw === null || raw === undefined) return {state:defaultSaasState()};
    if (typeof raw !== 'string' || raw.length > 128 * 1024) throw new Error('Workspace data exceeds its size limit.');
    const parsed = JSON.parse(raw);
    if (!record(parsed) || parsed.version !== 1) throw new Error('Workspace data has an unsupported format.');
    return {state:normalizeSaasState(parsed)};
  } catch (cause) {
    return {state:defaultSaasState(), error:'Saved workspace could not be loaded. Original data was left untouched.', cause};
  }
}
export function saveSaasState(state,storage) {
  const normalized = normalizeSaasState(state);
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(SAAS_STORAGE_KEY,JSON.stringify(normalized));
    return {state:normalized};
  } catch (cause) {
    return {state:normalized,error:'Workspace changes could not be saved in this browser.',cause};
  }
}

function matchesQuery(item,query) {
  const words = typeof query === 'string' ? query.trim().toLowerCase().slice(0,500).split(/\s+/).filter(Boolean) : [];
  const haystack = Object.values(item).filter(value => typeof value === 'string').join(' ').toLowerCase();
  return words.every(word => haystack.includes(word));
}
export function filterFleet({query = '', site = 'all', status = 'all'} = {}) {
  return FLEET.filter(item => (site === 'all' || item.site === site)
    && (status === 'all' || item.status === status) && matchesQuery(item,query)).map(item => ({...item}));
}
export function filterInspections(state,{query = '',site = 'all',status = 'all'} = {}) {
  const saved = normalizeSaasState(state);
  return INSPECTIONS.map(item => ({...item,note:'',...saved.inspectionOverrides[item.id]}))
    .filter(item => (site === 'all' || item.site === site)
      && (status === 'all' || item.status === status) && matchesQuery(item,query));
}
/** Updates are local review workflow changes; they never command a real vehicle. */
export function updateInspection(state,id,patch = {}) {
  if (!inspectionIds.has(id)) throw new Error('Choose an existing inspection.');
  if (!record(patch) || Object.keys(patch).some(key => !['status','note'].includes(key))) throw new Error('Inspection updates accept status and note only.');
  if (own(patch,'status') && !INSPECTION_STATUSES.includes(patch.status)) throw new Error('Choose a supported inspection status.');
  if (own(patch,'note') && typeof patch.note !== 'string') throw new Error('An inspection note must be text.');
  const next = normalizeSaasState(state), previous = next.inspectionOverrides[id] || {};
  next.inspectionOverrides[id] = {...previous,...patch};
  return normalizeSaasState(next);
}

const timelines = Object.freeze({
  '7d': {label:'Last 7 days',labels:['MON','TUE','WED','THU','FRI','SAT','SUN'],values:[12,18,15,24,22,17,20],coverage:[90,92,91,95,94,96,98]},
  '30d': {label:'Last 30 days',labels:['OCT 25','OCT 28','OCT 31','NOV 03','NOV 06','NOV 09','NOV 12','NOV 15','NOV 18','NOV 23'],values:[30,37,35,49,42,56,50,61,59,67],coverage:[86,88,87,90,91,93,92,95,96,98]},
  '90d': {label:'Last 90 days',labels:['AUG 31','SEP 07','SEP 14','SEP 21','SEP 28','OCT 05','OCT 12','OCT 19','OCT 26','NOV 02','NOV 09','NOV 16','NOV 23'],values:[45,52,49,67,61,78,74,83,96,91,105,111,124],coverage:[81,83,84,83,86,88,87,91,92,93,95,97,98]}
});
const splitValue = (value,site) => site === 'waterfront' ? Math.round(value * .62) : site === 'shipyard' ? value - Math.round(value * .62) : value;
const sum = values => values.reduce((total,value) => total + value,0);
const round = (value,digits = 0) => Number(value.toFixed(digits));

/** Range/site filters recalculate every related chart from the same deterministic fixture. */
export function getDashboardData({range = '30d',site = 'all',state} = {}) {
  range = option(range,RANGE_IDS,'30d'); site = option(site,SITE_IDS,'all');
  const source = timelines[range], fleet = filterFleet({site}), inspections = filterInspections(state,{site});
  const volume = source.values.map((value,index) => ({label:source.labels[index],value:splitValue(value,site)}));
  const coverageTrend = source.coverage.map((value,index) => ({label:source.labels[index],value:Math.max(0,value + (site === 'waterfront' ? 1 : site === 'shipyard' ? -2 : 0))}));
  const multiplier = range === '7d' ? 1 : range === '90d' ? 5 : 2;
  const defects = [
    {label:'CORROSION',value:splitValue(14 * multiplier,site),color:'#ffc782'},
    {label:'CRACKS',value:splitValue(8 * multiplier,site),color:'#f58e84'},
    {label:'THERMAL',value:splitValue(6 * multiplier,site),color:'#89b9ef'},
    {label:'SURFACE',value:splitValue(4 * multiplier,site),color:'#a9e9df'}
  ];
  const fleetStatus = [
    {label:'ACTIVE',value:fleet.filter(item => item.status === 'active').length,color:'#a9e9df'},
    {label:'READY',value:fleet.filter(item => item.status === 'ready').length,color:'#89b9ef'},
    {label:'SERVICE',value:fleet.filter(item => item.status === 'service').length,color:'#ffc782'}
  ];
  const utilization = fleet.map(item => ({label:item.id,value:round(item.flightHours * (range === '7d' ? .08 : range === '90d' ? .8 : .28),1)}));
  const heatmap = Array.from({length:35},(_,index) => ({label:`DAY ${index + 1}`,value:splitValue((index * 7 + Math.floor(index / 7) * 3) % 23 + 2,site)}));
  const metrics = {
    inspections:sum(volume.map(item => item.value)),
    flightHours:round(sum(utilization.map(item => item.value)),1),
    coverage:round(sum(coverageTrend.map(item => item.value)) / coverageTrend.length,1),
    reviewQueue:inspections.filter(item => item.status === 'review').length,
    activeDrones:fleetStatus[0].value, totalDrones:fleet.length, readyDrones:fleetStatus[1].value, serviceDrones:fleetStatus[2].value,
    uptime:site === 'shipyard' ? 99.2 : site === 'waterfront' ? 99.8 : 99.6,
    findings:sum(defects.map(item => item.value))
  };
  return {demo:true,asOf:'2026-11-23',range,site,rangeLabel:source.label,metrics,volume,coverageTrend,defects,fleetStatus,utilization,heatmap};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { paintGridControl, compassCardinals } from '../dist/viewer-grid-paint.js';
import { pixelText } from '../dist/vfd-glyphs.js';
import { PIXEL_PITCH } from '../dist/viewer-grid.js';

const MINT = '#a9e9df', DIM = '#558c7e';
const element = (dataset = {}, extra = {}) => ({ dataset, textContent:'', getAttribute:() => null, ...extra });
function raster() {
  const pixels = new Map(), stack = []; let path, clip = [-Infinity,-Infinity,Infinity,Infinity];
  return {
    pixels, fillStyle:'#000', globalAlpha:1,
    save() { stack.push({ clip:[...clip], fillStyle:this.fillStyle, globalAlpha:this.globalAlpha }); },
    restore() { Object.assign(this, stack.at(-1)); clip = stack.pop().clip; },
    beginPath() { path = null; },
    rect(x,y,w,h) { path = [x,y,x+w,y+h]; },
    clip() { clip = [Math.max(clip[0],path[0]),Math.max(clip[1],path[1]),Math.min(clip[2],path[2]),Math.min(clip[3],path[3])]; },
    fillRect(x,y,w,h) {
      assert.ok([x,y,w,h].every(Number.isInteger), 'glyphs, frames and paths use integer pixels');
      assert.ok(w >= 0 && h >= 0);
      for (let yy = Math.max(y,clip[1]); yy < Math.min(y+h,clip[3]); yy++) for (let xx = Math.max(x,clip[0]); xx < Math.min(x+w,clip[2]); xx++) pixels.set(`${xx},${yy}`,this.fillStyle);
    }
  };
}
function paint(type, el, options = {}) {
  const ctx = raster(); paintGridControl(ctx,{element:el,type,x:0,y:0,width:144,height:96,...options}); return ctx;
}

test('compass rose rotates world cardinals against clockwise viewing bearing',()=>{
  const north=compassCardinals(0),east=compassCardinals(90),west=compassCardinals(270);
  assert.equal(north[0].x,0);assert.equal(north[0].y,-1);
  assert.ok(Math.abs(east[0].x+1)<1e-12,'north moves left when facing east');
  assert.ok(Math.abs(east[1].y+1)<1e-12,'east is up when facing east');
  assert.ok(Math.abs(west[0].x-1)<1e-12,'north moves right when facing west');
  assert.deepEqual(compassCardinals('invalid'),north);
});

test('compass keeps integer pixel glyphs, follows bearing, highlights orbit and translates without scaling',()=>{
  const control=element({heading:'270',elevation:'28',gesture:'idle'}),options={width:96,height:96};
  const base=paint('compass',control,options),moved=paint('compass',control,{...options,x:24,y:16});
  const shifted=new Map([...moved.pixels].map(([key,value])=>{const[x,y]=key.split(',').map(Number);return[`${x-24},${y-16}`,value];}));
  assert.deepEqual(base.pixels,shifted);
  assert.notDeepEqual(base.pixels,paint('compass',element({heading:'90',elevation:'28',gesture:'idle'}),options).pixels);
  const orbit=paint('compass',element({heading:'270',elevation:'28',gesture:'orbit'}),options);
  assert.ok([...orbit.pixels.values()].includes('#ffc782'));
  assert.equal([...base.pixels.values()].includes('#ffc782'),false);
  for(const key of base.pixels.keys()){const[x,y]=key.split(',').map(Number);assert.ok(x>=0&&x<96&&y>=0&&y<96);}
});

test('histogram paints the real 32-bin distribution and selected overlay at a common scale', () => {
  const bins = Array(32).fill(0), selectedBins = Array(32).fill(0);
  bins[0] = 8; bins[16] = 16; selectedBins[0] = 4;
  const ctx = paint('histogram',element({bins:JSON.stringify(bins),selectedBins:JSON.stringify(selectedBins)}));
  assert.equal(ctx.pixels.get('8,40'),'#06231f');
  assert.equal(ctx.pixels.get('8,41'),DIM);
  assert.equal(ctx.pixels.get('8,56'),DIM);
  assert.equal(ctx.pixels.get('8,57'),MINT);
  assert.equal(ctx.pixels.get('10,73'),MINT);
  assert.equal(ctx.pixels.get('11,73'),'#06231f','one-pixel gaps separate adjacent bars');
  assert.equal(ctx.pixels.get('72,8'),DIM);
  assert.equal(ctx.pixels.get('74,73'),DIM);
  assert.equal(ctx.pixels.get('75,73'),'#06231f');
  assert.equal(ctx.pixels.get('20,75'),DIM,'baseline is separate from data bars');
  assert.equal(ctx.pixels.size,144*96,'histogram backing is opaque');
});

test('histogram handles empty, malformed, negative and excess bins without drawing outside its box', () => {
  const empty = paint('histogram',element({bins:'[]',selectedBins:'[]'}));
  for (const dataset of [{bins:'invalid',selectedBins:'null'},{bins:'{}',selectedBins:'{}'},{bins:JSON.stringify(Array(32).fill(-5)),selectedBins:'[]'}]) assert.deepEqual(paint('histogram',element(dataset)).pixels,empty.pixels);
  const bins = Array(32).fill(2), withExtra = [...bins, 999999];
  assert.deepEqual(paint('histogram',element({bins:JSON.stringify(bins)})).pixels,paint('histogram',element({bins:JSON.stringify(withExtra)})).pixels);
  for (const [width,height] of [[16,16],[40,32],[144,96],[200,120]]) {
    const ctx = paint('histogram',element({bins:JSON.stringify(bins)}),{x:-8,y:24,width,height});
    for (const key of ctx.pixels.keys()) { const [x,y] = key.split(',').map(Number); assert.ok(x >= -8 && x < width-8 && y >= 24 && y < height+24); }
  }
});

test('voxel size and nested timeline ranges use their own values instead of the playback frame', () => {
  const min=.25,max=8,value=1,fraction=(value-min)/(max-min);
  const range=element({}, {type:'range',min:String(min),max:String(max),value:String(value)});
  const ctx=paint('slider',range,{height:24,state:{frame:.9}});
  const expected=paint('slider',element(),{height:24,state:{frame:fraction}});
  assert.deepEqual(ctx.pixels,expected.pixels);
  const timeline=element({}, {querySelector:()=>({min:'0',max:'720',value:'360'})});
  assert.deepEqual(paint('slider',timeline,{height:24,state:{frame:0}}).pixels,paint('slider',element(),{height:24,state:{frame:.5}}).pixels);
});

test('lasso converts pane-local CSS coordinates directly into shared integer display pixels', () => {
  const points=[[8,8],[16,8],[16,16]].map(point=>point.map(value=>value*PIXEL_PITCH));
  const ctx=paint('lasso-overlay',element({points:JSON.stringify(points)}),{x:24,y:40,width:80,height:64});
  for(let x=32;x<=40;x++) assert.equal(ctx.pixels.get(`${x},48`),MINT);
  for(let y=48;y<=56;y++) assert.equal(ctx.pixels.get(`40,${y}`),MINT);
  assert.equal(ctx.pixels.get('30,48'),MINT,'the first point has a two-cell cross');
  assert.equal(ctx.pixels.get('32,46'),MINT);
  const moved=paint('lasso-overlay',element({points:JSON.stringify(points)}),{x:8,y:-8,width:80,height:64});
  const shifted=new Map([...moved.pixels].map(([key,value])=>{const[x,y]=key.split(',').map(Number);return[`${x+16},${y+48}`,value]}));
  assert.deepEqual(shifted,ctx.pixels,'moving the pane translates the path without stretching it');
});

test('lasso clips off-pane points before rasterization and ignores malformed paths', () => {
  for(const points of ['invalid','{}','[[null,0],[0,"x"]]']) assert.equal(paint('lasso-overlay',element({points})).pixels.size,0);
  const points=[[-1e8,16*PIXEL_PITCH],[1e8,16*PIXEL_PITCH]];
  const ctx=paint('lasso-overlay',element({points:JSON.stringify(points)}),{width:80,height:64});
  assert.equal(ctx.pixels.size,80);
  for(let x=0;x<80;x++) assert.equal(ctx.pixels.get(`${x},16`),MINT);
});

test('editing instructions can wrap beyond two rows without changing the bitmap glyphs', () => {
  const value='DRAG LOOP / CLICK + ENTER. THROUGH DEPTH. SHIFT ADD / ALT REMOVE.';
  const ctx=paint('label',element({vfdLines:'6'},{textContent:value}),{width:96,height:64});
  const reference=raster();pixelText(reference,value,0,0,MINT);
  assert.equal([...ctx.pixels.values()].filter(color=>color===MINT).length,reference.pixels.size);
});

test('marker flag paints coordinates and red flag using fixed integer glyphs',()=>{
  const el=element({latitude:'LAT 37.796044 N',longitude:'LON 122.395830 W'});
  const base=paint('marker-flag',el,{width:144,height:44});
  assert.ok([...base.pixels.values()].includes('#ff777b'));
  assert.ok([...base.pixels.values()].includes(MINT));
  const moved=paint('marker-flag',el,{x:8,y:24,width:144,height:44});
  const shifted=new Map([...moved.pixels].map(([key,value])=>{const[x,y]=key.split(',').map(Number);return[`${x-8},${y-24}`,value];}));
  assert.deepEqual(base.pixels,shifted);
  assert.notDeepEqual(base.pixels,paint('marker-flag',element({latitude:'LAT 37.796099 N',longitude:'LON 122.395830 W'}),{width:144,height:44}).pixels);
});

test('marker tether clips to viewport and does not close its path into a polygon',()=>{
  const ctx=paint('marker-tether',element({points:JSON.stringify([[-1e8,16*PIXEL_PITCH],[1e8,16*PIXEL_PITCH]])}),{width:80,height:64});
  assert.equal(ctx.pixels.size,80);
  assert.equal(paint('marker-tether',element({points:'invalid'})).pixels.size,0);
});

import { paintDirectOperateControl } from './direct-operate-paint.js?v=hologram-12';
import { paintDroneControl } from './drone-cluster-paint.js?v=hologram-12';
import { PIXEL_PITCH } from './viewer-grid.js?v=pane-140';
import { pixelText, glyphRect, glyphMark } from './vfd-glyphs.js?v=grid-1';

const MINT = '#a9e9df', DIM = '#558c7e', INK = '#06231f';
const AMBER = '#ffc782', ALERT_BACKING = '#151c0e';
const THERMAL_COLORS = [[40, 67, 138], [54, 189, 162], [228, 208, 94], [231, 130, 64]];
const text = value => String(value ?? '').replace(/\s+/g, ' ').trim()
  .replaceAll('…', '...').replaceAll('×', 'X').replaceAll('·', '.')
  .replaceAll('■', '#').replaceAll('≡', '=').replaceAll('▦', '#');
const activeElement = element => ['aria-pressed', 'aria-selected', 'aria-checked'].some(name => element?.getAttribute?.(name) === 'true') || element?.getAttribute?.('aria-current') === 'page';
const labelText = element => text(element?.dataset?.vfdLabel || element?.textContent).toUpperCase();
const textWidth = value => Math.max(0, [...value].length * 6 - 1);

function fit(value, available) {
  const chars = [...value], count = Math.max(0, Math.floor((available + 1) / 6));
  if (chars.length <= count) return value;
  return count < 4 ? chars.slice(0, count).join('') : chars.slice(0, count - 3).join('') + '...';
}
function lines(value, available, maxLines = 1) {
  const capacity = Math.max(1, Math.floor((available + 1) / 6));
  if (maxLines < 2 || value.length <= capacity) return [fit(value, available)];
  const result = [], words = value.split(' '); let current = '';
  while (words.length) {
    const word = words.shift(), joined = current ? `${current} ${word}` : word;
    if (joined.length <= capacity) { current = joined; continue; }
    if (current) { result.push(current); current = word; }
    else { result.push(fit(word, available)); current = ''; }
    if (result.length === maxLines - 1) {
      result.push(fit([current, ...words].filter(Boolean).join(' '), available));
      return result;
    }
  }
  if (current) result.push(fit(current, available));
  return result.length ? result : [''];
}
function alertLines(value, available) {
  const capacity = Math.max(1, Math.floor((available + 1) / 6)), rows = [];
  for (const paragraph of String(value ?? '').replaceAll('\r\n', '\n').split('\n')) {
    let row = '';
    for (const word of paragraph.trim().split(/\s+/).filter(Boolean)) {
      let chars = [...word];
      if (row && [...row].length + 1 + chars.length <= capacity) { row += ` ${word}`; continue; }
      if (row) { rows.push(row); row = ''; }
      while (chars.length > capacity) { rows.push(chars.slice(0, capacity).join('')); chars = chars.slice(capacity); }
      row = chars.join('');
    }
    rows.push(row);
  }
  return rows;
}
function centered(ctx, value, x, y, width, height, color, maxLines = 1) {
  const rows = lines(value, Math.max(0, width), maxLines), start = y + Math.floor((height - (rows.length * 10 - 3)) / 2);
  rows.forEach((row, index) => pixelText(ctx, row, x + Math.floor((width - textWidth(row)) / 2), start + index * 10, color));
}
function frame(ctx, x, y, width, height, { active = false, focused = false, color = MINT } = {}) {
  if (active && width > 8 && height > 8) {
    ctx.fillStyle = color; ctx.fillRect(x + 4, y + 4, width - 8, height - 8);
  }
  glyphRect(ctx, x, y, width, height, focused || active ? color : DIM);
  if (width >= 9 && height >= 9) glyphRect(ctx, x + 3, y + 3, width - 6, height - 6, active ? color : DIM);
  if (focused && width >= 13 && height >= 13) {
    ctx.fillStyle = active ? INK : color;
    ctx.fillRect(x + 5, y + 5, 2, 1); ctx.fillRect(x + width - 7, y + height - 6, 2, 1);
  }
}
function triangle(ctx, x, y, direction, radius = 5) {
  for (let row = 0; row <= radius * 2; row++) {
    const length = radius + 1 - Math.abs(row - radius);
    ctx.fillRect(direction > 0 ? x : x + radius + 1 - length, y + row, length, 1);
  }
}
function transport(ctx, element, x, y, width, height, focused, held, playing) {
  const id = element?.id || '', isPlay = id === 'play-pause' || id === 'play';
  const active = isPlay ? !!playing || held : activeElement(element) || held;
  frame(ctx, x, y, width, height, { active, focused });
  const cx = x + Math.floor(width / 2), cy = y + Math.floor(height / 2), color = active ? INK : MINT;
  ctx.fillStyle = color;
  if (id === 'stop-playback' || id === 'stop') {
    glyphRect(ctx, cx - 5, cy - 5, 10, 10, color);
    glyphRect(ctx, cx - 3, cy - 3, 6, 6, color);
  } else if (isPlay) {
    if (playing) { ctx.fillRect(cx - 4, cy - 5, 3, 11); ctx.fillRect(cx + 2, cy - 5, 3, 11); }
    else triangle(ctx, cx - 3, cy - 6, 1, 6);
  } else if (id === 'step-back' || id === 'previous') {
    triangle(ctx, cx - 7, cy - 5, -1); triangle(ctx, cx, cy - 5, -1);
  } else if (id === 'step-forward' || id === 'next') {
    triangle(ctx, cx - 6, cy - 5, 1); triangle(ctx, cx + 1, cy - 5, 1);
  }
}
function search(ctx, element, x, y, width, height, focused) {
  frame(ctx, x, y, width, height, { focused });
  const baseline = y + Math.floor((height - 7) / 2), left = x + 20, right = x + width - 10;
  pixelText(ctx, '>', x + 8, baseline, MINT);
  if (right <= left) return;
  const value = String(element?.value || element?.placeholder || ''), chars = [...value];
  const selectedStart = [...value.slice(0, element?.selectionStart ?? 0)].length;
  const selectedEnd = [...value.slice(0, element?.selectionEnd ?? 0)].length;
  // The native input uses 12 CSS-pixel glyph advances and a 40 CSS-pixel inset.
  // Its own scroll position keeps pointer selection and keyboard editing aligned.
  const scroll = focused ? Math.max(0, Math.round((Number(element?.scrollLeft) || 0) / PIXEL_PITCH)) : 0;
  const offset = Math.floor(scroll / 6), shift = scroll % 6;
  const origin = left - shift, capacity = Math.ceil((right - left + shift) / 6) + 1;
  ctx.save(); ctx.beginPath(); ctx.rect(left, y + 4, right - left, Math.max(0, height - 8)); ctx.clip();
  const selectionLeft = Math.max(offset, selectedStart), selectionRight = Math.min(offset + capacity, selectedEnd);
  if (focused && element?.value && selectionRight > selectionLeft) {
    ctx.fillStyle = MINT;
    ctx.fillRect(origin + (selectionLeft - offset) * 6, baseline - 1, (selectionRight - selectionLeft) * 6, 9);
  }
  pixelText(ctx, chars.slice(offset, offset + capacity).join(''), origin, baseline, element?.value ? MINT : DIM);
  if (focused && element?.value && selectionRight > selectionLeft) {
    pixelText(ctx, chars.slice(selectionLeft, selectionRight).join(''), origin + (selectionLeft - offset) * 6, baseline, INK);
  }
  if (focused && selectedStart === selectedEnd) {
    ctx.fillStyle = MINT; ctx.fillRect(left + selectedStart * 6 - scroll, baseline - 1, 1, 9);
  }
  ctx.restore();
}
function visibleLabel(element) {
  if (element?.dataset?.vfdLabel) return text(element.dataset.vfdLabel);
  if (!element?.childNodes) return text(element?.textContent);
  return text([...element.childNodes].map(node => {
    if (node.nodeType === 3) return node.textContent;
    if (node.nodeType !== 1 || node.hidden) return '';
    if (typeof getComputedStyle === 'function' && getComputedStyle(node).display === 'none') return '';
    return node.textContent;
  }).join(' '));
}

function numericArray(value, limit) {
  try {
    const array = JSON.parse(value || '[]');
    return Array.isArray(array) ? array.slice(0, limit) : [];
  } catch { return []; }
}
function histogram(ctx, element, x, y, width, height) {
  const normalize = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;
  const source = numericArray(element?.dataset?.bins, 32), chosen = numericArray(element?.dataset?.selectedBins, 32);
  const bins = Array.from({ length:32 }, (_, i) => normalize(source[i]));
  const selected = Array.from({ length:32 }, (_, i) => normalize(chosen[i]));
  ctx.fillStyle = INK; ctx.fillRect(x, y, width, height);
  glyphRect(ctx, x, y, width, height, DIM, { double:true });
  const left = x + 8, top = y + 8, plotWidth = Math.max(0, width - 16), plotHeight = Math.max(0, height - 30);
  if (!plotWidth || !plotHeight) return;
  const peak = Math.max(1, ...bins, ...selected), baseline = top + plotHeight;
  for (let i = 0; i < 32; i++) {
    const from = left + Math.floor(i * plotWidth / 32), until = left + Math.floor((i + 1) * plotWidth / 32);
    const barWidth = Math.max(0, until - from - (plotWidth >= 64 ? 1 : 0));
    for (const [amount, color] of [[bins[i], DIM], [selected[i], MINT]]) {
      const barHeight = amount > 0 ? Math.max(1, Math.round(amount / peak * plotHeight)) : 0;
      if (barWidth && barHeight) { ctx.fillStyle = color; ctx.fillRect(from, baseline - barHeight, barWidth, barHeight); }
    }
  }
  ctx.fillStyle = DIM; ctx.fillRect(left, baseline + 1, plotWidth, 1);
  for (let i = 0; i <= 4; i++) ctx.fillRect(left + Math.min(plotWidth - 1, Math.floor(i * plotWidth / 4)), baseline + 2, 1, 3);
  pixelText(ctx, '0', left, y + height - 14, DIM);
  pixelText(ctx, '255', left + Math.max(0, plotWidth - 17), y + height - 14, DIM);
  if (!bins.some(Boolean) && !selected.some(Boolean)) centered(ctx, 'NO POINTS', left, top, plotWidth, plotHeight, DIM);
}
function rasterLine(ctx, x0, y0, x1, y1, bounds, dotted = false) {
  const minX = bounds.x, minY = bounds.y, maxX = bounds.x + bounds.width - 1, maxY = bounds.y + bounds.height - 1;
  const code = (x, y) => (x < minX ? 1 : x > maxX ? 2 : 0) | (y < minY ? 4 : y > maxY ? 8 : 0);
  // Clip before walking so off-pane pointer positions never cause an unbounded loop.
  for (let attempts = 0; attempts < 8; attempts++) {
    const first = code(x0,y0), last = code(x1,y1);
    if (!(first | last)) break;
    if (first & last) return;
    const outside = first || last; let xx, yy;
    if (outside & 8) { yy = maxY; xx = x0 + (x1 - x0) * (maxY - y0) / (y1 - y0); }
    else if (outside & 4) { yy = minY; xx = x0 + (x1 - x0) * (minY - y0) / (y1 - y0); }
    else if (outside & 2) { xx = maxX; yy = y0 + (y1 - y0) * (maxX - x0) / (x1 - x0); }
    else { xx = minX; yy = y0 + (y1 - y0) * (minX - x0) / (x1 - x0); }
    if (outside === first) { x0 = xx; y0 = yy; } else { x1 = xx; y1 = yy; }
  }
  if (![x0,y0,x1,y1].every(Number.isFinite)) return;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1-x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1-y0), sy = y0 < y1 ? 1 : -1;
  let error = dx + dy, step = 0;
  for (;;) {
    if (!dotted || step % 4 < 2) ctx.fillRect(x0,y0,1,1);
    if (x0 === x1 && y0 === y1) break;
    const twice = error * 2; if (twice >= dy) { error += dy; x0 += sx; } if (twice <= dx) { error += dx; y0 += sy; } step++;
  }
}
function lasso(ctx, element, x, y, width, height) {
  const points = numericArray(element?.dataset?.points, 8192)
    .filter(point => Array.isArray(point) && point.length >= 2 && point.slice(0,2).every(Number.isFinite))
    .map(point => [x + Math.round(point[0] / PIXEL_PITCH), y + Math.round(point[1] / PIXEL_PITCH)]);
  if (!points.length) return;
  const bounds = { x,y,width,height }; ctx.fillStyle = MINT;
  for (let i = 1; i < points.length; i++) rasterLine(ctx, ...points[i-1], ...points[i], bounds);
  if (points.length > 2) rasterLine(ctx, ...points.at(-1), ...points[0], bounds, true);
  const [firstX,firstY] = points[0];
  rasterLine(ctx, firstX-2, firstY, firstX+2, firstY, bounds);
  rasterLine(ctx, firstX, firstY-2, firstX, firstY+2, bounds);
}

/** Viewing bearing is clockwise from map north (-Z), not camera azimuth. */
export function compassCardinals(heading = 0) {
  const bearing = Number.isFinite(Number(heading)) ? Number(heading) : 0;
  return ['N','E','S','W'].map((label, index) => {
    const angle = (index * 90 - bearing) * Math.PI / 180;
    return { label, x:Math.sin(angle), y:-Math.cos(angle) };
  });
}
function compass(ctx, element, x, y, width, height) {
  const raw = Number(element?.dataset?.heading), heading = Number.isFinite(raw) ? ((raw % 360) + 360) % 360 : 0;
  const rawElevation = Number(element?.dataset?.elevation), elevation = Number.isFinite(rawElevation) ? Math.max(-90,Math.min(90,rawElevation)) : 0;
  const gesture = element?.dataset?.gesture, accent = gesture === 'orbit' ? AMBER : MINT;
  const bounds = {x,y,width,height}, cx = x + Math.floor(width/2), cy = y + Math.floor(height/2) - 4;
  const radius = Math.max(2, Math.min(Math.floor(width/2)-17, Math.floor(height/2)-31));
  ctx.fillStyle = INK; ctx.fillRect(x,y,width,height);
  glyphRect(ctx,x,y,width,height,gesture === 'orbit' ? AMBER : DIM);
  centered(ctx,gesture === 'orbit' ? 'ORBIT' : gesture === 'pan' ? 'PAN MAP' : 'COMPASS',x+4,y+4,width-8,9,accent);
  ctx.fillStyle = DIM;
  for(let angle=0;angle<360;angle+=3) {
    const a=angle*Math.PI/180;
    ctx.fillRect(cx+Math.round(Math.sin(a)*radius),cy-Math.round(Math.cos(a)*radius),1,1);
  }
  for(const cardinal of compassCardinals(heading)) {
    ctx.fillStyle = cardinal.label === 'N' ? accent : DIM;
    rasterLine(ctx,cx+cardinal.x*(radius-4),cy+cardinal.y*(radius-4),cx+cardinal.x*radius,cy+cardinal.y*radius,bounds);
    pixelText(ctx,cardinal.label,cx+Math.round(cardinal.x*(radius+8))-2,cy+Math.round(cardinal.y*(radius+8))-3,cardinal.label === 'N' ? accent : MINT);
  }
  ctx.fillStyle=accent;
  rasterLine(ctx,cx,cy-7,cx,cy+4,bounds);
  rasterLine(ctx,cx,cy-7,cx-3,cy-3,bounds);
  rasterLine(ctx,cx,cy-7,cx+3,cy-3,bounds);
  centered(ctx,`HDG ${String(Math.round(heading)%360).padStart(3,'0')}`,x+4,y+height-21,width-8,7,accent);
  centered(ctx,`EL ${Math.round(elevation)}`,x+4,y+height-11,width-8,7,DIM);
}

/** Draw directly onto the shared integer grid. One logical cell is two CSS pixels. */
export function paintGridControl(ctx, {
  element, type = 'label', x = 0, y = 0, width = 0, height = 0,
  focused = false, held = false, playing = false, state = {}
} = {}) {
  if (!ctx || ![x, y, width, height].every(Number.isFinite)) return;
  x = Math.round(x); y = Math.round(y); width = Math.round(width); height = Math.round(height);
  if (width < 1 || height < 1) return;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, width, height); ctx.clip();
  if (element?.disabled || element?.getAttribute?.('aria-disabled') === 'true') ctx.globalAlpha *= .4;
  const active = activeElement(element) || !!held, color = element?.dataset?.vfdTone === 'dim' ? DIM : MINT;
  if (paintDirectOperateControl(ctx,{element,type,x,y,width,height,focused,held,playing,state})) {
    // Direct-flight controls use the same physical grid and optical pass.
  } else if (type === 'drone-header') {
    ctx.fillStyle = '#061713';ctx.fillRect(x,y,width,height);
    ctx.fillStyle = DIM;ctx.fillRect(x,y+height-1,width,1);
  } else if (type === 'drone-panel') {
    ctx.fillStyle = '#061713';ctx.fillRect(x,y,width,height);
    glyphRect(ctx,x,y,width,height,MINT,{double:true});
  } else if (paintDroneControl(ctx,{element,type,x,y,width,height,focused,held,playing,state})) {
    // Gauge artwork is rasterized directly into this same framebuffer.
  } else if (type === 'marker-tether') {
    const points = numericArray(element?.dataset?.points, 2);
    if (points.length === 2 && points.every(point => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
      ctx.fillStyle = '#b95760';
      const endpoints = points.map(point => [x+Math.round(point[0]/PIXEL_PITCH),y+Math.round(point[1]/PIXEL_PITCH)]);
      rasterLine(ctx,...endpoints[0],...endpoints[1],{x,y,width,height});
    }
  } else if (type === 'marker-panel') {
    ctx.fillStyle = '#061713';ctx.fillRect(x,y,width,height);
    glyphRect(ctx,x,y,width,height,'#b95760');
  } else if (type === 'marker-flag') {
    const red = '#ff777b';
    ctx.fillStyle = red;ctx.fillRect(x+7,y+6,1,11);
    ctx.fillRect(x+8,y+6,8,5);ctx.fillRect(x+14,y+8,4,5);
    pixelText(ctx,'DEMO TRACK',x+23,y+7,red);
    pixelText(ctx,fit(element?.dataset?.latitude || 'LAT --',width-14),x+7,y+22,MINT);
    pixelText(ctx,fit(element?.dataset?.longitude || 'LON --',width-14),x+7,y+32,MINT);
    if(focused)glyphRect(ctx,x+2,y+2,width-4,height-4,red);
  } else if (type === 'compass') {
    compass(ctx, element, x, y, width, height);
  } else if (type === 'histogram') {
    histogram(ctx, element, x, y, width, height);
  } else if (type === 'lasso-overlay') {
    lasso(ctx, element, x, y, width, height);
  } else if (type === 'alert') {
    // This opaque raster overlay must remain readable over the composited scene.
    ctx.fillStyle = ALERT_BACKING; ctx.fillRect(x, y, width, height);
    glyphRect(ctx, x, y, width, height, AMBER, { double: true });
    const rows = alertLines(String(element?.textContent ?? '').toUpperCase(), width - 16);
    rows.forEach((row, index) => pixelText(ctx, row, x + 8, y + 8 + index * 10, AMBER));
  } else if (type === 'thermal-ramp') {
    // Each bar occupies one display pixel, using the same palette as the DOM fallback.
    for (let column = 0; column < width; column++) {
      const position = column / Math.max(1, width - 1) * (THERMAL_COLORS.length - 1);
      const index = Math.min(THERMAL_COLORS.length - 2, Math.floor(position)), mix = position - index;
      const color = THERMAL_COLORS[index].map((channel, axis) => Math.round(channel + (THERMAL_COLORS[index + 1][axis] - channel) * mix));
      ctx.fillStyle = `rgb(${color.join(',')})`; ctx.fillRect(x + column, y, 1, height);
    }
  } else if (type === 'panel') {
    if (element?.dataset?.vfdOpaque === 'true') { ctx.fillStyle = INK; ctx.fillRect(x,y,width,height); }
    glyphRect(ctx, x, y, width, height, color, { double: true });
  } else if (type === 'transport-key') {
    transport(ctx, element, x, y, width, height, focused, held, playing);
  } else if (type === 'button') {
    frame(ctx, x, y, width, height, { active, focused });
    centered(ctx, labelText(element), x + 5, y + 4, width - 10, height - 8, active ? INK : MINT, height >= 29 ? 2 : 1);
  } else if (type === 'capture') {
    frame(ctx, x, y, width, height, { focused });
    const name = text(element?.querySelector?.('.capture-name')?.textContent).toUpperCase();
    const top = y + Math.max(5, Math.floor((height - 17) / 2));
    pixelText(ctx, fit(name, width - 16), x + 8, top, MINT);
    pixelText(ctx, fit(element?.dataset?.captureUnavailable === 'true' ? 'NOT BUNDLED' : active ? 'SELECTED' : 'OPEN', width - 16), x + 8, top + 10, active ? MINT : DIM);
  } else if (type === 'search') {
    search(ctx, element, x, y, width, height, focused);
  } else if (type === 'select') {
    frame(ctx, x, y, width, height, { focused });
    const value = text(element?.selectedOptions?.[0]?.textContent || element?.value).toUpperCase();
    const top = y + Math.floor((height - 7) / 2);
    pixelText(ctx, fit(value, width - 29), x + 8, top, MINT);
    ctx.fillStyle = MINT;
    for (let row = 0; row < 4; row++) ctx.fillRect(x + width - 16 + row, top + 2 + row, 7 - row * 2, 1);
  } else if (type === 'slider') {
    const range = element?.type === 'range' ? element : element?.querySelector?.('input[type="range"]');
    const min = Number(range?.min || 0), max = Number(range?.max || 100), value = Number(range?.value ?? 0);
    const progress = Math.max(0, Math.min(1, range ? (value-min) / (max-min || 1) : Number(state?.frame) || 0)), cy = y + Math.floor(height / 2);
    const trackHeight = Math.min(13, height), trackY = cy - Math.floor(trackHeight / 2), travel = Math.max(0, width - 12);
    glyphRect(ctx, x + 1, trackY, Math.max(1, width - 2), trackHeight, DIM, { double: trackHeight >= 11 });
    const point = x + 6 + Math.round(progress * travel);
    for (let xx = x + 5; xx + 5 <= x + width - 5; xx += 8) glyphMark(ctx, xx, cy - 2, 'hashes', xx <= point ? MINT : DIM, 5);
    const thumbX = Math.max(x + 1, Math.min(x + width - 7, point - 3)), thumbHeight = Math.min(19, height);
    ctx.fillStyle = INK; ctx.fillRect(thumbX, cy - Math.floor(thumbHeight / 2), 7, thumbHeight);
    glyphRect(ctx, thumbX, cy - Math.floor(thumbHeight / 2), 7, thumbHeight, MINT);
    if (focused || held) { ctx.fillStyle = MINT; ctx.fillRect(thumbX + 3, cy - Math.floor(thumbHeight / 2) + 3, 1, Math.max(1, thumbHeight - 6)); }
  } else {
    const align = element?.dataset?.vfdAlign || 'left', value = visibleLabel(element).toUpperCase();
    if (element?.id === 'viewer-title') {
      const title = text(element.dataset?.vfdLabel || [...(element.childNodes || [])]
        .filter(node => node.nodeType === 3 || node.nodeType === 1 && node.id !== 'capture-code')
        .map(node => node.textContent).join('')).toUpperCase();
      centered(ctx, title, x, y, width, height, color);
    } else {
      const requestedLines = Math.max(1, Math.min(12, Number(element?.dataset?.vfdLines) || 2));
      const rowLimit = height >= 20 ? Math.min(requestedLines, Math.floor((height + 3) / 10)) : 1;
      const rows = type === 'time' ? [fit(value, width)] : element?.dataset?.vfdMultiline === 'true'
        ? alertLines(String(element.dataset.vfdLabel || element.textContent || '').toUpperCase(), width).slice(0,rowLimit)
        : lines(value, width, rowLimit);
      const top = y + Math.floor((height - (rows.length * 10 - 3)) / 2);
      rows.forEach((row, index) => {
        const left = align === 'center' ? x + Math.floor((width - textWidth(row)) / 2) : align === 'right' ? x + width - textWidth(row) : x;
        pixelText(ctx, row, left, top + index * 10, color);
      });
    }
    if (focused) glyphRect(ctx, x, y, width, height, MINT);
  }
  ctx.restore();
}

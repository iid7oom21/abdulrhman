// All measurements and assignments in these training exercises belong to the activities.
export const projectionTasks = [
  { id: 'subs', ar: 'فحص الترجمة', en: 'Subtitle check', minutes: 4, screen: true },
  { id: 'mix', ar: 'فحص الصوت', en: 'Sound check', minutes: 3, screen: true },
  { id: 'prep', ar: 'تجهيز قائمة العرض', en: 'Prepare playlist', minutes: 6, screen: false, extended: true },
  { id: 'rehearsal', ar: 'البروفة النهائية', en: 'Final rehearsal', minutes: 2, screen: true, extended: true, final: true }
];

export function tasksForShift(extended) {
  return projectionTasks.filter(task => extended || !task.extended);
}

export function scheduleShift(requests, parallel) {
  const tasks = tasksForShift(parallel).map((task, index) => {
    const pick = requests[task.id] || {};
    return { ...task, index, requested: clampInt(pick.start, 0, 15, 0), tech: pick.tech === 1 ? 1 : 0 };
  }).sort((a, b) => Number(!!a.final) - Number(!!b.final) || a.requested - b.requested || a.index - b.index);
  const scheduled = [];
  for (const task of tasks) {
    let start = task.requested;
    const conflicts = new Set();
    if (task.final) {
      const ready = Math.max(...scheduled.map(other => other.end));
      if (ready > start) {start = ready; conflicts.add('checks');}
    }
    for (;;) {
      const clash = scheduled.find(other => other.start < start + task.minutes && start < other.end
        && (task.tech === other.tech || (task.screen && other.screen)));
      if (!clash) break;
      if (task.tech === clash.tech) conflicts.add('tech');
      if (task.screen && clash.screen) conflicts.add('screen');
      start = clash.end;
    }
    scheduled.push({ ...task, start, end: start + task.minutes, conflicts: [...conflicts] });
  }
  const end = Math.max(...scheduled.map(task => task.end));
  return { scheduled, end, opens: Math.max(6, end), delay: Math.max(0, end - 6) };
}
export function clampInt(value, min, max, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback;
}
export const lightDefault = {angle: -28, spread: 57, exposure: 1};
export function validatedLight(value) {
  return {
    angle: clampInt(value?.angle, -100, 100, lightDefault.angle),
    spread: clampInt(value?.spread, 0, 100, lightDefault.spread),
    exposure: clampInt(value?.exposure, -60, 60, lightDefault.exposure)
  };
}
export function pixelMetrics(image) {
  let low = 0, high = 0, gradient = 0, pairs = 0;
  const data = image.data, pixels = data.length / 4;
  for (let i = 0; i < pixels; i++) {
    const pos = i * 4;
    const luminance = .2126*data[pos] + .7152*data[pos+1] + .0722*data[pos+2];
    if (luminance <= 20) low++;
    if (luminance >= 240) high++;
    if (i % image.width > 0) {
      const previous = .2126*data[pos-4] + .7152*data[pos-3] + .0722*data[pos-2];
      gradient += Math.abs(luminance - previous);
      pairs++;
    }
  }
  return {low: 100*low/pixels, high: 100*high/pixels, texture: pairs ? gradient/pairs : 0};
}
const surfaceCache = new Map();
function surface(width, height) {
  const id = width + '/' + height;
  if (surfaceCache.has(id)) return surfaceCache.get(id);
  const n = width * height;
  const sx = new Float32Array(n), sy = new Float32Array(n);
  const grain = new Float32Array(n), ridges = new Float32Array(n);
  let seed = 1938057;
  for (let i = 0; i < n; i++) {
    const x = (i%width + .5) / width, y = (Math.floor(i/width) + .5) / height;
    // Rotate into the paper's fixed reference frame, keeping the camera still for both exposures.
    sx[i] = (x-.50)*.992 + (y-.51)*.065;
    sy[i] = (y-.51)*.992 - (x-.50)*.206;
    seed = (Math.imul(seed,1664525) + 1013904223) >>> 0;
    grain[i] = seed / 4294967296 - .5;
    const ring = Math.sqrt(((sx[i]-.038)*1.6)**2 + (sy[i]+.014)**2);
    ridges[i] = Math.sin((sx[i]*140 + Math.sin(sy[i]*27)*.18)*Math.PI)
      + (ring < .205 ? .9 * Math.sin(ring*157) : 0);
  }
  const result = {sx,sy,grain,ridges};
  if (surfaceCache.size > 3) surfaceCache.clear();
  surfaceCache.set(id,result);
  return result;
}
export function drawLight(canvas, rawSettings) {
  const ctx = canvas.getContext('2d', {willReadFrequently:true});
  if (!ctx) throw new Error('canvas unavailable');
  const {angle,spread,exposure} = validatedLight(rawSettings);
  const width=canvas.width, height=canvas.height;
  const {sx,sy,grain,ridges} = surface(width,height);
  const pixels = ctx.createImageData(width,height);
  const intensity = 2 ** (exposure/58), side = angle/100, soft = spread/100;
  const shift = -.059*side;
  const penumbra = .004 + soft*.065;
  const gain = (.8 + Math.abs(side)*2.85)*(1.22-soft*.85);
  for (let i=0; i<sx.length; i++) {
    const x=sx[i], y=sy[i], noise=grain[i];
    const onPaper=Math.abs(x) < .316 && Math.abs(y) < .305;
    let r,g,b;
    if (onPaper) {
      const falloff = side*x*142 + (y+.24)*10;
      const glow = 27*Math.max(0, 1 - ((x-side*.19)**2*6 + (y+.22)**2*2.5));
      const value = 151 + falloff + glow + (noise*14 + ridges[i]*3.6)*gain;
      r=(value+15)*intensity; g=value*intensity; b=(value-21)*intensity;
    } else {
      const distance = Math.max(Math.abs(x-shift)-.316, Math.abs(y-.035)-.305);
      const shadow = Math.max(0, Math.min(1, .5-distance/penumbra));
      const value = (35 - x*10 - y*8 + noise*7)*(1-.65*shadow);
      r=(value+8)*intensity;g=(value+6)*intensity;b=(value+4)*intensity;
    }
    const p=i*4;
    pixels.data[p]=r;pixels.data[p+1]=g;pixels.data[p+2]=b;pixels.data[p+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  // The displayed outlined patch and these pixel coordinates use the same normalized geometry.
  const rect = [Math.round(width*.39), Math.round(height*.39), Math.round(width*.22), Math.round(height*.22)];
  return pixelMetrics(ctx.getImageData(...rect));
}
export const foley = [
  {id:'paper', ar:'تقليب الورقة', en:'Paper turn', target:2, duration:.36},
  {id:'chair', ar:'جرّ الكرسي', en:'Chair scrape', target:3.7, duration:.6},
  {id:'key', ar:'نقرة المفتاح', en:'Key click', target:5, duration:.22}
];
export function cueResult(actual,target) {
  const ms = Math.round(actual*1000) - Math.round(target*1000);
  return { delta:ms/1000, matched:Math.abs(ms)<=250 };
}
export const shipments = [
  {id:'programme', ar:'برنامج الافتتاح', en:'Opening programme', request:['PDF',2,'AR'], item:['PDF',null,'AR']},
  {id:'subtitles', ar:'ملف الترجمة', en:'Subtitle file', request:['SRT',3,'EN'], item:['SRT',2,'EN']},
  {id:'notes', ar:'ملاحظات المذيع', en:'Host notes', request:['PDF',1,'AR'], item:['PDF',1,'AR']},
  {id:'credits', ar:'شريحة الختام', en:'Closing slide', request:['PNG',4,'EN'], item:['PNG',4,'AR']}
];
export function inspectShipment(request, item) {
  const mismatches=[], absent=[];
  request.forEach((v,i) => {
    if (item[i] == null) absent.push(i);
    else if (v !== item[i]) mismatches.push(i);
  });
  if (mismatches.length) return {decision:'replace', fields:mismatches};
  if (absent.length) return {decision:'missing', fields:absent};
  return {decision:'approve', fields:[0,1,2]};
}

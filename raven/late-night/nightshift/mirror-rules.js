// Top-down harbour plan. One coordinate unit is the same horizontal and vertical distance.
export const FIELD = { width:100, height:80 };
export const PERIOD = 4;
const EPSILON = 1e-8;

function mirror(id,x,y) { return {id,at:[x,y]}; }
function source(id,x,y,dx,dy) { return {id,at:[x,y],dir:[dx,dy],target:id}; }
function pane(id,x1,y1,x2,y2) { return {id,a:[x1,y1],b:[x2,y2]}; }

export const STAGES = [
  {
    id:'arcade', title:['أروقة الرصيف','The quay arcade'],
    sources:[source('pier',5,60,1,0),source('hall',70,74,0,-1)],
    mirrors:[mirror('A',26,60),mirror('B',26,22),mirror('C',70,45)],
    windows:[pane('pier',96,18,96,26),pane('hall',96,41,96,49)],
    shutter:{start:[54,22],end:[54,40],half:[0,5]}, initial:[1,0,0]
  },
  {
    id:'gallery', title:['ممرّ العرض','The projection gallery'],
    sources:[source('pier',13,5,0,1),source('hall',96,66,-1,0)],
    mirrors:[mirror('A',13,40),mirror('B',75,40),mirror('C',44,66)],
    windows:[pane('pier',71,4,79,4),pane('hall',40,77,48,77)],
    shutter:{start:[55,32],end:[55,48],half:[0,4]}, initial:[0,1,1]
  },
  {
    id:'crossing', title:['فوق ممرّ العبّارة','Over the ferry crossing'],
    sources:[source('pier',12,5,0,1),source('hall',95,53,-1,0)],
    mirrors:[mirror('A',12,24),mirror('B',80,24),mirror('C',45,53)],
    windows:[pane('pier',76,76,84,76),pane('hall',41,4,49,4)],
    shutter:{start:[45,36],end:[80,36],half:[5,0]}, initial:[0,1,0]
  }
];

export function mirrorSegment(mirror, orientation) {
  if (orientation !== 0 && orientation !== 1) throw new RangeError('Unknown mirror orientation');
  const [x,y] = mirror.at;
  const rise = orientation === 0 ? -4 : 4;
  return {a:[x-4,y-rise],b:[x+4,y+rise]};
}

// A carriage travels to the other end of its rail in two seconds, then returns.
// Light crosses the small set instantly: freeze the carriage at the exact moment of release.
export function shutterSegment(stage,time) {
  if (!Number.isFinite(time)) throw new RangeError('Invalid release time');
  const {start,end,half} = stage.shutter;
  const phase = ((time % PERIOD) + PERIOD) % PERIOD / PERIOD;
  const fraction = 1 - Math.abs(2 * phase - 1);
  const x = start[0] + fraction * (end[0]-start[0]);
  const y = start[1] + fraction * (end[1]-start[1]);
  return {a:[x-half[0],y-half[1]],b:[x+half[0],y+half[1]]};
}

const borders = [
  pane('north',0,0,FIELD.width,0), pane('east',FIELD.width,0,FIELD.width,FIELD.height),
  pane('south',0,FIELD.height,FIELD.width,FIELD.height), pane('west',0,0,0,FIELD.height)
].map(edge => ({...edge,kind:'edge'}));

function cross([x,y],[u,v]) { return x*v-y*u; }
function subtract(a,b) { return [a[0]-b[0],a[1]-b[1]]; }

// Solve origin + t * ray = a + u * (b - a), keeping only the finite segment
// in front of the beam. Strictly positive t avoids hitting the mirror just left.
function intersect(origin,ray,{a,b}) {
  const tangent = subtract(b,a);
  const offset = subtract(a,origin);
  const divisor = cross(ray,tangent);
  if (Math.abs(divisor) < EPSILON) {
    if (Math.abs(cross(offset,ray)) >= EPSILON) return null;
    // A beam running along a closed shutter still meets its leading edge.
    const component = Math.abs(ray[0]) >= Math.abs(ray[1]) ? 0 : 1;
    const ta = (a[component]-origin[component])/ray[component];
    const tb = (b[component]-origin[component])/ray[component];
    const near = Math.min(ta,tb);
    if (near > EPSILON) return near;
    return Math.max(ta,tb) > EPSILON ? Math.max(ta,tb) : null;
  }
  const t = cross(offset,tangent) / divisor;
  const u = cross(offset,ray) / divisor;
  return t > EPSILON && u >= -EPSILON && u <= 1+EPSILON ? t : null;
}

function reflect(ray,{a,b}) {
  const [tx,ty] = subtract(b,a);
  const twiceProjection = 2*(ray[0]*tx+ray[1]*ty)/(tx*tx+ty*ty);
  return [twiceProjection*tx-ray[0],twiceProjection*ty-ray[1]];
}

function traceBeam(source,surfaces) {
  const points = [source.at], hits = [], visited = new Set();
  let origin = source.at, ray = source.dir;
  for (;;) {
    let contact = null, distance = Infinity;
    for (const surface of surfaces) {
      const t = intersect(origin,ray,surface);
      if (t !== null && t < distance-EPSILON) {
        distance = t;
        contact = surface;
      }
    }
    if (!contact) throw new RangeError('The beam must start inside the field');
    const at = [origin[0]+distance*ray[0], origin[1]+distance*ray[1]];
    points.push(at);
    const hit = {kind:contact.kind,id:contact.id,at};
    hits.push(hit);
    if (contact.kind !== 'mirror') {
      return {id:source.id,points,hits,reached:contact.kind==='window' && contact.id===source.target};
    }

    // A repeated point and direction would yield the same reflections indefinitely.
    const state = [contact.id,...at,...ray].join('|');
    if (visited.has(state)) {
      hit.kind = 'loop';
      return {id:source.id,points,hits,reached:false};
    }
    visited.add(state);
    ray = reflect(ray,contact);
    origin = at;
  }
}

export function traceStage(stage,orientations,time) {
  if (!Array.isArray(orientations) || orientations.length !== stage.mirrors.length) {
    throw new RangeError('One orientation is required per mirror');
  }
  // At an equal-distance contact the opaque shutter covers the surface behind it.
  const surfaces = [
    {kind:'shutter',id:'shutter',...shutterSegment(stage,time)},
    ...stage.mirrors.map((mirror,i)=>({kind:'mirror',id:mirror.id,...mirrorSegment(mirror,orientations[i])})),
    ...stage.windows.map(window=>({...window,kind:'window'})), ...borders
  ];
  const beams = stage.sources.map(source=>traceBeam(source,surfaces));
  return {success:beams.every(beam=>beam.reached),beams};
}

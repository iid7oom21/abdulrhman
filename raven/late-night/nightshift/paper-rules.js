export const WIDTH=144, HEIGHT=88;
export const MAX_COMMANDS=80, MAX_POINTS=256;
export const SAMPLE_STROKE={type:'ink',points:[[28,52],[52,43],[76,41],[104,31]]};

export const blank=()=>({ink:new Uint16Array(WIDTH*HEIGHT),water:new Uint8Array(WIDTH*HEIGHT)});
export const clone=sheet=>({ink:sheet.ink.slice(),water:sheet.water.slice()});
const integer=(v,low,high)=>Number.isInteger(v)&&v>=low&&v<=high;

export function validCommand(c) {
  if (c?.type==='spread') return integer(c.seed,1,9999)&&integer(c.absorption,0,100)&&integer(c.dryness,0,100);
  return ['ink','water'].includes(c?.type) && Array.isArray(c.points) && c.points.length>0 && c.points.length<=MAX_POINTS &&
    c.points.every(p=>Array.isArray(p)&&p.length===2&&integer(p[0],0,WIDTH-1)&&integer(p[1],0,HEIGHT-1));
}

export function stamp(sheet,tool,x,y) {
  const radius=tool==='ink'?2:7;
  for(let j=Math.max(0,y-radius);j<=Math.min(HEIGHT-1,y+radius);j++) {
    for(let i=Math.max(0,x-radius);i<=Math.min(WIDTH-1,x+radius);i++) {
      const d=(i-x)**2+(j-y)**2;
      if(d>radius**2)continue;
      const index=j*WIDTH+i,weight=1-d/(radius**2+1);
      if(tool==='ink') sheet.ink[index]=Math.max(sheet.ink[index], Math.round(3800*weight));
      else sheet.water[index]=Math.max(sheet.water[index],Math.round(250*weight));
    }
  }
}

export function segment(sheet,tool,a,b) {
  const distance=Math.max(Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]),1);
  for(let i=0;i<=distance;i++) {
    stamp(sheet,tool,Math.round(a[0]+(b[0]-a[0])*i/distance),Math.round(a[1]+(b[1]-a[1])*i/distance));
  }
}

// The seed fixes the permeability of each fibre. Every pair exchanges equal integer
// amounts, so capillary spreading conserves pigment even at the edge of the sheet.
function fibres(seed) {
  const result=new Uint8Array(WIDTH*HEIGHT);
  let value=seed;
  for(let i=0;i<result.length;i++){value=(Math.imul(value,1664525)+1013904223)>>>0;result[i]=80+(value>>>25);}
  return result;
}
function spread(sheet,c) {
  const permeability=fibres(c.seed);
  const pigmentChange=new Int16Array(WIDTH*HEIGHT),waterChange=new Int16Array(WIDTH*HEIGHT);
  const evaporation=Math.floor(c.dryness/15);
  for(let step=0;step<18;step++) {
    pigmentChange.fill(0);waterChange.fill(0);
    for(let i=0;i<sheet.water.length;i++) {
      if (i%WIDTH!==WIDTH-1) exchange(i,i+1);
      if (i < sheet.water.length-WIDTH) exchange(i,i+WIDTH);
    }
    for(let i=0;i<sheet.water.length;i++) {
      sheet.ink[i]+=pigmentChange[i];
      sheet.water[i]=Math.max(0,sheet.water[i]+waterChange[i]-evaporation);
    }
  }
  function exchange(a,b) {
    const wet=sheet.water[a]+sheet.water[b];
    if(!wet)return;
    const f=permeability[a]+permeability[b];
    const mobile=(wet/510)*(f/414)*(c.absorption/100)*(1-c.dryness/100);
    const pigment=Math.trunc((sheet.ink[a]-sheet.ink[b])*mobile*.22);
    const moisture=Math.trunc((sheet.water[a]-sheet.water[b])*(f/414)*(.04+c.absorption*.0007));
    pigmentChange[a]-=pigment;pigmentChange[b]+=pigment;
    waterChange[a]-=moisture;waterChange[b]+=moisture;
  }
}
export function apply(sheet,c) {
  if (c.type==='spread') {spread(sheet,c);return;}
  stamp(sheet,c.type,...c.points[0]);
  for(let i=1;i<c.points.length;i++)segment(sheet,c.type,c.points[i-1],c.points[i]);
}

export function measures(sheet) {
  let marked=0,wet=0,mass=0;
  for(let i=0;i<sheet.ink.length;i++) {
    if(sheet.ink[i]>=32)marked++;
    if(sheet.water[i]>=8)wet++;
    mass+=sheet.ink[i];
  }
  return {marked,wet,mass};
}

export function reload(commands) {
  const sheet=blank();
  apply(sheet,SAMPLE_STROKE);
  let before=null;
  for(const command of commands) {
    before=command.type==='spread'?clone(sheet):null;
    apply(sheet,command);
  }
  return {sheet,before};
}

export function validDraft(data) {
  return data?.version===1 && ['ink','water'].includes(data.tool) &&
    integer(data.seed,1,9999)&&integer(data.absorption,0,100)&&integer(data.dryness,0,100)&&
    Array.isArray(data.commands)&&data.commands.length<=MAX_COMMANDS&&data.commands.every(validCommand);
}

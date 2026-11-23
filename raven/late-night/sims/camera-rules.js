// World coordinates are metres, seconds, and metres per second.
export const cameraStep=.25;
export const cameraTarget=[8,12];
export const maxStableSpeed=2;
export function cameraRun(input=[],duration=12){
  const end=Number.isFinite(duration)?Math.max(0,Math.min(12,Math.round(duration*4)/4)):12;
  const pushes=(Array.isArray(input)?input:[]).filter(p=>p&&Number.isFinite(p.t)&&p.t>=0&&p.t<=end&&[-4,-1,1,4].includes(p.dv))
    .map(p=>({t:Math.round(p.t*4)/4,dv:p.dv})).sort((a,b)=>a.t-b.t);
  let x=0,v=0,best=0,hold=0,brakeAt=null,previous=0,idx=0;
  const frames=[];
  for(let n=0;n<=end*4;n++){
    const t=n/4,priorX=x;
    if(n){
      x+=previous*cameraStep;
      if(Math.abs(previous)>maxStableSpeed)hold=0;
      else if(previous===0){hold=priorX>=8&&priorX<=12?hold+cameraStep:0;best=Math.max(best,hold);}
      else{
        const crossings=cameraTarget.map(boundary=>(boundary-priorX)/previous).sort((a,b)=>a-b);
        const from=Math.max(0,crossings[0]),to=Math.min(cameraStep,crossings[1]);
        if(to>=from){
          const segment=(from===0?hold:0)+to-from;best=Math.max(best,segment);hold=to===cameraStep?segment:0;
        }else hold=0;
      }
    }
    while(idx<pushes.length&&pushes[idx].t===t){
      const before=v;v+=pushes[idx++].dv;
      if(brakeAt===null&&Math.abs(v)<Math.abs(before))brakeAt=t;
    }
    if(Math.abs(v)>maxStableSpeed)hold=0;
    frames.push({t,x,v,hold});previous=v;
  }
  return {version:1,pushes,frames,best,brakeAt,success:best>=2,duration:end};
}

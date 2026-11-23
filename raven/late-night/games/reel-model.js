export const cols=7,rows=5,spawn=[0,2],goal=[5,2],souvenir=[3,4],obstacle=[3,2];
export const turns=[['N','E'],['E','S'],['S','W'],['W','N']];
export const vector={E:[1,0],W:[-1,0],N:[0,-1],S:[0,1]};
const opposite={E:'W',W:'E',N:'S',S:'N'};
const at=(p,x,y)=>p[0]===x&&p[1]===y;
export function roll(parts){
  let [x,y]=spawn,dir='E',got=false;
  const route=[[x,y]];let reason='spent';
  for(let step=0;step<12;step++){
    const v=vector[dir];x+=v[0];y+=v[1];
    if(x<0||x>=cols||y<0||y>=rows){reason='edge';break;}
    if(at(obstacle,x,y)){reason='obstacle';break;}
    route.push([x,y]);if(at(souvenir,x,y))got=true;
    if(at(goal,x,y)){reason='box';break;}
    const p=parts.find(part=>part.x===x&&part.y===y);
    if(p){
      const sides=turns[p.rot],from=opposite[dir];
      if(!sides.includes(from)){reason='curve';break;}
      dir=sides.find(d=>d!==from);
    }
  }
  return {route,reason,souvenir:got};
}

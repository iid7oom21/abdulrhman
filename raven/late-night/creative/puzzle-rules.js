export const topics={cinema:[['الستارة','العدسة','التذكرة'],['Curtain','Lens','Ticket']],harbor:[['الموجة','الشراع','المرساة'],['Wave','Sail','Anchor']],garden:[['السرخس','الورد','السرو'],['Fern','Rose','Cypress']]};
export const orders=[];
for(let a=1;a<=4;a++)for(let b=1;b<=4;b++)for(let c=1;c<=4;c++)if(new Set([a,b,c]).size===3)orders.push([a,b,c]);
export function fits(board,r){
  switch(r.op){
    case 'at':return board[r.a]===r.b;
    case 'not':return board[r.a]!==r.b;
    case 'before':return board[r.a]<board[r.b];
    case 'next':return Math.abs(board[r.a]-board[r.b])===1;
    case 'gap':return Math.abs(board[r.a]-board[r.b])===2;
    default:return false;
  }
}
export const solutions=rules=>orders.filter(p=>rules.every(r=>fits(p,r)));
export function generate(seed,difficulty){
  const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
  const target=orders[next()%orders.length],pool=[];
  for(let a=0;a<3;a++){
    for(let b=1;b<=4;b++)for(const op of difficulty==='simple'?['at','not']:['not']){
      const r={op,a,b};if(fits(target,r))pool.push(r);
    }
    for(let b=0;b<3;b++)if(a!==b)for(const op of ['before','next','gap']){
      if(op!=='before'&&a>b)continue;const r={op,a,b};if(fits(target,r))pool.push(r);
    }
  }
  for(let i=pool.length-1;i>0;i--){const j=next()%(i+1);[pool[i],pool[j]]=[pool[j],pool[i]];}
  if(difficulty==='simple')pool.sort((a,b)=>(b.op==='at')-(a.op==='at'));
  else pool.sort((a,b)=>(a.op==='not')-(b.op==='not'));
  let remaining=orders;const rules=[];
  for(const r of pool){
    const n=remaining.filter(p=>fits(p,r));if(n.length>=remaining.length)continue;
    rules.push(r);remaining=n;if(n.length===1)break;
  }
  if(solutions(rules).length!==1)throw new Error('ambiguous generated puzzle');
  return rules;
}
export function clue(r,n,t){
  const a=n[r.a],b=n[r.b];switch(r.op){
    case 'at':return t(a+' في الخانة '+r.b,a+' is in slot '+r.b);
    case 'not':return t(a+' خارج الخانة '+r.b,a+' is not in slot '+r.b);
    case 'before':return t(a+' يسبق '+b,a+' comes before '+b);
    case 'next':return t(a+' و'+b+' متجاوران',a+' and '+b+' are adjacent');
    case 'gap':return t('خانة واحدة بين '+a+' و'+b,'There is one slot between '+a+' and '+b);
  }
}

import {mount,element,link} from './night-shell.js';
import {activities,sections,extras,featured} from './catalog.js';
const pick=featured();
mount({id:'hub',title:['آخر الليل','Late Night'],intro:['مدينة ساحلية وسينما قديمة. اختر كيف تقضي ليلتك.','A coastal town and an old cinema. Choose how to spend the night.'],
render({root,t,url}){
  const feature=element('section',null,'night-feature'), art=element('img');
  art.src='./thumbs/'+pick[0]+'.webp';art.alt='';
  const lead=element('div'), h=element('h2',t(pick[1],pick[2]));
  lead.append(h,link(t(pick[5],pick[6]),url(pick[0]+'.html'),'night-cta'),link(t('كل التجارب','All experiences'),'#catalog','night-more'));
  feature.append(art,lead);root.append(feature);
  const nav=element('nav',null,'night-filters'); nav.id='catalog';
  sections.forEach((name,i)=>nav.append(link(t(...name),'#room-'+i)));
  root.append(nav);
  sections.forEach((name,i)=>{
    const section=element('section'),title=element('h2',t(...name)),grid=element('div',null,'night-grid');
    section.id='room-'+i;
    for(const [id,ar,en,minutes,group,aa,ae] of activities.filter(a=>a[4]===i)){
      const a=link('',url(id+'.html'),'night-card'),img=element('img');img.src='./thumbs/'+id+'.webp';img.loading='lazy';img.width=400;img.height=225;img.alt='';
      const caption=element('div');caption.append(element('h3',t(ar,en)),element('small',t(aa,ae)+' · '+minutes+' '+t('د','min')));
      a.append(img,caption);grid.append(a);
    }
    section.append(title,grid);root.append(section);
  });
  const extra=element('section');extra.append(element('h2',t('أكمل أمسيتك','Continue your evening')));
  const links=element('nav',null,'night-links');
  for(const [id,ar,en] of extras) links.append(link(t(ar,en),url(id+'.html')));
  links.append(link(t('بعد العرض','After the Show'),url('../after-show/')));
  extra.append(links);root.append(extra);
  if(location.hash)requestAnimationFrame(()=>document.getElementById(location.hash.slice(1))?.scrollIntoView());
}});

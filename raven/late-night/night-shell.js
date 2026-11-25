import {pieces,writePiece,events,recordEvent,loadDraft,saveDraft,download} from './night-store.js';

// A location still accompanies activities whose working view is a diagram or script.
const locationHeaders = new Set([
  'echo-last-seat', 'weightless-cam', 'tide-harbor', 'fabric-wind',
  'reading-actor', 'city-radio', 'puzzle-owner', 'replay-caller',
]);

export function element(tag, text, cls) {
  const node=document.createElement(tag);
  if(text!==undefined && text!==null) node.textContent=text;
  if(cls) node.className=cls;
  return node;
}
export function action(text, fn, cls) {
  const b=element('button',text,cls); b.type='button'; b.addEventListener('click',fn); return b;
}
export function link(text, href, cls) {
  const a=element('a',text,cls); a.href=href; return a;
}
export function mount({id,title,intro=['',''],render}) {
  const params=new URLSearchParams(location.search);
  let lang=params.get('lang') === 'en' ? 'en' : 'ar';
  const shell=document.querySelector('#night-app') || document.body.appendChild(element('main'));
  shell.id='night-app'; shell.classList.add('night-wrap');
  const mast=element('header',null,'night-mast'), bar=element('nav',null,'night-wrap night-bar');
  const brand=link('RAVEN','../','night-brand'); brand.dir='ltr';
  const wing=link('','./','night-wing'), tongue=action('',switchLanguage,'night-lang');
  bar.append(brand,wing,tongue); mast.append(bar); shell.before(mast);
  const heading=element('h1'), lead=element('p',null,'night-intro'), bench=element('div',null,'night-bench');
  const notice=element('aside',null,'night-notice'); notice.hidden=true; notice.setAttribute('role','status');
  const foot=element('footer',null,'night-wrap night-foot'), all=link('','./'), home=link('','../');
  foot.append(all,home); shell.after(foot);
  const header=element('header',null,'night-heading');
  header.append(heading,lead);
  if (locationHeaders.has(id)) {
    const still = element('img', null, 'night-location');
    still.alt = '';
    still.decoding = 'async';
    still.addEventListener('error', () => {
      still.remove();
      header.classList.remove('with-location');
    }, {once:true});
    header.classList.add('with-location');
    header.append(still);
    still.src = new URL('./assets/photo/' + id + '.webp', import.meta.url).href;
  }
  shell.replaceChildren(header,notice,bench);
  let lastIssue=null, clean;
  function showIssue(problem) {
    lastIssue=problem;
    notice.hidden=false;
    notice.replaceChildren(element('span',problem.reason==='read'
      ? t('تعذّرت قراءة الحفظ على هذا الجهاز.','Saved data could not be read on this device.')
      : t('لم يتأكد الحفظ على هذا الجهاز. احتفظ بنسخة قبل المغادرة.','Saving could not be confirmed on this device. Keep a copy before leaving.')));
    if(problem.value) notice.append(action(t('تنزيل نسخة JSON','Download JSON'),()=>download('late-night-copy.json',problem.value)));
  }
  window.addEventListener('night:storage',event=>showIssue(event.detail));
  function t(ar,en){return lang==='en' ? en : ar;}
  function url(path) {const u=new URL(path,location.href);u.searchParams.set('lang',lang);return u.href;}
  const selected=params.get('piece');
  const original=selected ? pieces().find(p=>p.id===selected && p.activity===id) : null;
  const ui={root:bench,t,url, get lang(){return lang;}, editData:original?.data ?? null,
    pieces, events, savePiece:p=>{
      const item=writePiece(id,p);
      if(item){lastIssue=null;notice.hidden=false;notice.replaceChildren(element('span',t('حُفظت القطعة على هذا الجهاز.','Saved on this device.')),document.createTextNode(' '),link(t('دفتر أعمالي','My portfolio'),url('my-notebook.html')));}
      return item;
    }, recordEvent:e=>recordEvent(id,e),
    load:()=>loadDraft(id),save:data=>saveDraft(id,data)};
  function switchLanguage(){
    lang=lang==='ar'?'en':'ar';
    const target=new URL(location.href); target.searchParams.set('lang',lang);
    history.replaceState(history.state,'',target);
    paint();
  }
  function paint(){
    if(typeof clean==='function')clean();
    document.documentElement.lang=lang; document.documentElement.dir=t('rtl','ltr');
    document.title=t(...title)+' · '+t('آخر الليل','Late Night');
    heading.textContent=t(...title); lead.textContent=t(...intro); lead.hidden=!lead.textContent;
    wing.textContent=t('آخر الليل','Late Night'); wing.href=url('./'); brand.href=url('../');
    tongue.textContent=t('EN','عربي'); tongue.lang=t('en','ar'); tongue.setAttribute('aria-label',t('English','العربية'));
    tongue.dataset.nightLanguage='';
    all.textContent=t('كل التجارب','All experiences'); all.href=url('./#catalog');
    home.textContent=t('العودة إلى RAVEN','Return to RAVEN');home.href=url('../');
    if(lastIssue) showIssue(lastIssue);
    bench.replaceChildren(); clean=render(ui);
  }
  paint();
  return ui;
}

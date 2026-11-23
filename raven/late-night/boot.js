// A failed entry module cannot render its own recovery controls.
window.addEventListener('error', event => {
  const script=event.target;
  if (!(script instanceof HTMLScriptElement) || script.type!=='module') return;
  const show=()=>{
    const root=document.getElementById('night-app');
    if(!root || root.querySelector('.night-bench'))return;
    const en=new URLSearchParams(location.search).get('lang')==='en';
    document.documentElement.lang=en?'en':'ar';document.documentElement.dir=en?'ltr':'rtl';
    const title=document.createElement('h1');title.textContent='RAVEN · '+(en?'Late Night':'آخر الليل');
    const text=document.createElement('p');text.setAttribute('role','status');text.textContent=en?'The activity could not be loaded.':'تعذّر تحميل التجربة.';
    const retry=document.createElement('button');retry.textContent=en?'Retry loading':'أعد تحميل التجربة';retry.onclick=()=>location.reload();
    const back=document.createElement('a');back.href='./?lang='+(en?'en':'ar');back.textContent=en?'All experiences':'كل التجارب';
    root.replaceChildren(title,text,retry,document.createTextNode(' · '),back);
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',show,{once:true});else show();
},true);

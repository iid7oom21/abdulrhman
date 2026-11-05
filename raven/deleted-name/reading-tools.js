(() => {
  const hook = document.getElementById('hook');
  if (!hook) return;
  const panel = document.createElement('section'); panel.id = 'reading-tools';
  document.getElementById('hook-actions').before(panel);
  let run, entries = [], sourceId = '', draft = '', kind = 'question', open = false, sequence = 0;
  let sources = new Map();
  const copy = {
    ar:{title:'دفتر المقارنة والأقوال',scope:'دفترك خاص في هذا المشهد فقط. لا يصل إلى الشخصيات ولا يغيّر اختياراتك. إعادة المشهد أو تحديث الصفحة يبدأ دفترًا جديدًا؛ نزّل نسخة إذا أردت الاحتفاظ بها.',
      task:'قارن ما في رسالتك بما أضيف إلى المسودة. اختر عبارة واكتب الملاحظة أو السؤال الذي تريد التحقق منه.',source:'العبارة التي أراجعها',kind:'نوع الملاحظة',question:'سؤال مفتوح',observation:'ملاحظة على النص',hypothesis:'فرضية تحتاج تحققًا',text:'ملاحظتي الخاصة',add:'أضف إلى دفتري',empty:'دفترك فارغ. لن تُسجل ملاحظة نيابة عنك.',saved:'أُضيفت إلى دفترك الخاص في هذه الصفحة فقط.',invalid:'اختر عبارة ظاهرة واكتب ملاحظتك (حتى 1000 حرف).',limit:'وصل الدفتر إلى 30 ملاحظة؛ نزّل نسختك قبل بدء تجربة أخرى.',remove:'حذف ملاحظتي',download:'تنزيل نسخة من دفتري',quotes:'الأقوال التي ظهرت في الحوار',original:'رسالتك — L02',conclusion:'الاستنتاج المضاف في المسودة',signature:'موضع التوقيع',none:'اختر عبارة',select:'اخترت هذا الجزء للمراجعة؛ اكتب ما لاحظته في الدفتر.',removed:'حُذفت ملاحظتك الخاصة؛ القول الأصلي باقٍ.'},
    en:{title:'Comparison and statements notebook',scope:'This notebook is private to this scene. It reaches no character and does not change your choices. Replaying or reloading starts a new notebook; download a copy if you want to keep it.',
      task:'Compare your message with what was added to the draft. Select a passage and write an observation or a question to check.',source:'Passage I am reviewing',kind:'Note type',question:'Open question',observation:'Text observation',hypothesis:'Hypothesis to check',text:'My private note',add:'Add to my notebook',empty:'Your notebook is empty. No note is written on your behalf.',saved:'Added to your private notebook on this page only.',invalid:'Select a visible passage and write a note (up to 1000 characters).',limit:'The notebook has 30 notes; download your copy before starting another run.',remove:'Delete my note',download:'Download my notebook',quotes:'Statements shown in the dialogue',original:'Your message — L02',conclusion:'Conclusion added to the draft',signature:'Signature space',none:'Select a passage',select:'Selected this passage for review; write what you noticed in the notebook.',removed:'Your private note was deleted; the original statement remains.'}
  };
  const lang = () => document.documentElement.lang === 'en' ? 'en' : 'ar';
  const el = (tag,text) => {const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  const button = (id,text,fn) => {const b=el('button',text);b.type='button';b.id=id;b.addEventListener('click',fn);return b;};
  const label = (id,text) => {const n=el('label',text);n.htmlFor=id;return n;};
  const announce = text => {document.getElementById('reading-status').textContent=text;};
  function collect(c) {
    sources = new Map();
    for (const part of ['original','conclusion','signature']) {
      const node=document.querySelector('#hook-document [data-part="'+part+'"] .hook-part');
      if(node)sources.set('document-'+part,{id:'document-'+part,label:c[part],text:node.textContent,type:'document'});
    }
    for (const row of document.querySelectorAll('#hook-log li[data-kind="spoken"][data-line-id]')) {
      const id=row.dataset.lineId, text=row.querySelector('p')?.textContent, speaker=row.querySelector('.who')?.textContent;
      if(text)sources.set(id,{id,label:speaker+' — '+id,text,type:'statement'});
    }
  }
  function snapshot() {
    return {format:'raven-private-reading-notebook-v1',contentVersion:hook.dataset.contentVersion,displayLanguage:lang(),scope:'private-scene-notes',entries:entries.map(n=>({...n,source:{...sources.get(n.sourceId)}}))};
  }
  function render(focusId) {
    const c=copy[lang()];
    collect(c);
    panel.hidden=['start','invite'].includes(hook.dataset.phase);
    if(run!==hook.dataset.sceneRun){run=hook.dataset.sceneRun;entries=[];draft='';sourceId='';kind='question';open=false;sequence=0;}
    panel.replaceChildren(); panel.dataset.notes = JSON.stringify(snapshot());
    const details=el('details');details.open=open;details.id='reading-details';details.append(el('summary',c.title),el('p',c.scope),el('p',c.task));
    details.addEventListener('toggle',()=>{if(details.isConnected)open=details.open;});
    const select=el('select');select.id='reading-source';select.append(new Option(c.none,''));
    for(const s of sources.values())select.append(new Option(s.label,s.id));select.value=sourceId;
    const preview=el('p',sources.get(sourceId)?.text || '');preview.id='reading-source-preview';preview.className='reading-source';
    select.addEventListener('change',()=>{sourceId=select.value;preview.textContent=sources.get(sourceId)?.text||'';});
    const types=el('select');types.id='reading-kind';for(const k of ['question','observation','hypothesis'])types.append(new Option(c[k],k));types.value=kind;types.addEventListener('change',()=>{kind=types.value;});
    const input=el('textarea');input.id='reading-note';input.maxLength=1000;input.value=draft;input.dir='auto';input.addEventListener('input',()=>{draft=input.value;});
    const status=el('p');status.id='reading-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    details.append(label(select.id,c.source),select,preview,label(types.id,c.kind),types,label(input.id,c.text),input);
    details.append(button('reading-add',c.add,()=>{
      if(!sources.has(sourceId)||!draft.trim()||draft.length>1000||!['question','observation','hypothesis'].includes(kind)){announce(c.invalid);return;}
      if(entries.length>=30){announce(c.limit);return;}
      entries.push({id:'note-'+(++sequence),sourceId,kind,text:draft.trim()});draft='';render('reading-note');announce(c.saved);
    }),status);
    const list=el('ol');list.id='reading-notes';
    if(!entries.length)details.append(el('p',c.empty));
    for(const n of entries){const row=el('li');row.dataset.noteId=n.id;row.append(el('strong',c[n.kind]),el('p',n.text),el('span',sources.get(n.sourceId)?.label||n.sourceId));row.append(button('remove-'+n.id,c.remove,()=>{entries=entries.filter(x=>x.id!==n.id);render('reading-note');announce(c.removed);}));list.append(row);}
    details.append(list);
    const download=button('reading-download',c.download,()=>{
      const blob=new Blob([JSON.stringify(snapshot(),null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download='raven-private-notebook.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    });download.disabled=!entries.length;details.append(download);
    const quotes=el('details');quotes.id='reading-quotes';quotes.append(el('summary',c.quotes));const statements=el('ul');
    for(const s of sources.values())if(s.type==='statement'){const li=el('li');li.dataset.sourceId=s.id;li.append(el('strong',s.label),el('p',s.text));statements.append(li);}
    quotes.append(statements);details.append(quotes);panel.append(details);
    if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  }
  hook.addEventListener('raven:opening-render',()=>{const id=panel.contains(document.activeElement)?document.activeElement.id:null;render(id);});
  hook.addEventListener('raven:inspect-part',event=>{
    const id='document-'+event.detail?.part;if(!sources.has(id))return;
    sourceId=id;open=true;render();
  });
  render();
})();

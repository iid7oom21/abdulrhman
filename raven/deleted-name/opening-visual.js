/* Presentation only. No storage, game actions, network requests or source edits. */
(() => {
  'use strict';
  const hook = document.getElementById('hook');
  if (!hook) return;
  const strings = {
    ar: {open:'اقرأ البطاقة',document:'افتح الورقة للقراءة',close:'إغلاق والعودة',focus:'التركيز على الورقة',exit:'الخروج من وضع التركيز',source:'ارجع إلى الأصل',scope:'عرض للقراءة فقط؛ لا يغير النص أو يشاركه.',paper:'المسودة',selected:'النص المعروض',character:'بطاقة شخصية',art:'تصور بصري، ليس دليلًا',shareTitle:'لمن تصل هذه النسخة؟',shareHelp:'اقرأ النص والمستلم في المعاينة. لا تُرسل المسودة بمجرد قراءتها.'},
    en: {open:'Read the card',document:'Open the paper to read',close:'Close and return',focus:'Focus on the paper',exit:'Leave focus mode',source:'Return to the source',scope:'Reading view only. It neither changes nor shares the text.',paper:'The draft',selected:'Displayed text',character:'Character card',art:'Visual interpretation, not evidence',shareTitle:'Who receives this copy?',shareHelp:'Review the text and recipient in the preview. Reading a draft does not send it.'}
  };
  const english = () => document.documentElement.lang === 'en';
  const words = () => strings[english() ? 'en' : 'ar'];
  const make = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  };
  let returnedTo = null, activeCard = null, savedPosition = null;
  const dialog = make('dialog', undefined, 'opening-card-dialog');
  dialog.id = 'opening-card-dialog';
  dialog.setAttribute('aria-labelledby', 'opening-card-title');
  const inner = make('div', undefined, 'card-dialog-inner');
  const close = make('button', words().close, 'card-dialog-close');close.type = 'button';
  const title = make('h2', '', 'card-dialog-heading');title.id = 'opening-card-title';title.tabIndex = -1;
  const body = make('div', undefined, 'card-dialog-body');
  const scope = make('p', words().scope, 'opening-chip');
  inner.append(close, title, body, scope);dialog.append(inner);document.body.append(dialog);
  function sourceFor(id) {
    if (id === 'paper') return document.getElementById('hook-document');
    return document.querySelector('.cast > [data-character="'+id+'"]:not([hidden])');
  }
  function renderCard() {
    const original = sourceFor(activeCard);
    if (!original) { if (dialog.open) dialog.close();return false; }
    body.replaceChildren();close.textContent = words().close;scope.textContent = words().scope;
    if (activeCard === 'paper') {
      title.textContent = original.querySelector('h3')?.textContent || words().paper;
      const list = make('dl');
      original.querySelectorAll(':scope > dl > div').forEach(group => {
        const row = make('div');
        row.append(make('dt',group.querySelector('dt')?.textContent || ''),make('dd',group.querySelector('dd')?.textContent || ''));
        list.append(row);
      });
      body.append(list);
    } else {
      title.textContent = original.querySelector('.cast-name')?.textContent || words().character;
      const portrait = original.querySelector('.cast-portrait');
      if (portrait) {
        const copy = portrait.cloneNode(true);
        copy.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
        body.append(copy);
      }
      body.append(make('p',original.querySelector('dd')?.textContent || ''));
    }
    return true;
  }
  function openCard(id, trigger) {
    activeCard = id;returnedTo = trigger;savedPosition = {x:scrollX,y:scrollY};
    if (!renderCard()) return;
    if (!dialog.open) dialog.showModal();
    title.focus({preventScroll:true});
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  }});
  dialog.addEventListener('close', () => {
    const target = returnedTo?.isConnected ? returnedTo : document.querySelector('[data-visual-open="'+activeCard+'"]');
    target?.focus({preventScroll:true});
    if (savedPosition) window.scrollTo({left:savedPosition.x,top:savedPosition.y,behavior:'instant'});
    activeCard = null;
  });
  function addOpenButton(parent,id,label) {
    let control = parent.querySelector('[data-visual-open]');
    if (!control) {
      control = make('button',label,'opening-secondary material-open');control.type = 'button';
      control.dataset.visualOpen = id;control.setAttribute('aria-haspopup','dialog');
      control.addEventListener('click', () => openCard(id,control));parent.append(control);
    }
    control.textContent = label;
  }
  const exit = make('button',words().exit,'opening-secondary');exit.type = 'button';exit.id = 'paper-focus-exit';exit.hidden = true;
  hook.prepend(exit);
  let beforeFocus = null;
  function leaveFocus(restorePosition = true) {
    document.body.classList.remove('paper-focus');exit.hidden = true;
    hook.querySelector('[data-visual-focus]')?.focus({preventScroll:true});
    if (restorePosition && beforeFocus) window.scrollTo({left:beforeFocus.x,top:beforeFocus.y,behavior:'instant'});
    beforeFocus = null;
  }
  exit.addEventListener('click',() => leaveFocus());
  document.addEventListener('keydown', event => {if(event.key === 'Escape' && !dialog.open && !exit.hidden) {event.preventDefault();leaveFocus();}});
  function enhance() {
    const c = words();exit.textContent = c.exit;
    document.querySelectorAll('.cast > [data-character]:not([hidden])').forEach(card => addOpenButton(card,card.dataset.character,c.open));
    const paper = document.getElementById('hook-document');
    if (paper) {
      let bar = paper.querySelector('.opening-toolsbar');
      if (!bar) {
        bar = make('div',undefined,'opening-toolsbar');
        addOpenButton(bar,'paper',c.document);
        const focus = make('button',c.focus,'opening-secondary');focus.type = 'button';focus.dataset.visualFocus = '';
        focus.addEventListener('click', () => {
          beforeFocus = {x:scrollX,y:scrollY};
          document.body.classList.add('paper-focus');exit.hidden = false;exit.focus({preventScroll:true});
          window.scrollTo({left:0,top:Math.max(0,scrollY + paper.getBoundingClientRect().top - exit.offsetHeight - 28),behavior:'instant'});
        });
        const source = make('a',c.source,'opening-secondary');source.href = '#t-assign';source.dataset.visualSource = '';
        source.addEventListener('click', () => {if(!exit.hidden) leaveFocus(false);document.getElementById('t-assign')?.focus({preventScroll:true});});
        bar.append(focus,source);paper.append(bar);
      }
      bar.querySelector('[data-visual-open]').textContent = c.document;
      bar.querySelector('[data-visual-focus]').textContent = c.focus;
      bar.querySelector('[data-visual-source]').textContent = c.source;
    } else if (!exit.hidden) {
      document.body.classList.remove('paper-focus');exit.hidden = true;beforeFocus = null;
    }
    let help = document.getElementById('opening-sharing-guide');
    const showHelp = ['share','review'].includes(hook.dataset.phase);
    if (!help && showHelp) {
      help = make('aside',undefined,'opening-guide-card');help.id = 'opening-sharing-guide';help.dataset.designCard = 'sharing-guide';
      help.append(make('h3'),make('p'));document.getElementById('hook-actions').before(help);
    }
    if (help) {help.hidden = !showHelp;help.querySelector('h3').textContent = c.shareTitle;help.querySelector('p').textContent = c.shareHelp;}
    if (dialog.open) renderCard();
  }
  hook.addEventListener('raven:opening-render',enhance);
  document.addEventListener('raven:language',enhance);
  enhance();
})();

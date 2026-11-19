/* Presentation only. Storage contains display preferences, never notes or game state. */
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
  const messageTitle = () => english() ? 'What brought me here' : 'اللي جابني هنا';
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
  const readingCopy = {
    ar: {legend:'راحة القراءة',size:'حجم النص',standard:'عادي',large:'أكبر',largest:'كبير جدًا',night:'قراءة ليلية',reset:'العرض الافتراضي',session:'تفضيلات عرض فقط؛ لا تحفظ تقدم القضية.',saved:'حُفظت تفضيلات القراءة على هذا المتصفح فقط؛ لا تحفظ تقدم القضية.',restored:'تفضيلات القراءة المحفوظة على هذا المتصفح؛ تقدم القضية منفصل.',unavailable:'تُطبق التفضيلات هنا مؤقتًا؛ تعذر حفظها في المتصفح.'},
    en: {legend:'Reading comfort',size:'Text size',standard:'Standard',large:'Larger',largest:'Largest',night:'Night reading',reset:'Default display',session:'Display preferences only. They do not save case progress.',saved:'Reading preferences saved in this browser only. They do not save case progress.',restored:'Reading preferences restored from this browser. Case progress is separate.',unavailable:'Preferences apply temporarily here; they could not be saved in this browser.'}
  };
  const preferenceKey = 'raven_opening_readability_v1';
  const validSizes = new Set(['standard','large','largest']);
  let preferences = {size:'standard',night:false}, preferenceStatus = 'session', readingRevision = 0;
  try {
    const stored = localStorage.getItem(preferenceKey);
    let parsed = null;try {parsed = stored ? JSON.parse(stored) : null;} catch { /* Ignore invalid preferences. */ }
    if (parsed?.version === 1 && validSizes.has(parsed.size) && typeof parsed.night === 'boolean') {
      preferences = {size:parsed.size,night:parsed.night};preferenceStatus = 'restored';
    }
  } catch {preferenceStatus = 'unavailable';}
  const readingPanel = make('details',undefined,'opening-reading-panel');readingPanel.id = 'opening-reading-settings';
  const readingSummary = make('summary');readingSummary.id = 'opening-reading-summary';
  const readingSettings = make('fieldset',undefined,'opening-reading-settings');
  const readingLegend = make('legend',undefined,'hook-sr');
  const sizeLabel = make('label');sizeLabel.htmlFor = 'opening-reading-size';
  const textSize = make('select');textSize.id = 'opening-reading-size';
  for (const value of validSizes) {const option = make('option');option.value = value;textSize.append(option);}
  const nightLabel = make('label',undefined,'opening-night-control');
  const night = make('input');night.type = 'checkbox';night.id = 'opening-reading-night';
  const nightText = make('span');nightLabel.append(night,nightText);
  const resetReading = make('button',undefined,'opening-secondary');resetReading.type = 'button';resetReading.id = 'opening-reading-reset';
  const preferenceNote = make('p',undefined,'opening-chip');preferenceNote.id = 'opening-reading-status';preferenceNote.setAttribute('role','status');
  readingSettings.append(readingLegend,sizeLabel,textSize,nightLabel,resetReading,preferenceNote);
  readingPanel.append(readingSummary,readingSettings);
  function renderReadingSettings() {
    const c = readingCopy[english() ? 'en' : 'ar'];
    readingSummary.textContent = c.legend;readingLegend.textContent = c.legend;sizeLabel.textContent = c.size;
    for (const option of textSize.options) option.textContent = c[option.value];
    textSize.value = preferences.size;night.checked = preferences.night;nightText.textContent = c.night;
    resetReading.textContent = c.reset;preferenceNote.textContent = c[preferenceStatus];
  }
  function applyReadingPreferences(save = false) {
    document.body.dataset.readingSize = preferences.size;
    document.body.dataset.readingNight = String(preferences.night);
    if (save) {
      readingRevision++;
      const serialized = JSON.stringify({version:1,...preferences});
      try {
        localStorage.setItem(preferenceKey,serialized);
        preferenceStatus = localStorage.getItem(preferenceKey) === serialized ? 'saved' : 'unavailable';
      } catch {preferenceStatus = 'unavailable';}
    }
    renderReadingSettings();
  }
  textSize.addEventListener('change',() => {
    if (!validSizes.has(textSize.value)) return;
    preferences.size = textSize.value;applyReadingPreferences(true);
  });
  night.addEventListener('change',() => {preferences.night = night.checked;applyReadingPreferences(true);});
  resetReading.addEventListener('click',() => {preferences = {size:'standard',night:false};applyReadingPreferences(true);});
  applyReadingPreferences();
  inner.append(close, title, readingPanel, body, scope);dialog.append(inner);document.body.append(dialog);
  function sourceFor(id) {
    if (id === 'message') return document.querySelector('#assignment-stage .thread');
    if (id === 'paper') return document.getElementById('hook-document');
    return document.querySelector('.cast > [data-character="'+id+'"]:not([hidden])');
  }
  function renderCard() {
    const original = sourceFor(activeCard);
    if (!original) { if (dialog.open) dialog.close();return false; }
    body.replaceChildren();close.textContent = words().close;scope.textContent = words().scope;renderReadingSettings();
    if (activeCard === 'message') {
      title.textContent = messageTitle();
      const transcript = make('ol',undefined,'message-transcript');
      original.querySelectorAll('.msg').forEach(message => {
        const row = make('li',undefined,'message-row');
        row.append(make('strong',message.querySelector('.who')?.textContent || '', 'message-speaker'),make('p',message.querySelector('p')?.textContent || ''));
        transcript.append(row);
      });
      body.append(transcript,make('p',english() ? 'An earlier conversation. Your reply in it has already happened.' : 'محادثة سابقة. ردّك المكتوب فيها حدث بالفعل.','opening-chip'));
    } else if (activeCard === 'paper') {
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
    activeCard = id;returnedTo = trigger;savedPosition = {x:scrollX,y:scrollY,anchorTop:trigger.getBoundingClientRect().top,readingRevision};
    if (!renderCard()) return;
    if (!dialog.open) dialog.showModal();
    title.focus({preventScroll:true});
  }
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || !dialog.open) return;
    // Keep the modal keyboard boundary inside this iframe. Native dialog focus
    // alone can otherwise continue into the parent page's soundtrack controls.
    const controls = [...dialog.querySelectorAll('button:not([disabled]),a[href],summary,input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')]
      .filter(node => node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden');
    const first = controls[0], last = controls[controls.length - 1];
    if (!first) {event.preventDefault();title.focus();return;}
    const outside = !controls.includes(document.activeElement);
    if (outside || (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
      event.preventDefault();(event.shiftKey ? last : first).focus();
    }
  });
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  }});
  dialog.addEventListener('close', () => {
    const target = returnedTo?.isConnected ? returnedTo : document.querySelector('[data-visual-open="'+activeCard+'"]');
    target?.focus({preventScroll:true});
    if (savedPosition) {
      const top = target?.isConnected && savedPosition.readingRevision !== readingRevision
        ? scrollY + target.getBoundingClientRect().top - savedPosition.anchorTop : savedPosition.y;
      window.scrollTo({left:savedPosition.x,top,behavior:'instant'});
    }
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
    const target = hook.querySelector('[data-visual-focus]');target?.focus({preventScroll:true});
    if (restorePosition && beforeFocus) {
      const top = target && beforeFocus.readingRevision !== readingRevision
        ? scrollY + target.getBoundingClientRect().top - beforeFocus.anchorTop : beforeFocus.y;
      window.scrollTo({left:beforeFocus.x,top,behavior:'instant'});
    }
    beforeFocus = null;
  }
  exit.addEventListener('click',() => leaveFocus());
  document.addEventListener('keydown', event => {if(event.key === 'Escape' && !dialog.open && !exit.hidden) {event.preventDefault();leaveFocus();}});
  function enhance() {
    const c = words();exit.textContent = c.exit;renderReadingSettings();
    const messageTools = document.querySelector('.journey-message-tools');
    if (messageTools) addOpenButton(messageTools,'message',english() ? 'Open the earlier conversation' : 'افتح المحادثة السابقة');
    const oldQuote = document.getElementById('old-message-quote');
    const oldMessage = document.querySelector('[data-k="m3"]')?.textContent;
    if (oldQuote && oldMessage) oldQuote.textContent = oldMessage.replace(/^[^.]+\.\s*/, '');
    const taskQuote = document.getElementById('task-message-quote');
    const taskMessage = document.querySelector('[data-k="m1"]')?.textContent;
    if (taskQuote && taskMessage) taskQuote.textContent = taskMessage.replace(/^.*\.\s*(?=[^.]+\.$)/, '');
    document.querySelector('.opening-journey-nav')?.setAttribute('aria-label',english() ? 'Opening path' : 'مسار الافتتاح');
    if (hook.dataset.phase === 'respond') {
      const effects = english() ? {
        precise:'Opens a draft, then a preview of the text and recipient before confirmation.',
        wait:'A spoken response only. No written draft or recipient is created.',
        refuse:'A spoken response only. No written draft or recipient is created.'
      } : {
        precise:'يفتح مسودة، ثم معاينة للنص والمستلم قبل التأكيد.',
        wait:'قول داخل المشهد فقط؛ لا ينشئ مسودة أو مستلمًا.',
        refuse:'قول داخل المشهد فقط؛ لا ينشئ مسودة أو مستلمًا.'
      };
      for (const [action,effect] of Object.entries(effects)) {
        const control = hook.querySelector('[data-hook-action="'+action+'"]');
        if (!control || control.parentElement.classList.contains('choice-with-effect')) continue;
        const row = make('div',undefined,'choice-with-effect'),hint = make('p',effect,'decision-effect');
        hint.id = 'opening-effect-'+action;control.setAttribute('aria-describedby',hint.id);
        control.before(row);row.append(control,hint);
      }
    }
    document.querySelectorAll('.cast > [data-character]:not([hidden])').forEach(card => addOpenButton(card,card.dataset.character,c.open));
    const paper = document.getElementById('hook-document');
    if (paper) {
      let bar = paper.querySelector('.opening-toolsbar');
      if (!bar) {
        bar = make('div',undefined,'opening-toolsbar');
        addOpenButton(bar,'paper',c.document);
        const focus = make('button',c.focus,'opening-secondary');focus.type = 'button';focus.dataset.visualFocus = '';
        focus.addEventListener('click', () => {
          beforeFocus = {x:scrollX,y:scrollY,anchorTop:focus.getBoundingClientRect().top,readingRevision};
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
  document.getElementById('task-message-preview')?.addEventListener('click',event => openCard('message',event.currentTarget));
  document.querySelector('[data-journey-paper]')?.addEventListener('click', () => {
    // This is the same explicit opening action. Returning never restarts a scene.
    if (hook.dataset.phase === 'start') hook.querySelector('[data-hook-action="open"]')?.click();
  });
  const appointment = document.querySelector('[data-appointment-art] img');
  if (appointment) {
    const showAppointment = () => {
      // Let the existing recovery script adopt the approved fallback first.
      // A failed new image therefore never removes that working illustration.
      if (!window.RavenOpeningArtwork) return;
      const image = new Image();
      image.onload = () => {
        const current = document.querySelector('[data-appointment-art] img');
        if (current) {current.src = image.src;current.width = image.naturalWidth;current.height = image.naturalHeight;}
      };
      image.src = '../assets/visual-20261119/appointment-phone' + (matchMedia('(max-width:650px)').matches ? '-mobile' : '') + '.webp';
    };
    if (document.readyState === 'complete') showAppointment();
    else window.addEventListener('load',showAppointment,{once:true});
  }
  enhance();
})();

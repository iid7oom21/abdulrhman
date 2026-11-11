/* Public player view only. The current scene, earned materials and available
   actions come from the case server. No story catalog or rules live here. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const PENDING_KEY = 'raven_case_pending_operation_v1';
  const OPENING_KEY = 'raven.case.opening.v1';
  const API = '/api/case/';
  const TEXT = {
    ar: {
      skip:'انتقل إلى القضية',title:'القضية',back:'العودة إلى صفحة القضية',language:'لغة العرض',
      actions:'ماذا تريد أن تفعل؟',review:'راجع اختيارك',materials:'المواد التي وصلت إليك',comparison:'مقارنة المواد',firstMaterial:'المادة الأولى',secondMaterial:'المادة الثانية',
      notebook:'دفتر خاص',notebookScope:'ملاحظات خاصة بجلسة القضية على الخادم. لا تصل إلى الشخصيات تلقائيًا. النص الذي لم تؤكده يبقى في هذه الصفحة فقط.',notesDownload:'تنزيل ملاحظاتي',notesDownloadScope:'التنزيل يشمل الملاحظات المؤكدة فقط، ولا يشمل نصًا ما زلت تكتبه.',
      permissions:'المواد التي شاركتها',timeline:'نطاقات التسجيل التي فحصتها',reports:'التقرير وما سجلته ومصادره',receipts:'إيصالات داخل القصة',receiptScope:'الإيصال القصصي يصف الاستلام داخل القصة؛ لا يعني إرسالًا إلى جهة حقيقية أو اعتماد صحة التقرير.',
      refresh:'تحديث حالة القضية',export:'تنزيل سجل القضية',loading:'جارٍ التحقق من توفر القضية',loadingBody:'تحتاج هذه التجربة إلى خادم القضية.',
      unavailable:'القضية المتصلة غير متاحة هنا',unavailableBody:'يمكنك قراءة الافتتاح من صفحة القضية. هذه الصفحة لا تشغّل القضية الكاملة دون خادمها، ولا تستبدلها بمحاكاة.',retryConnection:'تحقق مرة أخرى',
      startTitle:'ابدأ جلسة القضية',startBody:'يتابع الخادم هذه الجلسة. إذا لم تنقل اختيارًا من الافتتاح، ستختار نقطة الدخول داخل المشهد.',start:'ابدأ أو تابع جلستي',
      openingTitle:'اختيار الافتتاح الذي ستنقله',openingScope:'هذا اختيار محلي من الافتتاح، وليس إثباتًا لإرسال سابق إلى الخادم. لا يتضمن ملاحظاتك الخاصة.',startWithOpening:'ابدأ بهذا الاختيار',startWithoutOpening:'ابدأ دون استيراد الاختيار',openingInvalid:'اختيار الافتتاح المحفوظ غير صالح لهذه النسخة؛ لن يُستورد. يمكنك البدء دونه.',openingChoice:'الرد المختار',openingRecipient:'المستلم المختار داخل الافتتاح',precise:'توضيح دقيق',wait:'تأجيل الرد',refuse:'رفض التسجيل الآن',lie:'إنكار الرسالة',both:'يوناس وكلير',draft:'مسودة فقط — لا مستلم',none:'لا مستلم',
      confirmed:'حُفظت هذه الخطوة على خادم التجربة.',memory:'هذه الجلسة في ذاكرة الخادم فقط؛ قد تفقدها إعادة تشغيله. يمكنك تنزيل سجل للقراءة.',
      storagePaused:'توقفت تغييرات القضية بسبب تعذّر تأكيد الحفظ',storageUnconfirmed:'الحالة المعروضة للقراءة فقط. لم يؤكد الخادم حفظ آخر إجراء؛ احتفظ بمعرّف العملية وتحقق من الحالة بعد استعادة التخزين.',saveUnconfirmed:'الحفظ غير مؤكد؛ الحالة للقراءة فقط حتى يستعيد الخادم التخزين.',chooseRange:'اختر نطاقًا مكتسبًا لمراجعة ما أظهره',
      pendingTitle:'نتيجة الإجراء لم تُحسم بعد',pendingBody:'قد يكون الخادم نفّذ اختيارك. إعادة المحاولة التالية تستخدم العملية نفسها ولا تنشئ اختيارًا جديدًا.',retryOperation:'تابع العملية نفسها',pendingBusy:'جارٍ تنفيذ اختيارك…',
      pendingCorruptTitle:'تعذّرت قراءة سجل عملية سابقة',pendingCorruptBody:'أُبقي السجل المحلي الأصلي دون تغيير. يمكنك تنزيله للاحتفاظ به؛ لا يمكن إرسال إجراء جديد من هذه الصفحة قبل مراجعة هذه الحالة.',pendingDownload:'تنزيل سجل العملية المحلي',
      pendingNoStorage:'تعذّر حفظ مرجع العملية في هذا المتصفح. أبقِ الصفحة مفتوحة حتى تتضح النتيجة.',
      conflict:'تغيّرت حالة القضية. حدّثها ثم راجع اختيارك من جديد.',version:'إصدار جلسة القضية يختلف عن الإصدار المطلوب. نزّل سجلك المتاح قبل استئناف العمل على إصدار آخر.',
      rejected:'لم يقبل الخادم هذا الإجراء. راجع الحقول والاختيارات المتاحة.',session:'تعذّر الوصول إلى الجلسة. تحقّق من الاتصال قبل إعادة المحاولة.',blocked:'تعذّر التحقق من مصدر الطلب؛ لم يُؤكَّد تنفيذ الإجراء.',
      error:'تعذّر إكمال الطلب الآن.',emptyMaterials:'لم تصل إليك مواد بعد.',chooseMaterial:'اختر مادة',source:'المصدر',noSource:'لا يوجد مصدر معروض.',
      preview:'راجع قبل التأكيد',confirm:'تأكيد الاختيار',edit:'العودة للتعديل',choice:'الاختيار',fieldsScope:'هذه القيم ستُرسل إلى خادم القضية. راجع الجهة ونطاق المشاركة في المشهد؛ لا تُرفق ملاحظاتك الخاصة تلقائيًا.',
      sourceRefs:'المصادر المختارة',noSelection:'لم تختر شيئًا',select:'اختر',unsupported:'هذا الإجراء يحتاج نوع إدخال غير مدعوم في هذه النسخة.',
      noNotes:'لا توجد ملاحظات مؤكدة بعد.',noteUnavailable:'يظهر خيار إضافة ملاحظة عندما يتيحه المشهد.',noteAdded:'حُدّث دفتر الجلسة.',
      noActions:'لا توجد اختيارات إضافية في هذا المشهد.',updated:'حُدّثت حالة القضية.',languageChanged:'تغيّرت لغة العرض دون إرسال اختيار جديد.',
      recipient:'المستلم',shared:'مادة تمت مشاركتها داخل القصة',recorded:'ما سجلته',revision:'نسخة الجلسة',reportScope:'هذه صياغة اللاعب واختياراته المسجلة، وليست حقائق يثبتها النظام تلقائيًا.',
      receipt:'إيصال قصصي',relates:'مرتبط بإيصال سابق',reportLink:'مراجعة النسخة المرتبطة',exportFailed:'تعذّر تنزيل السجل. لم تتغير حالة القضية.',
      exportScope:'الملف سجل للقراءة والاحتفاظ بنسخة، ولا يتيح استيراد الجلسة هنا.',
      noInput:'لا توجد قيم إضافية لهذا الاختيار.',yes:'نعم',no:'لا',
      sharedEntries:'مشاركات مسجلة',
      names:{noah:'نوح',elena:'إيلينا',claire:'كلير',jonas:'يوناس',mateo:'ماتيو',matteo:'ماتيو',victor:'فيكتور',assessment_review:'الجهة التي أصدرت التقييم',incident_followup:'الجهة المتابعة لواقعة المكتبة'}
    },
    en: {
      skip:'Skip to the case',title:'The case',back:'Return to the case page',language:'Display language',
      actions:'What would you like to do?',review:'Review your choice',materials:'Materials you have received',comparison:'Compare materials',firstMaterial:'First material',secondMaterial:'Second material',
      notebook:'Private notebook',notebookScope:'Notes are private to your case session on the server. They do not reach characters automatically. Unconfirmed text stays on this page only.',notesDownload:'Download my notes',notesDownloadScope:'The download includes confirmed notes only, not text you are still writing.',
      permissions:'Materials you shared',timeline:'Recording ranges you examined',reports:'Your report, recorded choices, and sources',receipts:'Receipts within the story',receiptScope:'A fictional receipt records delivery within the story. It does not mean delivery to a real organization or approval of a report’s accuracy.',
      refresh:'Refresh case state',export:'Download case record',loading:'Checking case availability',loadingBody:'This experience needs the case server.',
      unavailable:'The connected case is unavailable here',unavailableBody:'You can read the opening on the case page. This page cannot run the full case without its server and does not substitute a simulation.',retryConnection:'Check again',
      startTitle:'Begin a case session',startBody:'The server follows this session. Without an imported opening choice, you will choose your entry point in the scene.',start:'Start or resume my session',
      openingTitle:'Opening choice to import',openingScope:'This is a local opening choice, not proof of earlier delivery to the server. Your private notes are not included.',startWithOpening:'Start with this choice',startWithoutOpening:'Start without importing',openingInvalid:'The saved opening choice is not valid for this version and will not be imported. You can start without it.',openingChoice:'Selected response',openingRecipient:'Recipient selected in the opening',precise:'Precise clarification',wait:'Defer the response',refuse:'Decline to record for now',lie:'Deny the message',both:'Jonas and Claire',draft:'Draft only — no recipient',none:'No recipient',
      confirmed:'This step was saved on the experience server.',memory:'This session is held in server memory only; a restart may lose it. You can download a reading copy.',
      storagePaused:'Case changes paused because saving could not be confirmed',storageUnconfirmed:'The displayed state is read-only. The server has not confirmed saving the last action; retain its operation reference and check again after storage is restored.',saveUnconfirmed:'Saving is unconfirmed; this state is read-only until server storage recovers.',chooseRange:'Choose an earned range to review what it showed',
      pendingTitle:'The action’s outcome is not confirmed',pendingBody:'The server may have carried out your choice. The next retry uses the same operation rather than creating a new choice.',retryOperation:'Check the same operation',pendingBusy:'Carrying out your choice…',
      pendingCorruptTitle:'A previous operation record could not be read',pendingCorruptBody:'The original local record was left unchanged. Download it to keep a copy; this page cannot submit a new action until this situation is reviewed.',pendingDownload:'Download local operation record',
      pendingNoStorage:'This browser could not retain the operation reference. Keep the page open until its outcome is known.',
      conflict:'The case state changed. Refresh it, then review your choice again.',version:'The case session uses a different content version. Download any available record before continuing with another version.',
      rejected:'The server did not accept this action. Review the fields and available choices.',session:'The session could not be reached. Check the connection before retrying.',blocked:'The request origin could not be verified; the action was not confirmed.',
      error:'The request could not finish right now.',emptyMaterials:'You have not received materials yet.',chooseMaterial:'Choose a material',source:'Source',noSource:'No source is shown.',
      preview:'Review before confirming',confirm:'Confirm choice',edit:'Back to editing',choice:'Choice',fieldsScope:'These values will be sent to the case server. Review the recipient and sharing scope in the scene; private notes are not attached automatically.',
      sourceRefs:'Selected sources',noSelection:'Nothing selected',select:'Choose',unsupported:'This action needs an input type that this version does not support.',
      noNotes:'No confirmed notes yet.',noteUnavailable:'An add-note action appears when the scene makes it available.',noteAdded:'The session notebook was updated.',
      noActions:'There are no further choices in this scene.',updated:'The case state was updated.',languageChanged:'The display language changed without submitting a new choice.',
      recipient:'Recipient',shared:'Material shared within the story',recorded:'What you recorded',revision:'Session revision',reportScope:'These are the player’s recorded words and choices, not facts automatically established by the system.',
      receipt:'Fictional receipt',relates:'Related to an earlier receipt',reportLink:'Review the related version',exportFailed:'The record could not be downloaded. The case state did not change.',
      exportScope:'This file is a reading and backup copy. Importing a session is not supported here.',
      noInput:'This choice has no additional fields.',yes:'Yes',no:'No',
      sharedEntries:'recorded shares',
      names:{noah:'Noah',elena:'Elena',claire:'Claire',jonas:'Jonas',mateo:'Mateo',matteo:'Mateo',victor:'Victor',assessment_review:'The organization that issued the assessment',incident_followup:'The organization following up the library incident'}
    }
  };
  let lang = new URL(location.href).searchParams.get('lang') === 'en' ? 'en' : 'ar';
  let config = null, state = null, epoch = 0, busy = false, pending = null, corruptPending = null, review = null, openingImport = null, openingInvalid = false, pendingIssue = null;
  let banner = null;
  const drafts = new Map();
  const openMaterials = new Set();
  const openShares = new Set(),captureAnchors = new Map();
  let newlyEarned = new Set();
  const materialById = id => state?.materials.find(material => material.id === id);
  const tr = key => TEXT[lang][key] || key;
  const localized = value => typeof value === 'string' ? value : value && typeof value === 'object' ? (value[lang] || value.ar || value.en || '') : '';
  const timePattern = /\b\d{1,2}:\d{2}(?:\s*[–—-]\s*\d{1,2}:\d{2})?\b/g;
  const optionLabel = text => String(text).replace(timePattern,range => '\u2066' + range + '\u2069');
  function displayText(node, value) {
    const text = String(value);let start = 0;node.replaceChildren();
    for (const match of text.matchAll(timePattern)) {
      node.append(document.createTextNode(text.slice(start,match.index)));
      const range = document.createElement('bdi');range.dir = 'ltr';range.textContent = match[0];node.append(range);start = match.index + match[0].length;
    }
    node.append(document.createTextNode(text.slice(start)));
  }
  const element = (tag, text, className) => {
    const node = document.createElement(tag);
    if (text !== undefined) displayText(node,text);
    if (className) node.className = className;
    return node;
  };
  const button = (id, text, handler, primary = false) => {
    const node = element('button', text, primary ? 'primary' : '');
    node.type = 'button';if (id) node.id = id;node.addEventListener('click', handler);return node;
  };
  const domId = (prefix, value) => prefix + '-' + encodeURIComponent(String(value));
  const announce = text => { $('announcement').textContent = text; };
  const focus = id => {
    const node = $(id);if (!node) return;
    if (node instanceof HTMLDetailsElement) node.open = true;
    for (let parent = node.parentElement; parent; parent = parent.parentElement) if (parent instanceof HTMLDetailsElement) parent.open = true;
    node.focus({preventScroll:true});
    const rect = node.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > innerHeight) node.scrollIntoView({block:'nearest',behavior:'instant'});
  };
  const safeImage = value => {
    if (typeof value !== 'string' || !/^\/raven\/deleted-name\/assets\/(?:scenes|characters)\/[a-zA-Z0-9_-]+\.(?:webp|png|jpg)$/.test(value)) return null;
    return value;
  };
  function artwork(item) {
    const src = safeImage(item?.image);if (!src) return null;
    const figure = element('figure', undefined, 'case-art');figure.setAttribute('aria-hidden','true');
    const image = element('img');image.src = src;image.alt = '';image.loading = 'lazy';image.decoding = 'async';
    if (Number.isInteger(item.imageRow) && item.imageRow >= 0 && item.imageRow <= 2) {
      figure.classList.add('case-art-atlas');figure.style.setProperty('--image-top', String(item.imageRow * -100) + '%');
    }
    figure.append(image);return figure;
  }
  function pair(list, label, value) {
    const group = element('div');group.append(element('dt',label));
    const description = element('dd');if (value instanceof Node) description.append(value);else description.textContent = value;
    group.append(description);list.append(group);
  }
  function sourceLink(id) {
    const material = materialById(id);if (!material) return element('span',String(id));
    const link = element('a',localized(material.title));link.href = '#' + domId('material',id);
    link.addEventListener('click',event => {event.preventDefault();focus(domId('material',id));});return link;
  }
  function download(value, name) {
    const blob = new Blob([typeof value === 'string' ? value : JSON.stringify(value,null,2) + '\n'],{type:'application/json'});
    const url = URL.createObjectURL(blob),link = element('a');link.href = url;link.download = name;link.click();setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  function readPending() {
    let raw;
    try {raw = sessionStorage.getItem(PENDING_KEY);} catch {return;}
    if (!raw) return;
    try {
      const value = JSON.parse(raw);
      if (!value || Object.keys(value).some(key => !['id','revision','contentVersion','actionId','values'].includes(key)) || typeof value.id !== 'string' || !Number.isInteger(value.revision) || value.revision < 0 || typeof value.contentVersion !== 'string' || typeof value.actionId !== 'string' || !value.values || typeof value.values !== 'object' || Array.isArray(value.values)) throw new Error('Invalid operation record');
      pending = value;
    } catch {corruptPending = raw;}
  }
  function readOpening() {
    if (new URL(location.href).searchParams.get('opening') === 'none') return;
    let raw;try {raw = sessionStorage.getItem(OPENING_KEY);} catch {return;}
    if (!raw) return;
    try {
      const value = JSON.parse(raw);
      const choices = ['precise','wait','refuse','lie'];
      if (!value || Array.isArray(value) || Object.keys(value).some(key => !['version','choice','recipient'].includes(key)) || value.version !== 'paper-opening-2026-11-05-r2' || !choices.includes(value.choice)) throw new Error('Invalid opening choice');
      const written = ['precise','lie'].includes(value.choice);
      if (written ? !['jonas','both','draft'].includes(value.recipient) : value.recipient !== null) throw new Error('Invalid recipient');
      openingImport = {version:value.version,choice:value.choice,recipient:value.recipient};
    } catch {openingInvalid = true;}
  }
  function keepPending(value) {
    pending = value;
    try {sessionStorage.setItem(PENDING_KEY,JSON.stringify(value));return true;} catch {return false;}
  }
  function clearPending() {
    pending = null;pendingIssue = null;
    try {sessionStorage.removeItem(PENDING_KEY);} catch { /* No other browser data is touched. */ }
  }
  function pendingBanner() {
    if (corruptPending !== null) return {title:'pendingCorruptTitle',message:'pendingCorruptBody',kind:'corrupt'};
    if (state?.readOnly || state?.storageUnavailable || state?.saveStatus === 'unconfirmed') return {title:'storagePaused',message:'storageUnconfirmed',kind:'storage'};
    if (pending) return {title:busy ? 'pendingBusy' : 'pendingTitle',message:pendingIssue || 'pendingBody',kind:'pending'};
    return banner;
  }
  function renderBanner() {
    const display = pendingBanner();$('connection').hidden = !display;
    if (!display) {$('connection-actions').replaceChildren();return;}
    $('connection-title').textContent = tr(display.title);$('connection-message').textContent = tr(display.message);
    const actions = $('connection-actions');actions.replaceChildren();
    if (display.kind === 'pending') actions.append(button('operation-retry',tr('retryOperation'),retryPending));
    if (display.kind === 'corrupt') actions.append(button('pending-download',tr('pendingDownload'),() => download(corruptPending,'raven-pending-operation.json')));
    if (display.kind === 'storage') {
      actions.append(button('storage-refresh',tr('refresh'),refresh));
      if (pending) actions.append(button('pending-download',tr('pendingDownload'),() => download(pending,'raven-pending-operation.json')));
    }
    if (display.kind === 'start') {
      if (openingImport) {
        const summary = element('section',undefined,'opening-summary');summary.id = 'opening-summary';
        summary.append(element('h3',tr('openingTitle')),element('p',tr('openingScope'),'muted'));
        const list = element('dl');pair(list,tr('openingChoice'),tr(openingImport.choice));pair(list,tr('openingRecipient'),openingImport.recipient === 'jonas' ? TEXT[lang].names.jonas : tr(openingImport.recipient || 'none'));summary.append(list);actions.append(summary);
        actions.append(button('case-start',tr('startWithOpening'),() => startSession(true),true),button('case-start-without-opening',tr('startWithoutOpening'),() => startSession(false)));
      } else {
        if (openingInvalid) {const note = element('p',tr('openingInvalid'),'muted');note.id = 'opening-warning';actions.append(note);}
        actions.append(button('case-start',tr('start'),() => startSession(false),true));
      }
    }
    if (['unavailable','error'].includes(display.kind)) actions.append(button('connection-retry',tr('retryConnection'),connect));
    for (const node of actions.querySelectorAll('button')) node.disabled = busy;
  }
  function setBusy(value) {
    busy = value;document.body.setAttribute('aria-busy',String(value));
    const locked = busy || Boolean(pending) || corruptPending !== null || Boolean(state?.readOnly || state?.storageUnavailable || state?.saveStatus === 'unconfirmed');
    for (const control of document.querySelectorAll('#actions input,#actions textarea,#actions select,#actions button,#notebook-actions input,#notebook-actions textarea,#notebook-actions select,#notebook-actions button,#review-actions button')) control.disabled = locked;
    $('state-refresh').disabled = busy;$('case-export').disabled = busy;renderBanner();
  }
  class ApiError extends Error {
    constructor(status,code) {super(code);this.status = status;this.code = code;}
  }
  async function request(path, method = 'GET', data) {
    const controller = new AbortController(),timer = setTimeout(() => controller.abort(),18000);
    try {
      const response = await fetch(API + path,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(data ? {'Content-Type':'application/json'} : {})},body:data ? JSON.stringify(data) : undefined,signal:controller.signal});
      if (!(response.headers.get('content-type') || '').includes('application/json')) throw new ApiError(response.status || 503,'case_unavailable');
      const value = await response.json();
      if (!response.ok) throw new ApiError(response.status,value?.error || 'unavailable');
      return value;
    } finally {clearTimeout(timer);}
  }
  function validProjection(value) {
    return value && typeof value.caseId === 'string' && typeof value.contentVersion === 'string' && Number.isInteger(value.revision) && value.scene && typeof value.scene.id === 'string' && Array.isArray(value.materials) && Array.isArray(value.actions);
  }
  function receive(value, moveFocus = false) {
    if (!validProjection(value)) throw new ApiError(503,'case_unavailable');
    newlyEarned = new Set(state ? value.materials.filter(material => !state.materials.some(previous => previous.id === material.id)).map(material => material.id) : []);
    state = {...value,notes:Array.isArray(value.notes) ? value.notes : [],shares:Array.isArray(value.shares) ? value.shares : [],receipts:Array.isArray(value.receipts) ? value.receipts : [],captures:value.captures && typeof value.captures === 'object' ? value.captures : {}};
    review = null;banner = null;render();
    if (moveFocus) focus('scene-title');announce(tr('updated'));
  }
  async function connect() {
    const token = ++epoch;banner = {title:'loading',message:'loadingBody',kind:'loading'};setBusy(true);
    try {
      const result = await request('config');if (token !== epoch) return;
      if (!result?.enabled || typeof result.contentVersion !== 'string') throw new ApiError(503,'case_unavailable');
      config = result;
      try {const current = await request('state');if (token !== epoch) return;receive(current);}
      catch (error) {
        if (token !== epoch) return;
        if (error.status === 401 && !pending) {state = null;banner = {title:'startTitle',message:'startBody',kind:'start'};$('case-app').hidden = true;}
        else throw error;
      }
    } catch {if (token === epoch) banner = {title:'unavailable',message:'unavailableBody',kind:'unavailable'};}
    finally {if (token === epoch) setBusy(false);}
  }
  async function startSession(importOpening = false) {
    if (!config || busy || pending || corruptPending !== null) return;
    const token = ++epoch;setBusy(true);
    try {
      const result = await request('start','POST',{contentVersion:config.contentVersion,...(importOpening && openingImport ? {opening:openingImport} : {})});
      if (token !== epoch) return;receive(result,true);
    } catch {if (token === epoch) banner = {title:'error',message:'session',kind:'error'};}
    finally {if (token === epoch) setBusy(false);}
  }
  function errorMessage(error) {
    return ({revision_conflict:'conflict',content_version_mismatch:'version',request_id_conflict:'conflict',invalid_request:'rejected',session_unavailable:'session',cross_site:'blocked'})[error.code] || 'error';
  }
  async function sendPending() {
    if (!pending || busy || corruptPending !== null || state?.readOnly || state?.storageUnavailable || state?.saveStatus === 'unconfirmed') return;
    const operation = pending,token = ++epoch;setBusy(true);
    try {
      const result = await request('actions','POST',operation);
      if (token !== epoch) return;
      if (!validProjection(result)) throw new ApiError(503,'case_unavailable');
      clearPending();drafts.delete(operation.actionId);receive(result,operation.actionId !== 'case.note');
      if (operation.actionId === 'case.note') {focus(domId('action','case.note'));announce(tr('noteAdded'));}
    } catch (error) {
      if (token !== epoch) return;
      // A rejected request is distinct from a lost response. Never rebase and
      // resubmit a possibly completed operation under a fresh identifier.
      if (error instanceof ApiError && [400,403].includes(error.status)) {
        clearPending();banner = {title:'error',message:errorMessage(error),kind:'error'};
      } else if (error instanceof ApiError && error.code === 'revision_conflict') {
        clearPending();banner = {title:'error',message:'conflict',kind:'error'};
      } else if (error instanceof ApiError && [401,409].includes(error.status)) {
        pendingIssue = errorMessage(error);
      }
      announce(pending ? tr('pendingBody') : tr(banner?.message || 'error'));
    } finally {if (token === epoch) setBusy(false);}
  }
  function retryPending() {return sendPending();}
  function submitAction(action, values) {
    if (!state || busy || pending || corruptPending !== null || state.readOnly || state.storageUnavailable || state.saveStatus === 'unconfirmed') return;
    const operation = {id:crypto.randomUUID(),revision:state.revision,contentVersion:state.contentVersion,actionId:action.id,values};
    const saved = keepPending(operation);if (!saved) announce(tr('pendingNoStorage'));
    review = null;$('review-panel').hidden = true;void sendPending();
  }
  function valuesFrom(form, fields) {
    const values = {};
    for (const field of fields) {
      if (field.type === 'materialRefs') values[field.id] = [...form.querySelectorAll('input[type="checkbox"]')].filter(node => node.dataset.fieldId === field.id && node.checked).map(node => node.value);
      else {
        const input = [...form.elements].find(node => node.dataset.fieldId === field.id);
        if (input && (input.value !== '' || field.required)) values[field.id] = input.value;
      }
    }
    return values;
  }
  function valueView(value, field) {
    if (Array.isArray(value)) {
      const list = element('ul',undefined,'source-list');
      for (const item of value) {const row = element('li');row.append(typeof item === 'string' ? sourceLink(item) : element('span',String(item)));list.append(row);}
      return value.length ? list : element('span',tr('noSelection'));
    }
    if (field?.type === 'select') {const option = field.options?.find(item => item.value === value);if (option) return element('span',localized(option.label));}
    if (typeof value === 'string' && materialById(value)) return sourceLink(value);
    return element('span',typeof value === 'boolean' ? tr(value ? 'yes' : 'no') : value == null ? tr('noSelection') : String(value));
  }
  function renderReview() {
    $('review-panel').hidden = !review;if (!review) return;
    const body = $('review-body');body.replaceChildren(element('p',localized(review.action.label)),element('p',tr('fieldsScope'),'muted'));
    const list = element('dl');for (const field of review.action.fields || []) pair(list,localized(field.label),valueView(review.values[field.id],field));
    body.append(list);
    $('review-actions').replaceChildren(button('review-confirm',tr('confirm'),() => {
      if (!review || review.revision !== state.revision || review.contentVersion !== state.contentVersion) {review = null;renderReview();announce(tr('conflict'));return;}
      submitAction(review.action,review.values);
    },true),button('review-edit',tr('edit'),() => {const id = domId('action',review.action.id);review = null;renderReview();focus(id);}));
  }
  function renderAction(action, parent) {
    if (typeof action.id !== 'string') return;
    const fields = Array.isArray(action.fields) ? action.fields : [];
    const form = element('form',undefined,'choice');form.dataset.actionId = action.id;form.id = domId('action',action.id);form.tabIndex = -1;
    const cached = drafts.get(action.id) || {};
    if (fields.length) form.append(element('h3',localized(action.label)));
    let supported = true;
    fields.forEach((field,index) => {
      const id = domId('field',action.id + ':' + field.id),name = field.id;
      if (typeof name !== 'string' || !['text','textarea','select','materialRefs'].includes(field.type)) {supported = false;return;}
      if (field.type === 'materialRefs') {
        const group = element('fieldset');group.append(element('legend',localized(field.label)));
        const options = Array.isArray(field.options) ? field.options : state.materials.map(material => ({value:material.id,label:material.title}));
        for (const option of options) {
          if (!materialById(option.value)) continue;
          const label = element('label',undefined,'check-label'),input = element('input');input.type = 'checkbox';input.id = id + ':' + index + ':' + encodeURIComponent(option.value);input.value = option.value;input.dataset.fieldId = name;input.checked = Array.isArray(cached[name]) && cached[name].includes(option.value);
          label.append(input,element('span',localized(option.label)));group.append(label);
        }
        form.append(group);return;
      }
      const label = element('label',localized(field.label));label.htmlFor = id;
      const input = element(field.type === 'textarea' ? 'textarea' : field.type === 'select' ? 'select' : 'input');input.id = id;input.name = name;input.dataset.fieldId = name;input.required = Boolean(field.required);
      if (field.type === 'select') {
        input.append(new Option(tr('select'),''));
        for (const option of field.options || []) if (typeof option.value === 'string') input.append(new Option(optionLabel(localized(option.label)),option.value));
      } else {input.maxLength = Number.isInteger(field.maxLength) ? Math.min(2000,field.maxLength) : 2000;input.dir = 'auto';if (field.type === 'textarea') input.rows = 4;else input.type = 'text';}
      input.value = typeof cached[name] === 'string' ? cached[name] : '';form.append(label,input);
    });
    if (!supported) {form.append(element('p',tr('unsupported')));parent.append(form);return;}
    const submit = element('button',fields.length ? tr('preview') : localized(action.label),'primary');submit.type = 'submit';submit.dataset.actionId = action.id;form.append(submit);
    const remember = () => drafts.set(action.id,valuesFrom(form,fields));form.addEventListener('input',remember);form.addEventListener('change',remember);
    form.addEventListener('submit',event => {
      event.preventDefault();if (busy || pending || corruptPending !== null || !form.reportValidity()) return;
      const values = valuesFrom(form,fields);drafts.set(action.id,values);
      if (fields.some(field => field.required && field.type === 'materialRefs' && !values[field.id]?.length)) {announce(tr('rejected'));form.querySelector('input[type="checkbox"]')?.focus();return;}
      if (!fields.length) {submitAction(action,values);return;}
      review = {action,values:JSON.parse(JSON.stringify(values)),revision:state.revision,contentVersion:state.contentVersion};renderReview();focus('review-title');
    });
    parent.append(form);
  }
  function renderMaterials() {
    const list = $('materials-list');
    for (const previous of list.querySelectorAll('details[data-material-id]')) {
      if (previous.open) openMaterials.add(previous.dataset.materialId);else openMaterials.delete(previous.dataset.materialId);
    }
    list.replaceChildren();
    if (!state.materials.length) list.append(element('p',tr('emptyMaterials'),'muted'));
    for (const material of state.materials) {
      const row = element('details',undefined,'material');row.id = domId('material',material.id);row.tabIndex = -1;row.dataset.materialId = material.id;
      row.open = openMaterials.has(material.id) || newlyEarned.has(material.id);
      const summary = element('summary',localized(material.title));summary.id = domId('material-summary',material.id);row.append(summary);
      row.addEventListener('toggle',() => {if (row.isConnected) {if (row.open) openMaterials.add(material.id);else openMaterials.delete(material.id);}});
      const picture = artwork(material);if (picture) row.append(picture);
      row.append(element('p',localized(material.body),'material-text'),element('p',tr('source') + ': ' + (localized(material.source) || tr('noSource')),'muted'));list.append(row);
    }
    newlyEarned.clear();
    for (const id of ['compare-a','compare-b']) {
      const select = $(id),previous = select.value;select.replaceChildren(new Option(tr('chooseMaterial'),''));
      for (const material of state.materials) select.append(new Option(optionLabel(localized(material.title)),material.id));
      select.value = previous;
    }
    renderComparison();
  }
  function renderComparison() {
    const body = $('comparison-body');body.replaceChildren();
    for (const id of ['compare-a','compare-b']) {
      const material = materialById($(id).value);if (!material) continue;
      const column = element('section');column.append(element('h3',localized(material.title)),element('blockquote',localized(material.body)),element('p',localized(material.source),'muted'));body.append(column);
    }
  }
  function renderNotes() {
    const list = $('notes-list');list.replaceChildren();
    for (const note of state.notes) {const item = element('li');item.append(element('p',String(note.text || '')),sourceLink(note.sourceId));list.append(item);}
    if (!state.notes.length) list.append(element('li',tr('noNotes'),'muted'));
    $('notes-download').disabled = !state.notes.length;
  }
  function renderShares() {
    const body = $('permissions-body');
    for (const previous of body.querySelectorAll('details[data-recipient]')) {
      if (previous.open) openShares.add(previous.dataset.recipient);else openShares.delete(previous.dataset.recipient);
    }
    body.replaceChildren();$('permissions-panel').hidden = !state.shares.length;
    const groups = new Map();
    for (const share of state.shares) {if (!groups.has(share.recipient)) groups.set(share.recipient,[]);groups.get(share.recipient).push(share);}
    for (const [recipient,shares] of groups) {
      const group = element('details');group.dataset.recipient = recipient;group.open = openShares.has(recipient);
      const summary = element('summary',(TEXT[lang].names[recipient] || String(recipient)) + ' — ' + shares.length + ' ' + tr('sharedEntries'));summary.id = domId('shares-summary',recipient);group.append(summary);
      const list = element('ul',undefined,'shared-materials');
      for (const share of shares) {const row = element('li');row.append(sourceLink(share.materialId),element('span',tr('revision') + ': ' + share.revision,'muted'));list.append(row);}
      group.append(list);group.addEventListener('toggle',() => {if (group.isConnected) {if (group.open) openShares.add(recipient);else openShares.delete(recipient);}});body.append(group);
    }
  }
  function renderTimeline() {
    const recordings = state.materials.filter(material => material.type === 'recording');
    const previous = $('timeline-range')?.value || '',body = $('timeline-body');body.replaceChildren();$('timeline-panel').hidden = !recordings.length;
    if (!recordings.length) return;
    const label = element('label',tr('chooseRange'));label.htmlFor = 'timeline-range';
    const select = element('select');select.id = 'timeline-range';select.append(new Option(tr('select'),''));
    for (const recording of recordings) select.append(new Option(optionLabel(localized(recording.title)),recording.id));
    select.value = previous;const inspection = element('article',undefined,'timeline-event');inspection.id = 'timeline-inspection';
    const show = () => {
      inspection.replaceChildren();const recording = recordings.find(item => item.id === select.value);inspection.hidden = !recording;
      if (recording) inspection.append(element('h3',localized(recording.title)),element('p',localized(recording.body),'material-text'),sourceLink(recording.id));
    };
    select.addEventListener('change',show);body.append(label,select,inspection);show();
  }
  function renderCaptures() {
    const body = $('reports-body');body.replaceChildren();const captures = Object.entries(state.captures);$('reports-panel').hidden = !captures.length;
    captureAnchors.clear();const versions = new Map();
    if (captures.length) body.append(element('p',tr('reportScope'),'muted'));
    for (const [key,capture] of captures) {
      // The API can expose both the current capture and its immutable receipt
      // snapshot. One identical version needs one card, with both links intact.
      const signature = JSON.stringify([capture.actionId,capture.revision,capture.values]);
      if (versions.has(signature)) {captureAnchors.set(key,versions.get(signature));continue;}
      const article = element('article',undefined,'material');article.id = domId('capture',key);article.tabIndex = -1;
      versions.set(signature,article.id);captureAnchors.set(key,article.id);
      article.append(element('h3',localized(capture.label || capture.title) || tr('recorded')),element('p',tr('revision') + ': ' + String(capture.revision),'muted'));
      const list = element('dl');
      for (const [fieldId,value] of Object.entries(capture.values || {})) {
        const field = Array.isArray(capture.fields) ? capture.fields.find(item => item.id === fieldId) : null;
        pair(list,localized(field?.label) || (Array.isArray(value) ? tr('sourceRefs') : tr('recorded')),valueView(value,field));
      }
      article.append(list);body.append(article);
    }
  }
  function renderReceipts() {
    const receipts = state.receipts.filter(receipt => receipt.scope === 'story-only');
    const body = $('receipts-body');body.replaceChildren();$('receipts-panel').hidden = !receipts.length;
    for (const receipt of receipts) {
      const article = element('article',undefined,'material');article.id = domId('receipt',receipt.id);article.tabIndex = -1;
      article.append(element('h3',tr('receipt') + ' — ' + localized(receipt.title)));
      const list = element('dl');pair(list,tr('revision'),String(receipt.revision));pair(list,tr('receipt'),String(receipt.id));article.append(list);
      if (receipt.fromCapture && state.captures[receipt.fromCapture]) {const target = captureAnchors.get(receipt.fromCapture);const link = element('a',tr('reportLink'));link.href = '#' + target;link.addEventListener('click',event => {event.preventDefault();focus(target);});article.append(link);}
      if (receipt.relatesTo) article.append(element('p',tr('relates') + ': ' + String(receipt.relatesTo)));
      body.append(article);
    }
  }
  function render() {
    document.documentElement.lang = lang;document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';document.title = 'RAVEN — ' + tr('title');
    for (const node of document.querySelectorAll('[data-ui]')) node.textContent = tr(node.dataset.ui);
    $('language-controls').setAttribute('aria-label',tr('language'));
    for (const language of ['ar','en']) $('language-' + language).setAttribute('aria-pressed',String(lang === language));
    $('home-link').href = '../../' + (lang === 'en' ? '?lang=en' : '');$('case-link').href = '../' + (lang === 'en' ? '?lang=en' : '');
    $('case-app').hidden = !state;renderBanner();if (!state) return;
    $('save-status').textContent = state.readOnly || state.storageUnavailable || state.saveStatus === 'unconfirmed' ? tr('saveUnconfirmed') : state.persistence === 'disk-file' && state.saveStatus === 'confirmed' ? tr('confirmed') : state.persistence === 'process-memory' && state.saveStatus === 'memory' ? tr('memory') : tr('saveUnconfirmed');
    displayText($('scene-title'),localized(state.scene.title));$('scene-label').textContent = '';
    const prose = $('scene-body');prose.replaceChildren();if (localized(state.scene.body)) prose.append(element('p',localized(state.scene.body)));
    for (const line of state.scene.lines || []) {const speech = element('div',undefined,'speech');if (localized(line.speaker)) speech.append(element('span',localized(line.speaker),'speaker'));speech.append(element('p',localized(line.text)));prose.append(speech);}
    const art = $('scene-art');art.replaceChildren();const picture = artwork(state.scene);if (picture) art.append(picture);
    $('actions').replaceChildren();$('notebook-actions').replaceChildren();
    for (const action of state.actions) renderAction(action,$(action.id === 'case.note' ? 'notebook-actions' : 'actions'));
    if (!state.actions.some(action => action.id !== 'case.note')) $('actions').append(element('p',tr('noActions'),'muted'));
    if (!state.actions.some(action => action.id === 'case.note')) $('notebook-actions').append(element('p',tr('noteUnavailable'),'muted'));
    renderMaterials();renderNotes();renderShares();renderTimeline();renderCaptures();renderReceipts();renderReview();setBusy(busy);
  }
  function changeLanguage(language) {
    if (!['ar','en'].includes(language) || language === lang) return;
    const previous = document.activeElement?.id,selection = document.activeElement instanceof HTMLTextAreaElement ? [document.activeElement.selectionStart,document.activeElement.selectionEnd] : null;
    lang = language;++epoch;busy = false;
    const url = new URL(location.href);if (lang === 'en') url.searchParams.set('lang','en');else url.searchParams.delete('lang');history.replaceState(history.state,'',url);
    render();if (previous && $(previous)) {$(previous).focus({preventScroll:true});if (selection && $(previous) instanceof HTMLTextAreaElement) $(previous).setSelectionRange(...selection);}
    announce(tr('languageChanged'));if (!state) void connect();
  }
  async function refresh() {
    if (busy) return;const token = ++epoch;setBusy(true);
    try {const result = await request('state');if (token === epoch) receive(result,true);}
    catch (error) {if (token === epoch) {banner = {title:'error',message:errorMessage(error),kind:'error'};announce(tr(banner.message));}}
    finally {if (token === epoch) setBusy(false);}
  }
  async function exportCase() {
    if (!state || busy) return;const token = epoch;
    try {const record = await request('export');if (token !== epoch) return;download(record,'raven-case-record.json');announce(tr('exportScope'));}
    catch {if (token === epoch) announce(tr('exportFailed'));}
  }
  for (const language of ['ar','en']) $('language-' + language).addEventListener('click',() => changeLanguage(language));
  for (const id of ['compare-a','compare-b']) $(id).addEventListener('change',renderComparison);
  $('state-refresh').addEventListener('click',refresh);$('case-export').addEventListener('click',exportCase);
  $('notes-download').addEventListener('click',() => {if (state) download({caseId:state.caseId,contentVersion:state.contentVersion,scope:'private-case-notes',notes:state.notes},'raven-private-case-notes.json');});
    readPending();readOpening();render();void connect();
})();

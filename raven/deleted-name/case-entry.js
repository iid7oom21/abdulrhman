// The static opening remains local. Continuing explicitly offers its small,
// versioned choice summary to the separate written-case session.
(() => {
  'use strict';
  const hook = document.getElementById('hook');
  const ending = document.getElementById('hook-ending');
  if (!hook || !ending) return;
  const key = 'raven.case.opening.v1';
  let availability = null;
  let pending = null;
  const english = () => document.documentElement.lang === 'en';
  function snapshot() {
    const choice = hook.dataset.choice;
    if (!['precise','wait','refuse','lie'].includes(choice)) return null;
    const written = ['precise','lie'].includes(choice);
    const recipient = written ? hook.dataset.share : null;
    if (written && !['jonas','both','draft'].includes(recipient)) return null;
    return {version:'paper-opening-2026-11-05-r2',choice,recipient};
  }
  function render() {
    const restoreFocus = document.activeElement?.id === 'case-continue-link';
    document.getElementById('case-continuation')?.remove();
    if (hook.dataset.phase !== 'done' || !availability?.enabled) return;
    const box = document.createElement('section');
    box.id = 'case-continuation';
    box.className = 'hook-review';
    const title = document.createElement('h3');
    title.textContent = english() ? 'Continue the case' : 'متابعة القضية';
    const note = document.createElement('p');
    note.textContent = english()
      ? 'Review your opening choice before continuing into the written case. A private draft stays private. Any receipt belongs to the story.'
      : 'راجع اختيارك من الافتتاح قبل متابعة القضية المكتوبة. المسودة الخاصة تبقى خاصة، وأي إيصال لاحق يخص أحداث القصة.';
    const link = document.createElement('button');
    link.type = 'button';
    link.id = 'case-continue-link';
    link.textContent = english() ? 'Continue from this opening' : 'أكمل من هذا الافتتاح';
    link.addEventListener('click', () => {
      const value = snapshot();
      try { if (value) sessionStorage.setItem(key, JSON.stringify(value)); }
      catch {
        note.textContent = english()
          ? 'Your browser could not keep the choice summary. Open the case and choose how to continue there.'
          : 'تعذّر الاحتفاظ بملخص الاختيار في المتصفح. افتح القضية واختر طريقة المتابعة هناك.';
        if (!box.querySelector('[data-case-without-import]')) {
          const direct = document.createElement('a');
          direct.dataset.caseWithoutImport = '';
          direct.href = './play/?opening=none' + (english() ? '&lang=en' : '');
          direct.textContent = english() ? 'Open the case' : 'افتح القضية';
          box.append(direct);
          direct.focus();
        }
        return;
      }
      // A button stores the summary before invoking the persistent shell route.
      const target = new URL('./play/' + (english() ? '?lang=en' : ''), location.href).href;
      if (!window.ravenNavigate?.(target)) location.assign(target);
    });
    box.append(title, note, link);
    ending.append(box);
    if (restoreFocus) link.focus({preventScroll:true});
  }
  function inspect() {
    if (hook.dataset.phase !== 'done') return;
    if (availability !== null) { render(); return; }
    if (pending) return;
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch('/api/case/config', {credentials:'same-origin',cache:'no-store',signal:controller.signal});
        availability = response.ok && response.headers.get('content-type')?.includes('application/json')
          ? await response.json() : {enabled:false};
      } catch { availability = {enabled:false}; }
      finally { clearTimeout(timer); pending = null; render(); }
    })();
  }
  hook.addEventListener('raven:opening-render', inspect);
  document.addEventListener('raven:language', render);
  inspect();
})();

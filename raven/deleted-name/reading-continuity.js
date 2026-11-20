/* Presentation memory only: no game writes, persistence, requests or replayed actions. */
(() => {
  'use strict';
  const hook = document.getElementById('hook');
  if (!hook) return;
  const parts = new Set(['original', 'conclusion', 'signature']);
  let sceneRun = hook.dataset.sceneRun;
  let selectedPart = null, lastReadingView = null, noteCaret = null, pending = null;
  let inspected = false, goalOpen = true, contextOpen = false;
  let generation = 0, restoring = false;

  function synchronizeRun() {
    if (sceneRun === hook.dataset.sceneRun) return;
    sceneRun = hook.dataset.sceneRun;
    selectedPart = null; lastReadingView = null; noteCaret = null; pending = null;
    inspected = false; goalOpen = true; contextOpen = false;
    generation++;
  }
  function showSelection() {
    synchronizeRun();
    for (const part of parts) {
      const button = hook.querySelector('[data-hook-action="source-' + part + '"]');
      if (!button) continue;
      if (part === selectedPart) {
        button.dataset.readingSelected = 'true';
        button.setAttribute('aria-current', 'true');
      } else {
        delete button.dataset.readingSelected;
        button.removeAttribute('aria-current');
      }
    }
    renderPaperTools();
  }
  function disclosure(id, label, open, remember) {
    const box = document.createElement('details');
    box.className = 'paper-disclosure';
    box.id = id;
    const title = document.createElement('summary');
    title.id = id + '-toggle';
    title.textContent = label;
    box.append(title);
    box.open = open;
    box.addEventListener('toggle', () => { if (box.isConnected) remember(box.open); });
    return box;
  }
  function renderPaperTools() {
    const paper = document.getElementById('hook-document');
    if (!paper) return;
    const en = document.documentElement.lang === 'en';
    const goal = document.getElementById('paper-goal');
    if (inspected || hook.dataset.phase !== 'compare') goal?.remove();
    else if (!goal) {
      const hint = disclosure('paper-goal', en ? 'What am I checking?' : 'وش أراجع؟', goalOpen, open => { goalOpen = open; });
      const text = document.createElement('p');
      text.textContent = en ? 'Pick a line you want to ask Jonas about.' : 'اختر السطر اللي تبي تسأل يوناس عنه.';
      hint.append(text);
      paper.querySelector('dl').before(hint);
    }
    if (!selectedPart) return;
    let box = document.getElementById('paper-context');
    if (!box) {
      box = disclosure('paper-context', '', contextOpen, open => { contextOpen = open; });
      box.append(document.createElement('ol'));
      document.getElementById('hook-source-note').after(box);
    }
    // Both lists are already available to this reader. Stay inside the selected source.
    const message = selectedPart === 'original';
    const rows = message ? [...document.querySelectorAll('#assignment-stage .thread > .msg')] : [...paper.querySelectorAll(':scope > dl > div')];
    const index = rows.findIndex(row => message ? row.querySelector('[data-k="m2"]') : row.querySelector('[data-part="' + selectedPart + '"]'));
    if (index < 0) { box.remove(); return; }
    box.firstElementChild.textContent = message
      ? (en ? 'Read this line in the earlier conversation' : 'اقرأ السطر في سياق المراسلة')
      : (en ? 'Read this line in the draft' : 'اقرأ السطر في سياق المسودة');
    const list = box.querySelector('ol');
    list.replaceChildren();
    for (const row of rows.slice(Math.max(0, index - 1), index + 2)) {
      const item = document.createElement('li');
      const label = document.createElement('strong');
      const text = document.createElement('p');
      label.textContent = row.querySelector(message ? '.who' : 'dt').textContent;
      text.textContent = row.querySelector(message ? 'p' : 'dd button').textContent;
      if (row === rows[index]) item.setAttribute('aria-current', 'true');
      item.append(label, text);
      list.append(item);
    }
  }
  function rememberCaret(target = document.activeElement) {
    if (target?.id !== 'reading-note') return;
    noteCaret = { value: target.value, start: target.selectionStart, end: target.selectionEnd, direction: target.selectionDirection };
  }
  function restoreCaret(saved) {
    const input = document.getElementById('reading-note');
    if (!saved || !input || input.value !== saved.value) return;
    input.setSelectionRange(saved.start, saved.end, saved.direction || 'none');
  }
  function readingView() {
    if (document.getElementById('opening-card-dialog')?.open) return null;
    const selectors = [
      '#hook-document > h3',
      ...Array.from(parts, part => '#hook-document [data-part="' + part + '"]'),
      '#hook-comparison > section:nth-of-type(1)', '#hook-comparison > section:nth-of-type(2)',
      '#reading-summary', '#reading-source-preview', '#reading-note', '#reading-notes',
      '#hook-draft', '#hook-share-review'
    ];
    let best = null;
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (!element || !element.getClientRects().length) continue;
      const rect = element.getBoundingClientRect();
      if (rect.bottom <= 80 || rect.top >= innerHeight - 40) continue;
      const distance = Math.abs(rect.top - 120);
      if (!best || distance < best.distance) best = { selector, top: rect.top, left: scrollX, distance };
    }
    return best;
  }
  function dialogView() {
    if (!document.getElementById('opening-card-dialog')?.open) return null;
    return ['#opening-card-dialog', '.card-dialog-inner', '.card-dialog-body'].map(selector => {
      const element = document.querySelector(selector);
      return element ? { selector, top: element.scrollTop, left: element.scrollLeft } : null;
    }).filter(Boolean);
  }
  function captureLanguage() {
    synchronizeRun();
    goalOpen = document.getElementById('paper-goal')?.open ?? goalOpen;
    contextOpen = document.getElementById('paper-context')?.open ?? contextOpen;
    rememberCaret();
    if (pending?.run === sceneRun) return;
    const current = readingView();
    if (current) lastReadingView = current;
    pending = { run: sceneRun, phase: hook.dataset.phase, view: current || lastReadingView, caret: noteCaret, dialog: dialogView() };
  }
  function finishLanguage() {
    const captured = pending;
    if (!captured) return;
    const token = ++generation;
    requestAnimationFrame(() => {
      if (token !== generation || captured !== pending) return;
      pending = null;
      if (captured.run !== hook.dataset.sceneRun || captured.phase !== hook.dataset.phase) return;
      restoring = true;
      restoreCaret(captured.caret);
      if (captured.dialog && document.getElementById('opening-card-dialog')?.open) {
        for (const position of captured.dialog) {
          const element = document.querySelector(position.selector);
          if (element) { element.scrollTop = position.top; element.scrollLeft = position.left; }
        }
      } else if (captured.view && !document.getElementById('opening-card-dialog')?.open) {
        const anchor = document.querySelector(captured.view.selector);
        if (anchor?.getClientRects().length) {
          window.scrollTo({ left: captured.view.left, top: scrollY + anchor.getBoundingClientRect().top - captured.view.top, behavior: 'instant' });
          lastReadingView = readingView() || captured.view;
        }
      }
      restoring = false;
    });
  }
  hook.addEventListener('raven:inspect-part', event => {
    synchronizeRun();
    if (!parts.has(event.detail?.part)) return;
    selectedPart = event.detail.part;
    inspected = true;
    showSelection();
    lastReadingView = readingView() || lastReadingView;
  });
  hook.addEventListener('raven:opening-render', showSelection);
  hook.addEventListener('click', event => {
    if (event.target.closest?.('[data-hook-action="compare-toggle"]')) {
      inspected = true;
      document.getElementById('paper-goal')?.remove();
    }
  });
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-raven-language]')) captureLanguage();
  }, true);
  document.addEventListener('raven:language', captureLanguage, true);
  document.addEventListener('raven:language', finishLanguage);
  for (const eventName of ['input', 'select', 'keyup', 'pointerup', 'focusout']) {
    document.addEventListener(eventName, event => rememberCaret(event.target), true);
  }
  document.addEventListener('selectionchange', () => rememberCaret());
  window.addEventListener('scroll', () => {
    if (restoring || pending) return;
    synchronizeRun();
    lastReadingView = readingView() || lastReadingView;
  }, { passive: true });
  showSelection();
})();

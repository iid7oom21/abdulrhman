/* Presentation memory only: no game writes, persistence, requests or replayed actions. */
(() => {
  'use strict';
  const hook = document.getElementById('hook');
  if (!hook) return;
  const parts = new Set(['original', 'conclusion', 'signature']);
  let sceneRun = hook.dataset.sceneRun;
  let selectedPart = null, lastReadingView = null, noteCaret = null, pending = null;
  let generation = 0, restoring = false;

  function synchronizeRun() {
    if (sceneRun === hook.dataset.sceneRun) return;
    sceneRun = hook.dataset.sceneRun;
    selectedPart = null; lastReadingView = null; noteCaret = null; pending = null;
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
    showSelection();
    lastReadingView = readingView() || lastReadingView;
  });
  hook.addEventListener('raven:opening-render', showSelection);
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

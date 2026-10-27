import { el } from './core.js?v=0e63bd470374096b';

const MORSE = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....',
  I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.',
  Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', 0: '-----', 1: '.----', 2: '..---', 3: '...--', 4: '....-',
  5: '.....', 6: '-....', 7: '--...', 8: '---..', 9: '----.',
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MODES = ['morse', 'caesar', 'numbers'];
const MORSE_CODE = ['-----', '.----', '--...'];
const CIPHER = 'WKH ILOH LV RSHQ';

function normalize(value) {
  return value.replace(/[٠-٩]/g, character => String('٠١٢٣٤٥٦٧٨٩'.indexOf(character)))
    .replace(/[۰-۹]/g, character => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(character)))
    .trim().toUpperCase();
}

/** Optional exercises. No exercise writes case evidence, answers, or solvedIds. */
export function mount(root, services, { mode = 'morse' } = {}) {
  const t = (ar, en) => services.t ? services.t(ar, en) : ar;
  const labels = {
    morse: t('جهاز مورس', 'Morse receiver'),
    caesar: t('عجلة قيصر', 'Caesar wheel'),
    numbers: t('الأرقام والحروف', 'Numbers & letters'),
  };
  const controller = new AbortController();
  const holdToken = `training-morse-${Math.random().toString(36).slice(2)}`;
  let currentMode = MODES.includes(mode) ? mode : 'morse';
  let audioContext;
  let oscillators = [];
  let frame = 0;
  let held = false;
  let destroyed = false;
  let playGeneration = 0;
  let modeCleanup = () => {};
  let resetSignal = () => {};

  function stopSignal() {
    playGeneration += 1;
    cancelAnimationFrame(frame);
    frame = 0;
    for (const oscillator of oscillators) {
      try { oscillator.stop(); } catch { /* Already ended. */ }
      try { oscillator.disconnect(); } catch { /* Already disconnected. */ }
    }
    oscillators = [];
    if (held) services.audio?.release?.(holdToken);
    held = false;
    resetSignal();
  }

  function completed(key) {
    return services.caseStore.get().training?.[key]?.completed === true;
  }

  function markCompleted(key) {
    services.caseStore.update(state => {
      state.training ??= {};
      state.training[key] = {
        ...state.training[key], completed: true,
        completedAt: state.training[key]?.completedAt || new Date().toISOString(),
      };
    });
    updateTabBadges();
  }

  const intro = el('header', { class: 'training-heading' }, [
    el('span', { class: 'training-eyebrow', text: 'FIELD EXERCISES / 013' }),
    el('h2', { text: t('تدريب المحقق', 'Investigator training') }),
    el('p', { text: t('ثلاث أدوات لفك الإشارات. تمارين مستقلة عن أدلة القضية.', 'Three ways to read a signal. These exercises are separate from the case evidence.') }),
  ]);
  const tabs = el('nav', { class: 'training-tabs', 'aria-label': t('تمارين المحقق', 'Investigator exercises') });
  const stage = el('section', { class: 'training-stage', 'aria-label': t('مساحة التدريب', 'Training workspace') });
  const wrapper = el('div', { class: 'training-workspace' }, [intro, tabs, stage]);
  root.replaceChildren(wrapper);

  function updateTabBadges() {
    for (const button of tabs.querySelectorAll('[data-training-mode]')) {
      const key = button.dataset.trainingMode;
      button.textContent = `${labels[key]}${completed(key) ? ' ✓' : ''}`;
      button.setAttribute('aria-pressed', String(key === currentMode));
    }
  }

  for (const key of MODES) {
    tabs.append(el('button', {
      type: 'button', class: 'training-tab', 'data-training-mode': key,
      onClick: () => { if (key !== currentMode) render(key); },
    }));
  }

  function notice() {
    return el('p', { class: 'training-result', role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  }

  function stamp(key) {
    return el('span', { class: 'training-stamp', text: completed(key) ? t('اجتزت التدريب', 'Exercise completed') : t('تمرين اختياري', 'Optional exercise') });
  }

  function referenceTable(kind) {
    const isMorse = kind === 'morse';
    const chars = isMorse ? [...ALPHABET, ...'0123456789'] : [...ALPHABET];
    return el('details', { class: 'training-reference' }, [
      el('summary', { text: isMorse ? t('جدول رموز مورس', 'Morse reference chart') : t('جدول الحروف وأرقامها', 'Letter-number reference chart') }),
      el('div', { class: 'training-reference-grid', dir: 'ltr' }, chars.map((character, index) =>
        el('div', { class: 'training-reference-cell' }, [
          el('b', { text: character }),
          el('span', { text: isMorse ? MORSE[character].replaceAll('-', '−') : String(index + 1) }),
        ]))),
    ]);
  }

  function mountMorse() {
    const feedback = notice();
    const badge = stamp('morse');
    const signalLabel = el('span', { text: t('المستقبِل جاهز', 'Receiver ready') });
    const signalLight = el('span', { class: 'training-signal-light', 'aria-hidden': 'true' });
    const marks = [];
    const signal = el('div', {
      class: 'training-morse-code', dir: 'ltr',
      'aria-label': t('الإشارة: خمس شرطات، نقطة وأربع شرطات، شرطتان وثلاث نقاط.', 'Signal: five dashes; a dot and four dashes; two dashes and three dots.'),
    }, MORSE_CODE.map((code, groupIndex) => el('div', { class: 'training-morse-group' }, [...code].map((character, index) => {
      const mark = el('span', { class: 'training-morse-mark', 'aria-hidden': 'true', text: character === '-' ? '−' : '•', 'data-signal-index': `${groupIndex}-${index}` });
      marks.push(mark);
      return mark;
    }))));
    const speed = el('select', { id: 'training-morse-speed', 'aria-label': t('سرعة الإشارة', 'Signal speed') }, [
      el('option', { value: '1', text: t('سرعة عادية · 1×', 'Normal speed · 1×') }),
      el('option', { value: '.5', text: t('ببطء · 0.5×', 'Slow speed · 0.5×') }),
    ]);
    const play = el('button', { type: 'button', class: 'training-primary', 'data-training-play': 'morse', text: t('استمع إلى الإشارة', 'Listen to the signal') });
    const stop = el('button', { type: 'button', disabled: true, text: t('إيقاف', 'Stop') });
    const soundStatus = el('p', { class: 'training-audio-note', role: 'status', 'aria-live': 'polite', text: t('يمكن حل الإشارة من الرموز المرئية أيضًا.', 'You can also solve the signal from the visible symbols.') });
    const input = el('input', {
      id: 'training-morse-answer', type: 'text', inputmode: 'numeric', autocomplete: 'off',
      maxlength: '12', dir: 'ltr', placeholder: '•••', 'data-training-answer': 'morse',
    });
    const form = el('form', { class: 'training-answer-form', onSubmit: event => {
      event.preventDefault();
      if (normalize(input.value).replace(/\s/g, '') === '017') {
        markCompleted('morse');
        badge.textContent = t('اجتزت التدريب', 'Exercise completed');
        feedback.dataset.result = 'correct';
        feedback.textContent = t('فُكّت الإشارة: 017. لكل رقم مجموعة مستقلة من خمس علامات.', 'Signal decoded: 017. Each digit is a separate group of five marks.');
      } else {
        feedback.dataset.result = 'retry';
        feedback.textContent = t('راجع مجموعة واحدة في كل مرة؛ كل مجموعة تمثل رقمًا.', 'Review one group at a time; each group represents a digit.');
      }
    } }, [
      el('label', { for: input.id, text: t('ما الأرقام الثلاثة؟', 'What are the three digits?') }), input,
      el('button', { type: 'submit', text: t('تحقق من الإشارة', 'Check the signal') }),
    ]);
    resetSignal = () => {
      play.disabled = false;
      stop.disabled = true;
      speed.disabled = false;
      signalLight.classList.remove('is-active');
      marks.forEach(mark => mark.classList.remove('is-active'));
      signalLabel.textContent = t('المستقبِل جاهز', 'Receiver ready');
      soundStatus.textContent = t('يمكن حل الإشارة من الرموز المرئية أيضًا.', 'You can also solve the signal from the visible symbols.');
    };
    stop.addEventListener('click', stopSignal);
    play.addEventListener('click', async () => {
      stopSignal();
      const generation = playGeneration;
      play.disabled = true;
      stop.disabled = false;
      speed.disabled = true;
      signalLabel.textContent = t('التقاط الإشارة', 'Receiving signal');
      let audible = false;
      try {
        const AudioConstructor = window.AudioContext || window.webkitAudioContext;
        if (AudioConstructor) {
          audioContext ??= new AudioConstructor();
          await audioContext.resume();
          audible = audioContext.state === 'running';
        }
      } catch { audible = false; }
      if (destroyed || generation !== playGeneration || document.hidden) {
        if (generation === playGeneration) stopSignal();
        return;
      }
      soundStatus.textContent = audible
        ? t('الموسيقى متوقفة مؤقتًا أثناء الإشارة.', 'Music is paused while the signal plays.')
        : t('الصوت غير متاح هنا؛ تتبع الإشارة المرئية أو استخدم جدول الرموز.', 'Audio is unavailable here; follow the visual signal or use the reference chart.');
      const unit = 0.2 / Number(speed.value);
      const segments = [];
      let cursor = 0;
      let index = 0;
      for (let group = 0; group < MORSE_CODE.length; group += 1) {
        for (let symbol = 0; symbol < MORSE_CODE[group].length; symbol += 1) {
          const duration = (MORSE_CODE[group][symbol] === '-' ? 3 : 1) * unit;
          segments.push({ start: cursor, end: cursor + duration, index: index++ });
          cursor += duration;
          if (symbol < MORSE_CODE[group].length - 1) cursor += unit;
        }
        if (group < MORSE_CODE.length - 1) cursor += unit * 3;
      }
      if (audible) {
        try {
          const start = audioContext.currentTime + 0.06;
          for (const segment of segments) {
            const oscillator = audioContext.createOscillator();
            const gain = audioContext.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.value = 580;
            gain.gain.setValueAtTime(0, start + segment.start);
            gain.gain.linearRampToValueAtTime(0.075, start + segment.start + 0.008);
            gain.gain.setValueAtTime(0.075, start + segment.end - 0.012);
            gain.gain.linearRampToValueAtTime(0, start + segment.end);
            oscillator.connect(gain);
            gain.connect(audioContext.destination);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            oscillator.start(start + segment.start);
            oscillator.stop(start + segment.end + 0.01);
            oscillators.push(oscillator);
          }
          services.audio?.hold?.(holdToken);
          held = true;
        } catch {
          for (const oscillator of oscillators) { try { oscillator.stop(); } catch { /* Ignore ended tones. */ } }
          oscillators = [];
          if (held) services.audio?.release?.(holdToken);
          held = false;
          audible = false;
          soundStatus.textContent = t('تعذّر تشغيل الصوت؛ الإشارة المرئية متاحة.', 'Audio could not play; the visual signal remains available.');
        }
      }
      const startsAt = performance.now() + (audible ? 60 : 0);
      const tick = now => {
        if (destroyed || generation !== playGeneration) return;
        const elapsed = (now - startsAt) / 1000;
        if (elapsed >= cursor + unit) {
          stopSignal();
          soundStatus.textContent = t('انتهت الإشارة. أعدها أو راجع الرموز على مهل.', 'Signal complete. Replay it or review the symbols at your own pace.');
          play.textContent = t('أعد الإشارة', 'Replay the signal');
          return;
        }
        const active = segments.find(segment => elapsed >= segment.start && elapsed < segment.end)?.index ?? -1;
        marks.forEach((mark, markIndex) => mark.classList.toggle('is-active', markIndex === active));
        signalLight.classList.toggle('is-active', active !== -1);
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    return [
      el('div', { class: 'training-instrument training-radio', 'data-training': 'morse' }, [
        el('div', { class: 'training-instrument-top' }, [el('span', { text: 'RX / 580 Hz', dir: 'ltr' }), badge]),
        el('h3', { text: t('التقط الإشارة.', 'Read the signal.') }),
        el('p', { text: t('ثلاث مجموعات. ثلاثة أرقام. استخدم سمعك أو راقب العلامات.', 'Three groups. Three digits. Listen or follow the marks.') }),
        el('div', { class: 'training-receiver' }, [
          el('div', { class: 'training-receiver-status' }, [signalLight, signalLabel]), signal,
          el('div', { class: 'training-radio-scale', 'aria-hidden': 'true', text: '530 ┃ ┃ ┃ 580 ┃ ┃ ┃ 630' }),
        ]),
        el('div', { class: 'training-controls' }, [play, stop, speed]), soundStatus, form, feedback,
      ]), referenceTable('morse'),
    ];
  }

  function mountCaesar() {
    const feedback = notice();
    const badge = stamp('caesar');
    const range = el('input', {
      id: 'training-caesar-shift', type: 'range', min: '0', max: '25', step: '1', value: '0', dir: 'ltr',
      'data-training-shift': '', 'aria-label': t('الإزاحة إلى الخلف', 'Backward shift'),
    });
    const value = el('output', { for: range.id, class: 'training-shift-value', text: '0', dir: 'ltr' });
    const decoded = el('output', { class: 'training-decoded', dir: 'ltr', 'data-training-decoded': '', text: CIPHER });
    const wheel = el('div', { class: 'training-cipher-wheel', 'aria-hidden': 'true' }, [
      el('span', { text: 'A / Z', class: 'training-wheel-top' }),
      el('span', { text: '↶', class: 'training-wheel-arrow' }),
      value,
    ]);
    const update = () => {
      const shift = Number(range.value);
      value.textContent = String(shift);
      decoded.textContent = [...CIPHER].map(character => /[A-Z]/.test(character) ? ALPHABET[(ALPHABET.indexOf(character) - shift + 26) % 26] : character).join('');
      range.setAttribute('aria-valuetext', t(`${shift} حروف إلى الخلف`, `${shift} letters backward`));
      wheel.style.setProperty('--wheel-angle', `${shift / 26 * 360}deg`);
      feedback.textContent = '';
    };
    range.addEventListener('input', update);
    const step = delta => { range.value = String((Number(range.value) + delta + 26) % 26); update(); };
    update();
    const form = el('form', { onSubmit: event => {
      event.preventDefault();
      if (Number(range.value) === 3) {
        markCompleted('caesar');
        badge.textContent = t('اجتزت التدريب', 'Exercise completed');
        feedback.dataset.result = 'correct';
        feedback.textContent = t('فُكّت الرسالة: THE FILE IS OPEN — الملف مفتوح. أعدت كل حرف ثلاث خطوات إلى الخلف.', 'Decoded: THE FILE IS OPEN. You moved every letter three positions backward.');
      } else {
        feedback.dataset.result = 'retry';
        feedback.textContent = t('تلميح: الحرف W يعود إلى T. جرّب الإزاحة نفسها لبقية الحروف.', 'Hint: W returns to T. Apply the same shift to every letter.');
      }
    } }, [
      el('label', { for: range.id, text: t('حرّك العجلة حتى تصبح الرسالة مقروءة.', 'Turn the wheel until the message becomes readable.') }),
      el('div', { class: 'training-shift-controls' }, [
        el('button', { type: 'button', 'aria-label': t('تقليل الإزاحة', 'Decrease shift'), text: '−', onClick: () => step(-1) }), range,
        el('button', { type: 'button', 'aria-label': t('زيادة الإزاحة', 'Increase shift'), text: '+', onClick: () => step(1) }),
      ]),
      el('p', { class: 'training-output-label', text: t('القراءة الحالية', 'Current reading') }), decoded,
      el('button', { type: 'submit', class: 'training-primary', text: t('تحقق من فك الشفرة', 'Check the decoding') }),
    ]);
    return [el('div', { class: 'training-instrument', 'data-training': 'caesar' }, [
      el('div', { class: 'training-instrument-top' }, [el('span', { text: 'SHIFT / 26', dir: 'ltr' }), badge]),
      el('h3', { text: t('الحروف تغيّر مواقعها.', 'The letters changed places.') }),
      el('p', { text: t('كل حرف في الرسالة تحرّك بالمقدار نفسه.', 'Every letter in the message moved by the same amount.') }),
      el('div', { class: 'training-cipher-layout' }, [wheel, el('div', {}, [
        el('p', { class: 'training-output-label', text: t('الرسالة المشفّرة', 'Encrypted message') }),
        el('p', { class: 'training-cipher-text', dir: 'ltr', text: CIPHER }),
      ])]), form, feedback,
    ])];
  }

  function mountNumbers() {
    const feedback = notice();
    const badge = stamp('numbers');
    const input = el('input', {
      id: 'training-numbers-answer', type: 'text', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', maxlength: '40', dir: 'ltr', placeholder: 'A B C …', 'data-training-answer': 'numbers',
    });
    const letterBoxes = el('div', { class: 'training-number-sequence', dir: 'ltr', 'aria-label': '18, 1, 22, 5, 14' },
      [18, 1, 22, 5, 14].map(number => el('span', { text: String(number) })));
    const form = el('form', { class: 'training-answer-form', onSubmit: event => {
      event.preventDefault();
      if (normalize(input.value).replace(/[\s-]/g, '') === 'RAVEN') {
        markCompleted('numbers');
        badge.textContent = t('اجتزت التدريب', 'Exercise completed');
        feedback.dataset.result = 'correct';
        feedback.textContent = t('الرسالة: RAVEN. رتبة كل حرف في الأبجدية الإنجليزية تعيد لك الكلمة.', 'The message is RAVEN. Each number gives a letter’s position in the English alphabet.');
      } else {
        feedback.dataset.result = 'retry';
        feedback.textContent = t('ابدأ من A = 1. ابحث عن كل رقم في الجدول، ثم اجمع الحروف بالترتيب.', 'Start with A = 1. Find each number in the chart, then read its letters in order.');
      }
    } }, [el('label', { for: input.id, text: t('اكتب الكلمة الإنجليزية', 'Enter the English word') }), input,
      el('button', { type: 'submit', class: 'training-primary', text: t('تحقق من الكلمة', 'Check the word') }),
    ]);
    return [el('div', { class: 'training-instrument', 'data-training': 'numbers' }, [
      el('div', { class: 'training-instrument-top' }, [el('span', { text: 'A1Z26 / KEY', dir: 'ltr' }), badge]),
      el('h3', { text: t('خلف كل رقم حرف.', 'A letter behind every number.') }),
      el('p', { text: t('A = 1، ثم B = 2. اقرأ الأرقام من اليسار إلى اليمين.', 'A = 1, then B = 2. Read the numbers from left to right.') }),
      letterBoxes, form, feedback,
    ]), referenceTable('numbers')];
  }

  function render(nextMode) {
    stopSignal();
    modeCleanup();
    modeCleanup = () => {};
    currentMode = nextMode;
    resetSignal = () => {};
    stage.replaceChildren(...(nextMode === 'morse' ? mountMorse() : nextMode === 'caesar' ? mountCaesar() : mountNumbers()));
    updateTabBadges();
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) stopSignal(); }, { signal: controller.signal });
  render(currentMode);

  return () => {
    destroyed = true;
    stopSignal();
    modeCleanup();
    controller.abort();
    if (audioContext && audioContext.state !== 'closed') audioContext.close().catch(() => {});
  };
}

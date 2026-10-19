import { node, arabic } from './dom.js?v=dossier-1';
import { createScene } from './media.js?v=cinema-2';

const trace = [
  {
    references: 'PH-06 · LC-14 · MA-22',
    title: 'القفل يعود إلى مكانه',
    detail: 'قفص المعدات EXT-02. الصورة لا تثبت أن لوسيان أغلق مخرج الأرشيف AR-01.',
  },
  {
    references: 'LC-14 · MA-22 · AR-09 · RC-31',
    title: 'كل توقيع يعود إلى ورقته',
    detail: 'تسليم، وفحص، وجرد، واستلام. أربعة أغراض مختلفة صارت اتهامًا لم يوقّعوا عليه.',
  },
  {
    references: 'AUD-07 · REV-08',
    title: 'النسخة تعود إلى صانعها',
    detail: 'سجل التدقيق يثبت تركيب أدريان للمحضر. المراسلة وقرار تأجيل الصيانة يفسّران دافعه.',
  },
];

/** The caller gates access and disposes existing scenes before replacing this view. */
export function createEnding(data) {
  const { ending } = data;
  const lucian = data.people.find((person) => person.id === 'lucian');
  const report = node('div', { class: 'ending-report' });
  const verdict = node('div', { class: 'ending-verdict-copy' }, [
    node('h2', { id: 'ending-title', tabindex: '-1', text: ending.title }),
    node('p', { class: 'ending-summary', text: ending.summary }),
  ]);

  const portrait = lucian ? node('figure', { class: 'ending-person' }, [
    node('img', { src: lucian.image, alt: `صورة ${lucian.name}`, loading: 'lazy', width: '120', height: '150' }),
    node('figcaption', {}, [
      node('span', { class: 'ending-person-label', text: 'وراء المحضر، إنسان' }),
      node('strong', { text: lucian.name }),
    ]),
  ]) : null;

  report.append(
    node('header', { class: 'ending-report-head' }, [
      node('p', { class: 'eyebrow', text: 'الملف ٠١٧ / خلاصة التحقيق' }),
      node('span', { class: 'ending-seal', text: 'اكتمل فحص المحضر' }),
    ]),
    node('div', { class: 'ending-verdict' }, [verdict, portrait]),
    node('div', { class: 'ending-resolution' }, [
      node('span', { class: 'ending-resolution-label', text: 'ما يترتب على التحقيق' }),
      node('p', { text: 'سحب الاعتماد على المحضر، وإعادة النظر في فصل لوسيان، ومساءلة أدريان عن تركيب الرواية التأديبية.' }),
    ]),
    node('section', { class: 'ending-trace', 'aria-label': 'من الدليل إلى الخلاصة' }, [
      node('h3', { text: 'كيف انقلب معنى الأوراق' }),
      node('ol', { class: 'ending-trace-list' }, trace.map((step, index) => node('li', {}, [
        node('span', { class: 'ending-trace-number', 'aria-hidden': 'true', text: arabic(index + 1) }),
        node('p', { class: 'ending-trace-ref', dir: 'ltr', text: step.references }),
        node('h4', { text: step.title }),
        node('p', { class: 'ending-trace-detail', text: step.detail }),
      ]))),
    ]),
    node('details', { class: 'ending-proof' }, [
      node('summary', {}, [
        node('span', { text: 'راجع تسلسل الاستدلال كاملًا' }),
        node('span', { class: 'ending-proof-count', text: `${arabic(ending.reasoning.length)} نقاط موثّقة` }),
      ]),
      node('ol', { class: 'ending-reasoning' }, ending.reasoning.map((reason) => node('li', { text: reason }))),
    ]),
    node('div', { class: 'ending-limits' }, [
      node('h3', { text: 'حدود ما نعرفه' }),
      ...ending.limits.map((limit) => node('p', { text: limit })),
    ]),
    node('div', { class: 'ending-afterword' }, [
      node('figure', { class: 'ending-scene-wrap' }, [
        createScene({
          id: 'archive',
          poster: 'assets/archive.webp',
          alt: 'الممر الهادئ بين رفوف أرشيف بيلمار',
          label: 'عودة إلى الأرشيف بعد إغلاق الملف',
          className: 'ending-scene',
          autoplay: false,
          originalImage: false,
        }),
        node('figcaption', { text: 'عادت الأوراق إلى أصولها. وبقي للحريق سؤاله.' }),
      ]),
      node('aside', { class: 'ending-next-file', 'aria-labelledby': 'ending-next-title' }, [
        node('p', { class: 'eyebrow', text: 'على رف آخر' }),
        node('div', { class: 'ending-book-mark', 'aria-hidden': 'true' }, [node('span'), node('span'), node('span')]),
        node('h3', { id: 'ending-next-title', text: 'التموّج — ملف لم يُفتح بعد' }),
        node('p', { class: 'ending-next-line', text: 'في الكتاب القديم، قد تكون الصفحة الساكنة بداية التموج.' }),
      ]),
    ]),
  );
  return report;
}

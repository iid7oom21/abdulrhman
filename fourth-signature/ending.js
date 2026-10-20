import { node, arabic } from './dom.js?v=dossier-1';
import { createScene } from './media.js?v=cinema-2';
import { createCaseSeal } from './case-seal.js?v=seal-1';

const signatures = [
  { person: 'lucian', evidence: 'E02', reference: 'LC-14', purpose: 'تسليم نصفي قفل EXT-02 والأداة.' },
  { person: 'elias', evidence: 'E03', reference: 'MA-22', purpose: 'فحص المخرج وإجراء صيانة.' },
  { person: 'elena', evidence: 'E04', reference: 'AR-09', purpose: 'إعداد الجرد الأولي للخسائر.' },
  { person: 'nora', evidence: 'E05', reference: 'RC-31', purpose: 'استلام الأوراق وإحالتها.' },
];

const checks = [
  {
    title: 'والصورة؟',
    detail: 'بطاقة PH-06 تصف الأصل عند قفص المعدات EXT-02. قصاصة المحضر حذفت سياق الموقع، وأضافت «قفل المخرج بيد الحارس». حمل القفل لا يثبت إغلاق AR-01.',
    sources: [{ id: 'E06', label: 'افتح بطاقة الصورة' }],
  },
  {
    title: 'لماذا أدريان؟',
    detail: 'يسجل AUD-07 قص التوقيعات وإضافة الاتهام وتصدير ADM-04.pdf في جلسة حساب أدريان، بمفتاح AV-02 المسلّم إليه وحده. بصمة الناتج 7A41 تطابق المحضر المعتمد للفصل.',
    sources: [{ id: 'E07', label: 'سجل التنفيذ' }, { id: 'E01', label: 'المحضر ذو البصمة نفسها' }],
  },
  {
    title: 'ما سياق القرار؟',
    detail: 'وقّع أدريان تأجيل إصلاح المزلاج في MA-22. مراسلته في REV-08 تطلب عدم إعادة فتح اعتماد الصيانة قبل استكمال الإجراء. هذه خلفية للقرار؛ سجل AUD-07 هو سند نسبة الإنتاج.',
    sources: [{ id: 'E03', label: 'قرار تأجيل الإصلاح' }, { id: 'E08', label: 'المراسلة المحفوظة' }],
  },
];

/** The caller gates access and disposes existing scenes before replacing this view. */
export function createEnding(data, { hintCount = null, onOpenEvidence, onRestart } = {}) {
  const { ending } = data;
  const lucian = data.people.find((person) => person.id === 'lucian');
  const report = node('div', { class: 'ending-report' });
  const evidenceLink = (id, label) => typeof onOpenEvidence === 'function'
    ? node('button', {
      type: 'button', class: 'ending-evidence-link', 'data-evidence-id': id,
      onClick: (event) => onOpenEvidence(id, event.currentTarget),
    }, node('span', {}, label.split(/([A-Z]{2,3}-\d{2})/g).map((part, index) =>
      index % 2 ? node('bdi', { class: 'ending-inline-code', dir: 'ltr', text: part }) : part
    )))
    : node('span', { class: 'ending-source-label', text: label });
  const verdict = node('div', { class: 'ending-verdict-copy' }, [
    node('h2', { id: 'ending-title', tabindex: '-1', text: ending.title }),
    node('p', { class: 'ending-summary', text: 'جمع أدريان ڤوس توقيعات حقيقية من أربعة مستندات، ووضعها تحت اتهام جديد استُخدم لفصل لوسيان. لم يوقّع أصحابها على ذلك الاتهام.' }),
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
    node('section', { class: 'ending-trace', 'aria-label': 'من الدليل إلى الخلاصة' }, [
      node('h3', { text: 'أربعة توقيعات. أربعة أغراض.' }),
      node('ol', { class: 'ending-trace-list ending-signatures' }, signatures.map((signature, index) => node('li', {
        'data-ending-signature': signature.person,
      }, [
        node('div', { class: 'ending-signature-heading' }, [
          node('span', { class: 'ending-trace-number', 'aria-hidden': 'true', text: arabic(index + 1) }),
          node('h4', { text: data.people.find((person) => person.id === signature.person)?.name || signature.person }),
        ]),
        node('p', { class: 'ending-trace-detail', text: signature.purpose }),
        evidenceLink(signature.evidence, `افتح الأصل ${signature.reference}`),
      ]))),
      node('p', { class: 'ending-residue' }, [
        node('span', { text: 'الأثر الذي بقي تحت التوقيع الرابع: ' }),
        node('strong', { text: '«توقيع المستلم»' }),
        node('span', { text: ' — عبارة إيصال نورا نفسها.' }),
      ]),
    ]),
    node('div', { class: 'ending-checks', 'aria-label': 'الصورة وإسناد المحضر وسياق القرار' }, checks.map((check) => node('details', { class: 'ending-check' }, [
      node('summary', { text: check.title }),
      node('p', { text: check.detail }),
      node('div', { class: 'ending-source-links' }, check.sources.map((source) => evidenceLink(source.id, source.label))),
    ]))),
    node('div', { class: 'ending-resolution' }, [
      node('span', { class: 'ending-resolution-label', text: 'النتيجة التي يسندها الملف' }),
      node('p', { text: 'سحب الاعتماد على المحضر، وإعادة النظر في فصل لوسيان، ومساءلة أدريان عن تركيب الرواية التأديبية.' }),
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
      node('p', { text: ending.limits[0] }),
      node('details', { class: 'ending-limits-more' }, [
        node('summary', { text: 'حدود أخرى للنتيجة' }),
        ...ending.limits.slice(1).map((limit) => node('p', { text: limit })),
      ]),
    ]),
    node('p', { class: 'ending-human-line', text: 'خسر لوسيان عمله بورقة تحمل توقيعه. لكن الورقة التي وقّعها كانت تقول شيئًا آخر.' }),
    node('div', { class: 'ending-final-actions' }, [
      node('a', { href: '#evidence', class: 'ending-action', text: 'راجع الأدلة' }),
      typeof onRestart === 'function' ? node('button', {
        type: 'button', class: 'ending-action ending-action-secondary', text: 'ابدأ تحقيقًا جديدًا',
        onClick: (event) => onRestart(event.currentTarget),
      }) : null,
    ]),
    createCaseSeal({ title: data.title, hintCount }),
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

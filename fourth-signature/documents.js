import { node, arabic } from './dom.js?v=dossier-1';

// The typography is presentation only. All evidence text comes from case-data.
const templates = {
  E01: { kind: 'administrative', label: 'محضر إداري', mark: 'ADM' },
  E02: { kind: 'receipt', label: 'محضر تسليم', mark: 'LC' },
  E03: { kind: 'technical', label: 'طلب إصلاح', mark: 'MA' },
  E04: { kind: 'inventory', label: 'جرد أولي', mark: 'AR' },
  E05: { kind: 'transfer', label: 'إيصال إحالة', mark: 'RC' },
  E06: { kind: 'photograph', label: 'بطاقة حفظ صورة', mark: 'PH' },
  E07: { kind: 'audit', label: 'سجل تدقيق رقمي', mark: 'AUD' },
  E08: { kind: 'letter', label: 'مراسلة وسجل حفظ', mark: 'REV' },
};

function documentDetails(item) {
  return {
    ...templates[item.id],
    code: item.reference.split(' · ')[0],
    referenceTitle: item.reference.split(' · ').slice(1).join(' · ') || item.type,
  };
}

export function createDocument(item, { comparison = false, titleId } = {}) {
  const details = documentDetails(item);
  return node('article', {
    class: `${comparison ? 'comparison-paper' : 'document-paper'} document-sheet document-${details.kind}`,
    'data-document': item.id,
    dir: 'rtl',
  }, [
    node('header', { class: 'document-heading' }, [
      node('div', { class: 'document-masthead' }, [
        node('div', { class: 'document-emblem', 'aria-hidden': 'true', text: details.mark }),
        node('div', { class: 'document-register' }, [
          node('span', { class: 'document-register-label', text: details.label }),
          node('bdi', { class: 'document-code', dir: 'ltr', text: details.code }),
        ]),
        node('span', { class: 'document-file-number', text: item.id, dir: 'ltr' }),
      ]),
      node(comparison ? 'h3' : 'h2', { id: titleId, class: 'document-title', text: item.title }),
      node('p', { class: 'document-reference', text: item.reference }),
    ]),
    node('div', { class: 'document-body' }, item.body.map((paragraph, index) =>
      node('div', { class: 'document-entry' }, [
        node('span', { class: 'document-line-number', 'aria-hidden': 'true', text: arabic(index + 1) }),
        node('p', { class: 'document-paragraph', text: paragraph }),
      ])
    )),
    item.signature ? node('div', { class: 'document-signature-block' }, [
      node('span', { class: 'document-signature-label', text: 'خانة التوقيع' }),
      node('p', { class: 'document-signature', text: item.signature }),
    ]) : null,
    node('footer', { class: 'document-footer' }, [
      node('p', { class: 'document-source', text: item.sourceLabel || item.reference }),
      node('span', { class: 'document-footer-code', dir: 'ltr', 'aria-hidden': 'true', text: `${item.id} / ${details.code}` }),
    ]),
  ]);
}

export function createDocumentPreview(item, index = 0) {
  const details = documentDetails(item);
  return node('div', {
    class: `document-preview document-preview-${details.kind}`,
    'aria-hidden': 'true',
    dir: 'rtl',
  }, [
    node('span', { class: 'document-preview-tab', dir: 'ltr', text: item.id }),
    node('div', { class: 'document-preview-sheet', style: `--paper-tilt:${index % 2 ? '-3deg' : '3deg'}` }, [
      node('div', { class: 'document-preview-masthead' }, [
        node('span', { class: 'document-preview-mark', dir: 'ltr', text: details.mark }),
        node('bdi', { class: 'document-preview-code', dir: 'ltr', text: details.code }),
      ]),
      node('span', { class: 'document-preview-type', text: details.label }),
      node('p', { class: 'document-preview-title', text: details.referenceTitle }),
      node('div', { class: 'document-preview-footer' }, [
        node('span', { text: item.signature || item.type }),
        node('span', { class: 'document-preview-folio', dir: 'ltr', text: item.id }),
      ]),
    ]),
  ]);
}

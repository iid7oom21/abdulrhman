import { node } from './dom.js?v=dossier-1';

const FRAME_RATIO = 2;
const DEFAULT_CROP = { x: 0, y: 0, width: .55, height: 1 };

export function createPhotoInspector({ imageSrc = './assets/photo-ph06.webp', crop = DEFAULT_CROP } = {}) {
  const region = {
    x: Math.max(0, Math.min(.95, Number(crop.x) || 0)),
    y: Math.max(0, Math.min(.95, Number(crop.y) || 0)),
  };
  region.width = Math.max(.05, Math.min(1 - region.x, Number(crop.width) || DEFAULT_CROP.width));
  region.height = Math.max(.05, Math.min(1 - region.y, Number(crop.height) || 1));

  let mode = 'crop';
  let showFrame = false;
  let sourceRatio = 16 / 9;

  const caption = node('figcaption', { class: 'photo-inspector-caption', 'aria-live': 'polite', 'aria-atomic': 'true' });
  const photo = node('img', {
    class: 'photo-inspector-image', src: imageSrc, loading: 'eager', decoding: 'async', draggable: 'false',
    onLoad: () => {
      if (photo.naturalWidth && photo.naturalHeight) sourceRatio = photo.naturalWidth / photo.naturalHeight;
      render();
    },
    onError: () => {
      inspector.classList.add('photo-inspector-unavailable');
      inspector.replaceChildren(node('p', { role: 'status', text: 'المرفق البصري غير متاح الآن. يمكنك فحص نص بطاقة PH-06 أدناه.' }));
    },
  });
  const frameOutline = node('span', { class: 'photo-inspector-crop-outline', 'aria-hidden': 'true', hidden: true });
  const pictureWindow = node('div', { class: 'photo-inspector-window' }, [photo, frameOutline]);
  const cropButton = node('button', {
    type: 'button', class: 'photo-inspector-mode', 'data-photo-view': 'crop', text: 'قصاصة المحضر',
    onClick: () => { mode = 'crop'; render(); },
  });
  const fullButton = node('button', {
    type: 'button', class: 'photo-inspector-mode', 'data-photo-view': 'full', text: 'الإطار الكامل',
    onClick: () => { mode = 'full'; render(); },
  });
  const frameButton = node('button', {
    type: 'button', class: 'photo-inspector-frame-toggle', text: 'إطار القص', 'aria-pressed': 'false',
    onClick: () => { showFrame = !showFrame; render(); },
  });

  const inspector = node('section', { class: 'photo-inspector', 'aria-label': 'فحص الصورة PH-06', 'data-photo-mode': mode }, [
    node('p', { class: 'photo-inspector-heading', text: 'إعادة بناء بصرية من بطاقة PH-06' }),
    node('div', { class: 'photo-inspector-controls', role: 'group', 'aria-label': 'عرض الصورة' }, [cropButton, fullButton, frameButton]),
    node('figure', { class: 'photo-inspector-figure' }, [
      node('div', { class: 'photo-inspector-frame' }, [pictureWindow]),
      caption,
    ]),
  ]);

  function render() {
    const isFull = mode === 'full';
    const visible = isFull ? { x: 0, y: 0, width: 1, height: 1 } : region;
    const viewRatio = sourceRatio * visible.width / visible.height;
    inspector.dataset.photoMode = mode;
    cropButton.setAttribute('aria-pressed', String(!isFull));
    fullButton.setAttribute('aria-pressed', String(isFull));
    frameButton.setAttribute('aria-pressed', String(showFrame));
    frameButton.disabled = !isFull;
    frameButton.style.visibility = isFull ? 'visible' : 'hidden';
    frameOutline.hidden = !(isFull && showFrame);
    pictureWindow.style.aspectRatio = String(viewRatio);
    pictureWindow.style.height = `${Math.min(1, FRAME_RATIO / viewRatio) * 100}%`;
    photo.style.width = `${100 / visible.width}%`;
    photo.style.height = `${100 / visible.height}%`;
    photo.style.left = `${-visible.x / visible.width * 100}%`;
    photo.style.top = `${-visible.y / visible.height * 100}%`;
    photo.alt = isFull
      ? 'الإطار الكامل: لوسيان يحمل القفل المزال قرب سياج قفص المعدات ولافتة EXT-02.'
      : 'قصاصة من الصورة: لوسيان يحمل قفلًا أمام مبنى يتصاعد منه الدخان.';
    caption.textContent = isFull
      ? 'ساحة معدات الصيانة EXT-02؛ الحارس يحمل القفل المزال.'
      : 'قفل المخرج بيد الحارس';
    Object.assign(frameOutline.style, {
      left: `${region.x * 100}%`, top: `${region.y * 100}%`,
      width: `${region.width * 100}%`, height: `${region.height * 100}%`,
    });
  }

  render();
  return inspector;
}

# RAVEN AI Dialogue Preview (Jonas & Claire)

معاينة محادثة نصية محاكاة ليوناس وكلير.

المرجع: BELHAQAK-GUEST-WITNESS-20261030

## التشغيل المحلي

```bash
cd server/ai-dialogue
npm test
npm start
```

الخادم يستمع على `0.0.0.0` والمنفذ من `process.env.PORT` (افتراضي 10000).

## النشر على Render

- أمر البناء: `npm install`
- أمر التشغيل: `npm start`
- الجذر: جذر المستودع

الردود محاكاة. الحفظ في ذاكرة الخادم (يُفقد عند إعادة التشغيل).

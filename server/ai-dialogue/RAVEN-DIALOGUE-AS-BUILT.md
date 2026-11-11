# RAVEN — الحوار كما هو مبني فعلاً
**المصدر:** الفرع `main` عند الالتزام `4252d8e`، والملفات داخل `server/ai-dialogue/`.
هذا الملف يصحح المخططات التخمينية السابقة ويوثق الكود الفعلي المعتمد كما هو مبني على السيرفر.

---

## 1. بنية ملفات الخادم (`server/ai-dialogue/src/`)
- **`src/server.js`:** الخادم الأساسي. مبني عبر مكتبة Node `http` الصافية بدون أي dependency خارجية (`package.json` يحتوي `"dependencies": {}`). يدير جلسات الكوكيز، وحماية Same-Origin وCSRF، وتوجيه المسارات.
- **`src/dialogue.js`:** منطق معالجة طابور الحوار والعمليات غير المتزامنة ومطابقة البصمات المشفرة (`sha256`) ومنع تكرار الخصم (Idempotency).
- **`src/model.js`:** منطق الرد المقيد المبني على المواد المسجلة فقط، ورد الرفض الموحد، والـ fallback.
- **`src/provider.js`:** مزود الموديل عبر استدعاء `fetch` مباشر إلى OpenAI Responses API. القيم المدعومة: `simulation` أو `openai` أو `compatible`. الموديل الافتراضي هو `gpt-5.2`.
- **`src/materials.js`:** إدارة مواد وأقوال اللاعب الموثقة وأحداث المشاركة الصريحة.
- **`src/knowledge.js`:** إدارة حدود المعرفة المقيدة للشخصيات (`jonas` و `claire`).
- **`src/case-service.js` و `src/case-engine.js`:** خدمة ومحرك القضية المكتوبة وأفعالها والتحقق من التضارب.
- **`src/disk-store.js`:** إدارة التخزين الذري على القرص الدائم `/var/data/raven`.

---

## 2. نقاط النهاية الحقيقية (Endpoints)
- **`POST /api/dialogue`:** إرسال رسالة حوار. يستقبل `requestId`, `characterId`, `message`, `sharedFacts`, `contentVersion`. يدعم فقط `jonas` و `claire`.
- **`GET /api/operations/:id`:** استعلام حالة الطلبات المعلقة المتأخرة (`202 Accepted`).
- **`GET /api/materials`:** استعراض المواد المسجلة وأحداث المشاركة في الجلسة.
- **`POST /api/materials`:** تسجيل مادة أو قول جديد لللاعب (`author: 'player'`).
- **`POST /api/shares`:** تسجيل حدث مشاركة صريح لمادة مع شخصية معينة.
- **`GET /api/knowledge?characterId=...`:** جلب سياق المعرفة المصرح به للشخصية.
- **`POST /api/case/start`:** بدء جلسة جديدة في القضية المكتوبة وإصدار الكوكي.
- **`POST /api/case/actions`:** تنفيذ خيارات وقرارات اللاعب في القصة مع كشف التضارب بالبصمة.
- **`GET /healthz`:** فحص صحة الخادم وجاهزيته.

---

## 3. الأمان والمصادقة
- **الكوكيز:** المصادقة تتم بكوكي داخلي مشفر صادر من الخادم (`raven_preview_session` للحوار و `raven_case_session` للقضية). لا يوجد `Bearer Token`.
- **حماية النطاق:** يمنع السيرفر فوراً أي طلبات عابرة للمواقع (`Sec-Fetch-Site: cross-site`) بـ `403 cross_site`.
- **الاستضافة الموحدة:** السيرفر يخدم الموقع الساكن من نفس النطاق عبر `RAVEN_SITE_ROOT`؛ لا حاجة لـ CORS ولا يربط بـ `gh-pages` عبر خوادم متباعدة.

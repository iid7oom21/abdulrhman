# محوّل حوار القضية — عقد البيانات (محلي، غير مفعّل)

**الحالة:** جاهز محليًا ومختبر ببيانات اصطناعية ومزود وهمي. **غير مربوط** بـ`server.js` ولا بأي مسار HTTP، ولا يستدعي نموذجًا حقيقيًا. لا يغيّر سلوك الإنتاج.

الملفات: `server/ai-dialogue/src/case-dialogue-adapter.js`، والقارئ `readSessionState()` في `case-service.js`، والاختبارات `server/ai-dialogue/tests/case-dialogue-adapter.test.js`.

## 1) الخريطة الحالية (قبل المحوّل)

| الجانب | معاينة الحوار الحالية `/api/dialogue` | محرك القضية `/api/case/*` |
|---|---|---|
| مصدر الحالة | مخزن مواد لكل جلسة: أقوال اللاعب وتصحيحاته ومشاركاته (`materials.js`) | `case-service.js`: حالة المحرك تُعاد بناؤها من العمليات وتُتحقق قبل القبول |
| هوية الجلسة | كوكي `raven_preview_session` | كوكي `raven_case_session` (أو نسخة مشفرة في المتصفح بمفتاح الخادم) |
| إصدار المحتوى | ثابت `deleted-name-preview-v2` | `pack.contentVersion` من الحزمة الخاصة |
| معرفة الشخصية | `knowledge.js`: `allowedKnowledge` فارغة؛ ما وصل من اللاعب فقط | لا يوجد في المحرك؛ السياسة في `buildInterrogationContext` (غير مستدعاة سابقًا) |
| الإذن بالإرسال للمزود | `runtime-controls` + مزود مضبوط؛ المزود يختار معرّفات مواد فقط | لا مزود إطلاقًا |

الجلستان مستقلتان، ولا توجد دالة تربطهما. المحوّل لا يربطهما أيضًا: يعمل على جلسة القضية فقط.

## 2) المدخل

```
ask({
  sessionId,            // 64 حرفًا hex — هوية جلسة القضية التي يقرأها الخادم من الكوكي، لا من جسم الطلب
  requestId,            // [A-Za-z0-9_-]{1,100} — مفتاح عدم التكرار داخل الجلسة
  actorId,              // معرّف شخصية من سياسة المؤلف
  message,              // نص اللاعب (غير موثوق، ≤ 8000)
  revision,             // مراجعة الحالة التي يراها اللاعب
  contentVersion,       // يجب أن يطابق الحزمة والحالة
  locale?,              // افتراضي: لغة الحزمة
  presentedMaterialIds? // مواد يعرضها اللاعب؛ يجب أن تكون مسلّمة لهذه الشخصية
})
```

أي حقل آخر (مثل `facts` أو `knowledge`) يُرفض: `invalid_request`.

## 3) الإعداد (من جهة الخادم فقط)

```
createCaseDialogueAdapter({
  pack,              // الحزمة الخاصة المتحققة
  policy,            // سياسة المؤلف أو null (= author_policy_missing صراحة)
  readCaseSession,   // (sessionId) => {state} | null — مثلًا service.readSessionState
  selectSources,     // (providerInput, {signal}) => {action, materialIds}
  timeoutMs?, maxRequestsPerSession?
})
```

`readSessionState(sessionId)` يرجع **نسخة** من حالة جلسة معروفة بنفس إصدار المحتوى، أو `null`. ليس مسار HTTP، ولا يقدر أحد يكتب الجلسة عبره.

## 4) ما يصل إلى المزود (`providerInput`)

- `actor`: الاسم وأسلوب الكلام من السياسة.
- `question`: نص اللاعب، موسوم `untrusted`.
- `sources`: فقط:
  - معرفة الشخصية الخاصة التي فتحت بوابة إفصاحها في حالة المحرك (`origin: own`)،
  - والمواد التي كسبها اللاعب وسلّمها لهذه الشخصية، إذا سمحت `receivedRequires` (`origin: received`).
- `disclosure.withheldCount`: عدد معرفة الشخصية غير المفصح عنها، **بدون نص أو معرّف**، مع القاعدة `withheld-knowledge-is-not-ignorance`: يجوز الامتناع، ولا يجوز الإنكار.

لا يصل: معرّف الجلسة، مفتاح الكاش، الأعلام، المشهد، الدفتر، المسودات، الإيصالات، أو نص أي معرفة محجوبة.

## 5) ما يرجع من المزود

`{action: 'quote_materials'|'clarify'|'unavailable', materialIds: [...]}` فقط. المعرّفات يجب أن تكون من `sources`، بلا تكرار، وبحد أقصى 8. أي نص حر أو مفتاح إضافي أو معرّف غير مكتسب ← `provider_invalid_output`. الخادم يركّب الرد من نصوص الحزمة نفسها مع النسبة لمصدرها.

## 6) المخرج

| `status` | المعنى |
|---|---|
| `answered` / `clarify` | `quotes[]`: `{materialId, title, body, source, type, origin, epistemicStatus:'attributed-source'}` |
| `unavailable` | `reason`: `author_policy_missing`، `actor_policy_missing`، `actor_has_no_authored_knowledge`، `no_disclosable_sources`، `provider_declined`. **تُعرض بصوت النظام، لا كإنكار من الشخصية.** |
| `error` | `error`: `invalid_request`، `session_unavailable`، `content_version_mismatch`، `revision_conflict` (مع المراجعة الحالية)، `material_unavailable`، `request_id_conflict`، `character_busy`، `requests_limit`، `provider_rejected`، `provider_unavailable` (`outcomeUnknown:true` عند المهلة أو الانقطاع)، `provider_invalid_output` |

كل نتيجة تحمل `replayed`. الطلب نفسه يُعاد من السجل بدون استدعاء ثانٍ، حتى بعد نتيجة مجهولة.

## 7) الضمانات المختبرة

- لا مصدر بدون كسب أو تسليم من المحرك، ولا استدعاء مدفوع بلا مصدر.
- رد النموذج لا يمنح مادة، ولا يغيّر حالة، ولا يودع تقريرًا. التحقق: حالة الجلسة مطابقة قبل وبعد، والمراجعة والإيصالات لم تتغير في خدمة القضية الحقيقية.
- تعطل المزود (رفض، انقطاع، مهلة) يترك الحالة سليمة ويرجع رمزًا مغلقًا بدون تفاصيل المزود.
- غياب السياسة أو الشخصية سبب صريح، لا نص إنكار.

## 8) ما يلزم قبل أي تفعيل (قرارات وموافقات)

1. سياسة معرفة معتمدة من المؤلف لكل شخصية (`policy`): المعرفة، وبوابات الإفصاح، و`receivedRequires`.
2. قرار مؤلف: كيف تعبّر الشخصية عن الامتناع عند وجود معرفة محجوبة. لا نص افتراضيًا مخترعًا الآن؛ المحوّل يرجع `provider_declined`/`no_disclosable_sources` فقط.
3. مزود حقيقي لـ`selectSources`: موافقة صريحة على مزود وتكلفة، وتعليمات مراجعة.
4. مسار HTTP يأخذ `sessionId` من كوكي القضية فقط، بنفس قيود المصدر وحجم الجسم في `case-service`، وواجهة تعرض الأسباب بصوت النظام.
5. سجل الطلبات حاليًا في الذاكرة. يلزم قرار تخزين قبل الإنتاج (وضع browser-checkpoint في Render لا يحفظ على قرص).

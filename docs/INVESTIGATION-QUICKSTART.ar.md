# تشغيل مختبر التحقيق ببيانات وهمية

تحتاج Node.js 24 ونسختين من المستودع. شغّل الأوامر من جذر نسخة `main` التي تحتوي على `server/ai-dialogue`. ضع في `pages_dir` المسار المطلق لنسخة `gh-pages` التي تحتوي على `raven/investigation-lab`.

```sh
server_dir=$PWD
pages_dir=/absolute/path/to/pages-checkout
lab_tmp=$(mktemp -d)
node --input-type=module -e "import fs from 'node:fs'; import {fixturePack} from './server/ai-dialogue/tests/fixtures/case.js'; fs.writeFileSync(process.argv[1], JSON.stringify(fixturePack()), {mode:0o600, flag:'wx'});" "$lab_tmp/case.json"
node server/ai-dialogue/scripts/start-investigation-lab.mjs --content "$lab_tmp/case.json" --site "$pages_dir" --data "$lab_tmp/recovery"
```

ابدأ جلسة، اختر **Read card**، وانتظر ظهور **Card A** ثم أعد تحميل الصفحة. ستجد البطاقة ضمن مواد الفحص. [افتح المختبر المحلي](http://127.0.0.1:10001/raven/investigation-lab/?lang=en)

للتحقق من المحاكاة، افتح `/api/config` على المنفذ نفسه. يعرض `provider: simulation` و`providerCallsEnabled: false`. يعرض `/api/case/config` إصدار العينة `fixture-v1` وطريقة الحفظ `browser-checkpoint`.

يحتفظ المتصفح بنقطة الاستئناف المشفّرة. لإعادة تجربة الاسترجاع بعد إيقاف الخادم، شغّل أمر التشغيل الأخير بنفس مجلد الاسترجاع والمنفذ والمتصفح. روابط اللوحة وملاحظاتها خاصة بهذا المتصفح. يحتوي تنزيل اللوحة على ما كتبه اللاعب. احتفظ بمجلد التجربة ومفتاحه والتنزيلات خارج المستودع ومجلد الموقع.

للتحقق آليًا من نسخة الخادم، شغّل

```sh
node --test server/ai-dialogue/tests/investigation-lab.test.js server/ai-dialogue/tests/interrogation-*.test.js
```

وللتحقق من الواجهة، شغّل من نسخة `gh-pages` مع Playwright وChromium

```sh
cd "$pages_dir"
RAVEN_CASE_SERVICE_ROOT="$server_dir/server/ai-dialogue" CHROMIUM_PATH=/usr/bin/chromium node --test tests/investigation-workbench-browser.cjs tests/case-checkpoint-browser.cjs
```

تغطي هذه الخطوات عينة ميكانيكيات محلية. اختبار القصة الخاصة، والأجهزة الفعلية، والخدمة المنشورة، وردود مزوّد حي يتطلب تجربة مستقلة. لتفاصيل نطاق اللوحة وسياق الشخصيات راجع [دليل أدوات التحقيق](./INVESTIGATION-TOOLS.md).

# جرد تجارب RAVEN

يقرأ الجرد فهارس «بعد العرض» ومسار الصفحات المستقلة و«آخر الليل» و«ليالي الحبر» من نسخة الموقع. يحتفظ كل مدخل بمعرّفه ومساره. يبيّن الجدول الثاني أين تشترك صفحتان في الاسم أو فكرة اللعب.

من نسخة `gh-pages`، اطبع الجرد الكامل في صيغة JSON بالأمر `node scripts/workshop-inventory.mjs`. يتضمن عناوين اللغات، والصورة عند توافرها، والصوت، والروابط، ومعرّف مراجعة بيانات كل مدخل وإصدار الموقع. لإعادة إنتاج هذه الصفحة استخدم `node scripts/workshop-inventory.mjs --markdown`. يفحص الأمر `node --test tests/workshop-inventory.mjs` المصادر والروابط.

الدقائق في الفهرسين الرئيسيين مأخوذة من تقدير المدة في المصدر. أما مدة زيارة ورش الحبر والصفحات المستقلة فتقدير تحريري لجولة واحدة ولم تُقَس مع زوار. الشرطة تعني أن المدة متغيرة أو غير محددة. صيغ الملفات تخص التنزيل من الصفحة نفسها. تُسجّل الموسيقى العامة خارج وصف صوت النشاط.

| التجربة | المعرّف | مسار الدخول | النوع | الحالة | دقائق | مصدر المدة | اللغة | التنزيل |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| الاسم يعبر الشاشة | after-show:titles | `raven/after-show/?activity=titles` | tool | listed | 5 | workshops.js | ar, en | JSON |
| مدينة من ثلاث زجاجات | after-show:parallax | `raven/after-show/?activity=parallax` | simulation | listed | 4 | workshops.js | ar, en | — |
| كرسي المترجم الأخير | after-show:subtitles | `raven/after-show/?activity=subtitles` | tool | listed | 5 | workshops.js | ar, en | — |
| ثلاثة مداخل ومفتاح واحد | after-show:blocking | `raven/after-show/?activity=blocking` | game | listed | 7 | workshops.js | ar, en | — |
| فنجان بحجم عمارة | after-show:forced-scale | `raven/after-show/?activity=forced-scale` | simulation | listed | 3 | workshops.js | ar, en | — |
| نصف الفندق مرسوم | after-show:matte | `raven/after-show/?activity=matte` | simulation | listed | 6 | workshops.js | ar, en | — |
| دورة لا تنقطع | after-show:zoetrope | `raven/after-show/?activity=zoetrope` | simulation | listed | 4 | workshops.js | ar, en | — |
| الممثل في آخر صف | after-show:costume | `raven/after-show/?activity=costume` | simulation | listed | 5 | workshops.js | ar, en | — |
| المطر داخل صندوق | after-show:rainbox | `raven/after-show/?activity=rainbox` | simulation | listed | 4 | workshops.js | ar, en | — |
| خطوة من اثنتي عشرة صورة | after-show:stopmotion | `raven/after-show/?activity=stopmotion` | simulation | listed | 6 | workshops.js | ar, en | — |
| بين جملتين | after-show:description | `raven/after-show/?activity=description` | tool | listed | 5 | workshops.js | ar, en | — |
| آخر باب إلى الصالة | after-show:wayfinding | `raven/after-show/?activity=wayfinding` | game | listed | 5 | workshops.js | ar, en | — |
| أربع نغمات تعود | after-show:leitmotif | `raven/after-show/?activity=leitmotif` | tool | listed | 4 | workshops.js | ar, en | — |
| مدينة بأربع قصاصات | after-show:shadows | `raven/after-show/?activity=shadows` | simulation | listed | 3 | workshops.js | ar, en | — |
| بروفة بلا حوار | after-show:performance | `raven/after-show/?activity=performance` | simulation | listed | 5 | workshops.js | ar, en | — |
| الغرفة التي تخرج من الكتاب | after-show:popup | `raven/after-show/?activity=popup` | simulation | listed | 6 | workshops.js | ar, en | — |
| المؤثّر الذي يُكتب باليد | after-show:film-ink | `raven/after-show/?activity=film-ink` | tool | listed | 5 | workshops.js | ar, en | — |
| رخام من ورق | after-show:scenic-texture | `raven/after-show/?activity=scenic-texture` | simulation | listed | 4 | workshops.js | ar, en | — |
| الشخص الذي قابل نفسه | after-show:split-screen | `raven/after-show/?activity=split-screen` | tool | listed | 6 | workshops.js | ar, en | — |
| فيلم له بابان | after-show:branch-film | `raven/after-show/?activity=branch-film` | story | listed | 8 | workshops.js | ar, en | — |
| آخر إرسال | after-show:edit | `raven/after-show/?activity=edit` | game | listed | 3 | workshops.js | ar, en | — |
| وردية غرفة العرض | after-show:projection | `raven/after-show/?activity=projection` | simulation | listed | 4 | workshops.js | ar, en | — |
| طاولة الضوء | after-show:light | `raven/after-show/?activity=light` | simulation | listed | 3 | workshops.js | ar, en | — |
| خارج الكادر | after-show:sound | `raven/after-show/?activity=sound` | simulation | listed | 2 | workshops.js | ar, en | — |
| نقطة تفتيش الأرشيف | after-show:archive | `raven/after-show/?activity=archive` | simulation | listed | 2 | workshops.js | ar, en | — |
| عين الاستمرارية | after-show:continuity | `raven/after-show/?activity=continuity` | game | listed | 2 | workshops.js | ar, en | — |
| ميزانية اللقطة | after-show:budget | `raven/after-show/?activity=budget` | game | listed | 3 | workshops.js | ar, en | — |
| غرفة التلوين | after-show:grade | `raven/after-show/?activity=grade` | tool | listed | 3 | workshops.js | ar, en | — |
| مصمّم اللقطة | after-show:camera | `raven/after-show/?activity=camera` | simulation | listed | 2 | workshops.js | ar, en | — |
| ليلة العرض | after-show:festival | `raven/after-show/?activity=festival` | story | listed | 10 | workshops.js | ar, en | — |
| تحدّي اليوم | after-show:daily | `raven/after-show/?activity=daily` | game | listed | 3 | workshops.js | ar, en | — |
| المخرج والمونتير | after-show:duo | `raven/after-show/?activity=duo` | game | listed | 5 | workshops.js | ar, en | JSON |
| مونتاج حر | after-show:free | `raven/after-show/?activity=free` | tool | listed | 5 | workshops.js | ar, en | JSON |
| مولّد التكليفات | after-show:brief | `raven/after-show/?activity=brief` | tool | listed | 2 | workshops.js | ar, en | — |
| اصنع تحدّيك | after-show:custom | `raven/after-show/?activity=custom` | game | listed | 5 | workshops.js | ar, en | JSON |
| بطاقة العرض | after-show:card | `raven/after-show/?activity=card` | card | listed | 1 | workshops.js | ar, en | PNG |
| آخر إرسال | after-show-25:01-last-send | `raven/after-show-25/01-last-send.html` | game | legacy-interactive | 2 | single-round editorial estimate | ar | — |
| وردية غرفة العرض | after-show-25:02-shift | `raven/after-show-25/02-shift.html` | simulation | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| طاولة الضوء | after-show-25:03-light | `raven/after-show-25/03-light.html` | simulation | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| خارج الكادر | after-show-25:04-foley | `raven/after-show-25/04-foley.html` | simulation | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| نقطة تفتيش الأرشيف | after-show-25:05-archive | `raven/after-show-25/05-archive.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| عين الاستمرارية | after-show-25:06-continuity | `raven/after-show-25/06-continuity.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| ميزانية اللقطة | after-show-25:07-budget | `raven/after-show-25/07-budget.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| المخرج والمونتير | after-show-25:08-duo | `raven/after-show-25/08-duo.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| تحدي اليوم | after-show-25:09-daily | `raven/after-show-25/09-daily.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| ليلة العرض | after-show-25:10-night | `raven/after-show-25/10-night.html` | story | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| مولد تكليفات المخرج | after-show-25:11-brief | `raven/after-show-25/11-brief.html` | tool | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| جرب تعديلا | after-show-25:12-tweak | `raven/after-show-25/12-tweak.html` | tool | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| لوحة اللقطات | after-show-25:13-board | `raven/after-show-25/13-board.html` | tool | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| سباق الترجمة | after-show-25:14-subs | `raven/after-show-25/14-subs.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| ضبط الصوت | after-show-25:15-sound | `raven/after-show-25/15-sound.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| ترتيب سريع | after-show-25:16-fast-cut | `raven/after-show-25/16-fast-cut.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| ذاكرة الكادر | after-show-25:17-memory | `raven/after-show-25/17-memory.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| إيقاع المونتاج | after-show-25:18-rhythm | `raven/after-show-25/18-rhythm.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| تخمين الظل | after-show-25:19-shadow | `raven/after-show-25/19-shadow.html` | simulation | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| توقيت المؤثر | after-show-25:20-fx-time | `raven/after-show-25/20-fx-time.html` | simulation | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| فرز النسخ | after-show-25:21-sort | `raven/after-show-25/21-sort.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| تحدي البروفة | after-show-25:22-rehearsal | `raven/after-show-25/22-rehearsal.html` | game | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| خريطة العرض | after-show-25:23-map | `raven/after-show-25/23-map.html` | tool | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| ستارة النهاية | after-show-25:24-curtain | `raven/after-show-25/24-curtain.html` | card | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| اختر لي تجربة | after-show-25:25-picker | `raven/after-show-25/25-picker.html` | card | legacy-interactive | 1 | single-round editorial estimate | ar | — |
| عشر ثوانٍ في المحطّة | late-night:station-shadow | `raven/late-night/station-shadow.html` | game | listed | 2 | late-night/catalog.js | ar, en | — |
| بكرة تدور في سينما نائمة | late-night:reel-run | `raven/late-night/reel-run.html` | game | listed | 3 | late-night/catalog.js | ar, en | — |
| مزاد الدقيقة الأخيرة | late-night:last-minute-auction | `raven/late-night/last-minute-auction.html` | game | listed | 4 | late-night/catalog.js | ar, en | — |
| خزانة المفقودات | late-night:lost-and-found | `raven/late-night/lost-and-found.html` | game | listed | 2 | late-night/catalog.js | ar, en | — |
| القبة ذات السماء الناقصة | late-night:dome-sky | `raven/late-night/dome-sky.html` | game | listed | 3 | late-night/catalog.js | ar, en | PNG |
| تردّد لشخصين | late-night:echo-two | `raven/late-night/echo-two.html` | game | listed | 4 | late-night/catalog.js | ar, en | — |
| ظلال المنارتين | late-night:nightshift-mirrors | `raven/late-night/nightshift-mirrors.html` | game | listed | 4 | late-night/catalog.js | ar, en | — |
| بريد المصعد | late-night:nightshift-post | `raven/late-night/nightshift-post.html` | game | listed | 4 | late-night/catalog.js | ar, en | — |
| الاختبار من آخر مقعد | late-night:echo-last-seat | `raven/late-night/echo-last-seat.html` | simulation | listed | 3 | late-night/catalog.js | ar, en | PNG |
| دقيقة التحميض | late-night:darkroom-minute | `raven/late-night/darkroom-minute.html` | simulation | listed | 4 | late-night/catalog.js | ar, en | PNG |
| كاميرا بلا وزن | late-night:weightless-cam | `raven/late-night/weightless-cam.html` | simulation | listed | 3 | late-night/catalog.js | ar, en | PNG |
| مرفأ المدّ والجزر | late-night:tide-harbor | `raven/late-night/tide-harbor.html` | simulation | listed | 3 | late-night/catalog.js | ar, en | PNG |
| نسيج في مهبّ الهواء | late-night:fabric-wind | `raven/late-night/fabric-wind.html` | simulation | listed | 3 | late-night/catalog.js | ar, en | PNG |
| ورق تحت المطر | late-night:nightshift-paper | `raven/late-night/nightshift-paper.html` | simulation | listed | 3 | late-night/catalog.js | ar, en | PNG |
| مخرج من جملة | late-night:director-sentence | `raven/late-night/director-sentence.html` | tool | listed | 4 | late-night/catalog.js | ar, en | — |
| ممثل طاولة القراءة | late-night:reading-actor | `raven/late-night/reading-actor.html` | tool | listed | 4 | late-night/catalog.js | ar, en | — |
| إذاعة المدينة التي صنعتها | late-night:city-radio | `raven/late-night/city-radio.html` | tool | listed | 2 | late-night/catalog.js | ar, en | — |
| صاحب اللغز | late-night:puzzle-owner | `raven/late-night/puzzle-owner.html` | game | listed | 4 | late-night/catalog.js | ar, en | — |
| معلّق الإعادة | late-night:replay-caller | `raven/late-night/replay-caller.html` | tool | listed | 2 | late-night/catalog.js | ar, en | — |
| المصعد الذي يتذكّر | late-night:memory-lift | `raven/late-night/memory-lift.html` | story | listed | 4 | late-night/catalog.js | ar, en | JSON |
| سبع نوافذ مضاءة | late-night:seven-windows | `raven/late-night/seven-windows.html` | story | listed | 3 | late-night/catalog.js | ar, en | JSON |
| حفلة خلف الستارة | late-night:curtain-party | `raven/late-night/curtain-party.html` | story | listed | 3 | late-night/catalog.js | ar, en | JSON |
| نافذة فوق البحر | late-night:nightshift-window | `raven/late-night/nightshift-window.html` | story | listed | 3 | late-night/catalog.js | ar, en | — |
| مقعد حُجز لشخص لن يأتي | late-night:nightshift-seat | `raven/late-night/nightshift-seat.html` | story | listed | 10 | late-night/catalog.js | ar, en | — |
| متحف الأصوات المنسيّة | late-night:sound-museum | `raven/late-night/sound-museum.html` | story | listed | 3 | late-night/catalog.js | ar, en | JSON |
| عندي دقيقتين | late-night:time-door | `raven/late-night/time-door.html` | card | listed | — | variable / unlisted | ar, en | — |
| أمسية من ثلاثة فصول | late-night:three-evening | `raven/late-night/three-evening.html` | story | listed | — | variable / unlisted | ar, en | PNG |
| دفتر أعمالي | late-night:my-notebook | `raven/late-night/my-notebook.html` | tool | listed | — | variable / unlisted | ar, en | JSON, saved image |
| كرسي مبرمج المهرجان | late-night:festival-chair | `raven/late-night/festival-chair.html` | tool | listed | — | variable / unlisted | ar, en | — |
| من فكرتي إلى الاستوديو | late-night:idea-to-studio | `raven/late-night/idea-to-studio.html` | tool | listed | — | variable / unlisted | ar, en | — |
| معاينة حوار «الاسم المحذوف» | late-night:dialogue-preview | `raven/late-night/dialogue-preview.html` | card | listed | — | variable / unlisted | ar, en | — |
| حلقات RAVEN 17 | late-night:episode-ends | `raven/late-night/episode-ends.html` | card | listed | — | variable / unlisted | ar, en | — |
| الورق والهاتف | late-night:behind-frame | `raven/late-night/behind-frame.html` | card | listed | — | variable / unlisted | ar, en | — |
| تحدي نهاية الأسبوع | late-night:weekend | `raven/late-night/weekend.html` | game | listed | — | variable / unlisted | ar, en | PNG |
| غرفة مشاهدة على جهاز واحد | late-night:screening-room | `raven/late-night/screening-room.html` | story | listed | — | variable / unlisted | ar, en | TXT |
| القطع الأخير | ink:ink-cut | `raven/late-night/ink-cut.html` | game | listed | 3 | single-round editorial estimate | ar, en | — |
| كاميرا الطبقات | ink:ink-camera | `raven/late-night/ink-camera.html` | simulation | listed | 3 | single-round editorial estimate | ar, en | PNG |
| آخر عبّارة | ink:ink-ferry | `raven/late-night/ink-ferry.html` | story | listed | 3 | single-round editorial estimate | ar, en | — |
| صفحة قبل الفجر | ink:ink-page | `raven/late-night/ink-page.html` | tool | listed | 4 | single-round editorial estimate | ar, en | PNG |
| حارس المنارة | ink:ink-beacon | `raven/late-night/ink-beacon.html` | game | listed | 2 | single-round editorial estimate | ar, en | — |
| ساعي المطر | ink:ink-courier | `raven/late-night/ink-courier.html` | game | listed | 5 | single-round editorial estimate | ar, en | PNG, JSON |
| خطوط السرعة | ink:ink-lines | `raven/late-night/ink-lines.html` | tool | listed | 3 | single-round editorial estimate | ar, en | — |
| فقاعات الحوار | ink:ink-letters | `raven/late-night/ink-letters.html` | tool | listed | 3 | single-round editorial estimate | ar, en | — |

## تشابه الاسم أو النشاط

| المدخل | المدخل الآخر | أساس المقارنة |
| --- | --- | --- |
| after-show:edit | after-show-25:01-last-send | matching title |
| after-show:edit | after-show-25:13-board | related mechanic |
| after-show:edit | after-show-25:16-fast-cut | related mechanic |
| after-show:edit | after-show-25:24-curtain | related mechanic |
| after-show:projection | after-show-25:02-shift | matching title |
| after-show:projection | after-show-25:14-subs | related mechanic |
| after-show:projection | after-show-25:15-sound | related mechanic |
| after-show:projection | after-show-25:22-rehearsal | related mechanic |
| after-show:light | after-show-25:03-light | matching title |
| after-show:light | after-show-25:19-shadow | related mechanic |
| after-show:sound | after-show-25:04-foley | matching title |
| after-show:sound | after-show-25:18-rhythm | related mechanic |
| after-show:sound | after-show-25:20-fx-time | related mechanic |
| after-show:archive | after-show-25:05-archive | matching title |
| after-show:archive | after-show-25:21-sort | related mechanic |
| after-show:continuity | after-show-25:06-continuity | matching title |
| after-show:continuity | after-show-25:17-memory | related mechanic |
| after-show:budget | after-show-25:07-budget | matching title |
| after-show:festival | after-show-25:10-night | matching title |
| after-show:festival | after-show-25:23-map | related mechanic |
| after-show:daily | after-show-25:09-daily | matching title |
| after-show:duo | after-show-25:08-duo | matching title |
| after-show:free | after-show-25:12-tweak | related mechanic |
| after-show:brief | after-show-25:11-brief | related mechanic |
| after-show-25:13-board | late-night:idea-to-studio | related mechanic |
| after-show-25:25-picker | late-night:festival-chair | related mechanic |

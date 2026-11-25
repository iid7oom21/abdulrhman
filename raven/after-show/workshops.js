// Each workshop group is a separate lazy-loaded workbench. Times are estimates in minutes.
export const rooms = {
  screencraft: ['الزمن على الشاشة', 'Screen timing'],
  illusions: ['خدع الكاميرا', 'Camera illusions'],
  stagecraft: ['إدارة المشهد', 'Directing a scene'],
  practical: ['الصوت والمجسّمات', 'Sound and models'],
  filmlab: ['معمل الفيلم', 'Film lab']
};

function workshop(group, id, minutes, ar, en, copyAr, copyEn, actionAr, actionEn) {
  return [id, [ar, en, copyAr, copyEn, actionAr, actionEn, minutes, 'preview-' + id, group]];
}

export const workshops = Object.fromEntries([
  workshop('screencraft', 'titles', 5, 'الاسم يعبر الشاشة', 'A title crosses the screen', 'حرّك عنوانًا على زجاج الواجهة واختبر متى يستطيع المارّ قراءته.', 'Place a title on glass and time it around a passing figure.', 'ركّب الشارة', 'Set the title'),
  workshop('screencraft', 'parallax', 4, 'مدينة من ثلاث زجاجات', 'A city on three panes', 'حرّك طبقات المدينة بسرعات مختلفة خلف نافذة القطار.', 'Give three city layers different speeds outside a train window.', 'حرّك المدينة', 'Move the city'),
  workshop('screencraft', 'subtitles', 5, 'كرسي المترجم الأخير', 'The subtitler’s chair', 'اختر صياغة سطر وحدّد كم يبقى فوق لقطة المخبز.', 'Choose a line and set how long it stays over the bakery scene.', 'وقّت الترجمة', 'Time the subtitle'),
  workshop('screencraft', 'blocking', 7, 'ثلاثة مداخل ومفتاح واحد', 'Three entrances, one key', 'وزّع دخول الممثلين ليعبر المفتاح الخشبة قبل الستار.', 'Time the cast so the key crosses the stage before the curtain.', 'وزّع المداخل', 'Block the entrances'),
  workshop('illusions', 'forced-scale', 3, 'فنجان بحجم عمارة', 'A building-sized cup', 'اضبط المنظور حتى يعلو الفنجان فوق عمارة بعيدة.', 'Line up a cup with a distant building to change its apparent scale.', 'ركّب المنظور', 'Line up the shot'),
  workshop('illusions', 'matte', 6, 'نصف الفندق مرسوم', 'Half a hotel in paint', 'اختر أين ينتهي بهو الفندق وأين يبدأ الطابق المرسوم.', 'Choose where the real lobby gives way to its painted upper floor.', 'اضبط الوصلة', 'Match the seam'),
  workshop('illusions', 'zoetrope', 4, 'دورة لا تنقطع', 'A seamless loop', 'وزّع زوايا جناح طائر ورقي وشاهد وصلة نهاية الدورة.', 'Set the angles of a paper wing and watch the loop close.', 'أدر الدولاب', 'Spin the drum'),
  workshop('illusions', 'costume', 5, 'الممثل في آخر صف', 'Costumes from the back row', 'صمّم أزياء ثلاثة أدوار ثم اختبر تمييزها من آخر القاعة.', 'Dress three roles and compare their silhouettes from the back row.', 'فصّل الأزياء', 'Dress the cast'),
  workshop('stagecraft', 'rainbox', 4, 'المطر داخل صندوق', 'Rain in a box', 'حرّك المطر أمام نافذة مصغّرة واختر لحظة التصوير.', 'Move rain past a miniature window and pick the instant to shoot.', 'التقط القطرة', 'Catch a drop'),
  workshop('stagecraft', 'stopmotion', 6, 'خطوة من اثنتي عشرة صورة', 'A twelve-frame step', 'وزّع وزن كرسي متحرك على اثني عشر إطارًا.', 'Distribute a walking chair’s weight across twelve frames.', 'حرّك الكرسي', 'Animate the chair'),
  workshop('stagecraft', 'description', 5, 'بين جملتين', 'Between two lines', 'أدخل وصف الحركة في فسحة بين صوتي الشخصيتين.', 'Place a description of the action in a gap between voices.', 'رتّب الوصف', 'Place the description'),
  workshop('stagecraft', 'wayfinding', 5, 'آخر باب إلى الصالة', 'The last door to the screen', 'وجّه زائر السينما بأربع لافتات وجرّب طريق المنحدر.', 'Guide a visitor with four signs and try the ramp route.', 'ضع اللافتات', 'Place the signs'),
  workshop('practical', 'leitmotif', 4, 'أربع نغمات تعود', 'Four notes return', 'اكتب عبارة من أربع نغمات وغيّر وقعها عند عودتها.', 'Write a four-note phrase and change how it sounds on its return.', 'ألّف العبارة', 'Write the phrase'),
  workshop('practical', 'shadows', 3, 'مدينة بأربع قصاصات', 'A city in four cutouts', 'طابق ظلّ القصاصات الأربع مع هيئة على سطح العرض.', 'Fit the shadows of four cutouts into a silhouette on the screen.', 'ركّب الظل', 'Build the shadow'),
  workshop('practical', 'performance', 5, 'بروفة بلا حوار', 'A wordless rehearsal', 'أخرج إشارة ونظرة وخطوة، ثم سلّم المشهد لمشاهد ثانٍ.', 'Direct a gesture, a glance and a step, then hand the scene to a viewer.', 'وجّه الأداء', 'Direct the performance'),
  workshop('practical', 'popup', 6, 'الغرفة التي تخرج من الكتاب', 'A room unfolds', 'ركّب مفاصل الديكور واختبر فتح الكتاب وإغلاقه.', 'Place the set hinges and test how the book opens and folds.', 'اطوِ الغرفة', 'Fold the room'),
  workshop('filmlab', 'film-ink', 5, 'المؤثّر الذي يُكتب باليد', 'Ink on film', 'ارسم أثرًا ضوئيًا وحدّد أين يمر خلف الجسم المتحرك.', 'Trace a light trail and choose where it passes behind the subject.', 'ارسم الأثر', 'Trace the light'),
  workshop('filmlab', 'scenic-texture', 4, 'رخام من ورق', 'Marble on paper', 'صمّم عينة رخام واختبر شكلها عند عرضها من بعيد.', 'Build a marble sample and inspect it at screening distance.', 'امزج الخامة', 'Mix a texture'),
  workshop('filmlab', 'split-screen', 6, 'الشخص الذي قابل نفسه', 'Meeting a double', 'اجمع أداءين في مقهى كي تتسلم يدٌ الكوبَ من الأخرى.', 'Blend two performances and time a cup passing between hands.', 'اجمع الأداءين', 'Composite the takes'),
  workshop('filmlab', 'branch-film', 8, 'فيلم له بابان', 'A film with two doors', 'اربط غرف متحف بخيارات ثم شاهد إلى أين تقود نهاياتك.', 'Link museum rooms with choices and play through the endings you built.', 'ارسم التفرعات', 'Build the paths')
]);

export const catalog = {
  ...workshops,
  edit: ['آخر إرسال','Last Transmission','عرّف بالمكان والفعل والأثر في مونتاج من ثلاث لقطات.','Introduce a place, an action and its trace in three shots.','ركّب اللقطات','Make the cut',3,'hand','edit'],
  projection: ['وردية غرفة العرض','Projection shift','وزّع الفنيين والشاشة قبل الافتتاح.','Schedule the crew and the screen before opening.','شغّل الوردية','Run the shift',4,'preview-projection','sims'],
  light: ['طاولة الضوء','The light table','حرّك الظل وصوّر ملمس الورق.','Move the shadow and photograph the paper.','اضبط الضوء','Set the light',3,'preview-light','sims'],
  sound: ['خارج الكادر','Offscreen sound','ركّب صوت الحركة في اللحظة المناسبة.','Place each sound at the instant of the action.','اضبط التوقيت','Set the cues',2,'preview-sound','sims'],
  archive: ['نقطة تفتيش الأرشيف','Archive check','طابق الشحنة مع طلب العرض.','Match the delivery against its screening order.','افحص الشحنة','Check a delivery',2,'preview-archive','sims'],
  continuity: ['عين الاستمرارية','Continuity eye','قارن ديكور اللقطتين وابحث عمّا تحرّك.','Compare two setups and spot what moved.','قارن اللقطتين','Compare the shots',2,'preview-continuity','events'],
  budget: ['ميزانية اللقطة','Shot budget','اختر كيف تصرف عشر وحدات إنتاج.','Decide how to spend ten production units.','وزّع الميزانية','Build a budget',3,'preview-budget','events'],
  grade: ['غرفة التلوين','Colour grading suite','لوّن لقطة وحرّك الفاصل لتقارنها بالأصل.','Grade a frame and slide the divider to compare it with the original.','لوّن اللقطة','Grade a shot',3,'preview-grade','lens'],
  camera: ['مصمّم اللقطة','Camera shot designer','اتخذ موقعك حول الطاولة واضبط حجم الظرف في الكادر.','Choose a camera height and frame the envelope on the table.','اضبط الكادر','Frame the shot',2,'preview-camera','lens'],
  festival: ['ليلة العرض','Screening night','اختر المونتاج والضوء والصوت ثم اعرض نسختك.','Cut, light and score a scene, then watch your version.','ابدأ الأمسية','Start the night',10,'lamp','events'],
  daily: ['تحدّي اليوم','Daily assignment','مواد اليوم وتكليفه واحدة لكل اللاعبين.','Everyone gets the same materials and brief today.','افتح تكليف اليوم','Open today’s brief',3,'exterior','edit'],
  duo: ['المخرج والمونتير','Director and editor','شخصان، جهاز واحد، وطلب ينتظر تفسيره.','Two people share one device and interpret a brief.','سلّم الدور','Pass the director’s brief',5,'hand','edit'],
  free: ['مونتاج حر','Open cutting room','غيّر لقطة بين نسختين وشاهد الفرق.','Change one shot between two cuts and compare.','افتح الطاولة','Open the bench',5,'envelope','edit'],
  brief: ['مولّد التكليفات','Director’s briefs','اختر إيقاعًا وقيدًا واحصل على جولة قابلة للعب.','Pick a pace and a constraint to get a playable brief.','أنشئ تكليفًا','Generate a brief',2,'lamp','edit'],
  custom: ['اصنع تحدّيك','Build a challenge','حدّد قواعد جولتك وجرّبها قبل تنزيلها.','Set the rules and play your round before exporting.','صمّم الجولة','Design a round',5,'exterior','edit'],
  card: ['بطاقة العرض','Screening card','عاين بطاقتك واحفظ صورة منها.','Preview your card and save an image.','افتح البطاقة','Open the card',1,'envelope','events']
};

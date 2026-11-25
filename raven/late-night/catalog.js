// Approximate visit lengths, in minutes. The quick door opens the station immediately.
export const sections=[['العب','Play'],['شغّل المحاكاة','Run a simulation'],['اصنع مع المخرج','Create with the director'],['ادخل مشهدًا','Enter a scene']];
export const activities=[
['station-shadow','عشر ثوانٍ في المحطّة','Ten seconds at the station',2,0,'سجّل طريقك','Record your route'],
['reel-run','بكرة تدور في سينما نائمة','A reel in a sleeping cinema',3,0,'ارسم مسار البكرة','Route the reel'],
['last-minute-auction','مزاد الدقيقة الأخيرة','Last-minute auction',4,0,'قدّم عرضك','Place your bid'],
['lost-and-found','خزانة المفقودات','Lost and found',2,0,'افحص الأغراض','Inspect the items'],
['dome-sky','القبة ذات السماء الناقصة','The incomplete sky',3,0,'أدر القرصين','Turn the discs'],
['echo-two','تردّد لشخصين','A frequency for two',4,0,'أرسل إشارة','Send a signal'],
['nightshift-post','بريد المصعد','Elevator Mail',4,0,'شغّل مصعد البريد','Run the mail lift'],
['echo-last-seat','الاختبار من آخر مقعد','The last-seat soundcheck',3,1,'اختر مقعدًا','Choose a seat'],
['darkroom-minute','دقيقة التحميض','A minute in the darkroom',4,1,'اطبع صورتك','Make a print'],
['weightless-cam','كاميرا بلا وزن','Weightless camera',3,1,'ادفع الكاميرا','Nudge the camera'],
['tide-harbor','مرفأ المدّ والجزر','Tidal harbour',3,1,'حدّد موعد الرحلة','Time the crossing'],
['fabric-wind','نسيج في مهبّ الهواء','Cloth in the wind',3,1,'ثبّت الراية','Rig the banner'],
['nightshift-paper','ورق تحت المطر','Paper in the Rain',3,1,'بلّل الحبر','Wet the ink'],
['director-sentence','مخرج من جملة','Direct a sentence',4,2,'شغّل فكرتك','Stage your idea'],
['reading-actor','ممثل طاولة القراءة','The table read',4,2,'ابدأ البروفة','Start rehearsal'],
['city-radio','إذاعة المدينة التي صنعتها','Your city on air',2,2,'ركّب النشرة','Build a bulletin'],
['puzzle-owner','صاحب اللغز','The puzzle maker',4,2,'جرّب قيدًا','Try a constraint'],
['replay-caller','معلّق الإعادة','Replay commentator',2,2,'راجع دفعاتك','Review your moves'],
['memory-lift','المصعد الذي يتذكّر','The remembering lift',4,3,'اختر حقبة','Choose an era'],
['seven-windows','سبع نوافذ مضاءة','Seven lit windows',3,3,'اختر نوافذك','Choose your windows'],
['curtain-party','حفلة خلف الستارة','Behind the curtain',3,3,'أعطِ إشارة','Call a cue'],
['nightshift-window','نافذة فوق البحر','Window above the sea',3,3,'أخرج المشهد','Direct the scene'],
['nightshift-seat','مقعد حُجز لشخص لن يأتي','A Seat Kept for Someone Who Won’t Come',10,3,'ادخل شباك التذاكر','Open the ticket window'],
['sound-museum','متحف الأصوات المنسيّة','Museum of forgotten sounds',3,3,'ركّب بطاقة بريدية','Arrange a postcard']
];
export const extras=[
['time-door','عندي دقيقتين','I have two minutes'],['three-evening','أمسية من ثلاثة فصول','A three-chapter evening'],
['my-notebook','دفتر أعمالي','My portfolio'],['festival-chair','كرسي مبرمج المهرجان','Festival programmer'],
['idea-to-studio','من فكرتي إلى الاستوديو','From idea to studio'],['dialogue-preview','معاينة حوار «الاسم المحذوف»','The Deleted Name dialogue preview'],
['episode-ends','حلقات RAVEN 17','RAVEN 17 episodes'],['behind-frame','الورق والهاتف','Paper and phone'],
['weekend','تحدي نهاية الأسبوع','Weekend challenge'],['screening-room','غرفة مشاهدة على جهاز واحد','A screening room for two']
];
export function featured(time=Date.now()) {
  const rotation=['station-shadow','director-sentence','seven-windows','darkroom-minute','tide-harbor','dome-sky'];
  return activities.find(item=>item[0]===rotation[Math.floor(time/21600000)%rotation.length]);
}

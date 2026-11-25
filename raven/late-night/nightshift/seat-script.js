// The Arabic and English texts are two readings of the same authored scene.
// A cue unlocks its next page. Only the decision at the interval chooses an ending.
export const title = ['مقعد حُجز لشخص لن يأتي', 'A Seat Kept for Someone Who Won’t Come'];
export const stills = {
  booth: {file:'salma-booth.webp', description:['سلمى في شباك التذاكر بالسينما القديمة.','Salma at the ticket window of the old cinema.']},
  aisle: {file:'seat-auditorium.webp', description:['صف مقاعد فارغ يطلّ على الممر المضاء.','An empty row looking onto the lit aisle.']}
};
export const objects = {
  ticket: {
    button:['افرد التذكرة','Unfold the ticket'], heading:['على ظهر التذكرة','On the back of the ticket'],
    text:['«أمل. الصف الرابع، عند الممر. الحجز حتى آخر جرس». على الطرف الآخر من الثنية كتبت سلمى بخط أصغر: «إذا تأخّر مركب اليوم قد لا تجيء». التاريخ هو تاريخ الليلة. في الدرج عشر ورقات أخرى من الرزمة نفسها، كلها بلا أسماء. تقلب سلمى التذكرة على وجهها ثم تضعها وحدها عند يدها اليسرى، بعيدًا عن الرزمة.',
      '“Amal. Fourth row, aisle. Hold until the last bell.” On the other side of the fold Salma has written, smaller, “If the boat is late today, she may not come.” The date is tonight’s. In the drawer are ten more slips from the same pad, every one blank. Salma turns this ticket face up and puts it by her left hand, well clear of the stack.']
  },
  seat: {
    button:['أنزل المقعد واقرأ بطاقة الفقرة','Lower the seat and read the programme slip'], heading:['فقرة قبل الفيلم','Before the feature'],
    text:['«دقيقة من عمل أمل في هذه الصالة. شريط مسموع أو دقيقة على المقعد المحجوز». كُتبت العبارة قبل طباعة التذاكر. في الورقة الأصلية شطبت أمل كلمة «تكريم». قالت يومها إن المقبل على فيلم لا يليق أن يُمتحن في معرفة من اشتغلت بالمكنسة قبل مجيئه. أبقت على الدقيقة. كان طولها، كما قالت وهي تقيس الممر بخطواتها، يكفي من الباب إلى آخر صف ثم الرجوع إذا نسي أحد معطفه.',
      '“One minute of Amal’s work in this house. A recording, or a minute held at her seat.” The words were agreed before tickets went on sale. On the proof Amal crossed out “tribute.” Nobody who had come for a film, she said, should be given a test on the woman who had swept up before they arrived. She kept the minute. In a minute, she said, walking the aisle to check, you could reach the back row and come all the way back if somebody had forgotten a coat.']
  },
  tape: {
    button:['افتح علبة الشريط','Open the tape case'], heading:['علامة الإيقاف','The stop mark'],
    text:['بطاقة أمل بخط يدها: «من أول المزلاج إلى طقّة الزر فقط. يصلح للقاعة الليلة. الوجه الثاني مسحته. لا توصلوا الفراغ بشيء». تثبّت سلمى البطاقة تحت عدّاد البكرات. في الكيس قلم رصاص كانت أمل تلفّ به الشريط إذا أفلت من مكانه. جرّبته سلمى مرة وهي صغيرة وأدارت البكرة بالعكس. يومها جلست أمل معها حتى عاد الشريط إلى موضعه، ولم تقل لأحد من رواد الصالة لماذا تأخر فتح الباب.',
      'Amal’s handwriting: “From the latch to the click of the button. You can play that much in the house tonight. I wiped the other side. Don’t splice anything onto the blank.” Salma wedges it beneath the counter on the deck. In the case is the pencil Amal used for winding loose tape. Once, as a child, Salma had taken it in hand and wound the wrong way. Amal sat down beside her until the tape was back where it belonged. No one in the queue ever found out why the doors opened late that day.']
  },
  line: {
    button:['ارفع غطاء الهاتف الداخلي','Lift the house phone cover'], heading:['الخط بين البابين','Between the two doors'],
    text:['تحت الغطاء زر واحد يصل السينما بكشك المرفأ. هذا الخط مفتوح قبل الجرس. قالت أمل لسلمى صباحًا: «إذا احتَرْتِ وش تسوين في الدقيقة، اتصلي قبل العرض. إذا سألتِني وقتها، أحب أسمع القاعة من مكانك. ارفعي السماعة وخليها عند الباب». لم يبدأ أحد مكالمة بعد. تعيد سلمى الغطاء إلى موضعه من غير أن تضغط الزر.',
      'Under the cover there is one button. It connects the cinema to the ferry kiosk, and it works before the bell. That morning Amal said, “If you aren’t sure what to do with the minute, ring before the film. If you do ask, I’d like to hear the house from where you stand. Put the receiver by the door.” Nobody has made the call yet. Salma puts the cover back without pressing the button.']
  }
};

export const passage = [
  {start:0,end:2, cue:['يرتفع لسان مزلاج الباب ويسقط في مكانه.','A door latch lifts, then drops into its catch.']},
  {start:2,end:5, cue:['ثلاث خطوات على خشب الممر، وبين الثانية والثالثة مهلٌ قصير.','Three footsteps on the aisle boards, a little space between the second and the third.']},
  {start:5,end:7, cue:['يرتفع مقعد قابل للطي ويستقرّ على اللباد.','A folding seat rises and settles against its felt stop.']},
  {start:7,end:8, cue:['طقّة زر التسجيل، ثم ينتهي المقتطف.','The recorder button clicks. The excerpt ends.']}
];
export const pages = {
  ticket: {
    time:'19:38', still:'booth', title:['التذكرة التي لم تُثقب','The unpunched ticket'],
    paragraphs:[
      ['قبل أن يفتح شباك السينما بساعة، ثنت سلمى تذكرة بالطول. هذه طريقتها منذ كانت تتعلّم البيع: التذكرة المثنية تعود إلى يدٍ بعينها. لا تُثقب، ولا تُحسب في إيراد الليلة، ولا تذهب مع الأوراق التي في الدرج. وضعتها عند الزجاج فرفعتها نفحة من باب البحر. ردّتها إلى مكانها ووضعت فوقها مثقاب التذاكر.',
       'An hour before the old cinema opened, Salma folded one ticket lengthways. It was a habit from her first week at the window. A folded ticket was meant for a particular hand. You didn’t punch it or count it in the takings or put it away with the slips in the drawer. She set it by the glass. A draught from the sea door lifted it. She put it back and set the ticket punch on top.'],
      ['في الطرف الآخر من ممر قصير مضاء، جلست أمل في كشك المرفأ تبيع الشاي للمنتظرين. عملت سنواتٍ في السينما، والليلة يعرضون قبل الفيلم دقيقة صنعتها من أصوات شغلها. قالت صباحًا إنها ستأتي إن رسا المركب في موعده. الآن جاء صبي من الرصيف يحمل إبريقًا فارغًا: «أمل تقول لك إنها باقية تملأ الأكواب لين يجي المركب. ابدؤوا في موعدكم». أخذ إبريقه وراح. سلمى تعرف أن أمل، إذا قالت ابدؤوا، تضيق بمن ينتظرها.',
       'Across a short, lighted passage Amal was selling tea to waiting passengers at the ferry kiosk. She had worked in the cinema for years. Tonight there was a minute before the feature for something she had made out of the sounds of that work. If the boat came on time, she had said, she would take her seat. Now a boy from the quay had come with an empty jug. “Amal says she’s staying to fill the cups until the boat comes. Start on time.” He took his jug and went. When Amal said start, Salma knew, she hated to be kept waiting for.'],
      ['عند النافذة زبونان يريدان كرسيين متجاورين. وجدت لهما اثنين في الوسط. لم يقل أحد شيئًا عن المقعد المفرد عند الممر. بقي المثقاب على ورقته، مع أنه يلزم للعمل الآن.',
       'At the window a couple wanted two places together. She found them two in the middle. Neither asked about the single on the aisle. The punch was still on its paper, although by now she needed it for work.']
    ]
  },
  aisle: {
    time:'19:45', still:'aisle', title:['عرض الممر','The width of an aisle'],
    paragraphs:[
      ['بعد أن خفّ الصف، أخذت سلمى التذكرة ومشت إلى كرسي أمل. مرّت يدها فوق مساند الصف الرابع تبحث عن الحافة الملساء التي تركتها كفوف الناس وهم ينعطفون نحو أماكنهم. هذا هو. لا يحمل لافتةً تميّزه. تحت المقعد شريط لباد جديد يخمد صوته حين ينهض الجالس. خيّطته أمل في صباح آخر يوم لها هنا، بإبرة أكبر من أذن سلمى الصغيرة في ذلك الوقت.',
       'When the queue thinned, Salma took the ticket to Amal’s seat. Her hand ran over the arms in the fourth row, looking for the smooth edge polished by people turning into the row. Here it was. No plaque set it apart. There was a strip of new felt underneath to soften the seat as it rose. Amal had stitched it on her last morning at the cinema with a needle bigger than Salma’s earring had been at the time.'],
      ['ترك عامل العرض ورقة البرنامج على المسند. من الصف الخلفي ناداه أحدهم ليضبط الترجمة وقال آخر إن الضوء فوق السلم لم ينطفئ. مدّ رأسه من نافذة غرفة العرض: «ما إن ترفعي كفّك أشغّل الفيلم. عندنا قبلها دقيقة؛ أُبقي ضوء الممر فيها؟». أجابت: «خلّه الآن. برفع يدي في نهاية الدقيقة، مهما صار هنا». عاد إلى جهازه. سُمعت من خلف الباب جرّة مقعد ثم ضحكة قصيرة لأن شخصين حاولا أن يفسح أحدهما للآخر في الوقت نفسه.',
       'The projectionist had left the programme slip on the arm. Somebody at the back wanted the subtitles adjusted; somebody else pointed out the lamp above the stairs. The projectionist leaned out of his high window. “I’ll start the film when you raise your hand. There’s a minute first. Shall I keep the aisle light on?” “For now,” she called. “Whatever we do with the minute, I’ll raise my hand at the end.” He went back to his machine. Beyond the door a seat scraped and two people laughed; each had tried to make room for the other at the same time.']
    ]
  },
  deck: {
    time:'19:51', still:'booth', title:['ثماني ثوانٍ على البكرة','Eight seconds on the reel'],
    paragraphs:[
      ['على الرف وراء الشباك مسجّل صغير، زرّه الأحمر أملس من كثرة الاستعمال. لقّنهما فنّي الصوت صباحًا كيف يوصلان مخرج المسجّل إلى القاعة. اختبرته سلمى في سمّاعة واحدة أولًا. جاء مزلاج الباب أوضح مما تذكّرت، وجاءت بعده خطوتان خفيفتان وثالثة أثقل منهما. كانت خفّة الصوت تثير فيها رغبة أن تسنده بكلام قليل: «هذه أمل في عملها». ثم نظرت إلى البطاقة على العلبة. ليس فيها تقديم.',
       'On the shelf behind the window was a little tape deck, its red button worn smooth. In the morning the sound technician had shown them how to send the output into the house. Salma checked it in one earpiece first. The latch came through more clearly than she remembered, then two light steps and a third a little heavier. The sound was so slight she wanted to support it with a few words: “This is Amal at work.” Then she looked at the label on the case. There was no introduction.'],
      ['ما زالت تذكر يوم التسجيل. لم تطلب أمل من أحد أن يهدأ. مشَت على الخشب، ردّت مقعدًا إلى مكانه، ومدّت إصبعها إلى الزر قبل أن تبدأ ضجّة المكان التالي. تركت لهم ثماني ثوانٍ صالحة للقاعة وباقي الدقيقة على تصرّفهم. إذا شغّلوها فلن يصير المكتوم بعدها كلامًا. رفعت سلمى سمّاعة الأذن حتى تسمع، في اللحظة نفسها، الصوت الذي على الشريط وما يجري الآن خلف الباب.',
       'She remembered the recording day. Amal had asked nobody to be quiet. She walked the boards, let a seat return to place and put her finger on the button before the next roomful of noise began. She had left them eight seconds they could use in the house. The rest of the minute was theirs. Playing those seconds would not turn the blank which followed into words. Salma lifted the earpiece a little so she could hear the sound on the tape and, at the same time, what was happening on the other side of the door.']
    ]
  },
  phone: {
    time:'19:55', still:'aisle', title:['الباب بين كشكين','The door between two booths'],
    paragraphs:[
      ['في المفصل الذي يشترك فيه البحر والسينما باب له نصف علوي من الزجاج المخدوش. من هنا كانت أمل تتابع في طفولتها أول دقيقتين من كل فيلم، ثم يعود بها أبوها إلى كشك الشاي. روت ذلك لسلمى مرة وهي تضع أوراق النعناع في الماء البارد. لم تقل اسم فيلم واحد. كل ما وصفته الضوء وهو يمشي حتى كفها على الزجاج. الليلة لا يظهر من الكشك إلا طرف إبريق وكمّ أمل تحرّكه في الغشاوة.',
       'Where the sea passage met the cinema there was a door with a scratched pane of glass in its upper half. Here, as a child, Amal had stood for the first two minutes of every picture before her father took her back to the tea kiosk. She had told Salma about it once as they put mint leaves in cold water. She hadn’t named a single film. All she described was the light travelling until it reached her palm on the glass. Tonight there was just a tip of a jug in sight and Amal’s sleeve moving through the mist on the pane.'],
      ['لم يكن على سلمى أن تأتي بها إلى القاعة. يستطيع اثنان أن يتقاسما دقيقةً ولو كان بينهما باب. خط الهاتف لا يمرّ بمقسم المدينة، والسماعة الطويلة تصل إلى عتبة الممر. قبلها بدقائق وضعت سلمى قرب الباب كرسيًا ذا ظهر مستقيم. يصلح لإسناد السماعة إن طلبت أمل ذلك، ويصلح لأن تجلس عليه سلمى وتراقب ضوء عامل العرض. ظل الكرسي على الحائط ينتظر أي الاستعمالين.',
       'It wasn’t Salma’s job to bring her into the house. Two people could share a minute with a door between them. The house line didn’t go through the town exchange, and the receiver had enough cord to reach the threshold. A little earlier Salma had put a straight-backed chair by the door. It could hold the receiver if Amal asked. It could just as well hold Salma while she watched for the projectionist’s light. The chair stood against the wall, waiting to find out which.']
    ]
  },
  interval: {
    time:'19:59',still:'aisle',title:['قبل أن ترفعي يدك','Before you raise your hand'],
    paragraphs:[
      ['أعطى عامل العرض الإشارة الأولى. هدأ من كان يطوي معطفه وبقي من لم يجد له موضعًا يطويه فيه. وضعت سلمى التذكرة المثنية فوق مسند المقعد. في يدها الأخرى علبة الشريط ومفتاح الغطاء المعدني للهاتف. من أي جهة في الصالة يمكن أن تُرى إذا رفعت يدها. بقيت دقيقة كاملة لم يأخذها الفيلم بعد.',
       'The projectionist signalled once. Most people finished folding their coats; one person was still looking for somewhere to put his. Salma laid the folded ticket on the arm of the seat. In her other hand were the tape case and the little key to the phone cover. From anywhere in the house her raised hand would be visible. There was a whole minute the film had not yet claimed.'],
      ['لم تحجز سلمى الكرسي لشخص آخر. أمل باقية عند المرفأ. ما تملكه سلمى الآن هو ترتيب هذه الدقيقة: صوت أمل الذي تركته على الشريط، أو المساحة التي تركتها في الصف، أو الوقت الكافي لتسألها كيف تريد أن تسمع القاعة. رفعت عينيها إلى نافذة العرض. كانت كفّ العامل مستندة إلى الحافة تنتظر كفّها.',
       'She had not held the seat for somebody else. Amal was staying at the quay. What Salma could decide was the shape of this minute: the sound Amal had left on tape, the space she had left in the row, or enough time to ask how she would like to hear the house. Salma looked up at the projection window. His hand was resting on its ledge, waiting for hers.']
    ]
  }
};

export const endings = {
  play: {
    choice:['شغّلي المقتطف المأذون','Play the approved excerpt'], title:['عند الطقّة','At the click'],
    before:[
      ['تحمل سلمى العلبة تحت ذراعها إلى الشباك. يتّسع مكانها خلف الزجاج لشخص واحد يتحرّك بناحيته اليسرى فقط؛ على الناحية اليمنى درجٌ إذا انفتح سدّ الطريق إلى مفتاح القاعة. تغلقه بركبتها كما كانت تفعل أمل. ترفع مستوى الصوت قليلاً ثم تتذكّر كيف كان المزلاج ينشز في الأذن الواحدة؛ تعيد المؤشر إلى الموضع الذي اتفقتا عليه في البروفة.',
       'Salma carries the case under her arm to the window. There is room behind the glass for one person moving mostly to the left. On the right a drawer, if left open, blocks the switch that feeds the house. She closes it with her knee the way Amal used to. She raises the level, remembers how the latch rang in the single earpiece and returns the needle to the mark they agreed at rehearsal.'],
      ['تخرج القطعة من السماعة فوق الباب. يبدو المزلاج لأول مرة آتيًا من السقف. تدير امرأة في الصف الرابع رأسها قليلًا لتفسح الطريق للخطوات الثلاث. لا أحد يمرّ. ترى سلمى المرأة وقد تنبّهت، وتراها تبقي رأسها على ميلته حتى ينتهي الصوت. بعد ارتداد المقعد تسمع سلمى الطقّة الصغيرة التي رسمت أمل عندها الخط.',
       'The piece comes out of the speaker above the door. For the first time the latch seems to be overhead. A woman in the fourth row turns her head a little to make room for the three approaching steps. Nobody passes. Salma sees the woman realise this and sees her hold her head at the same angle until the sound is over. After the seat settles, there is the small click where Amal drew the line.']
    ],
    action:['أوقفي الشريط عند العلامة','Stop the tape at its mark'],
    after:[
      ['ترفع سلمى زر التشغيل. يتوقف العدّاد، ويصبح لسكوت الجهاز حدّ مسموع. بقي من الدقيقة وقت أطول بكثير مما توقعت. تمد يدها إلى قصاصة البرنامج لتقول شيئًا ثم تسحبها؛ لا كلام في البطاقة. يجلس المتأخر في أول موضع خالٍ يلقاه، ويذهب صوت خشبة حقيقية من تحت قدمه إلى آخر القاعة. يجد الرجل أخيرًا موضعًا لمعطفه. حين ترفع سلمى يدها يكون الضوء فوق الممر قد أخذ وقته كله.',
       'Salma releases the key. The counter stops, giving the deck’s silence an audible edge. Much more of the minute remains than she expected. She reaches for the programme slip, meaning to say something, then draws her hand back. There are no words on the slip. A latecomer takes the first free place and the sound of a real board under his foot travels to the back. The man finally finds a home for his coat. By the time she raises her hand, the lamp has had its whole minute.'],
      ['تكتب على ظهر تذكرتها، في خانة العامل المناوب: «من المزلاج حتى الطقّة، ثم بدأ الفيلم في موعده». تطوي العلبة، وتترك لصاحبتها غدًا أن تسمع كيف كان وقع خطواتها على صالة مليئة. من تحت باب المرفأ يدخل خط ضيّق من الضوء حتى طرف حذائها.',
       'In the duty clerk’s space on the back of her ticket she writes, “From the latch to the click. Feature started on time.” She closes the case. Tomorrow Amal can ask what her footsteps sounded like in a full house. Under the quay door, a thin line of light reaches the tip of Salma’s shoe.']
    ]
  },
  hold: {
    choice:['اتركي المقعد لأمل طوال الدقيقة','Hold Amal’s seat for the minute'], title:['عرض مقعد واحد','One seat wide'],
    before:[
      ['تنزل سلمى المقعد بكفها وتضع التذكرة فوقه. كان يمكن أن تسندها منتصبة على ظهره ليراها من في الخلف. تجرّب ذلك، فتطير الورقة من تيار النافذة. تعيدها تحت المسند بحيث لا تُقرأ إلا لمن أتاه من ناحية الممر. هذه تذكرة حفظ مكان. لا حاجة لأن تُقرأ من آخر القاعة.',
       'Salma lowers the seat with her palm and lays the ticket on it. She could stand it against the backrest for people further back to read. She tries; the draught from the window carries it away. She tucks it under the arm, legible only to somebody coming along the aisle. It’s a ticket holding a place. It doesn’t have to be read from the back of the house.'],
      ['تظلّ راكعة قليلًا حتى يستقرّ المقعد ولا يضرب الخشب. بجوارها يرفع رجل معطفه عن ركبتيه، ينظر إلى الورقة ثم يحمله إلى الخطّاف عند الباب. لا يطلب منها سبب الحجز. تمر امرأة تبحث عن الصف الخامس وتقول «عفوًا» وهي تجتاز الموضع الضيّق. فجأة تعرف سلمى كم مرّة كانت أمل تسمع هذه الكلمة في وردية واحدة.',
       'She stays crouched until the seat settles without knocking the boards. Beside her, a man lifts his coat off his knees, looks at the slip and takes the coat to the hook by the door. He doesn’t ask why the place is held. A woman looking for the fifth row says “excuse me” as she passes through the narrow space. It strikes Salma how many times Amal must have heard those words in a single shift.']
    ],
    action:['ابقَي عند الممر حتى الجرس','Stand by the aisle until the bell'],
    after:[
      ['تسمع سلمى في الدقيقة التي تركتها مفتوحة خشخشة أكياس، وتنفّس امرأة وصلت بعد مشي طويل، ولمسة إصبع تردّ هاتفًا إلى الصامت. لا يصفق أحد. ينفتح بابٌ خلفي فيزيح الهواء عن مسند المخمل ويرتفع ركن الورقة ثم يعود. يجلس الجميع بالمقدار المعتاد من البطء. كان لهذا العمل العادي، في صالة تعرفه أمل بالقدم واليد، الوقت الذي طلبته ورقة البرنامج.',
       'In the minute she has left open Salma hears bags rustle, a woman catch her breath after a long walk and the tap of a finger silencing a phone. Nobody claps. A rear door opens; air moves over the velvet arm, and a corner of the ticket lifts and falls. Everybody settles into place as slowly as people usually do. In the house Amal knew by foot and by hand, that ordinary business has been given the time the programme promised.'],
      ['ترفع يدها. يمتد أول ضوء للفيلم على الممر. بقي المقعد مفروشًا والتذكرة في ثنيته. بعد العرض ستبسطها فوق شباكها، وتقول لأمل، إذا سألتها، إن المكان اتّسع لها إلى آخر الجرس. أما الشريط فتدخله في علبته كما وصل، ولا تحمل سكوتها قولًا باسم أحد.',
       'She raises her hand. The first light of the picture stretches across the aisle. The seat stays down, the ticket caught in its fold. After the show she’ll smooth it out on her counter. If Amal asks, she can say there was room for her all the way to the bell. She puts the tape back in its case just as it came, without making that silence speak for anybody.']
    ]
  },
  ask: {
    choice:['اتصلي بأمل واسأليها','Ring Amal and ask'], title:['على الخط الداخلي','On the house line'],
    before:[
      ['تمرّ سلمى إلى الكرسي المستقيم قرب الباب، وترفع الغطاء. يقرع الجرس في الطرف الآخر بصوت تسمعه في الهاتف، ثم بعد لحظة تسمعه أضعف خلف الزجاج. «أمل؟ معي الدقيقة. أأشغّل الشريط، أم أبقي المقعد عند الممر؟». لا تقول «ما زال عندك وقت لتلحقي». كان لدى أمل كفايتها من الناس الذين يحسبون لها زمن مشوارها بين البابين.',
       'Salma goes to the straight-backed chair and lifts the cover. She hears the ring down the line, then, a moment later, more faintly through the glass. “Amal? I’ve got the minute. Would you like the tape, or shall I keep your place on the aisle?” She doesn’t say there’s still time to come. Amal has had enough of people telling her how quickly she could get from one door to the other.'],
      ['«تذكرين كرسي الهاتف؟» تقول أمل. «خلّي السماعة عند الباب. ودي أسمعهم يدخلون، وإذا بدأ الفيلم علّقيها. لا يحتاجون يسمعوني أصب الشاي». تدير سلمى قاعدة الهاتف كيلا يتلوّى السلك. «تحبين تسمعينهم بس، وأنا أمسك السماعة من جهتي». «إيه، اتركي فتحتها للممر». لا يخرج صوت الكشك من سماعات الصالة.',
       '“Remember the chair for the phone?” Amal says. “Leave the receiver by the door. I’d like to hear them coming in. Hang up when the film starts. They don’t need to hear me pouring tea.” Salma turns the base so the cord won’t kink. “Just you listening, then. I’ll hold it at this end.” “Yes. Point the mouthpiece towards the aisle.” Nothing from the kiosk goes out over the house speakers.']
    ],
    action:['وجّهي السماعة نحو الممر','Point the mouthpiece into the aisle'],
    after:[
      ['تسند سلمى معصمها إلى ظهر الكرسي. في الصف الرابع تكاد امرأة تنسى أن ترفع حقيبتها فيرفعها الرجل إلى جوارها. تسمع أمل ضحكة الاثنين وتقول كلمةً عند الطرف الآخر، منخفضة إلى حدّ أن سلمى لا تميّزها. لا تطلب منها أن تعيدها. الهاتف في وضع يصلح لأن يسمع القاعة، لا لأن يحمل إليها حديثًا من خارجها. تُبقيه هكذا حتى يدخل آخر المتأخرين.',
       'Salma rests her wrist on the chair back. In the fourth row a woman nearly forgets to lift her bag; the man beside her picks it up for her. Amal hears them laugh and says something at her end so quietly Salma can’t make it out. She doesn’t ask her to repeat it. The phone is set to listen to the house rather than to carry a conversation into it. She holds it there until the last latecomer is inside.'],
      ['حين يأتي موعد الإشارة، تردّ السماعة إلى القاعدة. يخرج من الغطاء صوت صغير لا يحتاج ميكروفونًا. ترفع كفّها إلى عامل العرض. يبدأ الفيلم والمقعد في مكانه والعلبة مقفلة. تضع سلمى التذكرة في الثنية بين قاعدة الهاتف وسلكه؛ علامة صغيرة لتتذكّر غدًا أي كرسي تجعل عند أي باب.',
       'When it’s time for the signal she puts the receiver back. The cover makes a small sound that needs no microphone. She raises her palm to the projectionist. The feature starts with the seat in its place and the tape case closed. Salma slips the ticket between the phone and its cord, a little note to herself about which chair belongs at which door tomorrow.']
    ]
  }
};

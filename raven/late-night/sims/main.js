import {mount} from '../night-shell.js';

const configs={
  'echo-last-seat':{file:'echo',title:['الاختبار من آخر مقعد','Test from the last seat'],intro:['أعطِ المستمع طرقتين يمكن فصلهما. الهدف فرق وصول ٤٨ ملي ثانية على الأقل، وانعكاس بشدة ٢٤٪ من الطرقة المباشرة أو أكثر.','Give the listener two distinct knocks. Aim for at least 48 ms between arrivals and a reflection at least 24% as loud as the direct knock.']},
  'darkroom-minute':{file:'darkroom',title:['دقيقة التحميض','One developing minute'],intro:['اضبط تعريض طبعتك الرقمية وقناعها حتى تظهر تفاصيل النافذة والوجه معًا. ثبّت نسختين وافحص الفروق قبل تنزيل الطبعة التي تختارها.','Adjust digital paper exposure and a local mask to reveal detail in the window and the face. Pin two prints and compare them before downloading your choice.']},
  'weightless-cam':{file:'camera',title:['كاميرا بلا وزن','Weightless camera'],intro:['ادفع الكاميرا ثم افرمل داخل الكادر. ثبّتها ثانيتين متصلتين، وشاهد كيف تركت كل دفعة أثرًا على خط الرحلة.','Give the camera a push, then brake inside the frame. Hold it for two continuous seconds and watch each impulse shape its path.']},
  'tide-harbor':{file:'tide',title:['مرفأ المدّ والجزر','Tide harbour'],intro:['احمل شاشة السينما تحت قوس المرفأ. المدّ يرتفع ثم ينحسر خلال تسعين ثانية، والافتتاح عند الثانية ٦٨.','Bring the cinema screen under the harbour arch. The 90-second tide rises and falls. The opening is at second 68.']},
  'harbour-watch':{file:'vts',title:['نوبة برج المرفأ','Harbour tower watch'],intro:['الساعة ٠٣:١٠ والضباب يغلق المرسى. أنت مراقب حركة السفن: تقرأ الرادار وتعطي السفن أوامرك على القناة ١٢. لا تقترب سفينتان أكثر من ثلاثة كوابل، ولا تلتقي الكبيرتان داخل القناة.','It is 03:10 and fog closes the Marsa approach. You are the vessel traffic officer: read the radar and give ships your orders on channel 12. No two ships within three cables, and the large ships must never meet in the channel.']},
  'fabric-wind':{file:'fabric',title:['نسيج في مهبّ الهواء','Fabric in the wind'],intro:['علّق الراية فوق شارع الموكب. بدّل نقاط التثبيت والوزن والمروحة حتى يظلّ الشعار مقروءًا لثانيتين متصلتين.','Hang the banner over the parade street. Change the pins, weight and fan to expose the emblem for two uninterrupted seconds.']}
};
const id=document.getElementById('night-app').dataset.activity,cfg=configs[id];
try{
  const {default:render}=await import('./'+cfg.file+'.js');let fresh=true;
  mount({id,title:cfg.title,intro:cfg.intro,render(ui){const initial=fresh?ui.editData:null;fresh=false;return render({...ui,editData:initial});}});
}catch{
  const en=new URLSearchParams(location.search).get('lang')==='en',main=document.getElementById('night-app');
  document.documentElement.lang=en?'en':'ar';document.documentElement.dir=en?'ltr':'rtl';
  const label=document.createElement('p'),retry=document.createElement('button'),back=document.createElement('a');
  label.setAttribute('role','status');label.textContent=en?'The simulation could not open on this device.':'تعذّر فتح المحاكاة على هذا الجهاز.';
  retry.type='button';retry.dataset.sim='retry';retry.textContent=en?'Retry loading':'أعد التحميل';retry.onclick=()=>location.reload();
  back.href='./?lang='+(en?'en':'ar');back.textContent=en?'All experiences':'كل التجارب';main.replaceChildren(label,retry,back);
}

// Harbour tower watch: a night shift at the Marsa vessel traffic radar.
import {element, action, select, quantity, isolate, archive, output, showReadings} from './kit.js';
import * as R from './vts-rules.js';

const SIZE = 720, C = 360, VIEW = 4.5, PX = 330 / VIEW, SPEEDS = [10, 30, 60]; // a four-and-a-half-mile picture of the approach
const ORDER_KEYS = ['starboard10', 'starboard20', 'port10', 'port20', 'slow', 'half', 'full', 'stop', 'anchor', 'resume'];
const ORDER_TEXT = {
  starboard10: ['انعطف يمينًا ١٠°', 'Starboard 10°'], starboard20: ['انعطف يمينًا ٢٠°', 'Starboard 20°'],
  port10: ['انعطف يسارًا ١٠°', 'Port 10°'], port20: ['انعطف يسارًا ٢٠°', 'Port 20°'],
  slow: ['سرعة بطيئة', 'Slow ahead'], half: ['نصف السرعة', 'Half ahead'], full: ['السرعة الكاملة', 'Full ahead'],
  stop: ['أوقف المحرك', 'Stop engine'], anchor: ['انتظر في منطقة الرسو', 'Wait at the anchorage'], resume: ['عُد إلى المسار', 'Resume your track']
};
const RADIO = {
  starboard10: ['غيّروا الاتجاه ١٠ درجات إلى اليمين.', 'alter course ten degrees to starboard.'],
  starboard20: ['غيّروا الاتجاه ٢٠ درجة إلى اليمين.', 'alter course twenty degrees to starboard.'],
  port10: ['غيّروا الاتجاه ١٠ درجات إلى اليسار.', 'alter course ten degrees to port.'],
  port20: ['غيّروا الاتجاه ٢٠ درجة إلى اليسار.', 'alter course twenty degrees to port.'],
  slow: ['خفّضوا السرعة إلى بطيئة.', 'reduce to slow ahead.'], half: ['خفّضوا السرعة إلى النصف.', 'reduce to half ahead.'],
  full: ['استأنفوا السرعة الكاملة.', 'resume full ahead.'], stop: ['أوقفوا المحرك وانتظروا.', 'stop your engine and stand by.'],
  anchor: ['توجّهوا إلى منطقة الرسو وانتظروا الإذن.', 'proceed to the anchorage and wait for clearance.'],
  resume: ['عودوا إلى مساركم المعتمد.', 'resume your planned track.']
};
const VERDICT = {
  clean: ['نوبة نظيفة', 'A clean watch'], 'safe-delayed': ['نوبة آمنة مع تأخير', 'Safe, with delays'],
  incident: ['حادث وشيك يُسجَّل', 'A reportable near miss'], casualty: ['حادث بحري', 'A marine casualty']
};

let session = null; // survives a language switch inside the same visit
let stopActive = null; // the running frame loop, whichever render started it
let opened = null; // the saved report this visit already reopened

function fresh(scenario) {
  return {scenario, state: R.create(scenario), running: false, speed: 30, selected: 'safa', log: [], reported: false, sweep: 0};
}

function replay(data) {
  if (!data || !R.SCENARIOS[data.scenario] || !Array.isArray(data.calls)) return null;
  const s = fresh(data.scenario), calls = data.calls.filter(c => Number.isFinite(c.at) && R.ORDERS[c.order] && typeof c.id === 'string')
    .slice(0, 60).sort((a, b) => a.at - b.at);
  for (const c of calls) {
    R.advance(s.state, Math.max(0, c.at - s.state.time));
    const call = R.instruct(s.state, c.id, c.order);
    if (call) s.log.push(call);
  }
  while (!s.state.over) R.step(s.state);
  s.reported = true;
  return s;
}

export default function watch(ui) {
  const {t} = ui;
  if (stopActive) stopActive();
  // Reopen a saved report once; a restart or language switch afterwards keeps the live watch.
  if (ui.editData && opened !== ui.editData) { opened = ui.editData; session = replay(ui.editData) || session; }
  if (!session) session = fresh('fog');
  const S = session;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nm = (v, d = 2) => quantity(ui.lang, v, d, t('ميل', 'nm'));
  const kn = v => quantity(ui.lang, v, 1, t('عقدة', 'kn'));
  const num = (v, d = 0) => quantity(ui.lang, v, d, '').trim();
  const three = new Intl.NumberFormat(ui.lang === 'ar' ? 'ar-u-nu-arab' : 'en', {minimumIntegerDigits: 3, useGrouping: false});
  const deg = v => isolate(three.format(Math.round(R.norm(v)) % 360) + '°');
  const mins = v => quantity(ui.lang, v, 0, t('د', 'min'));
  const name = id => t(...S.state.vessels.find(v => v.id === id).name);

  const box = element('section', null, 'night-sim vts');
  const bar = element('div', null, 'vts-bar');
  const clock = element('output', R.clock(S.state.time), 'vts-clock');
  clock.dataset.sim = 'clock';
  clock.setAttribute('aria-label', t('ساعة النوبة', 'Watch clock'));
  const scenario = select('scenario', t('الحالة', 'Conditions'), Object.entries(R.SCENARIOS).map(([k, v]) => [k, t(...v.title)]), S.scenario, v => {
    session = fresh(v); restart();
  });
  const run = action('run', '', () => { if (S.state.over) return; S.running = !S.running; sync(); });
  const pace = element('div', null, 'vts-pace');
  pace.setAttribute('role', 'group');
  pace.setAttribute('aria-label', t('تسريع الزمن', 'Time compression'));
  const paceButtons = SPEEDS.map(x => {
    const b = action('pace-' + x, '×' + num(x), () => { S.speed = x; sync(); });
    pace.append(b);
    return b;
  });
  bar.append(clock, run, pace, scenario);

  const brief = element('p', t(...R.SCENARIOS[S.scenario].brief), 'vts-brief');
  const frame = element('figure', null, 'vts-scope');
  const canvas = element('canvas');
  canvas.width = SIZE; canvas.height = SIZE;
  canvas.setAttribute('role', 'img');
  canvas.dataset.sim = 'radar';
  const caption = element('figcaption');
  frame.append(canvas, caption);
  const warn = element('p', '', 'vts-warn');
  warn.setAttribute('role', 'status');
  warn.dataset.sim = 'threat';
  const fleet = element('div', null, 'vts-fleet');
  fleet.setAttribute('role', 'group');
  fleet.setAttribute('aria-label', t('الأهداف على الرادار', 'Radar targets'));
  const pad = element('div', null, 'vts-orders');
  const padTitle = element('h2', '', 'vts-pad-title');
  const padGrid = element('div', null, 'vts-order-grid');
  pad.append(padTitle, padGrid);
  const radioTitle = element('h2', t('قناة VHF ١٢', 'VHF channel 12'), 'vts-pad-title');
  const radio = element('ol', null, 'vts-radio');
  radio.setAttribute('aria-live', 'polite');
  radio.dataset.sim = 'radio';
  const report = element('section', null, 'vts-report');
  report.dataset.sim = 'report';
  const actions = element('div', null, 'sim-actions');
  const finish = action('finish', t('أنهِ النوبة الآن', 'End the watch now'), () => { while (!S.state.over) R.step(S.state); S.running = false; sync(); });
  actions.append(
    finish,
    action('restart', t('ابدأ النوبة من جديد', 'Restart the watch'), () => { session = fresh(S.scenario); restart(); }));
  box.append(bar, brief, frame, warn, fleet, pad, radioTitle, radio, actions, report);
  ui.root.replaceChildren(box);

  const w = {canvas, box};
  const c = canvas.getContext('2d');
  const glow = document.createElement('canvas');
  glow.width = SIZE; glow.height = SIZE;
  const g = glow.getContext('2d');
  const px = (x, y) => [C + x * PX, C - y * PX];
  const coast = [];
  for (let x = -VIEW; x <= VIEW; x += 0.05) if (Math.abs(x) > R.HARBOUR.gap) for (let d = 0; d < 0.4; d += 0.08) coast.push([x, R.HARBOUR.y - d]);

  function restart() {
    cleanup();
    watch(ui);
  }

  function paintEcho(x, y, size, alpha) {
    const [cx, cy] = px(x, y);
    const grad = g.createRadialGradient(cx, cy, 0, cx, cy, size);
    grad.addColorStop(0, 'rgba(170,255,190,' + alpha + ')');
    grad.addColorStop(1, 'rgba(60,255,140,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, size, 0, 7); g.fill();
  }
  const swept = (x, y, a0, a1) => {
    const b = R.bearing(0, 0, x, y);
    return a1 >= a0 ? b >= a0 && b < a1 : b >= a0 || b < a1;
  };
  function phosphor(a0, a1, dt) {
    g.fillStyle = 'rgba(2,10,5,' + Math.min(0.5, dt * 0.55) + ')';
    g.fillRect(0, 0, SIZE, SIZE);
    const all = reduce || a1 === null;
    for (const [x, y] of coast) if (all || swept(x, y, a0, a1)) paintEcho(x, y, 7, 0.55);
    for (const s of R.SHOALS) for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2, x = s.x + Math.sin(a) * s.r * 0.5, y = s.y + Math.cos(a) * s.r * 0.5;
      if (all || swept(x, y, a0, a1)) paintEcho(x, y, 4, 0.12);
    }
    const clutter = S.scenario === 'current' ? 26 : 14;
    for (let k = 0; k < clutter; k++) {
      const r = Math.random() * 0.9, a = Math.random() * 360, x = Math.sin(a) * r, y = Math.cos(a) * r;
      if (all || swept(x, y, a0, a1)) paintEcho(x, y, 2.5, 0.25 * (1 - r));
    }
    for (const v of S.state.vessels) if (!v.gone && (all || swept(v.x, v.y, a0, a1))) paintEcho(v.x, v.y, 4 + v.k.len / 34, 0.95);
  }

  function chart() {
    const bg = c.createRadialGradient(C, C, 40, C, C, 360);
    bg.addColorStop(0, '#0a2516'); bg.addColorStop(1, '#020806');
    c.fillStyle = '#05100a'; c.fillRect(0, 0, SIZE, SIZE);
    c.fillStyle = bg; c.beginPath(); c.arc(C, C, 340, 0, 7); c.fill();
    c.drawImage(glow, 0, 0);
    c.save();
    c.beginPath(); c.arc(C, C, 340, 0, 7); c.clip();
    // dredged bank either side of the channel
    c.fillStyle = 'rgba(120,170,130,.07)';
    const [bx0, by0] = px(R.BANK.x0, R.BANK.y1), [bx1, by1] = px(R.BANK.x1, R.BANK.y0);
    c.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    c.fillStyle = '#04110a';
    const [cx0, cy0] = px(R.CHANNEL.x0, R.CHANNEL.y1), [cx1, cy1] = px(R.CHANNEL.x1, R.CHANNEL.y0);
    c.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    c.setLineDash([6, 6]); c.strokeStyle = 'rgba(120,220,210,.55)'; c.lineWidth = 1.4;
    c.strokeRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    // shoals and anchorage
    c.strokeStyle = 'rgba(232,186,96,.75)';
    for (const s of R.SHOALS) {
      const [sx, sy] = px(s.x, s.y);
      c.beginPath(); c.arc(sx, sy, s.r * PX, 0, 7); c.stroke();
      text(quantity(ui.lang, s.depth, 0, t('م', 'm')), sx, sy + 5, 'rgba(232,186,96,.9)', 14, 'center');
    }
    const [ax, ay] = px(R.ANCHORAGE.x, R.ANCHORAGE.y);
    c.strokeStyle = 'rgba(150,200,255,.6)';
    c.beginPath(); c.arc(ax, ay, R.ANCHORAGE.r * PX, 0, 7); c.stroke();
    c.setLineDash([]);
    text(t('منطقة الرسو', 'Anchorage'), ax, ay + R.ANCHORAGE.r * PX + 16, 'rgba(170,210,255,.85)', 13, 'center'); // below the ring, clear of the bearing scale
    // land
    c.fillStyle = 'rgba(46,70,48,.55)';
    const [lx, ly] = px(-VIEW - 1, R.HARBOUR.y), [gx0] = px(-R.HARBOUR.gap, 0), [gx1] = px(R.HARBOUR.gap, 0);
    c.fillRect(lx, ly, gx0 - lx, SIZE); c.fillRect(gx1, ly, SIZE, SIZE);
    // range rings and bearing scale
    c.strokeStyle = 'rgba(80,255,150,.18)'; c.lineWidth = 1;
    for (let r = 1; r <= 4; r++) { c.beginPath(); c.arc(C, C, r * PX, 0, 7); c.stroke(); }
    for (let r = 1; r <= 4; r++) text(num(r), C + 4, C - r * PX + 14, 'rgba(120,255,170,.55)', 12, 'left');
    c.restore();
    for (let a = 0; a < 360; a += 10) {
      const s = Math.sin(a * Math.PI / 180), k = Math.cos(a * Math.PI / 180), long = a % 30 === 0;
      c.strokeStyle = 'rgba(120,255,170,.6)';
      c.beginPath(); c.moveTo(C + s * 340, C - k * 340); c.lineTo(C + s * (long ? 326 : 333), C - k * (long ? 326 : 333)); c.stroke();
      if (long) text(String(a).padStart(3, '0'), C + s * 312, C - k * 312 + 5, 'rgba(150,255,190,.75)', 12, 'center');
    }
    // targets: vectors, trails, labels
    const threat = R.threats(S.state)[0];
    for (const v of S.state.vessels) {
      if (v.gone) continue;
      const [x, y] = px(v.x, v.y), vel = R.velocity(v, R.SCENARIOS[S.scenario].current);
      const [vx, vy] = px(v.x + vel.x * 6, v.y + vel.y * 6);
      for (const p of v.trail) { const [tx, ty] = px(p.x, p.y); c.fillStyle = 'rgba(140,255,180,.35)'; c.fillRect(tx - 1.5, ty - 1.5, 3, 3); }
      const hot = threat && threat.pair.includes(v.id);
      c.strokeStyle = v.grounded ? '#ff6b5a' : hot ? '#ffcf6a' : 'rgba(170,255,200,.9)';
      c.lineWidth = 1.6;
      c.beginPath(); c.arc(x, y, 7, 0, 7); c.stroke();
      if (!v.grounded) { c.beginPath(); c.moveTo(x, y); c.lineTo(vx, vy); c.stroke(); }
      else { c.beginPath(); c.moveTo(x - 8, y - 8); c.lineTo(x + 8, y + 8); c.moveTo(x + 8, y - 8); c.lineTo(x - 8, y + 8); c.stroke(); }
      if (v.id === S.selected) {
        c.strokeStyle = '#f4efd8';
        c.strokeRect(x - 13, y - 13, 26, 26);
      }
      text(t(...v.name) + ' ' + num(v.speed, 1), x + 12, y - 10, hot ? '#ffd98a' : 'rgba(200,255,215,.95)', 13, 'left');
    }
    if (threat) {
      const a = S.state.vessels.find(v => v.id === threat.pair[0]), b = S.state.vessels.find(v => v.id === threat.pair[1]);
      const [ax1, ay1] = px(a.x, a.y), [bx2, by2] = px(b.x, b.y);
      c.setLineDash([3, 5]); c.strokeStyle = 'rgba(255,207,106,.6)';
      c.beginPath(); c.moveTo(ax1, ay1); c.lineTo(bx2, by2); c.stroke(); c.setLineDash([]);
    }
    // sweep
    if (!reduce && S.running) {
      const a = S.sweep * Math.PI / 180;
      for (let k = 0; k < 18; k++) {
        const b = a - k * 0.025;
        c.strokeStyle = 'rgba(120,255,170,' + (0.5 * (1 - k / 18)) + ')';
        c.lineWidth = k ? 2 : 2.4;
        c.beginPath(); c.moveTo(C, C); c.lineTo(C + Math.sin(b) * 338, C - Math.cos(b) * 338); c.stroke();
      }
    }
    c.strokeStyle = '#2d4a37'; c.lineWidth = 6; c.beginPath(); c.arc(C, C, 343, 0, 7); c.stroke();
    text('N', C, 14, '#bfffd2', 13, 'center');
  }
  function text(str, x, y, col, size, align) {
    c.save();
    c.direction = /[؀-ۿ]/.test(str) ? 'rtl' : 'ltr';
    c.font = '600 ' + size + 'px "IBM Plex Sans Arabic", Arial, sans-serif';
    c.textAlign = align; c.fillStyle = col;
    c.fillText(str, x, y);
    c.restore();
  }

  function describe() {
    const parts = S.state.vessels.filter(v => !v.gone).map(v => {
      const b = R.bearing(0, 0, v.x, v.y), r = Math.hypot(v.x, v.y);
      return t(...v.name) + t(' على الاتجاه ', ' bearing ') + deg(b) + t(' ومدى ', ' at ') + nm(r, 1) +
        t('، يسير ', ', steering ') + deg(v.heading) + t(' بسرعة ', ' at ') + kn(v.speed) + (v.grounded ? t('، جانح', ', aground') : '');
    });
    const textValue = t('رادار المرسى بمدى أربعة أميال ونصف. ', 'Marsa radar, four-and-a-half-mile range. ') + parts.join(t('؛ ', '; ')) + '.';
    if (caption.textContent !== textValue) { caption.textContent = textValue; canvas.setAttribute('aria-label', textValue); }
  }

  const picks = S.state.vessels.map(v => {
    const b = action('pick-' + v.id, '', () => { S.selected = v.id; sync(); });
    fleet.append(b);
    return b;
  });
  function fleetButtons() {
    S.state.vessels.forEach((v, i) => {
      const status = v.grounded ? t('جانح', 'aground') : v.gone ? t('غادر الشاشة', 'left the scope') : v.done ? t('أنجز رحلته', 'done') :
        v.mode === 'anchor' ? t('إلى الرسو', 'to anchorage') : v.mode === 'heading' ? t('اتجاه مأمور', 'ordered heading') : t('على المسار', 'on track');
      const label = [t(...v.name), deg(v.heading), kn(v.speed), status].map(isolate).join(' · ');
      if (picks[i].textContent !== label) picks[i].textContent = label;
      picks[i].setAttribute('aria-pressed', String(S.selected === v.id));
    });
  }

  let padKey = '';
  function orderPad() {
    const v = S.state.vessels.find(s => s.id === S.selected), off = S.state.over || v.gone || v.grounded, key = v.id + off;
    if (key === padKey) return;
    padKey = key;
    padTitle.textContent = t('أوامر إلى ', 'Orders to ') + t(...v.name);
    padGrid.replaceChildren(...ORDER_KEYS.filter(k => k !== 'anchor' || v.goal.type === 'reach').map(k => {
      const b = action('order-' + k, t(...ORDER_TEXT[k]), () => {
        const call = R.instruct(S.state, v.id, k);
        if (call) { S.log.push(call); sync(); }
      });
      b.disabled = off;
      return b;
    }));
  }

  function radioLog() {
    const items = [];
    for (const call of S.log.slice(-8).reverse()) {
      const time = R.clock(call.at).slice(0, 5), who = name(call.id);
      const reply = call.reply === 'silent' ? t('— لا رد. أعِد النداء.', '— no reply. Call again.') :
        call.reply === 'unable' ? who + t(': لا نستطيع، ليست لنا منطقة رسو.', ': unable, we have no anchorage slot.') :
          who + t(': مفهوم، ننفّذ.', ': understood, complying.');
      const li = element('li');
      li.dataset.reply = call.reply;
      li.append(element('time', time), ' ', t('برج المرسى إلى ', 'Marsa Tower to ') + who + ': ' + t(...RADIO[call.order]), element('br'), reply);
      items.push(li);
    }
    radio.replaceChildren(...items);
  }

  function warning() {
    const list = R.threats(S.state);
    if (S.state.over) { warn.textContent = t('انتهت النوبة.', 'The watch is over.'); return; }
    if (!list.length) { warn.textContent = t('لا تقارب خطر على المتجهات الحالية.', 'No dangerous approach on present vectors.'); warn.dataset.level = 'clear'; return; }
    const top = list[0];
    warn.dataset.level = top.cpa < R.CLOSE ? 'danger' : 'watch';
    warn.textContent = t('تقارب: ', 'Approach: ') + name(top.pair[0]) + ' ↔ ' + name(top.pair[1]) + t(' — أقرب نقطة ', ' — CPA ') + nm(top.cpa) + t(' بعد ', ' in ') + mins(top.tcpa);
  }

  function showReport() {
    const r = R.finish(S.state);
    const title = element('h2', t(...VERDICT[r.verdict]));
    report.dataset.verdict = r.verdict;
    const rows = [[t('مدة النوبة', 'Watch length'), mins(r.minutes)], [t('نداءات VHF', 'VHF calls'), num(r.calls)]];
    if (r.closest[0]) rows.push([t('أقرب تقارب', 'Closest approach'), name(r.closest[0].pair[0]) + ' ↔ ' + name(r.closest[0].pair[1]), nm(r.closest[0].d)]);
    const facts = element('div');
    showReadings(facts, rows);
    const list = element('ul', null, 'vts-events');
    const label = {
      collision: ['تصادم بين ', 'Collision between '], close: ['حالة تقارب حرج بين ', 'Close-quarters situation between '],
      meeting: ['التقت سفينتان كبيرتان داخل القناة: ', 'Two large ships met inside the channel: '], grounding: ['جنحت ', 'Grounding: '],
      arrived: ['دخلت القناة الداخلية بأمان: ', 'Reached the inner channel safely: '], cleared: ['غادرت منطقة المراقبة: ', 'Cleared the watch area: '],
      crossed: ['عبر مدخل الميناء: ', 'Crossed the approach: ']
    };
    for (const e of S.state.events) {
      const who = e.ids.map(name).join(t(' و', ' and '));
      const li = element('li', R.clock(e.at).slice(0, 5) + ' — ' + t(...label[e.type]) + who + (e.d != null ? ' (' + nm(e.d) + ')' : ''));
      li.dataset.event = e.type;
      list.append(li);
    }
    for (const id of r.pending) list.append(element('li', t('لم تُكمل رحلتها قبل نهاية النوبة: ', 'Not through before the watch ended: ') + name(id)));
    const advice = element('p', t(...{
      clean: ['لم تقترب سفينتان أكثر من ثلاثة كوابل، ولم تلتقِ الكبيرتان في القناة.', 'No two ships came within three cables, and the large ships never met in the channel.'],
      'safe-delayed': ['حافظت على السلامة، لكن رحلة على الأقل لم تكتمل. جرّب ترتيبًا يحرّر القناة أبكر.', 'You kept everyone safe, but at least one passage was not completed. Try a sequence that frees the channel earlier.'],
      incident: ['القناة لا تتسع لسفينتين كبيرتين في الضباب. قرّر مبكرًا من يدخل أولًا، وراقب قارب الصيد عند الفرضة.', 'The channel cannot take two large ships in fog. Decide early who goes first, and watch the fishing boat at the fairway.'],
      casualty: ['المتجهات أعطتك الإنذار قبل وقوع الحادث. أوامر السرعة تحتاج دقائق لتظهر على سفينة بهذا الحجم.', 'The vectors warned you before it happened. Speed orders take minutes to show on a ship this size.']
    }[r.verdict]), 'sim-outcome');
    const tools = element('div', null, 'sim-actions');
    tools.append(
      action('save', t('احفظ تقرير النوبة', 'Save the watch report'), () => archive(ui, w, 'harbour-watch', t('تقرير نوبة برج المرفأ', 'Harbour tower watch report'),
        {scenario: S.scenario, verdict: r.verdict, calls: S.log.map(({at, id, order}) => ({at, id, order}))})),
      action('export', t('نزّل صورة الرادار', 'Download the radar picture'), () => output(canvas, 'marsa-radar-' + S.scenario)));
    report.replaceChildren(title, facts, list, advice, tools);
    if (!S.reported) {
      S.reported = true;
      ui.recordEvent({ar: 'نوبة برج المرفأ: ' + VERDICT[r.verdict][0] + '.', en: 'Harbour tower watch: ' + VERDICT[r.verdict][1] + '.',
        data: {kind: 'harbour-watch', scenario: S.scenario, verdict: r.verdict}});
    }
  }

  function sync() {
    clock.value = R.clock(S.state.time);
    run.textContent = S.state.over ? t('انتهت النوبة', 'Watch ended') : S.running ? t('أوقف الزمن مؤقتًا', 'Pause') : S.state.time > 0 ? t('تابع النوبة', 'Continue the watch') : t('ابدأ النوبة', 'Start the watch');
    run.disabled = S.state.over;
    finish.disabled = S.state.over;
    run.setAttribute('aria-pressed', String(S.running));
    paceButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(SPEEDS[i] === S.speed)));
    canvas.dataset.time = S.state.time.toFixed(2);
    canvas.dataset.over = String(S.state.over);
    fleetButtons(); orderPad(); radioLog(); warning(); describe();
    if (S.state.over) showReport(); else report.replaceChildren();
    chart();
  }

  let frameId = 0, last = 0, lastPanel = 0;
  function tick(now) {
    frameId = requestAnimationFrame(tick);
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (S.running && !S.state.over) {
      const before = S.sweep;
      S.sweep = (S.sweep + dt * 144) % 360; // 24 revolutions a minute
      phosphor(before, S.sweep, dt);
      // Simulated time moves in whole five-second steps; carry the remainder between frames.
      S.carry = (S.carry || 0) + dt * S.speed / 60;
      const whole = Math.floor(S.carry / R.STEP + 1e-9) * R.STEP;
      if (whole > 0) { S.carry -= whole; R.advance(S.state, whole); }
      if (S.state.over) { S.running = false; sync(); return; }
      if (now - lastPanel > 400) { lastPanel = now; clock.value = R.clock(S.state.time); fleetButtons(); warning(); describe(); canvas.dataset.time = S.state.time.toFixed(2); orderPad(); }
      chart();
    }
  }
  function cleanup() { cancelAnimationFrame(frameId); document.removeEventListener('visibilitychange', hide); if (stopActive === cleanup) stopActive = null; }
  function hide() { if (document.hidden && S.running) { S.running = false; sync(); } }
  document.addEventListener('visibilitychange', hide);

  canvas.addEventListener('click', event => {
    const box2 = canvas.getBoundingClientRect(), x = ((event.clientX - box2.left) * SIZE / box2.width - C) / PX, y = (C - (event.clientY - box2.top) * SIZE / box2.height) / PX;
    let best = null, bestD = 0.6;
    for (const v of S.state.vessels) if (!v.gone) { const d = Math.hypot(v.x - x, v.y - y); if (d < bestD) { bestD = d; best = v; } }
    if (best) { S.selected = best.id; sync(); }
  });

  phosphor(0, null, 1);
  sync();
  frameId = requestAnimationFrame(tick);
  stopActive = cleanup;
  return () => stopActive && stopActive();
}

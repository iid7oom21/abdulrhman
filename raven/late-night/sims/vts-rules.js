// Harbour tower watch: the traffic model behind the radar. Pure functions, no DOM.
// Units: positions in nautical miles from the tower (x east, y north), speed in knots,
// time in minutes, headings in degrees true (0 north, clockwise).

export const STEP = 1 / 12;          // five simulated seconds per step
export const RANGE = 6;              // radar range in nautical miles
export const CLOSE = 0.3;            // three cables: a close-quarters situation
export const COLLISION = 0.08;       // about 150 metres between echoes
export const CHANNEL = {x0: -0.45, x1: 0.45, y0: -0.85, y1: 1.85};
export const HARBOUR = {x: 0, y: -0.85, gap: 0.32};
export const SHOALS = [
  {id: 'west-bank', x: -1.25, y: 2.45, r: 0.55, depth: 4},
  {id: 'east-bank', x: 1.55, y: 2.35, r: 0.42, depth: 7}
];
// The channel is dredged through a bank: outside it, between the harbour and the fairway, the water is 4 m deep.
export const BANK = {x0: -1.7, x1: 1.7, y0: -0.85, y1: 1.85, depth: 4};
export const ANCHORAGE = {x: 2.6, y: 3.65, r: 0.4};
export const START_CLOCK = 3 * 60 + 10; // 03:10 local

const KINDS = {
  container: {rot: 22, acc: 0.9, delay: 0.5, draft: 12.5, len: 260, slow: 6, half: 9, full: 12},
  ferry: {rot: 45, acc: 2.6, delay: 0.3, draft: 4.8, len: 120, slow: 6, half: 9, full: 12},
  fishing: {rot: 70, acc: 3.5, delay: 0.8, draft: 3.2, len: 24, slow: 3, half: 5, full: 6}
};

export const SCENARIOS = {
  fog: {
    title: ['ضباب الفجر', 'Dawn fog'],
    brief: ['ضباب كثيف يغلق الرؤية. قناة المرسى ضيقة، ولا تلتقي فيها سفينتان كبيرتان. سفينة الحاويات «صفا» قادمة، والعبّارة «دانة» خارجة، وقارب الصيد «نجم ٧» يعبر مدخل الميناء.',
      'Thick fog closes visibility. The Marsa channel is narrow, and two large ships must not meet in it. The container ship SAFA is inbound, the ferry DANA is outbound, and the fishing boat NAJM 7 is crossing the approach.'],
    current: {set: 0, drift: 0},
    shift: 36,
    vessels: [
      {id: 'safa', name: ['صفا', 'SAFA'], kind: 'container', x: 2.1, y: 3.3, speed: 12,
        route: [[1.1, 3.05], [0.15, 2.05], [0.15, 0.6], [0.1, -1.0]], goal: {type: 'reach', x: 0.15, y: 0.3, r: 0.3}},
      {id: 'dana', name: ['دانة', 'DANA'], kind: 'ferry', x: -0.15, y: -1.05, speed: 12,
        route: [[-0.15, 1.9], [-0.9, 3.4], [-1.9, 5.8]], goal: {type: 'exit', r: 4.5}},
      {id: 'najm', name: ['نجم ٧', 'NAJM 7'], kind: 'fishing', x: -2.3, y: 2.75, speed: 6,
        route: [[2.6, 2.75], [5.8, 2.6]], goal: {type: 'cross', x: 0.7}, deaf: 1}
    ]
  },
  current: {
    title: ['تيار المدّ', 'Flood current'],
    brief: ['التيار يدفع كل شيء نحو الشرق بسرعة عقدة. السفينة البطيئة تنجرف أكثر، وضفة الشرق الضحلة على بعد ميل من القناة.',
      'The flood current sets everything east at one knot. A slow ship drifts more, and the shallow east bank lies a mile from the channel.'],
    current: {set: 90, drift: 1},
    shift: 36,
    vessels: [
      {id: 'safa', name: ['صفا', 'SAFA'], kind: 'container', x: 2.1, y: 3.3, speed: 12,
        route: [[1.1, 3.05], [0.15, 2.05], [0.15, 0.6], [0.1, -1.0]], goal: {type: 'reach', x: 0.15, y: 0.3, r: 0.3}},
      {id: 'dana', name: ['دانة', 'DANA'], kind: 'ferry', x: -0.15, y: -1.05, speed: 12,
        route: [[-0.15, 1.9], [-0.9, 3.4], [-1.9, 5.8]], goal: {type: 'exit', r: 4.5}},
      {id: 'najm', name: ['نجم ٧', 'NAJM 7'], kind: 'fishing', x: -2.9, y: 2.75, speed: 6,
        route: [[2.6, 2.75], [5.8, 2.6]], goal: {type: 'cross', x: 0.7}, deaf: 1}
    ]
  }
};

export const ORDERS = {
  starboard10: {turn: 10}, starboard20: {turn: 20}, port10: {turn: -10}, port20: {turn: -20},
  slow: {speed: 'slow'}, half: {speed: 'half'}, full: {speed: 'full'}, stop: {speed: 'stop'},
  anchor: {anchor: true}, resume: {resume: true}
};

const rad = d => d * Math.PI / 180;
export const norm = d => ((d % 360) + 360) % 360;
export const bearing = (x0, y0, x1, y1) => norm(Math.atan2(x1 - x0, y1 - y0) * 180 / Math.PI);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const turnToward = (from, to, max) => {
  const diff = ((to - from + 540) % 360) - 180;
  return norm(from + Math.max(-max, Math.min(max, diff)));
};

// Ground velocity in nautical miles per minute, current included.
export function velocity(v, current) {
  const sx = Math.sin(rad(v.heading)) * v.speed / 60, sy = Math.cos(rad(v.heading)) * v.speed / 60;
  const d = current ? current.drift / 60 : 0;
  return {x: sx + Math.sin(rad(current?.set || 0)) * d, y: sy + Math.cos(rad(current?.set || 0)) * d};
}

// Closest point of approach between two moving targets on their present vectors.
export function cpa(a, b, current) {
  const va = velocity(a, current), vb = velocity(b, current);
  const rx = b.x - a.x, ry = b.y - a.y, vx = vb.x - va.x, vy = vb.y - va.y, vv = vx * vx + vy * vy;
  const tcpa = vv < 1e-9 ? 0 : Math.max(0, -(rx * vx + ry * vy) / vv);
  return {cpa: Math.hypot(rx + vx * tcpa, ry + vy * tcpa), tcpa};
}

export const inChannel = v => v.x > CHANNEL.x0 && v.x < CHANNEL.x1 && v.y > CHANNEL.y0 && v.y < CHANNEL.y1;
export const onLand = v => v.y < HARBOUR.y - 0.05 && Math.abs(v.x) > HARBOUR.gap;
export const shoalUnder = v => SHOALS.find(s => Math.hypot(v.x - s.x, v.y - s.y) < s.r && KINDS[v.kind].draft > s.depth) ||
  (!inChannel(v) && v.x > BANK.x0 && v.x < BANK.x1 && v.y > BANK.y0 && v.y < BANK.y1 && KINDS[v.kind].draft > BANK.depth ? {id: 'channel-edge'} : null);
export const large = v => KINDS[v.kind].len >= 100;

export function create(scenarioId = 'fog') {
  const sc = SCENARIOS[scenarioId] || SCENARIOS.fog;
  return {
    scenario: SCENARIOS[scenarioId] ? scenarioId : 'fog',
    time: 0, over: false, result: null, calls: [], events: [], closest: {},
    vessels: sc.vessels.map(d => {
      const k = KINDS[d.kind];
      const first = d.route[0];
      return {
        id: d.id, name: d.name, kind: d.kind, x: d.x, y: d.y,
        heading: bearing(d.x, d.y, first[0], first[1]), speed: d.speed, ordered: d.speed,
        route: d.route.map(([x, y]) => ({x, y})), wp: 0, mode: 'route', fixed: null,
        goal: d.goal, done: false, gone: false, grounded: false, deaf: d.deaf || 0, unanswered: 0,
        pending: [], trail: [], k
      };
    })
  };
}

function wanted(v) {
  if (v.mode === 'heading') return v.fixed;
  if (v.mode === 'anchor') return bearing(v.x, v.y, ANCHORAGE.x, ANCHORAGE.y);
  const p = v.route[Math.min(v.wp, v.route.length - 1)];
  return bearing(v.x, v.y, p.x, p.y);
}

// A VHF instruction. Returns the radio exchange; the effect lands after the ship's reaction time.
export function instruct(state, id, order) {
  const v = state.vessels.find(s => s.id === id), o = ORDERS[order];
  if (!v || !o || state.over || v.gone || v.grounded) return null;
  const call = {at: state.time, id, order, reply: 'ack'};
  if (v.deaf && v.unanswered < v.deaf) {
    v.unanswered++;
    call.reply = 'silent';
    state.calls.push(call);
    return call;
  }
  if (o.anchor && v.goal.type !== 'reach') call.reply = 'unable';
  else v.pending.push({at: state.time + v.k.delay, order});
  state.calls.push(call);
  return call;
}

function apply(v, order) {
  const o = ORDERS[order];
  if (o.turn) { v.mode = 'heading'; v.fixed = norm(wanted(v) + o.turn); }
  if (o.speed) v.ordered = o.speed === 'stop' ? 0 : v.k[o.speed];
  if (o.anchor) { v.mode = 'anchor'; v.ordered = v.k.slow; }
  if (o.resume) {
    v.mode = 'route';
    v.ordered = v.k.full;
    // Skip any waypoint the ship has already overtaken while off its route.
    while (v.wp < v.route.length - 1 && distance(v, v.route[v.wp + 1]) < distance(v.route[v.wp], v.route[v.wp + 1])) v.wp++;
  }
}

function event(state, type, ids, extra = {}) {
  const key = type + ':' + ids.join('-');
  if (state.events.some(e => e.key === key)) return;
  state.events.push({key, type, ids, at: state.time, ...extra});
}

export function step(state) {
  if (state.over) return state;
  const sc = SCENARIOS[state.scenario], dt = STEP;
  for (const v of state.vessels) {
    if (v.gone) continue;
    while (v.pending.length && v.pending[0].at <= state.time) apply(v, v.pending.shift().order);
    if (v.grounded) continue;
    if (v.mode === 'route' && v.wp < v.route.length && distance(v, v.route[v.wp]) < 0.15) v.wp++;
    if (v.mode === 'route' && v.wp >= v.route.length) v.ordered = v.goal.type === 'reach' ? 0 : v.ordered;
    if (v.mode === 'anchor' && distance(v, ANCHORAGE) < 0.18) v.ordered = 0;
    v.heading = turnToward(v.heading, wanted(v), v.k.rot * dt);
    const dv = v.ordered - v.speed, maxDv = v.k.acc * dt;
    v.speed = Math.max(0, v.speed + Math.max(-maxDv, Math.min(maxDv, dv)));
    const drift = v.speed < 0.2 && v.mode === 'anchor' && distance(v, ANCHORAGE) < 0.25 ? null : sc.current;
    const g = velocity(v, drift);
    v.x += g.x * dt;
    v.y += g.y * dt;
    if (Math.round(state.time / dt) % 6 === 0) { v.trail.push({x: v.x, y: v.y}); if (v.trail.length > 14) v.trail.shift(); }
    const shoal = shoalUnder(v);
    if (shoal || onLand(v)) { v.grounded = true; v.speed = 0; v.ordered = 0; event(state, 'grounding', [v.id], {where: shoal ? shoal.id : 'coast'}); }
    if (!v.done && v.goal.type === 'reach' && Math.hypot(v.x - v.goal.x, v.y - v.goal.y) < v.goal.r) { v.done = true; event(state, 'arrived', [v.id]); }
    if (!v.done && v.goal.type === 'exit' && Math.hypot(v.x, v.y) > v.goal.r) { v.done = true; event(state, 'cleared', [v.id]); }
    if (!v.done && v.goal.type === 'cross' && v.x > v.goal.x) { v.done = true; event(state, 'crossed', [v.id]); }
    if (Math.hypot(v.x, v.y) > RANGE + 0.6 || (v.goal.type === 'reach' && v.y < HARBOUR.y + 0.05)) v.gone = true;
  }
  const live = state.vessels.filter(v => !v.gone);
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], d = distance(a, b), key = [a.id, b.id].sort().join('-');
    const best = state.closest[key];
    if (!best || d < best.d) state.closest[key] = {d, at: state.time};
    if (d < COLLISION) event(state, 'collision', [a.id, b.id].sort(), {d});
    else if (d < CLOSE) event(state, 'close', [a.id, b.id].sort(), {d});
    if (large(a) && large(b) && inChannel(a) && inChannel(b)) event(state, 'meeting', [a.id, b.id].sort());
  }
  state.ticks = (state.ticks || 0) + 1;
  state.time = state.ticks * dt; // counted, so rounding never drifts the clock
  const allDone = state.vessels.every(v => v.done || v.gone || v.grounded);
  if (state.events.some(e => e.type === 'collision') || state.time >= sc.shift || allDone) finish(state);
  return state;
}

export function advance(state, minutes) {
  const end = state.time + minutes;
  while (!state.over && state.time < end - STEP / 2) step(state);
  return state;
}

// The watch report: what a duty officer would record.
export function finish(state) {
  if (state.result) return state.result;
  state.over = true;
  const bad = t => state.events.filter(e => e.type === t);
  const collisions = bad('collision'), groundings = bad('grounding'), close = bad('close'), meetings = bad('meeting');
  const pending = state.vessels.filter(v => !v.done && !v.grounded).map(v => v.id);
  const verdict = collisions.length || groundings.length ? 'casualty' : close.length || meetings.length ? 'incident' : pending.length ? 'safe-delayed' : 'clean';
  const closest = Object.entries(state.closest).map(([pair, c]) => ({pair: pair.split('-'), d: c.d, at: c.at})).sort((a, b) => a.d - b.d);
  state.result = {verdict, collisions: collisions.length, groundings: groundings.length, close: close.length, meetings: meetings.length,
    pending, closest, calls: state.calls.length, minutes: state.time};
  return state.result;
}

// Present picture: the riskiest pair on current vectors, for the operator's warning line.
export function threats(state) {
  const sc = SCENARIOS[state.scenario], live = state.vessels.filter(v => !v.gone && !v.grounded), list = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const r = cpa(live[i], live[j], sc.current);
    if (r.cpa < 0.5 && r.tcpa < 15) list.push({pair: [live[i].id, live[j].id], ...r});
  }
  return list.sort((a, b) => a.cpa - b.cpa);
}

export const clock = minutes => {
  const total = Math.round((START_CLOCK + minutes) * 60), h = Math.floor(total / 3600) % 24, m = Math.floor(total / 60) % 60, s = total % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
};
export const kinds = KINDS;

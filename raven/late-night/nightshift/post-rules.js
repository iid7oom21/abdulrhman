export const LAST_MINUTE = 32;
export const TRANSFER = 1;
export const CAPACITY = 2;
export const parcels = [
  {id:'film', origin:'car', target:3, opens:21, closes:23, label:['علبة الفيلم','Film canister']},
  {id:'keys', origin:'shelf', target:0, opens:8, closes:9, label:['مفاتيح الصالة','Hall keys']},
  {id:'slides', origin:'shelf', target:2, opens:13, closes:14, label:['شرائح العرض','Projection slides']},
];

export function beginShift() {
  return {floor:0, minute:0, slots:parcels.map(p => p.origin), delivered:[null,null,null], log:[]};
}
export function finished(s) { return s.minute >= LAST_MINUTE || s.delivered.every(v => v !== null); }

export function perform(s, command) {
  if (finished(s)) return {error:'finished'};
  if (typeof command !== 'string') return {error:'command'};
  let floor = s.floor, duration = 1, parcel = null, from = '', to = '';
  const slots = [...s.slots], delivered = [...s.delivered];
  if (command === 'up' || command === 'down') {
    floor += command === 'up' ? 1 : -1;
    if (floor < 0 || floor > 3) return {error:'floor'};
    duration = 2;
  } else if (command !== 'wait') {
    const [action, id, extra] = command.split(':');
    parcel = parcels.findIndex(p => p.id === id);
    if (extra !== undefined || parcel < 0) return {error:'command'};
    from = slots[parcel];
    if (action === 'load') {
      if (floor !== TRANSFER || !['shelf','platform'].includes(from)) return {error:'location'};
      if (slots.filter(slot => slot === 'car').length >= CAPACITY) return {error:'capacity'};
      to = 'car';
    } else if (action === 'unload') {
      if (floor !== TRANSFER || from !== 'car') return {error:'location'};
      if (slots.includes('platform')) return {error:'platform'};
      to = 'platform';
    } else if (action === 'deliver') {
      if (floor !== parcels[parcel].target || from !== 'car') return {error:'location'};
      if (s.minute + duration < parcels[parcel].opens) return {error:'early'};
      to = 'delivered'; delivered[parcel] = s.minute + duration;
    } else return {error:'command'};
    slots[parcel] = to;
  }
  if (s.minute + duration > LAST_MINUTE) return {error:'closing'};
  const event = {command, start:s.minute, end:s.minute+duration, floor, from, to, parcel,
    emptyTravel:(command === 'up' || command === 'down') && !s.slots.includes('car')};
  return {state:{floor, minute:event.end, slots, delivered, log:[...s.log,event]}};
}

export function restoreShift(data) {
  if (data?.version !== 1 || !Array.isArray(data.commands) || data.commands.length > LAST_MINUTE) return null;
  let state = beginShift();
  for (const command of data.commands) {
    const result = perform(state,command);
    if (!result.state) return null;
    state = result.state;
  }
  return state;
}

export function elapsedByUse(s) {
  const times = {travel:0, emptyTravel:0, wait:0, transfer:0, handling:0};
  for (const e of s.log) {
    const duration = e.end - e.start;
    if (e.command === 'wait') times.wait += duration;
    else if (e.command === 'up' || e.command === 'down') {
      times.travel += duration;
      if (e.emptyTravel) times.emptyTravel += duration;
    } else if (e.from === 'platform' || e.to === 'platform') times.transfer += duration;
    else times.handling += duration;
  }
  return times;
}

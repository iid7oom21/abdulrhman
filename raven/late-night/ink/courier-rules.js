export const START = 20;
export const LETTER = 3;
export const CINEMA = 24;
export const MAX_STEPS = 16;
export const WET_LIMIT = 100;
export const PANELS = ['departure', 'middle', 'end'];
export const MANGA_FORMAT = 'raven-rain-manga-2';
export const DRAFT_FORMAT = 'raven-rain-round-2';

const walls = new Set([7, 12, 17]);
const water = new Set([1, 6, 11, 16, 21]);
export const terrain = cell => walls.has(cell) ? 'wall' : water.has(cell) ? 'water' : 'covered';

export function neighbor(cell, offsetX, offsetY) {
  const x = cell % 5 + offsetX;
  const y = Math.floor(cell / 5) + offsetY;
  return x >= 0 && x < 5 && y >= 0 && y < 5 ? y * 5 + x : null;
}

export function begin() {
  return {cell: START, steps: 0, wetness: 0, pickup: null, outcome: 'playing'};
}

export function preview(round, cell) {
  if (round.outcome !== 'playing') return {reason: 'ended'};
  if (!Number.isInteger(cell) || cell < 0 || cell > 24) return {reason: 'outside'};
  if (cell === round.cell) return {reason: 'current'};
  if (terrain(cell) === 'wall') return {reason: 'wall'};
  const dx = Math.abs(cell % 5 - round.cell % 5);
  const dy = Math.abs(Math.floor(cell / 5) - Math.floor(round.cell / 5));
  if (dx + dy !== 1) return {reason: 'distant'};
  const cost = terrain(cell) === 'water' ? 22 : 3;
  return {cost, wetness: round.wetness + cost, steps: round.steps + 1};
}

export function advance(round, cell) {
  const next = preview(round, cell);
  if (next.reason) return null;
  const pickup = round.pickup ?? (cell === LETTER ? next.steps : null);
  let outcome = 'playing';
  if (next.wetness >= WET_LIMIT) outcome = 'soaked';
  else if (cell === CINEMA && pickup !== null) outcome = 'delivered';
  else if (next.steps >= MAX_STEPS) outcome = 'out-of-time';
  return {cell, steps: next.steps, wetness: next.wetness, pickup, outcome};
}

// Replaying only legal moves derives inventory, events and terminal states from the route.
export function replay(path) {
  if (!Array.isArray(path) || path.length > MAX_STEPS) return null;
  let round = begin();
  for (const cell of path) {
    round = advance(round, cell);
    if (!round) return null;
  }
  return round;
}

export function validOrder(order) {
  return Array.isArray(order) && order.length === 3 && PANELS.every(id => order.includes(id));
}

export function validWeather(weather) {
  return weather && Number.isInteger(weather.rain) && weather.rain >= 0 && weather.rain <= 100 &&
    Number.isInteger(weather.wind) && weather.wind >= -50 && weather.wind <= 50;
}

export function validateCourierManga(data) {
  if (!data || data.format !== MANGA_FORMAT || !validOrder(data.order) || !validWeather(data.weather)) return false;
  const round = replay(data.path);
  return Boolean(round && round.outcome !== 'playing');
}

export function validDraft(data) {
  return !!data && data.format === DRAFT_FORMAT && validOrder(data.order) && validWeather(data.weather) &&
    ['game','weather','manga'].includes(data.tab) && !!replay(data.path);
}

export function panelEvents(path) {
  const round = replay(path);
  if (!round) return [];
  const panels = [{id:'departure', art:'departure', step:0, cell:START}];
  if (round.pickup !== null) {
    panels.push({id:'middle', art:'letter', step:round.pickup, cell:LETTER});
  } else if (round.outcome !== 'playing') {
    const step = Math.ceil(round.steps / 2);
    panels.push({id:'middle', art:'crossing', step, cell:path[step-1]});
  }
  if (round.outcome !== 'playing') {
    panels.push({id:'end', art:round.outcome === 'delivered' ? 'arrival' : 'shelter',
      step:round.steps, cell:round.cell, outcome:round.outcome});
  }
  return panels;
}

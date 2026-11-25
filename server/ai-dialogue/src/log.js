const MAX_TEXT = 300;
const MAX_STACK_LINES = 4;
const LEVELS = {silent: 0, error: 1, info: 2};

// A structure can carry player material or a session capability, so it is dropped rather than serialized.
function plainValue(value) {
  if (typeof value === 'string') return value.length > MAX_TEXT ? value.slice(0, MAX_TEXT) + '...' : value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean' || value === null) return value;
  return undefined;
}

export function errorFields(error) {
  const fields = {
    errorName: typeof error?.name === 'string' && error.name ? error.name : 'Error',
    errorMessage: typeof error?.message === 'string' ? error.message : String(error ?? ''),
  };
  for (const [source, name] of [['code','errorCode'],['reason','errorReason'],['httpStatus','errorHttpStatus']]) {
    const value = error?.[source];
    if (typeof value === 'string' || typeof value === 'number') fields[name] = value;
  }
  if (typeof error?.stack === 'string') fields.errorStack = error.stack.split('\n').slice(0, MAX_STACK_LINES).join('\n');
  return fields;
}

export function createLog({level = process.env.RAVEN_LOG_LEVEL || 'info', stdout = process.stdout, stderr = process.stderr,
  now = () => new Date().toISOString()} = {}) {
  const threshold = Object.hasOwn(LEVELS, level) ? LEVELS[level] : LEVELS.info;
  const write = (stream, name, event, fields) => {
    if (typeof event !== 'string' || !event) throw new Error('log_event_required');
    const line = {level: name, time: now(), event};
    for (const [key, value] of Object.entries(fields || {})) {
      const plain = plainValue(value);
      if (plain !== undefined && !Object.hasOwn(line, key)) line[key] = plain;
    }
    try { stream.write(JSON.stringify(line) + '\n'); }
    catch { /* A closed stream must never fail the request it describes. */ }
  };
  return {
    level,
    info(event, fields) { if (threshold >= LEVELS.info) write(stdout, 'info', event, fields); },
    error(event, fields) { if (threshold >= LEVELS.error) write(stderr, 'error', event, fields); },
  };
}

type Fields = Record<string, string | number | boolean | null | undefined>;

/** Structured logs — avoid PII (no phone/email/full names in message fields). */
function emit(level: 'info' | 'warn' | 'error', event: string, fields: Fields): void {
  const line = JSON.stringify({
    level,
    app: 'functions',
    event,
    ...fields,
    ts: new Date().toISOString(),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export function logInfo(event: string, fields: Fields = {}): void {
  emit('info', event, fields);
}

export function logWarn(event: string, fields: Fields = {}): void {
  emit('warn', event, fields);
}

export function logError(event: string, fields: Fields = {}): void {
  emit('error', event, fields);
}

export async function timed<T>(
  event: string,
  run: () => Promise<T>,
  fields: Fields = {},
): Promise<T> {
  const started = Date.now();
  logInfo(`${event}_start`, fields);
  try {
    const result = await run();
    logInfo(`${event}_ok`, { ...fields, ms: Date.now() - started });
    return result;
  } catch (e) {
    logError(`${event}_fail`, {
      ...fields,
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}

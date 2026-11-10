type Fields = Record<string, string | number | boolean | null | undefined>;

function emit(
  level: 'info' | 'warn' | 'error',
  event: string,
  fields: Fields = {},
): void {
  const payload = {
    level,
    app: 'admin_web',
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logInfo = (event: string, fields?: Fields) =>
  emit('info', event, fields);
export const logWarn = (event: string, fields?: Fields) =>
  emit('warn', event, fields);
export const logError = (event: string, fields?: Fields) =>
  emit('error', event, fields);

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

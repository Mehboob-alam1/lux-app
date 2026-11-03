/** Structured logs — avoid PII (no phone/email/full names in message fields). */
export function logInfo(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  console.log(JSON.stringify({ level: 'info', event, ...fields, ts: new Date().toISOString() }));
}

export function logError(
  event: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  console.error(JSON.stringify({ level: 'error', event, ...fields, ts: new Date().toISOString() }));
}

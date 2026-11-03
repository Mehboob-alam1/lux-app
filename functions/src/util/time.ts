export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutesIso(minutes: number, from = new Date()): string {
  return new Date(from.getTime() + minutes * 60_000).toISOString();
}

export function isExpired(expiresAt: string | Date, now = new Date()): boolean {
  const t = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  return t.getTime() <= now.getTime();
}

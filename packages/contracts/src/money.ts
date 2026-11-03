import { z } from 'zod';

/** Money in integer minor units — never floating point. */
export const MoneySchema = z.object({
  amountMinor: z.number().int(),
  currency: z.string().length(3).toUpperCase(),
});
export type Money = z.infer<typeof MoneySchema>;

export function assertMinor(amountMinor: number): number {
  if (!Number.isInteger(amountMinor)) {
    throw new Error('Money amounts must be integer minor units');
  }
  return amountMinor;
}

/** Banker's rounding to nearest minor unit from a rational (numerator/denominator). */
export function roundHalfEvenMinor(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Invalid money value');
  const sign = value < 0 ? -1 : 1;
  const abs = Math.abs(value);
  const floor = Math.floor(abs);
  const frac = abs - floor;
  if (frac < 0.5) return sign * floor;
  if (frac > 0.5) return sign * (floor + 1);
  // exactly .5 → nearest even
  return sign * (floor % 2 === 0 ? floor : floor + 1);
}

export function addMinor(a: number, b: number): number {
  return assertMinor(a) + assertMinor(b);
}

export function subtractMinor(a: number, b: number): number {
  return assertMinor(a) - assertMinor(b);
}

export function formatMoney(money: Money, locale = 'en-CA'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(money.amountMinor / 100);
}

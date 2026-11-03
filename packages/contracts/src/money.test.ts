import { describe, expect, it } from 'vitest';
import { addMinor, assertMinor, roundHalfEvenMinor } from './money';

describe('money', () => {
  it('rejects floats', () => {
    expect(() => assertMinor(1.5)).toThrow();
  });

  it('adds minor units', () => {
    expect(addMinor(100, 50)).toBe(150);
  });

  it('rounds half-even', () => {
    expect(roundHalfEvenMinor(2.5)).toBe(2);
    expect(roundHalfEvenMinor(3.5)).toBe(4);
  });
});

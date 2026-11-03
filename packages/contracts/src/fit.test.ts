import { describe, expect, it } from 'vitest';
import { evaluateVehicleFit } from './fit';

describe('vehicle fit', () => {
  it('accepts suitable comfort booking', () => {
    expect(
      evaluateVehicleFit('COMFORT', { passengers: 2, luggage: 2 }),
    ).toEqual({ ok: true });
  });

  it('blocks unsuitable class and suggests upgrade', () => {
    const result = evaluateVehicleFit('COMFORT', {
      passengers: 5,
      luggage: 4,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.suggestedClasses).toContain('LUXURY_SUV');
    }
  });

  it('blocks oversized on comfort', () => {
    const result = evaluateVehicleFit('COMFORT', {
      passengers: 1,
      luggage: 1,
      oversized: true,
    });
    expect(result.ok).toBe(false);
  });
});

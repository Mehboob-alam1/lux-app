import { describe, expect, it } from 'vitest';
import { priceItinerary } from './pricing';

describe('pricing engine', () => {
  it('prices comfort trip in minor units', () => {
    const q = priceItinerary({
      distanceKm: 10,
      durationMin: 20,
      classId: 'COMFORT',
      airport: false,
      extraStops: 0,
      addons: [],
    });
    expect(Number.isInteger(q.totalMinor)).toBe(true);
    expect(q.totalMinor).toBeGreaterThan(0);
    expect(q.driverPayoutMinor).toBeLessThan(q.totalMinor);
  });

  it('applies airport fee and minimum', () => {
    const q = priceItinerary({
      distanceKm: 1,
      durationMin: 5,
      classId: 'COMFORT',
      airport: true,
      extraStops: 0,
      addons: ['MEET_AND_GREET'],
    });
    expect(q.components.some((c) => c.code === 'AIRPORT')).toBe(true);
    expect(q.components.some((c) => c.code === 'ADDON_MEET_AND_GREET')).toBe(
      true,
    );
  });

  it('executive costs more than comfort for same itinerary', () => {
    const base = {
      distanceKm: 15,
      durationMin: 25,
      airport: false,
      extraStops: 0,
      addons: [] as const,
    };
    const comfort = priceItinerary({ ...base, classId: 'COMFORT', addons: [] });
    const exec = priceItinerary({ ...base, classId: 'EXECUTIVE', addons: [] });
    expect(exec.totalMinor).toBeGreaterThan(comfort.totalMinor);
  });
});

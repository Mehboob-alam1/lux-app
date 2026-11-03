import { describe, expect, it } from 'vitest';
import { evaluateEligibility, rankCandidates } from './eligibility';

const base = {
  driverId: 'd1',
  vehicleId: 'v1',
  classIds: ['COMFORT' as const],
  status: 'ACTIVE',
  onlineState: 'ONLINE',
  documentEligibilityOk: true,
  vehicleApproved: true,
  capacityPassengers: 3,
  capacityLuggage: 2,
  marketIds: ['yyz'],
  lat: 43.65,
  lng: -79.38,
  reliability: 0.9,
};

const input = {
  marketId: 'yyz',
  classId: 'COMFORT' as const,
  passengers: 2,
  luggage: 1,
  pickup: { lat: 43.66, lng: -79.39 },
};

describe('dispatch eligibility', () => {
  it('rejects ineligible vehicle docs', () => {
    expect(
      evaluateEligibility(
        { ...base, documentEligibilityOk: false },
        input,
      ).ok,
    ).toBe(false);
  });

  it('ranks nearer higher reliability first', () => {
    const ranked = rankCandidates(
      [
        { ...base, driverId: 'far', lat: 44, lng: -79, reliability: 0.99 },
        { ...base, driverId: 'near', lat: 43.651, lng: -79.381, reliability: 0.8 },
      ],
      input,
    );
    expect(ranked[0].driverId).toBe('near');
  });
});

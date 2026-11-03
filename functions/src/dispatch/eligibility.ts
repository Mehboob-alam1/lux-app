import { VehicleClassId } from '@lux/contracts';

export type DriverCandidate = {
  driverId: string;
  vehicleId: string;
  classIds: VehicleClassId[];
  status: string;
  onlineState: string;
  documentEligibilityOk: boolean;
  vehicleApproved: boolean;
  capacityPassengers: number;
  capacityLuggage: number;
  marketIds: string[];
  lat?: number;
  lng?: number;
  reliability: number;
  nextCommitmentAt?: string | null;
};

export type EligibilityInput = {
  marketId: string;
  classId: VehicleClassId;
  passengers: number;
  luggage: number;
  scheduledAt?: string | null;
  pickup: { lat: number; lng: number };
};

export type RankedCandidate = DriverCandidate & {
  score: number;
  etaMinutes: number;
  pickupDistanceKm: number;
  ineligibleReason?: string;
};

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function evaluateEligibility(
  c: DriverCandidate,
  input: EligibilityInput,
): { ok: boolean; reason?: string } {
  if (c.status !== 'ACTIVE') return { ok: false, reason: 'Driver not ACTIVE' };
  if (c.onlineState !== 'ONLINE') return { ok: false, reason: 'Driver offline' };
  if (!c.documentEligibilityOk) {
    return { ok: false, reason: 'Documents ineligible' };
  }
  if (!c.vehicleApproved) return { ok: false, reason: 'Vehicle not approved' };
  if (!c.marketIds.includes(input.marketId)) {
    return { ok: false, reason: 'Market mismatch' };
  }
  if (!c.classIds.includes(input.classId)) {
    return { ok: false, reason: 'Class mismatch' };
  }
  if (c.capacityPassengers < input.passengers) {
    return { ok: false, reason: 'Passenger capacity' };
  }
  if (c.capacityLuggage < input.luggage) {
    return { ok: false, reason: 'Luggage capacity' };
  }
  // Schedule overlap check is applied by caller with booking calendar
  return { ok: true };
}

/**
 * Deterministic ranking: ETA/distance, reliability, commitment pressure.
 * No speculative AI (D020).
 */
export function rankCandidates(
  candidates: DriverCandidate[],
  input: EligibilityInput,
): RankedCandidate[] {
  const ranked: RankedCandidate[] = [];
  for (const c of candidates) {
    const el = evaluateEligibility(c, input);
    const pickupDistanceKm =
      c.lat != null && c.lng != null
        ? haversineKm({ lat: c.lat, lng: c.lng }, input.pickup)
        : 50;
    const etaMinutes = Math.max(5, Math.round(pickupDistanceKm * 3));
    if (!el.ok) {
      ranked.push({
        ...c,
        score: -1,
        etaMinutes,
        pickupDistanceKm,
        ineligibleReason: el.reason,
      });
      continue;
    }
    const score =
      1000 -
      pickupDistanceKm * 10 -
      etaMinutes +
      c.reliability * 100 -
      (c.nextCommitmentAt ? 20 : 0);
    ranked.push({ ...c, score, etaMinutes, pickupDistanceKm });
  }
  return ranked
    .filter((r) => r.score >= 0)
    .sort((a, b) => b.score - a.score || a.driverId.localeCompare(b.driverId));
}

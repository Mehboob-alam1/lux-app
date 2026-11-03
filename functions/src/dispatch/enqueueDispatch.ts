import { db } from '../firebase';
import { newId } from '../util/ids';
import { addMinutesIso, nowIso } from '../util/time';
import { rankCandidates, DriverCandidate } from './eligibility';
import { logInfo } from '../util/logger';

/**
 * Create time-limited offers for top eligible independent owner-drivers.
 * Fleet dispatch intentionally not implemented.
 */
export async function enqueueDispatch(bookingId: string): Promise<void> {
  const bookingRef = db.collection('bookings').doc(bookingId);
  const bookingSnap = await bookingRef.get();
  if (!bookingSnap.exists) return;
  const booking = bookingSnap.data()!;

  const driversSnap = await db
    .collection('drivers')
    .where('status', '==', 'ACTIVE')
    .where('onlineState', '==', 'ONLINE')
    .where('marketIds', 'array-contains', booking.marketId)
    .limit(50)
    .get();

  const candidates: DriverCandidate[] = [];
  for (const d of driversSnap.docs) {
    const driver = d.data();
    if (driver.driverType && driver.driverType !== 'OWNER_DRIVER') {
      // Future fleet drivers ignored this update
      continue;
    }
    if (!driver.currentVehicleId) continue;
    const vSnap = await db.collection('vehicles').doc(driver.currentVehicleId).get();
    if (!vSnap.exists) continue;
    const v = vSnap.data()!;
    const locSnap = await db.collection('driver_locations').doc(d.id).get();
    const loc = locSnap.data();
    candidates.push({
      driverId: d.id,
      vehicleId: v.vehicleId ?? vSnap.id,
      classIds: v.classIds ?? [],
      status: driver.status,
      onlineState: driver.onlineState,
      documentEligibilityOk: Boolean(v.documentEligibilityOk),
      vehicleApproved: v.status === 'APPROVED',
      capacityPassengers: v.capacityPassengers,
      capacityLuggage: v.capacityLuggage,
      marketIds: driver.marketIds ?? [],
      lat: loc?.lat,
      lng: loc?.lng,
      reliability: driver.performance?.completionRate ?? 0.8,
      nextCommitmentAt: null,
    });
  }

  const pickup = booking.itinerary.find(
    (s: { kind: string }) => s.kind === 'PICKUP',
  );
  if (!pickup) return;

  const ranked = rankCandidates(candidates, {
    marketId: booking.marketId,
    classId: booking.classId,
    passengers: booking.passengers,
    luggage: booking.luggage,
    scheduledAt: booking.scheduledAt,
    pickup: pickup.place.location,
  });

  const top = ranked.slice(0, 5);
  const now = nowIso();
  const batch = db.batch();
  for (const c of top) {
    const offerId = newId('off');
    batch.set(db.collection('driver_offers').doc(offerId), {
      offerId,
      bookingId,
      driverId: c.driverId,
      vehicleIdHint: c.vehicleId,
      expiresAt: addMinutesIso(2),
      response: 'PENDING',
      expectedPayoutMinor: booking.driverPayoutMinor,
      currency: booking.currency,
      pickupDistanceKm: c.pickupDistanceKm,
      etaMinutes: c.etaMinutes,
      createdAt: now,
    });
  }

  if (top.length === 0) {
    batch.update(bookingRef, {
      riskState: 'AT_RISK',
      updatedAt: now,
    });
    batch.set(db.collection('operational_alerts').doc(newId('alert')), {
      alertId: newId('alert'),
      marketId: booking.marketId,
      bookingId,
      health: 'AT_RISK',
      type: 'UNASSIGNED_NO_ELIGIBLE',
      createdAt: now,
    });
  }

  await batch.commit();
  logInfo('dispatch_offers_created', {
    bookingId,
    offerCount: top.length,
  });
}

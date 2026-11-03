import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { nowIso } from '../util/time';

const OPERATIONAL_STATUSES = new Set([
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'WAITING',
  'PASSENGER_ONBOARD',
  'IN_PROGRESS',
  'REASSIGNING',
]);

/**
 * State-aware location updates. Clients may only push when they have an
 * operational booking; writes go through Functions (rules deny direct write).
 */
export const updateDriverLocation = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    if (!ctx.roles.includes('DRIVER')) {
      throw new HttpsError('permission-denied', 'Driver role required');
    }
    const { lat, lng, accuracyM, bookingId, heading, speed } = request.data as {
      lat: number;
      lng: number;
      accuracyM?: number;
      bookingId?: string;
      heading?: number;
      speed?: number;
    };
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      throw new HttpsError('invalid-argument', 'lat/lng required');
    }

    if (bookingId) {
      const b = await db.collection('bookings').doc(bookingId).get();
      if (!b.exists || b.data()?.assignedDriverId !== ctx.uid) {
        throw new HttpsError('permission-denied', 'Not assigned to booking');
      }
      if (!OPERATIONAL_STATUSES.has(b.data()!.currentStatus)) {
        throw new HttpsError(
          'failed-precondition',
          'Location not justified for current booking state',
        );
      }
    }

    const now = nowIso();
    await db.collection('driver_locations').doc(ctx.uid).set({
      driverId: ctx.uid,
      lat,
      lng,
      accuracyM: accuracyM ?? null,
      heading: heading ?? null,
      speed: speed ?? null,
      bookingId: bookingId ?? null,
      updatedAt: now,
      // TTL cleanup via scheduled job — retain short window
      expireAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });

    return { ok: true, updatedAt: now };
  },
);

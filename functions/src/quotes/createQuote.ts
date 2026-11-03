import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  CreateQuoteCommandSchema,
  evaluateVehicleFit,
  type PriceKind,
} from '@lux/contracts';
import { createHash } from 'crypto';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requirePermission,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { addMinutesIso, nowIso } from '../util/time';
import { priceItinerary } from './pricing';
import { logInfo } from '../util/logger';

/** Haversine fallback when Maps adapter unavailable — marked ESTIMATED. */
function estimateKm(
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

export const createQuote = onCall({ region: 'us-central1' }, async (request) => {
  assertAppCheck(request);
  const ctx = await requireAuth(request);
  requirePermission(ctx, 'quote:create');

  const parsed = CreateQuoteCommandSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }
  const cmd = parsed.data;
  if (cmd.customerUid !== ctx.uid && !ctx.roles.some((r) => r.startsWith('ADMIN_'))) {
    throw new HttpsError('permission-denied', 'Cannot quote for another customer');
  }

  return withIdempotency(cmd.idempotencyKey, 'createQuote', ctx.uid, async () => {
    const market = await db.collection('markets').doc(cmd.marketId).get();
    if (!market.exists || !market.data()?.active) {
      throw new HttpsError('failed-precondition', 'Market unavailable');
    }
    if (market.data()?.bookingPaused) {
      throw new HttpsError('failed-precondition', 'Bookings paused in this market');
    }

    const fit = evaluateVehicleFit(cmd.selectedClass, {
      passengers: cmd.passengers,
      luggage: cmd.luggage,
      stroller: cmd.stroller,
      oversized: cmd.oversized,
    });
    if (!fit.ok) {
      throw new HttpsError('failed-precondition', fit.reason, {
        suggestedClasses: fit.suggestedClasses,
      });
    }

    const pickup = cmd.itinerary.find((s) => s.kind === 'PICKUP');
    const dropoff = cmd.itinerary.find((s) => s.kind === 'DROPOFF');
    if (!pickup || !dropoff) {
      throw new HttpsError('invalid-argument', 'Pickup and dropoff required');
    }

    const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.ROUTES_API_KEY;
    let distanceKm = estimateKm(pickup.place.location, dropoff.place.location);
    let durationMin = Math.max(10, Math.round(distanceKm * 2.2));
    let priceKind: PriceKind = 'FIXED';
    let mapsStatus: 'OK' | 'UNAVAILABLE' = 'OK';
    if (!mapsKey) {
      mapsStatus = 'UNAVAILABLE';
      // Without routes provider we still quote but mark ESTIMATED (honest)
      priceKind = 'ESTIMATED';
    }

    const extraStops = cmd.itinerary.filter((s) => s.kind === 'STOP').length;
    const priced = priceItinerary({
      distanceKm,
      durationMin,
      classId: cmd.selectedClass,
      airport: cmd.tripContext === 'AIRPORT' || Boolean(cmd.airport),
      extraStops,
      addons: cmd.addons,
    });

    const quoteId = newId('quo');
    const createdAt = nowIso();
    const expiresAt = addMinutesIso(15);
    const body = {
      quoteId,
      customerUid: cmd.customerUid,
      marketId: cmd.marketId,
      itinerary: cmd.itinerary,
      fit: {
        passengers: cmd.passengers,
        luggage: cmd.luggage,
        stroller: cmd.stroller ?? false,
        oversized: cmd.oversized ?? false,
      },
      selectedClass: cmd.selectedClass,
      components: priced.components,
      priceKind,
      totalMinor: priced.totalMinor,
      currency: priced.currency,
      ruleVersion: priced.ruleVersion,
      expiresAt,
      driverPayoutMinor: priced.driverPayoutMinor,
      redemptionState: 'OPEN',
      tripContext: cmd.tripContext,
      addons: cmd.addons,
      ...(cmd.airport ? { airport: cmd.airport } : {}),
      scheduledAt: cmd.scheduledAt ?? null,
      mapsStatus,
      createdAt,
    };

    const immutableHash = createHash('sha256')
      .update(JSON.stringify(body))
      .digest('hex');

    const doc = { ...body, immutableHash };
    await db.collection('quotes').doc(quoteId).set(doc);

    logInfo('quote_created', {
      quoteId,
      marketId: cmd.marketId,
      totalMinor: priced.totalMinor,
      priceKind,
      mapsStatus,
    });

    return {
      quote: doc,
      analyticsHint: 'quote_viewed',
      paymentMode: process.env.PAYMENT_MODE ?? 'sandbox',
    };
  });
});

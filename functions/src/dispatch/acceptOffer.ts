import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AcceptOfferCommandSchema } from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { isExpired, nowIso } from '../util/time';
import { logInfo } from '../util/logger';
import { notifyBookingEvent } from '../notifications/adapter';


export const acceptOffer = onCall({ region: 'us-central1' }, async (request) => {
  assertAppCheck(request);
  const ctx = await requireAuth(request);
  if (!ctx.roles.includes('DRIVER') && !ctx.roles.includes('ADMIN_SUPER')) {
    throw new HttpsError('permission-denied', 'Driver role required');
  }

  const parsed = AcceptOfferCommandSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new HttpsError('invalid-argument', parsed.error.message);
  }
  const cmd = parsed.data;

  return withIdempotency(cmd.idempotencyKey, 'acceptOffer', ctx.uid, async () => {
    const assignmentId = newId('asn');

    await db.runTransaction(async (tx) => {
      const offerRef = db.collection('driver_offers').doc(cmd.offerId);
      const offerSnap = await tx.get(offerRef);
      if (!offerSnap.exists) throw new HttpsError('not-found', 'Offer not found');
      const offer = offerSnap.data()!;
      if (offer.driverId !== ctx.uid) {
        throw new HttpsError('permission-denied', 'Not your offer');
      }
      if (offer.response !== 'PENDING') {
        throw new HttpsError('failed-precondition', 'Offer already resolved');
      }
      if (isExpired(offer.expiresAt)) {
        tx.update(offerRef, { response: 'EXPIRED' });
        throw new HttpsError('failed-precondition', 'Offer expired');
      }

      const bookingRef = db.collection('bookings').doc(offer.bookingId);
      const bookingSnap = await tx.get(bookingRef);
      if (!bookingSnap.exists) throw new HttpsError('not-found', 'Booking missing');
      const booking = bookingSnap.data()!;

      if (
        booking.currentStatus !== 'ASSIGNMENT_PENDING' &&
        booking.currentStatus !== 'REASSIGNING'
      ) {
        throw new HttpsError('failed-precondition', 'Booking not assignable');
      }
      if (booking.assignmentId) {
        throw new HttpsError('aborted', 'Already assigned');
      }

      const driverRef = db.collection('drivers').doc(ctx.uid);
      const driverSnap = await tx.get(driverRef);
      const driver = driverSnap.data();
      if (!driver || driver.status !== 'ACTIVE') {
        throw new HttpsError('failed-precondition', 'Driver not ACTIVE');
      }

      const vehicleRef = db.collection('vehicles').doc(cmd.vehicleId);
      const vehicleSnap = await tx.get(vehicleRef);
      if (!vehicleSnap.exists) throw new HttpsError('not-found', 'Vehicle not found');
      const vehicle = vehicleSnap.data()!;
      if (vehicle.ownerDriverId !== ctx.uid) {
        throw new HttpsError('permission-denied', 'Vehicle not owned');
      }
      if (vehicle.status !== 'APPROVED' || !vehicle.documentEligibilityOk) {
        throw new HttpsError(
          'failed-precondition',
          'Vehicle ineligible — cannot accept',
        );
      }
      if (!(vehicle.classIds ?? []).includes(booking.classId)) {
        throw new HttpsError('failed-precondition', 'Vehicle class mismatch');
      }

      const now = nowIso();
      tx.update(offerRef, { response: 'ACCEPTED', acceptedAt: now });
      tx.set(db.collection('assignments').doc(assignmentId), {
        assignmentId,
        bookingId: offer.bookingId,
        driverId: ctx.uid,
        vehicleId: cmd.vehicleId,
        status: 'ACCEPTED',
        offeredAt: offer.createdAt,
        acceptedAt: now,
        releasedAt: null,
        eligibilitySnapshot: {
          vehicleStatus: vehicle.status,
          documentEligibilityOk: vehicle.documentEligibilityOk,
          driverStatus: driver.status,
        },
        version: 1,
        payoutQuoteMinor: offer.expectedPayoutMinor,
        currency: offer.currency,
      });
      tx.update(bookingRef, {
        currentStatus: 'ASSIGNED',
        statusVersion: (booking.statusVersion ?? 0) + 1,
        assignmentId,
        assignedDriverId: ctx.uid,
        assignedVehicleId: cmd.vehicleId,
        assuranceStatus: 'CONFIRMED',
        riskState: 'NORMAL',
        updatedAt: now,
      });
      const eventId = newId('evt');
      tx.set(
        bookingRef.collection('events').doc(eventId),
        {
          eventId,
          bookingId: offer.bookingId,
          type: 'ASSIGNMENT_CONFIRMED',
          actorUid: ctx.uid,
          actorRole: 'DRIVER',
          timestamp: now,
          source: 'DRIVER_APP',
          previousStatus: booking.currentStatus,
          nextStatus: 'ASSIGNED',
          idempotencyKey: cmd.idempotencyKey,
        },
      );

      // Expire sibling pending offers
      // (best-effort outside strict sibling lock; transaction already locked booking)
    });

    // Expire other offers outside txn (booking already locked by assignmentId)
    const siblings = await db
      .collection('driver_offers')
      .where('bookingId', '==', (await db.collection('driver_offers').doc(cmd.offerId).get()).data()!.bookingId)
      .where('response', '==', 'PENDING')
      .get();
    const batch = db.batch();
    siblings.docs.forEach((d) => {
      if (d.id !== cmd.offerId) batch.update(d.ref, { response: 'EXPIRED' });
    });
    await batch.commit();

    const offer = (await db.collection('driver_offers').doc(cmd.offerId).get()).data()!;
    const booking = (await db.collection('bookings').doc(offer.bookingId).get()).data()!;
    await notifyBookingEvent({
      userId: booking.customerUid,
      bookingId: offer.bookingId,
      template: 'assignment_confirmed',
      title: 'Chauffeur assigned',
      body: 'Your chauffeur and vehicle are confirmed.',
      critical: true,
    });

    logInfo('assignment_confirmed', { assignmentId, offerId: cmd.offerId });
    return {
      assignmentId,
      analyticsHint: 'assignment_confirmed',
    };
  });
});

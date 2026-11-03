import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { ConfirmBookingCommandSchema } from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requirePermission,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { isExpired, nowIso } from '../util/time';
import { logInfo } from '../util/logger';
import { enqueueDispatch } from '../dispatch/enqueueDispatch';
import { notifyBookingEvent } from '../notifications/adapter';


export const confirmBooking = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'booking:create');

    const parsed = ConfirmBookingCommandSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;

    return withIdempotency(
      cmd.idempotencyKey,
      'confirmBooking',
      ctx.uid,
      async () => {
        const bookingId = newId('bkg');

        await db.runTransaction(async (tx) => {
          const quoteRef = db.collection('quotes').doc(cmd.quoteId);
          const paymentRef = db.collection('payments').doc(cmd.paymentId);
          const quoteSnap = await tx.get(quoteRef);
          const paymentSnap = await tx.get(paymentRef);

          if (!quoteSnap.exists) throw new HttpsError('not-found', 'Quote not found');
          if (!paymentSnap.exists) {
            throw new HttpsError('not-found', 'Payment not found');
          }

          const quote = quoteSnap.data()!;
          const payment = paymentSnap.data()!;

          if (quote.customerUid !== ctx.uid) {
            throw new HttpsError('permission-denied', 'Not your quote');
          }
          if (payment.customerUid !== ctx.uid) {
            throw new HttpsError('permission-denied', 'Not your payment');
          }
          if (payment.quoteId !== cmd.quoteId) {
            throw new HttpsError('failed-precondition', 'Payment/quote mismatch');
          }
          if (payment.state !== 'AUTHORIZED') {
            throw new HttpsError(
              'failed-precondition',
              'Payment not authorized',
            );
          }
          if (quote.redemptionState !== 'OPEN') {
            throw new HttpsError('failed-precondition', 'Quote not open');
          }
          if (isExpired(quote.expiresAt)) {
            tx.update(quoteRef, { redemptionState: 'EXPIRED' });
            throw new HttpsError('failed-precondition', 'Quote expired');
          }

          const now = nowIso();
          const booking = {
            bookingId,
            customerUid: quote.customerUid,
            bookerUid: cmd.bookerUid,
            passengerProfileId: cmd.passengerProfileId ?? null,
            source: 'CUSTOMER',
            marketId: quote.marketId,
            itinerary: quote.itinerary,
            tripContext: quote.tripContext,
            scheduledAt: quote.scheduledAt ?? null,
            passengers: quote.fit.passengers,
            luggage: quote.fit.luggage,
            classId: quote.selectedClass,
            addons: quote.addons ?? [],
            priceKind: quote.priceKind,
            customerPriceMinor: quote.totalMinor,
            driverPayoutMinor: quote.driverPayoutMinor,
            currency: quote.currency,
            quoteId: cmd.quoteId,
            currentStatus: 'ASSIGNMENT_PENDING',
            statusVersion: 1,
            assignmentId: null,
            assignedDriverId: null,
            riskState: 'NORMAL',
            paymentStatus: 'AUTHORIZED',
            incidentStatus: 'NONE',
            cancellationActor: null,
            airport: quote.airport ?? null,
            fleetCompanyId: null,
            travelAgencyId: null,
            assuranceStatus: 'SECURING_VEHICLE',
            createdAt: now,
            updatedAt: now,
          };

          const eventId = newId('evt');
          tx.set(db.collection('bookings').doc(bookingId), booking);
          tx.set(
            db
              .collection('bookings')
              .doc(bookingId)
              .collection('events')
              .doc(eventId),
            {
              eventId,
              bookingId,
              type: 'BOOKING_CREATED',
              actorUid: ctx.uid,
              actorRole: 'CUSTOMER',
              timestamp: now,
              source: 'CUSTOMER_APP',
              previousStatus: 'PAYMENT_AUTHORIZED',
              nextStatus: 'ASSIGNMENT_PENDING',
              reason: 'Customer confirmed booking after authorization',
              idempotencyKey: cmd.idempotencyKey,
            },
          );
          tx.update(quoteRef, { redemptionState: 'REDEEMED' });
          tx.update(paymentRef, {
            bookingId,
            updatedAt: now,
          });
          tx.set(db.collection('audit_logs').doc(newId('aud')), {
            auditId: newId('aud'),
            actorUid: ctx.uid,
            actorRole: 'CUSTOMER',
            marketId: quote.marketId,
            action: 'booking.confirm',
            entityType: 'booking',
            entityId: bookingId,
            bookingId,
            timestamp: now,
          });
        });

        await enqueueDispatch(bookingId);
        await notifyBookingEvent({
          userId: ctx.uid,
          bookingId,
          template: 'booking_created',
          title: 'Journey received',
          body: 'We are securing your vehicle.',
          critical: true,
        });

        logInfo('booking_created', { bookingId, quoteId: cmd.quoteId });
        return {
          bookingId,
          currentStatus: 'ASSIGNMENT_PENDING',
          assuranceStatus: 'SECURING_VEHICLE',
          analyticsHint: 'booking_created',
        };
      },
    );
  },
);

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { CreateQuoteCommandSchema } from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requirePermission,
  withIdempotency,
} from '../security/guards';
import { nowIso } from '../util/time';
import { newId } from '../util/ids';

/**
 * Customer-requested itinerary/requirements change: requires a new server quote
 * and explicit confirmation — never silent reprice of fixed journeys.
 */
export const requestBookingChange = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'booking:create');

    const { bookingId, idempotencyKey, change } = request.data as {
      bookingId: string;
      idempotencyKey: string;
      change: unknown;
    };

    return withIdempotency(
      idempotencyKey,
      'requestBookingChange',
      ctx.uid,
      async () => {
        const bookingSnap = await db.collection('bookings').doc(bookingId).get();
        if (!bookingSnap.exists) {
          throw new HttpsError('not-found', 'Booking not found');
        }
        const booking = bookingSnap.data()!;
        if (
          booking.customerUid !== ctx.uid &&
          booking.bookerUid !== ctx.uid &&
          !ctx.roles.some((r) => r.startsWith('ADMIN_'))
        ) {
          throw new HttpsError('permission-denied', 'Not your booking');
        }
        if (
          ['CUSTOMER_CANCELLED', 'PAYMENT_CAPTURED', 'COMPLETED'].includes(
            booking.currentStatus,
          )
        ) {
          throw new HttpsError(
            'failed-precondition',
            'Booking cannot be changed in current status',
          );
        }

        const parsed = CreateQuoteCommandSchema.safeParse({
          ...(change as object),
          idempotencyKey: `${idempotencyKey}_quote`,
          marketId: booking.marketId,
          customerUid: booking.customerUid,
        });
        if (!parsed.success) {
          throw new HttpsError('invalid-argument', parsed.error.message);
        }

        // Invalidate prior open quotes for this customer itinerary change
        const now = nowIso();
        const changeId = newId('chg');
        await db.collection('bookings').doc(bookingId).update({
          pendingChangeId: changeId,
          pendingChange: parsed.data,
          updatedAt: now,
        });
        await db
          .collection('bookings')
          .doc(bookingId)
          .collection('events')
          .doc(newId('evt'))
          .set({
            type: 'CHANGE_REQUESTED',
            actorUid: ctx.uid,
            timestamp: now,
            source: 'CUSTOMER_APP',
            reason: 'Customer requested modification — new quote required',
            idempotencyKey,
            payload: { changeId },
          });

        return {
          changeId,
          requiresNewQuote: true,
          message:
            'Create and confirm a new quote before the change is committed. Fixed price is not silently altered.',
        };
      },
    );
  },
);

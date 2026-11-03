import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  TripLifecycleCommandSchema,
  assertBookingTransition,
  BookingStatus,
} from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { getPaymentAdapter } from '../payments/adapter';
import { logInfo } from '../util/logger';

const ACTION_STATUS: Record<
  string,
  { to: BookingStatus; event: string; analytics?: string }
> = {
  EN_ROUTE: {
    to: 'DRIVER_EN_ROUTE',
    event: 'DRIVER_EN_ROUTE',
    analytics: 'driver_en_route',
  },
  ARRIVED: {
    to: 'DRIVER_ARRIVED',
    event: 'DRIVER_ARRIVED',
    analytics: 'driver_arrived',
  },
  START_WAIT: { to: 'WAITING', event: 'WAITING_STARTED' },
  PASSENGER_ONBOARD: {
    to: 'PASSENGER_ONBOARD',
    event: 'PASSENGER_ONBOARD',
    analytics: 'passenger_onboard',
  },
  START_TRIP: { to: 'IN_PROGRESS', event: 'TRIP_STARTED' },
  COMPLETE: {
    to: 'COMPLETED',
    event: 'TRIP_COMPLETED',
    analytics: 'trip_completed',
  },
};

export const tripLifecycle = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const parsed = TripLifecycleCommandSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;

    return withIdempotency(
      cmd.idempotencyKey,
      `trip_${cmd.action}`,
      ctx.uid,
      async () => {
        if (cmd.action === 'CONTACT_ATTEMPT') {
          const ref = db.collection('bookings').doc(cmd.bookingId);
          const snap = await ref.get();
          if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
          const b = snap.data()!;
          if (b.assignedDriverId !== ctx.uid) {
            throw new HttpsError('permission-denied', 'Not assigned driver');
          }
          const eventId = newId('evt');
          await ref.collection('events').doc(eventId).set({
            eventId,
            bookingId: cmd.bookingId,
            type: 'CONTACT_ATTEMPT',
            actorUid: ctx.uid,
            timestamp: nowIso(),
            source: 'DRIVER_APP',
            idempotencyKey: cmd.idempotencyKey,
            location: cmd.location ?? null,
          });
          return { ok: true };
        }

        if (cmd.action === 'PASSENGER_NO_SHOW') {
          return handleNoShow(ctx.uid, cmd);
        }

        const mapping = ACTION_STATUS[cmd.action];
        if (!mapping) {
          throw new HttpsError('invalid-argument', 'Unknown action');
        }

        let analyticsHint: string | undefined;

        await db.runTransaction(async (tx) => {
          const bookingRef = db.collection('bookings').doc(cmd.bookingId);
          const snap = await tx.get(bookingRef);
          if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
          const booking = snap.data()!;

          if (booking.assignedDriverId !== ctx.uid) {
            throw new HttpsError('permission-denied', 'Not assigned driver');
          }
          if (
            cmd.expectedStatusVersion != null &&
            booking.statusVersion !== cmd.expectedStatusVersion
          ) {
            throw new HttpsError('aborted', 'Version conflict');
          }

          // Trip start / movement requires eligible approved vehicle
          if (
            ['EN_ROUTE', 'START_TRIP', 'PASSENGER_ONBOARD'].includes(cmd.action)
          ) {
            const vSnap = await tx.get(
              db.collection('vehicles').doc(booking.assignedVehicleId),
            );
            const v = vSnap.data();
            if (!v || v.status !== 'APPROVED' || !v.documentEligibilityOk) {
              throw new HttpsError(
                'failed-precondition',
                'Ineligible vehicle blocked at trip action',
              );
            }
            const dSnap = await tx.get(db.collection('drivers').doc(ctx.uid));
            if (!dSnap.data() || dSnap.data()!.status !== 'ACTIVE') {
              throw new HttpsError(
                'failed-precondition',
                'Driver not ACTIVE',
              );
            }
          }

          assertBookingTransition(
            booking.currentStatus as BookingStatus,
            mapping.to,
          );

          const now = nowIso();
          const waitingStartedAt =
            mapping.to === 'WAITING' || mapping.to === 'DRIVER_ARRIVED'
              ? booking.waitingStartedAt ?? now
              : booking.waitingStartedAt ?? null;

          tx.update(bookingRef, {
            currentStatus: mapping.to,
            statusVersion: (booking.statusVersion ?? 0) + 1,
            updatedAt: now,
            waitingStartedAt:
              mapping.to === 'DRIVER_ARRIVED' ? now : waitingStartedAt,
            ...(mapping.to === 'WAITING'
              ? { waitingStartedAt: booking.waitingStartedAt ?? now }
              : {}),
          });

          const eventId = newId('evt');
          tx.set(bookingRef.collection('events').doc(eventId), {
            eventId,
            bookingId: cmd.bookingId,
            type: mapping.event,
            actorUid: ctx.uid,
            actorRole: 'DRIVER',
            timestamp: now,
            source: 'DRIVER_APP',
            previousStatus: booking.currentStatus,
            nextStatus: mapping.to,
            idempotencyKey: cmd.idempotencyKey,
            location: cmd.location ?? null,
            evidenceRef: cmd.evidenceRef,
          });

          analyticsHint = mapping.analytics;
        });

        if (cmd.action === 'COMPLETE') {
          await captureAfterComplete(cmd.bookingId, cmd.idempotencyKey);
        }

        logInfo('trip_lifecycle', {
          bookingId: cmd.bookingId,
          action: cmd.action,
        });
        return { ok: true, analyticsHint };
      },
    );
  },
);

async function handleNoShow(
  uid: string,
  cmd: { bookingId: string; idempotencyKey: string; location?: unknown },
) {
  await db.runTransaction(async (tx) => {
    const bookingRef = db.collection('bookings').doc(cmd.bookingId);
    const snap = await tx.get(bookingRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
    const booking = snap.data()!;
    if (booking.assignedDriverId !== uid) {
      throw new HttpsError('permission-denied', 'Not assigned driver');
    }
    const waitingStartedAt = booking.waitingStartedAt
      ? new Date(booking.waitingStartedAt).getTime()
      : 0;
    const minWaitMs = 10 * 60_000; // policy default — configurable later
    if (!waitingStartedAt || Date.now() - waitingStartedAt < minWaitMs) {
      throw new HttpsError(
        'failed-precondition',
        'No-show locked until minimum wait after authoritative arrival',
      );
    }

    // Require at least one contact attempt event
    const contacts = await tx.get(
      bookingRef.collection('events').where('type', '==', 'CONTACT_ATTEMPT').limit(1),
    );
    // Note: txn get on query may be limited in some environments; also check count field
    const contactCount = booking.contactAttemptCount ?? contacts.size;
    if (contactCount < 1) {
      throw new HttpsError(
        'failed-precondition',
        'No-show requires logged contact attempts',
      );
    }

    assertBookingTransition(
      booking.currentStatus as BookingStatus,
      'PASSENGER_NO_SHOW',
    );
    const now = nowIso();
    tx.update(bookingRef, {
      currentStatus: 'PASSENGER_NO_SHOW',
      statusVersion: (booking.statusVersion ?? 0) + 1,
      updatedAt: now,
    });
    const eventId = newId('evt');
    tx.set(bookingRef.collection('events').doc(eventId), {
      eventId,
      bookingId: cmd.bookingId,
      type: 'PASSENGER_NO_SHOW',
      actorUid: uid,
      timestamp: now,
      source: 'DRIVER_APP',
      previousStatus: booking.currentStatus,
      nextStatus: 'PASSENGER_NO_SHOW',
      idempotencyKey: cmd.idempotencyKey,
      location: cmd.location ?? null,
    });
  });
  return { ok: true };
}

async function captureAfterComplete(
  bookingId: string,
  idempotencyKey: string,
): Promise<void> {
  const payments = await db
    .collection('payments')
    .where('bookingId', '==', bookingId)
    .limit(1)
    .get();
  if (payments.empty) return;
  const paymentDoc = payments.docs[0];
  const payment = paymentDoc.data();
  if (payment.state === 'CAPTURED') return;
  if (payment.paymentMode === 'stripe' && payment.liveCharge) {
    // Live path when configured
  }
  const adapter = getPaymentAdapter();
  const captured = await adapter.capture(
    payment.providerIntentId,
    `${idempotencyKey}_capture`,
  );
  const now = nowIso();
  await db.runTransaction(async (tx) => {
    const bookingRef = db.collection('bookings').doc(bookingId);
    const b = await tx.get(bookingRef);
    if (!b.exists) return;
    const booking = b.data()!;
    if (booking.currentStatus === 'COMPLETED') {
      assertBookingTransition('COMPLETED', 'PAYMENT_CAPTURED');
      tx.update(bookingRef, {
        currentStatus: 'PAYMENT_CAPTURED',
        paymentStatus: 'CAPTURED',
        statusVersion: (booking.statusVersion ?? 0) + 1,
        updatedAt: now,
      });
    } else {
      tx.update(bookingRef, { paymentStatus: 'CAPTURED', updatedAt: now });
    }
    tx.update(paymentDoc.ref, {
      state: captured.state,
      updatedAt: now,
      lastProviderEvent: 'capture',
    });
    // Driver payout ledger entry (manual settle if no provider)
    const ledgerId = newId('pl');
    tx.set(db.collection('payout_ledger').doc(ledgerId), {
      ledgerId,
      driverId: booking.assignedDriverId,
      bookingId,
      amountMinor: booking.driverPayoutMinor,
      currency: booking.currency,
      status: 'PENDING_MANUAL_SETTLEMENT',
      notice:
        'Payout recorded in ledger. Direct transfer only when payout provider configured.',
      createdAt: now,
    });
  });
  logInfo('payment_captured', { bookingId, mode: payment.paymentMode });
}

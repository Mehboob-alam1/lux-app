import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  DriverCancelAssignmentCommandSchema,
  statusAfterDriverCancel,
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
import { enqueueDispatch } from './enqueueDispatch';
import { logInfo } from '../util/logger';

/**
 * Driver cancellation NEVER deletes/cancels the customer booking.
 * Assignment is cancelled; booking moves to REASSIGNING and redispatched.
 */
export const driverCancelAssignment = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const parsed = DriverCancelAssignmentCommandSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;

    return withIdempotency(
      cmd.idempotencyKey,
      'driverCancelAssignment',
      ctx.uid,
      async () => {
        await db.runTransaction(async (tx) => {
          const bookingRef = db.collection('bookings').doc(cmd.bookingId);
          const snap = await tx.get(bookingRef);
          if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
          const booking = snap.data()!;
          if (booking.assignedDriverId !== ctx.uid) {
            throw new HttpsError('permission-denied', 'Not your assignment');
          }
          if (booking.assignmentId !== cmd.assignmentId) {
            throw new HttpsError('failed-precondition', 'Assignment mismatch');
          }

          const next = statusAfterDriverCancel(
            booking.currentStatus as BookingStatus,
          );
          const now = nowIso();
          const assignmentRef = db
            .collection('assignments')
            .doc(cmd.assignmentId);
          tx.update(assignmentRef, {
            status: 'CANCELLED',
            releasedAt: now,
            cancelKind: cmd.kind,
            cancelReason: cmd.reason,
          });
          tx.update(bookingRef, {
            currentStatus: next,
            statusVersion: (booking.statusVersion ?? 0) + 1,
            assignmentId: null,
            assignedDriverId: null,
            assignedVehicleId: null,
            cancellationActor: null, // customer booking not cancelled
            lastDriverCancelReason: cmd.reason,
            riskState: 'RESCUE',
            assuranceStatus: 'SECURING_VEHICLE',
            updatedAt: now,
          });
          const eventId = newId('evt');
          tx.set(bookingRef.collection('events').doc(eventId), {
            eventId,
            bookingId: cmd.bookingId,
            type: 'DRIVER_CANCELLED',
            actorUid: ctx.uid,
            actorRole: 'DRIVER',
            timestamp: now,
            source: 'DRIVER_APP',
            previousStatus: booking.currentStatus,
            nextStatus: next,
            reason: cmd.reason,
            idempotencyKey: cmd.idempotencyKey,
            evidenceRef: cmd.evidenceRef,
            payload: { kind: cmd.kind, assignmentId: cmd.assignmentId },
          });
          tx.set(db.collection('rescue_cases').doc(newId('rsc')), {
            bookingId: cmd.bookingId,
            status: 'OPEN',
            reason: cmd.reason,
            kind: cmd.kind,
            originalCustomerPriceMinor: booking.customerPriceMinor,
            createdAt: now,
          });
          tx.set(db.collection('operational_alerts').doc(newId('alert')), {
            marketId: booking.marketId,
            bookingId: cmd.bookingId,
            health: 'RESCUE',
            type: 'DRIVER_CANCEL_REASSIGN',
            createdAt: now,
          });
        });

        await enqueueDispatch(cmd.bookingId);
        logInfo('rescue_started', { bookingId: cmd.bookingId });
        return {
          currentStatus: 'REASSIGNING',
          sameBookingId: cmd.bookingId,
          analyticsHint: 'rescue_started',
        };
      },
    );
  },
);

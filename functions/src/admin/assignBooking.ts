import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AdminAssignCommandSchema } from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requireMarketScope,
  requirePermission,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

export const adminAssignBooking = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'booking:assign');

    const parsed = AdminAssignCommandSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    requireMarketScope(ctx, cmd.marketId);

    return withIdempotency(
      cmd.idempotencyKey,
      'adminAssignBooking',
      ctx.uid,
      async () => {
        const assignmentId = newId('asn');
        await db.runTransaction(async (tx) => {
          const bookingRef = db.collection('bookings').doc(cmd.bookingId);
          const snap = await tx.get(bookingRef);
          if (!snap.exists) throw new HttpsError('not-found', 'Booking not found');
          const booking = snap.data()!;

          const driverSnap = await tx.get(db.collection('drivers').doc(cmd.driverId));
          const vehicleSnap = await tx.get(
            db.collection('vehicles').doc(cmd.vehicleId),
          );
          const driver = driverSnap.data();
          const vehicle = vehicleSnap.data();
          if (!driver || driver.status !== 'ACTIVE') {
            throw new HttpsError('failed-precondition', 'Driver ineligible');
          }
          if (
            !vehicle ||
            vehicle.status !== 'APPROVED' ||
            !vehicle.documentEligibilityOk
          ) {
            throw new HttpsError('failed-precondition', 'Vehicle ineligible');
          }
          if (!(vehicle.classIds ?? []).includes(booking.classId)) {
            if (!cmd.allowUpgradeComplimentary) {
              throw new HttpsError(
                'failed-precondition',
                'Class mismatch — complimentary upgrade requires flag + audit',
              );
            }
            // Platform upgrade must not increase customer price
          }

          const now = nowIso();
          tx.set(db.collection('assignments').doc(assignmentId), {
            assignmentId,
            bookingId: cmd.bookingId,
            driverId: cmd.driverId,
            vehicleId: cmd.vehicleId,
            status: 'ACCEPTED',
            offeredAt: now,
            acceptedAt: now,
            eligibilitySnapshot: {
              adminOverride: true,
              reason: cmd.reason,
            },
            version: 1,
            payoutQuoteMinor: booking.driverPayoutMinor,
            currency: booking.currency,
          });
          tx.update(bookingRef, {
            currentStatus: 'ASSIGNED',
            statusVersion: (booking.statusVersion ?? 0) + 1,
            assignmentId,
            assignedDriverId: cmd.driverId,
            assignedVehicleId: cmd.vehicleId,
            // Price protection: never bump customerPriceMinor on platform upgrade
            customerPriceMinor: booking.customerPriceMinor,
            assuranceStatus: 'CONFIRMED',
            riskState: 'NORMAL',
            updatedAt: now,
          });
          tx.set(bookingRef.collection('events').doc(newId('evt')), {
            type: 'ADMIN_ASSIGNMENT',
            actorUid: ctx.uid,
            actorRole: ctx.roles[0],
            timestamp: now,
            source: 'ADMIN',
            previousStatus: booking.currentStatus,
            nextStatus: 'ASSIGNED',
            reason: cmd.reason,
            idempotencyKey: cmd.idempotencyKey,
          });
          tx.set(db.collection('audit_logs').doc(newId('aud')), {
            actorUid: ctx.uid,
            actorRole: ctx.roles[0],
            marketId: cmd.marketId,
            action: 'booking.admin_assign',
            entityType: 'booking',
            entityId: cmd.bookingId,
            reason: cmd.reason,
            bookingId: cmd.bookingId,
            timestamp: now,
          });
        });
        logInfo('admin_assign', { bookingId: cmd.bookingId });
        return { assignmentId };
      },
    );
  },
);

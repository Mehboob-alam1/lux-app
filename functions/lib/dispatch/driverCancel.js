"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.driverCancelAssignment = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const enqueueDispatch_1 = require("./enqueueDispatch");
const logger_1 = require("../util/logger");
/**
 * Driver cancellation NEVER deletes/cancels the customer booking.
 * Assignment is cancelled; booking moves to REASSIGNING and redispatched.
 */
exports.driverCancelAssignment = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const parsed = contracts_1.DriverCancelAssignmentCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, 'driverCancelAssignment', ctx.uid, async () => {
        await firebase_1.db.runTransaction(async (tx) => {
            const bookingRef = firebase_1.db.collection('bookings').doc(cmd.bookingId);
            const snap = await tx.get(bookingRef);
            if (!snap.exists)
                throw new https_1.HttpsError('not-found', 'Booking not found');
            const booking = snap.data();
            if (booking.assignedDriverId !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Not your assignment');
            }
            if (booking.assignmentId !== cmd.assignmentId) {
                throw new https_1.HttpsError('failed-precondition', 'Assignment mismatch');
            }
            const next = (0, contracts_1.statusAfterDriverCancel)(booking.currentStatus);
            const now = (0, time_1.nowIso)();
            const assignmentRef = firebase_1.db
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
            const eventId = (0, ids_1.newId)('evt');
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
            tx.set(firebase_1.db.collection('rescue_cases').doc((0, ids_1.newId)('rsc')), {
                bookingId: cmd.bookingId,
                status: 'OPEN',
                reason: cmd.reason,
                kind: cmd.kind,
                originalCustomerPriceMinor: booking.customerPriceMinor,
                createdAt: now,
            });
            tx.set(firebase_1.db.collection('operational_alerts').doc((0, ids_1.newId)('alert')), {
                marketId: booking.marketId,
                bookingId: cmd.bookingId,
                health: 'RESCUE',
                type: 'DRIVER_CANCEL_REASSIGN',
                createdAt: now,
            });
        });
        await (0, enqueueDispatch_1.enqueueDispatch)(cmd.bookingId);
        (0, logger_1.logInfo)('rescue_started', { bookingId: cmd.bookingId });
        return {
            currentStatus: 'REASSIGNING',
            sameBookingId: cmd.bookingId,
            analyticsHint: 'rescue_started',
        };
    });
});
//# sourceMappingURL=driverCancel.js.map
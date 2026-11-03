"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminAssignBooking = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
exports.adminAssignBooking = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'booking:assign');
    const parsed = contracts_1.AdminAssignCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    (0, guards_1.requireMarketScope)(ctx, cmd.marketId);
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, 'adminAssignBooking', ctx.uid, async () => {
        const assignmentId = (0, ids_1.newId)('asn');
        await firebase_1.db.runTransaction(async (tx) => {
            const bookingRef = firebase_1.db.collection('bookings').doc(cmd.bookingId);
            const snap = await tx.get(bookingRef);
            if (!snap.exists)
                throw new https_1.HttpsError('not-found', 'Booking not found');
            const booking = snap.data();
            const driverSnap = await tx.get(firebase_1.db.collection('drivers').doc(cmd.driverId));
            const vehicleSnap = await tx.get(firebase_1.db.collection('vehicles').doc(cmd.vehicleId));
            const driver = driverSnap.data();
            const vehicle = vehicleSnap.data();
            if (!driver || driver.status !== 'ACTIVE') {
                throw new https_1.HttpsError('failed-precondition', 'Driver ineligible');
            }
            if (!vehicle ||
                vehicle.status !== 'APPROVED' ||
                !vehicle.documentEligibilityOk) {
                throw new https_1.HttpsError('failed-precondition', 'Vehicle ineligible');
            }
            if (!(vehicle.classIds ?? []).includes(booking.classId)) {
                if (!cmd.allowUpgradeComplimentary) {
                    throw new https_1.HttpsError('failed-precondition', 'Class mismatch — complimentary upgrade requires flag + audit');
                }
                // Platform upgrade must not increase customer price
            }
            const now = (0, time_1.nowIso)();
            tx.set(firebase_1.db.collection('assignments').doc(assignmentId), {
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
            tx.set(bookingRef.collection('events').doc((0, ids_1.newId)('evt')), {
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
            tx.set(firebase_1.db.collection('audit_logs').doc((0, ids_1.newId)('aud')), {
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
        (0, logger_1.logInfo)('admin_assign', { bookingId: cmd.bookingId });
        return { assignmentId };
    });
});
//# sourceMappingURL=assignBooking.js.map
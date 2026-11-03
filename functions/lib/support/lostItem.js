"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateLostItemStatus = exports.reportLostItem = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
exports.reportLostItem = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const { bookingId, description, idempotencyKey } = request.data;
    return (0, guards_1.withIdempotency)(idempotencyKey, 'reportLostItem', ctx.uid, async () => {
        const b = await firebase_1.db.collection('bookings').doc(bookingId).get();
        if (!b.exists)
            throw new https_1.HttpsError('not-found', 'Booking not found');
        const booking = b.data();
        if (booking.customerUid !== ctx.uid &&
            booking.bookerUid !== ctx.uid &&
            !ctx.roles.some((r) => r.startsWith('ADMIN_'))) {
            throw new https_1.HttpsError('permission-denied', 'Not your booking');
        }
        const id = (0, ids_1.newId)('lost');
        const now = (0, time_1.nowIso)();
        await firebase_1.db.collection('lost_items').doc(id).set({
            lostItemId: id,
            bookingId,
            reporterUid: ctx.uid,
            driverId: booking.assignedDriverId ?? null,
            vehicleId: booking.assignedVehicleId ?? null,
            description,
            status: 'REPORTED',
            createdAt: now,
            updatedAt: now,
        });
        return { lostItemId: id, status: 'REPORTED' };
    });
});
exports.updateLostItemStatus = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    if (!ctx.roles.some((r) => ['ADMIN_SUPPORT', 'ADMIN_SUPER', 'ADMIN_OPERATIONS', 'DRIVER'].includes(r))) {
        throw new https_1.HttpsError('permission-denied', 'Not allowed');
    }
    const { lostItemId, status } = request.data;
    const parsed = contracts_1.LostItemStatusSchema.safeParse(status);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', 'Invalid lost item status');
    }
    await firebase_1.db.collection('lost_items').doc(lostItemId).update({
        status: parsed.data,
        updatedAt: (0, time_1.nowIso)(),
        lastActorUid: ctx.uid,
    });
    return { lostItemId, status: parsed.data };
});
//# sourceMappingURL=lostItem.js.map
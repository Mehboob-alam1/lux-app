"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestBookingChange = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const ids_1 = require("../util/ids");
/**
 * Customer-requested itinerary/requirements change: requires a new server quote
 * and explicit confirmation — never silent reprice of fixed journeys.
 */
exports.requestBookingChange = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'booking:create');
    const { bookingId, idempotencyKey, change } = request.data;
    return (0, guards_1.withIdempotency)(idempotencyKey, 'requestBookingChange', ctx.uid, async () => {
        const bookingSnap = await firebase_1.db.collection('bookings').doc(bookingId).get();
        if (!bookingSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Booking not found');
        }
        const booking = bookingSnap.data();
        if (booking.customerUid !== ctx.uid &&
            booking.bookerUid !== ctx.uid &&
            !ctx.roles.some((r) => r.startsWith('ADMIN_'))) {
            throw new https_1.HttpsError('permission-denied', 'Not your booking');
        }
        if (['CUSTOMER_CANCELLED', 'PAYMENT_CAPTURED', 'COMPLETED'].includes(booking.currentStatus)) {
            throw new https_1.HttpsError('failed-precondition', 'Booking cannot be changed in current status');
        }
        const parsed = contracts_1.CreateQuoteCommandSchema.safeParse({
            ...change,
            idempotencyKey: `${idempotencyKey}_quote`,
            marketId: booking.marketId,
            customerUid: booking.customerUid,
        });
        if (!parsed.success) {
            throw new https_1.HttpsError('invalid-argument', parsed.error.message);
        }
        // Invalidate prior open quotes for this customer itinerary change
        const now = (0, time_1.nowIso)();
        const changeId = (0, ids_1.newId)('chg');
        await firebase_1.db.collection('bookings').doc(bookingId).update({
            pendingChangeId: changeId,
            pendingChange: parsed.data,
            updatedAt: now,
        });
        await firebase_1.db
            .collection('bookings')
            .doc(bookingId)
            .collection('events')
            .doc((0, ids_1.newId)('evt'))
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
            message: 'Create and confirm a new quote before the change is committed. Fixed price is not silently altered.',
        };
    });
});
//# sourceMappingURL=requoteChange.js.map
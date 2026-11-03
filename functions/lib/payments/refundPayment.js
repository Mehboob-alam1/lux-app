"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.refundPayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const adapter_1 = require("./adapter");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
exports.refundPayment = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'payment:refund');
    const { paymentId, amountMinor, reason, idempotencyKey, marketId, } = request.data;
    if (!paymentId || !amountMinor || !reason || !idempotencyKey) {
        throw new https_1.HttpsError('invalid-argument', 'Missing fields');
    }
    return (0, guards_1.withIdempotency)(idempotencyKey, 'refundPayment', ctx.uid, async () => {
        const payRef = firebase_1.db.collection('payments').doc(paymentId);
        const paySnap = await payRef.get();
        if (!paySnap.exists)
            throw new https_1.HttpsError('not-found', 'Payment not found');
        const payment = paySnap.data();
        if (payment.state !== 'CAPTURED' && payment.state !== 'AUTHORIZED') {
            throw new https_1.HttpsError('failed-precondition', `Cannot refund from state ${payment.state}`);
        }
        if (amountMinor > payment.amountMinor) {
            throw new https_1.HttpsError('invalid-argument', 'Refund exceeds capture');
        }
        const adapter = (0, adapter_1.getPaymentAdapter)();
        const result = await adapter.refund({
            providerIntentId: payment.providerIntentId,
            amountMinor,
            idempotencyKey,
        });
        if (result.state !== 'SUCCEEDED') {
            throw new https_1.HttpsError('aborted', 'Refund failed at provider');
        }
        const refundId = (0, ids_1.newId)('ref');
        const now = (0, time_1.nowIso)();
        const partial = amountMinor < payment.amountMinor;
        await firebase_1.db.collection('refunds').doc(refundId).set({
            refundId,
            paymentId,
            bookingId: payment.bookingId,
            customerUid: payment.customerUid,
            amountMinor,
            currency: payment.currency,
            reason,
            providerRefundId: result.refundId,
            paymentMode: (0, adapter_1.paymentModeLabel)(),
            createdAt: now,
            actorUid: ctx.uid,
        });
        await payRef.update({
            state: partial ? 'CAPTURED' : 'CANCELLED',
            lastProviderEvent: 'refund',
            updatedAt: now,
        });
        if (payment.bookingId) {
            await firebase_1.db.collection('bookings').doc(payment.bookingId).update({
                paymentStatus: partial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
                updatedAt: now,
            });
            await firebase_1.db
                .collection('bookings')
                .doc(payment.bookingId)
                .collection('events')
                .doc((0, ids_1.newId)('evt'))
                .set({
                type: 'REFUND_ISSUED',
                actorUid: ctx.uid,
                timestamp: now,
                source: 'ADMIN',
                reason,
                idempotencyKey,
                payload: { refundId, amountMinor },
            });
        }
        await firebase_1.db.collection('audit_logs').doc((0, ids_1.newId)('aud')).set({
            actorUid: ctx.uid,
            actorRole: ctx.roles[0],
            marketId,
            action: 'payment.refund',
            entityType: 'payment',
            entityId: paymentId,
            reason,
            bookingId: payment.bookingId,
            timestamp: now,
        });
        (0, logger_1.logInfo)('refund_issued', { refundId, amountMinor });
        return { refundId, amountMinor, partial };
    });
});
//# sourceMappingURL=refundPayment.js.map
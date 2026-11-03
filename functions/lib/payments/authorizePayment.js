"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authorizePayment = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const adapter_1 = require("./adapter");
const logger_1 = require("../util/logger");
exports.authorizePayment = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'payment:authorize');
    const parsed = contracts_1.AuthorizePaymentCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, 'authorizePayment', ctx.uid, async () => {
        const quoteRef = firebase_1.db.collection('quotes').doc(cmd.quoteId);
        const quoteSnap = await quoteRef.get();
        if (!quoteSnap.exists) {
            throw new https_1.HttpsError('not-found', 'Quote not found');
        }
        const quote = quoteSnap.data();
        if (quote.customerUid !== ctx.uid) {
            throw new https_1.HttpsError('permission-denied', 'Not your quote');
        }
        if (quote.redemptionState !== 'OPEN') {
            throw new https_1.HttpsError('failed-precondition', 'Quote not redeemable');
        }
        if ((0, time_1.isExpired)(quote.expiresAt)) {
            await quoteRef.update({ redemptionState: 'EXPIRED' });
            throw new https_1.HttpsError('failed-precondition', 'Quote expired');
        }
        const adapter = (0, adapter_1.getPaymentAdapter)();
        const intent = await adapter.createAuthorization({
            amountMinor: quote.totalMinor,
            currency: quote.currency,
            paymentMethodToken: cmd.paymentMethodToken,
            idempotencyKey: cmd.idempotencyKey,
            metadata: { quoteId: cmd.quoteId, marketId: cmd.marketId },
        });
        const paymentId = (0, ids_1.newId)('pay');
        const payment = {
            paymentId,
            bookingId: null,
            customerUid: ctx.uid,
            quoteId: cmd.quoteId,
            provider: intent.provider,
            providerIntentId: intent.providerIntentId,
            state: intent.state,
            amountMinor: intent.amountMinor,
            currency: intent.currency,
            idempotencyKey: cmd.idempotencyKey,
            paymentMode: (0, adapter_1.paymentModeLabel)(),
            liveCharge: (0, adapter_1.paymentModeLabel)() === 'stripe',
            createdAt: (0, time_1.nowIso)(),
            updatedAt: (0, time_1.nowIso)(),
        };
        await firebase_1.db.collection('payments').doc(paymentId).set(payment);
        if (intent.state === 'FAILED') {
            (0, logger_1.logInfo)('payment_failed', { paymentId, quoteId: cmd.quoteId });
            throw new https_1.HttpsError('aborted', 'Payment authorization failed', {
                paymentId,
                paymentMode: (0, adapter_1.paymentModeLabel)(),
            });
        }
        (0, logger_1.logInfo)('payment_authorized', {
            paymentId,
            quoteId: cmd.quoteId,
            mode: (0, adapter_1.paymentModeLabel)(),
        });
        return {
            payment,
            clientSecret: intent.clientSecret,
            analyticsHint: 'payment_authorized',
            notice: (0, adapter_1.paymentModeLabel)() === 'sandbox'
                ? 'SANDBOX: no live card charge. Configure STRIPE_* and PAYMENT_MODE=stripe for production.'
                : undefined,
        };
    });
});
//# sourceMappingURL=authorizePayment.js.map
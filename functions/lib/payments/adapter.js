"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxPaymentAdapter = void 0;
exports.getPaymentAdapter = getPaymentAdapter;
exports.paymentModeLabel = paymentModeLabel;
const firebase_1 = require("../firebase");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
/**
 * Explicit sandbox adapter — never claims live money movement.
 * Intents are persisted in Firestore so authorize/capture survive
 * Cloud Functions cold starts and emulator worker reloads.
 */
class SandboxPaymentAdapter {
    mode = 'sandbox';
    col() {
        return firebase_1.db.collection('sandbox_payment_intents');
    }
    async createAuthorization(input) {
        if (input.paymentMethodToken === 'fail') {
            return {
                provider: 'sandbox',
                providerIntentId: (0, ids_1.newId)('pi_fail'),
                clientSecret: null,
                state: 'FAILED',
                amountMinor: input.amountMinor,
                currency: input.currency,
            };
        }
        const intent = {
            provider: 'sandbox',
            providerIntentId: (0, ids_1.newId)('pi_sandbox'),
            clientSecret: `sandbox_secret_${input.idempotencyKey}`,
            state: 'AUTHORIZED',
            amountMinor: input.amountMinor,
            currency: input.currency,
        };
        await this.col().doc(intent.providerIntentId).set({
            ...intent,
            metadata: input.metadata,
            idempotencyKey: input.idempotencyKey,
            createdAt: (0, time_1.nowIso)(),
            updatedAt: (0, time_1.nowIso)(),
        });
        return intent;
    }
    async capture(providerIntentId, _idempotencyKey) {
        const ref = this.col().doc(providerIntentId);
        const snap = await ref.get();
        if (!snap.exists) {
            // Fallback: reconstruct from payments collection (seeded / prior workers)
            const pay = await firebase_1.db
                .collection('payments')
                .where('providerIntentId', '==', providerIntentId)
                .limit(1)
                .get();
            if (pay.empty) {
                throw new Error('Unknown sandbox payment intent');
            }
            const p = pay.docs[0].data();
            const reconstructed = {
                provider: 'sandbox',
                providerIntentId,
                clientSecret: null,
                state: p.state === 'CAPTURED' ? 'CAPTURED' : 'AUTHORIZED',
                amountMinor: p.amountMinor,
                currency: p.currency,
            };
            if (reconstructed.state === 'CAPTURED')
                return reconstructed;
            const next = { ...reconstructed, state: 'CAPTURED' };
            await ref.set({ ...next, updatedAt: (0, time_1.nowIso)() }, { merge: true });
            return next;
        }
        const existing = snap.data();
        if (existing.state === 'CAPTURED')
            return existing;
        if (existing.state !== 'AUTHORIZED') {
            throw new Error(`Cannot capture from state ${existing.state}`);
        }
        const next = { ...existing, state: 'CAPTURED' };
        await ref.set({ ...next, updatedAt: (0, time_1.nowIso)() }, { merge: true });
        return next;
    }
    async refund(input) {
        const snap = await this.col().doc(input.providerIntentId).get();
        const existing = snap.data();
        if (!existing || existing.state !== 'CAPTURED') {
            return { refundId: (0, ids_1.newId)('re_fail'), state: 'FAILED' };
        }
        return { refundId: (0, ids_1.newId)('re_sandbox'), state: 'SUCCEEDED' };
    }
}
exports.SandboxPaymentAdapter = SandboxPaymentAdapter;
let singleton = null;
function getPaymentAdapter() {
    if (singleton)
        return singleton;
    const mode = process.env.PAYMENT_MODE ?? 'sandbox';
    if (mode === 'stripe') {
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('PAYMENT_MODE=stripe but STRIPE_SECRET_KEY is not configured');
        }
        // Stripe live adapter wired when credentials exist — until then refuse.
        throw new Error('Stripe adapter selected but not fully configured in this environment; use PAYMENT_MODE=sandbox');
    }
    singleton = new SandboxPaymentAdapter();
    return singleton;
}
function paymentModeLabel() {
    return process.env.PAYMENT_MODE ?? 'sandbox';
}
//# sourceMappingURL=adapter.js.map
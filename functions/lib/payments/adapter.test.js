"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const adapter_1 = require("./adapter");
(0, vitest_1.describe)('SandboxPaymentAdapter', () => {
    (0, vitest_1.it)('authorizes and captures without claiming live charge', async () => {
        const adapter = new adapter_1.SandboxPaymentAdapter();
        const auth = await adapter.createAuthorization({
            amountMinor: 5000,
            currency: 'CAD',
            paymentMethodToken: 'tok_ok',
            idempotencyKey: 'idem_1',
            metadata: {},
        });
        (0, vitest_1.expect)(auth.provider).toBe('sandbox');
        (0, vitest_1.expect)(auth.state).toBe('AUTHORIZED');
        const cap = await adapter.capture(auth.providerIntentId, 'idem_1_cap');
        (0, vitest_1.expect)(cap.state).toBe('CAPTURED');
    });
    (0, vitest_1.it)('fails intentionally on fail token', async () => {
        const adapter = new adapter_1.SandboxPaymentAdapter();
        const auth = await adapter.createAuthorization({
            amountMinor: 100,
            currency: 'CAD',
            paymentMethodToken: 'fail',
            idempotencyKey: 'idem_fail',
            metadata: {},
        });
        (0, vitest_1.expect)(auth.state).toBe('FAILED');
    });
    (0, vitest_1.it)('is idempotent on double capture', async () => {
        const adapter = new adapter_1.SandboxPaymentAdapter();
        const auth = await adapter.createAuthorization({
            amountMinor: 1000,
            currency: 'CAD',
            paymentMethodToken: 'tok',
            idempotencyKey: 'idem_2',
            metadata: {},
        });
        await adapter.capture(auth.providerIntentId, 'c1');
        const again = await adapter.capture(auth.providerIntentId, 'c2');
        (0, vitest_1.expect)(again.state).toBe('CAPTURED');
    });
});
//# sourceMappingURL=adapter.test.js.map
import { describe, expect, it } from 'vitest';
import { SandboxPaymentAdapter } from './adapter';

describe('SandboxPaymentAdapter', () => {
  it('authorizes and captures without claiming live charge', async () => {
    const adapter = new SandboxPaymentAdapter();
    const auth = await adapter.createAuthorization({
      amountMinor: 5000,
      currency: 'CAD',
      paymentMethodToken: 'tok_ok',
      idempotencyKey: 'idem_1',
      metadata: {},
    });
    expect(auth.provider).toBe('sandbox');
    expect(auth.state).toBe('AUTHORIZED');
    const cap = await adapter.capture(auth.providerIntentId, 'idem_1_cap');
    expect(cap.state).toBe('CAPTURED');
  });

  it('fails intentionally on fail token', async () => {
    const adapter = new SandboxPaymentAdapter();
    const auth = await adapter.createAuthorization({
      amountMinor: 100,
      currency: 'CAD',
      paymentMethodToken: 'fail',
      idempotencyKey: 'idem_fail',
      metadata: {},
    });
    expect(auth.state).toBe('FAILED');
  });

  it('is idempotent on double capture', async () => {
    const adapter = new SandboxPaymentAdapter();
    const auth = await adapter.createAuthorization({
      amountMinor: 1000,
      currency: 'CAD',
      paymentMethodToken: 'tok',
      idempotencyKey: 'idem_2',
      metadata: {},
    });
    await adapter.capture(auth.providerIntentId, 'c1');
    const again = await adapter.capture(auth.providerIntentId, 'c2');
    expect(again.state).toBe('CAPTURED');
  });
});

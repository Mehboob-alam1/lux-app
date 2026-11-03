import { db } from '../firebase';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';

export type PaymentIntent = {
  provider: 'sandbox' | 'stripe';
  providerIntentId: string;
  clientSecret: string | null;
  state: 'REQUIRES_ACTION' | 'AUTHORIZED' | 'CAPTURED' | 'FAILED' | 'CANCELLED';
  amountMinor: number;
  currency: string;
};

export interface PaymentAdapter {
  readonly mode: 'sandbox' | 'stripe';
  createAuthorization(input: {
    amountMinor: number;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntent>;
  capture(providerIntentId: string, idempotencyKey: string): Promise<PaymentIntent>;
  refund(input: {
    providerIntentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string; state: 'SUCCEEDED' | 'FAILED' }>;
}

/**
 * Explicit sandbox adapter — never claims live money movement.
 * Intents are persisted in Firestore so authorize/capture survive
 * Cloud Functions cold starts and emulator worker reloads.
 */
export class SandboxPaymentAdapter implements PaymentAdapter {
  readonly mode = 'sandbox' as const;

  private col() {
    return db.collection('sandbox_payment_intents');
  }

  async createAuthorization(input: {
    amountMinor: number;
    currency: string;
    paymentMethodToken: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
  }): Promise<PaymentIntent> {
    if (input.paymentMethodToken === 'fail') {
      return {
        provider: 'sandbox',
        providerIntentId: newId('pi_fail'),
        clientSecret: null,
        state: 'FAILED',
        amountMinor: input.amountMinor,
        currency: input.currency,
      };
    }
    const intent: PaymentIntent = {
      provider: 'sandbox',
      providerIntentId: newId('pi_sandbox'),
      clientSecret: `sandbox_secret_${input.idempotencyKey}`,
      state: 'AUTHORIZED',
      amountMinor: input.amountMinor,
      currency: input.currency,
    };
    await this.col().doc(intent.providerIntentId).set({
      ...intent,
      metadata: input.metadata,
      idempotencyKey: input.idempotencyKey,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return intent;
  }

  async capture(
    providerIntentId: string,
    _idempotencyKey: string,
  ): Promise<PaymentIntent> {
    const ref = this.col().doc(providerIntentId);
    const snap = await ref.get();
    if (!snap.exists) {
      // Fallback: reconstruct from payments collection (seeded / prior workers)
      const pay = await db
        .collection('payments')
        .where('providerIntentId', '==', providerIntentId)
        .limit(1)
        .get();
      if (pay.empty) {
        throw new Error('Unknown sandbox payment intent');
      }
      const p = pay.docs[0].data();
      const reconstructed: PaymentIntent = {
        provider: 'sandbox',
        providerIntentId,
        clientSecret: null,
        state: p.state === 'CAPTURED' ? 'CAPTURED' : 'AUTHORIZED',
        amountMinor: p.amountMinor,
        currency: p.currency,
      };
      if (reconstructed.state === 'CAPTURED') return reconstructed;
      const next = { ...reconstructed, state: 'CAPTURED' as const };
      await ref.set({ ...next, updatedAt: nowIso() }, { merge: true });
      return next;
    }
    const existing = snap.data() as PaymentIntent;
    if (existing.state === 'CAPTURED') return existing;
    if (existing.state !== 'AUTHORIZED') {
      throw new Error(`Cannot capture from state ${existing.state}`);
    }
    const next = { ...existing, state: 'CAPTURED' as const };
    await ref.set({ ...next, updatedAt: nowIso() }, { merge: true });
    return next;
  }

  async refund(input: {
    providerIntentId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<{ refundId: string; state: 'SUCCEEDED' | 'FAILED' }> {
    const snap = await this.col().doc(input.providerIntentId).get();
    const existing = snap.data() as PaymentIntent | undefined;
    if (!existing || existing.state !== 'CAPTURED') {
      return { refundId: newId('re_fail'), state: 'FAILED' };
    }
    return { refundId: newId('re_sandbox'), state: 'SUCCEEDED' };
  }
}

let singleton: PaymentAdapter | null = null;

export function getPaymentAdapter(): PaymentAdapter {
  if (singleton) return singleton;
  const mode = process.env.PAYMENT_MODE ?? 'sandbox';
  if (mode === 'stripe') {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error(
        'PAYMENT_MODE=stripe but STRIPE_SECRET_KEY is not configured',
      );
    }
    // Stripe live adapter wired when credentials exist — until then refuse.
    throw new Error(
      'Stripe adapter selected but not fully configured in this environment; use PAYMENT_MODE=sandbox',
    );
  }
  singleton = new SandboxPaymentAdapter();
  return singleton;
}

export function paymentModeLabel(): string {
  return process.env.PAYMENT_MODE ?? 'sandbox';
}

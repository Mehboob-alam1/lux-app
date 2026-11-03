import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { AuthorizePaymentCommandSchema } from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requirePermission,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { isExpired, nowIso } from '../util/time';
import { getPaymentAdapter, paymentModeLabel } from './adapter';
import { logInfo } from '../util/logger';

export const authorizePayment = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'payment:authorize');

    const parsed = AuthorizePaymentCommandSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;

    return withIdempotency(
      cmd.idempotencyKey,
      'authorizePayment',
      ctx.uid,
      async () => {
        const quoteRef = db.collection('quotes').doc(cmd.quoteId);
        const quoteSnap = await quoteRef.get();
        if (!quoteSnap.exists) {
          throw new HttpsError('not-found', 'Quote not found');
        }
        const quote = quoteSnap.data()!;
        if (quote.customerUid !== ctx.uid) {
          throw new HttpsError('permission-denied', 'Not your quote');
        }
        if (quote.redemptionState !== 'OPEN') {
          throw new HttpsError('failed-precondition', 'Quote not redeemable');
        }
        if (isExpired(quote.expiresAt)) {
          await quoteRef.update({ redemptionState: 'EXPIRED' });
          throw new HttpsError('failed-precondition', 'Quote expired');
        }

        const adapter = getPaymentAdapter();
        const intent = await adapter.createAuthorization({
          amountMinor: quote.totalMinor,
          currency: quote.currency,
          paymentMethodToken: cmd.paymentMethodToken,
          idempotencyKey: cmd.idempotencyKey,
          metadata: { quoteId: cmd.quoteId, marketId: cmd.marketId },
        });

        const paymentId = newId('pay');
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
          paymentMode: paymentModeLabel(),
          liveCharge: paymentModeLabel() === 'stripe',
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };

        await db.collection('payments').doc(paymentId).set(payment);

        if (intent.state === 'FAILED') {
          logInfo('payment_failed', { paymentId, quoteId: cmd.quoteId });
          throw new HttpsError('aborted', 'Payment authorization failed', {
            paymentId,
            paymentMode: paymentModeLabel(),
          });
        }

        logInfo('payment_authorized', {
          paymentId,
          quoteId: cmd.quoteId,
          mode: paymentModeLabel(),
        });

        return {
          payment,
          clientSecret: intent.clientSecret,
          analyticsHint: 'payment_authorized',
          notice:
            paymentModeLabel() === 'sandbox'
              ? 'SANDBOX: no live card charge. Configure STRIPE_* and PAYMENT_MODE=stripe for production.'
              : undefined,
        };
      },
    );
  },
);

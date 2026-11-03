import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  requirePermission,
  withIdempotency,
} from '../security/guards';
import { getPaymentAdapter, paymentModeLabel } from './adapter';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

export const refundPayment = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'payment:refund');

    const {
      paymentId,
      amountMinor,
      reason,
      idempotencyKey,
      marketId,
    } = request.data as {
      paymentId: string;
      amountMinor: number;
      reason: string;
      idempotencyKey: string;
      marketId: string;
    };
    if (!paymentId || !amountMinor || !reason || !idempotencyKey) {
      throw new HttpsError('invalid-argument', 'Missing fields');
    }

    return withIdempotency(idempotencyKey, 'refundPayment', ctx.uid, async () => {
      const payRef = db.collection('payments').doc(paymentId);
      const paySnap = await payRef.get();
      if (!paySnap.exists) throw new HttpsError('not-found', 'Payment not found');
      const payment = paySnap.data()!;
      if (payment.state !== 'CAPTURED' && payment.state !== 'AUTHORIZED') {
        throw new HttpsError(
          'failed-precondition',
          `Cannot refund from state ${payment.state}`,
        );
      }
      if (amountMinor > payment.amountMinor) {
        throw new HttpsError('invalid-argument', 'Refund exceeds capture');
      }

      const adapter = getPaymentAdapter();
      const result = await adapter.refund({
        providerIntentId: payment.providerIntentId,
        amountMinor,
        idempotencyKey,
      });
      if (result.state !== 'SUCCEEDED') {
        throw new HttpsError('aborted', 'Refund failed at provider');
      }

      const refundId = newId('ref');
      const now = nowIso();
      const partial = amountMinor < payment.amountMinor;
      await db.collection('refunds').doc(refundId).set({
        refundId,
        paymentId,
        bookingId: payment.bookingId,
        customerUid: payment.customerUid,
        amountMinor,
        currency: payment.currency,
        reason,
        providerRefundId: result.refundId,
        paymentMode: paymentModeLabel(),
        createdAt: now,
        actorUid: ctx.uid,
      });
      await payRef.update({
        state: partial ? 'CAPTURED' : 'CANCELLED',
        lastProviderEvent: 'refund',
        updatedAt: now,
      });
      if (payment.bookingId) {
        await db.collection('bookings').doc(payment.bookingId).update({
          paymentStatus: partial ? 'PARTIALLY_REFUNDED' : 'REFUNDED',
          updatedAt: now,
        });
        await db
          .collection('bookings')
          .doc(payment.bookingId)
          .collection('events')
          .doc(newId('evt'))
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
      await db.collection('audit_logs').doc(newId('aud')).set({
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
      logInfo('refund_issued', { refundId, amountMinor });
      return { refundId, amountMinor, partial };
    });
  },
);

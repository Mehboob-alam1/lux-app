import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

/**
 * Help case — distinct from disputes and safety incidents.
 * Live-trip cases inherit booking/driver/vehicle context.
 */
export const createSupportCase = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const {
      idempotencyKey,
      bookingId,
      category,
      subject,
      message,
      escalateSafety,
    } = request.data as {
      idempotencyKey: string;
      bookingId?: string;
      category: string;
      subject: string;
      message: string;
      escalateSafety?: boolean;
    };
    if (!idempotencyKey || !category || !subject || !message) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    return withIdempotency(
      idempotencyKey,
      'createSupportCase',
      ctx.uid,
      async () => {
        if (escalateSafety) {
          const incidentId = newId('inc');
          const now = nowIso();
          let context: Record<string, unknown> = {};
          if (bookingId) {
            const b = await db.collection('bookings').doc(bookingId).get();
            if (b.exists) {
              const booking = b.data()!;
              context = {
                bookingId,
                driverId: booking.assignedDriverId ?? null,
                vehicleId: booking.assignedVehicleId ?? null,
                currentStatus: booking.currentStatus,
              };
              await db.collection('bookings').doc(bookingId).update({
                incidentStatus: 'OPEN',
                updatedAt: now,
              });
            }
          }
          await db.collection('incidents').doc(incidentId).set({
            incidentId,
            reporterUid: ctx.uid,
            category: 'SAFETY',
            status: 'OPEN',
            priority: 'CRITICAL',
            subject,
            message,
            context,
            createdAt: now,
            updatedAt: now,
          });
          logInfo('safety_incident_opened', { incidentId });
          return {
            type: 'INCIDENT',
            incidentId,
            analyticsHint: 'support_opened',
          };
        }

        let context: Record<string, unknown> = {};
        let priority = 'NORMAL';
        if (bookingId) {
          const b = await db.collection('bookings').doc(bookingId).get();
          if (b.exists) {
            const booking = b.data()!;
            const live = [
              'ASSIGNED',
              'DRIVER_EN_ROUTE',
              'DRIVER_ARRIVED',
              'WAITING',
              'PASSENGER_ONBOARD',
              'IN_PROGRESS',
              'REASSIGNING',
            ].includes(booking.currentStatus);
            priority = live ? 'LIVE_TRIP' : 'NORMAL';
            context = {
              bookingId,
              driverId: booking.assignedDriverId ?? null,
              vehicleId: booking.assignedVehicleId ?? null,
              currentStatus: booking.currentStatus,
            };
          }
        }

        const caseId = newId('sup');
        const now = nowIso();
        await db.collection('support_cases').doc(caseId).set({
          caseId,
          ownerUid: ctx.uid,
          bookingId: bookingId ?? null,
          category,
          subject,
          status: 'OPEN',
          priority,
          context,
          createdAt: now,
          updatedAt: now,
        });
        const msgId = newId('smsg');
        await db.collection('support_messages').doc(msgId).set({
          messageId: msgId,
          caseId,
          ownerUid: ctx.uid,
          authorUid: ctx.uid,
          authorRole: 'CUSTOMER',
          visibility: 'PUBLIC',
          body: message,
          createdAt: now,
        });
        await db.collection('support_cases').doc(caseId).set(
          {
            lastMessageAt: now,
            lastMessagePreview: message.slice(0, 120),
            lastAuthorUid: ctx.uid,
          },
          { merge: true },
        );
        logInfo('support_opened', { caseId, priority });
        return { type: 'SUPPORT', caseId, analyticsHint: 'support_opened' };
      },
    );
  },
);

export const convertSupportToDispute = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const { supportCaseId, claim, amountMinor, currency, idempotencyKey } =
      request.data as {
        supportCaseId: string;
        claim: string;
        amountMinor?: number;
        currency?: string;
        idempotencyKey: string;
      };

    return withIdempotency(
      idempotencyKey,
      'convertSupportToDispute',
      ctx.uid,
      async () => {
        const support = await db.collection('support_cases').doc(supportCaseId).get();
        if (!support.exists) throw new HttpsError('not-found', 'Case not found');
        const s = support.data()!;
        if (
          s.ownerUid !== ctx.uid &&
          !ctx.roles.some((r) =>
            ['ADMIN_SUPPORT', 'ADMIN_SUPER', 'ADMIN_FINANCE'].includes(r),
          )
        ) {
          throw new HttpsError('permission-denied', 'Cannot convert case');
        }
        const disputeId = newId('dsp');
        const now = nowIso();
        await db.collection('disputes').doc(disputeId).set({
          disputeId,
          supportCaseId,
          bookingId: s.bookingId ?? null,
          partyUid: s.ownerUid,
          claim,
          amountMinor: amountMinor ?? null,
          currency: currency ?? null,
          status: 'OPEN',
          decision: null,
          financialRemedy: null,
          rootCause: null,
          createdAt: now,
          updatedAt: now,
        });
        await db.collection('support_cases').doc(supportCaseId).update({
          linkedDisputeId: disputeId,
          updatedAt: now,
        });
        return { disputeId, linkedSupportCaseId: supportCaseId };
      },
    );
  },
);

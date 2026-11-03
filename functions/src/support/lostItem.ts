import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { LostItemStatusSchema } from '@lux/contracts';
import { db } from '../firebase';
import {
  assertAppCheck,
  requireAuth,
  withIdempotency,
} from '../security/guards';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';

export const reportLostItem = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const { bookingId, description, idempotencyKey } = request.data as {
      bookingId: string;
      description: string;
      idempotencyKey: string;
    };

    return withIdempotency(idempotencyKey, 'reportLostItem', ctx.uid, async () => {
      const b = await db.collection('bookings').doc(bookingId).get();
      if (!b.exists) throw new HttpsError('not-found', 'Booking not found');
      const booking = b.data()!;
      if (
        booking.customerUid !== ctx.uid &&
        booking.bookerUid !== ctx.uid &&
        !ctx.roles.some((r) => r.startsWith('ADMIN_'))
      ) {
        throw new HttpsError('permission-denied', 'Not your booking');
      }
      const id = newId('lost');
      const now = nowIso();
      await db.collection('lost_items').doc(id).set({
        lostItemId: id,
        bookingId,
        reporterUid: ctx.uid,
        driverId: booking.assignedDriverId ?? null,
        vehicleId: booking.assignedVehicleId ?? null,
        description,
        status: 'REPORTED',
        createdAt: now,
        updatedAt: now,
      });
      return { lostItemId: id, status: 'REPORTED' };
    });
  },
);

export const updateLostItemStatus = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    if (
      !ctx.roles.some((r) =>
        ['ADMIN_SUPPORT', 'ADMIN_SUPER', 'ADMIN_OPERATIONS', 'DRIVER'].includes(
          r,
        ),
      )
    ) {
      throw new HttpsError('permission-denied', 'Not allowed');
    }
    const { lostItemId, status } = request.data as {
      lostItemId: string;
      status: string;
    };
    const parsed = LostItemStatusSchema.safeParse(status);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', 'Invalid lost item status');
    }
    await db.collection('lost_items').doc(lostItemId).update({
      status: parsed.data,
      updatedAt: nowIso(),
      lastActorUid: ctx.uid,
    });
    return { lostItemId, status: parsed.data };
  },
);

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../firebase';
import { assertAppCheck, requireAuth } from '../security/guards';
import { newId } from '../util/ids';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';
import { notifyBookingEvent } from '../notifications/adapter';

const Schema = z.object({
  bookingId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

const LIVE = new Set([
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'WAITING',
  'PASSENGER_ONBOARD',
  'IN_PROGRESS',
  'REASSIGNING',
]);

/**
 * Customer ↔ driver chat on an active booking + push to the peer.
 */
export const postTripMessage = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
      throw new HttpsError('invalid-argument', parsed.error.message);
    }
    const { bookingId, body } = parsed.data;

    const bookingRef = db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      throw new HttpsError('not-found', 'Booking not found');
    }
    const booking = bookingSnap.data()!;
    const customerUid = String(booking.customerUid ?? booking.bookerUid ?? '');
    const driverId = String(booking.assignedDriverId ?? '');

    const isCustomer = customerUid === ctx.uid;
    const isDriver = driverId === ctx.uid;
    const isAdmin = ctx.roles.some((r) => r.startsWith('ADMIN_'));
    if (!isCustomer && !isDriver && !isAdmin) {
      throw new HttpsError('permission-denied', 'Not a trip participant');
    }
    if (!isAdmin && !LIVE.has(String(booking.currentStatus))) {
      throw new HttpsError(
        'failed-precondition',
        'Chat is only available on live trips',
      );
    }

    const now = nowIso();
    const messageId = newId('tmsg');
    const authorRole = isDriver ? 'DRIVER' : isCustomer ? 'CUSTOMER' : 'ADMIN';
    const trimmed = body.trim();

    await db.collection('trip_messages').doc(messageId).set({
      messageId,
      bookingId,
      customerUid: customerUid || null,
      driverId: driverId || null,
      authorUid: ctx.uid,
      authorRole,
      body: trimmed,
      createdAt: now,
    });

    await bookingRef.set(
      {
        lastTripMessageAt: now,
        lastTripMessagePreview: trimmed.slice(0, 120),
        lastTripMessageAuthorUid: ctx.uid,
        lastTripMessageAuthorRole: authorRole,
        updatedAt: now,
      },
      { merge: true },
    );

    // Notify the other party (never the sender).
    const peerUid = isDriver
      ? customerUid
      : isCustomer
        ? driverId
        : '';
    if (peerUid && peerUid !== ctx.uid) {
      const fromLabel = isDriver
        ? 'Your chauffeur'
        : isCustomer
          ? 'Your rider'
          : 'LUX Ops';
      const peerIsDriver = peerUid === driverId;
      const route = peerIsDriver
        ? `/active-trip/${bookingId}/chat`
        : `/trips/${bookingId}/chat`;
      await notifyBookingEvent({
        userId: peerUid,
        bookingId,
        template: 'trip_message',
        title: fromLabel,
        body: trimmed.slice(0, 140),
        data: {
          type: 'trip_message',
          bookingId,
          messageId,
          route,
          authorRole,
        },
      });
    }

    logInfo('trip_message_posted', { bookingId, authorRole, notified: Boolean(peerUid) });
    return { ok: true, messageId };
  },
);

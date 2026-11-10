"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.postTripMessage = void 0;
const https_1 = require("firebase-functions/v2/https");
const zod_1 = require("zod");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const adapter_1 = require("../notifications/adapter");
const Schema = zod_1.z.object({
    bookingId: zod_1.z.string().min(1),
    body: zod_1.z.string().min(1).max(2000),
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
exports.postTripMessage = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const parsed = Schema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const { bookingId, body } = parsed.data;
    const bookingRef = firebase_1.db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Booking not found');
    }
    const booking = bookingSnap.data();
    const customerUid = String(booking.customerUid ?? booking.bookerUid ?? '');
    const driverId = String(booking.assignedDriverId ?? '');
    const isCustomer = customerUid === ctx.uid;
    const isDriver = driverId === ctx.uid;
    const isAdmin = ctx.roles.some((r) => r.startsWith('ADMIN_'));
    if (!isCustomer && !isDriver && !isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Not a trip participant');
    }
    if (!isAdmin && !LIVE.has(String(booking.currentStatus))) {
        throw new https_1.HttpsError('failed-precondition', 'Chat is only available on live trips');
    }
    const now = (0, time_1.nowIso)();
    const messageId = (0, ids_1.newId)('tmsg');
    const authorRole = isDriver ? 'DRIVER' : isCustomer ? 'CUSTOMER' : 'ADMIN';
    const trimmed = body.trim();
    await firebase_1.db.collection('trip_messages').doc(messageId).set({
        messageId,
        bookingId,
        customerUid: customerUid || null,
        driverId: driverId || null,
        authorUid: ctx.uid,
        authorRole,
        body: trimmed,
        createdAt: now,
    });
    await bookingRef.set({
        lastTripMessageAt: now,
        lastTripMessagePreview: trimmed.slice(0, 120),
        lastTripMessageAuthorUid: ctx.uid,
        lastTripMessageAuthorRole: authorRole,
        updatedAt: now,
    }, { merge: true });
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
        await (0, adapter_1.notifyBookingEvent)({
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
    (0, logger_1.logInfo)('trip_message_posted', { bookingId, authorRole, notified: Boolean(peerUid) });
    return { ok: true, messageId };
});
//# sourceMappingURL=postTripMessage.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGuestLink = exports.createGuestLink = void 0;
const https_1 = require("firebase-functions/v2/https");
const https_2 = require("firebase-functions/v2/https");
const crypto_1 = require("crypto");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const ids_1 = require("../util/ids");
function hashToken(raw) {
    return (0, crypto_1.createHash)('sha256').update(raw).digest('hex');
}
/** Create expiring guest journey link — returns raw token once. */
exports.createGuestLink = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const { bookingId, ttlMinutes } = request.data;
    const booking = await firebase_1.db.collection('bookings').doc(bookingId).get();
    if (!booking.exists)
        throw new https_1.HttpsError('not-found', 'Booking not found');
    const b = booking.data();
    if (b.customerUid !== ctx.uid && b.bookerUid !== ctx.uid) {
        if (!ctx.roles.some((r) => r.startsWith('ADMIN_'))) {
            throw new https_1.HttpsError('permission-denied', 'Not your booking');
        }
    }
    const raw = (0, crypto_1.randomBytes)(32).toString('base64url');
    const linkId = (0, ids_1.newId)('gst');
    await firebase_1.db.collection('guest_links').doc(linkId).set({
        linkId,
        bookingId,
        tokenHash: hashToken(raw),
        permissions: [
            'view_chauffeur',
            'view_vehicle',
            'view_plate',
            'view_meeting_point',
            'view_eta',
            'update_readiness',
            'contact',
        ],
        expiresAt: (0, time_1.addMinutesIso)(ttlMinutes ?? 60 * 24),
        createdAt: (0, time_1.nowIso)(),
        createdBy: ctx.uid,
    });
    return {
        linkId,
        token: raw,
        // Client builds URL; never store raw token
        path: `/guest/${linkId}?t=${raw}`,
    };
});
/**
 * Public HTTPS guest view — scoped fields only (no prices / private PII).
 */
exports.resolveGuestLink = (0, https_2.onRequest)({ region: 'us-central1', cors: true }, async (req, res) => {
    const linkId = String(req.query.linkId || req.body?.linkId || '');
    const token = String(req.query.t || req.body?.t || '');
    if (!linkId || !token) {
        res.status(400).json({ error: 'linkId and t required' });
        return;
    }
    const linkSnap = await firebase_1.db.collection('guest_links').doc(linkId).get();
    if (!linkSnap.exists) {
        res.status(404).json({ error: 'Not found' });
        return;
    }
    const link = linkSnap.data();
    if (link.tokenHash !== hashToken(token)) {
        res.status(403).json({ error: 'Invalid token' });
        return;
    }
    if ((0, time_1.isExpired)(link.expiresAt)) {
        res.status(410).json({ error: 'Link expired' });
        return;
    }
    const bookingSnap = await firebase_1.db.collection('bookings').doc(link.bookingId).get();
    if (!bookingSnap.exists) {
        res.status(404).json({ error: 'Booking missing' });
        return;
    }
    const b = bookingSnap.data();
    let chauffeur = null;
    let vehicle = null;
    if (b.assignedDriverId) {
        const d = await firebase_1.db.collection('drivers').doc(b.assignedDriverId).get();
        chauffeur = {
            displayName: d.data()?.displayName ?? null,
            // no phone dump — contact via mediated action later
        };
    }
    if (b.assignedVehicleId) {
        const v = await firebase_1.db.collection('vehicles').doc(b.assignedVehicleId).get();
        vehicle = {
            make: v.data()?.make,
            model: v.data()?.model,
            color: v.data()?.color,
            plate: v.data()?.plate,
            // class ok; no VIN
            classIds: v.data()?.classIds,
        };
    }
    const pickup = b.itinerary?.find((s) => s.kind === 'PICKUP');
    // Explicitly omit customerPriceMinor, payment, personal phone/email
    res.json({
        bookingId: b.bookingId,
        currentStatus: b.currentStatus,
        scheduledAt: b.scheduledAt,
        meetingPoint: pickup?.place?.label ?? null,
        meetingAddress: pickup?.place?.address ?? null,
        readiness: b.airport?.readiness ?? null,
        chauffeur,
        vehicle,
        permissions: link.permissions,
        expiresAt: link.expiresAt,
    });
});
//# sourceMappingURL=guestLink.js.map
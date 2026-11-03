"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateDriverLocation = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const OPERATIONAL_STATUSES = new Set([
    'ASSIGNED',
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'WAITING',
    'PASSENGER_ONBOARD',
    'IN_PROGRESS',
    'REASSIGNING',
]);
/**
 * State-aware location updates. Clients may only push when they have an
 * operational booking; writes go through Functions (rules deny direct write).
 */
exports.updateDriverLocation = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    if (!ctx.roles.includes('DRIVER')) {
        throw new https_1.HttpsError('permission-denied', 'Driver role required');
    }
    const { lat, lng, accuracyM, bookingId, heading, speed } = request.data;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
        throw new https_1.HttpsError('invalid-argument', 'lat/lng required');
    }
    if (bookingId) {
        const b = await firebase_1.db.collection('bookings').doc(bookingId).get();
        if (!b.exists || b.data()?.assignedDriverId !== ctx.uid) {
            throw new https_1.HttpsError('permission-denied', 'Not assigned to booking');
        }
        if (!OPERATIONAL_STATUSES.has(b.data().currentStatus)) {
            throw new https_1.HttpsError('failed-precondition', 'Location not justified for current booking state');
        }
    }
    const now = (0, time_1.nowIso)();
    await firebase_1.db.collection('driver_locations').doc(ctx.uid).set({
        driverId: ctx.uid,
        lat,
        lng,
        accuracyM: accuracyM ?? null,
        heading: heading ?? null,
        speed: speed ?? null,
        bookingId: bookingId ?? null,
        updatedAt: now,
        // TTL cleanup via scheduled job — retain short window
        expireAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    return { ok: true, updatedAt: now };
});
//# sourceMappingURL=updateDriverLocation.js.map
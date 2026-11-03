"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.acceptOffer = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const adapter_1 = require("../notifications/adapter");
exports.acceptOffer = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    if (!ctx.roles.includes('DRIVER') && !ctx.roles.includes('ADMIN_SUPER')) {
        throw new https_1.HttpsError('permission-denied', 'Driver role required');
    }
    const parsed = contracts_1.AcceptOfferCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, 'acceptOffer', ctx.uid, async () => {
        const assignmentId = (0, ids_1.newId)('asn');
        await firebase_1.db.runTransaction(async (tx) => {
            const offerRef = firebase_1.db.collection('driver_offers').doc(cmd.offerId);
            const offerSnap = await tx.get(offerRef);
            if (!offerSnap.exists)
                throw new https_1.HttpsError('not-found', 'Offer not found');
            const offer = offerSnap.data();
            if (offer.driverId !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Not your offer');
            }
            if (offer.response !== 'PENDING') {
                throw new https_1.HttpsError('failed-precondition', 'Offer already resolved');
            }
            if ((0, time_1.isExpired)(offer.expiresAt)) {
                tx.update(offerRef, { response: 'EXPIRED' });
                throw new https_1.HttpsError('failed-precondition', 'Offer expired');
            }
            const bookingRef = firebase_1.db.collection('bookings').doc(offer.bookingId);
            const bookingSnap = await tx.get(bookingRef);
            if (!bookingSnap.exists)
                throw new https_1.HttpsError('not-found', 'Booking missing');
            const booking = bookingSnap.data();
            if (booking.currentStatus !== 'ASSIGNMENT_PENDING' &&
                booking.currentStatus !== 'REASSIGNING') {
                throw new https_1.HttpsError('failed-precondition', 'Booking not assignable');
            }
            if (booking.assignmentId) {
                throw new https_1.HttpsError('aborted', 'Already assigned');
            }
            const driverRef = firebase_1.db.collection('drivers').doc(ctx.uid);
            const driverSnap = await tx.get(driverRef);
            const driver = driverSnap.data();
            if (!driver || driver.status !== 'ACTIVE') {
                throw new https_1.HttpsError('failed-precondition', 'Driver not ACTIVE');
            }
            const vehicleRef = firebase_1.db.collection('vehicles').doc(cmd.vehicleId);
            const vehicleSnap = await tx.get(vehicleRef);
            if (!vehicleSnap.exists)
                throw new https_1.HttpsError('not-found', 'Vehicle not found');
            const vehicle = vehicleSnap.data();
            if (vehicle.ownerDriverId !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Vehicle not owned');
            }
            if (vehicle.status !== 'APPROVED' || !vehicle.documentEligibilityOk) {
                throw new https_1.HttpsError('failed-precondition', 'Vehicle ineligible — cannot accept');
            }
            if (!(vehicle.classIds ?? []).includes(booking.classId)) {
                throw new https_1.HttpsError('failed-precondition', 'Vehicle class mismatch');
            }
            const now = (0, time_1.nowIso)();
            tx.update(offerRef, { response: 'ACCEPTED', acceptedAt: now });
            tx.set(firebase_1.db.collection('assignments').doc(assignmentId), {
                assignmentId,
                bookingId: offer.bookingId,
                driverId: ctx.uid,
                vehicleId: cmd.vehicleId,
                status: 'ACCEPTED',
                offeredAt: offer.createdAt,
                acceptedAt: now,
                releasedAt: null,
                eligibilitySnapshot: {
                    vehicleStatus: vehicle.status,
                    documentEligibilityOk: vehicle.documentEligibilityOk,
                    driverStatus: driver.status,
                },
                version: 1,
                payoutQuoteMinor: offer.expectedPayoutMinor,
                currency: offer.currency,
            });
            tx.update(bookingRef, {
                currentStatus: 'ASSIGNED',
                statusVersion: (booking.statusVersion ?? 0) + 1,
                assignmentId,
                assignedDriverId: ctx.uid,
                assignedVehicleId: cmd.vehicleId,
                assuranceStatus: 'CONFIRMED',
                riskState: 'NORMAL',
                updatedAt: now,
            });
            const eventId = (0, ids_1.newId)('evt');
            tx.set(bookingRef.collection('events').doc(eventId), {
                eventId,
                bookingId: offer.bookingId,
                type: 'ASSIGNMENT_CONFIRMED',
                actorUid: ctx.uid,
                actorRole: 'DRIVER',
                timestamp: now,
                source: 'DRIVER_APP',
                previousStatus: booking.currentStatus,
                nextStatus: 'ASSIGNED',
                idempotencyKey: cmd.idempotencyKey,
            });
            // Expire sibling pending offers
            // (best-effort outside strict sibling lock; transaction already locked booking)
        });
        // Expire other offers outside txn (booking already locked by assignmentId)
        const siblings = await firebase_1.db
            .collection('driver_offers')
            .where('bookingId', '==', (await firebase_1.db.collection('driver_offers').doc(cmd.offerId).get()).data().bookingId)
            .where('response', '==', 'PENDING')
            .get();
        const batch = firebase_1.db.batch();
        siblings.docs.forEach((d) => {
            if (d.id !== cmd.offerId)
                batch.update(d.ref, { response: 'EXPIRED' });
        });
        await batch.commit();
        const offer = (await firebase_1.db.collection('driver_offers').doc(cmd.offerId).get()).data();
        const booking = (await firebase_1.db.collection('bookings').doc(offer.bookingId).get()).data();
        await (0, adapter_1.notifyBookingEvent)({
            userId: booking.customerUid,
            bookingId: offer.bookingId,
            template: 'assignment_confirmed',
            title: 'Chauffeur assigned',
            body: 'Your chauffeur and vehicle are confirmed.',
            critical: true,
        });
        (0, logger_1.logInfo)('assignment_confirmed', { assignmentId, offerId: cmd.offerId });
        return {
            assignmentId,
            analyticsHint: 'assignment_confirmed',
        };
    });
});
//# sourceMappingURL=acceptOffer.js.map
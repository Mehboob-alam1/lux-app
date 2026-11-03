"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enqueueDispatch = enqueueDispatch;
const firebase_1 = require("../firebase");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const eligibility_1 = require("./eligibility");
const logger_1 = require("../util/logger");
/**
 * Create time-limited offers for top eligible independent owner-drivers.
 * Fleet dispatch intentionally not implemented.
 */
async function enqueueDispatch(bookingId) {
    const bookingRef = firebase_1.db.collection('bookings').doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists)
        return;
    const booking = bookingSnap.data();
    const driversSnap = await firebase_1.db
        .collection('drivers')
        .where('status', '==', 'ACTIVE')
        .where('onlineState', '==', 'ONLINE')
        .where('marketIds', 'array-contains', booking.marketId)
        .limit(50)
        .get();
    const candidates = [];
    for (const d of driversSnap.docs) {
        const driver = d.data();
        if (driver.driverType && driver.driverType !== 'OWNER_DRIVER') {
            // Future fleet drivers ignored this update
            continue;
        }
        if (!driver.currentVehicleId)
            continue;
        const vSnap = await firebase_1.db.collection('vehicles').doc(driver.currentVehicleId).get();
        if (!vSnap.exists)
            continue;
        const v = vSnap.data();
        const locSnap = await firebase_1.db.collection('driver_locations').doc(d.id).get();
        const loc = locSnap.data();
        candidates.push({
            driverId: d.id,
            vehicleId: v.vehicleId ?? vSnap.id,
            classIds: v.classIds ?? [],
            status: driver.status,
            onlineState: driver.onlineState,
            documentEligibilityOk: Boolean(v.documentEligibilityOk),
            vehicleApproved: v.status === 'APPROVED',
            capacityPassengers: v.capacityPassengers,
            capacityLuggage: v.capacityLuggage,
            marketIds: driver.marketIds ?? [],
            lat: loc?.lat,
            lng: loc?.lng,
            reliability: driver.performance?.completionRate ?? 0.8,
            nextCommitmentAt: null,
        });
    }
    const pickup = booking.itinerary.find((s) => s.kind === 'PICKUP');
    if (!pickup)
        return;
    const ranked = (0, eligibility_1.rankCandidates)(candidates, {
        marketId: booking.marketId,
        classId: booking.classId,
        passengers: booking.passengers,
        luggage: booking.luggage,
        scheduledAt: booking.scheduledAt,
        pickup: pickup.place.location,
    });
    const top = ranked.slice(0, 5);
    const now = (0, time_1.nowIso)();
    const batch = firebase_1.db.batch();
    for (const c of top) {
        const offerId = (0, ids_1.newId)('off');
        batch.set(firebase_1.db.collection('driver_offers').doc(offerId), {
            offerId,
            bookingId,
            driverId: c.driverId,
            vehicleIdHint: c.vehicleId,
            expiresAt: (0, time_1.addMinutesIso)(2),
            response: 'PENDING',
            expectedPayoutMinor: booking.driverPayoutMinor,
            currency: booking.currency,
            pickupDistanceKm: c.pickupDistanceKm,
            etaMinutes: c.etaMinutes,
            createdAt: now,
        });
    }
    if (top.length === 0) {
        batch.update(bookingRef, {
            riskState: 'AT_RISK',
            updatedAt: now,
        });
        batch.set(firebase_1.db.collection('operational_alerts').doc((0, ids_1.newId)('alert')), {
            alertId: (0, ids_1.newId)('alert'),
            marketId: booking.marketId,
            bookingId,
            health: 'AT_RISK',
            type: 'UNASSIGNED_NO_ELIGIBLE',
            createdAt: now,
        });
    }
    await batch.commit();
    (0, logger_1.logInfo)('dispatch_offers_created', {
        bookingId,
        offerCount: top.length,
    });
}
//# sourceMappingURL=enqueueDispatch.js.map
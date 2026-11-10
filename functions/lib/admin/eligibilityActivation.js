"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.maybeActivateDriver = maybeActivateDriver;
const firebase_1 = require("../firebase");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/**
 * Activate driver only when vehicle is APPROVED and documents are eligible.
 */
async function maybeActivateDriver(driverId) {
    const driverRef = firebase_1.db.collection('drivers').doc(driverId);
    const driverSnap = await driverRef.get();
    if (!driverSnap.exists)
        return null;
    const driver = driverSnap.data();
    const vehicleId = driver.currentVehicleId;
    if (!vehicleId)
        return driver.status ?? null;
    const vehicleSnap = await firebase_1.db.collection('vehicles').doc(vehicleId).get();
    if (!vehicleSnap.exists)
        return driver.status ?? null;
    const vehicle = vehicleSnap.data();
    const ready = vehicle.status === 'APPROVED' && vehicle.documentEligibilityOk === true;
    const now = (0, time_1.nowIso)();
    if (ready) {
        await driverRef.set({
            status: 'ACTIVE',
            statusReason: 'Vehicle and documents approved by ops',
            updatedAt: now,
        }, { merge: true });
        await firebase_1.db.collection('users').doc(driverId).set({
            accountState: 'ACTIVE',
            updatedAt: now,
        }, { merge: true });
        (0, logger_1.logInfo)('driver_activated', { driverId: driverId.slice(0, 8) });
        return 'ACTIVE';
    }
    if (driver.status === 'ACTIVE') {
        await driverRef.set({
            status: 'PENDING',
            statusReason: 'Awaiting vehicle/document approval',
            onlineState: 'OFFLINE',
            updatedAt: now,
        }, { merge: true });
        return 'PENDING';
    }
    return driver.status ?? 'PENDING';
}
//# sourceMappingURL=eligibilityActivation.js.map
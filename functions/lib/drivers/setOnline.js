"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setDriverOnline = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/**
 * Online eligibility gate — driver cannot go online unless ACTIVE,
 * approved eligible vehicle, and documents OK.
 */
exports.setDriverOnline = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    if (!ctx.roles.includes('DRIVER') && !ctx.roles.includes('ADMIN_SUPER')) {
        throw new https_1.HttpsError('permission-denied', 'Driver role required');
    }
    const { online } = request.data;
    const driverRef = firebase_1.db.collection('drivers').doc(ctx.uid);
    const snap = await driverRef.get();
    if (!snap.exists)
        throw new https_1.HttpsError('not-found', 'Driver profile missing');
    const driver = snap.data();
    if (!online) {
        await driverRef.update({
            onlineState: 'OFFLINE',
            updatedAt: (0, time_1.nowIso)(),
        });
        return { onlineState: 'OFFLINE', ok: true };
    }
    const reasons = [];
    if (driver.status !== 'ACTIVE') {
        reasons.push(driver.statusReason ||
            `Account status is ${driver.status} — not eligible to go online`);
    }
    if (!driver.currentVehicleId) {
        reasons.push('No current vehicle assigned');
    }
    else {
        const v = await firebase_1.db.collection('vehicles').doc(driver.currentVehicleId).get();
        if (!v.exists || v.data()?.status !== 'APPROVED') {
            reasons.push('Vehicle is not approved');
        }
        if (!v.data()?.documentEligibilityOk) {
            reasons.push('Vehicle documents are not eligible / expired');
        }
    }
    if (reasons.length) {
        throw new https_1.HttpsError('failed-precondition', reasons.join('; '), {
            reasons,
        });
    }
    await driverRef.update({
        onlineState: 'ONLINE',
        updatedAt: (0, time_1.nowIso)(),
    });
    (0, logger_1.logInfo)('driver_online', { driverId: ctx.uid });
    return { onlineState: 'ONLINE', ok: true };
});
//# sourceMappingURL=setOnline.js.map
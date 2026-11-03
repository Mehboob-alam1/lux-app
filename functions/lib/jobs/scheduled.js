"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentExpiryJob = exports.unassignedAgingJob = exports.staleLocationsJob = exports.expireQuotesJob = void 0;
const scheduler_1 = require("firebase-functions/v2/scheduler");
const firebase_1 = require("../firebase");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/** Expire open quotes past expiresAt. */
exports.expireQuotesJob = (0, scheduler_1.onSchedule)('every 5 minutes', async () => {
    const now = (0, time_1.nowIso)();
    const snap = await firebase_1.db
        .collection('quotes')
        .where('redemptionState', '==', 'OPEN')
        .where('expiresAt', '<=', now)
        .limit(200)
        .get();
    const batch = firebase_1.db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { redemptionState: 'EXPIRED' }));
    await batch.commit();
    (0, logger_1.logInfo)('job_expire_quotes', { count: snap.size });
});
/** Mark stale driver locations. */
exports.staleLocationsJob = (0, scheduler_1.onSchedule)('every 5 minutes', async () => {
    const cutoff = new Date(Date.now() - 5 * 60_000).toISOString();
    const snap = await firebase_1.db
        .collection('driver_locations')
        .where('updatedAt', '<', cutoff)
        .limit(200)
        .get();
    const batch = firebase_1.db.batch();
    snap.docs.forEach((d) => batch.update(d.ref, { stale: true, staleSince: (0, time_1.nowIso)() }));
    await batch.commit();
    (0, logger_1.logInfo)('job_stale_locations', { count: snap.size });
});
/** Age unassigned bookings into AT_RISK / RESCUE alerts. */
exports.unassignedAgingJob = (0, scheduler_1.onSchedule)('every 5 minutes', async () => {
    const cutoff = new Date(Date.now() - 10 * 60_000).toISOString();
    const snap = await firebase_1.db
        .collection('bookings')
        .where('currentStatus', 'in', ['ASSIGNMENT_PENDING', 'REASSIGNING'])
        .where('updatedAt', '<', cutoff)
        .limit(100)
        .get();
    const batch = firebase_1.db.batch();
    const now = (0, time_1.nowIso)();
    for (const d of snap.docs) {
        batch.update(d.ref, { riskState: 'AT_RISK', updatedAt: now });
    }
    await batch.commit();
    (0, logger_1.logInfo)('job_unassigned_aging', { count: snap.size });
});
/** Document expiry → flip eligibility (simplified). */
exports.documentExpiryJob = (0, scheduler_1.onSchedule)('every 60 minutes', async () => {
    const now = (0, time_1.nowIso)();
    const snap = await firebase_1.db
        .collection('vehicle_documents')
        .where('reviewState', '==', 'APPROVED')
        .where('expiryAt', '<=', now)
        .limit(100)
        .get();
    const batch = firebase_1.db.batch();
    for (const d of snap.docs) {
        batch.update(d.ref, { reviewState: 'EXPIRED' });
        const vehicleId = d.data().vehicleId;
        if (vehicleId) {
            batch.update(firebase_1.db.collection('vehicles').doc(vehicleId), {
                documentEligibilityOk: false,
                updatedAt: now,
            });
        }
    }
    await batch.commit();
    (0, logger_1.logInfo)('job_document_expiry', { count: snap.size });
});
//# sourceMappingURL=scheduled.js.map
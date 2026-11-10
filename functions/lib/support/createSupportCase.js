"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertSupportToDispute = exports.createSupportCase = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
/**
 * Help case — distinct from disputes and safety incidents.
 * Live-trip cases inherit booking/driver/vehicle context.
 */
exports.createSupportCase = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const { idempotencyKey, bookingId, category, subject, message, escalateSafety, } = request.data;
    if (!idempotencyKey || !category || !subject || !message) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
    }
    return (0, guards_1.withIdempotency)(idempotencyKey, 'createSupportCase', ctx.uid, async () => {
        if (escalateSafety) {
            const incidentId = (0, ids_1.newId)('inc');
            const now = (0, time_1.nowIso)();
            let context = {};
            if (bookingId) {
                const b = await firebase_1.db.collection('bookings').doc(bookingId).get();
                if (b.exists) {
                    const booking = b.data();
                    context = {
                        bookingId,
                        driverId: booking.assignedDriverId ?? null,
                        vehicleId: booking.assignedVehicleId ?? null,
                        currentStatus: booking.currentStatus,
                    };
                    await firebase_1.db.collection('bookings').doc(bookingId).update({
                        incidentStatus: 'OPEN',
                        updatedAt: now,
                    });
                }
            }
            await firebase_1.db.collection('incidents').doc(incidentId).set({
                incidentId,
                reporterUid: ctx.uid,
                category: 'SAFETY',
                status: 'OPEN',
                priority: 'CRITICAL',
                subject,
                message,
                context,
                createdAt: now,
                updatedAt: now,
            });
            (0, logger_1.logInfo)('safety_incident_opened', { incidentId });
            return {
                type: 'INCIDENT',
                incidentId,
                analyticsHint: 'support_opened',
            };
        }
        let context = {};
        let priority = 'NORMAL';
        if (bookingId) {
            const b = await firebase_1.db.collection('bookings').doc(bookingId).get();
            if (b.exists) {
                const booking = b.data();
                const live = [
                    'ASSIGNED',
                    'DRIVER_EN_ROUTE',
                    'DRIVER_ARRIVED',
                    'WAITING',
                    'PASSENGER_ONBOARD',
                    'IN_PROGRESS',
                    'REASSIGNING',
                ].includes(booking.currentStatus);
                priority = live ? 'LIVE_TRIP' : 'NORMAL';
                context = {
                    bookingId,
                    driverId: booking.assignedDriverId ?? null,
                    vehicleId: booking.assignedVehicleId ?? null,
                    currentStatus: booking.currentStatus,
                };
            }
        }
        const caseId = (0, ids_1.newId)('sup');
        const now = (0, time_1.nowIso)();
        const ownerRole = ctx.roles.includes('DRIVER')
            ? 'DRIVER'
            : ctx.roles.includes('CUSTOMER')
                ? 'CUSTOMER'
                : 'CUSTOMER';
        await firebase_1.db.collection('support_cases').doc(caseId).set({
            caseId,
            ownerUid: ctx.uid,
            ownerRole,
            bookingId: bookingId ?? null,
            category,
            subject,
            status: 'OPEN',
            priority,
            context,
            createdAt: now,
            updatedAt: now,
        });
        const msgId = (0, ids_1.newId)('smsg');
        await firebase_1.db.collection('support_messages').doc(msgId).set({
            messageId: msgId,
            caseId,
            ownerUid: ctx.uid,
            authorUid: ctx.uid,
            authorRole: ownerRole,
            visibility: 'PUBLIC',
            body: message,
            createdAt: now,
        });
        await firebase_1.db.collection('support_cases').doc(caseId).set({
            lastMessageAt: now,
            lastMessagePreview: message.slice(0, 120),
            lastAuthorUid: ctx.uid,
        }, { merge: true });
        (0, logger_1.logInfo)('support_opened', { caseId, priority });
        return { type: 'SUPPORT', caseId, analyticsHint: 'support_opened' };
    });
});
exports.convertSupportToDispute = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const { supportCaseId, claim, amountMinor, currency, idempotencyKey } = request.data;
    return (0, guards_1.withIdempotency)(idempotencyKey, 'convertSupportToDispute', ctx.uid, async () => {
        const support = await firebase_1.db.collection('support_cases').doc(supportCaseId).get();
        if (!support.exists)
            throw new https_1.HttpsError('not-found', 'Case not found');
        const s = support.data();
        if (s.ownerUid !== ctx.uid &&
            !ctx.roles.some((r) => ['ADMIN_SUPPORT', 'ADMIN_SUPER', 'ADMIN_FINANCE'].includes(r))) {
            throw new https_1.HttpsError('permission-denied', 'Cannot convert case');
        }
        const disputeId = (0, ids_1.newId)('dsp');
        const now = (0, time_1.nowIso)();
        await firebase_1.db.collection('disputes').doc(disputeId).set({
            disputeId,
            supportCaseId,
            bookingId: s.bookingId ?? null,
            partyUid: s.ownerUid,
            claim,
            amountMinor: amountMinor ?? null,
            currency: currency ?? null,
            status: 'OPEN',
            decision: null,
            financialRemedy: null,
            rootCause: null,
            createdAt: now,
            updatedAt: now,
        });
        await firebase_1.db.collection('support_cases').doc(supportCaseId).update({
            linkedDisputeId: disputeId,
            updatedAt: now,
        });
        return { disputeId, linkedSupportCaseId: supportCaseId };
    });
});
//# sourceMappingURL=createSupportCase.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tripLifecycle = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const adapter_1 = require("../payments/adapter");
const logger_1 = require("../util/logger");
const ACTION_STATUS = {
    EN_ROUTE: {
        to: 'DRIVER_EN_ROUTE',
        event: 'DRIVER_EN_ROUTE',
        analytics: 'driver_en_route',
    },
    ARRIVED: {
        to: 'DRIVER_ARRIVED',
        event: 'DRIVER_ARRIVED',
        analytics: 'driver_arrived',
    },
    START_WAIT: { to: 'WAITING', event: 'WAITING_STARTED' },
    PASSENGER_ONBOARD: {
        to: 'PASSENGER_ONBOARD',
        event: 'PASSENGER_ONBOARD',
        analytics: 'passenger_onboard',
    },
    START_TRIP: { to: 'IN_PROGRESS', event: 'TRIP_STARTED' },
    COMPLETE: {
        to: 'COMPLETED',
        event: 'TRIP_COMPLETED',
        analytics: 'trip_completed',
    },
};
exports.tripLifecycle = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    const parsed = contracts_1.TripLifecycleCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, `trip_${cmd.action}`, ctx.uid, async () => {
        if (cmd.action === 'CONTACT_ATTEMPT') {
            const ref = firebase_1.db.collection('bookings').doc(cmd.bookingId);
            const snap = await ref.get();
            if (!snap.exists)
                throw new https_1.HttpsError('not-found', 'Booking not found');
            const b = snap.data();
            if (b.assignedDriverId !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Not assigned driver');
            }
            const eventId = (0, ids_1.newId)('evt');
            await ref.collection('events').doc(eventId).set({
                eventId,
                bookingId: cmd.bookingId,
                type: 'CONTACT_ATTEMPT',
                actorUid: ctx.uid,
                timestamp: (0, time_1.nowIso)(),
                source: 'DRIVER_APP',
                idempotencyKey: cmd.idempotencyKey,
                location: cmd.location ?? null,
            });
            return { ok: true };
        }
        if (cmd.action === 'PASSENGER_NO_SHOW') {
            return handleNoShow(ctx.uid, cmd);
        }
        const mapping = ACTION_STATUS[cmd.action];
        if (!mapping) {
            throw new https_1.HttpsError('invalid-argument', 'Unknown action');
        }
        let analyticsHint;
        await firebase_1.db.runTransaction(async (tx) => {
            const bookingRef = firebase_1.db.collection('bookings').doc(cmd.bookingId);
            const snap = await tx.get(bookingRef);
            if (!snap.exists)
                throw new https_1.HttpsError('not-found', 'Booking not found');
            const booking = snap.data();
            if (booking.assignedDriverId !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Not assigned driver');
            }
            if (cmd.expectedStatusVersion != null &&
                booking.statusVersion !== cmd.expectedStatusVersion) {
                throw new https_1.HttpsError('aborted', 'Version conflict');
            }
            // Trip start / movement requires eligible approved vehicle
            if (['EN_ROUTE', 'START_TRIP', 'PASSENGER_ONBOARD'].includes(cmd.action)) {
                const vSnap = await tx.get(firebase_1.db.collection('vehicles').doc(booking.assignedVehicleId));
                const v = vSnap.data();
                if (!v || v.status !== 'APPROVED' || !v.documentEligibilityOk) {
                    throw new https_1.HttpsError('failed-precondition', 'Ineligible vehicle blocked at trip action');
                }
                const dSnap = await tx.get(firebase_1.db.collection('drivers').doc(ctx.uid));
                if (!dSnap.data() || dSnap.data().status !== 'ACTIVE') {
                    throw new https_1.HttpsError('failed-precondition', 'Driver not ACTIVE');
                }
            }
            (0, contracts_1.assertBookingTransition)(booking.currentStatus, mapping.to);
            const now = (0, time_1.nowIso)();
            const waitingStartedAt = mapping.to === 'WAITING' || mapping.to === 'DRIVER_ARRIVED'
                ? booking.waitingStartedAt ?? now
                : booking.waitingStartedAt ?? null;
            tx.update(bookingRef, {
                currentStatus: mapping.to,
                statusVersion: (booking.statusVersion ?? 0) + 1,
                updatedAt: now,
                waitingStartedAt: mapping.to === 'DRIVER_ARRIVED' ? now : waitingStartedAt,
                ...(mapping.to === 'WAITING'
                    ? { waitingStartedAt: booking.waitingStartedAt ?? now }
                    : {}),
            });
            const eventId = (0, ids_1.newId)('evt');
            tx.set(bookingRef.collection('events').doc(eventId), {
                eventId,
                bookingId: cmd.bookingId,
                type: mapping.event,
                actorUid: ctx.uid,
                actorRole: 'DRIVER',
                timestamp: now,
                source: 'DRIVER_APP',
                previousStatus: booking.currentStatus,
                nextStatus: mapping.to,
                idempotencyKey: cmd.idempotencyKey,
                location: cmd.location ?? null,
                evidenceRef: cmd.evidenceRef,
            });
            analyticsHint = mapping.analytics;
        });
        if (cmd.action === 'COMPLETE') {
            await captureAfterComplete(cmd.bookingId, cmd.idempotencyKey);
        }
        (0, logger_1.logInfo)('trip_lifecycle', {
            bookingId: cmd.bookingId,
            action: cmd.action,
        });
        return { ok: true, analyticsHint };
    });
});
async function handleNoShow(uid, cmd) {
    await firebase_1.db.runTransaction(async (tx) => {
        const bookingRef = firebase_1.db.collection('bookings').doc(cmd.bookingId);
        const snap = await tx.get(bookingRef);
        if (!snap.exists)
            throw new https_1.HttpsError('not-found', 'Booking not found');
        const booking = snap.data();
        if (booking.assignedDriverId !== uid) {
            throw new https_1.HttpsError('permission-denied', 'Not assigned driver');
        }
        const waitingStartedAt = booking.waitingStartedAt
            ? new Date(booking.waitingStartedAt).getTime()
            : 0;
        const minWaitMs = 10 * 60_000; // policy default — configurable later
        if (!waitingStartedAt || Date.now() - waitingStartedAt < minWaitMs) {
            throw new https_1.HttpsError('failed-precondition', 'No-show locked until minimum wait after authoritative arrival');
        }
        // Require at least one contact attempt event
        const contacts = await tx.get(bookingRef.collection('events').where('type', '==', 'CONTACT_ATTEMPT').limit(1));
        // Note: txn get on query may be limited in some environments; also check count field
        const contactCount = booking.contactAttemptCount ?? contacts.size;
        if (contactCount < 1) {
            throw new https_1.HttpsError('failed-precondition', 'No-show requires logged contact attempts');
        }
        (0, contracts_1.assertBookingTransition)(booking.currentStatus, 'PASSENGER_NO_SHOW');
        const now = (0, time_1.nowIso)();
        tx.update(bookingRef, {
            currentStatus: 'PASSENGER_NO_SHOW',
            statusVersion: (booking.statusVersion ?? 0) + 1,
            updatedAt: now,
        });
        const eventId = (0, ids_1.newId)('evt');
        tx.set(bookingRef.collection('events').doc(eventId), {
            eventId,
            bookingId: cmd.bookingId,
            type: 'PASSENGER_NO_SHOW',
            actorUid: uid,
            timestamp: now,
            source: 'DRIVER_APP',
            previousStatus: booking.currentStatus,
            nextStatus: 'PASSENGER_NO_SHOW',
            idempotencyKey: cmd.idempotencyKey,
            location: cmd.location ?? null,
        });
    });
    return { ok: true };
}
async function captureAfterComplete(bookingId, idempotencyKey) {
    const payments = await firebase_1.db
        .collection('payments')
        .where('bookingId', '==', bookingId)
        .limit(1)
        .get();
    if (payments.empty)
        return;
    const paymentDoc = payments.docs[0];
    const payment = paymentDoc.data();
    if (payment.state === 'CAPTURED')
        return;
    if (payment.paymentMode === 'stripe' && payment.liveCharge) {
        // Live path when configured
    }
    const adapter = (0, adapter_1.getPaymentAdapter)();
    const captured = await adapter.capture(payment.providerIntentId, `${idempotencyKey}_capture`);
    const now = (0, time_1.nowIso)();
    await firebase_1.db.runTransaction(async (tx) => {
        const bookingRef = firebase_1.db.collection('bookings').doc(bookingId);
        const b = await tx.get(bookingRef);
        if (!b.exists)
            return;
        const booking = b.data();
        if (booking.currentStatus === 'COMPLETED') {
            (0, contracts_1.assertBookingTransition)('COMPLETED', 'PAYMENT_CAPTURED');
            tx.update(bookingRef, {
                currentStatus: 'PAYMENT_CAPTURED',
                paymentStatus: 'CAPTURED',
                statusVersion: (booking.statusVersion ?? 0) + 1,
                updatedAt: now,
            });
        }
        else {
            tx.update(bookingRef, { paymentStatus: 'CAPTURED', updatedAt: now });
        }
        tx.update(paymentDoc.ref, {
            state: captured.state,
            updatedAt: now,
            lastProviderEvent: 'capture',
        });
        // Driver payout ledger entry (manual settle if no provider)
        const ledgerId = (0, ids_1.newId)('pl');
        tx.set(firebase_1.db.collection('payout_ledger').doc(ledgerId), {
            ledgerId,
            driverId: booking.assignedDriverId,
            bookingId,
            amountMinor: booking.driverPayoutMinor,
            currency: booking.currency,
            status: 'PENDING_MANUAL_SETTLEMENT',
            notice: 'Payout recorded in ledger. Direct transfer only when payout provider configured.',
            createdAt: now,
        });
    });
    (0, logger_1.logInfo)('payment_captured', { bookingId, mode: payment.paymentMode });
}
//# sourceMappingURL=lifecycle.js.map
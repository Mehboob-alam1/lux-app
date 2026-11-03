"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmBooking = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const logger_1 = require("../util/logger");
const enqueueDispatch_1 = require("../dispatch/enqueueDispatch");
const adapter_1 = require("../notifications/adapter");
exports.confirmBooking = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'booking:create');
    const parsed = contracts_1.ConfirmBookingCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, 'confirmBooking', ctx.uid, async () => {
        const bookingId = (0, ids_1.newId)('bkg');
        await firebase_1.db.runTransaction(async (tx) => {
            const quoteRef = firebase_1.db.collection('quotes').doc(cmd.quoteId);
            const paymentRef = firebase_1.db.collection('payments').doc(cmd.paymentId);
            const quoteSnap = await tx.get(quoteRef);
            const paymentSnap = await tx.get(paymentRef);
            if (!quoteSnap.exists)
                throw new https_1.HttpsError('not-found', 'Quote not found');
            if (!paymentSnap.exists) {
                throw new https_1.HttpsError('not-found', 'Payment not found');
            }
            const quote = quoteSnap.data();
            const payment = paymentSnap.data();
            if (quote.customerUid !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Not your quote');
            }
            if (payment.customerUid !== ctx.uid) {
                throw new https_1.HttpsError('permission-denied', 'Not your payment');
            }
            if (payment.quoteId !== cmd.quoteId) {
                throw new https_1.HttpsError('failed-precondition', 'Payment/quote mismatch');
            }
            if (payment.state !== 'AUTHORIZED') {
                throw new https_1.HttpsError('failed-precondition', 'Payment not authorized');
            }
            if (quote.redemptionState !== 'OPEN') {
                throw new https_1.HttpsError('failed-precondition', 'Quote not open');
            }
            if ((0, time_1.isExpired)(quote.expiresAt)) {
                tx.update(quoteRef, { redemptionState: 'EXPIRED' });
                throw new https_1.HttpsError('failed-precondition', 'Quote expired');
            }
            const now = (0, time_1.nowIso)();
            const booking = {
                bookingId,
                customerUid: quote.customerUid,
                bookerUid: cmd.bookerUid,
                passengerProfileId: cmd.passengerProfileId ?? null,
                source: 'CUSTOMER',
                marketId: quote.marketId,
                itinerary: quote.itinerary,
                tripContext: quote.tripContext,
                scheduledAt: quote.scheduledAt ?? null,
                passengers: quote.fit.passengers,
                luggage: quote.fit.luggage,
                classId: quote.selectedClass,
                addons: quote.addons ?? [],
                priceKind: quote.priceKind,
                customerPriceMinor: quote.totalMinor,
                driverPayoutMinor: quote.driverPayoutMinor,
                currency: quote.currency,
                quoteId: cmd.quoteId,
                currentStatus: 'ASSIGNMENT_PENDING',
                statusVersion: 1,
                assignmentId: null,
                assignedDriverId: null,
                riskState: 'NORMAL',
                paymentStatus: 'AUTHORIZED',
                incidentStatus: 'NONE',
                cancellationActor: null,
                airport: quote.airport ?? null,
                fleetCompanyId: null,
                travelAgencyId: null,
                assuranceStatus: 'SECURING_VEHICLE',
                createdAt: now,
                updatedAt: now,
            };
            const eventId = (0, ids_1.newId)('evt');
            tx.set(firebase_1.db.collection('bookings').doc(bookingId), booking);
            tx.set(firebase_1.db
                .collection('bookings')
                .doc(bookingId)
                .collection('events')
                .doc(eventId), {
                eventId,
                bookingId,
                type: 'BOOKING_CREATED',
                actorUid: ctx.uid,
                actorRole: 'CUSTOMER',
                timestamp: now,
                source: 'CUSTOMER_APP',
                previousStatus: 'PAYMENT_AUTHORIZED',
                nextStatus: 'ASSIGNMENT_PENDING',
                reason: 'Customer confirmed booking after authorization',
                idempotencyKey: cmd.idempotencyKey,
            });
            tx.update(quoteRef, { redemptionState: 'REDEEMED' });
            tx.update(paymentRef, {
                bookingId,
                updatedAt: now,
            });
            tx.set(firebase_1.db.collection('audit_logs').doc((0, ids_1.newId)('aud')), {
                auditId: (0, ids_1.newId)('aud'),
                actorUid: ctx.uid,
                actorRole: 'CUSTOMER',
                marketId: quote.marketId,
                action: 'booking.confirm',
                entityType: 'booking',
                entityId: bookingId,
                bookingId,
                timestamp: now,
            });
        });
        await (0, enqueueDispatch_1.enqueueDispatch)(bookingId);
        await (0, adapter_1.notifyBookingEvent)({
            userId: ctx.uid,
            bookingId,
            template: 'booking_created',
            title: 'Journey received',
            body: 'We are securing your vehicle.',
            critical: true,
        });
        (0, logger_1.logInfo)('booking_created', { bookingId, quoteId: cmd.quoteId });
        return {
            bookingId,
            currentStatus: 'ASSIGNMENT_PENDING',
            assuranceStatus: 'SECURING_VEHICLE',
            analyticsHint: 'booking_created',
        };
    });
});
//# sourceMappingURL=confirmBooking.js.map
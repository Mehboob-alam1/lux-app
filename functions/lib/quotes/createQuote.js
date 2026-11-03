"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createQuote = void 0;
const https_1 = require("firebase-functions/v2/https");
const contracts_1 = require("@lux/contracts");
const crypto_1 = require("crypto");
const firebase_1 = require("../firebase");
const guards_1 = require("../security/guards");
const ids_1 = require("../util/ids");
const time_1 = require("../util/time");
const pricing_1 = require("./pricing");
const logger_1 = require("../util/logger");
/** Haversine fallback when Maps adapter unavailable — marked ESTIMATED. */
function estimateKm(a, b) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la1 = (a.lat * Math.PI) / 180;
    const la2 = (b.lat * Math.PI) / 180;
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
}
exports.createQuote = (0, https_1.onCall)({ region: 'us-central1' }, async (request) => {
    (0, guards_1.assertAppCheck)(request);
    const ctx = await (0, guards_1.requireAuth)(request);
    (0, guards_1.requirePermission)(ctx, 'quote:create');
    const parsed = contracts_1.CreateQuoteCommandSchema.safeParse(request.data);
    if (!parsed.success) {
        throw new https_1.HttpsError('invalid-argument', parsed.error.message);
    }
    const cmd = parsed.data;
    if (cmd.customerUid !== ctx.uid && !ctx.roles.some((r) => r.startsWith('ADMIN_'))) {
        throw new https_1.HttpsError('permission-denied', 'Cannot quote for another customer');
    }
    return (0, guards_1.withIdempotency)(cmd.idempotencyKey, 'createQuote', ctx.uid, async () => {
        const market = await firebase_1.db.collection('markets').doc(cmd.marketId).get();
        if (!market.exists || !market.data()?.active) {
            throw new https_1.HttpsError('failed-precondition', 'Market unavailable');
        }
        if (market.data()?.bookingPaused) {
            throw new https_1.HttpsError('failed-precondition', 'Bookings paused in this market');
        }
        const fit = (0, contracts_1.evaluateVehicleFit)(cmd.selectedClass, {
            passengers: cmd.passengers,
            luggage: cmd.luggage,
            stroller: cmd.stroller,
            oversized: cmd.oversized,
        });
        if (!fit.ok) {
            throw new https_1.HttpsError('failed-precondition', fit.reason, {
                suggestedClasses: fit.suggestedClasses,
            });
        }
        const pickup = cmd.itinerary.find((s) => s.kind === 'PICKUP');
        const dropoff = cmd.itinerary.find((s) => s.kind === 'DROPOFF');
        if (!pickup || !dropoff) {
            throw new https_1.HttpsError('invalid-argument', 'Pickup and dropoff required');
        }
        const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.ROUTES_API_KEY;
        let distanceKm = estimateKm(pickup.place.location, dropoff.place.location);
        let durationMin = Math.max(10, Math.round(distanceKm * 2.2));
        let priceKind = 'FIXED';
        let mapsStatus = 'OK';
        if (!mapsKey) {
            mapsStatus = 'UNAVAILABLE';
            // Without routes provider we still quote but mark ESTIMATED (honest)
            priceKind = 'ESTIMATED';
        }
        const extraStops = cmd.itinerary.filter((s) => s.kind === 'STOP').length;
        const priced = (0, pricing_1.priceItinerary)({
            distanceKm,
            durationMin,
            classId: cmd.selectedClass,
            airport: cmd.tripContext === 'AIRPORT' || Boolean(cmd.airport),
            extraStops,
            addons: cmd.addons,
        });
        const quoteId = (0, ids_1.newId)('quo');
        const createdAt = (0, time_1.nowIso)();
        const expiresAt = (0, time_1.addMinutesIso)(15);
        const body = {
            quoteId,
            customerUid: cmd.customerUid,
            marketId: cmd.marketId,
            itinerary: cmd.itinerary,
            fit: {
                passengers: cmd.passengers,
                luggage: cmd.luggage,
                stroller: cmd.stroller ?? false,
                oversized: cmd.oversized ?? false,
            },
            selectedClass: cmd.selectedClass,
            components: priced.components,
            priceKind,
            totalMinor: priced.totalMinor,
            currency: priced.currency,
            ruleVersion: priced.ruleVersion,
            expiresAt,
            driverPayoutMinor: priced.driverPayoutMinor,
            redemptionState: 'OPEN',
            tripContext: cmd.tripContext,
            addons: cmd.addons,
            ...(cmd.airport ? { airport: cmd.airport } : {}),
            scheduledAt: cmd.scheduledAt ?? null,
            mapsStatus,
            createdAt,
        };
        const immutableHash = (0, crypto_1.createHash)('sha256')
            .update(JSON.stringify(body))
            .digest('hex');
        const doc = { ...body, immutableHash };
        await firebase_1.db.collection('quotes').doc(quoteId).set(doc);
        (0, logger_1.logInfo)('quote_created', {
            quoteId,
            marketId: cmd.marketId,
            totalMinor: priced.totalMinor,
            priceKind,
            mapsStatus,
        });
        return {
            quote: doc,
            analyticsHint: 'quote_viewed',
            paymentMode: process.env.PAYMENT_MODE ?? 'sandbox',
        };
    });
});
//# sourceMappingURL=createQuote.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const eligibility_1 = require("./eligibility");
const base = {
    driverId: 'd1',
    vehicleId: 'v1',
    classIds: ['COMFORT'],
    status: 'ACTIVE',
    onlineState: 'ONLINE',
    documentEligibilityOk: true,
    vehicleApproved: true,
    capacityPassengers: 3,
    capacityLuggage: 2,
    marketIds: ['yyz'],
    lat: 43.65,
    lng: -79.38,
    reliability: 0.9,
};
const input = {
    marketId: 'yyz',
    classId: 'COMFORT',
    passengers: 2,
    luggage: 1,
    pickup: { lat: 43.66, lng: -79.39 },
};
(0, vitest_1.describe)('dispatch eligibility', () => {
    (0, vitest_1.it)('rejects ineligible vehicle docs', () => {
        (0, vitest_1.expect)((0, eligibility_1.evaluateEligibility)({ ...base, documentEligibilityOk: false }, input).ok).toBe(false);
    });
    (0, vitest_1.it)('ranks nearer higher reliability first', () => {
        const ranked = (0, eligibility_1.rankCandidates)([
            { ...base, driverId: 'far', lat: 44, lng: -79, reliability: 0.99 },
            { ...base, driverId: 'near', lat: 43.651, lng: -79.381, reliability: 0.8 },
        ], input);
        (0, vitest_1.expect)(ranked[0].driverId).toBe('near');
    });
});
//# sourceMappingURL=eligibility.test.js.map
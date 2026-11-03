"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const pricing_1 = require("./pricing");
(0, vitest_1.describe)('pricing engine', () => {
    (0, vitest_1.it)('prices comfort trip in minor units', () => {
        const q = (0, pricing_1.priceItinerary)({
            distanceKm: 10,
            durationMin: 20,
            classId: 'COMFORT',
            airport: false,
            extraStops: 0,
            addons: [],
        });
        (0, vitest_1.expect)(Number.isInteger(q.totalMinor)).toBe(true);
        (0, vitest_1.expect)(q.totalMinor).toBeGreaterThan(0);
        (0, vitest_1.expect)(q.driverPayoutMinor).toBeLessThan(q.totalMinor);
    });
    (0, vitest_1.it)('applies airport fee and minimum', () => {
        const q = (0, pricing_1.priceItinerary)({
            distanceKm: 1,
            durationMin: 5,
            classId: 'COMFORT',
            airport: true,
            extraStops: 0,
            addons: ['MEET_AND_GREET'],
        });
        (0, vitest_1.expect)(q.components.some((c) => c.code === 'AIRPORT')).toBe(true);
        (0, vitest_1.expect)(q.components.some((c) => c.code === 'ADDON_MEET_AND_GREET')).toBe(true);
    });
    (0, vitest_1.it)('executive costs more than comfort for same itinerary', () => {
        const base = {
            distanceKm: 15,
            durationMin: 25,
            airport: false,
            extraStops: 0,
            addons: [],
        };
        const comfort = (0, pricing_1.priceItinerary)({ ...base, classId: 'COMFORT', addons: [] });
        const exec = (0, pricing_1.priceItinerary)({ ...base, classId: 'EXECUTIVE', addons: [] });
        (0, vitest_1.expect)(exec.totalMinor).toBeGreaterThan(comfort.totalMinor);
    });
});
//# sourceMappingURL=pricing.test.js.map
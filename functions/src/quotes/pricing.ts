import {
  AddonType,
  VehicleClassId,
  assertMinor,
  roundHalfEvenMinor,
} from '@lux/contracts';

export type PricingRule = {
  ruleVersion: string;
  currency: string;
  baseMinor: number;
  minimumMinor: number;
  perKmMinor: number;
  perMinuteMinor: number;
  airportFeeMinor: number;
  waitingIncludedMinutes: number;
  waitingPerMinuteMinor: number;
  extraStopMinor: number;
  addonFees: Partial<Record<AddonType, number>>;
  classMultipliers: Partial<Record<VehicleClassId, number>>;
};

/** Demo/emulator defaults only — not production commercial rates (D012). */
export const DEMO_PRICING_YYZ: PricingRule = {
  ruleVersion: 'yyz-demo-v1',
  currency: 'CAD',
  baseMinor: 3500,
  minimumMinor: 4500,
  perKmMinor: 220,
  perMinuteMinor: 80,
  airportFeeMinor: 1200,
  waitingIncludedMinutes: 15,
  waitingPerMinuteMinor: 100,
  extraStopMinor: 1000,
  addonFees: {
    CHILD_SEAT: 1500,
    MEET_AND_GREET: 2500,
    LUGGAGE_HELP: 500,
    QUIET_RIDE: 0,
    LANGUAGE_ASSIST: 0,
    ACCESSIBILITY: 0,
  },
  classMultipliers: {
    COMFORT: 1,
    EXECUTIVE: 1.35,
    FIRST_CLASS: 1.8,
    LUXURY_SUV: 1.55,
    VIP_SPRINTER: 2.4,
    LIMO_COACH: 3.2,
  },
};

export type QuoteComponentsInput = {
  distanceKm: number;
  durationMin: number;
  classId: VehicleClassId;
  airport: boolean;
  extraStops: number;
  addons: AddonType[];
  rule?: PricingRule;
};

export type PricedQuote = {
  components: { code: string; label: string; amountMinor: number }[];
  totalMinor: number;
  currency: string;
  ruleVersion: string;
  driverPayoutMinor: number;
};

/**
 * Server-side pricing. Distance/duration must come from trusted adapter or estimate.
 * Uses integer minor units throughout.
 */
export function priceItinerary(input: QuoteComponentsInput): PricedQuote {
  const rule = input.rule ?? DEMO_PRICING_YYZ;
  const mult = rule.classMultipliers[input.classId] ?? 1;
  const components: PricedQuote['components'] = [];

  const base = assertMinor(rule.baseMinor);
  components.push({ code: 'BASE', label: 'Base fare', amountMinor: base });

  const distance = assertMinor(
    roundHalfEvenMinor(input.distanceKm * rule.perKmMinor * mult),
  );
  components.push({
    code: 'DISTANCE',
    label: 'Distance',
    amountMinor: distance,
  });

  const duration = assertMinor(
    roundHalfEvenMinor(input.durationMin * rule.perMinuteMinor * mult),
  );
  components.push({
    code: 'DURATION',
    label: 'Time',
    amountMinor: duration,
  });

  if (input.airport) {
    components.push({
      code: 'AIRPORT',
      label: 'Airport fee',
      amountMinor: assertMinor(rule.airportFeeMinor),
    });
  }

  if (input.extraStops > 0) {
    components.push({
      code: 'STOPS',
      label: 'Extra stops',
      amountMinor: assertMinor(input.extraStops * rule.extraStopMinor),
    });
  }

  for (const addon of input.addons) {
    const fee = rule.addonFees[addon] ?? 0;
    if (fee > 0) {
      components.push({
        code: `ADDON_${addon}`,
        label: addon,
        amountMinor: assertMinor(fee),
      });
    }
  }

  let total = components.reduce((s, c) => s + c.amountMinor, 0);
  if (total < rule.minimumMinor) {
    const topUp = rule.minimumMinor - total;
    components.push({
      code: 'MINIMUM_TOPUP',
      label: 'Booking minimum',
      amountMinor: assertMinor(topUp),
    });
    total = rule.minimumMinor;
  }

  // Separate driver payout estimate (not customer fare) — demo split 70%
  const driverPayoutMinor = assertMinor(roundHalfEvenMinor(total * 0.7));

  return {
    components,
    totalMinor: assertMinor(total),
    currency: rule.currency,
    ruleVersion: rule.ruleVersion,
    driverPayoutMinor,
  };
}

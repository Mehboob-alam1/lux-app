import { onCall } from 'firebase-functions/v2/https';
import { db } from '../firebase';
import { assertAppCheck, requireAuth, requirePermission } from '../security/guards';
import { nowIso } from '../util/time';
import { logInfo } from '../util/logger';

/**
 * Idempotent catalog seed for demo markets / classes / pricing.
 * Required before createQuote works on a fresh Firebase project.
 */
export const ensureDemoCatalog = onCall(
  { region: 'us-central1' },
  async (request) => {
    assertAppCheck(request);
    const ctx = await requireAuth(request);
    requirePermission(ctx, 'booking:assign');

    const now = nowIso();
    const batch = db.batch();

    batch.set(
      db.collection('markets').doc('yyz'),
      {
        marketId: 'yyz',
        displayName: 'Toronto (Demo)',
        timezone: 'America/Toronto',
        currency: 'CAD',
        active: true,
        bookingPaused: false,
        enabledContexts: ['STANDARD', 'AIRPORT', 'BUSINESS', 'FAMILY'],
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    const classes = [
      { id: 'COMFORT', passengers: 3, luggage: 2 },
      { id: 'EXECUTIVE', passengers: 3, luggage: 2 },
      { id: 'FIRST_CLASS', passengers: 3, luggage: 2 },
      { id: 'LUXURY_SUV', passengers: 5, luggage: 5 },
      { id: 'VIP_SPRINTER', passengers: 12, luggage: 12 },
      { id: 'LIMO_COACH', passengers: 20, luggage: 20 },
    ];
    for (const c of classes) {
      batch.set(
        db.collection('vehicle_classes').doc(c.id),
        {
          id: c.id,
          displayName: c.id.replace('_', ' '),
          capacityPassengers: c.passengers,
          capacityLuggage: c.luggage,
          active: true,
        },
        { merge: true },
      );
    }

    batch.set(
      db.collection('pricing_rules').doc('yyz-demo-v1'),
      {
        ruleVersion: 'yyz-demo-v1',
        marketId: 'yyz',
        notice: 'DEMO ONLY — not production commercial rates',
        currency: 'CAD',
        baseMinor: 3500,
        minimumMinor: 4500,
        perKmMinor: 220,
        perMinuteMinor: 80,
        airportFeeMinor: 1200,
        effectiveFrom: now,
      },
      { merge: true },
    );

    batch.set(
      db.collection('policy_versions').doc('yyz-wait-v1'),
      {
        marketId: 'yyz',
        waitingIncludedMinutes: 15,
        noShowMinWaitMinutes: 10,
        quoteExpiryMinutes: 15,
      },
      { merge: true },
    );

    batch.set(
      db.collection('airports').doc('YYZ'),
      {
        airportId: 'YYZ',
        marketId: 'yyz',
        name: 'Toronto Pearson',
        terminals: ['1', '3'],
      },
      { merge: true },
    );

    batch.set(
      db.collection('system_health').doc('global'),
      {
        status: 'NORMAL',
        listenersFresh: true,
        updatedAt: now,
        notice: 'Demo catalog ensured',
      },
      { merge: true },
    );

    await batch.commit();
    logInfo('demo_catalog_ensured', { marketId: 'yyz', by: ctx.uid });
    return { ok: true, marketId: 'yyz', classes: classes.length };
  },
);

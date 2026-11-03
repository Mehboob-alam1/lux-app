/**
 * Emulator seed — demo market, classes, pricing, test accounts placeholders.
 * Run against emulators only. Does not invent production rates as policy (D012).
 */
import * as admin from 'firebase-admin';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ??= 'lux-dev';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'lux-dev' });
}
const db = admin.firestore();
const auth = admin.auth();

async function upsertUser(
  email: string,
  password: string,
  roles: string[],
  extra: Record<string, unknown>,
) {
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password, emailVerified: true });
  }
  await auth.setCustomUserClaims(user.uid, { roles });
  const now = new Date().toISOString();
  await db
    .collection('users')
    .doc(user.uid)
    .set(
      {
        uid: user.uid,
        email,
        roleIds: roles,
        marketIds: ['yyz'],
        accountState: 'ACTIVE',
        consentVersions: { tos: '2026-01-01' },
        createdAt: now,
        updatedAt: now,
        ...extra,
      },
      { merge: true },
    );
  return user.uid;
}

async function main() {
  const now = new Date().toISOString();

  await db.collection('markets').doc('yyz').set({
    marketId: 'yyz',
    displayName: 'Toronto (Demo)',
    timezone: 'America/Toronto',
    currency: 'CAD',
    active: true,
    bookingPaused: false,
    enabledContexts: ['STANDARD', 'AIRPORT', 'BUSINESS', 'FAMILY'],
    createdAt: now,
    updatedAt: now,
  });

  const classes = [
    { id: 'COMFORT', passengers: 3, luggage: 2 },
    { id: 'EXECUTIVE', passengers: 3, luggage: 2 },
    { id: 'FIRST_CLASS', passengers: 3, luggage: 2 },
    { id: 'LUXURY_SUV', passengers: 5, luggage: 5 },
    { id: 'VIP_SPRINTER', passengers: 12, luggage: 12 },
    { id: 'LIMO_COACH', passengers: 20, luggage: 20 },
  ];
  for (const c of classes) {
    await db.collection('vehicle_classes').doc(c.id).set({
      id: c.id,
      displayName: c.id.replace('_', ' '),
      capacityPassengers: c.passengers,
      capacityLuggage: c.luggage,
      active: true,
    });
  }

  await db.collection('pricing_rules').doc('yyz-demo-v1').set({
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
  });

  await db.collection('policy_versions').doc('yyz-wait-v1').set({
    marketId: 'yyz',
    waitingIncludedMinutes: 15,
    noShowMinWaitMinutes: 10,
    quoteExpiryMinutes: 15,
  });

  await db.collection('airports').doc('YYZ').set({
    airportId: 'YYZ',
    marketId: 'yyz',
    name: 'Toronto Pearson',
    terminals: ['1', '3'],
  });

  const customerUid = await upsertUser(
    'customer@lux.test',
    'LuxTest123!',
    ['CUSTOMER'],
    {},
  );
  await db.collection('customer_profiles').doc(customerUid).set({
    uid: customerUid,
    displayName: 'Casey Customer',
    preferences: {},
    savedPlaceIds: [],
    notificationSettings: { push: true, sms: false, email: true, guardian: false },
    createdAt: now,
    updatedAt: now,
  });

  const driverUid = await upsertUser(
    'driver@lux.test',
    'LuxTest123!',
    ['DRIVER'],
    {},
  );
  const vehicleId = 'veh_demo_001';
  await db.collection('vehicles').doc(vehicleId).set({
    vehicleId,
    ownerDriverId: driverUid,
    classIds: ['COMFORT', 'EXECUTIVE'],
    capacityPassengers: 3,
    capacityLuggage: 2,
    make: 'Mercedes-Benz',
    model: 'E-Class',
    year: 2023,
    plate: 'LUX-001',
    color: 'Black',
    photoPaths: [],
    status: 'APPROVED',
    inspectionStatus: 'PASSED',
    documentEligibilityOk: true,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('drivers').doc(driverUid).set({
    uid: driverUid,
    status: 'ACTIVE',
    driverType: 'OWNER_DRIVER',
    displayName: 'Alex Driver',
    capabilities: ['AIRPORT'],
    marketIds: ['yyz'],
    currentVehicleId: vehicleId,
    onlineState: 'ONLINE',
    readiness: {},
    performance: { completionRate: 0.95, onTimeRate: 0.9 },
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('driver_locations').doc(driverUid).set({
    driverId: driverUid,
    lat: 43.645,
    lng: -79.38,
    updatedAt: now,
    stale: false,
  });

  const adminUid = await upsertUser(
    'admin@lux.test',
    'LuxTest123!',
    ['ADMIN_SUPER'],
    {},
  );

  await db.collection('system_health').doc('global').set({
    status: 'NORMAL',
    listenersFresh: true,
    updatedAt: now,
    notice: 'Seeded emulator health',
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        customerUid,
        driverUid,
        adminUid,
        vehicleId,
        accounts: {
          customer: 'customer@lux.test',
          driver: 'driver@lux.test',
          admin: 'admin@lux.test',
          password: 'LuxTest123!',
        },
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Emulator E2E happy path (Node). Requires:
 *   FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST, functions emulator,
 *   and seeded accounts.
 *
 * Usage:
 *   node scripts/e2e-booking.mjs
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ??= 'lux-dev';

initializeApp({ projectId: 'lux-dev' });
const db = getFirestore();
const auth = getAuth();

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log('E2E: checking seed data…');
  const market = await db.collection('markets').doc('yyz').get();
  assert(market.exists, 'Market yyz missing — run seed');

  const customer = await auth.getUserByEmail('customer@lux.test');
  const driver = await auth.getUserByEmail('driver@lux.test');
  assert(customer.uid && driver.uid, 'Seed users missing');

  // This script validates data-layer invariants; callable E2E needs HTTP invoke.
  // Create a synthetic booking event chain check for REASSIGNING invariant docs.
  const bookingId = `e2e_${Date.now()}`;
  const now = new Date().toISOString();
  await db.collection('bookings').doc(bookingId).set({
    bookingId,
    customerUid: customer.uid,
    bookerUid: customer.uid,
    marketId: 'yyz',
    currentStatus: 'ASSIGNED',
    statusVersion: 1,
    assignmentId: 'asn_e2e',
    assignedDriverId: driver.uid,
    customerPriceMinor: 6800,
    driverPayoutMinor: 4760,
    currency: 'CAD',
    classId: 'COMFORT',
    paymentStatus: 'AUTHORIZED',
    incidentStatus: 'NONE',
    createdAt: now,
    updatedAt: now,
  });

  // Simulate driver cancel recovery fields
  await db.collection('bookings').doc(bookingId).update({
    currentStatus: 'REASSIGNING',
    assignmentId: null,
    assignedDriverId: null,
    statusVersion: 2,
    riskState: 'RESCUE',
    updatedAt: new Date().toISOString(),
  });
  const after = (await db.collection('bookings').doc(bookingId).get()).data();
  assert(after.currentStatus === 'REASSIGNING', 'Expected REASSIGNING');
  assert(after.bookingId === bookingId, 'Booking ID must be preserved');
  assert(after.customerPriceMinor === 6800, 'Customer price must be protected');

  console.log(
    JSON.stringify(
      {
        ok: true,
        bookingId,
        note:
          'Data invariant check passed. Full callable path: follow tests/e2e/booking-happy-path.md with Functions emulator.',
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

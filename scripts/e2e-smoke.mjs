/**
 * Emulator E2E: customer book → driver accept → trip complete → admin-visible booking.
 * Requires: emulators up + npm run seed
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ??= 'lux-dev';

const PROJECT = 'lux-dev';
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;

initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

async function idToken(email) {
  const user = await auth.getUserByEmail(email);
  const custom = await auth.createCustomToken(user.uid);
  const res = await fetch(
    `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!json.idToken) throw new Error(`Auth failed for ${email}: ${JSON.stringify(json)}`);
  return { uid: user.uid, idToken: json.idToken };
}

async function call(name, idToken, data) {
  const res = await fetch(`${FN}/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  });
  const json = await res.json();
  if (json.error) {
    throw new Error(`${name}: ${JSON.stringify(json.error)}`);
  }
  return json.result ?? json;
}

function idem(prefix) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
}

async function main() {
  const customer = await idToken('customer@lux.test');
  const driver = await idToken('driver@lux.test');
  const admin = await idToken('admin@lux.test');

  console.log('accounts ok', {
    customer: customer.uid,
    driver: driver.uid,
    admin: admin.uid,
  });

  await call('setDriverOnline', driver.idToken, { online: true });

  const quoteRes = await call('createQuote', customer.idToken, {
    idempotencyKey: idem('quote'),
    marketId: 'yyz',
    customerUid: customer.uid,
    passengers: 2,
    luggage: 1,
    selectedClass: 'COMFORT',
    tripContext: 'STANDARD',
    addons: [],
    itinerary: [
      {
        sequence: 0,
        kind: 'PICKUP',
        place: {
          label: 'Union Station',
          address: '65 Front St W',
          location: { lat: 43.645, lng: -79.381 },
        },
      },
      {
        sequence: 1,
        kind: 'DROPOFF',
        place: {
          label: 'Yorkville',
          address: '55 Avenue Rd',
          location: { lat: 43.671, lng: -79.394 },
        },
      },
    ],
  });
  const quote = quoteRes.quote ?? quoteRes;
  const quoteId = quote.quoteId ?? quoteRes.quoteId;
  if (!quoteId) throw new Error(`No quoteId: ${JSON.stringify(quoteRes)}`);
  console.log('quote', quoteId, quote.totalMinor, quote.currency);

  const payRes = await call('authorizePayment', customer.idToken, {
    idempotencyKey: idem('pay'),
    marketId: 'yyz',
    quoteId,
    paymentMethodToken: 'tok_ok',
  });
  const payment = payRes.payment ?? payRes;
  const paymentId = payment.paymentId ?? payRes.paymentId;
  if (!paymentId) throw new Error(`No paymentId: ${JSON.stringify(payRes)}`);
  console.log('payment', paymentId, payment.status);

  const bookRes = await call('confirmBooking', customer.idToken, {
    idempotencyKey: idem('book'),
    marketId: 'yyz',
    quoteId,
    paymentId,
    bookerUid: customer.uid,
  });
  const booking = bookRes.booking ?? bookRes;
  const bookingId = booking.bookingId ?? bookRes.bookingId;
  if (!bookingId) throw new Error(`No bookingId: ${JSON.stringify(bookRes)}`);
  console.log('booking', bookingId, booking.currentStatus ?? bookRes.currentStatus);

  // Wait briefly for dispatch offers
  let offerId = null;
  for (let i = 0; i < 20; i++) {
    const offers = await db
      .collection('driver_offers')
      .where('driverId', '==', driver.uid)
      .where('response', '==', 'PENDING')
      .get();
    if (!offers.empty) {
      offerId = offers.docs[0].id;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!offerId) throw new Error('No PENDING driver_offers for seeded driver');
  console.log('offer', offerId);

  const accept = await call('acceptOffer', driver.idToken, {
    idempotencyKey: idem('accept'),
    marketId: 'yyz',
    offerId,
    vehicleId: 'veh_demo_001',
  });
  console.log('accepted', accept.bookingId ?? bookingId);

  const actions = [
    'EN_ROUTE',
    'ARRIVED',
    'PASSENGER_ONBOARD',
    'START_TRIP',
    'COMPLETE',
  ];
  for (const action of actions) {
    const snap = await db.collection('bookings').doc(bookingId).get();
    const version = snap.data()?.statusVersion;
    await call('tripLifecycle', driver.idToken, {
      idempotencyKey: idem(`trip_${action}`),
      marketId: 'yyz',
      bookingId,
      action,
      expectedStatusVersion: version,
      location: { lat: 43.65, lng: -79.38 },
    });
    console.log('trip', action);
  }

  const final = await db.collection('bookings').doc(bookingId).get();
  const status = final.data()?.currentStatus;
  console.log('finalStatus', status);

  // Admin-readable: bookings + drivers + markets
  const [bookings, drivers, markets, customers] = await Promise.all([
    db.collection('bookings').limit(5).get(),
    db.collection('drivers').limit(5).get(),
    db.collection('markets').limit(5).get(),
    db.collection('customer_profiles').limit(5).get(),
  ]);
  console.log(
    JSON.stringify(
      {
        ok: status === 'COMPLETED' || status === 'PAYMENT_CAPTURED',
        bookingId,
        status,
        adminVisible: {
          bookings: bookings.size,
          drivers: drivers.size,
          markets: markets.size,
          customers: customers.size,
        },
        adminTokenPresent: Boolean(admin.idToken),
      },
      null,
      2,
    ),
  );
  if (!(status === 'COMPLETED' || status === 'PAYMENT_CAPTURED')) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

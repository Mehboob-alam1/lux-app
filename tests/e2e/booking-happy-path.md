# Manual / scripted E2E — happy path

**Status:** NOT automated in CI yet. Run against emulators after seed.

## Setup

```bash
npm run build:contracts && npm run build:functions
npx firebase emulators:start --only auth,firestore,functions,storage
# other terminal
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export GCLOUD_PROJECT=lux-dev
export PAYMENT_MODE=sandbox
npm run seed -w @lux/functions
```

## Steps

1. Auth customer@lux.test → refresh ID token with roles claim  
2. `createQuote` with yyz pickup/dropoff, COMFORT, fit 2/1  
3. `authorizePayment` with paymentMethodToken `tok_ok`  
4. `confirmBooking` → note bookingId, status ASSIGNMENT_PENDING  
5. Auth driver@lux.test → list driver_offers → `acceptOffer` with veh_demo_001  
6. `tripLifecycle` EN_ROUTE → ARRIVED → START_WAIT → PASSENGER_ONBOARD → START_TRIP → COMPLETE  
7. Assert booking PAYMENT_CAPTURED, payment CAPTURED, payout_ledger PENDING_MANUAL_SETTLEMENT  
8. Negative: driverCancel after assign → REASSIGNING, same bookingId  
9. Guest: `createGuestLink` → `resolveGuestLink` must omit price fields  

Record results in IMPLEMENTATION_MATRIX before marking X1 DONE.

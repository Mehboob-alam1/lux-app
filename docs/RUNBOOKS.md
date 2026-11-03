# Operational Runbooks (MVP)

## Emulator local booking smoke

1. Start emulators + seed  
2. Auth as customer → `createQuote` → `authorizePayment` (token ≠ `fail`) → `confirmBooking`  
3. Auth as driver → `acceptOffer` with approved vehicle  
4. `tripLifecycle` EN_ROUTE → ARRIVED → START_WAIT → PASSENGER_ONBOARD → START_TRIP → COMPLETE  
5. Verify `paymentStatus=CAPTURED`, payout ledger `PENDING_MANUAL_SETTLEMENT`  
6. Second path: after ASSIGNED, `driverCancelAssignment` → status `REASSIGNING`, same bookingId, new offers  

## Payment sandbox vs live

- `PAYMENT_MODE=sandbox` (default): no live charges; UI must show sandbox notice  
- `PAYMENT_MODE=stripe` requires `STRIPE_SECRET_KEY` + webhook secret; refuse otherwise  

## Stale live location

- `staleLocationsJob` marks `driver_locations.stale`  
- Admin/Customer must show freshness warning — never hide  

## Document expiry

- `documentExpiryJob` sets docs EXPIRED and `vehicles.documentEligibilityOk=false`  
- Online / accept / trip start must fail  

## Emergency booking pause

- Set `markets/{id}.bookingPaused=true` via admin market settings (permission `system:emergency_pause`)  
- `createQuote` rejects  

## Incident vs support vs dispute

- Safety → `incidents` (restricted)  
- Help → `support_cases`  
- Claim/adjudication → `disputes` with separate decision vs remedy fields  

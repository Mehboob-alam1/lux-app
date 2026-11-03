# LUX Callable / HTTPS Command Contracts

All money: integer minor units + ISO currency. All timestamps: UTC ISO-8601.  
Clients send `idempotencyKey` on high-impact commands.

| Command | Type | Permission | Input (summary) | Effects |
|---------|------|------------|-----------------|---------|
| `provisionUser` | callable | authenticated | role CUSTOMER\|DRIVER, displayName, consent | users + profile/driver, claims |
| `createQuote` | callable | quote:create | itinerary, fit, class, market, addons | quotes OPEN; fit enforced |
| `authorizePayment` | callable | payment:authorize | quoteId, paymentMethodToken | payments AUTHORIZED or fail; sandbox notice |
| `confirmBooking` | callable | booking:create | quoteId, paymentId | redeem quote; booking ASSIGNMENT_PENDING; dispatch offers |
| `acceptOffer` | callable | DRIVER | offerId, vehicleId | assignment ACCEPTED; booking ASSIGNED; siblings expired |
| `driverCancelAssignment` | callable | DRIVER assigned | bookingId, assignmentId, reason, kind | assignment CANCELLED; booking **REASSIGNING**; rescue; redispatch |
| `tripLifecycle` | callable | DRIVER assigned | action EN_ROUTE…COMPLETE / CONTACT / NO_SHOW | status+event; capture on COMPLETE |
| `updateDriverLocation` | callable | DRIVER | lat/lng, bookingId? | driver_locations; state-gated |
| `adminAssignBooking` | callable | booking:assign | driverId, vehicleId, reason | audited assign; price protected |
| `createGuestLink` | callable | booking owner/admin | bookingId | guest_links hash; raw token once |
| `resolveGuestLink` | HTTPS | token | linkId, t | scoped guest JSON — **no prices/PII** |
| `bootstrapAdmin` | HTTPS | ALLOW_ADMIN_BOOTSTRAP | uid, roles | dev only |

Scheduled: `expireQuotesJob`, `staleLocationsJob`, `unassignedAgingJob`, `documentExpiryJob`.

Shared Zod schemas: `@lux/contracts` (`commands.ts`, `schemas.ts`).

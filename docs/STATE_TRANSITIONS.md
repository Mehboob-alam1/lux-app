# Booking State Transition Table

See `packages/contracts/src/booking-state.ts` for authoritative graph.

## Orthogonal fields

| Field | Purpose |
|-------|---------|
| `currentStatus` | Operational journey position |
| `paymentStatus` | NONE → AUTHORIZED → CAPTURED / FAILED / refunds |
| `incidentStatus` | NONE / OPEN / RESOLVED (do not overwrite journey with INCIDENT) |
| `cancellationActor` | Who cancelled the **customer booking** (null on driver assignment cancel) |

## Driver cancel

Event type `DRIVER_CANCELLED` is written; `currentStatus` becomes `REASSIGNING`. Same `bookingId` preserved. Customer price protected during rescue.

## PAYMENT_CAPTURED

Financial completion after operational `COMPLETED` (or policy exception). Not proof of journey by itself.

## Happy path

DRAFT → QUOTED → PAYMENT_AUTHORIZED → BOOKED → ASSIGNMENT_PENDING → ASSIGNED → DRIVER_EN_ROUTE → DRIVER_ARRIVED → WAITING → PASSENGER_ONBOARD → IN_PROGRESS → COMPLETED → PAYMENT_CAPTURED

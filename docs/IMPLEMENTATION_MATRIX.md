# LUX Implementation Matrix

**Status legend:** `NOT_STARTED` | `PARTIAL` | `DONE` | `BLOCKED`  
**Rule:** Never mark `DONE` without automated or documented manual E2E evidence for release-critical paths.

Updated: 2026-11-03 (Customer+Driver UI/wiring landed; emulator E2E still blocked on Java)

| ID | Requirement | Status | Notes |
|----|-------------|--------|-------|
| P0 scaffold / docs / placeholders | DONE | |
| C1–C5 contracts / dictionary / APIs | DONE | unit tests ✓ |
| S1–S4 rules + guards | PARTIAL | written; emulator rules tests pending |
| S5 Admin MFA | BLOCKED | Identity Platform |
| Q1 pricing | DONE | unit ✓ |
| PAY1 sandbox adapter | DONE | unit ✓ |
| PAY2 Stripe webhooks | BLOCKED | needs Stripe secrets |
| PAY3 capture on complete | PARTIAL | code ✓; emulator E2E pending |
| PAY4 refunds | PARTIAL | `refundPayment` callable + Admin UI |
| PAY5 payout ledger | PARTIAL | manual settlement notice |
| B1–B3 booking/dispatch/reassign | PARTIAL | code ✓; E2E pending |
| B5 customer change→requote | PARTIAL | `requestBookingChange` |
| T1–T3 trip/location | PARTIAL | code ✓ |
| T4 offline queue | PARTIAL | Driver `OfflineQueue` implemented |
| CA* Customer UI + Firebase facade | PARTIAL | lime UI + Auth/quote/pay wiring; needs emulator |
| DA* Driver UI + online/offers/trip | PARTIAL | lime UI + callables; needs emulator |
| AD* Admin modules | DONE (emu) | Auth + live Firestore modules; Fleets/Agencies placeholders only |
| N1 notifications | PARTIAL | FCM/SMS/email adapter + attempt logs |
| Guest link | PARTIAL | CF + `public/guest/index.html` |
| J1 scheduled jobs | PARTIAL | defined |
| X1/X2 E2E | BLOCKED | needs Java for Firestore emulator |
| X3 CI | PARTIAL | workflow present |
| OUT Fleet/Agency product | N/A | next update only |

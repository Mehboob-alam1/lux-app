# LUX Phased Implementation Plan

Execution order per master prompt. After each phase: files changed, tests run, blockers, next tasks.

## Phase 0 — Audit & scaffolding

- [x] REPO_AUDIT.md / DECISIONS.md / matrix / plan
- [x] Monorepo roots, env templates, CI skeleton
- [x] Placeholder fleet/agency apps
- [x] README with commands and status

## Phase 1 — Architecture & contracts ✅ (unit tested)

- [x] Roles, permissions matrix
- [x] Booking state machine + transition graph
- [x] Zod schemas for in-scope collections
- [x] Data dictionary, API/command contracts
- [x] Unit tests: transitions, money, fit, RBAC

## Phase 2 — Firebase security & auth ✅ (rules written; emulator rule tests pending)

- [x] Auth custom claims + server role cross-check
- [x] firestore.rules / storage.rules (default deny)
- [x] App Check verification hooks (soft unless enforced)
- [x] Callable guard + idempotency utilities
- [x] Emulator seed accounts script

## Phase 3 — Data model & seeds ✅ definitions

- [x] Indexes, seed script, TTL notes in dictionary
- [x] Collection ownership map in DATA_DICTIONARY

## Phase 4 — Quotes & payments ✅ sandbox (live BLOCKED)

- [x] Pricing rules engine (server-only)
- [x] Immutable quotes + expiry job
- [x] Sandbox payment adapter (+ unit tests)
- [ ] Stripe webhook idempotency (needs credentials)
- [x] Payout ledger on capture (manual settlement)

## Phase 5 — Booking & dispatch ✅ code (E2E pending)

- [x] Create booking from redeemed quote
- [x] Offer/assignment accept (transactional)
- [x] Driver cancel → REASSIGNING + redispatch
- [x] Idempotency keys

## Phase 6 — Driver execution & live tracking ✅ code (E2E pending)

- [x] Lifecycle transitions + capture
- [x] Location updates + stale job
- [x] No-show gates (wait + contact)
- [ ] Offline event queue in Flutter

## Phase 7 — Customer Flutter app 🔄 shell

- [x] Navigation, book flow UI, honest empty/error
- [ ] Firebase Auth + callables wired end-to-end
- [ ] Live trip map / guest UI / full support flows
- **Blocker:** Flutter SDK not installed on host

## Phase 8 — Driver Flutter app 🔄 shell

- [x] Onboarding + My Day / Offers / Trips / Earnings / Safety nav
- [ ] Online eligibility callable + offline queue
- **Blocker:** Flutter SDK not installed on host

## Phase 9 — Admin Next.js 🔄

- [x] RBAC nav shell, Coming Soon fleets/agencies
- [x] Dashboard KPI links (no fake numbers)
- [x] Bookings live Firestore list + detail timeline
- [ ] Remaining modules wired to real queries/actions

## Phase 10 — Support, finance, analytics, jobs 🔄

- [x] Support case + safety escalate + dispute convert callables
- [x] Scheduled jobs defined
- [ ] Notification adapters / analytics aggregates

## Phase 11 — Hardening & acceptance 🔄

- [x] Unit tests contracts+functions; CI workflow; runbooks
- [ ] Emulator E2E automation (manual script documented)
- [ ] Release gate — **not claimed**

## Out of scope (do not implement)

Fleet Portal workflows, Travel Agency Portal workflows, memberships, predictive concierge, exact vehicle guarantee, automated multi-vehicle optimization, Build My Day advanced, embedded navigation.

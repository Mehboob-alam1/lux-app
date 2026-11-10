# LUX Premium Mobility — Complete Application Guide

This document explains **how the whole product works**: architecture, UI/UX per app, every major function, backend contracts, data, and **step-by-step usage for each user type**.

| Item | Value |
|------|--------|
| Product | LUX Premium Mobility |
| Firebase project (live) | `uberclone-6e4a0` |
| Functions region | `us-central1` |
| Demo market | `yyz` (Toronto) |
| Currency | CAD (minor units / cents) |
| Payment mode (current) | Sandbox (no live Stripe charge) |

Related technical docs: `ARCHITECTURE.md`, `API_CONTRACTS.md`, `STATE_TRANSITIONS.md`, `DATA_DICTIONARY.md`, `ROLE_PERMISSION_MATRIX.md`, `IMPLEMENTATION_MATRIX.md`.

---

## 1. Product overview

LUX is a **premium chauffeur / transfer** platform (not a street-hail marketplace). Customers book point-to-point or airport transfers at a quoted price. Drivers go online, receive offers, accept, and execute a strict trip lifecycle. Admins monitor operations, rescue unassigned bookings, and handle support/finance views.

### Who uses what

| User | App | Platform |
|------|-----|----------|
| Customer / booker | Customer app | Flutter (iOS / Android) |
| Driver / chauffeur | Driver app | Flutter (iOS / Android) |
| Ops / admin | Admin web | Next.js (`apps/admin_web`) |
| Guest (share link) | Guest HTML page | Static (`public/guest`) |
| Fleet / Travel agency | Placeholders only | Out of scope this release |

### Core design rules

1. **Cloud Functions are the only writers** for bookings, payments, assignments, quotes, and sensitive state. Apps do **not** write those collections directly.
2. **Money** is always integer **minor units** + ISO currency (e.g. `12500` + `CAD` = $125.00).
3. **Idempotency keys** are sent on high-impact commands so retries do not double-book or double-charge.
4. **Roles** come from Firebase Auth custom claims + `users/{uid}.roleIds` (server cross-checks both).
5. **Booking status** and **payment status** are orthogonal (journey vs money).

---

## 2. System architecture

```
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│ Customer Flutter│  │ Driver Flutter  │  │ Admin Next.js    │
│ Auth + UI       │  │ Auth + UI       │  │ Auth + panels    │
└────────┬────────┘  └────────┬────────┘  └────────┬─────────┘
         │                    │                     │
         │   Firebase Auth + Callable HTTPS + Firestore listeners
         └────────────────────┼─────────────────────┘
                              ▼
                   ┌─────────────────────┐
                   │ Cloud Functions v2  │
                   │ (Node 22, Gen2)     │
                   └──────────┬──────────┘
                              │ Admin SDK
                   ┌──────────▼──────────┐
                   │ Firestore + Storage │
                   │ FCM / Scheduler     │
                   └─────────────────────┘
```

### Shared packages

| Package | Role |
|---------|------|
| `@lux/contracts` | Zod schemas, booking state machine, RBAC, vehicle fit, money helpers |
| `@lux/functions` | All callables, jobs, adapters (payments/notifications) |
| Vendored contracts | Copied into `functions/vendor/contracts` at deploy so Cloud Build can install offline |

### Environment modes

| Mode | How | Use |
|------|-----|-----|
| Live Firebase | Default for Flutter (`USE_EMULATORS=false`) | Real project `uberclone-6e4a0` |
| Emulators | `--dart-define=USE_EMULATORS=true` / admin `NEXT_PUBLIC_USE_EMULATORS=true` | Local Auth/Firestore/Functions |

---

## 3. Happy-path journey (all roles)

```
Customer signs in → createQuote → authorizePayment → confirmBooking
        → booking ASSIGNMENT_PENDING → dispatch creates driver_offers
Driver online → sees offer → acceptOffer → ASSIGNED
        → EN_ROUTE → ARRIVED → WAITING → PASSENGER_ONBOARD → IN_PROGRESS → COMPLETE
        → payment CAPTURED (sandbox)
Admin can rescue if stuck in ASSIGNMENT_PENDING / REASSIGNING
```

### Booking status happy path

`ASSIGNMENT_PENDING` → `ASSIGNED` → `DRIVER_EN_ROUTE` → `DRIVER_ARRIVED` → `WAITING` → `PASSENGER_ONBOARD` → `IN_PROGRESS` → `COMPLETED` → (payment) `PAYMENT_CAPTURED`

Driver cancel does **not** cancel the customer booking; status becomes `REASSIGNING` and dispatch retries.

---

## 4. Customer app (Flutter)

**Package:** `com.luxmobility.lux_customer`  
**Theme:** Light “lime” LUX chrome (lime accents, ink text, soft surfaces).  
**Entry:** Splash → Auth (if needed) → Home shell.

### 4.1 Navigation & screens

| Route | Screen | Purpose |
|-------|--------|---------|
| `/splash` | Splash | Init Firebase, route next |
| `/auth` | Sign in | Email/password + Google |
| `/auth/signup` | Sign up | Create account + provision CUSTOMER |
| `/auth/forgot` | Forgot password | Send reset email |
| `/auth/reset` | Reset password | Confirm new password with oob code |
| `/home` | Home | CTA to book + recent bookings |
| `/book` | Book flow | 4-step booking wizard |
| `/book/confirmed` | Confirmed | Success + booking id |
| `/trips` | Trips list | Live Firestore bookings for this customer |
| `/trips/:id` | Trip detail | Single booking detail |
| `/support` | Support | Open help / safety case |
| `/profile` | Profile | Name, account, sign out |

**Bottom tabs (shell):** Home · Trips · Support · Profile

### 4.2 UI / UX patterns

- Large bold titles, muted secondary text, lime primary buttons.
- Card-style rows for “New booking” and trip summaries.
- Book flow is a **wizard** (Route → When → Vehicle → Review) with step dots.
- Errors from Cloud Functions are mapped to readable messages (not raw stack traces in UI).
- Structured logs in console: `LUX {…}` / `LUX_ERROR {…}` (no emails/phones in fields).

### 4.3 Auth & provisioning

1. User signs in with **email/password** or **Google**.
2. App calls callable `provisionUser` with `role: CUSTOMER`.
3. Server creates (if new):
   - `users/{uid}` with `roleIds: ['CUSTOMER']`, `accountState: ACTIVE`
   - `customer_profiles/{uid}`
   - Auth custom claims `{ roles: ['CUSTOMER'] }`
4. App refreshes ID token so claims apply to later callables.

**Forgot / reset password** use Firebase Auth email flows.

### 4.4 Booking flow (step by step for the customer)

1. Open app → sign in (or sign up).
2. Home → **New booking**.
3. **Step 1 — Route**
   - Choose pickup/dropoff from catalog chips, or search (Places API when Remote Config `google_maps_api_key` / `places_api_key` is set; otherwise catalog filter).
   - Route preview shows haversine distance/ETA; with a Maps key from Remote Config it uses Google Static Maps.
   - Cannot continue until both are set.
4. **Step 2 — When**
   - Pick date/time (scheduled transfer).
5. **Step 3 — Vehicle**
   - Choose class (e.g. COMFORT, EXECUTIVE, LUXURY_SUV…).
   - Set passengers / luggage.
   - Optional airport meet & greet / flight number when airport context.
6. **Step 4 — Review**
   - App calls `createQuote` → shows total (sandbox notice if applicable).
   - Confirm → `authorizePayment` (token `tok_ok` in sandbox) → `confirmBooking`.
7. **Confirmed** screen shows `bookingId`.
8. Trips tab lists bookings; open a trip for detail.

### 4.5 Support (customer)

1. Support tab → subject + message.
2. Calls `createSupportCase` (`HELP` or safety escalate).
3. Cases appear under `support_cases` owned by the user (listener).

### 4.6 What the customer cannot do (by design)

- Write booking/payment status to Firestore.
- See other customers’ bookings.
- Capture or refund payments.
- Force-assign a driver.

---

## 5. Driver app (Flutter)

**Package:** `com.luxmobility.lux_driver`  
**Theme:** Same LUX lime system, driver-focused copy.  
**Entry:** Onboarding → Auth → My Day shell.

### 5.1 Navigation & screens

| Route | Screen | Purpose |
|-------|--------|---------|
| `/onboarding` | Onboarding | First-run intro → auth |
| `/auth` / signup / forgot / reset | Auth | Same patterns as customer, role DRIVER |
| `/my-day` | My Day | Online toggle + active trip shortcut |
| `/opportunities` | Offers | Pending `driver_offers` |
| `/trips` | Trips | Assigned bookings history/list |
| `/earnings` | Earnings | Earnings placeholder / post-trip landing |
| `/more` | More | Links to profile, performance, docs, safety |
| `/profile` | Profile | Account / sign out |
| `/active-trip/:id` | Active trip | Lifecycle actions |
| `/performance` | Performance | Stats shell |
| `/vehicle-docs` | Vehicle & docs | Upload checklist docs + live approval status |
| `/help-safety` | Help & safety | Safety shell |

**Bottom tabs:** My Day · Offers · Trips · Earnings · More

### 5.2 Auth & provisioning (driver)

1. Sign in / sign up / Google.
2. `provisionUser` with `role: DRIVER`.
3. Demo mode (default `LUX_DEMO_AUTO_APPROVE` not `false`) creates:
   - `users/{uid}` ACTIVE
   - `drivers/{uid}` **ACTIVE**, offline
   - Approved `vehicles/{veh_…}` linked as `currentVehicleId`
   - Seed `driver_locations` near Toronto
4. Claims `{ roles: ['DRIVER'] }`.
5. Before Online / trip callables, app calls **`ensureProvisioned()`** so older sessions (created before IAM worked) get repaired automatically.

### 5.3 Go online (step by step)

1. Sign in as driver.
2. **My Day** → toggle Online **ON** (pings device GPS when permitted; otherwise Toronto demo fallback).
3. App:
   - Ensures provisioned
   - Best-effort `updateDriverLocation`
   - Calls `setDriverOnline({ online: true })`
4. Server eligibility checks:
   - Driver `status === ACTIVE`
   - Has `currentVehicleId`
   - Vehicle `status === APPROVED`
   - `documentEligibilityOk === true`
5. On success: `onlineState: ONLINE` — driver is eligible for dispatch.

Toggle **OFF** sets `OFFLINE` (always allowed).

### 5.4 Accept an offer

1. Customer must have confirmed a booking while (or before) drivers are online.
2. Dispatch creates up to 5 time-limited `driver_offers` for ranked eligible drivers.
3. Driver opens **Offers** → sees PENDING offers.
4. Tap **Accept offer**:
   - Loads driver’s vehicle
   - Calls `acceptOffer(offerId, vehicleId)`
5. Server (transaction):
   - Marks offer accepted
   - Creates `assignments/{asn_…}`
   - Sets booking `ASSIGNED` + `assignedDriverId`
   - Expires sibling offers
6. App navigates to **Active trip**.

### 5.5 Execute the trip (lifecycle)

On **Active trip**, the UI shows **only the next valid steps** for the live `currentStatus` (server still validates):

| Status | Primary action(s) |
|--------|-------------------|
| `ASSIGNED` | `EN_ROUTE` |
| `DRIVER_EN_ROUTE` | `ARRIVED` |
| `DRIVER_ARRIVED` | `PASSENGER_ONBOARD` (+ optional `START_WAIT`, `CONTACT_ATTEMPT`, `PASSENGER_NO_SHOW`) |
| `WAITING` | `PASSENGER_ONBOARD` (+ `PASSENGER_NO_SHOW`) |
| `PASSENGER_ONBOARD` | `START_TRIP` |
| `IN_PROGRESS` | `COMPLETE` |

Each step:
- Pings location via `updateDriverLocation`
- Calls `tripLifecycle` with the Cloud Function action name above

**Cancel assignment:** soft/hard cancel via `driverCancelAssignment` → booking becomes `REASSIGNING` (customer booking kept; redispatch).

### 5.6 Driver UX notes

- New drivers are **PENDING** until they **upload** licence / insurance / registration / inspection on **Vehicle & docs**, ops **approves each file** + **vehicle**, then marks document eligibility. Only then does status become **ACTIVE** and Online work.
- Online switch is the operational “heartbeat” gate (reads live `drivers/{uid}.onlineState`).
- Offers list is live (Firestore query on `driverId` + `PENDING`).
- Active trip is guided by status — not a raw dump of every lifecycle button.
- Errors like “User profile not provisioned” mean Auth exists but Firestore profile was missing — fixed by ensure-provision on Online.

---

## 6. Admin web (Next.js)

**App:** `apps/admin_web`  
**Auth:** Email/password create + sign-in, Google (redirect).  
**Shell:** Left nav + module pages; live Firestore tables where wired.

### 6.1 Navigation modules

| Path | Label | What it does today |
|------|-------|--------------------|
| `/` | Dashboard | KPI links / overview |
| `/live` | Live Operations | Live ops view |
| `/bookings` | Bookings | List + detail timeline |
| `/assignment` | Assignment & Rescue | Unassigned / REASSIGNING + manual assign + **Ensure demo catalog** |
| `/customers` | Customers | Customer records |
| `/drivers` | Drivers | Driver records |
| `/vehicles` | Vehicles | Vehicles |
| `/airports` | Airports | Airport config |
| `/events` | Events | Events module |
| `/pricing` | Pricing | Pricing rules view |
| `/payments` | Payments | Payments |
| `/payouts` | Payouts | Payout ledger notices |
| `/support` | Help & Support | Support cases |
| `/disputes` | Disputes | Disputes |
| `/incidents` | Incidents & Safety | Safety incidents |
| `/documents` | Documents | Document review |
| `/analytics` | Analytics | Analytics |
| `/markets` | Markets & Settings | Markets |
| `/fleets` | Fleets | **Coming soon** (disabled) |
| `/agencies` | Agencies | **Coming soon** (disabled) |
| `/login` | Login | Auth |

### 6.2 Admin step-by-step: first-time live setup

1. Configure `.env.local` with live Firebase web config (`NEXT_PUBLIC_USE_EMULATORS=false`).
2. `npm run dev -w @lux/admin-web` → http://localhost:3000/login
3. Sign in / sign up on `/login`. The console calls **`ensureAdminAccess`** which
   grants `ADMIN_SUPER` (first admin, email allowlist, or demo self-provision) and
   refreshes the ID token so Firestore listeners work.
   - Lock down later: set Functions env `ALLOW_ADMIN_SELF_PROVISION=false` and
     `ADMIN_EMAIL_ALLOWLIST=you@company.com`.
   - Legacy: HTTPS `bootstrapAdmin` only if `ALLOW_ADMIN_BOOTSTRAP=true`.
4. Open **Assignment & Rescue** → click **Ensure demo catalog**  
   - Seeds market `yyz`, vehicle classes, pricing rule, airport YYZ, system health.
5. Monitor bookings / rescue as needed.

### 6.3 Admin step-by-step: rescue assign

1. Booking stuck in `ASSIGNMENT_PENDING` or `REASSIGNING` (no driver accepted).
2. Assignment page lists those bookings.
3. Click **Assign / rescue** → enter **Driver UID** and **Vehicle ID**.
4. Calls `adminAssignBooking` (audited, customer price protected).

### 6.4 Admin UX

- Operational panels, status pills, empty states when no rows.
- Structured browser console logs: `{"app":"admin_web",…}`.
- Fleets/Agencies explicitly disabled with “Coming in next update”.

---

## 7. Guest journey

1. Authorized party calls `createGuestLink` for a `bookingId` (owner/admin).
2. Receives one-time raw token (stored hashed).
3. Guest opens:  
   `apps/admin_web/public/guest/index.html?linkId=…&t=…`
4. `resolveGuestLink` returns **scoped** trip info — **no prices / no full PII**.

---

## 8. Backend — Cloud Functions (complete list)

All Gen2, region `us-central1`, codebase `lux`.

### 8.1 Auth & bootstrap

| Function | Type | Who | What |
|----------|------|-----|------|
| `provisionUser` | callable | Authenticated | Create/repair user + customer or driver (+ demo vehicle) |
| `bootstrapAdmin` | HTTPS | Env-gated | Dev-only set admin roles |
| `ensureDemoCatalog` | callable | Admin (`booking:assign`) | Idempotent seed market/classes/pricing |

### 8.2 Quote → pay → book

| Function | Permission | What |
|----------|------------|------|
| `createQuote` | `quote:create` | Fit check, distance estimate, price, store quote |
| `authorizePayment` | `payment:authorize` | Sandbox/Stripe authorize against quote |
| `confirmBooking` | `booking:create` | Redeem quote, create booking, enqueue dispatch |
| `requestBookingChange` | customer/admin | Requote change request path |

### 8.3 Dispatch & trip

| Function | Who | What |
|----------|-----|------|
| `acceptOffer` | Driver | Accept offer → assignment → ASSIGNED |
| `driverCancelAssignment` | Assigned driver | Cancel assignment → REASSIGNING + redispatch |
| `adminAssignBooking` | Admin assign | Manual/rescue assign |
| `tripLifecycle` | Assigned driver | Advance trip / contact / no-show / complete + capture |
| `updateDriverLocation` | Driver | Write `driver_locations` (state-gated if bookingId set) |
| `setDriverOnline` | Driver | Eligibility gate → ONLINE/OFFLINE |

### 8.4 Support & finance

| Function | What |
|----------|------|
| `createSupportCase` | Open help/safety case (+ optional incident) |
| `convertSupportToDispute` | Escalate support → dispute |
| `reportLostItem` / `updateLostItemStatus` | Lost item workflow |
| `refundPayment` | Refund path (admin/finance) |
| `createGuestLink` / `resolveGuestLink` | Guest share links |

### 8.5 Scheduled jobs

| Job | Cadence | Purpose |
|-----|---------|---------|
| `expireQuotesJob` | every 5 min | Expire open quotes |
| `staleLocationsJob` | every 5 min | Mark stale driver locations |
| `unassignedAgingJob` | every 5 min | Age unassigned bookings / alerts |
| `documentExpiryJob` | hourly | Document eligibility expiry |

### 8.6 Adapters

- **Payments:** sandbox adapter (live Stripe webhook path blocked without secrets).
- **Notifications:** adapter records attempts (FCM/SMS/email wiring partial).

### 8.7 Security guards

- `requireAuth` — Auth + `users/{uid}` must exist; accountState checked; roles from DB.
- `requirePermission` — RBAC from `@lux/contracts`.
- `assertAppCheck` — only enforced if `APPCHECK_ENFORCE=true` (off by default).
- `withIdempotency` — stores response under `idempotency_keys`.

### 8.8 Runtime IAM (live)

Functions Gen2 runtime SA (`PROJECT_NUMBER-compute@developer.gserviceaccount.com`) needs at least:

- `roles/datastore.user` (Firestore)
- `roles/firebase.admin` / `roles/firebaseauth.admin` (claims)
- Build SA roles for Cloud Build / Artifact Registry (deploy)

Without Datastore access, clients see `[firebase_functions/internal] INTERNAL`.

---

## 9. Data model (Firestore) — what each collection is for

| Collection | Purpose |
|------------|---------|
| `users` | Account, roles, markets, accountState |
| `customer_profiles` | Customer display/prefs/notifications |
| `drivers` | Driver status, onlineState, vehicle link, performance |
| `vehicles` | Class capacity, approval, documentEligibilityOk |
| `vehicle_classes` | Catalog capacities |
| `markets` / `airports` / `pricing_rules` / `policy_versions` | Config for quoting |
| `quotes` | Immutable priced offers until redeem/expiry |
| `bookings` | Journey + price + assignment pointers |
| `bookings/*/events` | Append-only timeline |
| `assignments` | Driver/vehicle assignment records |
| `driver_offers` | Time-limited offers to drivers |
| `driver_locations` | Latest lat/lng (short TTL) |
| `payments` / refunds / payout ledger | Money side |
| `support_cases` / incidents / disputes / lost_items | Care & safety |
| `guest_links` | Hashed guest tokens |
| `idempotency_keys` | Replay protection |
| `system_health` | Ops health doc |

**Clients listen (read)** where rules allow; **mutations** go through Functions.

---

## 10. End-to-end test script (manual)

Use **two accounts** (different emails) + optional admin.

### A. Prep

1. Customer app + Driver app installed/running against live Firebase.
2. Admin: Ensure demo catalog once.
3. Hot-restart apps after backend/IAM changes.

### B. Driver first (recommended)

1. Driver: sign up / sign in.
2. My Day → Online **ON** → expect `ONLINE`.
3. Leave app on Offers tab.

### C. Customer books

1. Customer: sign in.
2. Book → route → time → EXECUTIVE (or other class) → Review → quote → confirm.
3. Expect confirmed `bookingId`.

### D. Driver accepts & completes

1. Offer appears → Accept.
2. Active trip: EN_ROUTE → ARRIVED → WAITING → PASSENGER_ONBOARD → IN_PROGRESS → COMPLETE.
3. Customer trip shows completed; payment captured in sandbox.

### E. Admin rescue (if no offer)

1. Assignment page → booking pending.
2. Assign with driver UID + vehicle ID from Firestore Console.

### F. Support smoke

1. Customer Support → open a case.
2. Admin Support module shows it (if wired to collection).

---

## 11. Logging & debugging

| Layer | Format | Where |
|-------|--------|-------|
| Customer / Driver | `LUX {"level","app","event",…}` | Flutter run console / Logcat |
| Admin | JSON `app: admin_web` | Browser DevTools |
| Functions | JSON `app: functions` | Cloud Logging / `firebase functions:log` |

Useful events: `firebase_ready`, `user_provision`, `create_quote_ok/fail`, `set_driver_online`, `accept_offer`, `trip_lifecycle`.

App Check warning `No AppCheckProvider installed` is **expected** while `APPCHECK_ENFORCE` is not `true`; it is not the cause of failures when enforcement is off.

---

## 12. Known limits / out of scope (this release)

| Area | Status |
|------|--------|
| Live Stripe charges + webhooks | Blocked without Stripe secrets |
| Google Maps / Routes live ETA | Falls back to haversine estimate |
| Admin MFA | Blocked (Identity Platform) |
| Fleet Portal / Travel Agency Portal | Placeholder only |
| Exact vehicle guarantee / multi-vehicle optimization | Out of scope |
| Predictive concierge / Build My Day advanced | Out of scope |
| Full offline queue for driver | Partial / not fully productized |
| Production document compliance review UI | Shell / partial |

---

## 13. How each user “uses LUX” — quick cards

### Customer

> Sign in → Book transfer → Get quote → Confirm (sandbox pay) → Track in Trips → Message Support if needed.

### Driver

> Sign in → Go Online → Accept offer → Advance trip statuses → Complete (or cancel assignment for reassign).

### Admin

> Sign in → Ensure catalog → Watch bookings/live → Rescue assign if needed → Work support/payments modules.

### Guest

> Open guest link → See limited trip status (no price/PII dump).

---

## 14. Repository map (for developers)

```
apps/customer_flutter/     Customer Flutter app
apps/driver_flutter/       Driver Flutter app
apps/admin_web/            Admin Next.js + guest static page
functions/                 Cloud Functions (src → lib)
packages/contracts/        Shared Zod / state / RBAC
docs/                      This guide + architecture contracts
scripts/                   E2E helpers, vendor-contracts, seed-live-catalog
```

### Common commands

```bash
# Install / build
npm install
npm run build:contracts && npm run build:functions

# Emulators + seed
npx firebase emulators:start --only auth,firestore,functions,storage
npm run seed
npm run e2e:smoke

# Deploy functions (live)
firebase deploy --only functions --project uberclone-6e4a0 --force

# Seed live catalog (Owner token / or Admin UI button)
npm run seed:live-catalog

# Flutter
cd apps/customer_flutter && flutter run
cd apps/driver_flutter && flutter run

# Admin
npm run dev -w @lux/admin-web
```

---

*Document generated for the LUX monorepo as implemented on Firebase project `uberclone-6e4a0`. Keep in sync with `IMPLEMENTATION_MATRIX.md` when marking features DONE.*

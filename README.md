# LUX Premium Mobility

Firebase monorepo: **Customer** (Flutter), **Driver** (Flutter), **Admin** (Next.js), Cloud Functions.

Fleet Portal / Travel Agency Portal = **placeholders only** (next update).

## Status

| Area | Status |
|------|--------|
| Contracts / state machine / RBAC / pricing unit tests | DONE |
| Cloud Functions (quote→pay→book→offer→trip→capture, cancel→REASSIGNING, guest, support, refund, online gate, requote request, notifications) | DONE (code) |
| Customer UI (lime mockup system) + Firebase wiring | DONE (needs emulator for live) |
| Driver UI (lime) + online/offers/trip/offline queue | DONE (needs emulator for live) |
| Admin panel (Auth + live Firestore modules; Fleets/Agencies placeholders) | DONE (emulator) |
| Emulator E2E full callable path (`npm run e2e:smoke`) | DONE |
| Live Stripe / Maps / MFA | BLOCKED without credentials |

## Prerequisites

- Node 20+
- Flutter 3.24+
- Java 21+ (Firestore emulator)
- Optional: Stripe, Maps, SMS/email secrets

```bash
cp .env.example .env.local
```

## Install & unit tests

```bash
npm install
npm run build:contracts && npm run build:functions
npm run test:contracts && npm run test:functions
npm run build:admin
```

## Emulators + seed

```bash
npm run build:functions
npx firebase emulators:start --only auth,firestore,functions,storage
# other terminal
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080
export FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
export GCLOUD_PROJECT=lux-dev
npm run seed
npm run e2e:smoke
```

Seed accounts: `customer@lux.test` / `driver@lux.test` / `admin@lux.test` — `LuxTest123!`

`e2e:smoke` runs the documented path: `createQuote → authorizePayment → confirmBooking → acceptOffer → tripLifecycle → COMPLETE/PAYMENT_CAPTURED`.

Functions require **Node 22** (pin in `functions/package.json`) — the emulator rejects `>=20` ranges.

## Apps

```bash
# Admin (uses apps/admin_web/.env.local with NEXT_PUBLIC_USE_EMULATORS=true)
npm run dev -w @lux/admin-web
# Sign in: admin@lux.test / LuxTest123!

# Customer / Driver — default USE_EMULATORS=true (Auth/Firestore/Functions → 10.0.2.2 on Android emu)
export PATH="$HOME/development/flutter/bin:$PATH"
export ANDROID_HOME="$HOME/Library/Android/sdk"
cd apps/customer_flutter && flutter pub get && flutter run
cd apps/driver_flutter && flutter pub get && flutter run
# Physical device: --dart-define=FIREBASE_EMU_HOST=<your-lan-ip>
```

### Android Studio

1. Install **Flutter** + **Dart** plugins.
2. **File → Open** → `apps/customer_flutter` (or `apps/driver_flutter`) — open the Flutter root, not only `android/`.
3. Select an emulator/device → Run `main.dart`.

- Customer package: `com.luxmobility.lux_customer`
- Driver package: `com.luxmobility.lux_driver`

Guest journey page: `apps/admin_web/public/guest/index.html?linkId=…&t=…`

## Docs

See `docs/IMPLEMENTATION_MATRIX.md`, `docs/PHASED_PLAN.md`, `docs/DECISIONS.md`.

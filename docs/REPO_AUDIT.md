# LUX Repository Audit

**Audit date:** 2026-11-03  
**Auditor:** Cursor implementation agent  
**Repo path:** `/Users/mac/Documents/lux`

## 1. Current state

| Area | Finding |
|------|---------|
| Git / remote | Empty directory; no existing code, apps, or Firebase config |
| Customer app | Absent — greenfield Flutter target |
| Driver app | Absent — greenfield Flutter target |
| Admin dashboard | Absent — greenfield Next.js + TypeScript target |
| Fleet Portal | Out of scope — placeholder only |
| Travel Agency Portal | Out of scope — placeholder only |
| Backend | Absent — Firebase stack to be created (Auth, Firestore, Functions v2, Storage, FCM, App Check, Emulators) |
| Tests / CI | Absent |
| Brand assets | None present |

## 2. Toolchain on this machine

| Tool | Status |
|------|--------|
| Node.js | v22.14.0 (usable) |
| npm | 10.9.2 (usable) |
| Firebase CLI | 14.23.0 (usable) |
| Dart | 3.6.1 (usable) |
| Flutter SDK | **Not installed / not on PATH** — blocker for running Flutter apps until installed |
| Java runtime | **Not installed** — required for Firebase Firestore emulator |
| pnpm / yarn | Not installed — use npm workspaces |

## 3. Reuse assessment

Nothing to reuse. Entire platform will be scaffolded per master prompt monorepo layout, adapted only if later tooling constraints require it.

## 4. Target layout (this update)

```
apps/customer_flutter/     # Customer Flutter app (IN SCOPE)
apps/driver_flutter/       # Driver Flutter app (IN SCOPE)
apps/admin_web/            # Admin Next.js dashboard (IN SCOPE)
apps/fleet_portal/         # PLACEHOLDER ONLY — next update
apps/travel_agency_portal/ # PLACEHOLDER ONLY — next update
functions/                 # Cloud Functions v2 (TypeScript)
packages/contracts/        # Shared Zod/TS contracts + Dart mirrors where generated
packages/ui_tokens/        # Design tokens
firebase/                  # Rules, indexes
scripts/                   # Seed, emulator, release helpers
tests/                     # Cross-cutting integration/e2e
docs/                      # Architecture, matrix, runbooks, decisions
```

## 5. Blockers / prerequisites

1. **Flutter SDK** must be installed to build/run mobile apps and widget tests.
2. **Java 21+** required for Firestore emulator locally.
3. **Firebase project(s)** (dev/staging/prod) + service account for non-emulator deploy.
4. **Payment provider credentials** (e.g. Stripe) — without them, sandbox/emulator adapter only; live charge claims blocked.
5. **Maps/Places/Routes API keys** — without them, adapters return explicit unavailable fallbacks.
6. **SMS/email provider** — optional; FCM primary; fallback only when configured.
7. **Identity Platform MFA** for admin — verify entitlement before claiming MFA complete.
8. **App Check** attestation providers (DeviceCheck/Play Integrity/reCAPTCHA) per environment.

## 6. Migrations

None — greenfield. Future migrations will live under `scripts/migrations/` with versioned Firestore schema notes in `docs/DATA_DICTIONARY.md`.

## 7. Recommendation

Proceed with npm workspaces monorepo, TypeScript contracts as source of truth, Flutter apps consuming mirrored Dart models, Firebase Emulator Suite as primary local verification path until credentials are supplied.

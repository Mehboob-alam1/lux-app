# LUX Architecture Decisions

Record of conservative, configurable defaults where source documents were ambiguous.

| ID | Date | Decision | Rationale | Configurable? |
|----|------|----------|-----------|---------------|
| D001 | 2026-11-03 | Replace NestJS/PostgreSQL/Redis reference backend with Firebase Auth + Firestore + Functions v2 + Storage + FCM + App Check + Emulators | Explicit project decision in master prompt | No (platform choice) |
| D002 | 2026-11-03 | npm workspaces monorepo (not pnpm/yarn) | Available on host; avoid extra package manager install | Yes later |
| D003 | 2026-11-03 | Default market seed: `yyz` (Toronto) demo market for emulator only; no claim of legal jurisdiction or licensed service regions | Sources do not prescribe region | Yes — markets collection |
| D004 | 2026-11-03 | Currency: CAD minor units (cents) for seed market; all money as integer minor units + ISO currency | Avoid float money; CAD common for YYZ demo | Per market |
| D005 | 2026-11-03 | Payment adapter: Stripe-shaped interface with **SandboxPaymentAdapter** default until live credentials exist; block live capture claims when `PAYMENT_MODE=sandbox` | Firebase is not a card processor; no hardcoded secrets | Yes — env |
| D006 | 2026-11-03 | Maps/Places/Routes via adapter; return `UNAVAILABLE` when keys missing — UI shows honest fallback | No fabricated ETAs | Yes — env |
| D007 | 2026-11-03 | Booking `currentStatus` uses operational journey graph; `paymentStatus`, `incidentStatus`, `cancellationActor` are orthogonal fields. Labels `INCIDENT` and `PAYMENT_FAILED` preserved as event vocabulary and overlay flags, not irreversible overwrite of journey history | Prevents loss of trip history | Documented in state machine |
| D008 | 2026-11-03 | `DRIVER_CANCELLED` records assignment cancellation event; booking transitions to `REASSIGNING` (never silent customer cancel) | Shared architecture invariant | Policy may allow terminal cancel only with explicit admin/customer action |
| D009 | 2026-11-03 | Fleet/Agency portals: empty route shells + README placeholders only | Hard scope boundary this update | Next update |
| D010 | 2026-11-03 | Driver type enum includes `FLEET_DRIVER` passively; only `OWNER_DRIVER` workflows implemented | Forward compatibility without fleet logic | Next update |
| D011 | 2026-11-03 | Admin MFA: wire Identity Platform MFA APIs when project entitlement confirmed; until then document as BLOCKED and do not fake MFA UX as complete | Never fake MFA | Requires Firebase Identity Platform |
| D012 | 2026-11-03 | Seed pricing rules are illustrative demo amounts for emulator tests only — not production rates | Sources forbid inventing payment rates as policy | Markets/pricing_rules |
| D013 | 2026-11-03 | Flight status adapter stub returns unavailable; airport readiness still works manually | No guaranteed flight integration | When provider configured |
| D014 | 2026-11-03 | Quote expiry default 15 minutes; waiting allowance defaults in policy_versions seed | Conservative demo defaults | Policy versions |
| D015 | 2026-11-03 | Sensitive mutations exclusively via callable/HTTPS Cloud Functions (Admin SDK); clients never write booking state/price/assignment/payment/approval | Security architecture | No |
| D016 | 2026-11-03 | TypeScript Zod contracts in `packages/contracts` are source of truth; Dart models hand-mirrored/generated under Flutter `lib/contracts` | Shared typed contracts without duplicating pricing/transitions in clients | Codegen later |
| D017 | 2026-11-03 | Default deny Firestore/Storage rules; minimum reads for owners/roles; guests via hashed guest_links token resolution in Functions | Least privilege | Rules files |
| D018 | 2026-11-03 | Cloud Tasks / scheduled functions for quote expiry, leave-by, doc expiry, unassigned aging, reconciliation | No endless CF loops | Scheduler |
| D019 | 2026-11-03 | Independent owner-driver payouts: ledger + manual settlement workflow when Connect/payout provider not configured; never pretend money sent | Honest finance | Env + market |
| D020 | 2026-11-03 | Deterministic dispatch ranking: ETA, distance, reliability score, schedule feasibility — no speculative AI matching in MVP | Master prompt | Feature flags later |
| D021 | 2026-11-03 | Customer UI design system: light off-white `#F6F6F4`, neon lime `#E2FF00`, black pill CTAs, large radii — per supplied mockups (replaces earlier dark/gold draft) | User-provided UI references | Tokens in `lux_colors.dart` / `ui_tokens` |

# LUX Enterprise UI/UX Enhancement — Gap Analysis & Phased Plan

**Created:** 2026-11-09  
**Rule:** Preserve booking/dispatch contracts. Real features only — no fake success.

---

## 1. Current state (verified)

| Area | Reality |
|------|---------|
| Contracts / state machine / RBAC | DONE (unit tested) |
| Cloud Functions quote→pay→book→offer→trip | DONE (deployed live) |
| Customer auth + book wizard | PARTIAL — works; UI basic; places are catalog picks not Maps |
| Driver online / offers / lifecycle | PARTIAL — works; lifecycle is raw button stack |
| Admin modules | PARTIAL — many list pages; assignment uses UID prompts |
| Design system | Thin — few colors, duplicated across apps |
| Forms | Basic TextFields — weak validation UX |
| Snackbars / toasts | Ad hoc SnackBar / inline notice strings |
| Profiles CRUD | Minimal (display name); no avatar/phone/prefs |
| Onboarding | Driver has shell; customer jumps to auth |
| Maps / Places / Routes | NOT wired (haversine fallback server-side) |
| FCM push UX | Adapter partial; no polished client prefs |
| Automated UI tests | Sparse |
| Stripe live | BLOCKED (secrets) |
| MFA admin | BLOCKED |

---

## 2. Priority gaps (P0 → P3)

### P0 — Reliability & trust (must not break)
- Keep callables + idempotency + eligibility gates
- Central error mapper (no raw Firebase to users) — partially done
- Provision repair before driver online — done
- Demo catalog / IAM — done for live

### P1 — Design system & feedback (this sprint start)
- Semantic color/typography/spacing tokens (both Flutter apps + admin)
- Reusable text fields, buttons, cards, dialogs
- Global snackbar / toast helper
- WCAG-minded contrast for lime-on-ink

### P2 — Auth, onboarding, profiles
- Customer onboarding carousel + completion flag
- Richer profile CRUD (Firestore via new callables where needed)
- Avatar Storage upload with rules
- Driver setup checklist tied to real eligibility

### P3 — Product surfaces
- Customer home / booking / trip polish
- Driver My Day / offers / guided active trip
- Admin tables, searchable assign, KPIs from real queries
- Maps when API keys present; graceful fallbacks otherwise

### P4 — Notifications, perf, security tests, E2E
- FCM deep links, rules tests, widget tests, matrix updates

---

## 3. Architectural dependencies

```
Design tokens/components
    → Auth/onboarding/profile screens
        → Customer booking UX
        → Driver trip UX
            → Maps (needs keys)
            → Admin ops UX
                → Notifications + tests
```

**Do not** introduce Maps SDK until keys are available — build map-ready widgets with fallback UI.

**Profile mutations** that touch roles/eligibility must stay CF-mediated.

---

## 4. Phase checklist

| Phase | Status | Deliverable |
|-------|--------|-------------|
| 1 Audit & plan | DONE | This document |
| 2 Design system | DONE | Tokens + form/snackbar/card/button components |
| 3 Auth / onboarding / profiles | DONE | updateMyProfile CF deployed; customer onboarding; driver eligibility checklist; profile CRUD via CF |
| 4 Customer app polish | DONE | Home/trips/detail/book/support + BookingUi status helpers |
| 5 Driver app polish | DONE | My Day live online; offers; guided tripLifecycle; trips/earnings |
| 6 Maps & location | DONE (graceful) | Route preview canvas always; Static Maps + Places when `--dart-define=GOOGLE_MAPS_API_KEY`; driver GPS via geolocator |
| 7 Admin dashboard | DONE | Live KPIs; searchable assign picker (no prompt UIDs) |
| 8 Notifications / perf / security | PENDING | |
| 9 Tests & polish | PENDING | |

---

## 5. Quick wins (implement first)

1. Unified semantic `LuxColors` / spacing / type scale  
2. `LuxTextField`, `LuxSnack`, primary/secondary buttons  
3. Align admin CSS variables with same token names  
4. Wire themes so existing screens inherit better defaults  

---

## 6. Explicit blockers

| Blocker | Impact |
|---------|--------|
| No Google Maps / Places API key in repo | Maps/autocomplete deferred |
| No Stripe secrets | Keep sandbox copy honest |
| Admin MFA | Identity Platform |
| Fleet/Agency | Out of scope |

---

## 7. Verification rule

A phase is “stable” only when:

- Relevant apps analyze/build cleanly  
- Happy-path booking/dispatch still callable  
- No mock success for unpaid/unassigned states  
- Matrix updated only for verified items  

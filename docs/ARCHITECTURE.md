# LUX Architecture (Firebase)

```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│ Customer    │  │ Driver      │  │ Admin Web    │
│ Flutter     │  │ Flutter     │  │ Next.js      │
└──────┬──────┘  └──────┬──────┘  └──────┬───────┘
       │                │                │
       └────────────┬───┴────────────────┘
                    │  Auth + Callable HTTPS + listeners (read models)
                    ▼
         ┌─────────────────────┐
         │ Cloud Functions v2  │  ← only writers for sensitive state
         │ quotes, payments,   │
         │ bookings, dispatch, │
         │ trips, admin, jobs  │
         └──────────┬──────────┘
                    │ Admin SDK
         ┌──────────▼──────────┐
         │ Firestore + Storage │  rules: default deny
         │ FCM / Tasks / Sched │
         └─────────────────────┘

External adapters: Payments (sandbox|stripe), Maps/Routes, SMS/Email
Placeholders only: Fleet Portal, Travel Agency Portal
```

Shared contracts: `@lux/contracts` (Zod + state machine + RBAC + fit + money).

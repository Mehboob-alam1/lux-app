# Role × Permission Matrix

Source of truth: `packages/contracts/src/roles.ts` (`ROLE_PERMISSIONS`).

Market scope is applied separately for admin roles (`requireMarketScope`). Custom claims are hints; `users/{uid}.roleIds` + `accountState` are cross-checked on every callable.

| Permission | CUST | DRV | SUPER | OPS | DISP | SUPP | FIN | COMP | SAFE | RO |
|------------|------|-----|-------|-----|------|------|-----|------|------|----|
| booking:read | ✓ | ✓* | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| booking:create | ✓ | | ✓ | ✓ | | | | | | |
| booking:update | | | ✓ | ✓ | ✓ | | | | | |
| booking:cancel | ✓ | | ✓ | ✓ | | | | | | |
| booking:reprice | | | ✓ | ✓ | | | | | | |
| booking:assign | | | ✓ | ✓ | ✓ | | | | | |
| booking:rescue | | | ✓ | ✓ | ✓ | | | | | |
| quote:create | ✓ | | ✓ | | | | | | | |
| payment:authorize | ✓ | | ✓ | | | | | | | |
| payment:capture | | | ✓ | | | | ✓ | | | |
| payment:refund | | | ✓ | | | | ✓ | | | |
| payment:adjust | | | ✓ | | | | ✓ | | | |
| payout:read | | ✓ | ✓ | ✓ | | | ✓ | ✓ | | ✓ |
| payout:settle | | | ✓ | | | | ✓ | | | |
| payout:adjust | | | ✓ | | | | ✓ | | | |
| driver:approve | | | ✓ | | | | | ✓ | | |
| driver:restrict | | | ✓ | ✓ | | | | ✓ | ✓ | |
| vehicle:approve | | | ✓ | | | | | ✓ | | |
| document:review | | | ✓ | | | | | ✓ | | |
| customer:read | | | ✓ | ✓ | ✓ | ✓ | | ✓ | | ✓ |
| customer:credit | | | ✓ | | | ✓ | ✓ | | | |
| support:read/write | w | w | ✓ | ✓ | w | ✓ | | | r | r |
| dispute:* | | | ✓ | | | r/d | r | | | r |
| incident:* | | w | ✓ | r/w | | r | | | ✓ | r |
| pricing:manage | | | ✓ | | | | | | | |
| market:manage | | | ✓ | | | | | | | |
| analytics:read | | | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ |
| audit:read | | | ✓ | | | | ✓ | ✓ | ✓ | ✓ |
| admin:impersonate_search | | | ✓ | ✓ | ✓ | ✓ | | | | |
| system:emergency_pause | | | ✓ | ✓ | | | | | | |

\* Driver booking:read is limited to assigned bookings via Firestore rules.

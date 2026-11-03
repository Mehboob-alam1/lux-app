# LUX Data Dictionary (Firestore)

PII classification: **Public** | **Internal** | **PII** | **Sensitive** | **Restricted**  
Mutations: **CF only** unless noted. Clients never write booking/payment/assignment state.

| Collection | Key fields | Readers | Writers | TTL / retention | PII | Consistency | Owner CF |
|------------|------------|---------|---------|-----------------|-----|-------------|----------|
| users | uid, contacts, roleIds, marketIds, accountState, consentVersions | self, admin | CF | account lifecycle | PII | strong per doc | auth/provisionUser |
| customer_profiles | name, prefs, savedPlaceIds, notifications | self, admin | CF | with account | PII | strong | auth, customers/* |
| family_members (sub) | relationship, contact, needs, consent | owner, admin | CF | with account | PII | strong | customers/* |
| drivers | status, capabilities, onlineState, vehicle, performance | self, admin | CF | partner retention | PII | strong | drivers/* |
| vehicles | owner, class, capacity, plate, approval, eligibility | owner, admin | CF | partner retention | Internal+PII plate | strong | vehicles/* |
| vehicle_classes | capacity, policies | public read | CF | config | Public | strong | markets |
| driver_documents / vehicle_documents | storagePath, reviewState, expiry | owner, compliance | CF | legal retention | Restricted | strong | documents/* |
| eligibility_records | entity, status, reasons | owner, admin | CF | audit window | Internal | strong | documents/* |
| markets / service_areas / airports | config | public/auth | CF | config | Public | strong | markets |
| pricing_rules / policy_versions | versioned fees/policies | auth read | CF | version history | Internal | strong | pricing |
| feature_flags | flags | auth | CF | config | Internal | strong | markets |
| quotes | itinerary, fit, totalMinor, hash, expires, redemption | owner, admin | CF | short | PII loc | transactional redeem | createQuote |
| bookings | status, version, price, payout, assignment, overlays | customer/booker/assigned driver/admin | CF | legal+ops | PII | transactional | confirmBooking, trips, dispatch, admin |
| bookings/*/events | append-only timeline | same as booking | CF | audit retention | Internal | append-only | all mutators |
| assignments | driver, vehicle, payoutQuote, status | driver, admin | CF | ops | Internal | transactional | acceptOffer, adminAssign, driverCancel |
| driver_offers | expiry, response, expected payout | driver, admin | CF | short | Internal | transactional accept | enqueueDispatch, acceptOffer |
| driver_availability | calendar/breaks | driver, admin | CF | short | Internal | strong | drivers/* |
| driver_locations | lat/lng, updatedAt, stale | driver, admin (+ scoped trip views via CF) | CF | ~30m TTL | Sensitive | eventual | updateDriverLocation |
| trip_location_events | samples | admin/dispute restricted | CF | bounded | Sensitive | append | locations |
| payments / payment_events / refunds / credits / tips | amounts, provider ids | finance roles / owner scoped | CF | financial retention | Sensitive | append+materialize | payments/* |
| payout_ledger / payout_batches / financial_adjustments | driver amounts, status | driver/finance | CF | financial | Sensitive | append-only ledger | payments/payouts |
| support_cases / support_messages | case thread | owner, support | CF | support retention | PII | strong | support/* |
| lost_items | status workflow | reporter, support | CF | support | PII | strong | support/* |
| disputes / dispute_evidence | claim, decision, remedy | parties scoped, finance/support | CF | legal | Restricted | strong | disputes/* |
| incidents / rescue_cases | safety/rescue | reporter, safety/ops | CF | legal | Restricted | strong | incidents, dispatch |
| notifications / notification_attempts / device_tokens | delivery | owner | CF | short | PII token | eventual | notifications |
| guest_links | tokenHash, scoped perms, expiry | **none** (CF resolve only) | CF | until expiry | Sensitive | strong | guests/* |
| audit_logs / admin_actions | actor, before/after, reason | compliance/finance/safety/super/read-only | CF | long retention | Internal | append-only | all sensitive |
| operational_alerts / analytics_daily / system_health | ops metrics | admin | CF | short/daily | Internal | eventual | jobs, analytics |
| idempotency_keys / outbox | command replay / async | none | CF | short | Internal | strong | guards |

**No fleet/agency functional collections in this update.** Nullable `fleetCompanyId` / `travelAgencyId` on bookings only.

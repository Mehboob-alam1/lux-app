import { z } from 'zod';
import {
  AccountStateSchema,
  RoleSchema,
} from './roles';
import {
  BookingStatusSchema,
  CancellationActorSchema,
  IncidentStatusSchema,
  PaymentStatusSchema,
} from './booking-state';
import {
  AddonTypeSchema,
  AirportReadinessSchema,
  AssignmentStatusSchema,
  BookingSourceSchema,
  DocumentReviewStateSchema,
  DriverStatusSchema,
  DriverTypeSchema,
  OfferResponseSchema,
  PriceKindSchema,
  QuoteRedemptionStateSchema,
  RiskStateSchema,
  TripContextSchema,
  VehicleClassIdSchema,
} from './enums';
import { ItineraryStopSchema, PlaceRefSchema } from './geo';
import { MoneySchema } from './money';

const Ts = z.string().datetime({ offset: true }).or(z.date());

export const UserDocSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  emailVerified: z.boolean().default(false),
  phoneVerified: z.boolean().default(false),
  roleIds: z.array(RoleSchema).default([]),
  marketIds: z.array(z.string()).default([]),
  accountState: AccountStateSchema.default('ACTIVE'),
  consentVersions: z.record(z.string()).default({}),
  createdAt: Ts,
  updatedAt: Ts,
});
export type UserDoc = z.infer<typeof UserDocSchema>;

export const CustomerProfileSchema = z.object({
  uid: z.string(),
  displayName: z.string().min(1),
  preferences: z.record(z.unknown()).default({}),
  savedPlaceIds: z.array(z.string()).default([]),
  accessibilityNotes: z.string().optional(),
  notificationSettings: z
    .object({
      push: z.boolean().default(true),
      sms: z.boolean().default(false),
      email: z.boolean().default(true),
      guardian: z.boolean().default(false),
    })
    .default({}),
  createdAt: Ts,
  updatedAt: Ts,
});
export type CustomerProfile = z.infer<typeof CustomerProfileSchema>;

export const FamilyMemberSchema = z.object({
  id: z.string(),
  ownerUid: z.string(),
  relationship: z.string(),
  displayName: z.string(),
  contactPhone: z.string().optional(),
  needs: z.string().optional(),
  consentRecorded: z.boolean().default(false),
  createdAt: Ts,
  updatedAt: Ts,
});
export type FamilyMember = z.infer<typeof FamilyMemberSchema>;

export const DriverDocSchema = z.object({
  uid: z.string(),
  status: DriverStatusSchema,
  driverType: DriverTypeSchema.default('OWNER_DRIVER'),
  displayName: z.string(),
  capabilities: z.array(z.string()).default([]),
  marketIds: z.array(z.string()).default([]),
  currentVehicleId: z.string().nullable().optional(),
  onlineState: z.enum(['OFFLINE', 'ONLINE', 'BREAK']).default('OFFLINE'),
  readiness: z.record(z.unknown()).default({}),
  payoutAccountReference: z.string().nullable().optional(),
  performance: z
    .object({
      onTimeRate: z.number().min(0).max(1).optional(),
      completionRate: z.number().min(0).max(1).optional(),
      cancellationRate: z.number().min(0).max(1).optional(),
    })
    .default({}),
  documentStatusSummary: z.string().optional(),
  statusReason: z.string().optional(),
  createdAt: Ts,
  updatedAt: Ts,
});
export type DriverDoc = z.infer<typeof DriverDocSchema>;

export const VehicleDocSchema = z.object({
  vehicleId: z.string(),
  ownerDriverId: z.string(),
  classIds: z.array(VehicleClassIdSchema).min(1),
  capacityPassengers: z.number().int().positive(),
  capacityLuggage: z.number().int().nonnegative(),
  make: z.string(),
  model: z.string(),
  year: z.number().int(),
  plate: z.string(),
  color: z.string(),
  vin: z.string().optional(),
  photoPaths: z.array(z.string()).default([]),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']),
  inspectionStatus: z.enum(['PENDING', 'PASSED', 'FAILED', 'EXPIRED']).optional(),
  documentEligibilityOk: z.boolean().default(false),
  createdAt: Ts,
  updatedAt: Ts,
});
export type VehicleDoc = z.infer<typeof VehicleDocSchema>;

export const QuoteDocSchema = z.object({
  quoteId: z.string(),
  customerUid: z.string(),
  marketId: z.string(),
  itinerary: z.array(ItineraryStopSchema).min(2),
  fit: z.object({
    passengers: z.number().int().positive(),
    luggage: z.number().int().nonnegative(),
    stroller: z.boolean().optional(),
    oversized: z.boolean().optional(),
  }),
  selectedClass: VehicleClassIdSchema,
  components: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      amountMinor: z.number().int(),
    }),
  ),
  priceKind: PriceKindSchema,
  totalMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  ruleVersion: z.string(),
  expiresAt: Ts,
  immutableHash: z.string(),
  redemptionState: QuoteRedemptionStateSchema,
  tripContext: TripContextSchema.default('STANDARD'),
  addons: z.array(AddonTypeSchema).default([]),
  createdAt: Ts,
});
export type QuoteDoc = z.infer<typeof QuoteDocSchema>;

export const BookingDocSchema = z.object({
  bookingId: z.string(),
  customerUid: z.string(),
  bookerUid: z.string(),
  passengerProfileId: z.string().optional(),
  source: BookingSourceSchema,
  marketId: z.string(),
  itinerary: z.array(ItineraryStopSchema).min(2),
  tripContext: TripContextSchema,
  scheduledAt: Ts.nullable(),
  passengers: z.number().int().positive(),
  luggage: z.number().int().nonnegative(),
  classId: VehicleClassIdSchema,
  addons: z.array(AddonTypeSchema).default([]),
  priceKind: PriceKindSchema,
  customerPriceMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  quoteId: z.string(),
  currentStatus: BookingStatusSchema,
  statusVersion: z.number().int().nonnegative(),
  assignmentId: z.string().nullable().optional(),
  riskState: RiskStateSchema.default('NORMAL'),
  paymentStatus: PaymentStatusSchema.default('NONE'),
  incidentStatus: IncidentStatusSchema.default('NONE'),
  cancellationActor: CancellationActorSchema.nullable().optional(),
  cancellationReason: z.string().optional(),
  airport: z
    .object({
      airportId: z.string(),
      flightNumber: z.string().optional(),
      terminal: z.string().optional(),
      readiness: AirportReadinessSchema.optional(),
      meetAndGreet: z.boolean().optional(),
    })
    .optional(),
  // Future-compatible nullable org fields — no fleet/agency modules this update
  fleetCompanyId: z.string().nullable().optional(),
  travelAgencyId: z.string().nullable().optional(),
  createdAt: Ts,
  updatedAt: Ts,
});
export type BookingDoc = z.infer<typeof BookingDocSchema>;

export const BookingEventSchema = z.object({
  eventId: z.string(),
  bookingId: z.string(),
  type: z.string(),
  actorUid: z.string().nullable(),
  actorRole: RoleSchema.nullable().optional(),
  timestamp: Ts,
  source: z.enum(['CUSTOMER_APP', 'DRIVER_APP', 'ADMIN', 'SYSTEM', 'WEBHOOK']),
  previousStatus: BookingStatusSchema.nullable().optional(),
  nextStatus: BookingStatusSchema.nullable().optional(),
  reason: z.string().optional(),
  idempotencyKey: z.string(),
  evidenceRef: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
});
export type BookingEvent = z.infer<typeof BookingEventSchema>;

export const AssignmentDocSchema = z.object({
  assignmentId: z.string(),
  bookingId: z.string(),
  driverId: z.string(),
  vehicleId: z.string(),
  status: AssignmentStatusSchema,
  offeredAt: Ts,
  acceptedAt: Ts.nullable().optional(),
  releasedAt: Ts.nullable().optional(),
  eligibilitySnapshot: z.record(z.unknown()),
  version: z.number().int().nonnegative(),
  payoutQuoteMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
});
export type AssignmentDoc = z.infer<typeof AssignmentDocSchema>;

export const DriverOfferSchema = z.object({
  offerId: z.string(),
  bookingId: z.string(),
  driverId: z.string(),
  expiresAt: Ts,
  response: OfferResponseSchema,
  expectedPayoutMinor: z.number().int().nonnegative(),
  currency: z.string().length(3),
  createdAt: Ts,
});
export type DriverOffer = z.infer<typeof DriverOfferSchema>;

export const PaymentDocSchema = z.object({
  paymentId: z.string(),
  bookingId: z.string(),
  provider: z.enum(['sandbox', 'stripe']),
  providerIntentId: z.string(),
  state: z.enum([
    'REQUIRES_ACTION',
    'AUTHORIZED',
    'CAPTURED',
    'FAILED',
    'CANCELLED',
  ]),
  amountMinor: z.number().int().positive(),
  currency: z.string().length(3),
  idempotencyKey: z.string(),
  lastProviderEvent: z.string().optional(),
  createdAt: Ts,
  updatedAt: Ts,
});
export type PaymentDoc = z.infer<typeof PaymentDocSchema>;

export const AuditLogSchema = z.object({
  auditId: z.string(),
  actorUid: z.string(),
  actorRole: RoleSchema,
  marketId: z.string().optional(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  reason: z.string().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  bookingId: z.string().optional(),
  correlationId: z.string().optional(),
  timestamp: Ts,
});
export type AuditLog = z.infer<typeof AuditLogSchema>;

export const MarketDocSchema = z.object({
  marketId: z.string(),
  displayName: z.string(),
  timezone: z.string(),
  currency: z.string().length(3),
  active: z.boolean(),
  bookingPaused: z.boolean().default(false),
  enabledContexts: z.array(TripContextSchema).default(['STANDARD', 'AIRPORT']),
  createdAt: Ts,
  updatedAt: Ts,
});
export type MarketDoc = z.infer<typeof MarketDocSchema>;

export { PlaceRefSchema, ItineraryStopSchema, MoneySchema };

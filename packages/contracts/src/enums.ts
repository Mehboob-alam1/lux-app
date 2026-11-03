import { z } from 'zod';

export const VehicleClassIdSchema = z.enum([
  'COMFORT',
  'EXECUTIVE',
  'FIRST_CLASS',
  'LUXURY_SUV',
  'VIP_SPRINTER',
  'LIMO_COACH',
]);
export type VehicleClassId = z.infer<typeof VehicleClassIdSchema>;

export const TripContextSchema = z.enum([
  'STANDARD',
  'AIRPORT',
  'BUSINESS',
  'FAMILY',
  'EVENT',
  'HOURLY',
  'INTERCITY',
]);
export type TripContext = z.infer<typeof TripContextSchema>;

export const BookingSourceSchema = z.enum(['CUSTOMER', 'ADMIN']);
export type BookingSource = z.infer<typeof BookingSourceSchema>;

export const DriverStatusSchema = z.enum([
  'PENDING',
  'ACTIVE',
  'LIMITED',
  'UNDER_REVIEW',
  'SUSPENDED',
  'DEACTIVATED',
]);
export type DriverStatus = z.infer<typeof DriverStatusSchema>;

/** Passive forward-compat; only OWNER_DRIVER workflows in this update. */
export const DriverTypeSchema = z.enum([
  'OWNER_DRIVER',
  'FLEET_DRIVER',
  'SPECIALIZED_CHAUFFEUR',
]);
export type DriverType = z.infer<typeof DriverTypeSchema>;

export const DocumentReviewStateSchema = z.enum([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);
export type DocumentReviewState = z.infer<typeof DocumentReviewStateSchema>;

export const QuoteRedemptionStateSchema = z.enum([
  'OPEN',
  'REDEEMED',
  'EXPIRED',
  'INVALIDATED',
]);
export type QuoteRedemptionState = z.infer<typeof QuoteRedemptionStateSchema>;

export const AssignmentStatusSchema = z.enum([
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'RELEASED',
  'CANCELLED',
  'COMPLETED',
]);
export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;

export const OfferResponseSchema = z.enum([
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
]);
export type OfferResponse = z.infer<typeof OfferResponseSchema>;

export const AirportReadinessSchema = z.enum([
  'LANDED',
  'IMMIGRATION_CUSTOMS',
  'COLLECTING_BAGS',
  'READY',
]);
export type AirportReadiness = z.infer<typeof AirportReadinessSchema>;

export const SupportCaseStatusSchema = z.enum([
  'OPEN',
  'PENDING_CUSTOMER',
  'PENDING_INTERNAL',
  'RESOLVED',
  'REOPENED',
  'CLOSED',
]);
export type SupportCaseStatus = z.infer<typeof SupportCaseStatusSchema>;

export const LostItemStatusSchema = z.enum([
  'REPORTED',
  'DRIVER_CONTACTED',
  'FOUND',
  'RETURN_ARRANGED',
  'RETURNED',
  'NOT_FOUND_CLOSED',
]);
export type LostItemStatus = z.infer<typeof LostItemStatusSchema>;

export const OperationsHealthSchema = z.enum([
  'NORMAL',
  'WATCH',
  'AT_RISK',
  'RESCUE',
  'CRITICAL',
]);
export type OperationsHealth = z.infer<typeof OperationsHealthSchema>;

export const RiskStateSchema = z.enum([
  'NORMAL',
  'WATCH',
  'AT_RISK',
  'RESCUE',
  'CRITICAL',
]);
export type RiskState = z.infer<typeof RiskStateSchema>;

export const PriceKindSchema = z.enum(['FIXED', 'ESTIMATED']);
export type PriceKind = z.infer<typeof PriceKindSchema>;

export const AddonTypeSchema = z.enum([
  'QUIET_RIDE',
  'LUGGAGE_HELP',
  'CHILD_SEAT',
  'MEET_AND_GREET',
  'LANGUAGE_ASSIST',
  'ACCESSIBILITY',
]);
export type AddonType = z.infer<typeof AddonTypeSchema>;

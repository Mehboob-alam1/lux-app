import { z } from 'zod';
import { AddonTypeSchema, TripContextSchema, VehicleClassIdSchema } from './enums';
import { ItineraryStopSchema } from './geo';
import { AirportReadinessSchema } from './enums';

/** Idempotent command envelope for high-impact mutations. */
export const CommandMetaSchema = z.object({
  idempotencyKey: z.string().min(8).max(128),
  expectedStatusVersion: z.number().int().nonnegative().optional(),
  marketId: z.string().min(1),
  clientTimestamp: z.string().datetime({ offset: true }).optional(),
});
export type CommandMeta = z.infer<typeof CommandMetaSchema>;

export const CreateQuoteCommandSchema = CommandMetaSchema.extend({
  customerUid: z.string(),
  itinerary: z.array(ItineraryStopSchema).min(2),
  passengers: z.number().int().positive(),
  luggage: z.number().int().nonnegative(),
  stroller: z.boolean().optional(),
  oversized: z.boolean().optional(),
  selectedClass: VehicleClassIdSchema,
  tripContext: TripContextSchema.default('STANDARD'),
  addons: z.array(AddonTypeSchema).default([]),
  scheduledAt: z.string().datetime({ offset: true }).nullable().optional(),
  airport: z
    .object({
      airportId: z.string(),
      flightNumber: z.string().optional(),
      terminal: z.string().optional(),
      meetAndGreet: z.boolean().optional(),
    })
    .optional(),
});
export type CreateQuoteCommand = z.infer<typeof CreateQuoteCommandSchema>;

export const AuthorizePaymentCommandSchema = CommandMetaSchema.extend({
  quoteId: z.string(),
  paymentMethodToken: z.string().min(1),
});
export type AuthorizePaymentCommand = z.infer<
  typeof AuthorizePaymentCommandSchema
>;

export const ConfirmBookingCommandSchema = CommandMetaSchema.extend({
  quoteId: z.string(),
  paymentId: z.string(),
  bookerUid: z.string(),
  passengerProfileId: z.string().optional(),
});
export type ConfirmBookingCommand = z.infer<typeof ConfirmBookingCommandSchema>;

export const AcceptOfferCommandSchema = CommandMetaSchema.extend({
  offerId: z.string(),
  vehicleId: z.string(),
});
export type AcceptOfferCommand = z.infer<typeof AcceptOfferCommandSchema>;

export const TripLifecycleCommandSchema = CommandMetaSchema.extend({
  bookingId: z.string(),
  action: z.enum([
    'EN_ROUTE',
    'ARRIVED',
    'START_WAIT',
    'PASSENGER_ONBOARD',
    'START_TRIP',
    'COMPLETE',
    'CONTACT_ATTEMPT',
    'PASSENGER_NO_SHOW',
  ]),
  location: z
    .object({ lat: z.number(), lng: z.number(), accuracyM: z.number().optional() })
    .optional(),
  evidenceRef: z.string().optional(),
});
export type TripLifecycleCommand = z.infer<typeof TripLifecycleCommandSchema>;

export const DriverCancelAssignmentCommandSchema = CommandMetaSchema.extend({
  bookingId: z.string(),
  assignmentId: z.string(),
  reason: z.string().min(3),
  kind: z.enum([
    'REQUEST_RELEASE',
    'EMERGENCY_RELEASE',
    'MAY_NOT_MAKE',
    'ACTIVE_CANCEL',
  ]),
  evidenceRef: z.string().optional(),
});
export type DriverCancelAssignmentCommand = z.infer<
  typeof DriverCancelAssignmentCommandSchema
>;

export const AdminAssignCommandSchema = CommandMetaSchema.extend({
  bookingId: z.string(),
  driverId: z.string(),
  vehicleId: z.string(),
  reason: z.string().min(3),
  allowUpgradeComplimentary: z.boolean().default(false),
});
export type AdminAssignCommand = z.infer<typeof AdminAssignCommandSchema>;

export const UpdateAirportReadinessCommandSchema = CommandMetaSchema.extend({
  bookingId: z.string(),
  readiness: AirportReadinessSchema,
});
export type UpdateAirportReadinessCommand = z.infer<
  typeof UpdateAirportReadinessCommandSchema
>;

export const AnalyticsEventNameSchema = z.enum([
  'quote_viewed',
  'booking_created',
  'payment_authorized',
  'assignment_confirmed',
  'driver_en_route',
  'driver_arrived',
  'passenger_onboard',
  'trip_completed',
  'payment_captured',
  'support_opened',
  'rescue_started',
  'rescue_completed',
  'vehicle_upgrade',
  'rating_submitted',
]);
export type AnalyticsEventName = z.infer<typeof AnalyticsEventNameSchema>;

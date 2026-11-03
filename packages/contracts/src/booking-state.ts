import { z } from 'zod';

/**
 * Canonical operational booking statuses (shared architecture vocabulary).
 *
 * Orthogonal overlays (stored separately on booking):
 * - paymentStatus: NONE | REQUIRES_ACTION | AUTHORIZED | CAPTURED | FAILED | REFUNDED | PARTIALLY_REFUNDED
 * - incidentStatus: NONE | OPEN | RESOLVED
 * - cancellationActor: null | CUSTOMER | DRIVER | ADMIN | SYSTEM
 *
 * INCIDENT and PAYMENT_FAILED appear in source state lists as operational/financial
 * exception labels. They are preserved as event vocabulary and overlay flags.
 * They do NOT irreversibly overwrite journey history: operational currentStatus
 * remains the journey position (or REASSIGNING / terminal cancel / no-show).
 *
 * DRIVER_CANCELLED is recorded as an assignment/event cancellationActor=DRIVER
 * while booking currentStatus becomes REASSIGNING (never silent customer cancel).
 *
 * PAYMENT_CAPTURED is financial completion — journey must already be COMPLETED
 * (or policy exception documented). It is modeled as paymentStatus=CAPTURED;
 * optional currentStatus transition COMPLETED → PAYMENT_CAPTURED for vocabulary
 * compatibility when finance closes the booking.
 */
export const BookingStatusSchema = z.enum([
  'DRAFT',
  'QUOTED',
  'PAYMENT_AUTHORIZED',
  'BOOKED',
  'ASSIGNMENT_PENDING',
  'ASSIGNED',
  'DRIVER_EN_ROUTE',
  'DRIVER_ARRIVED',
  'WAITING',
  'PASSENGER_ONBOARD',
  'IN_PROGRESS',
  'COMPLETED',
  'PAYMENT_CAPTURED',
  'REASSIGNING',
  'CUSTOMER_CANCELLED',
  'DRIVER_CANCELLED', // event vocabulary / compatibility; prefer REASSIGNING + cancellationActor
  'PASSENGER_NO_SHOW',
  'DRIVER_NO_SHOW',
  'INCIDENT', // overlay vocabulary; prefer incidentStatus=OPEN
  'PAYMENT_FAILED', // overlay vocabulary; prefer paymentStatus=FAILED
]);
export type BookingStatus = z.infer<typeof BookingStatusSchema>;

export const PaymentStatusSchema = z.enum([
  'NONE',
  'REQUIRES_ACTION',
  'AUTHORIZED',
  'CAPTURED',
  'FAILED',
  'REFUNDED',
  'PARTIALLY_REFUNDED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

export const IncidentStatusSchema = z.enum(['NONE', 'OPEN', 'RESOLVED']);
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

export const CancellationActorSchema = z.enum([
  'CUSTOMER',
  'DRIVER',
  'ADMIN',
  'SYSTEM',
]);
export type CancellationActor = z.infer<typeof CancellationActorSchema>;

/** Allowed operational transitions (from → to[]). */
export const BOOKING_TRANSITIONS: Readonly<
  Record<BookingStatus, readonly BookingStatus[]>
> = {
  DRAFT: ['QUOTED', 'CUSTOMER_CANCELLED'],
  QUOTED: ['PAYMENT_AUTHORIZED', 'DRAFT', 'CUSTOMER_CANCELLED', 'PAYMENT_FAILED'],
  PAYMENT_AUTHORIZED: ['BOOKED', 'CUSTOMER_CANCELLED', 'PAYMENT_FAILED'],
  BOOKED: ['ASSIGNMENT_PENDING', 'CUSTOMER_CANCELLED', 'PAYMENT_FAILED'],
  ASSIGNMENT_PENDING: [
    'ASSIGNED',
    'REASSIGNING',
    'CUSTOMER_CANCELLED',
    'DRIVER_NO_SHOW',
  ],
  ASSIGNED: [
    'DRIVER_EN_ROUTE',
    'REASSIGNING',
    'CUSTOMER_CANCELLED',
    'DRIVER_CANCELLED',
  ],
  DRIVER_EN_ROUTE: [
    'DRIVER_ARRIVED',
    'REASSIGNING',
    'CUSTOMER_CANCELLED',
    'DRIVER_CANCELLED',
    'DRIVER_NO_SHOW',
  ],
  DRIVER_ARRIVED: [
    'WAITING',
    'PASSENGER_ONBOARD',
    'REASSIGNING',
    'CUSTOMER_CANCELLED',
    'PASSENGER_NO_SHOW',
    'DRIVER_CANCELLED',
  ],
  WAITING: [
    'PASSENGER_ONBOARD',
    'PASSENGER_NO_SHOW',
    'REASSIGNING',
    'CUSTOMER_CANCELLED',
    'DRIVER_CANCELLED',
  ],
  PASSENGER_ONBOARD: ['IN_PROGRESS', 'CUSTOMER_CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'REASSIGNING'],
  COMPLETED: ['PAYMENT_CAPTURED'],
  PAYMENT_CAPTURED: [],
  REASSIGNING: [
    'ASSIGNMENT_PENDING',
    'ASSIGNED',
    'CUSTOMER_CANCELLED',
    'DRIVER_NO_SHOW',
  ],
  CUSTOMER_CANCELLED: [],
  DRIVER_CANCELLED: ['REASSIGNING'], // compatibility: normalize to recovery
  PASSENGER_NO_SHOW: ['PAYMENT_CAPTURED'],
  DRIVER_NO_SHOW: ['REASSIGNING', 'CUSTOMER_CANCELLED'],
  INCIDENT: [], // not used as sole currentStatus; see assertTransition overlays
  PAYMENT_FAILED: ['PAYMENT_AUTHORIZED', 'CUSTOMER_CANCELLED', 'QUOTED'],
};

export const TERMINAL_STATUSES: ReadonlySet<BookingStatus> = new Set([
  'CUSTOMER_CANCELLED',
  'PAYMENT_CAPTURED',
  'PASSENGER_NO_SHOW',
]);

export type TransitionContext = {
  paymentStatus?: PaymentStatus;
  incidentStatus?: IncidentStatus;
  cancellationActor?: CancellationActor | null;
  /** When driver cancels assignment, force recovery path. */
  driverAssignmentCancelled?: boolean;
};

export class IllegalBookingTransitionError extends Error {
  constructor(
    public readonly from: BookingStatus,
    public readonly to: BookingStatus,
    message?: string,
  ) {
    super(
      message ??
        `Illegal booking transition ${from} → ${to}`,
    );
    this.name = 'IllegalBookingTransitionError';
  }
}

/**
 * Validates operational transition. Driver cancellation of assignment maps to REASSIGNING.
 * Opening an incident sets incident overlay — callers should keep operational status and
 * set incidentStatus=OPEN rather than jumping to INCIDENT unless compatibility mode.
 */
export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
  ctx: TransitionContext = {},
): void {
  if (from === to) {
    throw new IllegalBookingTransitionError(from, to, 'No-op transition not allowed');
  }

  // Normalize DRIVER_CANCELLED → REASSIGNING for customer booking continuity
  if (ctx.driverAssignmentCancelled && to === 'DRIVER_CANCELLED') {
    throw new IllegalBookingTransitionError(
      from,
      to,
      'Driver cancellation must move booking to REASSIGNING (record DRIVER_CANCELLED on assignment/event)',
    );
  }

  if (to === 'INCIDENT') {
    throw new IllegalBookingTransitionError(
      from,
      to,
      'Use incidentStatus=OPEN overlay; do not overwrite journey with INCIDENT',
    );
  }

  const allowed = BOOKING_TRANSITIONS[from];
  if (!allowed.includes(to)) {
    throw new IllegalBookingTransitionError(from, to);
  }

  if (to === 'PAYMENT_CAPTURED' && from === 'COMPLETED') {
    if (ctx.paymentStatus === 'FAILED') {
      throw new IllegalBookingTransitionError(
        from,
        to,
        'Cannot capture while paymentStatus=FAILED',
      );
    }
  }

  if (to === 'REASSIGNING' && ctx.cancellationActor === 'CUSTOMER') {
    throw new IllegalBookingTransitionError(
      from,
      to,
      'Customer cancellation is CUSTOMER_CANCELLED, not REASSIGNING',
    );
  }
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus,
  ctx: TransitionContext = {},
): boolean {
  try {
    assertBookingTransition(from, to, ctx);
    return true;
  } catch {
    return false;
  }
}

/** Resolve next status when a driver cancels an active assignment. */
export function statusAfterDriverCancel(from: BookingStatus): BookingStatus {
  const recoverable: BookingStatus[] = [
    'ASSIGNED',
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'WAITING',
    'ASSIGNMENT_PENDING',
    'IN_PROGRESS',
  ];
  if (!recoverable.includes(from) && from !== 'REASSIGNING') {
    throw new IllegalBookingTransitionError(
      from,
      'REASSIGNING',
      'Driver cancel not valid from this status',
    );
  }
  return 'REASSIGNING';
}

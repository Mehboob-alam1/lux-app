import { describe, expect, it } from 'vitest';
import {
  assertBookingTransition,
  canTransition,
  IllegalBookingTransitionError,
  statusAfterDriverCancel,
} from './booking-state';

describe('booking state machine', () => {
  it('allows happy-path operational transitions', () => {
    const path = [
      ['DRAFT', 'QUOTED'],
      ['QUOTED', 'PAYMENT_AUTHORIZED'],
      ['PAYMENT_AUTHORIZED', 'BOOKED'],
      ['BOOKED', 'ASSIGNMENT_PENDING'],
      ['ASSIGNMENT_PENDING', 'ASSIGNED'],
      ['ASSIGNED', 'DRIVER_EN_ROUTE'],
      ['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED'],
      ['DRIVER_ARRIVED', 'WAITING'],
      ['WAITING', 'PASSENGER_ONBOARD'],
      ['PASSENGER_ONBOARD', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'COMPLETED'],
      ['COMPLETED', 'PAYMENT_CAPTURED'],
    ] as const;

    for (const [from, to] of path) {
      expect(canTransition(from, to)).toBe(true);
    }
  });

  it('rejects illegal jumps', () => {
    expect(canTransition('DRAFT', 'COMPLETED')).toBe(false);
    expect(canTransition('ASSIGNED', 'IN_PROGRESS')).toBe(false);
  });

  it('maps driver cancel to REASSIGNING', () => {
    expect(statusAfterDriverCancel('ASSIGNED')).toBe('REASSIGNING');
    expect(statusAfterDriverCancel('DRIVER_EN_ROUTE')).toBe('REASSIGNING');
    expect(() => statusAfterDriverCancel('COMPLETED')).toThrow(
      IllegalBookingTransitionError,
    );
  });

  it('forbids overwriting journey with INCIDENT status', () => {
    expect(() =>
      assertBookingTransition('IN_PROGRESS', 'INCIDENT'),
    ).toThrow(/incidentStatus/);
  });

  it('forbids using DRIVER_CANCELLED as booking currentStatus when flagged', () => {
    expect(() =>
      assertBookingTransition('ASSIGNED', 'DRIVER_CANCELLED', {
        driverAssignmentCancelled: true,
      }),
    ).toThrow(/REASSIGNING/);
  });

  it('allows REASSIGNING back to ASSIGNED', () => {
    expect(canTransition('REASSIGNING', 'ASSIGNED')).toBe(true);
  });
});

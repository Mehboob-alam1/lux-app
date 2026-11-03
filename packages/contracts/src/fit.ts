import { VehicleClassId } from './enums';

export type FitInput = {
  passengers: number;
  luggage: number;
  stroller?: boolean;
  oversized?: boolean;
};

/** Conservative capacity defaults for class fit (configurable via vehicle_classes). */
export const DEFAULT_CLASS_CAPACITY: Record<
  VehicleClassId,
  { passengers: number; luggage: number; allowsOversized: boolean; group: boolean }
> = {
  COMFORT: { passengers: 3, luggage: 2, allowsOversized: false, group: false },
  EXECUTIVE: { passengers: 3, luggage: 2, allowsOversized: false, group: false },
  FIRST_CLASS: { passengers: 3, luggage: 2, allowsOversized: false, group: false },
  LUXURY_SUV: { passengers: 5, luggage: 5, allowsOversized: true, group: false },
  VIP_SPRINTER: { passengers: 12, luggage: 12, allowsOversized: true, group: true },
  LIMO_COACH: { passengers: 20, luggage: 20, allowsOversized: true, group: true },
};

export type FitResult =
  | { ok: true }
  | {
      ok: false;
      reason: string;
      suggestedClasses: VehicleClassId[];
    };

export function evaluateVehicleFit(
  classId: VehicleClassId,
  input: FitInput,
  capacity = DEFAULT_CLASS_CAPACITY[classId],
): FitResult {
  if (input.passengers < 1) {
    return { ok: false, reason: 'At least one passenger required', suggestedClasses: [] };
  }
  if (input.passengers > capacity.passengers) {
    return {
      ok: false,
      reason: `Passenger count ${input.passengers} exceeds class capacity ${capacity.passengers}`,
      suggestedClasses: suggestUpgrade(classId, input),
    };
  }
  if (input.luggage > capacity.luggage) {
    return {
      ok: false,
      reason: `Luggage count ${input.luggage} exceeds class capacity ${capacity.luggage}`,
      suggestedClasses: suggestUpgrade(classId, input),
    };
  }
  if (input.oversized && !capacity.allowsOversized) {
    return {
      ok: false,
      reason: 'Oversized luggage not suited to selected class',
      suggestedClasses: suggestUpgrade(classId, input),
    };
  }
  return { ok: true };
}

function suggestUpgrade(
  current: VehicleClassId,
  input: FitInput,
): VehicleClassId[] {
  const order: VehicleClassId[] = [
    'COMFORT',
    'EXECUTIVE',
    'FIRST_CLASS',
    'LUXURY_SUV',
    'VIP_SPRINTER',
    'LIMO_COACH',
  ];
  const start = order.indexOf(current);
  return order.slice(start + 1).filter((id) => evaluateVehicleFit(id, input).ok);
}

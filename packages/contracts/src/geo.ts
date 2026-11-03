import { z } from 'zod';

export const LatLngSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type LatLng = z.infer<typeof LatLngSchema>;

export const PlaceRefSchema = z.object({
  placeId: z.string().optional(),
  label: z.string().min(1),
  address: z.string().optional(),
  location: LatLngSchema,
  timezone: z.string().optional(),
});
export type PlaceRef = z.infer<typeof PlaceRefSchema>;

export const ItineraryStopSchema = z.object({
  sequence: z.number().int().nonnegative(),
  place: PlaceRefSchema,
  kind: z.enum(['PICKUP', 'STOP', 'DROPOFF']),
});
export type ItineraryStop = z.infer<typeof ItineraryStopSchema>;

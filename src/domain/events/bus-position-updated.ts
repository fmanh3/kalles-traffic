import { z } from 'zod';

/**
 * Event-schema för en buss positionsuppdatering.
 * Ref: GEMINI.md - "BussAnkommitHållplats"
 * Compliance: Data Act - Exponerar standardiserade fält.
 */
export const BusPositionUpdatedSchema = z.object({
  eventId: z.string().uuid(),
  correlationId: z.string().uuid(), // NIS2 Spårbarhet
  timestamp: z.string().datetime(),
  busId: z.string(),
  line: z.string().default("676"),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  status: z.object({
    speed: z.number().min(0),
    batteryPercentage: z.number().min(0).max(100),
    soc: z.number().optional(), // State of Charge
  }),
});

export type BusPositionUpdated = z.infer<typeof BusPositionUpdatedSchema>;

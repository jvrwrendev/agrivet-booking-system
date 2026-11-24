import { z } from "zod";

function nullableNonNegative(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export const updateAgentLocationDto = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().nullable().optional(),
  speed: z.preprocess(nullableNonNegative, z.number().nonnegative().nullable().optional()),
  heading: z.preprocess(nullableNonNegative, z.number().min(0).max(360).nullable().optional()),
  locationLabel: z.string().trim().max(255).nullable().optional(),
  recordedAt: z.string().datetime().optional(),
  gpsAvailable: z.boolean().optional(),
  isTracking: z.boolean().optional(),
});

export type UpdateAgentLocationDto = z.infer<typeof updateAgentLocationDto>;

export const agentLocationParamsDto = z.object({
  id: z.string().min(1),
});

export const agentLocationHistoryQueryDto = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type AgentLocationHistoryQueryDto = z.infer<
  typeof agentLocationHistoryQueryDto
>;

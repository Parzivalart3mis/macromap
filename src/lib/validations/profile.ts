import { z } from "zod";

export const updateProfileSchema = z.object({
  timezone: z.string().optional(),
  unitSystem: z.enum(["metric", "imperial"]).optional(),
  heightCm: z.number().positive().optional(),
  displayName: z.string().min(1).max(80).optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

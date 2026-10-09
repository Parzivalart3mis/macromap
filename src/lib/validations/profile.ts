import { z } from "zod";

import { BIOLOGICAL_SEXES } from "@/lib/db/schema";

export const updateProfileSchema = z.object({
  timezone: z.string().optional(),
  unitSystem: z.enum(["metric", "imperial"]).optional(),
  heightCm: z.number().positive().optional(),
  displayName: z.string().min(1).max(80).optional(),
  /** Only used to pick body-composition coefficients; "unspecified" opts out. */
  sex: z.enum(BIOLOGICAL_SEXES).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

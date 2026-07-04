import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const logWeightSchema = z.object({
  date: dateString,
  weightValue: z.number().positive(),
});

export const logBodyMetricsSchema = z
  .object({
    date: dateString,
    bodyFatPct: z.number().min(0).max(100).optional(),
    waistCm: z.number().positive().optional(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (value) =>
      value.bodyFatPct != null || value.waistCm != null || Boolean(value.notes),
    { message: "Log at least one metric" },
  );

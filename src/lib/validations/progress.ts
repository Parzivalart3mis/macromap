import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const logWeightSchema = z.object({
  date: dateString,
  weightValue: z.number().positive(),
});

/** Circumferences, in cm. Generous bounds — these only catch typos. */
const girth = z.number().positive().max(300).optional();

export const logBodyMetricsSchema = z
  .object({
    date: dateString,
    bodyFatPct: z.number().min(0).max(100).optional(),
    waistCm: girth,
    neckCm: girth,
    hipCm: girth,
    chestCm: girth,
    armCm: girth,
    thighCm: girth,
    notes: z.string().max(500).optional(),
  })
  .refine(
    (value) =>
      value.bodyFatPct != null ||
      value.waistCm != null ||
      value.neckCm != null ||
      value.hipCm != null ||
      value.chestCm != null ||
      value.armCm != null ||
      value.thighCm != null ||
      Boolean(value.notes),
    { message: "Log at least one metric" },
  );

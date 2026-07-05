import { z } from "zod";

export const createGoalProfileSchema = z.object({
  name: z.string().min(1).max(100),
});

export const goalDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  calories: z.number().positive(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().optional(),
  sugarGMax: z.number().nonnegative().optional(),
  sodiumMgMax: z.number().nonnegative().optional(),
  satFatGMax: z.number().nonnegative().optional(),
});

export const updateGoalProfileSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    days: z.array(goalDaySchema).length(7).optional(),
  })
  .refine((value) => value.name !== undefined || value.days !== undefined, {
    message: "Provide a name or days to update",
  });

export type GoalDayInput = z.infer<typeof goalDaySchema>;

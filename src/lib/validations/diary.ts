import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const createDiaryEntrySchema = z
  .object({
    date: dateString,
    mealName: z.string().min(1).max(40),
    foodId: z.uuid().optional(),
    customStoreOrderId: z.uuid().optional(),
    quantity: z.number().positive(),
    servingMultiplier: z.number().positive().default(1),
    servingText: z.string().max(60).optional(),
    loggedVia: z.enum([
      "search",
      "barcode",
      "voice",
      "natural_language",
      "store_builder",
      "saved_meal",
    ]),
  })
  .refine((value) => Boolean(value.foodId) !== Boolean(value.customStoreOrderId), {
    message: "Provide exactly one of foodId or customStoreOrderId",
  });

export const updateDiaryEntrySchema = z.object({
  quantity: z.number().positive().optional(),
  servingMultiplier: z.number().positive().optional(),
  mealName: z.string().min(1).max(40).optional(),
});

export const createDiaryMealSchema = z.object({
  date: dateString,
  mealName: z.string().min(1).max(40),
});

export const createSavedMealSchema = z.object({
  name: z.string().min(1).max(100),
  date: dateString,
  mealName: z.string().min(1).max(40),
});

export const logSavedMealSchema = z.object({
  savedMealId: z.uuid(),
  date: dateString,
  mealName: z.string().min(1).max(40),
});

export type CreateDiaryEntryInput = z.infer<typeof createDiaryEntrySchema>;

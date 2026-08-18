import { z } from "zod";

export const createCustomOrderSchema = z.object({
  name: z.string().min(1).max(100),
  baseMenuItemId: z.uuid().optional(),
  items: z
    .array(
      z.object({
        ingredientFoodId: z.uuid(),
        quantity: z.number().positive(),
      }),
    )
    .min(1)
    .max(50),
});

export type CreateCustomOrderInput = z.infer<typeof createCustomOrderSchema>;

/** A build-your-own pizza (size-scaled store): config + selections + slices. */
export const buildPizzaOrderSchema = z.object({
  configId: z.uuid(),
  sauce: z.string().max(60).nullable().optional(),
  cheeseLevel: z.enum(["None", "Light", "Regular", "Extra"]).default("Regular"),
  toppings: z
    .array(z.object({ name: z.string().max(60), qty: z.number().int().min(1).max(2) }))
    .max(20)
    .default([]),
  garlicOil: z.boolean().default(false),
  slices: z.number().int().min(1).max(24),
  name: z.string().min(1).max(100),
});
export type BuildPizzaOrderInput = z.infer<typeof buildPizzaOrderSchema>;

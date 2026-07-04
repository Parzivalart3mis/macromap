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

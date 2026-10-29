import { z } from "zod";

export const nutritionFieldsSchema = z.object({
  calories: z.number().nonnegative(),
  proteinG: z.number().nonnegative(),
  carbsG: z.number().nonnegative(),
  fatG: z.number().nonnegative(),
  fiberG: z.number().nonnegative().optional(),
  sugarG: z.number().nonnegative().optional(),
  satFatG: z.number().nonnegative().optional(),
  sodiumMg: z.number().nonnegative().optional(),
  cholesterolMg: z.number().nonnegative().optional(),
  potassiumMg: z.number().nonnegative().optional(),
  transFatG: z.number().nonnegative().optional(),
  polyUnsatFatG: z.number().nonnegative().optional(),
  monoUnsatFatG: z.number().nonnegative().optional(),
  addedSugarsG: z.number().nonnegative().optional(),
  sugarAlcoholsG: z.number().nonnegative().optional(),
  // % Daily Value fields — can legitimately exceed 100 (e.g. fortified foods).
  vitaminAPct: z.number().nonnegative().optional(),
  vitaminCPct: z.number().nonnegative().optional(),
  calciumPct: z.number().nonnegative().optional(),
  ironPct: z.number().nonnegative().optional(),
  vitaminDPct: z.number().nonnegative().optional(),
});

const alternateServingSchema = z.object({
  unit: z.string().min(1).max(20),
  multiplier: z.number().positive().max(1000),
});

export const createFoodSchema = nutritionFieldsSchema.extend({
  name: z.string().min(1).max(200),
  brandName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  servingSizeValue: z.number().positive(),
  servingSizeUnit: z.string().min(1).max(20),
  alternateServings: z.array(alternateServingSchema).max(12).optional(),
  barcode: z.string().min(8).max(32).optional(),
  forceCreate: z.boolean().default(false),
});

export const updateFoodSchema = nutritionFieldsSchema
  .partial()
  .extend({
    name: z.string().min(1).max(200).optional(),
    brandName: z.string().max(100).nullable().optional(),
    description: z.string().max(500).nullable().optional(),
    servingSizeValue: z.number().positive().optional(),
    servingSizeUnit: z.string().min(1).max(20).optional(),
    alternateServings: z.array(alternateServingSchema).max(12).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

/**
 * What an admin may create that a member may not: an entry marked verified, and
 * a place for it on a chain store's menu. Deliberately a separate schema from
 * createFoodSchema so the member path cannot grow these fields by accident.
 */
export const adminCreateFoodSchema = createFoodSchema.extend({
  /** A labelled product or a general food — see the verified definition. */
  isVerified: z.boolean().default(true),
  store: z
    .object({
      storeId: z.string().uuid(),
      /** Free text: stores name their own sections ("Dairy", "Bakery & Bread"). */
      menuCategory: z.string().min(1).max(60),
      /** A menu item by default; an ingredient feeds the build-your-own picker. */
      placement: z.enum(["menu", "builder"]).default("menu"),
      /** Only meaningful for builder placement. */
      ingredientGroup: z.string().min(1).max(60).optional(),
    })
    .optional(),
});

export const barcodeLookupSchema = z.object({
  barcode: z
    .string()
    .min(8)
    .max(32)
    .regex(/^\d+$/, "Barcode must be digits only"),
});

export const naturalLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  mealName: z.string().min(1).max(40),
  text: z.string().min(3).max(500),
});

export type CreateFoodInput = z.infer<typeof createFoodSchema>;
export type AdminCreateFoodInput = z.infer<typeof adminCreateFoodSchema>;
export type UpdateFoodInput = z.infer<typeof updateFoodSchema>;

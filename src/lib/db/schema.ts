import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import type { NutritionSnapshot, SavedMealEntrySnapshot } from "@/types/nutrition";

export const unitSystemEnum = pgEnum("unit_system", ["metric", "imperial"]);

export const foodSourceTypeEnum = pgEnum("food_source_type", [
  "official_store",
  "barcode_api",
  "open_food_facts",
  "user_created",
]);

export const loggedViaEnum = pgEnum("logged_via", [
  "search",
  "barcode",
  "voice",
  "natural_language",
  "store_builder",
  "saved_meal",
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  timezone: text("timezone").notNull().default("UTC"),
  unitSystem: unitSystemEnum("unit_system").notNull().default("metric"),
  heightCm: doublePrecision("height_cm"),
  startingWeightKg: doublePrecision("starting_weight_kg"),
  dateOfBirth: date("date_of_birth"),
  sex: text("sex"),
});

export const goalProfiles = pgTable(
  "goal_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("goal_profiles_user_idx").on(t.userId)],
);

export const goalDays = pgTable(
  "goal_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    goalProfileId: uuid("goal_profile_id")
      .notNull()
      .references(() => goalProfiles.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    calories: integer("calories").notNull(),
    proteinG: doublePrecision("protein_g").notNull(),
    carbsG: doublePrecision("carbs_g").notNull(),
    fatG: doublePrecision("fat_g").notNull(),
    fiberG: doublePrecision("fiber_g"),
    sugarGMax: doublePrecision("sugar_g_max"),
    sodiumMgMax: doublePrecision("sodium_mg_max"),
    satFatGMax: doublePrecision("sat_fat_g_max"),
  },
  (t) => [uniqueIndex("goal_days_profile_day_idx").on(t.goalProfileId, t.dayOfWeek)],
);

export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    brandName: text("brand_name"),
    sourceType: foodSourceTypeEnum("source_type").notNull().default("user_created"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    servingSizeValue: doublePrecision("serving_size_value").notNull(),
    servingSizeUnit: text("serving_size_unit").notNull(),
    calories: doublePrecision("calories").notNull(),
    proteinG: doublePrecision("protein_g").notNull(),
    carbsG: doublePrecision("carbs_g").notNull(),
    fatG: doublePrecision("fat_g").notNull(),
    fiberG: doublePrecision("fiber_g"),
    sugarG: doublePrecision("sugar_g"),
    satFatG: doublePrecision("sat_fat_g"),
    sodiumMg: doublePrecision("sodium_mg"),
    cholesterolMg: doublePrecision("cholesterol_mg"),
    potassiumMg: doublePrecision("potassium_mg"),
    transFatG: doublePrecision("trans_fat_g"),
    polyUnsatFatG: doublePrecision("poly_unsat_fat_g"),
    monoUnsatFatG: doublePrecision("mono_unsat_fat_g"),
    addedSugarsG: doublePrecision("added_sugars_g"),
    sugarAlcoholsG: doublePrecision("sugar_alcohols_g"),
    // FDA-label micronutrients, stored as % Daily Value per serving.
    vitaminAPct: doublePrecision("vitamin_a_pct"),
    vitaminCPct: doublePrecision("vitamin_c_pct"),
    calciumPct: doublePrecision("calcium_pct"),
    ironPct: doublePrecision("iron_pct"),
    vitaminDPct: doublePrecision("vitamin_d_pct"),
    barcode: text("barcode"),
    isVerified: boolean("is_verified").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("foods_barcode_idx")
      .on(t.barcode)
      .where(sql`${t.barcode} is not null`),
    index("foods_name_trgm_idx").using(
      "gin",
      sql`(${t.name} || ' ' || coalesce(${t.brandName}, '')) gin_trgm_ops`,
    ),
  ],
);

export const foodEditHistory = pgTable(
  "food_edit_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    editedByUserId: text("edited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fieldChanged: text("field_changed").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    editedAt: timestamp("edited_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("food_edit_history_food_idx").on(t.foodId, t.editedAt.desc())],
);

export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brandThemeKey: text("brand_theme_key").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const storeThemeTokens = pgTable("store_theme_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id")
    .notNull()
    .references(() => stores.id, { onDelete: "cascade" }),
  primaryHex: text("primary_hex").notNull(),
  secondaryHex: text("secondary_hex").notNull(),
  accentHex: text("accent_hex").notNull(),
  surfaceTintHex: text("surface_tint_hex").notNull(),
  textOverrideHex: text("text_override_hex"),
});

export const storeMenuItems = pgTable(
  "store_menu_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    isDefaultVerified: boolean("is_default_verified").notNull().default(true),
    menuCategory: text("menu_category").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [
    index("store_menu_items_store_idx").on(t.storeId, t.menuCategory, t.displayOrder),
  ],
);

export const storeIngredients = pgTable(
  "store_ingredients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id, { onDelete: "cascade" }),
    ingredientGroup: text("ingredient_group").notNull(),
    isDefaultSelected: boolean("is_default_selected").notNull().default(false),
  },
  (t) => [index("store_ingredients_store_idx").on(t.storeId, t.ingredientGroup)],
);

export const customStoreOrders = pgTable(
  "custom_store_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    storeId: uuid("store_id")
      .notNull()
      .references(() => stores.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    baseMenuItemId: uuid("base_menu_item_id").references(() => storeMenuItems.id, {
      onDelete: "set null",
    }),
    nutritionSnapshotJson: jsonb("nutrition_snapshot_json")
      .$type<NutritionSnapshot>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("custom_store_orders_user_store_idx").on(t.userId, t.storeId)],
);

export const customStoreOrderItems = pgTable("custom_store_order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  customStoreOrderId: uuid("custom_store_order_id")
    .notNull()
    .references(() => customStoreOrders.id, { onDelete: "cascade" }),
  ingredientFoodId: uuid("ingredient_food_id")
    .notNull()
    .references(() => foods.id, { onDelete: "cascade" }),
  quantity: doublePrecision("quantity").notNull().default(1),
});

export const diaryDays = pgTable(
  "diary_days",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    goalProfileId: uuid("goal_profile_id").references(() => goalProfiles.id, {
      onDelete: "set null",
    }),
  },
  (t) => [uniqueIndex("diary_days_user_date_idx").on(t.userId, t.date)],
);

export const diaryMeals = pgTable(
  "diary_meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    diaryDayId: uuid("diary_day_id")
      .notNull()
      .references(() => diaryDays.id, { onDelete: "cascade" }),
    mealName: text("meal_name").notNull(),
    displayOrder: integer("display_order").notNull().default(0),
  },
  (t) => [index("diary_meals_day_idx").on(t.diaryDayId, t.displayOrder)],
);

export const diaryEntries = pgTable(
  "diary_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    diaryMealId: uuid("diary_meal_id")
      .notNull()
      .references(() => diaryMeals.id, { onDelete: "cascade" }),
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    customStoreOrderId: uuid("custom_store_order_id").references(
      () => customStoreOrders.id,
      { onDelete: "set null" },
    ),
    quantity: doublePrecision("quantity").notNull().default(1),
    servingMultiplier: doublePrecision("serving_multiplier").notNull().default(1),
    loggedVia: loggedViaEnum("logged_via").notNull().default("search"),
    nutritionSnapshotJson: jsonb("nutrition_snapshot_json")
      .$type<NutritionSnapshot & { label: string }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("diary_entries_meal_idx").on(t.diaryMealId, t.createdAt)],
);

export const savedMeals = pgTable(
  "saved_meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    entriesSnapshotJson: jsonb("entries_snapshot_json")
      .$type<SavedMealEntrySnapshot[]>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("saved_meals_user_idx").on(t.userId)],
);

export const weightLogs = pgTable(
  "weight_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    weightValue: doublePrecision("weight_value").notNull(),
  },
  (t) => [uniqueIndex("weight_logs_user_date_idx").on(t.userId, t.date)],
);

export const bodyMetricLogs = pgTable(
  "body_metric_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    bodyFatPct: doublePrecision("body_fat_pct"),
    waistCm: doublePrecision("waist_cm"),
    notes: text("notes"),
  },
  (t) => [index("body_metric_logs_user_date_idx").on(t.userId, t.date)],
);

export const fastingSessions = pgTable(
  "fasting_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes"),
  },
  (t) => [index("fasting_sessions_user_start_idx").on(t.userId, t.startAt.desc())],
);

export const barcodeIngestLogs = pgTable("barcode_ingest_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  barcode: text("barcode").notNull(),
  resolvedFoodId: uuid("resolved_food_id").references(() => foods.id, {
    onDelete: "set null",
  }),
  sourceUsed: text("source_used").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const aiLoggingRuns = pgTable("ai_logging_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  inputText: text("input_text").notNull(),
  parsedJson: jsonb("parsed_json"),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type GoalProfile = typeof goalProfiles.$inferSelect;
export type GoalDay = typeof goalDays.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type NewFood = typeof foods.$inferInsert;
export type Store = typeof stores.$inferSelect;
export type StoreThemeToken = typeof storeThemeTokens.$inferSelect;
export type StoreMenuItem = typeof storeMenuItems.$inferSelect;
export type StoreIngredient = typeof storeIngredients.$inferSelect;
export type CustomStoreOrder = typeof customStoreOrders.$inferSelect;
export type DiaryDay = typeof diaryDays.$inferSelect;
export type DiaryMeal = typeof diaryMeals.$inferSelect;
export type DiaryEntry = typeof diaryEntries.$inferSelect;
export type SavedMeal = typeof savedMeals.$inferSelect;
export type WeightLog = typeof weightLogs.$inferSelect;
export type BodyMetricLog = typeof bodyMetricLogs.$inferSelect;
export type FastingSession = typeof fastingSessions.$inferSelect;

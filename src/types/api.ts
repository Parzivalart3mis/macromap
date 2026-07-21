import type { AlternateServing, NutritionSnapshot } from "./nutrition";

/** Client-side DTOs — server rows after JSON serialization (dates as strings). */

export interface FoodDTO {
  id: string;
  name: string;
  brandName: string | null;
  description: string | null;
  createdByUserId: string | null;
  sourceType: "official_store" | "barcode_api" | "open_food_facts" | "user_created";
  servingSizeValue: number;
  servingSizeUnit: string;
  servingSizeLabel: string | null;
  alternateServings: AlternateServing[];
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  sodiumMg: number | null;
  cholesterolMg: number | null;
  potassiumMg: number | null;
  transFatG: number | null;
  polyUnsatFatG: number | null;
  monoUnsatFatG: number | null;
  addedSugarsG: number | null;
  sugarAlcoholsG: number | null;
  vitaminAPct: number | null;
  vitaminCPct: number | null;
  calciumPct: number | null;
  ironPct: number | null;
  vitaminDPct: number | null;
  barcode: string | null;
  isVerified: boolean;
  isRecipe: boolean;
  logCount: number;
}

export interface DiaryEntryDTO {
  id: string;
  diaryMealId: string;
  foodId: string | null;
  customStoreOrderId: string | null;
  quantity: number;
  servingMultiplier: number;
  loggedVia: string;
  eatenTime: string | null;
  nutritionSnapshotJson: NutritionSnapshot & { label: string; serving?: string; brand?: string };
  /** Whether the underlying food currently carries the verified badge. */
  verified: boolean;
  createdAt: string;
}

export interface DiaryMealDTO {
  id: string;
  mealName: string;
  displayOrder: number;
  entries: DiaryEntryDTO[];
  totals: NutritionSnapshot;
}

export interface GoalDTO {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarGMax: number | null;
  sodiumMgMax: number | null;
  satFatGMax: number | null;
}

export interface DiaryPayloadDTO {
  date: string;
  meals: DiaryMealDTO[];
  totals: NutritionSnapshot;
  goal: GoalDTO | null;
}

export interface StoreThemeDTO {
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  surfaceTintHex: string;
  textOverrideHex: string | null;
}

export interface StoreDTO {
  id: string;
  name: string;
  slug: string;
  brandThemeKey: string;
  theme: StoreThemeDTO | null;
  menuItemCount?: number;
}

export interface StoreMenuItemDTO {
  id: string;
  menuCategory: string;
  isDefaultVerified: boolean;
  food: FoodDTO;
}

export interface StoreIngredientDTO {
  id: string;
  ingredientGroup: string;
  isDefaultSelected: boolean;
  food: FoodDTO;
}

export interface CustomStoreOrderItemDTO {
  ingredientFoodId: string;
  quantity: number;
}

export interface CustomStoreOrderDTO {
  id: string;
  storeId: string;
  name: string;
  nutritionSnapshotJson: NutritionSnapshot;
  createdAt: string;
  items?: CustomStoreOrderItemDTO[];
}

export interface SavedMealDTO {
  id: string;
  name: string;
  directions: string | null;
  entriesSnapshotJson: Array<{
    label: string;
    quantity: number;
    servingMultiplier: number;
    nutrition: NutritionSnapshot;
  }>;
  createdAt: string;
}

export interface ExternalFoodResultDTO {
  source: "usda" | "open_food_facts";
  name: string;
  brandName: string | null;
  barcode: string | null;
  servingSizeValue: number;
  servingSizeUnit: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG?: number;
  sugarG?: number;
  satFatG?: number;
  sodiumMg?: number;
  cholesterolMg?: number;
  potassiumMg?: number;
  transFatG?: number;
}

export interface NaturalLogSuggestionDTO {
  inputName: string;
  quantity: number;
  unit: string | null;
  matchedFood: FoodDTO | null;
  estimatedNutrition: NutritionSnapshot | null;
}

export interface FastingSessionDTO {
  id: string;
  startAt: string;
  endAt: string | null;
  durationMinutes: number | null;
}

export interface WeightLogDTO {
  id: string;
  date: string;
  weightValue: number;
}

export interface BodyMetricLogDTO {
  id: string;
  date: string;
  bodyFatPct: number | null;
  waistCm: number | null;
  notes: string | null;
}

export interface GoalProfileDTO {
  id: string;
  name: string;
  isActive: boolean;
  days: Array<{
    id: string;
    dayOfWeek: number;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    fiberG: number | null;
    sugarGMax: number | null;
    sodiumMgMax: number | null;
    satFatGMax: number | null;
  }>;
}

export interface StreakDTO {
  current: number;
  longest: number;
  todayLogged: boolean;
}

export interface ProgressOverviewDTO {
  today: { totals: NutritionSnapshot; goal: GoalDTO | null };
  calorieHistory: Array<{ date: string; calories: number; goal: number | null }>;
  weights: WeightLogDTO[];
  bodyMetrics: BodyMetricLogDTO[];
}

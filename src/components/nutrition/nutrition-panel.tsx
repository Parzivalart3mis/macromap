import type { NutritionSnapshot } from "@/types/nutrition";

const ROWS: Array<{ key: keyof NutritionSnapshot; label: string; unit: string }> = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "carbsG", label: "Carbohydrates", unit: "g" },
  { key: "fiberG", label: "Fiber", unit: "g" },
  { key: "sugarG", label: "Sugar", unit: "g" },
  { key: "fatG", label: "Fat", unit: "g" },
  { key: "satFatG", label: "Saturated fat", unit: "g" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
  { key: "potassiumMg", label: "Potassium", unit: "mg" },
];

/** Full nutrition facts panel for any snapshot. */
export function NutritionPanel({ nutrition }: { nutrition: NutritionSnapshot }) {
  return (
    <dl className="nutrition-panel divide-y rounded-xl border bg-card text-sm">
      {ROWS.map(({ key, label, unit }) => {
        const value = nutrition[key];
        if (value == null) return null;
        return (
          <div key={key} className="flex items-center justify-between px-4 py-2">
            <dt className={key === "calories" ? "font-semibold" : ""}>{label}</dt>
            <dd className="tabular-nums text-muted-foreground">
              {Math.round(value * 10) / 10} {unit}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

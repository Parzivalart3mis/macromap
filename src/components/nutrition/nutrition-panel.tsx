import type { NutritionSnapshot } from "@/types/nutrition";

const ROWS: Array<{ key: keyof NutritionSnapshot; label: string; unit: string }> = [
  { key: "calories", label: "Calories", unit: "kcal" },
  { key: "fatG", label: "Total fat", unit: "g" },
  { key: "satFatG", label: "Saturated fat", unit: "g" },
  { key: "polyUnsatFatG", label: "Polyunsaturated fat", unit: "g" },
  { key: "monoUnsatFatG", label: "Monounsaturated fat", unit: "g" },
  { key: "transFatG", label: "Trans fat", unit: "g" },
  { key: "cholesterolMg", label: "Cholesterol", unit: "mg" },
  { key: "sodiumMg", label: "Sodium", unit: "mg" },
  { key: "potassiumMg", label: "Potassium", unit: "mg" },
  { key: "carbsG", label: "Total carbohydrates", unit: "g" },
  { key: "fiberG", label: "Dietary fiber", unit: "g" },
  { key: "sugarG", label: "Sugars", unit: "g" },
  { key: "addedSugarsG", label: "Added sugars", unit: "g" },
  { key: "sugarAlcoholsG", label: "Sugar alcohols", unit: "g" },
  { key: "proteinG", label: "Protein", unit: "g" },
  { key: "vitaminAPct", label: "Vitamin A", unit: "% DV" },
  { key: "vitaminCPct", label: "Vitamin C", unit: "% DV" },
  { key: "calciumPct", label: "Calcium", unit: "% DV" },
  { key: "ironPct", label: "Iron", unit: "% DV" },
  { key: "vitaminDPct", label: "Vitamin D", unit: "% DV" },
];

/**
 * Full nutrition facts panel for any snapshot. With `showAll`, missing values
 * render as a dash (MFP-style label table) instead of hiding the row.
 */
export function NutritionPanel({
  nutrition,
  showAll = false,
}: {
  nutrition: NutritionSnapshot;
  showAll?: boolean;
}) {
  return (
    <dl className="nutrition-panel divide-y rounded-xl border bg-card text-sm">
      {ROWS.map(({ key, label, unit }) => {
        const value = nutrition[key];
        if (value == null && !showAll) return null;
        return (
          <div key={key} className="flex items-center justify-between px-4 py-2">
            <dt className={key === "calories" ? "font-semibold" : ""}>{label}</dt>
            <dd className="tabular-nums text-muted-foreground">
              {value == null ? "–" : `${Math.round(value * 10) / 10} ${unit}`}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

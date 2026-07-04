/**
 * Imports foods from a Notion CSV export into the shared food database,
 * owned by a given user (user_created, unverified).
 *
 * Get the CSV: open the Notion database -> ••• menu -> Export ->
 * "Markdown & CSV" -> unzip -> the .csv file is the table.
 *
 * Run: pnpm tsx scripts/import-notion-foods.ts <path-to.csv> [--dry-run]
 *
 * Recognized columns (case/spacing-insensitive; extras are ignored):
 *   Name / Food / Item, Serving Size, Calories, Total Fat, Saturated Fat,
 *   Polyunsaturated Fat, Monounsaturated Fat, Trans Fat, Cholesterol, Sodium,
 *   Potassium, Total Carbohydrates / Carbs, Dietary Fiber, Sugars,
 *   Added Sugars, Sugar Alcohols, Protein, Vitamin A, Vitamin C, Calcium,
 *   Iron, Vitamin D  (vitamins/minerals read as % Daily Value)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { and, eq, ilike } from "drizzle-orm";

import * as schema from "../src/lib/db/schema";

const OWNER_USER_ID = "user_3G2OwFaNf3IIQTsIfA4uqzU9vSB"; // Yash

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const db = drizzle(neon(url), { schema });

// --- tiny CSV parser (handles quotes, commas, newlines in cells) ---
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

// normalized header -> food field
const COLUMN_MAP: Record<string, string> = {
  name: "name",
  food: "name",
  item: "name",
  foodname: "name",
  brand: "brandName",
  brandname: "brandName",
  servingsize: "serving",
  serving: "serving",
  calories: "calories",
  kcal: "calories",
  totalfat: "fatG",
  fat: "fatG",
  saturatedfat: "satFatG",
  satfat: "satFatG",
  polyunsaturatedfat: "polyUnsatFatG",
  monounsaturatedfat: "monoUnsatFatG",
  transfat: "transFatG",
  cholesterol: "cholesterolMg",
  sodium: "sodiumMg",
  potassium: "potassiumMg",
  totalcarbohydrates: "carbsG",
  totalcarbohydrate: "carbsG",
  carbohydrates: "carbsG",
  carbs: "carbsG",
  dietaryfiber: "fiberG",
  fiber: "fiberG",
  sugars: "sugarG",
  sugar: "sugarG",
  addedsugars: "addedSugarsG",
  sugaralcohols: "sugarAlcoholsG",
  protein: "proteinG",
  vitamina: "vitaminAPct",
  vitaminc: "vitaminCPct",
  calcium: "calciumPct",
  iron: "ironPct",
  vitamind: "vitaminDPct",
};

function parseNumber(raw: string): number | undefined {
  const match = raw.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;
  const value = Number(match[0]);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** "1 scoop (29g)" -> { value: 1, unit: "scoop (29g)" }; "100g" -> { 100, "g" } */
function parseServing(raw: string): { value: number; unit: string } {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (match && Number(match[1]) > 0) {
    const unit = (match[2] || "serving").trim().slice(0, 20);
    return { value: Number(match[1]), unit: unit || "serving" };
  }
  return { value: 1, unit: trimmed.slice(0, 20) || "serving" };
}

async function main() {
  const [csvPath, flag] = process.argv.slice(2);
  const dryRun = flag === "--dry-run";
  if (!csvPath) {
    console.error("Usage: pnpm tsx scripts/import-notion-foods.ts <file.csv> [--dry-run]");
    process.exit(1);
  }

  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  if (rows.length < 2) {
    console.error("CSV has no data rows");
    process.exit(1);
  }

  const headers = rows[0].map((h) => COLUMN_MAP[normalize(h)] ?? null);
  if (!headers.includes("name")) {
    console.error(`No name column found. Headers seen: ${rows[0].join(", ")}`);
    process.exit(1);
  }
  console.log(
    "Mapped columns:",
    rows[0].map((h, i) => `${h} -> ${headers[i] ?? "(ignored)"}`).join(" | "),
  );

  let created = 0;
  let skipped = 0;
  for (const cells of rows.slice(1)) {
    const record: Record<string, string> = {};
    headers.forEach((field, i) => {
      if (field && cells[i] != null && cells[i].trim() !== "") {
        record[field] = cells[i].trim();
      }
    });
    const name = record.name;
    if (!name) {
      skipped++;
      continue;
    }

    const [existing] = await db
      .select({ id: schema.foods.id })
      .from(schema.foods)
      .where(
        and(
          ilike(schema.foods.name, name),
          eq(schema.foods.createdByUserId, OWNER_USER_ID),
        ),
      )
      .limit(1);
    if (existing) {
      console.log(`= exists, skipping: ${name}`);
      skipped++;
      continue;
    }

    const serving = parseServing(record.serving ?? "1 serving");
    const num = (field: string) => (record[field] ? parseNumber(record[field]) : undefined);

    const values = {
      name,
      brandName: record.brandName ?? null,
      sourceType: "user_created" as const,
      createdByUserId: OWNER_USER_ID,
      servingSizeValue: serving.value,
      servingSizeUnit: serving.unit,
      calories: num("calories") ?? 0,
      proteinG: num("proteinG") ?? 0,
      carbsG: num("carbsG") ?? 0,
      fatG: num("fatG") ?? 0,
      fiberG: num("fiberG") ?? null,
      sugarG: num("sugarG") ?? null,
      satFatG: num("satFatG") ?? null,
      sodiumMg: num("sodiumMg") ?? null,
      cholesterolMg: num("cholesterolMg") ?? null,
      potassiumMg: num("potassiumMg") ?? null,
      transFatG: num("transFatG") ?? null,
      polyUnsatFatG: num("polyUnsatFatG") ?? null,
      monoUnsatFatG: num("monoUnsatFatG") ?? null,
      addedSugarsG: num("addedSugarsG") ?? null,
      sugarAlcoholsG: num("sugarAlcoholsG") ?? null,
      vitaminAPct: num("vitaminAPct") ?? null,
      vitaminCPct: num("vitaminCPct") ?? null,
      calciumPct: num("calciumPct") ?? null,
      ironPct: num("ironPct") ?? null,
      vitaminDPct: num("vitaminDPct") ?? null,
      isVerified: false,
    };

    if (dryRun) {
      console.log("+ would create:", JSON.stringify(values));
    } else {
      await db.insert(schema.foods).values(values);
      console.log(`+ created: ${name} (${values.calories} kcal / ${serving.value} ${serving.unit})`);
    }
    created++;
  }

  console.log(`${dryRun ? "[dry run] " : ""}Done: ${created} created, ${skipped} skipped`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

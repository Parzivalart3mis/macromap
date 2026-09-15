# Task: Add food items to MacroMap from nutrition labels

> **How to use:** paste this whole file as the prompt for a coding agent, then attach
> the label photo(s) and say which store (if any) the items belong to. The agent
> must present a review table and wait for approval before writing anything.

You are adding foods to **MacroMap** (Next.js + Neon Postgres via Drizzle) from
nutrition-label photos the user provides. Follow this protocol exactly. The user's
#1 priority is **logging/goal-math correctness** — a wrong number silently
corrupts their diary, so accuracy beats speed.

## Non-negotiable rules
1. **Review first, then wait.** Read the label(s), present a full review table (format
   below), and STOP. Do not write to the DB until the user explicitly approves.
2. **Backup before any write.** Take a full logical backup (every public table →
   JSON + a row-count manifest) into the scratchpad dir BEFORE the first mutation.
3. **Never duplicate, never silently overwrite.** Dupe-check by barcode AND by
   name+brand. If a matching/similar verified item already exists, surface it
   (show its serving + nutrition side by side) and let the user choose overwrite vs
   add-second. Note: an existing item with 0 logs / 0 diary references is safe to
   overwrite; one with references is not.
4. **Integrity-verify after.** Diff the live DB against the backup: row-count
   deltas must be exactly the expected inserts, and NO pre-existing row may have
   changed in any column. Spot-check the new rows. Report the result.
5. **DB data changes are never git commits.** Don't commit or push for data work.
   The backup + integrity diff is the record.
6. Transcribe values exactly as printed. Never rescale nutrition unless the user
   asks to change the serving *quantity* (see serving rules).

## DB access recipe
Write temp scripts in the **project root** (module resolution needs it), run,
then delete:
```ts
import { config } from "dotenv"; config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL!);
// tagged template for static SQL: sql`select ...`
// sql.query(text, params) for dynamic SQL / $1 params
```
Run: `pnpm exec tsx X.tmp.ts 2>&1 | grep -v "injected env"; rm -f X.tmp.ts`

Backups go in the session's scratchpad directory (named in the system prompt),
never into the repo.

## Data model
`foods` columns you set:
- `name`, `brand_name` (the brand on the pack; user may override, e.g. distributor)
- `source_type='official_store'`, `created_by_user_id=NULL`, `is_verified=true`,
  `is_recipe=false`  ← this is what "verified / green tick / under no person" means
- `serving_size_value`, `serving_size_unit`, `serving_size_label` (display override),
  `alternate_servings_json` (jsonb array of `{unit, multiplier, label}`)
- `barcode` (unique index — hence the dupe-check)
- nutrition per **base serving**: `calories, protein_g, carbs_g, fat_g, fiber_g,
  sugar_g, sat_fat_g, sodium_mg, cholesterol_mg, potassium_mg, trans_fat_g,
  poly_unsat_fat_g, mono_unsat_fat_g, added_sugars_g, sugar_alcohols_g`
- micros as **% Daily Value**: `vitamin_a_pct, vitamin_c_pct, calcium_pct,
  iron_pct, vitamin_d_pct`; potassium is **mg**. Anything not on the label → NULL.

Store link (only when the user names a store): `store_menu_items`
(`store_id, food_id, is_default_verified=true, menu_category, display_order`).
Look up the store by slug (`select id from stores where slug=$1`; Jewel Osco is
`jewel`), and set `display_order = max(display_order)+1` within that category.
A "shared DB" item with no store named gets NO store link.

## Serving-model rules (the part that's easy to get wrong)
The picker auto-adds g/oz/lb/kg/100g conversions for **weight/volume** units and
adds NOTHING for **count** units. Choose deliberately:
- **Counted items** (slices, pieces, rotis, cookies, cakes, packets, containers):
  count-based. `serving_size_value=<count>`, `serving_size_unit` = a count noun
  (`slice`, `piece`, `roti`, `cookie`, `container`), and put the weight in the
  label if useful: `serving_size_label='1 piece (45 g)'`. The user does NOT want
  g/oz clutter on these. Beware: `cup`, `oz`, `g`, `tbsp` are weight/volume units
  and WILL trigger conversions — for "1 cup" of a dipping sauce use unit
  `container` with label `1 cup`.
- **Weighed/measured items** (shredded cheese, butter, spreads, yogurt-by-weight):
  weight-based so grams stay available. `serving_size_value=<grams>`, unit `g`,
  label = the household measure: `'1/4 cup (28 g)'`, `'1 tbsp (14 g)'`.
- **Multi-unit labels** (e.g. "2 slices (57 g)"): ask the user. Default to base
  = the label serving (`value=2, unit='slices'`, nutrition as printed) plus an
  alternate `{"unit":"slice","multiplier":0.5,"label":"1 slice"}`. If the user
  wants a single-unit base instead, HALVE every nutrient field and set
  `value=1`; state that you're rescaling.
- **Relabel vs rescale:** changing "45 g" → "1 cookie" when 45 g IS one cookie is
  a relabel — nutrition unchanged. Only rescale when the quantity actually changes.
- Whole-item alternates (e.g. pizza "whole pizza", sandwich "whole sandwich") are
  alternates with `multiplier = <units per whole>`.

## Value-parsing rules
- "< 1 g" / "less than 1 g" → store `1` (ceiling) and flag it in the review.
- "0%", "0 g", "not a significant source" → `0`.
- %DV micros: store the printed % (e.g. Calcium 200 mg **15%** → `calcium_pct=15`).
- Barcode: UPC-A is 12 digits — "0 21130 04945 5" → `021130049455`. Omit if any
  digit is illegible; never guess.
- Servings-per-container is informational only (mention it, don't store it).
- If a value is ambiguous in the photo, say so in the review rather than guessing.

## Review table (present this and STOP for approval)
Items as columns, fields as rows. Include every field below, plus the serving
model and any flags:
Name · Brand · Store/category (or "shared DB, no store") · Verified ✅ ·
Serving size (+ model: count-based / weight-based, and any alternate) ·
Servings/pack · Barcode · Calories · Total Fat · Sat Fat · Trans Fat ·
Poly/Mono fat · Cholesterol · Sodium · Total Carb · Fiber · Total Sugars ·
Added Sugars · Protein · Potassium (mg) · Calcium %DV · Iron %DV · Vit D %DV ·
Vit A / Vit C (— if not on label).
Then list: choices you made (serving model, ceilings), fields left blank and why,
and any dupe you found. End with "Confirm and I'll add it."

## After approval — do these in order
1. **Backup**: dump all `information_schema.tables` (public, base tables, excluding
   `drizzle*`) to `db-backup-<stamp>.json` + `.manifest.json` (row counts).
2. **Dupe-check**: `barcode = ANY($1)`; and `name ILIKE` + `brand_name ILIKE`.
   Also check the target store's existing menu for a same-name item.
3. **Insert** foods (parameterized `sql.query`), then `store_menu_items` if a
   store was named. Print each inserted id/name/calories.
4. **Verify**: every table's count == manifest + expected delta; for `foods` (and
   `store_menu_items`), diff each pre-existing row column-by-column against the
   backup — must be 0 mutated; spot-check the new rows. Print "INTEGRITY OK" only
   if all hold.
5. **Report**: what was added (item, serving, per-serving summary, barcode),
   backup stamp, dupe-check result, integrity result. Data-only → no commit.

## If asked to CHANGE an existing item's serving
- Check whether it's a **builder ingredient** (`store_ingredients`) and whether
  any **saved builds** (`custom_store_order_items`) reference it. Their
  `quantity` is in units of the food's serving — if you change the serving
  quantity (e.g. 2 slices → 1 slice), scale those quantities inversely (×2) so
  each build still matches its frozen `nutrition_snapshot_json`. Snapshots and
  diary entries are frozen and must NOT be edited.
- Report how many builds/diary entries reference it before changing anything.

/**
 * One-off: backfill nutrition_snapshot_json.brand on existing diary entries so
 * store foods and custom builds show their store as the brand. Idempotent —
 * only touches entries that don't already have a brand.
 *
 * Run: pnpm tsx scripts/backfill-entry-brands.ts
 */
import { config } from "dotenv"; config({ path: ".env.local" }); config();
import { neon } from "@neondatabase/serverless";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL not set"); process.exit(1); }
const sql = neon(url);

async function main() {
  // Custom builds -> store name.
  const custom = await sql`
    update diary_entries e
    set nutrition_snapshot_json = jsonb_set(e.nutrition_snapshot_json, '{brand}', to_jsonb(s.name::text))
    from custom_store_orders o
    join stores s on s.id = o.store_id
    where e.custom_store_order_id = o.id
      and not (e.nutrition_snapshot_json ? 'brand')
    returning e.id`;

  // Food entries whose food still has a brand.
  const food = await sql`
    update diary_entries e
    set nutrition_snapshot_json = jsonb_set(e.nutrition_snapshot_json, '{brand}', to_jsonb(f.brand_name::text))
    from foods f
    where e.food_id = f.id and f.brand_name is not null
      and not (e.nutrition_snapshot_json ? 'brand')
    returning e.id`;

  // Orphaned entries (food deleted): parse a trailing "(Brand)" from the label.
  // Only accept a trailing "(…)" as a brand when it matches a real brand or
  // store name — labels like "Soup (cup)" must not backfill "cup" as a brand.
  const brandRows = await sql`
    select distinct brand_name as brand from foods where brand_name is not null
    union select name as brand from stores`;
  const knownBrands = new Map(
    (brandRows as { brand: string }[]).map((r) => [r.brand.toLowerCase(), r.brand]),
  );
  const orphans = await sql`
    select id, nutrition_snapshot_json->>'label' as label
    from diary_entries
    where food_id is null and custom_store_order_id is null
      and not (nutrition_snapshot_json ? 'brand')`;
  let parsed = 0;
  for (const o of orphans as { id: string; label: string | null }[]) {
    const m = /\(([^)]+)\)\s*$/.exec(o.label ?? "");
    const brand = m ? knownBrands.get(m[1].trim().toLowerCase()) : undefined;
    if (!brand) continue;
    await sql`update diary_entries
      set nutrition_snapshot_json = jsonb_set(nutrition_snapshot_json, '{brand}', to_jsonb(${brand}::text))
      where id = ${o.id}`;
    parsed++;
  }

  console.log(`Backfilled brand: custom=${custom.length}, food=${food.length}, orphanParsed=${parsed}/${orphans.length}`);
}
main().catch((e) => { console.error(e); process.exit(1); });

import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

export interface AdminOverview {
  foods: {
    total: number;
    verified: number;
    recipes: number;
    bySource: Array<{ sourceType: string; count: number; verified: number }>;
  };
  gaps: {
    brandedWithoutBarcode: number;
    neverLogged: number;
    duplicateNames: number;
    duplicateExtraRows: number;
  };
  stores: Array<{ name: string; slug: string; menuItems: number; ingredients: number }>;
  users: { total: number; admins: number };
}

/**
 * Catalogue health for the admin page. Everything here is shared data the
 * admin curates rather than anything belonging to one user, so every caller
 * must have checked requireAdmin first.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [totalsQ, bySourceQ, storesQ, usersQ, gapsQ, duplicatesQ] = await Promise.all([
    db.execute<{ foods: number; verified: number; recipes: number }>(sql`
      select count(*)::int as foods,
             count(*) filter (where is_verified)::int as verified,
             count(*) filter (where is_recipe)::int as recipes
      from foods`),
    db.execute<{ source_type: string; n: number; verified: number }>(sql`
      select source_type,
             count(*)::int as n,
             count(*) filter (where is_verified)::int as verified
      from foods group by source_type order by count(*) desc`),
    db.execute<{ name: string; slug: string; menu_items: number; ingredients: number }>(sql`
      select s.name, s.slug,
             (select count(*)::int from store_menu_items m where m.store_id = s.id) as menu_items,
             (select count(*)::int from store_ingredients i where i.store_id = s.id) as ingredients
      from stores s order by s.name`),
    db.execute<{ total: number; admins: number }>(sql`
      select count(*)::int as total,
             count(*) filter (where role = 'admin')::int as admins
      from users`),
    // The two gaps worth acting on: a branded item with no barcode cannot be
    // scanned, and a food nothing references is dead weight in search.
    db.execute<{ branded_no_barcode: number; never_logged: number }>(sql`
      select count(*) filter (where brand_name is not null and barcode is null)::int
               as branded_no_barcode,
             count(*) filter (where coalesce(log_count, 0) = 0)::int as never_logged
      from foods`),
    db.execute<{ names: number; extra_rows: number }>(sql`
      select count(*)::int as names, (coalesce(sum(c), 0) - count(*))::int as extra_rows
      from (select count(*)::int as c from foods group by lower(name) having count(*) > 1) t`),
  ]);

  const totals = totalsQ.rows[0];
  const users = usersQ.rows[0];
  const gaps = gapsQ.rows[0];
  const duplicates = duplicatesQ.rows[0];

  return {
    foods: {
      total: totals.foods,
      verified: totals.verified,
      recipes: totals.recipes,
      bySource: bySourceQ.rows.map((row) => ({
        sourceType: row.source_type,
        count: row.n,
        verified: row.verified,
      })),
    },
    gaps: {
      brandedWithoutBarcode: gaps.branded_no_barcode,
      neverLogged: gaps.never_logged,
      duplicateNames: duplicates.names,
      duplicateExtraRows: duplicates.extra_rows,
    },
    stores: storesQ.rows.map((row) => ({
      name: row.name,
      slug: row.slug,
      menuItems: row.menu_items,
      ingredients: row.ingredients,
    })),
    users: { total: users.total, admins: users.admins },
  };
}

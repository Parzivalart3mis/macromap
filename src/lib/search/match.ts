import type { FoodDTO, RecentItemDTO } from "@/types/api";

/**
 * Text matching for the local tab filters on the Add Food screen.
 *
 * Typing filters the open tab in the browser; only the search button runs the
 * full database search. Those two matchers have to agree on what counts as a
 * match, or an item is filtered out while typing and then reappears on submit.
 *
 * That is exactly what went wrong with brands. The filter compared the query to
 * the food's name alone, so "celsius" never matched the food stored as
 * "Sparkling Orange" by Celsius — the brand was on screen and in the payload,
 * just never in the comparison. Matching happens against every field the row
 * displays instead, so what you can see you can search for.
 */

/** Lowercased and trimmed; an empty query is a match-everything wildcard. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/**
 * True when `query` appears in any of `fields`. `query` must already be
 * normalized — callers filter whole lists, so it is normalized once per
 * keystroke rather than once per row.
 */
export function matchesFields(
  query: string,
  fields: ReadonlyArray<string | null | undefined>,
): boolean {
  if (!query) return true;
  return fields.some((field) => !!field && field.toLowerCase().includes(query));
}

/** The searchable text of a catalog food: what the row's title and subtitle show. */
export function foodFields(food: Pick<FoodDTO, "name" | "brandName">): Array<string | null> {
  return [food.name, food.brandName];
}

/**
 * The searchable text of a Recent/Frequent row. Store builds carry the store in
 * `brand`, and quick-adds have only their label.
 */
export function recentFields(item: RecentItemDTO): Array<string | null> {
  if (item.kind === "food") return foodFields(item.food);
  if (item.kind === "order") return [item.name, item.brand];
  return [item.label];
}

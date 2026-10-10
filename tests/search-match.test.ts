import { describe, expect, it } from "vitest";

import {
  foodFields,
  matchesFields,
  normalizeQuery,
  recentFields,
} from "@/lib/search/match";
import type { FoodDTO, RecentItemDTO } from "@/types/api";

const food = (name: string, brandName: string | null) =>
  ({ name, brandName }) as FoodDTO;

const recentFood = (name: string, brandName: string | null): RecentItemDTO => ({
  kind: "food",
  food: food(name, brandName),
  lastQuantity: 1,
  lastMultiplier: 1,
  lastServing: null,
});

describe("normalizeQuery", () => {
  it("lowercases and trims", () => {
    expect(normalizeQuery("  Celsius ")).toBe("celsius");
  });

  it("collapses a whitespace-only query to the wildcard", () => {
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("matchesFields", () => {
  it("matches any field, not just the first", () => {
    expect(matchesFields("celsius", ["Sparkling Orange", "Celsius"])).toBe(true);
    expect(matchesFields("sparkling", ["Sparkling Orange", "Celsius"])).toBe(true);
  });

  it("matches on a substring, as typing does", () => {
    expect(matchesFields("cels", ["Sparkling Orange", "Celsius"])).toBe(true);
  });

  it("is case-insensitive on the field side too", () => {
    expect(matchesFields("celsius", ["CELSIUS"])).toBe(true);
  });

  it("skips null and empty fields rather than throwing", () => {
    expect(matchesFields("celsius", [null, undefined, ""])).toBe(false);
    expect(matchesFields("orange", ["Sparkling Orange", null])).toBe(true);
  });

  it("treats an empty query as matching everything", () => {
    expect(matchesFields("", ["anything"])).toBe(true);
    expect(matchesFields("", [null])).toBe(true);
  });

  it("does not match a query absent from every field", () => {
    expect(matchesFields("pepsi", ["Sparkling Orange", "Celsius"])).toBe(false);
  });
});

describe("recentFields", () => {
  // The regression this module exists for: 16 of the 20 rows in the Recent tab
  // were unreachable by brand because only the name was compared.
  it("finds a food by its brand when the brand is not in the name", () => {
    const celsius = recentFood("Sparkling Orange", "Celsius");
    expect(matchesFields("celsius", recentFields(celsius))).toBe(true);
    expect(matchesFields("sparkling", recentFields(celsius))).toBe(true);
  });

  it.each([
    ["subway", "Pepper Jack", "Subway"],
    ["poppi", "Raspberry Rose", "Poppi"],
    ["propel", "Fitness Water, Kiwi Strawberry", "Propel"],
    ["myprotein", "Creatine Monohydrate (5g)", "MyProtein"],
    ["aunt millie", "Seeded Italian Bread", "Aunt Millie's"],
  ])("finds %s items by brand", (query, name, brand) => {
    expect(matchesFields(query, recentFields(recentFood(name, brand)))).toBe(true);
  });

  it("searches a store build by its store name", () => {
    const order: RecentItemDTO = {
      kind: "order",
      orderId: "o1",
      name: "Footlong, turkey",
      brand: "Subway",
      nutrition: { calories: 600, proteinG: 40, carbsG: 70, fatG: 15 },
      lastQuantity: 1,
      lastMultiplier: 1,
      lastServing: null,
    };
    expect(matchesFields("subway", recentFields(order))).toBe(true);
    expect(matchesFields("turkey", recentFields(order))).toBe(true);
  });

  it("searches a quick-add by its label", () => {
    const quick: RecentItemDTO = {
      kind: "quick",
      label: "Office birthday cake",
      nutrition: { calories: 300, proteinG: 3, carbsG: 40, fatG: 14 },
    };
    expect(matchesFields("cake", recentFields(quick))).toBe(true);
    expect(matchesFields("subway", recentFields(quick))).toBe(false);
  });

  it("tolerates a food with no brand", () => {
    expect(matchesFields("almond", recentFields(recentFood("Almonds, NFS", null)))).toBe(true);
  });
});

describe("foodFields", () => {
  it("covers name and brand for My Foods and recipes", () => {
    expect(matchesFields("lucerne", foodFields(food("Fat Free Mozzarella", "Lucerne")))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { rescaleEntrySnapshot, type EntrySnapshot } from "@/lib/diary/service";

/** A logged "1 cup (245 g)" of curd: 61 cal per 100 g × 2.45. */
const curdCup: EntrySnapshot = {
  calories: 149.5,
  proteinG: 8.5,
  carbsG: 11.4,
  fatG: 8,
  sodiumMg: 112.7,
  label: "Curd (Dahi), plain, whole milk",
  serving: "1 cup (245 g)",
};

const slices: EntrySnapshot = {
  calories: 140,
  proteinG: 1,
  carbsG: 21,
  fatG: 6,
  label: "Chips Ahoy! Chewy (Nabisco)",
  serving: "2 cookies",
  brand: "Nabisco",
};

describe("rescaleEntrySnapshot", () => {
  it("scales nutrition by the ratio", () => {
    const next = rescaleEntrySnapshot(slices, 2);
    expect(next.calories).toBe(280);
    expect(next.carbsG).toBe(42);
    expect(next.fatG).toBe(12);
  });

  it("scales the serving text for a plain count change", () => {
    expect(rescaleEntrySnapshot(slices, 2).serving).toBe("4 cookies");
    expect(rescaleEntrySnapshot(slices, 1.5).serving).toBe("3 cookies");
  });

  it("does not re-pluralize when scaling down to one (pre-existing cosmetic)", () => {
    // scaleServingText only rewrites the leading number, so the unit word is
    // left verbatim. Documented here so a future plural fix is a deliberate change.
    expect(rescaleEntrySnapshot(slices, 0.5).serving).toBe("1 cookies");
  });

  it("uses an explicit serving text verbatim when the unit changes", () => {
    // 1 cup (245 g) -> 100 g. Scaling the old text would give "0.41 cup".
    const next = rescaleEntrySnapshot(curdCup, 100 / 245, "100 g");
    expect(next.serving).toBe("100 g");
    expect(next.calories).toBe(61);
  });

  it("would mislabel without the explicit text (the bug this guards)", () => {
    const scaled = rescaleEntrySnapshot(curdCup, 100 / 245);
    expect(scaled.serving).not.toBe("100 g");
    expect(scaled.serving).toBe("0.41 cup");
  });

  it("keeps label and brand untouched", () => {
    const next = rescaleEntrySnapshot(slices, 3, "6 cookies");
    expect(next.label).toBe("Chips Ahoy! Chewy (Nabisco)");
    expect(next.brand).toBe("Nabisco");
    expect(next.serving).toBe("6 cookies");
  });

  it("ignores a blank explicit text and falls back to scaling", () => {
    expect(rescaleEntrySnapshot(slices, 2, "   ").serving).toBe("4 cookies");
    expect(rescaleEntrySnapshot(slices, 2, "").serving).toBe("4 cookies");
  });

  it("survives a snapshot with no serving text", () => {
    const bare: EntrySnapshot = { calories: 100, proteinG: 1, carbsG: 2, fatG: 3, label: "X" };
    expect(rescaleEntrySnapshot(bare, 2).serving).toBeUndefined();
    expect(rescaleEntrySnapshot(bare, 2, "1 cup").serving).toBe("1 cup");
  });

  it("drops no optional nutrition keys while rescaling", () => {
    const next = rescaleEntrySnapshot(curdCup, 2, "2 cups");
    expect(next.sodiumMg).toBe(225.4);
  });
});

import { describe, expect, it } from "vitest";

import {
  ageOn,
  bodyComposition,
  navyBodyFatPct,
  waistToHeight,
} from "@/lib/body/composition";

describe("navyBodyFatPct", () => {
  const male = { sex: "male" as const, heightCm: 172, neckCm: 38 };

  it("matches the published male formula", () => {
    // 172 cm, 38 cm neck: hand-checked against the Navy equation.
    expect(navyBodyFatPct({ ...male, waistCm: 80 })).toBeCloseTo(13.4, 1);
    expect(navyBodyFatPct({ ...male, waistCm: 85 })).toBeCloseTo(17.4, 1);
    expect(navyBodyFatPct({ ...male, waistCm: 90 })).toBeCloseTo(21.2, 1);
  });

  it("rises with waist and falls with neck", () => {
    const narrow = navyBodyFatPct({ ...male, waistCm: 85 })!;
    const wider = navyBodyFatPct({ ...male, waistCm: 95 })!;
    const thickerNeck = navyBodyFatPct({ ...male, neckCm: 42, waistCm: 85 })!;
    expect(wider).toBeGreaterThan(narrow);
    expect(thickerNeck).toBeLessThan(narrow);
  });

  it("uses the female variant, which needs hips", () => {
    const base = { sex: "female" as const, heightCm: 165, neckCm: 32, waistCm: 75 };
    expect(navyBodyFatPct(base)).toBeNull(); // no hips -> no estimate
    const withHips = navyBodyFatPct({ ...base, hipCm: 95 });
    expect(withHips).not.toBeNull();
    expect(withHips!).toBeGreaterThan(20);
    expect(withHips!).toBeLessThan(40);
  });

  it("declines to estimate rather than guessing", () => {
    expect(navyBodyFatPct({ ...male, waistCm: null })).toBeNull();
    expect(navyBodyFatPct({ ...male, neckCm: null, waistCm: 85 })).toBeNull();
    expect(navyBodyFatPct({ ...male, heightCm: null, waistCm: 85 })).toBeNull();
    expect(navyBodyFatPct({ sex: null, heightCm: 172, neckCm: 38, waistCm: 85 })).toBeNull();
    expect(
      navyBodyFatPct({ sex: "unspecified", heightCm: 172, neckCm: 38, waistCm: 85 }),
    ).toBeNull();
  });

  it("returns null when waist does not exceed neck (log undefined)", () => {
    expect(navyBodyFatPct({ ...male, neckCm: 40, waistCm: 40 })).toBeNull();
    expect(navyBodyFatPct({ ...male, neckCm: 45, waistCm: 40 })).toBeNull();
  });
});

describe("waistToHeight", () => {
  it("bands a 172 cm frame the way the reference ranges do", () => {
    expect(waistToHeight(73, 172)!.band).toBe("lean"); // 0.424
    expect(waistToHeight(74, 172)!.band).toBe("athletic"); // 0.430, just past the cutoff
    expect(waistToHeight(77, 172)!.band).toBe("athletic");
    expect(waistToHeight(80, 172)!.band).toBe("fit");
    expect(waistToHeight(85, 172)!.band).toBe("healthy");
    expect(waistToHeight(90, 172)!.band).toBe("elevated");
    expect(waistToHeight(105, 172)!.band).toBe("high");
  });

  it("puts 0.5 exactly at the healthy ceiling", () => {
    expect(waistToHeight(86, 172)!.ratio).toBe(0.5);
    expect(waistToHeight(86, 172)!.band).toBe("healthy");
    expect(waistToHeight(86.5, 172)!.band).toBe("elevated");
  });

  it("reports the waist that reaches the next band down", () => {
    expect(waistToHeight(90, 172)!.nextBandCm).toBe(86); // elevated -> healthy
    expect(waistToHeight(73, 172)!.nextBandCm).toBeNull(); // already leanest
  });

  it("is height-relative, not absolute", () => {
    // The same 85 cm waist reads very differently depending on frame.
    expect(waistToHeight(85, 150)!.band).toBe("high"); // 0.567
    expect(waistToHeight(85, 172)!.band).toBe("healthy"); // 0.494
    expect(waistToHeight(85, 195)!.band).toBe("athletic"); // 0.436
  });

  it("returns null on missing or nonsense input", () => {
    expect(waistToHeight(null, 172)).toBeNull();
    expect(waistToHeight(85, null)).toBeNull();
    expect(waistToHeight(0, 172)).toBeNull();
  });
});

describe("bodyComposition", () => {
  it("splits weight into lean and fat", () => {
    expect(bodyComposition(75.95, 18)).toEqual({ leanKg: 62.3, fatKg: 13.7 });
    expect(bodyComposition(75.95, 20)).toEqual({ leanKg: 60.8, fatKg: 15.2 });
  });

  it("the two parts add back to the weight", () => {
    const c = bodyComposition(80, 22)!;
    expect(c.leanKg + c.fatKg).toBeCloseTo(80, 1);
  });

  it("returns null without both inputs", () => {
    expect(bodyComposition(null, 18)).toBeNull();
    expect(bodyComposition(75, null)).toBeNull();
    expect(bodyComposition(75, 100)).toBeNull();
  });
});

describe("ageOn", () => {
  it("counts whole years", () => {
    expect(ageOn("2000-01-01", "2026-10-09")).toBe(26);
    expect(ageOn("2000-10-09", "2026-10-09")).toBe(26); // birthday today
    expect(ageOn("2000-10-10", "2026-10-09")).toBe(25); // day before
  });

  it("returns null when unknown or implausible", () => {
    expect(ageOn(null, "2026-10-09")).toBeNull();
    expect(ageOn("2030-01-01", "2026-10-09")).toBeNull();
  });
});

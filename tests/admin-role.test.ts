import { describe, expect, it } from "vitest";

import { USER_ROLES, type UserRole } from "@/lib/db/schema";
import { createFoodSchema, updateFoodSchema } from "@/lib/validations/foods";

describe("user roles", () => {
  it("has exactly the two roles the app reasons about", () => {
    expect(USER_ROLES).toEqual(["member", "admin"]);
  });

  it("defaults to the narrower one", () => {
    // The column default is "member"; anything else would make every new
    // sign-up a curator of the shared catalogue.
    const first: UserRole = USER_ROLES[0];
    expect(first).toBe("member");
  });
});

describe("role cannot be set through a request body", () => {
  // The whole point of a verified badge is that a member cannot award it to
  // themselves. These schemas are the only way a client reaches the foods
  // table, so neither may carry a role or a verified flag.
  const payload = {
    name: "Smuggled",
    servingSizeValue: 1,
    servingSizeUnit: "serving",
    calories: 100,
    proteinG: 1,
    carbsG: 1,
    fatG: 1,
    role: "admin",
    isVerified: true,
  };

  it("strips them from a create", () => {
    const parsed = createFoodSchema.parse(payload);
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("isVerified");
  });

  it("strips them from an update", () => {
    const parsed = updateFoodSchema.parse({ name: "Renamed", role: "admin", isVerified: true });
    expect(parsed).not.toHaveProperty("role");
    expect(parsed).not.toHaveProperty("isVerified");
  });
});

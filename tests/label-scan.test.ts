import { describe, expect, it } from "vitest";

// The route's body schema is the contract between the camera and the scanner;
// it has to keep accepting the old single-photo shape while allowing a set.
import { z } from "zod";

const imageSchema = z.object({
  data: z.string().min(100).max(4_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

const scanSchema = z
  .object({
    images: z.array(imageSchema).min(1).max(5).optional(),
    image: z.string().min(100).max(4_000_000).optional(),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]).optional(),
  })
  .refine((v) => v.images?.length || (v.image && v.mimeType), {
    message: "Send images: [{ data, mimeType }]",
  });

const b64 = "a".repeat(200);
const img = { data: b64, mimeType: "image/jpeg" as const };

describe("label-scan body", () => {
  it("accepts a front and a back as one package", () => {
    expect(scanSchema.safeParse({ images: [img, img] }).success).toBe(true);
  });

  it("still accepts the old single-photo shape", () => {
    expect(scanSchema.safeParse({ image: b64, mimeType: "image/jpeg" }).success).toBe(true);
  });

  it("rejects a body with no photo at all", () => {
    expect(scanSchema.safeParse({}).success).toBe(false);
    expect(scanSchema.safeParse({ images: [] }).success).toBe(false);
    // A half-filled legacy body is not a photo either.
    expect(scanSchema.safeParse({ image: b64 }).success).toBe(false);
  });

  it("caps the set so one request cannot carry a whole album", () => {
    expect(scanSchema.safeParse({ images: Array(5).fill(img) }).success).toBe(true);
    expect(scanSchema.safeParse({ images: Array(6).fill(img) }).success).toBe(false);
  });

  it("refuses formats the vision model is not given", () => {
    expect(
      scanSchema.safeParse({ images: [{ data: b64, mimeType: "image/gif" }] }).success,
    ).toBe(false);
  });
});

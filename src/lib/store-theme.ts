import type { CSSProperties } from "react";

import type { StoreThemeDTO } from "@/types/api";

/** WCAG-ish relative luminance from hex, for picking readable text. */
export function readableTextOn(hex: string): "#ffffff" | "#141F1B" {
  const value = hex.replace("#", "");
  if (value.length !== 6) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(value.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.35 ? "#141F1B" : "#ffffff";
}

/**
 * CSS variables for the store-branded scope. Only accent-bearing tokens shift
 * (primary/CTA/ring plus the store header vars) — layout and typography do not.
 */
export function storeThemeStyle(theme: StoreThemeDTO | null): CSSProperties {
  if (!theme) return {};
  const onPrimary = theme.textOverrideHex ?? readableTextOn(theme.primaryHex);
  return {
    "--primary": theme.primaryHex,
    "--primary-foreground": onPrimary,
    "--ring": theme.primaryHex,
    "--cta": theme.accentHex,
    "--cta-foreground": readableTextOn(theme.accentHex),
    "--store-primary": theme.primaryHex,
    "--store-on-primary": onPrimary,
    "--store-accent": theme.accentHex,
    "--store-tint": theme.surfaceTintHex,
  } as CSSProperties;
}

/** Sensible default diary meal for "log it now" flows, by local time. */
export function defaultMealForNow(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Breakfast";
  if (hour < 16) return "Lunch";
  if (hour < 21) return "Dinner";
  return "Snacks";
}

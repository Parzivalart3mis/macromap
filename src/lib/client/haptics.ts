/**
 * Tiny haptic-feedback helper. Uses the Vibration API, which is supported in
 * Android browsers / installed PWAs and is a graceful no-op everywhere else
 * (notably iOS Safari, where `navigator.vibrate` is undefined). Never throws.
 */

type HapticKind = "light" | "success" | "warning" | "heavy";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  success: [12, 40, 18],
  warning: [22, 55, 22],
  heavy: 28,
};

export function haptic(kind: HapticKind = "light"): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // Some engines throw when called without a user-activation gesture — ignore.
  }
}

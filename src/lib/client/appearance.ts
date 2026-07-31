/**
 * Theme + text-size preferences. Kept in localStorage and applied to
 * <html> (the `.dark` class drives the token overrides in globals.css; the
 * root font-size scales the rem-based UI). The blocking script in the root
 * layout mirrors this logic so there is no flash before hydration.
 *
 * Unset defaults to "light" / "default" so first render is identical to how
 * the app has always looked — dark / system is strictly opt-in.
 */

export type ThemePref = "system" | "light" | "dark";
export type TextSize = "default" | "large" | "larger";

export const THEME_KEY = "mm-theme";
export const TEXT_SIZE_KEY = "mm-text-size";

const FONT_PX: Record<TextSize, string> = {
  default: "",
  large: "18px",
  larger: "20px",
};

export function getThemePref(): ThemePref {
  if (typeof localStorage === "undefined") return "light";
  const value = localStorage.getItem(THEME_KEY);
  return value === "dark" || value === "system" ? value : "light";
}

export function getTextSize(): TextSize {
  if (typeof localStorage === "undefined") return "default";
  const value = localStorage.getItem(TEXT_SIZE_KEY);
  return value === "large" || value === "larger" ? value : "default";
}

export function prefersDark(pref: ThemePref): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return (
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.classList.toggle("dark", prefersDark(pref));
}

export function applyTextSize(size: TextSize): void {
  document.documentElement.style.fontSize = FONT_PX[size];
}

// --- Reactive store (for useSyncExternalStore) --------------------------------

const listeners = new Set<() => void>();

/**
 * Subscribe to appearance changes: our own setters, other tabs (storage
 * event), and OS theme changes while "System" is selected.
 */
export function subscribeAppearance(callback: () => void): () => void {
  const mq = matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getThemePref() === "system") applyTheme("system");
    callback();
  };
  listeners.add(callback);
  window.addEventListener("storage", callback);
  mq.addEventListener("change", onSystem);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
    mq.removeEventListener("change", onSystem);
  };
}

export function setThemePref(value: ThemePref): void {
  localStorage.setItem(THEME_KEY, value);
  applyTheme(value);
  listeners.forEach((l) => l());
}

export function setTextSize(value: TextSize): void {
  localStorage.setItem(TEXT_SIZE_KEY, value);
  applyTextSize(value);
  listeners.forEach((l) => l());
}

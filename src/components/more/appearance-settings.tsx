"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useSyncExternalStore } from "react";

import { Card } from "@/components/ui/card";
import {
  getTextSize,
  getThemePref,
  setTextSize,
  setThemePref,
  subscribeAppearance,
  type TextSize,
  type ThemePref,
} from "@/lib/client/appearance";
import { haptic } from "@/lib/client/haptics";
import { cn } from "@/lib/utils";

const THEMES: Array<{ value: ThemePref; label: string; icon: LucideIcon }> = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

const SIZES: Array<{ value: TextSize; label: string; text: string }> = [
  { value: "default", label: "Default", text: "text-sm" },
  { value: "large", label: "Large", text: "text-base" },
  { value: "larger", label: "Larger", text: "text-lg" },
];

const cellBase =
  "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 font-medium transition-colors";
const cellActive = "border-primary bg-primary/10 text-primary";
const cellIdle = "border-border text-muted-foreground hover:bg-muted/50";

// Server (and pre-hydration) snapshots — light/default, matching the app's
// historical default appearance.
const themeServerSnapshot = (): ThemePref => "light";
const sizeServerSnapshot = (): TextSize => "default";

export function AppearanceSettings() {
  const theme = useSyncExternalStore(
    subscribeAppearance,
    getThemePref,
    themeServerSnapshot,
  );
  const size = useSyncExternalStore(subscribeAppearance, getTextSize, sizeServerSnapshot);

  return (
    <Card className="space-y-4 p-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Theme</p>
        <div className="grid grid-cols-3 gap-2">
          {THEMES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setThemePref(option.value);
                haptic("light");
              }}
              aria-pressed={theme === option.value}
              className={cn(
                cellBase,
                "text-xs",
                theme === option.value ? cellActive : cellIdle,
              )}
            >
              <option.icon className="size-4" aria-hidden />
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Text size</p>
        <div className="grid grid-cols-3 gap-2">
          {SIZES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setTextSize(option.value);
                haptic("light");
              }}
              aria-pressed={size === option.value}
              className={cn(
                cellBase,
                option.text,
                size === option.value ? cellActive : cellIdle,
              )}
            >
              Aa
              <span className="text-[11px] font-normal">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}

import { cn } from "@/lib/utils";

/**
 * Labeled macro meter — identity comes from the visible label, color is
 * reinforcement only (validated chart trio). The "hero" tone renders on the
 * gradient summary card with white ink.
 */
export function MacroMeter({
  label,
  value,
  target,
  unit = "g",
  colorVar,
  tone = "default",
}: {
  label: string;
  value: number;
  target: number | null;
  unit?: string;
  colorVar: "--chart-1" | "--chart-2" | "--chart-3";
  tone?: "default" | "hero";
}) {
  const pct = target && target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target != null && target > 0 && value > target;
  const hero = tone === "hero";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className={cn("font-medium", hero && "text-white/90")}>{label}</span>
        <span
          className={cn(
            "tabular-nums",
            hero ? "text-white/75" : "text-muted-foreground",
            over && (hero ? "font-semibold text-white" : "text-warning"),
          )}
        >
          {Math.round(value)}
          {target ? ` / ${Math.round(target)}` : ""} {unit}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={target ? Math.round(target) : undefined}
        className={cn(
          "h-2 overflow-hidden rounded-full",
          hero ? "bg-white/20" : "bg-muted",
        )}
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 [transition-timing-function:var(--ease-out-expo)]"
          style={{
            width: `${target ? pct : value > 0 ? 100 : 0}%`,
            backgroundColor: hero
              ? over
                ? "var(--cta)"
                : "rgb(255 255 255 / 0.92)"
              : over
                ? "var(--warning)"
                : `var(${colorVar})`,
          }}
        />
      </div>
    </div>
  );
}

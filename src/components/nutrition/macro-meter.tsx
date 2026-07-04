import { cn } from "@/lib/utils";

/**
 * Labeled macro meter — identity comes from the visible label, color is
 * reinforcement only (validated chart trio).
 */
export function MacroMeter({
  label,
  value,
  target,
  unit = "g",
  colorVar,
}: {
  label: string;
  value: number;
  target: number | null;
  unit?: string;
  colorVar: "--chart-1" | "--chart-2" | "--chart-3";
}) {
  const pct = target && target > 0 ? Math.min(100, (value / target) * 100) : 0;
  const over = target != null && target > 0 && value > target;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className={cn("tabular-nums text-muted-foreground", over && "text-warning")}>
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
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${target ? pct : value > 0 ? 100 : 0}%`,
            backgroundColor: over ? "var(--warning)" : `var(${colorVar})`,
          }}
        />
      </div>
    </div>
  );
}

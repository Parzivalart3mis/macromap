"use client";

/**
 * Calorie donut: segments show each macro's share of calories (carbs and
 * protein 4 kcal/g, fat 9 kcal/g). Colors are reinforcement only — the
 * labeled numbers beside it carry identity.
 */
export function MacroRing({
  calories,
  carbsG,
  fatG,
  proteinG,
  className = "size-32",
}: {
  calories: number;
  carbsG: number;
  fatG: number;
  proteinG: number;
  className?: string;
}) {
  const carbsCal = carbsG * 4;
  const fatCal = fatG * 9;
  const proteinCal = proteinG * 4;
  const macroCal = carbsCal + fatCal + proteinCal;
  const r = 42;
  const circumference = 2 * Math.PI * r;
  const segments =
    macroCal > 0
      ? [
          { color: "var(--chart-2)", fraction: carbsCal / macroCal },
          { color: "var(--chart-3)", fraction: fatCal / macroCal },
          { color: "var(--chart-1)", fraction: proteinCal / macroCal },
        ]
      : [];

  let offset = 0;
  return (
    <div
      className={`relative shrink-0 ${className}`}
      role="img"
      aria-label={`${Math.round(calories)} calories`}
    >
      <svg viewBox="0 0 100 100" className="-rotate-90">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--muted)" strokeWidth="9" />
        {segments.map((segment, index) => {
          // Small gap between segments keeps them CVD-distinct.
          const gap = segments.length > 1 ? 2.5 : 0;
          const length = Math.max(0, segment.fraction * circumference - gap);
          const dashOffset = -offset;
          offset += segment.fraction * circumference;
          return (
            <circle
              key={index}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={segment.color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={dashOffset}
              className="transition-[stroke-dasharray,stroke-dashoffset] duration-700 [transition-timing-function:var(--ease-out-expo)]"
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tracking-tight tabular-nums">
          {Math.round(calories)}
        </span>
        <span className="text-xs text-muted-foreground">cal</span>
      </div>
    </div>
  );
}

export function macroPctOfCalories(
  partCal: number,
  carbsG: number,
  fatG: number,
  proteinG: number,
): number {
  const total = carbsG * 4 + fatG * 9 + proteinG * 4;
  return total > 0 ? Math.round((partCal / total) * 100) : 0;
}

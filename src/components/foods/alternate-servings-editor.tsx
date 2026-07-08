"use client";

import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AlternateServing } from "@/types/nutrition";

/** Editable (string) form of an alternate serving, before it is parsed. */
export interface ServingDraft {
  unit: string;
  multiplier: string;
}

export function draftsFromServings(servings: AlternateServing[]): ServingDraft[] {
  return servings.map((s) => ({ unit: s.unit, multiplier: String(s.multiplier) }));
}

/** Keep only complete, valid rows and parse them into stored servings. */
export function servingsFromDrafts(drafts: ServingDraft[]): AlternateServing[] {
  return drafts
    .map((d) => ({ unit: d.unit.trim(), multiplier: Number(d.multiplier) }))
    .filter((d) => d.unit.length > 0 && Number.isFinite(d.multiplier) && d.multiplier > 0);
}

/**
 * Lets a food define extra serving sizes, each expressed as a multiple of the
 * food's base serving (so nutrition scales automatically). Example: base
 * "1 packet"; add "scoop = 0.5" to log by the scoop.
 */
export function AlternateServingsEditor({
  drafts,
  onChange,
  baseValue,
  baseUnit,
}: {
  drafts: ServingDraft[];
  onChange: (next: ServingDraft[]) => void;
  baseValue: number;
  baseUnit: string;
}) {
  const baseLabel = `${baseValue || 1} ${baseUnit || "serving"}`;

  function update(index: number, patch: Partial<ServingDraft>) {
    onChange(drafts.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-2">
      <div>
        <Label>Other serving sizes (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Add units this food can be logged in — each as a multiple of one {baseLabel}.
        </p>
      </div>

      {drafts.map((row, index) => (
        <div key={index} className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`alt-unit-${index}`} className="text-xs">
              Unit
            </Label>
            <Input
              id={`alt-unit-${index}`}
              value={row.unit}
              maxLength={20}
              placeholder="cup"
              onChange={(event) => update(index, { unit: event.target.value })}
            />
          </div>
          <span className="pb-2.5 text-sm text-muted-foreground">=</span>
          <div className="w-24 space-y-1">
            <Label htmlFor={`alt-mult-${index}`} className="text-xs">
              × {baseUnit || "serving"}
            </Label>
            <Input
              id={`alt-mult-${index}`}
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              value={row.multiplier}
              placeholder="1"
              onChange={(event) => update(index, { multiplier: event.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove serving size"
            className="text-muted-foreground"
            onClick={() => onChange(drafts.filter((_, i) => i !== index))}
          >
            <X aria-hidden />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...drafts, { unit: "", multiplier: "1" }])}
      >
        <Plus data-icon="inline-start" aria-hidden />
        Add serving size
      </Button>
    </div>
  );
}

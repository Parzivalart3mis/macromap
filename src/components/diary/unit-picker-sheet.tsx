"use client";

import { Check, ChevronDown } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { UnitOption } from "@/lib/units";

/**
 * The serving-unit list for a food, as a bottom sheet. Shared by the log screen
 * and the Edit Entry dialog so both offer exactly the same units — the two
 * screens drifting apart is how "I can change it here but not there" happens.
 */
export function UnitPickerSheet({
  open,
  onOpenChange,
  options,
  selected,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: UnitOption[];
  /** Label of the active option, or null when none matches (edited food). */
  selected: string | null;
  onSelect: (option: UnitOption) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="sheet-safe-bottom max-h-[70dvh] overflow-y-auto rounded-t-2xl"
      >
        <SheetHeader>
          <SheetTitle>Select Unit</SheetTitle>
        </SheetHeader>
        <ul className="space-y-1 px-4 pb-6">
          {options.map((opt) => {
            const active = opt.label === selected;
            return (
              <li key={opt.label}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(opt);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 text-left font-medium",
                    active ? "border-primary bg-primary/5" : "bg-card",
                  )}
                >
                  {opt.label}
                  {active ? <Check className="size-5 text-primary" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

/**
 * The "Serving Size" row that opens the picker. Renders as plain, non-tappable
 * text when there is nothing to choose from (custom store builds, quick adds,
 * or while the food is still loading) so it never reads as a dead control.
 */
export function ServingSizeRow({
  value,
  interactive,
  onOpen,
}: {
  value: string;
  interactive: boolean;
  onOpen: () => void;
}) {
  if (!interactive) {
    return (
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="font-medium">Serving Size</span>
        <span className="py-1.5 font-semibold text-muted-foreground">{value}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      onClick={onOpen}
    >
      <span className="font-medium">Serving Size</span>
      <span className="flex items-center gap-1 rounded-lg border px-3 py-1.5 font-semibold text-primary">
        {value}
        <ChevronDown className="size-3.5" aria-hidden />
      </span>
    </button>
  );
}

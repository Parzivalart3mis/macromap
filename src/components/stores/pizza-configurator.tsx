"use client";

import { Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import { defaultMealForNow } from "@/lib/store-theme";
import { cn } from "@/lib/utils";
import type { CustomStoreOrderDTO, PizzaConfigDTO } from "@/types/api";

const CHEESE_LEVELS = ["None", "Light", "Regular", "Extra"] as const;
type CheeseLevel = (typeof CHEESE_LEVELS)[number];

/** Subset of nutrients shown in the live preview. */
interface Macros {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number;
  satFatG: number;
}
const ZERO: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, sodiumMg: 0, satFatG: 0 };
function addMac(
  a: Macros,
  n: { calories: number; proteinG: number; carbsG: number; fatG: number; sodiumMg?: number; satFatG?: number },
  mult = 1,
): Macros {
  return {
    calories: a.calories + n.calories * mult,
    proteinG: a.proteinG + n.proteinG * mult,
    carbsG: a.carbsG + n.carbsG * mult,
    fatG: a.fatG + n.fatG * mult,
    sodiumMg: a.sodiumMg + (n.sodiumMg ?? 0) * mult,
    satFatG: a.satFatG + (n.satFatG ?? 0) * mult,
  };
}
const scaleMac = (m: Macros, f: number): Macros => ({
  calories: m.calories * f,
  proteinG: m.proteinG * f,
  carbsG: m.carbsG * f,
  fatG: m.fatG * f,
  sodiumMg: m.sodiumMg * f,
  satFatG: m.satFatG * f,
});

function currentTimeIfToday(date: string): string | undefined {
  if (date !== todayISO()) return undefined;
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-transparent bg-[var(--store-primary,var(--primary))] text-[var(--store-on-primary,var(--primary-foreground))]"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function macroLine(m: Macros): string {
  return `${Math.round(m.calories)} cal · ${Math.round(m.proteinG)}P / ${Math.round(m.carbsG)}C / ${Math.round(m.fatG)}F`;
}

/** Domino's-style build-your-own pizza: size/crust → sauce → cheese → toppings, logged by the slice. */
export function PizzaConfigurator({
  slug,
  mealName = defaultMealForNow(),
  date = todayISO(),
  configs,
  onLogged,
}: {
  slug: string;
  mealName?: string;
  date?: string;
  configs: PizzaConfigDTO[];
  onLogged: () => void;
}) {
  // Only offer configs whose component data is loaded.
  const available = useMemo(() => configs.filter((c) => c.components.length > 0), [configs]);
  const sizes = useMemo(() => [...new Set(available.map((c) => c.size))], [available]);

  const [configId, setConfigId] = useState(() => {
    const med = available.find((c) => c.crust === "Hand Tossed" && c.size.startsWith("Medium"));
    return (med ?? available[0])?.id ?? "";
  });
  const config = available.find((c) => c.id === configId) ?? available[0];

  const [sauce, setSauce] = useState<string | null>("Pizza Sauce");
  const [cheese, setCheese] = useState<CheeseLevel>("Regular");
  const [garlicOil, setGarlicOil] = useState(false);
  const [toppings, setToppings] = useState<Map<string, 1 | 2>>(new Map());
  const [slices, setSlices] = useState(1);
  const [busy, setBusy] = useState(false);

  const size = config?.size ?? "";
  const crustsForSize = available.filter((c) => c.size === size);
  const sauces = config?.components.filter((c) => c.group === "sauce") ?? [];
  const toppingList = config?.components.filter((c) => c.group === "topping") ?? [];
  const hasGarlicOil = config?.components.some(
    (c) => c.group === "extra" && c.name === "Garlic Oil Blend",
  );
  const slicesPerPizza = config?.slicesPerPizza ?? 1;

  const perSlice = useMemo(() => {
    if (!config) return ZERO;
    let m = addMac(ZERO, config.crustNutrition);
    if (garlicOil) {
      const g = config.components.find((c) => c.group === "extra" && c.name === "Garlic Oil Blend");
      if (g) m = addMac(m, g.nutrition);
    }
    if (sauce) {
      const s = config.components.find((c) => c.group === "sauce" && c.name === sauce);
      if (s) m = addMac(m, s.nutrition);
    }
    if (cheese !== "None") {
      const variant = toppings.size > 0 ? "with_toppings" : "only";
      const ch = config.components.find(
        (c) => c.group === "cheese" && c.name === `${cheese} Cheese` && c.variant === variant,
      );
      if (ch) m = addMac(m, ch.nutrition);
    }
    for (const [name, qty] of toppings) {
      const tc = config.components.find((c) => c.group === "topping" && c.name === name);
      if (tc) m = addMac(m, tc.nutrition, qty);
    }
    return m;
  }, [config, garlicOil, sauce, cheese, toppings]);

  const whole = scaleMac(perSlice, slicesPerPizza);
  const logged = scaleMac(perSlice, slices);

  function pickSize(nextSize: string) {
    const first =
      available.find((c) => c.size === nextSize && c.crust === "Hand Tossed") ??
      available.find((c) => c.size === nextSize);
    if (first) setConfigId(first.id);
  }

  function cycleTopping(name: string) {
    setToppings((prev) => {
      const next = new Map(prev);
      const cur = next.get(name);
      if (cur === undefined) next.set(name, 1);
      else if (cur === 1) next.set(name, 2);
      else next.delete(name);
      return next;
    });
  }

  function buildName(): string {
    const parts = [...toppings.keys()];
    const desc = parts.length ? parts.join(", ") : cheese === "None" ? "Plain" : "Cheese";
    return `${config?.label ?? "Pizza"} — ${desc}`.slice(0, 100);
  }

  async function log() {
    if (!config) return;
    setBusy(true);
    try {
      const { order, slicesPerPizza: spp } = await apiFetch<{
        order: CustomStoreOrderDTO;
        slicesPerPizza: number;
      }>(`/api/stores/${slug}/pizza-orders`, {
        method: "POST",
        body: JSON.stringify({
          configId: config.id,
          sauce,
          cheeseLevel: cheese,
          toppings: [...toppings].map(([name, qty]) => ({ name, qty })),
          garlicOil,
          slices,
          name: buildName(),
        }),
      });
      const whole = slices >= spp;
      const label = whole ? "whole pizza" : `${slices} slice${slices > 1 ? "s" : ""}`;
      await apiFetch("/api/diary/entries", {
        method: "POST",
        body: JSON.stringify({
          date,
          mealName,
          customStoreOrderId: order.id,
          quantity: slices,
          servingMultiplier: 1 / spp,
          servingText: label,
          loggedVia: "store_builder",
          eatenTime: currentTimeIfToday(date),
        }),
      });
      toast.success(`Logged ${label} to ${mealName}`);
      onLogged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not log pizza");
    } finally {
      setBusy(false);
    }
  }

  if (!config) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No pizza builder available for this store yet.
      </p>
    );
  }

  return (
    <div className="space-y-5 pb-40">
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Size</h3>
        <div className="flex flex-wrap gap-2">
          {sizes.map((s) => (
            <Chip key={s} active={s === size} onClick={() => pickSize(s)}>
              {s}
            </Chip>
          ))}
        </div>
      </section>

      {crustsForSize.length > 1 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Crust</h3>
          <div className="flex flex-wrap gap-2">
            {crustsForSize.map((c) => (
              <Chip key={c.id} active={c.id === config.id} onClick={() => setConfigId(c.id)}>
                {c.crust}
              </Chip>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Sauce</h3>
        <div className="flex flex-wrap gap-2">
          <Chip active={sauce === null} onClick={() => setSauce(null)}>
            No sauce
          </Chip>
          {sauces.map((s) => (
            <Chip key={s.id} active={sauce === s.name} onClick={() => setSauce(s.name)}>
              {s.name.replace(" (White Sauce)", "")}
            </Chip>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Cheese</h3>
        <div className="flex flex-wrap gap-2">
          {CHEESE_LEVELS.map((lvl) => (
            <Chip key={lvl} active={cheese === lvl} onClick={() => setCheese(lvl)}>
              {lvl}
            </Chip>
          ))}
        </div>
      </section>

      {hasGarlicOil && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Crust brush</h3>
          <Chip active={garlicOil} onClick={() => setGarlicOil((v) => !v)}>
            Garlic oil {garlicOil ? "✓" : ""}
          </Chip>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">
          Toppings <span className="font-normal text-muted-foreground">— tap to add, again for ×2</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {toppingList.map((t) => {
            const qty = toppings.get(t.name);
            return (
              <Chip key={t.id} active={qty !== undefined} onClick={() => cycleTopping(t.name)}>
                {t.name}
                {t.selectMarket ? "*" : ""}
                {qty === 2 ? " ×2" : ""}
              </Chip>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground">* available in select markets</p>
      </section>

      {/* Sticky totals + log */}
      <div className="fixed inset-x-0 bottom-16 z-10 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-lg space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Per slice</span>
            <span className="tabular-nums">{macroLine(perSlice)}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Whole pizza ({slicesPerPizza} slices)</span>
            <span className="tabular-nums">
              {macroLine(whole)} · {Math.round(whole.sodiumMg)}mg Na
            </span>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Button
                size="icon"
                variant="outline"
                onClick={() => setSlices((s) => Math.max(1, s - 1))}
                disabled={slices <= 1}
                aria-label="Fewer slices"
              >
                <Minus aria-hidden />
              </Button>
              <span className="w-16 text-center text-sm tabular-nums">
                {slices >= slicesPerPizza ? "Whole" : `${slices} slice${slices > 1 ? "s" : ""}`}
              </span>
              <Button
                size="icon"
                variant="outline"
                onClick={() => setSlices((s) => Math.min(slicesPerPizza, s + 1))}
                disabled={slices >= slicesPerPizza}
                aria-label="More slices"
              >
                <Plus aria-hidden />
              </Button>
            </div>
            <Button className="flex-1" onClick={log} disabled={busy}>
              {busy ? "Logging…" : `Log · ${Math.round(logged.calories)} cal`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

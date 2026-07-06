"use client";

import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ErrorState, ListSkeleton } from "@/components/async-states";
import { LogFoodDialog } from "@/components/diary/log-food-dialog";
import { VerifiedBadge } from "@/components/foods/verified-badge";
import { CustomBuilder } from "@/components/stores/custom-builder";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import { defaultMealForNow, storeThemeStyle } from "@/lib/store-theme";
import { cn } from "@/lib/utils";
import type {
  CustomStoreOrderDTO,
  FoodDTO,
  StoreIngredientDTO,
  StoreMenuItemDTO,
  StoreThemeDTO,
} from "@/types/api";

interface StoreInfo {
  store: { id: string; name: string; slug: string };
  theme: StoreThemeDTO | null;
  categories: string[];
}

export default function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [info, setInfo] = useState<StoreInfo | null>(null);
  const [menu, setMenu] = useState<StoreMenuItemDTO[] | null>(null);
  const [ingredients, setIngredients] = useState<StoreIngredientDTO[] | null>(null);
  const [orders, setOrders] = useState<CustomStoreOrderDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<FoodDTO | null>(null);
  const [logging, setLogging] = useState(false);
  const [orderBusy, setOrderBusy] = useState<string | null>(null);
  const [tab, setTab] = useState("menu");
  const [editingOrder, setEditingOrder] = useState<CustomStoreOrderDTO | null>(null);

  const load = useCallback(async () => {
    try {
      const [infoData, menuData, ingredientsData, ordersData] = await Promise.all([
        apiFetch<StoreInfo>(`/api/stores/${slug}`),
        apiFetch<{ menu: StoreMenuItemDTO[] }>(`/api/stores/${slug}/menu`),
        apiFetch<{ ingredients: StoreIngredientDTO[] }>(`/api/stores/${slug}/ingredients`),
        apiFetch<{ orders: CustomStoreOrderDTO[] }>(`/api/stores/${slug}/custom-orders`),
      ]);
      setInfo(infoData);
      setMenu(menuData.menu);
      setIngredients(ingredientsData.ingredients);
      setOrders(ordersData.orders);
      setCategory(infoData.categories[0] ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this store");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const menuByCategory = useMemo(() => {
    if (!menu) return [];
    return menu.filter((item) => item.menuCategory === category);
  }, [menu, category]);

  async function logMenuItem(quantity: number) {
    if (!selectedFood) return;
    setLogging(true);
    const mealName = defaultMealForNow();
    try {
      await apiFetch("/api/diary/entries", {
        method: "POST",
        body: JSON.stringify({
          date: todayISO(),
          mealName,
          foodId: selectedFood.id,
          quantity,
          servingMultiplier: 1,
          loggedVia: "store_builder",
        }),
      });
      toast.success(`Logged to ${mealName}`);
      setSelectedFood(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logging failed");
    } finally {
      setLogging(false);
    }
  }

  async function logOrder(order: CustomStoreOrderDTO) {
    setOrderBusy(order.id);
    const mealName = defaultMealForNow();
    try {
      await apiFetch("/api/diary/entries", {
        method: "POST",
        body: JSON.stringify({
          date: todayISO(),
          mealName,
          customStoreOrderId: order.id,
          quantity: 1,
          servingMultiplier: 1,
          loggedVia: "store_builder",
        }),
      });
      toast.success(`Logged ${order.name} to ${mealName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logging failed");
    } finally {
      setOrderBusy(null);
    }
  }

  async function reloadOrders() {
    try {
      const data = await apiFetch<{ orders: CustomStoreOrderDTO[] }>(
        `/api/stores/${slug}/custom-orders`,
      );
      setOrders(data.orders);
    } catch {
      // Non-fatal: the list just keeps its previous state.
    }
  }

  function startEdit(order: CustomStoreOrderDTO) {
    setEditingOrder(order);
    setTab("builder");
  }

  async function deleteOrder(order: CustomStoreOrderDTO) {
    if (!window.confirm(`Delete "${order.name}"?`)) return;
    setOrderBusy(order.id);
    try {
      await apiFetch(`/api/stores/${slug}/custom-orders/${order.id}`, {
        method: "DELETE",
      });
      setOrders((prev) => (prev ?? []).filter((o) => o.id !== order.id));
      toast.success(`Deleted ${order.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setOrderBusy(null);
    }
  }

  if (error) {
    return (
      <main>
        <ErrorState message={error} onRetry={load} />
      </main>
    );
  }

  if (!info || !menu || !ingredients || !orders) {
    return (
      <main>
        <ListSkeleton rows={6} />
      </main>
    );
  }

  return (
    <main style={storeThemeStyle(info.theme)} data-store-theme>
      {/* Store-branded header — accent shifts, layout identical across stores. */}
      <header className="store-header app-chrome sticky top-0 z-30 bg-[var(--store-primary)] px-4 pb-3 text-[var(--store-on-primary)]">
        <div className="flex items-center gap-2 pt-1">
          <Link
            href="/food"
            aria-label="Back to food"
            className="flex size-11 items-center justify-center rounded-md hover:bg-white/10"
          >
            <ArrowLeft className="size-5" aria-hidden />
          </Link>
          <h1 className="text-xl font-bold tracking-tight">{info.store.name}</h1>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next);
          // Leaving the builder abandons an in-progress edit.
          if (next !== "builder") setEditingOrder(null);
        }}
        className="p-4"
      >
        <TabsList className="w-full">
          <TabsTrigger value="menu">Menu</TabsTrigger>
          <TabsTrigger value="builder">Builder</TabsTrigger>
          <TabsTrigger value="saved">Saved ({orders.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-3 pt-3">
          {info.categories.length > 1 ? (
            <div className="store-tabs -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
              {info.categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "store-chip min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium",
                    category === cat
                      ? "border-transparent bg-[var(--store-primary)] text-[var(--store-on-primary)]"
                      : "bg-card",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          ) : null}

          {menuByCategory.length === 0 ? (
            <EmptyState title="No items in this category" />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {menuByCategory.map((item) => (
                <li key={item.id} className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                    onClick={() => setSelectedFood(item.food)}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-medium">
                          {item.food.name}
                        </span>
                        {item.isDefaultVerified ? <VerifiedBadge /> : null}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.food.brandName ? `${item.food.brandName}, ` : ""}
                        {item.food.servingSizeValue} {item.food.servingSizeUnit}
                      </span>
                      {item.food.description ? (
                        <span className="block truncate text-xs text-muted-foreground/80 italic">
                          {item.food.description}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {Math.round(item.food.calories)} kcal
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${item.food.name}`}
                    className="shrink-0 text-muted-foreground"
                    asChild
                  >
                    <Link href={`/foods/${item.food.id}`}>
                      <Pencil className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="builder" className="pt-3">
          {ingredients.length === 0 ? (
            <EmptyState
              title="No ingredient catalog yet"
              body="This store does not have a build-your-own ingredient list."
            />
          ) : (
            <CustomBuilder
              key={editingOrder?.id ?? "new"}
              slug={slug}
              ingredients={ingredients}
              editOrder={editingOrder}
              onSaved={() => {
                reloadOrders();
                setEditingOrder(null);
                setTab("saved");
              }}
              onCancelEdit={() => {
                setEditingOrder(null);
                setTab("saved");
              }}
            />
          )}
        </TabsContent>

        <TabsContent value="saved" className="pt-3">
          {orders.length === 0 ? (
            <EmptyState
              title="No saved builds"
              body="Create one in the builder tab and it will show up here."
            />
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{order.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(order.nutritionSnapshotJson.calories)} kcal ·{" "}
                      {Math.round(order.nutritionSnapshotJson.proteinG)}p
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${order.name}`}
                    disabled={orderBusy === order.id}
                    onClick={() => startEdit(order)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${order.name}`}
                    className="text-destructive"
                    disabled={orderBusy === order.id}
                    onClick={() => deleteOrder(order)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                  <Button
                    size="sm"
                    disabled={orderBusy === order.id}
                    onClick={() => logOrder(order)}
                  >
                    {orderBusy === order.id ? "..." : "Log"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <LogFoodDialog
        food={selectedFood}
        open={selectedFood !== null}
        onOpenChange={(next) => {
          if (!next) setSelectedFood(null);
        }}
        onConfirm={logMenuItem}
        busy={logging}
        mealName={defaultMealForNow()}
        date={todayISO()}
      />
    </main>
  );
}

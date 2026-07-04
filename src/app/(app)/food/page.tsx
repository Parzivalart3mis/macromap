"use client";

import { ChevronRight, PlusCircle, Store } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ErrorState, ListSkeleton } from "@/components/async-states";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/client/fetcher";
import type { StoreDTO } from "@/types/api";

export default function FoodPage() {
  const [stores, setStores] = useState<StoreDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ stores: StoreDTO[] }>("/api/stores");
      setStores(data.stores);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load stores");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <main>
      <PageHeader title="Food" />
      <div className="space-y-5 p-4">
        <Card>
          <CardContent className="space-y-2 p-4">
            <h2 className="font-semibold">Shared food database</h2>
            <p className="text-sm text-muted-foreground">
              Add a food once and every MacroMap user can log it. Duplicates are
              checked before anything is created.
            </p>
            <Button className="w-full" asChild>
              <Link href="/foods/new">
                <PlusCircle data-icon="inline-start" aria-hidden />
                Create a food
              </Link>
            </Button>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-2 flex items-center gap-1.5 px-1 text-sm font-semibold">
            <Store className="size-4 text-primary" aria-hidden />
            Chain stores
          </h2>
          {error ? (
            <ErrorState message={error} onRetry={load} />
          ) : !stores ? (
            <ListSkeleton rows={4} />
          ) : (
            <div className="stagger-children grid grid-cols-2 gap-3">
              {stores.map((store) => (
                <Link
                  key={store.id}
                  href={`/stores/${store.slug}`}
                  className="card-lift group relative flex min-h-24 flex-col justify-between overflow-hidden rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]"
                  style={
                    {
                      "--tile-color": store.theme?.primaryHex ?? "var(--primary)",
                    } as React.CSSProperties
                  }
                >
                  {/* Brand ribbon */}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 top-0 h-1.5 opacity-90"
                    style={{
                      background: `linear-gradient(90deg, var(--tile-color), color-mix(in oklab, var(--tile-color), transparent 45%))`,
                    }}
                  />
                  <span
                    className="mt-1 flex size-9 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ backgroundColor: "var(--tile-color)" }}
                    aria-hidden
                  >
                    {store.name.charAt(0)}
                  </span>
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold">{store.name}</span>
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1"
                      aria-hidden
                    />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

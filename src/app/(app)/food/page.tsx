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
            <div className="grid grid-cols-2 gap-3">
              {stores.map((store) => (
                <Link
                  key={store.id}
                  href={`/stores/${store.slug}`}
                  className="group flex min-h-24 flex-col justify-between rounded-xl border bg-card p-4 transition-colors hover:border-[var(--tile-color)]"
                  style={
                    {
                      "--tile-color": store.theme?.primaryHex ?? "var(--primary)",
                    } as React.CSSProperties
                  }
                >
                  <span
                    className="size-3 rounded-full"
                    style={{
                      backgroundColor: store.theme?.primaryHex ?? "var(--primary)",
                    }}
                    aria-hidden
                  />
                  <span className="flex items-center justify-between gap-1">
                    <span className="text-sm font-semibold">{store.name}</span>
                    <ChevronRight
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
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

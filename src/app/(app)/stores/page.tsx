"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { ErrorState, ListSkeleton } from "@/components/async-states";
import { PageHeader } from "@/components/shell/page-header";
import { apiFetch } from "@/lib/client/fetcher";
import type { StoreDTO } from "@/types/api";

export default function StoresPage() {
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
      <PageHeader title="Stores" />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !stores ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="grid grid-cols-2 gap-3 p-4">
          {stores.map((store) => (
            <Link
              key={store.id}
              href={`/stores/${store.slug}`}
              className="group flex min-h-24 flex-col justify-between rounded-xl border bg-card p-4 transition-colors hover:border-[var(--tile-color)]"
              style={{ "--tile-color": store.theme?.primaryHex ?? "var(--primary)" } as React.CSSProperties}
            >
              <span
                className="size-3 rounded-full"
                style={{ backgroundColor: store.theme?.primaryHex ?? "var(--primary)" }}
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
    </main>
  );
}

import { AlertTriangle, Barcode, Copy, Database, Store, UserRound } from "lucide-react";

import { SubHeader } from "@/components/more/sub-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, isAdmin, requireUserId } from "@/lib/api";
import { getAdminOverview, type AdminOverview } from "@/lib/admin/overview";

const SOURCE_LABEL: Record<string, string> = {
  barcode_api: "USDA generics",
  official_store: "Labelled products",
  user_created: "Member-created",
  open_food_facts: "Open Food Facts",
};

function Stat({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-2xl font-extrabold tabular-nums">{value}</p>
      <p className="text-xs font-medium">{label}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Null rather than a throw when the caller may not see this, so the page can
 * branch on it outside a try — React does not render eagerly, so JSX built
 * inside one would escape the catch anyway.
 */
async function overviewForAdmin(): Promise<AdminOverview | null> {
  try {
    const userId = await requireUserId();
    if (!(await isAdmin(userId))) return null;
    return await getAdminOverview();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

export default async function AdminPage() {
  const data = await overviewForAdmin();
  if (!data) return <Forbidden />;

  return (
    <main>
      <SubHeader title="Admin" />
      <div className="stagger-children space-y-4 p-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="size-4 text-primary" aria-hidden />
              Food catalogue
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between gap-3">
              <Stat label="Foods" value={data.foods.total.toLocaleString()} />
              <Stat
                label="Verified"
                value={data.foods.verified.toLocaleString()}
                hint={`${Math.round((data.foods.verified / data.foods.total) * 100)}% of all`}
              />
              <Stat label="Recipes" value={data.foods.recipes.toLocaleString()} />
              </div>
              <ul className="divide-y text-sm">
                {data.foods.bySource.map((row) => (
                  <li key={row.sourceType} className="flex justify-between gap-3 py-2">
                    <span>{SOURCE_LABEL[row.sourceType] ?? row.sourceType}</span>
                    <span className="shrink-0 tabular-nums">
                      {row.count.toLocaleString()}
                      <span className="text-muted-foreground">
                        {" "}· {row.verified.toLocaleString()} verified
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Worth cleaning up</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                <li className="flex items-center gap-3 py-2">
                  <Barcode className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1">Branded foods with no barcode</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {data.gaps.brandedWithoutBarcode.toLocaleString()}
                  </span>
                </li>
                <li className="flex items-center gap-3 py-2">
                  <Copy className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1">Duplicated names</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {data.gaps.duplicateNames.toLocaleString()}
                    <span className="font-normal text-muted-foreground">
                      {" "}· {data.gaps.duplicateExtraRows} extra rows
                    </span>
                  </span>
                </li>
                <li className="flex items-center gap-3 py-2">
                  <Database className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex-1">Never logged by anyone</span>
                  <span className="shrink-0 font-semibold tabular-nums">
                    {data.gaps.neverLogged.toLocaleString()}
                  </span>
                </li>
              </ul>
              <p className="pt-2 text-xs text-muted-foreground">
                A branded item without a barcode cannot be scanned at the shelf.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Store className="size-4 text-primary" aria-hidden />
                Stores
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {data.stores.map((store) => (
                  <li key={store.slug} className="flex justify-between gap-3 py-2">
                    <span className="truncate">{store.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {store.menuItems} menu
                      {store.ingredients > 0 ? ` · ${store.ingredients} builder` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="size-4 text-primary" aria-hidden />
                Accounts
              </CardTitle>
            </CardHeader>
            <CardContent className="flex justify-between gap-3">
              <Stat label="Users" value={data.users.total} />
              <Stat label="Admins" value={data.users.admins} />
              <Stat label="Members" value={data.users.total - data.users.admins} />
            </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Forbidden() {
  return (
    <main>
      <SubHeader title="Admin" />
      <div className="animate-fade-up mx-auto flex max-w-xs flex-col items-center gap-3 px-6 py-14 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground ring-1 ring-foreground/10">
          <AlertTriangle className="size-6" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="font-semibold">Admins only</p>
          <p className="text-sm text-muted-foreground">
            This page curates the shared catalogue, so it is limited to admin accounts.
          </p>
        </div>
      </div>
    </main>
  );
}

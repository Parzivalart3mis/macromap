"use client";

import { SignOutButton, useUser } from "@clerk/nextjs";
import {
  BarChart3,
  ChevronRight,
  FileText,
  LogOut,
  PlusCircle,
  ShieldCheck,
  Store,
  Target,
  Timer,
  UserRound,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppearanceSettings } from "@/components/more/appearance-settings";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { ProgressOverviewDTO, StreakDTO } from "@/types/api";

interface MePayload {
  isAdmin: boolean;
  user: { id: string; email: string | null; displayName: string | null };
  profile: { unitSystem: "metric" | "imperial" };
}

const MENU: Array<{ icon: LucideIcon; label: string; href: string }> = [
  { icon: UserRound, label: "My Profile", href: "/more/profile" },
  { icon: Target, label: "Goals", href: "/more/goals" },
  { icon: Timer, label: "Intermittent Fasting", href: "/fasting" },
  { icon: BarChart3, label: "Weight & Measurements", href: "/progress" },
  { icon: FileText, label: "My Weekly Report", href: "/more/reports" },
  { icon: UtensilsCrossed, label: "My Meals, Recipes & Foods", href: "/more/foods" },
  { icon: Store, label: "Chain Stores", href: "/food" },
  { icon: PlusCircle, label: "Create a Food", href: "/foods/new" },
];

/** Shown only to admins — it curates shared data rather than your own. */
const ADMIN_MENU: Array<{ icon: LucideIcon; label: string; href: string }> = [
  { icon: ShieldCheck, label: "Admin", href: "/more/admin" },
];

export default function MorePage() {
  const { user } = useUser();
  const [me, setMe] = useState<MePayload | null>(null);
  const [streak, setStreak] = useState<StreakDTO | null>(null);
  const [weights, setWeights] = useState<ProgressOverviewDTO["weights"]>([]);

  useEffect(() => {
    apiFetch<MePayload>("/api/me").then(setMe).catch(() => undefined);
    apiFetch<{ streak: StreakDTO }>(`/api/progress/streak?today=${todayISO()}`)
      .then((data) => setStreak(data.streak))
      .catch(() => undefined);
    apiFetch<ProgressOverviewDTO>("/api/progress/overview")
      .then((data) => setWeights(data.weights))
      .catch(() => undefined);
  }, []);

  const name =
    me?.user.displayName ||
    user?.fullName ||
    me?.user.email?.split("@")[0] ||
    "Your account";
  const unit = me?.profile.unitSystem === "metric" ? "kg" : "lbs";
  const weightDelta =
    weights.length >= 2
      ? Math.round((weights[0].weightValue - weights[weights.length - 1].weightValue) * 10) /
        10
      : null;

  return (
    <main>
      <PageHeader title="More" />
      <div className="stagger-children space-y-4 p-4">
        {/* Profile hero: streak | avatar | progress */}
        <section className="py-2 text-center">
          <div className="flex items-center justify-around">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Streak</p>
              <p className="text-3xl font-extrabold tabular-nums">
                {streak?.current ?? "–"}
              </p>
              <p className="text-sm text-muted-foreground">
                day{streak && streak.current === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-[image:var(--gradient-brand)] shadow-[var(--shadow-glow)]">
              {user?.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.imageUrl}
                  alt=""
                  className="size-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="text-4xl font-black text-white">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Progress</p>
              <p className="text-3xl font-extrabold tabular-nums">
                {weightDelta != null ? Math.abs(weightDelta) : "–"}
              </p>
              <p className="text-sm text-muted-foreground">
                {weightDelta != null
                  ? `${unit} ${weightDelta >= 0 ? "lost" : "gained"}`
                  : `${unit} lost`}
              </p>
            </div>
          </div>
          <h2 className="mt-3 text-xl font-extrabold tracking-tight">{name}</h2>
          {me ? (
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                me.isAdmin
                  ? "bg-primary/12 text-primary ring-1 ring-primary/20"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {me.isAdmin ? <ShieldCheck className="size-3" aria-hidden /> : null}
              {me.isAdmin ? "Admin" : "Member"}
            </span>
          ) : null}
        </section>

        {/* Menu rows */}
        <Card className="gap-0 overflow-hidden p-0">
          <ul className="divide-y">
            {[...MENU, ...(me?.isAdmin ? ADMIN_MENU : [])].map((item) => (
              <li key={item.href + item.label}>
                <Link
                  href={item.href}
                  className="flex min-h-14 items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground/70">
                    <item.icon className="size-4.5" aria-hidden />
                  </span>
                  <span className="flex-1 font-medium">{item.label}</span>
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <div>
          <h3 className="mb-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Appearance
          </h3>
          <AppearanceSettings />
        </div>

        <Card className="p-2">
          <SignOutButton redirectUrl="/">
            <Button variant="ghost" className="w-full text-destructive">
              <LogOut data-icon="inline-start" aria-hidden />
              Sign out
            </Button>
          </SignOutButton>
        </Card>

        <p className="pb-2 text-center text-xs text-muted-foreground">
          MacroMap · exercise lives in Iron Log, recipes in The Cookbook
        </p>
      </div>
    </main>
  );
}

"use client";

import { SignOutButton } from "@clerk/nextjs";
import { Download, FileText, LogOut, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/async-states";
import { GoalsManager } from "@/components/more/goals-manager";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/client/fetcher";
import { addDaysISO, todayISO, weekStartISO } from "@/lib/dates";

interface MePayload {
  user: { id: string; email: string | null; displayName: string | null };
  profile: {
    timezone: string;
    unitSystem: "metric" | "imperial";
    heightCm: number | null;
  };
}

interface WeeklySummaryPayload {
  summary: {
    daysLogged: number;
    averages: { calories: number; proteinG: number };
    weightChange: number | null;
  };
}

function ProfileCard() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [heightCm, setHeightCm] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MePayload>("/api/me");
      setMe(data);
      setDisplayName(data.user.displayName ?? "");
      setUnitSystem(data.profile.unitSystem);
      setHeightCm(data.profile.heightCm ? String(data.profile.heightCm) : "");
    } catch {
      toast.error("Could not load your profile");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        unitSystem,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };
      if (displayName.trim()) payload.displayName = displayName.trim();
      if (heightCm && Number(heightCm) > 0) payload.heightCm = Number(heightCm);
      await apiFetch("/api/me/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Profile</CardTitle>
      </CardHeader>
      <CardContent>
        {!me ? (
          <ListSkeleton rows={2} />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{me.user.email}</p>
            <div className="space-y-1">
              <Label htmlFor="display-name">Display name</Label>
              <Input
                id="display-name"
                value={displayName}
                maxLength={80}
                onChange={(event) => setDisplayName(event.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="unit-system">Units</Label>
                <Select
                  value={unitSystem}
                  onValueChange={(value) => setUnitSystem(value as "metric" | "imperial")}
                >
                  <SelectTrigger id="unit-system" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="metric">Metric</SelectItem>
                    <SelectItem value="imperial">Imperial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="height-cm">Height (cm)</Label>
                <Input
                  id="height-cm"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={heightCm}
                  onChange={(event) => setHeightCm(event.target.value)}
                />
              </div>
            </div>
            <Button disabled={busy} onClick={save} className="w-full">
              {busy ? "Saving..." : "Save profile"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsCard() {
  const [summary, setSummary] = useState<WeeklySummaryPayload["summary"] | null>(null);
  const [summaryError, setSummaryError] = useState(false);
  const from30 = addDaysISO(todayISO(), -29);
  const to = todayISO();

  useEffect(() => {
    apiFetch<WeeklySummaryPayload>(`/api/reports/weekly?weekStart=${weekStartISO(todayISO())}`)
      .then((data) => setSummary(data.summary))
      .catch(() => setSummaryError(true));
  }, []);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Reports</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-muted/60 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">This week</p>
          {summaryError ? (
            <p className="text-muted-foreground">Weekly summary unavailable</p>
          ) : !summary ? (
            <p className="text-muted-foreground">Loading summary...</p>
          ) : (
            <p>
              {summary.daysLogged} days logged · avg{" "}
              {Math.round(summary.averages.calories)} kcal ·{" "}
              {Math.round(summary.averages.proteinG)} g protein
              {summary.weightChange != null
                ? ` · weight ${summary.weightChange > 0 ? "+" : ""}${summary.weightChange}`
                : ""}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" asChild>
            <a href={`/api/reports/export.csv?from=${from30}&to=${to}`} download>
              <Download data-icon="inline-start" aria-hidden />
              CSV, 30 days
            </a>
          </Button>
          <Button variant="outline" className="flex-1" asChild>
            <a href={`/api/reports/export.pdf?from=${from30}&to=${to}`} download>
              <FileText data-icon="inline-start" aria-hidden />
              PDF, 30 days
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MorePage() {
  return (
    <main>
      <PageHeader title="More" />
      <div className="space-y-4 p-4">
        <ProfileCard />
        <GoalsManager />
        <ReportsCard />
        <Card>
          <CardContent className="space-y-2 py-4">
            <Button variant="outline" className="w-full" asChild>
              <Link href="/foods/new">
                <PlusCircle data-icon="inline-start" aria-hidden />
                Add a food to the shared database
              </Link>
            </Button>
            <SignOutButton redirectUrl="/">
              <Button variant="ghost" className="w-full text-destructive">
                <LogOut data-icon="inline-start" aria-hidden />
                Sign out
              </Button>
            </SignOutButton>
          </CardContent>
        </Card>
        <p className="pb-2 text-center text-xs text-muted-foreground">
          MacroMap · exercise lives in Iron Log, recipes in The Cookbook
        </p>
      </div>
    </main>
  );
}

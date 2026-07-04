"use client";

import { Check, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { EmptyState, ListSkeleton } from "@/components/async-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import type { GoalProfileDTO } from "@/types/api";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MACRO_COLUMNS = [
  { key: "calories", label: "kcal" },
  { key: "proteinG", label: "Protein" },
  { key: "carbsG", label: "Carbs" },
  { key: "fatG", label: "Fat" },
] as const;

type DayValues = Record<(typeof MACRO_COLUMNS)[number]["key"], string>;

/* Mounted fresh per edit session, so state initializes from the profile. */
function GoalEditor({
  profile,
  onOpenChange,
  onSaved,
}: {
  profile: GoalProfileDTO;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [days, setDays] = useState<DayValues[]>(() => {
    const byDow = new Map(profile.days.map((day) => [day.dayOfWeek, day]));
    return Array.from({ length: 7 }, (_, dow) => {
      const day = byDow.get(dow);
      return {
        calories: String(day?.calories ?? 2000),
        proteinG: String(day?.proteinG ?? 150),
        carbsG: String(day?.carbsG ?? 200),
        fatG: String(day?.fatG ?? 70),
      };
    });
  });
  const [busy, setBusy] = useState(false);

  function setValue(dow: number, key: keyof DayValues, value: string) {
    setDays((prev) => prev.map((day, i) => (i === dow ? { ...day, [key]: value } : day)));
  }

  function copyToAll(sourceDow: number) {
    setDays((prev) => prev.map(() => ({ ...prev[sourceDow] })));
  }

  async function save() {
    const parsed = days.map((day, dayOfWeek) => ({
      dayOfWeek,
      calories: Number(day.calories),
      proteinG: Number(day.proteinG),
      carbsG: Number(day.carbsG),
      fatG: Number(day.fatG),
    }));
    for (const day of parsed) {
      if (
        !(day.calories > 0) ||
        [day.proteinG, day.carbsG, day.fatG].some((v) => !Number.isFinite(v) || v < 0)
      ) {
        toast.error(`Check the numbers for ${DAY_NAMES[day.dayOfWeek]}`);
        return;
      }
    }
    setBusy(true);
    try {
      await apiFetch(`/api/goals/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ days: parsed }),
      });
      toast.success("Goals updated");
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile.name}</DialogTitle>
          <DialogDescription>
            Set calories and macros per day of week
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Day</th>
                {MACRO_COLUMNS.map((column) => (
                  <th key={column.key} className="px-1 py-1 font-medium">
                    {column.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {days.map((day, dow) => (
                <tr key={dow}>
                  <td className="py-1 pr-2 font-medium">{DAY_NAMES[dow]}</td>
                  {MACRO_COLUMNS.map((column) => (
                    <td key={column.key} className="px-1 py-1">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        aria-label={`${DAY_NAMES[dow]} ${column.label}`}
                        className="h-9 w-full min-w-14 px-2 text-sm"
                        value={day[column.key]}
                        onChange={(event) => setValue(dow, column.key, event.target.value)}
                      />
                    </td>
                  ))}
                  <td className="pl-1">
                    <Button
                      variant="ghost"
                      size="xs"
                      title={`Copy ${DAY_NAMES[dow]} to all days`}
                      onClick={() => copyToAll(dow)}
                    >
                      Copy
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save goals"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

export function GoalsManager() {
  const [profiles, setProfiles] = useState<GoalProfileDTO[] | null>(null);
  const [editing, setEditing] = useState<GoalProfileDTO | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ goalProfiles: GoalProfileDTO[] }>("/api/goals");
      setProfiles(data.goalProfiles);
    } catch {
      toast.error("Could not load goals");
      setProfiles([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createProfile() {
    const name = window.prompt("Goal profile name", "My plan");
    if (!name?.trim()) return;
    try {
      await apiFetch("/api/goals", {
        method: "POST",
        body: JSON.stringify({ name: name.trim() }),
      });
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create profile");
    }
  }

  async function activate(profile: GoalProfileDTO) {
    setBusyId(profile.id);
    try {
      await apiFetch(`/api/goals/${profile.id}/activate`, { method: "POST" });
      toast.success(`${profile.name} is now active`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">Goal profiles</CardTitle>
        <Button size="sm" variant="secondary" onClick={createProfile}>
          <Plus data-icon="inline-start" aria-hidden />
          New
        </Button>
      </CardHeader>
      <CardContent>
        {profiles === null ? (
          <ListSkeleton rows={2} />
        ) : profiles.length === 0 ? (
          <EmptyState
            title="No goal profiles"
            body="Create one to get calorie and macro targets on your diary."
          />
        ) : (
          <ul className="divide-y">
            {profiles.map((profile) => (
              <li key={profile.id} className="flex items-center gap-3 py-2.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setEditing(profile)}
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{profile.name}</span>
                    {profile.isActive ? <Badge variant="secondary">Active</Badge> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {profile.days[0]
                      ? `${profile.days[0].calories} kcal · ${Math.round(profile.days[0].proteinG)}p base`
                      : "Tap to edit"}
                  </span>
                </button>
                {!profile.isActive ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyId === profile.id}
                    onClick={() => activate(profile)}
                  >
                    <Check data-icon="inline-start" aria-hidden />
                    Activate
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing ? (
        <GoalEditor
          profile={editing}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          onSaved={load}
        />
      ) : null}
    </Card>
  );
}

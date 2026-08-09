"use client";

import { Check, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { todayISO } from "@/lib/dates";
import type { ActivityPresetDTO, GoalActivityDTO, GoalProfileDTO } from "@/types/api";

const DOW_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/** Activity value math preview: carbs/protein × 4 + fat × 9. */
function activityCalories(a: Pick<GoalActivityDTO, "deltaCarbsG" | "deltaProteinG" | "deltaFatG">) {
  return Math.round(4 * a.deltaCarbsG + 4 * a.deltaProteinG + 9 * a.deltaFatG);
}

/** Blank draft for the add form. */
function emptyDraft() {
  return { name: "", days: [false, false, false, false, false, false, false], c: "", p: "", f: "" };
}
type ActivityDraft = ReturnType<typeof emptyDraft>;

/** Per-profile recurring activities: add / edit / delete, layered on the base. */
function ActivitiesSection({
  profileId,
  initial,
  onChanged,
}: {
  profileId: string;
  initial: GoalActivityDTO[];
  onChanged: () => void;
}) {
  const [activities, setActivities] = useState<GoalActivityDTO[]>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActivityDraft | null>(null);
  const [busy, setBusy] = useState(false);

  function startAdd() {
    setEditingId(null);
    setDraft(emptyDraft());
  }
  function startEdit(a: GoalActivityDTO) {
    setEditingId(a.id);
    setDraft({
      name: a.name,
      days: Array.from({ length: 7 }, (_, d) => a.daysOfWeek.includes(d)),
      c: String(a.deltaCarbsG),
      p: String(a.deltaProteinG),
      f: String(a.deltaFatG),
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const daysOfWeek = draft.days.flatMap((on, d) => (on ? [d] : []));
    if (!draft.name.trim()) return toast.error("Name the activity");
    if (daysOfWeek.length === 0) return toast.error("Pick at least one day");
    const body = {
      name: draft.name.trim(),
      daysOfWeek,
      deltaCarbsG: Number(draft.c) || 0,
      deltaProteinG: Number(draft.p) || 0,
      deltaFatG: Number(draft.f) || 0,
    };
    setBusy(true);
    try {
      if (editingId) {
        const { activity } = await apiFetch<{ activity: GoalActivityDTO }>(
          `/api/goals/${profileId}/activities/${editingId}`,
          { method: "PATCH", body: JSON.stringify(body) },
        );
        setActivities((prev) => prev.map((a) => (a.id === editingId ? activity : a)));
      } else {
        const { activity } = await apiFetch<{ activity: GoalActivityDTO }>(
          `/api/goals/${profileId}/activities`,
          { method: "POST", body: JSON.stringify(body) },
        );
        setActivities((prev) => [...prev, activity]);
      }
      setDraft(null);
      setEditingId(null);
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save activity");
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: GoalActivityDTO) {
    if (!window.confirm(`Delete "${a.name}"?`)) return;
    try {
      await apiFetch(`/api/goals/${profileId}/activities/${a.id}`, { method: "DELETE" });
      setActivities((prev) => prev.filter((x) => x.id !== a.id));
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-semibold">Activities</p>
      <p className="mb-2 text-xs text-muted-foreground">
        Recurring macro adjustments added on top of the base days. Calories derive from the macros.
      </p>
      <ul className="space-y-1.5">
        {activities.map((a) => (
          <li
            key={a.id}
            className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{a.name}</span>
              <span className="text-xs text-muted-foreground">
                {a.daysOfWeek.map((d) => DOW_LETTERS[d]).join(" ")} · +{a.deltaCarbsG}c
                {a.deltaProteinG ? ` +${a.deltaProteinG}p` : ""}
                {a.deltaFatG ? ` +${a.deltaFatG}f` : ""} · {activityCalories(a)} cal
              </span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.name}`} onClick={() => startEdit(a)}>
              <Pencil aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={`Delete ${a.name}`}
              onClick={() => remove(a)}
            >
              <Trash2 aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {draft ? (
        <div className="mt-2 space-y-2 rounded-lg border bg-muted/40 p-3">
          <Input
            placeholder="Activity name"
            value={draft.name}
            maxLength={60}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-9 text-sm"
          />
          <div className="flex justify-between gap-1">
            {DOW_LETTERS.map((letter, d) => (
              <button
                key={d}
                type="button"
                aria-pressed={draft.days[d]}
                onClick={() =>
                  setDraft({ ...draft, days: draft.days.map((on, i) => (i === d ? !on : on)) })
                }
                className={
                  draft.days[d]
                    ? "size-8 rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                    : "size-8 rounded-full border text-sm text-muted-foreground"
                }
              >
                {letter}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["c", "p", "f"] as const).map((k) => (
              <label key={k} className="block">
                <span className="mb-1 block text-xs text-muted-foreground">
                  {k === "c" ? "Carbs" : k === "p" ? "Protein" : "Fat"} g
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={draft[k]}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}
                  className="h-9 px-2 text-sm"
                />
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={saveDraft}>
              {busy ? "..." : editingId ? "Update" : "Add"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="mt-2" onClick={startAdd}>
          <Plus data-icon="inline-start" aria-hidden />
          Add activity
        </Button>
      )}
    </div>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MACRO_COLUMNS = [
  { key: "calories", label: "kcal", optional: false },
  { key: "proteinG", label: "Protein", optional: false },
  { key: "carbsG", label: "Carbs", optional: false },
  { key: "fatG", label: "Fat", optional: false },
] as const;

// Optional per-day limits (blank = no target). Each day keeps its own value.
const MICRO_COLUMNS = [
  { key: "fiberG", label: "Fiber", optional: true },
  { key: "sugarGMax", label: "Sugar≤", optional: true },
  { key: "sodiumMgMax", label: "Sodium≤", optional: true },
  { key: "satFatGMax", label: "SatFat≤", optional: true },
] as const;

type DayKey = (typeof MACRO_COLUMNS)[number]["key"] | (typeof MICRO_COLUMNS)[number]["key"];
type DayValues = Record<DayKey, string>;

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
      const num = (v: number | null | undefined) => (v != null ? String(v) : "");
      return {
        calories: String(day?.calories ?? 2000),
        proteinG: String(day?.proteinG ?? 150),
        carbsG: String(day?.carbsG ?? 200),
        fatG: String(day?.fatG ?? 70),
        fiberG: num(day?.fiberG),
        sugarGMax: num(day?.sugarGMax),
        sodiumMgMax: num(day?.sodiumMgMax),
        satFatGMax: num(day?.satFatGMax),
      };
    });
  });
  // Limits are opt-in; auto-shown when the profile already has any per-day limit.
  const [showLimits, setShowLimits] = useState(() =>
    profile.days.some(
      (d) =>
        d.fiberG != null || d.sugarGMax != null || d.sodiumMgMax != null || d.satFatGMax != null,
    ),
  );
  const [busy, setBusy] = useState(false);

  function setValue(dow: number, key: DayKey, value: string) {
    setDays((prev) => prev.map((day, i) => (i === dow ? { ...day, [key]: value } : day)));
  }

  function copyToAll(sourceDow: number) {
    setDays((prev) => prev.map(() => ({ ...prev[sourceDow] })));
  }

  async function save() {
    // Build each day from its own values; blank limits become null (omitted).
    const parsed: Array<Record<string, number>> = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const day = days[dayOfWeek];
      const calories = Number(day.calories);
      const proteinG = Number(day.proteinG);
      const carbsG = Number(day.carbsG);
      const fatG = Number(day.fatG);
      if (
        !(calories > 0) ||
        [proteinG, carbsG, fatG].some((v) => !Number.isFinite(v) || v < 0)
      ) {
        toast.error(`Check the numbers for ${DAY_NAMES[dayOfWeek]}`);
        return;
      }
      const row: Record<string, number> = { dayOfWeek, calories, proteinG, carbsG, fatG };
      for (const { key, label } of MICRO_COLUMNS) {
        const raw = day[key].trim();
        if (raw === "") continue;
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0) {
          toast.error(`Check ${DAY_NAMES[dayOfWeek]} ${label}`);
          return;
        }
        row[key] = value;
      }
      parsed.push(row);
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

  const columns = showLimits ? [...MACRO_COLUMNS, ...MICRO_COLUMNS] : MACRO_COLUMNS;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile.name}</DialogTitle>
          <DialogDescription>
            Set calories, macros, and optional limits per day of week
          </DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="py-1 pr-2 font-medium">Day</th>
                {columns.map((column) => (
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
                  {columns.map((column) => (
                    <td key={column.key} className="px-1 py-1">
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        placeholder={column.optional ? "—" : undefined}
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

        <Button
          variant="ghost"
          size="sm"
          className="self-start text-primary"
          onClick={() => setShowLimits((s) => !s)}
        >
          {showLimits ? "Hide daily limits" : "Add daily limits (fiber, sugar, sodium…)"}
        </Button>

        {/* Recurring activities layered on top of the base day targets */}
        <ActivitiesSection profileId={profile.id} initial={profile.activities} onChanged={onSaved} />

        <Button disabled={busy} onClick={save}>
          {busy ? "Saving..." : "Save goals"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Global, reusable activity presets — quick-picks for "Adjust this day". */
function ActivityPresetsSection() {
  const [presets, setPresets] = useState<ActivityPresetDTO[] | null>(null);
  const [draft, setDraft] = useState<{ id: string | null; name: string; carbs: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { presets } = await apiFetch<{ presets: ActivityPresetDTO[] }>("/api/goals/presets");
      setPresets(presets);
    } catch {
      setPresets([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast.error("Name the activity");
      return;
    }
    const deltaCarbsG = Number(draft.carbs) || 0;
    setBusy(true);
    try {
      await apiFetch(draft.id ? `/api/goals/presets/${draft.id}` : "/api/goals/presets", {
        method: draft.id ? "PATCH" : "POST",
        body: JSON.stringify({ name, deltaCarbsG }),
      });
      setDraft(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save preset");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await apiFetch(`/api/goals/presets/${id}`, { method: "DELETE" });
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete preset");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0">
          <CardTitle className="text-base">Activity presets</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Shared across all plans · added manually from “Adjust this day” · never auto-applied
          </p>
        </div>
        {draft === null ? (
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={() => setDraft({ id: null, name: "", carbs: "" })}
          >
            <Plus data-icon="inline-start" aria-hidden />
            New
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {presets === null ? (
          <ListSkeleton rows={2} />
        ) : presets.length === 0 && draft === null ? (
          <EmptyState
            title="No activity presets"
            body='Add one like "Brisk Walking (10 mins)" to quick-add it to any day.'
          />
        ) : (
          <ul className="divide-y">
            {presets.map((preset) => (
              <li key={preset.id} className="flex items-center gap-2 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{preset.name}</span>
                  <span className="text-xs text-muted-foreground">
                    +{preset.deltaCarbsG} c · {Math.round(preset.deltaCarbsG * 4)} cal
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${preset.name}`}
                  onClick={() =>
                    setDraft({ id: preset.id, name: preset.name, carbs: String(preset.deltaCarbsG) })
                  }
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive"
                  aria-label={`Delete ${preset.name}`}
                  disabled={busy}
                  onClick={() => remove(preset.id)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {draft ? (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
            <Input
              placeholder="Name, e.g. Brisk Walking (10 mins)"
              value={draft.name}
              maxLength={60}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
              className="h-9 text-sm"
            />
            <label className="block">
              <span className="mb-1 block text-xs text-muted-foreground">
                Carbs (g) · {Math.round((Number(draft.carbs) || 0) * 4)} cal
              </span>
              <Input
                type="number"
                inputMode="decimal"
                value={draft.carbs}
                onChange={(event) => setDraft({ ...draft, carbs: event.target.value })}
                className="h-9 px-2 text-sm"
              />
            </label>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={save}>
                {busy ? "..." : draft.id ? "Update" : "Add"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
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
      await apiFetch(`/api/goals/${profile.id}/activate`, {
        method: "POST",
        // Local date so today (and any future days) adopt the new targets.
        body: JSON.stringify({ today: todayISO() }),
      });
      toast.success(`${profile.name} is now active`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Activation failed");
    } finally {
      setBusyId(null);
    }
  }

  async function rename(profile: GoalProfileDTO) {
    const name = window.prompt("Profile name", profile.name)?.trim();
    if (!name || name === profile.name) return;
    setBusyId(profile.id);
    try {
      await apiFetch(`/api/goals/${profile.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });
      toast.success("Profile renamed");
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rename failed");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(profile: GoalProfileDTO) {
    const confirmed = window.confirm(
      `Delete "${profile.name}"?${profile.isActive ? " It is your active profile — your diary will show no targets until you activate another." : ""}`,
    );
    if (!confirmed) return;
    setBusyId(profile.id);
    try {
      await apiFetch(`/api/goals/${profile.id}`, { method: "DELETE" });
      toast.success(`Deleted ${profile.name}`);
      load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <ActivityPresetsSection />
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Options for ${profile.name}`}
                      disabled={busyId === profile.id}
                    >
                      <MoreHorizontal aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => rename(profile)}>
                      <Pencil aria-hidden />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => remove(profile)}
                    >
                      <Trash2 aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
    </div>
  );
}

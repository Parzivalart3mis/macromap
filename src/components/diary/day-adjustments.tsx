"use client";

import { Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/client/fetcher";
import { cn } from "@/lib/utils";
import type {
  ActivityPresetDTO,
  DayActivityDTO,
  DayOneOffDTO,
  GoalActivityDTO,
  GoalProfileDTO,
} from "@/types/api";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Per-date adjustments for one diary day: skip / override the recurring
 * activities that fall on it, and add or remove one-off adjustments. Each write
 * calls the exceptions API and asks the parent to refetch so the ring updates.
 */
export function DayAdjustments({
  profileId,
  date,
  activities,
  oneOffs,
  onChanged,
}: {
  profileId: string;
  date: string;
  activities: DayActivityDTO[];
  oneOffs: DayOneOffDTO[];
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Inline override editor: which activity, and the draft carb value.
  const [editing, setEditing] = useState<{ id: string; carbs: string } | null>(null);
  const [oneOffDraft, setOneOffDraft] = useState<{ label: string; carbs: string } | null>(null);
  // The profile's whole activity list, lazily loaded to quick-fill one-offs
  // (add a preset like "E-bike commute" on a day it doesn't normally recur).
  const [presets, setPresets] = useState<GoalActivityDTO[] | null>(null);
  // Global, reusable activity presets (e.g. "Brisk Walking (10 mins)").
  const [globalPresets, setGlobalPresets] = useState<ActivityPresetDTO[] | null>(null);
  const weekdayName = WEEKDAY_NAMES[new Date(`${date}T00:00:00Z`).getUTCDay()];

  async function openOneOff() {
    setOneOffDraft({ label: "", carbs: "" });
    if (presets === null) {
      try {
        const { goalProfiles } = await apiFetch<{ goalProfiles: GoalProfileDTO[] }>("/api/goals");
        setPresets(goalProfiles.find((p) => p.id === profileId)?.activities ?? []);
      } catch {
        setPresets([]);
      }
    }
    if (globalPresets === null) {
      try {
        const { presets: rows } = await apiFetch<{ presets: ActivityPresetDTO[] }>(
          "/api/goals/presets",
        );
        setGlobalPresets(rows);
      } catch {
        setGlobalPresets([]);
      }
    }
  }

  // Merge the active plan's recurring activities and the global presets into one
  // quick-pick strip — tapping either just pre-fills the one-off draft.
  const quickPicks = [
    ...(presets ?? []).map((p) => ({ key: `a-${p.id}`, name: p.name, carbs: p.deltaCarbsG })),
    ...(globalPresets ?? []).map((p) => ({ key: `p-${p.id}`, name: p.name, carbs: p.deltaCarbsG })),
  ];

  async function run(fn: () => Promise<unknown>, failMsg: string) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : failMsg);
    } finally {
      setBusy(false);
    }
  }

  const skip = (a: DayActivityDTO) =>
    run(
      () =>
        apiFetch(`/api/goals/${profileId}/exceptions`, {
          method: "POST",
          body: JSON.stringify({ date, activityId: a.activityId, kind: "skip" }),
        }),
      "Could not skip",
    );

  const removeException = (exceptionId: string) =>
    run(
      () =>
        apiFetch(`/api/goals/${profileId}/exceptions/${exceptionId}`, { method: "DELETE" }),
      "Could not restore",
    );

  const overrideToday = (a: DayActivityDTO, carbs: number) =>
    run(async () => {
      await apiFetch(`/api/goals/${profileId}/exceptions`, {
        method: "POST",
        body: JSON.stringify({ date, activityId: a.activityId, kind: "override", deltaCarbsG: carbs }),
      });
      setEditing(null);
    }, "Could not override");

  const overrideAllDays = (a: DayActivityDTO, carbs: number) =>
    run(async () => {
      await apiFetch(`/api/goals/${profileId}/activities/${a.activityId}`, {
        method: "PATCH",
        body: JSON.stringify({ deltaCarbsG: carbs }),
      });
      setEditing(null);
    }, "Could not update");

  const addOneOff = (label: string, carbs: number) =>
    run(async () => {
      await apiFetch(`/api/goals/${profileId}/exceptions`, {
        method: "POST",
        body: JSON.stringify({ date, kind: "oneoff", label, deltaCarbsG: carbs }),
      });
      setOneOffDraft(null);
    }, "Could not add");

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold">Adjust this day</p>

      <ul className="space-y-1.5">
        {activities.map((a) => (
          <li key={a.activityId} className="rounded-lg border px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <span className={cn("min-w-0 flex-1", a.skipped && "text-muted-foreground line-through")}>
                <span className="block truncate font-medium">{a.name}</span>
                <span className="text-xs text-muted-foreground">
                  +{a.carbsG} c · {Math.round(a.calories)} cal
                  {a.overridden ? " · overridden" : ""}
                </span>
              </span>
              {a.skipped ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => a.exceptionId && removeException(a.exceptionId)}
                >
                  <RotateCcw data-icon="inline-start" aria-hidden />
                  Restore
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      setEditing(editing?.id === a.activityId ? null : { id: a.activityId, carbs: String(a.carbsG) })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Skip ${a.name} today`}
                    disabled={busy}
                    onClick={() => skip(a)}
                  >
                    <X aria-hidden />
                  </Button>
                </>
              )}
            </div>

            {editing?.id === a.activityId ? (
              <div className="mt-2 space-y-2 border-t pt-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Carbs (g)</span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    value={editing.carbs}
                    onChange={(e) => setEditing({ id: a.activityId, carbs: e.target.value })}
                    className="h-9 px-2 text-sm"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy} onClick={() => overrideToday(a, Number(editing.carbs) || 0)}>
                    Just today
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => overrideAllDays(a, Number(editing.carbs) || 0)}
                  >
                    Every {weekdayName}
                  </Button>
                  {a.overridden && a.exceptionId ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => removeException(a.exceptionId!)}
                    >
                      Reset today
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : null}
          </li>
        ))}

        {oneOffs.map((o) => (
          <li key={o.exceptionId} className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{o.label}</span>
              <span className="text-xs text-muted-foreground">
                +{o.carbsG} c · {Math.round(o.calories)} cal · one-off
              </span>
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-destructive"
              aria-label={`Remove ${o.label}`}
              disabled={busy}
              onClick={() => removeException(o.exceptionId)}
            >
              <X aria-hidden />
            </Button>
          </li>
        ))}
      </ul>

      {oneOffDraft ? (
        <div className="space-y-2 rounded-lg border bg-muted/40 p-3">
          {quickPicks.length > 0 ? (
            <div>
              <span className="mb-1 block text-xs text-muted-foreground">
                Quick pick from your activities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {quickPicks.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setOneOffDraft({ label: p.name, carbs: String(p.carbs) })}
                    className="rounded-full border bg-card px-3 py-1 text-xs hover:bg-muted"
                  >
                    {p.name} +{p.carbs}c
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <Input
            placeholder="One-off name (e.g. Extra ride)"
            value={oneOffDraft.label}
            maxLength={60}
            onChange={(e) => setOneOffDraft({ ...oneOffDraft, label: e.target.value })}
            className="h-9 text-sm"
          />
          <label className="block">
            <span className="mb-1 block text-xs text-muted-foreground">Carbs (g)</span>
            <Input
              type="number"
              inputMode="decimal"
              value={oneOffDraft.carbs}
              onChange={(e) => setOneOffDraft({ ...oneOffDraft, carbs: e.target.value })}
              className="h-9 px-2 text-sm"
            />
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy}
              onClick={() => {
                if (!oneOffDraft.label.trim()) return toast.error("Name the adjustment");
                addOneOff(oneOffDraft.label.trim(), Number(oneOffDraft.carbs) || 0);
              }}
            >
              Add
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOneOffDraft(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={openOneOff}>
          <Plus data-icon="inline-start" aria-hidden />
          One-off adjustment
        </Button>
      )}
    </div>
  );
}

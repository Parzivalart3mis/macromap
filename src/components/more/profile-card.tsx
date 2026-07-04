"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { ListSkeleton } from "@/components/async-states";
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

interface MePayload {
  user: { id: string; email: string | null; displayName: string | null };
  profile: {
    timezone: string;
    unitSystem: "metric" | "imperial";
    heightCm: number | null;
  };
}

export function ProfileCard() {
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

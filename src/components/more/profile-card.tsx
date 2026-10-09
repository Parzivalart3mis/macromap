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
import type { BiologicalSexDTO } from "@/types/api";

interface MePayload {
  user: { id: string; email: string | null; displayName: string | null };
  profile: {
    timezone: string;
    unitSystem: "metric" | "imperial";
    heightCm: number | null;
    sex: BiologicalSexDTO | null;
    dateOfBirth: string | null;
  };
}

export function ProfileCard() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [unitSystem, setUnitSystem] = useState<"metric" | "imperial">("metric");
  const [heightCm, setHeightCm] = useState("");
  // Only used to pick body-composition coefficients, so it defaults to opting out.
  const [sex, setSex] = useState<BiologicalSexDTO>("unspecified");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MePayload>("/api/me");
      setMe(data);
      setDisplayName(data.user.displayName ?? "");
      setUnitSystem(data.profile.unitSystem);
      setHeightCm(data.profile.heightCm ? String(data.profile.heightCm) : "");
      setSex(data.profile.sex ?? "unspecified");
      setDateOfBirth(data.profile.dateOfBirth ?? "");
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
      payload.sex = sex;
      payload.dateOfBirth = dateOfBirth || null;
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
            {/* Grid children default to min-width:auto, so a date input — whose
                intrinsic width comes from the formatted date — would otherwise
                refuse to shrink and push past the card. */}
            <div className="grid grid-cols-2 gap-3 [&>div]:min-w-0">
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
              <div className="space-y-1">
                <Label htmlFor="sex">Sex</Label>
                <Select value={sex} onValueChange={(v) => setSex(v as BiologicalSexDTO)}>
                  <SelectTrigger id="sex" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="unspecified">Prefer not to say</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="dob">Date of birth</Label>
                {/* Safari gives date inputs an intrinsic width and centres the
                    text; both are overridden so it matches its neighbours. */}
                <Input
                  id="dob"
                  type="date"
                  className="w-full appearance-none text-left [&::-webkit-date-and-time-value]:text-left"
                  value={dateOfBirth}
                  onChange={(event) => setDateOfBirth(event.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Sex and height are used only to estimate body fat from your
              measurements. Choosing &ldquo;prefer not to say&rdquo; simply skips that
              estimate.
            </p>
            <Button disabled={busy} onClick={save} className="w-full">
              {busy ? "Saving..." : "Save profile"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

-- Goal phases: one profile can hold up to four complete weekly tables
-- (cut / lean bulk / recomp / maintenance) and switch between them.
--
-- NOTE: drizzle's snapshot had drifted from the live database — several tables
-- and columns created after migration 0007 were applied directly and are absent
-- from the snapshot, so `db:generate` emitted CREATE TABLE for objects that
-- already exist. This file was trimmed by hand to the four changes that are
-- genuinely new, and every statement is guarded so re-running is harmless.

DO $$ BEGIN
	CREATE TYPE "public"."goal_phase" AS ENUM('cut', 'lean_bulk', 'recomp', 'maintenance');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

ALTER TABLE "goal_profiles" ADD COLUMN IF NOT EXISTS "active_phase" "goal_phase" DEFAULT 'maintenance' NOT NULL;--> statement-breakpoint

ALTER TABLE "goal_days" ADD COLUMN IF NOT EXISTS "phase" "goal_phase" DEFAULT 'maintenance' NOT NULL;--> statement-breakpoint

-- Existing rows are the plan's maintenance table; the column default already
-- placed them there. Widen the uniqueness to (profile, phase, weekday) so a
-- profile can carry one row per weekday per phase.
DROP INDEX IF EXISTS "goal_days_profile_day_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "goal_days_profile_phase_day_idx" ON "goal_days" USING btree ("goal_profile_id","phase","day_of_week");--> statement-breakpoint

-- Pinned per day, exactly like goal_profile_id, so switching phase never
-- rewrites the targets of days already logged. Null on days that predate this.
ALTER TABLE "diary_days" ADD COLUMN IF NOT EXISTS "goal_phase" "goal_phase";

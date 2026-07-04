CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."food_source_type" AS ENUM('official_store', 'barcode_api', 'open_food_facts', 'user_created');--> statement-breakpoint
CREATE TYPE "public"."logged_via" AS ENUM('search', 'barcode', 'voice', 'natural_language', 'store_builder', 'saved_meal');--> statement-breakpoint
CREATE TYPE "public"."unit_system" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TABLE "ai_logging_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"input_text" text NOT NULL,
	"parsed_json" jsonb,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "barcode_ingest_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"barcode" text NOT NULL,
	"resolved_food_id" uuid,
	"source_used" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_metric_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"body_fat_pct" double precision,
	"waist_cm" double precision,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "custom_store_order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_store_order_id" uuid NOT NULL,
	"ingredient_food_id" uuid NOT NULL,
	"quantity" double precision DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_store_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"base_menu_item_id" uuid,
	"nutrition_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"goal_profile_id" uuid
);
--> statement-breakpoint
CREATE TABLE "diary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diary_meal_id" uuid NOT NULL,
	"food_id" uuid,
	"custom_store_order_id" uuid,
	"quantity" double precision DEFAULT 1 NOT NULL,
	"serving_multiplier" double precision DEFAULT 1 NOT NULL,
	"logged_via" "logged_via" DEFAULT 'search' NOT NULL,
	"nutrition_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "diary_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"diary_day_id" uuid NOT NULL,
	"meal_name" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fasting_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone,
	"duration_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "food_edit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"edited_by_user_id" text NOT NULL,
	"field_changed" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"brand_name" text,
	"source_type" "food_source_type" DEFAULT 'user_created' NOT NULL,
	"created_by_user_id" text,
	"serving_size_value" double precision NOT NULL,
	"serving_size_unit" text NOT NULL,
	"calories" double precision NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"fiber_g" double precision,
	"sugar_g" double precision,
	"sat_fat_g" double precision,
	"sodium_mg" double precision,
	"cholesterol_mg" double precision,
	"potassium_mg" double precision,
	"barcode" text,
	"is_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goal_profile_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" double precision NOT NULL,
	"carbs_g" double precision NOT NULL,
	"fat_g" double precision NOT NULL,
	"fiber_g" double precision,
	"sugar_g_max" double precision,
	"sodium_mg_max" double precision,
	"sat_fat_g_max" double precision
);
--> statement-breakpoint
CREATE TABLE "goal_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"unit_system" "unit_system" DEFAULT 'metric' NOT NULL,
	"height_cm" double precision,
	"starting_weight_kg" double precision,
	"date_of_birth" date,
	"sex" text
);
--> statement-breakpoint
CREATE TABLE "saved_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"entries_snapshot_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"ingredient_group" text NOT NULL,
	"is_default_selected" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_menu_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"is_default_verified" boolean DEFAULT true NOT NULL,
	"menu_category" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_theme_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" uuid NOT NULL,
	"primary_hex" text NOT NULL,
	"secondary_hex" text NOT NULL,
	"accent_hex" text NOT NULL,
	"surface_tint_hex" text NOT NULL,
	"text_override_hex" text
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"brand_theme_key" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weight_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"date" date NOT NULL,
	"weight_value" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_logging_runs" ADD CONSTRAINT "ai_logging_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "barcode_ingest_logs" ADD CONSTRAINT "barcode_ingest_logs_resolved_food_id_foods_id_fk" FOREIGN KEY ("resolved_food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_metric_logs" ADD CONSTRAINT "body_metric_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_store_order_items" ADD CONSTRAINT "custom_store_order_items_custom_store_order_id_custom_store_orders_id_fk" FOREIGN KEY ("custom_store_order_id") REFERENCES "public"."custom_store_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_store_order_items" ADD CONSTRAINT "custom_store_order_items_ingredient_food_id_foods_id_fk" FOREIGN KEY ("ingredient_food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_store_orders" ADD CONSTRAINT "custom_store_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_store_orders" ADD CONSTRAINT "custom_store_orders_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_store_orders" ADD CONSTRAINT "custom_store_orders_base_menu_item_id_store_menu_items_id_fk" FOREIGN KEY ("base_menu_item_id") REFERENCES "public"."store_menu_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_days" ADD CONSTRAINT "diary_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_days" ADD CONSTRAINT "diary_days_goal_profile_id_goal_profiles_id_fk" FOREIGN KEY ("goal_profile_id") REFERENCES "public"."goal_profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_diary_meal_id_diary_meals_id_fk" FOREIGN KEY ("diary_meal_id") REFERENCES "public"."diary_meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_entries" ADD CONSTRAINT "diary_entries_custom_store_order_id_custom_store_orders_id_fk" FOREIGN KEY ("custom_store_order_id") REFERENCES "public"."custom_store_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "diary_meals" ADD CONSTRAINT "diary_meals_diary_day_id_diary_days_id_fk" FOREIGN KEY ("diary_day_id") REFERENCES "public"."diary_days"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fasting_sessions" ADD CONSTRAINT "fasting_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_edit_history" ADD CONSTRAINT "food_edit_history_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_edit_history" ADD CONSTRAINT "food_edit_history_edited_by_user_id_users_id_fk" FOREIGN KEY ("edited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_days" ADD CONSTRAINT "goal_days_goal_profile_id_goal_profiles_id_fk" FOREIGN KEY ("goal_profile_id") REFERENCES "public"."goal_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goal_profiles" ADD CONSTRAINT "goal_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_meals" ADD CONSTRAINT "saved_meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_ingredients" ADD CONSTRAINT "store_ingredients_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_ingredients" ADD CONSTRAINT "store_ingredients_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_menu_items" ADD CONSTRAINT "store_menu_items_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_menu_items" ADD CONSTRAINT "store_menu_items_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_theme_tokens" ADD CONSTRAINT "store_theme_tokens_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "body_metric_logs_user_date_idx" ON "body_metric_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "custom_store_orders_user_store_idx" ON "custom_store_orders" USING btree ("user_id","store_id");--> statement-breakpoint
CREATE UNIQUE INDEX "diary_days_user_date_idx" ON "diary_days" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "diary_entries_meal_idx" ON "diary_entries" USING btree ("diary_meal_id","created_at");--> statement-breakpoint
CREATE INDEX "diary_meals_day_idx" ON "diary_meals" USING btree ("diary_day_id","display_order");--> statement-breakpoint
CREATE INDEX "fasting_sessions_user_start_idx" ON "fasting_sessions" USING btree ("user_id","start_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "food_edit_history_food_idx" ON "food_edit_history" USING btree ("food_id","edited_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode") WHERE "foods"."barcode" is not null;--> statement-breakpoint
CREATE INDEX "foods_name_trgm_idx" ON "foods" USING gin (("name" || ' ' || coalesce("brand_name", '')) gin_trgm_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "goal_days_profile_day_idx" ON "goal_days" USING btree ("goal_profile_id","day_of_week");--> statement-breakpoint
CREATE INDEX "goal_profiles_user_idx" ON "goal_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "saved_meals_user_idx" ON "saved_meals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "store_ingredients_store_idx" ON "store_ingredients" USING btree ("store_id","ingredient_group");--> statement-breakpoint
CREATE INDEX "store_menu_items_store_idx" ON "store_menu_items" USING btree ("store_id","menu_category","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "weight_logs_user_date_idx" ON "weight_logs" USING btree ("user_id","date");
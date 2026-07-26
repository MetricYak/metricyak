DELETE FROM "project_keys";
--> statement-breakpoint
ALTER TABLE "project_keys" ADD COLUMN "last_used_at" timestamp (3) with time zone;--> statement-breakpoint
ALTER TABLE "project_keys" ADD COLUMN "expires_at" timestamp (3) with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "project_keys_one_active_idx" ON "project_keys" USING btree ("project_id") WHERE revoked_at is null and expires_at is null;--> statement-breakpoint
ALTER TABLE "project_keys" DROP COLUMN "name";
ALTER TABLE "users" ADD COLUMN "job_role" varchar(100);--> statement-breakpoint
UPDATE "users" SET "job_role" = (
  SELECT "job_role" FROM "organization_memberships"
  WHERE "organization_memberships"."user_id" = "users"."id"
  ORDER BY "organization_memberships"."created_at", "organization_memberships"."id"
  LIMIT 1
);--> statement-breakpoint
ALTER TABLE "organization_memberships" DROP COLUMN "job_role";

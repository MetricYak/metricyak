ALTER TABLE "users" ADD COLUMN "first_name" varchar(150) NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" varchar(150);--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "organization_memberships" ALTER COLUMN "job_role" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "heard_about_us" DROP NOT NULL;
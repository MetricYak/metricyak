CREATE TABLE "organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(32) NOT NULL,
	"job_role" varchar(100),
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "organization_memberships_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "user_selections" (
	"user_id" uuid PRIMARY KEY,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" varchar(150) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text,
	"email_verified_at" timestamp(3) with time zone,
	"heard_about_us" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) with time zone NOT NULL,
	"updated_at" timestamp(3) with time zone NOT NULL,
	CONSTRAINT "users_email_lowercase" CHECK ("email" = lower("email"))
);
--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_id_unique" UNIQUE("organization_id","id");--> statement-breakpoint
CREATE INDEX "organization_memberships_user_id_index" ON "organization_memberships" ("user_id");--> statement-breakpoint
CREATE INDEX "user_selections_project_id_index" ON "user_selections" ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_index" ON "users" ("email");--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_organizations_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_selections" ADD CONSTRAINT "user_selections_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_selections" ADD CONSTRAINT "user_selections_organization_membership_fkey" FOREIGN KEY ("organization_id","user_id") REFERENCES "organization_memberships"("organization_id","user_id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_selections" ADD CONSTRAINT "user_selections_project_fkey" FOREIGN KEY ("organization_id","project_id") REFERENCES "projects"("organization_id","id") ON DELETE CASCADE;
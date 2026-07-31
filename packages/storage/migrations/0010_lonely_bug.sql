CREATE TABLE "signal_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(128) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"connection_kind" varchar(24) DEFAULT 'manual_webhook' NOT NULL,
	"config" jsonb NOT NULL,
	"installation_id" text,
	"secret_id" uuid,
	"status" varchar(32) DEFAULT 'awaiting_first_delivery' NOT NULL,
	"last_delivery_at" timestamp (3) with time zone,
	"last_error" text,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signal_sources_project_id_name_key" UNIQUE("project_id","name"),
	CONSTRAINT "signal_sources_id_project_id_key" UNIQUE("id","project_id")
);
--> statement-breakpoint
CREATE TABLE "signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"kind" varchar(16) NOT NULL,
	"external_id" text NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"observed_at" timestamp (3) with time zone NOT NULL,
	"ended_at" timestamp (3) with time zone,
	"title" text NOT NULL,
	"status" varchar(24),
	"attributes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signals_source_id_external_id_key" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
ALTER TABLE "signal_sources" ADD CONSTRAINT "signal_sources_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signal_sources" ADD CONSTRAINT "signal_sources_secret_id_secrets_id_fk" FOREIGN KEY ("secret_id") REFERENCES "public"."secrets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signals" ADD CONSTRAINT "signals_source_id_project_id_fk" FOREIGN KEY ("source_id","project_id") REFERENCES "public"."signal_sources"("id","project_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "signal_sources_project_id_idx" ON "signal_sources" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "signal_sources_installation_id_idx" ON "signal_sources" USING btree ("installation_id");--> statement-breakpoint
CREATE INDEX "signals_project_id_occurred_at_idx" ON "signals" USING btree ("project_id","occurred_at");
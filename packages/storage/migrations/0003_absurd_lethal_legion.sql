ALTER TABLE "monitors" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "missing_data" varchar(8) DEFAULT 'skip' NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "next_eval_at" timestamp (3) with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "monitors_enabled_next_eval_at_idx" ON "monitors" USING btree ("enabled","next_eval_at");--> statement-breakpoint
ALTER TABLE "monitors" DROP COLUMN "workflow_id";
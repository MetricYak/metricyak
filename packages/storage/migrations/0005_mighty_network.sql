ALTER TABLE "monitors" ADD COLUMN "consecutive_failures" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "eval_health" varchar(8) DEFAULT 'ok' NOT NULL;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "last_eval_error" text;--> statement-breakpoint
ALTER TABLE "monitors" ADD COLUMN "last_eval_error_at" timestamp (3) with time zone;
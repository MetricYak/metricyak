CREATE TABLE "monitor_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"series" varchar(256) NOT NULL,
	"type" varchar(16) NOT NULL,
	"value" double precision NOT NULL,
	"threshold" jsonb NOT NULL,
	"occurred_at" timestamp (3) with time zone NOT NULL,
	"relayed_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_state" (
	"monitor_id" uuid NOT NULL,
	"series" varchar(256) NOT NULL,
	"status" varchar(8) DEFAULT 'ok' NOT NULL,
	"breached_since" timestamp (3) with time zone,
	"last_value" double precision,
	"last_evaluated_at" timestamp (3) with time zone,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitor_state_monitor_id_series_pk" PRIMARY KEY("monitor_id","series")
);
--> statement-breakpoint
ALTER TABLE "monitor_events" ADD CONSTRAINT "monitor_events_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_state" ADD CONSTRAINT "monitor_state_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitor_events_monitor_id_idx" ON "monitor_events" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "monitor_events_unrelayed_idx" ON "monitor_events" USING btree ("occurred_at") WHERE "monitor_events"."relayed_at" is null;--> statement-breakpoint
CREATE INDEX "monitor_state_monitor_id_idx" ON "monitor_state" USING btree ("monitor_id");
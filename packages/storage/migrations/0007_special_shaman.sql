CREATE TABLE "monitor_event_keys" (
	"monitor_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"event_name" varchar(256) NOT NULL,
	CONSTRAINT "monitor_event_keys_monitor_id_event_name_pk" PRIMARY KEY("monitor_id","event_name")
);
--> statement-breakpoint
ALTER TABLE "monitor_event_keys" ADD CONSTRAINT "monitor_event_keys_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_event_keys" ADD CONSTRAINT "monitor_event_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "monitor_event_keys_project_event_idx" ON "monitor_event_keys" USING btree ("project_id","event_name");
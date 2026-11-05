CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7(),
	"name" varchar(72) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

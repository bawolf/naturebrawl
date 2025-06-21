CREATE TABLE "battle_events" (
	"id" text PRIMARY KEY NOT NULL,
	"brawl_id" text NOT NULL,
	"turn_number" integer NOT NULL,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "battle_events" ADD CONSTRAINT "battle_events_brawl_id_brawls_id_fk" FOREIGN KEY ("brawl_id") REFERENCES "public"."brawls"("id") ON DELETE cascade ON UPDATE no action;
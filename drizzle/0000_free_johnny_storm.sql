CREATE TABLE "brawls" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"winner_id" text,
	"current_player_id" text,
	"turn_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "brawls_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "characters" (
	"id" text PRIMARY KEY NOT NULL,
	"brawl_id" text NOT NULL,
	"browser_id" text NOT NULL,
	"species" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD CONSTRAINT "characters_brawl_id_brawls_id_fk" FOREIGN KEY ("brawl_id") REFERENCES "public"."brawls"("id") ON DELETE cascade ON UPDATE no action;
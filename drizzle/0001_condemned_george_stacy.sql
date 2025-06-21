CREATE TABLE "attacks" (
	"id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"energy_cost" integer NOT NULL,
	"damage" integer NOT NULL,
	"critical_hit_chance" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "attack" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "defense" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "speed" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "energy" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "recovery" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "health" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "max_health" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "max_energy" integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE "attacks" ADD CONSTRAINT "attacks_character_id_characters_id_fk" FOREIGN KEY ("character_id") REFERENCES "public"."characters"("id") ON DELETE cascade ON UPDATE no action;
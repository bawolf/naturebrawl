CREATE TABLE "image_generations" (
	"id" text PRIMARY KEY NOT NULL,
	"brawl_id" text NOT NULL,
	"turn_number" integer NOT NULL,
	"replicate_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"prompt" text,
	"modification" text,
	"input_image_url" text,
	"output_image_url" text,
	"gcs_path" text,
	"webhook_data" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brawls" ADD COLUMN "current_image_url" text;--> statement-breakpoint
ALTER TABLE "brawls" ADD COLUMN "location" text DEFAULT 'San Francisco' NOT NULL;--> statement-breakpoint
ALTER TABLE "image_generations" ADD CONSTRAINT "image_generations_brawl_id_brawls_id_fk" FOREIGN KEY ("brawl_id") REFERENCES "public"."brawls"("id") ON DELETE cascade ON UPDATE no action;
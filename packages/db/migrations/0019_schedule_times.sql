ALTER TABLE "schedules" ADD COLUMN "day_times" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "alt_start_time" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "alt_end_time" text;--> statement-breakpoint
ALTER TABLE "schedules" ADD COLUMN "alt_anchor" date;

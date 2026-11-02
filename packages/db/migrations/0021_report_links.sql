-- Hisobotda havola (isbot turi `link`, SMM uchun): task_reports.links
ALTER TABLE "task_reports" ADD COLUMN "links" text[] DEFAULT '{}'::text[] NOT NULL;

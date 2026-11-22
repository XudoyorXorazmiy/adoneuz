-- 2-paket (2026-11-22): navbat o'lchovi (started_at/finished_at) va indekslar.
-- Idempotent (IF NOT EXISTS): yangi kod started_at ustunisiz ishlamaydi, shuning uchun bu fayl deploy'dan OLDIN bazaga qo'lda
-- qo'llanadi (eski kodga zarari yo'q), deploy'dan keyin odatdagi `migrate` uni jurnalga yozadi (qayta ishlasa ham xato bermaydi).
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "finished_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jobs_created_idx" ON "jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_created_idx" ON "tasks" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tasks_tenant_updated_idx" ON "tasks" USING btree ("tenant_id","updated_at");

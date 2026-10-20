-- 1-bosqich jadvallari RLS. Qoida (CLAUDE.md §3a): tenant jadvali — faqat `tenant_id = app_tenant_id()`, OR yo'q.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['branches', 'departments', 'schedules', 'employees', 'consents', 'media', 'attendance_events', 'attendance_days', 'invites', 'tg_links'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t || '_app', t);
  END LOOP;
END $$;--> statement-breakpoint

-- Jurnallar append-only
REVOKE UPDATE, DELETE ON attendance_events, consents FROM adone_app;--> statement-breakpoint

-- Bot: webhook'da tenant noma'lum — taklif kodi va Telegram bog'lanishlari platforma rolida o'qiladi/yoziladi.
GRANT SELECT, INSERT, UPDATE, DELETE ON invites, tg_links, bot_sessions, tg_updates TO adone_platform;--> statement-breakpoint
CREATE POLICY invites_platform ON invites TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY tg_links_platform ON tg_links TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE bot_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY bot_sessions_platform ON bot_sessions TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
ALTER TABLE tg_updates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tg_updates_platform ON tg_updates TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
-- Suhbat holati va update'lar ishxona ma'lumoti emas — ilova roli (tenant konteksti) ko'rmaydi
REVOKE ALL ON bot_sessions, tg_updates FROM adone_app;

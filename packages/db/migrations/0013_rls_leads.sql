-- Landing arizalari: ishxonaga bog'liq emas. Anonim yozish adone_auth orqali (faqat INSERT, o'qiy olmaydi),
-- ro'yxat va holat — faqat platforma. Ilova roli (adone_app) jadvalga umuman kirmaydi.
REVOKE ALL ON leads FROM adone_app;--> statement-breakpoint
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
GRANT INSERT ON leads TO adone_auth;--> statement-breakpoint
CREATE POLICY leads_auth ON leads FOR INSERT TO adone_auth WITH CHECK (status = 'new');--> statement-breakpoint
GRANT SELECT, UPDATE ON leads TO adone_platform;--> statement-breakpoint
CREATE POLICY leads_platform ON leads TO adone_platform USING (true) WITH CHECK (true);

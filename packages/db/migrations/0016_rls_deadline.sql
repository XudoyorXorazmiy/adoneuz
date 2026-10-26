-- Muddatni uzaytirish so'rovlari. Qoida (CLAUDE.md §3a): faqat `tenant_id = app_tenant_id()`, OR yo'q. So'rov o'chirilmaydi.
ALTER TABLE deadline_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY deadline_requests_app ON deadline_requests TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
REVOKE DELETE ON deadline_requests FROM adone_app;

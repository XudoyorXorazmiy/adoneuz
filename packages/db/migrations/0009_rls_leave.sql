-- 3-bosqich: ruxsat so'rovlari. Qoida (CLAUDE.md §3a): faqat `tenant_id = app_tenant_id()`, OR yo'q. So'rov o'chirilmaydi — `cancelled`.
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY leave_requests_app ON leave_requests TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
REVOKE DELETE ON leave_requests FROM adone_app;

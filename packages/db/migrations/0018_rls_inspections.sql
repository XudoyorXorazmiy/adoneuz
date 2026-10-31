-- «Nazorat» tekshiruvlari. Qoida (CLAUDE.md §3a): faqat `tenant_id = app_tenant_id()`, OR yo'q. Append-only: UPDATE/DELETE yo'q.
ALTER TABLE inspections ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY inspections_app ON inspections TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
REVOKE UPDATE, DELETE ON inspections FROM adone_app;

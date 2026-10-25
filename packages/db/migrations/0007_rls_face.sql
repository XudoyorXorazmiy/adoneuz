-- 3-bosqich: yuz namunalari. Qoida (CLAUDE.md §3a): faqat `tenant_id = app_tenant_id()`, OR yo'q.
ALTER TABLE face_templates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY face_templates_app ON face_templates TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());

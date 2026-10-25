-- 4-bosqich: ish haqi. Qoida (CLAUDE.md §3a): faqat `tenant_id = app_tenant_id()`, OR yo'q. Davr o'chirilmaydi — `closed`.
ALTER TABLE pay_rules ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY pay_rules_app ON pay_rules TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
ALTER TABLE payroll_periods ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY payroll_periods_app ON payroll_periods TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
ALTER TABLE payroll_lines ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY payroll_lines_app ON payroll_lines TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
REVOKE DELETE ON pay_rules, payroll_periods FROM adone_app;

-- 2-bosqich (vazifalar) RLS. Qoida (CLAUDE.md §3a): faqat `tenant_id = app_tenant_id()`, OR yo'q.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['task_templates', 'task_batches', 'tasks', 'task_events', 'task_reports'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t || '_app', t);
  END LOOP;
END $$;--> statement-breakpoint

-- Jurnallar append-only (holat o'tishlari va hisobotlar o'zgartirilmaydi, o'chirilmaydi)
REVOKE UPDATE, DELETE ON task_events, task_reports FROM adone_app;--> statement-breakpoint
-- Vazifa o'chirilmaydi — `cancelled` ga o'tadi (§1.5)
REVOKE DELETE ON tasks, task_batches FROM adone_app;

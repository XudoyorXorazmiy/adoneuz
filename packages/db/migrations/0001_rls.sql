-- Row Level Security: tenant devori bazaning o'zida (openstore naqshi, docs: CLAUDE.md §1.1).
--   adone_app       — ilova ulanishi (LOGIN, NOBYPASSRLS). Tenant siyosati faqat `tenant_id = app_tenant_id()` — OR YO'Q.
--   adone_platform  — super admin va navbat ishchisi (`SET LOCAL ROLE`, scoped.ts withPlatform).
--   adone_auth      — login va urinishlar cheklovi (withAuth).
-- Ilova roli kontekst rollariga SET qila oladi, lekin ularning huquq va siyosatlarini MEROS OLMAYDI (INHERIT FALSE).
-- Sozlama yo'q → qator yo'q. Idempotent emas joylari (CREATE POLICY) faqat bir marta, migrator orqali.

CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adone_app') THEN
    CREATE ROLE adone_app LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adone_platform') THEN
    CREATE ROLE adone_platform NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'adone_auth') THEN
    CREATE ROLE adone_auth NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;--> statement-breakpoint
GRANT adone_platform TO adone_app WITH INHERIT FALSE, SET TRUE;--> statement-breakpoint
GRANT adone_auth TO adone_app WITH INHERIT FALSE, SET TRUE;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO adone_app, adone_platform, adone_auth;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app_tenant_id() TO adone_app, adone_platform, adone_auth;--> statement-breakpoint

-- Ilova roli: tenant jadvallarida DML. Keyingi migratsiyalardagi yangi jadvallar ham avtomatik oladi —
-- har yangi tenant jadvaliga RLS + `TO adone_app USING (tenant_id = app_tenant_id())` siyosati YOZILADI.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO adone_app;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO adone_app, adone_platform, adone_auth;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO adone_app;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO adone_app, adone_platform, adone_auth;--> statement-breakpoint

-- Platforma: faqat platforma jadvallari (ishxona ichidagi ma'lumotga huquq berilmaydi).
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, users, memberships, plans, subscriptions, jobs, auth_throttle TO adone_platform;--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO adone_platform;--> statement-breakpoint
-- Login: user + a'zolik + ishxona holati o'qiladi, xato urinishlar yoziladi.
GRANT SELECT, UPDATE ON users TO adone_auth;--> statement-breakpoint
GRANT SELECT ON memberships, tenants TO adone_auth;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_throttle TO adone_auth;--> statement-breakpoint
GRANT INSERT ON audit_log TO adone_auth;--> statement-breakpoint
-- Jurnal — append-only
REVOKE UPDATE, DELETE ON audit_log FROM adone_app;--> statement-breakpoint

-- ---- tenants ----
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY tenants_app ON tenants TO adone_app USING (id = app_tenant_id()) WITH CHECK (id = app_tenant_id());--> statement-breakpoint
CREATE POLICY tenants_platform ON tenants TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY tenants_auth ON tenants FOR SELECT TO adone_auth USING (true);--> statement-breakpoint

-- ---- users: ishxona faqat o'z a'zolarini ko'radi; yangi xodim qo'shishda user avval yaratiladi ----
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY users_app_read ON users FOR SELECT TO adone_app
  USING (EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id AND m.tenant_id = app_tenant_id()));--> statement-breakpoint
CREATE POLICY users_app_insert ON users FOR INSERT TO adone_app WITH CHECK (app_tenant_id() IS NOT NULL AND NOT is_platform_admin);--> statement-breakpoint
CREATE POLICY users_app_update ON users FOR UPDATE TO adone_app
  USING (EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = users.id AND m.tenant_id = app_tenant_id()))
  WITH CHECK (NOT is_platform_admin);--> statement-breakpoint
CREATE POLICY users_platform ON users TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY users_auth_read ON users FOR SELECT TO adone_auth USING (true);--> statement-breakpoint
CREATE POLICY users_auth_update ON users FOR UPDATE TO adone_auth USING (true) WITH CHECK (true);--> statement-breakpoint

-- ---- memberships ----
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY memberships_app ON memberships TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
CREATE POLICY memberships_platform ON memberships TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY memberships_auth ON memberships FOR SELECT TO adone_auth USING (true);--> statement-breakpoint

-- ---- plans: hamma o'qiydi, faqat platforma yozadi ----
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY plans_app ON plans FOR SELECT TO adone_app USING (true);--> statement-breakpoint
CREATE POLICY plans_platform ON plans TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON plans FROM adone_app;--> statement-breakpoint

-- ---- subscriptions: ishxona o'zinikini o'qiydi, o'zgartirish — platforma (to'lov) ----
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY subscriptions_app ON subscriptions FOR SELECT TO adone_app USING (tenant_id = app_tenant_id());--> statement-breakpoint
CREATE POLICY subscriptions_platform ON subscriptions TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
REVOKE INSERT, UPDATE, DELETE ON subscriptions FROM adone_app;--> statement-breakpoint

-- ---- jobs: ishxona o'z ishini navbatga qo'yadi; ishchi platforma rolida oladi ----
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY jobs_app ON jobs TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
CREATE POLICY jobs_platform ON jobs TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint

-- ---- auth_throttle: faqat login va platforma ----
ALTER TABLE auth_throttle ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY auth_throttle_auth ON auth_throttle TO adone_auth USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY auth_throttle_platform ON auth_throttle TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
REVOKE ALL ON auth_throttle FROM adone_app;--> statement-breakpoint

-- ---- audit_log ----
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY audit_log_app ON audit_log TO adone_app USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id());--> statement-breakpoint
CREATE POLICY audit_log_platform ON audit_log TO adone_platform USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY audit_log_auth ON audit_log FOR INSERT TO adone_auth WITH CHECK (true);

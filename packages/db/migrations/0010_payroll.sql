CREATE TYPE "public"."payroll_status" AS ENUM('draft', 'closed');--> statement-breakpoint
CREATE TABLE "pay_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"pay_type" "pay_type" NOT NULL,
	"rate" bigint DEFAULT 0 NOT NULL,
	"base" bigint DEFAULT 0 NOT NULL,
	"penalty_total" bigint DEFAULT 0 NOT NULL,
	"bonus_total" bigint DEFAULT 0 NOT NULL,
	"adjustment" bigint DEFAULT 0 NOT NULL,
	"adjustment_reason" text,
	"total" bigint DEFAULT 0 NOT NULL,
	"breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"month" text NOT NULL,
	"status" "payroll_status" DEFAULT 'draft' NOT NULL,
	"rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"closed_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pay_rules" ADD CONSTRAINT "pay_rules_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_rules" ADD CONSTRAINT "pay_rules_updated_by_user_id_users_id_fk" FOREIGN KEY ("updated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_period_id_payroll_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."payroll_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_lines" ADD CONSTRAINT "payroll_lines_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_closed_by_user_id_users_id_fk" FOREIGN KEY ("closed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_rules_tenant_uq" ON "pay_rules" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_lines_uq" ON "payroll_lines" USING btree ("tenant_id","period_id","employee_id");--> statement-breakpoint
CREATE INDEX "payroll_lines_emp_idx" ON "payroll_lines" USING btree ("tenant_id","employee_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_periods_uq" ON "payroll_periods" USING btree ("tenant_id","month");
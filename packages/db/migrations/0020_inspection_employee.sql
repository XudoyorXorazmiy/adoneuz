-- Xodim tekshiruvi (2026-10-31): inspections.employee_id; bo'lim endi shart emas (bo'limsiz xodim).
ALTER TABLE "inspections" ALTER COLUMN "department_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "employee_id" uuid;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inspections_emp_idx" ON "inspections" USING btree ("tenant_id","employee_id","at");

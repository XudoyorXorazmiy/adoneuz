CREATE TABLE "face_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"embedding" real[] NOT NULL,
	"quality" jsonb,
	"media_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "device_id" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "device_label" text;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "device_bound_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "face_templates" ADD CONSTRAINT "face_templates_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_templates" ADD CONSTRAINT "face_templates_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "face_templates" ADD CONSTRAINT "face_templates_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "face_templates_emp_idx" ON "face_templates" USING btree ("tenant_id","employee_id");
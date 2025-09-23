CREATE TABLE "tenant_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"token" text NOT NULL,
	"invited_by" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_invites_role_check" CHECK ("tenant_invites"."role" in ('tenant-admin', 'operator', 'super-admin')),
	CONSTRAINT "tenant_invites_status_check" CHECK ("tenant_invites"."status" in ('pending', 'accepted', 'expired', 'cancelled'))
);
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "tenant_invites" ADD CONSTRAINT "tenant_invites_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
CREATE UNIQUE INDEX "tenant_invites_tenant_email_idx" ON "tenant_invites" USING btree ("tenant_id","email");
ALTER TABLE tenant_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invites FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON tenant_invites;
CREATE POLICY tenant_isolation ON tenant_invites
  USING (tenant_id = current_setting('app.tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id')::uuid);

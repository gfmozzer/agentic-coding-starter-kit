-- Seed data for local development. Execute with:
--   psql "$POSTGRES_URL" -f drizzle/seeds/tenant_demo.sql

INSERT INTO tenants (id, name, slug, settings)
VALUES (
  gen_random_uuid(),
  'Demo Tenant',
  'demo-tenant',
  '{}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- Assign an operator (replace the email with an existing user record).
INSERT INTO tenant_members (id, tenant_id, user_id, role)
SELECT
  gen_random_uuid(),
  t.id,
  u.id,
  'operator'
FROM tenants t
JOIN "user" u ON u.email = 'operator@example.com'
WHERE t.slug = 'demo-tenant'
ON CONFLICT (tenant_id, user_id) DO NOTHING;
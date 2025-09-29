ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS webhook_auth_header text;

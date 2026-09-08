ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_reply text;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_replied_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_replied_by uuid REFERENCES users(id) ON DELETE SET NULL;

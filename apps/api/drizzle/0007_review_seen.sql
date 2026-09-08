ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_seen_at timestamptz;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_seen_by uuid REFERENCES users(id) ON DELETE SET NULL;

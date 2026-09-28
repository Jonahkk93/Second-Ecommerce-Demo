ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_by uuid;
ALTER TABLE users ADD COLUMN IF NOT EXISTS block_reason text;
CREATE INDEX IF NOT EXISTS users_blocked_at_idx ON users(blocked_at);

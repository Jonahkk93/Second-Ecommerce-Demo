CREATE TABLE IF NOT EXISTS privacy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('access','correction','deletion','objection')),
  details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_review','closed')),
  response text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS privacy_requests_user_idx ON privacy_requests(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS privacy_requests_one_open_kind ON privacy_requests(user_id,kind) WHERE status <> 'closed';

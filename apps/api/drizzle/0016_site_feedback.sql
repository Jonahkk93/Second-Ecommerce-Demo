CREATE TABLE IF NOT EXISTS site_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('finding','details','ordering','other','bug')),
  problem text NOT NULL,
  description text NOT NULL CHECK (char_length(trim(description)) BETWEEN 1 AND 500),
  rating integer CHECK (rating BETWEEN 1 AND 5),
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS site_feedback_reference_unique ON site_feedback(reference);
CREATE INDEX IF NOT EXISTS site_feedback_created_idx ON site_feedback(created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_methods jsonb NOT NULL DEFAULT '[]';
ALTER TABLE users ADD COLUMN IF NOT EXISTS legacy_data jsonb NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique ON users(firebase_uid) WHERE firebase_uid IS NOT NULL;

ALTER TABLE orders ALTER COLUMN quote_id DROP NOT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS legacy_id text;
CREATE UNIQUE INDEX IF NOT EXISTS orders_legacy_unique ON orders(legacy_id) WHERE legacy_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS carts (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,items jsonb NOT NULL DEFAULT '[]',updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS favorites (user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,items jsonb NOT NULL DEFAULT '[]',updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),legacy_id text,user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,customer_name text NOT NULL,rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5),text text NOT NULL,purchased_options jsonb NOT NULL DEFAULT '{}',attachment jsonb,verified_purchase boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(user_id,product_id));
CREATE UNIQUE INDEX IF NOT EXISTS reviews_legacy_unique ON reviews(legacy_id) WHERE legacy_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews(product_id);
CREATE TABLE IF NOT EXISTS storefront_settings (key text PRIMARY KEY,value jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now());
INSERT INTO storefront_settings(key,value) VALUES ('popular','{"products":[],"windowDays":30}') ON CONFLICT (key) DO NOTHING;

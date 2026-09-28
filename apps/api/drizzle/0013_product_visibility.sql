DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'products'
          AND column_name = 'visibility'
    ) THEN
        ALTER TABLE products
        ADD COLUMN visibility text NOT NULL DEFAULT 'active';

        UPDATE products
        SET visibility = CASE WHEN active THEN 'active' ELSE 'draft' END;
    END IF;
END $$;

ALTER TABLE products
DROP CONSTRAINT IF EXISTS products_visibility_check;

ALTER TABLE products
ADD CONSTRAINT products_visibility_check
CHECK (visibility IN ('active', 'hidden', 'draft'));

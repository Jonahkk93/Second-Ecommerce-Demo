DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'local_password_set'
  ) THEN
    ALTER TABLE users
      ADD COLUMN local_password_set boolean NOT NULL DEFAULT true;

    UPDATE users
    SET local_password_set = false
    WHERE firebase_uid IS NOT NULL;
  END IF;
END $$;

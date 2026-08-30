ALTER TABLE payments ALTER COLUMN provider SET DEFAULT 'pesapal';

UPDATE payments
SET provider = 'pesapal',
    provider_reference = NULL,
    transaction_id = NULL,
    checkout_url = NULL,
    metadata = '{}'::jsonb,
    updated_at = now()
WHERE provider = 'flutterwave' AND status = 'pending';

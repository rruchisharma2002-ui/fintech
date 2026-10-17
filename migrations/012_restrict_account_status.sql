DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'accounts'::regclass
          AND conname = 'accounts_status_check'
    ) THEN
        ALTER TABLE accounts
        ADD CONSTRAINT accounts_status_check
        CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED'));
    END IF;
END
$$;
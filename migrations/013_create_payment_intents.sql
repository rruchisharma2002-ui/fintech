
-- Up Migration

CREATE TABLE payment_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    account_id UUID NOT NULL
        REFERENCES accounts(id)
        ON DELETE RESTRICT,

    idempotency_key VARCHAR(255) NOT NULL,

    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),

    currency VARCHAR(3) NOT NULL
        CHECK (currency = 'INR'),

    provider_order_id VARCHAR(255) UNIQUE,

    provider_payment_id VARCHAR(255) UNIQUE,

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'FAILED')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, idempotency_key)
);

CREATE INDEX payment_intents_account_id_idx
    ON payment_intents(account_id);

CREATE INDEX payment_intents_status_idx
    ON payment_intents(status);


-- Down Migration

DROP TABLE payment_intents;

-- Up Migration

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    type VARCHAR(20) NOT NULL
        CHECK (type IN ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),

    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED')),

    amount NUMERIC(20, 2) NOT NULL
        CHECK (amount > 0),

    currency VARCHAR(3) NOT NULL,

    reference VARCHAR(100) UNIQUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
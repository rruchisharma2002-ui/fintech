-- Up Migration

CREATE TABLE idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id)
        ON DELETE RESTRICT,

    key VARCHAR(255) NOT NULL,

    request_hash VARCHAR(64) NOT NULL,

    status VARCHAR(20) NOT NULL
        CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),

    response JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (user_id, key)
);
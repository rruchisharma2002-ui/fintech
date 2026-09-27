-- Up Migration

ALTER TABLE refresh_tokens
ADD COLUMN token_family_id UUID;

UPDATE refresh_tokens
SET token_family_id = gen_random_uuid()
WHERE token_family_id IS NULL;

ALTER TABLE refresh_tokens
ALTER COLUMN token_family_id SET NOT NULL;
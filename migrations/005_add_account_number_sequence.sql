-- Up Migration

CREATE SEQUENCE account_number_seq
    START WITH 100000000001;

ALTER TABLE accounts
ALTER COLUMN account_number
SET DEFAULT nextval('account_number_seq')::text;
ALTER TABLE accounts
ADD CONSTRAINT accounts_currency_check
CHECK (currency IN ('INR', 'USD'));
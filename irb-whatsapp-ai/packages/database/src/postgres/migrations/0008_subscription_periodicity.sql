-- Persist the selected billing periodicity and amount on subscriptions
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20),
  ADD COLUMN IF NOT EXISTS plan_price_cents INTEGER;

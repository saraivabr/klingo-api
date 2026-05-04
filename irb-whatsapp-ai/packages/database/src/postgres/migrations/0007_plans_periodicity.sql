-- Add semestral and annual pricing to plans table
ALTER TABLE plans
  ADD COLUMN IF NOT EXISTS price_semestral_cents INTEGER,
  ADD COLUMN IF NOT EXISTS price_annual_cents INTEGER;

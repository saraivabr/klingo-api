-- Allow storing multiple IGS product IDs as JSON array
ALTER TABLE subscriptions ALTER COLUMN igs_product_id TYPE text;

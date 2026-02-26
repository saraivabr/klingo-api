ALTER TABLE "appointments" ADD COLUMN "klingo_sync_status" varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "klingo_sync_error" text;--> statement-breakpoint
ALTER TABLE "appointments" ADD COLUMN "klingo_sync_attempts" integer DEFAULT 0;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "doctors" ADD COLUMN "klingo_id" integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

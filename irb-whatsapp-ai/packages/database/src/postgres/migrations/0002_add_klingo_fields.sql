ALTER TABLE "patients" ADD COLUMN "klingo_patient_id" integer;
CREATE INDEX "patients_klingo_patient_id_idx" ON "patients" ("klingo_patient_id");

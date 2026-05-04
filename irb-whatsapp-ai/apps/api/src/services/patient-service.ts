import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';

export async function getPatientById(id: string) {
  const [patient] = await db.select()
    .from(schema.patients)
    .where(eq(schema.patients.id, id))
    .limit(1);
  return patient || null;
}

export async function getPatientPhone(patientId: string): Promise<string | null> {
  const [patient] = await db.select({ phone: schema.patients.phone })
    .from(schema.patients)
    .where(eq(schema.patients.id, patientId))
    .limit(1);
  return patient?.phone || null;
}

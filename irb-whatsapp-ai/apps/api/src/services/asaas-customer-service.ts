import { db, schema } from '@irb/database';
import { eq } from 'drizzle-orm';
import { getAsaasClient } from './asaas.js';

/**
 * Get or create an Asaas customer for a patient.
 * Checks local DB first, then Asaas API by CPF, then creates new.
 */
export async function getOrCreateAsaasCustomer(
  patientId: string,
  cpf: string,
  opts?: { email?: string; name?: string; phone?: string },
) {
  // Check local DB
  let asaasCustomer = await db.select()
    .from(schema.asaasCustomers)
    .where(eq(schema.asaasCustomers.patientId, patientId))
    .limit(1)
    .then(rows => rows[0]);

  if (asaasCustomer) return asaasCustomer;

  const asaas = getAsaasClient();
  if (!asaas) throw new Error('Asaas não configurado');

  // Try to find existing customer by CPF
  let remote = await asaas.findCustomerByCpf(cpf);
  if (!remote) {
    remote = await asaas.createCustomer({
      name: opts?.name || 'Paciente',
      cpfCnpj: cpf,
      email: opts?.email,
      mobilePhone: opts?.phone,
    });
  }

  // Save locally
  [asaasCustomer] = await db.insert(schema.asaasCustomers).values({
    patientId,
    asaasId: remote.id,
    cpf,
    email: opts?.email,
  }).returning();

  return asaasCustomer;
}

/**
 * Get existing Asaas customer ID for a patient, or null.
 */
export async function getAsaasCustomerId(patientId: string): Promise<string | null> {
  const [row] = await db.select({ asaasId: schema.asaasCustomers.asaasId })
    .from(schema.asaasCustomers)
    .where(eq(schema.asaasCustomers.patientId, patientId))
    .limit(1);
  return row?.asaasId || null;
}

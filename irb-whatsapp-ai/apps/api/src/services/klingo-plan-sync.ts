import { schema } from '@irb/database';
import { getKlingoExternalClient } from './klingo-external-client.js';

type PatientRow = typeof schema.patients.$inferSelect;
type PlanRow = typeof schema.plans.$inferSelect;

export async function syncPatientPlanToKlingo(patient: PatientRow, plan: PlanRow) {
  if (!patient.klingoPatientId) {
    throw new Error('Paciente sem vínculo na Klingo');
  }

  if (!plan.klingoPlanId) {
    throw new Error('Plano sem código Klingo configurado');
  }

  const klingo = getKlingoExternalClient();
  if (!klingo) {
    throw new Error('Klingo não configurado');
  }

  await klingo.syncPatientPlan({
    id_paciente: patient.klingoPatientId,
    id_plano: plan.klingoPlanId,
  });
}

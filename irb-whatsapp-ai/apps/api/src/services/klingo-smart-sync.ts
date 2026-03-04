import { db, schema } from '@irb/database';
import { getKlingoExternalClient } from './klingo-external-client.js';
import { eq, and } from 'drizzle-orm';

interface SmartSyncResult {
  success: boolean;
  timestamp: string;
  specialties: { synced: number; failed: number };
  doctors: { synced: number; failed: number };
  patients: { synced: number; failed: number };
  services: { synced: number; failed: number };
  appointments: { synced: number; failed: number };
  error?: string;
}

/**
 * Smart Sync - Efficient approach without rate limiting issues
 * 1. Sync all specialties (single API call)
 * 2. Sync TODAY's appointments only (single API call)
 * 3. Extract and sync doctors, patients, services from today's appointments
 */
export async function smartSyncKlingoData(): Promise<SmartSyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('[klingo-smart-sync] ========== SMART SYNC START ==========');

  const result: SmartSyncResult = {
    success: false,
    timestamp,
    specialties: { synced: 0, failed: 0 },
    doctors: { synced: 0, failed: 0 },
    patients: { synced: 0, failed: 0 },
    services: { synced: 0, failed: 0 },
    appointments: { synced: 0, failed: 0 },
  };

  try {
    const client = getKlingoExternalClient();
    if (!client) {
      throw new Error('Klingo API token not configured');
    }

    // Health check
    const health = await client.healthCheck();
    if (!health) {
      throw new Error('Klingo API is offline');
    }
    console.log('[klingo-smart-sync] ✓ Klingo API is online');

    // 1. Sync Specialties (single API call)
    console.log('[klingo-smart-sync] Syncing specialties...');
    try {
      const specialtiesResponse = await client.getSpecialties();
      if (specialtiesResponse.success && specialtiesResponse.data) {
        const specs = Array.isArray(specialtiesResponse.data)
          ? specialtiesResponse.data
          : [specialtiesResponse.data];

        console.log(`[klingo-smart-sync] Found ${specs.length} specialties`);
        // We don't have a specialties table, they're embedded in doctors
        result.specialties.synced = specs.length;
      }
    } catch (err) {
      console.error('[klingo-smart-sync] Specialties sync failed:', (err as Error).message);
      result.specialties.failed = 1;
    }

    // 2. Sync TODAY's appointments (single API call)
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // BRT = UTC-3
    const todayStr = brtNow.toISOString().split('T')[0];

    console.log(`[klingo-smart-sync] Syncing appointments for ${todayStr}...`);
    const response: any = await client.listForConfirmation(todayStr, { links: false });

    // The telefonia/lista endpoint returns a direct array OR {success, data}
    let appointments: any[] = [];
    
    if (Array.isArray(response)) {
      // Direct array (telefonia returns this)
      appointments = response;
    } else if (response.success && Array.isArray(response.data)) {
      // Wrapped response {success, data}
      appointments = response.data;
    } else if (response.data) {
      // Single item wrapped
      appointments = [response.data];
    }

    if (appointments.length === 0) {
      console.warn('[klingo-smart-sync] No appointments found for today');
      result.success = true;
      return result;
    }

    console.log(`[klingo-smart-sync] Found ${appointments.length} appointments for today`);

    // 3. Extract unique entities
    const doctorsMap = new Map<number, { id: number; name: string; specialty: string }>();
    const servicesMap = new Map<number, { id: number; name: string }>();

    for (const apt of appointments) {
      // Doctors
      if (apt.medico_id && apt.medico) {
        doctorsMap.set(apt.medico_id, {
          id: apt.medico_id,
          name: apt.medico,
          specialty: apt.especialidade || 'Geral',
        });
      }

      // Services
      if (apt.procedimento_id && apt.procedimento) {
        servicesMap.set(apt.procedimento_id, {
          id: apt.procedimento_id,
          name: apt.procedimento,
        });
      }
    }

    console.log(`[klingo-smart-sync] Extracted: ${doctorsMap.size} doctors, ${servicesMap.size} services`);

    // 4. Sync Doctors
    for (const [klingoId, doctor] of doctorsMap) {
      try {
        const [existing] = await db
          .select()
          .from(schema.doctors)
          .where(eq(schema.doctors.klingoId, klingoId))
          .limit(1);

        if (existing) {
          await db
            .update(schema.doctors)
            .set({
              name: doctor.name,
              specialty: doctor.specialty,
            })
            .where(eq(schema.doctors.klingoId, klingoId));
        } else {
          await db.insert(schema.doctors).values({
            klingoId,
            name: doctor.name,
            specialty: doctor.specialty,
            isActive: true,
          });
        }
        result.doctors.synced++;
      } catch (err) {
        console.error(`[klingo-smart-sync] Failed to sync doctor ${klingoId}:`, (err as Error).message);
        result.doctors.failed++;
      }
    }

    // 5. Sync Services
    for (const [klingoId, service] of servicesMap) {
      try {
        const [existing] = await db
          .select()
          .from(schema.services)
          .where(eq(schema.services.name, service.name))
          .limit(1);

        if (!existing) {
          await db.insert(schema.services).values({
            name: service.name,
            category: 'consulta',
            isActive: true,
          });
          result.services.synced++;
        }
      } catch (err) {
        console.error(`[klingo-smart-sync] Failed to sync service ${klingoId}:`, (err as Error).message);
        result.services.failed++;
      }
    }

    // 6. Sync Patients and Appointments
    for (const apt of appointments) {
      try {
        // Normalize phone
        let phone = apt.celular || apt.telefone;
        if (!phone || phone.length < 10) {
          console.warn(`[klingo-smart-sync] Skipping appointment ${apt.id_marcacao} - invalid phone`);
          result.appointments.failed++;
          continue;
        }
        phone = phone.replace(/\D/g, '');
        const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;

        // Upsert patient
        const [existingPatient] = await db
          .select()
          .from(schema.patients)
          .where(eq(schema.patients.phone, normalizedPhone))
          .limit(1);

        let patientId: string;
        if (existingPatient) {
          patientId = existingPatient.id;
          // Update patient data
          await db
            .update(schema.patients)
            .set({
              name: apt.nome || existingPatient.name,
              birthDate: apt.nascimento ? apt.nascimento.split(' ')[0] : existingPatient.birthDate,
            })
            .where(eq(schema.patients.id, existingPatient.id));
        } else {
          const [newPatient] = await db
            .insert(schema.patients)
            .values({
              phone: normalizedPhone,
              name: apt.nome || 'Paciente',
              birthDate: apt.nascimento ? apt.nascimento.split(' ')[0] : null,
              source: 'klingo',
            })
            .returning();
          if (!newPatient) {
            throw new Error('Failed to create patient');
          }
          patientId = newPatient.id;
          result.patients.synced++;
        }

        // Find doctor
        let doctorId: string | undefined;
        if (apt.medico_id) {
          const [doctor] = await db
            .select()
            .from(schema.doctors)
            .where(eq(schema.doctors.klingoId, apt.medico_id))
            .limit(1);
          if (doctor) doctorId = doctor.id;
        }

        // Find service
        let serviceId: string | undefined;
        if (apt.procedimento) {
          const [service] = await db
            .select()
            .from(schema.services)
            .where(eq(schema.services.name, apt.procedimento))
            .limit(1);
          if (service) serviceId = service.id;
        }

        // Parse appointment date/time
        const scheduledAt = new Date(`${apt.data}T${apt.hora}:00`);

        // Map status
        const statusMap: Record<string, string> = {
          'Confirmado': 'confirmed',
          'Pendente': 'scheduled',
          'Não Confirmado': 'scheduled',
          'Cancelado': 'cancelled',
          'Remarcado': 'cancelled',
          'A': 'scheduled',
        };
        const appointmentStatus = statusMap[apt.status_confirmacao] || statusMap[apt.status] || 'scheduled';

        // Upsert appointment
        const [existing] = await db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.klingoVoucherId, apt.id_marcacao))
          .limit(1);

        if (existing) {
          await db
            .update(schema.appointments)
            .set({
              patientId,
              doctorId: doctorId || existing.doctorId,
              serviceId: serviceId || existing.serviceId,
              status: appointmentStatus,
              scheduledAt,
              notes: apt.obs_confirmacao || existing.notes,
              klingoSyncStatus: 'synced',
            })
            .where(eq(schema.appointments.klingoVoucherId, apt.id_marcacao));
        } else {
          await db.insert(schema.appointments).values({
            patientId,
            doctorId,
            serviceId,
            status: appointmentStatus,
            scheduledAt,
            notes: apt.obs_confirmacao,
            klingoVoucherId: apt.id_marcacao,
            klingoReservationId: apt.codigo_reserva,
            klingoSyncStatus: 'synced',
            createdBy: 'klingo_smart_sync',
          });
        }

        result.appointments.synced++;

        // Create OPD visit if confirmed
        if (appointmentStatus === 'confirmed' && doctorId) {
          try {
            const [existingVisit] = await db
              .select()
              .from(schema.opdVisits)
              .where(
                and(
                  eq(schema.opdVisits.patientId, patientId),
                  eq(schema.opdVisits.visitDate, apt.data)
                )
              )
              .limit(1);

            if (!existingVisit) {
              const [visit] = await db
                .insert(schema.opdVisits)
                .values({
                  patientId,
                  doctorId,
                  visitDate: apt.data,
                  status: 'waiting',
                  symptoms: apt.instrucao,
                })
                .returning();

              if (visit) {
                await db.insert(schema.opdTimelines).values({
                  opdVisitId: visit.id,
                  title: 'Agendamento confirmado',
                  description: `Paciente confirmado para ${apt.procedimento} com ${apt.medico}`,
                  date: new Date(),
                  createdBy: 'klingo_smart_sync',
                });
              }
            }
          } catch (err) {
            console.warn(`[klingo-smart-sync] Failed to create OPD visit:`, (err as Error).message);
          }
        }
      } catch (err) {
        console.error(`[klingo-smart-sync] Failed to sync appointment ${apt.id_marcacao}:`, (err as Error).message);
        result.appointments.failed++;
      }
    }

    const duration = Date.now() - startTime;
    result.success = true;

    console.log('[klingo-smart-sync] ========== SMART SYNC COMPLETE ==========');
    console.log(`[klingo-smart-sync] Duration: ${duration}ms`);
    console.log(`[klingo-smart-sync] Specialties: ${result.specialties.synced} discovered`);
    console.log(`[klingo-smart-sync] Doctors: ${result.doctors.synced} synced, ${result.doctors.failed} failed`);
    console.log(`[klingo-smart-sync] Patients: ${result.patients.synced} created`);
    console.log(`[klingo-smart-sync] Services: ${result.services.synced} synced, ${result.services.failed} failed`);
    console.log(`[klingo-smart-sync] Appointments: ${result.appointments.synced} synced, ${result.appointments.failed} failed`);

    return result;
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error('[klingo-smart-sync] ========== SMART SYNC FAILED ==========', errorMsg);
    result.error = errorMsg;
    return result;
  }
}

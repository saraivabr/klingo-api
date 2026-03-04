import { db, schema } from '@irb/database';
import { getKlingoExternalClient } from './klingo-external-client.js';
import { eq, and, or, gte, lte } from 'drizzle-orm';

interface ComprehensiveSyncResult {
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
 * Comprehensive sync - pulls ALL data from Klingo
 * Uses telefonia/lista endpoint with date range to get full appointment history
 */
export async function syncAllKlingoData(): Promise<ComprehensiveSyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('[klingo-full-sync] ========== COMPREHENSIVE SYNC START ==========');

  const result: ComprehensiveSyncResult = {
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
    console.log('[klingo-full-sync] ✓ Klingo API is online');

    // Date range: last 7 days + next 30 days
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // BRT = UTC-3
    
    const startDate = new Date(brtNow);
    startDate.setDate(startDate.getDate() - 7);
    
    const endDate = new Date(brtNow);
    endDate.setDate(endDate.getDate() + 30);

    console.log(`[klingo-full-sync] Fetching appointments from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Collect all appointments across date range
    // Add delay to avoid rate limiting (429)
    const allAppointments: any[] = [];
    const currentDate = new Date(startDate);
    let requestCount = 0;

    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      try {
        const response = await client.listForConfirmation(dateStr, { links: false });
        if (response.success && response.data) {
          const apts = Array.isArray(response.data) ? response.data : [response.data];
          allAppointments.push(...apts);
          console.log(`[klingo-full-sync] Found ${apts.length} appointments for ${dateStr}`);
        }
        requestCount++;
        
        // Add 500ms delay after every request to respect rate limits
        if (requestCount % 1 === 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        console.warn(`[klingo-full-sync] Failed to fetch ${dateStr}:`, (err as Error).message);
        // On rate limit error, wait longer
        if ((err as Error).message.includes('429')) {
          console.log(`[klingo-full-sync] Rate limited, waiting 3 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[klingo-full-sync] Total appointments collected: ${allAppointments.length}`);

    // Extract unique entities
    const specialtiesMap = new Map<string, { id: number; name: string }>();
    const doctorsMap = new Map<number, { id: number; name: string; specialty: string; crm?: string }>();
    const servicesMap = new Map<number, { id: number; name: string }>();

    for (const apt of allAppointments) {
      // Specialties
      if (apt.especialidade_id && apt.especialidade) {
        specialtiesMap.set(apt.especialidade, {
          id: apt.especialidade_id,
          name: apt.especialidade,
        });
      }

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

    console.log(`[klingo-full-sync] Extracted: ${specialtiesMap.size} specialties, ${doctorsMap.size} doctors, ${servicesMap.size} services`);

    // Sync Doctors (with specialties embedded)
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
        console.error(`[klingo-full-sync] Failed to sync doctor ${klingoId}:`, (err as Error).message);
        result.doctors.failed++;
      }
    }

    // Sync Services
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
            category: 'consulta', // Default category
            isActive: true,
          });
          result.services.synced++;
        }
      } catch (err) {
        console.error(`[klingo-full-sync] Failed to sync service ${klingoId}:`, (err as Error).message);
        result.services.failed++;
      }
    }

    // Sync Patients and Appointments
    for (const apt of allAppointments) {
      try {
        // Normalize phone
        let phone = apt.celular || apt.telefone;
        if (!phone || phone.length < 10) {
          console.warn(`[klingo-full-sync] Skipping appointment ${apt.id_marcacao} - invalid phone`);
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
          // Update patient data with latest from Klingo
          await db
            .update(schema.patients)
            .set({
              name: apt.nome || existingPatient.name,
              birthDate: apt.nascimento ? apt.nascimento.split(' ')[0] : existingPatient.birthDate,
              klingoPatientId: apt.id_paciente && !apt.id_paciente.toString().startsWith('TMP:')
                ? parseInt(apt.id_paciente.toString().replace('TMP:', ''))
                : existingPatient.klingoPatientId,
            })
            .where(eq(schema.patients.id, existingPatient.id));
        } else {
          const [newPatient] = await db
            .insert(schema.patients)
            .values({
              phone: normalizedPhone,
              name: apt.nome || 'Paciente',
              birthDate: apt.nascimento ? apt.nascimento.split(' ')[0] : null,
              klingoPatientId: apt.id_paciente && !apt.id_paciente.toString().startsWith('TMP:')
                ? parseInt(apt.id_paciente.toString().replace('TMP:', ''))
                : null,
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
          'A': 'scheduled', // Active
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
            createdBy: 'klingo_full_sync',
          });
        }

        result.appointments.synced++;

        // Create OPD visit if confirmed and for today/past
        if (appointmentStatus === 'confirmed' && doctorId && scheduledAt <= new Date()) {
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
                  createdBy: 'klingo_full_sync',
                });
              }
            }
          } catch (err) {
            console.warn(`[klingo-full-sync] Failed to create OPD visit:`, (err as Error).message);
          }
        }
      } catch (err) {
        console.error(`[klingo-full-sync] Failed to sync appointment ${apt.id_marcacao}:`, (err as Error).message);
        result.appointments.failed++;
      }
    }

    // Specialty count (we didn't create a table for them, they're embedded in doctors)
    result.specialties.synced = specialtiesMap.size;

    const duration = Date.now() - startTime;
    result.success = true;

    console.log('[klingo-full-sync] ========== COMPREHENSIVE SYNC COMPLETE ==========');
    console.log(`[klingo-full-sync] Duration: ${duration}ms`);
    console.log(`[klingo-full-sync] Doctors: ${result.doctors.synced} synced, ${result.doctors.failed} failed`);
    console.log(`[klingo-full-sync] Patients: ${result.patients.synced} created`);
    console.log(`[klingo-full-sync] Services: ${result.services.synced} synced, ${result.services.failed} failed`);
    console.log(`[klingo-full-sync] Appointments: ${result.appointments.synced} synced, ${result.appointments.failed} failed`);

    return result;
  } catch (err) {
    const errorMsg = (err as Error).message;
    console.error('[klingo-full-sync] ========== COMPREHENSIVE SYNC FAILED ==========', errorMsg);
    result.error = errorMsg;
    return result;
  }
}

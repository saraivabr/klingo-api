import { db, schema } from '@irb/database';
import { getKlingoExternalClient } from './klingo-external-client.js';
import { eq, or, and } from 'drizzle-orm';

interface SyncResult {
  success: boolean;
  timestamp: string;
  doctorsSync?: {
    synced: number;
    failed: number;
  };
  appointmentsSync?: {
    synced: number;
    failed: number;
    patientsCreated: number;
  };
  error?: string;
}

interface SyncStatus {
  lastSyncAt: string | null;
  lastSyncSuccess: boolean;
  lastError: string | null;
  itemsSyncedToday: number;
}

// In-memory sync status tracking
let syncStatus: SyncStatus = {
  lastSyncAt: null,
  lastSyncSuccess: false,
  lastError: null,
  itemsSyncedToday: 0,
};

/**
 * Sync doctors from Klingo to PostgreSQL
 */
export async function syncDoctors(): Promise<{
  synced: number;
  failed: number;
}> {
  const client = getKlingoExternalClient();
  if (!client) {
    throw new Error('Klingo client not configured');
  }

  console.log('[klingo-sync] Starting doctor sync...');
  let synced = 0;
  let failed = 0;

  try {
    let professionals: Array<{ id: number; nome: string; especialidade?: string; crm?: string }> = [];

    try {
      const response = await client.getProfessionals();
      if (response.success && response.data) {
        professionals = Array.isArray(response.data)
          ? response.data
          : [response.data];
      }
    } catch (err) {
      console.warn('[klingo-sync] getProfessionals fallback engaged:', (err as Error).message);
    }

    if (professionals.length === 0) {
      const now = new Date();
      const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const todayStr = brtNow.toISOString().split('T')[0];
      const response: any = await client.listForConfirmation(todayStr, { links: false });
      const appointments = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : response?.data
            ? [response.data]
            : [];

      const byName = new Map<string, { id: number; nome: string; especialidade?: string; crm?: string }>();
      for (const apt of appointments) {
        const doctorName = apt.profissional || apt.medico;
        if (!doctorName) continue;
        const doctorId = Number(apt.medico_id);
        if (!Number.isFinite(doctorId) || doctorId <= 0) continue;
        const key = `${doctorId}:${doctorName}`;
        if (!byName.has(key)) {
          byName.set(key, {
            id: doctorId,
            nome: doctorName,
            especialidade: apt.especialidade || 'Geral',
            crm: apt.crm_medico || apt.crm,
          });
        }
      }

      professionals = [...byName.values()];
    }

    if (professionals.length === 0) {
      throw new Error('Failed to fetch professionals from Klingo');
    }

    for (const prof of professionals) {
      try {
        // Check if doctor already exists by klingoId
        const [existing] = await db
          .select()
          .from(schema.doctors)
          .where(eq(schema.doctors.klingoId, prof.id))
          .limit(1);

        if (existing) {
          // Update existing doctor
          await db
            .update(schema.doctors)
            .set({
              name: prof.nome,
              specialty: prof.especialidade,
              crm: prof.crm,
            })
            .where(eq(schema.doctors.klingoId, prof.id));

          console.log(`[klingo-sync] Updated doctor: ${prof.nome}`);
          synced++;
        } else {
          // Insert new doctor
          await db.insert(schema.doctors).values({
            klingoId: prof.id,
            name: prof.nome,
            specialty: prof.especialidade,
            crm: prof.crm,
          });

          console.log(`[klingo-sync] Created doctor: ${prof.nome}`);
          synced++;
        }
      } catch (err) {
        console.error(
          `[klingo-sync] Failed to sync doctor ${prof.id}:`,
          (err as Error).message
        );
        failed++;
      }
    }

    console.log(
      `[klingo-sync] Doctor sync completed: ${synced} synced, ${failed} failed`
    );
    return { synced, failed };
  } catch (err) {
    console.error('[klingo-sync] Doctor sync error:', (err as Error).message);
    throw err;
  }
}

/**
 * Sync today's appointments from Klingo telefonica API
 */
export async function syncTodayAppointments(): Promise<{
  synced: number;
  failed: number;
  patientsCreated: number;
}> {
  const client = getKlingoExternalClient();
  if (!client) {
    throw new Error('Klingo client not configured');
  }

  console.log('[klingo-sync] Starting today appointments sync...');

  let synced = 0;
  let failed = 0;
  let patientsCreated = 0;

  try {
    // Get today's date in YYYY-MM-DD format
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000); // BRT = UTC-3
    const todayStr = brtNow.toISOString().split('T')[0];

    console.log(`[klingo-sync] Fetching appointments for ${todayStr}`);

    const response = await client.listForConfirmation(todayStr, { links: false });

    if (!response.success || !response.data) {
      console.warn(
        `[klingo-sync] No appointments found or API error:`,
        response.error
      );
      return { synced, failed, patientsCreated };
    }

    const appointments = Array.isArray(response.data)
      ? response.data
      : [response.data];

    console.log(
      `[klingo-sync] Found ${appointments.length} appointments in Klingo`
    );

    for (const apt of appointments) {
      try {
        // Normalize phone number
        const phone = apt.telefone?.replace(/\D/g, '');
        if (!phone || phone.length < 10) {
          console.warn(
            `[klingo-sync] Skipping appointment ${apt.id} - invalid phone`
          );
          failed++;
          continue;
        }
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
          // Update patient if needed
          if (existingPatient.name !== apt.paciente) {
            await db
              .update(schema.patients)
              .set({
                name: apt.paciente || existingPatient.name,
              })
              .where(eq(schema.patients.id, existingPatient.id));
          }
        } else {
          // Create new patient
          const [newPatient] = await db
            .insert(schema.patients)
            .values({
              phone: normalizedPhone,
              name: apt.paciente || 'Paciente',
              source: 'klingo',
            })
            .returning();

          if (!newPatient) {
            throw new Error('Failed to create patient');
          }

          patientId = newPatient.id;
          patientsCreated++;
          console.log(
            `[klingo-sync] Created patient: ${apt.paciente} (${normalizedPhone})`
          );
        }

        // Find doctor by name and specialty
        let doctorId: string | undefined;
        const [doctor] = await db
          .select()
          .from(schema.doctors)
          .where(
            and(
              eq(schema.doctors.name, apt.profissional || ''),
              eq(schema.doctors.specialty, apt.especialidade || '')
            )
          )
          .limit(1);

        if (doctor) {
          doctorId = doctor.id;
        } else {
          // Try to find by Klingo ID if available
          console.warn(
            `[klingo-sync] Doctor not found for ${apt.profissional} (${apt.especialidade})`
          );
        }

        // Check if appointment already exists by klingoVoucherId
        const [existingApt] = await db
          .select()
          .from(schema.appointments)
          .where(eq(schema.appointments.klingoVoucherId, apt.id_marcacao))
          .limit(1);

        // Map status from Klingo
        const statusMap: Record<string, string> = {
          P: 'scheduled', // Pending confirmation
          C: 'confirmed', // Confirmed
          N: 'no_show', // No-show
          R: 'cancelled', // Reschedule/Cancelled
        };

        const appointmentStatus =
          statusMap[apt.status_confirmacao] || 'scheduled';

        // Parse date and time
        const [year, month, day] = apt.data.split('-');
        const [hour, minute] = apt.hora.split(':');
        const scheduledAt = new Date(
          parseInt(year),
          parseInt(month) - 1,
          parseInt(day),
          parseInt(hour),
          parseInt(minute),
          0
        );

        if (existingApt) {
          // Update existing appointment
          await db
            .update(schema.appointments)
            .set({
              patientId,
              doctorId: doctorId || existingApt.doctorId,
              status: appointmentStatus,
              scheduledAt,
              klingoSyncStatus: 'synced',
            })
            .where(eq(schema.appointments.klingoVoucherId, apt.id_marcacao));

          console.log(
            `[klingo-sync] Updated appointment: ${apt.id_marcacao}`
          );
          synced++;
        } else {
          // Create new appointment
          const [newApt] = await db
            .insert(schema.appointments)
            .values({
              patientId,
              doctorId: doctorId,
              status: appointmentStatus,
              scheduledAt,
              klingoVoucherId: apt.id_marcacao,
              klingoSyncStatus: 'synced',
              createdBy: 'klingo_sync',
            })
            .returning();

          if (!newApt) {
            throw new Error('Failed to create appointment');
          }

          console.log(
            `[klingo-sync] Created appointment: ${apt.id_marcacao} for ${apt.paciente}`
          );
          synced++;

          // If appointment is confirmed (C), create OPD visit (only if doctorId found)
          if (apt.status_confirmacao === 'C' && doctorId) {
            try {
              const [existingVisit] = await db
                .select()
                .from(schema.opdVisits)
                .where(
                  and(
                    eq(schema.opdVisits.patientId, patientId),
                    eq(schema.opdVisits.appointmentId, newApt.id)
                  )
                )
                .limit(1);

              if (!existingVisit) {
                const [visit] = await db
                  .insert(schema.opdVisits)
                  .values({
                    patientId,
                    appointmentId: newApt.id,
                    doctorId,
                    status: 'waiting',
                    visitDate: apt.data,
                  })
                  .returning();

                if (visit) {
                  // Add timeline entry
                  await db.insert(schema.opdTimelines).values({
                    opdVisitId: visit.id,
                    title: 'Agendamento confirmado',
                    description: `Paciente confirmou presença para consulta com ${apt.profissional}`,
                    date: new Date(),
                    createdBy: 'klingo_sync',
                  });

                  console.log(
                    `[klingo-sync] Created OPD visit for appointment ${newApt.id}`
                  );
                }
              }
            } catch (err) {
              console.error(
                '[klingo-sync] Failed to create OPD visit:',
                (err as Error).message
              );
            }
          }
        }
      } catch (err) {
        console.error(
          `[klingo-sync] Failed to sync appointment ${apt.id}:`,
          (err as Error).message
        );
        failed++;
      }
    }

    console.log(
      `[klingo-sync] Appointments sync completed: ${synced} synced, ${failed} failed, ${patientsCreated} patients created`
    );
    return { synced, failed, patientsCreated };
  } catch (err) {
    console.error(
      '[klingo-sync] Appointments sync error:',
      (err as Error).message
    );
    throw err;
  }
}

/**
 * Sync vouchers to get additional appointment data
 */
export async function syncVouchers(): Promise<{
  synced: number;
  failed: number;
}> {
  const client = getKlingoExternalClient();
  if (!client) {
    throw new Error('Klingo client not configured');
  }

  console.log('[klingo-sync] Starting vouchers sync...');

  let synced = 0;
  let failed = 0;

  try {
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const datesToSync: string[] = [];

    for (let offset = -1; offset <= 30; offset++) {
      const date = new Date(brtNow);
      date.setDate(date.getDate() + offset);
      datesToSync.push(date.toISOString().split('T')[0]);
    }

    for (const dateStr of datesToSync) {
      let response: any;
      try {
        response = await client.listForConfirmation(dateStr, { links: false });
      } catch (err) {
        console.error(`[klingo-sync] Failed to fetch telefonia list for ${dateStr}:`, (err as Error).message);
        failed++;
        continue;
      }

      const appointments = Array.isArray(response)
        ? response
        : Array.isArray(response?.data)
          ? response.data
          : response?.data
            ? [response.data]
            : [];

      for (const apt of appointments) {
        try {
          const voucherId = Number(apt.id_marcacao);
          if (!Number.isFinite(voucherId) || voucherId <= 0) {
            continue;
          }

          const statusMap: Record<string, string> = {
            P: 'scheduled',
            C: 'confirmed',
            N: 'no_show',
            R: 'cancelled',
          };

          const nextStatus = statusMap[apt.status_confirmacao] || 'scheduled';

          const [existing] = await db
            .select({
              id: schema.appointments.id,
              status: schema.appointments.status,
              klingoReservationId: schema.appointments.klingoReservationId,
            })
            .from(schema.appointments)
            .where(eq(schema.appointments.klingoVoucherId, voucherId))
            .limit(1);

          if (!existing) {
            continue;
          }

          await db
            .update(schema.appointments)
            .set({
              status: nextStatus,
              klingoSyncStatus: 'synced',
              klingoReservationId: apt.codigo_reserva || existing.klingoReservationId || null,
            })
            .where(eq(schema.appointments.id, existing.id));

          synced++;
        } catch (err) {
          console.error(
            `[klingo-sync] Failed to sync voucher-like appointment ${apt?.id_marcacao ?? 'unknown'}:`,
            (err as Error).message
          );
          failed++;
        }
      }
    }

    console.log(
      `[klingo-sync] Vouchers sync completed: ${synced} synced, ${failed} failed`
    );
    return { synced, failed };
  } catch (err) {
    console.error('[klingo-sync] Vouchers sync error:', (err as Error).message);
    throw err;
  }
}

/**
 * Run full sync (doctors + appointments + vouchers)
 */
export async function runFullSync(): Promise<SyncResult> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  console.log('[klingo-sync] ========== FULL SYNC START ==========');

  try {
    // Verify Klingo client is available
    const client = getKlingoExternalClient();
    if (!client) {
      throw new Error('Klingo API token not configured');
    }

    // Health check
    try {
      const health = await client.healthCheck();
      if (!health) {
        throw new Error('Klingo health check failed');
      }
      console.log('[klingo-sync] ✓ Klingo API is online');
    } catch (err) {
      console.error('[klingo-sync] Klingo health check failed:', err);
      throw new Error('Cannot reach Klingo API');
    }

    // Run sync operations
    const doctorsResult = await syncDoctors();
    const appointmentsResult = await syncTodayAppointments();
    const vouchersResult = await syncVouchers();

    const totalSynced =
      doctorsResult.synced +
      appointmentsResult.synced +
      vouchersResult.synced;

    // Update sync status
    syncStatus = {
      lastSyncAt: timestamp,
      lastSyncSuccess: true,
      lastError: null,
      itemsSyncedToday: totalSynced,
    };

    const duration = Date.now() - startTime;

    const result: SyncResult = {
      success: true,
      timestamp,
      doctorsSync: doctorsResult,
      appointmentsSync: appointmentsResult,
    };

    console.log(
      `[klingo-sync] ========== FULL SYNC COMPLETE [${duration}ms] ==========`
    );
    console.log('[klingo-sync] Result:', JSON.stringify(result, null, 2));

    return result;
  } catch (err) {
    const errorMsg = (err as Error).message;

    // Update sync status
    syncStatus = {
      lastSyncAt: new Date().toISOString(),
      lastSyncSuccess: false,
      lastError: errorMsg,
      itemsSyncedToday: 0,
    };

    console.error(
      '[klingo-sync] ========== FULL SYNC FAILED ==========',
      errorMsg
    );

    return {
      success: false,
      timestamp,
      error: errorMsg,
    };
  }
}

/**
 * Get current sync status
 */
export function getSyncStatus(): SyncStatus {
  return syncStatus;
}

/**
 * Light sync - just appointments (for frequent runs)
 */
export async function runLightSync(): Promise<SyncResult> {
  const timestamp = new Date().toISOString();

  console.log('[klingo-sync] Light sync starting (appointments only)...');

  try {
    const client = getKlingoExternalClient();
    if (!client) {
      throw new Error('Klingo API token not configured');
    }

    const appointmentsResult = await syncTodayAppointments();

    syncStatus.lastSyncAt = timestamp;
    syncStatus.lastSyncSuccess = true;
    syncStatus.lastError = null;
    syncStatus.itemsSyncedToday = appointmentsResult.synced;

    return {
      success: true,
      timestamp,
      appointmentsSync: appointmentsResult,
    };
  } catch (err) {
    const errorMsg = (err as Error).message;

    syncStatus.lastSyncAt = new Date().toISOString();
    syncStatus.lastSyncSuccess = false;
    syncStatus.lastError = errorMsg;

    console.error('[klingo-sync] Light sync failed:', errorMsg);

    return {
      success: false,
      timestamp,
      error: errorMsg,
    };
  }
}

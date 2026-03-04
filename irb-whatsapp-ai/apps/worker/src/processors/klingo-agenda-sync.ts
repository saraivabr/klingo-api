import { Job } from 'bullmq';
import { db, schema } from '@irb/database';
import { getKlingoWorkerClient } from '../services/klingo-client-worker.js';
import { eq, and } from 'drizzle-orm';

interface KlingoAgendaSyncData {
  type?: 'light' | 'full'; // light = appointments only, full = doctors + appointments + vouchers
}

export async function processKlingoAgendaSync(job: Job<KlingoAgendaSyncData>) {
  const syncType = job.data?.type || 'light';

  console.log(`[klingo-agenda-sync] Starting ${syncType} sync (${new Date().toISOString()})`);

  try {
    const client = getKlingoWorkerClient();
    if (!client) {
      throw new Error('Klingo API token not configured');
    }

    // Health check
    const health = await client.healthCheck();
    if (!health) {
      throw new Error('Klingo API is offline');
    }

    let appointmentsCount = 0;
    let doctorsCount = 0;

    // Full sync includes doctors
    if (syncType === 'full') {
      const profResponse = await client.getProfessionals();
      if (profResponse.success && profResponse.data) {
        const profs = Array.isArray(profResponse.data)
          ? profResponse.data
          : [profResponse.data];
        for (const prof of profs) {
          try {
            const [existing] = await db
              .select()
              .from(schema.doctors)
              .where(eq(schema.doctors.klingoId, prof.id))
              .limit(1);

            if (!existing) {
              await db.insert(schema.doctors).values({
                klingoId: prof.id,
                name: prof.nome,
                specialty: prof.especialidade,
                crm: prof.crm,
              });
              doctorsCount++;
            }
          } catch (err) {
            console.warn(
              `[klingo-agenda-sync] Failed to sync doctor ${prof.id}:`,
              (err as Error).message
            );
          }
        }
      }
    }

    // Light or full sync: appointments
    const now = new Date();
    const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const todayStr = brtNow.toISOString().split('T')[0];

    const aptResponse = await client.listForConfirmation(todayStr, { links: false });
    if (aptResponse.success && aptResponse.data) {
      const apts = Array.isArray(aptResponse.data)
        ? aptResponse.data
        : [aptResponse.data];

      for (const apt of apts) {
        try {
          const phone = apt.telefone?.replace(/\D/g, '');
          if (!phone || phone.length < 10) continue;
          const normalizedPhone = phone.startsWith('55') ? phone : `55${phone}`;

          // Upsert patient
          const [existingPatient] = await db
            .select()
            .from(schema.patients)
            .where(eq(schema.patients.phone, normalizedPhone))
            .limit(1);

          let patientId: string;
          if (!existingPatient) {
            const [newPatient] = await db
              .insert(schema.patients)
              .values({
                phone: normalizedPhone,
                name: apt.paciente || 'Paciente',
                source: 'klingo',
              })
              .returning();
            if (newPatient) patientId = newPatient.id;
            else continue;
          } else {
            patientId = existingPatient.id;
          }

          // Find doctor
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
          if (doctor) doctorId = doctor.id;

          // Parse appointment date/time
          const [year, month, day] = apt.data.split('-');
          const [hour, minute] = apt.hora.split(':');
          const scheduledAt = new Date(
            parseInt(year),
            parseInt(month) - 1,
            parseInt(day),
            parseInt(hour),
            parseInt(minute)
          );

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
                status: apt.status_confirmacao === 'C' ? 'confirmed' : 'scheduled',
                scheduledAt,
              })
              .where(eq(schema.appointments.klingoVoucherId, apt.id_marcacao));
          } else {
            await db.insert(schema.appointments).values({
              patientId,
              doctorId,
              status: apt.status_confirmacao === 'C' ? 'confirmed' : 'scheduled',
              scheduledAt,
              klingoVoucherId: apt.id_marcacao,
              klingoSyncStatus: 'synced',
              createdBy: 'klingo_sync',
            });
          }

          appointmentsCount++;
        } catch (err) {
          console.warn(
            `[klingo-agenda-sync] Failed to sync appointment ${apt.id}:`,
            (err as Error).message
          );
        }
      }
    }

    console.log(
      `[klingo-agenda-sync] ${syncType} sync complete: ${appointmentsCount} appointments, ${doctorsCount} doctors`
    );

    return {
      status: 'success',
      type: syncType,
      appointmentsSynced: appointmentsCount,
      doctorsSynced: doctorsCount,
    };
  } catch (err) {
    console.error(
      `[klingo-agenda-sync] ${syncType} sync failed:`,
      (err as Error).message
    );
    throw err;
  }
}



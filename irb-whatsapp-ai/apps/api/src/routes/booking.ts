import { FastifyInstance } from 'fastify';
import { db, schema, redis } from '@irb/database';
import { eq, and, ilike, gte, lt, ne } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { getKlingoExternalClient } from '../services/klingo-external-client.js';
import { createHash } from 'crypto';

function buildGoogleCalendarUrl(params: {
  title: string;
  startDate: Date;
  durationMinutes: number;
  location: string;
  description: string;
}): string {
  const { title, startDate, durationMinutes, location, description } = params;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60_000);

  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dates = `${fmt(startDate)}/${fmt(endDate)}`;

  const url = new URL('https://calendar.google.com/calendar/render');
  url.searchParams.set('action', 'TEMPLATE');
  url.searchParams.set('text', title);
  url.searchParams.set('dates', dates);
  url.searchParams.set('location', location);
  url.searchParams.set('details', description);

  return url.toString();
}

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface SlotWithSource {
  date: string;
  time: string;
  dateTime: string;
  source: 'klingo' | 'fallback';
  klingoSlotId?: number;
}

function generateFallbackSlots(durationMinutes: number = 30): SlotWithSource[] {
  const slots: SlotWithSource[] = [];
  const now = new Date();

  for (let dayOffset = 1; dayOffset < 7; dayOffset++) {
    const day = new Date(now);
    day.setDate(day.getDate() + dayOffset);
    if (day.getDay() === 0 || day.getDay() === 6) continue;

    for (const hour of [9, 14, 16]) {
      const slotDate = new Date(day);
      slotDate.setHours(hour, 0, 0, 0);
      const dateStr = slotDate.toISOString().split('T')[0];
      const timeStr = `${String(hour).padStart(2, '0')}:00`;
      slots.push({ date: dateStr, time: timeStr, dateTime: slotDate.toISOString(), source: 'fallback' });
    }
  }

  return slots.slice(0, 9);
}

export async function bookingRoutes(app: FastifyInstance) {
  // GET /api/booking/:token - Get booking link data + available slots
  app.get<{ Params: { token: string } }>('/:token', async (request, reply) => {
    const { token } = request.params;

    const [link] = await db.select().from(schema.bookingLinks)
      .where(eq(schema.bookingLinks.token, token))
      .limit(1);

    if (!link) {
      return reply.status(404).send({ error: 'Link não encontrado' });
    }

    if (link.status === 'booked') {
      return reply.status(410).send({ error: 'Este link já foi utilizado', status: 'booked' });
    }

    if (link.status === 'expired' || new Date(link.expiresAt) < new Date()) {
      return reply.status(410).send({ error: 'Este link expirou', status: 'expired' });
    }

    // Get doctors for the specialty
    const doctorsList = await db.select().from(schema.doctors)
      .where(and(
        ilike(schema.doctors.specialty, `%${link.specialty}%`),
        eq(schema.doctors.isActive, true),
      ));

    // Get service info if serviceId exists
    let service = null;
    if (link.serviceId) {
      const [s] = await db.select().from(schema.services)
        .where(eq(schema.services.id, link.serviceId))
        .limit(1);
      service = s || null;
    }

    // Try to get real slots — Priority: External API > AQL > Fallback
    let slots: SlotWithSource[] = [];

    // Priority 1: Klingo External API
    const klingoExt = getKlingoExternalClient();
    if (klingoExt) {
      try {
        const now = new Date();
        const start = new Date(now);
        start.setDate(start.getDate() + 1);
        const end = new Date(now);
        end.setDate(end.getDate() + 8);

        // Find doctor CRM if specific doctor
        let crm: string | undefined;
        if (link.doctorId) {
          const [doc] = await db.select({ crm: schema.doctors.crm })
            .from(schema.doctors)
            .where(eq(schema.doctors.id, link.doctorId))
            .limit(1);
          if (doc?.crm) crm = doc.crm;
        }

        const result = await klingoExt.getAvailableSlots({
          especialidade: undefined, // TODO: map specialty name to Klingo ID
          inicio: start.toISOString().split('T')[0],
          fim: end.toISOString().split('T')[0],
          crm,
        });

        const extSlots = Array.isArray(result.data) ? result.data : (Array.isArray(result) ? result : []);
        for (const s of extSlots) {
          const slotDate = new Date(`${s.data}T${s.hora}:00-03:00`);
          if (slotDate <= now) continue;
          slots.push({
            date: s.data,
            time: s.hora,
            dateTime: slotDate.toISOString(),
            source: 'klingo',
            klingoSlotId: s.id,
          });
        }

        // Deduplicate and limit
        const seen = new Set<string>();
        slots = slots.filter(s => {
          if (seen.has(s.dateTime)) return false;
          seen.add(s.dateTime);
          return true;
        }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()).slice(0, 12);

        if (slots.length > 0) {
          console.log(`[booking] Got ${slots.length} slots from External API`);
        }
      } catch (err) {
        console.error('[booking] External API slots error:', err);
      }
    }

    // Priority 2: Hardcoded fallback
    if (slots.length === 0) {
      slots = generateFallbackSlots(service?.durationMinutes || 30);
    }

    return {
      specialty: link.specialty,
      patientName: link.patientName,
      patientPhone: link.patientPhone,
      expiresAt: link.expiresAt,
      doctors: doctorsList.map(d => ({ id: d.id, name: d.name, crm: d.crm })),
      service: service ? {
        id: service.id,
        name: service.name,
        priceCents: service.priceCents,
        durationMinutes: service.durationMinutes,
      } : null,
      slots,
    };
  });

  // POST /api/booking/:token/confirm - Confirm booking
  app.post<{
    Params: { token: string };
    Body: { patientName: string; cpf?: string; birthDate?: string; email?: string; doctorId: string; slotDateTime: string; slotSource?: 'klingo' | 'fallback'; klingoSlotId?: number };
  }>('/:token/confirm', async (request, reply) => {
    const { token } = request.params;
    const { patientName, cpf, birthDate, doctorId, slotDateTime, slotSource, klingoSlotId } = request.body;

    if (!patientName || !slotDateTime) {
      return reply.status(400).send({ error: 'Nome e horário são obrigatórios' });
    }

    const slotDate = new Date(slotDateTime);
    if (isNaN(slotDate.getTime()) || slotDate <= new Date()) {
      return reply.status(400).send({ error: 'Horário inválido' });
    }

    // Use a transaction for double-booking protection
    const result = await db.transaction(async (tx) => {
      const [link] = await tx.select().from(schema.bookingLinks)
        .where(eq(schema.bookingLinks.token, token))
        .limit(1);

      if (!link) {
        return { error: 'Link não encontrado', status: 404 };
      }

      if (link.status !== 'pending') {
        return { error: 'Este link já foi utilizado', status: 410 };
      }

      if (new Date(link.expiresAt) < new Date()) {
        return { error: 'Este link expirou', status: 410 };
      }

      // Check for conflicting appointment at the same time + doctor
      const slotEnd = new Date(slotDate);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);

      if (doctorId) {
        const [conflict] = await tx.select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(and(
            eq(schema.appointments.doctorId, doctorId),
            gte(schema.appointments.scheduledAt, slotDate),
            lt(schema.appointments.scheduledAt, slotEnd),
            ne(schema.appointments.status, 'cancelled'),
          ))
          .limit(1);

        if (conflict) {
          return { error: 'Este horário já foi reservado. Escolha outro.', status: 409 };
        }
      }

      // Find or reference patient
      let patientId: string | undefined;
      if (link.patientPhone) {
        const [patient] = await tx.select().from(schema.patients)
          .where(eq(schema.patients.phone, link.patientPhone))
          .limit(1);

        if (patient) {
          patientId = patient.id;
          // Update name, cpf, birthDate if not set
          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (!patient.name && patientName) updates.name = patientName;
          if (!patient.cpfHash && cpf) updates.cpfHash = createHash('sha256').update(cpf).digest('hex');
          if (!patient.birthDate && birthDate) {
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const digits = birthDate.replace(/\D/g, '');
            if (digits.length === 8) {
              updates.birthDate = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
            }
          }
          if (Object.keys(updates).length > 1) {
            await tx.update(schema.patients)
              .set(updates)
              .where(eq(schema.patients.id, patient.id));
          }
        } else {
          // Create patient
          const cpfHash = cpf ? createHash('sha256').update(cpf).digest('hex') : undefined;
          let birthDateISO: string | undefined;
          if (birthDate) {
            const digits = birthDate.replace(/\D/g, '');
            if (digits.length === 8) {
              birthDateISO = `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
            }
          }
          const [newPatient] = await tx.insert(schema.patients)
            .values({
              phone: link.patientPhone,
              name: patientName,
              cpfHash,
              birthDate: birthDateISO,
              source: 'booking_link',
            })
            .returning({ id: schema.patients.id });
          patientId = newPatient.id;
        }
      }

      // Create appointment - pending_confirmation if slot came from fallback
      const isFallback = slotSource === 'fallback';
      const [appointment] = await tx.insert(schema.appointments).values({
        patientId,
        doctorId: doctorId || link.doctorId || undefined,
        serviceId: link.serviceId || undefined,
        scheduledAt: slotDate,
        status: isFallback ? 'pending_confirmation' : 'scheduled',
        createdBy: 'booking_link',
        conversationMongoId: link.conversationMongoId || undefined,
        klingoSyncStatus: process.env.KLINGO_APP_TOKEN ? 'pending' : 'skipped',
      }).returning({ id: schema.appointments.id });

      // Update booking link
      await tx.update(schema.bookingLinks)
        .set({
          status: 'booked',
          appointmentId: appointment.id,
          patientName,
          bookedAt: new Date(),
        })
        .where(eq(schema.bookingLinks.id, link.id));

      return {
        success: true,
        appointmentId: appointment.id,
        link,
      };
    });

    if ('error' in result) {
      return reply.status(result.status as number).send({ error: result.error });
    }

    // Reserve + confirm slot in Klingo via External API
    const klingoExt = getKlingoExternalClient();
    if (klingoExt && klingoSlotId && slotSource === 'klingo') {
      try {
        // Identify patient in Klingo
        let klingoPatientId: number | undefined;

        if (cpf) {
          const cpfResult = await klingoExt.identifyPatientByCpf(cpf);
          if (cpfResult.data?.id_pessoa) {
            klingoPatientId = cpfResult.data.id_pessoa;
          }
        }

        if (!klingoPatientId && result.link.patientPhone) {
          const phoneResult = await klingoExt.identifyPatientByPhone(result.link.patientPhone);
          if (phoneResult.data?.id_pessoa) {
            klingoPatientId = phoneResult.data.id_pessoa;
          }
        }

        if (klingoPatientId) {
          // Reserve the slot
          const reservation = await klingoExt.reserveSlot({
            id_horario: klingoSlotId,
            id_paciente: klingoPatientId,
          });

          if (reservation.data?.id) {
            // Confirm the booking
            const confirmation = await klingoExt.confirmBooking({
              id_reserva: reservation.data.id,
              id_paciente: klingoPatientId,
            });

            // Save Klingo IDs in appointment
            await db.update(schema.appointments).set({
              klingoSyncStatus: 'synced',
              klingoVoucherId: confirmation.data?.voucher_id ?? null,
              klingoReservationId: reservation.data.id,
            }).where(eq(schema.appointments.id, result.appointmentId));

            console.log(`[booking] Klingo reservation confirmed: voucher=${confirmation.data?.voucher_id}, reservation=${reservation.data.id}`);
          }
        } else {
          console.warn(`[booking] Patient not found in Klingo (cpf=${cpf ? 'yes' : 'no'}, phone=${result.link.patientPhone}), sync skipped`);
          await db.update(schema.appointments).set({
            klingoSyncStatus: 'failed',
            klingoSyncError: 'Patient not found in Klingo (no CPF/phone match)',
          }).where(eq(schema.appointments.id, result.appointmentId));
        }
      } catch (err: any) {
        console.error(`[booking] Klingo reservation error:`, err.message);
        await db.update(schema.appointments).set({
          klingoSyncStatus: 'failed',
          klingoSyncError: err.message,
        }).where(eq(schema.appointments.id, result.appointmentId));
      }
    }

    // Notify team if slot came from fallback (needs manual confirmation in Klingo)
    if (slotSource === 'fallback' && result.link.patientPhone) {
      const notifyPhone = process.env.TEAM_NOTIFY_PHONE;
      if (notifyPhone) {
        await messageSendQueue.add('send', {
          patientPhone: notifyPhone,
          text: `⚠️ Agendamento FALLBACK criado (sem slot Klingo):\n\nPaciente: ${patientName}\nData: ${slotDate.toLocaleDateString('pt-BR')}\nHorário: ${slotDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n\nPor favor, confirme manualmente no Klingo.`,
          instanceName: 'uazapi',
        }, { removeOnComplete: 100, removeOnFail: 500 });
      }
    }

    // Enqueue WhatsApp confirmation message
    if (result.link.patientPhone && result.link.conversationMongoId) {
      const doctorInfo = doctorId
        ? await db.select({ name: schema.doctors.name, specialty: schema.doctors.specialty }).from(schema.doctors).where(eq(schema.doctors.id, doctorId)).limit(1)
        : [];

      const doctorName = doctorInfo[0]?.name || '';
      const specialty = result.link.specialty;
      const dateFormatted = slotDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      const timeFormatted = slotDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Buscar info do serviço se existir
      let serviceInfo = '';
      if (result.link.serviceId) {
        const [svc] = await db.select({ name: schema.services.name, priceCents: schema.services.priceCents, durationMinutes: schema.services.durationMinutes })
          .from(schema.services)
          .where(eq(schema.services.id, result.link.serviceId))
          .limit(1);
        if (svc) {
          const price = svc.priceCents ? `R$ ${(svc.priceCents / 100).toFixed(2).replace('.', ',')}` : null;
          const duration = svc.durationMinutes ? `${svc.durationMinutes} minutos` : null;
          if (price) serviceInfo += `\n\n💰 Valor: ${price}`;
          if (duration) serviceInfo += `\n⏱ Duração: ${duration}`;
        }
      }

      const firstName = patientName.split(' ')[0];

      const clinicAddress = 'IRB Prime Care - Rua Boa Vista, 99 - 6º Andar, Centro - SP';

      const confirmText = `Aeee ${firstName}, ta tudo certo! Seu agendamento foi confirmado com sucesso! 🎉\n\n` +
        `Olha so os detalhes:\n\n` +
        `📋 ${specialty}${doctorName ? ` com ${doctorName}` : ''}\n` +
        `📅 ${dateFormatted} as ${timeFormatted}\n` +
        `📍 ${clinicAddress}` +
        serviceInfo +
        `\n\n` +
        `Chega uns 10 minutinhos antes pra gente te receber com calma, ta bom? 😊`;

      // Build Google Calendar link
      let durationMin = 30; // default
      if (result.link.serviceId) {
        const [svcDur] = await db.select({ durationMinutes: schema.services.durationMinutes })
          .from(schema.services)
          .where(eq(schema.services.id, result.link.serviceId))
          .limit(1);
        if (svcDur?.durationMinutes) durationMin = svcDur.durationMinutes;
      }

      const calendarUrl = buildGoogleCalendarUrl({
        title: `${specialty}${doctorName ? ` - ${doctorName}` : ''} | IRB Prime Care`,
        startDate: slotDate,
        durationMinutes: durationMin,
        location: clinicAddress,
        description: `Consulta de ${specialty}${doctorName ? ` com ${doctorName}` : ''}.\n\nChegue 10 minutos antes.\n\nIRB Prime Care\nRua Boa Vista, 99 - 6º Andar\nCentro, São Paulo - SP`,
      });

      // Store calendar URL in Redis for button click handler (7 days TTL)
      const calKey = `calendar_event:${result.appointmentId}`;
      await redis.set(calKey, calendarUrl, 'EX', 7 * 24 * 60 * 60);

      // 1) Send confirmation text
      await messageSendQueue.add('send', {
        conversationId: result.link.conversationMongoId,
        patientPhone: result.link.patientPhone,
        text: confirmText,
        instanceName: 'uazapi',
      }, {
        removeOnComplete: 100,
        removeOnFail: 500,
      });

      // 2) Send interactive buttons after confirmation
      await messageSendQueue.add('send', {
        conversationId: result.link.conversationMongoId,
        patientPhone: result.link.patientPhone,
        text: '',
        instanceName: 'uazapi',
        interactive: {
          type: 'buttons' as const,
          text: 'Deseja adicionar na sua agenda? 📅',
          buttons: [
            { id: `cal_${result.appointmentId}`, text: 'Adicionar à agenda' },
            { id: 'cal_ok', text: 'OK, obrigado!' },
          ],
          footerText: 'IRB Prime Care',
        },
      }, {
        delay: 3000, // 3s after confirmation text
        removeOnComplete: 100,
        removeOnFail: 500,
      });
    }

    return {
      success: true,
      appointmentId: result.appointmentId,
      message: 'Agendamento confirmado!',
    };
  });
}

import { FastifyInstance } from 'fastify';
import { db, schema, redis } from '@irb/database';
import { eq, and, ilike, gte, lt, ne } from 'drizzle-orm';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { getKlingoExternalClient } from '../services/klingo-external-client.js';
import { createHash } from 'crypto';

// Klingo procedimento IDs for "CONSULTA" per specialty (from Klingo internal catalog)
const CONSULTA_PROCEDURE_MAP: Record<string, number> = {
  'cardiologia': 416,
  'gastroenterologia': 1293,
  'neurologia': 1312,
  'reumatologia': 1314,
  'dermatologia': 1317,
  'odontologia': 1105,
  'psiquiatria': 1345,
  'ginecologia': 1290,
  'ortopedia': 1301,
  'urologia': 1339,
  'oftalmologia': 1295,
  'pneumologia': 1321,
  'pediatria': 1327,
  'endocrinologia': 1302,
  'geriatria': 1343,
};

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
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });

interface SlotWithSource {
  date: string;
  time: string;
  dateTime: string;
  source: 'klingo' | 'fallback';
  klingoSlotId?: string | number;
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

        // Resolve specialty name to Klingo ID
        let especialidadeId: number | undefined;
        let exameId: number | undefined;
        try {
          const specResult = await klingoExt.getSpecialties() as any;
          // API may return array directly or { data: [...] }
          const specs = Array.isArray(specResult) ? specResult
            : Array.isArray(specResult?.data) ? specResult.data : [];
          const match = specs.find((s: any) =>
            s.nome && s.nome.toLowerCase().includes(link.specialty.toLowerCase())
          );
          if (match) especialidadeId = match.id || match.codigo;
        } catch (specErr) {
          console.warn('[booking] Could not fetch specialties for mapping:', specErr);
        }

        // Priority 1: Use CONSULTA procedure map (most bookings are consultations)
        const specKey = link.specialty.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const mapKey = Object.keys(CONSULTA_PROCEDURE_MAP).find(k => specKey.includes(k));
        if (mapKey) {
          exameId = CONSULTA_PROCEDURE_MAP[mapKey];
        }

        // Priority 2: Search Klingo exams API if no consulta match
        if (!exameId) {
          try {
            const examesResult = await klingoExt.getExams() as any;
            const exames = Array.isArray(examesResult) ? examesResult
              : Array.isArray(examesResult?.data) ? examesResult.data
              : Array.isArray(examesResult?.exames) ? examesResult.exames : [];
            const specName = link.specialty.toLowerCase();
            const exameMatch = exames.find((e: any) => {
              const esp = e.especialidade;
              if (typeof esp === 'string') return esp.toLowerCase().includes(specName);
              if (esp && typeof esp === 'object' && esp.nome) return esp.nome.toLowerCase().includes(specName);
              return false;
            });
            if (exameMatch) exameId = exameMatch.id || exameMatch.codigo;
          } catch (exameErr) {
            console.warn('[booking] Could not fetch exams for mapping:', exameErr);
          }
        }

        const result = await klingoExt.getAvailableSlots({
          especialidade: especialidadeId,
          exame: exameId,
          plano: 1, // PARTICULAR (default)
          inicio: start.toISOString().split('T')[0],
          fim: end.toISOString().split('T')[0],
        }) as any;


        // Klingo API returns { horarios: [{ data, profissional, horarios: {key: hora} }] }
        const extSlots = Array.isArray(result.horarios) ? result.horarios
          : Array.isArray(result.data) ? result.data
          : Array.isArray(result) ? result : [];
        for (const s of extSlots) {
          // Each slot group has a date and nested horarios dict
          const slotHorarios = s.horarios;
          if (slotHorarios && typeof slotHorarios === 'object' && !Array.isArray(slotHorarios)) {
            // Nested format: { "key1": "14:00", "key2": "14:20" }
            for (const [key, hora] of Object.entries(slotHorarios)) {
              const slotDate = new Date(`${s.data}T${hora}:00-03:00`);
              if (slotDate <= now) continue;
              slots.push({
                date: s.data,
                time: hora as string,
                dateTime: slotDate.toISOString(),
                source: 'klingo',
                klingoSlotId: key,
              });
            }
          } else if (s.hora) {
            // Flat format fallback: { data, hora }
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
    Body: { patientName: string; cpf?: string; birthDate?: string; email?: string; sexo?: 'M' | 'F'; doctorId: string; slotDateTime: string; slotSource?: 'klingo' | 'fallback'; klingoSlotId?: string | number };
  }>('/:token/confirm', async (request, reply) => {
    const { token } = request.params;
    const { patientName, cpf, birthDate, email, doctorId, slotDateTime, slotSource, klingoSlotId, sexo } = request.body;

    if (!patientName || !slotDateTime) {
      return reply.status(400).send({ error: 'Nome e horário são obrigatórios' });
    }

    const slotDate = new Date(slotDateTime);
    if (isNaN(slotDate.getTime()) || slotDate <= new Date()) {
      return reply.status(400).send({ error: 'Horário inválido' });
    }

    // Helper: convert DD/MM/YYYY to yyyy-mm-dd
    function toBirthDateISO(raw?: string): string | undefined {
      if (!raw) return undefined;
      const digits = raw.replace(/\D/g, '');
      if (digits.length !== 8) return raw;
      return `${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }

    // ── STEP 1: Validate link (quick read, no mutation) ──
    const [link] = await db.select().from(schema.bookingLinks)
      .where(eq(schema.bookingLinks.token, token))
      .limit(1);

    if (!link) return reply.status(404).send({ error: 'Link não encontrado' });
    if (link.status !== 'pending') return reply.status(410).send({ error: 'Este link já foi utilizado' });
    if (new Date(link.expiresAt) < new Date()) return reply.status(410).send({ error: 'Este link expirou' });

    // ── STEP 2: Klingo — identify/register patient + reserve slot (BEFORE DB commit) ──
    const klingoExt = getKlingoExternalClient();
    const isKlingoSlot = slotSource === 'klingo' && klingoSlotId && klingoExt;
    let klingoPatientId: number | undefined;
    let klingoReservationId: string | undefined;
    let klingoVoucherId: number | undefined;
    let klingoSyncStatus: string = process.env.KLINGO_APP_TOKEN ? 'pending' : 'skipped';
    let klingoSyncError: string | undefined;

    if (isKlingoSlot) {
      // 2a. Identify patient — CPF first, then phone
      if (cpf) {
        try {
          const cpfResult = await klingoExt.identifyPatientByCpf(cpf);
          const identifiedPatientId = klingoExt.extractPatientId(cpfResult);
          if (identifiedPatientId) {
            klingoPatientId = identifiedPatientId;
            console.log(`[booking] Patient identified by CPF: klingo_id=${klingoPatientId}`);
          }
        } catch (cpfErr: any) {
          console.warn(`[booking] CPF lookup failed (will try phone): ${cpfErr.message}`);
        }
      }

      if (!klingoPatientId && link.patientPhone) {
        try {
          const cleanPhone = link.patientPhone.replace(/\D/g, '').replace(/^55/, '');
          const phoneResult = await klingoExt.identifyPatientByPhone(cleanPhone);
          const identifiedPatientId = klingoExt.extractPatientId(phoneResult);
          if (identifiedPatientId) {
            klingoPatientId = identifiedPatientId;
            console.log(`[booking] Patient identified by phone: klingo_id=${klingoPatientId}`);
          }
        } catch (phoneErr: any) {
          console.warn(`[booking] Phone lookup failed: ${phoneErr.message}`);
        }
      }

      // 2b. Auto-register if not found
      if (!klingoPatientId && cpf && birthDate && link.patientPhone) {
        try {
          const cleanPhone = link.patientPhone.replace(/\D/g, '').replace(/^55/, '');
          const registerResult = await klingoExt.registerPatient({
            paciente: {
              nome: patientName,
              sexo: sexo || 'M',
              dt_nasc: toBirthDateISO(birthDate)!,
              docs: { cpf: cpf.replace(/\D/g, '') },
              contatos: {
                celular: cleanPhone,
                ...(email ? { email } : {}),
              },
            },
          });
          if (registerResult.data?.id) {
            klingoPatientId = registerResult.data.id;
            console.log(`[booking] Patient auto-registered in Klingo: id=${klingoPatientId}`);
          }
        } catch (regErr: any) {
          console.warn(`[booking] Klingo patient registration failed: ${regErr.message}`);
        }
      }

      // 2c. Reserve slot in Klingo (10-min hold)
      if (klingoPatientId) {
        try {
          const reservation = await klingoExt.reserveSlot(klingoPatientId, {
            id_horario: Number(klingoSlotId),
            id_paciente: klingoPatientId,
          });

          if (reservation.data?.id) {
            klingoReservationId = reservation.data.id;
            console.log(`[booking] Klingo slot reserved: reservation=${klingoReservationId}`);
          } else {
            // Reservation returned but no ID — slot may be taken
            klingoSyncStatus = 'failed';
            klingoSyncError = 'Klingo reserveSlot returned no reservation ID';
            return reply.status(409).send({ error: 'Este horário não está mais disponível no sistema. Escolha outro.' });
          }
        } catch (resErr: any) {
          console.error(`[booking] Klingo reserveSlot failed: ${resErr.message}`);
          // Slot is taken or unavailable — tell patient to pick another
          return reply.status(409).send({ error: 'Este horário não está mais disponível. Por favor, escolha outro.' });
        }
      } else {
        // Could not identify/register patient — will create appointment locally and notify team
        klingoSyncStatus = 'failed';
        klingoSyncError = 'Paciente nao identificado/registrado no Klingo';
        console.warn(`[booking] Patient not found/registered in Klingo — proceeding with local-only appointment`);
      }
    }

    // ── STEP 3: DB transaction — create patient + appointment + mark link as booked ──
    const isFallback = slotSource === 'fallback';
    const result = await db.transaction(async (tx) => {
      // Re-check link status inside transaction (concurrent protection)
      const [freshLink] = await tx.select({ status: schema.bookingLinks.status })
        .from(schema.bookingLinks)
        .where(eq(schema.bookingLinks.token, token))
        .limit(1);

      if (!freshLink || freshLink.status !== 'pending') {
        return { error: 'Este link já foi utilizado', status: 410 };
      }

      // Check for conflicting appointment at same time + doctor
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

      // Find or create patient
      let patientId: string | undefined;
      if (link.patientPhone) {
        const [patient] = await tx.select().from(schema.patients)
          .where(eq(schema.patients.phone, link.patientPhone))
          .limit(1);

        if (patient) {
          patientId = patient.id;
          const updates: Record<string, unknown> = { updatedAt: new Date() };
          if (!patient.name && patientName) updates.name = patientName;
          if (!patient.cpfHash && cpf) updates.cpfHash = createHash('sha256').update(cpf).digest('hex');
          if (!patient.birthDate && birthDate) {
            const iso = toBirthDateISO(birthDate);
            if (iso) updates.birthDate = iso;
          }
          if (klingoPatientId && !patient.klingoPatientId) {
            updates.klingoPatientId = klingoPatientId;
          }
          if (Object.keys(updates).length > 1) {
            await tx.update(schema.patients).set(updates).where(eq(schema.patients.id, patient.id));
          }
        } else {
          const cpfHash = cpf ? createHash('sha256').update(cpf).digest('hex') : undefined;
          const [newPatient] = await tx.insert(schema.patients)
            .values({
              phone: link.patientPhone,
              name: patientName,
              cpfHash,
              birthDate: toBirthDateISO(birthDate),
              klingoPatientId: klingoPatientId || undefined,
              source: 'booking_link',
            })
            .returning({ id: schema.patients.id });
          patientId = newPatient.id;
        }
      }

      // Create appointment with Klingo data already resolved
      const [appointment] = await tx.insert(schema.appointments).values({
        patientId,
        doctorId: doctorId || link.doctorId || undefined,
        serviceId: link.serviceId || undefined,
        scheduledAt: slotDate,
        status: isFallback ? 'pending_confirmation' : 'scheduled',
        createdBy: 'booking_link',
        conversationMongoId: link.conversationMongoId || undefined,
        klingoSyncStatus,
        klingoReservationId: klingoReservationId || undefined,
        klingoSyncError: klingoSyncError || undefined,
      }).returning({ id: schema.appointments.id });

      // Mark link as booked
      await tx.update(schema.bookingLinks)
        .set({
          status: 'booked',
          appointmentId: appointment.id,
          patientName,
          bookedAt: new Date(),
        })
        .where(eq(schema.bookingLinks.id, link.id));

      return { success: true, appointmentId: appointment.id };
    });

    if ('error' in result) {
      // If we reserved a Klingo slot but DB failed, cancel the reservation
      if (klingoReservationId && klingoExt) {
        try {
          if (klingoPatientId) {
            await klingoExt.cancelReservation(klingoPatientId, klingoReservationId);
          }
          console.log(`[booking] Cancelled Klingo reservation ${klingoReservationId} after DB error`);
        } catch (cancelErr: any) {
          console.error(`[booking] Failed to cancel Klingo reservation: ${cancelErr.message}`);
        }
      }
      return reply.status(result.status as number).send({ error: result.error });
    }

    // ── STEP 4: Klingo — confirm booking (convert reservation to voucher) ──
    let klingoSynced = false;
    if (klingoReservationId && klingoPatientId && klingoExt) {
      try {
        const confirmation = await klingoExt.confirmBooking(klingoPatientId, {
          id_reserva: klingoReservationId,
          id_paciente: klingoPatientId,
        });

        klingoVoucherId = confirmation.data?.voucher_id;
        await db.update(schema.appointments).set({
          klingoSyncStatus: 'synced',
          klingoVoucherId: klingoVoucherId ?? null,
        }).where(eq(schema.appointments.id, result.appointmentId));

        klingoSynced = true;
        console.log(`[booking] Klingo booking confirmed: voucher=${klingoVoucherId}, reservation=${klingoReservationId}`);
      } catch (confErr: any) {
        console.error(`[booking] Klingo confirmBooking failed: ${confErr.message}`);
        // Reservation is still valid (10-min hold) — notify team to confirm manually
        await db.update(schema.appointments).set({
          klingoSyncStatus: 'failed',
          klingoSyncError: `confirmBooking failed: ${confErr.message}`,
        }).where(eq(schema.appointments.id, result.appointmentId));
      }
    }

    // ── STEP 5: Notifications ──
    const needsTeamNotify = isFallback || (isKlingoSlot && !klingoSynced);
    if (needsTeamNotify && link.patientPhone) {
      const notifyPhone = process.env.TEAM_NOTIFY_PHONE;
      if (notifyPhone) {
        const reason = isFallback
          ? 'Slot FALLBACK (sem slot Klingo)'
          : klingoSyncError || 'Klingo sync falhou';
        await messageSendQueue.add('send', {
          conversationId: `team-notify-${result.appointmentId}`,
          patientPhone: notifyPhone,
          text: `⚠️ AGENDAMENTO precisa de acao manual:\n\n📋 ${reason}\n👤 Paciente: ${patientName}\n📱 Tel: ${link.patientPhone}\n🏥 ${link.specialty}\n📅 ${slotDate.toLocaleDateString('pt-BR')} as ${slotDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}\n${cpf ? `🆔 CPF: ${cpf}\n` : ''}${birthDate ? `🎂 Nasc: ${birthDate}\n` : ''}\nPor favor, verifique no Klingo e confirme o agendamento.`,
          instanceName: 'uazapi',
        }, { removeOnComplete: 100, removeOnFail: 500 });
      }
    }

    // ── STEP 6: WhatsApp confirmation to patient ──
    if (link.patientPhone && link.conversationMongoId) {
      const doctorInfo = doctorId
        ? await db.select({ name: schema.doctors.name, specialty: schema.doctors.specialty }).from(schema.doctors).where(eq(schema.doctors.id, doctorId)).limit(1)
        : [];

      const doctorName = doctorInfo[0]?.name || '';
      const specialty = link.specialty;
      const dateFormatted = slotDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
      const timeFormatted = slotDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      const firstName = patientName.split(' ')[0];
      const clinicAddress = 'IRB Prime Care - Rua Boa Vista, 99 - 6º Andar, Centro - SP';

      // Fetch service info once (fixes duplicate query)
      let serviceInfo = '';
      let durationMin = 30;
      if (link.serviceId) {
        const [svc] = await db.select({
          name: schema.services.name,
          priceCents: schema.services.priceCents,
          durationMinutes: schema.services.durationMinutes,
        }).from(schema.services).where(eq(schema.services.id, link.serviceId)).limit(1);
        if (svc) {
          if (svc.priceCents) serviceInfo += `\n\n💰 Valor: R$ ${(svc.priceCents / 100).toFixed(2).replace('.', ',')}`;
          if (svc.durationMinutes) {
            serviceInfo += `\n⏱ Duração: ${svc.durationMinutes} minutos`;
            durationMin = svc.durationMinutes;
          }
        }
      }

      // Different message depending on whether Klingo confirmed or not
      let confirmText: string;
      if (klingoSynced || isFallback) {
        confirmText = `Aeee ${firstName}, ta tudo certo! Seu agendamento foi confirmado com sucesso! 🎉\n\n` +
          `Olha so os detalhes:\n\n` +
          `📋 ${specialty}${doctorName ? ` com ${doctorName}` : ''}\n` +
          `📅 ${dateFormatted} as ${timeFormatted}\n` +
          `📍 ${clinicAddress}` +
          serviceInfo +
          `\n\n` +
          `Chega uns 10 minutinhos antes pra gente te receber com calma, ta bom? 😊`;
      } else {
        // Klingo sync failed — tell patient it's being processed
        confirmText = `Oi ${firstName}! Recebemos seu agendamento e estamos confirmando com a clinica. 📋\n\n` +
          `📋 ${specialty}${doctorName ? ` com ${doctorName}` : ''}\n` +
          `📅 ${dateFormatted} as ${timeFormatted}\n` +
          `📍 ${clinicAddress}` +
          serviceInfo +
          `\n\n` +
          `Nossa equipe vai confirmar e te avisar em breve! 😊`;
      }

      const calendarUrl = buildGoogleCalendarUrl({
        title: `${specialty}${doctorName ? ` - ${doctorName}` : ''} | IRB Prime Care`,
        startDate: slotDate,
        durationMinutes: durationMin,
        location: clinicAddress,
        description: `Consulta de ${specialty}${doctorName ? ` com ${doctorName}` : ''}.\n\nChegue 10 minutos antes.\n\nIRB Prime Care\nRua Boa Vista, 99 - 6º Andar\nCentro, São Paulo - SP`,
      });

      const calKey = `calendar_event:${result.appointmentId}`;
      await redis.set(calKey, calendarUrl, 'EX', 7 * 24 * 60 * 60);

      await messageSendQueue.add('send', {
        conversationId: link.conversationMongoId,
        patientPhone: link.patientPhone,
        text: confirmText,
        instanceName: 'uazapi',
      }, { removeOnComplete: 100, removeOnFail: 500 });

      await messageSendQueue.add('send', {
        conversationId: link.conversationMongoId,
        patientPhone: link.patientPhone,
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
      }, { delay: 3000, removeOnComplete: 100, removeOnFail: 500 });
    }

    return {
      success: true,
      appointmentId: result.appointmentId,
      klingoSynced,
      message: klingoSynced ? 'Agendamento confirmado!' : (isFallback ? 'Agendamento registrado, pendente de confirmação.' : 'Agendamento registrado, confirmação pendente no sistema.'),
    };
  });
}

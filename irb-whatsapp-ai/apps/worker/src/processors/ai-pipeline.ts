import { Job, Queue } from 'bullmq';
import { ConversationModel, db, schema, publishEvent, redis } from '@irb/database';
import { QUEUE_NAMES } from '@irb/shared/constants';
import { callClaude, aiTools, loadKnowledgeBase, buildContext, classifyIntent, checkEscalation, detectEscapePhrase, transitionState, searchKnowledge, formatChunksForPrompt } from '@irb/ai';
import { eq, ilike, and, gte, lt, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
};

const messageSendQueue = new Queue(QUEUE_NAMES.MESSAGE_SEND, { connection: redisConnection });
const followUpQueue = new Queue(QUEUE_NAMES.FOLLOW_UP, { connection: redisConnection });
const analyticsQueue = new Queue(QUEUE_NAMES.ANALYTICS, { connection: redisConnection });
const teleconsultationReminderQueue = new Queue(QUEUE_NAMES.TELECONSULTATION_REMINDER, { connection: redisConnection });

interface AiPipelineJobData {
  conversationId: string;
  patientPhone: string;
  patientId: string;
  patientName: string | null;
  text: string;
  instanceName: string;
  messageId?: string;
}

const UAZAPI_URL = process.env.UAZAPI_URL || 'https://saraiva.uazapi.com';
const UAZAPI_TOKEN = process.env.UAZAPI_TOKEN || '';

function pickReactionEmoji(text: string): string | null {
  const lower = text.toLowerCase().trim();
  // Saudações
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|hey|hello|e aí|eai)/.test(lower)) return '👋';
  // Gratidão
  if (/(obrigad[oa]|valeu|agradeço|agradeco|brigad[oa])/.test(lower)) return '💛';
  // Confirmação de agendamento / decisão positiva
  if (/\b(quero agendar|vamos l[aá]|bora|vou agendar|pode marcar|marca pra mim)\b/.test(lower)) return '🔥';
  // Dor / sintoma — empatia
  if (/\b(dor|doendo|doer|incomodo|incômodo|sofrendo|mal|passando mal)\b/.test(lower)) return '🫂';
  // Família / filhos — amor
  if (/\b(filh[oa]|beb[eê]|mam[ãa]e|pap[aã]i|gestante|gr[aá]vida|crian[cç]a)\b/.test(lower)) return '❤️';
  // Comemoração / felicidade
  if (/\b(consegui|deu certo|amei|adorei|maravilh|perfeito|otimo|ótimo)\b/.test(lower)) return '🎉';
  // Risada / humor
  if (/\b(kkk|haha|rsrs|😂|🤣)\b/.test(lower)) return '😂';
  return null;
}

async function sendReactionToPatient(
  phone: string,
  messageId: string,
  reaction: string,
  _instanceName: string,
): Promise<void> {
  const number = phone.replace(/\D/g, '');
  try {
    const response = await fetch(`${UAZAPI_URL}/message/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': UAZAPI_TOKEN,
      },
      body: JSON.stringify({
        number,
        id: messageId,
        text: reaction,
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error(`sendReaction error: ${response.status} - ${err}`);
    }
  } catch (err) {
    console.error('sendReaction failed:', err);
  }
}

interface ToolContext {
  patientPhone: string;
  patientName: string | null;
  conversationId: string;
}

// Type for interactive messages (buttons/lists)
interface PendingInteractiveMessage {
  type: 'buttons' | 'list';
  text: string;
  buttons?: Array<{ id: string; text: string }>;
  listButtonText?: string;
  listSections?: Array<{
    title: string;
    items: Array<{ id: string; title: string; description?: string }>;
  }>;
  footerText?: string;
}

// Mutable holder passed by reference to avoid module-level state race conditions
interface InteractiveHolder {
  message: PendingInteractiveMessage | null;
}

const BOOKING_BASE_URL = process.env.BOOKING_BASE_URL || 'https://irb.saraiva.ai/agendar';

// Tool execution handlers
async function executeTool(toolName: string, toolInput: Record<string, unknown>, context?: ToolContext, interactiveHolder?: InteractiveHolder): Promise<string> {
  switch (toolName) {
    case 'get_service_price': {
      const serviceName = toolInput.service_name as string;
      const services = await db.select().from(schema.services)
        .where(ilike(schema.services.name, `%${serviceName}%`));
      if (services.length === 0) return JSON.stringify({ found: false, message: 'Serviço não encontrado' });
      return JSON.stringify({
        found: true,
        services: services.map(s => ({
          name: s.name,
          price: s.priceCents ? `R$ ${(s.priceCents / 100).toFixed(2)}` : 'Consultar',
          duration: s.durationMinutes ? `${s.durationMinutes} min` : null,
        })),
      });
    }

    case 'check_availability': {
      const specialty = toolInput.specialty as string;
      const doctors = await db.select().from(schema.doctors)
        .where(ilike(schema.doctors.specialty, `%${specialty}%`));

      // Try External API for real slots
      const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;
      const KLINGO_EXTERNAL_BASE_URL = process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

      if (KLINGO_APP_TOKEN) {
        try {
          const now = new Date();
          const start = new Date(now);
          start.setDate(start.getDate() + 1);
          const end = new Date(now);
          end.setDate(end.getDate() + 8);

          // Resolve specialty name to Klingo ID
          let especialidadeId: number | undefined;
          try {
            const specRes = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/agenda/especialidades`, {
              headers: { 'Accept': 'application/json', 'X-APP-TOKEN': KLINGO_APP_TOKEN },
            });
            if (specRes.ok) {
              const specData = await specRes.json() as { data?: Array<{ id: number; nome: string }> };
              const specs = Array.isArray(specData.data) ? specData.data : (Array.isArray(specData) ? specData as any[] : []);
              const match = specs.find((s: any) =>
                s.nome && s.nome.toLowerCase().includes(specialty.toLowerCase())
              );
              if (match) especialidadeId = match.id;
            }
          } catch (specErr) {
            console.warn('[ai-pipeline] Could not fetch specialties:', specErr);
          }

          const params = new URLSearchParams({
            inicio: start.toISOString().split('T')[0],
            fim: end.toISOString().split('T')[0],
          });
          if (especialidadeId) params.set('especialidade', String(especialidadeId));

          const res = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/agenda/horarios?${params.toString()}`, {
            headers: {
              'Accept': 'application/json',
              'X-APP-TOKEN': KLINGO_APP_TOKEN,
            },
          });

          if (res.ok) {
            const data = await res.json() as { data?: Array<{ id: number; data: string; hora: string; nome_medico: string; especialidade: string }> };
            const extSlots = Array.isArray(data.data) ? data.data : (Array.isArray(data) ? data as any[] : []);

            // Additional client-side filter by specialty name if Klingo ID was not resolved
            const filtered = extSlots.filter((s: any) =>
              especialidadeId || !specialty || (s.especialidade && s.especialidade.toLowerCase().includes(specialty.toLowerCase()))
            ).slice(0, 6);

            if (filtered.length > 0) {
              return JSON.stringify({
                available: true,
                source: 'klingo_external',
                doctors: doctors.map(d => ({ name: d.name, crm: d.crm })),
                nextSlots: filtered.map((s: any) => ({
                  id: s.id,
                  date: s.data,
                  time: s.hora,
                  doctor: s.nome_medico,
                  specialty: s.especialidade,
                })),
                message: `Temos ${filtered.length} horário(s) disponível(is) em ${specialty}`,
              });
            }
          }
        } catch (err) {
          console.error('[ai-pipeline] External API check_availability error:', err);
        }
      }

      // Fallback: inform that no slots were found — do NOT invent fake slots
      return JSON.stringify({
        available: doctors.length > 0,
        doctors: doctors.map(d => ({ name: d.name, crm: d.crm })),
        nextSlots: [],
        message: doctors.length > 0
          ? `Temos ${doctors.length} médico(s) de ${specialty}, mas não consegui consultar os horários agora. Sugira ao paciente usar o link de agendamento para ver horários em tempo real.`
          : `Não encontrei médicos para ${specialty}. Verifique a especialidade ou sugira ao paciente entrar em contato com a recepção.`,
      });
    }

    case 'book_appointment': {
      const patientNameInput = toolInput.patient_name as string;
      const serviceName = toolInput.service_name as string;
      const doctorNameInput = toolInput.doctor_name as string | undefined;
      const dateTimeStr = toolInput.date_time as string;

      // Parse date
      const scheduledAt = new Date(dateTimeStr.replace(' ', 'T') + ':00');
      if (isNaN(scheduledAt.getTime())) {
        return JSON.stringify({ success: false, message: 'Data/hora inválida. Use o formato YYYY-MM-DD HH:mm' });
      }

      // Find doctor
      let doctorId: string | undefined;
      let doctorKlingoId: number | undefined;
      if (doctorNameInput) {
        const [doctor] = await db.select().from(schema.doctors)
          .where(ilike(schema.doctors.name, `%${doctorNameInput}%`))
          .limit(1);
        if (doctor) {
          doctorId = doctor.id;
          doctorKlingoId = doctor.klingoId ?? undefined;
        }
      }

      // Find service
      let serviceId: string | undefined;
      const [service] = await db.select().from(schema.services)
        .where(ilike(schema.services.name, `%${serviceName}%`))
        .limit(1);
      if (service) serviceId = service.id;

      // Check for conflicting appointment (double-booking protection)
      if (doctorId) {
        const slotEnd = new Date(scheduledAt);
        slotEnd.setMinutes(slotEnd.getMinutes() + (service?.durationMinutes || 30));
        const [conflict] = await db.select({ id: schema.appointments.id })
          .from(schema.appointments)
          .where(and(
            eq(schema.appointments.doctorId, doctorId),
            gte(schema.appointments.scheduledAt, scheduledAt),
            lt(schema.appointments.scheduledAt, slotEnd),
            ne(schema.appointments.status, 'cancelled'),
          ))
          .limit(1);
        if (conflict) {
          return JSON.stringify({ success: false, message: 'Este horário já está ocupado. Sugira outro horário ao paciente.' });
        }
      }

      // Find or create patient
      let patientId: string | undefined;
      let patientKlingoId: number | undefined;
      if (context?.patientPhone) {
        const [patient] = await db.select().from(schema.patients)
          .where(eq(schema.patients.phone, context.patientPhone))
          .limit(1);
        if (patient) {
          patientId = patient.id;
          patientKlingoId = patient.klingoPatientId ?? undefined;
          if (!patient.name && patientNameInput) {
            await db.update(schema.patients)
              .set({ name: patientNameInput, updatedAt: new Date() })
              .where(eq(schema.patients.id, patient.id));
          }
        } else {
          const [newPatient] = await db.insert(schema.patients)
            .values({ phone: context.patientPhone, name: patientNameInput, source: 'ai_booking' })
            .returning({ id: schema.patients.id });
          patientId = newPatient.id;
        }
      }

      // Create the appointment locally
      const KLINGO_APP_TOKEN_BOOK = process.env.KLINGO_APP_TOKEN;
      const KLINGO_BASE_BOOK = process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

      const [appointment] = await db.insert(schema.appointments).values({
        patientId,
        doctorId,
        serviceId,
        scheduledAt,
        status: 'scheduled',
        createdBy: 'ai',
        conversationMongoId: context?.conversationId,
        klingoSyncStatus: KLINGO_APP_TOKEN_BOOK ? 'pending' : 'skipped',
      }).returning({ id: schema.appointments.id });

      // Sync with Klingo: reserve slot + confirm booking
      let klingoSynced = false;
      if (KLINGO_APP_TOKEN_BOOK && patientKlingoId) {
        try {
          // First, find matching slot in Klingo
          const dateStr = scheduledAt.toISOString().split('T')[0];
          const slotsRes = await fetch(`${KLINGO_BASE_BOOK}/api/agenda/horarios?inicio=${dateStr}&fim=${dateStr}`, {
            headers: { 'Accept': 'application/json', 'X-APP-TOKEN': KLINGO_APP_TOKEN_BOOK },
          });

          if (slotsRes.ok) {
            const slotsData = await slotsRes.json() as { data?: Array<{ id: number; data: string; hora: string; id_medico: number }> };
            const slots = Array.isArray(slotsData.data) ? slotsData.data : [];
            const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

            // Match by time (and doctor if available)
            const matchingSlot = slots.find(s =>
              s.hora === timeStr && (!doctorKlingoId || s.id_medico === doctorKlingoId)
            ) || slots.find(s => s.hora === timeStr);

            if (matchingSlot) {
              // Reserve the slot (10 min hold)
              const reserveRes = await fetch(`${KLINGO_BASE_BOOK}/api/agenda/reservar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-APP-TOKEN': KLINGO_APP_TOKEN_BOOK },
                body: JSON.stringify({ id_horario: matchingSlot.id, id_paciente: patientKlingoId }),
              });

              if (reserveRes.ok) {
                const reserveData = await reserveRes.json() as { data?: { id: string } };
                const reservationId = reserveData.data?.id;

                if (reservationId) {
                  // Confirm the booking
                  const confirmRes = await fetch(`${KLINGO_BASE_BOOK}/api/agenda/horario`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-APP-TOKEN': KLINGO_APP_TOKEN_BOOK },
                    body: JSON.stringify({ id_reserva: reservationId, id_paciente: patientKlingoId }),
                  });

                  if (confirmRes.ok) {
                    const confirmData = await confirmRes.json() as { data?: { voucher_id: number } };
                    await db.update(schema.appointments).set({
                      klingoSyncStatus: 'synced',
                      klingoVoucherId: confirmData.data?.voucher_id ?? null,
                      klingoReservationId: reservationId,
                    }).where(eq(schema.appointments.id, appointment.id));
                    klingoSynced = true;
                    console.log(`[ai-pipeline] Klingo booking synced: voucher=${confirmData.data?.voucher_id}`);
                  }
                }
              }
            }
          }

          if (!klingoSynced) {
            await db.update(schema.appointments).set({
              klingoSyncStatus: 'failed',
              klingoSyncError: 'No matching slot found in Klingo or reservation failed',
            }).where(eq(schema.appointments.id, appointment.id));
            console.warn('[ai-pipeline] Klingo sync failed: no matching slot or reservation error');
          }
        } catch (klingoErr) {
          console.error('[ai-pipeline] Klingo booking sync error:', klingoErr);
          await db.update(schema.appointments).set({
            klingoSyncStatus: 'failed',
            klingoSyncError: (klingoErr as Error).message,
          }).where(eq(schema.appointments.id, appointment.id));
        }
      }

      const dateFormatted = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      const timeFormatted = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return JSON.stringify({
        success: true,
        appointmentId: appointment.id,
        klingoSynced,
        message: `Agendamento confirmado para ${dateFormatted} às ${timeFormatted}`,
        details: {
          patient: patientNameInput,
          service: service?.name || serviceName,
          doctor: doctorNameInput,
          dateTime: `${dateFormatted} às ${timeFormatted}`,
          price: service?.priceCents ? `R$ ${(service.priceCents / 100).toFixed(2)}` : null,
        },
      });
    }

    case 'get_knowledge': {
      const topic = toolInput.topic as string;
      // Semantic search via RAG instead of exact match
      const chunks = await searchKnowledge(topic, 3);
      if (chunks.length === 0) {
        // Fallback to exact match in knowledge_base table
        const [entry] = await db.select().from(schema.knowledgeBase)
          .where(eq(schema.knowledgeBase.key, topic))
          .limit(1);
        if (!entry) return JSON.stringify({ found: false });
        return JSON.stringify({ found: true, answer: entry.answer });
      }
      return JSON.stringify({
        found: true,
        answer: chunks.map(c => c.content).join('\n\n'),
        sources: chunks.map(c => ({ section: c.section, score: c.score.toFixed(3) })),
      });
    }

    case 'escalate_to_human': {
      return JSON.stringify({
        escalated: true,
        message: 'Conversa transferida para atendente humano',
      });
    }

    case 'send_interactive_message': {
      console.log('[TOOL] send_interactive_message called with:', toolInput);
      const messageType = toolInput.message_type as 'buttons' | 'list';
      const text = toolInput.text as string;
      const buttons = toolInput.buttons as Array<{ id: string; text: string }> | undefined;
      const listButtonText = toolInput.list_button_text as string | undefined;
      const listSections = toolInput.list_sections as Array<{
        title: string;
        items: Array<{ id: string; title: string; description?: string }>;
      }> | undefined;
      const footerText = toolInput.footer_text as string | undefined;

      // Validate based on type
      if (messageType === 'buttons') {
        if (!buttons || buttons.length === 0 || buttons.length > 3) {
          return JSON.stringify({
            success: false,
            error: 'Botões devem ter entre 1 e 3 opções',
          });
        }
        // Validate button text length
        for (const btn of buttons) {
          if (btn.text.length > 20) {
            return JSON.stringify({
              success: false,
              error: `Texto do botão "${btn.text}" excede 20 caracteres`,
            });
          }
        }
      } else if (messageType === 'list') {
        if (!listSections || listSections.length === 0) {
          return JSON.stringify({
            success: false,
            error: 'Lista precisa de pelo menos uma seção com itens',
          });
        }
        if (!listButtonText) {
          return JSON.stringify({
            success: false,
            error: 'Lista precisa de um texto para o botão (list_button_text)',
          });
        }
      }

      // Store the interactive message to be sent (via holder to avoid race conditions)
      const interactiveMsg: PendingInteractiveMessage = {
        type: messageType,
        text,
        buttons,
        listButtonText,
        listSections,
        footerText,
      };

      if (interactiveHolder) {
        interactiveHolder.message = interactiveMsg;
      }

      console.log('[TOOL] Interactive message stored:', interactiveMsg);

      return JSON.stringify({
        success: true,
        message: 'Mensagem interativa configurada! Os botões serão enviados automaticamente após sua resposta de texto.',
        type: messageType,
        interactiveText: text,
        optionsCount: messageType === 'buttons' ? buttons?.length : listSections?.reduce((acc, s) => acc + s.items.length, 0),
      });
    }

    case 'generate_booking_link': {
      const specialty = toolInput.specialty as string;
      const doctorName = toolInput.doctor_name as string | undefined;
      const serviceName = toolInput.service_name as string | undefined;

      // Find doctor if specified
      let doctorId: string | undefined;
      if (doctorName) {
        const [doctor] = await db.select().from(schema.doctors)
          .where(ilike(schema.doctors.name, `%${doctorName}%`))
          .limit(1);
        if (doctor) doctorId = doctor.id;
      }

      // Find service if specified
      let serviceId: string | undefined;
      if (serviceName) {
        const [service] = await db.select().from(schema.services)
          .where(ilike(schema.services.name, `%${serviceName}%`))
          .limit(1);
        if (service) serviceId = service.id;
      }

      // Generate token and expiration (48h)
      const token = nanoid(21);
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48);

      // Insert booking link
      await db.insert(schema.bookingLinks).values({
        token,
        patientPhone: context?.patientPhone || null,
        patientName: context?.patientName || null,
        conversationMongoId: context?.conversationId || null,
        specialty,
        doctorId: doctorId || null,
        serviceId: serviceId || null,
        status: 'pending',
        expiresAt,
      });

      const url = `${BOOKING_BASE_URL}/${token}`;
      return JSON.stringify({
        success: true,
        url,
        token,
        expiresAt: expiresAt.toISOString(),
        message: `Link de agendamento criado: ${url}`,
      });
    }

    case 'cancel_appointment': {
      const KLINGO_APP_TOKEN = process.env.KLINGO_APP_TOKEN;
      const KLINGO_EXTERNAL_BASE_URL = process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

      if (!context?.patientPhone) {
        return JSON.stringify({ success: false, message: 'Paciente não identificado' });
      }

      // Find patient's upcoming appointments
      const [patient] = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.phone, context.patientPhone))
        .limit(1);

      if (!patient) {
        return JSON.stringify({ success: false, message: 'Paciente não encontrado' });
      }

      const now = new Date();
      const upcomingAppts = await db.select()
        .from(schema.appointments)
        .where(and(
          eq(schema.appointments.patientId, patient.id),
          gte(schema.appointments.scheduledAt, now),
          ne(schema.appointments.status, 'cancelled'),
        ));

      if (upcomingAppts.length === 0) {
        return JSON.stringify({ success: false, message: 'Nenhum agendamento futuro encontrado' });
      }

      // Cancel the nearest appointment
      const nextAppt = upcomingAppts.sort((a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      )[0];

      // Try to cancel via External API
      let klingoCancelled = false;
      if (KLINGO_APP_TOKEN && nextAppt.klingoVoucherId) {
        try {
          const cancelRes = await fetch(`${KLINGO_EXTERNAL_BASE_URL}/api/voucher?id=${nextAppt.klingoVoucherId}`, {
            method: 'DELETE',
            headers: { 'X-APP-TOKEN': KLINGO_APP_TOKEN, 'Accept': 'application/json' },
          });
          if (cancelRes.ok) {
            klingoCancelled = true;
          } else {
            const errText = await cancelRes.text();
            console.error(`[ai-pipeline] Klingo cancel returned ${cancelRes.status}: ${errText}`);
          }
        } catch (err) {
          console.error('[ai-pipeline] External API cancel error:', err);
        }
      }

      // Update local status
      await db.update(schema.appointments)
        .set({
          status: 'cancelled',
          klingoSyncStatus: klingoCancelled ? 'synced' : (nextAppt.klingoVoucherId ? 'failed' : 'skipped'),
        })
        .where(eq(schema.appointments.id, nextAppt.id));

      const dateFormatted = new Date(nextAppt.scheduledAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const timeFormatted = new Date(nextAppt.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return JSON.stringify({
        success: true,
        message: `Consulta de ${dateFormatted} às ${timeFormatted} cancelada com sucesso`,
      });
    }

    case 'get_patient_appointments': {
      if (!context?.patientPhone) {
        return JSON.stringify({ success: false, message: 'Paciente não identificado' });
      }

      const [patient] = await db.select()
        .from(schema.patients)
        .where(eq(schema.patients.phone, context.patientPhone))
        .limit(1);

      if (!patient) {
        return JSON.stringify({ appointments: [], message: 'Nenhum agendamento encontrado' });
      }

      const now = new Date();
      const appointments = await db.select({
        id: schema.appointments.id,
        scheduledAt: schema.appointments.scheduledAt,
        status: schema.appointments.status,
        doctorName: schema.doctors.name,
        specialty: schema.doctors.specialty,
      })
        .from(schema.appointments)
        .leftJoin(schema.doctors, eq(schema.appointments.doctorId, schema.doctors.id))
        .where(and(
          eq(schema.appointments.patientId, patient.id),
          gte(schema.appointments.scheduledAt, now),
          ne(schema.appointments.status, 'cancelled'),
        ));

      if (appointments.length === 0) {
        return JSON.stringify({ appointments: [], message: 'Nenhum agendamento futuro encontrado' });
      }

      return JSON.stringify({
        appointments: appointments.map(a => ({
          date: new Date(a.scheduledAt).toLocaleDateString('pt-BR'),
          time: new Date(a.scheduledAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          doctor: a.doctorName,
          specialty: a.specialty,
          status: a.status,
        })),
        message: `Encontrei ${appointments.length} agendamento(s) futuro(s)`,
      });
    }

    case 'check_exam_results': {
      // This would need exam data from Klingo. For now, return a helpful response.
      return JSON.stringify({
        success: true,
        results: [],
        message: 'Para verificar resultados de exames, o paciente pode acessar o portal do paciente ou entrar em contato com a recepção.',
      });
    }

    case 'send_location': {
      // Location will be sent by message-send processor
      return JSON.stringify({
        success: true,
        message: 'Localização da IRB Prime Care enviada no mapa! O paciente pode abrir no Waze ou Google Maps.',
        address: 'Rua Boa Vista, 99 - 6º Andar, Centro, São Paulo - SP',
        reference: 'Próximo ao Metrô São Bento, acima da Rua 25 de Março',
      });
    }

    case 'generate_teleconsultation_link': {
      const specialty = toolInput.specialty as string;
      const doctorName = toolInput.doctor_name as string | undefined;
      const scheduledAtStr = toolInput.scheduled_at as string;

      // Parse date
      const scheduledAt = new Date(scheduledAtStr.replace(' ', 'T') + ':00');
      if (isNaN(scheduledAt.getTime())) {
        return JSON.stringify({ success: false, message: 'Data/hora inválida. Use o formato YYYY-MM-DD HH:mm' });
      }

      // Find doctor by name or specialty
      let doctor: { id: string; name: string; specialty: string | null } | undefined;
      if (doctorName) {
        const [found] = await db.select({ id: schema.doctors.id, name: schema.doctors.name, specialty: schema.doctors.specialty })
          .from(schema.doctors)
          .where(ilike(schema.doctors.name, `%${doctorName}%`))
          .limit(1);
        doctor = found;
      }
      if (!doctor) {
        const [found] = await db.select({ id: schema.doctors.id, name: schema.doctors.name, specialty: schema.doctors.specialty })
          .from(schema.doctors)
          .where(ilike(schema.doctors.specialty, `%${specialty}%`))
          .limit(1);
        doctor = found;
      }
      if (!doctor) {
        return JSON.stringify({ success: false, message: `Nenhum médico encontrado para ${specialty}. Verifique a especialidade.` });
      }

      // Find or create patient
      let patientId: string | undefined;
      if (context?.patientPhone) {
        const [patient] = await db.select().from(schema.patients)
          .where(eq(schema.patients.phone, context.patientPhone))
          .limit(1);
        if (patient) {
          patientId = patient.id;
        } else {
          const [newPatient] = await db.insert(schema.patients)
            .values({ phone: context.patientPhone, name: context.patientName, source: 'ai_teleconsulta' })
            .returning({ id: schema.patients.id });
          patientId = newPatient.id;
        }
      }

      if (!patientId) {
        return JSON.stringify({ success: false, message: 'Paciente não identificado' });
      }

      // Generate room code and token
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      const part = () => Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => chars[b % chars.length]).join('');
      const roomCode = `${part()}-${part()}`;

      const tokenChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      const patientToken = Array.from(crypto.getRandomValues(new Uint8Array(20)))
        .map(b => tokenChars[b % tokenChars.length]).join('');

      // Create teleconsultation room
      const [room] = await db.insert(schema.teleconsultationRooms).values({
        patientId,
        doctorId: doctor.id,
        roomCode,
        patientToken,
        status: 'waiting',
        scheduledAt,
      }).returning({ id: schema.teleconsultationRooms.id });

      // Schedule reminders (30min and 5min before)
      const scheduledTime = scheduledAt.getTime();
      const now = Date.now();

      const reminder30 = scheduledTime - 30 * 60 * 1000;
      if (reminder30 > now) {
        await teleconsultationReminderQueue.add('reminder-30min', {
          teleconsultationId: room.id,
          minutesBefore: 30,
        }, { delay: reminder30 - now, removeOnComplete: 50 });
      }

      const reminder5 = scheduledTime - 5 * 60 * 1000;
      if (reminder5 > now) {
        await teleconsultationReminderQueue.add('reminder-5min', {
          teleconsultationId: room.id,
          minutesBefore: 5,
        }, { delay: reminder5 - now, removeOnComplete: 50 });
      }

      const teleconsultaUrl = `${process.env.TELECONSULTA_BASE_URL || 'https://irb.saraiva.ai/consulta'}/${patientToken}`;

      const dateFormatted = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' });
      const timeFormatted = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      return JSON.stringify({
        success: true,
        url: teleconsultaUrl,
        roomCode,
        doctor: doctor.name,
        specialty: doctor.specialty,
        scheduledAt: `${dateFormatted} às ${timeFormatted}`,
        message: `Link de teleconsulta criado! O paciente pode acessar pelo link: ${teleconsultaUrl}`,
      });
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export async function processAiPipeline(job: Job<AiPipelineJobData>) {
  const { conversationId, patientPhone, patientId, patientName, instanceName, messageId } = job.data;
  let { text } = job.data;
  const startTime = Date.now();

  // Job-scoped holder for interactive messages (no module-level state = no race conditions)
  const interactiveHolder: InteractiveHolder = { message: null };

  // Resolve debounced messages: aggregate all buffered texts into one
  if (text === '__DEBOUNCED__') {
    const debounceKey = `debounce:${patientPhone}`;
    const bufferedTexts = await redis.lrange(debounceKey, 0, -1);
    await redis.del(debounceKey);
    await redis.del(`debounce_job:${patientPhone}`);
    text = bufferedTexts.join('\n');
    if (!text.trim()) return { status: 'skipped', reason: 'empty_debounce' };
  }

  // 0. Send reaction emoji only for greetings/thanks (keep it minimal)
  if (messageId) {
    const emoji = pickReactionEmoji(text);
    if (emoji) {
      sendReactionToPatient(patientPhone, messageId, emoji, instanceName);
    }
  }

  // 1. Load conversation
  const conversation = await ConversationModel.findById(conversationId);
  if (!conversation || !conversation.isAiHandling) return { status: 'skipped' };

  // 1.5 🔥 CANCELAR recuperador de atenção pendente — paciente respondeu!
  try {
    const recoveryJobId = `attention_recovery_${conversationId}`;
    const pendingJob = await followUpQueue.getJob(recoveryJobId);
    if (pendingJob) {
      await pendingJob.remove();
      console.log(`[AI-PIPELINE] 🔥 Cancelled attention recovery for ${patientPhone} — patient responded`);
    }
  } catch (err) {
    // Ignora erro se job não existir
  }

  // 2. Classify intent from patient message
  const { primary: intent, all: allIntents } = classifyIntent(text);

  // 3. Detect escape phrases
  const escapeResult = detectEscapePhrase(text);

  // 4. RAG: Search relevant knowledge chunks based on patient message
  let ragContext = '';
  try {
    const ragChunks = await searchKnowledge(text, 5);
    ragContext = formatChunksForPrompt(ragChunks);
  } catch (err) {
    console.error('RAG search failed, continuing without:', err);
  }

  // 5. Build context for Claude (with RAG chunks injected + active doctors)
  const knowledgeBase = await loadKnowledgeBase();
  const activeDoctors = await db.select({
    name: schema.doctors.name,
    specialty: schema.doctors.specialty,
    crm: schema.doctors.crm,
  }).from(schema.doctors).where(eq(schema.doctors.isActive, true));

  const context = buildContext({
    conversation: conversation as any,
    knowledgeBase,
    patientInfo: patientName ? { name: patientName } : null,
    ragContext,
    doctors: activeDoctors,
  });

  // 6. Call Claude
  console.log('[AI-PIPELINE] Calling Claude with', aiTools.length, 'tools available');
  let response = await callClaude({
    systemPrompt: context.systemPrompt,
    messages: context.messages,
    tools: aiTools,
  });
  console.log('[AI-PIPELINE] Claude response:', {
    text: response.text?.substring(0, 100),
    toolCallsCount: response.toolCalls.length,
    toolNames: response.toolCalls.map(tc => tc.name),
  });

  // 7. Handle tool calls (loop until no more tool calls)
  const toolsUsed: string[] = [];
  let totalPromptTokens = response.promptTokens;
  let totalCompletionTokens = response.completionTokens;

  while (response.toolCalls.length > 0) {
    // Build assistant message with tool calls for OpenAI format
    const assistantMsg: any = {
      role: 'assistant' as const,
      content: response.text || null,
      tool_calls: response.toolCalls.map(tc => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.input) },
      })),
    };

    const toolResultMsgs: any[] = [];
    for (const toolCall of response.toolCalls) {
      toolsUsed.push(toolCall.name);
      const toolContext: ToolContext = { patientPhone, patientName, conversationId };
      const result = await executeTool(toolCall.name, toolCall.input as Record<string, unknown>, toolContext, interactiveHolder);
      toolResultMsgs.push({
        role: 'tool' as const,
        tool_call_id: toolCall.id,
        content: result,
      });
    }

    // Re-call with tool results
    const updatedMessages = [
      ...context.messages,
      assistantMsg,
      ...toolResultMsgs,
    ];

    response = await callClaude({
      systemPrompt: context.systemPrompt,
      messages: updatedMessages,
      tools: aiTools,
    });

    totalPromptTokens += response.promptTokens;
    totalCompletionTokens += response.completionTokens;
  }

  const latencyMs = Date.now() - startTime;
  // Strip tool name leaks from AI text (model sometimes writes tool names as text)
  const TOOL_NAMES = ['send_interactive_message', 'check_availability', 'get_service_price', 'book_appointment', 'get_knowledge', 'generate_booking_link', 'escalate_to_human', 'cancel_appointment', 'get_patient_appointments', 'check_exam_results', 'send_location', 'generate_teleconsultation_link'];
  let aiText = response.text;
  for (const toolName of TOOL_NAMES) {
    aiText = aiText.replace(new RegExp(`\\b${toolName}\\b`, 'gi'), '').trim();
  }
  // Remove leftover empty lines
  aiText = aiText.replace(/\n{3,}/g, '\n\n').trim();

  // Auto-detect bullet points / numbered lists and convert to interactive buttons
  // This catches cases where the AI writes options as text instead of calling the tool
  // BUT: Don't do this if send_interactive_message was already called!
  const alreadySentInteractive = toolsUsed.includes('send_interactive_message');
  if (!interactiveHolder.message && !alreadySentInteractive) {
    const bulletRegex = /^[\s]*(?:[•\-\*]|\d+[\.\)])\s*(.+)$/gm;
    const bullets: string[] = [];
    let match;
    while ((match = bulletRegex.exec(aiText)) !== null) {
      const item = match[1].trim();
      if (item.length > 0 && item.length <= 40) bullets.push(item);
    }

    if (bullets.length >= 2 && bullets.length <= 3) {
      // Extract the text BEFORE the bullet points as the interactive text
      const firstBulletIndex = aiText.search(/^[\s]*(?:[•\-\*]|\d+[\.\)])\s*/m);
      const textBefore = firstBulletIndex > 0 ? aiText.substring(0, firstBulletIndex).trim() : '';
      const interactiveText = textBefore || 'Escolha uma das opções:';

      interactiveHolder.message = {
        type: 'buttons',
        text: interactiveText,
        buttons: bullets.map((b, i) => ({
          id: b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').substring(0, 20),
          text: b.length > 20 ? b.substring(0, 19) + '…' : b,
        })),
        footerText: 'IRB Prime Care',
      };

      // Remove bullet points from AI text since they'll be buttons now
      aiText = textBefore;
      console.log('[AI-PIPELINE] Auto-converted bullet points to buttons:', interactiveHolder.message.buttons);
    } else if (bullets.length > 3 && bullets.length <= 10) {
      // Too many for buttons, use a list
      const firstBulletIndex = aiText.search(/^[\s]*(?:[•\-\*]|\d+[\.\)])\s*/m);
      const textBefore = firstBulletIndex > 0 ? aiText.substring(0, firstBulletIndex).trim() : '';
      const interactiveText = textBefore || 'Escolha uma das opções:';

      interactiveHolder.message = {
        type: 'list',
        text: interactiveText,
        listButtonText: 'Ver opções',
        listSections: [{
          title: 'Opções',
          items: bullets.map((b, i) => ({
            id: b.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').substring(0, 20),
            title: b.length > 24 ? b.substring(0, 23) + '…' : b,
          })),
        }],
        footerText: 'IRB Prime Care',
      };

      aiText = textBefore;
      console.log('[AI-PIPELINE] Auto-converted bullet points to list:', bullets.length, 'items');
    }
  }

  // 8. Check escalation
  // Derive AI confidence from stop reason and tool usage
  const aiConfidence = response.stopReason === 'stop' && toolsUsed.length > 0 ? 0.85
    : response.stopReason === 'stop' ? 0.7
    : 0.5;

  // Track consecutive unknowns from conversation history
  let consecutiveUnknowns = 0;
  const recentAiMsgs = [...conversation.messages].reverse().filter(m => m.sender === 'ai');
  for (const msg of recentAiMsgs) {
    if (msg.aiMetadata?.intentClassified === 'unknown' || msg.aiMetadata?.intentClassified === 'other') {
      consecutiveUnknowns++;
    } else {
      break;
    }
  }

  const escalationCheck = checkEscalation({
    patientMessage: text,
    aiConfidence,
    intent,
    consecutiveUnknowns,
    sentimentScore: conversation.sentimentScore,
  });

  if (escalationCheck.shouldEscalate && escalationCheck.reason) {
    // Create escalation in PostgreSQL
    await db.insert(schema.escalations).values({
      conversationMongoId: conversationId,
      patientId,
      reason: escalationCheck.reason,
      priority: escalationCheck.priority,
    });

    conversation.status = 'escalated';
    conversation.isAiHandling = false;

    await publishEvent('channel:escalations', {
      type: 'escalation:created',
      payload: {
        conversationId,
        patientPhone,
        patientName,
        reason: escalationCheck.reason,
        priority: escalationCheck.priority,
      },
      timestamp: new Date(),
    });
  }

  // 9. State transition
  const transition = transitionState(conversation.state as any, intent, {
    isEscalated: escalationCheck.shouldEscalate,
    escapePhraseDetected: escapeResult.detected,
  });

  if (transition.changed) {
    conversation.previousStates.push({ state: conversation.state, at: new Date() });
    conversation.state = transition.newState;
  }

  // 10. Add AI message to conversation
  conversation.messages.push({
    sender: 'ai',
    text: aiText,
    type: 'text',
    deliveryStatus: 'pending',
    aiMetadata: {
      promptTokens: totalPromptTokens,
      completionTokens: totalCompletionTokens,
      model: response.model,
      confidenceScore: 0.8,
      intentClassified: intent,
      stateTransition: transition.changed ? { from: conversation.previousStates.at(-1)?.state || '', to: transition.newState } : null,
      toolsUsed,
      interactiveMessagesCount: toolsUsed.filter(t => t === 'send_interactive_message').length,
      latencyMs,
    },
    timestamp: new Date(),
  });

  // Update conversation metrics
  conversation.metrics.totalMessages += 1;
  conversation.metrics.aiMessages += 1;
  conversation.detectedIntents = [...new Set([...conversation.detectedIntents, ...allIntents])];
  conversation.escapePhraseDetected = escapeResult.detected || conversation.escapePhraseDetected;
  conversation.lastMessageAt = new Date();

  if (patientName && !conversation.patientName) {
    conversation.patientName = patientName;
  }

  await conversation.save();

  // 11. Schedule follow-up if escape phrase detected
  if (escapeResult.detected) {
    await followUpQueue.add('follow-up', {
      conversationId,
      patientPhone,
      patientName,
      type: 'escape_phrase',
    }, {
      delay: 24 * 60 * 60 * 1000, // 24 hours
      removeOnComplete: 50,
    });
  }

  // 12. Enqueue message to send (with interactive message if tool was used)
  const sendJobData: {
    conversationId: string;
    patientPhone: string;
    text: string;
    instanceName: string;
    interactive?: {
      type: 'buttons' | 'list';
      text: string;
      buttons?: Array<{ id: string; text: string }>;
      listButtonText?: string;
      listSections?: Array<{
        title: string;
        items: Array<{ id: string; title: string; description?: string }>;
      }>;
      footerText?: string;
    };
  } = {
    conversationId,
    patientPhone,
    text: aiText,
    instanceName,
  };

  // If an interactive message was configured via tool, include it
  if (interactiveHolder.message) {
    console.log('[AI-PIPELINE] Adding interactive message to send job:', interactiveHolder.message);
    sendJobData.interactive = interactiveHolder.message;
  } else {
    console.log('[AI-PIPELINE] No interactive message pending');
    
    // Detect if AI promised buttons but didn't call the tool
    const promisedButtons = /vou (deixar|mandar|enviar|te mandar|mostrar).*(opç[õo]es?|bot[õa]o|botões|menu|lista)/i.test(aiText);
    
    // Also detect first contact / greeting scenarios that should always have buttons
    const isFirstContact = conversation.messages.filter(m => m.sender === 'patient').length <= 1;
    const isGreeting = /^(oi|olá|ola|bom dia|boa tarde|boa noite|e ai|eai|hey|hello|hi)\b/i.test(text);
    const shouldHaveButtons = promisedButtons || (isFirstContact && isGreeting);
    
    if (shouldHaveButtons) {
      console.warn('[AI-PIPELINE] ⚠️ AI SHOULD HAVE SENT BUTTONS BUT DIDNT - Adding fallback buttons...');
      console.warn('[AI-PIPELINE] isFirstContact:', isFirstContact, 'isGreeting:', isGreeting, 'promisedButtons:', promisedButtons);
      
      // Add fallback buttons based on context
      // Since the AI didn't call the tool, we'll add sensible defaults
      if (isFirstContact || isGreeting) {
        // First contact: triage buttons
        interactiveHolder.message = {
          type: 'buttons',
          text: aiText.replace(/vou (deixar|mandar|enviar|te mandar|mostrar).*(opç[õo]es?|bot[õa]o|botões|menu|lista).*$/i, '').trim() || aiText,
          buttons: [
            { id: 'sintoma', text: 'Tenho um sintoma' },
            { id: 'checkup', text: 'Quero check-up' },
            { id: 'conhecer', text: 'Conhecer a clínica' },
          ],
          footerText: 'IRB Prime Care',
        };
        sendJobData.interactive = interactiveHolder.message;
        // Clean up the text - remove the promise since we're delivering buttons
        aiText = aiText.replace(/\n*vou (deixar|mandar|enviar|te mandar|mostrar).*(opç[õo]es?|bot[õa]o|botões|menu|lista).*$/i, '').trim();
        sendJobData.text = aiText;
        console.log('[AI-PIPELINE] ✅ Added fallback triage buttons');
      } else if (promisedButtons) {
        // Generic case: remove the broken promise from text
        aiText = aiText.replace(/\n*vou (deixar|mandar|enviar|te mandar|mostrar).*(opç[õo]es?|bot[õa]o|botões|menu|lista).*$/i, '').trim();
        sendJobData.text = aiText;
        console.log('[AI-PIPELINE] Removed unfulfilled button promise from text');
      }
    }
  }

  // If send_location tool was used, flag to send location
  if (toolsUsed.includes('send_location')) {
    (sendJobData as any).sendLocation = true;
  }

  await messageSendQueue.add('send', sendJobData, {
    removeOnComplete: 100,
    removeOnFail: 500,
  });

  // 13. 🔥 RECUPERADOR DE ATENÇÃO — Agenda quando enviamos mensagem interativa
  // Se enviamos botões, esperamos resposta. Se não vier, ativa o recuperador.
  if (interactiveHolder.message && !escalationCheck.shouldEscalate) {
    // Determina contexto para mensagens de recuperação
    const recoveryContext = intent === 'appointment_booking' ? 'agendamento'
      : intent === 'price_inquiry' ? 'precos'
      : intent === 'service_info' ? 'informacoes'
      : 'conversa';

    await followUpQueue.add('follow-up', {
      conversationId,
      patientPhone,
      patientName,
      type: 'attention_recovery',
      attempt: 1,
      lastContext: recoveryContext,
    }, {
      delay: 30 * 60 * 1000, // Primeira tentativa em 30 minutos
      removeOnComplete: 50,
      jobId: `attention_recovery_${conversationId}`, // ID único para poder cancelar
    });

    console.log(`[AI-PIPELINE] 🔥 Attention recovery scheduled for ${patientPhone} in 30min`);
  }

  // 14. Enqueue analytics
  await analyticsQueue.add('update', {
    conversationId,
    intent,
    latencyMs,
    toolsUsed,
    escalated: escalationCheck.shouldEscalate,
  }, { removeOnComplete: 50 });

  return { status: 'processed', intent, latencyMs, toolsUsed };
}

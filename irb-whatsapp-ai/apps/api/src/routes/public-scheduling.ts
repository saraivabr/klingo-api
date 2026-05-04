/**
 * Public Scheduling Routes (no auth required)
 * Used by the agendamento.html static page to fetch real Klingo data.
 *
 * Endpoints:
 *   GET  /api/public/scheduling/specialties     - List specialties from Klingo
 *   GET  /api/public/scheduling/exams           - List exams from Klingo
 *   GET  /api/public/scheduling/professionals    - List professionals (optional: ?especialidade=ID&exame=ID)
 *   GET  /api/public/scheduling/slots            - Available slots (?especialidade=ID&exame=ID&profissional=ID&inicio=YYYY-MM-DD&fim=YYYY-MM-DD)
 *   POST /api/public/scheduling/book             - Create a booking request
 */
import { FastifyInstance } from 'fastify';
import { getKlingoExternalClient } from '../services/klingo-external-client.js';
import { db, schema } from '@irb/database';
import { eq, and, ilike, gte, lt, ne } from 'drizzle-orm';

// Map specialty names to procedure IDs for slot lookup
// Synced with booking.ts CONSULTA_PROCEDURE_MAP (canonical source)
const CONSULTA_PROCEDURE_MAP: Record<string, number> = {
  'cardiologia': 416,
  'clinica medica': 1000,
  'clinica geral': 1000,
  'gastroenterologia': 1293,
  'neurologia': 1312,
  'reumatologia': 1340,
  'dermatologia': 1281,
  'odontologia': 1105,
  'psiquiatria': 1322,
  'ginecologia': 1290,
  'ortopedia': 1301,
  'urologia': 1341,
  'oftalmologia': 1295,
  'pneumologia': 1318,
  'pediatria': 1316,
  'endocrinologia': 1027,
  'geriatria': 1343,
  'cirurgia vascular': 1272,
  'fonoaudiologia': 1198,
  'nutricao': 1204,
  'psicologia': 1321,
  'fisioterapia': 1218,
};

// Specialties to hide from patients (internal/administrative)
const HIDDEN_SPECIALTIES = new Set([
  'AUXILIAR ENFERMAGEM', 'BIOQUIMICO', 'ENFERMAGEM', 'FARMACEUTICO',
  'SENHA DO ATENDIMENTO', 'RADIOLOGIA', 'ANESTESIOLOGIA',
  'TERAPEUTA OCUPACIONA', 'ULTRA-SONOGRAFIA', 'ENDOSCOPIA DIGESTIVA',
  'FISIATRIA', 'HEMATOLOGIA', 'INFECTOLOGIA', 'NEFROLOGIA',
  'CIR.CABECA E PESCOÇO', 'CIRURGIA GERAL', 'CIRURGIA PLÁSTICA',
  'CUIDADOS PALIATIVOS', 'GINECO OBSTETRICIA', 'NEUROPEDIATRIA',
  'NUTROLOGO', 'MEDICINA DO TRABALHO', 'ACUPUNTURA-TERAPEUTA',
  'ALERGOLOGIA',
]);

function toTitleCase(str: string): string {
  return str.toLowerCase().replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
}

export async function publicSchedulingRoutes(app: FastifyInstance) {

  // GET /specialties - list available specialties
  app.get('/specialties', async (_request, reply) => {
    const klingoExt = getKlingoExternalClient();
    if (!klingoExt) {
      return reply.send({ source: 'fallback', specialties: getFallbackSpecialties() });
    }

    try {
      const result = await klingoExt.getSpecialties() as any;
      const specs = Array.isArray(result) ? result
        : Array.isArray(result?.data) ? result.data
        : Array.isArray(result?.especialidades) ? result.especialidades : [];

      if (specs.length === 0) {
        return reply.send({ source: 'fallback', specialties: getFallbackSpecialties() });
      }

      const filtered = specs.filter((s: any) => {
        const name = (s.nome || s.name || '').toUpperCase();
        return !HIDDEN_SPECIALTIES.has(name);
      });

      return reply.send({
        source: 'klingo',
        specialties: filtered.map((s: any) => ({
          id: s.id || s.codigo,
          name: toTitleCase(s.nome || s.name),
        })),
      });
    } catch (err: any) {
      console.error('[public-scheduling] getSpecialties error:', err.message);
      return reply.send({ source: 'fallback', specialties: getFallbackSpecialties() });
    }
  });

  // GET /exams - list exams/procedures available for public scheduling
  app.get('/exams', async (_request, reply) => {
    const klingoExt = getKlingoExternalClient();
    if (!klingoExt) {
      return reply.send({ source: 'fallback', exams: getFallbackExams() });
    }

    try {
      const result = await klingoExt.getExams() as any;
      const exams = Array.isArray(result) ? result
        : Array.isArray(result?.data) ? result.data
        : Array.isArray(result?.exames) ? result.exames : [];

      if (exams.length === 0) {
        return reply.send({ source: 'fallback', exams: getFallbackExams() });
      }

      const visible = exams
        .map((exam: any) => {
          const id = exam.id || exam.codigo || exam.id_procedimento;
          const name = exam.nome || exam.name || exam.descricao || exam.procedimento;
          if (!id || !name) return null;
          const rawPrice = exam.valor ?? exam.preco ?? exam.price ?? exam.valor_particular;
          const priceCents = typeof rawPrice === 'number'
            ? Math.round(rawPrice * (rawPrice > 1000 ? 1 : 100))
            : undefined;

          return {
            id: String(id),
            name: toTitleCase(String(name)),
            category: exam.categoria || exam.especialidade?.nome || exam.especialidade || 'Exame',
            priceCents,
            durationMinutes: exam.duracao || exam.durationMinutes || 30,
          };
        })
        .filter(Boolean)
        .slice(0, 120);

      if (visible.length === 0) {
        return reply.send({ source: 'fallback', exams: getFallbackExams() });
      }

      return reply.send({ source: 'klingo', exams: visible });
    } catch (err: any) {
      console.error('[public-scheduling] getExams error:', err.message);
      return reply.send({ source: 'fallback', exams: getFallbackExams() });
    }
  });

  // GET /patient-search - limited public Klingo lookup by CPF or phone
  app.get('/patient-search', async (request, reply) => {
    const { cpf, phone } = request.query as { cpf?: string; phone?: string };
    if (!cpf && !phone) {
      return reply.status(400).send({ error: 'Informe CPF ou telefone' });
    }

    const klingoExt = getKlingoExternalClient();
    if (!klingoExt) {
      return reply.send({ found: false, patient: null });
    }

    try {
      const payload = cpf
        ? await klingoExt.identifyPatientByCpf(cpf.replace(/\D/g, ''))
        : await klingoExt.identifyPatientByPhone(phone!.replace(/\D/g, ''));
      const patient = klingoExt.extractPatientRecord(payload);
      const klingoId = klingoExt.extractPatientId(patient);

      if (!patient || !klingoId) {
        return reply.send({ found: false, patient: null });
      }

      return reply.send({
        found: true,
        patient: {
          klingoId,
          name: patient.nome || patient.st_nome || '',
          cpf: patient.docs?.cpf || patient.st_cpf || cpf || '',
          phone: patient.contatos?.celular || patient.contatos?.telefone || patient.st_telefone || phone || '',
          email: patient.contatos?.email || patient.st_email || '',
          birthDate: patient.dt_nasc || patient.dt_nascimento || '',
        },
      });
    } catch (err: any) {
      console.error('[public-scheduling] patient-search error:', err.message);
      return reply.send({ found: false, patient: null });
    }
  });

  // GET /professionals - list professionals
  app.get('/professionals', async (request, reply) => {
    const { especialidade, exame } = request.query as {
      especialidade?: string;
      exame?: string;
    };

    const klingoExt = getKlingoExternalClient();

    // Fetch local doctors from DB, filtered by specialty if provided
    let localDoctors: any[] = [];
    try {
      let query;
      if (especialidade) {
        // Normalize specialty name for matching
        const specNorm = especialidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const allDocs = await db.select().from(schema.doctors).where(eq(schema.doctors.isActive, true));
        localDoctors = allDocs.filter(d => {
          if (!d.specialty) return false;
          const docSpec = d.specialty.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return docSpec.includes(specNorm) || specNorm.includes(docSpec);
        });
      } else {
        localDoctors = await db.select().from(schema.doctors).where(eq(schema.doctors.isActive, true));
      }
    } catch (dbErr: any) {
      console.warn('[public-scheduling] DB doctors query failed:', dbErr.message);
    }

    // Resolve Klingo procedure ID for this specialty
    let procedureId = exame ? parseInt(exame) : undefined;
    if (!procedureId && especialidade && isNaN(Number(especialidade))) {
      const specKey = especialidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mapKey = Object.keys(CONSULTA_PROCEDURE_MAP).find(k => specKey.includes(k) || k.includes(specKey));
      if (mapKey) procedureId = CONSULTA_PROCEDURE_MAP[mapKey];
    }

    const formatName = (n: string) => toTitleCase(n);

    if (!klingoExt) {
      return reply.send({
        source: 'local',
        professionals: localDoctors.map(d => ({
          id: d.id,
          name: formatName(d.name),
          crm: d.crm,
          specialty: d.specialty ? toTitleCase(d.specialty) : undefined,
          klingoId: d.klingoId,
        })),
      });
    }

    try {
      const result = await klingoExt.getProfessionals(procedureId, 1) as any;
      const profs = Array.isArray(result) ? result
        : Array.isArray(result?.data) ? result.data
        : Array.isArray(result?.profissionais) ? result.profissionais : [];

      if (profs.length === 0) {
        return reply.send({
          source: 'local',
          professionals: localDoctors.map(d => ({
            id: d.id,
            name: formatName(d.name),
            crm: d.crm,
            specialty: d.specialty ? toTitleCase(d.specialty) : undefined,
            klingoId: d.klingoId,
          })),
        });
      }

      return reply.send({
        source: 'klingo',
        professionals: profs.map((p: any) => ({
          id: p.id,
          name: toTitleCase(p.nome || p.name),
          crm: p.crm,
          specialty: p.especialidade ? toTitleCase(p.especialidade) : undefined,
        })),
      });
    } catch (err: any) {
      console.error('[public-scheduling] getProfessionals error:', err.message);
      return reply.send({
        source: 'local',
        professionals: localDoctors.map(d => ({
          id: d.id,
          name: formatName(d.name),
          crm: d.crm,
          specialty: d.specialty ? toTitleCase(d.specialty) : undefined,
          klingoId: d.klingoId,
        })),
      });
    }
  });

  // GET /slots - available time slots
  app.get('/slots', async (request, reply) => {
    const { especialidade, exame, profissional, inicio, fim } = request.query as {
      especialidade?: string;
      exame?: string;
      profissional?: string;
      inicio?: string;
      fim?: string;
    };

    if (!inicio || !fim) {
      return reply.status(400).send({ error: 'Parametros inicio e fim sao obrigatorios (YYYY-MM-DD)' });
    }

    const klingoExt = getKlingoExternalClient();
    if (!klingoExt) {
      return reply.send({ source: 'none', slots: [], message: 'Sem horários disponíveis online. Agende pelo WhatsApp.' });
    }

    try {
      // If especialidade is a name (not numeric), resolve it
      let especialidadeId = especialidade && !isNaN(Number(especialidade))
        ? parseInt(especialidade) : undefined;
      let exameId = exame && !isNaN(Number(exame))
        ? parseInt(exame) : undefined;

      // If specialty is provided as name, find the CONSULTA procedure ID
      if (especialidade && isNaN(Number(especialidade))) {
        const specKey = especialidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const mapKey = Object.keys(CONSULTA_PROCEDURE_MAP).find(k => specKey.includes(k));
        if (mapKey) {
          exameId = CONSULTA_PROCEDURE_MAP[mapKey];
        }

        // Also try to resolve the specialty ID from Klingo
        try {
          const specResult = await klingoExt.getSpecialties() as any;
          const specs = Array.isArray(specResult) ? specResult
            : Array.isArray(specResult?.data) ? specResult.data : [];
          const match = specs.find((s: any) =>
            s.nome && s.nome.toLowerCase().includes(especialidade!.toLowerCase())
          );
          if (match) especialidadeId = match.id || match.codigo;
        } catch { /* ignore */ }
      }

      const result = await klingoExt.getAvailableSlots({
        especialidade: especialidadeId,
        exame: exameId,
        profissional: profissional ? parseInt(profissional) : undefined,
        plano: 1, // PARTICULAR
        inicio,
        fim,
      }) as any;

      const now = new Date();
      const slots: any[] = [];

      const extSlots = Array.isArray(result.horarios) ? result.horarios
        : Array.isArray(result.data) ? result.data
        : Array.isArray(result) ? result : [];

      for (const s of extSlots) {
        const slotHorarios = s.horarios;
        if (slotHorarios && typeof slotHorarios === 'object' && !Array.isArray(slotHorarios)) {
          for (const [key, hora] of Object.entries(slotHorarios)) {
            const slotDate = new Date(`${s.data}T${hora}:00-03:00`);
            if (slotDate <= now) continue;
            slots.push({
              date: s.data,
              time: hora,
              dateTime: slotDate.toISOString(),
              source: 'klingo',
              klingoSlotId: key,
              professional: s.profissional || s.nome_medico,
              professionalId: s.id_medico || s.profissional_id,
            });
          }
        } else if (s.hora) {
          const slotDate = new Date(`${s.data}T${s.hora}:00-03:00`);
          if (slotDate <= now) continue;
          slots.push({
            date: s.data,
            time: s.hora,
            dateTime: slotDate.toISOString(),
            source: 'klingo',
            klingoSlotId: s.id,
            professional: s.nome_medico,
            professionalId: s.id_medico,
          });
        }
      }

      // Deduplicate
      const seen = new Set<string>();
      const uniqueSlots = slots.filter(s => {
        if (seen.has(s.dateTime)) return false;
        seen.add(s.dateTime);
        return true;
      }).sort((a: any, b: any) =>
        new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
      ).slice(0, 30);

      if (uniqueSlots.length > 0) {
        return reply.send({ source: 'klingo', slots: uniqueSlots });
      }

      // No real slots available: keep the site usable and mark booking for manual confirmation.
      return reply.send({
        source: 'fallback',
        slots: generateFallbackSlots(inicio, fim),
        message: 'Horarios sugeridos para confirmacao manual pela equipe.',
      });
    } catch (err: any) {
      console.error('[public-scheduling] getSlots error:', err.message);
      return reply.send({
        source: 'fallback',
        slots: generateFallbackSlots(inicio, fim),
        message: 'Horarios sugeridos para confirmacao manual pela equipe.',
      });
    }
  });

  // POST /book - create a booking request (stored locally, team notified)
  app.post('/book', async (request, reply) => {
    const {
      patientName,
      patientPhone,
      cpf,
      birthDate,
      email,
      specialty,
      doctorName,
      doctorId,
      slotDateTime,
      slotSource,
      klingoSlotId,
      selectedExams,
      paymentMethod,
      requestId,
      requestFileName,
    } = request.body as {
      patientName: string;
      patientPhone: string;
      cpf?: string;
      birthDate?: string;
      email?: string;
      specialty: string;
      doctorName?: string;
      doctorId?: string;
      slotDateTime: string;
      slotSource?: 'klingo' | 'fallback';
      klingoSlotId?: string | number;
      selectedExams?: Array<{ id: string; name: string; priceCents?: number }>;
      paymentMethod?: string;
      requestId?: string;
      requestFileName?: string;
    };

    if (!patientName || !patientPhone || !specialty || !slotDateTime) {
      return reply.status(400).send({
        error: 'Campos obrigatorios: patientName, patientPhone, specialty, slotDateTime',
      });
    }

    const slotDate = new Date(slotDateTime);
    if (isNaN(slotDate.getTime()) || slotDate <= new Date()) {
      return reply.status(400).send({ error: 'Horario invalido ou no passado' });
    }

    try {
      // Find or create patient
      let patientId: string | undefined;
      const cleanPhone = patientPhone.replace(/\D/g, '');

      const [existingPatient] = await db.select().from(schema.patients)
        .where(eq(schema.patients.phone, cleanPhone))
        .limit(1);

      if (existingPatient) {
        patientId = existingPatient.id;
        const updates: Record<string, unknown> = { updatedAt: new Date() };
        if (!existingPatient.name && patientName) updates.name = patientName;
        if (Object.keys(updates).length > 1) {
          await db.update(schema.patients).set(updates)
            .where(eq(schema.patients.id, existingPatient.id));
        }
      } else {
        const [newPatient] = await db.insert(schema.patients).values({
          phone: cleanPhone,
          name: patientName,
          source: 'website',
        }).returning({ id: schema.patients.id });
        patientId = newPatient.id;
      }

      // Resolve doctorId — if it's a Klingo numeric ID, look up by klingoId or name
      let resolvedDoctorId: string | undefined;
      const isUUID = doctorId && /^[0-9a-f]{8}-/.test(doctorId);
      if (isUUID) {
        resolvedDoctorId = doctorId;
      } else if (doctorId && !isNaN(Number(doctorId))) {
        // Klingo numeric ID — find local doctor by klingoId
        const [doc] = await db.select().from(schema.doctors)
          .where(eq(schema.doctors.klingoId, Number(doctorId)))
          .limit(1);
        if (doc) resolvedDoctorId = doc.id;
      }
      if (!resolvedDoctorId && doctorName) {
        const [doc] = await db.select().from(schema.doctors)
          .where(ilike(schema.doctors.name, `%${doctorName}%`))
          .limit(1);
        if (doc) resolvedDoctorId = doc.id;
      }

      // Create appointment
      const totalCents = (selectedExams || []).reduce((sum, exam) => sum + (exam.priceCents || 0), 0);
      const [appointment] = await db.insert(schema.appointments).values({
        patientId,
        doctorId: resolvedDoctorId || undefined,
        scheduledAt: slotDate,
        status: 'pending_confirmation',
        notes: JSON.stringify({
          source: 'site-exam-scheduling',
          selectedExams: selectedExams || [],
          totalCents,
          paymentMethod: paymentMethod || null,
          cpfProvided: Boolean(cpf),
          birthDate: birthDate || null,
          email: email || null,
          requestId: requestId || null,
          requestFileName: requestFileName || null,
          klingoSlotId: klingoSlotId || null,
          operationalWarning: 'Paciente deve apresentar o pedido fisico na recepcao.',
        }),
        createdBy: 'website',
        klingoSyncStatus: slotSource === 'klingo' ? 'pending' : 'manual_required',
      }).returning({ id: schema.appointments.id });

      return reply.status(201).send({
        success: true,
        appointmentId: appointment.id,
        message: 'Agendamento registrado! Nossa equipe vai confirmar e entrar em contato.',
      });
    } catch (err: any) {
      console.error('[public-scheduling] book error:', err.message);
      return reply.status(500).send({ error: 'Erro ao registrar agendamento. Tente novamente.' });
    }
  });
}

// Fallback specialties when Klingo is unavailable
function getFallbackSpecialties() {
  return [
    { id: 'clinica-geral', name: 'Clinica Geral' },
    { id: 'cardiologia', name: 'Cardiologia' },
    { id: 'neurologia', name: 'Neurologia' },
    { id: 'reumatologia', name: 'Reumatologia' },
    { id: 'urologia', name: 'Urologia' },
    { id: 'cirurgia-vascular', name: 'Cirurgia Vascular' },
    { id: 'ortopedia', name: 'Ortopedia' },
    { id: 'ginecologia', name: 'Ginecologia' },
    { id: 'psiquiatria', name: 'Psiquiatria' },
    { id: 'odontologia', name: 'Odontologia' },
    { id: 'nutricao', name: 'Nutricao' },
    { id: 'fonoaudiologia', name: 'Fonoaudiologia' },
    { id: 'psicologia', name: 'Psicologia' },
    { id: 'pediatria', name: 'Pediatria' },
    { id: 'dermatologia', name: 'Dermatologia' },
    { id: 'endocrinologia', name: 'Endocrinologia' },
    { id: 'gastroenterologia', name: 'Gastroenterologia' },
    { id: 'pneumologia', name: 'Pneumologia' },
    { id: 'geriatria', name: 'Geriatria' },
    { id: 'fisioterapia', name: 'Fisioterapia' },
  ];
}

function getFallbackExams() {
  return [
    { id: '1431', name: 'Exame De Sangue', category: 'Laboratorio', priceCents: 8900, durationMinutes: 20 },
    { id: '1448', name: 'Ultrassonografia', category: 'Imagem', priceCents: 18000, durationMinutes: 30 },
    { id: '1429', name: 'Raio-X', category: 'Imagem', priceCents: 12000, durationMinutes: 20 },
    { id: '1277', name: 'Ecocardiograma', category: 'Cardiologia', priceCents: 26000, durationMinutes: 40 },
    { id: '1439', name: 'Radiologia', category: 'Imagem', priceCents: 15000, durationMinutes: 30 },
  ];
}

// Generate fallback slots for a date range
function generateFallbackSlots(inicio: string, fim: string) {
  const slots: any[] = [];
  const start = new Date(inicio);
  const end = new Date(fim);
  const now = new Date();

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue; // skip weekends
    const dateStr = d.toISOString().split('T')[0];

    for (const hour of [9, 10, 11, 14, 15, 16]) {
      const slotDate = new Date(d);
      slotDate.setHours(hour, 0, 0, 0);
      if (slotDate <= now) continue;
      const timeStr = `${String(hour).padStart(2, '0')}:00`;
      slots.push({
        date: dateStr,
        time: timeStr,
        dateTime: slotDate.toISOString(),
        source: 'fallback',
      });
    }
  }

  return slots.slice(0, 30);
}

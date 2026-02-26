/**
 * Klingo API Client
 * Conecta com a API Klingo para buscar agendas reais dos médicos.
 */

interface KlingoSlot {
  hora: string;
  status: string;
  data: string;
  base: string;
  marcacao: Record<string, unknown> | null;
}

interface KlingoAQLResponse {
  lista?: {
    status: number;
    data: {
      agendas?: KlingoSlot[];
      [key: string]: unknown;
    };
  };
  [key: string]: unknown;
}

export interface AvailableSlot {
  date: string;
  time: string;
  dateTime: string;
}

export class KlingoClient {
  private baseUrl = 'https://api.klingo.app/api';
  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  private domain: string;
  private loginUser: string;
  private loginSenha: string;

  constructor(config: { domain: string; login: string; senha: string }) {
    this.domain = config.domain;
    this.loginUser = config.login;
    this.loginSenha = config.senha;
  }

  private async ensureAuth(): Promise<void> {
    if (this.token && Date.now() < this.tokenExpiresAt) return;

    const res = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-DOMAIN': this.domain,
        'X-PORTAL': '0',
        'X-UNIDADE': '1',
      },
      body: JSON.stringify({ login: this.loginUser, senha: this.loginSenha }),
    });

    if (!res.ok) {
      console.error(`[Klingo] Login failed: HTTP ${res.status}`);
      throw new Error(`Klingo login failed: ${res.status}`);
    }

    const data = await res.json() as { access_token?: string; token?: string };
    this.token = data.access_token || data.token || null;
    if (!this.token) throw new Error('Klingo login: no token returned');
    this.tokenExpiresAt = Date.now() + 50 * 60 * 1000;
    console.log('[Klingo] Login OK, token refreshed');
  }

  private async aql(
    name: string,
    parms: Record<string, unknown>,
    idAlias: string = 'lista',
    action?: string,
    page?: number,
  ): Promise<KlingoAQLResponse> {
    await this.ensureAuth();

    const query = { name, id: idAlias, parms };
    const params = new URLSearchParams();
    if (action) params.set('a', action);
    if (page) params.set('page', String(page));

    const url = `${this.baseUrl}/aql?${params.toString()}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        'X-DOMAIN': this.domain,
        'X-PORTAL': '0',
        'X-UNIDADE': '1',
      },
      body: JSON.stringify({ q: [query] }),
    });

    if (!res.ok) {
      console.error(`[Klingo] AQL HTTP error (${name}): ${res.status}`);
      throw new Error(`Klingo AQL error (${name}): ${res.status}`);
    }

    const data = await res.json() as KlingoAQLResponse;

    // Klingo pode retornar HTTP 200 com erro no body
    if (data[idAlias] && typeof data[idAlias] === 'object') {
      const aliasData = data[idAlias] as Record<string, unknown>;
      if (aliasData.status && Number(aliasData.status) >= 400) {
        const msg = `Klingo AQL error-in-200 (${name}): status=${aliasData.status}`;
        console.error(`[Klingo] ${msg}`);
        throw new Error(msg);
      }
    }

    return data;
  }

  /**
   * Busca slots livres de um médico para uma data específica.
   */
  async getAvailableSlots(
    klingoMedicoId: number,
    date: string,
    period: 'morning' | 'afternoon' | 'any' = 'any',
  ): Promise<AvailableSlot[]> {
    const result = await this.aql(
      'agendas.index',
      {
        data: date,
        turno: 'G',
        medico: klingoMedicoId,
        medicos: null,
        group: 'none',
        livres: 1,
        status: 'T',
        especialidade: '',
        unidade_operacao: 1,
        faixa_hora: 'D',
        recepcao: '',
        search: null,
        view_status: '',
        id_atendimento: null,
        id_fila_laudo: '',
        tipo_proced: 'T',
        editados: false,
      },
      'lista',
      'agendas.index',
      1,
    );

    const agendas = result.lista?.data?.agendas || [];
    const now = new Date();

    const slots: AvailableSlot[] = [];
    for (const agenda of agendas) {
      if (agenda.status !== 'livre') continue;

      const [hour] = agenda.hora.split(':').map(Number);

      if (period === 'morning' && hour >= 12) continue;
      if (period === 'afternoon' && hour < 12) continue;

      const slotDate = new Date(`${date}T${agenda.hora}:00-03:00`);
      if (slotDate <= now) continue;

      slots.push({
        date,
        time: agenda.hora,
        dateTime: slotDate.toISOString(),
      });
    }

    return slots;
  }

  /**
   * Busca slots livres distribuídos inteligentemente:
   * - Próximos N dias úteis
   * - Máximo de maxSlots no total
   * - Distribuídos em 3 faixas: manhã, início tarde, fim tarde
   */
  async getSmartSlots(
    klingoMedicoId: number,
    options: {
      daysAhead?: number;
      maxSlots?: number;
      period?: 'morning' | 'afternoon' | 'any';
    } = {},
  ): Promise<AvailableSlot[]> {
    const { daysAhead = 7, maxSlots = 9, period = 'any' } = options;

    const allSlots: AvailableSlot[] = [];
    const now = new Date();

    for (let i = 0; i < daysAhead; i++) {
      const day = new Date(now);
      day.setDate(day.getDate() + i);

      if (day.getDay() === 0 || day.getDay() === 6) continue;

      const dateStr = day.toISOString().split('T')[0];
      try {
        const daySlots = await this.getAvailableSlots(klingoMedicoId, dateStr, period);
        allSlots.push(...daySlots);
      } catch {
        continue;
      }
    }

    if (allSlots.length === 0) return [];

    return this.distributeSlots(allSlots, maxSlots);
  }

  /**
   * Busca paciente no Klingo pelo CPF.
   */
  async searchPatientByCpf(cpf: string): Promise<{ id_pessoa: number } | null> {
    const result = await this.aql(
      'pacientes.index',
      { search: cpf },
      'lista',
      'pacientes.index',
      1,
    );

    const data = result.lista?.data as any;
    const patients = data?.data || data?.pacientes || [];
    if (Array.isArray(patients) && patients.length > 0) {
      return { id_pessoa: patients[0].id_pessoa || patients[0].id };
    }
    return null;
  }

  /**
   * Cria um paciente no Klingo.
   */
  async createPatient(data: {
    nome: string;
    cpf?: string;
    nascimento?: string;
    telefone?: string;
  }): Promise<{ id_pessoa: number }> {
    const parms: Record<string, unknown> = {
      st_nome: data.nome,
    };
    if (data.cpf) parms.st_cpf = data.cpf;
    if (data.nascimento) parms.dt_nascimento = data.nascimento;
    if (data.telefone) parms.st_telefone = data.telefone;

    const result = await this.aql(
      'pacientes.store',
      parms,
      'lista',
      'pacientes.store',
    );

    const resData = result.lista?.data as any;
    const idPessoa = resData?.id_pessoa || resData?.id;
    if (!idPessoa) {
      throw new Error('Klingo createPatient: no id_pessoa returned');
    }
    return { id_pessoa: idPessoa };
  }

  /**
   * Cria um agendamento (marcação) no Klingo.
   */
  async createBooking(data: {
    id_paciente: number;
    id_medico: number;
    data: string;
    hora: string;
  }): Promise<any> {
    const result = await this.aql(
      'agendas.store',
      {
        id_pessoa: data.id_paciente,
        medico: data.id_medico,
        data: data.data,
        hora: data.hora,
        unidade_operacao: 1,
      },
      'lista',
      'agendas.store',
    );

    const bookingData = result.lista?.data;
    if (!bookingData) {
      throw new Error(`Klingo createBooking: empty response (patient=${data.id_paciente}, doctor=${data.id_medico}, date=${data.data})`);
    }

    console.log(`[Klingo] Booking created: patient=${data.id_paciente}, doctor=${data.id_medico}, date=${data.data} ${data.hora}`);
    return bookingData;
  }

  /**
   * Primeiro reduz os slots a 1 por hora (o primeiro disponível de cada hora),
   * depois distribui em 3 faixas priorizando variedade de dias.
   */
  private distributeSlots(slots: AvailableSlot[], maxSlots: number): AvailableSlot[] {
    // Step 1: Deduplicate to 1 slot per hour per day
    const hourlySlots: AvailableSlot[] = [];
    const seen = new Set<string>();
    for (const slot of slots) {
      const hour = slot.time.split(':')[0];
      const key = `${slot.date}-${hour}`;
      if (!seen.has(key)) {
        seen.add(key);
        hourlySlots.push(slot);
      }
    }

    // Step 2: Split into 3 time ranges
    const morning: AvailableSlot[] = [];
    const earlyAfternoon: AvailableSlot[] = [];
    const lateAfternoon: AvailableSlot[] = [];

    for (const slot of hourlySlots) {
      const hour = parseInt(slot.time.split(':')[0]);
      if (hour < 12) morning.push(slot);
      else if (hour < 15) earlyAfternoon.push(slot);
      else lateAfternoon.push(slot);
    }

    // Step 3: Pick from each range, spread across different days
    const result: AvailableSlot[] = [];
    const perRange = Math.ceil(maxSlots / 3);

    for (const range of [morning, earlyAfternoon, lateAfternoon]) {
      const byDate = new Map<string, AvailableSlot[]>();
      for (const slot of range) {
        const existing = byDate.get(slot.date) || [];
        existing.push(slot);
        byDate.set(slot.date, existing);
      }

      let added = 0;
      const dates = [...byDate.keys()].sort();
      let round = 0;
      while (added < perRange && round < 10) {
        for (const date of dates) {
          if (added >= perRange) break;
          const daySlots = byDate.get(date) || [];
          if (daySlots.length > round) {
            result.push(daySlots[round]);
            added++;
          }
        }
        round++;
      }
    }

    return result.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }
}

// Singleton
let _client: KlingoClient | null = null;

export function getKlingoClient(): KlingoClient {
  if (!_client) {
    const login = process.env.KLINGO_LOGIN;
    const senha = process.env.KLINGO_SENHA;
    const domain = process.env.KLINGO_DOMAIN || 'irb';

    if (!login || !senha) {
      throw new Error('KLINGO_LOGIN and KLINGO_SENHA env vars are required');
    }

    _client = new KlingoClient({ domain, login, senha });
  }
  return _client;
}

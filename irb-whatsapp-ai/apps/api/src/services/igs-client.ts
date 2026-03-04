/**
 * IGS API Client
 * Integração com a API da IGS (Integral Group Solution) para gestão de
 * assistências: Customers (pessoais), Residentials e Pets.
 *
 * Docs: Documentação_API_IGS_rev_2.2.pdf
 * Ambiente HML: https://prdapolobr.igs.teknosgroup.com/api-hml/v1
 * Ambiente PRD: https://prdapolobr.igs.teknosgroup.com/api-apolo/v1
 */

// ============================================================
// Types
// ============================================================

export interface IGSConfig {
  baseUrl: string;
  service: string;
  authKey: string;
  username: string;
  password: string;
}

export interface IGSLoginResponse {
  status: number;
  message: string;
  user_id: string;
  token: string;
}

export interface IGSItemResponse {
  status: number | string; // IGS retorna number na maioria dos endpoints, string em alguns (ex: /pets cancel)
  message: string;
  action: string;
  cnpjcpf: string;
  producto: string;
  placa?: string;
}

/** Campos comuns a todos os endpoints (Customers e Pets). */
export interface IGSBasePayload {
  action: '1' | '2' | '3'; // 1=Inclusão, 2=Atualização, 3=Cancelamento
  cnpjcpf: string;          // CPF ou CNPJ sem formatação
  producto: string;          // Código do produto IGS
}

/** Dados do segurado — usados em inclusão (action=1) e atualização (action=2). */
export interface IGSCustomerData extends IGSBasePayload {
  nombre: string;
  apellido: string;
  iniciovigencia: string;   // YYYY-MM-DD
  finvigencia: string;      // YYYY-MM-DD
  telefono: string;
  codigo: string;           // CEP sem formatação
  calle: string;
  numero: string;
  barrio: string;
  ciudad: string;
  provincia: string;        // UF (2 chars)
  email?: string;
  complemento?: string;
  fechanascimiento?: string; // YYYY-MM-DD ou DD/MM/YYYY
  vendor_lead_code?: string;
  numero_sorte?: string;
}

/** Dados específicos para o endpoint /pets. */
export interface IGSPetData extends IGSCustomerData {
  registro: string;  // Obrigatório — usar CPF do cliente
  nome: string;      // Nome do pet
  pet?: string;      // Tipo: cachorro, gato, etc.
  porte?: string;    // pequeno, medio, grande
  idade?: string;
  raca?: string;
}

/** Dados específicos para o endpoint /residentials (sem endereço completo). */
export interface IGSResidentialData extends IGSBasePayload {
  nombre: string;
  apellido: string;
  iniciovigencia: string;
  finvigencia: string;
  telefono: string;
  codigo: string;
  calle: string;
  numero: string;
  barrio: string;
  ciudad: string;
  provincia: string;
  email?: string;
  complemento?: string;
  fechanascimiento?: string;
  vendor_lead_code?: string;
  numero_sorte?: string;
}

/** Payload mínimo para cancelamento (action=3) de customer/residential. */
export interface IGSCancelCustomer extends IGSBasePayload {
  action: '3';
}

/** Payload mínimo para cancelamento (action=3) de pet — campo `nome` é obrigatório. */
export interface IGSCancelPet extends IGSBasePayload {
  action: '3';
  nome: string;
}

// ============================================================
// Produtos IRB mapeados
// ============================================================

export const IGS_PRODUCTS = {
  RESIDENCIAL_COMPLETO:     '143508006',
  ORIENTACAO_NUTRICIONAL:   '143508007',
  ORIENTACAO_PSICOLOGICA:   '143508008',
  ORIENTACAO_FITNESS:       '143508010',
  DESCONTO_MEDICAMENTOS:    '143508011',
  BEM_ESTAR:                '143508013',
  FUNERAL_FAMILIAR:         '143508071',
  ASSISTENCIA_PET:          '143508072',
  FUTURA_MAMAE:             '143508073',
  ASSISTENCIA_FAMILIAR:     '143508075',
  ASSISTENCIA_CELULAR:      '143508076',
} as const;

export const IGS_PRODUCT_NAMES: Record<string, string> = {
  '143508006': 'Residencial Completo',
  '143508007': 'Orientação Nutricional',
  '143508008': 'Orientação Psicológica',
  '143508010': 'Orientação Fitness',
  '143508011': 'Desconto em Medicamentos',
  '143508013': 'Bem Estar',
  '143508071': 'Funeral Familiar R$ 5.000',
  '143508072': 'Assistência Pet',
  '143508073': 'Futura Mamãe',
  '143508075': 'Assistência Familiar (Kiddle Pass)',
  '143508076': 'Assistência Celular',
};

/** Produtos que usam o endpoint /pets. */
const PET_PRODUCTS = new Set<string>([IGS_PRODUCTS.ASSISTENCIA_PET]);

/** Produtos que usam o endpoint /residentials. */
const RESIDENTIAL_PRODUCTS = new Set<string>([IGS_PRODUCTS.RESIDENCIAL_COMPLETO]);

// ============================================================
// Client
// ============================================================

export class IGSClient {
  private baseUrl: string;
  private service: string;
  private authKey: string;
  private username: string;
  private password: string;

  private token: string | null = null;
  private userId: string | null = null;
  private tokenExpiresAt: number = 0;

  /** Token da IGS expira a cada 5 min. Renovamos com 30s de margem. */
  private static readonly TOKEN_TTL_MS = 4.5 * 60 * 1000;

  constructor(config: IGSConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.service = config.service;
    this.authKey = config.authKey;
    this.username = config.username;
    this.password = config.password;
  }

  // ----------------------------------------------------------
  // Auth
  // ----------------------------------------------------------

  private async ensureAuth(): Promise<void> {
    if (this.token && this.userId && Date.now() < this.tokenExpiresAt) return;

    const res = await fetch(`${this.baseUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'service': this.service,
        'auth_key': this.authKey,
        'username': this.username,
        'password': this.password,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      throw new Error(`IGS login failed: HTTP ${res.status}`);
    }

    const data = await res.json() as IGSLoginResponse;
    if (data.status !== 200) {
      throw new Error(`IGS login failed: ${data.message}`);
    }

    this.token = data.token;
    this.userId = data.user_id;
    this.tokenExpiresAt = Date.now() + IGSClient.TOKEN_TTL_MS;
  }

  private async getHeaders(): Promise<Record<string, string>> {
    await this.ensureAuth();
    return {
      'service': this.service,
      'auth_key': this.authKey,
      'user_id': this.userId!,
      'token': this.token!,
      'Content-Type': 'application/json',
    };
  }

  // ----------------------------------------------------------
  // Core request
  // ----------------------------------------------------------

  private async request(
    endpoint: string,
    payload: IGSBasePayload[],
  ): Promise<IGSItemResponse[]> {
    const headers = await this.getHeaders();

    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`IGS ${endpoint} HTTP ${res.status}: ${text}`);
    }

    return res.json() as Promise<IGSItemResponse[]>;
  }

  /**
   * Determina o endpoint correto com base no código do produto.
   * - Pets → /pets
   * - Residencial Completo → /residentials
   * - Todos os demais → /customers
   */
  endpointForProduct(producto: string): string {
    if (PET_PRODUCTS.has(producto)) return '/pets';
    if (RESIDENTIAL_PRODUCTS.has(producto)) return '/residentials';
    return '/customers';
  }

  // ----------------------------------------------------------
  // Customers
  // ----------------------------------------------------------

  /** Cadastra um ou mais clientes (action=1). */
  async addCustomers(items: IGSCustomerData[]): Promise<IGSItemResponse[]> {
    return this.request('/customers', items);
  }

  /** Atualiza um ou mais clientes (action=2). */
  async updateCustomers(items: IGSCustomerData[]): Promise<IGSItemResponse[]> {
    return this.request('/customers', items);
  }

  /** Cancela um ou mais clientes (action=3). */
  async cancelCustomers(items: IGSCancelCustomer[]): Promise<IGSItemResponse[]> {
    return this.request('/customers', items);
  }

  // ----------------------------------------------------------
  // Residentials
  // ----------------------------------------------------------

  /** Cadastra um ou mais residenciais (action=1). */
  async addResidentials(items: IGSResidentialData[]): Promise<IGSItemResponse[]> {
    return this.request('/residentials', items);
  }

  /** Atualiza um ou mais residenciais (action=2). */
  async updateResidentials(items: IGSResidentialData[]): Promise<IGSItemResponse[]> {
    return this.request('/residentials', items);
  }

  /** Cancela um ou mais residenciais (action=3). */
  async cancelResidentials(items: IGSCancelCustomer[]): Promise<IGSItemResponse[]> {
    return this.request('/residentials', items);
  }

  // ----------------------------------------------------------
  // Pets
  // ----------------------------------------------------------

  /** Cadastra um ou mais pets (action=1). */
  async addPets(items: IGSPetData[]): Promise<IGSItemResponse[]> {
    return this.request('/pets', items);
  }

  /** Atualiza um ou mais pets (action=2). */
  async updatePets(items: IGSPetData[]): Promise<IGSItemResponse[]> {
    return this.request('/pets', items);
  }

  /** Cancela um ou mais pets (action=3). Requer campo `nome` do pet. */
  async cancelPets(items: IGSCancelPet[]): Promise<IGSItemResponse[]> {
    return this.request('/pets', items);
  }

  // ----------------------------------------------------------
  // High-level helpers
  // ----------------------------------------------------------

  /**
   * Envia itens para a IGS, roteando automaticamente para o endpoint
   * correto (/customers, /residentials ou /pets) com base no produto.
   * Suporta batch misto de produtos.
   */
  async send(items: (IGSCustomerData | IGSResidentialData | IGSPetData)[]): Promise<IGSItemResponse[]> {
    const customerItems: IGSBasePayload[] = [];
    const residentialItems: IGSBasePayload[] = [];
    const petItems: IGSBasePayload[] = [];

    for (const item of items) {
      if (PET_PRODUCTS.has(item.producto)) {
        petItems.push(item);
      } else if (RESIDENTIAL_PRODUCTS.has(item.producto)) {
        residentialItems.push(item);
      } else {
        customerItems.push(item);
      }
    }

    const results: IGSItemResponse[] = [];

    if (customerItems.length > 0) {
      const res = await this.request('/customers', customerItems);
      results.push(...res);
    }

    if (residentialItems.length > 0) {
      const res = await this.request('/residentials', residentialItems);
      results.push(...res);
    }

    if (petItems.length > 0) {
      const res = await this.request('/pets', petItems);
      results.push(...res);
    }

    return results;
  }

  /**
   * Envia itens em batches respeitando o limite de 5.000 por request.
   * Útil para sincronizações grandes.
   */
  async sendBatch(
    items: (IGSCustomerData | IGSResidentialData | IGSPetData)[],
    batchSize: number = 5000,
  ): Promise<IGSItemResponse[]> {
    const allResults: IGSItemResponse[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const results = await this.send(batch);
      allResults.push(...results);
    }

    return allResults;
  }

  /**
   * Verifica se o resultado de um item indica sucesso.
   */
  static isSuccess(item: IGSItemResponse): boolean {
    const s = Number(item.status);
    return s === 200 || s === 201;
  }

  /**
   * Filtra resultados separando sucessos e falhas.
   */
  static splitResults(results: IGSItemResponse[]): {
    success: IGSItemResponse[];
    errors: IGSItemResponse[];
  } {
    const success: IGSItemResponse[] = [];
    const errors: IGSItemResponse[] = [];
    for (const r of results) {
      (IGSClient.isSuccess(r) ? success : errors).push(r);
    }
    return { success, errors };
  }
}

// ============================================================
// Singleton
// ============================================================

let _client: IGSClient | null = null;

export function getIGSClient(): IGSClient {
  if (!_client) {
    const baseUrl = process.env.IGS_BASE_URL;
    const service = process.env.IGS_SERVICE;
    const authKey = process.env.IGS_AUTH_KEY;
    const username = process.env.IGS_USERNAME;
    const password = process.env.IGS_PASSWORD;

    if (!baseUrl || !service || !authKey || !username || !password) {
      throw new Error(
        'IGS env vars required: IGS_BASE_URL, IGS_SERVICE, IGS_AUTH_KEY, IGS_USERNAME, IGS_PASSWORD',
      );
    }

    _client = new IGSClient({ baseUrl, service, authKey, username, password });
  }
  return _client;
}

/**
 * Klingo External API client for worker processes
 * This is a simplified version that doesn't require shared imports
 */

interface KlingoResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export class KlingoWorkerClient {
  private baseUrl: string;
  private appToken: string;

  constructor(baseUrl: string, appToken: string) {
    this.baseUrl = baseUrl;
    this.appToken = appToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<KlingoResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'X-APP-TOKEN': this.appToken,
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json() as KlingoResponse<T>;
    }

    return {
      success: true,
      data: (await response.text()) as unknown as T,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.request('GET', '/api/live');
      return response.success === true;
    } catch {
      return false;
    }
  }

  async getProfessionals(): Promise<
    KlingoResponse<Array<{
      id: number;
      nome: string;
      crm?: string;
      especialidade?: string;
    }>>
  > {
    return this.request('GET', '/api/agenda/profissionais');
  }

  async listForConfirmation(
    date: string,
    options?: { links?: boolean }
  ): Promise<
    KlingoResponse<
      Array<{
        id: number;
        id_marcacao: number;
        paciente: string;
        telefone: string;
        data: string;
        hora: string;
        profissional: string;
        especialidade: string;
        status_confirmacao: string;
      }>
    >
  > {
    const qs = new URLSearchParams();
    if (options?.links) qs.set('links', '1');
    const query = qs.toString();
    return this.request(
      'GET',
      `/api/telefonia/lista/${date}${query ? '?' + query : ''}`
    );
  }
}

export function getKlingoWorkerClient(): KlingoWorkerClient | null {
  const token = process.env.KLINGO_APP_TOKEN;
  const baseUrl =
    process.env.KLINGO_EXTERNAL_BASE_URL || 'https://api-externa.klingo.app';

  if (!token) {
    return null;
  }

  return new KlingoWorkerClient(baseUrl, token);
}

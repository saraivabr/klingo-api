/**
 * Asaas Payment Gateway Client
 * API docs: https://docs.asaas.com/reference
 * Auth via header `access_token`
 * Sandbox: https://api-sandbox.asaas.com/v3
 * Production: https://api.asaas.com/v3
 */

export interface AsaasCustomerRequest {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface AsaasCustomerResponse {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}

export interface AsaasSubscriptionRequest {
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  cycle: 'MONTHLY' | 'WEEKLY' | 'BIWEEKLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'YEARLY';
  nextDueDate: string; // YYYY-MM-DD
  description?: string;
}

export interface AsaasSubscriptionResponse {
  id: string;
  customer: string;
  billingType: string;
  value: number;
  cycle: string;
  nextDueDate: string;
  status: string;
}

export interface AsaasPaymentResponse {
  id: string;
  customer: string;
  subscription?: string;
  billingType: string;
  value: number;
  netValue: number;
  status: string;
  dueDate: string;
  confirmedDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
}

export interface AsaasPixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

export class AsaasClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: { apiKey: string; environment?: string }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://api-sandbox.asaas.com/v3';
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'access_token': this.apiKey,
      'Accept': 'application/json',
    };

    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[Asaas] ${method} ${path} → ${res.status}: ${text}`);
      throw new AsaasError(
        `Asaas API error: ${method} ${path} → ${res.status}`,
        res.status,
        text,
      );
    }

    return await res.json() as T;
  }

  // === Customers ===

  async createCustomer(data: AsaasCustomerRequest): Promise<AsaasCustomerResponse> {
    return this.request('POST', '/customers', data);
  }

  async findCustomerByCpf(cpf: string): Promise<AsaasCustomerResponse | null> {
    const result = await this.request<{ data: AsaasCustomerResponse[] }>(
      'GET',
      `/customers?cpfCnpj=${encodeURIComponent(cpf)}`,
    );
    return result.data?.[0] || null;
  }

  // === Subscriptions ===

  async createSubscription(data: AsaasSubscriptionRequest): Promise<AsaasSubscriptionResponse> {
    return this.request('POST', '/subscriptions', data);
  }

  async getSubscription(id: string): Promise<AsaasSubscriptionResponse> {
    return this.request('GET', `/subscriptions/${id}`);
  }

  async cancelSubscription(id: string): Promise<AsaasSubscriptionResponse> {
    return this.request('DELETE', `/subscriptions/${id}`);
  }

  // === Payments ===

  async getPayment(id: string): Promise<AsaasPaymentResponse> {
    return this.request('GET', `/payments/${id}`);
  }

  async getPixQrCode(paymentId: string): Promise<AsaasPixQrCodeResponse> {
    return this.request('GET', `/payments/${paymentId}/pixQrCode`);
  }
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly responseBody: string,
  ) {
    super(message);
    this.name = 'AsaasError';
  }
}

// Singleton
let _client: AsaasClient | null = null;

export function getAsaasClient(): AsaasClient | null {
  if (_client) return _client;

  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    console.warn('[Asaas] ASAAS_API_KEY not set — Asaas integration disabled');
    return null;
  }

  _client = new AsaasClient({
    apiKey,
    environment: process.env.ASAAS_ENVIRONMENT || 'sandbox',
  });

  return _client;
}

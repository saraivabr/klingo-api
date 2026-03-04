import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import {
  getIGSClient,
  IGSClient,
  IGS_PRODUCTS,
  IGS_PRODUCT_NAMES,
  type IGSCustomerData,
  type IGSResidentialData,
  type IGSPetData,
  type IGSCancelCustomer,
  type IGSCancelPet,
  type IGSItemResponse,
} from '../services/igs-client.js';

// ============================================================
// Types
// ============================================================

interface CustomerBody {
  cnpjcpf: string;
  nombre: string;
  apellido: string;
  email?: string;
  iniciovigencia: string;
  finvigencia: string;
  telefono: string;
  codigo: string;
  calle: string;
  numero: string;
  complemento?: string;
  barrio: string;
  ciudad: string;
  provincia: string;
  producto: string;
  fechanascimiento?: string;
  vendor_lead_code?: string;
  numero_sorte?: string;
}

interface PetBody extends CustomerBody {
  registro?: string;
  nome: string;
  pet?: string;
  porte?: string;
  idade?: string;
  raca?: string;
}

interface CancelBody {
  cnpjcpf: string;
  producto: string;
  nome?: string; // obrigatório para pets
}

interface BatchBody {
  items: (CustomerBody | PetBody)[];
}

interface BatchCancelBody {
  items: CancelBody[];
}

// ============================================================
// Helpers
// ============================================================

/** Valida CPF (11 dígitos) ou CNPJ (14 dígitos) — apenas formato, sem checksum. */
function isValidCpfCnpj(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 || digits.length === 14;
}

/** Normaliza data para YYYY-MM-DD se vier em DD/MM/YYYY. */
function normalizeDate(date: string | undefined): string | undefined {
  if (!date) return undefined;
  const ddmmyyyy = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = date.match(ddmmyyyy);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return date;
}

// ============================================================
// Routes
// ============================================================

export async function igsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // ----------------------------------------------------------
  // GET /api/igs/products — Lista produtos disponíveis
  // ----------------------------------------------------------
  app.get('/products', async () => {
    const client = getIGSClient();
    return Object.entries(IGS_PRODUCT_NAMES).map(([id, name]) => ({
      id,
      name,
      endpoint: client.endpointForProduct(id),
    }));
  });

  // ----------------------------------------------------------
  // GET /api/igs/status — Health check da conexão IGS
  // ----------------------------------------------------------
  app.get('/status', async (_request, reply) => {
    try {
      const client = getIGSClient();
      // Tenta login para verificar credenciais — addCustomers([]) retorna erro 406 (JSON array empty)
      // mas confirma que a API está acessível e as credenciais funcionam
      const res = await client.addCustomers([] as IGSCustomerData[]);
      return { status: 'connected', message: 'IGS API acessível', response: res };
    } catch (err: any) {
      return reply.status(503).send({
        status: 'error',
        message: 'Falha na conexão com a IGS',
        error: err.message,
      });
    }
  });

  // ----------------------------------------------------------
  // POST /api/igs/customers — Cadastrar cliente(s)
  // ----------------------------------------------------------
  app.post<{ Body: CustomerBody | CustomerBody[] }>('/customers', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    for (const item of items) {
      if (!isValidCpfCnpj(item.cnpjcpf)) {
        return reply.status(400).send({ error: `CPF/CNPJ inválido: ${item.cnpjcpf}` });
      }
    }

    const payload: IGSCustomerData[] = items.map(item => ({
      action: '1' as const,
      ...item,
      fechanascimiento: normalizeDate(item.fechanascimiento),
    }));

    try {
      const client = getIGSClient();
      const results = await client.addCustomers(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 201).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao cadastrar na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // PUT /api/igs/customers — Atualizar cliente(s)
  // ----------------------------------------------------------
  app.put<{ Body: CustomerBody | CustomerBody[] }>('/customers', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    const payload: IGSCustomerData[] = items.map(item => ({
      action: '2' as const,
      ...item,
      fechanascimiento: normalizeDate(item.fechanascimiento),
    }));

    try {
      const client = getIGSClient();
      const results = await client.updateCustomers(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao atualizar na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // DELETE /api/igs/customers — Cancelar cliente(s)
  // ----------------------------------------------------------
  app.delete<{ Body: CancelBody | CancelBody[] }>('/customers', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    const payload: IGSCancelCustomer[] = items.map(item => ({
      action: '3' as const,
      cnpjcpf: item.cnpjcpf,
      producto: item.producto,
    }));

    try {
      const client = getIGSClient();
      const results = await client.cancelCustomers(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao cancelar na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/igs/residentials — Cadastrar residencial(ais)
  // ----------------------------------------------------------
  app.post<{ Body: CustomerBody | CustomerBody[] }>('/residentials', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    for (const item of items) {
      if (!isValidCpfCnpj(item.cnpjcpf)) {
        return reply.status(400).send({ error: `CPF/CNPJ inválido: ${item.cnpjcpf}` });
      }
    }

    const payload: IGSResidentialData[] = items.map(item => ({
      action: '1' as const,
      ...item,
      producto: IGS_PRODUCTS.RESIDENCIAL_COMPLETO,
      fechanascimiento: normalizeDate(item.fechanascimiento),
    }));

    try {
      const client = getIGSClient();
      const results = await client.addResidentials(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 201).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao cadastrar residencial na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // PUT /api/igs/residentials — Atualizar residencial(ais)
  // ----------------------------------------------------------
  app.put<{ Body: CustomerBody | CustomerBody[] }>('/residentials', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    const payload: IGSResidentialData[] = items.map(item => ({
      action: '2' as const,
      ...item,
      producto: IGS_PRODUCTS.RESIDENCIAL_COMPLETO,
      fechanascimiento: normalizeDate(item.fechanascimiento),
    }));

    try {
      const client = getIGSClient();
      const results = await client.updateResidentials(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao atualizar residencial na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // DELETE /api/igs/residentials — Cancelar residencial(ais)
  // ----------------------------------------------------------
  app.delete<{ Body: CancelBody | CancelBody[] }>('/residentials', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    const payload: IGSCancelCustomer[] = items.map(item => ({
      action: '3' as const,
      cnpjcpf: item.cnpjcpf,
      producto: IGS_PRODUCTS.RESIDENCIAL_COMPLETO,
    }));

    try {
      const client = getIGSClient();
      const results = await client.cancelResidentials(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao cancelar residencial na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/igs/pets — Cadastrar pet(s)
  // ----------------------------------------------------------
  app.post<{ Body: PetBody | PetBody[] }>('/pets', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    for (const item of items) {
      if (!isValidCpfCnpj(item.cnpjcpf)) {
        return reply.status(400).send({ error: `CPF/CNPJ inválido: ${item.cnpjcpf}` });
      }
    }

    const payload: IGSPetData[] = items.map(item => ({
      action: '1' as const,
      ...item,
      producto: IGS_PRODUCTS.ASSISTENCIA_PET,
      registro: item.registro || item.cnpjcpf, // fallback: usar CPF como registro
      fechanascimiento: normalizeDate(item.fechanascimiento),
    }));

    try {
      const client = getIGSClient();
      const results = await client.addPets(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 201).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao cadastrar pet na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // PUT /api/igs/pets — Atualizar pet(s)
  // ----------------------------------------------------------
  app.put<{ Body: PetBody | PetBody[] }>('/pets', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    const payload: IGSPetData[] = items.map(item => ({
      action: '2' as const,
      ...item,
      producto: IGS_PRODUCTS.ASSISTENCIA_PET,
      registro: item.registro || item.cnpjcpf,
      fechanascimiento: normalizeDate(item.fechanascimiento),
    }));

    try {
      const client = getIGSClient();
      const results = await client.updatePets(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao atualizar pet na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // DELETE /api/igs/pets — Cancelar pet(s)
  // ----------------------------------------------------------
  app.delete<{ Body: CancelBody | CancelBody[] }>('/pets', async (request, reply) => {
    const items = Array.isArray(request.body) ? request.body : [request.body];

    // Validação: nome do pet é obrigatório para cancelamento
    for (const item of items) {
      if (!item.nome || item.nome.trim() === '') {
        return reply.status(400).send({
          error: `Campo "nome" do pet é obrigatório para cancelamento (CPF: ${item.cnpjcpf})`,
        });
      }
    }

    const payload: IGSCancelPet[] = items.map(item => ({
      action: '3' as const,
      cnpjcpf: item.cnpjcpf,
      producto: IGS_PRODUCTS.ASSISTENCIA_PET,
      nome: item.nome!,
    }));

    try {
      const client = getIGSClient();
      const results = await client.cancelPets(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro ao cancelar pet na IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/igs/batch — Envio em lote (misto customers + residentials + pets)
  // ----------------------------------------------------------
  app.post<{ Body: BatchBody }>('/batch', async (request, reply) => {
    const { items } = request.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'Campo "items" é obrigatório e deve ser um array' });
    }

    if (items.length > 5000) {
      return reply.status(400).send({ error: 'Limite máximo de 5.000 itens por request' });
    }

    const payload: (IGSCustomerData | IGSResidentialData | IGSPetData)[] = items.map(item => ({
      action: '1' as const,
      ...item,
      fechanascimiento: normalizeDate(item.fechanascimiento),
      // Se for pet e não tiver registro, usar CPF
      ...('nome' in item && item.producto === IGS_PRODUCTS.ASSISTENCIA_PET
        ? { registro: (item as PetBody).registro || item.cnpjcpf }
        : {}),
    }));

    try {
      const client = getIGSClient();
      const results = await client.send(payload);
      const { success, errors } = IGSClient.splitResults(results);

      return reply.status(errors.length > 0 ? 207 : 201).send({
        total: results.length,
        success: success.length,
        errors: errors.length,
        results,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro no envio batch IGS', details: err.message });
    }
  });

  // ----------------------------------------------------------
  // POST /api/igs/batch/cancel — Cancelamento em lote
  // ----------------------------------------------------------
  app.post<{ Body: BatchCancelBody }>('/batch/cancel', async (request, reply) => {
    const { items } = request.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return reply.status(400).send({ error: 'Campo "items" é obrigatório e deve ser um array' });
    }

    // Separar por endpoint: customers, residentials e pets
    const customerCancels: IGSCancelCustomer[] = [];
    const residentialCancels: IGSCancelCustomer[] = [];
    const petCancels: IGSCancelPet[] = [];

    for (const item of items) {
      if (item.producto === IGS_PRODUCTS.ASSISTENCIA_PET) {
        if (!item.nome || item.nome.trim() === '') {
          return reply.status(400).send({
            error: `Campo "nome" do pet é obrigatório para cancelamento (CPF: ${item.cnpjcpf})`,
          });
        }
        petCancels.push({
          action: '3',
          cnpjcpf: item.cnpjcpf,
          producto: item.producto,
          nome: item.nome,
        });
      } else if (item.producto === IGS_PRODUCTS.RESIDENCIAL_COMPLETO) {
        residentialCancels.push({
          action: '3',
          cnpjcpf: item.cnpjcpf,
          producto: item.producto,
        });
      } else {
        customerCancels.push({
          action: '3',
          cnpjcpf: item.cnpjcpf,
          producto: item.producto,
        });
      }
    }

    try {
      const client = getIGSClient();
      const allResults: IGSItemResponse[] = [];

      if (customerCancels.length > 0) {
        const res = await client.cancelCustomers(customerCancels);
        allResults.push(...res);
      }
      if (residentialCancels.length > 0) {
        const res = await client.cancelResidentials(residentialCancels);
        allResults.push(...res);
      }
      if (petCancels.length > 0) {
        const res = await client.cancelPets(petCancels);
        allResults.push(...res);
      }

      const { success, errors } = IGSClient.splitResults(allResults);

      return reply.status(errors.length > 0 ? 207 : 200).send({
        total: allResults.length,
        success: success.length,
        errors: errors.length,
        results: allResults,
      });
    } catch (err: any) {
      return reply.status(500).send({ error: 'Erro no cancelamento batch IGS', details: err.message });
    }
  });
}

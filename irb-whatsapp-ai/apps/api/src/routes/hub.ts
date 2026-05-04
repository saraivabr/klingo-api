import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { db, schema, redis } from '@irb/database';
import { eq, sql, and, or } from 'drizzle-orm';
import { getInstanceStatus } from '../services/uazapi.js';
import { getSyncStatus } from '../services/klingo-sync.js';
import { getIGSClient, IGS_PRODUCT_NAMES } from '../services/igs-client.js';
import { getAsaasClient } from '../services/asaas.js';

export async function hubRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/hub/status — All connections status
  app.get('/status', async () => {
    const results: Record<string, any> = {};

    // 1. WhatsApp (UAZAPI)
    try {
      const status = await getInstanceStatus();
      results.whatsapp = {
        connected: status === 'open',
        status,
        provider: 'UAZAPI',
        url: process.env.UAZAPI_URL || null,
      };
    } catch (err) {
      results.whatsapp = {
        connected: false,
        status: 'error',
        error: (err as Error).message,
        provider: 'UAZAPI',
      };
    }

    // 2. Klingo (sync status)
    try {
      const syncStatus = getSyncStatus();
      results.klingo = {
        connected: true,
        lastSync: syncStatus.lastSyncAt,
        lastSuccess: syncStatus.lastSyncSuccess,
        lastError: syncStatus.lastError,
        itemsSyncedToday: syncStatus.itemsSyncedToday,
      };
    } catch (err) {
      results.klingo = {
        connected: false,
        error: (err as Error).message,
      };
    }

    // 3. IGS
    try {
      const client = getIGSClient();
      // Just check if client can be created (config exists)
      results.igs = {
        connected: true,
        productsCount: Object.keys(IGS_PRODUCT_NAMES).length,
      };
    } catch (err) {
      results.igs = {
        connected: false,
        error: (err as Error).message,
      };
    }

    // 4. Asaas
    try {
      const asaas = getAsaasClient();
      results.asaas = {
        connected: !!asaas,
        environment: process.env.ASAAS_ENVIRONMENT || 'sandbox',
      };
    } catch {
      results.asaas = { connected: false };
    }

    // 5. AI (Claude)
    results.ai = {
      connected: !!process.env.ANTHROPIC_API_KEY,
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
      systemPromptConfigured: true,
    };

    // 6. Redis
    try {
      await redis.ping();
      results.redis = { connected: true };
    } catch {
      results.redis = { connected: false };
    }

    return results;
  });

  // GET /api/hub/ai-config — AI attendance configuration
  app.get('/ai-config', async () => {
    // Get from knowledge base what the AI is configured to handle
    const kb = await db.select({
      key: schema.knowledgeBase.key,
      question: schema.knowledgeBase.question,
      answer: schema.knowledgeBase.answer,
      category: schema.knowledgeBase.category,
    })
      .from(schema.knowledgeBase)
      .orderBy(schema.knowledgeBase.category);

    const services = await db.select({
      id: schema.services.id,
      name: schema.services.name,
      category: schema.services.category,
      priceCents: schema.services.priceCents,
      isActive: schema.services.isActive,
    })
      .from(schema.services)
      .orderBy(schema.services.category);

    const doctors = await db.select({
      id: schema.doctors.id,
      name: schema.doctors.name,
      specialty: schema.doctors.specialty,
      isActive: schema.doctors.isActive,
      klingoId: schema.doctors.klingoId,
    })
      .from(schema.doctors)
      .orderBy(schema.doctors.name);

    // Subscription stats
    const [subStats] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'active')`,
      pending: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'pending')`,
      cancelled: sql<number>`count(*) filter (where ${schema.subscriptions.status} = 'cancelled')`,
    }).from(schema.subscriptions);

    return {
      knowledgeBase: kb,
      services,
      doctors,
      subscriptionStats: {
        total: Number(subStats.total),
        active: Number(subStats.active),
        pending: Number(subStats.pending),
        cancelled: Number(subStats.cancelled),
      },
    };
  });
}

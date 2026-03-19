import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { connectMongo, db, redis, mongoose } from '@irb/database';
import { sql } from 'drizzle-orm';
import { uazapiWebhookRoutes } from './routes/webhooks/uazapi.js';
import { klingoWebhookRoutes } from './routes/webhooks/klingo.js';
import { conversationRoutes } from './routes/conversations.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { settingsRoutes } from './routes/settings.js';
import { authRoutes } from './routes/auth.js';
import { patientRoutes } from './routes/patients.js';
import { bookingRoutes } from './routes/booking.js';
import { igsRoutes } from './routes/igs.js';
import { asaasWebhookRoutes } from './routes/webhooks/asaas.js';
import { subscriptionRoutes } from './routes/subscriptions.js';
import { financeRoutes } from './routes/finance.js';
import { teleconsultationRoutes } from './routes/teleconsultation.js';
import { scheduleRoutes } from './routes/schedules.js';
import { billingRoutes } from './routes/billing.js';
import { labRoutes } from './routes/lab.js';
import { opdRoutes } from './routes/opd.js';
import { pharmacyRoutes } from './routes/pharmacy.js';
import { doctorRoutes } from './routes/doctors.js';
import { syncRoutes } from './routes/sync.js';
import { accountsPayableRoutes } from './routes/accounts-payable.js';
import { accountsReceivableRoutes } from './routes/accounts-receivable.js';
import { cashFlowRoutes } from './routes/cash-flow.js';
import { financeOpsRoutes } from './routes/finance-ops.js';
import { userRoutes } from './routes/users.js';
import { pdvRoutes } from './routes/pdv.js';
import { crmRoutes } from './routes/crm.js';
import { websocketHandler } from './websocket/handler.js';

const PORT = parseInt(process.env.API_PORT || '3001');

async function start() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    allowList: ['127.0.0.1', '::1'],
  });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
  await app.register(websocket);
  await app.register(fastifyStatic, {
    root: '/data/prescriptions',
    prefix: '/api/files/prescriptions/',
    decorateReply: false,
  });

  // Connect databases
  await connectMongo();
  app.log.info('MongoDB connected');

  // Health check (public, no auth)
  app.get('/api/health', async (_request, reply) => {
    const checks: Record<string, string> = {};

    // Redis
    try {
      await redis.ping();
      checks.redis = 'ok';
    } catch { checks.redis = 'unavailable'; }

    // Postgres
    try {
      await db.execute(sql`SELECT 1`);
      checks.postgres = 'ok';
    } catch { checks.postgres = 'unavailable'; }

    // Mongo
    try {
      checks.mongo = mongoose.connection.readyState === 1 ? 'ok' : 'unavailable';
    } catch { checks.mongo = 'unavailable'; }

    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: checks,
    });
  });

  // Public routes (with specific rate limits)
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(async (scope) => {
    scope.addHook('onRoute', (routeOptions) => { routeOptions.config = { ...routeOptions.config, rateLimit: { max: 300, timeWindow: '1 minute' } }; });
    await scope.register(uazapiWebhookRoutes, { prefix: '/api/webhooks' });
    await scope.register(klingoWebhookRoutes, { prefix: '/api/webhooks' });
    await scope.register(asaasWebhookRoutes, { prefix: '/api/webhooks' });
  });
  await app.register(async (scope) => {
    scope.addHook('onRoute', (routeOptions) => { routeOptions.config = { ...routeOptions.config, rateLimit: { max: 30, timeWindow: '1 minute' } }; });
    await scope.register(bookingRoutes, { prefix: '/api/booking' });
  });
  await app.register(teleconsultationRoutes, { prefix: '/api/teleconsultation' });

  // Protected routes
   await app.register(conversationRoutes, { prefix: '/api/conversations' });
   await app.register(patientRoutes, { prefix: '/api/patients' });
   await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
   await app.register(settingsRoutes, { prefix: '/api/settings' });
   await app.register(igsRoutes, { prefix: '/api/igs' });
   await app.register(subscriptionRoutes, { prefix: '/api/subscriptions' });
     await app.register(financeRoutes, { prefix: '/api/finance' });
      await app.register(scheduleRoutes, { prefix: '/api/schedules' });
      await app.register(billingRoutes, { prefix: '/api/billing' });
      await app.register(labRoutes, { prefix: '/api/lab' });
await app.register(opdRoutes, { prefix: '/api/opd' });
       await app.register(pharmacyRoutes, { prefix: '/api/pharmacy' });
        await app.register(doctorRoutes, { prefix: '/api/doctors' });
        await app.register(syncRoutes, { prefix: '/api/sync' });
  await app.register(accountsPayableRoutes, { prefix: '/api/accounts-payable' });
  await app.register(accountsReceivableRoutes, { prefix: '/api/accounts-receivable' });
  await app.register(cashFlowRoutes, { prefix: '/api/cash-flow' });
  await app.register(financeOpsRoutes, { prefix: '/api/finance-ops' });
  await app.register(userRoutes, { prefix: '/api/users' });
  await app.register(pdvRoutes, { prefix: '/api/pdv' });
  await app.register(crmRoutes, { prefix: '/api/crm' });

   // WebSocket
  await app.register(websocketHandler, { prefix: '/ws' });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`API server running on port ${PORT}`);
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

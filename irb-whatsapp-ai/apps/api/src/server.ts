import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import jwt from '@fastify/jwt';
import { connectMongo } from '@irb/database';
import { uazapiWebhookRoutes } from './routes/webhooks/uazapi.js';
import { klingoWebhookRoutes } from './routes/webhooks/klingo.js';
import { conversationRoutes } from './routes/conversations.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { settingsRoutes } from './routes/settings.js';
import { authRoutes } from './routes/auth.js';
import { patientRoutes } from './routes/patients.js';
import { bookingRoutes } from './routes/booking.js';
import { igsRoutes } from './routes/igs.js';
import { websocketHandler } from './websocket/handler.js';

const PORT = parseInt(process.env.API_PORT || '3001');

async function start() {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL || 'info' } });

  // Plugins
  await app.register(cors, { origin: true });
  await app.register(jwt, { secret: process.env.JWT_SECRET || 'dev-secret-change-me' });
  await app.register(websocket);

  // Connect databases
  await connectMongo();
  app.log.info('MongoDB connected');

  // Public routes
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(uazapiWebhookRoutes, { prefix: '/api/webhooks' });
  await app.register(klingoWebhookRoutes, { prefix: '/api/webhooks' });
  await app.register(bookingRoutes, { prefix: '/api/booking' });

  // Protected routes
  await app.register(conversationRoutes, { prefix: '/api/conversations' });
  await app.register(patientRoutes, { prefix: '/api/patients' });
  await app.register(dashboardRoutes, { prefix: '/api/dashboard' });
  await app.register(settingsRoutes, { prefix: '/api/settings' });
  await app.register(igsRoutes, { prefix: '/api/igs' });

  // WebSocket
  await app.register(websocketHandler, { prefix: '/ws' });

  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`API server running on port ${PORT}`);
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

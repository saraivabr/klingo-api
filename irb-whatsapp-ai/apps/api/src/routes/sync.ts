import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { runFullSync, getSyncStatus } from '../services/klingo-sync.js';
import { smartSyncKlingoData } from '../services/klingo-smart-sync.js';

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/sync/klingo/status - Get current sync status
  app.get('/klingo/status', async () => {
    return getSyncStatus();
  });

  // POST /api/sync/klingo - Trigger manual full sync (light version)
  app.post('/klingo', async (request, reply) => {
    try {
      const result = await runFullSync();

      if (result.success) {
        return reply.status(200).send({
          success: true,
          message: 'Sync completed successfully',
          data: result,
        });
      } else {
        return reply.status(400).send({
          success: false,
          message: 'Sync failed',
          error: result.error,
        });
      }
    } catch (err) {
      console.error('[sync] Error during manual sync:', err);
      return reply.status(500).send({
        success: false,
        message: 'Sync error',
        error: (err as Error).message,
      });
    }
  });

  // POST /api/sync/klingo/all - Trigger smart sync (all data from Klingo efficiently)
  app.post('/klingo/all', async (request, reply) => {
    try {
      console.log('[sync] Starting smart Klingo sync (specialties + today appointments)...');
      const result = await smartSyncKlingoData();

      if (result.success) {
        return reply.status(200).send({
          success: true,
          message: 'Smart sync completed successfully',
          data: result,
        });
      } else {
        return reply.status(400).send({
          success: false,
          message: 'Smart sync failed',
          error: result.error,
        });
      }
    } catch (err) {
      console.error('[sync] Error during smart sync:', err);
      return reply.status(500).send({
        success: false,
        message: 'Smart sync error',
        error: (err as Error).message,
      });
    }
  });
}

import { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { runFullSync, getSyncStatus } from '../services/klingo-sync.js';

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authMiddleware);

  // GET /api/sync/klingo/status - Get current sync status
  app.get('/klingo/status', async () => {
    return getSyncStatus();
  });

  // POST /api/sync/klingo - Trigger manual full sync
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
}

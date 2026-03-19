import { FastifyInstance } from 'fastify';
import { subClient } from '@irb/database';

const CHANNELS = ['channel:conversations', 'channel:escalations', 'channel:metrics'];

// Singleton fan-out: one Redis subscription → all WebSocket clients
const clients = new Set<{ readyState: number; OPEN: number; send: (data: string) => void }>();
let subscribed = false;

function setupRedisSubscription(log: FastifyInstance['log']) {
  if (subscribed) return;
  subscribed = true;

  for (const ch of CHANNELS) {
    subClient.subscribe(ch);
  }

  subClient.on('message', (channel: string, message: string) => {
    const payload = JSON.stringify({ channel, data: JSON.parse(message) });
    for (const ws of clients) {
      try {
        if (ws.readyState === ws.OPEN) {
          ws.send(payload);
        }
      } catch (err) {
        log.error({ err }, 'Error sending WebSocket message');
      }
    }
  });
}

export async function websocketHandler(app: FastifyInstance) {
  setupRedisSubscription(app.log);

  app.get('/', { websocket: true }, (socket, request) => {
    app.log.info('WebSocket client connected');
    clients.add(socket);

    socket.on('close', () => {
      app.log.info('WebSocket client disconnected');
      clients.delete(socket);
    });
  });
}

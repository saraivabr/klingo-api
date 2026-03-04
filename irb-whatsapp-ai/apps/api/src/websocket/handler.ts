import { FastifyInstance } from 'fastify';
import { subClient } from '@irb/database';

export async function websocketHandler(app: FastifyInstance) {
  app.get('/', { websocket: true }, (socket, request) => {
    app.log.info('WebSocket client connected');

    // Subscribe to Redis channels
    const channels = ['channel:conversations', 'channel:escalations', 'channel:metrics'];
    
    const messageHandler = (channel: string, message: string) => {
      try {
        socket.send(JSON.stringify({ channel, data: JSON.parse(message) }));
      } catch (err) {
        app.log.error({ err }, 'Error sending WebSocket message');
      }
    };

    for (const ch of channels) {
      subClient.subscribe(ch);
    }
    subClient.on('message', messageHandler);

    socket.on('close', () => {
      app.log.info('WebSocket client disconnected');
      for (const ch of channels) {
        subClient.unsubscribe(ch);
      }
      subClient.off('message', messageHandler);
    });
  });
}

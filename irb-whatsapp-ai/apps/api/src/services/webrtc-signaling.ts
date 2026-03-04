/**
 * WebRTC Signaling - Sinalização de teleconsulta via Redis pub/sub (ioredis)
 *
 * Zero dependência externa. Vídeo é peer-to-peer via WebRTC nativo.
 * O servidor apenas troca SDP offer/answer e ICE candidates entre peers.
 */

import { pubClient } from '@irb/database';
import IORedis from 'ioredis';
const Redis = (IORedis as any).default || IORedis;

const CHANNEL_PREFIX = 'teleconsult:';

/**
 * Publica uma mensagem de sinalização para uma sala
 */
export async function publishSignal(roomCode: string, message: object): Promise<void> {
  await pubClient.publish(`${CHANNEL_PREFIX}${roomCode}`, JSON.stringify(message));
}

/**
 * Cria um subscriber ioredis dedicado para uma sala WebSocket
 * Cada conexão WS precisa de instância própria (ioredis exige isso em subscribe mode)
 */
export function createRoomSubscriber(): InstanceType<typeof Redis> {
  return new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: null,
  });
}

/**
 * STUN servers públicos para NAT traversal
 * Suficiente para a maioria das redes. Se problemas com NAT simétrico,
 * adicionar TURN server próprio (coturn) no futuro.
 */
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

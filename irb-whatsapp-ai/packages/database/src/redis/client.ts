import IORedis from 'ioredis';
const Redis = IORedis.default || IORedis;

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = parseInt(process.env.REDIS_PORT || '6379');
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;

export const redis = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const pubClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

export const subClient = new Redis({
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
});

// Session helpers
const SESSION_TTL = 86400; // 24h

export async function getSession(phone: string) {
  const data = await redis.get(`conv:session:${phone}`);
  return data ? JSON.parse(data) : null;
}

export async function setSession(phone: string, session: Record<string, unknown>) {
  await redis.set(`conv:session:${phone}`, JSON.stringify(session), 'EX', SESSION_TTL);
}

export async function deleteSession(phone: string) {
  await redis.del(`conv:session:${phone}`);
}

// Rate limiting
export async function checkRateLimit(phone: string, maxPerMinute = 10): Promise<boolean> {
  const key = `ratelimit:msg:${phone}`;
  const current = await redis.incr(key);
  if (current === 1) await redis.expire(key, 60);
  return current <= maxPerMinute;
}

// Distributed lock
export async function acquireLock(key: string, ttlSeconds = 30): Promise<boolean> {
  const result = await redis.set(`lock:${key}`, '1', 'EX', ttlSeconds, 'NX');
  return result === 'OK';
}

export async function releaseLock(key: string) {
  await redis.del(`lock:${key}`);
}

// Pub/Sub helpers
export async function publishEvent(channel: string, data: unknown) {
  await pubClient.publish(channel, JSON.stringify(data));
}

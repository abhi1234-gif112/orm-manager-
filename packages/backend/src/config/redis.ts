import IORedis from 'ioredis';
import { env } from './env.js';
import { logger } from './logger.js';

export const redis = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', { err }));

// Separate connection for BullMQ (must not share with subscribe)
export const bullMQConnection = new IORedis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

import { Queue } from 'bullmq';
import { bullMQConnection } from '../config/redis.js';

export const ingestionQueue = new Queue('ingestion', {
  connection: bullMQConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
    attempts: 4,
    backoff: { type: 'exponential', delay: 2000 },
  },
});

export const aiQueue = new Queue('ai', {
  connection: bullMQConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 500 },
    removeOnFail: { count: 100 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
  },
});

export const alertQueue = new Queue('alerts', {
  connection: bullMQConnection,
  defaultJobOptions: {
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 50 },
    attempts: 2,
  },
});

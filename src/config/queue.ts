import { ConnectionOptions } from 'bullmq';
import { parseRedisUrl } from './redis';
import { env } from './environment';

export const queueConnection: ConnectionOptions = {
  ...parseRedisUrl(env.REDIS_URL),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

/**
 * Namespaced per environment so a test run never shares BullMQ state with a
 * locally running dev server: without this, dev workers pick up jobs enqueued
 * by the test suite (and vice versa), which points the jobs at the wrong
 * database and shows up as unexplained multi-second stalls.
 */
export const queuePrefix = `jestbest:queues:${env.NODE_ENV ?? 'development'}`;

export const defaultJobOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 5000,
  },
  removeOnComplete: {
    age: 60 * 60 * 24 * 7,
    count: 1000,
  },
  removeOnFail: {
    age: 60 * 60 * 24 * 14,
  },
};

export const queueConfig = {
  connection: queueConnection,
  prefix: queuePrefix,
  defaultJobOptions,
};

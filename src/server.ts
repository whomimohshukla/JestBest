import http from 'http';
import type { Worker } from 'bullmq';

import { createApp } from './app';
import { env } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { closeAllQueues } from './queues';
import { setupWorkers } from './workers';
import { logger } from './config/logger';

const app = createApp();

let server: http.Server | undefined;
const workers: Worker[] = [];
const startedAt = Date.now();

const shutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'shutting down');
  if (server) {
    server.close();
  }
  await Promise.allSettled(workers.map((worker) => worker.close()));
  // Queues and the shared Redis client are process-wide singletons; leaving them
  // open keeps the event loop alive and leaks connections on every reload.
  await Promise.allSettled([closeAllQueues(), closeRedis()]);
  await disconnectDatabase();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

const main = async (): Promise<void> => {
  await connectDatabase();
  workers.push(...setupWorkers());
  server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        nodeEnv: env.NODE_ENV,
        pid: process.pid,
        bootMs: Date.now() - startedAt,
      },
      'JestBest API listening'
    );
  });
};

main().catch((error) => {
  logger.fatal({ err: error }, 'failed to start server');
  process.exit(1);
});

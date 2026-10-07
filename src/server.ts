import http from 'http';
import type { Worker } from 'bullmq';

import { createApp } from './app';
import { env } from './config/environment';
import { connectDatabase, disconnectDatabase } from './config/database';
import { closeRedis } from './config/redis';
import { closeAllQueues } from './queues';
import { emailService } from './services/notification/emailService';
import { setupWorkers } from './workers';
import { logger } from './config/logger';
import { setShuttingDown } from './controllers/health';

const app = createApp();

let server: http.Server | undefined;
const workers: Worker[] = [];
const startedAt = Date.now();
let shuttingDown = false;

const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  // 1. Fail readiness first: the load balancer must stop sending traffic
  //    before anything is closed, otherwise requests land on dead sockets.
  setShuttingDown(true);
  await new Promise((resolve) => setTimeout(resolve, 250));

  // 2. Drain in-flight HTTP with a deadline. close() only resolves once every
  //    socket is done; without a deadline a stuck keep-alive hangs the pod
  //    until the platform SIGKILLs it.
  if (server) {
    await Promise.race([
      new Promise<void>((resolve) => {
        server?.close(() => resolve());
        server?.closeIdleConnections?.();
      }),
      new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
    ]);
  }

  // 3. Workers after HTTP: closing them first would let a request that arrived
  //    in the drain window enqueue into a closed queue.
  await Promise.allSettled(workers.map((worker) => worker.close()));
  // Queues and the shared Redis client are process-wide singletons; leaving them
  // open keeps the event loop alive and leaks connections on every reload. The
  // pooled SMTP transport holds an open socket for the same reason.
  await Promise.allSettled([closeAllQueues(), closeRedis(), emailService.closeTransporter()]);
  await disconnectDatabase();
  logger.info({ signal }, 'shutdown complete');
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

// Node's default for unhandledRejection is a silent-ish crash with no context;
// log it with the structured logger first so the failure is attributable.
process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'unhandledRejection');
});
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'uncaughtException');
  process.exit(1);
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

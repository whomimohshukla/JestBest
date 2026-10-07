import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { getRedis } from '../../config/redis';
import { testQueue } from '../../queues/testQueue';
import { Messages } from '../../constants/messages';
import { ErrorCodes } from '../../constants';
import { ok, errorResponse } from '../../utils/formatters';

const CHECK_TIMEOUT_MS = 1500;

type CheckName = 'database' | 'redis' | 'queue';
type CheckResult = { status: 'ok' | 'fail'; latencyMs: number; error?: string };

/**
 * Flipped by server.ts before it starts draining, so a load balancer stops
 * routing to this instance while in-flight requests finish. Without it the
 * probe kept answering 200 throughout shutdown and the container was only
 * ever removed when the process died.
 */
let shuttingDown = false;
export const setShuttingDown = (value: boolean): void => {
  shuttingDown = value;
};

const runCheck = async (fn: () => Promise<unknown>): Promise<CheckResult> => {
  const started = Date.now();
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${CHECK_TIMEOUT_MS}ms`)),
          CHECK_TIMEOUT_MS
        );
      }),
    ]);
    return { status: 'ok', latencyMs: Date.now() - started };
  } catch (error) {
    return {
      status: 'fail',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const collectChecks = async (): Promise<Record<CheckName, CheckResult>> => {
  const [database, redis, queue] = await Promise.all([
    runCheck(() => prisma.$queryRaw`SELECT 1`),
    runCheck(() => getRedis().ping()),
    // BullMQ holds its own connection, so this fails even when a direct PING
    // succeeds — it is the check that actually matters for test runs.
    runCheck(() => testQueue.getJobCounts('wait', 'active', 'failed', 'delayed')),
  ]);
  return { database, redis, queue };
};

/** Liveness: the process is up and serving HTTP. No dependencies. */
export const health = async (_req: Request, res: Response): Promise<void> => {
  res
    .status(200)
    .json(ok({ status: 'up', timestamp: new Date().toISOString() }, { message: Messages.HEALTH.OK }));
};

export const live = health;

/**
 * Readiness: every dependency the server needs to do useful work.
 *
 * All three paths used to return `{status:'up'}` unconditionally, so a
 * container with a dead database pool still reported healthy — the
 * Docker healthcheck and `deploy.sh`'s rollout gate were both checking a
 * liveness probe wearing a readiness label.
 */
export const ready = async (req: Request, res: Response): Promise<void> => {
  const checks = await collectChecks();
  const healthy = !shuttingDown && Object.values(checks).every((check) => check.status === 'ok');
  const timestamp = new Date().toISOString();

  if (healthy) {
    res.status(200).json(ok({ status: 'ready', checks, timestamp }, { message: Messages.HEALTH.OK }));
    return;
  }

  res.status(503).json(
    errorResponse(
      {
        code: ErrorCodes.SERVICE_UNAVAILABLE,
        message: shuttingDown ? 'Server is shutting down.' : 'Server is not ready.',
        details: { checks, timestamp },
      },
      req.requestId
    )
  );
};

import express from 'express';
import supertest from 'supertest';
import { prisma, connectDatabase, disconnectDatabase } from '../../src/config/database';
import { closeRedis } from '../../src/config/redis';
import { closeAllQueues } from '../../src/queues';
import { createApp } from '../../src/app';

export type TestUser = {
  userId: string;
  organizationId: string;
  accessToken: string;
  refreshToken: string;
  email: string;
  password: string;
};

let app: express.Express | null = null;

export const getApp = async (): Promise<express.Express> => {
  if (!app) {
    await connectDatabase();
    app = createApp();
  }
  return app;
};

export const request = async () => {
  const instance = await getApp();
  return supertest(instance);
};

export const teardownDatabase = async (): Promise<void> => {
  // Importing the app transitively constructs BullMQ Queue instances and a shared
  // Redis client. Without closing them jest never finishes, because the event
  // loop stays alive.
  await Promise.allSettled([closeAllQueues(), closeRedis()]);
  await disconnectDatabase();
  app = null;
};

/**
 * Order matters: children before parents because of foreign key constraints.
 * `IncidentKnowledge` is intentionally omitted — it is not part of the
 * user-visible surface under test and carries a pgvector column.
 */
const TABLES_IN_DELETE_ORDER = [
  'auditLog',
  'webhookDelivery',
  'webhook',
  'integration',
  'agentToolCall',
  'agentMessage',
  'agentRun',
  'aITrace',
  'aIEvaluation',
  'aICost',
  'testResult',
  'testRun',
  'testSuiteItem',
  'testCase',
  'testSuite',
  'testUser',
  'environment',
  'applicationScan',
  'pageRelation',
  'page',
  'component',
  'workflow',
  'application',
  'bugComment',
  'bugAttachment',
  'bug',
  'flakyTestRecord',
  'testHealing',
  'releaseAnalysis',
  'apiKey',
  'subscription',
  'usage',
  'project',
  'membership',
  'organization',
  'user',
] as const;

export const resetDatabase = async (): Promise<void> => {
  for (const table of TABLES_IN_DELETE_ORDER) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic table name
      await (prisma as any)[table].deleteMany({});
    } catch (error) {
      // A table that does not exist in this schema version should not block cleanup.
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('does not exist')) {
        throw error;
      }
    }
  }
};

let sequence = 0;

export const uniqueEmail = (label = 'user'): string => {
  sequence += 1;
  return `${label}.${Date.now()}.${sequence}@veribot.test`;
};

export const TEST_PASSWORD = 'SuperSecret123!';

type AuthedRequest = ReturnType<typeof supertest>;

/**
 * Registers a user, completes email verification and returns a logged-in
 * session. This mirrors the real signup path so tests exercise the same code
 * (and the same tokens) that a real client receives.
 */
export const createTestUser = async (
  api: AuthedRequest,
  options: { email?: string; password?: string; organizationName?: string } = {}
): Promise<TestUser> => {
  const email = options.email ?? uniqueEmail();
  const password = options.password ?? TEST_PASSWORD;
  const organizationName = options.organizationName ?? `Org ${email.split('@')[0]}`;

  const register = await api.post('/api/v1/auth/register').send({
    email,
    password,
    name: 'Test User',
    organizationName,
  });
  if (register.status !== 201) {
    throw new Error(
      `register failed: ${register.status} ${JSON.stringify(register.body?.error ?? register.body)}`
    );
  }

  const verificationToken = register.body.data.verificationToken as string;
  const verify = await api
    .post('/api/v1/auth/verify-email')
    .send({ token: verificationToken });
  if (verify.status !== 200) {
    throw new Error(`verify-email failed: ${verify.status} ${JSON.stringify(verify.body)}`);
  }

  const login = await api.post('/api/v1/auth/login').send({ email, password });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    userId: login.body.data.user.id as string,
    organizationId: login.body.data.organization.id as string,
    accessToken: login.body.data.tokens.accessToken as string,
    refreshToken: login.body.data.tokens.refreshToken as string,
    email,
    password,
  };
};

export const auth = (user: TestUser) => ({ Authorization: `Bearer ${user.accessToken}` });

export type { AuthedRequest };

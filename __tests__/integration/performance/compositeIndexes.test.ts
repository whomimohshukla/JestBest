import { connectDatabase, disconnectDatabase, prisma } from '../../../src/config/database';

/**
 * Index guard for the paginated list endpoints.
 *
 * Every list route filters on a scope column and then sorts `createdAt DESC`
 * (bugs, audit logs, test runs, webhook deliveries, test cases). Those queries
 * need a composite `(scope, createdAt)` index or Postgres falls back to a
 * top-N sort that degrades as an organization accumulates rows.
 *
 * The single-column indexes below were dropped in the same migration: each one
 * is a strict leading-column prefix of its replacement, so equality-only
 * queries keep coverage while the ORDER BY stops needing a sort. If someone
 * removes one of these from `schema.prisma` without a migration — or adds the
 * migration back but not the schema — this test fails.
 *
 * Proof of the plan shape lives in README.md ("Performance").
 */

const COMPOSITE_INDEXES = [
  'TestCase_projectId_createdAt_idx',
  'TestRun_projectId_createdAt_idx',
  'TestRun_status_createdAt_idx',
  'Bug_organizationId_createdAt_idx',
  'Bug_projectId_createdAt_idx',
  'AuditLog_organizationId_createdAt_idx',
  'WebhookDelivery_webhookId_createdAt_idx',
] as const;

/** Superseded single-column indexes; keeping them costs write amplification. */
const REPLACED_PREFIXES = [
  'TestCase_projectId_idx',
  'TestRun_projectId_idx',
  'TestRun_status_idx',
  'Bug_organizationId_idx',
  'Bug_projectId_idx',
  'AuditLog_organizationId_idx',
  'WebhookDelivery_webhookId_idx',
] as const;

const listIndexes = async (): Promise<Set<string>> => {
  const rows = await prisma.$queryRaw<Array<{ indexname: string }>>`
    SELECT indexname FROM pg_indexes WHERE schemaname = current_schema()
  `;
  return new Set(rows.map((row) => row.indexname));
};

beforeAll(async () => {
  await connectDatabase();
});

afterAll(async () => {
  await disconnectDatabase();
});

describe('composite list indexes', () => {
  it('creates a (scope, createdAt) index for every paginated list', async () => {
    const indexes = await listIndexes();
    for (const name of COMPOSITE_INDEXES) {
      expect(indexes.has(name)).toBe(true);
    }
  });

  it('drops the single-column prefixes the composites replace', async () => {
    const indexes = await listIndexes();
    for (const name of REPLACED_PREFIXES) {
      expect(indexes.has(name)).toBe(false);
    }
  });

  it('keeps the unscoped createdAt index the planner uses for global recency queries', async () => {
    const indexes = await listIndexes();
    expect(indexes.has('TestRun_createdAt_idx')).toBe(true);
    expect(indexes.has('Bug_createdAt_idx')).toBe(true);
    expect(indexes.has('AuditLog_createdAt_idx')).toBe(true);
  });
});

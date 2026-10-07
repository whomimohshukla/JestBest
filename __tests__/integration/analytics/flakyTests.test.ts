import { prisma } from '../../../src/config/database';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

/**
 * GET /analytics/flaky-tests:
 *  - reads the records the detection job wrote, joined with the caller's own
 *    test-case titles, highest flakiness first
 *  - never returns another tenant's analysis (records are keyed by test-case
 *    id, so a naive query would leak across organizations)
 *  - refuses a project id that belongs to somebody else instead of silently
 *    treating it as the caller's
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;
let projectId: string;
let testCaseId: string;

const seedRecord = (id: string, flakyScore: number) =>
  prisma.flakyTestRecord.create({
    data: {
      testCaseId: id,
      flakyScore,
      totalRuns: 20,
      passCount: 12,
      failCount: 8,
      rootCauseAnalysis: 'Race between cart update and promo render',
      lastOccurredAt: new Date('2026-10-01T10:00:00.000Z'),
    },
  });

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);

  const project = await api.post(`${API}/projects`).set(auth(user)).send({ name: 'Flaky Project' });
  projectId = project.body.data.id as string;

  const testCase = await api
    .post(`${API}/test-cases`)
    .set(auth(user))
    .send({ projectId, title: 'Checkout applies coupon' });
  testCaseId = testCase.body.data.id as string;
});

afterAll(async () => {
  await teardownDatabase();
});

describe('GET /analytics/flaky-tests', () => {
  it('returns an empty list when nothing has been detected yet', async () => {
    const res = await api.get(`${API}/analytics/flaky-tests`).set(auth(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns detected records with the title joined and the worst first', async () => {
    await seedRecord(testCaseId, 41);
    const second = await api
      .post(`${API}/test-cases`)
      .set(auth(user))
      .send({ projectId, title: 'Login persists session' });
    await seedRecord(second.body.data.id as string, 88);

    const res = await api.get(`${API}/analytics/flaky-tests`).set(auth(user));

    expect(res.status).toBe(200);
    const items = res.body.data as Array<{
      testCaseId: string;
      testCaseTitle: string;
      flakyScore: number;
      rootCauseAnalysis: string;
    }>;
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.flakyScore)).toEqual([88, 41]);
    expect(items[0].testCaseTitle).toBe('Login persists session');
    expect(items[1].rootCauseAnalysis).toBe('Race between cart update and promo render');
  });

  it('hides records below the flakiness threshold', async () => {
    await seedRecord(testCaseId, 9);

    const res = await api.get(`${API}/analytics/flaky-tests`).set(auth(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('does not leak another organization flaky analysis', async () => {
    const other = await createTestUser(api);
    const otherProject = await api
      .post(`${API}/projects`)
      .set(auth(other))
      .send({ name: 'Other Project' });
    const otherCase = await api
      .post(`${API}/test-cases`)
      .set(auth(other))
      .send({ projectId: otherProject.body.data.id as string, title: 'Other tenant case' });
    await seedRecord(otherCase.body.data.id as string, 95);
    await seedRecord(testCaseId, 60);

    const res = await api.get(`${API}/analytics/flaky-tests`).set(auth(user));

    expect(res.status).toBe(200);
    const items = res.body.data as Array<{ testCaseId: string; testCaseTitle: string }>;
    expect(items).toHaveLength(1);
    expect(items[0].testCaseId).toBe(testCaseId);
    expect(items.map((i) => i.testCaseTitle)).not.toContain('Other tenant case');
  });

  it('rejects a project owned by another organization', async () => {
    const other = await createTestUser(api);
    const otherProject = await api
      .post(`${API}/projects`)
      .set(auth(other))
      .send({ name: 'Foreign Project' });

    const res = await api
      .get(`${API}/analytics/flaky-tests`)
      .query({ projectId: otherProject.body.data.id as string })
      .set(auth(user));

    expect(res.status).toBe(404);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await api.get(`${API}/analytics/flaky-tests`);
    expect(res.status).toBe(401);
  });
});

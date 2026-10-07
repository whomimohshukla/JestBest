import { prisma } from '../../../src/config/database';
import { testExecutionService } from '../../../src/services/test/testExecutionService';
import { testRunService } from '../../../src/services/test/testRunService';
import { enqueueTestExecution, testQueue } from '../../../src/queues/testQueue';
import { auth, createTestUser, request, resetDatabase, teardownDatabase } from '../../fixtures/testApp';

/**
 * Exactly-once execution of a test run.
 *
 * BullMQ redelivers: a job retries after a transient failure, a double submit
 * enqueues twice, and two workers can drain the queue at the same time. Each of
 * those used to run the whole suite again — double browser time, double usage
 * billing, double webhooks/notifications — and a run cancelled by the user was
 * overwritten with PASSED/FAILED when the in-flight execution finished.
 *
 * The runs below have no test results, so the body of the run is a no-op and
 * only the claim/finalise/billing path is exercised (a real browser would make
 * these tests slow and flaky).
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let organizationId: string;
let userId: string;
let projectId: string;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  const owner = await createTestUser(api);
  organizationId = owner.organizationId;
  userId = owner.userId;
  const project = await api.post(`${API}/projects`).set(auth(owner)).send({ name: 'Exactly Once' });
  expect(project.status).toBe(201);
  projectId = project.body.data.id as string;
  await testQueue.drain();
});

afterAll(async () => {
  await testQueue.drain();
  await teardownDatabase();
});

const createRun = (status: 'PENDING' | 'RUNNING' | 'CANCELLED', startedAt?: Date) =>
  prisma.testRun.create({
    data: {
      projectId,
      createdById: userId,
      status,
      totalTests: 0,
      executionStartedAt: startedAt,
    },
  });

const execute = (testRunId: string) =>
  testExecutionService.executeRun({ testRunId, projectId, organizationId });

const usage = async () => {
  const row = await prisma.usage.findFirst({ where: { organizationId } });
  return { testsRun: row?.testsRun ?? 0, apiRequests: row?.apiRequests ?? 0 };
};

describe('test run executes at most once', () => {
  it('claims a pending run, bills usage once and records a verdict', async () => {
    const run = await createRun('PENDING');

    await execute(run.id);

    const finished = await prisma.testRun.findUnique({ where: { id: run.id } });
    expect(finished?.status).toBe('PASSED');
    expect(finished?.executionStartedAt).not.toBeNull();
    expect(finished?.executionCompletedAt).not.toBeNull();
    expect(await usage()).toMatchObject({ testsRun: 0, apiRequests: 1 });
  });

  it('refuses a second execution of a finished run', async () => {
    const run = await createRun('PENDING');
    await execute(run.id);
    const firstFinish = await prisma.testRun.findUnique({ where: { id: run.id } });

    // The redelivered job: same test run, executed again.
    await execute(run.id);

    const after = await prisma.testRun.findUnique({ where: { id: run.id } });
    expect(after?.executionCompletedAt).toEqual(firstFinish?.executionCompletedAt);
    expect(await usage()).toMatchObject({ apiRequests: 1 });
  });

  it('refuses to start a run that was cancelled before the worker got to it', async () => {
    const run = await createRun('PENDING');
    await testRunService.cancel(run.id);

    await execute(run.id);

    const after = await prisma.testRun.findUnique({ where: { id: run.id } });
    expect(after?.status).toBe('CANCELLED');
    expect(after?.executionStartedAt).toBeNull();
    expect(await usage()).toMatchObject({ apiRequests: 0 });
  });

  it('takes over a run whose worker died mid-execution', async () => {
    const stale = new Date(Date.now() - 20 * 60 * 1000);
    const run = await createRun('RUNNING', stale);

    await execute(run.id);

    const after = await prisma.testRun.findUnique({ where: { id: run.id } });
    expect(after?.status).toBe('PASSED');
    expect(await usage()).toMatchObject({ apiRequests: 1 });
  });

  it('does not take over a run another worker is actively running', async () => {
    const fresh = new Date(Date.now() - 60 * 1000);
    const run = await createRun('RUNNING', fresh);

    await execute(run.id);

    const after = await prisma.testRun.findUnique({ where: { id: run.id } });
    expect(after?.status).toBe('RUNNING');
    expect(await usage()).toMatchObject({ apiRequests: 0 });
  });
});

describe('enqueue dedupes on the test run id', () => {
  it('creates one job no matter how many times the run is enqueued', async () => {
    const run = await createRun('PENDING');
    const data = {
      testRunId: run.id,
      organizationId,
      projectId,
      testCaseIds: [],
    };

    const first = await enqueueTestExecution(data);
    const second = await enqueueTestExecution(data);

    expect(second).toBe(first);
    const jobs = await testQueue.getJobs(['waiting', 'delayed', 'completed', 'failed']);
    expect(jobs.filter((job) => job.id === `test-run-${run.id}`)).toHaveLength(1);
  });
});

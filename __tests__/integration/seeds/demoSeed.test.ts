import { connectDatabase, prisma } from '../../../src/config/database';
import { resetDatabase, teardownDatabase } from '../../fixtures/testApp';
import { seedDemoData } from '../../../src/seeds/demo';

/**
 * Demo seed (`npm run seed:demo`).
 *
 *  - a fresh install gets a workspace an evaluator can actually look at
 *  - the run history is spread over two weeks, so the dashboard charts and the
 *    "last 14 days" widgets have something to render
 *  - re-running the seed is a no-op, which is what makes it safe to run on an
 *    existing database
 */

beforeAll(async () => {
  await connectDatabase();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('seedDemoData', () => {
  it('creates a workspace with cases, run history, bugs and usage rows', async () => {
    const summary = await seedDemoData();

    expect(summary.alreadySeeded).toBe(false);
    expect(summary.testCases).toBe(5);
    expect(summary.testRuns).toBe(8);
    expect(summary.testResults).toBe(40);
    expect(summary.bugs).toBe(5);

    const project = await prisma.project.findUniqueOrThrow({
      where: { id: summary.projectId },
    });
    expect(project.organizationId).toBe(summary.organizationId);

    const suites = await prisma.testSuite.findMany({
      where: { projectId: project.id },
      include: { testSuiteItems: true },
    });
    expect(suites).toHaveLength(1);
    expect(suites[0]?.testSuiteItems).toHaveLength(5);

    const runs = await prisma.testRun.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(runs).toHaveLength(8);
    expect(runs.every((run) => run.status !== 'PENDING')).toBe(true);
    expect(runs.some((run) => run.status === 'PASSED')).toBe(true);
    expect(runs.some((run) => run.status === 'FAILED')).toBe(true);

    // The history must reach back far enough for 14-day charts to be non-empty.
    const oldest = runs[0];
    expect(oldest).toBeDefined();
    const ageDays = (Date.now() - (oldest?.createdAt.getTime() ?? 0)) / (24 * 60 * 60 * 1000);
    expect(ageDays).toBeGreaterThanOrEqual(12);
    expect(ageDays).toBeLessThanOrEqual(16);

    const results = await prisma.testResult.count({ where: { testRunId: { in: runs.map((r) => r.id) } } });
    expect(results).toBe(40);
    expect(
      await prisma.testResult.count({
        where: { status: 'FAILED', errorMessage: { not: null } },
      })
    ).toBeGreaterThan(0);

    const bugs = await prisma.bug.findMany({ where: { projectId: project.id } });
    expect(bugs).toHaveLength(5);
    expect(bugs.some((bug) => bug.status === 'OPEN')).toBe(true);
    expect(bugs.filter((bug) => bug.closedAt !== null).length).toBeGreaterThan(0);

    expect(await prisma.usage.count({ where: { organizationId: summary.organizationId } })).toBe(3);

    const demoUser = await prisma.user.findUniqueOrThrow({ where: { id: summary.userId } });
    expect(demoUser.email).toBe('demo@jestbest.dev');
    expect(demoUser.emailVerified).not.toBeNull();
    expect(demoUser.passwordHash).not.toBeNull();
  });

  it('is idempotent: a second run adds nothing', async () => {
    const first = await seedDemoData();
    const second = await seedDemoData();

    expect(second.alreadySeeded).toBe(true);
    expect(second.projectId).toBe(first.projectId);
    expect(second.testCases).toBe(0);
    expect(second.testRuns).toBe(0);

    expect(await prisma.project.count({ where: { name: 'Acme Storefront' } })).toBe(1);
    expect(await prisma.user.count({ where: { email: 'demo@jestbest.dev' } })).toBe(1);
    expect(await prisma.testRun.count()).toBe(8);
    expect(await prisma.bug.count()).toBe(5);
    expect(await prisma.usage.count()).toBe(3);
  });

  it('attaches the workspace to the seeded admin when one exists', async () => {
    const first = await seedDemoData();

    // Point the seed at the account it just created and re-run: the project
    // must land on that same organization, not a second one.
    const second = await seedDemoData();
    expect(second.organizationId).toBe(first.organizationId);
    expect(await prisma.organization.count()).toBe(1);
  });
});

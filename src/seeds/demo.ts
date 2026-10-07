import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { env } from '../config/environment';
import { passwordService } from '../services/auth/passwordService';
import { toSlug } from '../utils/helpers';
import type { TestStep } from '../types/domain.types';
import type { Prisma } from '@prisma/client';

/**
 * Demo workspace: a project, cases, a history of runs and a bug backlog.
 *
 * A fresh install only has roles/permissions and (optionally) an admin, so the
 * dashboard an evaluator opens on first login was empty — no chart had data,
 * no list had rows, and nothing demonstrated the product. This seeds a
 * believable 2-week history instead of inventing numbers at render time.
 *
 * Every write is keyed off existing rows (project name, e-mail, month), so
 * re-running the seed never duplicates anything.
 */

const DEMO_PROJECT = 'Acme Storefront';
const DEMO_PASSWORD = 'DemoPassword123!';

const daysAgo = (days: number, hour = 9): Date => {
  const at = new Date();
  at.setDate(at.getDate() - days);
  at.setHours(hour, 17, 0, 0);
  return at;
};

const monthStart = (offsetMonths: number): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offsetMonths, 1));
};

interface DemoCaseSeed {
  title: string;
  description: string;
  type: 'FUNCTIONAL' | 'SMOKE' | 'REGRESSION' | 'NEGATIVE';
  priority: 'high' | 'medium' | 'low';
  tags: string[];
  steps: TestStep[];
  expectedResult: string;
}

const DEMO_CASES: DemoCaseSeed[] = [
  {
    title: 'User can sign in with valid credentials',
    description: 'Happy path for the email/password sign-in form.',
    type: 'SMOKE',
    priority: 'high',
    tags: ['smoke', 'auth'],
    steps: [
      { action: 'goto', value: '/login' },
      { action: 'fill', selector: '#email', value: 'qa@acme.test' },
      { action: 'fill', selector: '#password', value: 'correct horse battery' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'expectVisible', selector: '[data-testid="dashboard"]' },
    ],
    expectedResult: 'The dashboard loads and the user menu shows the account email.',
  },
  {
    title: 'Sign-in rejects a wrong password',
    description: 'Invalid credentials must surface the auth error, not a blank screen.',
    type: 'NEGATIVE',
    priority: 'high',
    tags: ['auth', 'negative'],
    steps: [
      { action: 'goto', value: '/login' },
      { action: 'fill', selector: '#email', value: 'qa@acme.test' },
      { action: 'fill', selector: '#password', value: 'wrong-password' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'expectText', selector: '[role="alert"]', text: 'Invalid email or password' },
    ],
    expectedResult: 'An inline error is shown and the session stays unauthenticated.',
  },
  {
    title: 'Checkout applies a valid discount code',
    description: 'A known coupon reduces the order total before payment.',
    type: 'FUNCTIONAL',
    priority: 'high',
    tags: ['checkout', 'billing'],
    steps: [
      { action: 'goto', value: '/cart' },
      { action: 'fill', selector: '#coupon', value: 'SPRING10' },
      { action: 'click', selector: 'button:has-text("Apply")' },
      { action: 'expectText', selector: '[data-testid="order-total"]', text: '$90.00' },
    ],
    expectedResult: 'The order total reflects the 10% discount.',
  },
  {
    title: 'Guest cart survives a page reload',
    description: 'Cart contents are restored from storage after navigation.',
    type: 'REGRESSION',
    priority: 'medium',
    tags: ['cart', 'regression'],
    steps: [
      { action: 'goto', value: '/products' },
      { action: 'click', selector: '[data-testid="add-to-cart"]' },
      { action: 'press', selector: 'body', value: 'F5' },
      { action: 'expectText', selector: '[data-testid="cart-count"]', text: '1' },
    ],
    expectedResult: 'The cart badge still shows one item.',
  },
  {
    title: 'Password reset email is delivered',
    description: 'Requesting a reset sends a mail with a working token link.',
    type: 'FUNCTIONAL',
    priority: 'medium',
    tags: ['auth', 'email'],
    steps: [
      { action: 'goto', value: '/forgot-password' },
      { action: 'fill', selector: '#email', value: 'qa@acme.test' },
      { action: 'click', selector: 'button[type="submit"]' },
      { action: 'expectText', selector: '[data-testid="sent-confirmation"]', text: 'Check your inbox' },
    ],
    expectedResult: 'A confirmation appears and the reset email is delivered.',
  },
];

interface BugSeed {
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'OPEN' | 'IN_PROGRESS' | 'FIXED' | 'VERIFIED' | 'CLOSED';
  createdDaysAgo: number;
}

const DEMO_BUGS: BugSeed[] = [
  {
    title: 'Discount code SPRING10 not applied on Safari',
    description:
      'On Safari 17 the coupon is accepted but the order total never changes. Chrome and Firefox are fine.',
    severity: 'HIGH',
    priority: 'P1',
    status: 'IN_PROGRESS',
    createdDaysAgo: 6,
  },
  {
    title: 'Checkout button stays disabled after address edit',
    description: 'Editing a saved address leaves the place-order button disabled until the page is reloaded.',
    severity: 'CRITICAL',
    priority: 'P0',
    status: 'OPEN',
    createdDaysAgo: 3,
  },
  {
    title: 'Password reset email lands in spam for outlook.com',
    description: 'SPF/DKIM pass but the bulk folder still swallows the reset mail for outlook recipients.',
    severity: 'MEDIUM',
    priority: 'P2',
    status: 'OPEN',
    createdDaysAgo: 9,
  },
  {
    title: 'Cart badge rounds down quantities above 99',
    description: 'The header badge shows "99+" even for a single line item of quantity 120.',
    severity: 'LOW',
    priority: 'P3',
    status: 'FIXED',
    createdDaysAgo: 12,
  },
  {
    title: 'Guest cart lost when the session cookie expires',
    description: 'A cart built while signed out disappears once the 24h guest cookie lapses.',
    severity: 'MEDIUM',
    priority: 'P2',
    status: 'VERIFIED',
    createdDaysAgo: 14,
  },
];

/** Days back, then how many of the five cases passed / failed. */
const RUN_PLAN: Array<{ daysAgo: number; passed: number; failed: number }> = [
  { daysAgo: 1, passed: 5, failed: 0 },
  { daysAgo: 2, passed: 4, failed: 1 },
  { daysAgo: 3, passed: 5, failed: 0 },
  { daysAgo: 5, passed: 3, failed: 2 },
  { daysAgo: 7, passed: 5, failed: 0 },
  { daysAgo: 9, passed: 4, failed: 1 },
  { daysAgo: 11, passed: 5, failed: 0 },
  { daysAgo: 13, passed: 2, failed: 3 },
];

export interface DemoSeedSummary {
  organizationId: string;
  userId: string;
  projectId: string;
  testCases: number;
  testRuns: number;
  testResults: number;
  bugs: number;
  alreadySeeded: boolean;
}

/** Resolve (or create) the workspace the demo data hangs off. */
const ensureDemoWorkspace = async (): Promise<{ organizationId: string; userId: string }> => {
  const email = env.SEED_ADMIN_EMAIL ?? 'demo@jestbest.dev';
  const password = env.SEED_ADMIN_PASSWORD ?? DEMO_PASSWORD;

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { memberships: { orderBy: { joinedAt: 'asc' } } },
  });
  if (existing) {
    const membership = existing.memberships[0];
    if (membership) {
      return { organizationId: membership.organizationId, userId: existing.id };
    }
  }

  const organization = await prisma.organization.create({
    data: { name: 'JestBest Demo', slug: toSlug(`JestBest Demo ${Date.now()}`) },
  });
  const passwordHash = await passwordService.hash(password);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Demo QA Lead',
      passwordHash,
      emailVerified: new Date(),
      memberships: { create: { organizationId: organization.id, role: 'OWNER' } },
    },
  });
  return { organizationId: organization.id, userId: user.id };
};

export const seedDemoData = async (): Promise<DemoSeedSummary> => {
  const { organizationId, userId } = await ensureDemoWorkspace();

  const existingProject = await prisma.project.findFirst({
    where: { organizationId, name: DEMO_PROJECT },
  });
  if (existingProject) {
    return {
      organizationId,
      userId,
      projectId: existingProject.id,
      testCases: 0,
      testRuns: 0,
      testResults: 0,
      bugs: 0,
      alreadySeeded: true,
    };
  }

  const project = await prisma.project.create({
    data: {
      organizationId,
      name: DEMO_PROJECT,
      description: 'Reference storefront used to demonstrate JestBest end to end.',
    },
  });
  await prisma.application.create({
    data: {
      projectId: project.id,
      name: 'Acme Storefront Web',
      baseUrl: 'https://demo.acme.test',
      description: 'Public storefront the demo suite drives in a real browser.',
    },
  });

  const testCases = await Promise.all(
    DEMO_CASES.map((seed) =>
      prisma.testCase.create({
        data: {
          projectId: project.id,
          title: seed.title,
          description: seed.description,
          type: seed.type,
          priority: seed.priority,
          status: 'active',
          // TestStep is structurally a list of objects; Prisma's Json input
          // is typed as a generic JSON value, hence the cast at the boundary.
          steps: seed.steps as unknown as Prisma.InputJsonValue,
          expectedResult: seed.expectedResult,
          tags: seed.tags,
          ownerId: userId,
        },
      })
    )
  );

  const suite = await prisma.testSuite.create({
    data: {
      projectId: project.id,
      name: 'Storefront smoke',
      description: 'The five cases an evaluator sees on the suite page.',
      type: 'smoke',
    },
  });
  await prisma.testSuiteItem.createMany({
    data: testCases.map((testCase, index) => ({
      testSuiteId: suite.id,
      testCaseId: testCase.id,
      order: index,
    })),
  });

  let testResults = 0;
  for (const plan of RUN_PLAN) {
    const startedAt = daysAgo(plan.daysAgo, 10);
    const outcomes = [
      ...Array.from({ length: plan.passed }, () => 'PASSED' as const),
      ...Array.from({ length: plan.failed }, () => 'FAILED' as const),
    ];
    const duration = 4200 + plan.daysAgo * 137;

    const run = await prisma.testRun.create({
      data: {
        projectId: project.id,
        createdById: userId,
        status: plan.failed > 0 ? 'FAILED' : 'PASSED',
        totalTests: outcomes.length,
        passedTests: plan.passed,
        failedTests: plan.failed,
        skippedTests: 0,
        duration,
        executionStartedAt: startedAt,
        executionCompletedAt: new Date(startedAt.getTime() + duration),
        createdAt: startedAt,
        testSuiteId: suite.id,
      },
    });

    await prisma.testResult.createMany({
      data: outcomes.map((status, index) => ({
        testRunId: run.id,
        testCaseId: testCases[index]?.id as string,
        status,
        duration: 600 + index * 121,
        errorMessage:
          status === 'FAILED'
            ? `expect(Text): expected "${DEMO_CASES[index]?.title}" to match, but the assertion failed on step ${index + 1}`
            : null,
        consoleLog: [],
        browserLogs: [],
        createdAt: startedAt,
      })),
    });
    testResults += outcomes.length;
  }

  for (const bug of DEMO_BUGS) {
    const createdAt = daysAgo(bug.createdDaysAgo, 14);
    await prisma.bug.create({
      data: {
        projectId: project.id,
        organizationId,
        testCaseId: testCases[bug.createdDaysAgo % testCases.length]?.id,
        title: bug.title,
        description: bug.description,
        severity: bug.severity,
        priority: bug.priority,
        status: bug.status,
        createdById: userId,
        createdAt,
        closedAt: ['FIXED', 'VERIFIED', 'CLOSED'].includes(bug.status)
          ? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000)
          : null,
      },
    });
  }

  // Billing/usage charts read the last few months of aggregates; without rows
  // the plan page renders zeros even though the run history above is full.
  for (let offset = 0; offset < 3; offset += 1) {
    const month = monthStart(offset);
    await prisma.usage.upsert({
      where: { organizationId_month: { organizationId, month } },
      create: {
        organizationId,
        month,
        testsRun: 40 - offset * 9,
        browserMinutes: 18 - offset * 3,
        screenshotsGenerated: 12,
        apiRequests: 240 - offset * 40,
        estimatedCostUsd: 3.4 - offset * 0.7,
      },
      update: {},
    });
  }

  logger.info(
    { organizationId, projectId: project.id, testCases: testCases.length, runs: RUN_PLAN.length },
    'demo data seeded'
  );

  return {
    organizationId,
    userId,
    projectId: project.id,
    testCases: testCases.length,
    testRuns: RUN_PLAN.length,
    testResults,
    bugs: DEMO_BUGS.length,
    alreadySeeded: false,
  };
};

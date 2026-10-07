import type { TestCase, TestRun, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { testRunRepository } from '../../repositories/testRun.repository';
import { testResultRepository } from '../../repositories/testResult.repository';
import { browserService } from '../browser/browserService';
import { pageService } from '../browser/pageService';
import { usageService } from '../billing/usageService';
import { logger } from '../../config/logger';
import { aiQueue } from '../../queues/aiQueue';
import { reportQueue } from '../../queues/reportQueue';
import { webhookService } from '../webhook/webhookService';
import { notificationService } from '../notification/notificationService';
import type { TestStep } from '../../types/domain.types';

export interface ExecutionContext {
  testRunId: string;
  projectId: string;
  organizationId: string;
}

/**
 * How long a RUNNING claim is honoured before another worker may take the run
 * over. Covers a worker that died mid-run (OOM, deploy); without it a crashed
 * run would sit in RUNNING forever because the retry is refused by the claim.
 */
const STALE_CLAIM_MS = 10 * 60 * 1000;

export const testExecutionService = {
  async executeRun(context: ExecutionContext): Promise<void> {
    const testRun = await testRunRepository.findWithResults(context.testRunId);
    if (!testRun) {
      logger.error({ testRunId: context.testRunId }, 'test run not found for execution');
      return;
    }

    // Claim the run before doing any work. BullMQ redelivers jobs (retries
    // after a transient error, a duplicate enqueue, two workers draining the
    // queue), and without this compare-and-set both would execute the same run
    // and bill usage twice. updateMany with a status predicate is atomic, so
    // exactly one worker wins.
    const claimed = await prisma.testRun.updateMany({
      where: {
        id: context.testRunId,
        OR: [
          { status: 'PENDING' },
          { status: 'RUNNING', executionStartedAt: { lt: new Date(Date.now() - STALE_CLAIM_MS) } },
        ],
      },
      data: { status: 'RUNNING', executionStartedAt: new Date() },
    });
    if (claimed.count === 0) {
      logger.info(
        { testRunId: context.testRunId, status: testRun.status },
        'test run already claimed or finished; skipping duplicate execution'
      );
      return;
    }

    const startedAt = Date.now();
    const failedResults: Array<{ testResultId: string; testCaseId: string; testCaseTitle: string }> = [];
    let cancelled = false;

    for (const testResult of testRun.testResults) {
      // Cancellation flips this row while the loop is awaiting a browser. Check
      // before every case so a cancelled run stops spending browser time and
      // never gets its CANCELLED verdict overwritten by PASSED/FAILED.
      const current = await prisma.testRun.findUnique({
        where: { id: context.testRunId },
        select: { status: true },
      });
      if (current?.status !== 'RUNNING') {
        cancelled = true;
        logger.info(
          { testRunId: context.testRunId, status: current?.status },
          'test run stopped; halting execution'
        );
        break;
      }

      try {
        const outcome = await testExecutionService.executeTestCase(testResult.testCase, testRun, context);
        await testResultRepository.upsert(context.testRunId, testResult.testCaseId, {
          status: outcome.status,
          duration: outcome.duration,
          errorMessage: outcome.errorMessage,
          screenshotUrl: outcome.screenshotUrl,
          consoleLog: outcome.consoleLog,
          domSnapshot: outcome.domSnapshot,
          failureAnalysis: outcome.failureAnalysis,
        });
        if (outcome.status === 'FAILED') {
          failedResults.push({
            testResultId: testResult.id,
            testCaseId: testResult.testCaseId,
            testCaseTitle: testResult.testCase.title,
          });
        }
      } catch (error) {
        await testResultRepository.upsert(context.testRunId, testResult.testCaseId, {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Execution crashed',
          consoleLog: [],
        });
        failedResults.push({
          testResultId: testResult.id,
          testCaseId: testResult.testCaseId,
          testCaseTitle: testResult.testCase.title,
        });
      }
    }

    if (cancelled) {
      // Results written up to the cancellation are kept (they are real
      // observations), but the verdict, usage billing, webhooks and
      // notifications belong to the cancel path only.
      return;
    }

    const results = await testResultRepository.listByRun(context.testRunId);
    const passedTests = results.filter((r) => r.status === 'PASSED').length;
    const failedCount = results.filter((r) => r.status === 'FAILED').length;
    const skippedTests = results.filter((r) => r.status === 'SKIPPED').length;
    const finalStatus: 'PASSED' | 'FAILED' = failedCount > 0 ? 'FAILED' : 'PASSED';

    const finalized = await prisma.testRun.updateMany({
      where: { id: context.testRunId, status: 'RUNNING' },
      data: {
        status: finalStatus,
        passedTests,
        failedTests: failedCount,
        skippedTests,
        duration: Date.now() - startedAt,
        executionCompletedAt: new Date(),
      },
    });
    if (finalized.count === 0) {
      // Cancelled between the last check and now: leave CANCELLED in place and
      // do not bill usage or announce a verdict for a run the user stopped.
      logger.info({ testRunId: context.testRunId }, 'test run cancelled during execution');
      return;
    }

    await usageService.increment(context.organizationId, {
      testsRun: results.length,
      apiRequests: 1,
    });

    if (failedResults.length > 0) {
      await aiQueue.add('analyze-failure', {
        testRunId: context.testRunId,
        testResultId: failedResults[0].testResultId,
        organizationId: context.organizationId,
        projectId: context.projectId,
        ...(failedResults.length > 1 ? { failingResults: failedResults } : {}),
      });
    }

    // Flakiness is recomputed here, on the run's own completion, instead of
    // inside GET /analytics/flaky-tests. Detection loads 100 results per test
    // case and upserts a row per flaky case, so doing it on a read meant a
    // page view performed unbounded writes and got slower with every project
    // the caller belonged to.
    await reportQueue
      .add(
        'detect-flaky-tests',
        {
          organizationId: context.organizationId,
          projectId: context.projectId,
          periodStart: new Date().toISOString(),
          periodEnd: new Date().toISOString(),
        },
        { jobId: `flaky-${context.projectId}-${context.testRunId}` }
      )
      .catch((err: unknown) => {
        logger.warn({ err, projectId: context.projectId }, 'failed to enqueue flaky detection');
      });

    await webhookService.dispatch(
      context.organizationId,
      finalStatus === 'PASSED' ? 'TEST_COMPLETED' : 'TEST_FAILED',
      {
        testRunId: context.testRunId,
        projectId: context.projectId,
        status: finalStatus,
        passedTests,
        failedTests: failedCount,
        skippedTests,
        duration: Date.now() - startedAt,
      }
    );

    const totalTests = results.length;
    await notificationService.notifyTestRunCompleted({
      id: context.testRunId,
      projectId: context.projectId,
      status: finalStatus,
      totalTests,
      passedTests,
      failedTests: failedCount,
      duration: Date.now() - startedAt,
    });

    logger.info({ testRunId: context.testRunId, passedTests, failedTests: failedCount }, 'test run finished');
  },

  async executeTestCase(testCase: TestCase, testRun: TestRun, context: ExecutionContext) {
    const steps = (testCase.steps as unknown as TestStep[]) ?? [];
    const baseUrl = testRun.environmentId
      ? await getEnvironmentUrl(testRun.environmentId)
      : testCase.applicationId
        ? await getApplicationUrl(testCase.applicationId)
        : undefined;

    const browserContext = await browserService.newContext();
    const page = await browserContext.newPage();
    const consoleLog: string[] = [];

    try {
      page.on('console', (message) => {
        if (message.type() === 'error') {
          consoleLog.push(message.text().slice(0, 2000));
        }
      });
      page.on('pageerror', (error) => {
        consoleLog.push(`pageerror: ${error.message.slice(0, 2000)}`);
      });

      const effectiveSteps: TestStep[] =
        steps.length === 0
          ? [{ action: 'goto', value: baseUrl ?? '' }]
          : steps.some((step) => step.action === 'goto')
            ? steps
            : [{ action: 'goto', value: baseUrl ?? '' }, ...steps];

      const startedAt = Date.now();
      const results = await pageService.runSteps(page, effectiveSteps, baseUrl);
      const failedStep = results.find((r) => !r.success);

      const screenshotPath = failedStep ? `/tmp/jestbest-${context.testRunId}-${testCase.id}.png` : null;
      const screenshotUrl =
        failedStep && screenshotPath ? await pageService.captureScreenshot(page, screenshotPath) : null;

      const domSnapshot = await page
        .evaluate(() => {
          const title = document.title;
          const locationUrl = window.location.href;
          try {
            return { title, locationUrl, text: document.body?.innerText?.slice(0, 50000) ?? '' };
          } catch {
            return null;
          }
        })
        .catch(() => null);

      const bodyText = domSnapshot ? String((domSnapshot as { text: string }).text ?? '') : '';

      return {
        status: failedStep ? ('FAILED' as const) : ('PASSED' as const),
        duration: Date.now() - startedAt,
        errorMessage: failedStep?.error,
        screenshotUrl,
        consoleLog,
        domSnapshot: domSnapshot as Prisma.InputJsonValue | undefined,
        failureAnalysis: undefined,
        bodyText,
      };
    } finally {
      await page.close();
      await browserContext.close();
    }
  },
};

const getEnvironmentUrl = async (environmentId: string): Promise<string | undefined> => {
  const environment = await prisma.environment.findUnique({ where: { id: environmentId } });
  return environment?.url;
};

const getApplicationUrl = async (applicationId: string): Promise<string | undefined> => {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  return application?.baseUrl || undefined;
};

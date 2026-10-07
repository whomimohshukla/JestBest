import type { TestRun, Prisma } from '@prisma/client';
import { testRunRepository } from '../../repositories/testRun.repository';
import { testCaseRepository } from '../../repositories/testCase.repository';
import { NotFoundError, BadRequestError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { pagination } from '../../utils/formatters';
import { enqueueTestExecution, testQueue } from '../../queues/testQueue';
import type { TestJobData } from '../../queues/testQueue';
import { webhookService } from '../webhook/webhookService';
import type { ListResponse } from '../../types/api.types';

export interface StartRunParams {
  projectId: string;
  createdById: string;
  organizationId: string;
  testSuiteId?: string;
  testCaseIds?: string[];
  environmentId?: string;
  testUserId?: string;
  metadata?: Record<string, unknown>;
}

export const testRunService = {
  async startRun(params: StartRunParams): Promise<TestRun> {
    let testCaseIds = params.testCaseIds ?? [];

    if (params.testSuiteId) {
      const suite = await testCaseRepository.findSuite(params.testSuiteId);
      if (!suite) {
        throw new NotFoundError('Test suite not found.');
      }
      testCaseIds = suite.testSuiteItems.map((item) => item.testCaseId);
    }

    if (testCaseIds.length === 0) {
      throw new BadRequestError('No test cases selected for the run.');
    }

    const tests = await testCaseRepository.listByIds(testCaseIds);
    if (tests.length !== testCaseIds.length) {
      throw new BadRequestError('One or more test cases do not exist.');
    }

    const testRun = await testRunRepository.create({
      projectId: params.projectId,
      testSuiteId: params.testSuiteId,
      environmentId: params.environmentId,
      testUserId: params.testUserId,
      createdById: params.createdById,
      status: 'PENDING',
      totalTests: tests.length,
      metadata: { testCaseIds, ...(params.metadata ?? {}) },
    });

    await testRunRepository.createResults(testRun.id, testCaseIds);

    await enqueueTestExecution({
      testRunId: testRun.id,
      testCaseIds,
      organizationId: params.organizationId,
      projectId: params.projectId,
    });

    await webhookService.dispatch(params.organizationId, 'TEST_STARTED', {
      testRunId: testRun.id,
      projectId: params.projectId,
      status: testRun.status,
      totalTests: tests.length,
    });

    return testRun;
  },

  async get(testRunId: string) {
    const testRun = await testRunRepository.findWithResults(testRunId);
    if (!testRun) {
      throw new NotFoundError(Messages.TEST.RUN_NOT_FOUND);
    }
    return testRun;
  },

  async getResults(testRunId: string) {
    const testRun = await testRunRepository.findWithResults(testRunId);
    if (!testRun) {
      throw new NotFoundError(Messages.TEST.RUN_NOT_FOUND);
    }
    return testRun.testResults;
  },

  async cancel(testRunId: string): Promise<TestRun> {
    const existing = await testRunRepository.findById(testRunId);
    if (!existing) {
      throw new NotFoundError(Messages.TEST.RUN_NOT_FOUND);
    }
    if (existing.status === 'RUNNING' || existing.status === 'PENDING') {
      await testRunRepository.update(testRunId, {
        status: 'CANCELLED',
        executionCompletedAt: new Date(),
      });
    }
    return testRunRepository.findById(testRunId) as Promise<TestRun>;
  },

  async schedule(params: StartRunParams & { cron: string }): Promise<{ scheduled: boolean }> {
    await testQueue.upsertJobScheduler(
      `scheduled-run-${params.projectId}`,
      { pattern: params.cron },
      {
        name: 'execute-scheduled-run',
        data: {
          projectId: params.projectId,
          organizationId: params.organizationId,
          createdById: params.createdById,
          testSuiteId: params.testSuiteId,
          testCaseIds: params.testCaseIds ?? [],
          environmentId: params.environmentId,
          testUserId: params.testUserId,
        } satisfies TestJobData,
        opts: {
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: true,
        },
      }
    );
    return { scheduled: true };
  },

  async list(where: Prisma.TestRunWhereInput, page = 1, pageSize = 20): Promise<ListResponse<TestRun>> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      testRunRepository.list(where, skip, pageSize),
      testRunRepository.count(where),
    ]);
    return pagination(items, total, { page, pageSize });
  },
};

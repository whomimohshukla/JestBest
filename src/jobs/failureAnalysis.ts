import { Job } from 'bullmq';
import type { AiJobData } from '../queues/aiQueue';
import { failureAnalyzerAgent } from '../services/ai/failureAnalyzerAgent';
import { bugDetectionService } from '../services/bug/bugDetectionService';
import { testResultRepository } from '../repositories/testResult.repository';
import { logger } from '../config/logger';
import type { Prisma } from '@prisma/client';

export const processFailureAnalysisJob = async (job: Job<AiJobData>): Promise<void> => {
  if (job.name !== 'analyze-failure') {
    return;
  }

  const data = job.data as {
    testResultId: string;
    organizationId: string;
    testRunId: string;
    projectId?: string;
    failingResults?: Array<{ testResultId: string; testCaseId: string; testCaseTitle: string }>;
  };

  // A run can fail more than one case. `testExecutionService` forwards the full
  // list, so analyze every failing result instead of only the first one.
  const failingResults =
    data.failingResults && data.failingResults.length > 0
      ? data.failingResults
      : [{ testResultId: data.testResultId, testCaseId: '', testCaseTitle: '' }];

  for (const failing of failingResults) {
    const result = await testResultRepository.findById(failing.testResultId);
    if (!result) {
      logger.warn({ testResultId: failing.testResultId }, 'no test result found for failure analysis');
      continue;
    }

    const response = await failureAnalyzerAgent.execute(
      {
        organizationId: data.organizationId,
        testRunId: data.testRunId,
        testResultId: failing.testResultId,
      },
      {
        errorMessage: result.errorMessage ?? undefined,
        consoleLog: result.consoleLog ?? undefined,
        domSnapshot: result.domSnapshot,
        testTitle: failing.testCaseTitle || result.testCase?.title,
      }
    );

    await testResultRepository.update(failing.testResultId, {
      failureAnalysis: response.output.analysis as unknown as Prisma.InputJsonValue,
    });

    logger.info({ testResultId: failing.testResultId }, 'failure analysis stored');
  }

  if (data.projectId) {
    await bugDetectionService.detect({
      projectId: data.projectId,
      testRunId: data.testRunId,
      testResultId: data.testResultId,
      organizationId: data.organizationId,
      failingResults,
    });
  }
};

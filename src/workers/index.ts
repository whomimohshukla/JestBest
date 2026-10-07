import { Worker } from 'bullmq';
import { queueConfig } from '../config/queue';
import { logger } from '../config/logger';
import { setupTestQueueWorker } from './setupWorkers';

const setupAiQueueWorker = (): Worker => {
  const worker = new Worker(
    'ai',
    async (job) => {
      switch (job.name) {
        case 'explore-application':
          return runExplorationJob(job as never);
        case 'analyze-failure':
          return runFailureAnalysisJob(job as never);
        case 'generate-tests':
          return runTestGenerationJob(job as never);
        case 'run-agent':
          return runAgentJob(job as never);
        case 'track-ai-cost':
          return runCostTrackingJob(job as never);
        default:
          logger.warn({ jobName: job.name }, 'unhandled ai queue job name');
      }
    },
    { connection: queueConfig.connection, prefix: queueConfig.prefix, concurrency: 2 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: 'ai', err }, 'ai queue job failed');
  });
  return worker;
};

const setupReportQueueWorker = (): Worker => {
  const worker = new Worker(
    'report',
    async (job) => {
      if (job.name === 'detect-flaky-tests') {
        const { flakyTestService } = await import('../services/analytics/flakyTestService');
        const { projectId } = job.data as { projectId: string };
        await flakyTestService.detectFlakyTests(projectId);
        return;
      }
      const { processReportGenerationJob } = await import('../jobs/reportGeneration');
      await processReportGenerationJob(job as never);
    },
    { connection: queueConfig.connection, prefix: queueConfig.prefix, concurrency: 1 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: 'report', err }, 'report queue job failed');
  });
  return worker;
};

const setupWebhookQueueWorker = (): Worker => {
  const worker = new Worker(
    'webhook',
    async (job) => {
      const { processWebhookDeliveryJob } = await import('../jobs/webhookDelivery');
      await processWebhookDeliveryJob(job as never);
    },
    { connection: queueConfig.connection, prefix: queueConfig.prefix, concurrency: 10 }
  );
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, queue: 'webhook', err }, 'webhook queue job failed');
  });
  return worker;
};

const runExplorationJob = async (job: import('bullmq').Job): Promise<void> => {
  const { processAiExplorationJob } = await import('../jobs/aiExploration');
  await processAiExplorationJob(job as never);
};

const runFailureAnalysisJob = async (job: import('bullmq').Job): Promise<void> => {
  const { processFailureAnalysisJob } = await import('../jobs/failureAnalysis');
  await processFailureAnalysisJob(job as never);
};

const runCostTrackingJob = async (job: import('bullmq').Job): Promise<void> => {
  const { processAiCostTrackingJob } = await import('../jobs/aiCostTracking');
  await processAiCostTrackingJob(job as never);
};

const runAgentJob = async (job: import('bullmq').Job): Promise<void> => {
  const { agentOrchestrator } = await import('../services/ai/agentOrchestrator');
  const data = job.data as { agentRunId: string; organizationId: string };
  await agentOrchestrator.run(data.agentRunId, data.organizationId);
};

const runTestGenerationJob = async (job: import('bullmq').Job): Promise<void> => {
  const { testGeneratorAgent } = await import('../services/ai/testGeneratorAgent');
  const { testCaseRepository } = await import('../repositories/testCase.repository');
  const data = job.data as {
    applicationId: string;
    projectId: string;
    organizationId: string;
    requirements?: string;
    types?: string[];
    count?: number;
  };
  const response = await testGeneratorAgent.execute(
    {
      organizationId: data.organizationId,
      applicationId: data.applicationId,
      projectId: data.projectId,
    },
    {
      applicationId: data.applicationId,
      requirements: data.requirements,
      types: data.types,
      count: data.count,
    }
  );

  for (const generated of response.output.testCases) {
    await testCaseRepository.create({
      projectId: data.projectId,
      applicationId: data.applicationId,
      title: generated.title.slice(0, 200),
      description: generated.description,
      type: generated.type,
      priority: generated.priority,
      status: 'draft',
      steps: generated.steps as unknown as import('@prisma/client').Prisma.InputJsonValue,
      expectedResult: generated.expectedResult,
      tags: generated.tags,
    });
  }
};

export const setupWorkers = (): Worker[] => {
  const workers = [
    setupTestQueueWorker(),
    setupAiQueueWorker(),
    setupReportQueueWorker(),
    setupWebhookQueueWorker(),
  ];
  logger.info({ count: workers.length }, 'queue workers started');
  return workers;
};

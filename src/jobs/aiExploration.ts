import { Job } from 'bullmq';
import type { AiJobData } from '../queues/aiQueue';
import { scannerService } from '../services/application/scannerService';
import { applicationRepository } from '../repositories/application.repository';
import { aiQueue } from '../queues/aiQueue';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { NotFoundError } from '../utils/errors';
import { Messages } from '../constants/messages';

export const processAiExplorationJob = async (job: Job<AiJobData>): Promise<void> => {
  if (job.name !== 'explore-application') {
    return;
  }

  const data = job.data as {
    applicationId: string;
    organizationId?: string;
    environmentId?: string;
    testUserId?: string;
    maxPages?: number;
    scanId?: string;
  };
  const application = await applicationRepository.findById(data.applicationId);
  if (!application) {
    throw new NotFoundError(Messages.APPLICATION.NOT_FOUND);
  }

  const baseUrl = application.baseUrl ?? '/';
  const environmentUrl = data.environmentId
    ? (await prisma.environment.findUnique({ where: { id: data.environmentId } }))?.url
    : undefined;

  // Record the outcome on the scan row so the status endpoint the UI polls stops
  // reporting 0/null forever. A failure here must still mark the scan as failed,
  // otherwise it stays "in progress" indefinitely.
  try {
    const result = await scannerService.exploreApplication({
      applicationId: data.applicationId,
      baseUrl: environmentUrl ?? baseUrl,
      environmentId: data.environmentId,
      testUserId: data.testUserId,
      maxPages: data.maxPages,
    });

    if (data.scanId) {
      await applicationRepository.updateScan(data.scanId, {
        completedAt: new Date(),
        pagesDiscovered: result.pagesDiscovered,
        componentsDiscovered: result.componentsDiscovered,
        workflowsDiscovered: result.workflowsDiscovered,
        // Flag that generation was queued so the status endpoint can report it.
        metadata: { testGenerationQueued: true },
      });
    }

    logger.info({ applicationId: data.applicationId, ...result }, 'application exploration complete');

    // Discovery alone leaves the user with pages/components and no tests, which
    // reads as "the scan did nothing". Chain straight into test generation using
    // what was just discovered.
    if (result.pagesDiscovered > 0 && data.organizationId) {
      await aiQueue.add('generate-tests', {
        applicationId: data.applicationId,
        projectId: application.projectId,
        organizationId: data.organizationId,
        count: 5,
      });
      logger.info({ applicationId: data.applicationId }, 'queued test generation after exploration');
    }
  } catch (error) {
    if (data.scanId) {
      await applicationRepository
        .updateScan(data.scanId, {
          completedAt: new Date(),
          metadata: { error: error instanceof Error ? error.message : String(error) },
        })
        .catch((updateError) =>
          logger.error({ err: updateError, scanId: data.scanId }, 'failed to mark scan as failed')
        );
    }
    throw error;
  }
};

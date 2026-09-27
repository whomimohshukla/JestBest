import { Request, Response } from 'express';
import { testRunService } from '../../services/test/testRunService';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { created } from '../../utils/formatters';
import { prisma } from '../../config/database';

export const runTests = async (req: Request, res: Response): Promise<void> => {
  if (!req.user || !req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { projectId, testSuiteId, testCaseIds, environmentId, testUserId, triggerType } = req.body as {
    projectId: string;
    testSuiteId?: string;
    testCaseIds?: string[];
    environmentId?: string;
    testUserId?: string;
    triggerType?: 'MANUAL' | 'SCHEDULED' | 'API' | 'CI';
  };
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project || project.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.PROJECT.NOT_FOUND);
  }
  const testRun = await testRunService.startRun({
    projectId,
    organizationId: req.orgId,
    createdById: req.user.id,
    testSuiteId,
    testCaseIds,
    environmentId,
    testUserId,
    metadata: triggerType ? { triggerType } : undefined,
  });
  res.status(201).json(created(testRun, { message: Messages.TEST.RUN_STARTED }));
};

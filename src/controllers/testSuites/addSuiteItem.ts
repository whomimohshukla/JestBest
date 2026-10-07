import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { testCaseService } from '../../services/test/testCaseService';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const addSuiteItem = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { testSuiteId } = req.params as { testSuiteId: string };
  const { testCaseId, order } = req.body as { testCaseId: string; order?: number };
  const suite = await testCaseService.getSuite(testSuiteId);
  const project = await prisma.project.findUnique({ where: { id: suite.projectId } });
  if (req.orgId && project?.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }
  await testCaseService.addSuiteItem(testSuiteId, testCaseId, order);
  res
    .status(200)
    .json(ok(await testCaseService.getApiSuite(testSuiteId), { message: Messages.TEST.UPDATED }));
};

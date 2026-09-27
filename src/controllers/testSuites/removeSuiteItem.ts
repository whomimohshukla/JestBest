import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { testCaseService } from '../../services/test/testCaseService';
import { ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const removeSuiteItem = async (req: Request, res: Response): Promise<void> => {
  const { testSuiteId, suiteItemId } = req.params as {
    testSuiteId: string;
    suiteItemId: string;
  };
  const suite = await testCaseService.getSuite(testSuiteId);
  const project = await prisma.project.findUnique({ where: { id: suite.projectId } });
  if (req.orgId && project?.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }
  await testCaseService.removeSuiteItem(testSuiteId, suiteItemId);
  res.status(200).json(ok(await testCaseService.getApiSuite(testSuiteId), { message: Messages.TEST.UPDATED }));
};

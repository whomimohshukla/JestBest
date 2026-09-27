import { Request, Response } from 'express';
import { testCaseService } from '../../services/test/testCaseService';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { created } from '../../utils/formatters';
import { prisma } from '../../config/database';

export const createTestCase = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const body = req.body as {
    projectId: string;
    title: string;
    description?: string;
    type:
      | 'FUNCTIONAL'
      | 'HAPPY_PATH'
      | 'NEGATIVE'
      | 'EDGE_CASE'
      | 'BOUNDARY'
      | 'REGRESSION'
      | 'SMOKE'
      | 'SECURITY'
      | 'ACCESSIBILITY'
      | 'API';
    priority: 'high' | 'medium' | 'low';
    steps: unknown[];
    expectedResult?: string;
    tags?: string[];
    applicationId?: string;
    workflowId?: string;
  };
  const project = await prisma.project.findUnique({ where: { id: body.projectId } });
  if (!project || project.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.PROJECT.NOT_FOUND);
  }
  const applicationId = body.applicationId || undefined;
  if (applicationId) {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application || application.projectId !== body.projectId) {
      throw new ForbiddenError(Messages.APPLICATION.NOT_FOUND);
    }
  }
  const testCase = await testCaseService.create({
    ...body,
    projectId: body.projectId,
    applicationId,
    workflowId: body.workflowId || undefined,
    steps: body.steps as never,
    tags: body.tags ?? [],
  });
  res.status(201).json(created(testCase, { message: Messages.TEST.CREATED }));
};

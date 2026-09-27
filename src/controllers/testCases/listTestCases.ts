import { Request, Response } from 'express';
import { testCaseService } from '../../services/test/testCaseService';
import { ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { prisma } from '../../config/database';

export const listTestCases = async (req: Request, res: Response): Promise<void> => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const projectId = req.query.projectId as string | undefined;
  const type = req.query.type as string | undefined;
  const applicationId = req.query.applicationId as string | undefined;

  if (projectId && req.orgId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.organizationId !== req.orgId) {
      throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
    }
  }

  const result = await testCaseService.list(
    {
      ...(projectId
        ? { projectId }
        : { project: { organizationId: req.orgId } }),
      ...(type ? { type: type as never } : {}),
      ...(applicationId ? { applicationId } : {}),
    },
    page,
    pageSize
  );
  res.status(200).json(ok(result));
};

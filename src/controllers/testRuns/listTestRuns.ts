import { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { testRunService } from '../../services/test/testRunService';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const listTestRuns = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { page = 1, pageSize = 20, projectId, status } = req.query;
  if (projectId) {
    const project = await prisma.project.findUnique({ where: { id: projectId as string } });
    if (!project || project.organizationId !== req.orgId) {
      throw new ForbiddenError(Messages.PROJECT.NOT_FOUND);
    }
  }
  const where: Prisma.TestRunWhereInput = {
    ...(projectId
      ? { projectId: projectId as string }
      : { project: { organizationId: req.orgId } }),
    ...(status ? { status: status as Prisma.TestRunWhereInput['status'] } : {}),
  };
  const runs = await testRunService.list(where, Number(page), Number(pageSize));
  res.status(200).json(ok(runs));
};

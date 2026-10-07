import { Request, Response } from 'express';
import { bugService } from '../../services/bug/bugService';
import { ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { prisma } from '../../config/database';
import type { Prisma } from '@prisma/client';

export const listBugs = async (req: Request, res: Response): Promise<void> => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const projectId = req.query.projectId as string | undefined;
  const status = req.query.status as string | undefined;
  const severity = req.query.severity as string | undefined;

  if (projectId && req.orgId) {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (project?.organizationId !== req.orgId) {
      throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
    }
  }

  const where: Prisma.BugWhereInput = projectId && req.orgId ? { projectId } : { organizationId: req.orgId };
  const result = await bugService.list(where, page, pageSize, { status, severity });
  res.status(200).json(ok(result));
};

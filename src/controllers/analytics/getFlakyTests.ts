import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { flakyTestService } from '../../services/analytics/flakyTestService';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { z } from 'zod';

const querySchema = z.object({
  projectId: z.string().min(1).optional(),
});

export const getFlakyTests = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { projectId } = querySchema.parse(req.query ?? {});
  let flaky;
  if (projectId) {
    await flakyTestService.detectFlakyTests(projectId);
    flaky = await flakyTestService.getFlakyTests(projectId);
  } else {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id, deletedAt: null },
      select: { organization: { select: { projects: { select: { id: true } } } } },
    });
    const projectIds = Array.from(new Set(memberships.flatMap((m) => m.organization.projects.map((p) => p.id))));
    const perProject = await Promise.all(
      projectIds.map(async (id) => {
        await flakyTestService.detectFlakyTests(id);
        return flakyTestService.getFlakyTests(id);
      })
    );
    flaky = perProject.flat().sort((a, b) => b.flakyScore - a.flakyScore);
  }
  res.status(200).json(ok(flaky));
};
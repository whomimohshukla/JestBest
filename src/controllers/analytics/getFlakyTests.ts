import { Request, Response } from 'express';
import { prisma } from '../../config/database';
import { flakyTestService } from '../../services/analytics/flakyTestService';
import { UnauthorizedError, NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { z } from 'zod';

const querySchema = z.object({
  projectId: z.string().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const getFlakyTests = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { projectId, pageSize } = querySchema.parse(req.query ?? {});

  let projectIds: string[];
  if (projectId) {
    // Ownership is verified before the id is used. This endpoint previously
    // passed `projectId` straight through, so any caller could read the flaky
    // analysis of a project belonging to another organization.
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: req.orgId ?? req.user.orgId, archivedAt: null },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
    }
    projectIds = [project.id];
  } else {
    const memberships = await prisma.membership.findMany({
      where: { userId: req.user.id, deletedAt: null },
      select: {
        organization: { select: { projects: { where: { archivedAt: null }, select: { id: true } } } },
      },
    });
    projectIds = Array.from(new Set(memberships.flatMap((m) => m.organization.projects.map((p) => p.id))));
  }

  // Read-only: flakiness is recomputed by the `detect-flaky-tests` queue job
  // when a test run finishes, so a page view no longer triggers a full
  // detection pass (100 results per test case, one upsert per flaky case).
  const perProject = await Promise.all(projectIds.map((id) => flakyTestService.getFlakyTests(id, pageSize)));

  const flaky = perProject
    .flat()
    .sort((a, b) => b.flakyScore - a.flakyScore)
    .slice(0, pageSize);

  res.status(200).json(ok(flaky));
};

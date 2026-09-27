import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const integrationRepository = {
  findById: (id: string) => prisma.integration.findUnique({ where: { id } }),

  findByType: (organizationId: string, type: string, projectId?: string | null) =>
    prisma.integration.findFirst({
      where: {
        organizationId,
        type: type as Prisma.IntegrationWhereInput['type'],
        projectId: projectId ?? null,
      },
    }),

  /**
   * Resolve the integration to use for a project.
   *
   * Prefers one explicitly attached to the project and only then falls back to
   * an org-wide integration. Selecting the first org-wide GITHUB integration
   * instead would file project A's bugs into project B's repository.
   */
  findForProject: (organizationId: string, type: string, projectId?: string | null) =>
    prisma.integration.findFirst({
      where: {
        organizationId,
        type: type as Prisma.IntegrationWhereInput['type'],
        isActive: true,
        ...(projectId ? { OR: [{ projectId }, { projectId: null }] } : {}),
      },
      orderBy: { projectId: { sort: 'desc', nulls: 'last' } },
    }),

  create: (data: Prisma.IntegrationUncheckedCreateInput) => prisma.integration.create({ data }),

  update: (id: string, data: Prisma.IntegrationUpdateInput) =>
    prisma.integration.update({ where: { id }, data }),

  hardDelete: (id: string) => prisma.integration.delete({ where: { id } }),

  list: (organizationId: string, projectId?: string | null) =>
    prisma.integration.findMany({
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),
};

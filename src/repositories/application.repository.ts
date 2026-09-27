import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const applicationRepository = {
  findById: (id: string) => prisma.application.findUnique({ where: { id } }),

  create: (data: Prisma.ApplicationUncheckedCreateInput) => prisma.application.create({ data }),

  update: (id: string, data: Prisma.ApplicationUncheckedUpdateInput) =>
    prisma.application.update({ where: { id }, data }),

  hardDelete: (id: string) => prisma.application.delete({ where: { id } }),

  listByProject: (projectId: string) =>
    prisma.application.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    }),

  listByOrganization: (organizationId: string) =>
    prisma.application.findMany({
      where: { project: { organizationId } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    }),

  getMap: (id?: string | null) =>
    id ? prisma.application.findUnique({ where: { id }, include: { pages: { include: { components: true }, orderBy: { order: 'asc' } }, workflows: true, components: true } }) : null,

  addEnvironment: (data: Prisma.EnvironmentUncheckedCreateInput) => prisma.environment.create({ data }),

  addTestUser: (data: Prisma.TestUserUncheckedCreateInput) => prisma.testUser.create({ data }),

  addPage: (data: Prisma.PageUncheckedCreateInput) => prisma.page.create({ data }),

  addComponent: (data: Prisma.ComponentUncheckedCreateInput) => prisma.component.create({ data }),

  addWorkflow: (data: Prisma.WorkflowUncheckedCreateInput) => prisma.workflow.create({ data }),

  createScan: (data: Prisma.ApplicationScanUncheckedCreateInput) => prisma.applicationScan.create({ data }),

  getScan: (id: string) => prisma.applicationScan.findUnique({ where: { id } }),

  updateScan: (id: string, data: Prisma.ApplicationScanUncheckedUpdateInput) =>
    prisma.applicationScan.update({ where: { id }, data }),
};

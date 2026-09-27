import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const testCaseRepository = {
  findById: (id: string) => prisma.testCase.findUnique({ where: { id } }),

  create: (data: Prisma.TestCaseUncheckedCreateInput) => prisma.testCase.create({ data }),

  update: (id: string, data: Prisma.TestCaseUpdateInput) => prisma.testCase.update({ where: { id }, data }),

  hardDelete: (id: string) => prisma.testCase.delete({ where: { id } }),

  archive: (id: string) => prisma.testCase.update({ where: { id }, data: { archivedAt: new Date() } }),

  duplicate: (id: string, data: Prisma.TestCaseUncheckedCreateInput) => prisma.testCase.create({ data }),

  count: (where: Prisma.TestCaseWhereInput = {}) =>
    prisma.testCase.count({ where: { status: { not: 'archived' }, ...where } }),

  list: (where: Prisma.TestCaseWhereInput = {}, skip = 0, take = 20) =>
    prisma.testCase.findMany({
      where: { status: { not: 'archived' }, ...where },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),

  listByIds: (ids: string[]) =>
    prisma.testCase.findMany({ where: { id: { in: ids }, status: { not: 'archived' } } }),

  findSuite: (id: string) =>
    prisma.testSuite.findUnique({
      where: { id },
      include: {
        testSuiteItems: { include: { testCase: true }, orderBy: { order: 'asc' } },
      },
    }),

  createSuite: (data: Prisma.TestSuiteUncheckedCreateInput) => prisma.testSuite.create({ data }),

  updateSuite: (id: string, data: Prisma.TestSuiteUpdateInput) =>
    prisma.testSuite.update({ where: { id }, data }),

  hardDeleteSuite: (id: string) => prisma.testSuite.delete({ where: { id } }),

  listSuites: (projectId: string, skip = 0, take = 20) =>
    prisma.testSuite.findMany({
      where: { projectId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { testSuiteItems: true, testRuns: true } },
        testSuiteItems: { include: { testCase: true }, orderBy: { order: 'asc' } },
      },
    }),

  countSuites: (projectId: string) => prisma.testSuite.count({ where: { projectId } }),

  findSuiteItem: (id: string) => prisma.testSuiteItem.findUnique({ where: { id } }),

  removeSuiteItem: (id: string) => prisma.testSuiteItem.delete({ where: { id } }),

  addSuiteItems: (testSuiteId: string, items: Array<{ testCaseId: string; order: number }>) =>
    prisma.$transaction(
      items.map((item) =>
        prisma.testSuiteItem.create({
          data: { testSuiteId, testCaseId: item.testCaseId, order: item.order },
        })
      )
    ),
};

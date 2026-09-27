import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

export const testRunRepository = {
  findById: (id: string) => prisma.testRun.findUnique({ where: { id } }),

  findWithResults: (id: string) =>
    prisma.testRun.findUnique({
      where: { id },
      include: {
        testResults: { include: { testCase: true } },
        testSuite: true,
        environment: true,
      },
    }),

  create: (data: Prisma.TestRunUncheckedCreateInput) => prisma.testRun.create({ data }),

  update: (id: string, data: Prisma.TestRunUpdateInput) => prisma.testRun.update({ where: { id }, data }),

  list: (where: Prisma.TestRunWhereInput = {}, skip = 0, take = 20) =>
    prisma.testRun.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { testSuite: true, createdBy: { select: { id: true, name: true, email: true } } },
    }),

  count: (where: Prisma.TestRunWhereInput = {}) => prisma.testRun.count({ where }),

  createResults: (testRunId: string, testCaseIds: string[]) =>
    prisma.$transaction(
      testCaseIds.map((testCaseId) =>
        prisma.testResult.create({
          data: { testRunId, testCaseId, status: 'PENDING' },
        })
      )
    ),
};

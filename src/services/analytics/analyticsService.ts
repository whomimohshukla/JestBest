import { prisma } from '../../config/database';
import { cacheService } from '../cache/cacheService';
import { NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';

export interface QualityScoreParams {
  projectId: string;
  /**
   * Required, not optional. These aggregations used to be keyed on `projectId`
   * alone, so any authenticated caller could pass another tenant's project id
   * and read their pass rates, bug counts and release risk. Resolving the
   * project through the caller's organization makes a foreign id simply not
   * exist.
   */
  organizationId: string;
}

export interface QualityScore {
  score: number;
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  components: {
    passRate: number;
    testCoverage: number;
    bugBurden: number;
    flakiness: number;
  };
}

export const analyticsService = {
  async qualityScore(params: QualityScoreParams): Promise<QualityScore> {
    const project = await resolveProject(params);
    return cacheService.remember(
      `analytics:quality:${project.id}`,
      async () => {
        // Two grouped queries replace four separate counts over the same rows.
        const [runStatuses, bugStatuses, runs] = await Promise.all([
          prisma.testRun.groupBy({
            by: ['status'],
            where: { projectId: project.id },
            _count: true,
          }),
          prisma.bug.groupBy({
            by: ['status'],
            where: { projectId: project.id },
            _count: true,
          }),
          prisma.testRun.findMany({
            where: { projectId: project.id },
            orderBy: { createdAt: 'desc' },
            take: 30,
          }),
        ]);

        // Bounded to the same 30-run window as the other inputs. Counting every
        // TestResult row ever written for the project was an unbounded join
        // whose cost grew forever. Depends on `runs`, so it runs second.
        const resultStats = await prisma.testResult.aggregate({
          where: { testRunId: { in: runs.map((r) => r.id) } },
          _count: true,
        });

        const statusCounts = new Map(runStatuses.map((r) => [r.status, r._count]));
        const totalRuns = runStatuses.reduce((sum, r) => sum + r._count, 0);
        const passedRuns = statusCounts.get('PASSED') ?? 0;
        const totalBugs = bugStatuses.reduce((sum, b) => sum + b._count, 0);
        const openBugs = bugStatuses
          .filter((b) => b.status !== 'CLOSED')
          .reduce((sum, b) => sum + b._count, 0);

        const passRate = totalRuns > 0 ? passedRuns / totalRuns : 0;
        const bugBurden = totalBugs > 0 ? Math.min(1, openBugs / totalBugs) : 0;
        const flakiness = runs.length >= 5 ? estimateFlakiness(runs) : 0;

        const testCoverage =
          resultStats._count > 0
            ? Math.min(1, (passedRuns / Math.max(1, totalRuns)) * (runs.length / 30))
            : 0;

        const score = Math.round(
          passRate * 40 + (1 - bugBurden) * 25 + (1 - flakiness) * 20 + testCoverage * 15
        );

        return {
          score,
          level: score >= 80 ? 'LOW' : score >= 65 ? 'MEDIUM' : score >= 45 ? 'HIGH' : 'CRITICAL',
          components: {
            passRate: round(passRate * 100),
            testCoverage: round(testCoverage * 100),
            bugBurden: round(bugBurden * 100),
            flakiness: round(flakiness * 100),
          },
        };
      },
      60
    );
  },

  async releaseRisk(params: QualityScoreParams): Promise<{
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    details: Record<string, number>;
  }> {
    const quality = await analyticsService.qualityScore(params);
    const project = await resolveProject(params);
    const [openCriticalBugs, recentRuns] = await Promise.all([
      prisma.bug.count({
        where: {
          projectId: project.id,
          status: { not: 'CLOSED' },
          severity: { in: ['CRITICAL', 'HIGH'] },
        },
      }),
      prisma.testRun.findMany({
        where: { projectId: project.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const failureRate =
      recentRuns.length > 0
        ? recentRuns.filter((run) => run.status === 'FAILED').length / recentRuns.length
        : 0;
    const riskScore = Math.round(
      (100 - quality.score) * 0.5 +
        (100 - quality.components.passRate) * 0.2 +
        openCriticalBugs * 5 +
        failureRate * 100 * 0.3
    );
    const clamped = Math.min(100, Math.max(0, riskScore));

    return {
      riskScore: clamped,
      riskLevel: clamped >= 75 ? 'CRITICAL' : clamped >= 55 ? 'HIGH' : clamped >= 35 ? 'MEDIUM' : 'LOW',
      details: {
        openCriticalBugs,
        failureRate: round(failureRate * 100),
        qualityScore: quality.score,
      },
    };
  },

  async getDashboardAnalytics(organizationId: string, projectId?: string): Promise<unknown> {
    const [projects, recentRuns, openBugs, totalCases] = await Promise.all([
      prisma.project.findMany({
        where: { organizationId, archivedAt: null, ...(projectId ? { id: projectId } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.testRun.findMany({
        where: { ...(projectId ? { projectId } : { project: { organizationId } }) },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { project: { select: { id: true, name: true } } },
      }),
      prisma.bug.count({
        where: {
          ...(projectId ? { projectId } : { project: { organizationId } }),
          status: { not: 'CLOSED' },
        },
      }),
      prisma.testCase.count({
        where: { ...(projectId ? { projectId } : { project: { organizationId } }), archivedAt: null },
      }),
    ]);

    const quality = projectId ? await analyticsService.qualityScore({ projectId, organizationId }) : null;
    const risk = projectId ? await analyticsService.releaseRisk({ projectId, organizationId }) : null;

    return {
      projects,
      recentRuns,
      openBugs,
      totalCases,
      quality,
      risk,
    };
  },
};

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * Resolve a project within the caller's organization. A project belonging to a
 * different tenant is indistinguishable from one that does not exist, which is
 * what keeps these aggregates from becoming a cross-tenant read.
 */
const resolveProject = async (params: QualityScoreParams) => {
  const project = await prisma.project.findFirst({
    where: {
      id: params.projectId,
      organizationId: params.organizationId,
      archivedAt: null,
    },
    select: { id: true },
  });
  if (!project) {
    throw new NotFoundError(Messages.PROJECT.NOT_FOUND);
  }
  return project;
};

const estimateFlakiness = (
  runs: Array<{ passedTests: number; failedTests: number; totalTests: number }>
): number => {
  const runsWithResults = runs.filter((run) => run.totalTests > 0);
  if (runsWithResults.length === 0) return 0;
  const inconsistent = runsWithResults.filter((run) => run.passedTests > 0 && run.failedTests > 0).length;
  return inconsistent / runsWithResults.length;
};

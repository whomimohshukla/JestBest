import { analyticsService } from './analyticsService';
import { metricsService } from './metricsService';
import { reportQueue } from '../../queues/reportQueue';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';

export interface ReportParams {
  organizationId: string;
  projectId: string;
  testRunId?: string;
  periodStart: string;
  periodEnd: string;
}

export const reportService = {
  async generate(params: ReportParams): Promise<{ generated: boolean; queued: boolean }> {
    const project = await prisma.project.findUnique({ where: { id: params.projectId } });
    if (!project) return { generated: false, queued: false };

    await reportQueue.add('generate-report', {
      organizationId: params.organizationId,
      projectId: params.projectId,
      testRunId: params.testRunId,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
    });
    return { generated: true, queued: true };
  },

  async buildReport(params: ReportParams): Promise<unknown> {
    const [quality, testMetrics, bugMetrics, agentMetrics, run] = await Promise.all([
      analyticsService.qualityScore({
        projectId: params.projectId,
        organizationId: params.organizationId,
      }),
      metricsService.getTestMetrics({ projectId: params.projectId }),
      metricsService.getBugMetrics(params.projectId),
      metricsService.getAgentMetrics(params.organizationId),
      params.testRunId ? prisma.testRun.findUnique({ where: { id: params.testRunId } }) : null,
    ]);

    logger.info({ projectId: params.projectId }, 'report generated');
    return {
      projectId: params.projectId,
      period: { start: params.periodStart, end: params.periodEnd },
      quality,
      testMetrics,
      bugMetrics,
      agentMetrics,
      latestRun: run,
    };
  },
};

import { Queue } from 'bullmq';
import { queueConfig } from '../config/queue';

export type ReportJobData = {
  organizationId: string;
  projectId: string;
  testRunId?: string;
  periodStart: string;
  periodEnd: string;
};

export type ReportJobNames = 'generate-report' | 'generate-quality-score' | 'detect-flaky-tests';

export const reportQueue = new Queue<ReportJobData>('report', queueConfig);

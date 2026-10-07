import { Queue } from 'bullmq';
import { queueConfig } from '../config/queue';

export type TestJobData = {
  testRunId?: string;
  testCaseIds?: string[];
  organizationId: string;
  projectId: string;
  createdById?: string;
  testSuiteId?: string;
  environmentId?: string;
  testUserId?: string;
};

export type TestJobNames = 'execute-test-run' | 'execute-test-case' | 'execute-scheduled-run';

export const testQueue = new Queue<TestJobData>('test', queueConfig);

export const enqueueTestExecution = async (data: TestJobData): Promise<string> => {
  // Deterministic job id per test run: BullMQ ignores an add whose jobId is
  // already known, so a double submit (double click, retried request, two
  // workers racing) cannot enqueue a second execution of the same run.
  const job = await testQueue.add('execute-test-run', data, {
    // BullMQ rejects job ids containing ':' so this stays a plain slug.
    jobId: data.testRunId ? `test-run-${data.testRunId}` : undefined,
  });
  return job.id ?? '';
};

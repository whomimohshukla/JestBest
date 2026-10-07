import { testQueue } from './testQueue';
import { aiQueue, aiExplorationQueue } from './aiQueue';
import { reportQueue } from './reportQueue';
import { webhookQueue } from './webhookQueue';

export const queues = {
  testQueue,
  aiQueue,
  aiExplorationQueue,
  reportQueue,
  webhookQueue,
};

export const closeAllQueues = async (): Promise<void> => {
  // aiExplorationQueue was missing here, so every process that shut down left
  // one BullMQ connection open and the event loop never drained.
  await Promise.all([
    testQueue.close(),
    aiQueue.close(),
    aiExplorationQueue.close(),
    reportQueue.close(),
    webhookQueue.close(),
  ]);
};

export type { TestJobData, TestJobNames } from './testQueue';
export type { AiJobData, AiJobNames } from './aiQueue';
export type { ReportJobData, ReportJobNames } from './reportQueue';
export type { WebhookJobData, WebhookJobNames } from './webhookQueue';

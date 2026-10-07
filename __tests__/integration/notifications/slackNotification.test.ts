jest.mock('../../../src/services/integration/slack/slackService', () => ({
  slackService: {
    sendTestFailureNotification: jest.fn().mockResolvedValue(undefined),
    sendTestSuccessNotification: jest.fn().mockResolvedValue(undefined),
    sendBugNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

import { slackService } from '../../../src/services/integration/slack/slackService';
import { prisma } from '../../../src/config/database';
import { notificationService } from '../../../src/services/notification/notificationService';
import { integrationService } from '../../../src/services/integration/integrationService';
import { createTestUser, request, resetDatabase, teardownDatabase } from '../../fixtures/testApp';

/**
 * `sendSlackNotification` used to read `integration.config` straight out of the
 * row, so the bot token it put on the wire was the AES-GCM ciphertext. Slack
 * rejected it and the surrounding try/catch hid the failure, which looked like
 * "Slack is connected but never posts anything".
 */

let api: Awaited<ReturnType<typeof request>>;
let owner: Awaited<ReturnType<typeof createTestUser>>;

const sendFailure = slackService.sendTestFailureNotification as jest.Mock;

const failurePayload = {
  projectName: 'Checkout',
  testRunId: 'run_1',
  failedCount: 2,
  passedCount: 8,
  totalCount: 10,
  failedTests: [{ title: 'applies a coupon' }],
  testRunUrl: 'http://localhost:5173/runs/run_1',
};

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  sendFailure.mockClear();
  owner = await createTestUser(api);
});

afterAll(async () => {
  await teardownDatabase();
});

describe('POST sendSlackNotification config handling', () => {
  it('decrypts stored credentials before dispatching', async () => {
    await integrationService.connect(owner.organizationId, {
      type: 'SLACK',
      projectId: undefined,
      config: { botToken: 'xoxb-plaintext-token', channel: '#qa' },
    });

    await notificationService.sendSlackNotification(owner.organizationId, 'test_failure', failurePayload);

    expect(sendFailure).toHaveBeenCalledTimes(1);
    const [config] = sendFailure.mock.calls[0] as [{ botToken?: string; channel?: string }];
    expect(config.botToken).toBe('xoxb-plaintext-token');
    expect(config.channel).toBe('#qa');
  });

  it('does nothing when the organization has no Slack integration', async () => {
    await notificationService.sendSlackNotification(owner.organizationId, 'test_failure', failurePayload);

    expect(sendFailure).not.toHaveBeenCalled();
  });

  it('ignores a disconnected integration', async () => {
    const integration = await integrationService.connect(owner.organizationId, {
      type: 'SLACK',
      projectId: undefined,
      config: { botToken: 'xoxb-plaintext-token', channel: '#qa' },
    });
    await prisma.integration.update({
      where: { id: integration.id },
      data: { isActive: false },
    });

    await notificationService.sendSlackNotification(owner.organizationId, 'test_failure', failurePayload);

    expect(sendFailure).not.toHaveBeenCalled();
  });
});

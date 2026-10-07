import { UpstreamError } from '../../../utils/errors';
import type { IntegrationConfig } from '../integrationService';

export interface SlackConfig {
  botToken?: string;
  channel?: string;
}

const getConfig = (config: IntegrationConfig): SlackConfig => {
  const botToken = (config.botToken ?? config.accessToken ?? config.apiKey) as string | undefined;
  if (!botToken) {
    throw new UpstreamError('Slack bot token missing.');
  }
  return { botToken, channel: config.channel as string | undefined };
};

export const slackService = {
  async testConnection(config: IntegrationConfig): Promise<{ ok: boolean; message: string }> {
    try {
      const slack = getConfig(config);
      const response = await fetch('https://slack.com/api/auth.test', {
        headers: { Authorization: `Bearer ${slack.botToken}` },
      });
      const data = (await response.json()) as { ok?: boolean; team?: string };
      if (!data.ok) return { ok: false, message: 'Slack auth failed' };
      return { ok: true, message: `Connected to Slack team ${data.team ?? ''}` };
    } catch (error) {
      return { ok: false, message: (error as Error).message };
    }
  },

  async postMessage(config: IntegrationConfig, text: string, channel?: string): Promise<void> {
    const slack = getConfig(config);
    const targetChannel = channel ?? slack.channel;
    if (!targetChannel) {
      throw new UpstreamError('Slack channel is not configured.');
    }
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slack.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel: targetChannel, text }),
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      throw new UpstreamError(`Slack message failed: ${data.error ?? 'unknown error'}`);
    }
  },

  async postBlockMessage(
    config: IntegrationConfig,
    blocks: any[],
    text: string,
    channel?: string
  ): Promise<void> {
    const slack = getConfig(config);
    const targetChannel = channel ?? slack.channel;
    if (!targetChannel) {
      throw new UpstreamError('Slack channel is not configured.');
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${slack.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: targetChannel,
        text, // Fallback text
        blocks,
      }),
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (!data.ok) {
      throw new UpstreamError(`Slack message failed: ${data.error ?? 'unknown error'}`);
    }
  },

  async sendTestFailureNotification(
    config: IntegrationConfig,
    notification: {
      projectName: string;
      testRunId: string;
      failedCount: number;
      passedCount: number;
      totalCount: number;
      failedTests: Array<{ title: string; errorMessage?: string }>;
      testRunUrl: string;
    },
    channel?: string
  ): Promise<void> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '❌ Test Failure Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n${notification.projectName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Failed:*\n${notification.failedCount} / ${notification.totalCount} tests`,
          },
          {
            type: 'mrkdwn',
            text: `*Passed:*\n${notification.passedCount}`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n:x: Failed`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Failed Tests:*\n${notification.failedTests
            .slice(0, 5)
            .map((t) => `• ${t.title}`)
            .join(
              '\n'
            )}${notification.failedTests.length > 5 ? `\n_...and ${notification.failedTests.length - 5} more_` : ''}`,
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔍 View Test Results',
              emoji: true,
            },
            url: notification.testRunUrl,
            style: 'danger',
          },
        ],
      },
    ];

    await this.postBlockMessage(
      config,
      blocks,
      `Test Failure: ${notification.failedCount} tests failed in ${notification.projectName}`,
      channel
    );
  },

  async sendTestSuccessNotification(
    config: IntegrationConfig,
    notification: {
      projectName: string;
      testRunId: string;
      totalCount: number;
      duration: number;
      testRunUrl: string;
    },
    channel?: string
  ): Promise<void> {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '✅ All Tests Passed',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n${notification.projectName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Tests:*\n${notification.totalCount} passed`,
          },
          {
            type: 'mrkdwn',
            text: `*Duration:*\n${Math.round(notification.duration / 1000)}s`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n:white_check_mark: Passed`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🔍 View Results',
              emoji: true,
            },
            url: notification.testRunUrl,
            style: 'primary',
          },
        ],
      },
    ];

    await this.postBlockMessage(config, blocks, `All tests passed in ${notification.projectName}`, channel);
  },

  async sendBugNotification(
    config: IntegrationConfig,
    notification: {
      bugTitle: string;
      bugId: string;
      severity: string;
      priority: string;
      projectName: string;
      bugUrl: string;
    },
    channel?: string
  ): Promise<void> {
    const severityEmoji =
      {
        CRITICAL: '🔴',
        HIGH: '🟠',
        MEDIUM: '🟡',
        LOW: '🟢',
      }[notification.severity] || '⚪';

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${severityEmoji} New Bug Detected`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${notification.bugTitle}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Project:*\n${notification.projectName}`,
          },
          {
            type: 'mrkdwn',
            text: `*Severity:*\n${notification.severity}`,
          },
          {
            type: 'mrkdwn',
            text: `*Priority:*\n${notification.priority}`,
          },
        ],
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '🐛 View Bug Details',
              emoji: true,
            },
            url: notification.bugUrl,
            style: 'danger',
          },
        ],
      },
    ];

    await this.postBlockMessage(
      config,
      blocks,
      `New ${notification.severity} bug: ${notification.bugTitle}`,
      channel
    );
  },

  async sendDailySummary(
    config: IntegrationConfig,
    summary: {
      date: string;
      testsRun: number;
      testsPassed: number;
      testsFailed: number;
      bugsCreated: number;
      bugsFixed: number;
      topFailingTests: Array<{ title: string; failureCount: number }>;
    },
    channel?: string
  ): Promise<void> {
    const passRate = summary.testsRun > 0 ? Math.round((summary.testsPassed / summary.testsRun) * 100) : 0;

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📊 Daily Testing Summary',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Summary for ${summary.date}*`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Tests Run:*\n${summary.testsRun}`,
          },
          {
            type: 'mrkdwn',
            text: `*Pass Rate:*\n${passRate}%`,
          },
          {
            type: 'mrkdwn',
            text: `*Bugs Created:*\n${summary.bugsCreated}`,
          },
          {
            type: 'mrkdwn',
            text: `*Bugs Fixed:*\n${summary.bugsFixed}`,
          },
        ],
      },
    ];

    if (summary.topFailingTests.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Top Failing Tests:*\n${summary.topFailingTests
            .slice(0, 5)
            .map((t) => `• ${t.title} (${t.failureCount} failures)`)
            .join('\n')}`,
        },
      });
    }

    await this.postBlockMessage(
      config,
      blocks,
      `Daily summary: ${summary.testsRun} tests run with ${passRate}% pass rate`,
      channel
    );
  },
};

import type { Integration } from '@prisma/client';
import { integrationRepository } from '../../repositories/integration.repository';
import { projectRepository } from '../../repositories/project.repository';
import { NotFoundError, UpstreamError, ConflictError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { decrypt, encrypt } from '../../utils/encryption';
import { getRedis } from '../../config/redis';
import { logger } from '../../config/logger';
import type { ConnectIntegrationInput } from '../../validators/integration.validator';

export interface IntegrationConfig {
  accessToken?: string;
  token?: string;
  baseUrl?: string;
  repository?: string;
  workspaceId?: string;
  apiKey?: string;
  channel?: string;
  [key: string]: unknown;
}

const decryptedConfig = (integration: Integration): IntegrationConfig => {
  const raw = integration.config as Record<string, unknown>;
  const decrypted: IntegrationConfig = { ...raw };
  for (const key of Object.keys(raw)) {
    if (typeof raw[key] === 'string' && isEncryptedValue(raw[key] as string)) {
      try {
        decrypted[key] = decrypt(raw[key] as string);
      } catch {
        delete decrypted[key];
      }
    }
  }
  return decrypted;
};

export const integrationConfigOf = decryptedConfig;

const isEncryptedValue = (value: string): boolean => {
  try {
    const buffer = Buffer.from(value, 'base64');
    const parsed = JSON.parse(buffer.toString('utf8'));
    return (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.data === 'string' &&
      typeof parsed.iv === 'string'
    );
  } catch {
    return false;
  }
};

export const integrationService = {
  async connect(organizationId: string, params: ConnectIntegrationInput): Promise<Integration> {
    // A project id arrives from the client, so it must be proven to belong to
    // the caller. Without this an organization could attach its integration to
    // another tenant's project (the FK alone does not prevent it).
    if (params.projectId) {
      const project = await projectRepository.findById(params.projectId);
      if (!project || project.organizationId !== organizationId) {
        throw new ForbiddenError(Messages.PROJECT.NOT_FOUND);
      }
    }

    const existing = await integrationRepository.findByType(organizationId, params.type, params.projectId);
    if (existing) {
      throw new ConflictError('This integration is already connected.');
    }

    const config: Record<string, string> = {};
    for (const [key, value] of Object.entries(params.config ?? {})) {
      config[key] = encrypt(String(value));
    }
    const integration = await integrationRepository.create({
      organizationId,
      projectId: params.projectId,
      type: params.type,
      config: config as object,
    });

    logger.info({ integrationId: integration.id, type: params.type }, 'integration connected');
    return integration;
  },

  async get(integrationId: string): Promise<Integration> {
    const integration = await integrationRepository.findById(integrationId);
    if (!integration) {
      throw new NotFoundError(Messages.INTEGRATION.NOT_FOUND);
    }
    return integration;
  },

  async disconnect(integrationId: string): Promise<void> {
    const integration = await integrationService.get(integrationId);
    const redis = getRedis();
    await redis.del(`integration:${integration.id}`);
    await integrationRepository.hardDelete(integrationId);
  },

  async list(organizationId: string, projectId?: string | null): Promise<Integration[]> {
    return integrationRepository.list(organizationId, projectId);
  },

  async getConfig(integrationId: string): Promise<IntegrationConfig> {
    const integration = await integrationService.get(integrationId);
    return decryptedConfig(integration);
  },

  async test(integrationId: string): Promise<{ ok: boolean; message: string }> {
    const integration = await integrationService.get(integrationId);
    try {
      const config = decryptedConfig(integration);
      switch (integration.type) {
        case 'GITHUB': {
          const client = await import('../integration/github/githubService');
          const result = await client.githubService.testConnection(config);
          return { ok: result.ok, message: result.message };
        }
        case 'JIRA': {
          const client = await import('../integration/jira/jiraService');
          const result = await client.jiraService.testConnection(config);
          return { ok: result.ok, message: result.message };
        }
        case 'SLACK': {
          const client = await import('../integration/slack/slackService');
          const result = await client.slackService.testConnection(config);
          return { ok: result.ok, message: result.message };
        }
        default:
          return {
            ok: true,
            message: `${integration.type} integration exists but has no connectivity test.`,
          };
      }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof UpstreamError ? error.message : 'Connection test failed',
      };
    }
  },
};

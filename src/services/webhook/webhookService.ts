import { createHmac, timingSafeEqual } from 'crypto';
import { webhookRepository } from '../../repositories/webhook.repository';
import { webhookQueue } from '../../queues/webhookQueue';
import { NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { pagination } from '../../utils/formatters';
import { logger } from '../../config/logger';
import type { Prisma, Webhook, WebhookDelivery, WebhookEventType } from '@prisma/client';
import type { ListResponse } from '../../types/api.types';
import type { CreateWebhookInput } from '../../validators/webhook.validator';

export interface WebhookPayload {
  id: string;
  event: string;
  createdAt: string;
  data: unknown;
}

export const webhookService = {
  async create(organizationId: string, params: CreateWebhookInput): Promise<Webhook> {
    const secret = params.secret ?? createHmac('sha256', organizationId).digest('hex').slice(0, 32);
    return webhookRepository.create({
      organizationId,
      projectId: params.projectId,
      url: params.url,
      eventTypes: params.eventTypes,
      secret,
    });
  },

  async get(webhookId: string): Promise<Webhook> {
    const webhook = await webhookRepository.findById(webhookId);
    if (!webhook) {
      throw new NotFoundError(Messages.WEBHOOK.NOT_FOUND);
    }
    return webhook;
  },

  async update(webhookId: string, params: Prisma.WebhookUpdateInput): Promise<Webhook> {
    await webhookService.get(webhookId);
    return webhookRepository.update(webhookId, params);
  },

  async hardDelete(webhookId: string): Promise<void> {
    await webhookService.get(webhookId);
    await webhookRepository.hardDelete(webhookId);
  },

  async list(organizationId: string, projectId?: string | null): Promise<Webhook[]> {
    return webhookRepository.list(organizationId, projectId);
  },

  sign(payload: string, secret: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  },

  verify(payload: string, signature: string, secret: string): boolean {
    const expected = webhookService.sign(payload, secret);
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  },

  buildPayload(event: WebhookEventType, data: unknown): WebhookPayload {
    return {
      id: `${event.toLowerCase()}_${Date.now()}`,
      event,
      createdAt: new Date().toISOString(),
      data,
    };
  },

  async deliver(webhookId: string, eventType: string, payload: unknown): Promise<void> {
    const webhook = await webhookService.get(webhookId);
    if (!webhook.isActive) return;

    const delivery = await webhookRepository.createDelivery({
      webhookId,
      eventType: eventType as WebhookEventType,
      payload: payload as object,
    });

    await webhookQueue.add('deliver-webhook', {
      webhookId,
      deliveryId: delivery.id,
      eventType,
      payload,
      organizationId: webhook.organizationId,
    });
  },

  async dispatch(organizationId: string, eventType: WebhookEventType, payload: unknown): Promise<number> {
    const webhooks = await webhookRepository.listActiveForEvent(organizationId, eventType);
    for (const webhook of webhooks) {
      await webhookService.deliver(webhook.id, eventType, payload);
    }
    return webhooks.length;
  },

  async test(webhookId: string): Promise<{ queued: boolean }> {
    const webhook = await webhookService.get(webhookId);
    await webhookQueue.add('test-webhook', {
      webhookId,
      eventType: 'TEST_STARTED',
      payload: { message: 'This is a test delivery from JestBest.' },
      organizationId: webhook.organizationId,
    });
    return { queued: true };
  },

  async listDeliveries(webhookId: string, page = 1, pageSize = 20): Promise<ListResponse<WebhookDelivery>> {
    await webhookService.get(webhookId);
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      webhookRepository.listDeliveries(webhookId, skip, pageSize),
      webhookRepository.countDeliveries(webhookId),
    ]);
    return pagination(items, total, { page, pageSize });
  },

  async redeliver(deliveryId: string): Promise<{ queued: boolean }> {
    const delivery = await webhookRepository.findDelivery(deliveryId);
    if (!delivery) {
      throw new NotFoundError(Messages.WEBHOOK.DELIVERY_NOT_FOUND);
    }
    const webhook = await webhookService.get(delivery.webhookId);
    if (!webhook.isActive) {
      throw new NotFoundError(Messages.WEBHOOK.INACTIVE);
    }
    await webhookService.deliver(webhook.id, delivery.eventType, delivery.payload);
    return { queued: true };
  },

  async processDelivery(
    webhookId: string,
    eventType: string,
    payload: unknown,
    deliveryId?: string
  ): Promise<void> {
    const webhook = await webhookService.get(webhookId);
    if (!webhook.isActive) return;
    const envelope = webhookService.buildPayload(eventType as WebhookEventType, payload);
    const { ok, status } = await webhookService.sendDelivery(webhook, envelope, deliveryId);
    if (!ok) {
      logger.warn({ webhookId, deliveryId, status }, 'webhook delivery not acknowledged');
    }
  },

  async sendDelivery(
    webhook: Webhook,
    payload: WebhookPayload,
    deliveryId?: string
  ): Promise<{ status: number; ok: boolean }> {
    const body = JSON.stringify(payload);
    const signature = webhookService.sign(body, webhook.secret);
    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-JestBest-Signature': signature,
          'X-JestBest-Event': payload.event,
          'User-Agent': 'JestBest-Webhook/1.0',
        },
        body,
      });
      if (deliveryId) {
        await webhookRepository.updateDelivery(deliveryId, {
          responseStatus: response.status,
          responseBody: (await response.text().catch(() => '')).slice(0, 2000),
          succeededAt: response.ok ? new Date() : undefined,
          failedAt: response.ok ? undefined : new Date(),
        });
      }
      if (response.ok) {
        await webhookRepository.update(webhook.id, { lastTriggeredAt: new Date(), failureCount: 0 });
      } else {
        await webhookRepository.update(webhook.id, {
          lastTriggeredAt: new Date(),
          failureCount: { increment: 1 },
        });
      }
      return { status: response.status, ok: response.ok };
    } catch (error) {
      logger.warn({ webhookId: webhook.id, err: error }, 'webhook delivery failed');
      if (deliveryId) {
        await webhookRepository.updateDelivery(deliveryId, {
          responseBody: (error as Error).message.slice(0, 2000),
          failedAt: new Date(),
        });
      }
      return { status: 0, ok: false };
    }
  },
};

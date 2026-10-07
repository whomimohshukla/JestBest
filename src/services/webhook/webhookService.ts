import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import { webhookRepository } from '../../repositories/webhook.repository';
import { webhookQueue } from '../../queues/webhookQueue';
import { NotFoundError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { pagination } from '../../utils/formatters';
import { logger } from '../../config/logger';
import { safeFetch, assertSafeUrl } from '../../utils/safeFetch';
import type { Prisma, Webhook, WebhookDelivery, WebhookEventType } from '@prisma/client';
import type { ListResponse } from '../../types/api.types';
import type { CreateWebhookInput } from '../../validators/webhook.validator';

export interface WebhookPayload {
  id: string;
  event: string;
  createdAt: string;
  data: unknown;
}

/**
 * Webhook responses to expose. `secret` is the HMAC key used to sign outbound
 * payloads; returning it let anyone with read access forge webhooks that the
 * customer's own systems would accept as genuine. It is shown once, at
 * creation time, and never again.
 */
export type WebhookPublic = Omit<Webhook, 'secret'>;

const toPublic = (webhook: Webhook): WebhookPublic => {
  const { secret: _secret, ...rest } = webhook;
  return rest;
};

/** Strip URLs out of a delivery error before persisting it. */
const sanitizeDeliveryError = (message: string): string =>
  message.replace(/https?:\/\/\S+/gi, '[url]').slice(0, 500);

export const webhookService = {
  async create(organizationId: string, params: CreateWebhookInput): Promise<Webhook> {
    // Reject an internal target at save time so the user gets immediate
    // feedback, rather than discovering it as a permanent delivery failure.
    await assertSafeUrl(params.url);
    // This was `createHmac('sha256', organizationId)`, which is not a secret at
    // all: the organization id appears in API responses and URLs, so anyone who
    // knew it could recompute every webhook signature and forge deliveries that
    // the customer's own systems would accept. Derive from a CSPRNG instead.
    const secret = params.secret ?? randomBytes(32).toString('hex');
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

  /** Same lookup as `get`, but with the signing secret stripped. */
  async getPublic(webhookId: string): Promise<WebhookPublic> {
    return toPublic(await webhookService.get(webhookId));
  },

  async update(webhookId: string, params: Prisma.WebhookUpdateInput): Promise<WebhookPublic> {
    await webhookService.get(webhookId);
    // Validate a changed URL before it is stored, so an internal target is
    // rejected up front rather than only at delivery time.
    const nextUrl = typeof params.url === 'string' ? params.url : undefined;
    if (nextUrl) {
      await assertSafeUrl(nextUrl);
    }
    return toPublic(await webhookRepository.update(webhookId, params));
  },

  async hardDelete(webhookId: string): Promise<void> {
    await webhookService.get(webhookId);
    await webhookRepository.hardDelete(webhookId);
  },

  async list(organizationId: string, projectId?: string | null): Promise<WebhookPublic[]> {
    return (await webhookRepository.list(organizationId, projectId)).map(toPublic);
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

  async redeliver(deliveryId: string, webhookId: string): Promise<{ queued: boolean }> {
    // The delivery is looked up *through* the webhook, which the caller has
    // already had authorized against their organization. Resolving it by id
    // alone let any caller force a re-delivery of another tenant's event —
    // which also turned that tenant's webhook URL into a target the attacker
    // could trigger.
    const delivery = await webhookRepository.findDelivery(webhookId, deliveryId);
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
      // Guarded: the URL is attacker-chosen, so an unguarded fetch turns this
      // into an SSRF primitive. `safeFetch` rejects non-HTTP schemes, resolves
      // DNS and refuses private/loopback/link-local/metadata targets, refuses
      // embedded credentials, and does not follow redirects.
      const response = await safeFetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-JestBest-Signature': signature,
          'X-JestBest-Event': payload.event,
          'User-Agent': 'JestBest-Webhook/1.0',
        },
        body,
        timeoutMs: 10000,
      });
      if (deliveryId) {
        await webhookRepository.updateDelivery(deliveryId, {
          responseStatus: response.status,
          // The response body is not stored. It was readable through
          // GET /webhooks/:id/deliveries, which made this an exfiltration
          // channel for anything the webhook URL could reach.
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
          // Error messages can embed the URL that was dialled; keep them as a
          // diagnostic but never the response body of a blocked or failed call.
          responseBody: sanitizeDeliveryError((error as Error).message),
          failedAt: new Date(),
        });
      }
      return { status: 0, ok: false };
    }
  },
};

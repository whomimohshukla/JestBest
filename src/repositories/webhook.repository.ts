import { Prisma, WebhookEventType } from '@prisma/client';
import { prisma } from '../config/database';

export const webhookRepository = {
  findById: (id: string) => prisma.webhook.findUnique({ where: { id } }),

  create: (data: Prisma.WebhookUncheckedCreateInput) => prisma.webhook.create({ data }),

  update: (id: string, data: Prisma.WebhookUpdateInput) => prisma.webhook.update({ where: { id }, data }),

  hardDelete: (id: string) => prisma.webhook.delete({ where: { id } }),

  list: (organizationId: string, projectId?: string | null) =>
    prisma.webhook.findMany({
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    }),

  listActiveForEvent: (organizationId: string, eventType: WebhookEventType) =>
    prisma.webhook.findMany({
      where: {
        organizationId,
        isActive: true,
        eventTypes: { has: eventType },
      },
    }),

  createDelivery: (data: Prisma.WebhookDeliveryUncheckedCreateInput) =>
    prisma.webhookDelivery.create({ data }),

  updateDelivery: (id: string, data: Prisma.WebhookDeliveryUpdateInput) =>
    prisma.webhookDelivery.update({ where: { id }, data }),

  /** Scoped to the webhook so a delivery id from another tenant cannot resolve. */
  findDelivery: (webhookId: string, deliveryId: string) =>
    prisma.webhookDelivery.findFirst({ where: { id: deliveryId, webhookId } }),

  listDeliveries: (webhookId: string, skip = 0, take = 20) =>
    prisma.webhookDelivery.findMany({
      where: { webhookId },
      skip,
      take,
      orderBy: { createdAt: 'desc' },
    }),

  countDeliveries: (webhookId: string) => prisma.webhookDelivery.count({ where: { webhookId } }),
};

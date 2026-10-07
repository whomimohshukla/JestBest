import type { Subscription, SubscriptionPlan, Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { stripeService } from './stripeService';
import { NotFoundError, UpstreamError, ConflictError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { usageService } from './usageService';
import { logger } from '../../config/logger';

export interface PlanChangeParams {
  organizationId: string;
  plan: SubscriptionPlan;
}

interface StripeEvent {
  id: string;
  type: string;
  // Optional on the wire: a truncated payload must be rejected up front rather
  // than throwing mid-apply (which Stripe would retry forever).
  data?: {
    object: {
      id?: string;
      customer?: string;
      status?: string;
      current_period_start?: number;
      current_period_end?: number;
      cancel_at_period_end?: boolean;
      plan?: { id?: string };
    };
  };
}

const PLAN_BY_STRIPE_PRODUCT: Record<string, SubscriptionPlan> = {
  prod_pro: 'PRO',
  prod_business: 'BUSINESS',
  prod_enterprise: 'ENTERPRISE',
};

export const billingService = {
  async getSubscription(organizationId: string): Promise<Subscription> {
    const subscription = await prisma.subscription.findUnique({ where: { organizationId } });
    if (!subscription) {
      throw new NotFoundError(Messages.BILLING.NOT_FOUND);
    }
    return subscription;
  },

  async getOrCreate(organizationId: string): Promise<Subscription> {
    const existing = await prisma.subscription.findUnique({ where: { organizationId } });
    if (existing) return existing;
    return prisma.subscription.create({
      data: {
        organizationId,
        plan: 'FREE',
        status: 'ACTIVE',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  },

  async changePlan(params: PlanChangeParams): Promise<Subscription> {
    await billingService.getSubscription(params.organizationId);
    return prisma.subscription.update({
      where: { organizationId: params.organizationId },
      data: { plan: params.plan },
    });
  },

  async updateSubscription(
    organizationId: string,
    data: Prisma.SubscriptionUpdateInput
  ): Promise<Subscription> {
    await billingService.getSubscription(organizationId);
    return prisma.subscription.update({ where: { organizationId }, data });
  },

  async getUsage(organizationId: string): Promise<unknown> {
    const [subscription, current, history, latest] = await Promise.all([
      billingService.getSubscription(organizationId),
      usageService.getForOrg(organizationId),
      usageService.getHistory(organizationId),
      prisma.usage.findMany({ where: { organizationId }, orderBy: { month: 'desc' }, take: 1 }),
    ]);
    return { subscription, current, history, latest: latest[0] ?? null };
  },

  async handleStripeWebhook(
    signature: string,
    rawBody: string
  ): Promise<{ received: true; duplicate?: boolean }> {
    const event = (await stripeService.handleWebhook(rawBody, signature)) as StripeEvent;
    if (!event?.id || !event.type || !event.data?.object) {
      throw new UpstreamError('Invalid webhook payload.');
    }

    const alreadyApplied = await prisma.stripeWebhookEvent.findUnique({ where: { id: event.id } });
    if (alreadyApplied) {
      logger.debug({ eventId: event.id, type: event.type }, 'stripe webhook event already applied');
      return { received: true, duplicate: true };
    }

    // Applied before the marker is written: if this throws the response is a
    // 5xx, Stripe retries, and nothing marks the event as handled.
    await billingService.applyStripeEvent(event);

    try {
      await prisma.stripeWebhookEvent.create({ data: { id: event.id, type: event.type } });
    } catch (error) {
      // Two deliveries of the same event raced. Both applied, which is safe
      // because applyStripeEvent only writes idempotent updates.
      if ((error as { code?: string }).code !== 'P2002') {
        throw error;
      }
    }
    return { received: true };
  },

  async applyStripeEvent(event: StripeEvent): Promise<void> {
    // Errors propagate: the caller returns 5xx so Stripe redelivers. Swallowing
    // them here would acknowledge an event that was never applied.
    const object = event.data?.object;
    if (!object) {
      throw new UpstreamError('Invalid webhook payload.');
    }
    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        const sub = object as unknown as {
          id?: string;
          customer?: string;
          status?: string;
          current_period_start?: number;
          current_period_end?: number;
          cancel_at_period_end?: boolean;
          plan?: { id?: string };
          items?: { data?: Array<{ price?: { product?: string } }> };
        };
        if (!sub.customer) return;
        const subscription = await prisma.subscription.findFirst({
          where: { stripeCustomerId: sub.customer },
        });
        if (!subscription) return;
        const productId = sub.items?.data?.[0]?.price?.product;
        const plan = productId ? (PLAN_BY_STRIPE_PRODUCT[productId] ?? subscription.plan) : subscription.plan;
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            plan,
            stripeSubscriptionId: sub.id ?? subscription.stripeSubscriptionId,
            status: 'ACTIVE',
            currentPeriodStart: sub.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : undefined,
            currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined,
            cancelledAt: sub.cancel_at_period_end ? new Date() : null,
          },
        });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = object as unknown as { customer?: string };
        if (!sub.customer) return;
        const subscription = await prisma.subscription.findFirst({
          where: { stripeCustomerId: sub.customer },
        });
        if (!subscription) return;
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', cancelledAt: new Date() },
        });
        break;
      }
      case 'invoice.payment_failed': {
        const obj = object as unknown as { customer?: string };
        logger.warn({ customer: obj.customer, eventId: event.id }, 'stripe invoice payment failed');
        break;
      }
      default:
        logger.debug({ type: event.type }, 'stripe webhook event noop');
    }
  },
};

// Moved to stripeService so the webhook path can verify signatures without an
// import cycle; re-exported here for existing consumers.
export { throwStripeError, ensureStripeConfigured } from './stripeService';

export { ConflictError as BillingConflictError };

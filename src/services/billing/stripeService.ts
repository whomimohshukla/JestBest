import { createHmac, timingSafeEqual } from 'node:crypto';

import { UpstreamError, UnauthorizedError } from '../../utils/errors';

export interface StripeCustomer {
  customerId: string;
}

export interface StripeSubscriptionResult {
  subscriptionId: string;
}

/**
 * Fails closed when the instance has no Stripe key. Lives here rather than in
 * billingService so the webhook path can verify signatures without importing
 * billingService (which imports this module).
 */
export const throwStripeError = (): never => {
  throw new UpstreamError('Stripe is not configured on this instance.');
};

export const ensureStripeConfigured = (): void => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throwStripeError();
  }
  void key;
};

const STRIPE_API = 'https://api.stripe.com/v1';

const callStripe = async <T>(method: string, path: string, body?: URLSearchParams): Promise<T> => {
  ensureStripeConfigured();
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throwStripeError();
  const response = await fetch(`${STRIPE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body?.toString(),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new UpstreamError(`Stripe API returned ${response.status}`, text.slice(0, 500));
  }
  return response.json() as Promise<T>;
};

export const stripeService = {
  async createCustomer(organizationId: string, email: string, name?: string): Promise<StripeCustomer> {
    const body = new URLSearchParams();
    body.set('email', email);
    body.set('metadata[organizationId]', organizationId);
    if (name) body.set('name', name);
    return callStripe<StripeCustomer>('POST', '/customers', body);
  },

  async createSubscription(
    customerId: string,
    priceId: string,
    options?: {
      trialDays?: number;
      coupon?: string;
      metadata?: Record<string, string>;
    }
  ): Promise<StripeSubscriptionResult & { clientSecret?: string }> {
    const body = new URLSearchParams({
      customer: customerId,
      [`items[0][price]`]: priceId,
      payment_behavior: 'default_incomplete',
      [`payment_settings[save_default_payment_method]`]: 'on_subscription',
      [`expand[0]`]: 'latest_invoice.payment_intent',
    });

    if (options?.trialDays) {
      body.set('trial_period_days', String(options.trialDays));
    }

    if (options?.coupon) {
      body.set('coupon', options.coupon);
    }

    if (options?.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        body.set(`metadata[${key}]`, value);
      });
    }

    const result = await callStripe<any>('POST', '/subscriptions', body);

    return {
      subscriptionId: result.id,
      clientSecret: result.latest_invoice?.payment_intent?.client_secret,
    };
  },

  async cancelSubscription(subscriptionId: string, immediately = false): Promise<void> {
    if (immediately) {
      await callStripe<unknown>('DELETE', `/subscriptions/${subscriptionId}`);
    } else {
      // Cancel at period end
      const body = new URLSearchParams({ cancel_at_period_end: 'true' });
      await callStripe<unknown>('POST', `/subscriptions/${subscriptionId}`, body);
    }
  },

  async updateSubscription(
    subscriptionId: string,
    updates: {
      priceId?: string;
      quantity?: number;
      metadata?: Record<string, string>;
    }
  ): Promise<void> {
    const body = new URLSearchParams();

    if (updates.priceId) {
      body.set(`items[0][price]`, updates.priceId);
      body.set('proration_behavior', 'always_invoice');
    }

    if (updates.quantity) {
      body.set(`items[0][quantity]`, String(updates.quantity));
    }

    if (updates.metadata) {
      Object.entries(updates.metadata).forEach(([key, value]) => {
        body.set(`metadata[${key}]`, value);
      });
    }

    await callStripe<unknown>('POST', `/subscriptions/${subscriptionId}`, body);
  },

  async createPaymentMethod(customerId: string, paymentMethodId: string): Promise<void> {
    const body = new URLSearchParams({
      payment_method: paymentMethodId,
    });

    await callStripe<unknown>('POST', `/customers/${customerId}`, body);
  },

  async getSubscription(subscriptionId: string): Promise<any> {
    return callStripe<any>('GET', `/subscriptions/${subscriptionId}`);
  },

  async listInvoices(customerId: string, limit = 10): Promise<any[]> {
    const response = await callStripe<{ data: any[] }>(
      'GET',
      `/invoices?customer=${customerId}&limit=${limit}`
    );
    return response.data;
  },

  async createUsageRecord(subscriptionItemId: string, quantity: number, timestamp?: number): Promise<void> {
    const body = new URLSearchParams({
      quantity: String(quantity),
      timestamp: String(timestamp || Math.floor(Date.now() / 1000)),
      action: 'increment',
    });

    await callStripe<unknown>('POST', `/subscription_items/${subscriptionItemId}/usage_records`, body);
  },

  async createCheckoutSession(params: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    trialDays?: number;
  }): Promise<{ sessionId: string; url: string }> {
    const body = new URLSearchParams({
      customer: params.customerId,
      [`line_items[0][price]`]: params.priceId,
      [`line_items[0][quantity]`]: '1',
      mode: 'subscription',
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });

    if (params.trialDays) {
      body.set('subscription_data[trial_period_days]', String(params.trialDays));
    }

    const result = await callStripe<{ id: string; url: string }>('POST', '/checkout/sessions', body);

    return {
      sessionId: result.id,
      url: result.url,
    };
  },

  async createPortalSession(customerId: string, returnUrl: string): Promise<{ url: string }> {
    const body = new URLSearchParams({
      customer: customerId,
      return_url: returnUrl,
    });

    const result = await callStripe<{ url: string }>('POST', '/billing_portal/sessions', body);
    return { url: result.url };
  },

  /**
   * Verify a Stripe webhook signature and return the parsed event.
   *
   * Stripe signs `${timestamp}.${payload}` with HMAC-SHA256 using the endpoint
   * secret and sends it as `Stripe-Signature: t=<ts>,v1=<hex>[,v1=<hex>...]`.
   * Verification is mandatory: without it anyone able to reach this endpoint
   * could forge subscription events and grant themselves a paid plan.
   */
  async handleWebhook(payload: string, signature: string): Promise<unknown> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) {
      throw new UpstreamError('Stripe webhook secret is not configured');
    }

    const parts = signature.split(',');
    let timestamp: number | undefined;
    const received: string[] = [];
    for (const part of parts) {
      const [key, value] = part.split('=');
      if (key === 't' && value) timestamp = Number.parseInt(value, 10);
      if (key === 'v1' && value) received.push(value);
    }
    if (timestamp === undefined || Number.isNaN(timestamp) || received.length === 0) {
      throw new UnauthorizedError('Malformed Stripe-Signature header');
    }

    // Reject replays of an old, otherwise valid, signature.
    const toleranceSeconds = 300;
    if (Math.abs(Date.now() / 1000 - timestamp) > toleranceSeconds) {
      throw new UnauthorizedError('Stripe signature timestamp is outside the tolerance window');
    }

    const expected = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
    const matches = received.some(
      (candidate) =>
        candidate.length === expected.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))
    );
    if (!matches) {
      throw new UnauthorizedError('Stripe signature verification failed');
    }

    try {
      return JSON.parse(payload);
    } catch {
      throw new UpstreamError('Invalid webhook payload');
    }
  },
};

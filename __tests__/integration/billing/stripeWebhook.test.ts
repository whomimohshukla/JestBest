import { createHmac } from 'node:crypto';

import { prisma } from '../../../src/config/database';
import { createTestUser, request, resetDatabase, teardownDatabase } from '../../fixtures/testApp';

/**
 * Stripe webhook handling.
 *
 *  - the signature is verified over the exact raw bytes
 *  - the event is applied synchronously (the response is only 200 once the
 *    subscription row is updated)
 *  - a redelivered event id is acknowledged but not applied twice, which is
 *    what makes Stripe's at-least-once delivery safe
 */

const API = '/api/v1';
const WEBHOOK = `${API}/billing/webhooks/stripe`;
const SECRET = 'whsec_test_secret';

let api: Awaited<ReturnType<typeof request>>;
let organizationId: string;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  const owner = await createTestUser(api);
  organizationId = owner.organizationId;
});

afterAll(async () => {
  await teardownDatabase();
});

const sign = (payload: string, timestamp = Math.floor(Date.now() / 1000), secret = SECRET) => {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${digest}`;
};

const postEvent = (event: unknown, options: { signature?: string; timestamp?: number } = {}) => {
  const payload = JSON.stringify(event);
  return api
    .post(WEBHOOK)
    .set('Content-Type', 'application/json')
    .set('Stripe-Signature', options.signature ?? sign(payload, options.timestamp))
    .send(payload);
};

const seedSubscription = async (stripeCustomerId = 'cus_stripe_1') => {
  // Registration already provisions a FREE subscription for the organization.
  await prisma.subscription.upsert({
    where: { organizationId },
    create: {
      organizationId,
      plan: 'FREE',
      status: 'ACTIVE',
      stripeCustomerId,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    update: { plan: 'FREE', status: 'ACTIVE', stripeCustomerId, cancelledAt: null },
  });
};

const subscriptionUpdateEvent = (id: string) => ({
  id,
  type: 'customer.subscription.updated',
  data: {
    object: {
      id: 'sub_123',
      customer: 'cus_stripe_1',
      status: 'active',
      current_period_start: 1791300000,
      current_period_end: 1793892000,
      items: { data: [{ price: { product: 'prod_pro' } }] },
    },
  },
});

describe('POST /billing/webhooks/stripe', () => {
  it('verifies the signature and applies the subscription update', async () => {
    await seedSubscription();

    const res = await postEvent(subscriptionUpdateEvent('evt_apply_1'));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ received: true });

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId },
    });
    expect(subscription?.plan).toBe('PRO');
    expect(subscription?.stripeSubscriptionId).toBe('sub_123');
    expect(subscription?.status).toBe('ACTIVE');
    expect(subscription?.currentPeriodStart).toEqual(new Date(1791300000 * 1000));

    await expect(
      prisma.stripeWebhookEvent.findUnique({ where: { id: 'evt_apply_1' } })
    ).resolves.not.toBeNull();
  });

  it('acknowledges a redelivered event without applying it twice', async () => {
    await seedSubscription();
    const event = subscriptionUpdateEvent('evt_redeliver_1');

    expect((await postEvent(event)).status).toBe(200);

    // Stripe marks an event handled the moment it sees a 2xx and will happily
    // send it again after a timeout, a deploy, or a load-balancer retry.
    const duplicate = await postEvent(event);

    expect(duplicate.status).toBe(200);
    expect(duplicate.body.data).toEqual({ received: true, duplicate: true });
    await expect(prisma.stripeWebhookEvent.count({ where: { id: 'evt_redeliver_1' } })).resolves.toBe(1);
  });

  it('marks the subscription cancelled on customer.subscription.deleted', async () => {
    await seedSubscription();

    const res = await postEvent({
      id: 'evt_deleted_1',
      type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_123', customer: 'cus_stripe_1' } },
    });

    expect(res.status).toBe(200);
    const subscription = await prisma.subscription.findFirst({ where: { organizationId } });
    expect(subscription?.status).toBe('CANCELED');
    expect(subscription?.cancelledAt).not.toBeNull();
  });

  it('rejects a forged signature', async () => {
    await seedSubscription();
    const payload = JSON.stringify(subscriptionUpdateEvent('evt_forged_1'));

    const res = await api
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', sign(payload, undefined, 'whsec_wrong'))
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    await expect(prisma.stripeWebhookEvent.count()).resolves.toBe(0);
  });

  it('rejects a tampered payload that keeps a valid signature', async () => {
    await seedSubscription();
    const original = JSON.stringify(subscriptionUpdateEvent('evt_tampered_1'));
    const tampered = JSON.stringify({
      ...subscriptionUpdateEvent('evt_tampered_1'),
      data: { object: { customer: 'cus_victim', id: 'sub_hijacked' } },
    });

    const res = await api
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', sign(original))
      .send(tampered);

    expect(res.status).toBe(401);
  });

  it('rejects a replayed signature outside the tolerance window', async () => {
    const payload = JSON.stringify(subscriptionUpdateEvent('evt_stale_1'));

    const res = await api
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .set('Stripe-Signature', sign(payload, Math.floor(Date.now() / 1000) - 400))
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error.message).toMatch(/tolerance window/i);
  });

  it('rejects a request with no signature header', async () => {
    const res = await api
      .post(WEBHOOK)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(subscriptionUpdateEvent('evt_unsigned_1')));

    expect(res.status).toBe(401);
  });
});

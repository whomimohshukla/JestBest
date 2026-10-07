import { prisma } from '../../../src/config/database';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

/**
 * POST /webhooks/:webhookId/deliveries/:deliveryId/redeliver:
 *  - replays the stored payload as a new delivery attempt (the operator
 *    recovery path after a downstream outage)
 *  - resolves the delivery *through* the caller's webhook, so a guessed id
 *    can neither read nor fire another tenant's endpoint
 *  - refuses to replay for a webhook that has been switched off
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;
let webhookId: string;

const seedDelivery = () =>
  prisma.webhookDelivery.create({
    data: {
      webhookId,
      eventType: 'TEST_COMPLETED',
      payload: { message: 'original payload' },
      attempts: 1,
      responseStatus: 500,
      failedAt: new Date(),
    },
  });

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);

  const webhook = await api
    .post(`${API}/webhooks`)
    .set(auth(user))
    .send({ url: 'https://example.com/hook', eventTypes: ['TEST_COMPLETED'] });
  webhookId = webhook.body.data.id as string;
});

afterAll(async () => {
  await teardownDatabase();
});

describe('POST /webhooks/:webhookId/deliveries/:deliveryId/redeliver', () => {
  it('queues a replay of the stored payload as a new delivery', async () => {
    const delivery = await seedDelivery();

    const res = await api
      .post(`${API}/webhooks/${webhookId}/deliveries/${delivery.id}/redeliver`)
      .set(auth(user));

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ queued: true });
    expect(res.body.meta.message).toBeTruthy();

    // The replay is a separate attempt, so the original record is intact and
    // the log gains exactly one row.
    await expect(prisma.webhookDelivery.count({ where: { webhookId } })).resolves.toBe(2);
    await expect(prisma.webhookDelivery.findUnique({ where: { id: delivery.id } })).resolves.toMatchObject({
      attempts: 1,
      responseStatus: 500,
    });
  });

  it('404s for a delivery that does not exist', async () => {
    const res = await api
      .post(`${API}/webhooks/${webhookId}/deliveries/delivery_missing/redeliver`)
      .set(auth(user));

    expect(res.status).toBe(404);
    await expect(prisma.webhookDelivery.count({ where: { webhookId } })).resolves.toBe(0);
  });

  it('refuses to replay a delivery that belongs to another organization', async () => {
    const other = await createTestUser(api);
    const otherWebhook = await api
      .post(`${API}/webhooks`)
      .set(auth(other))
      .send({ url: 'https://example.com/other', eventTypes: ['TEST_COMPLETED'] });
    const otherDelivery = await prisma.webhookDelivery.create({
      data: {
        webhookId: otherWebhook.body.data.id as string,
        eventType: 'TEST_COMPLETED',
        payload: { message: 'tenant b payload' },
      },
    });

    const res = await api
      .post(`${API}/webhooks/${otherWebhook.body.data.id}/deliveries/${otherDelivery.id}/redeliver`)
      .set(auth(user));

    expect(res.status).toBe(403);
    await expect(prisma.webhookDelivery.count()).resolves.toBe(1);
  });

  it('refuses to replay while the webhook is switched off', async () => {
    const delivery = await seedDelivery();
    await prisma.webhook.update({ where: { id: webhookId }, data: { isActive: false } });

    const res = await api
      .post(`${API}/webhooks/${webhookId}/deliveries/${delivery.id}/redeliver`)
      .set(auth(user));

    expect(res.status).toBe(404);
    await expect(prisma.webhookDelivery.count({ where: { webhookId } })).resolves.toBe(1);
  });

  it('requires authentication', async () => {
    const delivery = await seedDelivery();
    const res = await api.post(`${API}/webhooks/${webhookId}/deliveries/${delivery.id}/redeliver`);
    expect(res.status).toBe(401);
  });
});

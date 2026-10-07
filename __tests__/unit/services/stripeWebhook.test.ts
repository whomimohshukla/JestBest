import { createHmac } from 'node:crypto';

import { stripeService } from '../../../src/services/billing/stripeService';

const SECRET = 'whsec_unit_test_secret';

/** Build a genuine Stripe-Signature header for a payload. */
const sign = (payload: string, timestamp: number, secret = SECRET) => {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
  return `t=${timestamp},v1=${digest}`;
};

const now = () => Math.floor(Date.now() / 1000);

describe('stripeService.handleWebhook signature verification', () => {
  const original = process.env.STRIPE_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  });

  afterAll(() => {
    process.env.STRIPE_WEBHOOK_SECRET = original;
  });

  it('accepts a correctly signed payload', async () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    const event = await stripeService.handleWebhook(payload, sign(payload, now()));

    expect(event).toEqual({ id: 'evt_1', type: 'checkout.session.completed' });
  });

  it('rejects a forged signature', async () => {
    const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
    // Attacker signs with the wrong secret.
    await expect(stripeService.handleWebhook(payload, sign(payload, now(), 'whsec_wrong'))).rejects.toThrow(
      /signature verification failed/i
    );
  });

  it('rejects a tampered payload that keeps a valid signature', async () => {
    const originalPayload = JSON.stringify({ id: 'evt_1', amount: 1000 });
    const tampered = JSON.stringify({ id: 'evt_1', amount: 1 });
    const signature = sign(originalPayload, now());

    await expect(stripeService.handleWebhook(tampered, signature)).rejects.toThrow(
      /signature verification failed/i
    );
  });

  it('rejects a replayed signature outside the tolerance window', async () => {
    const payload = JSON.stringify({ id: 'evt_old' });
    const stale = now() - 3600;

    await expect(stripeService.handleWebhook(payload, sign(payload, stale))).rejects.toThrow(
      /tolerance window/i
    );
  });

  it('rejects a signature with a timestamp in the future beyond tolerance', async () => {
    const payload = JSON.stringify({ id: 'evt_future' });
    await expect(stripeService.handleWebhook(payload, sign(payload, now() + 3600))).rejects.toThrow(
      /tolerance window/i
    );
  });

  it('rejects a malformed header', async () => {
    const payload = JSON.stringify({ id: 'evt_1' });
    await expect(stripeService.handleWebhook(payload, 'garbage')).rejects.toThrow(/malformed/i);
    await expect(stripeService.handleWebhook(payload, 't=abc,v1=def')).rejects.toThrow(/malformed/i);
    await expect(stripeService.handleWebhook(payload, `v1=${'0'.repeat(64)}`)).rejects.toThrow(/malformed/i);
  });

  it('rejects a truncated or padded signature without throwing on length mismatch', async () => {
    const payload = JSON.stringify({ id: 'evt_1' });
    const timestamp = now();
    const valid = sign(payload, timestamp);
    const digest = valid.split('v1=')[1];

    // Shorter digest must not crash timingSafeEqual on unequal lengths.
    await expect(
      stripeService.handleWebhook(payload, `t=${timestamp},v1=${digest.slice(0, 10)}`)
    ).rejects.toThrow(/signature verification failed/i);
  });

  it('accepts a header carrying multiple v1 candidates (key rotation)', async () => {
    const payload = JSON.stringify({ id: 'evt_rot' });
    const timestamp = now();
    const good = createHmac('sha256', SECRET).update(`${timestamp}.${payload}`).digest('hex');
    const header = `t=${timestamp},v1=${'0'.repeat(64)},v1=${good}`;

    await expect(stripeService.handleWebhook(payload, header)).resolves.toMatchObject({ id: 'evt_rot' });
  });

  it('fails closed when the webhook secret is not configured', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const payload = JSON.stringify({ id: 'evt_1' });

    await expect(stripeService.handleWebhook(payload, sign(payload, now()))).rejects.toThrow(
      /secret is not configured/i
    );
  });

  it('rejects a correctly signed payload that is not valid JSON', async () => {
    const payload = 'not-json';
    await expect(stripeService.handleWebhook(payload, sign(payload, now()))).rejects.toThrow(
      /invalid webhook payload/i
    );
  });
});

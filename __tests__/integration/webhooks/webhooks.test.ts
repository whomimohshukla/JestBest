import { webhookService } from '../../../src/services/webhook/webhookService';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

/**
 * Webhook signing-secret confidentiality and delivery safety:
 *  - the signing secret is unguessable and never returned by a read
 *  - delivery to an internal address is rejected as SSRF
 *  - signature verification round-trips and rejects tampering
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);
});

afterAll(async () => {
  await teardownDatabase();
});

describe('webhook signing secret', () => {
  it('generates a long random secret rather than deriving one from the org id', async () => {
    const res = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'https://example.com/hook', eventTypes: ['TEST_COMPLETED'] });

    expect(res.status).toBe(201);
    const secret = res.body.data.secret as string;

    // The old implementation was HMAC-SHA256 keyed on the organization id,
    // which is not secret: it appears in API responses and URLs, so anyone
    // could recompute the secret and forge deliveries their systems trusted.
    expect(secret).not.toBe(user.organizationId);
    expect(secret.length).toBeGreaterThanOrEqual(32);
    expect(secret).toMatch(/^[0-9a-f]+$/);
  });

  it('gives two webhooks in the same org different secrets', async () => {
    const a = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'https://example.com/a', eventTypes: ['TEST_COMPLETED'] });
    const b = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'https://example.com/b', eventTypes: ['TEST_COMPLETED'] });

    expect(a.body.data.secret).not.toBe(b.body.data.secret);
  });

  it('never returns the secret from list, get or update', async () => {
    const created = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'https://example.com/hook', eventTypes: ['TEST_COMPLETED'] });
    const id = created.body.data.id as string;
    const secret = created.body.data.secret as string;

    const list = await api.get(`${API}/webhooks`).set(auth(user));
    expect(JSON.stringify(list.body)).not.toContain(secret);

    const get = await api.get(`${API}/webhooks/${id}`).set(auth(user));
    expect(get.body.data.secret).toBeUndefined();

    const updated = await api.patch(`${API}/webhooks/${id}`).set(auth(user)).send({ isActive: false });
    expect(updated.body.data.secret).toBeUndefined();
  });

  it('keeps an explicit user-supplied secret', async () => {
    const res = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({
        url: 'https://example.com/hook',
        eventTypes: ['TEST_COMPLETED'],
        secret: 'a-sufficiently-long-secret',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.secret).toBe('a-sufficiently-long-secret');
  });

  it('rejects a secret shorter than 16 characters', async () => {
    const res = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({
        url: 'https://example.com/hook',
        eventTypes: ['TEST_COMPLETED'],
        secret: 'tooshort',
      });

    expect(res.status).toBe(400);
  });
});

describe('webhookService.sign / verify', () => {
  it('verifies an untampered payload', () => {
    const secret = 'a-sufficiently-long-secret';
    const body = JSON.stringify({ event: 'TEST_COMPLETED' });

    const signature = webhookService.sign(body, secret);

    expect(webhookService.verify(body, signature, secret)).toBe(true);
  });

  it('rejects a payload modified after signing', () => {
    const secret = 'a-sufficiently-long-secret';
    const signature = webhookService.sign(JSON.stringify({ amount: 1 }), secret);

    expect(webhookService.verify(JSON.stringify({ amount: 2 }), signature, secret)).toBe(false);
  });

  it('rejects a valid signature verified with a different secret', () => {
    const body = JSON.stringify({ event: 'X' });
    const signature = webhookService.sign(body, 'secret-one-aaaaaaaaaa');

    expect(webhookService.verify(body, signature, 'secret-two-bbbbbbbbbb')).toBe(false);
  });

  it('is deterministic for the same input', () => {
    const body = JSON.stringify({ event: 'X' });

    expect(webhookService.sign(body, 'secret-one-aaaaaaaaaa')).toBe(
      webhookService.sign(body, 'secret-one-aaaaaaaaaa')
    );
  });

  it('does not throw on a malformed signature', () => {
    const body = JSON.stringify({ event: 'X' });

    expect(() => webhookService.verify(body, 'not-hex', 'secret-one-aaaaaaaaaa')).not.toThrow();
    expect(webhookService.verify(body, 'not-hex', 'secret-one-aaaaaaaaaa')).toBe(false);
  });
});

describe('webhook SSRF protection', () => {
  const internalTargets = [
    'http://127.0.0.1/hook',
    'http://localhost/hook',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/hook',
    'http://192.168.1.1/hook',
    'http://[::1]/hook',
  ];

  it.each(internalTargets)('refuses to create a webhook targeting %s', async (url) => {
    const res = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url, eventTypes: ['TEST_COMPLETED'] });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('refuses a non-http scheme', async () => {
    const res = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'file:///etc/passwd', eventTypes: ['TEST_COMPLETED'] });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('rejects an update that retargets a webhook internally', async () => {
    const created = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'https://example.com/hook', eventTypes: ['TEST_COMPLETED'] });
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/webhooks/${id}`)
      .set(auth(user))
      .send({ url: 'http://169.254.169.254/' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('accepts an ordinary public https target', async () => {
    const res = await api
      .post(`${API}/webhooks`)
      .set(auth(user))
      .send({ url: 'https://example.com/hooks/abc', eventTypes: ['TEST_COMPLETED'] });

    expect(res.status).toBe(201);
  });
});

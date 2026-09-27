import { createHash } from 'node:crypto';

import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;

const newKey = (name: string) => ({ name, expiresAt: new Date(Date.now() + 86400000).toISOString() });

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

describe('POST /api-keys', () => {
  it('returns the plaintext key exactly once', async () => {
    const res = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('CI pipeline'));

    expect(res.status).toBe(201);
    expect(res.body.data.plainKey).toMatch(/^jb_/);
    expect(res.body.data.prefix).toBe(res.body.data.plainKey.slice(0, 8));
    expect(res.body.data.name).toBe('CI pipeline');
    expect(res.body.data.lastUsedAt).toBeNull();
  });

  it('never returns the stored key hash', async () => {
    const res = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Leak check'));

    // Regression: the create query used to return the bcrypt/sha256 `key` column.
    expect(res.body.data).not.toHaveProperty('key');

    // The plaintext is returned once, on creation. Its hash must never appear.
    const hash = createHash('sha256').update(res.body.data.plainKey as string).digest('hex');
    expect(JSON.stringify(res.body)).not.toContain(hash);
  });

  it('never returns the hash in the list endpoint', async () => {
    await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Listed'));

    const res = await api.get(`${API}/api-keys`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).not.toHaveProperty('key');
    expect(res.body.data[0]).not.toHaveProperty('plainKey');
  });

  it('rejects an unauthenticated request', async () => {
    const res = await api.post(`${API}/api-keys`).send(newKey('Nope'));
    expect(res.status).toBe(401);
  });

  it('orders keys newest first', async () => {
    await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('First'));
    await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Second'));

    const res = await api.get(`${API}/api-keys`).set(auth(user));
    expect(res.body.data.map((k: { name: string }) => k.name)).toEqual(['Second', 'First']);
  });
});

describe('API key authentication', () => {
  it('authenticates with x-api-key plus x-org-id', async () => {
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Auth'));
    const plainKey = created.body.data.plainKey as string;

    const res = await api
      .get(`${API}/users/me`)
      .set({ 'x-api-key': plainKey, 'x-org-id': user.organizationId });
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.userId);
  });

  it('rejects an api key without x-org-id', async () => {
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('No org'));
    const plainKey = created.body.data.plainKey as string;

    const res = await api.get(`${API}/users/me`).set({ 'x-api-key': plainKey });
    expect(res.status).toBe(401);
  });

  it('rejects an api key for an organization the user does not belong to', async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Wrong org'));
    const plainKey = created.body.data.plainKey as string;

    const res = await api.get(`${API}/users/me`).set({ 'x-api-key': plainKey, 'x-org-id': other.organizationId });
    // 401 (not 403) so the response does not confirm that the org exists.
    expect(res.status).toBe(401);
  });

  it('rejects a forged api key', async () => {
    const res = await api
      .get(`${API}/users/me`)
      .set({ 'x-api-key': 'jb_totally_made_up', 'x-org-id': user.organizationId });
    expect(res.status).toBe(401);
  });

  it('updates lastUsedAt on use', async () => {
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Usage'));
    const plainKey = created.body.data.plainKey as string;

    await api.get(`${API}/users/me`).set({ 'x-api-key': plainKey, 'x-org-id': user.organizationId });

    const list = await api.get(`${API}/api-keys`).set(auth(user));
    expect(list.body.data[0].lastUsedAt).not.toBeNull();
  });
});

describe('DELETE /api-keys/:apiKeyId', () => {
  it('revokes the key and stops authenticating with it', async () => {
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Revoke'));
    const id = created.body.data.id as string;
    const plainKey = created.body.data.plainKey as string;

    const del = await api.delete(`${API}/api-keys/${id}`).set(auth(user));
    expect(del.status).toBe(200);

    const list = await api.get(`${API}/api-keys`).set(auth(user));
    expect(list.body.data).toHaveLength(0);

    const use = await api
      .get(`${API}/users/me`)
      .set({ 'x-api-key': plainKey, 'x-org-id': user.organizationId });
    expect(use.status).toBe(401);
  });

  it('404s when revoking an already-revoked key', async () => {
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Twice'));
    const id = created.body.data.id as string;

    await api.delete(`${API}/api-keys/${id}`).set(auth(user));
    const second = await api.delete(`${API}/api-keys/${id}`).set(auth(user));
    expect(second.status).toBe(404);
    expect(second.body.error.code).toBe('NOT_FOUND');
  });

  it("does not let a user revoke another user's key", async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const mine = await api.post(`${API}/api-keys`).set(auth(user)).send(newKey('Mine'));
    const id = mine.body.data.id as string;

    const res = await api.delete(`${API}/api-keys/${id}`).set(auth(other));
    expect(res.status).toBe(404);

    const list = await api.get(`${API}/api-keys`).set(auth(user));
    expect(list.body.data).toHaveLength(1);
  });

  it("does not expose another user's keys in the list", async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    await api.post(`${API}/api-keys`).set(auth(other)).send(newKey('Theirs'));

    const res = await api.get(`${API}/api-keys`).set(auth(user));
    expect(res.body.data).toHaveLength(0);
  });
});

import { auth, createTestUser, request, resetDatabase, teardownDatabase } from '../../fixtures/testApp';

/**
 * Audit-log pagination:
 *  - the controller parsed `Number(req.query.pageSize)` with no upper bound, so
 *    `?pageSize=1000000` exported an entire tenant's audit trail (with its user
 *    joins) in one response
 *  - a request inside the limit still returns the standard envelope
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let owner: Awaited<ReturnType<typeof createTestUser>>;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  owner = await createTestUser(api);
});

afterAll(async () => {
  await teardownDatabase();
});

describe('GET /organizations/:id/audit-logs pagination', () => {
  it('caps pageSize instead of exporting the whole trail', async () => {
    const res = await api
      .get(`${API}/organizations/${owner.organizationId}/audit-logs?pageSize=1000000`)
      .set(auth(owner));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a page within the limit', async () => {
    const res = await api
      .get(`${API}/organizations/${owner.organizationId}/audit-logs?page=1&pageSize=50`)
      .set(auth(owner));

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data.pageSize).toBe(50);
  });
});

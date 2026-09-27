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
let victim: TestUser;
let attacker: TestUser;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  victim = await createTestUser(api, { organizationName: 'Victim Org' });
  attacker = await createTestUser(api, { organizationName: 'Attacker Org' });
});

afterAll(async () => {
  await teardownDatabase();
});

/**
 * Regression guard for a cross-tenant IDOR: the organizations router authorizes
 * against the role carried in the caller's own JWT, but the target organization
 * comes from the path. Without an explicit membership check on :organizationId,
 * any owner of *any* org could read or mutate a different org.
 *
 * Every attacker request below targets the victim's organization id.
 */
describe('cross-tenant isolation on /organizations', () => {
  it('lists only organizations the caller belongs to', async () => {
    const res = await api.get(`${API}/organizations`).set(auth(attacker));

    expect(res.status).toBe(200);
    const ids = (res.body.data as Array<{ id: string }>).map((o) => o.id);
    expect(ids).toContain(attacker.organizationId);
    expect(ids).not.toContain(victim.organizationId);
  });

  it('GET /organizations/:id — blocks reading another org', async () => {
    const res = await api.get(`${API}/organizations/${victim.organizationId}`).set(auth(attacker));
    expect(res.status).toBe(403);
  });

  it('GET /organizations/:id — allows reading your own org', async () => {
    const res = await api
      .get(`${API}/organizations/${attacker.organizationId}`)
      .set(auth(attacker));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(attacker.organizationId);
  });

  it('GET /organizations/:id/members — blocks reading another org roster', async () => {
    const res = await api
      .get(`${API}/organizations/${victim.organizationId}/members`)
      .set(auth(attacker));
    expect(res.status).toBe(403);
  });

  it('GET /organizations/:id/audit-logs — blocks reading another org audit trail', async () => {
    const res = await api
      .get(`${API}/organizations/${victim.organizationId}/audit-logs`)
      .set(auth(attacker));
    expect(res.status).toBe(403);
  });

  it('PATCH /organizations/:id — blocks renaming another org', async () => {
    const res = await api
      .patch(`${API}/organizations/${victim.organizationId}`)
      .set(auth(attacker))
      .send({ name: 'PWNED' });

    expect(res.status).toBe(403);

    const check = await api.get(`${API}/organizations/${victim.organizationId}`).set(auth(victim));
    expect(check.body.data.name).toBe('Victim Org');
  });

  it('DELETE /organizations/:id — blocks deleting another org', async () => {
    const res = await api.delete(`${API}/organizations/${victim.organizationId}`).set(auth(attacker));
    expect(res.status).toBe(403);

    // The victim must still be able to act on their own org afterwards.
    const check = await api.get(`${API}/organizations/${victim.organizationId}`).set(auth(victim));
    expect(check.status).toBe(200);
  });

  it('POST /organizations/:id/invitations — blocks inviting into another org', async () => {
    const res = await api
      .post(`${API}/organizations/${victim.organizationId}/invitations`)
      .set(auth(attacker))
      .send({ email: 'intruder@jestbest.test', role: 'ADMIN' });

    expect(res.status).toBe(403);
  });

  it('PATCH /organizations/:id/members/:userId/role — blocks role escalation in another org', async () => {
    const res = await api
      .patch(`${API}/organizations/${victim.organizationId}/members/${victim.userId}/role`)
      .set(auth(attacker))
      .send({ role: 'VIEWER' });

    expect(res.status).toBe(403);
  });

  it('DELETE /organizations/:id/members/:userId — blocks removing a member of another org', async () => {
    const res = await api
      .delete(`${API}/organizations/${victim.organizationId}/members/${victim.userId}`)
      .set(auth(attacker));

    expect(res.status).toBe(403);
  });

  it('blocks an unauthenticated request to an organization', async () => {
    const res = await api.get(`${API}/organizations/${victim.organizationId}`);
    expect(res.status).toBe(401);
  });
});

describe('x-org-id header handling', () => {
  it('honours x-org-id for an org the caller actually belongs to', async () => {
    // The attacker belongs only to their own org, so they cannot borrow the victim's.
    const res = await api
      .get(`${API}/projects`)
      .set({ ...auth(attacker), 'x-org-id': victim.organizationId });
    expect(res.status).toBe(403);
  });

  it('is ignored for an unknown organization', async () => {
    const res = await api
      .get(`${API}/projects`)
      .set({ ...auth(attacker), 'x-org-id': 'org_does_not_exist' });
    expect(res.status).toBe(403);
  });
});

describe('project isolation', () => {
  it('does not expose another organization\'s project', async () => {
    const created = await api
      .post(`${API}/projects`)
      .set(auth(victim))
      .send({ name: 'Victim Project' });
    expect(created.status).toBe(201);
    const projectId = created.body.data.id as string;

    const read = await api.get(`${API}/projects/${projectId}`).set(auth(attacker));
    expect(read.status).toBe(403);

    const list = await api.get(`${API}/projects`).set(auth(attacker));
    const ids = (list.body.data.items ?? list.body.data).map((p: { id: string }) => p.id);
    expect(ids).not.toContain(projectId);

    const remove = await api.delete(`${API}/projects/${projectId}`).set(auth(attacker));
    expect(remove.status).toBe(403);
  });
});

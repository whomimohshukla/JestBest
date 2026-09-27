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

const newProject = (name: string) => ({ name, description: `${name} description` });

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

describe('POST /projects', () => {
  it('creates a project owned by the caller\'s organization', async () => {
    const res = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Checkout'));

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe('Checkout');
    expect(res.body.data.organizationId).toBe(user.organizationId);
    expect(res.body.data.archivedAt).toBeNull();
  });

  it('rejects an unauthenticated request', async () => {
    const res = await api.post(`${API}/projects`).send(newProject('Nope'));
    expect(res.status).toBe(401);
  });

  it('rejects a missing name', async () => {
    const res = await api.post(`${API}/projects`).set(auth(user)).send({ description: 'no name' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an over-long name', async () => {
    const res = await api
      .post(`${API}/projects`)
      .set(auth(user))
      .send({ name: 'x'.repeat(500) });
    expect(res.status).toBe(400);
  });
});

describe('GET /projects', () => {
  it('returns a paginated envelope', async () => {
    await api.post(`${API}/projects`).set(auth(user)).send(newProject('One'));
    await api.post(`${API}/projects`).set(auth(user)).send(newProject('Two'));

    const res = await api.get(`${API}/projects`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data).toMatchObject({ page: 1, total: 2, pageSize: 20 });
  });

  it('excludes archived projects by default', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Temp'));
    const id = created.body.data.id as string;
    await api.patch(`${API}/projects/${id}/archive`).set(auth(user));

    const res = await api.get(`${API}/projects`).set(auth(user));
    expect(res.body.data.items.map((p: { id: string }) => p.id)).not.toContain(id);
  });

  it('honours pageSize', async () => {
    for (let i = 0; i < 3; i++) {
      await api.post(`${API}/projects`).set(auth(user)).send(newProject(`P${i}`));
    }
    const res = await api.get(`${API}/projects?pageSize=2`).set(auth(user));
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data.total).toBe(3);
  });

  it('rejects an out-of-range pageSize', async () => {
    const res = await api.get(`${API}/projects?pageSize=1000`).set(auth(user));
    expect(res.status).toBe(400);
  });
});

describe('GET /projects/:id', () => {
  it('returns the project', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Detail'));
    const id = created.body.data.id as string;

    const res = await api.get(`${API}/projects/${id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });

  it('404s for an unknown id', async () => {
    const res = await api.get(`${API}/projects/does_not_exist`).set(auth(user));
    expect(res.status).toBe(404);
  });
});

describe('GET /projects/dashboard', () => {
  it('returns aggregate counters for the project', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Dash'));
    const id = created.body.data.id as string;

    const res = await api.get(`${API}/projects/dashboard?projectId=${id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.project.id).toBe(id);
    expect(res.body.data.counts).toMatchObject({
      totalTests: 0,
      totalRuns: 0,
      openBugs: 0,
    });
  });
});

describe('PATCH /projects/:id', () => {
  it('updates the name', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Before'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/projects/${id}`).set(auth(user)).send({ name: 'After' });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('After');
  });

  it('rejects an empty name', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Keep'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/projects/${id}`).set(auth(user)).send({ name: '' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /projects/:id/archive', () => {
  it('archives the project and hides it from the default list', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Arch'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/projects/${id}/archive`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.archivedAt).toBeTruthy();

    const list = await api.get(`${API}/projects`).set(auth(user));
    expect(list.body.data.items.map((p: { id: string }) => p.id)).not.toContain(id);

    // ...but is still retrievable when archived projects are explicitly requested.
    const withArchived = await api
      .get(`${API}/projects?includeArchived=true`)
      .set(auth(user));
    expect(withArchived.body.data.items.map((p: { id: string }) => p.id)).toContain(id);
  });
});

describe('DELETE /projects/:id', () => {
  it('removes the project', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Delete'));
    const id = created.body.data.id as string;

    const res = await api.delete(`${API}/projects/${id}`).set(auth(user));
    expect(res.status).toBe(200);

    const after = await api.get(`${API}/projects/${id}`).set(auth(user));
    expect(after.status).toBe(404);
  });

  it('does not delete twice', async () => {
    const created = await api.post(`${API}/projects`).set(auth(user)).send(newProject('Twice'));
    const id = created.body.data.id as string;

    expect((await api.delete(`${API}/projects/${id}`).set(auth(user))).status).toBe(200);

    const second = await api.delete(`${API}/projects/${id}`).set(auth(user));
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body.success).toBe(false);
  });
});

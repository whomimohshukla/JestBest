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
let projectId: string;

const newBug = (title: string) => ({
  projectId,
  title,
  description: `${title} description`,
  severity: 'HIGH' as const,
  priority: 'P1' as const,
  rootCause: 'Off-by-one in pagination',
  reproductionSteps: ['Open /projects', 'Click next page'],
  expectedBehavior: 'Page 2 loads',
  actualBehavior: 'Page 1 loads again',
});

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);
  const project = await api.post(`${API}/projects`).set(auth(user)).send({ name: 'Bug Project' });
  projectId = project.body.data.id as string;
});

afterAll(async () => {
  await teardownDatabase();
});

describe('POST /bugs', () => {
  it('creates a bug and applies schema defaults', async () => {
    const res = await api.post(`${API}/bugs`).set(auth(user)).send({ projectId, title: 'Crash' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Crash');
    expect(res.body.data.status).toBe('OPEN');
    expect(res.body.data.severity).toBe('MEDIUM');
    expect(res.body.data.priority).toBe('P2');
  });

  it('persists the full defect report', async () => {
    const res = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Pagination bug'));
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ severity: 'HIGH', priority: 'P1' });
    expect(res.body.data.reproductionSteps).toHaveLength(2);
    expect(res.body.data.rootCause).toBe('Off-by-one in pagination');
  });

  it('rejects a missing title', async () => {
    const res = await api.post(`${API}/bugs`).set(auth(user)).send({ projectId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('refuses to file a bug against another organization\'s project', async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const foreign = await api
      .post(`${API}/projects`)
      .set(auth(other))
      .send({ name: 'Foreign' });

    const res = await api
      .post(`${API}/bugs`)
      .set(auth(user))
      .send({ projectId: foreign.body.data.id, title: 'Sneaky' });
    expect(res.status).toBe(403);
  });
});

describe('GET /bugs', () => {
  it('lists bugs in a pagination envelope', async () => {
    await api.post(`${API}/bugs`).set(auth(user)).send(newBug('One'));
    await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Two'));

    const res = await api.get(`${API}/bugs`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data).toMatchObject({ total: 2, page: 1 });
  });

  it('filters by status', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Closed me'));
    await api
      .patch(`${API}/bugs/${created.body.data.id}/status`)
      .set(auth(user))
      .send({ status: 'CLOSED' });

    const open = await api.get(`${API}/bugs?status=OPEN`).set(auth(user));
    expect(open.body.data.items).toHaveLength(0);

    const closed = await api.get(`${API}/bugs?status=CLOSED`).set(auth(user));
    expect(closed.body.data.items).toHaveLength(1);
  });

  it('filters by severity', async () => {
    await api.post(`${API}/bugs`).set(auth(user)).send(newBug('High one'));
    await api
      .post(`${API}/bugs`)
      .set(auth(user))
      .send({ projectId, title: 'Low one', severity: 'LOW' });

    const res = await api.get(`${API}/bugs?severity=HIGH`).set(auth(user));
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].severity).toBe('HIGH');
  });

  it('rejects an unknown status filter', async () => {
    const res = await api.get(`${API}/bugs?status=NOPE`).set(auth(user));
    expect(res.status).toBe(400);
  });

  it('does not leak bugs from another organization', async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const foreign = await api.post(`${API}/projects`).set(auth(other)).send({ name: 'Foreign' });
    await api
      .post(`${API}/bugs`)
      .set(auth(other))
      .send({ projectId: foreign.body.data.id, title: 'Private bug' });

    const res = await api.get(`${API}/bugs`).set(auth(user));
    expect(res.body.data.total).toBe(0);
  });
});

describe('GET /bugs/:bugId', () => {
  it('returns the bug', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Detail'));
    const id = created.body.data.id as string;

    const res = await api.get(`${API}/bugs/${id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});

describe('PATCH /bugs/:bugId', () => {
  it('updates triage fields but not status', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Triage'));
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/bugs/${id}`)
      .set(auth(user))
      .send({ title: 'Retitled', priority: 'P0', severity: 'CRITICAL' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'Retitled', priority: 'P0', severity: 'CRITICAL' });
    expect(res.body.data.status).toBe('OPEN');
  });
});

describe('PATCH /bugs/:bugId/status', () => {
  it('transitions the bug status', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Status flow'));
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/bugs/${id}/status`)
      .set(auth(user))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('IN_PROGRESS');
  });

  it('rejects an unknown status', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Bad status'));
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/bugs/${id}/status`)
      .set(auth(user))
      .send({ status: 'NOT_A_STATUS' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /bugs/:bugId/assignee', () => {
  it('assigns the bug to a member of the organization', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Assign'));
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/bugs/${id}/assignee`)
      .set(auth(user))
      .send({ assigneeId: user.userId });
    expect(res.status).toBe(200);
    expect(res.body.data.assigneeId).toBe(user.userId);
  });

  it('rejects an assignee outside the organization', async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Bad assign'));
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/bugs/${id}/assignee`)
      .set(auth(user))
      .send({ assigneeId: other.userId });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

describe('bug comments', () => {
  it('adds and lists comments', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Discuss'));
    const id = created.body.data.id as string;

    const add = await api
      .post(`${API}/bugs/${id}/comments`)
      .set(auth(user))
      .send({ content: 'Reproduced on staging.' });
    expect(add.status).toBe(201);

    const list = await api.get(`${API}/bugs/${id}/comments`).set(auth(user));
    expect(list.status).toBe(200);
    const items = Array.isArray(list.body.data) ? list.body.data : list.body.data.items;
    expect(items).toHaveLength(1);
    expect(items[0].content).toBe('Reproduced on staging.');
  });

  it('rejects an empty comment', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Empty'));
    const id = created.body.data.id as string;

    const res = await api
      .post(`${API}/bugs/${id}/comments`)
      .set(auth(user))
      .send({ content: '' });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /bugs/:bugId', () => {
  it('removes the bug', async () => {
    const created = await api.post(`${API}/bugs`).set(auth(user)).send(newBug('Delete'));
    const id = created.body.data.id as string;

    expect((await api.delete(`${API}/bugs/${id}`).set(auth(user))).status).toBe(200);
    expect((await api.get(`${API}/bugs/${id}`).set(auth(user))).status).toBe(404);
  });
});

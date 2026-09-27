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

const newCase = (title: string) => ({
  projectId,
  title,
  description: `${title} description`,
  type: 'FUNCTIONAL' as const,
  priority: 'high' as const,
  steps: [
    { action: 'goto' as const, value: '/' },
    { action: 'click' as const, selector: '#submit' },
  ],
  expectedResult: 'Form submits',
  tags: ['smoke'],
});

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);
  const project = await api.post(`${API}/projects`).set(auth(user)).send({ name: 'Test Project' });
  projectId = project.body.data.id as string;
});

afterAll(async () => {
  await teardownDatabase();
});

describe('POST /test-cases', () => {
  it('creates a test case and applies schema defaults', async () => {
    const res = await api
      .post(`${API}/test-cases`)
      .set(auth(user))
      .send({ projectId, title: 'Login works' });

    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Login works');
    expect(res.body.data.priority).toBe('medium');
    expect(res.body.data.type).toBe('FUNCTIONAL');
    expect(res.body.data.steps).toEqual([]);
  });

  it('persists steps, tags and the expected result', async () => {
    const res = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Checkout flow'));
    expect(res.status).toBe(201);
    expect(res.body.data.steps).toHaveLength(2);
    expect(res.body.data.steps[0]).toMatchObject({ action: 'goto', value: '/' });
    expect(res.body.data.tags).toEqual(['smoke']);
    expect(res.body.data.expectedResult).toBe('Form submits');
  });

  it('rejects a missing title', async () => {
    const res = await api.post(`${API}/test-cases`).set(auth(user)).send({ projectId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown step action', async () => {
    const res = await api
      .post(`${API}/test-cases`)
      .set(auth(user))
      .send({ projectId, title: 'Bad step', steps: [{ action: 'teleport' }] });
    expect(res.status).toBe(400);
  });

  it('refuses to attach a test case to a project in another organization', async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const otherProject = await api
      .post(`${API}/projects`)
      .set(auth(other))
      .send({ name: 'Foreign Project' });

    const res = await api
      .post(`${API}/test-cases`)
      .set(auth(user))
      .send({ projectId: otherProject.body.data.id, title: 'Sneaky' });
    expect(res.status).toBe(403);
  });
});

describe('GET /test-cases', () => {
  it('lists the organization\'s test cases in a pagination envelope', async () => {
    await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('A'));
    await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('B'));

    const res = await api.get(`${API}/test-cases`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(2);
    expect(res.body.data).toMatchObject({ total: 2, page: 1 });
  });

  it('filters by projectId', async () => {
    const second = await api.post(`${API}/projects`).set(auth(user)).send({ name: 'Second' });
    const secondId = second.body.data.id as string;

    await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('In first'));
    await api
      .post(`${API}/test-cases`)
      .set(auth(user))
      .send({ ...newCase('In second'), projectId: secondId });

    const res = await api.get(`${API}/test-cases?projectId=${secondId}`).set(auth(user));
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].title).toBe('In second');
  });

  it('filters by type', async () => {
    await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Functional'));
    await api
      .post(`${API}/test-cases`)
      .set(auth(user))
      .send({ projectId, title: 'Negative', type: 'NEGATIVE' });

    const res = await api.get(`${API}/test-cases?type=NEGATIVE`).set(auth(user));
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].type).toBe('NEGATIVE');
  });

  it('rejects a non-numeric page', async () => {
    const res = await api.get(`${API}/test-cases?page=abc`).set(auth(user));
    expect(res.status).toBe(400);
  });
});

describe('GET /test-cases/:testCaseId', () => {
  it('returns the test case', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Detail'));
    const id = created.body.data.id as string;

    const res = await api.get(`${API}/test-cases/${id}`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(id);
  });
});

describe('PATCH /test-cases/:testCaseId', () => {
  it('updates title, status and priority', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Before'));
    const id = created.body.data.id as string;

    const res = await api
      .patch(`${API}/test-cases/${id}`)
      .set(auth(user))
      .send({ title: 'After', status: 'active', priority: 'low' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ title: 'After', status: 'active', priority: 'low' });
  });

  it('rejects an empty title', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Keep'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/test-cases/${id}`).set(auth(user)).send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty steps array on update', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Steps'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/test-cases/${id}`).set(auth(user)).send({ steps: [] });
    expect(res.status).toBe(400);
  });

  it('keeps the path parameter when validating body and params together', async () => {
    // Regression: params validation used to replace req.params with the Zod output,
    // which stripped undeclared keys and made every :testCaseId route 400.
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Params'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/test-cases/${id}`).set(auth(user)).send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Renamed');
  });
});

describe('POST /test-cases/:testCaseId/duplicate', () => {
  it('creates a copy with a distinct id', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Original'));
    const id = created.body.data.id as string;

    const res = await api.post(`${API}/test-cases/${id}/duplicate`).set(auth(user));
    expect(res.status).toBe(201);
    expect(res.body.data.id).not.toBe(id);
    expect(res.body.data.steps).toHaveLength(2);
  });
});

describe('PATCH /test-cases/:testCaseId/archive', () => {
  it('archives the test case', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Archive'));
    const id = created.body.data.id as string;

    const res = await api.patch(`${API}/test-cases/${id}/archive`).set(auth(user));
    expect(res.status).toBe(200);
    expect(res.body.data.archivedAt).toBeTruthy();
  });
});

describe('DELETE /test-cases/:testCaseId', () => {
  it('removes the test case', async () => {
    const created = await api.post(`${API}/test-cases`).set(auth(user)).send(newCase('Delete'));
    const id = created.body.data.id as string;

    expect((await api.delete(`${API}/test-cases/${id}`).set(auth(user))).status).toBe(200);
    expect((await api.get(`${API}/test-cases/${id}`).set(auth(user))).status).toBe(404);
  });
});

describe('POST /test-cases/generate', () => {
  it('enqueues an AI generation job instead of generating inline', async () => {
    const app = await api
      .post(`${API}/applications`)
      .set(auth(user))
      .send({ projectId, name: 'Web App', baseUrl: 'https://example.test' });
    const applicationId = app.body.data.id as string;

    const res = await api
      .post(`${API}/test-cases/generate`)
      .set(auth(user))
      .send({ applicationId, projectId, count: 3, requirements: 'login and logout' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ queued: true });
  });

  it('rejects generation for a project in another organization', async () => {
    const other = await createTestUser(api, { organizationName: 'Other Org' });
    const otherProject = await api
      .post(`${API}/projects`)
      .set(auth(other))
      .send({ name: 'Foreign Project' });
    const foreignId = otherProject.body.data.id as string;

    const res = await api
      .post(`${API}/test-cases/generate`)
      .set(auth(user))
      .send({ applicationId: 'app_whatever', projectId: foreignId });
    expect(res.status).toBe(403);
  });

  it('rejects a count above the cap', async () => {
    const app = await api
      .post(`${API}/applications`)
      .set(auth(user))
      .send({ projectId, name: 'Web App', baseUrl: 'https://example.test' });

    const res = await api
      .post(`${API}/test-cases/generate`)
      .set(auth(user))
      .send({ applicationId: app.body.data.id, projectId, count: 500 });
    expect(res.status).toBe(400);
  });
});

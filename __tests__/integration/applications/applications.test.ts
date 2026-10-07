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
 * Scan status polling.
 *
 * `POST /applications/:id/scan` runs asynchronously, so without this endpoint
 * a client had no way to learn when its scan finished.
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;
let applicationId: string;
let scanId: string;

const createApplication = async (owner: TestUser, name: string): Promise<string> => {
  const project = await api
    .post(`${API}/projects`)
    .set(auth(owner))
    .send({ name: `${name} Project` });
  const created = await api.post(`${API}/applications`).set(auth(owner)).send({
    projectId: project.body.data.id,
    name,
    baseUrl: 'https://example.com',
  });
  expect(created.status).toBe(201);
  return created.body.data.id as string;
};

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);
  applicationId = await createApplication(user, 'Scan App');

  const scan = await prisma.applicationScan.create({
    data: { applicationId, pagesDiscovered: 7, componentsDiscovered: 3 },
  });
  scanId = scan.id;
});

afterAll(async () => {
  await teardownDatabase();
});

describe('application scan status', () => {
  it('returns the scan for the owning organization', async () => {
    const response = await api.get(`${API}/applications/${applicationId}/scan/${scanId}`).set(auth(user));

    expect(response.status).toBe(200);
    expect(response.body.data.id).toBe(scanId);
    expect(response.body.data.pagesDiscovered).toBe(7);
  });

  it('requires authentication', async () => {
    const response = await api.get(`${API}/applications/${applicationId}/scan/${scanId}`);
    expect(response.status).toBe(401);
  });

  it("refuses a scan lookup for another organization's application", async () => {
    const outsider = await createTestUser(api, { organizationName: 'Other Org' });

    const response = await api.get(`${API}/applications/${applicationId}/scan/${scanId}`).set(auth(outsider));

    expect(response.status).toBe(403);
  });

  it('rejects a scan that belongs to a different application', async () => {
    const otherAppId = await createApplication(user, 'Other App');
    const otherScan = await prisma.applicationScan.create({ data: { applicationId: otherAppId } });

    const response = await api
      .get(`${API}/applications/${applicationId}/scan/${otherScan.id}`)
      .set(auth(user));

    expect(response.status).toBe(404);
  });

  it('returns 404 for an unknown scan id', async () => {
    const response = await api
      .get(`${API}/applications/${applicationId}/scan/does-not-exist`)
      .set(auth(user));

    expect(response.status).toBe(404);
  });
});

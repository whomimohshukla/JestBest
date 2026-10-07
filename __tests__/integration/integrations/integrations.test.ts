import { prisma } from '../../../src/config/database';
import { integrationRepository } from '../../../src/repositories/integration.repository';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

/**
 * Integration tenancy + GitHub scoping:
 *  - an integration cannot be attached to another org's project
 *  - GitHub resolution prefers the bug's own project over an org-wide default
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;
let projectId: string;

const githubPayload = {
  type: 'GITHUB' as const,
  config: { token: 'gh-token-a', repository: 'acme/app-a' },
};

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
  user = await createTestUser(api);
  const project = await api.post(`${API}/projects`).set(auth(user)).send({ name: 'Integration Project' });
  projectId = project.body.data.id as string;
});

afterAll(async () => {
  await teardownDatabase();
});

describe('integration tenancy', () => {
  it('connects an integration to a project in the same organization', async () => {
    const response = await api
      .post(`${API}/integrations`)
      .set(auth(user))
      .send({ ...githubPayload, projectId });

    expect(response.status).toBe(201);
    expect(response.body.data.projectId).toBe(projectId);
  });

  it("refuses to attach an integration to another organization's project", async () => {
    const outsider = await createTestUser(api, { organizationName: 'Other Org' });

    const response = await api
      .post(`${API}/integrations`)
      .set(auth(outsider))
      .send({ ...githubPayload, projectId });

    expect(response.status).toBe(403);
    expect(response.body.error.message).toMatch(/not found|forbidden/i);

    // And nothing leaked into the victim org.
    const victimIntegrations = await prisma.integration.count({
      where: { projectId, organizationId: user.organizationId },
    });
    expect(victimIntegrations).toBe(0);
  });
});

describe('GitHub integration resolution per project', () => {
  const seedGithub = (organizationId: string, forProject: string | null, repository: string) =>
    prisma.integration.create({
      data: {
        organizationId,
        projectId: forProject,
        type: 'GITHUB',
        isActive: true,
        config: { token: `gh-${repository}`, repository },
      } as never,
    });

  it('prefers the project-scoped integration over the org-wide default', async () => {
    const orgWide = await seedGithub(user.organizationId, null, 'acme/default');
    const projectScoped = await seedGithub(user.organizationId, projectId, 'acme/specific');

    const resolved = await integrationRepository.findForProject(user.organizationId, 'GITHUB', projectId);

    expect(resolved?.id).toBe(projectScoped.id);
    expect(resolved?.id).not.toBe(orgWide.id);
  });

  it('falls back to the org-wide integration when the project has none', async () => {
    const orgWide = await seedGithub(user.organizationId, null, 'acme/default');

    const resolved = await integrationRepository.findForProject(user.organizationId, 'GITHUB', projectId);

    expect(resolved?.id).toBe(orgWide.id);
  });

  it('never resolves another organization’s integration', async () => {
    const outsider = await createTestUser(api, { organizationName: 'Other Org' });
    const foreign = await seedGithub(outsider.organizationId, projectId, 'acme/foreign');

    const resolved = await integrationRepository.findForProject(user.organizationId, 'GITHUB', projectId);

    expect(resolved?.id ?? null).not.toBe(foreign.id);
    expect(resolved).toBeNull();
  });

  it('ignores deactivated integrations', async () => {
    await prisma.integration.create({
      data: {
        organizationId: user.organizationId,
        projectId,
        type: 'GITHUB',
        isActive: false,
        config: { token: 'gh-off', repository: 'acme/off' },
      } as never,
    });

    const resolved = await integrationRepository.findForProject(user.organizationId, 'GITHUB', projectId);

    expect(resolved).toBeNull();
  });
});

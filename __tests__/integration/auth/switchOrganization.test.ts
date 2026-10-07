import { prisma } from '../../../src/config/database';
import { verifyToken } from '../../../src/utils/jwt';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TestUser,
} from '../../fixtures/testApp';

/**
 * POST /auth/switch-organization:
 *  - re-issues the token pair against a membership that is re-verified, which
 *    is what makes the orgId claim in the access token trustworthy
 *  - refuses organizations the caller does not belong to (or was removed
 *    from) instead of minting a token for them
 *  - rotates the presented refresh token so the previous workspace cannot be
 *    reached again by refreshing the old pair
 */

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;

const createOrganization = async (actor: TestUser, name: string): Promise<string> => {
  const res = await api.post(`${API}/organizations`).set(auth(actor)).send({ name });
  expect(res.status).toBe(201);
  return res.body.data.id as string;
};

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

describe('POST /auth/switch-organization', () => {
  it('issues a token pair scoped to the destination organization', async () => {
    const target = await createOrganization(user, 'Second Workspace');

    const res = await api
      .post(`${API}/auth/switch-organization`)
      .set(auth(user))
      .send({ organizationId: target, refreshToken: user.refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.data.organization.id).toBe(target);
    expect(res.body.data.user.id).toBe(user.userId);

    const payload = verifyToken(res.body.data.tokens.accessToken, 'access');
    expect(payload.orgId).toBe(target);
    expect(payload.sub).toBe(user.userId);
    expect(payload.roles).toEqual(['OWNER']);

    const refreshed = await api
      .post(`${API}/auth/refresh-token`)
      .send({ refreshToken: res.body.data.tokens.refreshToken });
    expect(refreshed.status).toBe(200);
  });

  it('revokes the refresh token the caller presented', async () => {
    const target = await createOrganization(user, 'Second Workspace');

    await api
      .post(`${API}/auth/switch-organization`)
      .set(auth(user))
      .send({ organizationId: target, refreshToken: user.refreshToken });

    const replay = await api.post(`${API}/auth/refresh-token`).send({ refreshToken: user.refreshToken });

    expect(replay.status).toBe(401);
  });

  it('refuses an organization the caller is not a member of', async () => {
    const stranger = await createTestUser(api);
    const foreign = await createOrganization(stranger, 'Stranger Workspace');

    const res = await api
      .post(`${API}/auth/switch-organization`)
      .set(auth(user))
      .send({ organizationId: foreign });

    expect(res.status).toBe(403);

    // No token was minted for a workspace the caller cannot read.
    const leaked = await prisma.membership.count({
      where: { organizationId: foreign, userId: user.userId },
    });
    expect(leaked).toBe(0);
  });

  it('refuses an organization whose membership was revoked', async () => {
    const target = await createOrganization(user, 'Second Workspace');
    await prisma.membership.updateMany({
      where: { organizationId: target, userId: user.userId },
      data: { deletedAt: new Date() },
    });

    const res = await api
      .post(`${API}/auth/switch-organization`)
      .set(auth(user))
      .send({ organizationId: target });

    expect(res.status).toBe(403);
  });

  it('records the switch in the destination organization audit trail', async () => {
    const target = await createOrganization(user, 'Second Workspace');

    await api
      .post(`${API}/auth/switch-organization`)
      .set(auth(user))
      .send({ organizationId: target, refreshToken: user.refreshToken });

    const entry = await prisma.auditLog.findFirst({
      where: { organizationId: target, userId: user.userId },
      orderBy: { createdAt: 'desc' },
    });
    expect(entry).not.toBeNull();
    expect(entry?.metadata).toMatchObject({
      action: 'auth.switch_organization',
      to: target,
    });
  });

  it('rejects an empty organization id', async () => {
    const res = await api
      .post(`${API}/auth/switch-organization`)
      .set(auth(user))
      .send({ organizationId: '' });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await api.post(`${API}/auth/switch-organization`).send({ organizationId: 'org_anything' });

    expect(res.status).toBe(401);
  });
});

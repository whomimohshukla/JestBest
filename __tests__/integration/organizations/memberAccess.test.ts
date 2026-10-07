import { prisma } from '../../../src/config/database';
import { roleHasPermission, canManageRole } from '../../../src/constants/roles';
import { Permissions } from '../../../src/constants/permissions';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  uniqueEmail,
  TEST_PASSWORD,
} from '../../fixtures/testApp';

/**
 * Member-list access:
 *  - reading the member list is permitted for every role, not just admins
 *  - mutating members still requires the manage permission
 *
 * `GET /organizations/:id/members` was gated behind ORG_MEMBER_MANAGE, so a
 * developer, tester or viewer got a 403 on a read-only page they are meant to
 * be able to open.
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

/** Create a real user in the owner's org with the given role. */
const addMember = async (role: 'VIEWER' | 'TESTER' | 'DEVELOPER' | 'QA_MANAGER' | 'ADMIN') => {
  const email = uniqueEmail(`member-${role}`);
  const registered = await api
    .post(`${API}/auth/register`)
    .send({ email, password: TEST_PASSWORD, organizationName: 'Temp Org' });
  const userId = registered.body.data.user.id as string;

  // Registration deliberately withholds a session until the address is
  // verified, so confirm it before logging in as this member.
  const verified = await api
    .post(`${API}/auth/verify-email`)
    .send({ token: registered.body.data.verificationToken as string });
  expect(verified.status).toBe(200);

  await prisma.membership.create({
    data: { organizationId: owner.organizationId, userId, role },
  });

  const login = await api.post(`${API}/auth/login`).send({ email, password: TEST_PASSWORD });
  if (login.status !== 200) {
    throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  }

  return {
    userId,
    organizationId: owner.organizationId,
    accessToken: login.body.data.tokens.accessToken as string,
    refreshToken: login.body.data.tokens.refreshToken as string,
    email,
    password: TEST_PASSWORD,
  };
};

describe('GET /organizations/:id/members', () => {
  const readers = ['VIEWER', 'TESTER', 'DEVELOPER', 'QA_MANAGER', 'ADMIN'] as const;

  it.each(readers)('allows a %s to read the member list', async (role) => {
    const member = await addMember(role);

    const res = await api.get(`${API}/organizations/${owner.organizationId}/members`).set(auth(member));

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.items ?? res.body.data)).toBe(true);
  });

  it('lets a VIEWER see the members but not change a role', async () => {
    const viewer = await addMember('VIEWER');
    const other = await addMember('TESTER');

    const list = await api.get(`${API}/organizations/${owner.organizationId}/members`).set(auth(viewer));
    expect(list.status).toBe(200);

    const promote = await api
      .patch(`${API}/organizations/${owner.organizationId}/members/${other.userId}/role`)
      .set(auth(viewer))
      .send({ role: 'ADMIN' });
    expect(promote.status).toBe(403);
  });

  it('lets a VIEWER not invite or remove members', async () => {
    const viewer = await addMember('VIEWER');

    const invite = await api
      .post(`${API}/organizations/${owner.organizationId}/invitations`)
      .set(auth(viewer))
      .send({ email: uniqueEmail('nope'), role: 'TESTER' });
    expect(invite.status).toBe(403);

    const remove = await api
      .delete(`${API}/organizations/${owner.organizationId}/members/${owner.userId}`)
      .set(auth(viewer));
    expect(remove.status).toBe(403);
  });

  it('still refuses a member of a different organization', async () => {
    const outsider = await createTestUser(api, { email: uniqueEmail('outsider') });

    const res = await api.get(`${API}/organizations/${owner.organizationId}/members`).set(auth(outsider));

    expect(res.status).toBe(403);
  });
});

describe('role permission matrix', () => {
  it('grants member read to every role', () => {
    for (const role of ['OWNER', 'ADMIN', 'QA_MANAGER', 'DEVELOPER', 'TESTER', 'VIEWER'] as const) {
      expect(roleHasPermission(role, Permissions.ORG_MEMBER_READ)).toBe(true);
    }
  });

  it('withholds member manage from the lower-privilege roles', () => {
    expect(roleHasPermission('OWNER', Permissions.ORG_MEMBER_MANAGE)).toBe(true);
    expect(roleHasPermission('ADMIN', Permissions.ORG_MEMBER_MANAGE)).toBe(true);
    expect(roleHasPermission('DEVELOPER', Permissions.ORG_MEMBER_MANAGE)).toBe(false);
    expect(roleHasPermission('TESTER', Permissions.ORG_MEMBER_MANAGE)).toBe(false);
    expect(roleHasPermission('VIEWER', Permissions.ORG_MEMBER_MANAGE)).toBe(false);
  });
});

describe('canManageRole hierarchy', () => {
  it('lets a higher role manage a lower one', () => {
    expect(canManageRole('OWNER', 'ADMIN')).toBe(true);
    expect(canManageRole('ADMIN', 'VIEWER')).toBe(true);
    expect(canManageRole('QA_MANAGER', 'VIEWER')).toBe(true);
  });

  it('does not let a role manage its own or a higher role', () => {
    // QA_MANAGER (60) ranks below ADMIN (80).
    expect(canManageRole('QA_MANAGER', 'ADMIN')).toBe(false);
    expect(canManageRole('ADMIN', 'OWNER')).toBe(false);
  });

  it('lets DEVELOPER manage TESTER, which ranks below it', () => {
    // Ranked deliberately: DEVELOPER 40 > TESTER 30.
    expect(canManageRole('DEVELOPER', 'TESTER')).toBe(true);
    expect(canManageRole('TESTER', 'DEVELOPER')).toBe(false);
  });

  it('never lets a role manage an equal rank', () => {
    expect(canManageRole('ADMIN', 'ADMIN')).toBe(false);
    expect(canManageRole('VIEWER', 'VIEWER')).toBe(false);
  });
});


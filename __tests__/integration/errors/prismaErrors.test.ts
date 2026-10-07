import { prisma } from '../../../src/config/database';
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
 * Prisma's driver errors are not Express errors: before they were mapped in
 * the error handler they escaped as raw 500s.
 *
 *  - P2002 (unique constraint) => 409 CONFLICT
 *  - P2025 (record not found on update/delete) => 404 NOT_FOUND
 *
 * The membership cases below are the two real paths that hit those constraints:
 * inviting an already-active member, and re-inviting a member who was removed
 * (the soft-deleted row still owns organizationId_userId).
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

/** Register a second user and verify the address, but do not add them yet. */
const registerMember = async () => {
  const email = uniqueEmail('invitee');
  const registered = await api
    .post(`${API}/auth/register`)
    .send({ email, password: TEST_PASSWORD, organizationName: 'Temp Org' });
  expect(registered.status).toBe(201);
  const verified = await api
    .post(`${API}/auth/verify-email`)
    .send({ token: registered.body.data.verificationToken as string });
  expect(verified.status).toBe(200);
  return { userId: registered.body.data.user.id as string, email };
};

const invite = (email: string) =>
  api
    .post(`${API}/organizations/${owner.organizationId}/invitations`)
    .set(auth(owner))
    .send({ email, role: 'TESTER' });

describe('P2002 unique-constraint violations return 409', () => {
  it('rejects a duplicate active invite', async () => {
    const { email } = await registerMember();

    expect((await invite(email)).status).toBe(201);
    const duplicate = await invite(email);

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.error.code).toBe('CONFLICT');
    expect(duplicate.body.error.message).toMatch(/already a member/i);
  });

  it('revives a removed member on re-invite instead of failing', async () => {
    const { userId, email } = await registerMember();
    expect((await invite(email)).status).toBe(201);

    const removed = await api
      .delete(`${API}/organizations/${owner.organizationId}/members/${userId}`)
      .set(auth(owner));
    expect(removed.status).toBe(200);

    // The row survives the removal, so this is exactly the insert that used to
    // collide on @@unique([organizationId, userId]).
    const softDeleted = await prisma.membership.findMany({
      where: { organizationId: owner.organizationId, userId },
    });
    expect(softDeleted).toHaveLength(1);
    expect(softDeleted[0]?.deletedAt).not.toBeNull();

    const again = await invite(email);
    expect(again.status).toBe(201);

    const rows = await prisma.membership.findMany({
      where: { organizationId: owner.organizationId, userId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.deletedAt).toBeNull();
    expect(rows[0]?.role).toBe('TESTER');

    const listed = await api.get(`${API}/organizations/${owner.organizationId}/members`).set(auth(owner));
    expect(listed.body.data.some((member: { userId: string }) => member.userId === userId)).toBe(true);
  });
});

describe('P2025 missing-record errors return 404', () => {
  it('maps deleting a non-existent suite item to 404', async () => {
    const project = await api.post(`${API}/projects`).set(auth(owner)).send({ name: 'P2025 Project' });
    expect(project.status).toBe(201);
    const suite = await api
      .post(`${API}/test-suites`)
      .set(auth(owner))
      .send({ projectId: project.body.data.id, name: 'Suite' });
    expect(suite.status).toBe(201);

    const res = await api
      .delete(`${API}/test-suites/${suite.body.data.id}/items/item_does_not_exist`)
      .set(auth(owner));

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toMatch(/not found/i);
  });
});

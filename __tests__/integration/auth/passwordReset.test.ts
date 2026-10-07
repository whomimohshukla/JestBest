import { tokenService } from '../../../src/services/auth/tokenService';
import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TEST_PASSWORD,
  TestUser,
} from '../../fixtures/testApp';

/**
 * Password reset hardening:
 *  - reset tokens are purpose-bound (a normal access token is rejected)
 *  - reset tokens are single-use (Redis GETDEL)
 *  - changing the password bumps a password version so previously issued
 *    access tokens stop working, while tokens minted afterwards keep working
 */

const API = '/api/v1';
const NEW_PASSWORD = 'BrandNewSecret456!';

let api: Awaited<ReturnType<typeof request>>;
let user: TestUser;

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

describe('password reset token hardening', () => {
  it('rejects an ordinary access token used as a reset token', async () => {
    const response = await api
      .post(`${API}/auth/reset-password`)
      .send({ token: user.accessToken, password: NEW_PASSWORD });

    expect(response.status).toBe(401);

    // The account must be untouched.
    const login = await api.post(`${API}/auth/login`).send({ email: user.email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
  });

  it('accepts a purpose-bound reset token and swaps the password', async () => {
    const token = await tokenService.issuePasswordResetToken(user.userId);

    const response = await api.post(`${API}/auth/reset-password`).send({ token, password: NEW_PASSWORD });
    expect(response.status).toBe(200);

    const oldPassword = await api
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: TEST_PASSWORD });
    expect(oldPassword.status).toBe(401);

    const newPassword = await api
      .post(`${API}/auth/login`)
      .send({ email: user.email, password: NEW_PASSWORD });
    expect(newPassword.status).toBe(200);
  });

  it('burns the reset token so it cannot be replayed', async () => {
    const token = await tokenService.issuePasswordResetToken(user.userId);

    const first = await api.post(`${API}/auth/reset-password`).send({ token, password: NEW_PASSWORD });
    expect(first.status).toBe(200);

    const replay = await api.post(`${API}/auth/reset-password`).send({ token, password: 'YetAnother789!' });
    expect(replay.status).toBe(401);
    expect(replay.body.error.message).toMatch(/already been used|expired/i);
  });

  it('invalidates access tokens issued before the password changed', async () => {
    const before = await api.get(`${API}/projects`).set(auth(user));
    expect(before.status).toBe(200);

    const token = await tokenService.issuePasswordResetToken(user.userId);
    const reset = await api.post(`${API}/auth/reset-password`).send({ token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    // The version bumped, so the pre-reset access token is now dead.
    const after = await api.get(`${API}/projects`).set(auth(user));
    expect(after.status).toBe(401);
    expect(after.body.error.message).toMatch(/no longer valid|session/i);
  });

  it('invalidates access tokens on an authenticated password change', async () => {
    const change = await api
      .post(`${API}/users/me/change-password`)
      .set(auth(user))
      .send({ currentPassword: TEST_PASSWORD, newPassword: NEW_PASSWORD });
    expect(change.status).toBe(200);

    const after = await api.get(`${API}/projects`).set(auth(user));
    expect(after.status).toBe(401);
  });

  it('keeps access tokens minted after the password change working', async () => {
    // The counterpart to the two tests above. Revoking by a timestamp is only
    // safe if it cannot also reject a token minted moments later, which is the
    // bug a second-granular `iat` comparison introduces.
    const token = await tokenService.issuePasswordResetToken(user.userId);
    const reset = await api.post(`${API}/auth/reset-password`).send({ token, password: NEW_PASSWORD });
    expect(reset.status).toBe(200);

    const login = await api.post(`${API}/auth/login`).send({ email: user.email, password: NEW_PASSWORD });
    expect(login.status).toBe(200);

    const fresh = login.body.data.tokens.accessToken as string;
    expect(fresh).toBeTruthy();

    const after = await api.get(`${API}/projects`).set({ Authorization: `Bearer ${fresh}` });
    expect(after.status).toBe(200);
  });
});

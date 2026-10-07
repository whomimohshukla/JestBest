import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  TEST_PASSWORD,
  uniqueEmail,
} from '../../fixtures/testApp';
import { tokenService } from '../../../src/services/auth/tokenService';
import { getRedis } from '../../../src/config/redis';

const API = '/api/v1';

let api: Awaited<ReturnType<typeof request>>;

beforeAll(async () => {
  api = await request();
});

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await teardownDatabase();
});

describe('POST /auth/oauth/exchange', () => {
  it('rejects a request with no exchange token', async () => {
    const res = await api.post(`${API}/auth/oauth/exchange`).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('rejects an arbitrary string as an exchange token', async () => {
    const res = await api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken: 'not-a-real-token' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('exchanges a valid token for a working session', async () => {
    const user = await createTestUser(api, { email: uniqueEmail('oauth-exchange') });
    const exchangeToken = await tokenService.issueOAuthExchangeToken({
      userId: user.userId,
      orgId: user.organizationId,
      roles: ['OWNER'],
    });

    const res = await api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.id).toBe(user.userId);
    expect(res.body.data.organization.id).toBe(user.organizationId);
    expect(res.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(res.body.data.tokens.refreshToken).toEqual(expect.any(String));

    // The returned access token must actually authenticate.
    const me = await api
      .get(`${API}/users/me`)
      .set(auth({ ...user, accessToken: res.body.data.tokens.accessToken }));
    expect(me.status).toBe(200);
    expect(me.body.data.id).toBe(user.userId);
    expect(me.body.data.email).toBe(user.email);
  });

  it('is single-use: a second redemption of the same token fails', async () => {
    const user = await createTestUser(api, { email: uniqueEmail('oauth-replay') });
    const exchangeToken = await tokenService.issueOAuthExchangeToken({
      userId: user.userId,
      orgId: user.organizationId,
      roles: ['OWNER'],
    });

    const first = await api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken });
    expect(first.status).toBe(200);

    const second = await api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken });
    expect(second.status).toBe(401);
  });

  it('does not let two concurrent redemptions both succeed', async () => {
    const user = await createTestUser(api, { email: uniqueEmail('oauth-race') });
    const exchangeToken = await tokenService.issueOAuthExchangeToken({
      userId: user.userId,
      orgId: user.organizationId,
      roles: ['OWNER'],
    });

    // This is the reason redemption uses GETDEL rather than GET then DEL.
    const [a, b] = await Promise.all([
      api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken }),
      api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken }),
    ]);

    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 401]);
  });

  it('cannot mint a session for a user that does not exist', async () => {
    const exchangeToken = await tokenService.issueOAuthExchangeToken({
      userId: 'cuid-does-not-exist',
      orgId: 'cuid-does-not-exist',
      roles: ['OWNER'],
    });

    const res = await api.post(`${API}/auth/oauth/exchange`).send({ exchangeToken });

    expect(res.status).toBe(401);
  });
});

describe('GET /auth/oauth/:provider/authorize', () => {
  it('refuses to start a flow for a provider that is not configured', async () => {
    const res = await api.get(`${API}/auth/oauth/gitee/authorize`);

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });

  it('issues a Google consent URL with a single-use state', async () => {
    // jest.setup.js configures GOOGLE_CLIENT_ID, so this exercises the real
    // route: state is minted and persisted in Redis, then returned.
    const res = await api.get(`${API}/auth/oauth/google/authorize`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const url = res.body.data.url as string;
    expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
    expect(url).toContain('client_id=google-test-client-id.apps.googleusercontent.com');
    expect(url).toContain('response_type=code');
    expect(url).toContain(`state=${res.body.data.state}`);

    // The state is stored for the callback (GETDEL) bound to this provider and
    // can be consumed exactly once.
    const state = res.body.data.state as string;
    const redemption = await getRedis().getdel(`oauth:state:${state}`);
    expect(redemption).toBe('google');
    expect(await getRedis().getdel(`oauth:state:${state}`)).toBeNull();
  });

  it('rejects github because no GITHUB_* secrets are configured in tests', async () => {
    const res = await api.get(`${API}/auth/oauth/github/authorize`);

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('not configured');
  });
});

describe('GET /auth/oauth/:provider/callback', () => {
  it('rejects a callback with no state parameter', async () => {
    const res = await api.get(`${API}/auth/oauth/github/callback?code=abc123`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('missing_state');
  });

  it('rejects a state this server never issued', async () => {
    // The check used to run only `if (state)`, so omitting the parameter
    // skipped CSRF protection entirely.
    const res = await api.get(
      `${API}/auth/oauth/github/callback?code=abc123&state=never-issued-by-this-server`
    );

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_state');
  });

  it('sends a browser back to the SPA with the failure instead of raw JSON', async () => {
    const res = await api
      .get(`${API}/auth/oauth/github/callback?code=abc123`)
      .set('Accept', 'text/html,application/xhtml+xml');

    expect(res.status).toBe(302);
    const location = res.headers.location ?? '';
    expect(location).toContain('/auth/oauth/callback?');
    expect(location).toContain('error=missing_state');
    expect(location).toContain('message=');
  });
});

describe('POST /auth/logout', () => {
  it('revokes the supplied refresh token so it cannot be reused', async () => {
    const email = uniqueEmail('logout');
    const user = await createTestUser(api, { email });

    const logout = await api
      .post(`${API}/auth/logout`)
      .set(auth(user))
      .send({ refreshToken: user.refreshToken });
    expect(logout.status).toBe(200);

    // The frontend used to send no refresh token, which left the session
    // alive server-side for the remainder of the 7-day refresh lifetime.
    const refresh = await api.post(`${API}/auth/refresh-token`).send({ refreshToken: user.refreshToken });
    expect(refresh.status).toBe(401);
  });
});

describe('registration password strength', () => {
  it('refuses a password under the 8 character minimum', async () => {
    const res = await api
      .post(`${API}/auth/register`)
      .send({ email: uniqueEmail('weak'), password: 'short12', organizationName: 'Weak Ltd' });

    expect(res.status).toBe(400);
  });

  it('accepts a password at exactly the minimum length', async () => {
    // 8 characters is the documented floor, and the frontend enforces the same
    // number, so it must not be rejected.
    const res = await api
      .post(`${API}/auth/register`)
      .send({ email: uniqueEmail('exactly8'), password: 'password', organizationName: 'Eight Ltd' });

    expect(res.status).toBe(201);
  });

  it('accepts the standard test password', async () => {
    const res = await api.post(`${API}/auth/register`).send({
      email: uniqueEmail('strong'),
      password: TEST_PASSWORD,
      organizationName: 'Strong Ltd',
    });

    expect(res.status).toBe(201);
  });
});

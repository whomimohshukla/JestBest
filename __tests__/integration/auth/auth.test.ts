import {
  auth,
  createTestUser,
  request,
  resetDatabase,
  teardownDatabase,
  uniqueEmail,
  TEST_PASSWORD,
} from '../../fixtures/testApp';

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

describe('POST /auth/register', () => {
  it('creates the user and their own organization, and requires email verification', async () => {
    const email = uniqueEmail('register');
    const res = await api.post(`${API}/auth/register`).send({
      email,
      password: TEST_PASSWORD,
      name: 'Ada',
      organizationName: 'Ada Labs',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(email);
    expect(res.body.data.user.emailVerified).toBe(false);
    expect(res.body.data.organization.name).toBe('Ada Labs');
    expect(res.body.data.organization.slug).toBe('ada-labs');
    expect(res.body.data.verificationRequired).toBe(true);
    expect(typeof res.body.data.verificationToken).toBe('string');
  });

  it('never returns a session before the email is verified', async () => {
    const res = await api
      .post(`${API}/auth/register`)
      .send({ email: uniqueEmail('noverify'), password: TEST_PASSWORD });

    expect(res.status).toBe(201);
    expect(res.body.data.tokens).toBeUndefined();
  });

  it('rejects a duplicate email', async () => {
    const email = uniqueEmail('dupe');
    const payload = { email, password: TEST_PASSWORD, name: 'First' };
    await api.post(`${API}/auth/register`).send(payload);
    const second = await api.post(`${API}/auth/register`).send(payload);

    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body.success).toBe(false);
  });

  it('rejects a weak password', async () => {
    const res = await api
      .post(`${API}/auth/register`)
      .send({ email: uniqueEmail('weak'), password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('gives a second org with the same name a unique slug', async () => {
    const first = await api
      .post(`${API}/auth/register`)
      .send({ email: uniqueEmail('a'), password: TEST_PASSWORD, organizationName: 'Shared Name' });
    const second = await api
      .post(`${API}/auth/register`)
      .send({ email: uniqueEmail('b'), password: TEST_PASSWORD, organizationName: 'Shared Name' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.organization.slug).not.toBe(first.body.data.organization.slug);
    expect(second.body.data.organization.slug).toBe('shared-name-1');
  });
});

describe('POST /auth/verify-email', () => {
  it('marks the account verified and unlocks login', async () => {
    const email = uniqueEmail('verify');
    const register = await api.post(`${API}/auth/register`).send({ email, password: TEST_PASSWORD });

    const blocked = await api.post(`${API}/auth/login`).send({ email, password: TEST_PASSWORD });
    expect(blocked.status).toBe(200);
    expect(blocked.body.data.verificationRequired).toBe(true);

    const verified = await api
      .post(`${API}/auth/verify-email`)
      .send({ token: register.body.data.verificationToken });
    expect(verified.status).toBe(200);

    const login = await api.post(`${API}/auth/login`).send({ email, password: TEST_PASSWORD });
    expect(login.status).toBe(200);
    expect(login.body.data.tokens.accessToken).toBeTruthy();
    expect(login.body.data.user.emailVerified).toBe(true);
  });

  it('rejects a bogus token', async () => {
    const res = await api.post(`${API}/auth/verify-email`).send({ token: 'garbage' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/login', () => {
  it('rejects a wrong password without revealing which field was wrong', async () => {
    const email = uniqueEmail('wrongpw');
    await createTestUser(api, { email });

    const res = await api.post(`${API}/auth/login`).send({ email, password: 'WrongPassword123!' });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('does not disclose whether an email exists', async () => {
    const res = await api
      .post(`${API}/auth/login`)
      .send({ email: uniqueEmail('ghost'), password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed email with a validation error', async () => {
    const res = await api.post(`${API}/auth/login`).send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /auth/refresh-token', () => {
  it('issues a fresh access token for a valid refresh token', async () => {
    const user = await createTestUser(api);
    const res = await api.post(`${API}/auth/refresh-token`).send({ refreshToken: user.refreshToken });

    expect(res.status).toBe(200);
    const tokens = res.body.data.tokens ?? res.body.data;
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.accessToken).not.toBe(user.accessToken);
  });

  it('rejects an access token used as a refresh token', async () => {
    const user = await createTestUser(api);
    const res = await api.post(`${API}/auth/refresh-token`).send({ refreshToken: user.accessToken });
    expect(res.status).toBe(401);
  });

  it('rejects a garbage refresh token', async () => {
    const res = await api.post(`${API}/auth/refresh-token`).send({ refreshToken: 'nope' });
    expect(res.status).toBe(401);
  });
});

describe('GET /users/me', () => {
  it('returns the authenticated profile', async () => {
    const user = await createTestUser(api);
    const res = await api.get(`${API}/users/me`).set(auth(user));

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(user.userId);
    expect(res.body.data.email).toBe(user.email);
  });

  it('rejects a missing token', async () => {
    const res = await api.get(`${API}/users/me`);
    expect(res.status).toBe(401);
  });

  it('rejects a garbage token', async () => {
    const res = await api.get(`${API}/users/me`).set({ Authorization: 'Bearer garbage' });
    expect(res.status).toBe(401);
  });

  it('rejects an API key without an x-org-id header', async () => {
    const user = await createTestUser(api);
    const created = await api.post(`${API}/api-keys`).set(auth(user)).send({ name: 'k' });
    expect(created.status).toBe(201);

    const res = await api.get(`${API}/users/me`).set({ 'x-api-key': created.body.data.plainKey });
    expect(res.status).toBe(401);
  });
});

describe('POST /users/me/change-password', () => {
  it('changes the password and invalidates the old one', async () => {
    const user = await createTestUser(api);
    const newPassword = 'BrandNewSecret456!';

    const changed = await api
      .post(`${API}/users/me/change-password`)
      .set(auth(user))
      .send({ currentPassword: TEST_PASSWORD, newPassword });
    expect(changed.status).toBe(200);

    const oldLogin = await api.post(`${API}/auth/login`).send({ email: user.email, password: TEST_PASSWORD });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api.post(`${API}/auth/login`).send({ email: user.email, password: newPassword });
    expect(newLogin.status).toBe(200);
  });

  it('rejects a wrong current password', async () => {
    const user = await createTestUser(api);
    const res = await api
      .post(`${API}/users/me/change-password`)
      .set(auth(user))
      .send({ currentPassword: 'WrongPassword123!', newPassword: 'BrandNewSecret456!' });

    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

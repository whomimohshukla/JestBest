import { oauthService } from '../../../src/services/auth/oauthService';
import { env } from '../../../src/config/environment';
import { UpstreamError } from '../../../src/utils/errors';

/**
 * Unit-level coverage for the Google OAuth provider. These never touch the
 * network: `fetch` is mocked, and integration tests cover the authorize route.
 * Run with the rest of the suite (`npm test` is `--runInBand`).
 */

const API = `${env.API_ORIGIN}${env.API_PREFIX}`;

describe('oauthService google provider', () => {
  describe('getProviderConfig', () => {
    it('returns a config when GOOGLE_* vars are present', () => {
      const config = oauthService.getProviderConfig('google');

      expect(config).not.toBeNull();
      expect(config?.clientId).toBe(env.GOOGLE_CLIENT_ID);
      expect(config?.clientSecret).toBe(env.GOOGLE_CLIENT_SECRET);
      expect(config?.callbackUrl).toBe(`${API}/auth/oauth/google/callback`);
    });

    it('returns null for github when no GITHUB_* vars are set', () => {
      // jest.setup.js only configures Google, never GitHub, so this documents
      // the unconfigured branch of the same switch.
      expect(oauthService.getProviderConfig('github')).toBeNull();
    });

    it('returns null for a provider with no switch case', () => {
      expect(oauthService.getProviderConfig('jira')).toBeNull();
    });
  });

  describe('getAuthorizationUrl', () => {
    it('builds a well-formed Google consent URL', () => {
      const url = oauthService.getAuthorizationUrl('google', 'state-123');

      expect(url.startsWith('https://accounts.google.com/o/oauth2/v2/auth?')).toBe(true);
      expect(url).toContain(`client_id=${env.GOOGLE_CLIENT_ID}`);
      expect(url).toContain(`redirect_uri=${encodeURIComponent(`${API}/auth/oauth/google/callback`)}`);
      expect(url).toContain('response_type=code');
      expect(url).toContain(`scope=${encodeURIComponent('openid email profile')}`);
      expect(url).toContain('prompt=select_account');
      expect(url).toContain('state=state-123');
    });

    it('throws when the provider is not configured', () => {
      expect(() => oauthService.getAuthorizationUrl('jira', 'state-123')).toThrow(UpstreamError);
      expect(() => oauthService.getAuthorizationUrl('github', 'state-123')).toThrow(UpstreamError);
    });
  });

  describe('exchangeCode', () => {
    const googleToken = { access_token: 'google-access-token', id_token: 'x', expires_in: 3600 };
    const googleUser = {
      sub: 'google-subject-42',
      email: 'google.user@example.com',
      name: 'Google User',
      picture: 'https://example.com/avatar.png',
      email_verified: true,
    };

    let fetchMock: jest.Mock;

    beforeEach(() => {
      fetchMock = jest.fn();
      (global as { fetch: unknown }).fetch = fetchMock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('exchanges a code for a profile via the token + userinfo endpoints', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => googleToken })
        .mockResolvedValueOnce({ ok: true, json: async () => googleUser });

      const profile = await oauthService.exchangeCode('google', 'the-code');

      expect(profile).toEqual({
        providerUserId: 'google-subject-42',
        email: 'google.user@example.com',
        name: 'Google User',
        avatar: 'https://example.com/avatar.png',
      });

      // Token call carries the client credentials and the code.
      const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
      expect(tokenUrl).toBe('https://oauth2.googleapis.com/token');
      const body = (tokenInit as RequestInit).body as URLSearchParams;
      expect(body.get('code')).toBe('the-code');
      expect(body.get('client_id')).toBe(env.GOOGLE_CLIENT_ID);
      expect(body.get('redirect_uri')).toBe(`${API}/auth/oauth/google/callback`);
      expect(body.get('grant_type')).toBe('authorization_code');

      // Userinfo call is authenticated with the access token.
      const [, userInit] = fetchMock.mock.calls[1];
      expect((userInit.headers as Record<string, string>).Authorization).toBe('Bearer google-access-token');
    });

    it('falls back to the email prefix when Google returns no name', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => googleToken })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ...googleUser, name: undefined }) });

      const profile = await oauthService.exchangeCode('google', 'the-code');

      expect(profile.name).toBe('google.user');
    });

    it('throws when Google declines the token exchange', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) });

      await expect(oauthService.exchangeCode('google', 'the-code')).rejects.toThrow(UpstreamError);
    });

    it('throws when the token response omits an access token', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ error: 'invalid_grant' }),
      });

      await expect(oauthService.exchangeCode('google', 'the-code')).rejects.toThrow('No access token');
    });

    it('throws when Google returns no verified email', async () => {
      fetchMock
        .mockResolvedValueOnce({ ok: true, json: async () => googleToken })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ ...googleUser, email: undefined }) });

      await expect(oauthService.exchangeCode('google', 'the-code')).rejects.toThrow(/email/i);
    });

    it('rejects a provider that is not configured before any network call', async () => {
      await expect(oauthService.exchangeCode('github', 'the-code')).rejects.toThrow(UpstreamError);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

import { env } from '../../config/environment';
import { logger } from '../../config/logger';
import { UpstreamError } from '../../utils/errors';

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
}

export interface OAuthUserProfile {
  email: string;
  name: string;
  avatar?: string;
  providerUserId: string;
}

export const oauthService = {
  getProviderConfig(provider: 'github' | 'google' | 'jira' | 'slack'): OAuthProviderConfig | null {
    switch (provider) {
      case 'github':
        if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;
        return {
          clientId: env.GITHUB_CLIENT_ID,
          clientSecret: env.GITHUB_CLIENT_SECRET,
          // Must point at this API's callback route. It previously fell back to
          // a path on the SPA, and .env.example pointed at an
          // `/integrations/github/callback` route that does not exist, so GitHub
          // redirected to a 404 and sign-in could never complete.
          callbackUrl:
            env.GITHUB_OAUTH_CALLBACK_URL ?? `${env.API_ORIGIN}${env.API_PREFIX}/auth/oauth/github/callback`,
        };
      case 'google':
        if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;
        return {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
          callbackUrl:
            env.GOOGLE_OAUTH_CALLBACK_URL ?? `${env.API_ORIGIN}${env.API_PREFIX}/auth/oauth/google/callback`,
        };
      default:
        return null;
    }
  },

  getAuthorizationUrl(provider: 'github' | 'google' | 'jira' | 'slack', state: string): string {
    const config = oauthService.getProviderConfig(provider);
    if (!config) {
      throw new UpstreamError(`${provider} OAuth is not configured`);
    }
    switch (provider) {
      case 'github':
        return `https://github.com/login/oauth/authorize?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.callbackUrl)}&scope=repo&state=${state}`;
      case 'google':
        return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.callbackUrl)}&response_type=code&scope=${encodeURIComponent('openid email profile')}&prompt=select_account&state=${state}`;
      default:
        throw new UpstreamError(`${provider} OAuth is not supported yet`);
    }
  },

  async exchangeCode(provider: 'github' | 'google', code: string): Promise<OAuthUserProfile> {
    const config = oauthService.getProviderConfig(provider);
    if (!config) {
      throw new UpstreamError(`${provider} OAuth is not configured`);
    }
    logger.info({ provider }, 'exchanging oauth code');

    if (provider === 'github') {
      return await oauthService.exchangeGitHubCode(code, config);
    }

    if (provider === 'google') {
      return await oauthService.exchangeGoogleCode(code, config);
    }

    throw new UpstreamError(`${provider} OAuth exchange is not implemented`);
  },

  async exchangeGitHubCode(code: string, config: OAuthProviderConfig): Promise<OAuthUserProfile> {
    try {
      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.callbackUrl,
        }),
      });

      if (!tokenResponse.ok) {
        throw new UpstreamError('Failed to exchange GitHub code for token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new UpstreamError('No access token received from GitHub');
      }

      // Get user information
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!userResponse.ok) {
        throw new UpstreamError('Failed to fetch GitHub user information');
      }

      const githubUser = await userResponse.json();

      // Get user email if not public
      let email = githubUser.email;
      if (!email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });

        if (emailResponse.ok) {
          const emails = await emailResponse.json();
          const primaryEmail = emails.find((e: any) => e.primary && e.verified);
          email = primaryEmail?.email || emails.find((e: any) => e.verified)?.email;
        }
      }

      if (!email) {
        throw new UpstreamError('Could not retrieve verified email from GitHub account');
      }

      logger.info({ email, provider: 'github' }, 'GitHub OAuth successful');

      return {
        providerUserId: String(githubUser.id),
        email,
        name: githubUser.name || githubUser.login,
        avatar: githubUser.avatar_url,
      };
    } catch (error) {
      logger.error({ error, provider: 'github' }, 'GitHub OAuth exchange failed');
      throw error;
    }
  },

  async exchangeGoogleCode(code: string, config: OAuthProviderConfig): Promise<OAuthUserProfile> {
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          redirect_uri: config.callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        throw new UpstreamError('Failed to exchange Google code for token');
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        throw new UpstreamError('No access token received from Google');
      }

      const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!userResponse.ok) {
        throw new UpstreamError('Failed to fetch Google user information');
      }

      const user = await userResponse.json();

      if (!user.email) {
        throw new UpstreamError('Could not retrieve a verified email from your Google account');
      }

      logger.info({ email: user.email, provider: 'google' }, 'Google OAuth successful');

      return {
        providerUserId: String(user.sub),
        email: user.email,
        name: user.name || user.email.split('@')[0],
        avatar: user.picture,
      };
    } catch (error) {
      logger.error({ error, provider: 'google' }, 'Google OAuth exchange failed');
      throw error;
    }
  },
};

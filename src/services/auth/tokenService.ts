import { randomUUID, randomBytes, createHash } from 'crypto';
import { signToken, verifyToken } from '../../utils/jwt';
import { getRedis } from '../../config/redis';
import { prisma } from '../../config/database';
import { env } from '../../config/environment';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import type { JwtPayload, TokenPair } from '../../types/auth.types';
import type { RoleName } from '../../constants/roles';

const REFRESH_PREFIX = 'auth:refresh:';
const USER_TOKENS_PREFIX = 'auth:user-tokens:';
const BLACKLIST_PREFIX = 'auth:blacklist:';
const RESET_PREFIX = 'auth:reset:';
const PASSWORD_VERSION_PREFIX = 'auth:password-version:';
/** Spent refresh-token jtis, kept briefly so a replay can be detected. */
const CONSUMED_PREFIX = 'auth:refresh-consumed:';
/** Pending OAuth hand-offs between the provider redirect and the SPA. */
const OAUTH_EXCHANGE_PREFIX = 'auth:oauth-exchange:';
const OAUTH_EXCHANGE_TTL_SECONDS = 5 * 60;

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
};

const remainingTtl = (exp?: number): number => {
  if (!exp || !Number.isFinite(exp)) return 15 * 60;
  return Math.max(60, exp - Math.floor(Date.now() / 1000));
};

/** Keep the password version at least as long as the longest access-token TTL. */
const PASSWORD_VERSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Current password version for a user; 0 when the key is absent. */
const passwordVersionOf = async (userId: string): Promise<number> => {
  const raw = await getRedis().get(`${PASSWORD_VERSION_PREFIX}${userId}`);
  return toNumber(raw);
};

const expiryToSeconds = (value: string): number => {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) return 3600;
  const n = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return Math.max(60, n * multiplier);
};

const passwordResetTtlSeconds = (): number => expiryToSeconds(env.PASSWORD_RESET_EXPIRES_IN);

const recordUserToken = async (userId: string, jti: string, ttl: number): Promise<void> => {
  const redis = getRedis();
  await redis.sadd(`${USER_TOKENS_PREFIX}${userId}`, jti);
  await redis.expire(`${USER_TOKENS_PREFIX}${userId}`, ttl);
};

const forgetUserToken = async (userId: string, jti: string): Promise<void> => {
  const redis = getRedis();
  await redis.srem(`${USER_TOKENS_PREFIX}${userId}`, jti);
};

export interface IssueOptions {
  userId: string;
  orgId: string;
  roles: RoleName[];
}

export interface RefreshResult {
  tokens: TokenPair;
}

export const tokenService = {
  issue: async (options: IssueOptions): Promise<TokenPair> => {
    const jti = randomUUID();
    const basePayload: JwtPayload = {
      sub: options.userId,
      orgId: options.orgId,
      roles: options.roles,
      type: 'access',
      jti,
      pv: await passwordVersionOf(options.userId),
    };
    const accessToken = signToken(basePayload, 'access');

    const refreshPayload: JwtPayload = {
      ...basePayload,
      type: 'refresh',
      jti,
    };
    const refreshToken = signToken(refreshPayload, 'refresh');

    const redis = getRedis();
    const expiresInSeconds = 7 * 24 * 60 * 60;
    await redis.set(
      `${REFRESH_PREFIX}${jti}`,
      JSON.stringify({ userId: options.userId, orgId: options.orgId }),
      'EX',
      expiresInSeconds
    );
    await recordUserToken(options.userId, jti, expiresInSeconds);

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60,
      tokenType: 'Bearer',
    };
  },

  refresh: async (refreshToken: string): Promise<RefreshResult> => {
    let payload: JwtPayload;
    try {
      payload = verifyToken(refreshToken, 'refresh');
    } catch {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    if (payload.type !== 'refresh' || !payload.jti) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const redis = getRedis();
    // GETDEL is atomic: a plain GET followed by DEL let two concurrent requests
    // carrying the same refresh token both pass the check and both receive a
    // fresh pair, silently forking one session into two live ones.
    const stored = await redis.getdel(`${REFRESH_PREFIX}${payload.jti}`);
    if (!stored) {
      // A jti that is absent but recorded as already consumed means this token
      // was replayed after a successful rotation — i.e. it was stolen. Retire
      // every session the user has so the thief and the victim are separated
      // and both are forced to re-authenticate.
      const consumedBy = await redis.get(`${CONSUMED_PREFIX}${payload.jti}`);
      if (consumedBy && consumedBy === payload.sub) {
        await tokenService.revokeAllForUser(String(payload.sub));
        await redis.del(`${CONSUMED_PREFIX}${payload.jti}`);
      }
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const data = JSON.parse(stored) as { userId: string; orgId: string };
    if (data.userId !== payload.sub) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    await forgetUserToken(data.userId, payload.jti);
    // Remember that this jti was spent, for reuse detection above.
    await redis.set(`${CONSUMED_PREFIX}${payload.jti}`, String(payload.sub), 'EX', remainingTtl(payload.exp));

    // Re-read the role from the live membership instead of propagating the
    // `roles` claim. The claim is a snapshot from whenever the token was minted
    // and each refresh re-armed its TTL, so forwarding it let a demoted member
    // refresh indefinitely and keep their old role forever.
    const membership = await prisma.membership.findFirst({
      where: { userId: data.userId, organizationId: data.orgId, deletedAt: null },
      select: { role: true },
    });
    if (!membership) {
      // Removed from the organization since the token was issued.
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const tokens = await tokenService.issue({
      userId: data.userId,
      orgId: data.orgId,
      roles: [membership.role],
    });

    return { tokens };
  },

  /**
   * Mint a short-lived, single-use token that stands in for a provider's OAuth
   * authorization code on the trip back to the SPA. The code has already been
   * exchanged by the time the browser is redirected, so the SPA cannot present
   * it again — it presents this instead and receives the session at
   * `POST /auth/oauth/exchange`.
   */
  issueOAuthExchangeToken: async (options: IssueOptions): Promise<string> => {
    const jti = randomUUID();
    const token = signToken({ sub: '', orgId: '', roles: [], type: 'oauth-exchange', jti }, 'access');
    await getRedis().set(
      `${OAUTH_EXCHANGE_PREFIX}${jti}`,
      JSON.stringify(options),
      'EX',
      OAUTH_EXCHANGE_TTL_SECONDS
    );
    return token;
  },

  /**
   * Redeem an exchange token for a real session. GETDEL is atomic, so the token
   * works exactly once and a leaked callback URL cannot be replayed.
   */
  redeemOAuthExchangeToken: async (token: string): Promise<{ tokens: TokenPair; userId: string }> => {
    let payload: JwtPayload;
    try {
      payload = verifyToken(token, 'access');
    } catch {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }
    if (payload.type !== 'oauth-exchange' || !payload.jti) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const raw = await getRedis().getdel(`${OAUTH_EXCHANGE_PREFIX}${payload.jti}`);
    if (!raw) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const options = JSON.parse(raw) as IssueOptions;
    return { tokens: await tokenService.issue(options), userId: options.userId };
  },

  revokeRefresh: async (refreshToken: string): Promise<void> => {
    try {
      const payload = verifyToken(refreshToken, 'refresh');
      if (payload.jti) {
        const redis = getRedis();
        await redis.del(`${REFRESH_PREFIX}${payload.jti}`);
        await forgetUserToken(String(payload.sub ?? ''), payload.jti);
      }
    } catch {
      return;
    }
  },

  revokeAllForUser: async (userId: string): Promise<void> => {
    const redis = getRedis();
    const jtis = await redis.smembers(`${USER_TOKENS_PREFIX}${userId}`);
    const pipeline = redis.pipeline();
    for (const jti of jtis) {
      pipeline.del(`${REFRESH_PREFIX}${jti}`);
    }
    pipeline.del(`${USER_TOKENS_PREFIX}${userId}`);
    await pipeline.exec();
  },

  blacklistAccess: async (accessToken: string): Promise<void> => {
    try {
      const payload = verifyToken(accessToken, 'access');
      if (payload.jti) {
        const redis = getRedis();
        await redis.set(`${BLACKLIST_PREFIX}${payload.jti}`, '1', 'EX', remainingTtl(toNumber(payload.exp)));
      }
    } catch {
      return;
    }
  },

  /**
   * Mint a password-reset token.
   *
   * The token is purpose-bound (`purpose: 'password-reset'`, empty orgId, no
   * roles) so it can never be mistaken for a session token, and its jti is
   * recorded in Redis so it can be consumed exactly once. It deliberately has
   * its own short expiry rather than borrowing the access-token TTL.
   */
  issuePasswordResetToken: async (userId: string): Promise<string> => {
    const jti = randomUUID();
    const ttl = passwordResetTtlSeconds();
    const token = signToken(
      { sub: userId, orgId: '', roles: [], type: 'access', jti, purpose: 'password-reset' },
      'access'
    );
    await getRedis().set(`${RESET_PREFIX}${jti}`, userId, 'EX', ttl);
    return token;
  },

  /**
   * Validate a reset token and burn it.
   *
   * GETDEL is atomic, so two concurrent requests racing with the same link
   * cannot both succeed. A session access token is rejected here because its
   * purpose is not 'password-reset' — without this check a leaked access token
   * could be escalated into a permanent credential change.
   */
  consumePasswordResetToken: async (token: string): Promise<string> => {
    const payload = verifyToken(token, 'access');
    if (payload.purpose !== 'password-reset' || !payload.jti) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }
    const userId = await getRedis().getdel(`${RESET_PREFIX}${payload.jti}`);
    if (!userId) {
      throw new UnauthorizedError(Messages.AUTH.RESET_TOKEN_USED);
    }
    return userId;
  },

  /**
   * Bump the password version so every access token minted before now stops
   * authenticating, which is what actually revokes a stolen session — refresh
   * tokens are covered separately by revokeAllForUser, but access tokens are
   * stateless. This is a monotonic counter rather than a timestamp because JWT
   * `iat` is only precise to the second: storing "the time of the change" leaves
   * a token minted in that same second indistinguishable from one minted after.
   */
  markPasswordChanged: async (userId: string): Promise<void> => {
    const key = `${PASSWORD_VERSION_PREFIX}${userId}`;
    await getRedis().multi().incr(key).expire(key, PASSWORD_VERSION_TTL_SECONDS).exec();
  },

  /** Password version a token must carry to still be valid. */
  passwordVersion: async (userId: string): Promise<number> => passwordVersionOf(userId),

  generateApiKey: (): string => {
    const entropy = randomBytes(24);
    return `jb_${entropy.toString('base64url')}`;
  },

  hashApiKey: async (apiKey: string): Promise<string> => {
    return createHash('sha256').update(apiKey).digest('hex');
  },
};

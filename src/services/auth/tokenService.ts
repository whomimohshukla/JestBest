import { randomUUID, randomBytes, createHash } from 'crypto';
import { signToken, verifyToken } from '../../utils/jwt';
import { getRedis } from '../../config/redis';
import { env } from '../../config/environment';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import type { JwtPayload, TokenPair } from '../../types/auth.types';
import type { RoleName } from '../../constants/roles';

const REFRESH_PREFIX = 'auth:refresh:';
const USER_TOKENS_PREFIX = 'auth:user-tokens:';
const BLACKLIST_PREFIX = 'auth:blacklist:';
const RESET_PREFIX = 'auth:reset:';
const PASSWORD_EPOCH_PREFIX = 'auth:password-epoch:';

const toNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(n) ? n : 0;
};

const remainingTtl = (exp?: number): number => {
  if (!exp || !Number.isFinite(exp)) return 15 * 60;
  return Math.max(60, exp - Math.floor(Date.now() / 1000));
};

/** Keep the password epoch at least as long as the longest access-token TTL. */
const PASSWORD_EPOCH_TTL_SECONDS = 30 * 24 * 60 * 60;

const expiryToSeconds = (value: string): number => {
  const match = /^(\d+)\s*([smhd])$/.exec(value.trim());
  if (!match) return 3600;
  const n = Number.parseInt(match[1], 10);
  const unit = match[2];
  const multiplier = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
  return Math.max(60, n * multiplier);
};

const passwordResetTtlSeconds = (): number =>
  expiryToSeconds(env.PASSWORD_RESET_EXPIRES_IN);

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
    const stored = await redis.get(`${REFRESH_PREFIX}${payload.jti}`);
    if (!stored) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const data = JSON.parse(stored) as { userId: string; orgId: string };
    if (data.userId !== payload.sub) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    await redis.del(`${REFRESH_PREFIX}${payload.jti}`);
    await forgetUserToken(data.userId, payload.jti);
    const tokens = await tokenService.issue({
      userId: data.userId,
      orgId: data.orgId,
      roles: payload.roles,
    });

    return { tokens };
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
   * Record that the password changed at this moment.
   *
   * Access tokens issued before this timestamp stop authenticating, which is
   * what actually revokes a stolen session — refresh tokens are covered
   * separately by revokeAllForUser, but access tokens are stateless.
   */
  markPasswordChanged: async (userId: string): Promise<void> => {
    await getRedis().set(
      `${PASSWORD_EPOCH_PREFIX}${userId}`,
      String(Math.floor(Date.now() / 1000)),
      'EX',
      PASSWORD_EPOCH_TTL_SECONDS
    );
  },

  /** Epoch seconds of the last password change, or 0 if unknown/expired. */
  passwordEpoch: async (userId: string): Promise<number> => {
    const raw = await getRedis().get(`${PASSWORD_EPOCH_PREFIX}${userId}`);
    const value = Number.parseInt(raw ?? '0', 10);
    return Number.isFinite(value) ? value : 0;
  },

  generateApiKey: (): string => {
    const entropy = randomBytes(24);
    return `jb_${entropy.toString('base64url')}`;
  },

  hashApiKey: async (apiKey: string): Promise<string> => {
    return createHash('sha256').update(apiKey).digest('hex');
  },
};

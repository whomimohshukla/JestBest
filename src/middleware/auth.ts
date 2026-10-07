import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { Messages } from '../constants/messages';
import { verifyToken } from '../utils/jwt';
import { getRedis } from '../config/redis';
import { prisma } from '../config/database';
import { tokenService } from '../services/auth/tokenService';
import type { AuthUser } from '../types/auth.types';
import { ROLE_PERMISSIONS, roleHasPermission } from '../constants/roles';
import type { RoleName } from '../constants/roles';

export interface AuthenticateOptions {
  optional?: boolean;
  allowSuspended?: boolean;
}

export const authenticate = (options: AuthenticateOptions = {}) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const apiKeyHeader = req.headers['x-api-key'];
    const header = req.headers.authorization;

    if (apiKeyHeader && typeof apiKeyHeader === 'string' && apiKeyHeader.startsWith('jb_')) {
      return authenticateWithApiKey(req, next, options, apiKeyHeader);
    }

    if (!header || !header.startsWith('Bearer ')) {
      if (options.optional) return next();
      throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
    }
    const token = header.slice('Bearer '.length).trim();
    if (!token) {
      if (options.optional) return next();
      throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
    }

    const payload = verifyToken(token, 'access');

    // Intermediate-purpose tokens (email verification, the 2FA challenge) are
    // signed with the access secret so they can be presented to
    // /auth/verify-email and /auth/2fa/verify, but they must never act as a
    // session. They carry a real orgId and roles, so without this check a
    // `purpose: '2fa'` token is a complete two-factor bypass and a
    // `purpose: 'verification'` token skips email verification.
    if (payload.type !== 'access' || payload.purpose) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const redis = getRedis();
    const blacklisted = await redis.get(`auth:blacklist:${payload.jti ?? ''}`);
    if (blacklisted) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        avatar: true,
        deletedAt: true,
        suspendedUntil: true,
        // `deletedAt: null` is load-bearing: Membership is soft-deleted, so
        // without it a member removed from an organization keeps
        // authenticating against it for as long as their token chain lives.
        memberships: { where: { organizationId: payload.orgId, deletedAt: null } },
      },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now() && !options.allowSuspended) {
      throw new ForbiddenError(Messages.AUTH.ACCOUNT_SUSPENDED_UNTIL(user.suspendedUntil.toISOString()));
    }

    // A password change (or reset) bumps this counter, which retroactively
    // invalidates every access token issued before it. Access tokens are
    // stateless, so revoking refresh tokens alone would leave a stolen access
    // token usable until it expired. Tokens minted before this claim existed
    // carry no `pv` and count as version 0: they keep working until the user's
    // next password change, so deploying this does not sign everyone out.
    const currentVersion = await tokenService.passwordVersion(payload.sub);
    if ((payload.pv ?? 0) !== currentVersion) {
      throw new UnauthorizedError(Messages.AUTH.SESSION_REVOKED);
    }

    const membership = user.memberships[0];
    if (!membership) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    // The live membership row is authoritative, never the `roles` claim. A role
    // demotion (OWNER -> VIEWER) has to take effect immediately, but the claim
    // is baked into the token and lives for its whole TTL, so trusting it let a
    // demoted member keep admin permissions until the token expired.
    const roles: RoleName[] = [membership.role];
    const permissions = Array.from(new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? [])));

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      orgId: payload.orgId,
      roles,
      permissions,
    };

    req.user = authUser;
    req.orgId = payload.orgId;
    return next();
  };
};

const authenticateWithApiKey = async (
  req: Request,
  next: NextFunction,
  options: AuthenticateOptions,
  apiKeyPlain: string
): Promise<void> => {
  try {
    const hash = await tokenService.hashApiKey(apiKeyPlain);
    const record = await prisma.apiKey.findUnique({
      where: { key: hash },
      include: {
        user: { select: { id: true, email: true, name: true, avatar: true, deletedAt: true } },
      },
    });

    if (
      !record ||
      record.revokedAt ||
      (record.expiresAt && record.expiresAt.getTime() < Date.now()) ||
      record.user.deletedAt
    ) {
      if (options.optional) return next();
      throw new UnauthorizedError(Messages.AUTH.INVALID_API_KEY);
    }

    const headerOrg = req.headers['x-org-id'];
    const orgId = typeof headerOrg === 'string' && headerOrg.length > 0 ? headerOrg : undefined;
    if (!orgId) {
      if (options.optional) return next();
      throw new UnauthorizedError(Messages.AUTH.API_KEY_ORG_REQUIRED);
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: record.user.id, organizationId: orgId, deletedAt: null },
    });
    if (!membership) {
      if (options.optional) return next();
      throw new UnauthorizedError(Messages.AUTH.INVALID_API_KEY);
    }

    const permissions = Array.from(new Set(ROLE_PERMISSIONS[membership.role] ?? []));
    req.user = {
      id: record.user.id,
      email: record.user.email,
      name: record.user.name,
      avatar: record.user.avatar,
      orgId,
      roles: [membership.role],
      permissions,
    };
    req.orgId = orgId;

    // Awaited rather than fire-and-forget: an unhandled rejection from this
    // write would otherwise be able to take down the process, and callers that
    // read the key back expect lastUsedAt to be durable.
    await prisma.apiKey.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });
    return next();
  } catch (error) {
    if (options.optional) return next();
    return next(error);
  }
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new UnauthorizedError(Messages.AUTH.UNAUTHORIZED));
  }
  return next();
};

export const hasPermission =
  (permission: string) =>
  (user: AuthUser): boolean => {
    return roleHasPermission(user.roles[0], permission);
  };

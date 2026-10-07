import { signToken, verifyToken } from '../../utils/jwt';
import { ConflictError, ForbiddenError, UnauthorizedError } from '../../utils/errors';
import { env } from '../../config/environment';
import { Messages } from '../../constants/messages';
import { userRepository } from '../../repositories/user.repository';
import { organizationRepository } from '../../repositories/organization.repository';
import { ROLE_PERMISSIONS } from '../../constants/roles';
import { passwordService } from './passwordService';
import { tokenService } from './tokenService';
import { toSlug, resolveUniqueSlug } from '../../utils/helpers';
import { notificationService } from '../notification/notificationService';
import { emailService } from '../notification/emailService';
import { logger } from '../../config/logger';
import type { MembershipRole } from '@prisma/client';
import type {
  TokenPair,
  AuthUser,
  PublicUser,
  JwtPayload,
  LoginResult,
  TwoFactorAuthResult,
  VerificationRequiredAuthResult,
} from '../../types/auth.types';

export interface RegisterParams {
  email: string;
  password: string;
  name?: string;
  organizationName?: string;
}

export interface LoginParams {
  email: string;
  password: string;
}

export interface AuthResult {
  user: PublicUser;
  organization: { id: string; name: string; slug: string; requireTwoFactor: boolean };
  tokens: TokenPair;
}

const toPublicUser = (user: {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  twoFactorEnabled?: boolean;
  suspendedUntil?: Date | null;
}): PublicUser => {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    emailVerified: user.emailVerified !== null,
    createdAt: user.createdAt,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    suspendedUntil: user.suspendedUntil ?? null,
  };
};

export const authService = {
  async register(params: RegisterParams): Promise<AuthResult | VerificationRequiredAuthResult> {
    const existing = await userRepository.findActiveByEmail(params.email);
    if (existing) {
      throw new ConflictError(Messages.AUTH.EMAIL_IN_USE);
    }

    const passwordHash = await passwordService.hash(params.password);
    const user = await userRepository.create({
      email: params.email,
      name: params.name,
      passwordHash,
    });

    const orgName = params.organizationName ?? `${params.name ?? 'My'} Workspace`;
    const slugBase = toSlug(orgName) || `org-${user.id.slice(0, 8)}`;
    const uniqueSlug = await resolveUniqueSlug(slugBase, (s) => organizationRepository.slugExists(s));

    const organization = await organizationRepository.create({
      name: orgName,
      slug: uniqueSlug,
    });

    await organizationRepository.addMember({
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER',
    });

    const { billingService } = await import('../billing/billingService');
    await billingService.getOrCreate(organization.id);

    const verificationToken = signToken(
      { sub: user.id, orgId: organization.id, roles: ['OWNER'], type: 'access', purpose: 'verification' },
      'access'
    );
    await notificationService.notifyEmailVerification(user, verificationToken);

    const baseOrg = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      requireTwoFactor: false,
    };

    if (env.REQUIRE_EMAIL_VERIFICATION) {
      return {
        user: toPublicUser(user),
        organization: baseOrg,
        verificationRequired: true,
        verificationToken,
      } satisfies VerificationRequiredAuthResult;
    }

    const tokens = await tokenService.issue({
      userId: user.id,
      orgId: organization.id,
      roles: ['OWNER'],
    });

    return {
      user: toPublicUser(user),
      organization: baseOrg,
      tokens,
    };
  },

  async login(params: LoginParams): Promise<LoginResult> {
    const user = await userRepository.findActiveByEmail(params.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_CREDENTIALS);
    }

    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      throw new ForbiddenError(Messages.AUTH.ACCOUNT_SUSPENDED_UNTIL(user.suspendedUntil.toISOString()));
    }

    const valid = await passwordService.verify(params.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_CREDENTIALS);
    }

    const membership = await organizationRepository.findMembershipByUser(user.id);
    if (!membership) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_CREDENTIALS);
    }

    const org = await organizationRepository.findById(membership.organizationId);
    if (!org) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_CREDENTIALS);
    }

    const permissionRoles: MembershipRole[] = [membership.role];
    const roles = permissionRoles;

    if (env.REQUIRE_EMAIL_VERIFICATION && !user.emailVerified) {
      const verificationToken = signToken(
        { sub: user.id, orgId: org.id, roles, type: 'access', purpose: 'verification' },
        'access'
      );
      return {
        verificationRequired: true,
        verificationToken,
        user: toPublicUser(user),
        organization: { id: org.id, name: org.name, slug: org.slug, requireTwoFactor: org.requireTwoFactor },
      } satisfies VerificationRequiredAuthResult;
    }

    if (user.twoFactorEnabled) {
      const twoFactorToken = signToken(
        { sub: user.id, orgId: org.id, roles, type: 'access', purpose: '2fa' },
        'access'
      );
      return {
        requiresTwoFactor: true,
        twoFactorToken,
        user: toPublicUser(user),
        organization: { id: org.id, name: org.name, slug: org.slug, requireTwoFactor: org.requireTwoFactor },
      } satisfies TwoFactorAuthResult;
    }

    if (org.requireTwoFactor) {
      const { twoFactorService } = await import('./twoFactorService');
      const secret = user.twoFactorSecret ?? twoFactorService.generateSecret();
      if (!user.twoFactorSecret) {
        await userRepository.update(user.id, { twoFactorSecret: secret });
        // The secret is emailed, never returned in the response. Returning it
        // here meant a stolen password was sufficient to enrol an authenticator
        // and take over the account, which is exactly what an org-level 2FA
        // policy is meant to prevent. Possession of the password alone must not
        // be enough, so the enrolment material goes to the verified inbox.
        const otpauthUrl = twoFactorService.generateOtpauthUrl(secret, user.email);
        await emailService
          .sendTwoFactorSetupEmail(user.email, { name: user.name ?? '', secret, otpauthUrl })
          .catch((err: unknown) => {
            logger.error({ err, userId: user.id }, 'failed to email forced 2FA setup');
          });
      }
      const twoFactorToken = signToken(
        { sub: user.id, orgId: org.id, roles, type: 'access', purpose: '2fa' },
        'access'
      );
      return {
        requiresTwoFactor: true,
        twoFactorToken,
        setupRequired: !user.twoFactorSecret,
        user: toPublicUser(user),
        organization: { id: org.id, name: org.name, slug: org.slug, requireTwoFactor: org.requireTwoFactor },
      } satisfies TwoFactorAuthResult;
    }

    const tokens = await tokenService.issue({
      userId: user.id,
      orgId: org.id,
      roles,
    });

    return {
      user: toPublicUser(user),
      organization: { id: org.id, name: org.name, slug: org.slug, requireTwoFactor: org.requireTwoFactor },
      tokens,
    };
  },

  async verifyTwoFactor(twoFactorToken: string, code: string): Promise<AuthResult> {
    const payload = verifyToken(twoFactorToken, 'access');
    if (payload.purpose !== '2fa') {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const user = await userRepository.findActiveById(payload.sub);
    if (!user || !user.twoFactorSecret) {
      throw new UnauthorizedError(Messages.AUTH.TWO_FACTOR_NOT_ENABLED);
    }
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      throw new ForbiddenError(Messages.AUTH.ACCOUNT_SUSPENDED_UNTIL(user.suspendedUntil.toISOString()));
    }

    const { twoFactorService } = await import('./twoFactorService');
    if (!twoFactorService.verify(user.twoFactorSecret, code)) {
      throw new UnauthorizedError(Messages.AUTH.TWO_FACTOR_INVALID);
    }

    if (!user.twoFactorEnabled) {
      await userRepository.update(user.id, { twoFactorEnabled: true });
      user.twoFactorEnabled = true;
    }

    const membership = await organizationRepository.findMembership(payload.orgId, user.id);
    const org = await organizationRepository.findById(payload.orgId);
    if (!membership || !org) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const roles: MembershipRole[] = [membership.role];
    const tokens = await tokenService.issue({
      userId: user.id,
      orgId: org.id,
      roles,
    });

    return {
      user: toPublicUser(user),
      organization: { id: org.id, name: org.name, slug: org.slug, requireTwoFactor: org.requireTwoFactor },
      tokens,
    };
  },

  async logout(accessToken: string | undefined, refreshToken?: string): Promise<void> {
    if (accessToken) {
      await tokenService.blacklistAccess(accessToken);
    }
    if (refreshToken) {
      await tokenService.revokeRefresh(refreshToken);
    }
  },

  /**
   * Move the session into another organization the user belongs to.
   *
   * The access token *is* the tenant boundary: every request is scoped by the
   * orgId claim baked into it, so switching means re-issuing the token pair
   * against a membership that is re-verified here. The caller can therefore
   * only enter an organization they are an active (not soft-deleted) member
   * of, and the refresh token they present is revoked so the previous
   * workspace cannot be reached again by refreshing an old pair.
   */
  async switchOrganization(
    userId: string,
    organizationId: string,
    currentRefreshToken?: string
  ): Promise<AuthResult> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }

    const membership = await organizationRepository.findMembership(organizationId, userId);
    const organization = membership ? await organizationRepository.findById(organizationId) : null;
    if (!membership || !organization) {
      throw new ForbiddenError(Messages.ORG.NOT_MEMBER);
    }

    const roles: MembershipRole[] = [membership.role];
    const tokens = await tokenService.issue({ userId, orgId: organization.id, roles });

    if (currentRefreshToken) {
      // revokeRefresh already swallows an invalid or rotated token, so this is
      // best-effort by construction: a stale refresh token must never fail the
      // switch the user can already see happening.
      await tokenService.revokeRefresh(currentRefreshToken);
    }

    return {
      user: toPublicUser(user),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        requireTwoFactor: organization.requireTwoFactor,
      },
      tokens,
    };
  },

  async refreshTokens(refreshToken: string): Promise<{ user: PublicUser; tokens: TokenPair }> {
    const { tokens } = await tokenService.refresh(refreshToken);
    const payload = verifyToken(tokens.accessToken, 'access');
    const user = await userRepository.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }
    return { user: toPublicUser(user), tokens };
  },

  async verifyEmail(token: string): Promise<void> {
    const payload = verifyToken(token, 'access');
    const user = await userRepository.findActiveById(payload.sub);
    if (!user) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }
    if (user.emailVerified) {
      throw new ConflictError(Messages.AUTH.EMAIL_ALREADY_VERIFIED);
    }
    await userRepository.update(user.id, { emailVerified: new Date() });
  },

  async resendVerification(email: string): Promise<void> {
    const user = await userRepository.findActiveByEmail(email);
    if (!user) {
      return;
    }
    if (user.emailVerified) {
      throw new ConflictError(Messages.AUTH.EMAIL_ALREADY_VERIFIED);
    }
    const token = signToken({ sub: user.id, type: 'verification' } as unknown as JwtPayload, 'access');
    await notificationService.notifyEmailVerification(user, token);
  },

  async buildAuthUser(userId: string, orgId: string): Promise<AuthUser> {
    const user = await userRepository.findActiveById(userId);
    if (!user) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }
    const membership = await organizationRepository.findMembership(orgId, userId);
    if (!membership) {
      throw new UnauthorizedError(Messages.AUTH.INVALID_TOKEN);
    }
    const roles = [membership.role];
    const permissions = Array.from(new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? [])));
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
      orgId,
      roles,
      permissions,
    };
  },
};

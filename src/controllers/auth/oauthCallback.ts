import type { Request, Response } from 'express';
import { oauthService } from '../../services/auth/oauthService';
import { tokenService } from '../../services/auth/tokenService';
import { userRepository } from '../../repositories/user.repository';
import { organizationRepository } from '../../repositories/organization.repository';
import { toSlug, resolveUniqueSlug } from '../../utils/helpers';
import { auditService } from '../../services/audit/auditTrailService';
import { logger } from '../../config/logger';
import { env } from '../../config/environment';
import { ok } from '../../utils/formatters';
import { Messages } from '../../constants/messages';
import type { MembershipRole } from '@prisma/client';

const toPublicUser = (user: {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  avatar: user.avatar,
  emailVerified: user.emailVerified !== null,
  createdAt: user.createdAt,
});

export const oauthCallback = async (req: Request, res: Response): Promise<void> => {
  const { code, error, error_description } = req.query;
  const { provider } = req.params as { provider: string };

  const fail = (code: string, message: string, status = 400) => {
    res.status(status).json({
      success: false,
      error: { code, message },
    });
  };

  if (error) {
    logger.warn({ provider, error, error_description }, 'OAuth error callback');
    fail('oauth_error', String(error_description || error));
    return;
  }

  if (!code || typeof code !== 'string') {
    fail('invalid_request', Messages.AUTH.INVALID_TOKEN);
    return;
  }

  if (provider !== 'github') {
    fail('unsupported_provider', `Provider '${provider}' is not supported`);
    return;
  }

  const isBrowser = req.headers.accept?.includes('text/html');

  const profile = await oauthService.exchangeCode(provider, code);
  const user = await userRepository.findOrCreateFromOAuth(profile);

  let membership = await organizationRepository.findMembershipByUser(user.id);
  if (!membership) {
    const orgName = `${profile.name ?? 'My'} Workspace`;
    const slugBase = toSlug(orgName) || `org-${user.id.slice(0, 8)}`;
    const uniqueSlug = await resolveUniqueSlug(slugBase, (s) => organizationRepository.slugExists(s));

    const organization = await organizationRepository.create({ name: orgName, slug: uniqueSlug });
    await organizationRepository.addMember({
      organizationId: organization.id,
      userId: user.id,
      role: 'OWNER',
    });
    membership = await organizationRepository.findMembershipByUser(user.id);
  }

  const roles: MembershipRole[] = membership ? [membership.role] : ['OWNER'];
  const orgId = membership?.organizationId ?? '';

  const tokens = await tokenService.issue({ userId: user.id, orgId, roles });
  const org = orgId ? await organizationRepository.findById(orgId) : null;

  await auditService.log(
    {
      organizationId: orgId,
      userId: user.id,
      actionType: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: user.id,
      metadata: { action: 'oauth', provider },
    },
    req
  );

  logger.info({ userId: user.id, provider }, 'OAuth login successful');

  if (isBrowser) {
    const frontendUrl = env.FRONTEND_ORIGIN;
    const state = req.query.state && typeof req.query.state === 'string' ? req.query.state : '';
    res.redirect(
      `${frontendUrl}/auth/oauth/callback?provider=${provider}&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
    );
    return;
  }

  res.status(200).json(
    ok({
      user: toPublicUser(user),
      organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      tokens,
    })
  );
};
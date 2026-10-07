import type { Request, Response } from 'express';
import { oauthService } from '../../services/auth/oauthService';
import { tokenService } from '../../services/auth/tokenService';
import { userRepository } from '../../repositories/user.repository';
import { organizationRepository } from '../../repositories/organization.repository';
import { toSlug, resolveUniqueSlug } from '../../utils/helpers';
import { auditService } from '../../services/audit/auditTrailService';
import { logger } from '../../config/logger';
import { env } from '../../config/environment';
import { getRedis } from '../../config/redis';
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

  const isBrowser = req.headers.accept?.includes('text/html');

  const fail = (errorCode: string, message: string, status = 400) => {
    // A browser lands here from a redirect, so a JSON body would be a blank
    // page it cannot read. Send it back to the SPA's callback route instead,
    // which surfaces the failure on the sign-in screen.
    if (isBrowser) {
      const params = new URLSearchParams({ provider, error: errorCode, message });
      res.redirect(`${env.FRONTEND_ORIGIN}/auth/oauth/callback?${params.toString()}`);
      return;
    }
    res.status(status).json({
      success: false,
      error: { code: errorCode, message },
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

  if (provider !== 'github' && provider !== 'google') {
    fail('unsupported_provider', `Provider '${provider}' is not supported`);
    return;
  }

  // Prove the round-trip was initiated here. The state is minted by
  // /oauth/:provider/authorize and consumed atomically (GETDEL), so it is both
  // single-use and bound to this server's own redirect. It used to be optional
  // — the check only ran `if (state)` — which turned CSRF protection into a
  // no-op for any caller that simply dropped the parameter.
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  if (!state) {
    fail(
      'missing_state',
      'This sign-in link is missing its state parameter. Please start the sign-in again.'
    );
    return;
  }
  const known = await getRedis().getdel(`oauth:state:${state}`);
  if (!known) {
    fail('invalid_state', 'This sign-in link has expired or was already used. Please try again.');
    return;
  }

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
    // Hand the SPA a single-use exchange token, never the provider `code`.
    // The code has already been spent above; forwarding it meant the SPA
    // re-POSTed an already-consumed code, the provider rejected the replay, and
    // GitHub sign-in failed for every user. Tokens are minted at exchange time
    // so this path never issues a pair that goes unused.
    const exchangeToken = await tokenService.issueOAuthExchangeToken({
      userId: user.id,
      orgId,
      roles,
    });
    const frontendUrl = env.FRONTEND_ORIGIN;
    res.redirect(
      `${frontendUrl}/auth/oauth/callback?provider=${provider}&exchange=${encodeURIComponent(exchangeToken)}`
    );
    return;
  }

  const tokens = await tokenService.issue({ userId: user.id, orgId, roles });
  res.status(200).json(
    ok({
      user: toPublicUser(user),
      organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      tokens,
    })
  );
};

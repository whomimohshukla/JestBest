import type { Request, Response } from 'express';
import { tokenService } from '../../services/auth/tokenService';
import { userRepository } from '../../repositories/user.repository';
import { organizationRepository } from '../../repositories/organization.repository';
import { auditService } from '../../services/audit/auditTrailService';
import { logger } from '../../config/logger';
import { ok } from '../../utils/formatters';
import { Messages } from '../../constants/messages';

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

/**
 * Redeem the single-use token handed to the SPA by the OAuth callback redirect
 * for a real session. Splitting it out of the callback is what makes the flow
 * work: the provider `code` is single-use and is already spent by the time the
 * browser gets here, so it cannot be what the client exchanges.
 */
export const oauthExchange = async (req: Request, res: Response): Promise<void> => {
  const { exchangeToken } = req.body as { exchangeToken?: string };
  if (!exchangeToken) {
    res
      .status(400)
      .json({ success: false, error: { code: 'invalid_request', message: 'exchangeToken is required' } });
    return;
  }

  const { tokens, userId } = await tokenService.redeemOAuthExchangeToken(exchangeToken);

  const user = await userRepository.findById(userId);
  if (!user) {
    res
      .status(401)
      .json({ success: false, error: { code: 'invalid_token', message: Messages.AUTH.INVALID_TOKEN } });
    return;
  }

  const membership = await organizationRepository.findMembershipByUser(user.id);
  const org = membership ? await organizationRepository.findById(membership.organizationId) : null;

  await auditService.log(
    {
      organizationId: membership?.organizationId ?? '',
      userId: user.id,
      actionType: 'AUTHENTICATION',
      resourceType: 'auth',
      resourceId: user.id,
      metadata: { action: 'oauth.exchange' },
    },
    req
  );

  logger.info({ userId: user.id }, 'OAuth exchange redeemed');

  res.status(200).json(
    ok({
      user: toPublicUser(user),
      organization: org ? { id: org.id, name: org.name, slug: org.slug } : null,
      tokens,
    })
  );
};

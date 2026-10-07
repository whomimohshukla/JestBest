import { Request, Response } from 'express';
import { oauthService } from '../../services/auth/oauthService';
import { UpstreamError } from '../../utils/errors';
import { ok } from '../../utils/formatters';
import { getRedis } from '../../config/redis';
import { randomBytes } from 'crypto';

const SUPPORTED_PROVIDERS = new Set(['github', 'google']);

/** State is valid for the length of a typical provider round-trip. */
const STATE_TTL_SECONDS = 10 * 60;

export const oauthAuthorize = async (req: Request, res: Response): Promise<void> => {
  const { provider } = req.params as { provider: string };

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    throw new UpstreamError(`Provider '${provider}' is not supported`);
  }

  const state = randomBytes(16).toString('hex');

  // The state is recorded server-side so the callback can prove it belongs to a
  // sign-in this server actually started. Without this the value is
  // attacker-supplied and never checked, which is the classic OAuth login-CSRF
  // shape: an attacker completes their own provider login and walks the victim
  // into signing in as the attacker's account.
  await getRedis().set(`oauth:state:${state}`, provider, 'EX', STATE_TTL_SECONDS);

  const url = oauthService.getAuthorizationUrl(provider as 'github' | 'google', state);
  res.status(200).json(ok({ url, state }));
};

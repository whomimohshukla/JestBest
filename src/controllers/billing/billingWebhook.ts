import { Request, Response } from 'express';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { billingService } from '../../services/billing/billingService';

export const billingWebhook = async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['stripe-signature'] as string | undefined;
  if (!signature) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const rawBody = req.rawBody?.toString('utf8');
  if (!rawBody) {
    // Never fall back to re-serializing the parsed body: the signature is
    // computed over the exact bytes the provider sent.
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const result = await billingService.handleStripeWebhook(signature, rawBody);
  res.status(200).json(ok(result));
};

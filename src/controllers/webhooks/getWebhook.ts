import { Request, Response } from 'express';
import { webhookService } from '../../services/webhook/webhookService';
import { ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const getWebhook = async (req: Request, res: Response): Promise<void> => {
  const { webhookId } = req.params as { webhookId: string };
  const webhook = await webhookService.getPublic(webhookId);
  if (req.orgId && webhook.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }
  res.status(200).json(ok(webhook));
};

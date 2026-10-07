import { Request, Response } from 'express';
import { webhookService } from '../../services/webhook/webhookService';
import { UnauthorizedError, ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const redeliverWebhookDelivery = async (req: Request, res: Response): Promise<void> => {
  if (!req.orgId || !req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { webhookId, deliveryId } = req.params as { webhookId: string; deliveryId: string };
  const webhook = await webhookService.get(webhookId);
  if (webhook.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }
  const delivery = await webhookService.redeliver(deliveryId, webhookId);
  res.status(200).json(ok(delivery, { message: Messages.WEBHOOK.DELIVERY_REDELIVERED }));
};

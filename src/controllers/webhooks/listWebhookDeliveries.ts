import { Request, Response } from 'express';
import { webhookService } from '../../services/webhook/webhookService';
import { ForbiddenError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { z } from 'zod';

// Clamped and coerced: `Number(req.query.pageSize)` previously accepted any
// value, so `?pageSize=1000000` exported an entire tenant's delivery history
// and a non-numeric value produced `skip: NaN` and a 500.
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const listWebhookDeliveries = async (req: Request, res: Response): Promise<void> => {
  const { webhookId } = req.params as { webhookId: string };
  const webhook = await webhookService.get(webhookId);
  if (req.orgId && webhook.organizationId !== req.orgId) {
    throw new ForbiddenError(Messages.AUTH.FORBIDDEN);
  }
  const { page, pageSize } = querySchema.parse(req.query ?? {});
  const deliveries = await webhookService.listDeliveries(webhookId, page, pageSize);
  res.status(200).json(ok(deliveries));
};

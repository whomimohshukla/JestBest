import { Request, Response } from 'express';
import { NotFoundError, UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';
import { prisma } from '../../config/database';
import { auditService } from '../../services/audit/auditTrailService';

export const revokeApiKey = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { apiKeyId } = req.params as { apiKeyId: string };
  const apiKey = await prisma.apiKey.updateMany({
    where: { id: apiKeyId, userId: req.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (apiKey.count === 0) {
    throw new NotFoundError(Messages.API_KEY.NOT_FOUND);
  }
  if (req.orgId) {
    await auditService.log(
      {
        organizationId: req.orgId,
        userId: req.user.id,
        actionType: 'DELETE',
        resourceType: 'api_key',
        resourceId: apiKeyId,
      },
      req
    );
  }
  res.status(200).json(ok(null, { message: Messages.API_KEY.REVOKED }));
};

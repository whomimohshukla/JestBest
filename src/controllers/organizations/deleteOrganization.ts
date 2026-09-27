import { Request, Response } from 'express';
import { organizationService } from '../../services/organization/organizationService';
import { UnauthorizedError } from '../../utils/errors';
import { ok } from '../../utils/formatters';
import { Messages } from '../../constants/messages';

export const deleteOrganization = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { organizationId } = req.params as { organizationId: string };
  await organizationService.softDelete(organizationId, req.user.id);
  res.status(200).json(ok(null, { message: Messages.ORG.DELETED }));
};

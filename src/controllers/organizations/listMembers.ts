import { Request, Response } from 'express';
import { organizationService } from '../../services/organization/organizationService';
import { UnauthorizedError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const listMembers = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { organizationId } = req.params as { organizationId: string };
  const members = await organizationService.listMembers(organizationId, req.user.id);
  res.status(200).json(ok(members));
};

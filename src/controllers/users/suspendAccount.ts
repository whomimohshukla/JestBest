import { Request, Response } from 'express';
import { userService } from '../../services/user/userService';
import { UnauthorizedError, BadRequestError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

export const suspendAccount = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { days = 7 } = req.body as { days?: number };
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    throw new BadRequestError('Days must be between 1 and 365.');
  }
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const profile = await userService.suspendUntil(req.user.id, until);
  res.status(200).json(ok(profile, { message: `Account suspended until ${until.toISOString()}.` }));
};

export const reactivateAccount = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const profile = await userService.reactivate(req.user.id);
  res.status(200).json(ok(profile, { message: 'Account reactivated.' }));
};
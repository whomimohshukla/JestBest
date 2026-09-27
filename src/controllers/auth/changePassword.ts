import { Request, Response } from 'express';
import { tokenService } from '../../services/auth/tokenService';
import { userRepository } from '../../repositories/user.repository';
import { passwordService } from '../../services/auth/passwordService';
import { ok } from '../../utils/formatters';
import { UnauthorizedError, BadRequestError } from '../../utils/errors';
import { Messages } from '../../constants/messages';

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  const user = await userRepository.findActiveById(req.user.id);
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const valid = await passwordService.verify(currentPassword, user.passwordHash);
  if (!valid) {
    throw new BadRequestError('Current password is incorrect.');
  }
  const passwordHash = await passwordService.hash(newPassword);
  await userRepository.update(user.id, { passwordHash });
  // Invalidate access tokens minted before this change, not just refresh tokens.
  await tokenService.markPasswordChanged(user.id);
  await tokenService.revokeAllForUser(user.id);
  res.status(200).json(ok(null, { message: Messages.AUTH.PASSWORD_RESET }));
};

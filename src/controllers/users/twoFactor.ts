import { Request, Response } from 'express';
import { userService } from '../../services/user/userService';
import { passwordService } from '../../services/auth/passwordService';
import { twoFactorService } from '../../services/auth/twoFactorService';
import { userRepository } from '../../repositories/user.repository';
import { UnauthorizedError, BadRequestError } from '../../utils/errors';
import { Messages } from '../../constants/messages';
import { ok } from '../../utils/formatters';

const requirePassword = async (userId: string, password: string): Promise<void> => {
  const user = await userRepository.findActiveById(userId);
  if (!user || !user.passwordHash) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  if (!(await passwordService.verify(password, user.passwordHash))) {
    throw new BadRequestError('Current password is incorrect.');
  }
};

export const setupTwoFactor = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { password } = req.body as { password?: string };
  if (!password) {
    throw new BadRequestError('Current password is required.');
  }
  await requirePassword(req.user.id, password);

  const user = await userRepository.findActiveById(req.user.id);
  if (!user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }

  const secret = user.twoFactorSecret ?? twoFactorService.generateSecret();
  const accountName = user.email;
  const otpauthUrl = twoFactorService.generateOtpauthUrl(secret, accountName);
  const qrDataUrl = await twoFactorService.generateQrDataUrl(secret, accountName);

  await userRepository.update(user.id, { twoFactorSecret: secret });
  res.status(200).json(ok({ secret, otpauthUrl, qrDataUrl }));
};

export const enableTwoFactor = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { code } = req.body as { code?: string };
  if (!code) {
    throw new BadRequestError('Verification code is required.');
  }
  const user = await userRepository.findActiveById(req.user.id);
  if (!user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  if (!twoFactorService.verify(user.twoFactorSecret, code)) {
    throw new BadRequestError(Messages.AUTH.TWO_FACTOR_INVALID);
  }
  const profile = await userService.enableTwoFactor(user.id, user.twoFactorSecret!);
  res.status(200).json(ok(profile, { message: 'Two-factor authentication enabled.' }));
};

export const disableTwoFactor = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  const { password, code } = req.body as { password?: string; code?: string };
  if (!password) {
    throw new BadRequestError('Current password is required.');
  }
  await requirePassword(req.user.id, password);

  const user = await userRepository.findActiveById(req.user.id);
  if (!user) {
    throw new UnauthorizedError(Messages.AUTH.UNAUTHORIZED);
  }
  if (user.twoFactorEnabled && code) {
    if (!twoFactorService.verify(user.twoFactorSecret, code)) {
      throw new BadRequestError(Messages.AUTH.TWO_FACTOR_INVALID);
    }
  }
  const profile = await userService.disableTwoFactor(user.id);
  res.status(200).json(ok(profile, { message: 'Two-factor authentication disabled.' }));
};